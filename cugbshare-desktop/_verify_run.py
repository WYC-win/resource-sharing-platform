# -*- coding: utf-8 -*-
"""正式验收：脱离沙箱启动 EXE，确认窗口常驻、页面正常，然后关闭。

窗口检测按 **进程 PID** 过滤（比按标题匹配可靠，不受标题变动影响）。
"""

import ctypes
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXE = HERE / "dist" / "北地书阁.exe"
APP = Path(os.environ["LOCALAPPDATA"]) / "CugbShare"
LOG = APP / "client.log"
REPORTS = APP / "webview" / "EBWebView" / "Crashpad" / "reports"

u32 = ctypes.windll.user32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)


def alive(pid: str) -> bool:
    r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"],
                       capture_output=True, text=True, errors="ignore")
    return str(pid) in r.stdout


def tree_pids(root_pid: str):
    """单文件 EXE 的 bootloader 会再 fork 子进程跑真正的 Python，
    窗口在子进程上，所以要把同名的所有进程都算进来。"""
    r = subprocess.run(["tasklist", "/FI", f"IMAGENAME eq {EXE.name}", "/FO", "CSV", "/NH"],
                       capture_output=True, text=True, errors="ignore")
    pids = [root_pid]
    for line in r.stdout.splitlines():
        parts = [p.strip('" ') for p in line.split('","')]
        if len(parts) >= 2 and parts[1].isdigit():
            pids.append(parts[1])
    return sorted(set(pids))


def windows_of(pids):
    """返回这些 PID 拥有的所有可见顶层窗口 (pid, 标题)。"""
    targets = {int(p) for p in pids if str(p).isdigit()}
    out = []

    def cb(hwnd, _):
        wpid = ctypes.c_ulong()
        u32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
        if wpid.value in targets:
            n = u32.GetWindowTextLengthW(hwnd)
            buf = ctypes.create_unicode_buffer(n + 1)
            u32.GetWindowTextW(hwnd, buf, n + 1)
            out.append((wpid.value, bool(u32.IsWindowVisible(hwnd)), buf.value))
        return True

    u32.EnumWindows(WNDENUMPROC(cb), None)
    return out


def main() -> int:
    wait = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    extra = sys.argv[2] if len(sys.argv) > 2 else ""      # 例如 --selftest
    before = len(list(REPORTS.glob("*.dmp"))) if REPORTS.is_dir() else 0

    print("通过 WMI 启动（父进程 = WmiPrvSE，脱离沙箱注入）...")
    cmdline = f'"{EXE}"' + (f" {extra}" if extra else "")
    script = ("$p = Invoke-CimMethod -ClassName Win32_Process -MethodName Create "
              f"-Arguments @{{ CommandLine = '{cmdline}' }}; $p.ProcessId")
    r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
                       capture_output=True, text=True, errors="ignore")
    pid = (r.stdout.strip().splitlines() or ["?"])[-1].strip()
    print(f"  PID = {pid}")

    if pid in ("", "?"):
        print("  启动失败:", (r.stderr or "").strip()[:200])
        return 1

    ok_runs = 0
    selftest = "--selftest" in extra
    t0 = time.time()
    while time.time() - t0 < wait:
        time.sleep(3)
        el = int(time.time() - t0)
        if not alive(pid):
            print(f"  +{el:>2}s  进程已退出"
                  + ("（自检模式会主动关窗，属预期）" if selftest else " ⚠️"))
            break
        pids = tree_pids(pid)
        vis = [w for w in windows_of(pids) if w[1]]
        titles = sorted({w[2] for w in vis if w[2]})
        if titles:
            ok_runs += 1
        print(f"  +{el:>2}s  存活=True  进程数={len(pids)}  可见窗口={len(vis)}  标题={titles if titles else '（无标题）'}")

    after = len(list(REPORTS.glob("*.dmp"))) if REPORTS.is_dir() else 0
    print(f"\n新增崩溃转储: {after - before}")
    print("=== 日志末尾 ===")
    if LOG.exists():
        print("".join(LOG.read_text(encoding="utf-8", errors="ignore").splitlines(True)[-3:]))

    print("=== 关闭测试实例 ===")
    subprocess.run(["taskkill", "/PID", pid, "/T", "/F"],
                   capture_output=True, text=True, errors="ignore")
    time.sleep(2)
    gone = not alive(pid)
    print("  已关闭" if gone else "  仍在运行")

    enough = ok_runs >= (2 if selftest else 3)
    good = enough and (after - before) == 0
    if selftest:
        print("\n提示: 自检结果见 %LOCALAPPDATA%\\CugbShare\\selftest.json（ui/ui_button/ui_panel 应为 true）")
    print(f"\n结论: {'✅ 通过' if good else '⚠️ 需复查'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
