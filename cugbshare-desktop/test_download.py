# -*- coding: utf-8 -*-
"""脱离 GUI 验证 app.py 的下载与文件名解析逻辑。"""

import http.server
import json
import os
import socketserver
import sys
import tempfile
import threading
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app  # noqa: E402

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"   {extra}" if extra else ""))


# ── 1) Content-Disposition 解析 ────────────────────────────────────────────
print("\n=== 1) Content-Disposition 解析 ===")
cn = "概率论与数理统计 2021年真题.pdf"
utf8_q = urllib.parse.quote(cn)
cases = [
    (f"attachment; filename=resource.pdf; filename*=UTF-8''{utf8_q}", cn),
    ('attachment; filename="plain name.pdf"', "plain name.pdf"),
    ("attachment; filename=no_quotes.docx", "no_quotes.docx"),
    (None, ""),
]
for cd, want in cases:
    got = app.parse_filename(cd)
    check(f"解析 {str(cd)[:52]!r}", got == want, f"-> {got!r}")

# 服务端把 UTF-8 字节直接塞进 filename= 的情况（latin-1 解码成乱码再还原）
mojibake = "attachment; filename=" + cn.encode("utf-8").decode("latin-1")
check("还原 latin-1 乱码的 filename=", app.parse_filename(mojibake) == cn,
      f"-> {app.parse_filename(mojibake)!r}")

# ── 2) 文件名清洗 ──────────────────────────────────────────────────────────
print("\n=== 2) 文件名清洗 ===")
check("剔除路径分隔符", "/" not in app.sanitize_filename("a/b\\c.pdf"))
check("空名有兜底", app.sanitize_filename("   ") == "download")

# ── 3) 重名自动加序号 ──────────────────────────────────────────────────────
print("\n=== 3) 重名处理 ===")
with tempfile.TemporaryDirectory() as td:
    d = Path(td)
    (d / "x.pdf").write_bytes(b"1")
    (d / "x (1).pdf").write_bytes(b"1")
    got = app.unique_path(d, "x.pdf")
    check("已存在时顺延为 x (2).pdf", got.name == "x (2).pdf", f"-> {got.name}")

# ── 4) 端到端下载（本地服务，中文文件名 + 分块流）─────────────────────────
print("\n=== 4) 端到端下载（本地 mock 服务）===")
PAYLOAD = bytes(range(256)) * 4096  # 1 MiB
CD_NAME = "高等数学（上） 2020-2021 学年期末试卷.pdf"


FLAKY = {"n": 0}          # /flaky 用：第一次截断，第二次完整
# /gz 用：随机数据（压不动，所以 gzip 后仍是 ~1MB，能产生多次读取）
GZ_PAYLOAD = os.urandom(1_000_000)


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/gz"):
            import gzip as _gzip
            body = _gzip.compress(GZ_PAYLOAD)
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Disposition", 'attachment; filename="gz.pdf"')
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith("/flaky"):
            FLAKY["n"] += 1
            first = FLAKY["n"] % 2 == 1          # 第 1、3… 次故意截断
            size = 200000
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition", 'attachment; filename="flaky.bin"')
            self.end_headers()
            try:
                self.wfile.write(b"\0" * (size // 2 if first else size))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            if first:
                self.close_connection = True
        elif self.path.startswith("/file"):
            cd = f"attachment; filename=resource.pdf; filename*=UTF-8''{urllib.parse.quote(CD_NAME)}"
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Length", str(len(PAYLOAD)))
            self.send_header("Content-Disposition", cd)
            self.end_headers()
            self.wfile.write(PAYLOAD)
        elif self.path.startswith("/short"):
            # 声明 100KB 却只发 50KB 就断开 —— 模拟网络中途断流。
            # read/read1 遇到这种情况只是"返回短数据"，不会报错，所以必须靠 Content-Length 校验。
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", "100000")
            self.send_header("Content-Disposition", 'attachment; filename="truncated.bin"')
            self.end_headers()
            try:
                self.wfile.write(b"\0" * 50000)
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            self.close_connection = True
        elif self.path.startswith("/small"):
            # 总量故意小于客户端单次读取上限(256KB)，且慢慢吐 —— 用来回归
            # "read(n) 会阻塞到收满 n 字节，导致进度回调只触发一次" 这个 bug
            n, size, delay = 20, 10240, 0.05      # 200KB，约 1 秒
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(n * size))
            self.send_header("Content-Disposition", 'attachment; filename="small.bin"')
            self.end_headers()
            try:
                for _ in range(n):
                    self.wfile.write(b"\0" * size)
                    self.wfile.flush()
                    time.sleep(delay)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif self.path.startswith("/slow"):
            # 慢速分块，用来测「下载中取消」
            n, size, delay = 20, 65536, 0.1
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(n * size))
            self.send_header("Content-Disposition", 'attachment; filename="slow.bin"')
            self.end_headers()
            try:
                for _ in range(n):
                    self.wfile.write(b"\0" * size)
                    self.wfile.flush()
                    time.sleep(delay)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif self.path.startswith("/redirect"):
            self.send_response(302)
            self.send_header("Location", "/file")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *a):
        pass


srv = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{port}"

with tempfile.TemporaryDirectory() as td:
    dl = Path(td)
    progress = []
    res = app.fetch_to_folder(f"{base}/file", folder=dl, chunk=65536,
                              on_progress=lambda n, t, nm: progress.append(n))

    check("下载成功", res["ok"], json.dumps({k: res[k] for k in ("name", "bytes")}, ensure_ascii=False))
    check("中文文件名正确落地", res["name"] == CD_NAME, f"-> {res['name']!r}")
    check("文件真实存在", Path(res["path"]).exists())
    check("字节数一致", Path(res["path"]).read_bytes() == PAYLOAD,
          f"{Path(res['path']).stat().st_size} vs {len(PAYLOAD)}")
    check("进度回调被调用", len(progress) > 1, f"{len(progress)} 次")
    check("无 .part 残留", not list(dl.glob("*.part")))

    # 重名再下一次
    res2 = app.fetch_to_folder(f"{base}/file", folder=dl)
    check("第二次下载自动改名", res2["name"] != CD_NAME, f"-> {res2['name']!r}")

    # 跟随 302（Office 预览跳转下载就是这个形态）
    res3 = app.fetch_to_folder(f"{base}/redirect", folder=dl)
    check("跟随 302 重定向", res3["ok"] and Path(res3["path"]).exists())

    # 404 的错误提示
    try:
        app.fetch_to_folder(f"{base}/missing", folder=dl)
        check("404 应抛错", False)
    except Exception as exc:
        msg = app.friendly_error(exc)
        check("404 提示友好", "不存在" in msg, f"-> {msg}")

# ── 4b) 回归：文件比读取块还小时，进度必须多次回调 ────────────────────────
# 曾经的问题：用 resp.read(256*1024) 会阻塞到收满 256KB 或 EOF，
# 200KB 的文件一次读完 -> 进度回调只触发 1 次 -> 界面上进度条 0% 直接跳 100%（"假进度条"）
print("\n=== 4b) 小文件进度回调次数（read1 回归）===")
with tempfile.TemporaryDirectory() as td:
    ev = []
    res_s = app.fetch_to_folder(f"{base}/small", folder=Path(td), chunk=256 * 1024,
                                on_progress=lambda g, t, n: ev.append(g))
    check("小文件下载完整", res_s["bytes"] == 20 * 10240, str(res_s["bytes"]))
    check("总大小解析正确", res_s["total"] == 20 * 10240, str(res_s["total"]))
    check("进度回调 >= 5 次（旧实现只有 1 次）", len(ev) >= 5, f"{len(ev)} 次")
    check("回调字节数单调递增", ev == sorted(ev), str(ev[:6]))

# 注意：mock 服务要留到第 6 节的任务管理测试用完再关

# ── 4c) 回归：中途断流必须报错，绝不能当成功 ──────────────────────────────
# 曾经的问题：只校验"读到 EOF 就结束"，把 Content-Length 当摆设，
# 结果半个文件被当成「完成」保存下来，用户点开才发现打不开。
print("\n=== 4c) 中途断流必须报错（完整性校验回归）===")
with tempfile.TemporaryDirectory() as td:
    dl = Path(td)
    try:
        app.fetch_to_folder(f"{base}/short", folder=dl)
        check("声明长度 > 实收时应抛错", False, "居然当成功了")
    except app.IncompleteDownload as e:
        check("抛出 IncompleteDownload", True)
        check("报告实收字节", e.got == 50000, str(e.got))
        check("报告声明长度", e.total == 100000, str(e.total))
        msg = app.friendly_error(e)
        check("错误提示可读", "中断" in msg and "MB" in msg, msg)
    except Exception as e:
        check("抛出 IncompleteDownload", False, f"抛的是 {type(e).__name__}: {e}")
    time.sleep(0.2)
    check("不留 .part 残留", not list(dl.glob("*.part")),
          str([p.name for p in dl.glob("*.part")]))
    check("不留半成品文件", not (dl / "truncated.bin").exists())

# ── 4d) 回归：服务端 gzip 压缩时必须自己解压 ──────────────────────────────
# 曾经的隐患：只判断了 Content-Encoding 就跳过长度校验，但仍把**压缩后的字节**写进磁盘，
# 一旦服务端开启 gzip，用户拿到的 .pdf 其实是 gzip 数据，打不开。
print("\n=== 4d) 服务端 gzip 时必须边收边解压（回归）===")
with tempfile.TemporaryDirectory() as td:
    dl = Path(td)
    ev = []
    res = app.fetch_to_folder(f"{base}/gz", folder=dl,
                              on_progress=lambda g, t, n: ev.append((g, t)))
    on_disk = Path(res["path"]).read_bytes()
    check("落盘内容 == 原始内容（已解压）", on_disk == GZ_PAYLOAD,
          f"{len(on_disk)} vs {len(GZ_PAYLOAD)}")
    check("落盘的是原文件头，不是 gzip 头", on_disk[:4] == GZ_PAYLOAD[:4],
          f"{on_disk[:4]!r} vs {GZ_PAYLOAD[:4]!r}")
    check("报告大小 = 解压后大小", res["bytes"] == len(GZ_PAYLOAD), str(res["bytes"]))
    check("总长未知（压缩后不可知）", res["total"] == 0, str(res["total"]))
    check("进度回调多次", len(ev) > 1, f"{len(ev)} 次")
    check("进度按解压后字节单调递增",
          all(ev[i][0] < ev[i + 1][0] for i in range(len(ev) - 1)) and ev[-1][0] == len(GZ_PAYLOAD),
          f"首次={ev[0][0]} 末次={ev[-1][0]}")
    check("不把压缩后长度当总数（避免百分比虚高）", all(t == 0 for _, t in ev))

# ── 5) 真实站点 · 未授权路径 ─────────────────────────────────────────────
print("\n=== 5) 真实站点 · 未授权路径 ===")
try:
    app.fetch_to_folder("https://cugbshare.asia/api/v1/resources/1/download",
                        folder=Path(tempfile.gettempdir()))
    check("未授权应失败", False)
except Exception as exc:
    msg = app.friendly_error(exc)
    check("未授权提示友好", "登录" in msg or "权限" in msg, f"-> {msg}")

# ── 6) 下载任务管理（DownloadManager）─────────────────────────────────────
print("\n=== 6) 下载任务管理 ===")


def wait_state(tid, want, timeout=15.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        snap = app.dm.snapshot()
        for t in snap["tasks"]:
            if t["id"] == tid and t["state"] in want:
                return t
        time.sleep(0.05)
    return None


with tempfile.TemporaryDirectory() as td:
    # 隔离设置：临时把单例的落盘路径指到临时文件，避免污染用户真实配置
    real_settings_path = app.settings.path
    app.settings.path = Path(td) / "_test_settings.json"
    try:
        app.settings.update(download_dir=td, ask_every_time=False)

        # 正常完成
        task = app.dm.start(f"{base}/file", td)
        check("start 返回 queued 状态", task["state"] == "queued", task["state"])
        done = wait_state(task["id"], ("done", "error"))
        check("任务最终完成", done and done["state"] == "done", done["state"] if done else "超时")
        check("文件名回填为中文原名", done and done["name"] == CD_NAME, done["name"] if done else "")
        check("落盘路径存在", done and Path(done["path"]).exists())
        check("字节数正确", done and done["got"] == len(PAYLOAD), str(done["got"]) if done else "")
        check("total 已填充", done and done["total"] == len(PAYLOAD))
        check("完成后 speed 归零", done and done["speed"] == 0.0)

        # snapshot 不应泄漏内部字段
        check("snapshot 不含下划线内部字段",
              all(not k.startswith("_") for t in app.dm.snapshot()["tasks"] for k in t))

        # 重试
        r = app.dm.retry(done["id"])
        check("retry 生成新任务", r and r["id"] != done["id"], r["id"] if r else "")
        wait_state(r["id"], ("done", "error"))
        check("重试后重名自动加序号", any("(1)" in t["name"] for t in app.dm.snapshot()["tasks"]))

        # 下载中取消
        slow = app.dm.start(f"{base}/slow", td)
        time.sleep(0.35)
        mid = wait_state(slow["id"], ("downloading",))
        check("慢速下载进入 downloading", mid is not None)
        check("取消前进度 > 0", mid and mid["got"] > 0, str(mid["got"]) if mid else "")
        check("cancel 返回 True", app.dm.cancel(slow["id"]) is True)
        cancelled = wait_state(slow["id"], ("cancelled",), timeout=10)
        check("任务变为 cancelled", cancelled is not None, cancelled["state"] if cancelled else "超时")
        time.sleep(0.3)
        check("取消后不留 .part 残留", not list(Path(td).glob("*.part")),
              str([p.name for p in Path(td).glob("*.part")]))
        check("取消后不留 slow.bin", not (Path(td) / "slow.bin").exists())

        # 错误任务
        bad = app.dm.start(f"{base}/missing", td)
        err = wait_state(bad["id"], ("error",), timeout=10)
        check("404 任务标记为 error", err is not None, err["state"] if err else "超时")
        check("error 文案友好", err and "不存在" in err["error"], err["error"] if err else "")
        check("retry 不存在任务返回 None", app.dm.retry("nope") is None)
        check("cancel 已完成任务返回 False", app.dm.cancel(done["id"]) is False)

        # 清除已完成
        before = len(app.dm.snapshot()["tasks"])
        removed = app.dm.clear_finished()
        after = len(app.dm.snapshot()["tasks"])
        check("clear_finished 清掉终点任务", removed > 0 and after < before, f"{before} -> {after}")
        check("进行中任务不被清除",
              all(t["state"] in ("queued", "downloading") for t in app.dm.snapshot()["tasks"]))

        # 数量上限
        app.dm._max_keep = 3
        for _ in range(5):
            app.dm.start(f"{base}/missing", td)
        time.sleep(1.2)
        check("任务数受 max_keep 约束", len(app.dm.snapshot()["tasks"]) <= 3,
              str(len(app.dm.snapshot()["tasks"])))
        app.dm._max_keep = 50
    finally:
        app.settings.path = real_settings_path
        app.dm.clear_finished()

# ── 6b) 截断后自动重试 ────────────────────────────────────────────────────
print("\n=== 6b) 中途断流后自动重试 ===")
with tempfile.TemporaryDirectory() as td:
    real_sp = app.settings.path
    app.settings.path = Path(td) / "_test_settings.json"
    try:
        FLAKY["n"] = 0
        task = app.dm.start(f"{base}/flaky", td)
        done = wait_state(task["id"], ("done", "error"), timeout=30)
        check("第一次被截断后重试成功", done and done["state"] == "done",
              done["state"] if done else "超时")
        check("尝试次数记录为 2", done and done.get("attempt") == 2,
              str(done.get("attempt")) if done else "")
        check("重试后文件完整", done and Path(done["path"]).stat().st_size == 200000,
              str(Path(done["path"]).stat().st_size) if done else "")
        check("重试后不留 .part", not list(Path(td).glob("*.part")))
    finally:
        app.settings.path = real_sp
        app.dm.clear_finished()

# ── 7) 设置持久化 ─────────────────────────────────────────────────────────
print("\n=== 7) 设置持久化 ===")
with tempfile.TemporaryDirectory() as td:
    sp = Path(td) / "settings.json"
    s1 = app.Settings(sp)
    check("默认每次询问=True", s1.get("ask_every_time") is True)
    check("默认下载目录为系统「下载」", os.path.isdir(s1.get("download_dir")),
          s1.get("download_dir"))
    s1.update(download_dir=td, ask_every_time=False)
    s2 = app.Settings(sp)
    check("目录写入后可读回", s2.get("download_dir") == td)
    check("开关写入后可读回", s2.get("ask_every_time") is False)
    sp.write_text('{"download_dir": "Z:\\\\不存在的盘\\\\x", "ask_every_time": true}', encoding="utf-8")
    s3 = app.Settings(sp)
    check("目录失效时回退默认", os.path.isdir(s3.get("download_dir")), s3.get("download_dir"))
    sp.write_text("{{{ 坏 JSON", encoding="utf-8")
    s4 = app.Settings(sp)
    check("JSON 损坏时不崩且用默认", os.path.isdir(s4.get("download_dir")))

# ── 8) 其它小工具 ─────────────────────────────────────────────────────────
print("\n=== 8) 其它小工具 ===")
check("app_hwnd 不抛异常", isinstance(app.app_hwnd(), int))
check("friendly_error 覆盖权限错误",
      "权限" in app.friendly_error(PermissionError("denied")),
      app.friendly_error(PermissionError("denied")))
check("friendly_error 覆盖网络错误",
      "网络" in app.friendly_error(urllib.error.URLError("boom")),
      app.friendly_error(urllib.error.URLError("boom")))
check("pick_folder 可调用（不在此处弹窗）", callable(app.pick_folder))

srv.shutdown()

# ── 9) 打开 / 定位文件（打桩，不真的弹窗口）──────────────────────────────
print("\n=== 9) 打开 / 定位文件 ===")
import unittest.mock as mock  # noqa: E402

with tempfile.TemporaryDirectory() as td:
    d = Path(td)
    f = d / "已下载 的文件.pdf"
    f.write_bytes(b"%PDF-1.7 stub")

    # 打开存在的文件 -> 用默认程序打开该文件
    with mock.patch("os.startfile") as ms:
        r = app.dm.open_path(str(f))
        check("打开文件 action=open", r.get("action") == "open", str(r))
        check("打开的是文件本身（不是目录）", ms.call_args[0][0] == str(f), str(ms.call_args))

    # 文件已被删/移走 -> 退回打开所在目录，而不是静默失败
    with mock.patch("os.startfile") as ms:
        r = app.dm.open_path(str(d / "没了.pdf"))
        check("文件丢失退回文件夹 action=folder", r.get("action") == "folder", str(r))
        check("退回时打开的是父目录", ms.call_args[0][0] == str(d), str(ms.call_args))

    # 目标是目录 -> 直接打开目录
    with mock.patch("os.startfile") as ms:
        r = app.dm.open_path(str(d))
        check("目标是目录时直接打开目录",
              r.get("action") == "folder" and ms.call_args[0][0] == str(d), str(r))

    # 路径完全不存在（连父目录都没有）-> 老实返回 ok=False
    with mock.patch("os.startfile"):
        r = app.dm.open_path(str(d / "无此目录" / "x.pdf"))
        check("彻底找不到时返回 ok=False", r.get("ok") is False, str(r))

    # 定位文件 -> explorer /select，且必须是「单个命令行字符串」
    with mock.patch("subprocess.Popen") as mp:
        r = app.dm.reveal_path(str(f))
        check("定位 action=select", r.get("action") == "select", str(r))
        cmd = mp.call_args[0][0]
        check("以字符串而非列表传给 explorer", isinstance(cmd, str), type(cmd).__name__)
        check("命令形如 explorer /select,\"<path>\"",
              cmd.startswith('explorer /select,"') and str(f) in cmd, cmd[:70])

    # 含引号的路径在 Windows 上造不出来（" 是非法文件名字符），属于纵深防御分支，
    # 用打桩直接验证：绝不把引号拼进 explorer 命令行，而是退回 os.startfile
    weird = str(d) + '\\a"b.pdf'
    with mock.patch.object(app.Path, "exists", return_value=True), \
         mock.patch.object(app.Path, "is_dir", return_value=False), \
         mock.patch.object(app.Path, "is_file", return_value=True), \
         mock.patch("subprocess.Popen") as mp, mock.patch("os.startfile") as ms:
        r = app.dm.reveal_path(weird)
        check("含引号路径不会拼出 explorer 命令", not mp.called, str(mp.call_args))
        check("含引号路径退回 os.startfile", ms.called, str(ms.call_args))
        check("且返回成功而不是静默失败", r.get("ok") is True, str(r))

# ── 汇总 ───────────────────────────────────────────────────────────────────
print(f"\n{'='*58}\n通过 {len(PASS)} 项，失败 {len(FAIL)} 项")
if FAIL:
    print("失败项：")
    for f in FAIL:
        print("  -", f)
sys.exit(1 if FAIL else 0)
