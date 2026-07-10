// Build-time only. Never import from client scripts.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const parser = new Parser({
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:image', 'itunesImage'],
      ['podcast:transcript', 'podcastTranscript'],
    ],
  },
});

export function toStableSlug(guid) {
  if (!guid) throw new Error('Episode is missing <guid>; cannot build a stable slug.');
  const hash = createHash('sha256').update(String(guid)).digest('hex').slice(0, 8);
  return `ep-${hash}`;
}

async function loadLocalTranscript(guid) {
  const path = resolve(process.cwd(), `src/transcripts/${guid}.md`);
  if (!existsSync(path)) return null;
  return await readFile(path, 'utf8');
}

async function mapItem(item, feed) {
  if (!item.enclosure?.url) {
    console.warn(`[rss] Episode "${item.title}" has no enclosure; player will be hidden.`);
  }

  // Transcript: prefer RSS, fallback to local file
  let transcript = null;
  if (item.podcastTranscript) {
    // RSS transcript could be URL or inline text; for now assume inline
    transcript = typeof item.podcastTranscript === 'string'
      ? item.podcastTranscript
      : item.podcastTranscript?.$?.url || null;
  }
  if (!transcript && item.guid) {
    transcript = await loadLocalTranscript(item.guid);
  }

  return {
    guid: item.guid,
    slug: toStableSlug(item.guid),
    title: item.title ?? '未命名單集',
    descriptionHtml: item.content ?? '',
    pubDate: new Date(item.pubDate ?? Date.now()),
    audioUrl: item.enclosure?.url ?? null,
    duration: item.duration ?? null,
    cover: item.itunesImage?.$?.href ?? feed.image?.url ?? null,
    transcript,
  };
}

async function getFeed(rssUrl = process.env.PODCAST_RSS_URL) {
  return rssUrl
    ? await parser.parseURL(rssUrl)
    : await parser.parseString(
        // process.cwd() ensures fixture resolution works from any test working directory
        await readFile(resolve(process.cwd(), 'src/data/sample-feed.xml'), 'utf8'),
      );
}

export async function getEpisodes(rssUrl = process.env.PODCAST_RSS_URL) {
  // Fetch/parse failures throw → Astro build fails loudly → Vercel keeps last deploy.
  const feed = await getFeed(rssUrl);
  const episodes = await Promise.all(feed.items.map((item) => mapItem(item, feed)));
  return episodes.sort((a, b) => b.pubDate - a.pubDate);
}

export async function getFeedMeta(rssUrl = process.env.PODCAST_RSS_URL) {
  const feed = await getFeed(rssUrl);
  return {
    title: feed.title ?? '',
    link: feed.link ?? '',
    cover: feed.image?.url ?? '',
  };
}
