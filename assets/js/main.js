// Ghousia Nalli Biryani — UI: scroll sync, story reveal, live hours, WhatsApp order builder
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const WA = '923002106954';
  const fmt = (n) => 'Rs. ' + n.toLocaleString('en-PK');

  /* ---------- nav ---------- */
  const nav = $('#nav');
  /* ---------- theatre ---------- */
  const theatre = $('#theatre');
  const slides = $$('.slide'), words = $$('.word'), idxBtns = $$('.dish-index button'), bar = $('[data-bar]');
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
    scrollTo({ top: top + 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }));

  /* ---------- story reveal ---------- */
  const reveal = $('[data-reveal]'); const units = [];
  if (reveal) {
    const nodes = Array.from(reveal.childNodes); reveal.textContent = '';
    nodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { reveal.appendChild(document.createTextNode(' ')); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = part; reveal.appendChild(s); units.push(s);
        });
      } else { reveal.appendChild(n); if (n.classList && n.classList.contains('chip')) units.push(n); }
    });
  }
  function updateReveal() {
    if (!reveal) return;
    const r = reveal.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3));
    const lit = Math.round(p * units.length);
    for (let i = 0; i < units.length; i++) units[i].classList.toggle('on', i < lit);
  }

  /* ---------- scroll loop ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      nav.classList.toggle('is-solid', scrollY > 40);
      const p = (window.__theatre ? window.__theatre.progress : rawProgress());
      const raw = rawProgress();
      setActive(Math.round(clamp(raw, 0, N - 1)));
      if (bar) bar.style.transform = `scaleX(${(p / (N - 1)).toFixed(4)})`;
      updateReveal();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  // keep the progress bar in step with the eased 3D progress
  (function barLoop() { if (window.__theatre && bar) { const p = window.__theatre.progress; bar.style.transform = `scaleX(${(p / (N - 1)).toFixed(4)})`; } requestAnimationFrame(barLoop); })();

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
