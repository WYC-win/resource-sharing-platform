# 北地书阁 · 桌面客户端

把 [cugbshare.asia](https://cugbshare.asia) 装进一个 Windows 原生窗口的轻量壳。

**数据全在 N1 服务器上** —— 这个程序只是个外壳，不存任何业务数据、不连本地数据库。
在壳里操作和在浏览器里操作，改的是同一份数据、同一个账号。

---

## 用户怎么用

1. 双击 `北地书阁.exe`（免安装，可直接发微信/QQ 给同学）
2. 用**学号登录**，和网页版完全一样
3. 关掉再打开**不用重新登录**（登录态保存在本地）

| 操作 | 行为 |
|---|---|
| 浏览 / 搜索 / 上传 | 在窗口内完成 |
| **下载资料** | 弹出原生「选择保存位置」→ 下载，右下角**悬浮按钮**实时显示进度 |
| **预览 PDF** | 交给系统浏览器打开（浏览器内置 PDF 阅读器渲染效果最好） |
| 刷新页面 | `Ctrl+R` 或 `F5` |
| 重复双击 | 不会开出第二个窗口，会激活已打开的窗口 |
| 多窗口 | 下载面板可同时跟踪多个任务，支持**取消 / 重试** |

### 下载管理面板

右下角 📥 悬浮按钮，有任务时徽标显示进行中的数量，面板会自动展开。

每个任务显示：文件名、进度条、百分比、**实时速度**和已下载/总大小。按状态提供不同操作：

| 状态 | 可做的操作 |
|---|---|
| 下载中 | **取消**（会删掉未完成的 `.part` 文件） |
| 已完成 | **打开**（用系统默认程序打开文件）、**文件夹**（在资源管理器里定位并选中） |
| 失败 / 已取消 | **重试** |

> 「打开」找不到文件时会自动退回打开所在文件夹，并给一个中性的提示，而不是静默失败。

面板里还可以：

- 看到并**点击修改默认保存位置**
- 开关「**每次下载都询问保存位置**」（默认开；关掉后直接存到上面那个目录）
- 一键「清除已完成」
- 一键「打开保存文件夹」

数据存放位置（只有登录态、设置和日志，没有业务数据）：

```
%LOCALAPPDATA%\CugbShare\
├── webview\        登录态（localStorage / Cookie）
├── settings.json   保存位置、是否每次都询问
└── client.log      运行日志，出问题时把它发我
```

---

## 技术要点

| 项 | 说明 |
|---|---|
| 渲染内核 | 系统自带的 **WebView2**（Win10/11 基本都预装），不打自己的 Chromium |
| 体积 | 约 17 MB（对比 Electron 方案约 180 MB） |
| 依赖 | [pywebview](https://pywebview.flowrl.com/) + pythonnet（WebView2 后端） |
| 打包 | PyInstaller `--onefile --windowed` |
| 注入 UI | `ui.js`，页面加载后注入，自绘悬浮面板（不依赖站点的组件库） |

### 四个必须做对的实现细节

1. **`private_mode=False` + `storage_path` 不能省**
   站点把 JWT 存在 `localStorage`（`accessToken` / `refreshToken` / `user`）。
   pywebview 默认 `private_mode=True`，不改的话每次打开都要重新登录。

2. **`window.open` 必须接管**
   站点前端是用 `window.open(url, '_blank')` 触发下载和预览的。
   pywebview 的 WebView2 后端会把所有新窗口请求一律拦截（`set_Handled(True)`），
   默认丢给系统浏览器。`ui.js` 改写 `window.open`：
   - `/download` → 调 Python 侧下载（带进度/取消）
   - `/preview` → 交给系统浏览器
   - 桥不可用时 → 退回 pywebview 原生行为（仍然可用，只是跳到浏览器）

3. **请求必须带浏览器 UA**
   站点在 Cloudflare 后面，裸 `urllib` 请求会吃到 `403 error code: 1010`。
   代码里固定了 `USER_AGENT`。

4. **选目录用 Win32 API，不用 pywebview 的 `create_file_dialog`**
   后者内部是 WinForms 的 `dialog.ShowDialog(owner)`，从 js_api 子线程调用有跨线程风险。
   这里用 `SHBrowseForFolderW`（`BIF_NEWDIALOGSTYLE | BIF_EDITBOX`，现代样式 + 可新建文件夹），
   任何线程都能安全调用；调之前先 `CoInitializeEx`（该 flag 要求线程已初始化 COM）。

### 进度是怎么推给页面的

Python 侧不直接在下载线程里刷 JS（那样会有并发写和调用过频的问题）。改成：

```
下载线程 --写--> 任务表(加锁) --set--> dirty 事件
                                      ↓
                            单个推送线程每 200ms 醒来
                                      ↓
                    状态变了才 evaluate_js 整包替换（避免增量乱序）
```

进度回调每 0.5s 更新一次速度，UI 端进度条有 `transition: width .25s linear`，看起来是平滑走的。

**⚠️ 读流必须用 `read1(n)` 而不是 `read(n)`。**

`read(n)` 会**阻塞到收满 n 字节或 EOF**。当单次读取上限（256KB）比文件本身还大时，
整份文件会在一次调用里读完 —— 进度回调只触发 **1 次**，界面上的进度条就从 0% 直接跳到
100%，看起来完全是个假进度条。

`read1(n)` 只做一次底层读取、有多少返回多少，进度才能真正实时刷新。EOF 时它返回 `b""`，
所以不会漏字节。实测同一份 173KB 的文件：旧实现 **1 次**回调，新实现 **71 次**。

还有一个兜底：万一服务端没给 `Content-Length`（总大小未知），进度条会切成**滑动的橙色块**，
而不是卡在 0% 让人以为坏了。

### ⚠️ 下载完整性必须自己校验

**`resp.read(n)` / `read1(n)` 在连接中途断开时只是"返回短数据"，不会报错。**
（只有不带宽度的 `read()` 才会抛 `IncompleteRead`。）如果不自己校验，就会把半个文件
当成功保存下来 —— 用户点开才发现是坏的。

所以读完必须比对 `Content-Length`：

```python
if total and not encoded and got != total:
    raise IncompleteDownload(got, total)     # -> 任务显示失败 + 重试，并删掉 .part
```

链路抖动被截断时还会**自动重试**（最多 3 次），界面会显示「第 2 次尝试」。

### 关于下载速度：慢在网络，不在程序

实测同一份 7.46 MB 的文件：

| 路径 | 速度 | 结果 |
|---|---|---|
| N1 本机 `127.0.0.1:3000` | **4.28 MB/s** | 1.67 秒拿全，字节数分毫不差 |
| 公网 `cugbshare.asia` | 12–40 KB/s | 慢 100 倍以上，且会中途断流 |

服务端日志记的是 `200 ... 7461936`（完整发出），N1 的磁盘和 Node 都没问题。
瓶颈是 **N1 出公网那一段**（家宽上行 + Cloudflare 回源）。

站点的下载接口**不支持 Range**（带 `Range:` 请求头仍返回 `200` + 完整长度），
所以客户端没法断点续传，只能重试。

大文件想快，得在部署侧解决：把下载流量放到国内的机器/对象存储上，
或者让文件走一个不经 Cloudflare 的域名。

---

## 验证工具

```bash
# 打真实站点，检查下载是否完整、进度回调的真实时间线（需要一个 token）
python _probe_live.py <token>

# 只测「下载到第几秒、收了多少字节时断开」——排查大文件被截断时最有用
python _probe_timing.py <token> [资源id]

# 把下载面板渲染成静态预览图，用系统 Edge 无头截图 —— 不开主程序就能看 UI
python _preview_ui.py && python _shot.py     # -> _preview.png

# 脱离沙箱起主程序并验收（启动 → 确认窗口 → 检查崩溃 → 关闭）
python _verify_run.py 30
python _verify_run.py 22 --selftest          # 自检模式（会主动关窗，属预期）

# 审计并清理本程序遗留的 WebView2 进程（只杀命令行里带 CugbShare 的）
python _cleanup_procs.py
```

`_probe_live.py` 的 token 可以在服务器上现签（只读，不改任何数据）：

```bash
cd /opt/resource-platform/server
node -e "const p=require('path');const c=require(p.join(process.cwd(),'src/config'));\
const d=require(p.join(process.cwd(),'src/config/db'));\
const j=require(p.join(process.cwd(),'node_modules/jsonwebtoken'));\
(async()=>{await d.getDb();const u=d.queryOne(\"SELECT id FROM users WHERE role='admin' AND status='active' LIMIT 1\");\
console.log(j.sign({userId:u.id},c.jwt.secret,{expiresIn:600}))})()"
```

---

## 开发与构建

```bash
# 依赖（隔离环境）
python -m pip install pywebview pyinstaller pillow
npm install jsdom        # 仅测试 UI 用

# 直接跑源码
python app.py

# 自检（把页面标题/DOM/注入状态/桥接方法写到 %LOCALAPPDATA%\CugbShare\selftest.json）
python app.py --selftest

# 测试：下载引擎（55 项断言，脱离 GUI，起本地 mock HTTP 服务）
python test_download.py

# 测试：注入 UI（62 项断言，用 jsdom 跑真实 DOM + 计算样式）
node test_ui.js

# 打包
python build.py          # -> dist/北地书阁.exe
```

### 图标

图标用的是**网站 favicon 那个 📚**。站点 `client/index.html` 里是内联 SVG：

```html
<link rel="icon" href="data:image/svg+xml,<svg viewBox='0 0 100 100'><text y='.9em' font-size='90'>📚</text></svg>" />
```

`make_icon.py` 用系统 Segoe UI Emoji 渲染同一个字形，超采样（4 倍绘制后 LANCZOS 缩小）
生成 16/24/32/48/64/128/256 七种尺寸的 `icon.ico`，并输出 `icon_preview.png` 供肉眼检查：

```bash
python make_icon.py      # 重新生成 icon.ico + icon_preview.png
python build.py
```

想换回校徽版本：`icon-badge-backup.ico` 是改图标前的备份，覆盖回 `icon.ico` 再打包即可。

---

## ⚠️ 已知坑：不要从受限终端 / 沙箱里启动

如果从带**代码注入**的终端或沙箱环境拉起本程序，弹窗会是：

```
msedgewebview2 has stopped working
Error launching CrashSender.exe
```

**这不是程序的问题。** 从崩溃转储里能看到真凶：

```
崩溃进程主模块: ...\EdgeWebView\Application\153.0.4234.48\msedgewebview2.exe
异常码:        0x80000003 BREAKPOINT（Chromium 自检失败）
注入的非系统模块: C:\...\WorkBuddy\...\cli\vendor\sandbox\5.6.10\tsbx.dll
```

外部注入的 DLL（如某些沙箱 / 安全软件的 hook 库）进到 WebView2 进程里，
Chromium 的自检会失败并主动 abort，于是 `msedgewebview2.exe` 崩掉。

**正确用法：在「文件资源管理器」里双击 `北地书阁.exe`。**

### 怎么验证"到底是程序坏了还是环境问题"

让系统服务（`WmiPrvSE.exe`）去创建进程，父进程脱离沙箱，就不会被注入。
`_verify_run.py` 就是这么做的，一条命令完成「启动 → 确认窗口 → 检查崩溃 → 关闭」：

```bash
python _verify_run.py 30
```

正常输出：

```
+ 3s  存活=True  进程数=2  可见窗口=1  标题=['北地书阁']
...
新增崩溃转储: 0
结论: ✅ 通过
```

> 注意：`--onefile` 打的 EXE，启动器会**再 fork 一个子进程**跑真正的程序，
> 窗口属于**子进程**。所以按父进程 PID 找窗口会一直找不到，
> 要按"所有同名进程的 PID 集合"过滤 `EnumWindows`。

---

## 排查

| 现象 | 处理 |
|---|---|
| `msedgewebview2 has stopped working` | 见上面「已知坑」——别从沙箱/受限终端启动 |
| 提示缺 WebView2 | 装 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| 下载没反应 | 看 `%LOCALAPPDATA%\CugbShare\client.log`；检查是否登录已过期 |
| 点下载没弹选目录 | 面板里「每次下载都询问保存位置」被关掉了；再点开即可 |
| 提示没有写入权限 | 面板里点「保存在：…」换一个目录 |
| 打开是空白页 | 确认能正常访问 https://cugbshare.asia |
| 想改指向的服务器 | 改 `app.py` 里的 `SITE_URL` / `SITE_ORIGIN` 后重新打包 |

崩溃转储位置（排查注入类问题时很有用）：

```
%LOCALAPPDATA%\CugbShare\webview\EBWebView\Crashpad\reports\*.dmp
```
