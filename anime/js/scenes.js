// Procedural scene painters (sky, railway crossing, walk, shadows, title); the shots
// built on the painted key art live in scenes_art.js. Each draws at local time lt.
import { W, H, TAU, clamp, lerp, smoothstep, ease, buffer, rgba, mix, linGrad, radGrad, mulberry32 } from './core.js';
import { A } from './assets.js';
import * as fx from './fx.js';
import * as env from './env.js';
import * as ch from './chars.js';
import { ART_SCENES } from './scenes_art.js';

const { PAL } = env;

function post(ctx, o = {}) {
  fx.bloom(ctx, ctx.canvas, o.bloom || {});
  fx.grade(ctx, o.grade || {});
}

// ------------------------------------------------------------ 1. opening sky
function openingSky(ctx, lt, dur) {
  const img = A.sky.open;
  const p = ease.inOutCubic(clamp(lt / (dur + 0.6)));
  const yTop = lerp(40, img.height - H - 10, p);
  const drift = lt * 6;
  const sx = -(img.width - W) / 2 - drift + 30;
  ctx.drawImage(img, sx, -yTop);
  // distant town rising into frame at the end of the tilt
  const city = env.cityStrip('golden', 11, 2600, 360);
  const baseY = img.height + 10 - yTop;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.drawImage(city, -300 - drift * 1.4, baseY - city.height * 0.6, city.width, city.height * 0.6);
  ctx.fillStyle = PAL.golden.city;
  ctx.fillRect(0, baseY - 2, W, H);
  ctx.restore();
  // sun entering frame
  const sunX = 1560 + sx, sunY = 2930 - yTop;
  const sunVis = smoothstep(H + 500, H - 200, sunY);
  fx.sunGlow(ctx, sunX, sunY, 700, '#fff0d0', 0.7 * sunVis);
  fx.godRays(ctx, sunX, sunY, lt, { n: 16, len: 2200, alpha: 0.12 * sunVis, rot: -Math.PI, spread: Math.PI });
  fx.motes(ctx, lt, { n: 50, alpha: 0.55, size: [2, 6] });
  fx.petals(ctx, lt + 3, { seed: 2, n: 22, vx: 140, vy: -30, size: [16, 28], sway: 50, light: 1 });
  fx.petals(ctx, lt + 1, { seed: 3, n: 3, vx: 520, vy: -120, size: [120, 170], blur: 4, alpha: 0.85, sway: 80 });
  post(ctx, {
    bloom: { strength: 0.4, diffusion: 0.18 },
    grade: { vignette: 0.25, vigColor: '#203070', top: ['#bfe0ff', 0.12], leak: [W, H, 900, '#ffcf9a', 0.35 * sunVis] },
  });
  fx.lensFlare(ctx, sunX, sunY, 0.9 * smoothstep(H + 100, H - 150, sunY), lt);
}

// ------------------------------------------------------------ 4a. crossing signal close-up
const lampOn = (T) => Math.floor(T * 2.3) % 2;

function signalClose(ctx, lt, dur, T) {
  const p = PAL.sunset;
  const sky = A.sky.sunset;
  ctx.save();
  const rot = lerp(-0.07, -0.035, ease.inOutSine(lt / dur));
  const z = lerp(1.0, 1.06, ease.inOutSine(lt / dur));
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(sky, -460, -420, sky.width * 1.12, sky.height * 1.12);
  fx.sunGlow(ctx, 1290, 610, 700, '#fff0d0', 0.55);
  // wires slicing the sky
  const wc = rgba(p.sil, 0.9);
  env.wires(ctx, -200, 160, 2200, 40, 120, wc, 3, 3, 16);
  env.wires(ctx, -200, 330, 2200, 260, 90, wc, 2.5, 2, 12);
  const on = lampOn(T);
  env.crossingSignal(ctx, 860, 1460, 2.15, lt, p, { on, dark: p.sil });
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  env.crossingGlow(ctx, 860, 1460, 2.15, on, 1);
  ctx.restore();
  fx.petals(ctx, lt + 30, { seed: 31, n: 14, vx: -260, vy: 40, size: [16, 30], sway: 30, light: 1 });
  fx.motes(ctx, lt, { n: 30, alpha: 0.4 });
  post(ctx, {
    bloom: { strength: 0.45, threshold: 2.2 },
    grade: { vignette: 0.4, vigColor: '#2a1238', leak: [W, H * 0.6, 900, '#ff9a6a', 0.25] },
  });
  fx.lensFlare(ctx, 1290, 610, 0.5, lt, { ghosts: false });
}

// ------------------------------------------------------------ 4b. the crossing (train passes, boy revealed)
const CROSS_SUN = [1290, 590];
function crossingSet(ctx, lt, T, o = {}) {
  const { train = null, boy = true, shake = 0 } = o;
  const p = PAL.sunset;
  const sky = A.sky.sunset;
  ctx.save();
  if (shake) ctx.translate(Math.sin(lt * 53) * shake, Math.cos(lt * 47) * shake * 0.6);
  ctx.drawImage(sky, CROSS_SUN[0] - 1560, CROSS_SUN[1] - 1060);
  fx.sunGlow(ctx, CROSS_SUN[0], CROSS_SUN[1], 640, '#fff0d0', 0.7);
  // houses beyond the tracks
  const houses = env.houseStrip('sunset', 5, 2600, 260, rgba(mix(p.farTrees, '#ff9a86', 0.25)));
  ctx.drawImage(houses, -300, 735 - 260 * 0.75, 2600 * 0.75, 260 * 0.75);
  const houses2 = env.houseStrip('sunset', 9, 2600, 260, p.sil);
  ctx.drawImage(houses2, -500, 760 - 260 * 0.85, 2600 * 0.85, 260 * 0.85);
  // far road / ground
  ctx.fillStyle = rgba(mix(p.path, p.sil, 0.55));
  ctx.fillRect(-50, 755, W + 100, 50);
  // utility poles and sagging wires
  const pc = p.sil;
  env.powerPole(ctx, 1560, 780, 520, pc, { arms: 2 });
  env.powerPole(ctx, 250, 1120, 1060, pc, { arms: 2, w: 22 });
  env.wires(ctx, 250 - 70, 110, 1560 - 60, 300, 70, rgba(pc, 0.95), 3, 4, 16);
  env.wires(ctx, 1560 + 60, 300, 2100, 260, 40, rgba(pc, 0.95), 2.5, 4, 14);
  env.wires(ctx, -200, 60, 250 - 60, 110, 30, rgba(pc, 0.95), 3, 4, 16);
  // far signal + barrier
  const on = lampOn(T);
  env.crossingSignal(ctx, 1500, 790, 0.5, lt, p, { on, dark: p.sil });
  env.barrier(ctx, 1450, 790, 360, 0.55, Math.PI, p);
  // the boy waiting on the far side
  if (boy) {
    ch.litFigure(ctx, (c) => {
      c.translate(1060, 792);
      c.scale(0.95, 0.95);
      ch.figureBack(c, { girl: false, t: lt, col: p.sil, wind: 1 + (train ? 1.5 : 0), front: true });
    }, { rim: p.rim, dx: 0, dy: -3, glow: 0.45 });
  }
  // tracks
  env.rails(ctx, 822, p, { h: 64 });
  if (train) train(ctx);
  // near road
  ctx.fillStyle = linGrad(ctx, 0, 860, 0, H, [
    [0, rgba(mix(p.path, p.sil, 0.35))],
    [1, rgba(mix(p.path, p.sil, 0.65))],
  ]);
  ctx.beginPath();
  ctx.moveTo(760, 862);
  ctx.lineTo(1240, 862);
  ctx.lineTo(1700, H + 10);
  ctx.lineTo(300, H + 10);
  ctx.fill();
  ctx.fillStyle = rgba(p.sil, 0.9);
  ctx.beginPath();
  ctx.moveTo(-50, 862);
  ctx.lineTo(760, 862);
  ctx.lineTo(300, H + 10);
  ctx.lineTo(-50, H + 10);
  ctx.moveTo(1240, 862);
  ctx.lineTo(W + 50, 862);
  ctx.lineTo(W + 50, H + 10);
  ctx.lineTo(1700, H + 10);
  ctx.fill();
  // stop line and road sheen
  ctx.fillStyle = rgba('#fff2e0', 0.75);
  ctx.beginPath();
  ctx.moveTo(700, 905);
  ctx.lineTo(1290, 905);
  ctx.lineTo(1300, 918);
  ctx.lineTo(690, 918);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, 1000, 870, 0, 500, [
    [0, rgba(p.rim, 0.35)],
    [1, rgba(p.rim, 0)],
  ]);
  ctx.fillRect(300, 860, 1400, 230);
  // near barrier + signal (big, foreground)
  env.barrier(ctx, 560, 960, 420, 1.0, 0, p);
  env.crossingSignal(ctx, 440, 1180, 1.25, lt, p, { on, dark: p.sil });
  ctx.restore();
  env.crossingGlow(ctx, 440, 1180, 1.25, on, 0.9);
  env.crossingGlow(ctx, 1500, 790, 0.5, on, 0.6);
}

function crossing(ctx, lt, dur, T) {
  const p = PAL.sunset;
  const t0 = 0.3, speed = 3100;
  const nose = W + 120 - (lt - t0) * speed;
  const passing = lt > t0 && nose + 6 * 1006 > -100;
  const trainFn = passing
    ? (c) => {
        const tb = buffer('train');
        env.trainBig(tb.ctx, nose, 800, 300, lt, p);
        // directional motion blur: smear copies along the direction of travel
        c.save();
        c.globalAlpha = 0.35;
        c.drawImage(tb.canvas, 34, 0);
        c.globalAlpha = 0.5;
        c.drawImage(tb.canvas, 17, 0);
        c.globalAlpha = 1;
        c.drawImage(tb.canvas, 0, 0);
        c.globalAlpha = 0.4;
        c.drawImage(tb.canvas, -17, 0);
        c.restore();
      }
    : null;
  const zoom = lerp(1.0, 1.04, ease.inOutSine(lt / dur));
  ctx.save();
  ctx.translate(1130, 700);
  ctx.scale(zoom, zoom);
  ctx.translate(-1130, -700);
  crossingSet(ctx, lt, T, { train: trainFn, shake: passing ? 3 : 0 });
  ctx.restore();
  if (passing) fx.speedLines(ctx, lt, { n: 30, alpha: 0.18, y0: 480, y1: 830, dir: 1 });
  const gust = passing ? 1 : 0.3;
  fx.petals(ctx, lt + 40, { seed: 41, n: 26, vx: -300 - gust * 900, vy: 20, size: [14, 28], sway: 30, light: 1 });
  fx.motes(ctx, lt, { n: 30, alpha: 0.4 });
  post(ctx, {
    bloom: { strength: 0.38 },
    grade: { vignette: 0.38, vigColor: '#2a1238', leak: [CROSS_SUN[0], CROSS_SUN[1], 900, '#ff9a6a', 0.2] },
  });
  // the sun strobes through the gaps between cars
  fx.lensFlare(ctx, CROSS_SUN[0], CROSS_SUN[1], passing ? 0.15 : 0.7, lt);
}

// ------------------------------------------------------------ 6. walking into the sunset (from behind)
const WALK_VP = [980, 560];
function walkSet(ctx, lt, o = {}) {
  const p = PAL.sunset;
  const sky = A.sky.sunset;
  const [vx, vy] = WALK_VP;
  ctx.drawImage(sky, vx - 1560, vy - 1060 + 40);
  fx.sunGlow(ctx, vx, vy - 10, 700, '#fff0d0', 0.75);
  // far city + river on the left, sakura row on the right
  const city = env.cityStrip('sunset');
  ctx.drawImage(city, -600, vy + 6 - 360 * 0.4, 2600 * 0.9, 360 * 0.4);
  // river (left of the path)
  ctx.fillStyle = linGrad(ctx, 0, vy, 0, H, [
    [0, p.riverTop],
    [1, p.riverBot],
  ]);
  ctx.beginPath();
  ctx.moveTo(-50, vy + 4);
  ctx.lineTo(vx - 30, vy + 4);
  ctx.lineTo(-50, H * 0.85);
  ctx.fill();
  env.river(ctx, p, vy + 4, vy + 160, lt, vx - 150, {});
  // ground on the right
  ctx.fillStyle = linGrad(ctx, 0, vy, 0, H, [
    [0, rgba(mix(p.grassMid, p.sil, 0.3))],
    [1, rgba(p.sil)],
  ]);
  ctx.beginPath();
  ctx.moveTo(vx + 20, vy + 4);
  ctx.lineTo(W + 50, vy + 4);
  ctx.lineTo(W + 50, H + 10);
  ctx.lineTo(vx + 20, H + 10);
  ctx.fill();
  // path in perspective
  ctx.fillStyle = linGrad(ctx, 0, vy, 0, H, [
    [0, rgba(mix(p.pathLit, '#fff0d0', 0.4))],
    [0.25, p.pathLit],
    [1, rgba(mix(p.path, p.sil, 0.4))],
  ]);
  ctx.beginPath();
  ctx.moveTo(vx - 14, vy + 4);
  ctx.lineTo(vx + 14, vy + 4);
  ctx.lineTo(1650, H + 10);
  ctx.lineTo(260, H + 10);
  ctx.fill();
  // embankment slope on the left (towards the river)
  ctx.fillStyle = linGrad(ctx, 0, vy, 0, H, [
    [0, rgba(mix(p.grassMid, p.sil, 0.3))],
    [1, rgba(mix(p.grassDark, p.sil, 0.5))],
  ]);
  ctx.beginPath();
  ctx.moveTo(vx - 14, vy + 4);
  ctx.lineTo(260, H + 10);
  ctx.lineTo(-50, H + 10);
  ctx.lineTo(-50, H * 0.8);
  ctx.fill();
  // railing posts receding along the left edge of the path
  ctx.fillStyle = p.fence;
  ctx.strokeStyle = p.fence;
  for (let i = 0; i < 26; i++) {
    const z = (lt * 0.9 + i) % 26;
    const kk = Math.pow(0.86, z);
    const x = lerp(vx - 16, 200, kk), y = lerp(vy + 4, H + 40, kk), h = 150 * kk;
    ctx.fillRect(x - 4 * kk - 1, y - h, 8 * kk + 1.5, h);
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(vx - 16, vy - 1);
  ctx.lineTo(200, H + 40 - 150);
  ctx.moveTo(vx - 16, vy + 1);
  ctx.lineTo(200, H + 40 - 80);
  ctx.stroke();
  ctx.strokeStyle = rgba(p.rim, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(vx - 16, vy - 2);
  ctx.lineTo(200, H + 40 - 152);
  ctx.stroke();
  // sakura trees receding on the right
  for (let i = 7; i >= 0; i--) {
    const z = (i + (lt * 0.25) % 1);
    const kk = Math.pow(0.62, z);
    const x = lerp(vx + 70, 2050, kk), y = lerp(vy + 4, H + 160, kk);
    sakuraTree(ctx, x, y, kk * 1.7, lt, p, i);
  }
}

const treeCache = new Map();
function treeSprite(p, seed) {
  const key = seed;
  if (treeCache.has(key)) return treeCache.get(key);
  const c = document.createElement('canvas');
  c.width = 700;
  c.height = 640;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed * 17 + 3);
  ctx.translate(350, 630);
  // trunk and limbs
  ctx.fillStyle = p.trunk;
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.quadraticCurveTo(-8, -140, -60, -260);
  ctx.lineTo(-44, -266);
  ctx.quadraticCurveTo(0, -180, 10, -230);
  ctx.lineTo(22, -226);
  ctx.quadraticCurveTo(12, -120, 16, 0);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = p.trunk;
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = 8 - i;
    ctx.beginPath();
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.2;
    ctx.moveTo(0, -200);
    ctx.quadraticCurveTo(Math.cos(a) * 80, -200 + Math.sin(a) * 80, Math.cos(a) * 200, -230 + Math.sin(a) * 150);
    ctx.stroke();
  }
  // canopy: many small blossom clumps, shaded from below, lit toward the sun (left)
  const clumps = [];
  for (let k = 0; k < 150; k++) {
    const u = rnd() * 2 - 1, v = rnd();
    const x = u * 310 * Math.sqrt(1 - v * 0.5);
    const y = -250 - v * 300 + Math.abs(u) * 90 + (rnd() - 0.5) * 40;
    if (y > -170) continue;
    clumps.push([x, y, 22 + rnd() * 30]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of clumps) {
    const depth = clamp((y + 520) / 360);
    ctx.fillStyle = rgba(mix(p.blossom[1], p.sil, 0.45 + depth * 0.3));
    ctx.beginPath();
    ctx.arc(x, y + r * 0.25, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(mix(p.blossom[1], p.sil, 0.12 + rnd() * 0.15));
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.08, r * 0.8, 0, TAU);
    ctx.fill();
    if (x < 60) {
      ctx.fillStyle = rgba(mix(p.blossom[0], p.rim, 0.5), 0.75);
      ctx.beginPath();
      ctx.arc(x - r * 0.38, y - r * 0.3, r * 0.34, 0, TAU);
      ctx.fill();
    }
  }
  // tiny individual flowers sprinkled on top
  for (let k = 0; k < 120; k++) {
    const x = (rnd() * 2 - 1) * 300, y = -260 - rnd() * 300 + Math.abs(x) * 0.25;
    ctx.fillStyle = rgba(mix(p.blossom[2], '#ffffff', 0.4), 0.9);
    ctx.beginPath();
    ctx.arc(x, y, 2 + rnd() * 3, 0, TAU);
    ctx.fill();
  }
  treeCache.set(key, c);
  return c;
}

function sakuraTree(ctx, x, y, s, t, p, seed) {
  const spr = treeSprite(p, seed % 4);
  const sway = Math.sin(t * 1.2 + seed) * 0.012;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(s * 0.62, s * 0.62);
  ctx.drawImage(spr, -350, -630);
  ctx.restore();
}

function couple(ctx, lt, o) {
  const { gx, bx, y, s, walk, reach = 0, col, rim, shadowReach = reach, wind = 1, shadowOnly = false } = o;
  const drawPair = (c, rr) => {
    c.save();
    c.translate(gx, y);
    c.scale(s, s);
    figureBackSafe(c, { girl: true, t: lt, walk, col, wind, reach: rr, reachSide: 1 });
    c.restore();
    c.save();
    c.translate(bx, y);
    c.scale(s * 1.07, s * 1.07);
    figureBackSafe(c, { girl: false, t: lt, walk: walk === null ? null : walk + Math.PI * 0.85, col, wind, reach: rr, reachSide: -1 });
    c.restore();
  };
  // long shadows fanning toward the camera
  const sb = buffer('shadowFig');
  drawPair(sb.ctx, shadowReach);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.filter = 'blur(2px)';
  const cx = (gx + bx) / 2;
  const shear = (cx - WALK_VP[0]) / (y - WALK_VP[1]);
  ctx.translate(cx, y);
  ctx.transform(1, 0, shear * 0.9, 1, 0, 0);
  ctx.scale(1.3, -1.05);
  ctx.translate(-cx, -y);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(sb.canvas, 0, 0);
  ctx.restore();
  if (shadowOnly) return;
  ch.litFigure(ctx, (c) => drawPair(c, reach), { rim, dx: 0, dy: -3, glow: 0.4 });
}
const figureBackSafe = (c, o) => ch.figureBack(c, o);

function walk(ctx, lt, dur) {
  const p = PAL.sunset;
  const push = ease.inOutSine(lt / dur);
  ctx.save();
  const z = lerp(1.0, 1.05, push);
  ctx.translate(WALK_VP[0], WALK_VP[1]);
  ctx.scale(z, z);
  ctx.translate(-WALK_VP[0], -WALK_VP[1]);
  walkSet(ctx, lt);
  const s = lerp(1.22, 1.1, push);
  const y = lerp(838, 812, push);
  const reach = smoothstep(2.6, 4.4, lt);
  couple(ctx, lt, {
    gx: 880, bx: 1090, y, s, walk: lt * TAU * 0.85, reach: reach * 0.3, shadowReach: 0.3 + reach * 1.2, col: p.sil, rim: p.rim,
    shadowCol: '#3a2050',
  });
  ctx.restore();
  fx.godRays(ctx, WALK_VP[0], WALK_VP[1] - 10, lt, { n: 20, len: 2200, alpha: 0.1 });
  fx.motes(ctx, lt, { n: 50, alpha: 0.5 });
  fx.petals(ctx, lt + 60, { seed: 61, n: 30, vx: -60, vy: 70, size: [14, 28], sway: 60, light: 1 });
  fx.petals(ctx, lt + 3, { seed: 62, n: 3, vx: -500, vy: 160, size: [150, 210], blur: 4, alpha: 0.8, sway: 60 });
  post(ctx, {
    bloom: { strength: 0.42 },
    grade: { vignette: 0.42, vigColor: '#2a1238', leak: [WALK_VP[0], WALK_VP[1], 1000, '#ff9a6a', 0.25] },
  });
  fx.lensFlare(ctx, WALK_VP[0], WALK_VP[1] - 10, 0.8, lt);
}

// ------------------------------------------------------------ 7. shadows hold hands
function shadows(ctx, lt, dur) {
  const p = PAL.sunset;
  ctx.save();
  const rot = lerp(0.04, -0.01, ease.inOutSine(lt / dur));
  const z = lerp(1.08, 1.0, ease.inOutSine(lt / dur));
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  // warm asphalt lit by the low sun
  ctx.fillStyle = linGrad(ctx, 0, -100, 0, H + 100, [
    [0, '#ffc79a'],
    [0.5, '#f0a07e'],
    [1, '#c97a74'],
  ]);
  ctx.fillRect(-200, -200, W + 400, H + 400);
  const rnd = mulberry32(71);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,240,220,0.25)' : 'rgba(120,60,70,0.18)';
    const s = 1 + rnd() * 3;
    ctx.fillRect(-200 + rnd() * (W + 400), -200 + rnd() * (H + 400), s, s);
  }
  // painted edge line + grass edge
  ctx.fillStyle = 'rgba(255,248,236,0.8)';
  ctx.fillRect(140, -200, 18, H + 400);
  ctx.fillStyle = rgba(mix(p.grassDark, '#f0a07e', 0.2));
  ctx.fillRect(-200, -200, 230, H + 400);
  env.grass(ctx, lt, {
    seed: 72, x0: -200, x1: 60, yAt: () => -100, ySpread: H + 300, n: 500, hmin: 20, hmax: 60, lean: 0.6,
    colors: [p.grassDark, p.grassMid, '#ffc58a'], wind: 1, light: 0.4,
  });
  // the two shadows, heads toward the camera
  const reach = ease.inOutCubic(clamp((lt - 0.2) / 1.5));
  const sb = buffer('shadowFig');
  const walkPh = lt * TAU * 0.5 * (1 - reach * 0.9);
  const sc = 2.2;
  sb.ctx.save();
  sb.ctx.translate(800, -40);
  sb.ctx.scale(sc, -sc * 1.35);
  ch.figureBack(sb.ctx, { girl: true, t: lt, walk: walkPh, col: '#000', wind: 1, reach: 0.4 + reach * 1.25, reachSide: 1 });
  sb.ctx.restore();
  sb.ctx.save();
  sb.ctx.translate(1250, -60);
  sb.ctx.scale(sc * 1.07, -sc * 1.07 * 1.35);
  ch.figureBack(sb.ctx, { girl: false, t: lt, walk: walkPh + Math.PI * 0.85, col: '#000', wind: 1, reach: 0.4 + reach * 1.25, reachSide: -1 });
  sb.ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.62;
  ctx.filter = 'blur(3px)';
  const tint = buffer('shadowTint');
  tint.ctx.drawImage(sb.canvas, 0, 0);
  tint.ctx.globalCompositeOperation = 'source-in';
  tint.ctx.fillStyle = '#5a2f6e';
  tint.ctx.fillRect(0, 0, W, H);
  ctx.drawImage(tint.canvas, 0, 0);
  ctx.restore();
  ctx.restore();
  // little petals tumbling over the ground, each with its own shadow
  fx.petals(ctx, lt + 70, { seed: 73, n: 16, vx: -120, vy: -60, size: [22, 34], sway: 30, light: 1 });
  // a glint where the hands meet
  const meet = smoothstep(1.55, 1.9, lt);
  if (meet > 0) {
    const mx = 1030, my = 470;
    fx.sparkle(ctx, mx, my, 60 * meet * (1 + 0.1 * Math.sin(lt * 9)), meet, lt * 0.5);
    fx.sparkles(ctx, lt, { seed: 74, n: 10, x0: mx - 160, x1: mx + 160, y0: my - 120, y1: my + 120, size: [8, 20], alpha: meet });
  }
  post(ctx, {
    bloom: { strength: 0.3 },
    grade: { vignette: 0.45, vigColor: '#3a1238', leak: [W / 2, -200, 1200, '#ffd2a0', 0.3] },
  });
}

// ------------------------------------------------------------ night sky helpers
function stars(ctx, t, alpha, x0, y0, x1, y1, seed = 101, n = 260) {
  if (alpha <= 0) return;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rnd()), y = lerp(y0, y1, Math.pow(rnd(), 1.4));
    const s = 0.6 + Math.pow(rnd(), 3) * 2.8;
    const tw = 0.6 + 0.4 * Math.sin(t * (1 + rnd() * 3) + rnd() * TAU);
    const fade = 1 - smoothstep(y1 * 0.55, y1, y);
    ctx.globalAlpha = alpha * tw * fade * (0.4 + rnd() * 0.6);
    ctx.fillStyle = rnd() < 0.2 ? '#ffd9e6' : '#eef3ff';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
    if (s > 2.4) fx.sparkle(ctx, x, y, s * 4, alpha * tw * fade * 0.6);
  }
  ctx.restore();
}

function shootingStar(ctx, t, t0, x0, y0, x1, y1) {
  const k = (t - t0) / 0.9;
  if (k < 0 || k > 1.2) return;
  const e = ease.outCubic(clamp(k));
  const x = lerp(x0, x1, e), y = lerp(y0, y1, e);
  const tail = 260 * (1 - Math.abs(k - 0.4));
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(1.2 - k);
  ctx.strokeStyle = linGrad(ctx, x - Math.cos(ang) * tail, y - Math.sin(ang) * tail, x, y, [
    [0, 'rgba(255,255,255,0)'],
    [1, 'rgba(255,240,250,1)'],
  ]);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ang) * tail, y - Math.sin(ang) * tail);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
  fx.sparkle(ctx, x, y, 24, clamp(1.2 - k), k * 3);
}

// ------------------------------------------------------------ 11. title card
function title(ctx, lt, dur, T) {
  const sky = A.sky.twilight;
  ctx.drawImage(sky, 960 - 1350, -260 - lt * 12);
  stars(ctx, lt + 7, 1, 0, 0, W, H * 0.9, 111, 340);
  shootingStar(ctx, lt, 5.6, 300, 140, 760, 330);
  fx.petals(ctx, lt + 110, { seed: 112, n: 30, vx: -60, vy: 40, size: [12, 26], sway: 60, light: 0.3 });
  fx.motes(ctx, lt, { seed: 113, n: 40, alpha: 0.5, color: 'pink' });
  post(ctx, {
    bloom: { strength: 0.35, threshold: 2.0 },
    grade: { vignette: 0.5, vigColor: '#070414' },
  });
}

export const SCENES = {
  ...ART_SCENES,
  openingSky: { draw: openingSky },
  signalClose: { draw: signalClose },
  crossing: { draw: crossing },
  walk: { draw: walk },
  shadows: { draw: shadows },
  title: { draw: title },
};
