// Ghousia Nalli Biryani — UI: scroll sync, story reveal, live hours, WhatsApp order builder
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const WA = '923002106954';
  const fmt = (n) => 'Rs. ' + n.toLocaleString('en-PK');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const QA = /[?&]qa\b/.test(location.search);

  /* ---------- one master ticker: scroll → UI → 3D, all in the same frame ---------- */
  const GH = (window.GH = window.GH || {});
  GH.tickers = GH.tickers || [];
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.085, touchInertiaMultiplier: 28 });
    window.__lenis = lenis;
  }
  function tick(now) {
    if (lenis) lenis.raf(now);
    ui(now);
    for (let i = 0; i < GH.tickers.length; i++) GH.tickers[i](now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const goTo = (target) => { if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) }); else if (typeof target === 'number') scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' }); else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); const el = id.length > 1 ? document.querySelector(id) : document.body;
    if (!el) return; e.preventDefault(); goTo(id === '#top' ? 0 : el);
  }));

  /* ---------- preloader ---------- */
  const pre = $('[data-preloader]'), preNum = $('[data-pre-num]'), preRing = $('[data-pre-ring]'), preMsg = $('[data-pre-msg]');
  const MSGS = ['Lighting the fire', 'Slow-cooking the shank', 'Layering the basmati', 'Sealing the dum', 'Plating the nalli'];
  let target = 0, shown = 0, sceneDone = false, fontsDone = false, revealed = false;
  const t0 = performance.now();
  const sceneW = 0.85;
  let sceneP = 0;
  GH.progress = (v) => { sceneP = Math.max(sceneP, v); target = (fontsDone ? 0.15 : 0) + sceneW * sceneP; };
  GH.done = () => { sceneDone = true; GH.progress(1); };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsDone = true; GH.progress(sceneP); });
  if (lenis && pre) lenis.stop();
  function reveal() {
    if (revealed) return; revealed = true;
    document.documentElement.classList.remove('is-loading');
    document.documentElement.classList.add('is-loaded');
    if (lenis) lenis.start();
    if (pre) setTimeout(() => pre.remove(), 1600);
    setTimeout(() => document.documentElement.classList.add('intro-done'), 2600);
  }
  function preTick(now) {
    if (revealed || !pre) return;
    shown += (target - shown) * 0.12;
    if (target - shown < 0.002) shown = target;
    const pct = Math.round(shown * 100);
    if (preNum) preNum.textContent = String(pct).padStart(2, '0');
    if (preRing) preRing.style.strokeDashoffset = String(1 - shown);
    if (preMsg) preMsg.textContent = MSGS[Math.min(MSGS.length - 1, Math.floor(shown * MSGS.length))];
    const minTime = now - t0 > 1100;
    if (shown >= 0.999 && sceneDone && fontsDone && minTime) reveal();
  }
  // safety nets: never trap the visitor behind the loader
  setTimeout(() => { sceneDone = true; fontsDone = true; target = 1; }, QA ? 60000 : 12000);
  if (!pre) reveal();

  /* ---------- nav ---------- */
  const nav = $('#nav');
  /* ---------- theatre ---------- */
  const theatre = $('#theatre');
  const slides = $$('.slide'), words = $$('.word'), idxBtns = $$('.dish-index button'), bar = $('[data-bar]');
  words.forEach((w) => {
    const txt = w.textContent; w.textContent = '';
    [...txt].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i); s.textContent = ch; w.appendChild(s); });
    w.classList.add('is-split');
  });
  slides.forEach((sl) => Array.from(sl.children).forEach((c, i) => c.style.setProperty('--d', i)));
  const N = slides.length; let active = 0;
  function setActive(i) {
    if (i === active) return; active = i;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    words.forEach((w, k) => { w.classList.toggle('is-active', k === i); w.classList.toggle('is-past', k < i); });
    idxBtns.forEach((b, k) => b.classList.toggle('is-active', k === i));
  }
  function rawProgress() {
    const r = theatre.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight)) * (N - 1);
  }
  idxBtns.forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.go; const top = theatre.offsetTop + (i / (N - 1)) * (theatre.offsetHeight - innerHeight);
    goTo(top + 2);
  }));

  /* ---------- story reveal (only touches the words that change) ---------- */
  const reveal_ = $('[data-reveal]'); const units = [];
  if (reveal_) {
    const nodes = Array.from(reveal_.childNodes); reveal_.textContent = '';
    nodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { reveal_.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = part; reveal_.appendChild(s); units.push(s);
        });
      } else { reveal_.appendChild(n); if (n.classList && n.classList.contains('chip')) units.push(n); }
    });
  }
  let lit = 0;
  function updateReveal() {
    if (!reveal_) return;
    const r = reveal_.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < -vh || r.top > vh * 2) return;
    const want = Math.round(clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3)) * units.length);
    if (want === lit) return;
    const [a, b, on] = want > lit ? [lit, want, true] : [want, lit, false];
    for (let i = a; i < b; i++) units[i].classList.toggle('on', on);
    lit = want;
  }

  /* ---------- per-frame UI (driven by the master ticker) ---------- */
  let lastY = -1, solid = false, lastBar = -1;
  function ui(now) {
    preTick(now);
    const y = window.scrollY;
    if (y !== lastY) {
      lastY = y;
      const s = y > 40; if (s !== solid) { solid = s; nav.classList.toggle('is-solid', s); }
      updateReveal();
      if (!window.__theatre) setActive(Math.round(clamp(rawProgress(), 0, N - 1)));
    }
    if (window.__theatre) {
      const p = window.__theatre.progress;
      setActive(Math.round(clamp(p, 0, N - 1)));
      const b = Math.round((p / (N - 1)) * 1000) / 1000;
      if (bar && b !== lastBar) { lastBar = b; bar.style.transform = 'scaleX(' + b + ')'; }
    }
  }

  /* ---------- live hours (Asia/Karachi) ---------- */
  const status = $('[data-status]'), statusText = $('[data-status-text]');
  function karachiNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    return { day: get('weekday'), mins: (+get('hour') % 24) * 60 + +get('minute') };
  }
  function updateStatus() {
    if (!status) return;
    const { day, mins } = karachiNow();
    const openDay = day !== 'Sun';
    const open = openDay && mins >= 660 && mins < 1380;
    const delivering = openDay && mins >= 750 && mins < 1320;
    status.classList.toggle('is-open', open);
    if (open) statusText.textContent = delivering ? 'Open · delivering now' : 'Open now · delivery from 12:30';
    else if (day === 'Sun') statusText.textContent = 'Closed Sunday · opens Mon 11 AM';
    else if (mins < 660) statusText.textContent = 'Opens today 11 AM';
    else statusText.textContent = day === 'Sat' ? 'Closed · opens Mon 11 AM' : 'Closed · opens 11 AM';
  }
  updateStatus(); setInterval(updateStatus, 60000);
  const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();

  /* ---------- menu + cart ---------- */
  const PORTIONS = { '1p': ['1 Paou', 300], '1.5p': ['1.5 Paou', 450], half: ['0.5 KG', 600], '3p': ['3 Paou', 900], '1kg': ['1 KG', 1200] };
  const ITEMS = {
    biryani: { name: 'Beef Nalli Biryani', portions: true },
    pulao: { name: 'Beef Pulao', portions: true },
    nalli: { name: 'Per-Piece Nalli', price: 300 },
    kheer: { name: 'Kheer Box', price: 200 },
    zarda: { name: 'Zarda (200 g)', price: 200 },
    raita: { name: 'Raita', price: 60 },
    salad: { name: 'Salad', price: 70 },
  };
  const KEY = 'ghousia-order-v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => ITEMS[l.id]); } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const lineKey = (id, portion) => id + (portion ? ':' + portion : '');
  const unitPrice = (l) => (ITEMS[l.id].portions ? PORTIONS[l.portion][1] : ITEMS[l.id].price);
  const total = () => cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0);
  const count = () => cart.reduce((s, l) => s + l.qty, 0);

  function add(id, portion) {
    if (ITEMS[id].portions && !PORTIONS[portion]) portion = '1kg';
    if (!ITEMS[id].portions) portion = undefined;
    const k = lineKey(id, portion);
    const l = cart.find((x) => lineKey(x.id, x.portion) === k);
    if (l) l.qty++; else cart.push({ id, portion, qty: 1 });
    save(); render(true);
  }

  // portion pickers
  $$('.card').forEach((card) => {
    const btns = $$('.portions button', card), price = $('[data-price]', card), addBtn = $('.card-foot .add', card);
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      const p = PORTIONS[b.dataset.portion]; if (price) price.textContent = fmt(p[1]);
      if (addBtn) addBtn.dataset.portion = b.dataset.portion;
    }));
    // arrow-key support for the radiogroup
    btns.forEach((b, i) => b.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return; e.preventDefault();
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length]; n.focus(); n.click();
    }));
  });

  $$('[data-add]').forEach((b) => b.addEventListener('click', () => {
    add(b.dataset.add, b.dataset.portion || '1kg');
    const label = b.childNodes[0];
    b.classList.add('is-added');
    if (label && label.nodeType === 3 && label.textContent.trim()) {
      const orig = b.dataset.label || (b.dataset.label = label.textContent);
      label.textContent = 'Added ';
      clearTimeout(b._t); b._t = setTimeout(() => { label.textContent = orig; b.classList.remove('is-added'); }, 1400);
    } else { clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('is-added'), 1400); }
  }));

  const tray = $('[data-tray]'), dlg = $('[data-order]'), list = $('[data-list]'), empty = $('[data-empty]'), send = $('[data-send]');
  function render(bump) {
    const c = count();
    tray.hidden = c === 0;
    $$('[data-count]').forEach((e) => (e.textContent = c));
    $$('[data-total]').forEach((e) => (e.textContent = fmt(total())));
    if (bump) { tray.classList.remove('bump'); void tray.offsetWidth; tray.classList.add('bump'); }
    list.textContent = '';
    cart.forEach((l, i) => {
      const li = document.createElement('li');
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = ITEMS[l.id].name;
      if (l.portion) { const sm = document.createElement('small'); sm.textContent = PORTIONS[l.portion][0] + ' · ' + fmt(PORTIONS[l.portion][1]); nm.appendChild(sm); }
      else { const sm = document.createElement('small'); sm.textContent = fmt(ITEMS[l.id].price) + ' each'; nm.appendChild(sm); }
      const st = document.createElement('span'); st.className = 'step';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Remove one ' + ITEMS[l.id].name);
      const out = document.createElement('output'); out.textContent = l.qty;
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Add one ' + ITEMS[l.id].name);
      minus.onclick = () => { l.qty--; if (l.qty <= 0) cart.splice(i, 1); save(); render(); };
      plus.onclick = () => { l.qty++; save(); render(); };
      st.append(minus, out, plus);
      const amt = document.createElement('span'); amt.className = 'amt'; amt.textContent = fmt(unitPrice(l) * l.qty);
      li.append(nm, st, amt); list.appendChild(li);
    });
    empty.hidden = c > 0; send.disabled = c === 0;
  }
  render();

  $('[data-open-order]').addEventListener('click', () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('[data-clear]').addEventListener('click', () => { cart = []; save(); render(); });
  send.addEventListener('click', () => {
    if (!cart.length) return;
    const f = $('[data-order-form]');
    const name = f.elements.name.value.trim(), addr = f.elements.address.value.trim();
    const lines = cart.map((l) => `• ${ITEMS[l.id].name}${l.portion ? ' — ' + PORTIONS[l.portion][0] : ''} × ${l.qty} = ${fmt(unitPrice(l) * l.qty)}`);
    const msg = ['Assalam o Alaikum! I would like to order:', '', ...lines, '', `Total: ${fmt(total())} (plus delivery)`, '', `Name: ${name || ''}`, `Address: ${addr || ''}`].join('\n');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });
})();
