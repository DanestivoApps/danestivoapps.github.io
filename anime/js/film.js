// The film: shot list, camera moves, transitions, post-processing and titles.
import { W, H, clamp, ease, prog, buffer } from './core.js';
import * as fx from './fx.js';
import { cityStrip } from './env.js';
import { SCENES } from './scenes.js';
import { drawTitles, prepareTitles } from './titles.js';

export const DURATION = 60;

// [start, end, scene, options]
export const SHOTS = [
  { id: 'sky', t0: 0, t1: 7.5, scene: 'openingSky' },
  { id: 'gate', t0: 7.5, t1: 13.5, scene: 'gate', xin: { type: 'dissolve', d: 0.9 } },
  { id: 'girlClose', t0: 13.5, t1: 18, scene: 'artGirlClose' },
  { id: 'signal', t0: 18, t1: 20.25, scene: 'signalClose' },
  { id: 'crossing', t0: 20.25, t1: 24, scene: 'crossing' },
  { id: 'boyClose', t0: 24, t1: 27, scene: 'artBoyClose' },
  { id: 'walk', t0: 27, t1: 31.5, scene: 'walk', xin: { type: 'dissolve', d: 0.5 } },
  { id: 'shadows', t0: 31.5, t1: 34.5, scene: 'shadows' },
  { id: 'confess', t0: 34.5, t1: 40.5, scene: 'artConfess' },
  { id: 'boyReply', t0: 40.5, t1: 44.25, scene: 'artBoyReply' },
  { id: 'finale', t0: 44.25, t1: 51.5, scene: 'gateFinale', xin: { type: 'white', d: 0.7 } },
  { id: 'title', t0: 51.5, t1: 60, scene: 'title', xin: { type: 'dissolve', d: 1.2 } },
];

export async function prepare() {
  // warm caches so the first frames don't stutter
  cityStrip('golden', 11, 2600, 360);
  cityStrip('sunset');
  for (const k in SCENES) SCENES[k].prepare?.();
  prepareTitles();
}

function shotAt(T) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (T >= SHOTS[i].t0) return i;
  return 0;
}

function drawShot(i, T, name) {
  const s = SHOTS[i];
  const b = buffer(name);
  const scene = SCENES[s.scene];
  if (scene) scene.draw(b.ctx, T - s.t0, s.t1 - s.t0, T);
  else {
    b.ctx.fillStyle = '#222';
    b.ctx.fillRect(0, 0, W, H);
    b.ctx.fillStyle = '#fff';
    b.ctx.font = '60px sans-serif';
    b.ctx.fillText(s.id, 100, 200);
  }
  return b;
}

export function renderFrame(ctx, T) {
  T = clamp(T, 0, DURATION - 1e-4);
  const i = shotAt(T);
  const s = SHOTS[i];
  const cur = drawShot(i, T, 'shotA');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  const lt = T - s.t0;
  if (s.xin && i > 0 && lt < s.xin.d) {
    const k = lt / s.xin.d;
    if (s.xin.type === 'dissolve') {
      const prev = drawShot(i - 1, T, 'shotB');
      ctx.drawImage(prev.canvas, 0, 0);
      ctx.globalAlpha = ease.inOutSine(k);
      ctx.drawImage(cur.canvas, 0, 0);
      ctx.globalAlpha = 1;
    } else if (s.xin.type === 'white') {
      ctx.drawImage(cur.canvas, 0, 0);
      fx.fadeColor(ctx, '#fff8f0', 1 - ease.outCubic(k));
    }
  } else {
    ctx.drawImage(cur.canvas, 0, 0);
  }
  // white flash leading into the finale
  const next = SHOTS[i + 1];
  if (next && next.xin && next.xin.type === 'white') {
    const pre = 0.35;
    if (T > next.t0 - pre) fx.fadeColor(ctx, '#fff8f0', ease.inCubic((T - (next.t0 - pre)) / pre));
  }
  drawTitles(ctx, T);
  fx.grain(ctx, T, 0.055);
  // global fades
  fx.fadeColor(ctx, '#000', 1 - prog(T, 0, 1.6, ease.inOutSine));
  fx.fadeColor(ctx, '#000', prog(T, DURATION - 1.4, DURATION - 0.05, ease.inOutSine));
}
