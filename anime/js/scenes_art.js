// Shots built on the painted key art (school gate at sunset, the two leads).
import { W, H, clamp, lerp, smoothstep, ease, linGrad } from './core.js';
import * as fx from './fx.js';
import { ART, drawPlate, drawChar, toScreen } from './art.js';

const blinkAt = (t, times, dur = 0.16) => {
  let v = 0;
  for (const b of times) {
    const d = t - b;
    if (d >= 0 && d < dur) v = Math.max(v, Math.sin((d / dur) * Math.PI));
  }
  return v;
};

// Mouth opening for a run of morae starting at t0 (seconds per mora `rate`).
function speak(t, t0, morae, rate = 0.17, amp = 1) {
  const k = (t - t0) / rate;
  if (k < 0 || k > morae) return 0;
  return amp * Math.pow(Math.sin((k % 1) * Math.PI), 0.8) * (0.7 + 0.3 * Math.sin(k * 2.3));
}

function post(ctx, o = {}) {
  fx.bloom(ctx, ctx.canvas, o.bloom || { strength: 0.22 });
  fx.grade(ctx, o.grade || {});
}

const camLerp = (a, b, k) => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), s: lerp(a.s, b.s, k) });

function sunFx(ctx, cam, lt, k = 1) {
  const [sx, sy] = toScreen(cam, ART.meta.plate.sun[0], ART.meta.plate.sun[1]);
  fx.sunGlow(ctx, sx, sy, 300 * Math.min(2.2, cam.s), '#ffe9c4', 0.45 * k);
  fx.godRays(ctx, sx, sy, lt, { n: 16, len: 2400, alpha: 0.07 * k, color: '#ffe2b4' });
  return [sx, sy];
}

// ------------------------------------------------------------ 2. the school gate
function gate(ctx, lt, dur) {
  const k = ease.inOutSine(clamp(lt / dur));
  const cam = camLerp({ cx: 688, cy: 384, s: 1.43 }, { cx: 712, cy: 320, s: 1.95 }, k);
  const plateCam = { ...cam, s: lerp(1.43, 1.78, k), cx: lerp(688, 705, k) };
  drawPlate(ctx, plateCam);
  fx.petals(ctx, lt + 3, { seed: 201, n: 10, vx: -60, vy: 50, size: [8, 14], sway: 30, light: 0.6, blur: 1 });
  drawChar(ctx, 'girl', cam, lt, { wind: 0.9, dir: -1, blink: blinkAt(lt, [2.7, 5.1]), blush: 0.15 });
  const [sx, sy] = sunFx(ctx, cam, lt);
  fx.motes(ctx, lt, { n: 50, alpha: 0.5 });
  fx.petals(ctx, lt + 10, { seed: 202, n: 22, vx: -140, vy: 70, size: [16, 30], sway: 50, light: 1 });
  fx.petals(ctx, lt + 2, { seed: 203, n: 3, vx: -560, vy: 140, size: [150, 210], blur: 4, alpha: 0.85, sway: 70 });
  post(ctx, { bloom: { strength: 0.24 }, grade: { vignette: 0.3, vigColor: '#2a1838', leak: [sx, sy, 900, '#ffb070', 0.18] } });
  fx.lensFlare(ctx, sx, sy, 0.55, lt);
}

// ------------------------------------------------------------ 3. her close-up
function girlClose(ctx, lt, dur) {
  const k = ease.inOutSine(clamp(lt / dur));
  const cam = camLerp({ cx: 690, cy: 214, s: 4.0 }, { cx: 702, cy: 208, s: 4.35 }, k);
  drawPlate(ctx, { cx: cam.cx + 30, cy: cam.cy + 40, s: cam.s * 0.72 }, { blur: 4, defocus: true });
  fx.bokeh(ctx, lt, { seed: 211, n: 14, x0: 1150, x1: W, y0: 0, y1: 700, size: [60, 170], alpha: 0.35 });
  fx.petals(ctx, lt + 6, { seed: 212, n: 6, vx: -90, vy: 40, size: [30, 50], blur: 2, alpha: 0.7, sway: 40 });
  drawChar(ctx, 'girl', cam, lt, { wind: 1.1, dir: -1, blink: blinkAt(lt, [1.05, 3.55]), blush: 0.25 });
  const [sx, sy] = sunFx(ctx, { cx: cam.cx + 30, cy: cam.cy + 40, s: cam.s * 0.72 }, lt, 0.8);
  fx.motes(ctx, lt, { n: 36, alpha: 0.45 });
  fx.petals(ctx, lt + 20, { seed: 213, n: 10, vx: -170, vy: 50, size: [22, 36], sway: 40, light: 1 });
  fx.petals(ctx, lt + 1, { seed: 214, n: 2, vx: -700, vy: 90, size: [180, 260], blur: 4, alpha: 0.85, sway: 60 });
  post(ctx, { bloom: { strength: 0.2 }, grade: { vignette: 0.34, vigColor: '#2a1838', leak: [W, 0, 1000, '#ffb07a', 0.2] } });
  fx.lensFlare(ctx, Math.min(sx, W - 150), Math.max(sy, 120), 0.35, lt);
}

// ------------------------------------------------------------ 5. his close-up (after the train)
function boyClose(ctx, lt, dur, T) {
  const k = ease.inOutSine(clamp(lt / dur));
  const cam = camLerp({ cx: 712, cy: 196, s: 3.9 }, { cx: 716, cy: 190, s: 4.25 }, k);
  const pcam = { cx: cam.cx + 40, cy: cam.cy + 50, s: cam.s * 0.7 };
  drawPlate(ctx, pcam, { blur: 4, defocus: true });
  // the crossing lamps, out of focus, still blinking behind him
  const on = Math.floor(T * 2.3) % 2;
  const red = fx.getSprites().bokeh.red;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.65 * (1 - smoothstep(1.2, 2.6, lt));
  ctx.drawImage(red, on ? 260 : 130, 330, 170, 170);
  ctx.restore();
  fx.bokeh(ctx, lt, { seed: 221, n: 12, x0: 1200, x1: W, y0: 0, y1: 700, size: [60, 160], alpha: 0.3 });
  const gust = 1.6 * Math.exp(-lt * 1.4);
  drawChar(ctx, 'boy', cam, lt, {
    wind: 0.7, dir: -1, gust, blink: blinkAt(lt, [0.3, 2.45]), mouth: speak(lt, 1.0, 2, 0.2, 0.9), blush: smoothstep(1.6, 2.6, lt) * 0.3,
  });
  const [sx, sy] = sunFx(ctx, pcam, lt, 0.8);
  fx.petals(ctx, lt + 30, { seed: 222, n: 14, vx: -260 - gust * 500, vy: 30, size: [22, 36], sway: 30, light: 1 });
  fx.petals(ctx, lt + 4, { seed: 223, n: 2, vx: -900, vy: 60, size: [180, 250], blur: 4, alpha: 0.8, sway: 60 });
  post(ctx, { bloom: { strength: 0.2 }, grade: { vignette: 0.34, vigColor: '#1e1838', leak: [W, 100, 900, '#ffa070', 0.2] } });
  fx.lensFlare(ctx, Math.min(sx, W - 150), Math.max(sy, 120), 0.35, lt);
}

// ------------------------------------------------------------ 8. the confession
function confess(ctx, lt, dur) {
  // tight on her face, then the music hits (lt 1.5) and the camera pulls back
  const hit = 1.5;
  const pull = ease.outCubic(clamp((lt - hit) / 1.4));
  const tight = { cx: 704, cy: 214, s: lerp(5.6, 5.9, clamp(lt / hit)) };
  const wide = { cx: 706, cy: 262, s: lerp(2.95, 3.15, clamp((lt - hit) / (dur - hit))) };
  const cam = camLerp(tight, wide, pull);
  const pcam = { cx: cam.cx + 20, cy: cam.cy + 30, s: cam.s * 0.72 };
  drawPlate(ctx, pcam, { blur: 4, defocus: true });
  const burst = smoothstep(hit - 0.05, hit + 0.25, lt);
  fx.bokeh(ctx, lt, { seed: 231, n: 22, x0: 1000, x1: W, y0: 0, y1: 800, size: [50, 170], alpha: 0.3 + burst * 0.2 });
  const gust = burst * 1.6 * Math.exp(-(lt - hit) * 1.2);
  const tears = smoothstep(0.6, 1.4, lt);
  drawChar(ctx, 'girl', cam, lt, {
    wind: 0.8 + burst * 0.6, dir: -1, gust, blink: blinkAt(lt, [0.12, 3.9]), blush: lerp(0.35, 0.75, smoothstep(0.5, 1.6, lt)),
    mouth: speak(lt, 0.8, 4, 0.17, 0.9), sparkle: tears * (0.6 + 0.4 * burst),
  });
  const [sx, sy] = sunFx(ctx, pcam, lt, 0.8 + burst * 0.4);
  fx.petals(ctx, lt + 80, {
    seed: 232, n: 16 + Math.round(burst * 40), vx: -200 - burst * 220, vy: -30, size: [16, 34], sway: 60, light: 1,
    swirl: { x: W / 2, y: H / 2, k: 1, amount: burst * 0.8, spin: 0.25 },
  });
  fx.petals(ctx, lt + 9, { seed: 233, n: 1 + Math.round(burst * 3), vx: -800, vy: -60, size: [170, 240], blur: 4, alpha: 0.8, sway: 60 });
  fx.sparkles(ctx, lt, { seed: 234, n: 14, x0: 300, x1: 1600, y0: 80, y1: 900, size: [8, 24], alpha: burst * 0.85 });
  post(ctx, {
    bloom: { strength: 0.2 + burst * 0.1 },
    grade: { vignette: 0.32, vigColor: '#2a1838', leak: [W, 150, 1100, '#ffb08a', 0.16 + burst * 0.12] },
  });
  fx.lensFlare(ctx, Math.min(sx, W - 150), Math.max(sy, 120), 0.3 + burst * 0.4, lt);
  // a soft white bloom right on the downbeat
  fx.fadeColor(ctx, '#fff6ee', 0.5 * Math.exp(-Math.max(0, lt - hit) * 5) * smoothstep(hit - 0.05, hit, lt));
}

// ------------------------------------------------------------ 9. his answer
function boyReply(ctx, lt, dur) {
  const k = ease.inOutSine(clamp(lt / dur));
  const cam = camLerp({ cx: 714, cy: 236, s: 2.95 }, { cx: 716, cy: 226, s: 3.3 }, k);
  const pcam = { cx: cam.cx + 30, cy: cam.cy + 30, s: cam.s * 0.75 };
  drawPlate(ctx, pcam, { blur: 3, defocus: true });
  fx.bokeh(ctx, lt, { seed: 241, n: 16, x0: 1100, x1: W, y0: 0, y1: 800, size: [50, 150], alpha: 0.32 });
  const mouth = Math.max(speak(lt, 0.5, 3, 0.18, 0.8), speak(lt, 1.5, 6, 0.17, 0.8));
  drawChar(ctx, 'boy', cam, lt, {
    wind: 0.8, dir: -1, blink: blinkAt(lt, [1.3, 3.2]), mouth, blush: lerp(0.2, 0.6, smoothstep(0.2, 1.2, lt)),
  });
  const [sx, sy] = sunFx(ctx, pcam, lt, 0.9);
  fx.petals(ctx, lt + 90, { seed: 242, n: 22, vx: -200, vy: 20, size: [16, 32], sway: 50, light: 1 });
  fx.sparkles(ctx, lt, { seed: 243, n: 10, x0: 300, x1: 1600, y0: 100, y1: 900, size: [8, 22], alpha: 0.55 });
  post(ctx, { bloom: { strength: 0.22 }, grade: { vignette: 0.32, vigColor: '#1e1838', leak: [W, 100, 900, '#ffa57a', 0.18] } });
  fx.lensFlare(ctx, Math.min(sx, W - 150), Math.max(sy, 120), 0.4, lt);
}

// ------------------------------------------------------------ 10. together at the gate
function gateFinale(ctx, lt, dur) {
  const k = ease.inOutCubic(clamp(lt / (dur - 0.6)));
  const cam = camLerp({ cx: 790, cy: 250, s: 2.3 }, { cx: 688, cy: 384, s: 1.43 }, k);
  const pcam = camLerp({ cx: 770, cy: 270, s: 2.0 }, { cx: 688, cy: 384, s: 1.42 }, k);
  drawPlate(ctx, pcam);
  // he waits a step behind her, to her left
  drawChar(ctx, 'boy', cam, lt + 3, { wind: 0.8, dir: -1, dx: 228, zoom: 0.93, blink: blinkAt(lt, [2.2, 5.6]), blush: 0.35 });
  drawChar(ctx, 'girl', cam, lt, { wind: 0.9, dir: -1, blink: blinkAt(lt, [1.4, 4.4]), blush: 0.4 });
  const [sx, sy] = sunFx(ctx, pcam, lt, 1);
  // dusk settles in
  const dusk = smoothstep(3.0, 7.2, lt);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = dusk * 0.55;
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, [
    [0, '#6a5ab0'],
    [0.6, '#b07ab0'],
    [1, '#5a3a78'],
  ]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  fx.motes(ctx, lt, { seed: 251, n: 50, alpha: 0.5, color: dusk > 0.5 ? 'pink' : 'warm' });
  fx.petals(ctx, lt + 100, {
    seed: 252, n: 50, vx: -110, vy: 20, size: [14, 30], sway: 70, light: 0.8,
    swirl: { x: W * 0.5, y: H * 0.45, k: 1, amount: 0.55, spin: 0.2 },
  });
  fx.sparkles(ctx, lt, { seed: 253, n: 16, x0: 300, x1: 1600, y0: 80, y1: 800, size: [6, 18], alpha: 0.5 + dusk * 0.4 });
  post(ctx, { bloom: { strength: 0.26 }, grade: { vignette: 0.38, vigColor: '#140a28', leak: [sx, sy, 1000, '#ff9a7a', 0.2 * (1 - dusk) + 0.06] } });
  fx.lensFlare(ctx, sx, sy, 0.6 * (1 - dusk * 0.6), lt);
}

export const ART_SCENES = {
  gate: { draw: gate },
  artGirlClose: { draw: girlClose },
  artBoyClose: { draw: boyClose },
  artConfess: { draw: confess },
  artBoyReply: { draw: boyReply },
  gateFinale: { draw: gateFinale },
};
