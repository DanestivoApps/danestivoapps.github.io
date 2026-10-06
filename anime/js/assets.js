// Asset loading: baked skies (tools/bake_skies.py) and the animated key art (art.js).
import { loadImage } from './core.js';
import { loadArt } from './art.js';

export const A = { sky: {} };

export async function loadAssets(base, onProgress = () => {}) {
  const skies = ['open', 'sunset', 'twilight'];
  let done = 0;
  await Promise.all([
    loadArt(`${base}/art`),
    ...skies.map(async (n) => {
      A.sky[n] = await loadImage(`${base}/sky_${n}.jpg`);
      onProgress(++done / skies.length);
    }),
  ]);
  return A;
}
