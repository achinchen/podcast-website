// Build-time only. Never import from client scripts.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:image', 'itunesImage'],
    ],
  },
});

export function toStableSlug(guid) {
  if (!guid) throw new Error('Episode is missing <guid>; cannot build a stable slug.');
  const hash = createHash('sha256').update(String(guid)).digest('hex').slice(0, 8);
  return `ep-${hash}`;
}

function mapItem(item, feed) {
  if (!item.enclosure?.url) {
    console.warn(`[rss] Episode "${item.title}" has no enclosure; player will be hidden.`);
  }
  return {
    guid: item.guid,
    slug: toStableSlug(item.guid),
    title: item.title ?? '未命名',
    descriptionHtml: item.content ?? '',
    pubDate: new Date(item.pubDate ?? Date.now()),
    audioUrl: item.enclosure?.url ?? null,
    duration: item.duration ?? null,
    cover: item.itunesImage?.$?.href ?? feed.image?.url ?? null,
  };
}

async function getFeed(rssUrl = process.env.PODCAST_RSS_URL) {
  return rssUrl
    ? await parser.parseURL(rssUrl)
    : await parser.parseString(
        await readFile(resolve(process.cwd(), 'src/data/sample-feed.xml'), 'utf8'),
      );
}

export async function getEpisodes(rssUrl = process.env.PODCAST_RSS_URL) {
  // Fetch/parse failures throw → Astro build fails loudly → Vercel keeps last deploy.
  const feed = await getFeed(rssUrl);
  return feed.items.map((item) => mapItem(item, feed)).sort((a, b) => b.pubDate - a.pubDate);
}

export async function getFeedMeta(rssUrl = process.env.PODCAST_RSS_URL) {
  const feed = await getFeed(rssUrl);
  return {
    title: feed.title ?? '',
    link: feed.link ?? '',
    cover: feed.image?.url ?? '',
  };
}
