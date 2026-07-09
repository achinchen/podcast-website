# a.chin.logs Podcast Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the zero-backend, pure-static MVP podcast website for "a.chin.logs" per `spec:2026-07-08.md` (v1.3): RSS-driven Astro SSG with clickable show-note timestamps, platform links, SEO, and cron-based rebuild automation.

**Architecture:** Astro (SSG) fetches the SoundOn RSS feed at build time (`rss-parser`), maps items to episodes with GUID-derived stable slugs, and renders all pages statically. The only client JS is a small timestamp-seek script on episode pages. GitHub Actions polls the feed every 6 hours and triggers a Vercel Deploy Hook when the newest GUID changes.

**Tech Stack:** Astro 5, Tailwind CSS 4 (`@tailwindcss/vite`), rss-parser, @astrojs/sitemap, Vitest (+jsdom for the client script test), GitHub Actions, Vercel.

## Global Constraints

- Show name copy is exactly `a.chin.logs` everywhere (user override of the spec's 《阿晴 Dialogues》). Page `<title>` format: `{單集標題}｜a.chin.logs`.
- RSS is the single source of truth. Feed URL comes from env var `PODCAST_RSS_URL`; when unset, build reads local fixture `src/data/sample-feed.xml` (dev/test mode). No episode database.
- Slug rule: `ep-` + first 8 hex chars of sha256(guid). Slug NEVER derives from title.
- Feed fetch/parse failure must throw and fail the build (fail loudly). Missing individual fields get defaults and never abort the whole parse.
- Timestamp regex, verbatim from spec: `/\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g`. Timestamps become `<button type="button" class="timestamp-link" data-time="...">`, never `<a href="#">`. Text inside `<a>...</a>` must not be transformed.
- Platform links are plain `https://` Universal Links only. No custom schemes, no UA sniffing, no redirect JS.
- Brand tokens (exact): `brand.blue #2D56A8`, `brand.cream #EEEDE9` (site background), `brand.blue-dark #1F3D7A`, `brand.blue-tint` = `#2D56A8` at 8–12% alpha, body text `#2A2A28`. Two-color system only. Big radii (`rounded-2xl`+), pill buttons. Fonts: Baloo 2 (display) + Noto Sans TC.
- Homepage ships zero client JS (spec budget: < 50KB gzip; we ship none). Only episode pages load the timestamp script.
- Pagination: static, 10 episodes per page at `/episodes`, `/episodes/2`, …
- Language: UI copy in Traditional Chinese (`<html lang="zh-Hant">`).
- Node 22. All commits use conventional-commit style messages.
- Values pending real accounts (documented in `src/config.js`, swapped later without code changes elsewhere): Apple Podcasts URL, Spotify URL, Instagram URL, production domain, real `PODCAST_RSS_URL`.

## File Structure

```
package.json, astro.config.mjs        # scaffold + sitemap + tailwind + site URL
src/config.js                         # SITE constants (name, tagline, platform/IG links)
src/styles/global.css                 # Tailwind v4 @theme brand tokens + component classes
src/layouts/Base.astro                # HTML shell, SEO head (OG/Twitter/canonical), header/footer
src/utils/rss.js                      # getEpisodes(), toStableSlug() — build-time only
src/utils/text.js                     # stripHtml(), excerpt()
src/utils/timestamps.js               # transformTimestamps(), toAriaLabel() — build-time only
src/scripts/timestamp-player.js       # toSeconds(), initTimestampPlayer() — the ONLY client JS
src/data/sample-feed.xml              # fixture: 11 episodes incl. edge cases
src/components/PlatformBadges.astro   # Apple/Spotify pill links
src/components/EpisodeCard.astro      # card used by home + list pages
src/pages/index.astro                 # hero + latest 3 + badges
src/pages/episodes/[...page].astro    # paginated list (10/page)
src/pages/episodes/[slug].astro       # player + show notes + JSON-LD
src/pages/404.astro                   # custom 404 → back to /episodes
public/robots.txt
scripts/check-feed.mjs                # CI: compare latest guid vs cache
.feed-cache.json                      # CI cache file (committed)
.github/workflows/check-feed.yml      # cron 6h + deploy hook + failure notify
test/rss.test.js, test/text.test.js, test/timestamps.test.js, test/player.test.js
```

---

### Task 1: Project scaffold, brand theme, base layout

**Files:**
- Create: `package.json`, `astro.config.mjs`, `src/config.js`, `src/styles/global.css`, `src/layouts/Base.astro`, `public/robots.txt`, `.gitignore`, `vitest.config.js`
- Test: `npm run build` succeeds; `npx vitest run` passes (no tests yet → passWithNoTests)

**Interfaces:**
- Produces: `SITE` object from `src/config.js` (`{ name, tagline, url, applePodcasts, spotify, instagram }`); `Base.astro` layout accepting props `{ title?, description?, image?, type? }` with a named `head` slot; Tailwind classes `bg-brand-cream`, `text-brand-blue`, `bg-brand-blue-tint`, `font-display`, `font-body`, and component classes `.badge-pill`, `.timestamp-link`.

- [ ] **Step 1: Initialize repo and scaffold Astro**

```bash
cd /Users/chin/projects/podcast-website
git init
npm create astro@latest . -- --template minimal --no-install --no-git --typescript strict --yes
npm install
npm install rss-parser @astrojs/sitemap tailwindcss @tailwindcss/vite
npm install -D vitest jsdom
git add spec:2026-07-08.md docs/
git commit -m "docs: add v1.3 spec and implementation plan"
```

- [ ] **Step 2: Configure Astro + sitemap + tailwind**

`astro.config.mjs`:
```javascript
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
```

`vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { passWithNoTests: true } });
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Site config**

`src/config.js`:
```javascript
// Single place for values that change when real accounts/domains exist.
export const SITE = {
  name: 'a.chin.logs',
  tagline: '聊聊醫療與生命議題的溫柔對話',
  // Pending real show links — update these when the show is live on each platform:
  applePodcasts: 'https://podcasts.apple.com/tw/podcast/a-chin-logs',
  spotify: 'https://open.spotify.com/show/a-chin-logs',
  instagram: 'https://www.instagram.com/a.chin.logs/',
};
```

- [ ] **Step 4: Brand theme (Tailwind v4 `@theme`) + component classes**

`src/styles/global.css`:
```css
@import "tailwindcss";

@theme {
  --color-brand-blue: #2D56A8;
  --color-brand-blue-dark: #1F3D7A;
  --color-brand-cream: #EEEDE9;
  --color-brand-blue-tint: rgb(45 86 168 / 0.10); /* 8–12% per spec */
  --color-brand-ink: #2A2A28;
  --font-display: "Baloo 2", "Noto Sans TC", sans-serif;
  --font-body: "Noto Sans TC", sans-serif;
}

@layer components {
  .badge-pill {
    @apply inline-flex items-center rounded-full bg-brand-blue px-5 py-2.5
      font-medium text-brand-cream transition-colors hover:bg-brand-blue-dark;
  }
  .timestamp-link {
    @apply inline-flex cursor-pointer items-center rounded-full bg-brand-blue-tint
      px-2 py-0.5 font-medium text-brand-blue transition-colors
      hover:bg-brand-blue hover:text-brand-cream;
  }
  .show-notes a {
    @apply text-brand-blue underline hover:text-brand-blue-dark;
  }
  .show-notes p { @apply my-4; }
}
```

- [ ] **Step 5: Base layout with SEO head**

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import { SITE } from '../config.js';

const {
  title = SITE.name,
  description = SITE.tagline,
  image = null,
  type = 'website',
} = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
const ogImage = image && (image.startsWith('http') ? image : new URL(image, Astro.site).href);
---
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="sitemap" href="/sitemap-index.xml" />
    <meta property="og:site_name" content={SITE.name} />
    <meta property="og:type" content={type} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <slot name="head" />
  </head>
  <body class="min-h-screen bg-brand-cream font-body text-brand-ink">
    <header class="mx-auto flex max-w-3xl items-center justify-between px-4 py-6">
      <a href="/" class="font-display text-2xl font-bold text-brand-blue">{SITE.name}</a>
      <nav>
        <a href="/episodes" class="font-medium text-brand-blue hover:text-brand-blue-dark">單集列表</a>
      </nav>
    </header>
    <main class="mx-auto max-w-3xl px-4 pb-16">
      <slot />
    </main>
    <footer class="mx-auto max-w-3xl px-4 py-8 text-sm">
      <p>
        © {new Date().getFullYear()} {SITE.name} ·
        <a href={SITE.instagram} class="text-brand-blue underline">Instagram</a>
      </p>
    </footer>
  </body>
</html>
```

- [ ] **Step 6: robots.txt**

`public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://a-chin-logs.vercel.app/sitemap-index.xml
```

- [ ] **Step 7: Replace scaffold index page with a minimal placeholder** (rebuilt properly in Task 6)

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base>
  <h1 class="font-display text-4xl font-bold text-brand-blue">a.chin.logs</h1>
</Base>
```

- [ ] **Step 8: Verify build and tests**

Run: `npm run build && npm test`
Expected: build outputs `dist/index.html`, `dist/sitemap-index.xml`; vitest exits 0 (no tests).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Astro site with brand theme and base layout"
```

---

### Task 2: Sample feed fixture + RSS utility (TDD)

**Files:**
- Create: `src/data/sample-feed.xml`, `src/utils/rss.js`, `src/utils/text.js`
- Test: `test/rss.test.js`, `test/text.test.js`

**Interfaces:**
- Produces:
  - `toStableSlug(guid: string): string` → `ep-{8 hex}`; throws on falsy guid.
  - `getEpisodes(rssUrl?: string): Promise<Episode[]>` sorted newest-first. `Episode = { guid, slug, title, descriptionHtml, pubDate: Date, audioUrl: string|null, duration: string|null, cover: string|null }`. Uses `process.env.PODCAST_RSS_URL` when no arg; falls back to fixture when neither set.
  - `stripHtml(html: string): string`, `excerpt(html: string, max = 120): string` from `src/utils/text.js`.

- [ ] **Step 1: Create the fixture feed** (11 episodes → exercises 2-page pagination; EP09 lacks enclosure; EP10 lacks duration; EP05 has its own `itunes:image`; EP11 show notes contain timestamps and a link whose text/href contain a time-like string)

`src/data/sample-feed.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>a.chin.logs</title>
    <link>https://a-chin-logs.vercel.app</link>
    <description>聊聊醫療與生命議題的溫柔對話</description>
    <image>
      <url>https://cdn.example.com/achinlogs/cover-2000.jpg</url>
      <title>a.chin.logs</title>
      <link>https://a-chin-logs.vercel.app</link>
    </image>
    <item>
      <title>EP11 病主法之後：我們如何談死亡</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-000b</guid>
      <pubDate>Tue, 07 Jul 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep11.mp3" length="28311552" type="audio/mpeg"/>
      <itunes:duration>41:07</itunes:duration>
      <description><![CDATA[<p>本集重點：</p><p>02:15 開場閒聊</p><p>15:40 病主法三年回顧</p><p>1:02:30 聽眾來信</p><p>延伸閱讀：<a href="https://example.com/law?t=12:34">病主法 12:34 條文整理</a></p>]]></description>
    </item>
    <item>
      <title>EP10 加護病房的日常</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-000a</guid>
      <pubDate>Tue, 23 Jun 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep10.mp3" length="26214400" type="audio/mpeg"/>
      <description><![CDATA[<p>03:20 值班故事</p><p>21:05 家屬會議怎麼開</p>]]></description>
    </item>
    <item>
      <title>EP09 訪談：安寧居家護理師</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0009</guid>
      <pubDate>Tue, 09 Jun 2026 22:00:00 +0800</pubDate>
      <itunes:duration>38:12</itunes:duration>
      <description><![CDATA[<p>本集音檔重新上架中。</p>]]></description>
    </item>
    <item>
      <title>EP08 醫病溝通的三個誤區</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0008</guid>
      <pubDate>Tue, 26 May 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep08.mp3" length="24117248" type="audio/mpeg"/>
      <itunes:duration>35:44</itunes:duration>
      <description><![CDATA[<p>05:10 誤區一：太快給答案</p>]]></description>
    </item>
    <item>
      <title>EP07 當家人不願意放手</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0007</guid>
      <pubDate>Tue, 12 May 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep07.mp3" length="23068672" type="audio/mpeg"/>
      <itunes:duration>33:02</itunes:duration>
      <description><![CDATA[<p>08:45 個案故事</p>]]></description>
    </item>
    <item>
      <title>EP06 器捐協調師在做什麼</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0006</guid>
      <pubDate>Tue, 28 Apr 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep06.mp3" length="22020096" type="audio/mpeg"/>
      <itunes:duration>31:58</itunes:duration>
      <description><![CDATA[<p>10:00 器捐流程</p>]]></description>
    </item>
    <item>
      <title>EP05 預立醫療決定書怎麼簽</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0005</guid>
      <pubDate>Tue, 14 Apr 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep05.mp3" length="20971520" type="audio/mpeg"/>
      <itunes:duration>29:30</itunes:duration>
      <itunes:image href="https://cdn.example.com/achinlogs/ep05-cover.jpg"/>
      <description><![CDATA[<p>07:22 簽署流程</p>]]></description>
    </item>
    <item>
      <title>EP04 住院醫師的眼淚</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0004</guid>
      <pubDate>Tue, 31 Mar 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep04.mp3" length="19922944" type="audio/mpeg"/>
      <itunes:duration>27:15</itunes:duration>
      <description><![CDATA[<p>04:20 第一次宣告死亡</p>]]></description>
    </item>
    <item>
      <title>EP03 你想在哪裡老去</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0003</guid>
      <pubDate>Tue, 17 Mar 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep03.mp3" length="18874368" type="audio/mpeg"/>
      <itunes:duration>26:40</itunes:duration>
      <description><![CDATA[<p>06:00 長照現場</p>]]></description>
    </item>
    <item>
      <title>EP02 白色巨塔外的溫柔</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0002</guid>
      <pubDate>Tue, 03 Mar 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep02.mp3" length="17825792" type="audio/mpeg"/>
      <itunes:duration>24:12</itunes:duration>
      <description><![CDATA[<p>09:15 護理師視角</p>]]></description>
    </item>
    <item>
      <title>EP01 為什麼開始錄 podcast</title>
      <guid isPermaLink="false">soundon-f3a9c1d2-0001</guid>
      <pubDate>Tue, 17 Feb 2026 22:00:00 +0800</pubDate>
      <enclosure url="https://rss.soundon.fm/audio/ep01.mp3" length="16777216" type="audio/mpeg"/>
      <itunes:duration>22:05</itunes:duration>
      <description><![CDATA[<p>01:30 自我介紹</p>]]></description>
    </item>
  </channel>
</rss>
```

- [ ] **Step 2: Write failing tests**

`test/rss.test.js`:
```javascript
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
```

`test/text.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { stripHtml, excerpt } from '../src/utils/text.js';

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('<p>哈囉  <b>世界</b></p>')).toBe('哈囉 世界');
  });
  it('handles empty input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml(null)).toBe('');
  });
});

describe('excerpt', () => {
  it('truncates to max chars with ellipsis', () => {
    expect(excerpt(`<p>${'字'.repeat(200)}</p>`, 120)).toHaveLength(121); // 120 + '…'
  });
  it('returns short text untouched', () => {
    expect(excerpt('<p>短文</p>', 120)).toBe('短文');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/rss.test.js test/text.test.js`
Expected: FAIL — cannot resolve `../src/utils/rss.js` / `text.js`.

- [ ] **Step 4: Implement `src/utils/rss.js` and `src/utils/text.js`**

`src/utils/rss.js`:
```javascript
// Build-time only. Never import from client scripts.
import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

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
    title: item.title ?? '未命名單集',
    descriptionHtml: item.content ?? '',
    pubDate: new Date(item.pubDate ?? Date.now()),
    audioUrl: item.enclosure?.url ?? null,
    duration: item.duration ?? null,
    cover: item.itunesImage?.$?.href ?? feed.image?.url ?? null,
  };
}

export async function getEpisodes(rssUrl = process.env.PODCAST_RSS_URL) {
  // Fetch/parse failures throw → Astro build fails loudly → Vercel keeps last deploy.
  const feed = rssUrl
    ? await parser.parseURL(rssUrl)
    : await parser.parseString(
        await readFile(new URL('../data/sample-feed.xml', import.meta.url), 'utf8'),
      );
  return feed.items.map((item) => mapItem(item, feed)).sort((a, b) => b.pubDate - a.pubDate);
}
```

`src/utils/text.js`:
```javascript
export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function excerpt(html, max = 120) {
  const text = stripHtml(html);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/rss.test.js test/text.test.js`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/data/sample-feed.xml src/utils/rss.js src/utils/text.js test/rss.test.js test/text.test.js
git commit -m "feat: RSS parsing with GUID-stable slugs and fixture feed"
```

---

### Task 3: Build-time timestamp transform (TDD)

**Files:**
- Create: `src/utils/timestamps.js`
- Test: `test/timestamps.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `transformTimestamps(html: string): string`; `toAriaLabel(time: string): string` (e.g. `"04:20"` → `"跳轉至 4 分 20 秒"` label text is built by caller; this returns `"4 分 20 秒"`).

- [ ] **Step 1: Write failing tests**

`test/timestamps.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { transformTimestamps, toAriaLabel } from '../src/utils/timestamps.js';

describe('toAriaLabel', () => {
  it('MM:SS', () => expect(toAriaLabel('04:20')).toBe('4 分 20 秒'));
  it('HH:MM:SS', () => expect(toAriaLabel('1:04:20')).toBe('1 小時 4 分 20 秒'));
});

describe('transformTimestamps', () => {
  it('wraps MM:SS in a button with data-time and aria-label', () => {
    const out = transformTimestamps('<p>04:20 第一次宣告死亡</p>');
    expect(out).toContain(
      '<button type="button" class="timestamp-link" data-time="04:20" aria-label="跳轉至 4 分 20 秒">04:20</button>',
    );
  });
  it('wraps HH:MM:SS', () => {
    const out = transformTimestamps('<p>1:02:30 聽眾來信</p>');
    expect(out).toContain('data-time="1:02:30"');
  });
  it('does NOT transform text or href inside <a>', () => {
    const html = '<a href="https://example.com/law?t=12:34">病主法 12:34 條文整理</a>';
    expect(transformTimestamps(html)).toBe(html);
  });
  it('transforms outside links while preserving the link', () => {
    const out = transformTimestamps('<p>02:15 開場</p><a href="/x">連結 03:30</a>');
    expect(out).toContain('data-time="02:15"');
    expect(out).toContain('<a href="/x">連結 03:30</a>');
  });
  it('handles empty/null input', () => {
    expect(transformTimestamps('')).toBe('');
    expect(transformTimestamps(null)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/timestamps.test.js`
Expected: FAIL — cannot resolve `../src/utils/timestamps.js`.

- [ ] **Step 3: Implement**

`src/utils/timestamps.js`:
```javascript
// Build-time only: converts MM:SS / HH:MM:SS in show-notes HTML into seek buttons.
// Regex verbatim from spec §3-2.
const TIME_RE = /\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g;
const ANCHOR_RE = /(<a\b[^>]*>[\s\S]*?<\/a>)/gi;

export function toAriaLabel(time) {
  const parts = time.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return h > 0 ? `${h} 小時 ${m} 分 ${s} 秒` : `${m} 分 ${s} 秒`;
}

export function transformTimestamps(html) {
  if (!html) return '';
  // Split on whole <a>…</a> segments (odd indexes) so links are never touched.
  return html
    .split(ANCHOR_RE)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(
            TIME_RE,
            (m) =>
              `<button type="button" class="timestamp-link" data-time="${m}" aria-label="跳轉至 ${toAriaLabel(m)}">${m}</button>`,
          ),
    )
    .join('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/timestamps.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/timestamps.js test/timestamps.test.js
git commit -m "feat: build-time timestamp-to-button transform"
```

---

### Task 4: Client timestamp player script (TDD)

**Files:**
- Create: `src/scripts/timestamp-player.js`
- Test: `test/player.test.js`

**Interfaces:**
- Consumes: DOM produced by Task 3 (`.timestamp-link` buttons with `data-time`) and an `<audio id="main-audio-player">` element (Task 5).
- Produces: `toSeconds(time: string): number`; `initTimestampPlayer(doc = document): void` — installs one delegated click listener.

- [ ] **Step 1: Write failing tests**

`test/player.test.js`:
```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toSeconds, initTimestampPlayer } from '../src/scripts/timestamp-player.js';

describe('toSeconds', () => {
  it('MM:SS', () => expect(toSeconds('04:20')).toBe(260));
  it('HH:MM:SS', () => expect(toSeconds('1:04:20')).toBe(3860));
  it('M:SS', () => expect(toSeconds('0:05')).toBe(5));
});

describe('initTimestampPlayer', () => {
  let audio;
  beforeEach(() => {
    document.body.innerHTML =
      '<button class="timestamp-link" data-time="04:20">04:20</button>';
    audio = {
      readyState: 1,
      duration: 6000,
      currentTime: 0,
      play: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
    };
    vi.spyOn(document, 'getElementById').mockReturnValue(audio);
    initTimestampPlayer(document);
  });

  it('seeks and plays on click when metadata is ready', () => {
    document.querySelector('.timestamp-link').click();
    expect(audio.currentTime).toBe(260);
    expect(audio.play).toHaveBeenCalled();
  });

  it('clamps to duration when timestamp exceeds audio length', () => {
    document.querySelector('.timestamp-link').dataset.time = '2:00:00';
    document.querySelector('.timestamp-link').click();
    expect(audio.currentTime).toBe(6000);
  });

  it('defers seek until loadedmetadata when not ready', () => {
    audio.readyState = 0;
    document.querySelector('.timestamp-link').click();
    expect(audio.addEventListener).toHaveBeenCalledWith(
      'loadedmetadata',
      expect.any(Function),
      { once: true },
    );
    expect(audio.load).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/player.test.js`
Expected: FAIL — cannot resolve `../src/scripts/timestamp-player.js`.

- [ ] **Step 3: Implement**

`src/scripts/timestamp-player.js`:
```javascript
// The ONLY client-side script on the site (episode pages only).
export function toSeconds(time) {
  return time.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export function initTimestampPlayer(doc = document) {
  doc.addEventListener('click', (e) => {
    const btn = e.target.closest('.timestamp-link');
    if (!btn) return;
    const audio = doc.getElementById('main-audio-player');
    if (!audio) return;
    const seconds = toSeconds(btn.dataset.time);
    const seek = () => {
      audio.currentTime = Math.min(seconds, audio.duration || seconds);
      audio.play();
    };
    if (audio.readyState >= 1) {
      seek();
    } else {
      audio.addEventListener('loadedmetadata', seek, { once: true });
      audio.load();
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/player.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/timestamp-player.js test/player.test.js
git commit -m "feat: client timestamp seek script with delegation and clamping"
```

---

### Task 5: Episode detail page with player, show notes, JSON-LD

**Files:**
- Create: `src/components/PlatformBadges.astro`, `src/pages/episodes/[slug].astro`

**Interfaces:**
- Consumes: `getEpisodes()` (Task 2), `transformTimestamps()` (Task 3), `initTimestampPlayer()` (Task 4), `Base.astro` + `SITE` (Task 1), `excerpt()` (Task 2).
- Produces: `PlatformBadges.astro` (no props) — reused by Task 6.

- [ ] **Step 1: PlatformBadges component**

`src/components/PlatformBadges.astro`:
```astro
---
import { SITE } from '../config.js';
---
<div class="flex flex-wrap gap-3">
  <a class="badge-pill" href={SITE.applePodcasts} rel="noopener">在 Apple Podcasts 收聽</a>
  <a class="badge-pill" href={SITE.spotify} rel="noopener">在 Spotify 收聽</a>
</div>
```

- [ ] **Step 2: Episode page**

`src/pages/episodes/[slug].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import PlatformBadges from '../../components/PlatformBadges.astro';
import { getEpisodes } from '../../utils/rss.js';
import { transformTimestamps } from '../../utils/timestamps.js';
import { excerpt } from '../../utils/text.js';
import { SITE } from '../../config.js';

export async function getStaticPaths() {
  const episodes = await getEpisodes();
  return episodes.map((ep) => ({ params: { slug: ep.slug }, props: { ep } }));
}

const { ep } = Astro.props;
const notesHtml = transformTimestamps(ep.descriptionHtml);
const description = excerpt(ep.descriptionHtml, 150);
const dateText = ep.pubDate.toLocaleDateString('zh-TW', {
  year: 'numeric', month: 'long', day: 'numeric',
});

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'PodcastEpisode',
  name: ep.title,
  datePublished: ep.pubDate.toISOString(),
  url: new URL(`/episodes/${ep.slug}`, Astro.site).href,
  ...(ep.audioUrl && {
    associatedMedia: { '@type': 'MediaObject', contentUrl: ep.audioUrl },
  }),
  partOfSeries: { '@type': 'PodcastSeries', name: SITE.name, url: Astro.site?.href },
});
---
<Base title={`${ep.title}｜${SITE.name}`} description={description} image={ep.cover} type="article">
  <script type="application/ld+json" set:html={jsonLd} slot="head" />
  <article>
    <p class="text-sm">{dateText}{ep.duration && ` · ${ep.duration}`}</p>
    <h1 class="mt-2 font-display text-3xl font-bold text-brand-blue">{ep.title}</h1>
    {ep.cover && (
      <img src={ep.cover} alt={`${ep.title} 封面`} width="512" height="512"
        class="mt-6 w-64 rounded-2xl" loading="lazy" />
    )}
    {ep.audioUrl && (
      <audio id="main-audio-player" controls preload="metadata" src={ep.audioUrl}
        class="mt-6 w-full">
        您的瀏覽器不支援音訊播放。
      </audio>
    )}
    <div class="show-notes mt-8" set:html={notesHtml} />
    <hr class="my-10 border-brand-blue-tint" />
    <section class="rounded-2xl bg-brand-blue-tint p-6">
      <h2 class="font-display text-xl font-bold text-brand-blue">在其他平台收聽</h2>
      <div class="mt-4"><PlatformBadges /></div>
      <p class="mt-4 text-sm">
        有想說的話？歡迎到
        <a href={SITE.instagram} class="text-brand-blue underline">Instagram</a>
        私訊我 💬
      </p>
    </section>
  </article>
</Base>
<script>
  import { initTimestampPlayer } from '../../scripts/timestamp-player.js';
  initTimestampPlayer();
</script>
```

- [ ] **Step 3: Verify build output**

Run: `npm run build && ls dist/episodes`
Expected: 11 `ep-*` directories. Then:
Run: `grep -l 'timestamp-link' dist/episodes/ep-*/index.html | wc -l`
Expected: ≥ 10 (every episode with a timestamp in notes). And:
Run: `grep -c 'main-audio-player' "$(grep -rl 'EP09' dist/episodes --include=index.html | head -1)"`
Expected: `0` (EP09 has no enclosure → no player). And:
Run: `grep -o 'PodcastEpisode' dist/episodes/*/index.html | head -1`
Expected: match found (JSON-LD present).

- [ ] **Step 4: Commit**

```bash
git add src/components/PlatformBadges.astro src/pages/episodes/
git commit -m "feat: episode detail page with player, timestamps, JSON-LD"
```

---

### Task 6: Homepage, paginated episode list, 404

**Files:**
- Create: `src/components/EpisodeCard.astro`, `src/pages/episodes/[...page].astro`, `src/pages/404.astro`
- Modify: `src/pages/index.astro` (replace Task 1 placeholder)

**Interfaces:**
- Consumes: `getEpisodes()`, `excerpt()`, `PlatformBadges.astro`, `Base.astro`, `SITE`.
- Produces: `EpisodeCard.astro` with prop `episode` (an `Episode` from Task 2).

- [ ] **Step 1: EpisodeCard component**

`src/components/EpisodeCard.astro`:
```astro
---
import { excerpt } from '../utils/text.js';
const { episode } = Astro.props;
const dateText = episode.pubDate.toLocaleDateString('zh-TW', {
  year: 'numeric', month: 'long', day: 'numeric',
});
---
<article class="rounded-2xl bg-brand-blue-tint p-6 transition-shadow hover:shadow-md">
  <p class="text-sm">{dateText}{episode.duration && ` · ${episode.duration}`}</p>
  <h3 class="mt-1 font-display text-xl font-bold">
    <a href={`/episodes/${episode.slug}`} class="text-brand-blue hover:text-brand-blue-dark">
      {episode.title}
    </a>
  </h3>
  <p class="mt-2">{excerpt(episode.descriptionHtml, 120)}</p>
  <a href={`/episodes/${episode.slug}`}
    class="badge-pill mt-4"
    aria-label={`播放 ${episode.title}`}>▶ 收聽本集</a>
</article>
```

- [ ] **Step 2: Homepage** (zero client JS — "play" buttons link to episode pages)

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import EpisodeCard from '../components/EpisodeCard.astro';
import PlatformBadges from '../components/PlatformBadges.astro';
import { getEpisodes } from '../utils/rss.js';
import { SITE } from '../config.js';
const episodes = await getEpisodes();
const latest = episodes.slice(0, 3);
---
<Base image={episodes[0]?.cover}>
  <section class="py-12 text-center">
    <h1 class="font-display text-5xl font-bold text-brand-blue">{SITE.name}</h1>
    <p class="mx-auto mt-4 max-w-xl text-lg">{SITE.tagline}</p>
    <div class="mt-8 flex justify-center"><PlatformBadges /></div>
  </section>
  <section class="mt-8">
    <h2 class="font-display text-2xl font-bold text-brand-blue">最新單集</h2>
    <div class="mt-6 grid gap-6">
      {latest.map((ep) => <EpisodeCard episode={ep} />)}
    </div>
    <p class="mt-8 text-center">
      <a href="/episodes" class="font-medium text-brand-blue underline hover:text-brand-blue-dark">
        看全部單集 →
      </a>
    </p>
  </section>
</Base>
```

- [ ] **Step 3: Paginated list**

`src/pages/episodes/[...page].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import EpisodeCard from '../../components/EpisodeCard.astro';
import { getEpisodes } from '../../utils/rss.js';
import { SITE } from '../../config.js';

export async function getStaticPaths({ paginate }) {
  const episodes = await getEpisodes();
  return paginate(episodes, { pageSize: 10 });
}
const { page } = Astro.props;
---
<Base title={`全部單集（第 ${page.currentPage} 頁）｜${SITE.name}`}>
  <h1 class="font-display text-3xl font-bold text-brand-blue">全部單集</h1>
  <div class="mt-8 grid gap-6">
    {page.data.map((ep) => <EpisodeCard episode={ep} />)}
  </div>
  <nav class="mt-10 flex items-center justify-between" aria-label="分頁">
    {page.url.prev
      ? <a href={page.url.prev} class="badge-pill">← 較新單集</a>
      : <span />}
    <span class="text-sm">第 {page.currentPage} / {page.lastPage} 頁</span>
    {page.url.next
      ? <a href={page.url.next} class="badge-pill">較舊單集 →</a>
      : <span />}
  </nav>
</Base>
```

- [ ] **Step 4: 404 page**

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { SITE } from '../config.js';
---
<Base title={`找不到頁面｜${SITE.name}`}>
  <section class="py-20 text-center">
    <h1 class="font-display text-4xl font-bold text-brand-blue">404 找不到這一頁</h1>
    <p class="mt-4">這個連結可能已失效，或單集網址有變動。</p>
    <a href="/episodes" class="badge-pill mt-8">瀏覽全部單集</a>
  </section>
</Base>
```

- [ ] **Step 5: Verify build output**

Run: `npm run build && ls dist dist/episodes`
Expected: `dist/index.html`, `dist/404.html`, `dist/episodes/index.html` (page 1, 10 cards), `dist/episodes/2/index.html` (1 card), 11 `ep-*` dirs, `dist/sitemap-index.xml`.
Run: `grep -c '<script' dist/index.html`
Expected: `0` (homepage ships no JS).

- [ ] **Step 6: Commit**

```bash
git add src/components/EpisodeCard.astro src/pages/
git commit -m "feat: homepage, paginated episode list, custom 404"
```

---

### Task 7: CI/CD — feed polling, deploy hook, failure notification

**Files:**
- Create: `scripts/check-feed.mjs`, `.feed-cache.json`, `.github/workflows/check-feed.yml`

**Interfaces:**
- Consumes: env `PODCAST_RSS_URL`; GitHub secrets `PODCAST_RSS_URL`, `VERCEL_DEPLOY_HOOK`, optional `DISCORD_WEBHOOK`.
- Produces: GitHub Actions step output `changed=true|false`; updates `.feed-cache.json` (`{ latestGuid, checkedAt }`).

- [ ] **Step 1: Check-feed script** (compares latest `<guid>` — NOT `lastBuildDate`, per spec §4)

`scripts/check-feed.mjs`:
```javascript
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
```

- [ ] **Step 2: Seed cache file**

`.feed-cache.json`:
```json
{
  "latestGuid": null,
  "checkedAt": null
}
```

- [ ] **Step 3: Workflow**

`.github/workflows/check-feed.yml`:
```yaml
name: Check RSS feed
on:
  schedule:
    - cron: '0 */6 * * *' # every 6 hours per spec §4
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Compare latest episode guid with cache
        id: check
        env:
          PODCAST_RSS_URL: ${{ secrets.PODCAST_RSS_URL }}
        run: node scripts/check-feed.mjs
      - name: Commit cache and trigger Vercel deploy
        if: steps.check.outputs.changed == 'true'
        env:
          DEPLOY_HOOK: ${{ secrets.VERCEL_DEPLOY_HOOK }}
        run: |
          # Hook before cache push: a transient hook failure fails the step
          # before the guid is persisted, so the next run retries the deploy.
          curl -fsS -X POST "$DEPLOY_HOOK"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .feed-cache.json
          git commit -m "chore: new episode detected, update feed cache"
          git push
      - name: Notify on failure
        if: failure()
        env:
          DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
        run: |
          if [ -n "$DISCORD_WEBHOOK" ]; then
            curl -fsS -H 'Content-Type: application/json' \
              -d '{"content":"⚠️ a.chin.logs feed check failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}' \
              "$DISCORD_WEBHOOK"
          else
            echo "DISCORD_WEBHOOK not set; skipping notification."
          fi
```

- [ ] **Step 4: Verify script locally (no env → graceful skip)**

Run: `node scripts/check-feed.mjs`
Expected: prints `PODCAST_RSS_URL not set; nothing to check.` and `changed=false`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-feed.mjs .feed-cache.json .github/
git commit -m "ci: poll RSS feed every 6h and trigger Vercel deploy on new guid"
```

---

### Task 8: Final verification against spec ACs

**Files:** none new — verification only.

- [ ] **Step 1: Full test suite + build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 2: AC — slug stability**

Edit `src/data/sample-feed.xml`: change EP04's `<title>` to `EP04 住院醫師的眼淚（修正版）`. Run `npm run build`; confirm the same `dist/episodes/ep-*/` directory name exists for EP04 (slug unchanged). Revert the edit (`git checkout -- src/data/sample-feed.xml`).

- [ ] **Step 3: AC — build fails loudly on broken feed**

Run: `PODCAST_RSS_URL=https://invalid.example.com/feed.xml npm run build`
Expected: build FAILS with a fetch error (Vercel would keep last deploy).

- [ ] **Step 4: AC — manual browser checks**

Run: `npm run dev`, open an episode page, verify:
- Clicking `02:15` (and `1:02:30` on EP11) seeks the player (audio URLs are fake in fixture — verify `currentTime`/console has no errors; full audio check happens with the real feed).
- The `<a>` link containing `12:34` is intact and clickable.
- Tab focuses timestamp buttons; Enter activates them.
- EP09 page shows no player, no errors.
- 404 page renders at an unknown URL and links to `/episodes`.

- [ ] **Step 5: Commit any fixes; final commit**

```bash
git add -A
git commit -m "chore: final AC verification fixes" # only if fixes were needed
```

---

## Deployment notes (manual, post-plan)

Not automatable from this machine; do when accounts are ready:
1. Push repo to GitHub; import into Vercel (framework: Astro, no adapter needed).
2. Vercel env vars: `PODCAST_RSS_URL` (real SoundOn feed), `PUBLIC_SITE_URL` (production domain).
3. Create a Vercel Deploy Hook; add GitHub secrets `VERCEL_DEPLOY_HOOK`, `PODCAST_RSS_URL`, optional `DISCORD_WEBHOOK`.
4. Update `src/config.js` with real Apple Podcasts / Spotify / Instagram URLs; update `public/robots.txt` sitemap URL to the real domain.
5. Enable Vercel Analytics (or add Plausible) per NFR — dashboard toggle, no code needed for Vercel Analytics on static sites.
6. Do the SoundOn feed field audit from spec §7 (guid format/stability, per-episode `itunes:image`, enclosure CORS/`Range` support) and check for an upload webhook; if available, wire it to the Deploy Hook directly.
7. Replace text logotype and default favicon with the real 《A. Chin. Logs》 logo assets (512px WebP hero, 180px apple-touch-icon) when files are provided.
