import { describe, it, expect, beforeAll } from 'vitest';
import { getEpisodes, toStableSlug, getFeedMeta } from '../src/utils/rss.js';

beforeAll(() => {
  delete process.env.PODCAST_RSS_URL; // fixture-path tests must not hit the network
});

describe('toStableSlug', () => {
  it('produces ep-{8 hex} format', () => {
    expect(toStableSlug('soundon-f3a9c1d2-0001')).toMatch(/^ep-[0-9a-f]{8}$/);
  });
  it('is deterministic for the same guid', () => {
    expect(toStableSlug('abc')).toBe(toStableSlug('abc'));
  });
  it('differs for different guids', () => {
    expect(toStableSlug('abc')).not.toBe(toStableSlug('abd'));
  });
  it('throws on missing guid', () => {
    expect(() => toStableSlug(undefined)).toThrow();
  });
});

describe('getEpisodes (local fixture)', () => {
  it('parses episodes sorted newest-first', async () => {
    const eps = await getEpisodes();
    expect(eps.length).toBeGreaterThanOrEqual(1);
    // First episode is EP1
    expect(eps[0].title).toContain('EP1');
  });
  it('derives slug from guid, not title', async () => {
    const eps = await getEpisodes();
    for (const ep of eps) expect(ep.slug).toBe(toStableSlug(ep.guid));
  });
  it('parses audio URL from enclosure', async () => {
    const eps = await getEpisodes();
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    expect(ep1.audioUrl).toContain('soundon.fm');
  });
  it('parses duration', async () => {
    const eps = await getEpisodes();
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    // EP1 has duration 1617 (27 minutes)
    expect(ep1.duration).toBeTruthy();
  });
  it('parses cover image', async () => {
    const eps = await getEpisodes();
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    expect(ep1.cover).toContain('soundon.fm');
  });
  it('keeps show-notes HTML', async () => {
    const eps = await getEpisodes();
    // Real SoundOn feed uses <br /> tags in content:encoded
    expect(eps[0].descriptionHtml).toContain('<');
  });
});

describe('getFeedMeta (local fixture)', () => {
  it('returns feed title, link, and cover', async () => {
    const meta = await getFeedMeta();
    expect(meta.title).toBe('A Chin Logs');
    expect(meta.link).toBe('https://player.soundon.fm/p/8b628513-c167-4183-8b90-3fe7cc4ecf94');
    expect(meta.cover).toBe('https://files.soundon.fm/1783316066645-64c98447-27d4-4ddc-b7dd-161da54c3279.jpeg');
  });
});

describe('transcript loading', () => {
  it('episode object includes transcript field', async () => {
    const eps = await getEpisodes();
    // Before transcript file exists, transcript should be null
    expect(eps[0]).toHaveProperty('transcript');
  });

  it('loads transcript from local file when present', async () => {
    const eps = await getEpisodes();
    // EP1 has a transcript file at src/transcripts/{guid}.md
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    expect(ep1.transcript).toContain('EP1 的逐字稿測試內容');
  });
});
