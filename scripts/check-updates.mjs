/**
 * Checks for new Claude releases using public sources only — no API key required.
 *
 * Strategy:
 *   1. Fetch the @anthropic-ai/sdk npm registry (public, no auth)
 *   2. Compare latest version + publish date against what's already in changelog.json
 *   3. If new version found, add a changelog entry and commit
 *
 * Optional: set NOTIFY_EMAIL (comma-separated) + RESEND_API_KEY to send email alerts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = path.join(__dirname, '../src/data/changelog.json');
const NPM_URL = 'https://registry.npmjs.org/@anthropic-ai/sdk';

async function getLatestSdkRelease() {
  const res = await fetch(NPM_URL);
  if (!res.ok) throw new Error(`npm registry error: ${res.status}`);
  const data = await res.json();

  const latest = data['dist-tags'].latest;
  const publishDate = data.time[latest];
  const description = data.versions[latest]?.description ?? '';

  return { version: latest, date: publishDate.slice(0, 10), description };
}

function buildEntry(sdk) {
  return {
    date: sdk.date,
    version: `SDK v${sdk.version}`,
    title: `Actualización del SDK de Anthropic v${sdk.version}`,
    summary: `Se publicó una nueva versión del SDK de Anthropic (v${sdk.version}). Esto puede incluir soporte para nuevos modelos de Claude, mejoras en la API o correcciones. Revisa los módulos avanzados para ver si hay nuevas funciones que aprender.`,
    modules: ['Módulo 06', 'Módulo 07', 'Módulo 08'],
  };
}

async function sendEmail(entry, emails) {
  if (!process.env.RESEND_API_KEY || !emails.length) return;

  for (const to of emails) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Claude Class <noreply@mariomiqueles.github.io>',
        to,
        subject: `Novedad: ${entry.title}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h1 style="color:#4F6BF0">${entry.title}</h1>
            <p style="color:#6b7280">${entry.date}</p>
            <p style="color:#374151;line-height:1.6">${entry.summary}</p>
            <a href="https://mariomiqueles.github.io/design-team-claude-class/changelog"
               style="background:#4F6BF0;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Ver novedades →
            </a>
          </div>`,
      }),
    });
    if (res.ok) console.log('Email sent to', to);
    else console.error('Email failed to', to, await res.text());
  }
}

async function main() {
  console.log('Checking for Claude/SDK updates (no API key required)...');

  const changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf-8'));
  const sdk = await getLatestSdkRelease();

  console.log(`Latest SDK: v${sdk.version} (${sdk.date})`);

  const alreadyLogged = changelog.some(e =>
    e.version.includes(sdk.version)
  );

  if (alreadyLogged) {
    console.log('Already in changelog. No update needed.');
    return;
  }

  const entry = buildEntry(sdk);
  changelog.unshift(entry);
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2));
  console.log('Changelog updated:', entry.title);

  const emails = (process.env.NOTIFY_EMAIL ?? '')
    .split(',').map(e => e.trim()).filter(Boolean);
  await sendEmail(entry, emails);
}

main().catch(err => { console.error(err); process.exit(1); });
