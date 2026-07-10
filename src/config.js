// Single place for values that change when real accounts/domains exist.
export const SITE = {
  name: 'a.chin.logs',
  tagline: '聊聊醫療與生命議題的溫柔對話',
  // Production domain pending — keep in sync with `site` in astro.config.mjs.
  url: 'https://a-chin-logs.vercel.app',
  // Pending real show links — update these when the show is live on each platform:
  applePodcasts: 'https://podcasts.apple.com/tw/podcast/a-chin-logs',
  spotify: 'https://open.spotify.com/show/a-chin-logs',
  soundon: '', // Extracted from RSS feed at build time if empty
  instagram: 'https://www.instagram.com/a.chin.logs/',
};
