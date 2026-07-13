# Inline-Timestamp Transcript Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render transcripts with inline `[HH:MM:SS]` timestamps (like `src/transcripts/text.md`) as clickable, paragraph-grouped transcripts — same UX as existing SRT transcripts.

**Architecture:** A new build-time module `src/utils/transcript.js` exposes one entry point, `transcriptToHtml(content)`, that detects the format (SRT → inline-timestamped → plain text) and dispatches. The inline parser converts marker-separated text into `{startSeconds, text}` segments and reuses `groupIntoParagraphs()` from `src/utils/srt.js` plus identical button markup. The episode page swaps its inline `isSRT ? srtToHtml : raw` branch for the single call.

**Tech Stack:** Astro 7 (static build), vanilla JS utils, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-13-transcript-inline-format-design.md`

## Global Constraints

- Node >= 22.12.0, ESM (`"type": "module"`).
- Build-time only code: nothing in `src/utils/` may be imported by client scripts.
- Rendered timestamp buttons must exactly match existing markup: `<button type="button" class="timestamp-link mr-2" data-time="M:SS">M:SS</button>` inside `<p class="my-3">`, since `src/scripts/timestamp-player.js` binds on `.timestamp-link` and parses `data-time` with `toSeconds()`.
- `src/utils/srt.js` must not change (its exports `isSRT`, `srtToHtml`, `parseSRT`, `groupIntoParagraphs` are reused as-is).
- `src/transcripts/text.md` must not be modified or renamed in this plan (rename to `{guid}.md` happens manually after the episode is published).
- Test command: `npx vitest run test/transcript.test.js` (full suite: `npm test`).

---

### Task 1: Inline format detection and parsing

**Files:**
- Create: `src/utils/transcript.js`
- Test: `test/transcript.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `isInlineTimestamped(content: string) -> boolean` — true when content contains >= 3 `[HH:MM:SS]`/`[MM:SS]` markers.
  - `parseInline(content: string) -> Array<{startSeconds: number, text: string}>` — segments in document order; leading markdown headings stripped; text before the first marker becomes a segment at `startSeconds: 0`.

- [ ] **Step 1: Write the failing tests**

Create `test/transcript.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { isInlineTimestamped, parseInline } from '../src/utils/transcript.js';

// Mirrors src/transcripts/text.md: leading heading, markers mid-sentence,
// blank lines between paragraphs.
const INLINE = `# 向生活下戰帖

[00:00:00] 嗨嗨，今天想聊聊向生活下戰帖。為什麼要做挑戰呢？我想[00:00:10] 主要是因為我們渴望改變，[00:00:20] 但卻覺得改變的代價不一定付得起。

[00:01:00] 第二段開始了，這裡是新的段落內容。`;

describe('isInlineTimestamped', () => {
  it('detects content with 3+ bracket markers', () => {
    expect(isInlineTimestamped(INLINE)).toBe(true);
  });
  it('accepts [MM:SS] short markers', () => {
    expect(isInlineTimestamped('[00:00] a [00:10] b [00:20] c')).toBe(true);
  });
  it('rejects plain text and sparse brackets', () => {
    expect(isInlineTimestamped('hello world')).toBe(false);
    expect(isInlineTimestamped('see [00:10] once and [00:20] twice')).toBe(false);
  });
  it('rejects empty / non-string input', () => {
    expect(isInlineTimestamped('')).toBe(false);
    expect(isInlineTimestamped(null)).toBe(false);
  });
});

describe('parseInline', () => {
  it('splits text on markers, assigning text to the preceding timestamp', () => {
    const segs = parseInline(INLINE);
    expect(segs).toEqual([
      { startSeconds: 0, text: '嗨嗨，今天想聊聊向生活下戰帖。為什麼要做挑戰呢？我想' },
      { startSeconds: 10, text: '主要是因為我們渴望改變，' },
      { startSeconds: 20, text: '但卻覺得改變的代價不一定付得起。' },
      { startSeconds: 60, text: '第二段開始了，這裡是新的段落內容。' },
    ]);
  });
  it('strips leading markdown headings', () => {
    const segs = parseInline(INLINE);
    expect(segs.some((s) => s.text.includes('向生活下戰帖'))).toBe(false);
  });
  it('puts text before the first marker into a 0:00 segment', () => {
    const segs = parseInline('開場白 [00:00:10] 正文一 [00:00:20] 正文二');
    expect(segs[0]).toEqual({ startSeconds: 0, text: '開場白' });
    expect(segs[1]).toEqual({ startSeconds: 10, text: '正文一' });
  });
  it('parses [MM:SS] short markers', () => {
    const segs = parseInline('[01:05] hello');
    expect(segs).toEqual([{ startSeconds: 65, text: 'hello' }]);
  });
  it('collapses newlines/blank lines inside segment text to single spaces', () => {
    const segs = parseInline('[00:00:00] line one\n\nline two');
    expect(segs[0].text).toBe('line one line two');
  });
  it('returns [] for empty input', () => {
    expect(parseInline('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/transcript.test.js`
Expected: FAIL — `Cannot find module '../src/utils/transcript.js'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `src/utils/transcript.js`:

```js
// Build-time only: unified transcript rendering with format detection.
// Never import from client scripts.
import { isSRT, srtToHtml, groupIntoParagraphs } from './srt.js';

// Inline markers embedded in prose: [HH:MM:SS] or [MM:SS].
const MARKER_RE = /\[(?:\d{1,2}:)?\d{1,2}:\d{2}\]/g;

// Below this count, brackets are likely literal content, not a transcript format.
const MIN_MARKERS = 3;

/**
 * Detect the inline-timestamp transcript format.
 * @param {string} content
 * @returns {boolean}
 */
export function isInlineTimestamped(content) {
  if (!content || typeof content !== 'string') return false;
  const matches = content.match(MARKER_RE);
  return Boolean(matches && matches.length >= MIN_MARKERS);
}

/** Convert "[HH:MM:SS]" / "[MM:SS]" to seconds. */
function markerToSeconds(marker) {
  return marker
    .slice(1, -1)
    .split(':')
    .map(Number)
    .reduce((acc, n) => acc * 60 + n, 0);
}

/** Drop leading markdown heading lines (and surrounding blank lines). */
function stripLeadingHeadings(content) {
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || /^#{1,6}\s/.test(lines[i].trim()))) {
    i++;
  }
  return lines.slice(i).join('\n');
}

/** Collapse all whitespace runs (incl. newlines) to single spaces. */
function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Parse inline-timestamped content into segments.
 * Text between marker N and marker N+1 belongs to marker N's time.
 * Text before the first marker becomes a segment at 0 seconds.
 * @param {string} content
 * @returns {Array<{startSeconds: number, text: string}>}
 */
export function parseInline(content) {
  if (!content || typeof content !== 'string') return [];
  const body = stripLeadingHeadings(content);
  const segments = [];
  const re = new RegExp(MARKER_RE.source, 'g');
  let sliceStart = 0;
  let currentSeconds = 0; // time owning the text run before the next marker
  let match;
  while ((match = re.exec(body)) !== null) {
    const text = clean(body.slice(sliceStart, match.index));
    if (text) segments.push({ startSeconds: currentSeconds, text });
    currentSeconds = markerToSeconds(match[0]);
    sliceStart = re.lastIndex;
  }
  const tail = clean(body.slice(sliceStart));
  if (tail) segments.push({ startSeconds: currentSeconds, text: tail });
  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/transcript.test.js`
Expected: PASS (all `isInlineTimestamped` and `parseInline` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/utils/transcript.js test/transcript.test.js
git commit -m "feat(transcript): parse inline [HH:MM:SS] timestamp format"
```

---

### Task 2: Unified rendering entry point `transcriptToHtml`

**Files:**
- Modify: `src/utils/transcript.js` (append to file from Task 1)
- Test: `test/transcript.test.js` (append)

**Interfaces:**
- Consumes: `isInlineTimestamped`, `parseInline` (Task 1); `isSRT`, `srtToHtml`, `groupIntoParagraphs` from `src/utils/srt.js`. `groupIntoParagraphs(segments)` returns `Array<{startSeconds, startTime, texts}>` where `startTime` is pre-formatted `M:SS` / `H:MM:SS`.
- Produces: `transcriptToHtml(content: string|null) -> string|null` — HTML string, or `null` for empty/non-string input. This is the only function the episode page (Task 3) calls.

- [ ] **Step 1: Write the failing tests**

Append to `test/transcript.test.js` (add `transcriptToHtml` to the existing import):

```js
import { isInlineTimestamped, parseInline, transcriptToHtml } from '../src/utils/transcript.js';
```

```js
const SRT = `1
00:00:03,547 --> 00:00:06,770
歡迎收聽 a.chin.logs

2
00:00:07,000 --> 00:00:09,500
今天聊聊告別`;

describe('transcriptToHtml', () => {
  it('returns null for empty or non-string input', () => {
    expect(transcriptToHtml(null)).toBe(null);
    expect(transcriptToHtml('')).toBe(null);
    expect(transcriptToHtml(undefined)).toBe(null);
  });

  it('dispatches SRT content to SRT rendering', () => {
    const html = transcriptToHtml(SRT);
    expect(html).toContain('class="timestamp-link mr-2"');
    expect(html).toContain('data-time="0:03"');
    expect(html).toContain('歡迎收聽 a.chin.logs');
  });

  it('renders inline format with clickable, paragraph-grouped timestamps', () => {
    const html = transcriptToHtml(INLINE);
    // Segments at 0/10/20s group into one 0:00 paragraph; 60s starts a new one.
    expect(html).toContain('data-time="0:00"');
    expect(html).toContain('data-time="1:00"');
    expect(html).not.toContain('data-time="0:10"');
    expect(html).toContain('<p class="my-3">');
    // Bracket markers must not leak into the rendered text.
    expect(html).not.toContain('[00:00:10]');
    // Heading is stripped.
    expect(html).not.toContain('向生活下戰帖');
  });

  it('renders plain text as a paragraph with <br> line breaks', () => {
    expect(transcriptToHtml('hello\nworld')).toBe('<p>hello<br>world</p>');
  });

  it('treats sparse-bracket text as plain text', () => {
    const html = transcriptToHtml('note [00:10] once');
    expect(html).toBe('<p>note [00:10] once</p>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/transcript.test.js`
Expected: FAIL — `transcriptToHtml is not a function` (Task 1 tests still PASS).

- [ ] **Step 3: Write the implementation**

Append to `src/utils/transcript.js`:

```js
/** Render grouped paragraphs with the same markup srtToHtml emits. */
function paragraphsToHtml(paragraphs) {
  return paragraphs
    .map((p) => {
      const btn = `<button type="button" class="timestamp-link mr-2" data-time="${p.startTime}">${p.startTime}</button>`;
      return `<p class="my-3">${btn}${p.texts.join(' ')}</p>`;
    })
    .join('\n');
}

/** Plain-text fallback: single paragraph, newlines become <br>. */
function plainToHtml(content) {
  return `<p>${content.replace(/\n/g, '<br>')}</p>`;
}

/**
 * Render any supported transcript format to HTML.
 * Detection order: SRT → inline [HH:MM:SS] → plain text.
 * @param {string|null|undefined} content
 * @returns {string|null} HTML, or null when there is nothing to render
 */
export function transcriptToHtml(content) {
  if (!content || typeof content !== 'string') return null;
  if (isSRT(content)) return srtToHtml(content);
  if (isInlineTimestamped(content)) {
    const paragraphs = groupIntoParagraphs(parseInline(content));
    if (paragraphs.length) return paragraphsToHtml(paragraphs);
  }
  return plainToHtml(content);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/transcript.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/utils/transcript.js test/transcript.test.js
git commit -m "feat(transcript): unified transcriptToHtml with format detection"
```

---

### Task 3: Wire episode page to `transcriptToHtml`

**Files:**
- Modify: `src/pages/episodes/[slug].astro:7,19-22`
- Modify: `test/rss.test.js:78-83`
- Commit (content provided by user, do not edit): `src/transcripts/8ad0e2df-2d31-4087-9570-8da4a1ce488b.md` (now inline format), `src/transcripts/text1.md` (the old SRT, kept for reference)

**Interfaces:**
- Consumes: `transcriptToHtml(content) -> string|null` from `src/utils/transcript.js` (Task 2).
- Produces: episode pages render every transcript format; no other consumers.

**Context:** The user replaced EP1's transcript file (`src/transcripts/8ad0e2df-2d31-4087-9570-8da4a1ce488b.md`) with inline-format content titled `# 向生活下戰帖`, and saved the original SRT to `src/transcripts/text1.md`. These working-tree changes are intentional — commit them as-is, never modify their content. This breaks the old test assertion, fixed in Step 2 below.

- [ ] **Step 1: Update the episode page**

In `src/pages/episodes/[slug].astro`, replace the import (line 7):

```astro
import { isSRT, srtToHtml } from '../../utils/srt.js';
```

with:

```astro
import { transcriptToHtml } from '../../utils/transcript.js';
```

and replace the transform block (lines 19-22):

```astro
// Transform transcript: SRT gets clickable timestamps, plain text stays as-is
const transcriptHtml = ep.transcript && isSRT(ep.transcript)
  ? srtToHtml(ep.transcript)
  : ep.transcript;
```

with:

```astro
// Transform transcript: SRT and inline-timestamp formats get clickable
// timestamps; anything else renders as plain text.
const transcriptHtml = transcriptToHtml(ep.transcript);
```

(The `{ep.transcript && (...)}` guard around the `<details>` section stays as-is.)

- [ ] **Step 2: Update the stale transcript-loading assertion**

In `test/rss.test.js`, replace the second test in `describe('transcript loading', ...)`:

```js
  it('loads transcript from local file when present', async () => {
    const eps = await getEpisodes();
    // EP1 has a transcript file at src/transcripts/{guid}.md (SRT format)
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    expect(ep1.transcript).toContain('a.chin.logs');
  });
```

with:

```js
  it('loads transcript from local file when present', async () => {
    const eps = await getEpisodes();
    // EP1 has a transcript file at src/transcripts/{guid}.md (inline-timestamp format)
    const ep1 = eps.find((e) => e.title.includes('EP1'));
    expect(ep1.transcript).toContain('向生活下戰帖');
  });
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all files including `test/rss.test.js` and `test/transcript.test.js`.

- [ ] **Step 4: Verify the static build**

Run: `npm run build`
Expected: build completes; EP1's page still contains the transcript section. Verify:

```bash
grep -c 'timestamp-link' dist/episodes/*/index.html
```

Expected: a non-zero count for EP1's page.

- [ ] **Step 5: Manual browser check (optional but recommended)**

Start the dev server per AGENTS.md (`astro dev --background`), open EP1's episode page, expand 逐字稿 Transcript, click a timestamp button, and confirm the audio player seeks. Stop with `astro dev stop`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/episodes/[slug].astro test/rss.test.js src/transcripts/8ad0e2df-2d31-4087-9570-8da4a1ce488b.md src/transcripts/text1.md
git commit -m "feat: render all transcript formats via transcriptToHtml on episode pages"
```

---

## Out of scope (from spec)

- Renaming `src/transcripts/text.md` — done manually once its episode is published (`{guid}.md`).
- VTT or additional formats, transcript search, matching by title/frontmatter.
