from pathlib import Path
from PIL import Image

base = Path(r"c:\mini game_03\art")
raw = base / "raw"
names = [
    "orb-1.png",
    "orb-2.png",
    "orb-4.png",
    "orb-8.png",
    "crystal-1.png",
    "crystal-2.png",
    "crystal-3.png",
    "crystal-combo.png",
    "coin.png",
    "tap.png",
    "cell-white.png",
]
for n in names:
    im = Image.open(base / n).convert("RGBA")
    bg = Image.new("RGB", im.size, (40, 48, 70))
    bg.paste(im, (0, 0), im)
    bg.save(raw / ("pv-" + n.replace(".png", ".jpg")), quality=85)
    print(n, im.size)
