// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://mariomiqueles.github.io',
  base: '/design-team-claude-class',
  integrations: [tailwind(), mdx()],
});
