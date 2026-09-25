# -*- coding: utf-8 -*-
"""
打包脚本：把 app.py 打成免安装单文件 EXE。

用法：
    python build.py

产物：
    dist/北地书阁.exe
"""

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXE_NAME = "北地书阁"

# 采集进来的运行时依赖（pywebview 的 WebView2 后端需要 pythonnet/clr）
HIDDEN = [
    "webview.platforms.edgechromium",
    "webview.platforms.winforms",
    "clr_loader",
    "pythonnet",
]

# 运行时用不到、体积又大的模块，排除掉能显著减小 EXE
EXCLUDES = [
    "tkinter",
    "unittest",
    "pydoc",
    "doctest",
    "test",
    "xmlrpc",
    "pdb",
    "difflib",
    "numpy",
    "PIL",
    "PyInstaller",
    "setuptools",
    "pip",
]


def _clear_workdir(p: Path) -> None:
    """清中间产物。注意：某些环境会给删除操作挂安全钩子（走回收站），
    对 exe 这类文件可能失败；失败不影响打包（PyInstaller 会覆盖），所以吞掉异常。"""
    try:
        shutil.rmtree(p, ignore_errors=True)
    except Exception:
        pass
    if p.exists():
        print(f"提示: {p.name}/ 未能清空（可能被安全删除策略挡住），交给 PyInstaller 覆盖")


def main() -> int:
    icon = HERE / "icon.ico"
    if not icon.exists():
        print(f"缺少图标文件：{icon}", file=sys.stderr)
        return 1

    ui_js = HERE / "ui.js"
    if not ui_js.exists():
        print(f"缺少注入脚本：{ui_js}", file=sys.stderr)
        return 1

    # 只清中间目录，不动 dist/ —— 避免删除旧 EXE 时被安全钩子拦下导致打包中断
    _clear_workdir(HERE / "build")
    (HERE / "dist").mkdir(exist_ok=True)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean",
        "--onefile",          # 单文件免安装
        "--windowed",         # 不弹控制台窗口
        "--name", EXE_NAME,
        "--icon", str(icon),
        "--add-data", f"{icon};.",
        "--add-data", f"{ui_js};.",
        "--specpath", str(HERE),
        "--workpath", str(HERE / "build"),
        "--distpath", str(HERE / "dist"),
    ]
    for m in HIDDEN:
        cmd += ["--hidden-import", m]
    for m in EXCLUDES:
        cmd += ["--exclude-module", m]
    cmd.append(str(HERE / "app.py"))

    print("执行:", " ".join(cmd), flush=True)
    rc = subprocess.call(cmd, cwd=str(HERE))
    if rc != 0:
        print(f"\n打包失败，退出码 {rc}", file=sys.stderr)
        return rc

    exe = HERE / "dist" / f"{EXE_NAME}.exe"
    if not exe.exists():
        print("\n未找到产物 EXE", file=sys.stderr)
        return 1
    print(f"\n✅ 打包完成：{exe}")
    print(f"   大小：{exe.stat().st_size / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
