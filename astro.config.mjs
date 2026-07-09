// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Production domain pending — override with PUBLIC_SITE_URL on Vercel.
  site: process.env.PUBLIC_SITE_URL || 'https://a-chin-logs.vercel.app',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
