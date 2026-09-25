# -*- coding: utf-8 -*-
"""用系统 Edge 无头模式给 _preview.html 截图（via WMI，避开沙箱 DLL 注入）。"""

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
HTML = HERE / "_preview.html"
OUT = HERE / "_preview.png"

EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]
EDGE = next((p for p in EDGE_CANDIDATES if os.path.exists(p)), None)
if not EDGE:
    print("找不到 Edge/Chrome")
    sys.exit(1)

if not HTML.exists():
    print("先跑 python _preview_ui.py 生成 _preview.html")
    sys.exit(1)

if OUT.exists():
    OUT.unlink()

profile = Path(tempfile.mkdtemp(prefix="edge_shot_"))
W, H = 500, 900

base = [
    f'"{EDGE}"',
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    f"--user-data-dir={profile}",
    f"--window-size={W},{H}",
    f'--screenshot="{OUT}"',
    HTML.as_uri(),
]
cmdline = " ".join(base)

print("Edg:", EDGE)
print("URL:", HTML.as_uri())

script = ("$p = Invoke-CimMethod -ClassName Win32_Process -MethodName Create "
          f"-Arguments @{{ CommandLine = '{cmdline}' }}; $p.ProcessId")
r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                   capture_output=True, text=True, errors="ignore")
print("启动:", (r.stdout or r.stderr).strip()[:200])

for _ in range(30):
    time.sleep(1)
    if OUT.exists() and OUT.stat().st_size > 0:
        time.sleep(1)   # 等写完
        break

if OUT.exists():
    from PIL import Image
    im = Image.open(OUT)
    print(f"\n✅ 截图完成: {OUT}  {im.size}  {OUT.stat().st_size} 字节")
else:
    print("\n❌ 没拿到截图")
