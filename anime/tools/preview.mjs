// Render selected timestamps to PNG for quick visual checks.
// Usage: node tools/preview.mjs OUT_DIR t1 t2 ...   (server must serve the repo root on :8765)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [out, ...times] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log('[page]', m.text(), JSON.stringify(m.location())));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8765/anime/index.html?render', { waitUntil: 'load' });
await page.waitForFunction(() => window.__film);
await page.evaluate(() => window.__film.ready);
for (const t of times) {
  const t0 = Date.now();
  const url = await page.evaluate((t) => {
    window.__film.render(t);
    return document.getElementById('film').toDataURL('image/png');
  }, Number(t));
  const file = path.join(out, `f_${String(t).replace('.', '_')}.png`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file, Date.now() - t0, 'ms');
}
await browser.close();
