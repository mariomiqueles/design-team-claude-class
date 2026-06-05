/**
 * Checks the Anthropic changelog for new Claude model releases.
 * If a new entry is found, updates changelog.json and sends an email notification.
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY  — to query Claude for changelog info
 *   RESEND_API_KEY     — to send email notifications
 *   NOTIFY_EMAIL       — comma-separated list of emails to notify
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = path.join(__dirname, '../src/data/changelog.json');

async function fetchLatestClaudeRelease() {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  // Get the most recently created model
  const models = data.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return models[0];
}

async function generateChangelogEntry(model) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: model.id,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are helping maintain a learning website for UX/UI designers about Claude.
A new Claude model was just detected: "${model.display_name || model.id}" (created: ${model.created_at}).

Write a short changelog entry for this model in JSON format with these fields:
- date: today's date in YYYY-MM-DD format
- version: the model name/version
- title: a short title (e.g. "Claude Sonnet 4.6 disponible")
- summary: 2-3 sentences in Spanish explaining what's new and why it matters for UX/UI designers
- modules: array of module names that might need reviewing (e.g. ["Módulo 06", "Módulo 08"])

Respond ONLY with the JSON object, no markdown fences.`
    }],
  });

  return JSON.parse(msg.content[0].text);
}

async function sendEmailNotification(entry, emails) {
  if (!process.env.RESEND_API_KEY || !emails.length) return;

  const emailList = emails.map(to => ({
    from: 'Claude Class <noreply@mariomiqueles.github.io>',
    to,
    subject: `Novedad en Claude: ${entry.title}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #4F6BF0; font-size: 24px; margin-bottom: 8px;">Nueva actualización de Claude</h1>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">${entry.date}</p>

        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; color: #111827; margin-top: 0;">${entry.title}</h2>
          <p style="color: #374151; line-height: 1.6;">${entry.summary}</p>
          ${entry.modules.length ? `
          <p style="color: #6b7280; font-size: 13px; margin-bottom: 6px;">Módulos relacionados:</p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${entry.modules.map(m => `<span style="background: #e0e7ff; color: #4338ca; padding: 4px 10px; border-radius: 6px; font-size: 12px;">${m}</span>`).join('')}
          </div>
          ` : ''}
        </div>

        <a href="https://mariomiqueles.github.io/design-team-claude-class/changelog"
           style="background: #4F6BF0; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ver en el sitio →
        </a>
      </div>
    `,
  }));

  for (const email of emailList) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
    });
    if (!res.ok) {
      console.error('Failed to send email to', email.to, await res.text());
    } else {
      console.log('Email sent to', email.to);
    }
  }
}

async function main() {
  console.log('Checking for Claude updates...');

  const changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf-8'));
  const latestModel = await fetchLatestClaudeRelease();

  console.log('Latest model:', latestModel.id, 'created:', latestModel.created_at);

  // Check if we already have this model in the changelog
  const alreadyLogged = changelog.some(entry =>
    entry.version.toLowerCase().includes(latestModel.id.toLowerCase()) ||
    latestModel.id.toLowerCase().includes(entry.version.toLowerCase().replace(/\s/g, '-'))
  );

  if (alreadyLogged) {
    console.log('No new updates found.');
    return;
  }

  console.log('New model detected! Generating changelog entry...');
  const newEntry = await generateChangelogEntry(latestModel);

  changelog.unshift(newEntry);
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2));
  console.log('Changelog updated:', newEntry.title);

  const emails = (process.env.NOTIFY_EMAIL || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  await sendEmailNotification(newEntry, emails);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
