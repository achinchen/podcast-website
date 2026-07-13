# Transcript Multi-Format Support — Design

**Date:** 2026-07-13
**Status:** Approved approach, pending spec review

## Problem

Transcript files arrive in varying formats. The site currently renders only SRT with
clickable timestamps; anything else displays as a raw text blob. A new transcript
(`src/transcripts/text.md`, for an upcoming episode) uses an inline-timestamp style —
`[HH:MM:SS]` markers embedded mid-sentence — which today would render with visible
bracket noise and no click-to-seek.

## Goals

- Render inline-timestamp transcripts with the same UX as SRT: paragraphs with
  clickable timestamp buttons that seek the audio player.
- Keep a single, obvious place to add future formats (formats vary by transcription tool).
- No change to the file-matching convention: transcripts live at
  `src/transcripts/{episode-guid}.md`. `text.md` gets renamed to its episode's GUID
  once that episode is published.

## Non-Goals

- Matching transcripts by filename, title, or frontmatter.
- VTT or other format support (add later via the same dispatch point).
- Transcript search.
- Renaming/wiring `text.md` itself (blocked on episode publish; manual rename).

## Design

### New module: `src/utils/transcript.js`

Single entry point used by the episode page:

```js
transcriptToHtml(content) // → HTML string, or null for empty input
```

Detection order:

1. **SRT** — existing `isSRT()` → existing `srtToHtml()` (both from `src/utils/srt.js`, unchanged).
2. **Inline-timestamped** — new `isInlineTimestamped()` → new `inlineToHtml()`.
3. **Fallback** — plain text wrapped as `<p>…</p>` with newlines converted to `<br>`
   (same as `srtToHtml`'s existing internal fallback). Note: this is a minor change from
   today's behavior, which injects the raw string without line-break handling.

### Inline format parsing

Format characteristics (from the real file):

- Optional markdown heading on the first line (`# 向生活下戰帖`).
- Timestamps appear as `[HH:MM:SS]` (also accept `[MM:SS]`), roughly every 10 seconds,
  often mid-sentence: `我想[00:00:10] 主要我挑戰…`.

Parsing rules:

- Strip leading markdown headings (`#`–`######` lines before body text); the page
  already shows the episode title.
- Split content on the timestamp-marker regex. Text between marker N and marker N+1
  becomes the segment for marker N's time.
- Text before the first marker (if non-empty after heading stripping) becomes a
  segment at `0:00`.
- Detection threshold: at least 3 markers → treated as inline format. Fewer markers
  means brackets are likely literal content; fall through to plain text.

Segments (`{ startSeconds, text }`) are grouped into ~45-second paragraphs by reusing
`groupIntoParagraphs()` from `srt.js`, and rendered with the exact markup `srtToHtml()`
emits today:

```html
<p class="my-3"><button type="button" class="timestamp-link mr-2" data-time="M:SS">M:SS</button>text…</p>
```

`data-time` uses the same `M:SS` / `H:MM:SS` format as SRT rendering (via
`groupIntoParagraphs()`'s `startTime`), which `timestamp-player.js#toSeconds`
already parses.

### Changes to existing files

- `src/utils/srt.js` — no changes. `transcript.js` reuses the already-exported
  `isSRT()`, `srtToHtml()`, and `groupIntoParagraphs()` (whose paragraphs include a
  pre-formatted `startTime`, so no extra export is needed).
- `src/pages/episodes/[slug].astro` — replace the inline
  `isSRT(ep.transcript) ? srtToHtml(...) : ep.transcript` branch with a single
  `transcriptToHtml(ep.transcript)` call.

### Error handling

- Empty/non-string input → `null` (section already hidden by the `ep.transcript &&` guard).
- Inline parse yielding no segments → fall back to plain-text rendering (mirrors
  `srtToHtml`'s existing fallback).
- Malformed timestamps inside brackets are ignored (treated as literal text).

## Testing

New `test/transcript.test.js` (Vitest, same style as `test/rss.test.js`):

- SRT content dispatches to SRT rendering (timestamp buttons present).
- Inline content: heading stripped, mid-sentence markers split correctly,
  paragraphs grouped, `data-time` values correct, `[MM:SS]` variant accepted.
- Text before the first marker lands in a `0:00` segment.
- Plain text (no/few markers) passes through unchanged.
- Empty input returns `null`.

Manual verification: temporarily point EP1's transcript at inline-format content and
confirm click-to-seek works in the browser.

## Operational note

When the episode for `text.md` is published, rename the file to
`src/transcripts/{guid}.md`. No code change needed at that point.
