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
    // The phrase 向生活下戰帖 legitimately appears in the prose; assert the
    // heading line itself (with its '#' marker) never leaks into a segment.
    expect(segs.some((s) => s.text.includes('# 向生活下戰帖'))).toBe(false);
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
