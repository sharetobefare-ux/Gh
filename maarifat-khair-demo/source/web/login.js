'use strict';
// صفحة الدخول: اسم ورقم فقط. لا يظهر قبلها أي محتوى.
(function () {
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); } kids.flat(Infinity).forEach((c) => c != null && c !== false && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; };
  const root = document.getElementById('root');
  const api = async (method, url, body) => { const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-MK': '1' }, body: body && JSON.stringify(body), credentials: 'same-origin' }); let d = {}; try { d = await r.json(); } catch {} return { ok: r.ok, status: r.status, d }; };
  const loadJs = (src) => new Promise((res, rej) => { const e = document.createElement('script'); e.src = src; e.onload = res; e.onerror = rej; document.head.append(e); });
  // النسخة الثابتة: الخلفية داخل الصفحة، فيُحمَّل التطبيق في نفس المستند كي لا تضيع الجلسة.
  const go = async () => { if (!window.MK_BROWSER_DEMO) { location.href = 'app/index.html'; return; } for (const f of ['lib', 'forms']) await loadJs('app/' + f + '.js'); MK.BASE = ''; location.hash = '#/'; await loadJs('app/pages.js'); };
  const name = h('input', { id: 'n', autocomplete: 'username', spellcheck: 'false', required: true, 'aria-describedby': 'e' }), code = h('input', { id: 'c', type: 'password', dir: 'ltr', autocomplete: 'current-password', spellcheck: 'false', required: true, 'aria-describedby': 'e' }), err = h('div', { class: 'err', id: 'e', role: 'alert' });
  const btn = h('button', { class: 'btn', type: 'submit' }, 'دخول');
  const form = h('form', { class: 'card login-card', onsubmit: async (ev) => { ev.preventDefault(); err.textContent = ''; btn.disabled = true; const r = await api('POST', 'api/auth/login', { name: name.value, code: code.value }); btn.disabled = false; if (r.ok) return go(); err.textContent = r.d.message || 'تعذر الدخول'; code.value = ''; code.focus(); } },
    h('img', { src: 'assets/logo-symbol.svg', alt: '', width: 56, height: 56 }), h('h1', null, 'دخول'),
    h('div', { class: 'field' }, h('label', { for: 'n' }, 'الاسم'), name), h('div', { class: 'field' }, h('label', { for: 'c' }, 'الرقم'), code), err, btn);
  const wrap = h('div', { class: 'login-wrap' }, h('div', null, form));
  root.replaceChildren(wrap);
  api('GET', 'api/auth/me').then((r) => { if (r.ok && r.d.role) go(); });
  api('GET', 'api/demo/accounts').then((r) => {
    if (!r.ok) return;
    const fill = (a) => { name.value = a.name; code.value = a.code; code.focus(); };
    const box = h('div', { class: 'card login-card demo-box' }, h('h2', null, 'حسابات تجريبية'), h('p', { class: 'small muted' }, 'تظهر في النسخة التجريبية فقط. في النسخة الفعلية يولّد المشرف الأول الاسم والرقم.'),
      h('ul', { class: 'demo-list' }, r.d.accounts.map((a) => h('li', null, h('button', { type: 'button', class: 'btn sm secondary', onclick: () => fill(a) }, (a.label || a.key) + ' · ' + ({ super_admin: 'مشرف أول', supervisor: 'مشرف', tech: 'مشرف تقني' }[a.role] || a.role)), h('div', { class: 'small', dir: 'ltr' }, a.name + '  /  ' + a.code)))));
    wrap.firstChild.append(box);
  });
})();
