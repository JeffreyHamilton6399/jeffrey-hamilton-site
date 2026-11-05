"""The drawn version of me, from generated sheets (6 x 5 grids of poses on
flat grey). Each cell is lifted off its grey by flooding the background in
from the edges (the drawing's own outline stops it), lined up by the hair
(the same place and size in every pose), then given the same sticker
treatment as before (build.py's write).

    python3 scripts/me/toon.py SHEET_A SHEET_B
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build

# cell (sheet, number in reading order) -> poses it stands for
NAMES = {
 ('A', 1): ['point_0_0', 'point_0_1'], ('A', 2): ['point_0_2'], ('A', 3): ['point_0_4', 'point_0_3'],
 ('A', 4): ['point_1_0', 'point_1_1'], ('A', 5): ['point_center'], ('A', 6): ['point_1_4', 'point_1_3'],
 ('A', 7): ['point_2_0', 'point_2_1'], ('A', 8): ['point_2_2'], ('A', 9): ['point_2_4', 'point_2_3'],
 ('A', 10): ['look_1_4'], ('A', 11): ['look_1_3'], ('A', 12): ['look_0_2'], ('A', 13): ['look_2_2'],
 ('A', 14): ['wave'], ('A', 15): ['thumbs'], ('A', 16): ['whoa'],
 ('A', 17): ['type_0', 'type_3', 'lean_1'], ('A', 18): ['type_1', 'type_4'], ('A', 19): ['submit'],
 ('A', 20): ['earbuds_0'], ('A', 21): ['talk_closed'], ('A', 22): ['talk_open'], ('A', 23): ['talk_wide'],
 ('A', 25): ['nod_1'], ('A', 26): ['smile'], ('A', 27): ['talk_round'], ('A', 28): ['talk_teeth'],
 ('A', 29): ['look_center', 'look_1_2'], ('A', 30): ['surprised'],
 ('B', 1): ['look_1_0', 'look_1_1'], ('B', 2): ['look_0_1', 'look_0_0'], ('B', 3): ['look_0_3', 'look_0_4'],
 ('B', 4): ['look_2_1', 'look_2_0'], ('B', 5): ['look_2_3', 'look_2_4'], ('B', 6): ['point_1_2'],
 ('B', 7): ['startle_0'], ('B', 9): ['lean_0'], ('B', 10): ['glance'],
 ('B', 11): ['earbuds_1'], ('B', 12): ['listen'], ('B', 13): ['nod_0', 'nod_2'],
 ('B', 15): ['half_point'], ('B', 16): ['half_roll'], ('B', 17): ['shrug'], ('B', 18): ['type_2', 'type_5'],
 ('B', 19): ['blink'], ('B', 20): ['blink_side'], ('B', 21): ['think'], ('B', 22): ['laugh'],
 ('B', 23): ['huh'], ('B', 24): ['nod_yes'], ('B', 25): ['wave_small'], ('B', 26): ['click'],
 ('B', 27): ['crossed'], ('B', 28): ['fist'], ('B', 29): ['look_far'], ('B', 30): ['look_far_2'],
}


def cells(path, tag):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    cw, ch = W / 6, H / 5
    for r in range(5):
        for c in range(6):
            yield (tag, r * 6 + c + 1), im.crop((int(c * cw) + 6, int(r * ch) + 6, int((c + 1) * cw) - 6, int((r + 1) * ch) - 6))


def lift(cell):
    """The figure off its grey: the background flooded in from the edges."""
    big = cell.resize((cell.width * 3, cell.height * 3), Image.LANCZOS)
    a = np.asarray(big).astype(int)
    # the grey, sampled just inside the corners (the very edge can be the
    # sheet's white gap); background is that grey or the white of the gap
    c = 30
    samp = np.concatenate([a[c:c+12, c:c+12].reshape(-1, 3), a[c:c+12, -c-12:-c].reshape(-1, 3)])
    bg = np.median(samp, axis=0)
    grey = np.abs(a - bg).sum(axis=2) < 48
    white = a.min(axis=2) > 236
    near = ((grey | white).astype(np.uint8) * 255)
    m = Image.fromarray(near, 'L').copy()      # a writable copy: floodfill can't write into the array's buffer
    W_, H_ = m.size
    for x in range(0, W_, 2):
        for y in (0, H_ - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, H_, 2):
        for x in (0, W_ - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    alpha = m.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = big.convert('RGBA')
    out.putalpha(alpha)
    return out


def hair(img):
    """Centre x, top y and width of the hair (dark brown, in the top part)."""
    a = np.asarray(img).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = (al > 200) & (r < 140) & (r > g) & (g > b) & (r - b > 25) & (r + g + b < 330)
    m[int(m.shape[0] * 0.7):] = False
    ys, xs = np.where(m)
    if len(xs) < 50:
        return None
    top = np.percentile(ys, 2)
    band = (ys < top + (np.percentile(ys, 60) - top))
    return float(np.median(xs[band])), float(top), float(np.percentile(xs, 95) - np.percentile(xs, 5))


def main(a, b):
    lifted = {}
    for path, tag in ((a, 'A'), (b, 'B')):
        for key, cell in cells(path, tag):
            if key in NAMES:
                lifted[key] = lift(cell)
    ref = hair(lifted[('A', 29)])
    T = 150
    CW, CH, HY = 9 * T, int(5.6 * T), 3 * T
    k = (T * 1.25) / ref[2]
    poses, heads = {}, {}
    for key, img in lifted.items():
        h = hair(img)
        kk = k
        if key == ('B', 8) or h is None:          # right up close: bigger, centred
            kk = k * 1.45 if key == ('B', 8) else k
            h = (img.width / 2, img.height * 0.02, 0)
        im = img.resize((round(img.width * kk), round(img.height * kk)), Image.LANCZOS)
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        canvas.alpha_composite(im, (round(CW / 2 - h[0] * kk), round(HY - T * 0.95 - h[1] * kk)))
        for n in NAMES[key]:
            poses[n] = canvas
            heads[n] = (CW / 2, HY, T * 0.62)
    build.write(poses, heads)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
