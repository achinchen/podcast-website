// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://podcast.achin.me',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
