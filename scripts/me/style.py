"""The comic look for the cut-out frames of me (intro start screen).

stylize(rgba) takes a frame with its background already removed and gives it
the Spider-Verse treatment: a thick white sticker outline with a thin ink
edge, halftone dots in the shadows, a slightly misregistered colour print
behind the outline, punchier colour and a little grain. Same settings for
every frame, so the cuts between poses read as one character.
"""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

INK = (20, 18, 30)
CYAN = (0, 190, 230)
MAGENTA = (240, 40, 140)


def _grow(alpha, px):
    """alpha grown outward by px (a max filter, done in steps for speed)."""
    a = alpha
    while px > 0:
        k = min(px, 7)
        a = a.filter(ImageFilter.MaxFilter(k * 2 + 1 if k * 2 + 1 <= 15 else 15))
        px -= k
    return a


def stylize(img, outline=14, ink=3, dot=6, offset=4, seed=7, crop=True):
    img = img.convert('RGBA')
    w, h = img.size
    pad = outline + ink + offset + 4
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, (pad, pad), img)
    rgb = canvas.convert('RGB')
    alpha = canvas.getchannel('A').point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.8))
    alpha = alpha.point(lambda v: 255 if v > 127 else 0)

    # punchier, slightly flattened colour
    rgb = ImageEnhance.Color(rgb).enhance(1.25)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    arr = np.asarray(rgb).astype(np.float32)
    arr = np.round(arr / 18) * 18                                     # a light posterise

    # halftone in the shadows: a 45 degree dot screen, dots grow as it darkens
    lum = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255
    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]].astype(np.float32)
    u = (xx + yy) / (dot * 1.414)
    v = (xx - yy) / (dot * 1.414)
    du = (u - np.round(u)) * dot
    dv = (v - np.round(v)) * dot
    dist = np.sqrt(du * du + dv * dv)
    shade = np.clip((0.52 - lum) / 0.52, 0, 1)
    radius = np.sqrt(shade) * dot * 0.62
    dots = (dist < radius).astype(np.float32) * 0.42
    for c in range(3):
        arr[..., c] = arr[..., c] * (1 - dots) + INK[c] * dots

    # grain
    rng = np.random.default_rng(seed)
    arr += rng.normal(0, 6, arr.shape[:2])[..., None]
    figure = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert('RGBA')
    figure.putalpha(alpha)

    # the sticker: white outline, ink edge, and a misregistered print behind
    white = _grow(alpha, outline)
    edge = _grow(white, ink)
    out = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    for colour, dx, dy in ((CYAN, -offset, 0), (MAGENTA, offset, offset // 2)):
        ghost = Image.new('RGBA', canvas.size, colour + (0,))
        ghost.putalpha(edge.point(lambda v: v * 0.55))
        out.alpha_composite(ghost, (dx if dx > 0 else 0, dy), (-dx if dx < 0 else 0, 0))
    ink_layer = Image.new('RGBA', canvas.size, INK + (255,))
    ink_layer.putalpha(edge)
    out.alpha_composite(ink_layer)
    paper = Image.new('RGBA', canvas.size, (255, 255, 255, 255))
    paper.putalpha(white)
    out.alpha_composite(paper)
    out.alpha_composite(figure)
    return out.crop(out.getbbox()) if crop else out
