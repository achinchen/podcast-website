# a.chin.logs

Static podcast website built with Astro 5+ and Tailwind 4. Content is driven entirely
by the podcast RSS feed at build time — zero backend, zero client-side data fetching.

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # vitest suite
npm run build   # static build to ./dist/
```

Without `PODCAST_RSS_URL` set, builds and tests use the local fixture
`src/data/sample-feed.xml`.

## Environment variables

- `PODCAST_RSS_URL` — SoundOn RSS feed URL (production builds)
- `PUBLIC_SITE_URL` — production domain (canonical URLs, sitemap, JSON-LD)

## GitHub secrets (feed-check workflow)

- `PODCAST_RSS_URL` — same feed URL as above
- `VERCEL_DEPLOY_HOOK` — deploy hook triggered when the feed changes
- `DISCORD_WEBHOOK` — optional failure notifications

> **Important:** GitHub disables scheduled workflows after ~60 days of repository
> inactivity. Re-enable via the Actions tab or push a commit periodically. The cron
> drives episode updates — a disabled cron means the site stops updating.

## Pending real-account values

Placeholder values live in `src/config.js` (platform links, Instagram) and
`public/robots.txt` (domain). Update them when the real accounts/domain are ready.
