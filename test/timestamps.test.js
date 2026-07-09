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
