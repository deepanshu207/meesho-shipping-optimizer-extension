#!/usr/bin/env python3
"""Generate Shipping Optimizer extension icons (symbol-only, readable at 16px)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"

GOLD = (255, 215, 0)
MID = (245, 166, 35)
DEEP = (230, 126, 34)
SAVE_GREEN = (16, 185, 129)


def lerp_color(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def gradient_color(y: int, height: int) -> tuple[int, int, int]:
    t = y / max(height - 1, 1)
    if t < 0.5:
        return lerp_color(GOLD, MID, t / 0.5)
    return lerp_color(MID, DEEP, (t - 0.5) / 0.5)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_package(draw: ImageDraw.ImageDraw, size: int) -> None:
    pad = size * 0.2
    left = pad
    top = pad * 0.75
    right = size - pad
    bottom = size - pad * (1.45 if size >= 32 else 1.2)
    radius = max(int(size * 0.08), 1)

    draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=(255, 255, 255, 250))

    tape = max(1, int(size * 0.045))
    mid_y = top + (bottom - top) * 0.4
    draw.rectangle([left, mid_y - tape, right, mid_y + tape], fill=(*MID, 210))
    mid_x = (left + right) / 2
    draw.rectangle([mid_x - tape, top, mid_x + tape, bottom], fill=(*MID, 190))


def draw_savings_badge(draw: ImageDraw.ImageDraw, size: int) -> None:
    if size < 24:
        return

    pad = size * 0.16
    r = size * 0.19 if size >= 48 else size * 0.16
    cx = size - pad
    cy = size - pad
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*SAVE_GREEN, 255))

    stroke = max(1, int(size * 0.07))
    shaft_top = cy - r * 0.15
    shaft_bot = cy + r * 0.55
    draw.line([(cx, shaft_top), (cx, shaft_bot)], fill=(255, 255, 255, 255), width=stroke)
    head = r * 0.42
    draw.polygon(
        [
            (cx - head, shaft_bot - head * 0.35),
            (cx + head, shaft_bot - head * 0.35),
            (cx, shaft_bot + head * 0.65),
        ],
        fill=(255, 255, 255, 255),
    )


def create_icon(size: int) -> Image.Image:
    radius = max(size // 5, 2)

    bg = Image.new("RGBA", (size, size))
    pixels = bg.load()
    for y in range(size):
        color = gradient_color(y, size)
        for x in range(size):
            pixels[x, y] = (*color, 255)

    mask = rounded_mask(size, radius)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(canvas)
    draw_package(draw, size)
    draw_savings_badge(draw, size)

    if size >= 64:
        # Subtle highlight arc for depth
        shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shine)
        sd.ellipse(
            [-size * 0.15, -size * 0.35, size * 0.75, size * 0.55],
            fill=(255, 255, 255, 35),
        )
        canvas = Image.alpha_composite(canvas, shine)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    return out


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = ICONS / f"icon{size}.png"
        create_icon(size).save(path, "PNG", optimize=True)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
