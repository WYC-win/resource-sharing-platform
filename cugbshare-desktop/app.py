# -*- coding: utf-8 -*-
"""
北地书阁 · 桌面客户端
=====================

一个极轻量的 Windows 桌面壳：用系统自带的 WebView2 渲染
https://cugbshare.asia，所有数据都读写 N1 服务器，与网页端完全同源同账号。

设计要点
--------
* 登录态存 localStorage -> 通过 WebView2 持久化用户目录保留，关掉再开无需重新登录
* 站点前端用 window.open(url) 触发下载 / 预览，这里统一接管：
    - /download  -> 本程序下载（可选保存位置，带实时进度/取消/重试）
    - /preview   -> 交给系统浏览器（PDF 用浏览器内置阅读器渲染最稳）
    - 其它       -> 交给系统浏览器
* 下载进度通过注入的悬浮面板实时显示（见 ui.js）
* Ctrl+R / F5 刷新；单实例运行，重复启动会激活已有窗口
"""

from __future__ import annotations

import ctypes
import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from collections import OrderedDict
from pathlib import Path

import webview

# ────────────────────────────── 基本配置 ──────────────────────────────

APP_NAME = "北地书阁"
APP_ID = "CugbShare"
SITE_URL = "https://cugbshare.asia"
SITE_ORIGIN = "https://cugbshare.asia"
WINDOW_W, WINDOW_H = 1280, 840
WINDOW_MIN = (960, 640)

# 站点在 Cloudflare 后面，裸请求会被拦（error code: 1010），必须带浏览器 UA
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
)

SELFTEST = "--selftest" in sys.argv
SELFTEST_DELAY = 6.0
PUSH_INTERVAL = 0.2           # 进度推送到页面的间隔（秒）
CHUNK = 64 * 1024             # 单次读取上限；配合 read1 保证进度能实时刷新
MAX_ATTEMPTS = 3              # 中途断流时自动重试的次数（站点公网链路不稳）


# ────────────────────────────── 目录与日志 ──────────────────────────────

def app_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home())
    d = Path(base) / APP_ID
    d.mkdir(parents=True, exist_ok=True)
    return d


def bundled_path(name: str) -> Path:
    """取随程序一起打包的资源：PyInstaller 单文件模式解压在 sys._MEIPASS。"""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        p = Path(base) / name
        if p.exists():
            return p
    return Path(__file__).resolve().parent / name


APP_DIR = app_dir()
STORAGE_DIR = APP_DIR / "webview"
LOG_PATH = APP_DIR / "client.log"
SETTINGS_PATH = APP_DIR / "settings.json"
ICON_PATH = bundled_path("icon.ico")
UI_JS_PATH = bundled_path("ui.js")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stderr),
    ],
)
log = logging.getLogger("cugbshare")

window: webview.Window | None = None


# ────────────────────────────── 系统目录 ──────────────────────────────

def default_downloads_dir() -> Path:
    """取系统「下载」文件夹，取不到就退回 ~/Downloads。"""
    try:
        import winreg

        key = r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key) as k:
            p = winreg.QueryValueEx(k, "{374DE290-123F-4565-9164-39C4925E467B}")[0]
        if p and os.path.isdir(p):
            return Path(p)
    except Exception:
        log.debug("读取下载目录失败，退回默认路径", exc_info=True)
    p = Path.home() / "Downloads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def app_hwnd() -> int:
    """主窗口句柄，用于给原生对话框指定 owner（否则对话框会跑到窗口后面）。"""
    try:
        return ctypes.windll.user32.FindWindowW(None, APP_NAME) or 0
    except Exception:
        return 0


def pick_folder(title: str = "选择下载保存位置", initial: str | None = None) -> str | None:
    """
    弹出原生「选择文件夹」对话框（Win32 SHBrowseForFolderW）。

    为什么不用 pywebview 的 create_file_dialog：它内部是 WinForms 的
    dialog.ShowDialog(owner)，从 js_api 子线程调用存在跨线程风险。
    这里直接调 Win32 API，任何线程都能安全调用。

    BIF_NEWDIALOGSTYLE 需要线程已初始化 COM，所以先 CoInitializeEx。
    返回所选目录，取消返回 None。
    """
    shell32 = ctypes.windll.shell32
    ole32 = ctypes.windll.ole32

    COINIT_APARTMENTTHREADED = 0x2
    RPC_E_CHANGED_MODE = -2147417850
    hr = ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
    need_uninit = hr in (0, 1)  # S_OK / S_FALSE

    BIF_RETURNONLYFSDIRS = 0x0001
    BIF_EDITBOX = 0x0010
    BIF_NEWDIALOGSTYLE = 0x0040

    class BROWSEINFOW(ctypes.Structure):
        _fields_ = [
            ("hwndOwner", ctypes.c_void_p),
            ("pidlRoot", ctypes.c_void_p),
            ("pszDisplayName", ctypes.c_wchar_p),
            ("lpszTitle", ctypes.c_wchar_p),
            ("ulFlags", ctypes.c_uint),
            ("lpfn", ctypes.c_void_p),
            ("lParam", ctypes.c_void_p),
            ("iImage", ctypes.c_int),
        ]

    display = ctypes.create_unicode_buffer(260)
    bi = BROWSEINFOW()
    bi.hwndOwner = app_hwnd()
    bi.pszDisplayName = ctypes.cast(display, ctypes.c_wchar_p)
    bi.lpszTitle = title
    bi.ulFlags = BIF_RETURNONLYFSDIRS | BIF_EDITBOX | BIF_NEWDIALOGSTYLE

    try:
        shell32.SHBrowseForFolderW.restype = ctypes.c_void_p
        pidl = shell32.SHBrowseForFolderW(ctypes.byref(bi))
        if not pidl:
            return None  # 用户取消
        out = ctypes.create_unicode_buffer(1024)
        ok = shell32.SHGetPathFromIDListW(ctypes.c_void_p(pidl), out)
        ole32.CoTaskMemFree(ctypes.c_void_p(pidl))
        return out.value if ok and out.value else None
    finally:
        if need_uninit:
            ole32.CoUninitialize()


# ────────────────────────────── 设置持久化 ──────────────────────────────

class Settings:
    DEFAULTS = {"download_dir": "", "ask_every_time": True}

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.RLock()
        self.data = dict(self.DEFAULTS)
        self.data["download_dir"] = str(default_downloads_dir())
        self.load()

    def load(self) -> None:
        try:
            if self.path.exists():
                raw = json.loads(self.path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    self.data.update({k: v for k, v in raw.items() if k in self.DEFAULTS})
        except Exception:
            log.warning("读取设置失败，用默认值")
        d = self.data.get("download_dir") or ""
        if d and not os.path.isdir(d):
            log.info("记录的下载目录已不存在，回退默认: %s", d)
            self.data["download_dir"] = str(default_downloads_dir())

    def save(self) -> None:
        try:
            self.path.write_text(
                json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception:
            log.warning("写入设置失败", exc_info=True)

    def get(self, key: str, default=None):
        with self._lock:
            return self.data.get(key, default)

    def update(self, **kw) -> dict:
        with self._lock:
            for k, v in kw.items():
                if k in self.DEFAULTS:
                    self.data[k] = v
        self.save()
        return dict(self.data)


settings = Settings(SETTINGS_PATH)


# ────────────────────────────── 下载核心 ──────────────────────────────

class Cancelled(Exception):
    pass


class IncompleteDownload(Exception):
    """连接中途断开，只收到部分数据。

    `resp.read(n)` / `read1(n)` 在连接提前关闭时**只是返回短数据，不会报错**
    （只有不带宽度的 `read()` 才会抛 IncompleteRead）。所以必须拿 Content-Length
    自己校验，否则会把半个文件当成功保存 —— 用户点开才发现是坏的。
    """

    def __init__(self, got: int, total: int):
        self.got, self.total = got, total
        super().__init__(f"只收到 {got}/{total} 字节")


_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t]')


def sanitize_filename(name: str) -> str:
    name = _ILLEGAL.sub("_", (name or "").strip()).strip(". ")
    return name or "download"


def parse_filename(content_disposition: str | None, default: str = "") -> str:
    """解析 RFC 6266 的 Content-Disposition，优先 filename*（UTF-8）。"""
    if not content_disposition:
        return default
    m = re.search(r"filename\*\s*=\s*([^;]+)", content_disposition, re.I)
    if m:
        v = m.group(1).strip().strip('"').strip("'")
        if "''" in v:
            charset, _, rest = v.partition("''")
            try:
                return urllib.parse.unquote(rest, encoding=charset or "utf-8")
            except Exception:
                return urllib.parse.unquote(rest)
        return urllib.parse.unquote(v)
    m = re.search(r'filename\s*=\s*"([^"]*)"', content_disposition, re.I) or re.search(
        r"filename\s*=\s*([^;]+)", content_disposition, re.I
    )
    if m:
        v = m.group(1).strip().strip('"')
        try:  # 有些服务端把 UTF-8 字节直接塞进 filename=
            return v.encode("latin-1").decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            return v
    return default


def unique_path(folder: Path, name: str) -> Path:
    """同名文件自动加 (1)(2)，和浏览器行为一致。"""
    name = sanitize_filename(name)
    cand = folder / name
    if not cand.exists():
        return cand
    stem, ext = os.path.splitext(name)
    for i in range(1, 1000):
        cand = folder / f"{stem} ({i}){ext}"
        if not cand.exists():
            return cand
    return folder / f"{stem}-{int(time.time())}{ext}"


def fetch_to_folder(
    url: str,
    folder: Path | None = None,
    cancel: threading.Event | None = None,
    on_progress=None,
    timeout: int = 60,
    chunk: int = CHUNK,
) -> dict:
    """
    流式下载 url 到 folder（默认「下载」文件夹）。可脱离 GUI 单独调用。

    on_progress(got, total, name) 会被反复调用；cancel 一旦置位立即中止并清理 .part。
    """
    req = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Referer": SITE_ORIGIN + "/"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        cd = resp.headers.get("Content-Disposition")
        name = parse_filename(cd)
        if not name:
            name = os.path.basename(urllib.parse.urlparse(url).path) or "download"
        if not os.path.splitext(name)[1]:  # 没后缀就按 URL 补
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1]
            if ext:
                name += ext

        declared = resp.headers.get("Content-Length")
        total = int(declared or 0)
        # 服务端若开了压缩（Content-Encoding: gzip/deflate），Content-Length 是**压缩后**长度，
        # 而磁盘上要写的是解压后的内容。必须自己解压，否则会把压缩字节当成 PDF 存下来。
        enc = (resp.headers.get("Content-Encoding") or "").strip().lower()
        decomp = None
        if enc in ("gzip", "x-gzip", "deflate"):
            import zlib as _zlib

            # wbits=47 = 自动识别 gzip / zlib 头；个别服务端发裸 deflate，回退到 -15
            decomp = _zlib.decompressobj(47)
            log.info("响应使用 %s 压缩，将边收边解压", enc)

        dest = unique_path(folder or default_downloads_dir(), name)
        tmp = dest.with_name(dest.name + ".part")

        # 关键：必须用 read1 而不是 read(n)。
        # read(n) 会阻塞到收满 n 字节或 EOF，当 n 比文件还大时整份文件一次返回，
        # 进度回调只会触发一次 —— 界面上的进度条就会从 0% 直接跳到 100%，看着像假的。
        # read1(n) 只做一次底层读取，有多少返回多少，进度才能实时刷新。
        reader = getattr(resp, "read1", None)
        if not callable(reader):
            reader = resp.read
            chunk = min(chunk, 32 * 1024)

        got = 0        # 网络收到的字节（压缩后）
        written = 0    # 写入磁盘的字节（解压后）
        idle = 0
        try:
            with open(tmp, "wb") as f:
                while True:
                    if cancel is not None and cancel.is_set():
                        raise Cancelled()
                    block = reader(chunk)
                    if block is None:
                        # read1 在"暂时读不到数据"时可能返回 None（不是 EOF），等一下重试
                        idle += 1
                        if idle > 200:
                            raise TimeoutError("读取停滞，连接疑似已断开")
                        time.sleep(0.01)
                        continue
                    idle = 0
                    if not block:
                        break          # b"" 才是真正的 EOF
                    got += len(block)
                    data = decomp.decompress(block) if decomp else block
                    if data:
                        f.write(data)
                        written += len(data)
                        # 压缩后总大小未知（解压后才准），进度条走"滑动"形态
                        if on_progress:
                            on_progress(written, 0 if decomp else total, dest.name)

                if decomp:
                    tail = decomp.flush()
                    if tail:
                        f.write(tail)
                        written += len(tail)

            # 完整性校验：对"网络字节"比对（压缩与否都以 Content-Length 为准）
            if total and got != total:
                raise IncompleteDownload(got, total)

            os.replace(tmp, dest)
        except BaseException:
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass
            raise
    # bytes = 落盘大小（若服务端压缩过，这里比网络传输的字节数大）
    return {"ok": True, "path": str(dest), "name": dest.name,
            "bytes": written, "total": 0 if decomp else total}


def friendly_error(exc: BaseException) -> str:
    if isinstance(exc, IncompleteDownload):
        mb = 1024 * 1024
        return (f"下载中断：只收到 {exc.got/mb:.1f}/{exc.total/mb:.1f} MB。"
                "文件较大时容易中途断流，请重试")
    if isinstance(exc, urllib.error.HTTPError):
        detail = ""
        try:
            body = exc.read().decode("utf-8", "ignore")
            detail = (json.loads(body).get("message") or "").strip()
        except Exception:
            pass
        if exc.code == 401:
            return "登录已过期，请重新登录后再下载"
        if exc.code == 403:
            return detail or "没有权限下载该资源"
        if exc.code == 404:
            return "文件不存在或已被删除"
        return detail or f"服务器返回 {exc.code}"
    if isinstance(exc, urllib.error.URLError):
        return "网络连接失败，请检查网络后重试"
    if isinstance(exc, TimeoutError):
        return "下载超时，请重试"
    if isinstance(exc, PermissionError):
        return "没有写入权限，请换一个保存位置"
    if isinstance(exc, OSError):
        return f"写入失败：{exc}"
    return f"{type(exc).__name__}: {exc}"


# ────────────────────────────── 下载任务管理 ──────────────────────────────

class DownloadManager:
    """维护下载任务列表，并把状态推给页面上的悬浮面板。"""

    def __init__(self, max_keep: int = 50):
        self._lock = threading.RLock()
        self.tasks: "OrderedDict[str, dict]" = OrderedDict()
        self._seq = 0
        self._max_keep = max_keep
        self._dirty = threading.Event()
        self._stop = threading.Event()

    # ---- 内部 ----
    def _next_id(self) -> str:
        self._seq += 1
        return f"t{self._seq}"

    def _trim(self) -> None:
        """已完成的任务超过上限时，从最早清起。"""
        finished = [k for k, v in self.tasks.items() if v["state"] in ("done", "error", "cancelled")]
        while len(self.tasks) > self._max_keep and finished:
            self.tasks.pop(finished.pop(0), None)

    # ---- 对外 ----
    def snapshot(self) -> dict:
        with self._lock:
            return {
                "tasks": [
                    {k: v for k, v in t.items() if not k.startswith("_")}
                    for t in self.tasks.values()
                ],
                "settings": {
                    "ask": bool(settings.get("ask_every_time", True)),
                    "dir": settings.get("download_dir", ""),
                },
            }

    def start(self, url: str, folder: str | Path) -> dict:
        with self._lock:
            tid = self._next_id()
            task = {
                "id": tid,
                "url": url,
                "name": os.path.basename(urllib.parse.urlparse(url).path) or "下载中…",
                "dir": str(folder),
                "path": "",
                "total": 0,
                "got": 0,
                "state": "queued",     # queued / downloading / done / error / cancelled
                "error": "",
                "speed": 0.0,
                "attempt": 1,          # 第几次尝试（链路抖动会自动重试）
                "ts": time.time(),
                "_cancel": threading.Event(),
                "_t0": 0.0,
                "_g0": 0,
            }
            self.tasks[tid] = task
            self._trim()
        self._dirty.set()
        threading.Thread(target=self._run, args=(tid,), daemon=True).start()
        return {k: v for k, v in task.items() if not k.startswith("_")}

    def cancel(self, tid: str) -> bool:
        with self._lock:
            t = self.tasks.get(tid)
        if not t or t["state"] not in ("queued", "downloading"):
            return False
        t["_cancel"].set()
        log.info("请求取消下载 %s", tid)
        return True

    def retry(self, tid: str) -> dict | None:
        with self._lock:
            t = self.tasks.get(tid)
            if not t:
                return None
            url, folder = t["url"], t["dir"]
        return self.start(url, folder)

    def clear_finished(self) -> int:
        with self._lock:
            gone = [k for k, v in self.tasks.items()
                    if v["state"] in ("done", "error", "cancelled")]
            for k in gone:
                self.tasks.pop(k, None)
        if gone:
            self._dirty.set()
        return len(gone)

    def open_path(self, target: str) -> dict:
        """打开已下载的文件（用系统默认程序）。文件不在了就退回打开所在文件夹。"""
        p = Path(str(target))
        if p.is_file():
            try:
                os.startfile(str(p))  # noqa: S606
                return {"ok": True, "action": "open"}
            except OSError:
                log.warning("打开文件失败，尝试打开所在文件夹: %s", p, exc_info=True)

        folder = p if p.is_dir() else (p.parent if p.parent.is_dir() else None)
        if folder is not None:
            try:
                os.startfile(str(folder))  # noqa: S606
                return {"ok": True, "action": "folder"}
            except OSError:
                log.warning("打开文件夹失败: %s", folder, exc_info=True)
        return {"ok": False}

    def reveal_path(self, target: str) -> dict:
        """在资源管理器里定位并选中该文件。"""
        p = Path(str(target))
        if not p.exists():
            return self.open_path(target)      # 文件没了就直接开目录
        if p.is_dir():
            return self.open_path(target)
        # explorer /select 只认「单个命令行字符串」；用列表传参 Python 会给内层引号加反斜杠转义，
        # explorer 解析不了。路径里若本来就有引号则退回打开所在目录，避免命令行被注入。
        if '"' in str(p):
            return self.open_path(str(p.parent))
        try:
            subprocess.Popen(f'explorer /select,"{p}"')
            return {"ok": True, "action": "select"}
        except OSError:
            log.warning("定位文件失败: %s", p, exc_info=True)
            return {"ok": False}

    def _run(self, tid: str) -> None:
        with self._lock:
            t = self.tasks.get(tid)
        if not t:
            return

        def on_progress(got: int, total: int, name: str) -> None:
            now = time.time()
            t["got"], t["total"], t["name"] = got, total, name
            if t["state"] == "queued":
                t["state"] = "downloading"
                t["_t0"], t["_g0"] = now, 0
            span = now - t["_t0"]
            if span >= 0.5:                       # 每 0.5s 刷新一次速度
                t["speed"] = (got - t["_g0"]) / span
                t["_t0"], t["_g0"] = now, got
            self._dirty.set()

        try:
            log.info("开始下载 %s -> %s", t["url"], t["dir"])
            res = None
            for attempt in range(1, MAX_ATTEMPTS + 1):
                t["attempt"] = attempt
                try:
                    res = fetch_to_folder(t["url"], folder=Path(t["dir"]),
                                          cancel=t["_cancel"], on_progress=on_progress)
                    break
                except IncompleteDownload as exc:
                    if attempt >= MAX_ATTEMPTS:
                        raise
                    log.warning("第 %d 次下载被截断（%s），准备重试", attempt, exc)
                    t.update(got=0, speed=0.0, state="queued", error="")
                    t["_t0"], t["_g0"] = 0.0, 0
                    self._dirty.set()
                    time.sleep(1.0)
            t.update(name=res["name"], path=res["path"], got=res["bytes"],
                     total=res["total"] or res["bytes"], state="done")
            log.info("下载完成 %s (%d 字节, 第 %d 次尝试)", res["path"], res["bytes"], t["attempt"])
        except Cancelled:
            t.update(state="cancelled", error="已取消")
            log.info("下载已取消 %s", tid)
        except Exception as exc:
            t.update(state="error", error=friendly_error(exc))
            # HTTPError 是预期内的失败（404/401/403），不打完整栈，日志干净些
            log.warning("下载失败 %s: %s", t["url"], exc,
                        exc_info=not isinstance(exc, urllib.error.HTTPError))
        finally:
            t["speed"] = 0.0
            with self._lock:
                self._trim()   # 任务结束时也要裁一次，否则上限形同虚设
            self._dirty.set()

    def start_pusher(self) -> None:
        threading.Thread(target=self._push_loop, daemon=True).start()

    def _push_loop(self) -> None:
        """节流把最新状态推给页面（整体替换，避免增量顺序问题）。"""
        last = None
        while not self._stop.is_set():
            self._dirty.wait(timeout=PUSH_INTERVAL)
            self._dirty.clear()
            if window is None:
                continue
            try:
                snap = self.snapshot()
                payload = json.dumps(snap, ensure_ascii=True, sort_keys=True)
                if payload == last:
                    continue
                last = payload
                window.evaluate_js(f"window.__cugbDM && window.__cugbDM.update({payload})")
            except Exception:
                log.debug("推送下载状态失败", exc_info=True)


dm = DownloadManager()


# ────────────────────────────── 页内提示 ──────────────────────────────

def toast(msg: str, ok: bool = True) -> None:
    """页内轻提示。样式定义在 ui.js 里（window.__cugbToast）。"""
    if window is None:
        return
    try:
        window.evaluate_js(
            f"window.__cugbToast && window.__cugbToast("
            f"{json.dumps(msg, ensure_ascii=True)}, {str(ok).lower()})"
        )
    except Exception:
        log.debug("页内提示失败", exc_info=True)


# ────────────────────────────── JS 桥 ──────────────────────────────

class Bridge:
    """暴露给网页的接口（window.pywebview.api.*），运行在子线程。"""

    def log(self, msg) -> None:
        log.info("[js] %s", msg)

    def open_external(self, url) -> bool:
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            log.info("交给系统浏览器: %s", url)
            webbrowser.open(url)
            return True
        return False

    def get_state(self) -> dict:
        return dm.snapshot()

    def download(self, url) -> dict:
        """接管 window.open：先决定保存位置，再排入下载队列。"""
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            return {"ok": False, "error": "无效的下载地址"}

        folder = settings.get("download_dir") or str(default_downloads_dir())
        if settings.get("ask_every_time", True):
            picked = pick_folder("选择保存位置", folder)
            if not picked:
                log.info("用户取消了保存位置选择")
                return {"ok": False, "cancelled": True}
            folder = picked
            settings.update(download_dir=folder)

        task = dm.start(url, folder)
        dm._dirty.set()
        return {"ok": True, "id": task["id"], "name": task["name"], "dir": str(folder)}

    def cancel(self, tid) -> bool:
        return dm.cancel(str(tid))

    def retry(self, tid) -> dict:
        t = dm.retry(str(tid))
        if not t:
            return {"ok": False, "error": "任务不存在"}
        dm._dirty.set()
        return {"ok": True, "id": t["id"]}

    def clear_finished(self) -> int:
        return dm.clear_finished()

    def open_path(self, target) -> dict:
        return dm.open_path(str(target))

    def reveal_path(self, target) -> dict:
        return dm.reveal_path(str(target))

    def open_dir(self) -> dict:
        d = settings.get("download_dir")
        return dm.open_path(d) if d else {"ok": False}

    def pick_dir(self) -> dict:
        """手动指定默认保存位置。"""
        cur = settings.get("download_dir")
        picked = pick_folder("选择默认保存位置", cur)
        if not picked:
            return {"ok": False, "cancelled": True}
        settings.update(download_dir=picked)
        dm._dirty.set()
        return {"ok": True, "dir": picked}

    def set_ask(self, flag) -> dict:
        v = bool(flag)
        settings.update(ask_every_time=v)
        dm._dirty.set()
        return {"ok": True, "ask": v}


# ────────────────────────────── 自检 / 单实例 ──────────────────────────────

def install_ui() -> None:
    global window
    if window is None:
        return
    try:
        js = UI_JS_PATH.read_text(encoding="utf-8")
    except Exception:
        log.warning("读取 ui.js 失败，回退到最小注入脚本", exc_info=True)
        js = "window.__cugbDM=window.__cugbDM||{update:function(){}};true;"
    try:
        window.evaluate_js(js)
        window.evaluate_js(
            "window.__cugbDM && window.__cugbDM.update("
            + json.dumps(dm.snapshot(), ensure_ascii=True, sort_keys=True) + ")"
        )
        log.info("UI 注入脚本已生效")
    except Exception:
        log.warning("UI 注入失败", exc_info=True)


def run_selftest() -> None:
    time.sleep(SELFTEST_DELAY)
    out = {}
    probes = {
        "title": "document.title",
        "url": "location.href",
        "has_dom": "!!document.querySelector('#app, form, input, .el-container')",
        "bridge": "!!(window.pywebview && window.pywebview.api)",
        "ui": "!!window.__cugbDM",
        "ui_button": "!!document.getElementById('__cugb_fab')",
        "ui_panel": "!!document.getElementById('__cugb_dm')",
        "has_localStorage": "typeof localStorage !== 'undefined'",
    }
    for k, js in probes.items():
        try:
            out[k] = window.evaluate_js(js)
        except Exception as exc:
            out[k] = f"ERR {exc!r}"
    try:
        out["bridge_methods"] = window.evaluate_js(
            "Object.keys((window.pywebview&&window.pywebview.api)||{}).join(',')"
        )
    except Exception as exc:
        out["bridge_methods"] = f"ERR {exc!r}"
    try:
        out["state"] = window.evaluate_js("JSON.stringify(window.__cugbDM.getState&&window.__cugbDM.getState())")
    except Exception as exc:
        out["state"] = f"ERR {exc!r}"
    try:
        (APP_DIR / "selftest.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception:
        log.exception("写入自检结果失败")
    log.info("自检结果: %s", json.dumps(out, ensure_ascii=False)[:800])
    try:
        window.destroy()
    except Exception:
        pass


def acquire_single_instance() -> bool:
    """返回 True 表示本进程是唯一实例。"""
    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW(None, False, "Local\\CugbShareDesktopClient")
    return kernel32.GetLastError() != 183  # ERROR_ALREADY_EXISTS


def activate_existing_window() -> bool:
    user32 = ctypes.windll.user32
    hwnd = user32.FindWindowW(None, APP_NAME)
    if not hwnd:
        time.sleep(0.4)
        hwnd = user32.FindWindowW(None, APP_NAME)
    if hwnd:
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.SetForegroundWindow(hwnd)
        log.info("已激活已有窗口: %s", hwnd)
        return True
    log.warning("已有实例在运行，但未找到窗口")
    return False


def message_box(text: str, title: str = APP_NAME, flags: int = 0x10) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(None, text, title, flags)
    except Exception:
        pass


# ────────────────────────────── 入口 ──────────────────────────────

def main() -> int:
    global window

    if not SELFTEST and not acquire_single_instance():
        activate_existing_window()
        return 0

    log.info("启动 %s | 站点=%s | 数据目录=%s", APP_NAME, SITE_URL, APP_DIR)

    webview.settings["ALLOW_DOWNLOADS"] = True          # 兜底：任何 WebView 内下载都放行
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
    webview.settings["IGNORE_SSL_ERRORS"] = False

    try:
        window = webview.create_window(
            APP_NAME,
            SITE_URL,
            width=WINDOW_W,
            height=WINDOW_H,
            min_size=WINDOW_MIN,
            js_api=Bridge(),
            text_select=True,
            zoomable=True,
            background_color="#F7F8FA",
        )
    except Exception as exc:
        log.exception("创建窗口失败")
        message_box(
            "无法创建窗口，可能是系统缺少 WebView2 运行库。\n\n"
            "请安装「Microsoft Edge WebView2 Runtime」后重试：\n"
            "https://developer.microsoft.com/microsoft-edge/webview2/\n\n"
            f"错误信息：{exc}",
            f"{APP_NAME} 启动失败",
        )
        return 1

    window.events.loaded += install_ui
    if SELFTEST:
        window.events.loaded += lambda: threading.Thread(target=run_selftest, daemon=True).start()

    dm.start_pusher()

    icon = str(ICON_PATH) if ICON_PATH.exists() else None
    try:
        webview.start(
            private_mode=False,               # 必须：否则 localStorage 不持久，每次都要重新登录
            storage_path=str(STORAGE_DIR),
            icon=icon,
            debug=False,
        )
    except Exception as exc:
        log.exception("启动失败")
        message_box(f"{APP_NAME} 启动失败：\n{exc}", f"{APP_NAME} 启动失败")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
