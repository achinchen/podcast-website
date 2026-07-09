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
