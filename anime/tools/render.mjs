// Offline frame-exact renderer: N headless Chromium pages render disjoint frame
// ranges to JPEG, then ffmpeg muxes them with the soundtrack.
// Usage: node tools/render.mjs FRAMES_DIR [fps=30] [workers=4] [from=0] [to=duration]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [dir, fpsArg = '30', workersArg = '4', fromArg, toArg] = process.argv.slice(2);
const fps = Number(fpsArg);
const workers = Number(workersArg);
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:8765/anime/index.html?render', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__film);
  await page.evaluate(() => window.__film.ready);
  return page;
}

const duration = await (async () => {
  const p = await openPage();
  const d = await p.evaluate(() => window.__film.duration);
  await p.close();
  return d;
})();
const from = Math.round(Number(fromArg ?? 0) * fps);
const to = Math.round(Number(toArg ?? duration) * fps);
const frames = [];
for (let f = from; f < to; f++) frames.push(f);

let done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await openPage();
  while (frames.length) {
    const f = frames.shift();
    const file = path.join(dir, `f${String(f).padStart(5, '0')}.jpg`);
    if (fs.existsSync(file)) {
      done++;
      continue;
    }
    const url = await page.evaluate((t) => {
      window.__film.render(t);
      return document.getElementById('film').toDataURL('image/jpeg', 0.96);
    }, f / fps);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    done++;
    if (done % 50 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${to - from} frames, ${(done / el).toFixed(2)} fps, eta ${((to - from - done) / (done / el)).toFixed(0)}s`);
    }
  }
  await page.close();
}
await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
await browser.close();
console.log('rendered', to - from, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
