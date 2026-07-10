# v2 Features Design Spec

**Date:** 2026-07-10  
**Status:** Approved  

## Overview

Three enhancements to the podcast website:
1. Link tree page for social bio sharing
2. Fix content line breaks and timestamp formatting
3. Transcription support (RSS + local files)

---

## Feature 1: Link Tree Page

### Route
`/links`

### Purpose
A standalone page optimized for sharing in Instagram bio and other social profiles. Provides quick access to all listening platforms and social links.

### Layout
- Centered single-column, max-width 400px
- Show cover image (rounded-2xl, 128px width)
- Show name (`a.chin.logs`) + tagline
- Vertical stack of full-width link buttons

### Links (in order)
1. Apple Podcasts
2. Spotify  
3. SoundOn (player link extracted from RSS `<link>`)
4. Instagram

### Styling
- Reuse existing pill-button style from PlatformBadges
- Full-width buttons with platform icon + label
- Brand blue (#2D56A8) background, white text
- Hover: darker blue (#1F3D7A)
- Consistent rounded-2xl corners

### Data Sources
- `src/config.js`: Apple Podcasts, Spotify, Instagram URLs
- RSS feed: SoundOn player URL from `<channel><link>`

### Files
- New: `src/pages/links.astro`
- Update: `src/utils/rss.js` — export feed-level metadata (player URL, cover)

### Constraints
- Zero client JavaScript (static page)
- Exclude from sitemap (optional, social-only page)

---

## Feature 2: Content Line Breaks

### Problem
RSS `<content:encoded>` contains `<br />` tags and newlines, but the rendered show notes display as a continuous block. Timestamps under `📍 本集重點` run together instead of appearing on separate lines.

### Root Cause
1. HTML `<br />` tags render as line breaks, but consecutive `<br /><br />` don't create paragraph-like spacing
2. Plain `\n` newlines in HTML are collapsed to single spaces by default

### Solution

#### CSS Update
Add to `.show-notes` in `src/styles/global.css`:
```css
.show-notes {
  white-space: pre-line;
}
```
This preserves newlines while still wrapping text normally.

#### Content Transform (optional enhancement)
In `src/utils/rss.js` or a new utility:
- Normalize `<br />\n` and `<br/>\n` variations
- Convert `<br /><br />` sequences to `</p><p class="mt-4">` for semantic paragraph breaks
- Ensure timestamp lines are separated properly

### Files
- Update: `src/styles/global.css`
- Optional: `src/utils/content.js` (new transform utility)

### Testing
- Verify EP1 show notes render with proper line breaks
- Timestamps under 📍 appear on separate lines
- Links remain clickable
- Timestamp buttons still function for audio seek

---

## Feature 3: Transcription Support

### Data Sources (priority order)
1. **RSS `<podcast:transcript>`** — Podcasting 2.0 namespace standard
   - SoundOn may add this in future
   - Contains URL to transcript file or inline text
2. **Local markdown file** — manual upload fallback
   - Path: `src/transcripts/{episode-guid}.md`
   - Example: `src/transcripts/8ad0e2df-2d31-4087-9570-8da4a1ce488b.md`

### Why GUID-based filenames
- Stable across title changes
- Matches existing slug derivation pattern
- Avoids filename encoding issues with Chinese titles

### RSS Parser Update
Add to `rss-parser` custom fields in `src/utils/rss.js`:
```javascript
['podcast:transcript', 'transcript']
```

### Transcript Loading Logic
In `getEpisodes()` or separate utility:
1. Check `item.transcript` from RSS
2. If not present, check for local file `src/transcripts/{guid}.md`
3. If found, read and attach to episode object
4. If neither exists, `transcript: null`

### Episode Page Display
New section in `src/pages/episodes/[slug].astro`:
- Heading: "逐字稿 Transcript"
- Collapsible (collapsed by default)
- Click to expand/collapse
- Hidden entirely if no transcript available

### Collapse/Expand Implementation
Minimal client JS using `<details>` + `<summary>` (native HTML):
```html
<details class="transcript-section">
  <summary>逐字稿 Transcript</summary>
  <div class="transcript-content">...</div>
</details>
```
No custom JavaScript required — native browser behavior.

### Files
- Update: `src/utils/rss.js` — add transcript field, load local files
- Update: `src/pages/episodes/[slug].astro` — add transcript section
- New: `src/transcripts/` directory (empty initially, for manual uploads)
- Update: `src/styles/global.css` — transcript section styling

### Future Considerations
- SRT/VTT format support (timed transcripts with audio sync)
- Search across transcripts
- Speaker labels/diarization

---

## Non-Goals

- Automatic transcription generation (use external services manually)
- Transcript editing UI (edit markdown files directly)
- Multi-language transcripts (single language per episode)

---

## Success Criteria

1. `/links` page renders with all platform links, matches brand styling
2. EP1 show notes display with proper line breaks; timestamps on separate lines
3. Episodes with local transcript files show collapsible transcript section
4. Episodes without transcripts show no transcript section
5. All existing tests pass
6. Build succeeds with zero errors
