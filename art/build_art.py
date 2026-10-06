"""Cut UI sprites out of the reference screen and tint the missing tiers."""
import colorsys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(r"c:\mini game_03")
REF = Path(
    r"C:\Users\nlion\.cursor\projects\c-mini-game-03\assets"
    r"\c__Users_nlion_AppData_Roaming_Cursor_User_workspaceStorage_c87ca5bbc5ef0b395d55456af8050d9e_images_Gemini_Generated_Image_x93sjzx93sjzx93s-050df44f-fef2-482b-a606-dbbb4b5c949d.jpg"
)
TAP = Path(r"C:\Users\nlion\.cursor\projects\c-mini-game-03\assets\tap-orb.jpg")
BG = Path(r"C:\Users\nlion\.cursor\projects\c-mini-game-03\assets\bg-space.jpg")
OUT = ROOT / "art"
src = Image.open(REF).convert("RGBA")


def flood_clear(im, thresh):
    a = np.array(im.convert("RGBA"))
    lum = a[:, :, :3].mean(axis=2)
    h, w = lum.shape
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        seen[y, x] = True
        if lum[y, x] > thresh:
            continue
        a[y, x, 3] = 0
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return Image.fromarray(a)


def scale(im, factor):
    return im.resize((max(1, im.width * factor), max(1, im.height * factor)), Image.Resampling.LANCZOS)


def extract_orb(box):
    im = src.crop(box).convert("RGBA")
    a = np.array(im)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy, rad = w * 0.50, h * 0.56, h * 0.34
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    alpha = np.clip((rad + 1.2 - dist) / 1.8, 0, 1)
    a[:, :, 3] = (alpha * 255).astype(np.uint8)
    rgb = a[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)
    ring = (dist > rad * 0.78) & (dist < rad * 0.98) & (alpha > 0.75)
    if ring.sum() > 8:
        color = np.median(rgb[ring], axis=0)
        rx, ry = rad * 0.42, rad * 0.72
        oy = cy - rad * 0.06
        ellipse = ((xx - cx) / rx) ** 2 + ((yy - oy) / ry) ** 2
        feather = np.clip((1.05 - ellipse) / 0.28, 0, 1)
        mixed = rgb * (1 - feather[..., None]) + color * feather[..., None]
        a[:, :, :3] = mixed.astype(np.uint8)
    pad = 1
    x0, y0 = max(0, int(cx - rad - pad)), max(0, int(cy - rad - pad))
    x1, y1 = min(w, int(cx + rad + pad + 1)), min(h, int(cy + rad + pad + 1))
    return Image.fromarray(a).crop((x0, y0, x1, y1))


def recolor(im, hue, sat_scale=1.0, val_scale=1.0, keep_white=0.16):
    a = np.array(im.convert("RGBA"))
    out = a.copy()
    rgb = a[:, :, :3].astype(np.float32) / 255.0
    alpha = a[:, :, 3]
    flat = rgb.reshape(-1, 3)
    al = alpha.reshape(-1)
    for i, (r, g, b) in enumerate(flat):
        if al[i] < 8:
            continue
        hh, s, v = colorsys.rgb_to_hsv(float(r), float(g), float(b))
        if s < keep_white and v > 0.72:
            continue
        rr, gg, bb = colorsys.hsv_to_rgb(hue % 1, min(1, s * sat_scale), min(1, v * val_scale))
        out.reshape(-1, 4)[i, 0] = int(rr * 255)
        out.reshape(-1, 4)[i, 1] = int(gg * 255)
        out.reshape(-1, 4)[i, 2] = int(bb * 255)
    return Image.fromarray(out)


def key_magenta(path):
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mag = np.minimum(r, b) - g
    alpha = np.clip((78 - mag) / 36, 0, 1)
    a[:, :, 3] = alpha * 255
    spill = (alpha < 0.85) & (alpha > 0)
    a[:, :, 0] = np.where(spill, np.minimum(r, g + 40), r)
    a[:, :, 2] = np.where(spill, np.minimum(b, g + 40), b)
    return Image.fromarray(a.astype(np.uint8))


cell = scale(flood_clear(src.crop((26, 344, 140, 403)), 26), 3)
cell.save(OUT / "cell.png")
gold = scale(flood_clear(src.crop((282, 556, 398, 613)), 30), 3)
gold.save(OUT / "cell-gold.png")
white = scale(flood_clear(src.crop((536, 556, 652, 613)), 30), 3)
white.save(OUT / "cell-white.png")

orb1 = scale(extract_orb((26, 414, 140, 473)), 4)
orb2 = scale(extract_orb((406, 484, 523, 543)), 4)
def stamp(path, text):
    im = Image.open(path).convert("RGBA")
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", max(12, int(im.height * 0.48)))
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (im.width - tw) / 2 - bbox[0]
    y = (im.height - th) / 2 - bbox[1] + im.height * 0.04
    draw.text((x + 1, y + 1), text, font=font, fill=(30, 16, 0, 150))
    draw.text((x, y), text, font=font, fill=(255, 252, 245, 255))
    im.save(path)


orb1.save(OUT / "orb-1.png")
orb2.save(OUT / "orb-2.png")

# hues: blue, green, amber, orange, pink, white-gold
for name, hue, sat, val in [
    ("orb-3.png", 0.56, 1.15, 1.05),
    ("orb-4.png", 0.36, 1.2, 1.02),
    ("orb-5.png", 0.12, 1.05, 1.12),
    ("orb-6.png", 0.05, 1.25, 1.05),
    ("orb-7.png", 0.93, 1.15, 1.05),
    ("orb-8.png", 0.14, 0.55, 1.25),
]:
    recolor(orb1, hue, sat, val).save(OUT / name)

for n in range(1, 9):
    stamp(OUT / f"orb-{n}.png", str(n))

def trim(im, pad=6):
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 24)
    if len(xs) == 0:
        return im
    x0 = max(0, int(xs.min()) - pad)
    y0 = max(0, int(ys.min()) - pad)
    x1 = min(a.shape[1], int(xs.max()) + pad)
    y1 = min(a.shape[0], int(ys.max()) + pad)
    return im.crop((x0, y0, x1, y1))


def fit_h(im, height=320):
    im = trim(im)
    width = max(1, int(im.width * height / im.height))
    return im.resize((width, height), Image.Resampling.LANCZOS)


pale = fit_h(key_magenta(Path(r"C:\Users\nlion\.cursor\projects\c-mini-game-03\assets\crystal-pale.jpg")))
violet = fit_h(key_magenta(Path(r"C:\Users\nlion\.cursor\projects\c-mini-game-03\assets\crystal-violet.jpg")))
pale.save(OUT / "crystal-2.png")
violet.save(OUT / "crystal-3.png")
recolor(pale, 0.08, 0.45, 1.02, keep_white=0.12).save(OUT / "crystal-1.png")
recolor(pale, 0.34, 1.2, 1.04, keep_white=0.12).save(OUT / "crystal-4.png")
recolor(pale, 0.13, 1.15, 1.08, keep_white=0.12).save(OUT / "crystal-5.png")
recolor(violet, 0.04, 1.25, 1.05, keep_white=0.12).save(OUT / "crystal-6.png")
recolor(violet, 0.92, 1.1, 1.06, keep_white=0.12).save(OUT / "crystal-7.png")
recolor(pale, 0.15, 0.35, 1.28, keep_white=0.05).save(OUT / "crystal-8.png")
recolor(pale, 0.12, 0.25, 1.35, keep_white=0.05).save(OUT / "crystal-combo.png")

coin = src.crop((536, 22, 592, 78)).convert("RGBA")
ca = np.array(coin)
ch, cw = ca.shape[:2]
yy, xx = np.mgrid[0:ch, 0:cw]
dist = np.sqrt((xx - cw / 2) ** 2 + (yy - ch / 2) ** 2)
ca[:, :, 3] = (np.clip((cw * 0.48 - dist) / 1.6, 0, 1) * 255).astype(np.uint8)
scale(Image.fromarray(ca), 3).save(OUT / "coin.png")

key_magenta(TAP).save(OUT / "tap.png")
Image.open(BG).convert("RGB").save(OUT / "bg.jpg", quality=90)
print("wrote", OUT)
