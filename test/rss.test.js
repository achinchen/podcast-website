import { describe, it, expect } from 'vitest';
import { getEpisodes, toStableSlug } from '../src/utils/rss.js';

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
  it('parses all 11 episodes sorted newest-first', async () => {
    const eps = await getEpisodes();
    expect(eps).toHaveLength(11);
    expect(eps[0].title).toContain('EP11');
    expect(eps.at(-1).title).toContain('EP01');
  });
  it('derives slug from guid, not title', async () => {
    const eps = await getEpisodes();
    for (const ep of eps) expect(ep.slug).toBe(toStableSlug(ep.guid));
  });
  it('missing enclosure → audioUrl null (EP09)', async () => {
    const eps = await getEpisodes();
    const ep9 = eps.find((e) => e.title.includes('EP09'));
    expect(ep9.audioUrl).toBeNull();
  });
  it('missing itunes:duration → null (EP10)', async () => {
    const eps = await getEpisodes();
    const ep10 = eps.find((e) => e.title.includes('EP10'));
    expect(ep10.duration).toBeNull();
  });
  it('episode-level itunes:image wins, else channel image (EP05 vs EP04)', async () => {
    const eps = await getEpisodes();
    const ep5 = eps.find((e) => e.title.includes('EP05'));
    const ep4 = eps.find((e) => e.title.includes('EP04'));
    expect(ep5.cover).toBe('https://cdn.example.com/achinlogs/ep05-cover.jpg');
    expect(ep4.cover).toBe('https://cdn.example.com/achinlogs/cover-2000.jpg');
  });
  it('keeps show-notes HTML', async () => {
    const eps = await getEpisodes();
    expect(eps[0].descriptionHtml).toContain('<p>');
  });
});
