import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const latestGuid = feed.items[0]?.guid;
if (!latestGuid) throw new Error('Feed has no items or missing guid.');

const prev = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')).latestGuid : null;
const changed = latestGuid !== prev;
if (changed) {
  writeFileSync(
    CACHE,
    `${JSON.stringify({ latestGuid, checkedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
setOutput('changed', String(changed));
