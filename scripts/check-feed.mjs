import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Parser from 'rss-parser';

const CACHE = '.feed-cache.json';

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

const url = process.env.PODCAST_RSS_URL;
if (!url) {
  console.log('PODCAST_RSS_URL not set; nothing to check.');
  setOutput('changed', 'false');
  process.exit(0);
}

const feed = await new Parser().parseURL(url); // throws → job fails → notification
if (!feed.items?.length) throw new Error('Feed has no items.');

// Content-hash comparison over (guid, enclosure url, title, pubDate) of every item
// plus feed-level image/title (spec §4 allows "feed 內容雜湊"; never lastBuildDate).
// Catches new episodes, title fixes, cover swaps, and enclosure-URL changes. The hash
// is item-order-sensitive; a feed reorder just triggers one benign extra deploy.
const feedHash = createHash('sha256')
  .update(
    JSON.stringify([
      feed.items.map((i) => [i.guid, i.enclosure?.url ?? null, i.title ?? null, i.pubDate ?? null]),
      feed.image?.url ?? null,
      feed.title ?? null,
    ]),
  )
  .digest('hex');

const prev = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')).feedHash : null;
const changed = feedHash !== prev;
if (changed) {
  writeFileSync(
    CACHE,
    `${JSON.stringify({ feedHash, checkedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
setOutput('changed', String(changed));
