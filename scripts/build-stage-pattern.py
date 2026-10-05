"""
Builds the seamless sticker pattern used behind the live draw stage.

The brand illustration (stickers over a green -> cream radial gradient) is not tileable as is:
every copy would repeat its own gradient and cut the stickers at the edges. This script models the
gradient, cuts every sticker out of it (adding the cream sticker outline), drops the ones touching
the border, re-lays them evenly on a torus (seamless tile) and applies a light blur. The gradient
itself is recreated in CSS (.parallax-bg in frontend/src/styles/global.css).

Requires only Python 3 + Pillow:
    python3 scripts/build-stage-pattern.py assets/stage-pattern-source.jpg frontend/public/brand/stage-pattern.webp
"""
import math, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
CREAM = (251, 248, 204)
img = Image.open(SRC).convert('RGB')
w, h = img.size
cx, cy = w / 2, h / 2

# 1. Model of the radial background gradient (anchors measured from the image).
anchors = [(0, (249, 240, 226)), (144, (245, 228, 212)), (240, (251, 218, 188)), (288, (240, 208, 174)),
           (336, (194, 181, 148)), (384, (145, 151, 120)), (432, (101, 124, 94)), (480, (52, 97, 68)),
           (528, (30, 84, 57)), (2000, (28, 82, 55))]
def bg_at(r):
    for (r0, c0), (r1, c1) in zip(anchors, anchors[1:]):
        if r <= r1:
            t = (r - r0) / (r1 - r0)
            return tuple(round(a + (b - a) * t) for a, b in zip(c0, c1))
lut = [bg_at(r) for r in range(int(math.hypot(cx, cy)) + 2)]
bg = Image.new('RGB', (w, h))
bg.putdata([lut[int(math.hypot(x - cx, y - cy))] for y in range(h) for x in range(w)])

# 2. Foreground = pixels that differ from the gradient (largest channel difference).
r_, g_, b_ = ImageChops.difference(img, bg).split()
diff = ImageChops.lighter(ImageChops.lighter(r_, g_), b_)
core = diff.point(lambda v: 255 if v > 48 else 0)
core = core.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))   # close small gaps
core = core.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))   # drop specks

# 3. Fill holes: background is whatever connects to the border.
inv = Image.eval(core, lambda v: 255 - v)
draw = ImageDraw.Draw(inv)
border = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
for xy in border:
    if inv.getpixel(xy) == 255:
        ImageDraw.floodfill(inv, xy, 128)
filled = inv.point(lambda v: 0 if v == 128 else 255)

# 4. Sticker outline, then drop every sticker (with its blur margin) that touches the border.
outlined = filled.filter(ImageFilter.MaxFilter(13))
check = outlined.filter(ImageFilter.MaxFilter(17))
for xy in border:
    if check.getpixel(xy) == 255:
        ImageDraw.floodfill(check, xy, 0)
keep = check
outlined = ImageChops.darker(outlined, keep)
filled = ImageChops.darker(filled, keep)

# 5. Cut every sticker (artwork + cream outline) as its own sprite.
sharp = Image.new('RGBA', (w, h), CREAM + (0,))
sharp.paste(Image.new('RGBA', (w, h), CREAM + (255,)), mask=outlined)
sharp.paste(img.convert('RGBA'), mask=filled)

work = outlined.copy()
sprites = []
for y in range(0, h, 3):
    for x in range(0, w, 3):
        if work.getpixel((x, y)) != 255:
            continue
        ImageDraw.floodfill(work, (x, y), 128)
        mask = work.point(lambda v: 255 if v == 128 else 0)
        work = work.point(lambda v: 0 if v == 128 else v)
        box = mask.getbbox()
        area = sum(1 for v in mask.crop(box).getdata() if v)
        if area < 150:
            continue
        sprite = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), CREAM + (0,))
        sprite.paste(sharp.crop(box), mask=mask.crop(box))
        sprites.append((area, sprite))
sprites.sort(key=lambda item: -item[0])
big = [s for a, s in sprites if a > 12000]
small = [s for a, s in sprites if a <= 12000]
print(f'stickers: {len(big)} big, {len(small)} small')

# 6. Seamless layout on a torus: big ones on a jittered brick grid, small ones in the gaps.
import random
rng = random.Random(7)
T = 1024
GAP = 14
tile_sharp = Image.new('RGBA', (T, T), CREAM + (0,))
placed = []

def overlaps(x, y, sw, sh):
    for px, py, pw, ph in placed:
        for dx in (-T, 0, T):
            for dy in (-T, 0, T):
                if x < px + dx + pw + GAP and px + dx < x + sw + GAP and y < py + dy + ph + GAP and py + dy < y + sh + GAP:
                    return True
    return False

def put(sprite, x, y):
    x, y = int(x) % T, int(y) % T
    for dx in (-T, 0, T):
        for dy in (-T, 0, T):
            tile_sharp.alpha_composite(sprite, (x + dx, y + dy)) if 0 <= x + dx < T and 0 <= y + dy < T else None
            if not (0 <= x + dx < T and 0 <= y + dy < T):
                # Partially visible copies (crossing an edge).
                left, top = x + dx, y + dy
                if left < T and top < T and left + sprite.width > 0 and top + sprite.height > 0:
                    crop = sprite.crop((max(0, -left), max(0, -top), min(sprite.width, T - left), min(sprite.height, T - top)))
                    tile_sharp.alpha_composite(crop, (max(0, left), max(0, top)))
    placed.append((x, y, sprite.width, sprite.height))

cols = math.ceil(math.sqrt(len(big)))
rows = math.ceil(len(big) / cols)
# Fill every slot of the grid, repeating characters when there are fewer than slots.
order = (big * math.ceil(cols * rows / len(big)))[: cols * rows]
rng.shuffle(order)
for i, sprite in enumerate(order):
    row, col = divmod(i, cols)
    cx_ = (col + 0.5 + (0.5 if row % 2 else 0)) * T / cols + rng.uniform(-0.08, 0.08) * T / cols
    cy_ = (row + 0.5) * T / rows + rng.uniform(-0.08, 0.08) * T / rows
    put(sprite, cx_ - sprite.width / 2, cy_ - sprite.height / 2)

skipped = 0
for sprite in small * 3:
    for _ in range(400):
        x, y = rng.uniform(0, T), rng.uniform(0, T)
        if not overlaps(x, y, sprite.width, sprite.height):
            put(sprite, x, y)
            break
    else:
        skipped += 1
print(f'small stickers placed: {len(small) * 3 - skipped}')

tile = tile_sharp.filter(ImageFilter.GaussianBlur(2.5))
tile.save(OUT, 'WEBP', quality=86, method=6)
