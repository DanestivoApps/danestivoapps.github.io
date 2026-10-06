// 2.5D animation of painted key art: a clean background plate plus cut-out
// characters. Hair and cloth sway through a WebGL displacement pass driven by
// a per-character weight map; blinks, mouth movement and breathing are layered
// on top in 2D. Coordinates are in pixels of the original 1376x768 artwork.
import { W, H, clamp, rgba, radGrad, loadImage } from './core.js';

export const ART = { ready: false };

const VS = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;

// disp map: R = hair weight, G = cloth weight, B = 1 where the face must stay rigid.
const FS = `
precision highp float;
varying vec2 uv;
uniform sampler2D img;
uniform sampler2D disp;
uniform float t;
uniform vec2 wind;      // x: strength, y: direction (+1 right / -1 left)
uniform float gust;     // extra short-lived amplitude
uniform vec2 px;        // 1/size
uniform float aspect;   // h/w of the layer
void main() {
  vec4 dm = texture2D(disp, uv);
  float h = dm.r, c = dm.g;
  float y = uv.y * aspect;
  float w1 = sin(t * 2.3 - y * 9.0 + uv.x * 3.0);
  float w2 = sin(t * 3.7 - y * 17.0 + 1.3);
  float w3 = sin(t * 6.1 - y * 31.0 + uv.x * 11.0);
  float amp = (wind.x + gust) * h;
  float dx = amp * (0.012 * wind.y * (0.55 + 0.45 * w1) + 0.004 * w2 + 0.0018 * w3);
  float dy = amp * (0.002 * w2 - 0.0015 * (0.5 + 0.5 * w1));
  dx += c * (wind.x * 0.5 + gust) * 0.003 * sin(t * 5.0 + uv.x * 40.0 + y * 7.0);
  vec2 s = uv - vec2(dx, dy * aspect);
  gl_FragColor = texture2D(img, s);
}`;

let gl, glCanvas, prog, buf;
const textures = new Map();

function initGL() {
  glCanvas = document.createElement('canvas');
  gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true });
  if (!gl) return false;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.log(gl.getShaderInfoLog(s));
    return s;
  };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return true;
}

function texture(img) {
  if (textures.has(img)) return textures.get(img);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  textures.set(img, tex);
  return tex;
}

// Returns a canvas with the character warped by the wind at time t.
function warp(ch, t, wind = 1, dir = 1, gust = 0) {
  if (!gl) return ch.img;
  const { img, disp } = ch;
  if (glCanvas.width !== img.width || glCanvas.height !== img.height) {
    glCanvas.width = img.width;
    glCanvas.height = img.height;
  }
  gl.viewport(0, 0, img.width, img.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture(img));
  gl.uniform1i(gl.getUniformLocation(prog, 'img'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture(disp));
  gl.uniform1i(gl.getUniformLocation(prog, 'disp'), 1);
  gl.uniform1f(gl.getUniformLocation(prog, 't'), t);
  gl.uniform2f(gl.getUniformLocation(prog, 'wind'), wind, dir);
  gl.uniform1f(gl.getUniformLocation(prog, 'gust'), gust);
  gl.uniform2f(gl.getUniformLocation(prog, 'px'), 1 / img.width, 1 / img.height);
  gl.uniform1f(gl.getUniformLocation(prog, 'aspect'), img.height / img.width);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return glCanvas;
}

export async function loadArt(base) {
  const meta = await fetch(`${base}/art.json`).then((r) => r.json());
  const [plate, plateBg, girl, girlD, boy, boyD] = await Promise.all([
    loadImage(`${base}/${meta.plate.src}`),
    loadImage(`${base}/${meta.plate.bg}`),
    loadImage(`${base}/${meta.girl.src}`),
    loadImage(`${base}/${meta.girl.disp}`),
    loadImage(`${base}/${meta.boy.src}`),
    loadImage(`${base}/${meta.boy.disp}`),
  ]);
  ART.meta = meta;
  ART.plate = { img: plate, scale: meta.plate.scale };
  ART.plateBg = { img: plateBg, scale: 1 };
  ART.girl = { ...meta.girl, img: girl, disp: girlD };
  ART.boy = { ...meta.boy, img: boy, disp: boyD };
  initGL();
  ART.ready = !!(plate && girl && boy);
  return ART;
}

// Camera: (cx, cy) = artwork point at screen centre, s = screen px per artwork px.
export const toScreen = (cam, x, y) => [W / 2 + (x - cam.cx) * cam.s, H / 2 + (y - cam.cy) * cam.s];

export function drawPlate(ctx, cam, o = {}) {
  const { img, scale } = o.defocus ? ART.plateBg : ART.plate;
  const [x, y] = toScreen(cam, 0, 0);
  ctx.save();
  if (o.blur) ctx.filter = `blur(${o.blur}px)`;
  ctx.drawImage(img, x, y, (img.width / scale) * cam.s, (img.height / scale) * cam.s);
  ctx.restore();
}

// Character with wind, breathing, blinks and mouth.
export function drawChar(ctx, who, cam, t, o = {}) {
  const ch = ART[who];
  const { wind = 1, dir = 1, gust = 0, blink = 0, mouth = 0, blush = 0, dx = 0, dy = 0, breath = 1, sparkle = 0, alpha = 1, zoom = 1 } = o;
  const src = warp(ch, t, wind, dir, gust);
  const sc = ch.scale;
  // zoom scales the character about its feet (bottom centre), e.g. to stand further back
  const fx0 = ch.x + ch.w / 2 + dx, fy0 = ch.y + ch.h + dy;
  const zc = { cx: fx0 - (fx0 - cam.cx) / zoom, cy: fy0 - (fy0 - cam.cy) / zoom, s: cam.s * zoom };
  cam = zc;
  const [x, y] = toScreen(cam, ch.x + dx, ch.y + dy);
  const w = (ch.img.width / sc) * cam.s, h = (ch.img.height / sc) * cam.s;
  const br = 1 + 0.005 * breath * Math.sin((t * Math.PI * 2) / 3.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y + h);
  ctx.scale(1, br);
  ctx.drawImage(src, 0, -h, w, h);
  ctx.restore();
  // facial overlays move with the (breathing) head
  const P = (px, py) => {
    const [sx, sy] = toScreen(cam, px + dx, py + dy);
    return [sx, y + h - (y + h - sy) * br];
  };
  if (blush > 0) {
    for (const [ex, ey, ew] of ch.eyes) {
      const [cx, cy] = P(ex, ey + ew * 0.62);
      const r = ew * 0.75 * cam.s;
      ctx.save();
      ctx.globalAlpha = blush * 0.55 * alpha;
      ctx.fillStyle = radGrad(ctx, cx, cy, 0, r, [
        [0, 'rgba(255,110,140,0.9)'],
        [1, 'rgba(255,110,140,0)'],
      ]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (blink > 0.02) {
    ch.eyes.forEach(([ex, ey, ew, eh, skin, lid], i) => {
      const [cx, cy] = P(ex, ey);
      const w2 = ew * cam.s, h2 = eh * cam.s;
      const k = clamp(blink);
      const top = cy - h2 * 0.62;
      const bottom = top + h2 * 1.08 * k;
      ctx.save();
      ctx.globalAlpha = alpha;
      // eyelid skin sliding down
      ctx.beginPath();
      ctx.ellipse(cx, cy - h2 * 0.05, w2 * 0.62, h2 * 0.66, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = skin;
      ctx.fillRect(cx - w2, top - h2, w2 * 2, bottom - top + h2);
      ctx.fillStyle = rgba(lid, 0.35);
      ctx.fillRect(cx - w2, bottom - h2 * 0.12, w2 * 2, h2 * 0.12);
      ctx.restore();
      // lash line at the lid edge
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ch.lash;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, h2 * 0.11);
      const sag = h2 * (0.12 + 0.1 * k);
      const side = i === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx - w2 * 0.58, bottom - h2 * 0.08 + (side < 0 ? h2 * 0.06 : 0));
      ctx.quadraticCurveTo(cx, bottom + sag * (k > 0.8 ? 1 : 0.2), cx + w2 * 0.58, bottom - h2 * 0.08 + (side > 0 ? h2 * 0.06 : 0));
      ctx.stroke();
      ctx.restore();
    });
  }
  if (mouth > 0.03 && ch.mouth) {
    // open mouth hanging from the painted smile line (which stays as the upper lip)
    const [L, M, R] = ch.mouth.map(([mx, my]) => P(mx, my));
    const C = [2 * M[0] - (L[0] + R[0]) / 2, 2 * M[1] - (L[1] + R[1]) / 2];
    const hh = (who === 'girl' ? 7 : 6) * cam.s * mouth;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    ctx.quadraticCurveTo(C[0], C[1], R[0], R[1]);
    ctx.quadraticCurveTo(C[0] + (R[0] - L[0]) * 0.08, C[1] + hh * 2.3, L[0], L[1]);
    ctx.closePath();
    ctx.fillStyle = '#6e2632';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(222,118,128,0.95)';
    ctx.beginPath();
    ctx.ellipse(C[0] + (R[0] - L[0]) * 0.04, (L[1] + R[1]) / 2 + hh * 1.25, (R[0] - L[0]) * 0.22, hh * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,248,0.92)';
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    ctx.quadraticCurveTo(C[0], C[1], R[0], R[1]);
    ctx.quadraticCurveTo(C[0], C[1] + Math.min(hh * 0.5, cam.s * 1.6), L[0], L[1]);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#4a2420';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, cam.s * 0.9);
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    ctx.quadraticCurveTo(C[0], C[1], R[0], R[1]);
    ctx.stroke();
    ctx.restore();
  }
  if (sparkle > 0) {
    // watery glints in the eyes
    ch.eyes.forEach(([ex, ey, ew, eh], i) => {
      const [cx, cy] = P(ex + ew * 0.12, ey + eh * 0.22);
      const r = ew * cam.s * 0.07 * (0.8 + 0.4 * Math.sin(t * 6 + i * 2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sparkle * alpha;
      ctx.fillStyle = radGrad(ctx, cx, cy, 0, r * 2.5, [
        [0, 'rgba(255,255,255,1)'],
        [0.3, 'rgba(255,240,250,0.8)'],
        [1, 'rgba(255,240,250,0)'],
      ]);
      ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
      ctx.restore();
    });
  }
}

export function charCenter(who) {
  const c = ART[who];
  const [ex, ey] = c.eyes[0];
  const [fx, fy] = c.eyes[1];
  return [(ex + fx) / 2, (ey + fy) / 2];
}
