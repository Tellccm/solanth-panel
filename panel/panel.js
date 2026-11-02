/* 索兰斯 · 常识面板（外链脚本版 · 挂载方式照 3601）
 * 由角色脚本 `90-面板` import；运行在酒馆助手脚本环境，自带 TavernHelper 全局。
 * 挂载策略与 3601 状态栏一致：
 *   getChatMessages('0-{{lastMessageId}}', {role:'assistant'}) → 逐条 paint
 *   宿主优先 .mes_block，退回 .mes；同一楼用签名去重，避免每次重画
 *   第 0 楼（开场白）也在里面，所以新聊天一打开就有状态栏
 */
(function () {
  'use strict';
  var VERSION = '2026-11-03b';
  var SYS = '常识修改系统';
  var PERSONS = ['雷恩', '艾尔诺娅', '卢西恩六世', '希薇尔'];
  var COLOR = { '雷恩': '#b08b3a', '艾尔诺娅': '#9a5fb0', '卢西恩六世': '#7fb0c8', '希薇尔': '#c88496' };
  var CLS = 'jz-panel';
  var STYLE_ID = 'jz-panel-style';

  /* ── 接口自适应 ── */
  function pick(name) {
    try { if (typeof window[name] === 'function') return window[name].bind(window); } catch (e) {}
    try { var h = window.TavernHelper; if (h && typeof h[name] === 'function') return h[name].bind(h); } catch (e) {}
    try { var p = window.parent; if (p && p !== window && p.TavernHelper && typeof p.TavernHelper[name] === 'function') return p.TavernHelper[name].bind(p.TavernHelper); } catch (e) {}
    return null;
  }
  var getVars = pick('getVariables');
  var replaceVars = pick('replaceVariables');
  var getChatMessages = pick('getChatMessages');
  var getLastId = pick('getLastMessageId');
  var retrieveMsg = pick('retrieveDisplayedMessage');
  var eventOn = pick('eventOn');

  function pageDoc() {
    try { if (window.$ && $('body')[0]) return $('body')[0].ownerDocument; } catch (e) {}
    try { if (window.parent && window.parent.document) return window.parent.document; } catch (e) {}
    return document;
  }
  function chatVars() {
    try { var v = getVars && getVars({ type: 'chat' }); if (v && typeof v === 'object') return v; } catch (e) {}
    return {};
  }
  function writeVars(next) { try { if (replaceVars) { replaceVars({ type: 'chat' }, next); return true; } } catch (e) {} return false; }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ── 样式 ── */
  var CSS = '.jz-panel{font:12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#efe4d6;'
    + 'background:linear-gradient(176deg,#1a1412,#0e0a09);border:1px solid rgba(212,175,55,.22);border-radius:10px;max-width:820px;margin:8px 0;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.45)}'
    + '.jz-panel .jz-hd{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(212,175,55,.16);background:rgba(212,175,55,.05);flex-wrap:wrap}'
    + '.jz-panel .jz-hd b{font-size:12px;letter-spacing:.04em;color:#f3e5ab}'
    + '.jz-panel .jz-chip{font-size:10px;color:#b7a894}.jz-panel .jz-chip.right{margin-left:auto}'
    + '.jz-panel .jz-chip i{font-style:normal;color:#e8b465}'
    + '.jz-panel .jz-bd{padding:8px 10px 10px}'
    + '.jz-panel .jz-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}'
    + '.jz-panel .jz-lbl{font-size:11px;color:#b7a894;min-width:52px}'
    + '.jz-panel .jz-num{font-family:ui-monospace,Consolas,monospace;font-size:14px;color:#fff}'
    + '.jz-panel .jz-num small{font-size:10px;color:#8e8072}'
    + '.jz-panel .jz-bar{flex:1;min-width:90px;height:6px;background:#241c19;border-radius:99px;overflow:hidden}'
    + '.jz-panel .jz-bar i{display:block;height:100%;background:linear-gradient(90deg,#7d2f38,#c94a53,#d4af37)}'
    + '.jz-panel .jz-dots{display:flex;gap:4px}'
    + '.jz-panel .jz-dot{width:9px;height:9px;border-radius:50%;border:1px solid rgba(212,175,55,.5)}'
    + '.jz-panel .jz-dot.on{background:#d4af37;box-shadow:0 0 6px rgba(212,175,55,.6)}'
    + '.jz-panel .jz-tag{font-size:10px;color:#8e8072;border:1px solid rgba(212,175,55,.2);border-radius:99px;padding:0 6px}'
    + '.jz-panel .jz-person{display:grid;grid-template-columns:104px 1fr;gap:1px 10px;padding:3px 0 4px;border-left:2px solid;border-radius:4px;margin-bottom:2px}'
    + '.jz-panel .jz-pname{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.jz-panel .jz-axes{display:flex;gap:12px;align-items:center;font-size:10px;color:#b7a894}'
    + '.jz-panel .jz-axes .v{font-family:ui-monospace,Consolas,monospace;color:#efe4d6}'
    + '.jz-panel .jz-mini{width:40px;height:3px;background:#241c19;border-radius:99px;overflow:hidden;display:inline-block;vertical-align:middle}'
    + '.jz-panel .jz-mini i{display:block;height:100%}'
    + '.jz-panel .jz-voice{grid-column:1/3;font-size:11px;color:#b7a894;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.jz-panel .jz-sec{display:flex;align-items:center;gap:6px;margin:8px 0 4px;font-size:11px;color:#f3e5ab}'
    + '.jz-panel .jz-sec em{font-style:normal;color:#8e8072;font-size:10px}'
    + '.jz-panel .jz-log{display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;border-bottom:1px dashed rgba(212,175,55,.12)}'
    + '.jz-panel .jz-log .t{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.jz-panel .jz-log .st{font-size:10px;padding:0 5px;border-radius:99px;border:1px solid}'
    + '.jz-panel .st.on{color:#8fd6a8;border-color:rgba(143,214,168,.5)}'
    + '.jz-panel .st.off{color:#e8b465;border-color:rgba(232,180,101,.5)}'
    + '.jz-panel .st.rvk{color:#c94a53;border-color:rgba(201,74,83,.5)}'
    + '.jz-panel button{font:11px/1 inherit;background:#241c19;color:#efe4d6;border:1px solid rgba(212,175,55,.28);border-radius:6px;padding:3px 7px;cursor:pointer}'
    + '.jz-panel button:hover{border-color:rgba(212,175,55,.6)}.jz-panel button:disabled{opacity:.4;cursor:not-allowed}'
    + '.jz-panel select,.jz-panel input{font:11px/1.4 inherit;background:#141010;color:#efe4d6;border:1px solid rgba(212,175,55,.24);border-radius:6px;padding:3px 6px}'
    + '.jz-panel .jz-inject{display:flex;gap:6px;margin-top:8px}.jz-panel .jz-inject input{flex:1;min-width:0}'
    + '.jz-panel .jz-empty{font-size:11px;color:#8e8072;padding:4px 0}.jz-panel .jz-err{font-size:11px;color:#c94a53;padding:6px 0}'
    + '@media(max-width:560px){.jz-panel .jz-person{grid-template-columns:88px 1fr}.jz-panel .jz-mini{width:26px}}';

  function injectStyle() {
    var d = pageDoc();
    if (!d || d.getElementById(STYLE_ID)) return;
    var st = d.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (d.head || d.body).appendChild(st);
  }

  /* ── 定位消息元素（照 3601：retrieveDisplayedMessage → .mes_block 宿主） ── */
  function elOf(id) {
    var d = pageDoc();
    if (!d) return null;
    var el = null;
    try { if (retrieveMsg) { var r = retrieveMsg(id); if (r && r.length) el = r[0]; } } catch (e) {}
    if (!el) el = d.querySelector('.mes[mesid="' + id + '"]');
    return el;
  }
  function hostOf(el) {
    if (!el) return null;
    var block = el.querySelector ? el.querySelector('.mes_block') : null;
    return block || el;
  }
  function assistantIds() {
    var ids = [];
    try { if (getChatMessages) ids = getChatMessages('0-{{lastMessageId}}', { role: 'assistant', hide_state: 'unhidden' }).map(function (m) { return m.message_id; }); } catch (e) {}
    if (!ids.length) {
      var d = pageDoc();
      if (d) { Array.prototype.forEach.call(d.querySelectorAll('.mes[is_user="false"]'), function (n) { ids.push(Number(n.getAttribute('mesid'))); }); }
    }
    return ids;
  }

  /* ── 数据 ── */
  function readBox(v) { var b = v && v[SYS]; return (b && typeof b === 'object') ? b : null; }
  function personOf(v, who) { var p = v && v['人物'] && v['人物'][who]; return (p && typeof p === 'object') ? p : {}; }
  function timeLine(v) {
    var t = (v && v['时间']) || {}, out = [];
    if (t['日期']) out.push(t['日期']);
    if (t['时段']) out.push(t['时段']);
    if (t['地点']) out.push(t['地点']);
    return out.join(' · ');
  }

  /* ── 渲染 ── */
  function htmlFor(vars, msgId) {
    var sys = readBox(vars);
    var shame = num(sys && sys['羞辱值'], 0);
    var pool = num(sys && sys['充能池'], 0);
    var max = num(sys && sys['单轮注入上限'], 1);
    var logs = (sys && sys['修改日志']) || {};
    var total = 0, on = 0, off = 0, rvk = 0;
    var h = '';

    h += '<div class="jz-hd"><b>常识修改系统</b>'
      + '<span class="jz-chip">' + esc(timeLine(vars) || '时间未就位') + '</span>'
      + '<span class="jz-chip right">第 <i>' + msgId + '</i> 楼 · 生效 <i>' + pool + '</i> 次</span></div><div class="jz-bd">';
    if (!sys) h += '<div class="jz-err">读不到变量：确认角色脚本已勾选，并开新聊天。</div>';

    h += '<div class="jz-row"><span class="jz-lbl">受辱充能</span>'
      + '<span class="jz-num">' + shame + '<small>/100</small></span>'
      + '<span class="jz-bar"><i style="width:' + clamp(shame, 0, 100) + '%"></i></span>'
      + '<span class="jz-tag">' + (pool > 0 ? '可注入 ' + pool + ' 次' : '还差 ' + Math.max(0, 100 - shame % 100) + ' 点') + '</span></div>';

    h += '<div class="jz-row"><span class="jz-lbl">充能池</span>'
      + '<span class="jz-num">' + pool + '<small>/3</small></span>'
      + '<span class="jz-dots">' + [1, 2, 3].map(function (i) { return '<i class="jz-dot' + (i <= pool ? ' on' : '') + '"></i>'; }).join('') + '</span>'
      + '<span class="jz-tag">单轮上限 ' + max + '</span></div>';

    h += '<div class="jz-sec">目标状态 <em>好感度 / 欲望 / 羞耻 + 心声</em></div>';
    PERSONS.forEach(function (who) {
      var p = personOf(vars, who);
      var ho = clamp(num(p['好感度'], 0), 0, 100), de = clamp(num(p['欲望'], 0), 0, 100), sh = clamp(num(p['羞耻'], 0), 0, 100);
      var voice = String(p['心声'] || '').trim();
      var c = COLOR[who] || '#d4af37';
      h += '<div class="jz-person" style="border-left-color:' + c + '">'
        + '<span class="jz-pname" style="color:' + c + '">' + esc(who) + '</span>'
        + '<span class="jz-axes">'
        + '<span>好 <span class="jz-mini"><i style="width:' + ho + '%;background:#8fd6a8"></i></span> <span class="v">' + ho + '</span></span>'
        + '<span>欲 <span class="jz-mini"><i style="width:' + de + '%;background:#d4af37"></i></span> <span class="v">' + de + '</span></span>'
        + '<span>羞 <span class="jz-mini"><i style="width:' + sh + '%;background:#c94a53"></i></span> <span class="v">' + sh + '</span></span>'
        + '</span><span class="jz-voice" title="' + esc(voice) + '">' + (voice ? '「' + esc(voice) + '」' : '——') + '</span></div>';
    });

    h += '<div class="jz-sec">三态台账 <em>生效 / 关闭 / 撤回</em></div>';
    PERSONS.forEach(function (who) {
      (Array.isArray(logs[who]) ? logs[who] : []).forEach(function (it) {
        if (!it || !it['内容']) return;
        total++;
        var st = it['状态'] === '已撤回' ? 'rvk' : (it['启用'] === false ? 'off' : 'on');
        if (st === 'on') on++; else if (st === 'off') off++; else rvk++;
        h += '<div class="jz-log" data-who="' + esc(who) + '" data-id="' + num(it.id, 0) + '">'
          + '<span class="jz-tag">' + esc(who) + '</span>'
          + '<span class="t" title="' + esc(it['内容']) + '">' + esc(it['内容']) + '</span>'
          + '<span class="st ' + st + '">' + (st === 'on' ? '生效中' : st === 'off' ? '已关闭' : '已撤回') + '</span>'
          + (st === 'on' ? '<button data-act="close">关闭</button><button data-act="revoke">撤回</button>'
            : st === 'off' ? '<button data-act="open">开启</button><button data-act="revoke">撤回</button>'
              : '<span class="jz-tag">永久</span>') + '</div>';
      });
    });
    if (!total) h += '<div class="jz-empty">还没有常识。攒满 100 点受辱充能，换一次注入机会。</div>';
    h += '<div class="jz-sec" style="margin-top:2px"><em>台账 ' + total + ' 条：生效 ' + on + ' · 关闭 ' + off + ' · 撤回 ' + rvk + '</em></div>';

    h += '<div class="jz-inject"><select data-role="who">' + PERSONS.map(function (w) { return '<option>' + esc(w) + '</option>'; }).join('') + '</select>'
      + '<input data-role="text" maxlength="120" placeholder="写一句常识（消耗 1 次充能注入）">'
      + '<button data-act="inject"' + (pool < 1 ? ' disabled' : '') + '>注入</button></div></div>';
    return h;
  }

  var SIG = {};
  function paint(id, force) {
    var d = pageDoc();
    var el = elOf(id);
    if (!el) return;
    var host = hostOf(el);
    if (!host) return;
    var vars = chatVars();
    var sys = readBox(vars);
    var sig = JSON.stringify([sys, vars['人物'], vars['时间'], PERSONS.length]);
    var old = host.querySelector('.' + CLS);
    if (!force && old && SIG[id] === sig) return;
    if (old) old.remove();
    var box = d.createElement('div');
    box.className = CLS;
    box.innerHTML = htmlFor(vars, id);
    if (!box.__jzBound) { box.addEventListener('click', onClick, true); box.__jzBound = true; }
    host.appendChild(box);
    SIG[id] = sig;
  }

  function onClick(ev) {
    var btn = ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if (!btn) return;
    ev.preventDefault();
    var act = btn.getAttribute('data-act');
    var panel = btn.closest('.' + CLS);
    if (!panel) return;

    if (act === 'inject') {
      var who = (panel.querySelector('[data-role="who"]') || {}).value || PERSONS[0];
      var input = panel.querySelector('[data-role="text"]');
      var text = ((input && input.value) || '').trim();
      if (!text) return;
      mutate(function (sys) {
        var pool = num(sys['充能池'], 0);
        if (pool < 1) return;
        var list = sys['修改日志'][who];
        var nid = list.reduce(function (m, it) { return Math.max(m, num(it && it.id, 0)); }, 0) + 1;
        list.push({ id: nid, '内容': text.slice(0, 120), '启用': true, '状态': '生效中', '失效原因': '', '已锁定受辱': true });
        sys['充能池'] = pool - 1;
        sys['可用次数'] = pool - 1;
      });
      return;
    }

    var row = btn.closest('.jz-log');
    if (!row) return;
    var w = row.getAttribute('data-who'), id = Number(row.getAttribute('data-id'));
    mutate(function (sys) {
      var it = (sys['修改日志'][w] || []).find(function (x) { return num(x.id, 0) === id; });
      if (!it) return;
      if (act === 'close') { it['启用'] = false; it['状态'] = '已关闭'; }
      else if (act === 'open') { it['启用'] = true; it['状态'] = '生效中'; }
      else if (act === 'revoke') {
        it['启用'] = false; it['状态'] = '已撤回'; it['失效原因'] = '玩家主动撤回';
        sys['撤回黑名单'] = (sys['撤回黑名单'] || []).concat([{ who: w, text: it['内容'] }]);
      }
    });
  }

  function mutate(fn) {
    var next = JSON.parse(JSON.stringify(chatVars() || {}));
    var sys = next[SYS] || (next[SYS] = {});
    sys['修改日志'] = sys['修改日志'] || {};
    PERSONS.forEach(function (w) { if (!Array.isArray(sys['修改日志'][w])) sys['修改日志'][w] = []; });
    fn(sys, next);
    writeVars(next);
    paintAll(true);
  }

  var busy = false;
  function paintAll(force) {
    if (busy) return;
    busy = true;
    try {
      injectStyle();
      var ids = assistantIds();
      var keep = {};
      ids.forEach(function (id) { keep[id] = 1; paint(id, force); });
      // 清掉不属于助手消息的残留
      var d = pageDoc();
      if (d) Array.prototype.forEach.call(d.querySelectorAll('.' + CLS), function (n) {
        var mes = n.closest ? n.closest('.mes') : null;
        var mid = mes ? Number(mes.getAttribute('mesid')) : -1;
        if (!(mid in keep)) n.remove();
      });
    } catch (e) { console.error('[常识面板] 渲染失败', e); }
    finally { busy = false; }
  }

  function installWatchdog() {
    if (typeof MutationObserver === 'undefined') return;
    var d = pageDoc();
    var root = (d && d.getElementById('chat')) || (d && d.body);
    if (!root) return;
    var scheduled = false;
    var obs = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () { scheduled = false; try { paintAll(false); } catch (e) {} }, 60);
    });
    obs.observe(root, { childList: true, subtree: true });
  }

  function boot() {
    paintAll(true);
    installWatchdog();
    [600, 1500, 3000].forEach(function (ms) { setTimeout(function () { paintAll(true); }, ms); });
    setInterval(function () { paintAll(false); }, 2500);

    if (eventOn) {
      var T = (typeof tavern_events !== 'undefined') ? tavern_events : {};
      ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_RECEIVED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED'].forEach(function (k) {
        var name = T[k] || k;
        try { eventOn(name, function () { setTimeout(function () { paintAll(true); }, 120); }); } catch (e) {}
      });
      try { if (T.MESSAGE_DELETED) eventOn(T.MESSAGE_DELETED, function () { setTimeout(function () { paintAll(true); }, 150); }); } catch (e) {}
    }
    console.info('[常识面板] 已加载 ' + VERSION + '（挂载：逐条助手消息，含第 0 楼开场白）');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
