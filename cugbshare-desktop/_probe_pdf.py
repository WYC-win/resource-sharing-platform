# -*- coding: utf-8 -*-
"""搞清楚 PDF 里到底是什么，以及 33% 的压缩收益来自哪里。"""

import re
import zlib
from pathlib import Path

p = Path(__file__).resolve().parent / "_samples" / "2018年大物下期末.pdf"
data = p.read_bytes()
n = len(data)
print(f"{p.name}  {n} 字节\n")

# ── 1) 图片对象到底用什么 Filter，stream 头几个字节是什么 ────────────────
print("=== 图片对象（/Subtype /Image）逐个看 ===")
for m in list(re.finditer(rb"/Subtype\s*/Image", data))[:12]:
    start = m.start()
    seg = data[start:start + 900]
    filt = re.findall(rb"/Filter\s*(\[[^\]]*\]|/\w+)", seg)
    wl = re.findall(rb"/(Width|Height|Length)\s+(\d+)", seg)
    # 找紧随其后的 stream
    sp = seg.find(b"stream")
    magic = b""
    if sp > 0:
        s = start + sp + 6
        while data[s:s + 1] in (b"\r", b"\n"):
            s += 1
        magic = data[s:s + 6]
    print(f"  @{start:<9} filter={[f.decode() for f in filt]}  "
          f"{dict((k.decode(), int(v)) for k, v in wl)}  stream头={magic!r}")

# ── 2) 全文件里 JPEG 起始标记有多少个 ─────────────────────────────────────
print(f"\n=== 全文件扫描 ===")
print(f"  JPEG SOI (FFD8FF) 出现次数: {len(re.findall(rb'\\xff\\xd8\\xff', data))}")
print(f"  '/Filter /DCTDecode' 次数:  {len(re.findall(rb'/DCTDecode', data))}")
print(f"  '/Filter /FlateDecode' 次数: {len(re.findall(rb'/FlateDecode', data))}")
print(f"  PNG 签名出现次数:            {len(re.findall(rb'\\x89PNG\\r\\n\\x1a\\n', data))}")

# ── 3) 压缩收益到底来自文件的哪一段？（按 128KB 分块看）────────────────────
print("\n=== 分块压缩率（看收益来自哪个区域）===")
BLK = 128 * 1024
for i in range(0, n, BLK):
    chunk = data[i:i + BLK]
    c = zlib.compress(chunk, 9)
    print(f"  {i/1024:>7.0f}KB - {(i+len(chunk))/1024:>7.0f}KB  "
          f"{len(chunk):>7} → {len(c):>7}  省 {100*(1-len(c)/len(chunk)):5.1f}%")
