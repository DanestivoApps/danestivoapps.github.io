// Player: loads assets, syncs the film clock to the soundtrack, and exposes a
// frame-exact render hook for offline video export (?render).
import { W, H } from './core.js';
import { loadAssets } from './assets.js';
import { initFx } from './fx.js';
import { renderFrame, DURATION, prepare } from './film.js';

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
const canvas = document.getElementById('film');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

const ui = {
  overlay: document.getElementById('overlay'),
  play: document.getElementById('play'),
  bar: document.getElementById('bar'),
  load: document.getElementById('load'),
  stage: document.getElementById('stage'),
};
const audio = document.getElementById('music');

async function boot() {
  await Promise.all([
    document.fonts.load('700 40px Shippori', '春風'),
    document.fonts.load('500 30px ZenMaru', 'Aa'),
    document.fonts.load('italic 500 46px Cormorant', 'Ha'),
  ]).catch(() => {});
  await loadAssets('assets', (p) => {
    if (ui.load) ui.load.style.width = `${Math.round(p * 100)}%`;
  });
  initFx();
  await prepare();
  renderFrame(ctx, 0);
}

const ready = boot();

if (renderMode) {
  document.body.classList.add('render');
  window.__film = {
    ready,
    duration: DURATION,
    render: (t) => renderFrame(ctx, t),
  };
} else {
  let playing = false;
  let started = false;
  let clockStart = 0;
  let pausedAt = 0;
  let useAudio = true;

  const now = () => {
    if (useAudio && !audio.paused && audio.readyState >= 2) return audio.currentTime;
    return playing ? (performance.now() - clockStart) / 1000 : pausedAt;
  };

  function frame() {
    if (!playing) return;
    const t = now();
    if (t >= DURATION) {
      renderFrame(ctx, DURATION - 0.001);
      stop(true);
      return;
    }
    renderFrame(ctx, t);
    ui.bar.style.transform = `scaleX(${t / DURATION})`;
    requestAnimationFrame(frame);
  }

  function start(from = 0) {
    playing = true;
    started = true;
    ui.overlay.classList.add('hidden');
    clockStart = performance.now() - from * 1000;
    audio.currentTime = from;
    audio.play().then(
      () => (useAudio = true),
      () => (useAudio = false)
    );
    requestAnimationFrame(frame);
  }

  function stop(ended = false) {
    pausedAt = now();
    playing = false;
    audio.pause();
    if (ended) {
      pausedAt = 0;
      started = false;
      ui.play.textContent = '↻ Ver otra vez';
      ui.overlay.classList.remove('hidden');
    }
  }

  let preferVideo = false;
  ui.play.addEventListener('click', async (e) => {
    e.stopPropagation();
    await ready;
    if (preferVideo) return videoMode();
    start(started ? pausedAt : 0);
  });
  ui.stage.addEventListener('click', () => {
    if (!started) return;
    playing ? stop() : start(pausedAt);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!started) ui.play.click();
      else playing ? stop() : start(pausedAt);
    }
    if (e.key === 'f') document.documentElement.requestFullscreen?.();
  });
  // Devices that can't draw a frame fast enough get the pre-rendered video instead.
  const video = document.getElementById('video');
  function videoMode() {
    document.body.classList.add('videomode');
    ui.overlay.classList.add('hidden');
    audio.pause();
    playing = false;
    video.play().catch(() => {});
  }
  document.getElementById('asvideo').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoMode();
  });
  ready.then(() => {
    const t0 = performance.now();
    for (const t of [9, 15, 36]) renderFrame(ctx, t);
    renderFrame(ctx, 0);
    const ms = (performance.now() - t0) / 4;
    ui.play.disabled = false;
    ui.play.textContent = '▶ Ver el tráiler';
    if (ms > 70 && !params.has('live')) {
      preferVideo = true;
      ui.play.textContent = '▶ Ver el tráiler (vídeo)';
    }
  });
}
