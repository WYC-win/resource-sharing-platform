# -*- coding: utf-8 -*-
"""
严格控制变量的实验：直接把 PDF 里嵌的原始 JPEG 拿出来，按不同缩放/质量重压，看能省多少。

原图 6 张，合计 1,725,942 字节（占全文件 99.2%）。
"""

import io
import re
import zlib
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "_samples" / "2018年大物下期末.pdf"
data = SRC.read_bytes()

# ── 抽出 6 张原始 JPEG ────────────────────────────────────────────────────
imgs = []
for m in re.finditer(rb"/Subtype\s*/Image", data):
    start = m.start()
    seg = data[start:start + 900]
    if b"DCTDecode" not in seg:
        continue
    lm = re.search(rb"/Length\s+(\d+)", seg)
    sp = seg.find(b"stream")
    if not (lm and sp > 0):
        continue
    s = start + sp + 6
    while data[s:s + 1] in (b"\r", b"\n"):
        s += 1
    n = int(lm.group(1))
    imgs.append((s, n, data[s:s + n]))

total = sum(n for _, n, _ in imgs)
print(f"抽出 {len(imgs)} 张原始 JPEG，合计 {total} 字节")
for i, (_, n, raw) in enumerate(imgs):
    with Image.open(io.BytesIO(raw)) as im:
        print(f"  #{i+1}  {im.size[0]}x{im.size[1]}  {n:>8} 字节  {raw[:4]!r}")

print(f"\n原 PDF 全文件 {len(data)} 字节；原图占 {100*total/len(data):.1f}%")
print(f"原图仅 gzip: {len(zlib.compress(b''.join(r for _,_,r in imgs),9))} 字节\n")

print(f"{'缩放':>6} {'等效边长':>11} {'质量':>5} {'图片合计':>10} {'占原图':>7} {'+gzip':>10} {'全文件估算':>11}")
print("-" * 72)
for scale, q in [(1.0, 85), (1.0, 75), (0.75, 80), (0.5, 80), (0.5, 70),
                 (0.4, 70), (0.33, 70), (0.25, 65)]:
    out_all = []
    w0 = h0 = 0
    for _, _, raw in imgs:
        with Image.open(io.BytesIO(raw)) as im:
            im = im.convert("RGB")
            w0, h0 = im.size
            if scale != 1.0:
                im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))),
                               Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
            out_all.append(buf.getvalue())
    new_total = sum(len(b) for b in out_all)
    gz = len(zlib.compress(b"".join(out_all), 9))
    # 全文件 = 新图 + 原文件里的非图片部分
    est = len(data) - total + new_total
    est_gz = len(data) - total + gz
    print(f"{scale:>6.2f} {f'{int(w0*scale)}x{int(h0*scale)}':>11} {q:>5} "
          f"{new_total:>10} {100*new_total/total:>6.1f}% {gz:>10} "
          f"{est_gz:>7} ({100*(1-est_gz/len(data)):>4.1f}%↓)")

# 留一张 1/2 缩放的对照页，供肉眼判断能不能看清
with Image.open(io.BytesIO(imgs[1][2])) as im:
    im = im.convert("RGB")
    im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(
        HERE / "_samples" / "对照-半分辨率.jpg", "JPEG", quality=80,
        optimize=True, progressive=True)
    print(f"\n已留对照图：_samples/对照-半分辨率.jpg（供判断清晰度）")
    print(f"原图 {im.size[0]}x{im.size[1]} → 半分辨率 {im.width//2}x{im.height//2}")
