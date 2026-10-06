// Backgrounds ("bijutsu"): city, river, grass, railroad crossing, train and
// power lines. Palettes per time of day.
import { W, TAU, lerp, mulberry32, noise2, makeCanvas, rgba, mix, mixa, radGrad, linGrad } from './core.js';

export const PAL = {
  golden: {
    mount: ['#b9a6c4', '#d9b9bf'], city: '#b49ab6', cityLit: '#f2c6a6', cityHaze: '#f4cfb2', windows: null,
    riverTop: '#f7c69c', riverBot: '#6c6aa8', glint: '#fff4d8', farBank: '#7d6a8e', farTrees: '#6e6088',
    bridge: '#4e4462', bridgeLit: '#e9a77e', grassDark: '#2f3a44', grassMid: '#5f6450', grassLit: '#f2c27c',
    path: '#a98480', pathLit: '#efc39e', fence: '#3e3352', sil: '#2a2038', rim: '#ffd9a0', sun: [1560, 760],
    trunk: '#5b3d4a', blossom: ['#ffd2df', '#ffb3c9', '#fff1f5'],
  },
  sunset: {
    mount: ['#8e6c9c', '#c88596'], city: '#7d5f8f', cityLit: '#f39a7e', cityHaze: '#f2a088', windows: null,
    riverTop: '#ffb487', riverBot: '#5b4f8c', glint: '#ffe7c2', farBank: '#5f4a78', farTrees: '#553f6c',
    bridge: '#3e3352', bridgeLit: '#f08b6c', grassDark: '#2f3c4c', grassMid: '#5a5c5e', grassLit: '#ffb36e',
    path: '#b9837a', pathLit: '#ffc08e', fence: '#352a48', sil: '#24193a', rim: '#ffc07a', sun: [1060, 800],
    trunk: '#3e2630', blossom: ['#ffb066', '#e2672e', '#ffd27a'],
  },
  twilight: {
    mount: ['#3b3466', '#5c477e'], city: '#2c2752', cityLit: '#8a5f8f', cityHaze: '#6d4f86', windows: '#ffd89a',
    riverTop: '#b0698f', riverBot: '#1d1d45', glint: '#ffd4c0', farBank: '#231f44', farTrees: '#1d1a3a',
    bridge: '#1e1a38', bridgeLit: '#8d5a86', grassDark: '#141a30', grassMid: '#262a48', grassLit: '#8a5f93',
    path: '#4a3f68', pathLit: '#8a6a9a', fence: '#15122a', sil: '#110d22', rim: '#ffa8b8', sun: [960, 1000],
    trunk: '#21172e', blossom: ['#e7b4d0', '#c98fb6', '#f6dcec'],
  },
};

// ---------------------------------------------------------------- sky
export function drawSky(ctx, img, x, y, scale = 1) {
  if (!img) return;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

// ---------------------------------------------------------------- city
const cityCache = new Map();
export function cityStrip(palName, seed = 7, width = 2600, height = 360) {
  const key = palName + seed + width;
  if (cityCache.has(key)) return cityCache.get(key);
  const p = PAL[palName];
  const { canvas, ctx } = makeCanvas(width, height);
  const rnd = mulberry32(seed);
  const base = height;
  // three depth rows: far (hazier) to near
  const rows = [
    { hmin: 30, hmax: 120, wmin: 30, wmax: 90, haze: 0.65, gap: 0.2 },
    { hmin: 20, hmax: 190, wmin: 40, wmax: 120, haze: 0.4, gap: 0.3 },
    { hmin: 15, hmax: 90, wmin: 50, wmax: 150, haze: 0.15, gap: 0.15 },
  ];
  rows.forEach((row, ri) => {
    let x = -20;
    while (x < width) {
      const bw = lerp(row.wmin, row.wmax, rnd());
      let bh = lerp(row.hmin, row.hmax, Math.pow(rnd(), 1.6));
      if (rnd() < 0.04 && ri === 1) bh = 260 + rnd() * 60; // a few towers
      const col = mix(p.city, p.cityHaze, row.haze);
      ctx.fillStyle = rgba(col);
      ctx.fillRect(x, base - bh, bw, bh);
      // lit side facing the sun
      ctx.fillStyle = rgba(mix(p.cityLit, p.cityHaze, row.haze * 0.8), 0.55);
      ctx.fillRect(x + bw * 0.62, base - bh, bw * 0.38, bh);
      // rooftop details
      if (rnd() < 0.4) {
        ctx.fillStyle = rgba(col);
        ctx.fillRect(x + bw * 0.2, base - bh - 8, bw * 0.25, 8);
      }
      if (rnd() < 0.15) {
        ctx.fillRect(x + bw * 0.5, base - bh - 26, 2, 26);
      }
      // windows
      if (p.windows && ri > 0) {
        for (let wy = base - bh + 8; wy < base - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 8) {
            if (rnd() < 0.32) {
              ctx.fillStyle = rgba(p.windows, 0.5 + rnd() * 0.5);
              ctx.fillRect(wx, wy, 3, 4);
            }
          }
        }
      } else if (ri > 0) {
        ctx.fillStyle = rgba(mix(col, '#000000', 0.12), 0.5);
        for (let wy = base - bh + 8; wy < base - 6; wy += 10) ctx.fillRect(x + 4, wy, bw * 0.55, 2);
      }
      x += bw + (rnd() < row.gap ? rnd() * 40 : -rnd() * 6);
    }
  });
  // TV tower silhouette
  const tx = width * 0.3;
  ctx.fillStyle = rgba(mix(p.city, p.cityHaze, 0.5));
  ctx.beginPath();
  ctx.moveTo(tx - 22, base);
  ctx.lineTo(tx - 3, base - 300);
  ctx.lineTo(tx + 3, base - 300);
  ctx.lineTo(tx + 22, base);
  ctx.fill();
  ctx.fillRect(tx - 9, base - 230, 18, 14);
  ctx.fillRect(tx - 1.5, base - 350, 3, 50);
  cityCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------- river
export function river(ctx, p, y0, y1, t, sunX, o = {}) {
  const { skyImg = null, skyX = 0, skyY = 0, skyScale = 1, horizonY = y0 } = o;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-10, y0, W + 20, y1 - y0);
  ctx.clip();
  ctx.fillStyle = linGrad(ctx, 0, y0, 0, y1, [
    [0, p.riverTop],
    [1, p.riverBot],
  ]);
  ctx.fillRect(-10, y0, W + 20, y1 - y0);
  // mirrored sky reflection
  if (skyImg) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(0, horizonY * 2);
    ctx.scale(1, -1);
    ctx.filter = 'blur(3px)';
    ctx.drawImage(skyImg, skyX, skyY, skyImg.width * skyScale, skyImg.height * skyScale);
    ctx.restore();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = linGrad(ctx, 0, y0, 0, y1, [
      [0, 'rgba(255,255,255,1)'],
      [1, p.riverBot],
    ]);
    ctx.fillRect(-10, y0, W + 20, y1 - y0);
    ctx.globalCompositeOperation = 'source-over';
  }
  // ripples: thin horizontal lines whose density increases towards the viewer
  const rnd = mulberry32(31);
  for (let i = 0; i < 140; i++) {
    const v = rnd();
    const y = y0 + Math.pow(v, 1.8) * (y1 - y0);
    const depth = (y - y0) / (y1 - y0);
    const len = 20 + depth * 220 * rnd();
    const x = ((rnd() * (W + 400) + t * (10 + depth * 30)) % (W + 400)) - 200;
    ctx.globalAlpha = 0.15 + 0.25 * rnd();
    ctx.fillStyle = rgba(mix(p.riverBot, '#000000', 0.2));
    ctx.fillRect(x, y, len, 1 + depth * 2.5);
  }
  // sun glitter column
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) {
    const v = rnd();
    const y = y0 + Math.pow(v, 1.4) * (y1 - y0);
    const depth = (y - y0) / (y1 - y0);
    const spread = 40 + depth * 380;
    const x = sunX + (rnd() - 0.5) * 2 * spread * Math.pow(rnd(), 0.7);
    const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (3 + rnd() * 5) + rnd() * TAU), 3);
    ctx.globalAlpha = tw * (1 - Math.abs(x - sunX) / (spread * 1.1)) * 0.9;
    ctx.fillStyle = p.glint;
    const w = 4 + depth * 26 * rnd();
    ctx.fillRect(x - w / 2, y, w, 1 + depth * 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- grass
// Wind-swept grass blades along a ground line. Analytic sway from noise.
export function grass(ctx, t, o) {
  const {
    seed = 3, x0 = 0, x1 = W, yAt, n = 600, hmin = 10, hmax = 40, colors, wind = 1, lean = 0.3, width = 2.2,
    light = 0.5, ySpread = 6,
  } = o;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rnd());
    const y = yAt(x) + rnd() * ySpread;
    const hh = lerp(hmin, hmax, Math.pow(rnd(), 1.5));
    const ci = rnd();
    const g = noise2(x * 0.004 - t * 0.9 * wind, t * 0.3) * 0.5 + 0.5;
    const sway = (lean + g * 0.7 * wind + Math.sin(t * 2.3 + x * 0.05) * 0.06 * wind) * hh;
    const tipX = x + sway, tipY = y - hh * (1 - 0.25 * Math.abs(sway / hh));
    const lit = ci < light;
    ctx.strokeStyle = lit ? mixa(colors[1], colors[2], rnd(), 1) : mixa(colors[0], colors[1], rnd() * 0.6, 1);
    ctx.lineWidth = width * (0.6 + rnd() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x + sway * 0.1, y - hh * 0.55, tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- power lines
export function powerPole(ctx, x, yBase, h, col, o = {}) {
  const { arms = 2, w = 10 } = o;
  ctx.save();
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, yBase - h, w, h);
  for (let i = 0; i < arms; i++) {
    const y = yBase - h + 18 + i * 34;
    ctx.fillRect(x - 70, y, 140, 6);
    for (const dx of [-60, -20, 20, 60]) {
      ctx.fillRect(x + dx - 3, y - 10, 6, 10);
    }
  }
  // transformer can
  ctx.beginPath();
  ctx.roundRect(x + w / 2, yBase - h + 100, 26, 44, 5);
  ctx.fill();
  ctx.restore();
}

export function wires(ctx, x0, y0, x1, y1, sag, col, width = 2, count = 4, spacing = 10) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  for (let i = 0; i < count; i++) {
    const dy = i * spacing;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + dy);
    ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag + dy, x1, y1 + dy);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- railway crossing
// Japanese crossing signal ("fumikiri"): crossbuck, twin red lamps, arrow board.
// Local units: pole base at origin, ~560 tall. `on` = which lamp is lit (0/1), glow 0..1.
export function crossingSignal(ctx, x, y, s, t, p, o = {}) {
  const { on = 0, lit = 1, dark = '#1d1626', rim = p.rim } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // pole with yellow/black base
  ctx.fillStyle = dark;
  ctx.fillRect(-9, -560, 18, 560);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-10, -150, 20, 150);
  ctx.clip();
  for (let i = -2; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#e8c23a' : '#141018';
    ctx.beginPath();
    ctx.moveTo(-12, -i * 18);
    ctx.lineTo(12, -i * 18 - 14);
    ctx.lineTo(12, -i * 18 - 32);
    ctx.lineTo(-12, -i * 18 - 18);
    ctx.fill();
  }
  ctx.restore();
  // crossbuck (two striped boards)
  for (const a of [Math.PI / 5, -Math.PI / 5]) {
    ctx.save();
    ctx.translate(0, -500);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.rect(-130, -17, 260, 34);
    ctx.clip();
    for (let i = -8; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f0c93c' : '#17121c';
      ctx.beginPath();
      ctx.moveTo(i * 34, -18);
      ctx.lineTo(i * 34 + 34, -18);
      ctx.lineTo(i * 34 + 14, 18);
      ctx.lineTo(i * 34 - 20, 18);
      ctx.fill();
    }
    ctx.restore();
  }
  // lamp bar
  ctx.fillStyle = dark;
  ctx.fillRect(-150, -404, 300, 14);
  for (const side of [-1, 1]) {
    const lx = side * 112, ly = -380;
    const isOn = (side < 0 ? 0 : 1) === on;
    // backing plate
    ctx.fillStyle = '#0f0b14';
    ctx.beginPath();
    ctx.arc(lx, ly, 54, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#f2efe8';
    ctx.lineWidth = 6;
    ctx.stroke();
    // lens
    ctx.fillStyle = isOn
      ? radGrad(ctx, lx, ly, 0, 40, [
          [0, '#fff3e0'],
          [0.3, '#ff6a4a'],
          [1, '#d4141e'],
        ])
      : radGrad(ctx, lx, ly, 0, 40, [
          [0, '#5a1a22'],
          [1, '#2a0a10'],
        ]);
    ctx.beginPath();
    ctx.arc(lx, ly, 38, 0, TAU);
    ctx.fill();
    // hood
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(lx, ly, 52, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(lx + 44, ly - 40);
    ctx.quadraticCurveTo(lx, ly - 82, lx - 44, ly - 40);
    ctx.fill();
    // specular rim from the sunset
    ctx.strokeStyle = rgba(rim, 0.7);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(lx, ly, 55, -0.9, -0.1);
    ctx.stroke();
  }
  // arrow direction board
  ctx.fillStyle = '#0f0b14';
  ctx.beginPath();
  ctx.roundRect(-74, -310, 148, 52, 6);
  ctx.fill();
  ctx.fillStyle = on ? '#ffd38a' : '#ff9a5a';
  ctx.globalAlpha = 0.55 + 0.45 * lit;
  ctx.beginPath();
  ctx.moveTo(-60, -284);
  ctx.lineTo(-30, -302);
  ctx.lineTo(-30, -266);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(60, -284);
  ctx.lineTo(30, -302);
  ctx.lineTo(30, -266);
  ctx.fill();
  ctx.fillRect(-30, -289, 60, 10);
  ctx.globalAlpha = 1;
  // warning bell box at top
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(-26, -600, 52, 44, 8);
  ctx.fill();
  ctx.restore();
}

// Glow of lit lamps, drawn additively above everything (after the signal).
export function crossingGlow(ctx, x, y, s, on, amt = 1) {
  const lx = x + (on ? 112 : -112) * s, ly = y - 380 * s;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = radGrad(ctx, lx, ly, 0, 260 * s, [
    [0, rgba('#ff7a5a', 0.85 * amt)],
    [0.2, rgba('#ff3a2a', 0.45 * amt)],
    [1, rgba('#ff2a1a', 0)],
  ]);
  ctx.fillRect(lx - 260 * s, ly - 260 * s, 520 * s, 520 * s);
  ctx.restore();
}

export function barrier(ctx, x, y, len, s, angle, p) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#1d1626';
  ctx.fillRect(-16, -90, 32, 90);
  ctx.translate(0, -70);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.rect(0, -7, len, 14);
  ctx.clip();
  for (let i = 0; i * 40 < len; i++) {
    ctx.fillStyle = i % 2 ? '#f0c93c' : '#17121c';
    ctx.beginPath();
    ctx.moveTo(i * 40, -8);
    ctx.lineTo(i * 40 + 40, -8);
    ctx.lineTo(i * 40 + 28, 8);
    ctx.lineTo(i * 40 - 12, 8);
    ctx.fill();
  }
  ctx.restore();
}

// Rows of two-storey houses (gabled roofs) as a silhouette strip.
const houseCache = new Map();
export function houseStrip(palName, seed = 3, width = 2600, height = 260, col = null) {
  const key = palName + seed + width + (col || '');
  if (houseCache.has(key)) return houseCache.get(key);
  const p = PAL[palName];
  const { canvas, ctx } = makeCanvas(width, height);
  const rnd = mulberry32(seed);
  let x = -40;
  const c = col || p.farTrees;
  while (x < width) {
    const w = 120 + rnd() * 140, hh = 90 + rnd() * 90;
    const base = height;
    ctx.fillStyle = c;
    ctx.fillRect(x, base - hh, w, hh);
    // gabled roof
    ctx.beginPath();
    const roof = 30 + rnd() * 30;
    if (rnd() < 0.6) {
      ctx.moveTo(x - 10, base - hh);
      ctx.lineTo(x + w / 2, base - hh - roof);
      ctx.lineTo(x + w + 10, base - hh);
    } else {
      ctx.moveTo(x - 8, base - hh);
      ctx.lineTo(x + w * 0.2, base - hh - roof * 0.7);
      ctx.lineTo(x + w * 0.8, base - hh - roof * 0.7);
      ctx.lineTo(x + w + 8, base - hh);
    }
    ctx.fill();
    // antenna / water tank details
    if (rnd() < 0.35) {
      ctx.fillRect(x + w * 0.6, base - hh - roof - 30, 3, 34);
      ctx.fillRect(x + w * 0.6 - 14, base - hh - roof - 24, 30, 3);
    }
    // a few lit windows (warm) for evening
    if (p.windows) {
      ctx.fillStyle = rgba(p.windows, 0.85);
      for (let k = 0; k < 3; k++) if (rnd() < 0.5) ctx.fillRect(x + 14 + rnd() * (w - 40), base - hh + 18 + rnd() * (hh - 50), 16, 12);
    }
    x += w + rnd() * 30 - 6;
  }
  houseCache.set(key, canvas);
  return canvas;
}

// Big commuter train seen from the side, moving fast (motion-blurred).
// x = position of the train's nose (front) moving toward -x. Returns gaps for strobing.
export function trainBig(ctx, x, y, h, t, p, o = {}) {
  const { cars = 6, carLen = 980, body = '#d9d6d2', stripe = '#2f8a6e', stripe2 = '#e86e3a', blur = 1 } = o;
  const top = y - h;
  for (let c = 0; c < cars; c++) {
    const cx = x + c * (carLen + 26);
    if (cx > W + 50 || cx + carLen < -50) continue;
    // body, slightly darker as it's against the light
    ctx.fillStyle = linGrad(ctx, 0, top, 0, y, [
      [0, rgba(mix(body, p.sil, 0.45))],
      [0.5, rgba(mix(body, p.sil, 0.25))],
      [1, rgba(mix(body, p.sil, 0.6))],
    ]);
    ctx.beginPath();
    ctx.roundRect(cx, top, carLen, h, c === 0 ? [60, 10, 4, 30] : 10);
    ctx.fill();
    // stripes
    ctx.fillStyle = rgba(mix(stripe, p.sil, 0.35));
    ctx.fillRect(cx, y - h * 0.3, carLen, h * 0.07);
    ctx.fillStyle = rgba(mix(stripe2, p.sil, 0.3));
    ctx.fillRect(cx, y - h * 0.22, carLen, h * 0.035);
    // windows: we see the bright sunset through the car
    for (let k = 0; k < 6; k++) {
      const wx = cx + 90 + k * 140;
      ctx.fillStyle = linGrad(ctx, wx, 0, wx + 110, 0, [
        [0, rgba(p.rim, 0.65)],
        [0.5, rgba(mix(p.rim, '#ffffff', 0.4), 0.95)],
        [1, rgba(p.rim, 0.65)],
      ]);
      ctx.fillRect(wx, top + h * 0.17, 110, h * 0.33);
    }
    // doors
    ctx.strokeStyle = rgba(p.sil, 0.55);
    ctx.lineWidth = 3;
    for (const dx of [40, carLen / 2 - 40, carLen - 120]) {
      ctx.strokeRect(cx + dx, top + h * 0.12, 80, h * 0.8);
    }
    // under-floor equipment + bogies
    ctx.fillStyle = '#17121c';
    ctx.fillRect(cx + 40, y, carLen - 80, h * 0.1);
    for (const bx of [140, carLen - 140]) {
      ctx.beginPath();
      ctx.arc(cx + bx - 40, y + h * 0.12, h * 0.07, 0, TAU);
      ctx.arc(cx + bx + 40, y + h * 0.12, h * 0.07, 0, TAU);
      ctx.fill();
    }
    // speed streaks on the body
    ctx.save();
    ctx.globalAlpha = 0.25 * blur;
    ctx.fillStyle = '#ffffff';
    const rnd = mulberry32(c * 13 + 5);
    for (let k = 0; k < 10; k++) ctx.fillRect(cx + rnd() * carLen, top + rnd() * h, 120 + rnd() * 300, 2);
    ctx.restore();
  }
}

export function rails(ctx, y, p, o = {}) {
  const { h = 60, col = '#2a2030' } = o;
  // ballast
  ctx.fillStyle = linGrad(ctx, 0, y - h * 0.3, 0, y + h, [
    [0, rgba(mix(p.path, p.sil, 0.5))],
    [1, rgba(mix(p.path, p.sil, 0.7))],
  ]);
  ctx.fillRect(-50, y - h * 0.3, W + 100, h * 1.3);
  // sleepers
  ctx.fillStyle = rgba(mix(col, p.path, 0.2));
  for (let x = -40; x < W + 40; x += 34) ctx.fillRect(x, y - h * 0.15, 18, h * 0.5);
  // rails with sunset glints
  for (const ry of [y - h * 0.12, y + h * 0.28]) {
    ctx.fillStyle = col;
    ctx.fillRect(-50, ry - 4, W + 100, 9);
    ctx.fillStyle = rgba(p.rim, 0.9);
    ctx.fillRect(-50, ry - 4, W + 100, 2.5);
  }
}
