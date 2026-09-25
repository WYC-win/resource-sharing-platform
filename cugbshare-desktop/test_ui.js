/**
 * ui.js 的 DOM 测试（jsdom）
 *
 * 图形界面我看不到，所以用 jsdom 把注入脚本跑一遍，断言：
 *   - 悬浮按钮/面板是否正确注入，CSS 是否被解析
 *   - 进度状态能否正确渲染（进度条宽度、速度/体积文案、状态类名、徽标）
 *   - window.open 是否被正确接管（下载走 api.download、预览走 open_external）
 *   - 各按钮点击是否调到了对应的桥接方法
 *
 * 运行：node test_ui.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const UI_SRC = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8');

let pass = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? '   ' + extra : ''}`); }
  else { fails.push(name); console.log(`  ❌ ${name}${extra ? '   ' + extra : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async function main() {
  // ── 搭环境 ────────────────────────────────────────────────
  const calls = [];
  const ok = (v) => Promise.resolve(v);

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', {
    url: 'https://cugbshare.asia/login?redirect=/resources',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;

  window.pywebview = {
    api: {
      log: (m) => { calls.push(['log', m]); return ok(true); },
      open_external: (u) => { calls.push(['open_external', u]); return ok(true); },
      download: (u) => { calls.push(['download', u]); return ok({ ok: true, id: 't1', name: 'x.pdf' }); },
      cancel: (i) => { calls.push(['cancel', i]); return ok(true); },
      retry: (i) => { calls.push(['retry', i]); return ok({ ok: true, id: 't9' }); },
      clear_finished: () => { calls.push(['clear_finished']); return ok(2); },
      open_path: (p) => { calls.push(['open_path', p]); return ok({ ok: true, action: 'open' }); },
      reveal_path: (p) => { calls.push(['reveal_path', p]); return ok({ ok: true, action: 'select' }); },
      open_dir: () => { calls.push(['open_dir']); return ok({ ok: true, action: 'folder' }); },
      pick_dir: () => { calls.push(['pick_dir']); return ok({ ok: true, dir: 'D:\\DL' }); },
      set_ask: (f) => { calls.push(['set_ask', f]); return ok({ ok: true, ask: f }); },
    },
  };
  window.console = console;
  window.URL = URL;

  console.log('=== 1) 注入与初始化 ===');
  window.eval(UI_SRC);
  await sleep(60);

  check('暴露 window.__cugbDM', !!window.__cugbDM);
  check('创建悬浮按钮 #__cugb_fab', !!document.getElementById('__cugb_fab'));
  check('创建面板 #__cugb_dm', !!document.getElementById('__cugb_dm'));
  check('创建进度列表 #__cugb_list', !!document.getElementById('__cugb_list'));
  check('面板默认收起', !document.getElementById('__cugb_panel').className.includes('show'));

  const styleEl = document.getElementById('__cugb_style');
  check('注入 <style id="__cugb_style">', !!styleEl);
  let rules = 0;
  try { rules = document.styleSheets[0].cssRules.length; } catch (e) { rules = -1; }
  check('CSS 已被解析成规则', rules > 20, `规则数=${rules}`);
  check('CSS 无残留无效行', !/^__cugb_empty$/m.test(styleEl.textContent));

  console.log('\n=== 2) 空状态 ===');
  window.__cugbDM.update({ tasks: [], settings: { ask: true, dir: 'C:\\Users\\WYC\\Downloads' } });
  await sleep(20);
  check('显示空提示', !!document.getElementById('__cugb_empty'));
  check('徽标隐藏', document.getElementById('__cugb_badge').style.display === 'none');
  check('目录文案渲染', document.getElementById('__cugb_dir').textContent.includes('C:\\Users\\WYC\\Downloads'));
  check('询问开关为勾选', document.getElementById('__cugb_ask').checked === true);

  console.log('\n=== 3) 下载中（实时进度）===');
  const t1 = { id: 't1', name: '高等数学（上）2021真题.pdf', dir: 'C:\\DL', path: '',
    total: 10485760, got: 4194304, state: 'downloading', error: '', speed: 524288 };
  window.__cugbDM.update({ tasks: [t1], settings: { ask: true, dir: 'C:\\DL' } });
  await sleep(20);

  const item = document.querySelector('[data-id="t1"]');
  check('生成任务条目', !!item, item ? item.className : '');
  check('状态类名 is-downloading', item.className.includes('is-downloading'));
  const w1 = item.querySelector('.__cugb_bar i').style.width;
  check('进度条宽度 = 40%', w1 === '40%', `width=${w1}`);
  check('百分比文案', item.querySelector('.__cugb_pct').textContent === '40%',
    item.querySelector('.__cugb_pct').textContent);
  const sub = item.querySelector('.__cugb_sub').textContent;
  check('速度/体积文案', sub.includes('512 KB/s') && sub.includes('4.0 MB') && sub.includes('/ 10.0 MB'), sub);
  check('文件名渲染', item.querySelector('.__cugb_name').textContent.includes('高等数学'));
  check('自动展开面板', document.getElementById('__cugb_panel').className.includes('show'));
  check('徽标显示 1', document.getElementById('__cugb_badge').textContent === '1');

  // 进度推进
  window.__cugbDM.update({ tasks: [Object.assign({}, t1, { got: 10485760 })], settings: { ask: true, dir: 'C:\\DL' } });
  await sleep(20);
  check('进度推进到 100%', item.querySelector('.__cugb_bar i').style.width === '100%',
    item.querySelector('.__cugb_bar i').style.width);

  console.log('\n=== 4) 完成 / 失败 / 取消 ===');
  window.__cugbDM.update({ tasks: [Object.assign({}, t1, { state: 'done', got: 10485760, path: 'C:\\DL\\x.pdf', speed: 0 })],
    settings: { ask: true, dir: 'C:\\DL' } });
  await sleep(20);
  check('状态类名 is-done', item.className.includes('is-done'));
  check('文案显示完成', item.querySelector('.__cugb_pct').textContent === '完成');
  check('显示「已保存」', item.querySelector('.__cugb_sub').textContent.startsWith('已保存'));
  check('出现完成提示 toast', !!document.getElementById('__cugb_toast'));
  const tst = document.getElementById('__cugb_toast');
  check('toast 文案含文件名', tst && tst.textContent.includes('已保存'), tst ? tst.textContent : '');
  check('徽标隐藏（无进行中）', document.getElementById('__cugb_badge').style.display === 'none');

  window.__cugbDM.update({ tasks: [Object.assign({}, t1, { state: 'error', error: '登录已过期，请重新登录后再下载' })],
    settings: { ask: true, dir: 'C:\\DL' } });
  await sleep(20);
  check('状态类名 is-error', item.className.includes('is-error'));
  check('显示错误原因', item.querySelector('.__cugb_sub').textContent.includes('登录已过期'));

  window.__cugbDM.update({ tasks: [Object.assign({}, t1, { state: 'cancelled', error: '已取消' })],
    settings: { ask: true, dir: 'C:\\DL' } });
  await sleep(20);
  check('状态类名 is-cancelled', item.className.includes('is-cancelled'));

  console.log('\n=== 5) window.open 接管 ===');
  calls.length = 0;
  const r1 = window.open('/api/v1/resources/7/download?token=abc', '_blank');
  await sleep(30);
  const dl = calls.find((c) => c[0] === 'download');
  check('下载走 api.download', !!dl, JSON.stringify(dl));
  check('URL 补成绝对地址', dl && dl[1] === 'https://cugbshare.asia/api/v1/resources/7/download?token=abc',
    dl ? dl[1] : '');
  check('window.open 返回 null', r1 === null);

  calls.length = 0;
  window.open('/api/v1/resources/7/preview?token=abc', '_blank');
  await sleep(30);
  const pv = calls.find((c) => c[0] === 'open_external');
  check('预览走 api.open_external', !!pv, JSON.stringify(pv));
  check('预览 URL 正确', pv && pv[1].includes('/preview?token=abc'));

  calls.length = 0;
  window.open('https://example.com/other', '_blank');
  await sleep(30);
  check('其它链接也交给浏览器', !!calls.find((c) => c[0] === 'open_external'));

  console.log('\n=== 6) 按钮交互 ===');
  calls.length = 0;
  item.querySelector('.__cugb_cancel').click();
  await sleep(20);
  check('取消按钮 -> api.cancel(t1)', JSON.stringify(calls) === JSON.stringify([['cancel', 't1']]), JSON.stringify(calls));

  calls.length = 0;
  item.querySelector('.__cugb_retry').click();
  await sleep(30);
  check('重试按钮 -> api.retry(t1)', !!calls.find((c) => c[0] === 'retry' && c[1] === 't1'), JSON.stringify(calls));

  calls.length = 0;
  document.getElementById('__cugb_dir').click();
  await sleep(30);
  check('点击目录 -> api.pick_dir', !!calls.find((c) => c[0] === 'pick_dir'), JSON.stringify(calls));

  calls.length = 0;
  const askEl = document.getElementById('__cugb_ask');
  askEl.checked = false;
  askEl.dispatchEvent(new window.Event('change'));
  await sleep(30);
  check('切换开关 -> api.set_ask(false)',
    !!calls.find((c) => c[0] === 'set_ask' && c[1] === false), JSON.stringify(calls));

  calls.length = 0;
  document.getElementById('__cugb_clear').click();
  await sleep(30);
  check('清除已完成 -> api.clear_finished', !!calls.find((c) => c[0] === 'clear_finished'), JSON.stringify(calls));

  calls.length = 0;
  document.getElementById('__cugb_opendir').click();
  await sleep(30);
  check('打开文件夹 -> api.open_dir', !!calls.find((c) => c[0] === 'open_dir'), JSON.stringify(calls));

  console.log('\n=== 7) 面板开关 / 多项任务 ===');
  document.getElementById('__cugb_hide').click();
  await sleep(20);
  check('收起按钮生效', !document.getElementById('__cugb_panel').className.includes('show'));
  document.getElementById('__cugb_fab').click();
  await sleep(20);
  check('悬浮按钮可展开', document.getElementById('__cugb_panel').className.includes('show'));

  const many = [
    { id: 'a', name: 'a.pdf', state: 'downloading', got: 1, total: 2, speed: 1024, error: '', path: '' },
    { id: 'b', name: 'b.pdf', state: 'done', got: 2, total: 2, speed: 0, error: '', path: 'C:\\b.pdf' },
    { id: 'c', name: 'c.pdf', state: 'error', got: 0, total: 0, speed: 0, error: '网络连接失败', path: '' },
  ];
  window.__cugbDM.update({ tasks: many, settings: { ask: false, dir: 'C:\\DL' } });
  await sleep(20);
  check('渲染 3 条任务', document.querySelectorAll('.__cugb_item').length === 3,
    String(document.querySelectorAll('.__cugb_item').length));
  check('徽标只计进行中 (=1)', document.getElementById('__cugb_badge').textContent === '1');
  check('最新任务排在最上', document.querySelector('.__cugb_item').dataset.id === 'c');

  window.__cugbDM.update({ tasks: [many[0]], settings: { ask: false, dir: 'C:\\DL' } });
  await sleep(20);
  check('移除已消失的任务', document.querySelectorAll('.__cugb_item').length === 1);

  console.log('\n=== 8) getState / toggle ===');
  check('getState 返回最新状态', window.__cugbDM.getState().tasks.length === 1);
  check('toggle(false) 收起', window.__cugbDM.toggle(false) === false);

  console.log('\n=== 9) 样式回归：内边距必须真的生效 ===');
  // 曾经的 bug：隔离样式写成 `#__cugb_dm *`，权重 (1,0,0) 盖掉了
  // `.__cugb_item` 的 padding/margin（(0,1,0)），面板内容紧贴边框、行距被压扁。
  // 这里直接断言计算样式，避免再犯。
  window.__cugbDM.update({
    tasks: [{ id: 's9', name: 's.pdf', state: 'downloading', got: 1, total: 4, speed: 2048, error: '', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  const s9 = document.querySelector('[data-id="s9"]');
  const gs = (el) => window.getComputedStyle(el);
  check('条目有上内边距 13px', gs(s9).paddingTop === '13px', `paddingTop=${gs(s9).paddingTop}`);
  check('条目有左内边距 18px', gs(s9).paddingLeft === '18px', `paddingLeft=${gs(s9).paddingLeft}`);
  check('进度条有上外边距 9px', gs(s9.querySelector('.__cugb_bar')).marginTop === '9px',
    `marginTop=${gs(s9.querySelector('.__cugb_bar')).marginTop}`);
  check('小按钮有内边距 5px/11px',
    gs(s9.querySelector('.__cugb_mini')).paddingTop === '5px' &&
    gs(s9.querySelector('.__cugb_mini')).paddingLeft === '11px',
    `${gs(s9.querySelector('.__cugb_mini')).paddingTop}/${gs(s9.querySelector('.__cugb_mini')).paddingLeft}`);
  check('面板容器本身不受重置影响',
    gs(document.getElementById('__cugb_head')).paddingTop === '14px',
    `headPaddingTop=${gs(document.getElementById('__cugb_head')).paddingTop}`);
  check('隔离 class 挂在容器上',
    document.getElementById('__cugb_dm').className.includes('__cugb_reset'));

  console.log('\n=== 10) toast 配色不能搞反 ===');
  window.__cugbDM.update({ tasks: [], settings: { ask: true, dir: 'C:/DL' } });
  await sleep(20);
  window.__cugbDM.update({
    tasks: [{ id: 's9', name: 's.pdf', state: 'downloading', got: 1, total: 4, speed: 0, error: '', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(20);
  window.__cugbDM.update({
    tasks: [{ id: 's9', name: 's.pdf', state: 'done', got: 4, total: 4, speed: 0, error: '', path: 'C:/DL/s.pdf' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  const tDone = document.getElementById('__cugb_toast');
  // 浏览器会把颜色规范化成 "rgba(31, 122, 61, 0.95)"（带空格），所以用正则匹配
  check('成功提示是绿色（31,122,61）', tDone && /rgba?\(\s*31,\s*122,\s*61/.test(tDone.style.background),
    tDone ? tDone.style.background : '(无 toast)');
  check('成功提示文案', tDone && tDone.textContent.includes('已保存'), tDone ? tDone.textContent : '');

  window.__cugbDM.update({
    tasks: [{ id: 's9', name: 's.pdf', state: 'downloading', got: 1, total: 4, speed: 0, error: '', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(20);
  window.__cugbDM.update({
    tasks: [{ id: 's9', name: 's.pdf', state: 'cancelled', got: 1, total: 4, speed: 0, error: '已取消', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  const tCancel = document.getElementById('__cugb_toast');
  check('取消提示是中性灰（不是红色）', tCancel && /rgba?\(\s*72,\s*78,\s*88/.test(tCancel.style.background),
    tCancel ? tCancel.style.background : '(无 toast)');

  console.log('\n=== 11) 总大小未知时用滑动进度 ===');
  window.__cugbDM.update({
    tasks: [{ id: 'u1', name: 'u.bin', state: 'downloading', got: 500000, total: 0, speed: 1024, error: '', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  const u1 = document.querySelector('[data-id="u1"]');
  check('进度条带 indet 类', u1.querySelector('.__cugb_bar').className.includes('indet'),
    u1.querySelector('.__cugb_bar').className);
  check('文字显示「下载中」而非百分比', u1.querySelector('.__cugb_pct').textContent === '下载中',
    u1.querySelector('.__cugb_pct').textContent);
  check('副文案只显示已下载量', u1.querySelector('.__cugb_sub').textContent.includes('488 KB') &&
    !u1.querySelector('.__cugb_sub').textContent.includes(' / '),   // " / " 才是「已下载/总大小」分隔符
    u1.querySelector('.__cugb_sub').textContent);

  console.log('\n=== 12) 回归：完成后「打开」必须真的能用 ===');
  // 旧 bug：条目在 queued 状态就建好了，onclick 闭包抓的是那时 path 为空的对象；
  // 下载完成后 path 回填到「新」对象上，闭包仍读旧对象 -> 直接 return，点了毫无反应。
  // 所以这里必须先用未完成状态建元素，再切成完成，才能复现。
  calls.length = 0;
  window.__cugbDM.update({
    tasks: [{ id: 'c1', name: 'c1.pdf', state: 'queued', got: 0, total: 100, speed: 0, error: '', path: '' }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  const c1 = document.querySelector('[data-id="c1"]');
  check('排队时条目不是 done', !c1.className.includes('is-done'), c1.className);
  calls.length = 0;
  c1.querySelector('.__cugb_open').click();          // 此时还没路径
  await sleep(30);
  check('路径为空时点「打开」不会误调 api', !calls.some((c) => c[0] === 'open_path'), JSON.stringify(calls));
  check('路径为空时给出提示', !!document.getElementById('__cugb_toast'));

  const DONE_PATH = 'C:/DL/已下载 的文件.pdf';
  window.__cugbDM.update({
    tasks: [{ id: 'c1', name: 'c1.pdf', state: 'done', got: 100, total: 100, speed: 0, error: '', path: DONE_PATH }],
    settings: { ask: true, dir: 'C:/DL' },
  });
  await sleep(30);
  check('完成后变为 is-done', c1.className.includes('is-done'), c1.className);

  calls.length = 0;
  c1.querySelector('.__cugb_open').click();
  await sleep(40);
  const op = calls.find((c) => c[0] === 'open_path');
  check('点「打开」调到 api.open_path', !!op, JSON.stringify(calls));
  check('传的是完成后回填的真实路径', op && op[1] === DONE_PATH, op ? op[1] : '');

  calls.length = 0;
  c1.querySelector('.__cugb_reveal').click();
  await sleep(40);
  const rv = calls.find((c) => c[0] === 'reveal_path');
  check('点「文件夹」调到 api.reveal_path', !!rv, JSON.stringify(calls));
  check('定位传的路径正确', rv && rv[1] === DONE_PATH, rv ? rv[1] : '');

  // ── 汇总 ─────────────────────────────────────────────────
  console.log('\n' + '='.repeat(56));
  console.log(`通过 ${pass} 项，失败 ${fails.length} 项`);
  if (fails.length) { console.log('失败项：'); fails.forEach((f) => console.log('  - ' + f)); }
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('测试异常:', e); process.exit(1); });
