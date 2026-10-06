// Compositing ("satsuei") effects: petals, light rays, lens flares, sparkles,
// bloom/diffusion, grading, grain. All deterministic in time.
import {
  W, H, TAU, clamp, lerp, smoothstep, mulberry32, noise1, makeCanvas, buffer, rgba, radGrad, linGrad, mix,
} from './core.js';

// ---------------------------------------------------------------- sprites
const sprites = {};

function makeGlowSprite(size, color, core = 0.15) {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2;
  ctx.fillStyle = radGrad(ctx, r, r, 0, r, [
    [0, rgba(color, 1)],
    [core, rgba(color, 0.8)],
    [0.4, rgba(color, 0.25)],
    [1, rgba(color, 0)],
  ]);
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeBokehSprite(size, color) {
  const { canvas, ctx } = makeCanvas(size, size);
  const r = size / 2;
  ctx.beginPath();
  // slightly polygonal aperture like a real lens
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU + 0.3;
    const x = r + Math.cos(a) * r * 0.92, y = r + Math.sin(a) * r * 0.92;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = radGrad(ctx, r, r, 0, r, [
    [0, rgba(color, 0.35)],
    [0.75, rgba(color, 0.5)],
    [0.92, rgba(color, 0.9)],
    [1, rgba(color, 0.2)],
  ]);
  ctx.filter = 'blur(1.5px)';
  ctx.fill();
  return canvas;
}

function makeGrainTiles() {
  const tiles = [];
  const rnd = mulberry32(99);
  for (let k = 0; k < 6; k++) {
    const { canvas, ctx } = makeCanvas(256, 256);
    const img = ctx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (rnd() + rnd() + rnd() - 1.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(canvas);
  }
  return tiles;
}

// Autumn leaves: maple, ginkgo and simple oval leaves, drawn pointing up.
function leafPath(ctx, kind, s) {
  ctx.beginPath();
  if (kind === 'maple') {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = (-90 + i * 72) * Math.PI / 180;
      const a0 = a - 0.62, a1 = a + 0.62;
      pts.push([Math.cos(a0) * s * 0.2, Math.sin(a0) * s * 0.2]);
      pts.push([Math.cos(a - 0.18) * s * 0.42, Math.sin(a - 0.18) * s * 0.42]);
      pts.push([Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5]);
      pts.push([Math.cos(a + 0.18) * s * 0.42, Math.sin(a + 0.18) * s * 0.42]);
      pts.push([Math.cos(a1) * s * 0.2, Math.sin(a1) * s * 0.2]);
    }
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
  } else if (kind === 'ginkgo') {
    ctx.moveTo(0, s * 0.5);
    ctx.lineTo(-s * 0.04, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.15, -s * 0.42, -s * 0.42);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.5, -s * 0.03, -s * 0.38);
    ctx.lineTo(0, -s * 0.28);
    ctx.lineTo(s * 0.03, -s * 0.38);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.42, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.15, s * 0.04, s * 0.05);
    ctx.closePath();
  } else {
    ctx.moveTo(0, s * 0.5);
    ctx.bezierCurveTo(-s * 0.38, s * 0.2, -s * 0.3, -s * 0.3, 0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.3, -s * 0.3, s * 0.38, s * 0.2, 0, s * 0.5);
    ctx.closePath();
  }
}

function makeLeafSprite(size, blur, kind, cols) {
  const pad = blur * 3 + 4;
  const { canvas, ctx } = makeCanvas(size + pad * 2, size + pad * 2);
  const sharp = makeCanvas(size + pad * 2, size + pad * 2);
  const c = sharp.ctx;
  c.translate(canvas.width / 2, canvas.height / 2);
  leafPath(c, kind, size);
  c.fillStyle = linGrad(c, -size * 0.4, size * 0.4, size * 0.4, -size * 0.4, [
    [0, cols[0]],
    [0.55, cols[1]],
    [1, cols[2]],
  ]);
  c.fill();
  c.strokeStyle = rgba(cols[0], 0.6);
  c.lineWidth = size * 0.03;
  c.beginPath();
  c.moveTo(0, size * 0.5);
  c.lineTo(0, -size * 0.3);
  if (kind === 'maple') {
    for (const a of [-0.9, 0.9, -2.2, 2.2]) {
      c.moveTo(0, 0);
      c.lineTo(Math.sin(a) * size * 0.35, -Math.cos(a) * size * 0.35);
    }
  }
  c.stroke();
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = radGrad(c, -size * 0.15, -size * 0.2, 0, size * 0.6, [
    [0, 'rgba(255,240,200,0.45)'],
    [1, 'rgba(255,240,200,0)'],
  ]);
  c.fillRect(-size, -size, size * 2, size * 2);
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(sharp.canvas, 0, 0);
  return canvas;
}

export function initFx() {
  const leaves = [
    ['maple', ['#a8321e', '#e0552a', '#ff9a4a']],
    ['maple', ['#c0501c', '#f08a2c', '#ffc35a']],
    ['ginkgo', ['#c98a12', '#f2b52e', '#ffe07a']],
    ['oval', ['#8e4a22', '#cf7a34', '#f4b060']],
    ['maple', ['#b8401e', '#ec6a2c', '#ffb04e']],
    ['ginkgo', ['#d69a1a', '#f6c443', '#fff09a']],
  ];
  sprites.petal = [0, 2, 5, 10, 18].map((b) => leaves.map(([k, c]) => makeLeafSprite(48, b, k, c)));
  sprites.glowWarm = makeGlowSprite(128, '#fff1d0');
  sprites.glowPink = makeGlowSprite(128, '#ffc4dc');
  sprites.glowWhite = makeGlowSprite(128, '#ffffff', 0.05);
  sprites.bokeh = {
    warm: makeBokehSprite(128, '#ffd6a0'),
    pink: makeBokehSprite(128, '#ffb3cf'),
    white: makeBokehSprite(128, '#fff6ea'),
    teal: makeBokehSprite(128, '#a8e6ff'),
    red: makeBokehSprite(128, '#ff5a3a'),
  };
  sprites.grain = makeGrainTiles();
}

export const getSprites = () => sprites;

// ---------------------------------------------------------------- petals
// Petals drift with the wind and tumble in 3D; position is analytic in t.
export function petals(ctx, t, o) {
  const {
    seed = 1, n = 40, x0 = -100, y0 = -100, x1 = W + 100, y1 = H + 100,
    vx = 120, vy = 60, size = [14, 26], blur = 0, alpha = 1, sway = 40, light = null, spin = 1,
    gust = 0, swirl = null,
  } = o;
  const rnd = mulberry32(seed);
  const bw = x1 - x0, bh = y1 - y0;
  const levels = sprites.petal[clamp(blur, 0, sprites.petal.length - 1) | 0];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const px = rnd(), py = rnd(), sp = 0.6 + rnd() * 0.8, ph = rnd() * TAU, fr = 0.4 + rnd() * 0.9;
    const sz = lerp(size[0], size[1], rnd()), col = (rnd() * 6) | 0, rot0 = rnd() * TAU, flipf = 0.8 + rnd() * 2;
    const tt = t * sp + gust * (1 - Math.exp(-t * 0.8)) * sp;
    let x = px * bw + vx * tt + Math.sin(t * fr + ph) * sway;
    let y = py * bh + vy * tt + Math.sin(t * fr * 1.3 + ph * 2) * sway * 0.6;
    x = ((x % bw) + bw) % bw + x0;
    y = ((y % bh) + bh) % bh + y0;
    if (swirl) {
      // spiral around a point (used for the climax petal storm)
      const k = swirl.k * swirl.amount;
      const dx = x - swirl.x, dy = y - swirl.y;
      const d = Math.hypot(dx, dy) + 1;
      const a = Math.atan2(dy, dx) + (k * 300) / (d + 150) + t * swirl.spin * sp;
      const rr = d * (1 - 0.25 * swirl.amount);
      x = swirl.x + Math.cos(a) * rr;
      y = swirl.y + Math.sin(a) * rr * 0.6;
    }
    const flip = Math.cos(t * flipf * spin + ph);
    const rot = rot0 + t * (0.6 + fr) * spin * (i % 2 ? 1 : -1);
    const spr = levels[col];
    const sc = sz / 48;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sc * (0.25 + 0.75 * Math.abs(flip)), sc);
    ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.abs(flip));
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    if (light && flip > 0.6) {
      // glint when the petal faces the sun
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (flip - 0.6) * 1.5 * light;
      const g = sprites.glowWarm;
      ctx.drawImage(g, -40, -40, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- light
export function godRays(ctx, sx, sy, t, o = {}) {
  const { n = 14, len = 2400, alpha = 0.18, color = '#fff2d6', spread = TAU, rot = 0, width = 0.06, seed = 3 } = o;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const base = rot + (i / n) * spread + rnd() * 0.3;
    const a = base + Math.sin(t * 0.13 + i) * 0.03;
    const w = width * (0.4 + rnd() * 1.2);
    const fl = 0.5 + 0.5 * noise1(t * 0.6 + i * 7.3);
    const L = len * (0.6 + rnd() * 0.5);
    ctx.globalAlpha = alpha * fl;
    ctx.fillStyle = radGrad(ctx, sx, sy, 0, L, [
      [0, rgba(color, 0.9)],
      [0.25, rgba(color, 0.35)],
      [1, rgba(color, 0)],
    ]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, L, a - w / 2, a + w / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function sunGlow(ctx, sx, sy, r, color = '#fff3d8', alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = radGrad(ctx, sx, sy, 0, r, [
    [0, rgba('#ffffff', 1)],
    [0.08, rgba(color, 0.95)],
    [0.25, rgba(color, 0.4)],
    [0.6, rgba(color, 0.1)],
    [1, rgba(color, 0)],
  ]);
  ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  ctx.restore();
}

export function lensFlare(ctx, sx, sy, intensity = 1, t = 0, o = {}) {
  const { streak = true, ghosts = true, star = true, tint = '#ffd9a8' } = o;
  if (intensity <= 0.001) return;
  const cx = W / 2, cy = H / 2;
  const dx = cx - sx, dy = cy - sy;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // anamorphic streak
  if (streak) {
    ctx.globalAlpha = 0.55 * intensity;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.018);
    ctx.fillStyle = radGrad(ctx, 0, 0, 0, 1300, [
      [0, 'rgba(255,255,255,1)'],
      [0.1, 'rgba(255,226,190,0.8)'],
      [0.4, 'rgba(255,170,150,0.25)'],
      [1, 'rgba(160,140,255,0)'],
    ]);
    ctx.fillRect(-1300, -1300, 2600, 2600);
    ctx.restore();
  }
  // starburst
  if (star) {
    ctx.globalAlpha = 0.35 * intensity;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI + 0.25 + t * 0.02;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.scale(1, 0.012);
      ctx.fillStyle = radGrad(ctx, 0, 0, 0, 380, [
        [0, 'rgba(255,255,255,1)'],
        [1, 'rgba(255,240,220,0)'],
      ]);
      ctx.fillRect(-380, -380, 760, 760);
      ctx.restore();
    }
  }
  // ghosts along the optical axis
  if (ghosts) {
    const gh = [
      [0.35, 40, '#ffcf8a', 0.18],
      [0.62, 18, '#ff9ec4', 0.22],
      [0.9, 90, '#9fd8ff', 0.08],
      [1.2, 28, '#c9a8ff', 0.16],
      [1.45, 140, '#ffd1a0', 0.06],
      [1.7, 55, '#a0ffd6', 0.1],
      [2.0, 22, '#ffffff', 0.18],
    ];
    for (const [k, r, c, a] of gh) {
      const x = sx + dx * k, y = sy + dy * k;
      ctx.globalAlpha = a * intensity;
      ctx.fillStyle = radGrad(ctx, x, y, 0, r, [
        [0, rgba(c, 0.25)],
        [0.7, rgba(c, 0.6)],
        [0.9, rgba(c, 0.9)],
        [1, rgba(c, 0)],
      ]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    // hexagonal aperture ghost
    const hx = sx + dx * 1.32, hy = sy + dy * 1.32;
    ctx.globalAlpha = 0.12 * intensity;
    ctx.fillStyle = rgba(tint, 0.8);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const x = hx + Math.cos(a) * 70, y = hy + Math.sin(a) * 70;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Floating dust motes / light particles drifting in sunbeams.
export function motes(ctx, t, o = {}) {
  const { seed = 5, n = 60, x0 = 0, y0 = 0, x1 = W, y1 = H, size = [2, 7], alpha = 0.7, vx = 8, vy = -6, color = 'warm' } = o;
  const rnd = mulberry32(seed);
  const spr = color === 'pink' ? sprites.glowPink : color === 'white' ? sprites.glowWhite : sprites.glowWarm;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bw = x1 - x0, bh = y1 - y0;
  for (let i = 0; i < n; i++) {
    const px = rnd(), py = rnd(), ph = rnd() * TAU, s = lerp(size[0], size[1], rnd()), f = 0.3 + rnd();
    let x = px * bw + vx * t * f + Math.sin(t * 0.5 * f + ph) * 20;
    let y = py * bh + vy * t * f + Math.cos(t * 0.4 * f + ph) * 14;
    x = ((x % bw) + bw) % bw + x0;
    y = ((y % bh) + bh) % bh + y0;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + f * 2) + ph * 3);
    ctx.globalAlpha = alpha * (0.3 + 0.7 * tw);
    const r = s * 3;
    ctx.drawImage(spr, x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// Four-point twinkling stars ("kira kira").
export function sparkle(ctx, x, y, r, a = 1, rot = 0, color = '#ffffff') {
  if (a <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  const k = r * 0.14;
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.fill();
  const g = sprites.glowWhite;
  ctx.globalAlpha = a * 0.7;
  ctx.drawImage(g, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
  ctx.restore();
}

export function sparkles(ctx, t, o = {}) {
  const { seed = 9, n = 20, x0 = 0, y0 = 0, x1 = W, y1 = H, size = [6, 22], alpha = 1, rate = 1, color = '#ffffff' } = o;
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rnd()), y = lerp(y0, y1, rnd()), s = lerp(size[0], size[1], rnd());
    const ph = rnd(), f = (0.5 + rnd()) * rate;
    const c = (t * f + ph) % 1;
    const a = Math.pow(Math.sin(c * Math.PI), 3);
    sparkle(ctx, x + Math.sin(t + i) * 3, y, s * (0.6 + 0.4 * a), a * alpha, c * 0.6, color);
  }
}

export function bokeh(ctx, t, o = {}) {
  const { seed = 11, n = 18, x0 = 0, y0 = 0, x1 = W, y1 = H, size = [40, 140], alpha = 0.5, colors = ['warm', 'pink', 'white'], drift = 6 } = o;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rnd()) + Math.sin(t * 0.3 + i) * drift;
    const y = lerp(y0, y1, rnd()) + Math.cos(t * 0.25 + i * 2) * drift;
    const s = lerp(size[0], size[1], rnd());
    const c = colors[(rnd() * colors.length) | 0];
    ctx.globalAlpha = alpha * (0.4 + 0.6 * rnd()) * (0.75 + 0.25 * Math.sin(t * 0.8 + i * 1.7));
    ctx.drawImage(sprites.bokeh[c], x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- post
// Bloom + soft "diffusion" glow, the signature of modern anime compositing.
export function bloom(ctx, src, o = {}) {
  const { strength = 0.3, diffusion = 0.1, threshold = 2.4, tint = null } = o;
  const q = buffer('bloomQ', W / 4, H / 4);
  q.ctx.filter = `brightness(0.85) contrast(${threshold}) saturate(1.25) blur(5px)`;
  q.ctx.drawImage(src, 0, 0, W / 4, H / 4);
  const e = buffer('bloomE', W / 8, H / 8);
  e.ctx.filter = 'blur(6px)';
  e.ctx.drawImage(q.canvas, 0, 0, W / 8, H / 8);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = strength;
  ctx.drawImage(q.canvas, 0, 0, W, H);
  ctx.globalAlpha = strength * 0.8;
  ctx.drawImage(e.canvas, 0, 0, W, H);
  if (diffusion > 0) {
    const d = buffer('diff', W / 3, H / 3);
    d.ctx.filter = 'blur(4px)';
    d.ctx.drawImage(src, 0, 0, W / 3, H / 3);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = diffusion;
    ctx.drawImage(d.canvas, 0, 0, W, H);
  }
  if (tint) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = tint[1];
    ctx.fillStyle = tint[0];
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export function grade(ctx, o = {}) {
  const { vignette = 0.35, vigColor = '#1a0f2e', leak = null, top = null, bottom = null, lift = null } = o;
  ctx.save();
  if (top) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = top[1];
    ctx.fillStyle = linGrad(ctx, 0, 0, 0, H * 0.6, [
      [0, top[0]],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.fillRect(0, 0, W, H);
  }
  if (bottom) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = bottom[1];
    ctx.fillStyle = linGrad(ctx, 0, H * 0.45, 0, H, [
      [0, 'rgba(255,255,255,0)'],
      [1, bottom[0]],
    ]);
    ctx.fillRect(0, 0, W, H);
  }
  if (leak) {
    const [lx, ly, lr, lc, la] = leak;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = la;
    ctx.fillStyle = radGrad(ctx, lx, ly, 0, lr, [
      [0, rgba(lc, 1)],
      [0.5, rgba(lc, 0.35)],
      [1, rgba(lc, 0)],
    ]);
    ctx.fillRect(0, 0, W, H);
  }
  if (lift) {
    ctx.globalCompositeOperation = 'lighten';
    ctx.globalAlpha = 1;
    ctx.fillStyle = lift;
    ctx.fillRect(0, 0, W, H);
  }
  if (vignette > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;
    ctx.fillStyle = radGrad(ctx, W / 2, H / 2, H * 0.35, H * 1.05, [
      [0, 'rgba(255,255,255,1)'],
      [1, rgba(mix('#ffffff', vigColor, vignette), 1)],
    ]);
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export function grain(ctx, t, amount = 0.06) {
  const tiles = sprites.grain;
  const f = Math.floor(t * 24);
  const tile = tiles[f % tiles.length];
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  const ox = (f * 73) % 256, oy = (f * 151) % 256;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

// Rim light: an edge strip on the side facing the light, derived from a layer's alpha.
export function rimLight(layer, dx, dy, color, alpha = 1, blur = 2) {
  const r = buffer('rim');
  r.ctx.drawImage(layer, 0, 0);
  r.ctx.globalCompositeOperation = 'source-in';
  r.ctx.fillStyle = color;
  r.ctx.fillRect(0, 0, W, H);
  r.ctx.globalCompositeOperation = 'destination-out';
  r.ctx.drawImage(layer, -dx, -dy);
  const lctx = layer.getContext('2d');
  lctx.save();
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-atop';
  lctx.globalAlpha = alpha;
  if (blur) lctx.filter = `blur(${blur}px)`;
  lctx.drawImage(r.canvas, 0, 0);
  lctx.restore();
}

export function fadeColor(ctx, color, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function speedLines(ctx, t, o = {}) {
  const { seed = 21, n = 40, alpha = 0.25, y0 = 0, y1 = H, dir = -1, color = '#ffffff' } = o;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, rnd());
    const len = 200 + rnd() * 600;
    const sp = 3000 + rnd() * 3000;
    let x = (rnd() * (W + len) + t * sp * -dir) % (W + len);
    if (x < 0) x += W + len;
    x -= len;
    ctx.globalAlpha = alpha * (0.3 + rnd() * 0.7);
    ctx.fillStyle = linGrad(ctx, x, 0, x + len, 0, [
      [0, rgba(color, 0)],
      [0.5, rgba(color, 1)],
      [1, rgba(color, 0)],
    ]);
    ctx.fillRect(x, y, len, 1 + rnd() * 2);
  }
  ctx.restore();
}

export { smoothstep };
