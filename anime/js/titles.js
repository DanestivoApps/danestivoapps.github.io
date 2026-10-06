// On-screen text: Japanese lines with Spanish subtitles, and the title card.
import { W, H, clamp, lerp, ease, buffer, linGrad } from './core.js';

const JP = '"Shippori", "Noto Serif CJK JP", serif';
const ES = '"ZenMaru", "Noto Sans CJK JP", sans-serif';

// [start, end, japanese, spanish, style]
export const CUES = [
  [2.0, 6.6, 'あの秋、風が君の名前を運んできた。', 'Aquel otoño, el viento me trajo tu nombre.'],
  [14.0, 17.6, 'ずっと、言えなかった言葉がある。', 'Hay unas palabras que nunca me atreví a decir.'],
  [25.0, 26.9, '……ハナ？', '…¿Hana?', 'him'],
  [28.0, 31.3, '影だけが、先に手をつないだ。', 'Solo nuestras sombras se tomaron de la mano primero.'],
  [35.3, 37.9, '好きです。', 'Me gustas.', 'confess'],
  [41.0, 44.0, '……俺も。ずっと前から。', '…Yo también. Desde hace mucho.', 'him'],
];

export function prepareTitles() {}

function cue(ctx, T, [t0, t1, jp, es, style]) {
  if (T < t0 - 0.1 || T > t1 + 0.6) return;
  const a = clamp((T - t0) / 0.5) * (1 - clamp((T - t1) / 0.6));
  if (a <= 0) return;
  const rise = (1 - ease.outCubic(clamp((T - t0) / 0.9))) * 10;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const big = style === 'confess';
  const jpSize = big ? 58 : 40;
  const y = H - (big ? 150 : 128) + rise;
  // character-by-character reveal of the Japanese line
  const chars = [...jp];
  const shown = clamp((T - t0) / Math.max(0.6, Math.min(1.6, chars.length * 0.09)));
  ctx.font = `700 ${jpSize}px ${JP}`;
  const total = ctx.measureText(jp).width;
  let x = W / 2 - total / 2;
  ctx.textAlign = 'left';
  ctx.shadowColor = style === 'him' ? 'rgba(40,60,120,0.85)' : 'rgba(120,30,70,0.8)';
  ctx.shadowBlur = 18;
  for (let i = 0; i < chars.length; i++) {
    const ca = clamp(shown * chars.length - i);
    const cw = ctx.measureText(chars[i]).width;
    if (ca > 0) {
      ctx.globalAlpha = a * ca;
      ctx.fillStyle = style === 'him' ? '#e8f1ff' : '#fff4f7';
      ctx.fillText(chars[i], x, y - (1 - ca) * 6);
    }
    x += cw;
  }
  // Spanish subtitle
  ctx.textAlign = 'center';
  ctx.globalAlpha = a * clamp((T - t0 - 0.25) / 0.5);
  ctx.font = `500 ${big ? 34 : 30}px ${ES}`;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(es, W / 2, y + (big ? 62 : 52));
  ctx.restore();
}

const LAT = '"Cormorant", "Noto Serif CJK JP", serif';
const TITLE = '秋風のシグナル';

function titleCard(ctx, T) {
  const t0 = 52.2;
  if (T < t0 - 0.1) return;
  const cx = W / 2, cy = H / 2 - 40;
  // main title, character by character
  const b = buffer('title');
  const c = b.ctx;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.font = `700 150px ${JP}`;
  const chars = [...TITLE];
  const widths = chars.map((ch) => c.measureText(ch).width);
  const total = widths.reduce((a, w) => a + w, 0) + (chars.length - 1) * 14;
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    const k = clamp((T - t0 - i * 0.13) / 0.9);
    if (k > 0) {
      const e = ease.outCubic(k);
      c.save();
      c.globalAlpha = e;
      c.translate(x + widths[i] / 2, cy + (1 - e) * 18);
      c.scale(1 + (1 - e) * 0.15, 1 + (1 - e) * 0.15);
      c.filter = `blur(${(1 - e) * 8}px)`;
      c.fillStyle = '#fff6f9';
      c.fillText(ch, -widths[i] / 2, 0);
      c.restore();
    }
    x += widths[i] + 14;
  });
  // a glint sweeping across the letters
  const sw = (T - (t0 + 1.4)) / 1.1;
  if (sw > 0 && sw < 1) {
    c.save();
    c.globalCompositeOperation = 'source-atop';
    const gx = lerp(cx - total / 2 - 200, cx + total / 2 + 200, ease.inOutSine(sw));
    c.fillStyle = linGrad(c, gx - 120, 0, gx + 120, 0, [
      [0, 'rgba(255,190,215,0)'],
      [0.5, 'rgba(255,214,170,1)'],
      [1, 'rgba(255,190,215,0)'],
    ]);
    c.fillRect(0, cy - 120, W, 240);
    c.restore();
  }
  ctx.save();
  // soft pink glow behind the title
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.85;
  ctx.filter = 'blur(18px)';
  ctx.drawImage(b.canvas, 0, 0);
  ctx.filter = 'blur(4px)';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(b.canvas, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(255,120,170,0.8)';
  ctx.shadowBlur = 30;
  ctx.drawImage(b.canvas, 0, 0);
  ctx.restore();
  // thin ornamental rules
  const rk = ease.inOutCubic(clamp((T - t0 - 1.0) / 1.2));
  if (rk > 0) {
    ctx.save();
    ctx.globalAlpha = rk * 0.8;
    ctx.strokeStyle = '#ffd6e4';
    ctx.lineWidth = 1.5;
    const half = 380 * rk;
    for (const y of [cy - 112, cy + 104]) {
      ctx.beginPath();
      ctx.moveTo(cx - half, y);
      ctx.lineTo(cx + half, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // romaji + Spanish subtitle
  const ra = clamp((T - t0 - 1.5) / 0.9);
  if (ra > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = ra;
    ctx.fillStyle = '#ffe9f0';
    ctx.shadowColor = 'rgba(255,120,170,0.7)';
    ctx.shadowBlur = 16;
    ctx.font = `italic 500 46px ${LAT}`;
    ctx.letterSpacing = `${lerp(30, 14, ease.outCubic(ra))}px`;
    ctx.fillText('Akikaze no Signal', cx, cy + 160);
    ctx.restore();
  }
  const sa = clamp((T - t0 - 2.2) / 0.9);
  if (sa > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = sa * 0.9;
    ctx.fillStyle = '#f3dbe6';
    ctx.font = `500 30px ${ES}`;
    ctx.letterSpacing = '3px';
    ctx.fillText('— La señal del viento de otoño —', cx, cy + 224);
    ctx.restore();
  }
  const pa = clamp((T - t0 - 3.4) / 1.0);
  if (pa > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = pa * 0.75;
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 22px ${ES}`;
    ctx.letterSpacing = '10px';
    ctx.fillText('PRÓXIMAMENTE', cx, H - 120);
    ctx.restore();
  }
}

export function drawTitles(ctx, T) {
  for (const c of CUES) cue(ctx, T, c);
  titleCard(ctx, T);
}
