# -*- coding: utf-8 -*-
"""
本地实测 PDF 可压缩性。

用法：
  python _probe_compress.py              # 分析 _samples/ 里已有的文件
  python _probe_compress.py --fetch 257  # 先从站点下这个资源到 _samples/ 再分析

下载只走正常读取，不在服务器上跑压缩（服务器 1.8G 内存无 swap，xz 会吃几百 MB）。
"""

import bz2
import lzma
import os
import re
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app  # noqa: E402

HERE = Path(__file__).resolve().parent
SAMPLES = HERE / "_samples"


def human(n: float) -> str:
    for u in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.1f}{u}"
        n /= 1024
    return f"{n:.1f}GB"


def analyze_streams(data: bytes) -> dict:
    """粗略统计 PDF 各 stream 的构成。"""
    out = {"jpeg": 0, "flate": 0, "other": 0, "raw": 0}
    out["pages"] = len(re.findall(rb"/Type\s*/Page[^s]", data))
    out["imgs"] = len(re.findall(rb"/Subtype\s*/Image", data))
    pos = 0
    while True:
        s = data.find(b"stream", pos)
        if s < 0:
            break
        e = data.find(b"endstream", s)
        if e < 0:
            break
        head, body = data[max(0, s - 500):s], e - (s + 6)
        if body > 0:
            if b"DCTDecode" in head:
                out["jpeg"] += body
            elif b"FlateDecode" in head:
                out["flate"] += body
            elif b"/Filter" in head:
                out["other"] += body
            else:
                out["raw"] += body
        pos = e + 9
    return out


def report(p: Path) -> None:
    raw = p.read_bytes()
    n = len(raw)
    print(f"\n【{p.name}】")
    print(f"  大小 {n} 字节 ({human(n)})   头 {raw[:8]!r}  "
          f"{'✅ PDF' if raw[:5] == b'%PDF-' else '⚠️ 非 PDF'}")

    print("  通用无损压缩（本地跑，不碰服务器）:")
    for label, fn in [
        ("zlib-9 (≈gzip)", lambda d: zlib.compress(d, 9)),
        ("bz2-9", bz2.compress),
        ("lzma xz-6", lambda d: lzma.compress(d, preset=6)),
    ]:
        try:
            c = fn(raw)
            print(f"    {label:16} {len(c):>9} 字节   省 {100*(1-len(c)/n):5.1f}%")
        except Exception as ex:
            print(f"    {label:16} 失败: {ex}")

    if raw[:5] != b"%PDF-":
        return
    st = analyze_streams(raw)
    print(f"  内部构成（{st['pages']} 页, {st['imgs']} 张图）:")
    for k, label in [("jpeg", "JPEG 图片(DCTDecode)"), ("flate", "Flate 流(已 deflate)"),
                     ("other", "其它 Filter"), ("raw", "未压缩流")]:
        if st[k]:
            print(f"    {label:24} {st[k]:>9} 字节  占 {100*st[k]/n:5.1f}%")
    hard = st["jpeg"] + st["flate"]
    print(f"  => 已压过的部分占 {100*hard/n:.1f}%；"
          f"无损压缩最多只能动剩下那 {100*(n-hard)/n:.1f}%")


def main() -> None:
    SAMPLES.mkdir(exist_ok=True)

    if "--fetch" in sys.argv:
        rid = sys.argv[sys.argv.index("--fetch") + 1]
        token = os.environ.get("PB_TOKEN", "")
        if not token:
            print("需要 token：先 export PB_TOKEN=<token>")
            return
        url = f"{app.SITE_ORIGIN}/api/v1/resources/{rid}/download?token={token}"
        print(f"下载资源 {rid} 到 {SAMPLES} …")
        res = app.fetch_to_folder(url, folder=SAMPLES)
        print(f"  完成: {res['name']}  {res['bytes']} 字节")
        print()

    files = sorted(SAMPLES.glob("*"))
    if not files:
        print(f"{SAMPLES} 里没有文件。用 --fetch <资源id> 下载一份。")
        return

    print("=" * 74)
    print(f"样本（{len(files)} 个，来自站点真实资源）")
    print("=" * 74)
    for p in files:
        if p.is_file() and p.stat().st_size > 1024:
            report(p)

    print("\n" + "=" * 74)
    print("解读：JPEG/Flate 占比高 → 无损压缩几乎没收益，只能靠有损重压图片（降 DPI/质量）")
    print("=" * 74)


if __name__ == "__main__":
    main()
