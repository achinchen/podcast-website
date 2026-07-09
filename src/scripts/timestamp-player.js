// The ONLY client-side script on the site (episode pages only).
export function toSeconds(time) {
  return time.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export function initTimestampPlayer(doc = document) {
  doc.addEventListener('click', (e) => {
    const btn = e.target.closest('.timestamp-link');
    if (!btn) return;
    const audio = doc.getElementById('main-audio-player');
    if (!audio) return;
    const seconds = toSeconds(btn.dataset.time);
    const seek = () => {
      audio.currentTime = Math.min(seconds, audio.duration || seconds);
      audio.play();
    };
    if (audio.readyState >= 1) {
      seek();
    } else {
      audio.addEventListener('loadedmetadata', seek, { once: true });
      audio.load();
    }
  });
}
