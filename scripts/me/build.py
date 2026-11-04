"""Frames of me for the intro's start screen.

    python3 scripts/me/build.py extract VIDEO [VIDEO ...]
        Pulls frames (6 a second) into scripts/me/work/ and makes contact
        sheets, each frame labelled with its video and time, to choose from.

    python3 scripts/me/build.py build scripts/me/picks.json
        For every pose named in picks.json ({"pose": ["video", seconds]}),
        takes that exact frame, removes the background (rembg, locally),
        crops every pose to the same box (the camera did not move), gives it
        the comic look (style.py) and writes assets/me/<pose>.webp, plus
        assets/me/me.json: frame size, the poses there are, and where the head
        is in each (for the cursor that picks it up).

    python3 scripts/me/build.py placeholder
        Stand-in poses made from assets/portrait.jpg, so the intro runs before
        the real footage exists.

The pose names the intro uses are in POSES below.
"""
import json, os, subprocess, sys, math
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'me')
WORK = os.path.join(HERE, 'work')
sys.path.insert(0, HERE)

GRID = [(r, c) for r in range(3) for c in range(5)]
POSES = (
    ['point_%d_%d' % rc for rc in GRID] + ['point_center'] +      # pointing at the screen, row 0 = top, col 0 = left as seen on screen
    ['look_%d_%d' % rc for rc in GRID] + ['look_center'] +        # the same, just looking
    ['whoa', 'thumbs', 'wave'] +                                   # now and then while waiting
    ['startle_0', 'startle_1', 'lean_0', 'lean_1'] +               # pulled in at the press
    ['type_%d' % i for i in range(6)] + ['glance'] +               # typing at the screen on the right
    ['talk_closed', 'talk_open', 'talk_wide', 'talk_round', 'talk_teeth'] +   # into the earbuds
    ['listen', 'nod_0', 'nod_1', 'nod_2', 'smile'] +               # while the AI answers
    ['surprised', 'shrug'] +                                       # the head is picked up
    ['half_point', 'half_roll']                                    # the halfway line
)
HEIGHT = 640          # frame height written, in pixels


def sh(*a):
    subprocess.run(a, check=True)


def extract(videos):
    os.makedirs(WORK, exist_ok=True)
    from PIL import ImageFont
    for v in videos:
        name = os.path.splitext(os.path.basename(v))[0]
        d = os.path.join(WORK, name)
        os.makedirs(d, exist_ok=True)
        sh('ffmpeg', '-v', 'error', '-y', '-i', v, '-vf', 'fps=6,scale=-2:360', os.path.join(d, '%05d.jpg'))
        frames = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
        per = 48
        for s in range(0, len(frames), per):
            chunk = frames[s:s + per]
            th = [Image.open(os.path.join(d, f)) for f in chunk]
            tw, thh = th[0].size
            tw, thh = tw // 2, thh // 2
            cols = 8
            sheet = Image.new('RGB', (cols * tw, math.ceil(len(th) / cols) * (thh + 16)), 'white')
            dr = ImageDraw.Draw(sheet)
            for i, (f, im) in enumerate(zip(chunk, th)):
                x, y = (i % cols) * tw, (i // cols) * (thh + 16)
                sheet.paste(im.resize((tw, thh)), (x, y + 16))
                t = (int(f[:5]) - 1) / 6
                dr.text((x + 3, y + 2), '%s %.2fs' % (name, t), fill='black')
            sheet.save(os.path.join(WORK, '%s_sheet_%02d.jpg' % (name, s // per)), quality=85)
        print(name, len(frames), 'frames')


def cutout(img):
    from rembg import remove, new_session
    if not hasattr(cutout, 'session'):
        cutout.session = new_session('u2net_human_seg')
    return remove(img.convert('RGB'), session=cutout.session)


def head_of(alpha):
    """Where the head is: the middle of the figure's top band."""
    a = alpha.point(lambda v: 255 if v > 127 else 0)
    box = a.getbbox()
    if not box:
        return [0.5, 0.25, 0.12]
    l, t, r, b = box
    band = a.crop((l, t, r, t + int((b - t) * 0.22)))
    bb = band.getbbox() or (0, 0, r - l, 1)
    cx = l + (bb[0] + bb[2]) / 2
    w = bb[2] - bb[0]
    cy = t + w * 0.62
    W, H = a.size
    return [round(cx / W, 4), round(cy / H, 4), round(w * 0.55 / W, 4)]


def write(poses):
    """poses: {name: RGBA cut-out}, all the same size. Styled, cropped to one
    shared box, saved."""
    from style import stylize
    os.makedirs(OUT, exist_ok=True)
    styled = {k: stylize(v, crop=False) for k, v in poses.items()}
    box = None
    for im in styled.values():
        bb = im.getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    meta = {'height': HEIGHT, 'poses': {}}
    for k, im in styled.items():
        im = im.crop(box)
        scale = HEIGHT / im.height
        im = im.resize((round(im.width * scale), HEIGHT), Image.LANCZOS)
        im.save(os.path.join(OUT, k + '.webp'), 'WEBP', quality=70, method=6)
        meta['width'] = im.width
        meta['poses'][k] = {'head': head_of(im.getchannel('A'))}
    with open(os.path.join(OUT, 'me.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    missing = [p for p in POSES if p not in poses]
    print('wrote', len(styled), 'poses to', OUT, '| missing:', ', '.join(missing) or 'none')


def build(picks_path):
    picks = json.load(open(picks_path))
    base = os.path.dirname(os.path.abspath(picks_path))
    poses = {}
    for name, (video, t) in picks.items():
        v = video if os.path.isabs(video) else os.path.join(base, video)
        tmp = os.path.join(WORK, '_frame.png')
        os.makedirs(WORK, exist_ok=True)
        sh('ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', v, '-frames:v', '1', tmp)
        im = Image.open(tmp)
        im = ImageOps.contain(im, (1600, 1600))
        poses[name] = cutout(im)
        print('cut', name)
    write(poses)


def placeholder():
    """Every pose from the one portrait, nudged so the stand-in still shows
    which pose is up: a lean toward where it points."""
    src = cutout(ImageOps.contain(Image.open(os.path.join(ROOT, 'assets', 'portrait.jpg')), (900, 900)))
    W, H = src.size
    pad = 120
    base = Image.new('RGBA', (W + pad * 2, H + pad), (0, 0, 0, 0))
    base.paste(src, (pad, pad), src)
    poses = {}
    for name in POSES:
        im = base
        if name.startswith(('point_', 'look_')) and name[-1].isdigit():
            r, c = int(name[-3]), int(name[-1])
            ang = (c - 2) * -3.5 + (0 if name.startswith('look') else 1.5)
            im = base.rotate(ang, resample=Image.BICUBIC, center=(base.width / 2, base.height))
            if r != 1:
                im = im.transform(im.size, Image.AFFINE, (1, 0, 0, 0, 1, (r - 1) * 10), resample=Image.BICUBIC)
        elif name in ('startle_0', 'startle_1', 'surprised', 'whoa'):
            im = base.transform(base.size, Image.AFFINE, (1, 0, 0, 0, 1, 14), resample=Image.BICUBIC)
        elif name.startswith(('type_', 'lean_')):
            im = base.rotate(-4 if name.endswith(('0', '2', '4')) else -5, resample=Image.BICUBIC, center=(base.width / 2, base.height))
        elif name.startswith('nod_'):
            im = base.transform(base.size, Image.AFFINE, (1, 0, 0, 0, 1, -6 * int(name[-1] == '1')), resample=Image.BICUBIC)
        poses[name] = im
    write(poses)
    with open(os.path.join(OUT, 'me.json')) as f:
        meta = json.load(f)
    meta['placeholder'] = True
    with open(os.path.join(OUT, 'me.json'), 'w') as f:
        json.dump(meta, f, indent=1)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'extract':
        extract(sys.argv[2:])
    elif cmd == 'build':
        build(sys.argv[2])
    elif cmd == 'placeholder':
        placeholder()
    else:
        print(__doc__)
