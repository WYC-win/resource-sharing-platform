# -*- coding: utf-8 -*-
"""清理本程序遗留的 WebView2 孤儿进程。

只杀命令行里带 CugbShare 用户数据目录的 msedgewebview2.exe，
避免误伤 Edge、Office、Windows 小组件等其它使用 WebView2 的程序。
"""

import collections
import json
import os
import re
import subprocess

PS = r"""
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
  Select-Object ProcessId, ParentProcessId, CommandLine |
  ConvertTo-Json -Compress -Depth 3
"""

r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", PS],
                   capture_output=True, text=True, errors="ignore")
raw = (r.stdout or "").strip()
if not raw:
    print("查询失败:", (r.stderr or "").strip()[:200])
    raise SystemExit(1)

data = json.loads(raw)
if isinstance(data, dict):
    data = [data]

mark = os.path.join(os.environ.get("LOCALAPPDATA", ""), "CugbShare").lower()

# ── 先审计：看清楚这些进程分别属于谁，别误伤 ──────────────────────────
types = collections.Counter()
owners = collections.Counter()
for p in data:
    cmd = p.get("CommandLine") or ""
    m = re.search(r"--type=([a-z]+)", cmd)
    types[m.group(1) if m else "browser(主)"] += 1
    u = re.search(r'--user-data-dir=(?:"([^"]+)"|(\S+))', cmd)
    owners[(u.group(1) or u.group(2)) if u else "(子进程未指定)"] += 1

print("WebView2 进程总数:", len(data))
print("按类型:", dict(types))
print("按用户数据目录:")
for k, v in owners.most_common(8):
    print(f"  {v:>2} 个  {k}{'   ← 本程序' if mark and mark in k.lower() else ''}")

mine = [p for p in data if mark and mark in (p.get("CommandLine") or "").lower()]
print(f"\n属于本程序(CugbShare)的: {len(mine)}")

if not mine:
    print("✅ 没有本程序的残留进程（其余都是 Edge / Office / 小组件等在用）")
    raise SystemExit(0)

alive = set()
r2 = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="ignore")
for line in r2.stdout.splitlines():
    parts = [x.strip('" ') for x in line.split('","')]
    if len(parts) >= 2 and parts[1].isdigit():
        alive.add(parts[1])

killed = 0
for p in mine:
    pid = str(p["ProcessId"])
    ppid = str(p.get("ParentProcessId") or "")
    tag = "孤儿" if ppid not in alive else f"父进程 {ppid} 仍在"
    r3 = subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, text=True, errors="ignore")
    ok = "成功" in (r3.stdout + r3.stderr)
    killed += 1 if ok else 0
    print(f"  PID {pid:>7}  {tag}  -> {'已结束' if ok else '结束失败'}")

print(f"\n共结束 {killed} 个")

