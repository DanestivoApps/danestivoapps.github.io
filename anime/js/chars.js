// Characters seen at a distance: back-lit silhouettes with wind-blown hair,
// fluttering skirts and a walk cycle. Close-ups use the painted art (art.js).
import { W, H, TAU, lerp, buffer, noise1, ribbon } from './core.js';
import * as fx from './fx.js';

// A wavy strand from root along direction `ang`, displaced by wind.
export function strandPts(rx, ry, ang, len, t, o = {}) {
  const { bend = 0, amp = 6, k = 2.2, speed = 5, phase = 0, segs = 12, wind = 0, windAng = Math.PI } = o;
  const pts = [];
  let x = rx, y = ry, a = ang;
  const step = len / segs;
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const w = Math.sin(k * s * TAU - t * speed + phase) * amp * Math.pow(s, 1.3);
    const nx = -Math.sin(a), ny = Math.cos(a);
    pts.push([x + nx * w, y + ny * w]);
    // wind pulls the direction toward windAng progressively
    let da = windAng - a;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    a += bend / segs + da * wind * (0.12 + 0.1 * s);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  return pts;
}

export function drawStrand(ctx, pts, w0, w1 = 0.2) {
  ctx.beginPath();
  ribbon(ctx, pts, (s) => lerp(w0, w1, Math.pow(s, 0.9)) * (s < 0.08 ? 0.7 + s * 3.75 : 1));
  ctx.fill();
}

// Draw a figure into a scratch layer with the caller's transform, add a rim light, composite back.
export function litFigure(ctx, drawFn, o = {}) {
  const { rim = '#ffd9a0', dx = 3, dy = -1, rimAlpha = 1, glow = 0.35 } = o;
  const b = buffer('figure');
  b.ctx.setTransform(ctx.getTransform());
  drawFn(b.ctx);
  b.ctx.setTransform(1, 0, 0, 1, 0, 0);
  fx.rimLight(b.canvas, dx, dy, rim, rimAlpha, 1.2);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (glow > 0) {
    // soft halo of light wrapping around the silhouette (behind it)
    const r = buffer('figureGlow');
    r.ctx.filter = 'blur(12px)';
    r.ctx.drawImage(b.canvas, 0, 0);
    r.ctx.filter = 'none';
    r.ctx.globalCompositeOperation = 'source-in';
    r.ctx.fillStyle = rim;
    r.ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glow;
    ctx.drawImage(r.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(b.canvas, 0, 0);
  ctx.restore();
}

// Back (or front) view figure, feet at origin, ~300 tall. Used walking away into
// the sunset and standing across the railway crossing.
// o: { girl, t, walk (phase radians or null), col, wind, armOut (0..1 reach toward partner, signed side) }
export function figureBack(ctx, o) {
  const { girl = true, t = 0, walk = null, col = '#24193a', wind = 1, reach = 0, reachSide = 1, front = false } = o;
  const ph = walk ?? 0;
  const walking = walk !== null;
  const bob = walking ? -Math.abs(Math.cos(ph)) * 5 : 0;
  const sway = walking ? Math.sin(ph) * 2.5 : 0;
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs: tapered from thigh to ankle, the lifted one foreshortened
  for (const side of [-1, 1]) {
    const lift = walking ? Math.max(0, Math.sin(ph + (side > 0 ? 0 : Math.PI))) * 16 : 0;
    const hipX = side * (girl ? 8 : 10) + sway;
    const footX = side * (girl ? 10 : 13) + sway * 0.4;
    const top = -112 + bob, bot = -6 - lift;
    const kneeY = lerp(top, bot, 0.5) - lift * 0.3;
    const wT = girl ? 9 : 12, wK = girl ? 6 : 9, wA = girl ? 4 : 7.5;
    ctx.beginPath();
    ctx.moveTo(hipX - wT, top);
    ctx.quadraticCurveTo(lerp(hipX, footX, 0.5) - wK - 1.5, kneeY, footX - wA, bot);
    ctx.lineTo(footX + wA, bot);
    ctx.quadraticCurveTo(lerp(hipX, footX, 0.5) + wK + 1.5, kneeY, hipX + wT, top);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(footX, -3 - lift * 0.7, girl ? 7 : 9, 5 + lift * 0.15, 0, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(sway, bob);
  // torso
  ctx.beginPath();
  if (girl) {
    ctx.moveTo(-25, -232);
    ctx.quadraticCurveTo(-28, -196, -17, -158);
    ctx.lineTo(17, -158);
    ctx.quadraticCurveTo(28, -196, 25, -232);
    ctx.quadraticCurveTo(0, -242, -25, -232);
  } else {
    ctx.moveTo(-31, -236);
    ctx.quadraticCurveTo(-33, -176, -21, -106);
    ctx.lineTo(21, -106);
    ctx.quadraticCurveTo(33, -176, 31, -236);
    ctx.quadraticCurveTo(0, -246, -31, -236);
  }
  ctx.fill();
  // arms
  for (const side of [-1, 1]) {
    const swing = walking ? Math.sin(ph + (side > 0 ? Math.PI : 0)) * 0.18 : 0;
    const r = side === reachSide ? reach : 0;
    const sx = side * (girl ? 24 : 30), sy = -226;
    const ex = sx + side * (6 + r * 14), ey = sy + 40 * (1 - swing * 0.3) - r * 4;
    const hx = ex + side * (2 + r * 26), hy = ey + 38 * (1 - Math.abs(swing)) - r * 10;
    ctx.lineWidth = girl ? 11 : 14;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineWidth = girl ? 8 : 11;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx + side * r * 3, hy + 3, girl ? 5 : 6, 0, TAU);
    ctx.fill();
  }
  if (girl) {
    // skirt
    const f = (k) => noise1(t * 2.2 + k) * 4 * wind;
    ctx.beginPath();
    ctx.moveTo(-15, -164);
    ctx.lineTo(15, -164);
    ctx.lineTo(28 + f(1), -104);
    for (let i = 0; i <= 6; i++) ctx.lineTo(lerp(28, -28, i / 6) + f(i * 2), -104 + (i % 2 ? 3 : 0) + f(i) * 0.4);
    ctx.closePath();
    ctx.fill();

  }
  // neck + head
  ctx.fillRect(-5, -248, 10, 14);
  ctx.beginPath();
  ctx.ellipse(0, -266, girl ? 21 : 22, girl ? 24 : 25, 0, 0, TAU);
  ctx.fill();
  if (girl) {
    // long hair down the back, swaying
    for (let i = 0; i < 8; i++) {
      const s = i / 7;
      const pts = strandPts(lerp(-21, 21, s), -278, Math.PI * 0.5 + (s - 0.5) * 0.34, 132 - Math.abs(s - 0.5) * 30, t, {
        amp: 3 + wind * 4, k: 1, speed: 4, phase: i * 0.8, wind: 0.15 * wind, windAng: Math.PI * 0.5 + 0.4,
      });
      drawStrand(ctx, pts, 9, 1.5);
    }
  } else {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r = 26 + (i % 2) * 7;
      const x = Math.cos(a) * r, y = -268 + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineTo(22, -252);
    ctx.lineTo(-22, -252);
    ctx.fill();
  }
  ctx.restore();
}
