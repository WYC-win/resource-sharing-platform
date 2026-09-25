# -*- coding: utf-8 -*-
"""
生成 EXE 图标：直接用网站上 favicon 那个 📚 emoji。

站点 client/index.html 里的 favicon 就是：
    <svg viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>

这里用 Segoe UI Emoji 把同一个字形渲染成多尺寸 .ico。
渲染方式：先在 4 倍尺寸绘制再 LANCZOS 缩小（超采样），小尺寸下也清晰。

用法：python make_icon.py
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT_ICO = HERE / "icon.ico"
OUT_PREVIEW = HERE / "icon_preview.png"

EMOJI = "\U0001F4DA"  # 📚
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\seguiemj.ttf",   # Segoe UI Emoji
    r"C:\Windows\Fonts\SegoeUIEmoji.ttf",
]
SIZES = [16, 24, 32, 48, 64, 128, 256]
SUPERSAMPLE = 4
GLYPH_RATIO = 0.82  # 对应 SVG 里 font-size:90 / viewBox:100 的占比


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception as e:
                print(f"  加载 {p} 失败: {e}", file=sys.stderr)
    raise SystemExit("找不到 Segoe UI Emoji 字体，无法渲染彩色 emoji")


def render(size: int) -> Image.Image:
    """渲染单个尺寸（透明背景）。"""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = load_font(int(big * GLYPH_RATIO))
    try:
        d.text((big / 2, big / 2), EMOJI, font=font, embedded_color=True, anchor="mm")
    except TypeError:  # 老版本 Pillow 不支持 embedded_color
        d.text((big / 2, big / 2), EMOJI, font=font, anchor="mm")
    if size != big:
        img = img.resize((size, size), Image.LANCZOS)
    return img


def coverage(img: Image.Image) -> float:
    a = img.getchannel("A")
    return sum(1 for p in a.getdata() if p > 8) / float(img.width * img.height)


def main() -> int:
    frames = []
    print("各尺寸不透明像素占比：")
    for s in SIZES:
        im = render(s)
        cov = coverage(im)
        print(f"  {s:>3}x{s:<3}  {cov*100:5.1f}%")
        if cov < 0.02:
            print(f"  ❌ {s}px 几乎空白，渲染失败", file=sys.stderr)
            return 1
        frames.append(im)

    biggest = frames[-1]
    biggest.save(OUT_ICO, format="ICO",
                 sizes=[(s, s) for s in SIZES],
                 append_images=frames[:-1])
    print(f"\n✅ 已生成 {OUT_ICO}  ({OUT_ICO.stat().st_size} 字节)")

    # 预览图：放大展示 16/32/48/256，方便肉眼确认
    pad = 12
    show = [frames[0], frames[2], frames[3], frames[-1]]
    scales = [8, 5, 4, 1]
    tiles = [im.resize((im.width * sc, im.height * sc), Image.NEAREST)
             for im, sc in zip(show, scales)]
    w = sum(t.width for t in tiles) + pad * (len(tiles) + 1)
    h = max(t.height for t in tiles) + pad * 2
    canvas = Image.new("RGBA", (w, h), (245, 246, 248, 255))
    x = pad
    for t in tiles:
        canvas.paste(t, (x, (h - t.height) // 2), t)
        x += t.width + pad
    canvas.save(OUT_PREVIEW)
    print(f"✅ 已生成预览 {OUT_PREVIEW}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
