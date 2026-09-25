# -*- coding: utf-8 -*-
"""只测一件事：下载到第几秒、收到多少字节时连接断掉。"""

import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app  # noqa: E402

TOKEN = sys.argv[1]
RID = sys.argv[2] if len(sys.argv) > 2 else "255"
URL = f"https://cugbshare.asia/api/v1/resources/{RID}/download?token={TOKEN}"
HDRS = {"User-Agent": app.USER_AGENT, "Referer": app.SITE_ORIGIN + "/"}

print(f"资源 id={RID}  URL 长度={len(URL)}", flush=True)
t0 = time.time()
try:
    with urllib.request.urlopen(urllib.request.Request(URL, headers=HDRS), timeout=600) as r:
        cl = int(r.headers.get("Content-Length") or 0)
        print(f"Content-Length = {cl}  ({cl/1048576:.2f} MB)", flush=True)
        got = 0
        mark = 0.0
        while True:
            b = r.read1(64 * 1024)
            if not b:
                print(f"  ⛔ 流结束（EOF）", flush=True)
                break
            got += len(b)
            el = time.time() - t0
            if el - mark >= 10:
                mark = el
                print(f"  +{el:6.1f}s  {got:>9} / {cl}  ({got/cl*100 if cl else 0:5.1f}%)", flush=True)
        el = time.time() - t0
        print(f"\n结束: 收到 {got} / {cl} 字节  =  {got/cl*100 if cl else 0:.1f}%", flush=True)
        print(f"总耗时 {el:.1f}s   平均 {got/1024/max(el,0.01):.1f} KB/s", flush=True)
        print(f"{'✅ 完整' if cl and got == cl else '❌ 被截断，少 ' + str(cl - got) + ' 字节'}", flush=True)
except Exception as e:
    print(f"\n异常 {type(e).__name__}: {e}", flush=True)
    print(f"耗时 {time.time()-t0:.1f}s", flush=True)
