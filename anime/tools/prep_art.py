"""Turn the two key illustrations into animatable layers.

Usage: python3 prep_art.py WORK_DIR OUT_DIR

WORK_DIR/art must contain boy.jpg, girl.jpg (1376x768 originals), mask2_boy.png,
mask2_girl.png (1x character masks) and optionally boy_x4.png / girl_x4.png
(Real-ESRGAN anime x4 upscales; Lanczos is used when they are missing).

Outputs (OUT_DIR): plate.jpg (2x clean background), girl.webp / boy.webp (3x RGBA
cut-outs), girl_disp.png / boy_disp.png (wind weight maps), art.json (metadata).
"""
import json
import os
import sys

import cv2
import numpy as np

WORK, OUT = sys.argv[1], sys.argv[2]
ART = os.path.join(WORK, 'art')
os.makedirs(OUT, exist_ok=True)

# landmarks measured on the 1x artwork: eyes [x, y, w, h], mouth [x, y, w]
FACE = {
    'boy': {'eyes': [[677, 176, 31, 18], [744, 167, 34, 21]], 'mouth': [[698.5, 226.8], [712, 227.6], [735, 222.4]], 'lash': '#2a1a1c'},
    'girl': {'eyes': [[663, 188, 33, 24], [738, 181, 38, 23]], 'mouth': [[694, 231.2], [704, 233.4], [725, 227]], 'lash': '#3a1a22'},
}


def load_big(name, scale):
    """Artwork at `scale`x, from the x4 upscale when available."""
    p4 = os.path.join(ART, f'{name}_x4.png')
    base = cv2.imread(os.path.join(ART, f'{name}.jpg'))
    h, w = base.shape[:2]
    if os.path.exists(p4):
        big = cv2.imread(p4)
        return cv2.resize(big, (w * scale, h * scale), interpolation=cv2.INTER_AREA), True
    return cv2.resize(base, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4), False


def soft_mask(m1x, scale, erode=0.6):
    m = cv2.resize(m1x.astype(np.float32), None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    m = cv2.GaussianBlur(m, (0, 0), 0.5 * scale)
    # pull the edge in slightly so background fringe doesn't travel with the character
    lo, hi = 0.5 + erode * 0.2, 0.75 + erode * 0.2
    return np.clip((m - lo) / (hi - lo), 0, 1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hex_of(bgr):
    b, g, r = [int(v) for v in bgr]
    return '#%02x%02x%02x' % (r, g, b)


masks1 = {n: (cv2.imread(os.path.join(ART, f'mask2_{n}.png'), 0) > 127).astype(np.uint8) for n in ('boy', 'girl')}
orig = {n: cv2.imread(os.path.join(ART, f'{n}.jpg')) for n in ('boy', 'girl')}
H1, W1 = orig['boy'].shape[:2]
meta = {}

# ------------------------------------------------------------------ clean plate (2x)
S = 2
A2, srA = load_big('boy', S)
B2, srB = load_big('girl', S)
mb = cv2.dilate(masks1['boy'], np.ones((5, 5), np.uint8))
mg = cv2.dilate(masks1['girl'], np.ones((5, 5), np.uint8))
mb2 = cv2.resize(mb, (W1 * S, H1 * S), interpolation=cv2.INTER_NEAREST)
mg2 = cv2.resize(mg, (W1 * S, H1 * S), interpolation=cv2.INTER_NEAREST)
plate = A2.copy()
use_b = (mb2 > 0) & (mg2 == 0)
plate[use_b] = B2[use_b]
hole = ((mb2 > 0) & (mg2 > 0)).astype(np.uint8)
# stray strands outside the masks: in a ring around the characters keep, per pixel,
# whichever source agrees with a median-filtered (line-free) estimate
U1 = cv2.dilate(((masks1['boy'] + masks1['girl']) > 0).astype(np.uint8), np.ones((19, 19), np.uint8))
ring = cv2.resize(U1, (W1 * S, H1 * S), interpolation=cv2.INTER_NEAREST) > 0
med = cv2.medianBlur(plate, 11).astype(np.int32)
dA = np.abs(A2.astype(np.int32) - med).sum(axis=2)
dB = np.abs(B2.astype(np.int32) - med).sum(axis=2)
pick_b = ring & (mg2 == 0) & (dB < dA)
plate[pick_b] = B2[pick_b]
pick_med = ring & (((mg2 > 0) & (dA > 45)) | (np.minimum(dA, dB) > 90))
plate[pick_med] = med[pick_med].astype(np.uint8)
# stray flyaway strands against the sky: inpaint dark marks in that patch
lum = cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY).astype(np.float32)
dark = (lum < cv2.GaussianBlur(lum, (0, 0), 12) - 12).astype(np.uint8)
sky = np.zeros_like(dark)
sky[6 * S:48 * S, 650 * S:750 * S] = 1
dark = cv2.dilate(dark * sky, np.ones((5, 5), np.uint8))
plate = cv2.inpaint(plate, dark * 255, 5, cv2.INPAINT_TELEA)
# the region hidden in both pictures is always covered by a character; fill it softly
hole = ((mb2 > 0) & (mg2 > 0)).astype(np.uint8)
small = cv2.resize(plate, (W1, H1), interpolation=cv2.INTER_AREA)
hole1 = cv2.dilate(cv2.resize(hole, (W1, H1), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8))
fill = cv2.inpaint(small, hole1 * 255, 9, cv2.INPAINT_TELEA)
fill = cv2.GaussianBlur(fill, (0, 0), 6)
fill2 = cv2.resize(fill, (W1 * S, H1 * S), interpolation=cv2.INTER_CUBIC)
holeS = cv2.GaussianBlur(cv2.resize(hole1.astype(np.float32), (W1 * S, H1 * S)), (0, 0), 2)[..., None]
plate = (plate * (1 - holeS) + fill2 * holeS).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'plate.jpg'), plate, [cv2.IMWRITE_JPEG_QUALITY, 93])
meta['plate'] = {'src': 'plate.jpg', 'scale': S, 'sun': [935, 262]}
# defocused background for close-ups: everything the characters ever covered is
# repainted from its surroundings, then blurred (it is always seen out of focus)
small = cv2.resize(plate, (W1, H1), interpolation=cv2.INTER_AREA)
U1 = cv2.dilate(((masks1['boy'] + masks1['girl']) > 0).astype(np.uint8), np.ones((31, 31), np.uint8))
bg = cv2.inpaint(small, U1 * 255, 15, cv2.INPAINT_TELEA)
bg = cv2.GaussianBlur(bg, (0, 0), 9)
small_bl = cv2.GaussianBlur(small, (0, 0), 3)
m = cv2.GaussianBlur(U1.astype(np.float32), (0, 0), 12)[..., None]
bg = (small_bl * (1 - m) + bg * m).astype(np.uint8)
cv2.imwrite(os.path.join(OUT, 'plate_bg.jpg'), bg, [cv2.IMWRITE_JPEG_QUALITY, 90])
meta['plate']['bg'] = 'plate_bg.jpg'
print('plate', plate.shape, 'superres', srA and srB)

# ------------------------------------------------------------------ characters (4x)
S = 4
for name in ('girl', 'boy'):
    big, sr = load_big(name, S)
    m1 = masks1[name]
    alpha = soft_mask(cv2.erode(m1, np.ones((3, 3), np.uint8)), S, erode=0.3)
    # edge-aware refinement at full resolution: snap the matte to the painted outline
    guide = cv2.cvtColor(big, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    try:
        ref = cv2.ximgproc.guidedFilter(guide, alpha.astype(np.float32), 6 * S // 2, 2e-3)
    except Exception as e:  # pragma: no cover
        print('guided filter unavailable', e)
        ref = alpha
    alpha = np.clip((ref - 0.5) * 1.8 + 0.5, 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    ys, xs = np.where(m1 > 0)
    pad = 24
    x0, x1 = max(0, xs.min() - pad), min(W1, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(H1, ys.max() + pad)
    X0, X1, Y0, Y1 = x0 * S, x1 * S, y0 * S, y1 * S
    rgb = big[Y0:Y1, X0:X1].copy()
    a = alpha[Y0:Y1, X0:X1]
    # colour decontamination: edge pixels take the colour of the nearby interior so
    # the sunlit background doesn't leave a bright halo around the hair
    band = ((a < 0.97) & (cv2.dilate((a > 0.02).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)).astype(np.uint8)
    inner = cv2.inpaint(rgb, band * 255, 4, cv2.INPAINT_TELEA)
    rgb[band > 0] = inner[band > 0]
    a = np.clip((a - 0.08) / 0.92, 0, 1)
    rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT, f'{name}.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 94])

    # ---- wind weight map
    hsv = cv2.cvtColor(orig[name], cv2.COLOR_BGR2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255
    yy, xx = np.mgrid[0:H1, 0:W1].astype(np.float32)
    f = FACE[name]
    (lx, ly, lw, lh), (rx, ry, rw, rh) = f['eyes']
    fcx, fcy = (lx + rx) / 2, (ly + ry) / 2 + 22
    face = ((xx - fcx) / 62) ** 2 + ((yy - fcy) / 70) ** 2 < 1
    if name == 'girl':
        sides = ((xx < 600) | (xx > 805)) & (yy > 230) & (yy < 520)
        hairc = (((hue < 18) | (hue > 330)) & (sat > 0.2) & (val > 0.45)) | ((hue < 34) & (sat > 0.2) & (val > 0.6) & sides)
        bow = (np.abs(xx - 712) < 60) & (yy > 262) & (yy < 340)
        middle = (xx > 615) & (xx < 800) & (yy > 300)
        hair = hairc & (m1 > 0) & ~face & ~bow & ~middle
        hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
        fall = 0.18 + 0.82 * smoothstep(150, 430, yy)
        # bangs over the forehead get a light touch
        bangs = (yy < fcy - 18) & (np.abs(xx - fcx) < 75)
        weight = hair * fall * np.where(bangs, 0.45, 1.0)
        cloth = (m1 > 0) * smoothstep(600, 700, yy) * (val < 0.45)
    else:
        shirt = (sat < 0.18) & (val > 0.75)
        hair = (yy < 236) & (m1 > 0) & ~face & ~shirt & ~((yy > 205) & (np.abs(xx - fcx) < 70))
        hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
        d = np.sqrt((xx - fcx) ** 2 + ((yy - fcy) * 1.1) ** 2)
        weight = hair * (0.2 + 0.8 * smoothstep(55, 115, d))
        cloth = (m1 > 0) * smoothstep(560, 700, yy) * 0.6 * (yy > 0)
    face_soft = cv2.GaussianBlur(face.astype(np.float32), (0, 0), 6)
    weight = cv2.GaussianBlur(weight.astype(np.float32), (0, 0), 3) * (1 - face_soft)
    cloth = cv2.GaussianBlur(cloth.astype(np.float32), (0, 0), 4)
    disp = np.dstack([np.zeros_like(weight), np.clip(cloth, 0, 1), np.clip(weight, 0, 1)])  # BGR -> R = hair
    disp = (disp * 255).astype(np.uint8)
    disp = cv2.resize(disp[y0:y1, x0:x1], ((x1 - x0) * S, (y1 - y0) * S), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(os.path.join(OUT, f'{name}_disp.png'), disp)
    vis = orig[name].copy()
    vis[..., 2] = np.clip(vis[..., 2] * 0.4 + weight * 255 * 0.8, 0, 255)
    cv2.imwrite(os.path.join(WORK, 'art', f'weights_{name}.jpg'), vis)

    eyes = []
    for (ex, ey, ew, eh) in f['eyes']:
        cands = []
        for sy in (int(ey - eh * 0.95), int(ey + eh * 0.95)):
            patch = orig[name][sy - 2:sy + 2, int(ex) - 4:int(ex) + 4].reshape(-1, 3)
            cands.append(np.median(patch, axis=0))
        skin = max(cands, key=lambda c: c.sum())
        eyes.append([ex, ey, ew, eh, hex_of(skin), hex_of(skin * 0.72)])
    meta[name] = {
        'src': f'{name}.webp', 'disp': f'{name}_disp.png', 'scale': S, 'x': int(x0), 'y': int(y0),
        'w': int(x1 - x0), 'h': int(y1 - y0), 'eyes': eyes, 'mouth': f['mouth'], 'lash': f['lash'], 'superres': sr,
    }
    print(name, meta[name])

json.dump(meta, open(os.path.join(OUT, 'art.json'), 'w'), indent=1)
