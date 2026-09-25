# -*- coding: utf-8 -*-
"""实测真实站点的下载：是否被截断、进度回调的真实时间线。

只读操作，只下一份文件到临时目录。
"""

import os
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app  # noqa: E402

TOKEN = sys.argv[1]
BASE = "https://cugbshare.asia/api/v1"

# ── 先问接口要资源列表（顺带验证 token 可用）─────────────────────────────
def api(path):
    req = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": app.USER_AGENT, "Authorization": "Bearer " + TOKEN},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        import json
        return json.loads(r.read().decode("utf-8"))


print("=== 目标资源 ===")
target = None
try:
    data = api("/resources/admin?page=1&pageSize=500")
    items = data.get("data", {}).get("list") or data.get("data", {}).get("items") or []
    for it in items:
        if "2020年秋期中" in (it.get("title") or ""):
            target = it
            break
    print("  列表条数:", len(items))
except Exception as e:
    print("  列表接口失败:", e)

if target:
    print("  命中:", target.get("id"), target.get("title"),
          "| file_size =", target.get("file_size"), "| file_type =", target.get("file_type"))

rid = target.get("id") if target else 168
print(f"\n=== 下载 resource id={rid} ===")

url = f"{BASE}/resources/{rid}/download?token={TOKEN}"
events = []
t0 = time.time()


def on_progress(got, total, name):
    events.append((round(time.time() - t0, 3), got, total))


with tempfile.TemporaryDirectory() as td:
    # 先用裸 urllib 看响应头，确认服务端声明的长度
    req = urllib.request.Request(url, headers={"User-Agent": app.USER_AGENT, "Referer": app.SITE_ORIGIN + "/"})
    with urllib.request.urlopen(req, timeout=60) as r:
        declared = r.headers.get("Content-Length")
        enc = r.headers.get("Content-Encoding")
        te = r.headers.get("Transfer-Encoding")
        ctype = r.headers.get("Content-Type")
        cd = r.headers.get("Content-Disposition")
        n = 0
        while True:
            b = r.read(64 * 1024)
            if not b:
                break
            n += len(b)

    print(f"  Content-Length     = {declared} ({int(declared)/1024:.1f} KB)" if declared else "  Content-Length     = (无)")
    print(f"  Transfer-Encoding  = {te}")
    print(f"  Content-Encoding   = {enc}")
    print(f"  Content-Type       = {ctype}")
    print(f"  裸读取到的字节数   = {n} ({n/1024:.1f} KB)")
    if declared:
        d = int(declared)
        print(f"  => {'✅ 完整' if n == d else f'❌ 被截断！少了 {d-n} 字节 ({(d-n)/d*100:.1f}%)'}")

    print("\n=== 用 app.fetch_to_folder 下载，记录进度回调时间线 ===")
    t0 = time.time()          # 只计这一段，别把上面的裸下载算进来
    res = app.fetch_to_folder(url, folder=Path(td), on_progress=on_progress)
    elapsed = time.time() - t0
    print(f"  返回: name={res['name']} bytes={res['bytes']} total={res['total']}")
    print(f"  进度回调次数: {len(events)}")
    if events:
        step = max(1, len(events) // 12)
        for ts, got, total in events[::step]:
            pct = (got / total * 100) if total else 0
            print(f"    +{ts:6.3f}s  {got:>9} / {total:<9}  {pct:5.1f}%")
        ts, got, total = events[-1]
        print(f"    +{ts:6.3f}s  {got:>9} / {total:<9}  (最后一次)")
    print(f"  本次耗时: {elapsed:.3f}s  ->  {res['bytes']/1024/max(elapsed,0.001):.1f} KB/s")
    print(f"  落盘大小: {Path(res['path']).stat().st_size} 字节")
    print(f"  文件头: {Path(res['path']).read_bytes()[:8]!r}")
