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
