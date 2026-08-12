from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

src = Path(r"d:\Bajrang\TurfScore\turfScore_landing_image.png")
out = Path(r"d:\Bajrang\TurfScore\client\public\images\turfscore-landing-bg.png")

im = Image.open(src).convert("RGB")
w, h = im.size
print("source", w, h)

base = im.copy()

# Scrub baked UI; keep stadium / batsman
regions = [
    (0.00, 0.00, 0.28, 0.16),  # logo
    (0.62, 0.00, 1.00, 0.14),  # pitch
    (0.02, 0.28, 0.48, 0.58),  # headline
    (0.02, 0.78, 0.55, 0.98),  # features
    (0.55, 0.08, 0.98, 0.95),  # auth card
]

for x0, y0, x1, y1 in regions:
    box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
    patch = im.crop(box).filter(ImageFilter.GaussianBlur(radius=32))
    dark = Image.new("RGB", patch.size, (2, 13, 11))
    patch = Image.blend(patch, dark, 0.32)
    base.paste(patch, box[:2])

vignette = Image.new("RGBA", (w, h), (0, 0, 0, 0))
vd = ImageDraw.Draw(vignette)
for i in range(48):
    a = int(10 + i * 1.35)
    x = int(w * (0.52 + i * 0.01))
    vd.rectangle([x, 0, w, h], fill=(2, 13, 11, min(a, 110)))

# Soft left readability wash (light)
left = Image.new("RGBA", (w, h), (0, 0, 0, 0))
ld = ImageDraw.Draw(left)
for i in range(28):
    a = int(8 + i * 0.9)
    x1 = int(w * (0.42 - i * 0.012))
    ld.rectangle([0, 0, max(0, x1), h], fill=(2, 13, 11, min(a, 70)))

base = base.convert("RGBA")
base = Image.alpha_composite(base, left)
base = Image.alpha_composite(base, vignette).convert("RGB")
base.save(out, "PNG", optimize=True)
print("wrote", out, out.stat().st_size)
