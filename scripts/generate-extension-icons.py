#!/usr/bin/env python3
"""Generate Shipping Optimizer icons — Meesho gold palette + shipping reducer mark."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"

# Meesho seller / Shipping Optimizer palette
GOLD = (255, 215, 0)
MID = (245, 166, 35)
ORANGE = (230, 126, 34)
BROWN = (61, 41, 20)
CREAM = (255, 248, 238)
WHITE = (255, 255, 255)
GREEN = (5, 150, 105)


def lerp(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def meesho_gradient_pixel(x: int, y: int, size: int) -> tuple[int, int, int]:
    """Diagonal gold → orange gradient like Meesho seller UI."""
    t = (x + y) / max((size - 1) * 2, 1)
    if t < 0.45:
        return lerp(GOLD, MID, t / 0.45)
    return lerp(MID, ORANGE, (t - 0.45) / 0.55)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_background(size: int) -> Image.Image:
    radius = max(size // 5, 2)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = bg.load()
    for y in range(size):
        for x in range(size):
            pixels[x, y] = (*meesho_gradient_pixel(x, y, size), 255)

    mask = rounded_mask(size, radius)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(canvas)
    inset = max(1, size // 32)
    draw.rounded_rectangle(
        [inset, inset, size - inset - 1, size - inset - 1],
        radius=max(radius - inset, 1),
        outline=(*BROWN, 40),
        width=max(1, size // 48),
    )
    return canvas, mask


def draw_package(draw: ImageDraw.ImageDraw, size: int) -> tuple[float, float, float, float]:
    """White Meesho-style parcel with orange tape."""
    pad = size * (0.2 if size <= 20 else 0.18)
    left = pad
    right = size - pad
    top = size * (0.24 if size <= 20 else 0.22)
    bottom = size - pad * (1.1 if size <= 20 else 1.05)
    radius = max(int(size * 0.1), 1)

    draw.rounded_rectangle([left, top, right, bottom], radius=radius, fill=(*WHITE, 252))
    if size > 20:
        draw.rounded_rectangle(
            [left, top, right, bottom],
            radius=radius,
            outline=(*BROWN, 35),
            width=max(1, size // 64),
        )

    tape = max(1, int(size * (0.08 if size <= 20 else 0.045)))
    mid_y = top + (bottom - top) * 0.5
    draw.rectangle([left + 1, mid_y - tape, right - 1, mid_y + tape], fill=(*ORANGE, 240))
    if size > 20:
        mid_x = (left + right) / 2
        draw.rectangle([mid_x - tape, top + radius * 0.2, mid_x + tape, bottom - radius * 0.2], fill=(*MID, 210))

    if size >= 24:
        label_h = max(2, int(size * 0.07))
        label_top = top + (bottom - top) * 0.12
        draw.rounded_rectangle(
            [left + size * 0.12, label_top, right - size * 0.12, label_top + label_h],
            radius=label_h // 2,
            fill=(*CREAM, 255),
        )

    return left, top, right, bottom


def draw_rupee_on_box(draw: ImageDraw.ImageDraw, size: int, box: tuple[float, float, float, float]) -> None:
    if size < 28:
        return
    left, top, right, bottom = box
    cx = (left + right) / 2
    cy = top + (bottom - top) * 0.62
    r = size * 0.11
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*ORANGE, 235))
    stroke = max(1, int(size * 0.04))
    # Simplified ₹ glyph
    draw.line([(cx - r * 0.35, cy - r * 0.45), (cx + r * 0.4, cy - r * 0.45)], fill=(*WHITE, 255), width=stroke)
    draw.line([(cx - r * 0.1, cy - r * 0.45), (cx - r * 0.1, cy + r * 0.35)], fill=(*WHITE, 255), width=stroke)
    draw.line([(cx - r * 0.35, cy + r * 0.05), (cx + r * 0.25, cy + r * 0.05)], fill=(*WHITE, 255), width=stroke)
    draw.line([(cx - r * 0.35, cy + r * 0.35), (cx + r * 0.35, cy + r * 0.35)], fill=(*WHITE, 255), width=stroke)


def draw_reduce_badge(draw: ImageDraw.ImageDraw, size: int) -> None:
    """Green badge: shipping cost down (↓₹)."""
    if size < 16:
        return

    r = size * (0.22 if size <= 20 else (0.19 if size >= 48 else 0.18))
    cx = size - size * (0.15 if size <= 20 else 0.17)
    cy = size - size * (0.15 if size <= 20 else 0.17)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*GREEN, 255))
    if size > 20:
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            outline=(*WHITE, 180),
            width=max(1, size // 48),
        )

    stroke = max(1, int(size * (0.12 if size <= 20 else 0.06)))
    shaft_top = cy - r * 0.3
    shaft_bot = cy + r * (0.2 if size <= 20 else 0.15)
    draw.line([(cx, shaft_top), (cx, shaft_bot)], fill=(*WHITE, 255), width=stroke)
    head = r * (0.45 if size <= 20 else 0.38)
    draw.polygon(
        [
            (cx - head, shaft_bot - head * 0.15),
            (cx + head, shaft_bot - head * 0.15),
            (cx, shaft_bot + head * 0.6),
        ],
        fill=(*WHITE, 255),
    )

    if size >= 40:
        ru_x = cx - r * 0.55
        ru_y = cy - r * 0.05
        s = max(1, int(size * 0.025))
        draw.line([(ru_x - s, ru_y - s * 2), (ru_x + s * 2, ru_y - s * 2)], fill=(*WHITE, 255), width=s)
        draw.line([(ru_x, ru_y - s * 2), (ru_x, ru_y + s * 3)], fill=(*WHITE, 255), width=s)


def draw_shine(canvas: Image.Image, size: int) -> Image.Image:
    if size < 48:
        return canvas
    shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.ellipse([-size * 0.1, -size * 0.42, size * 0.72, size * 0.48], fill=(255, 255, 255, 42))
    return Image.alpha_composite(canvas, shine)


def create_icon(size: int) -> Image.Image:
    canvas, mask = draw_background(size)
    draw = ImageDraw.Draw(canvas)
    box = draw_package(draw, size)
    draw_rupee_on_box(draw, size, box)
    draw_reduce_badge(draw, size)
    canvas = draw_shine(canvas, size)

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
