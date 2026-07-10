// Build-time only: converts MM:SS / HH:MM:SS in show-notes HTML into seek buttons.
// Regex verbatim from spec §3-2.
const TIME_RE = /\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g;
const ANCHOR_RE = /(<a\b[^>]*>[\s\S]*?<\/a>)/gi;
// SoundOn wraps show-note timestamps in dead links (href="0", href="04:20")
// that don't navigate anywhere on our site — an <a> whose entire text is a
// timestamp is one of these, not a real link worth keeping.
const TIMESTAMP_ANCHOR_RE = /^<a\b[^>]*>\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s*<\/a>$/i;

export function toAriaLabel(time) {
  const parts = time.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return h > 0 ? `${h} 小時 ${m} 分 ${s} 秒` : `${m} 分 ${s} 秒`;
}

export function transformTimestamps(html) {
  if (!html) return '';
  // Split on whole <a>…</a> segments (odd indexes) so links are never touched
  // by the plain-text pass below.
  return html
    .split(ANCHOR_RE)
    .map((part, i) => {
      if (i % 2 === 1) {
        return TIMESTAMP_ANCHOR_RE.test(part) ? '' : part;
      }
      return part.replace(
        TIME_RE,
        (m) =>
          `<button type="button" class="timestamp-link" data-time="${m}" aria-label="跳轉至 ${toAriaLabel(m)}">${m}</button>`,
      );
    })
    .join('');
}
