"""Gera os ícones do app (grão de café creme sobre verde-folha). Uso: python3 tools/make_icons.py"""
from PIL import Image, ImageDraw
import math, os

GREEN = (46, 94, 58)
CREAM = (250, 249, 245)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public')

def bean(size, pad_frac, rounded):
    s = size * 4  # supersampling
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=GREEN)
    else:
        d.rectangle([0, 0, s, s], fill=GREEN)
    # grão: elipse inclinada desenhada numa camada e girada
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    w = s * (1 - 2 * pad_frac) * 0.62
    h = s * (1 - 2 * pad_frac) * 0.86
    cx, cy = s / 2, s / 2
    ld.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=CREAM)
    # sulco em S
    pts = []
    for i in range(101):
        t = i / 100
        y = cy - h * 0.40 + t * h * 0.80
        x = cx + math.sin((t - 0.5) * math.pi * 2) * w * 0.13
        pts.append((x, y))
    ld.line(pts, fill=GREEN, width=int(s * 0.045), joint='curve')
    layer = layer.rotate(-30, resample=Image.BICUBIC, center=(cx, cy))
    img.alpha_composite(layer)
    return img.resize((size, size), Image.LANCZOS)

os.makedirs(OUT, exist_ok=True)
bean(192, 0.12, True).save(os.path.join(OUT, 'icon-192.png'))
bean(512, 0.12, True).save(os.path.join(OUT, 'icon-512.png'))
bean(512, 0.22, False).save(os.path.join(OUT, 'icon-maskable-512.png'))
bean(180, 0.12, False).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
print('ícones gerados em', os.path.abspath(OUT))
