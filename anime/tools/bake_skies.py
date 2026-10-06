"""Bake painterly anime skies (gradient + cel-shaded cumulus + cirrus) to images.

Usage: python3 bake_skies.py OUT_DIR [name ...]

Each sky is generated procedurally and deterministically: billowy cumulus are
built from stacked hemispheric "puffs" whose height field gives cauliflower-like
normals, then lit by a low sun with a soft cel ramp, silver linings and haze.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ramp(stops, t):
    """stops: list of (pos, '#hex'); t: array -> (...,3) colours."""
    t = np.asarray(t, dtype=np.float32)
    pos = np.array([s[0] for s in stops], dtype=np.float32)
    cols = np.stack([hexc(s[1]) for s in stops])
    out = np.zeros(t.shape + (3,), dtype=np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out


def value_noise(rng, h, w, cell):
    gh, gw = int(h / cell) + 3, int(w / cell) + 3
    g = rng.random((gh, gw)).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    return ndimage.map_coordinates(g, [yy / cell + 1, xx / cell + 1], order=3, mode='wrap')


def fbm(rng, h, w, cell, octaves=5, gain=0.5, aniso=(1.0, 1.0)):
    acc = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for _ in range(octaves):
        gh, gw = int(h / (cell * aniso[0])) + 3, int(w / (cell * aniso[1])) + 3
        g = rng.random((gh, gw)).astype(np.float32)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        acc += amp * ndimage.map_coordinates(
            g, [yy / (cell * aniso[0]) + 1, xx / (cell * aniso[1]) + 1], order=3, mode='wrap')
        norm += amp
        amp *= gain
        cell /= 2.0
        if cell < 1.5:
            break
    return acc / norm


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.rgb = np.zeros((h, w, 3), np.float32)


def sky_gradient(w, h, stops, sun, glow):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = yy / (h - 1)
    col = ramp(stops, t)
    sx, sy = sun
    d = np.sqrt((xx - sx) ** 2 + ((yy - sy) * 1.25) ** 2)
    for radius, colour, strength in glow:
        g = np.exp(-(d / radius) ** 2)[..., None] * strength
        col = col + (hexc(colour) - col) * np.clip(g, 0, 1)
    return col


def make_cumulus(rng, cx, base, width, height, detail=3):
    """Return list of puffs (x, y, r, z) forming a towering cumulus."""
    puffs = []
    scale = min(height, 0.55 * width)
    n1 = max(6, int(width / (scale * 0.16)) + 2)
    xs = np.linspace(cx - width / 2, cx + width / 2, n1)
    phase = rng.uniform(0, 6.28)
    for i, x in enumerate(xs):
        u = (x - cx) / (width / 2)
        lump = 0.82 + 0.18 * np.sin(u * 5.0 + phase) + 0.12 * rng.random()
        prof = max(0.05, (1 - u * u)) ** 0.9 * lump
        top = base - height * prof
        r = scale * (0.09 + 0.08 * (1 - abs(u))) * (0.8 + 0.4 * rng.random())
        y = base - r * 0.3
        while y > top + r * 0.5:
            puffs.append((x + rng.normal(0, r * 0.45), y, r * (0.8 + 0.4 * rng.random()), -r * 0.3))
            y -= r * (0.6 + 0.4 * rng.random())
        puffs.append((x + rng.normal(0, r * 0.1), top + r * 0.5, r, 0.0))
    nb = max(4, int(width / (scale * 0.22)))
    for x in np.linspace(cx - width * 0.42, cx + width * 0.42, nb):
        r = scale * rng.uniform(0.15, 0.2)
        puffs.append((x + rng.normal(0, r * 0.2), base - r * 0.55, r, -r * 0.4))
    level = [p for p in puffs]
    for d in range(detail):
        nxt = []
        for (x, y, r, z) in level:
            k = int(2 + rng.integers(0, 3))
            for j in range(k):
                ang = rng.uniform(-np.pi * 0.92, -np.pi * 0.08)
                rr = r * rng.uniform(0.3, 0.5)
                dist = r * rng.uniform(0.7, 0.9)
                px, py = x + np.cos(ang) * dist, y + np.sin(ang) * dist
                if py > base - rr * 0.5:
                    continue
                nxt.append((px, py, rr, z + r * 0.1))
        puffs.extend(nxt)
        level = nxt
    return puffs


def raster_cloud(puffs, pad=40):
    """Smooth-union height field of puffs inside their own bounding box."""
    xs0 = min(p[0] - p[2] for p in puffs) - pad
    ys0 = min(p[1] - p[2] for p in puffs) - pad
    xs1 = max(p[0] + p[2] for p in puffs) + pad
    ys1 = max(p[1] + p[2] for p in puffs) + pad
    ox, oy = int(np.floor(xs0)), int(np.floor(ys0))
    w, h = int(np.ceil(xs1)) - ox, int(np.ceil(ys1)) - oy
    rmean = float(np.mean([p[2] for p in puffs]))
    k = max(2.0, rmean * 0.2)
    acc = np.zeros((h, w), np.float64)
    for (x, y, r, z) in puffs:
        x -= ox
        y -= oy
        x0, x1 = int(max(0, x - r - 1)), int(min(w, x + r + 2))
        y0, y1 = int(max(0, y - r - 1)), int(min(h, y + r + 2))
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float64)
        d2 = (xx - x) ** 2 + (yy - y) ** 2
        inside = d2 < r * r
        v = np.sqrt(np.maximum(0.0, r * r - d2)) + z
        acc[y0:y1, x0:x1] += np.where(inside, np.exp(np.minimum(v / k, 60.0)), 0.0)
    hf = np.where(acc > 0, k * np.log(np.maximum(acc, 1e-30)), -1.0).astype(np.float32)
    return hf, ox, oy


def shade_cloud(hf, ox, oy, base, sun_xy, pal, light_z, rng, haze=0.0, haze_col='#ffffff', rim=1.0,
                fringe=0.7, cel=0.62):
    h, w = hf.shape
    mask = (hf > 0).astype(np.float32)
    alpha = smoothstep(0.0, 1.8, hf)
    hs = np.maximum(hf, 0.0)
    big = ndimage.gaussian_filter(hs, max(4.0, h * 0.012))
    small = ndimage.gaussian_filter(hs, 1.5)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    lx = sun_xy[0] - (xx + ox)
    ly = sun_xy[1] - (yy + oy)
    ll = np.sqrt(lx * lx + ly * ly) + 1e-3
    proximity = np.exp(-ll / 1000.0)
    lx, ly = lx / ll, ly / ll
    lz = light_z * (1 - proximity) - 0.5 * proximity

    def lambert(f, zscale):
        gy, gx = np.gradient(f)
        nz = np.full_like(gx, zscale)
        n = np.sqrt(gx * gx + gy * gy + nz * nz)
        nx, ny, nzz = -gx / n, -gy / n, nz / n
        ln = np.sqrt(lx * lx + ly * ly + lz * lz)
        return (nx * lx + ny * ly + nzz * lz) / ln, nx, ny

    # large-scale pillow form: multi-scale blur of the silhouette (no medial ridges)
    m = (hf > 0).astype(np.float32)
    size = max(h, w)
    dome = (ndimage.gaussian_filter(m, size * 0.03) * 0.5 + ndimage.gaussian_filter(m, size * 0.07) * 0.35
            + ndimage.gaussian_filter(m, size * 0.14) * 0.15) * size * 0.25
    form = dome + small * 0.22
    lb, nx, ny = lambert(dome + small * 0.08, 0.9)
    ls, _, _ = lambert(small, 1.0)
    edge_zone = 1 - smoothstep(0.55, 0.92, ndimage.gaussian_filter(m, size * 0.02))
    lam = lb * 0.9 + ls * (0.1 + 0.25 * edge_zone)
    s = lam * 0.5 + 0.5
    # two-tone cel boundary with a soft edge, plus smooth gradient inside each tone
    t2 = smoothstep(cel - 0.06, cel + 0.06, lb * 0.5 + 0.5)
    s2 = 0.18 + 0.32 * s + t2 * 0.45
    # crease occlusion between billows
    occ = np.clip((ndimage.gaussian_filter(hs, 6) - hs) / 14.0, 0, 1)
    s2 -= occ * (0.08 + 0.25 * edge_zone)
    # bottoms go to shadow tone
    bottom = smoothstep(base - 0.35 * (base - oy), base, yy + oy)
    s2 -= bottom * 0.22
    col = ramp(pal, np.clip(s2, 0, 1))
    edge = np.exp(-hs / 6.0) * mask
    facing = np.clip(nx * lx + ny * ly, 0, 1)
    glow = edge * (0.3 + 0.7 * facing) * (0.35 + 1.8 * proximity) * rim
    col = col + hexc(pal[-1][1])[None, None, :] * glow[..., None] * 0.85
    if haze > 0:
        col = col + (hexc(haze_col) - col) * haze
    # dissolve the flat base with noise
    if fringe > 0:
        n = fbm(rng, h, w, 40, octaves=4)
        cut = smoothstep(base - 90 - n * 70, base + 10 - n * 40, yy + oy)
        alpha = alpha * (1 - cut * fringe)
    return col, alpha


def comp_at(dst, col, alpha, ox, oy):
    H, W, _ = dst.shape
    h, w = alpha.shape
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(W, ox + w), min(H, oy + h)
    if x0 >= x1 or y0 >= y1:
        return dst
    a = alpha[y0 - oy:y1 - oy, x0 - ox:x1 - ox, None]
    c = col[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    dst[y0:y1, x0:x1] = dst[y0:y1, x0:x1] * (1 - a) + c * a
    return dst


def comp(dst, col, alpha):
    a = alpha[..., None]
    return dst * (1 - a) + col * a


def cirrus(rng, h, w, cell, threshold, aniso, angle_shift=0.0):
    n = fbm(rng, h, w, cell, octaves=6, gain=0.55, aniso=aniso)
    # streaking: shear rows
    if angle_shift:
        n = ndimage.shift(n, (0, 0))
    return smoothstep(threshold, threshold + 0.18, n)


def dither(img, rng, amt=1.2):
    return img + (rng.random(img.shape).astype(np.float32) - 0.5) * (amt / 255.0)


def save(img, path, quality=94):
    arr = np.clip(img * 255.0 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr, 'RGB')
    if path.endswith('.webp'):
        im.save(path, 'WEBP', quality=quality, method=6)
    elif path.endswith('.jpg'):
        im.save(path, 'JPEG', quality=quality, subsampling=0, optimize=True)
    else:
        im.save(path, optimize=True)
    print('wrote', path, im.size, os.path.getsize(path) // 1024, 'KB')


# ----------------------------------------------------------------- skies

def build_sky(spec, seed):
    rng = np.random.default_rng(seed)
    w, h = spec['size']
    sun = spec['sun']
    img = sky_gradient(w, h, spec['grad'], sun, spec['glow'])
    # high cirrus wisps
    for layer in spec.get('cirrus', []):
        a = cirrus(rng, h, w, layer['cell'], layer['th'], layer['aniso'])
        band = smoothstep(layer['y0'], layer['y1'], np.arange(h, dtype=np.float32))[:, None]
        if layer.get('fade_down'):
            band = band * (1 - smoothstep(layer['fade_down'][0], layer['fade_down'][1],
                                          np.arange(h, dtype=np.float32)))[:, None]
        else:
            band = 1 - band
        a = a * band * layer['alpha']
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d = np.sqrt((xx - sun[0]) ** 2 + (yy - sun[1]) ** 2)
        warm = np.exp(-d / layer.get('warm_r', 900.0))[..., None]
        c = hexc(layer['col']) * (1 - warm) + hexc(layer['warm']) * warm
        img = comp(img, np.broadcast_to(c, img.shape), a)
    # cumulus banks, far to near
    for bank in spec['banks']:
        for cl in bank['clouds']:
            cx, base, cw, ch = cl[:4]
            det = cl[4] if len(cl) > 4 else 3
            puffs = make_cumulus(rng, cx, base, cw, ch, det)
            hf, ox, oy = raster_cloud(puffs)
            col, alpha = shade_cloud(hf, ox, oy, base, sun, bank['pal'], bank.get('lz', 0.6), rng,
                                     haze=bank.get('haze', 0.0), haze_col=bank.get('haze_col', '#ffffff'),
                                     rim=bank.get('rim', 1.0), fringe=bank.get('fringe', 0.7),
                                     cel=bank.get('cel', 0.62))
            img = comp_at(img, col, alpha * bank.get('alpha', 1.0), ox, oy)
    img = dither(img, rng)
    return np.clip(img, 0, 1)


SPECS = {
    # Opening tilt: high blue sky down to a warm horizon. Tall image.
    'sky_open': dict(
        size=(2048, 3072), sun=(1560, 2930),
        grad=[(0.0, '#1f56c0'), (0.28, '#3f84e2'), (0.55, '#7db6f0'), (0.78, '#c9def2'), (0.9, '#ffe6c4'), (1.0, '#ffd6a0')],
        glow=[(900, '#fff1d6', 0.55), (260, '#fffaf0', 0.85)],
        cirrus=[dict(cell=520, th=0.55, aniso=(0.32, 1.7), y0=0, y1=1400, alpha=0.6, col='#ffffff', warm='#fff3df', warm_r=1500),
                dict(cell=260, th=0.6, aniso=(0.28, 2.0), y0=200, y1=1800, alpha=0.45, col='#f4f8ff', warm='#ffe9cf', warm_r=1200)],
        banks=[
            dict(clouds=[(330, 2880, 640, 170, 2), (1000, 2900, 420, 110, 2), (1820, 2890, 600, 160, 2)],
                 pal=[(0, '#a8b4d6'), (0.45, '#dfe3f0'), (0.75, '#fff3e4'), (1.0, '#ffffff')], lz=0.6, haze=0.35,
                 haze_col='#f6e6d6', fringe=0.8),
            dict(clouds=[(560, 2500, 900, 1150, 4), (1750, 2620, 560, 420, 3)],
                 pal=[(0, '#6f86c0'), (0.42, '#b3c3e6'), (0.72, '#fbf3ea'), (1.0, '#ffffff')], lz=0.35, haze=0.06,
                 haze_col='#e8eefa', fringe=0.7),
            dict(clouds=[(1450, 1250, 560, 240, 3)],
                 pal=[(0, '#8ca2d0'), (0.45, '#cdd8ee'), (0.75, '#fdfbf7'), (1.0, '#ffffff')], lz=0.45, haze=0.04,
                 haze_col='#e8eefa', fringe=0.6),
        ]),
    # Golden hour riverside.
    'sky_golden': dict(
        size=(2560, 1440), sun=(1880, 1010),
        grad=[(0.0, '#3a6cc2'), (0.35, '#78a5dc'), (0.6, '#cfc4cc'), (0.76, '#ffcf9e'), (0.9, '#ffb67a'), (1.0, '#ffcf98')],
        glow=[(1100, '#ffd8a8', 0.55), (300, '#fff3d6', 0.85)],
        cirrus=[dict(cell=420, th=0.55, aniso=(0.3, 1.8), y0=0, y1=700, alpha=0.5, col='#fde9e2', warm='#ffd9a0', warm_r=900)],
        banks=[
            dict(clouds=[(380, 1010, 700, 170, 2), (1050, 1030, 420, 110, 2), (2350, 1015, 520, 150, 2)],
                 pal=[(0, '#b394b4'), (0.45, '#e8b8b0'), (0.75, '#ffdab2'), (1.0, '#fff2d2')], lz=0.4, haze=0.32,
                 haze_col='#ffcfa6', fringe=0.8),
            dict(clouds=[(520, 760, 820, 520, 3), (2280, 800, 640, 400, 3)],
                 pal=[(0, '#8a7fb0'), (0.4, '#c8a2b6'), (0.7, '#ffd2aa'), (1.0, '#fff6e0')], lz=0.45, haze=0.06,
                 haze_col='#f0c8b0', fringe=0.75),
        ]),
    # Sunset (crossing, walk, confession).
    'sky_sunset': dict(
        size=(2560, 1440), sun=(1560, 1060),
        grad=[(0.0, '#283a84'), (0.25, '#5856a4'), (0.48, '#c06c9a'), (0.66, '#f5987e'), (0.82, '#ffb36b'), (1.0, '#ffd790')],
        glow=[(1200, '#ffb27a', 0.5), (330, '#fff0c8', 0.9)],
        cirrus=[dict(cell=460, th=0.53, aniso=(0.28, 2.1), y0=0, y1=800, alpha=0.6, col='#f6a6a8', warm='#ffd0a0', warm_r=1000)],
        banks=[
            dict(clouds=[(400, 1050, 760, 180, 2), (1100, 1070, 460, 110, 2), (2200, 1055, 700, 170, 2)],
                 pal=[(0, '#8a5b8e'), (0.45, '#d9798e'), (0.75, '#ffad86'), (1.0, '#ffe2b0')], lz=0.3, haze=0.3,
                 haze_col='#ff9f86', fringe=0.8, rim=1.4),
            dict(clouds=[(420, 760, 900, 560, 4), (2230, 800, 760, 440, 3)],
                 pal=[(0, '#4d3f7d'), (0.42, '#a45d8c'), (0.72, '#f08a83'), (1.0, '#ffd6a4')], lz=0.3, haze=0.04,
                 haze_col='#c070a0', fringe=0.7, rim=1.5),
        ]),
    # Twilight finale (tall for the tilt up to the stars).
    'sky_twilight': dict(
        size=(2560, 2400), sun=(1350, 2480),
        grad=[(0.0, '#060a24'), (0.25, '#111946'), (0.5, '#2a2e72'), (0.68, '#684894'), (0.82, '#c06898'), (0.92, '#f39a8f'), (1.0, '#ffc49a')],
        glow=[(1000, '#f08a8f', 0.45), (420, '#ffd0a0', 0.6)],
        cirrus=[dict(cell=520, th=0.56, aniso=(0.3, 2.0), y0=1100, y1=1900, alpha=0.45, col='#5a4c8c', warm='#ff9aa0', warm_r=900)],
        banks=[
            dict(clouds=[(480, 2140, 820, 190, 2), (1500, 2165, 500, 120, 2), (2300, 2150, 700, 170, 2)],
                 pal=[(0, '#3a2c62'), (0.45, '#6e4a86'), (0.8, '#d77898'), (1.0, '#ffb39a')], lz=-0.2, haze=0.25,
                 haze_col='#8a5a98', fringe=0.8, rim=1.8),
            dict(clouds=[(420, 1820, 900, 420, 3), (2200, 1860, 760, 340, 3)],
                 pal=[(0, '#22204c'), (0.45, '#45386e'), (0.8, '#a05c8c'), (1.0, '#ff9c9a')], lz=-0.3, haze=0.05,
                 haze_col='#3a3070', fringe=0.7, rim=1.8),
        ]),
}


if __name__ == '__main__':
    out = sys.argv[1]
    names = sys.argv[2:] or list(SPECS)
    os.makedirs(out, exist_ok=True)
    for i, name in enumerate(names):
        img = build_sky(SPECS[name], 1000 + list(SPECS).index(name))
        save(img, os.path.join(out, name + '.png'))
