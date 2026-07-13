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
