/**
 * Parse SRT (SubRip) transcript format into structured segments.
 * Each segment has: index, startSeconds, endSeconds, text
 */

/**
 * Convert SRT timestamp (HH:MM:SS,mmm) to seconds
 * @param {string} timestamp - e.g. "00:01:23,456"
 * @returns {number} seconds with millisecond precision
 */
function parseTimestamp(timestamp) {
  const [time, ms] = timestamp.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + (parseInt(ms, 10) || 0) / 1000;
}

/**
 * Format seconds to MM:SS or HH:MM:SS display
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse SRT content into segments
 * @param {string} srtContent - Raw SRT file content
 * @returns {Array<{index: number, startSeconds: number, endSeconds: number, text: string}>}
 */
export function parseSRT(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') return [];
  
  const segments = [];
  // Split by double newline (segment separator), handle both \r\n and \n
  const blocks = srtContent.trim().replace(/\r\n/g, '\n').split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // Line 1: index number
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;
    
    // Line 2: timestamps (00:00:03,547 --> 00:00:06,770)
    const timeLine = lines[1];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    
    const startSeconds = parseTimestamp(timeMatch[1]);
    const endSeconds = parseTimestamp(timeMatch[2]);
    
    // Lines 3+: text content (may span multiple lines)
    const text = lines.slice(2).join(' ').trim();
    if (!text) continue;
    
    segments.push({ index, startSeconds, endSeconds, text });
  }
  
  return segments;
}

/**
 * Group segments into paragraphs based on time intervals
 * @param {Array} segments - Parsed SRT segments
 * @param {number} intervalSeconds - Group segments within this time window (default: 45)
 * @returns {Array<{startSeconds: number, startTime: string, texts: string[]}>}
 */
export function groupIntoParagraphs(segments, intervalSeconds = 45) {
  if (!segments.length) return [];
  
  const paragraphs = [];
  let currentParagraph = {
    startSeconds: segments[0].startSeconds,
    startTime: formatTime(segments[0].startSeconds),
    texts: [segments[0].text],
  };
  let paragraphStart = segments[0].startSeconds;
  
  for (let i = 1; i < segments.length; i++) {
    const curr = segments[i];
    const elapsed = curr.startSeconds - paragraphStart;
    
    if (elapsed > intervalSeconds) {
      // Start new paragraph after interval
      paragraphs.push(currentParagraph);
      currentParagraph = {
        startSeconds: curr.startSeconds,
        startTime: formatTime(curr.startSeconds),
        texts: [curr.text],
      };
      paragraphStart = curr.startSeconds;
    } else {
      // Continue current paragraph
      currentParagraph.texts.push(curr.text);
    }
  }
  
  // Don't forget the last paragraph
  paragraphs.push(currentParagraph);
  
  return paragraphs;
}

/**
 * Transform SRT content into HTML with clickable timestamps
 * @param {string} srtContent - Raw SRT file content
 * @returns {string} HTML string with timestamp buttons and paragraphs
 */
export function srtToHtml(srtContent) {
  const segments = parseSRT(srtContent);
  const paragraphs = groupIntoParagraphs(segments);
  
  if (!paragraphs.length) {
    // Fallback: return content as-is if parsing fails
    return `<p>${srtContent.replace(/\n/g, '<br>')}</p>`;
  }
  
  return paragraphs.map(p => {
    // Use data-time with MM:SS format to match timestamp-player.js
    const timestampBtn = `<button type="button" class="timestamp-link mr-2" data-time="${p.startTime}">${p.startTime}</button>`;
    const text = p.texts.join(' ');
    return `<p class="my-3">${timestampBtn}${text}</p>`;
  }).join('\n');
}

/**
 * Detect if content is SRT format
 * @param {string} content
 * @returns {boolean}
 */
export function isSRT(content) {
  if (!content || typeof content !== 'string') return false;
  // SRT starts with "1" (or number) followed by timestamp line
  const firstLines = content.trim().split('\n').slice(0, 3);
  if (firstLines.length < 2) return false;
  return /^\d+$/.test(firstLines[0].trim()) && 
         /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(firstLines[1]);
}
