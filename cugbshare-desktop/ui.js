/* 北地书阁桌面客户端 · 注入到页面里的下载管理 UI
 *
 * 由 app.py 在页面 loaded 后注入（见 install_ui）。
 * 职责：
 *   1. 右下角悬浮按钮 + 下载管理面板（实时进度 / 速度 / 取消 / 重试 / 打开）
 *   2. 接管 window.open —— 站点的下载和预览都靠它
 *   3. Ctrl+R / F5 刷新（WebView2 默认屏蔽了浏览器快捷键）
 *
 * 与 Python 的约定：
 *   Python -> JS : window.__cugbDM.update(state)
 *   JS -> Python : window.pywebview.api.<方法>
 *     download(url) / cancel(id) / retry(id) / clear_finished()
 *     open_path(path) / open_dir() / pick_dir() / set_ask(bool)
 */
(function () {
  'use strict';
  if (window.__cugbDM) { return true; }

  var API = function () { return (window.pywebview && window.pywebview.api) || null; };
  var PANEL_OPEN = false;
  var STATE = { tasks: [], settings: { ask: true, dir: '' } };

  /* ───────────────────────── 样式 ───────────────────────── */

  var CSS = [
    /* 注意：这里用 class 而不是 #id 做隔离。
       写成 `#__cugb_dm *` 的话权重是 (1,0,0)，会盖掉下面所有 `.__cugb_xxx` 的
       padding/margin（(0,1,0)），导致项内边距全变 0 —— 面板会紧贴边框、行距被压扁。
       用 `.__cugb_reset *`（同样 (0,1,0)）并且放在最前面，后面同权重的规则就能正常覆盖它。 */
    '.__cugb_reset, .__cugb_reset * { box-sizing: border-box; margin: 0; padding: 0;',
    '  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }',

    '#__cugb_fab { position: fixed; right: 22px; bottom: 22px; z-index: 2147483600;',
    '  width: 54px; height: 54px; border: none; border-radius: 50%; cursor: pointer;',
    '  background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05);',
    '  font-size: 24px; line-height: 1; display: flex; align-items: center; justify-content: center;',
    '  transition: transform .15s, box-shadow .15s; }',
    '#__cugb_fab:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,.24); }',
    '#__cugb_fab.is-active { box-shadow: 0 4px 16px rgba(0,0,0,.18), 0 0 0 2px #409eff; }',

    '#__cugb_badge { position: absolute; top: -3px; right: -3px; min-width: 21px; height: 21px;',
    '  padding: 0 6px; border-radius: 11px; background: #f56c6c; color: #fff;',
    '  font-size: 12px; font-weight: 600; line-height: 21px; text-align: center; }',
    '#__cugb_badge.spin { background: #409eff; }',

    '#__cugb_panel { position: fixed; right: 22px; bottom: 90px; z-index: 2147483600;',
    '  width: 400px; max-width: calc(100vw - 44px); max-height: 64vh; display: none;',
    '  flex-direction: column; background: #fff; border-radius: 12px;',
    '  box-shadow: 0 10px 34px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.06); overflow: hidden; }',
    '#__cugb_panel.show { display: flex; }',

    '#__cugb_head { display: flex; align-items: center; justify-content: space-between;',
    '  padding: 14px 18px; border-bottom: 1px solid #f0f2f5; }',
    '#__cugb_head b { font-size: 14px; color: #303133; font-weight: 600; }',
    '#__cugb_head .r { display: flex; gap: 8px; }',

    '.__cugb_mini { border: none; background: #f4f6f9; color: #606266; cursor: pointer;',
    '  font-size: 12px; padding: 5px 11px; border-radius: 6px; white-space: nowrap;',
    '  line-height: 1.4; transition: background .15s, color .15s; }',
    '.__cugb_mini:hover { background: #e8eef7; color: #409eff; }',
    '.__cugb_mini.danger:hover { background: #fdeaea; color: #f56c6c; }',
    '.__cugb_mini:disabled { opacity: .5; cursor: default; }',

    '#__cugb_opts { padding: 12px 18px 14px; border-bottom: 1px solid #f0f2f5;',
    '  font-size: 12px; color: #606266; display: flex; flex-direction: column; gap: 9px; }',
    '#__cugb_opts label { display: flex; align-items: center; gap: 7px; cursor: pointer; }',
    '#__cugb_dir { color: #909399; word-break: break-all; cursor: pointer; line-height: 1.6; }',
    '#__cugb_dir:hover { color: #409eff; }',
    '#__cugb_dir span { color: #c0c4cc; }',

    '#__cugb_list { overflow-y: auto; flex: 1; min-height: 72px; }',
    '#__cugb_empty { padding: 30px 18px; text-align: center;',
    '  color: #c0c4cc; font-size: 13px; line-height: 1.8; }',

    '.__cugb_item { padding: 13px 18px 14px; border-bottom: 1px solid #f5f7fa; }',
    '.__cugb_item:last-child { border-bottom: none; }',
    '.__cugb_row { display: flex; align-items: baseline; gap: 10px; }',
    '.__cugb_name { flex: 1; min-width: 0; font-size: 13px; color: #303133; line-height: 1.5;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.__cugb_pct { font-size: 12px; color: #909399; font-variant-numeric: tabular-nums;',
    '  flex-shrink: 0; }',

    '.__cugb_bar { height: 6px; border-radius: 3px; background: #eef1f5; margin: 9px 0 8px;',
    '  overflow: hidden; }',
    '.__cugb_bar i { display: block; height: 100%; width: 0; border-radius: 3px;',
    '  background: #409eff; transition: width .25s linear; }',
    '.__cugb_item.is-done .__cugb_bar i { background: #67c23a; }',
    '.__cugb_item.is-error .__cugb_bar i { background: #f56c6c; }',
    '.__cugb_item.is-cancelled .__cugb_bar i { background: #98a3b0; }',
    /* 总大小未知时用滑动块表示"进行中"，避免进度条卡在 0% 让人以为是假的 */
    '.__cugb_bar.indet i { background: #e6a23c;',
    '  animation: __cugb_indet 1.1s ease-in-out infinite; }',
    '@keyframes __cugb_indet { 0% { margin-left: 0; } 50% { margin-left: 62%; } 100% { margin-left: 0; } }',

    '.__cugb_meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }',
    '.__cugb_sub { font-size: 11px; color: #909399; overflow: hidden; min-width: 0;',
    '  text-overflow: ellipsis; white-space: nowrap; }',
    '.__cugb_item.is-error .__cugb_sub { color: #f56c6c; }',
    '.__cugb_acts { display: flex; gap: 7px; flex-shrink: 0; }',
    '.__cugb_acts .__cugb_open, .__cugb_acts .__cugb_retry, .__cugb_acts .__cugb_reveal { display: none; }',
    '.__cugb_item.is-done .__cugb_open, .__cugb_item.is-done .__cugb_reveal { display: inline-block; }',
    '.__cugb_item.is-done .__cugb_cancel { display: none; }',
    '.__cugb_item.is-error .__cugb_retry, .__cugb_item.is-cancelled .__cugb_retry { display: inline-block; }',
    '.__cugb_item.is-error .__cugb_cancel, .__cugb_item.is-cancelled .__cugb_cancel { display: none; }',

    '#__cugb_foot { padding: 10px 18px; border-top: 1px solid #f0f2f5; text-align: right; }',
    '#__cugb_toast { position: fixed; right: 88px; bottom: 30px; z-index: 2147483601;',
    '  color: #fff; padding: 11px 16px; border-radius: 8px; font-size: 14px; line-height: 1.4;',
    '  box-shadow: 0 6px 20px rgba(0,0,0,.28); max-width: 52vw; word-break: break-all;',
    '  font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }'
  ].join('\n');

  /* ───────────────────────── 工具 ───────────────────────── */

  function fmtSize(n) {
    if (!n || n < 0) { return ''; }
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(n >= 100 ? 0 : 1)) + ' ' + u[i];
  }

  function fmtSpeed(bps) {
    if (!bps || bps <= 0) { return ''; }
    return fmtSize(bps) + '/s';
  }

  function toast(msg, kind) {
    // kind: 省略/true = 成功(绿)、false = 失败(红)、'info' = 中性(灰)
    var old = document.getElementById('__cugb_toast');
    if (old) { old.remove(); }
    var d = document.createElement('div');
    d.id = '__cugb_toast';
    d.textContent = msg;
    d.style.background = kind === false
      ? 'rgba(179,38,30,.95)'
      : (kind === 'info' ? 'rgba(72,78,88,.93)' : 'rgba(31,122,61,.95)');
    document.body.appendChild(d);
    if (kind !== false) { setTimeout(function () { try { d.remove(); } catch (e) {} }, 4200); }
  }
  window.__cugbToast = toast;

  function call(method) {
    var api = API();
    var args = Array.prototype.slice.call(arguments, 1);
    if (!api || typeof api[method] !== 'function') { return { ok: false, error: '桥接未就绪' }; }
    try { return api[method].apply(api, args); }
    catch (e) { return { ok: false, error: String(e) }; }
  }

  // 按 id 取「当前」的任务对象。元素是排队时就建好的，之后任务对象会被整个替换，
  // 所以事件处理里一律现取，不要捕获创建时的那个。
  function findTask(id) {
    var list = STATE.tasks || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }

  /* ───────────────────────── DOM ───────────────────────── */

  function build() {
    if (!document.body) { setTimeout(build, 50); return; }

    var style = document.createElement('style');
    style.id = '__cugb_style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.id = '__cugb_dm';
    wrap.className = '__cugb_reset';   // 样式隔离靠这个 class，不能用 #id（权重会盖掉自己的 padding）
    wrap.innerHTML =
      '<div id="__cugb_panel">' +
        '<div id="__cugb_head"><b>下载管理</b>' +
          '<span class="r"><button class="__cugb_mini" id="__cugb_clear">清除已完成</button>' +
          '<button class="__cugb_mini" id="__cugb_hide">收起</button></span></div>' +
        '<div id="__cugb_opts">' +
          '<label><input type="checkbox" id="__cugb_ask"> 每次下载都询问保存位置</label>' +
          '<div id="__cugb_dir" title="点击修改默认保存位置"></div>' +
        '</div>' +
        '<div id="__cugb_list"></div>' +
        '<div id="__cugb_foot"><button class="__cugb_mini" id="__cugb_opendir">打开保存文件夹</button></div>' +
      '</div>' +
      '<button id="__cugb_fab" title="下载管理"><span>📥</span>' +
        '<span id="__cugb_badge" style="display:none"></span></button>';
    document.body.appendChild(wrap);

    document.getElementById('__cugb_fab').onclick = function () { setPanel(!PANEL_OPEN); };
    document.getElementById('__cugb_hide').onclick = function () { setPanel(false); };
    document.getElementById('__cugb_clear').onclick = function () {
      Promise.resolve(call('clear_finished')).then(refresh);
    };
    document.getElementById('__cugb_opendir').onclick = function () { call('open_dir'); };
    document.getElementById('__cugb_dir').onclick = function () {
      Promise.resolve(call('pick_dir')).then(function (r) {
        if (r && r.ok) { toast('默认保存位置已更新'); }
        refresh();
      });
    };
    document.getElementById('__cugb_ask').onchange = function (e) {
      call('set_ask', !!e.target.checked);
    };
  }

  function setPanel(open) {
    PANEL_OPEN = !!open;
    var p = document.getElementById('__cugb_panel');
    var f = document.getElementById('__cugb_fab');
    if (!p || !f) { return; }
    p.className = PANEL_OPEN ? 'show' : '';
    f.className = PANEL_OPEN ? 'is-active' : '';
    if (PANEL_OPEN) { refresh(); }
  }

  /* ───────────────────────── 渲染（原地更新，不重建 DOM） ───────────────────────── */

  function itemEl(t) {
    var el = document.createElement('div');
    el.className = '__cugb_item';
    el.dataset.id = t.id;
    el.innerHTML =
      '<div class="__cugb_row"><span class="__cugb_name"></span>' +
      '<span class="__cugb_pct"></span></div>' +
      '<div class="__cugb_bar"><i></i></div>' +
      '<div class="__cugb_meta"><span class="__cugb_sub"></span>' +
        '<span class="__cugb_acts">' +
          '<button class="__cugb_mini __cugb_reveal">文件夹</button>' +
          '<button class="__cugb_mini __cugb_open">打开</button>' +
          '<button class="__cugb_mini danger __cugb_cancel">取消</button>' +
          '<button class="__cugb_mini __cugb_retry">重试</button>' +
        '</span></div>';

    // ⚠️ 这里绝对不能在闭包里用参数 t —— 元素是任务刚排队时创建的（那时 path 还是空的），
    //    下载完成后 path 会回填到「新」的任务对象上。闭包抓着旧对象的话，
    //    「打开」会一直读到空 path 而静默失效。必须按 id 现取当前任务。
    var cur = function () { return findTask(el.dataset.id) || t; };

    el.querySelector('.__cugb_cancel').onclick = function () {
      this.disabled = true;
      call('cancel', cur().id);
    };
    el.querySelector('.__cugb_retry').onclick = function () {
      Promise.resolve(call('retry', cur().id)).then(function (r) {
        if (r && r.ok === false) { toast(r.error || '重试失败', false); }
        refresh();
      });
    };
    el.querySelector('.__cugb_open').onclick = function () {
      var task = cur();
      if (!task.path) { toast('文件还没准备好', false); return; }
      Promise.resolve(call('open_path', task.path)).then(function (r) {
        if (r && r.ok === false) { toast('打不开了，文件可能已被移动或删除', false); }
        else if (r && r.action === 'folder') { toast('文件不在了，已为你打开所在文件夹', 'info'); }
      });
    };
    el.querySelector('.__cugb_reveal').onclick = function () {
      var task = cur();
      if (!task.path) { return; }
      Promise.resolve(call('reveal_path', task.path)).then(function (r) {
        if (r && r.ok === false) { toast('找不到文件位置', false); }
      });
    };
    return el;
  }

  function applyState(el, t) {
    var hasTotal = t.total > 0;
    var pct = hasTotal ? Math.min(100, (t.got / t.total) * 100) : (t.state === 'done' ? 100 : 0);
    // 还没拿到总大小时用滑动块，避免进度条卡在 0% 让人以为它是假的
    var indet = (t.state === 'downloading' || t.state === 'queued') && !hasTotal;

    el.className = '__cugb_item is-' + t.state;
    el.querySelector('.__cugb_name').textContent = t.name || '下载中…';
    el.querySelector('.__cugb_pct').textContent =
      t.state === 'done' ? '完成' : (hasTotal ? pct.toFixed(0) + '%' : (indet ? '下载中' : ''));

    var bar = el.querySelector('.__cugb_bar');
    bar.className = indet ? '__cugb_bar indet' : '__cugb_bar';
    bar.querySelector('i').style.width = indet ? '35%' : (t.state === 'queued' ? 2 : pct) + '%';

    var sub;
    if (t.state === 'downloading' || t.state === 'queued') {
      sub = [fmtSpeed(t.speed), fmtSize(t.got) + (hasTotal ? ' / ' + fmtSize(t.total) : '')]
        .filter(Boolean).join(' · ');
      // 链路抖动被截断后会自动重试，让用户知道这不是卡住
      if (t.attempt > 1) { sub += ' · 第 ' + t.attempt + ' 次尝试'; }
    } else if (t.state === 'done') {
      sub = '已保存 · ' + fmtSize(t.got);
      if (t.attempt > 1) { sub += '（重试 ' + (t.attempt - 1) + ' 次后成功）'; }
    } else {
      sub = t.error || t.state;
    }
    el.querySelector('.__cugb_sub').textContent = sub;

    var cb = el.querySelector('.__cugb_cancel');
    cb.disabled = false;
    el.querySelector('.__cugb_open').disabled = !t.path;
  }

  var lastSig = '';

  function refresh() {
    var list = document.getElementById('__cugb_list');
    if (!list) { return; }
    var tasks = (STATE.tasks || []).slice().reverse();  // 新的在上

    if (!tasks.length) {
      list.innerHTML = '<div id="__cugb_empty">暂无下载任务<br>在资料页点「下载」试试</div>';
    } else {
      var empty = document.getElementById('__cugb_empty');
      if (empty) { empty.remove(); }
      var seen = {};
      tasks.forEach(function (t) {
        seen[t.id] = true;
        var el = list.querySelector('[data-id="' + t.id + '"]');
        if (!el) { el = itemEl(t); list.appendChild(el); }
        applyState(el, t);
      });
      // 清掉已消失的任务：children 是活集合，必须先快照成数组再遍历
      Array.prototype.slice.call(list.children).forEach(function (c) {
        if (c.dataset && c.dataset.id && !seen[c.dataset.id]) { c.remove(); }
      });
      // 保持「最新在最上」：要倒着插到队首，正向插会把顺序整个翻过来
      for (var i = tasks.length - 1; i >= 0; i--) {
        var el2 = list.querySelector('[data-id="' + tasks[i].id + '"]');
        if (el2 && list.firstChild !== el2) { list.insertBefore(el2, list.firstChild); }
      }
    }

    // 设置
    var dirEl = document.getElementById('__cugb_dir');
    var askEl = document.getElementById('__cugb_ask');
    var s = STATE.settings || {};
    if (dirEl) { dirEl.innerHTML = '保存在：' + (s.dir || '（未设置）') + ' <span>［点击修改］</span>'; }
    if (askEl) { askEl.checked = !!s.ask; }

    // 徽标
    var active = (STATE.tasks || []).filter(function (t) {
      return t.state === 'downloading' || t.state === 'queued';
    }).length;
    var badge = document.getElementById('__cugb_badge');
    if (badge) {
      badge.style.display = active ? '' : 'none';
      badge.textContent = active;
      badge.className = active ? 'spin' : '';
    }
  }

  /* ───────────────────────── 对外接口 ───────────────────────── */

  window.__cugbDM = {
    update: function (state) {
      if (!state || typeof state !== 'object') { return; }
      var sig = JSON.stringify(state);
      STATE = state;
      if (sig === lastSig) { return; }
      lastSig = sig;

      // 新出现「进行中」任务时自动展开面板
      var active = (state.tasks || []).filter(function (t) {
        return t.state === 'downloading' || t.state === 'queued';
      }).length;
      if (active > 0 && !PANEL_OPEN) { setPanel(true); }

      // 完成提示
      var prev = window.__cugbDM._states || {};
      (state.tasks || []).forEach(function (t) {
        if (prev[t.id] && prev[t.id] !== t.state) {
          if (t.state === 'done') { toast('已保存：' + t.name); }
          else if (t.state === 'error') { toast('下载失败：' + (t.error || '未知错误'), false); }
          else if (t.state === 'cancelled') { toast('已取消：' + t.name, 'info'); }
        }
      });
      var m = {};
      (state.tasks || []).forEach(function (t) { m[t.id] = t.state; });
      window.__cugbDM._states = m;

      refresh();
    },
    getState: function () { return STATE; },
    toggle: function (open) { setPanel(open === undefined ? !PANEL_OPEN : open); return PANEL_OPEN; }
  };

  /* ───────────────────────── 接管 window.open ───────────────────────── */

  var nativeOpen = window.open ? window.open.bind(window) : null;

  window.open = function (url, name, features) {
    if (!url) { return nativeOpen ? nativeOpen(url, name, features) : null; }
    var href;
    try { href = new URL(url, location.href).href; } catch (e) { href = String(url); }

    if (API() && href.indexOf('http') === 0) {
      try {
        var p;
        if (href.indexOf('/download') !== -1) {
          p = window.pywebview.api.download(href);
          if (p && p.then) {
            p.then(function (r) {
              if (!r || r.cancelled) { return; }
              if (r.ok) { setPanel(true); }
              else { toast(r.error || '下载失败', false); }
            }).catch(function (e) { toast('下载失败：' + e, false); });
          }
          return null;
        }
        if (href.indexOf('/preview') !== -1) {
          window.pywebview.api.open_external(href);
          return null;
        }
        window.pywebview.api.open_external(href);
        return null;
      } catch (e) { /* 桥不可用则退回原生行为 */ }
    }
    return nativeOpen ? nativeOpen(url, name, features) : null;
  };

  /* ───────────────────────── 快捷键刷新 ───────────────────────── */

  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey && (e.key === 'r' || e.key === 'R')) || e.key === 'F5') {
      e.preventDefault();
      location.reload();
    }
  }, true);

  build();
  return true;
})();
