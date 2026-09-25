# -*- coding: utf-8 -*-
"""测 N1 <-> 本机 的传输速度（走 Tailscale/SSH），决定"本地压缩再传回"是否可行。

用 /dev/zero 生成测试流，不碰服务器上任何真实文件。
"""

import subprocess
import time

SSH = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20",
       "-o", "StrictHostKeyChecking=no", "-i", r"C:\Users\WYC\.ssh\id_rsa",
       "root@100.72.161.48"]
MB = 2


def run(cmd, label, stdin_pipe=b"", timeout=600):
    t0 = time.time()
    r = subprocess.run(cmd, input=stdin_pipe, capture_output=True, timeout=timeout)
    el = time.time() - t0
    n = len(r.stdout)
    mbps = n / 1048576 / el if el > 0 else 0
    print(f"  {label}")
    print(f"    传输 {n/1048576:.1f} MB   耗时 {el:.1f}s   {mbps:.2f} MB/s")
    if r.returncode != 0:
        print(f"    退出码 {r.returncode}  stderr: {r.stderr.decode('utf-8', 'ignore')[:200]}")
    return mbps


print(f"=== 服务器 → 本机（下行，{MB}MB 测试流）===")
down = run(SSH + [f"dd if=/dev/zero bs=1M count={MB} 2>/dev/null"], "下行")

print(f"\n=== 本机 → 服务器（上行，{MB}MB 测试流）===")
zeros = b"\0" * (MB * 1048576)
up = run(SSH + ["cat > /tmp/_speedtest.bin; sync; rm -f /tmp/_speedtest.bin; echo ok"],
         "上行", stdin_pipe=zeros)

print(f"""
=== 结论 ===
  以 28 KB/s 的公网速度为准：1 GB 要 ~10 小时
  实测 SSH 通道：下行 {down:.2f} MB/s，上行 {up:.2f} MB/s
  按此速度处理 1 GB 数据（下行 1GB + 上行 0.3GB）：
    约 {(1024/down + 307/up)/60:.1f} 分钟
""")
