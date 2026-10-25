// Ghousia — live 3D theatre.
// Heavy work (textures, geometry, shader compile, GPU upload) happens behind the preloader,
// then one shared ticker drives scroll → UI → 3D in the same frame so nothing lags the page.
import * as THREE from 'three';
import { makeStage } from './stage.js';
import { biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad, degh, spiceCloud, tickOrbiters, setQuality } from './dishes.js';
import { smoke } from './textures.js';

const GH = (window.GH ||= { tickers: [], progress() {}, done() {} });
const canvas = document.getElementById('gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QA = /[?&]qa\b/.test(location.search);

/* ---------- device tier ---------- */
const coarse = matchMedia('(pointer: coarse)').matches;
const LOW = coarse || innerWidth < 900 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const TIER = LOW
  ? { rice: 0.5, shadow: 512, dpr: 1.25, steam: 8, embers: 60 }
  : { rice: 0.85, shadow: 1024, dpr: 1.5, steam: 14, embers: 120 };
setQuality({ rice: TIER.rice, tier: LOW ? 'low' : 'high' });

const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const DWELL = 0.22;
function dwell(raw) { const i = Math.floor(raw), f = raw - i; return i + ease(clamp((f - DWELL) / (1 - DWELL * 2))); }

/* ---------- WebGL guard ---------- */
let stage;
try { stage = makeStage(canvas, { shadowSize: TIER.shadow }); }
catch (e) { GH.progress(1); GH.done(); canvas.remove(); throw e; }
const { renderer, scene, camera, fitShadow } = stage;
const DIST = camera.position.length(), RADIUS = 1.75;
GH.progress(0.12);

/* ---------- steam ---------- */
let puffs = null;
class Steam {
  constructor(count) {
    puffs ||= smoke();
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: puffs[i % puffs.length], transparent: true, depthWrite: false, opacity: 0, color: 0xfff3e2 });
      m.rotation = Math.random() * 6.28;
      const s = new THREE.Sprite(m); s.renderOrder = 5; s.visible = false; scene.add(s);
      this.items.push({ s, life: i / count, speed: 0.09 + Math.random() * 0.06, dx: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.3 });
    }
  }
  update(dt, origin, scale, strength, t) {
    const on = strength > 0.01;
    for (const p of this.items) {
      p.s.visible = on; if (!on) continue;
      p.life += dt * p.speed; if (p.life > 1) { p.life -= 1; p.dx = (Math.random() - 0.5) * 0.5; }
      const L = p.life, curl = Math.sin(t * 0.7 + p.ph + L * 4) * 0.14 * L;
      p.s.position.set(origin.x + (p.dx * L + curl) * scale, origin.y + L * 1.6 * scale, origin.z + p.dx * 0.25 * scale);
      const sz = (0.32 + L * 1.3) * scale; p.s.scale.set(sz, sz * 1.15, 1);
      p.s.material.rotation += p.rot * dt;
      p.s.material.opacity = Math.sin(Math.PI * L) * Math.min(1, L * 4) * 0.3 * strength;
    }
  }
}

/* ---------- objects (built during preload) ---------- */
const heroFactories = [biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad];
const baseRot = [0.5, -0.4, 0.2, 0.6, 0.3, 0.1];
const N = heroFactories.length;
const hero = [], steams = [];
let spices, pot, potSteam = [];

const EMB = TIER.embers;
const embGeo = new THREE.BufferGeometry();
const embPos = new Float32Array(EMB * 3), embSp = new Float32Array(EMB);
for (let i = 0; i < EMB; i++) { embPos[i * 3] = (Math.random() - 0.5) * 14; embPos[i * 3 + 1] = (Math.random() - 0.5) * 9; embPos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1; embSp[i] = 0.08 + Math.random() * 0.28; }
embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ size: 0.06, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
scene.add(embers);

async function preload() {
  const steps = [
    ...heroFactories.map((f, i) => () => { const d = f(); d.visible = false; scene.add(d); hero[i] = d; steams[i] = d.userData.steam.map(() => new Steam(TIER.steam)); }),
    () => { spices = spiceCloud(); spices.visible = false; scene.add(spices); },
    () => { pot = degh(); pot.visible = false; scene.add(pot); potSteam = pot.userData.steam.map(() => new Steam(TIER.steam)); },
  ];
  for (let k = 0; k < steps.length; k++) { await yieldFrame(); steps[k](); GH.progress(0.12 + 0.6 * ((k + 1) / steps.length)); }

  // compile every shader and upload every buffer now, so no dish ever hitches on first appearance
  const all = [...hero, spices, pot];
  all.forEach((o) => { o.visible = true; o.position.set(0, 0, 0); o.scale.setScalar(0.01); });
  await yieldFrame();
  if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch (e) { /* fall through */ } }
  else renderer.compile(scene, camera);
  GH.progress(0.88);
  await yieldFrame();
  fitShadow(hero[0], RADIUS);
  renderer.render(scene, camera);          // warm-up frame: geometry + textures to the GPU, shadow program too
  all.forEach((o) => (o.visible = false));
  renderer.clear();
  GH.progress(1);
}

/* ---------- sizing + adaptive resolution ---------- */
let vw = innerWidth, vh = innerHeight;
const maxDpr = Math.min(devicePixelRatio || 1, TIER.dpr);
let dpr = maxDpr;
function resize() {
  vw = innerWidth; vh = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
}
let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 120); }); resize();
let ftAvg = 16.7, ftFrames = 0;
function adapt(ms) {
  if (QA) return;
  ftAvg = ftAvg * 0.95 + Math.min(ms, 60) * 0.05; ftFrames++;
  if (ftFrames < 60) return;
  if (ftAvg > 19.5 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.15); resize(); ftFrames = 0; }
  else if (ftAvg < 14 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.1); resize(); ftFrames = 0; }
}

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmpV = new THREE.Vector3(), ndc = new THREE.Vector2();
function worldAt(px, py, out) { ndc.set((px / vw) * 2 - 1, -(py / vh) * 2 + 1); ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, out); return out; }
function pxToWorld() { return (2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / vh; }
function anchorOf(el) { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: Math.min(r.width, r.height), top: r.top, bottom: r.bottom }; }

/* ---------- DOM hooks ---------- */
const theatre = document.getElementById('theatre');
const heroAnchor = document.querySelector('[data-anchor="hero"]');
const spiceAnchor = document.querySelector('[data-anchor="spices"]');
const deghAnchor = document.querySelector('[data-anchor="degh"]');
let p = 0, mx = 0, my = 0, smx = 0, smy = 0, spIn = 0, dgIn = 0;
addEventListener('pointermove', (e) => { mx = e.clientX / vw - 0.5; my = e.clientY / vh - 0.5; }, { passive: true });
window.__theatre = { get progress() { return p; }, dwell };
function rawProgress() { const r = theatre.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - vh)) * (N - 1); }

const wp = new THREE.Vector3();
function place(obj, a, scaleMul) {
  worldAt(a.cx, a.cy, wp); obj.position.copy(wp);
  const s = ((a.size * 0.5) * pxToWorld() / RADIUS) * scaleMul; obj.scale.setScalar(Math.max(0.0001, s));
  return s;
}

/* ---------- frame ---------- */
let t = 0, last = 0, wasIdle = false, ready = false, qaKey = '', qaHold = 0;
function frame(now) {
  if (!ready || document.hidden) { last = 0; return; }
  if (QA) { const k = scrollY + ''; if (k === qaKey && ++qaHold > 2) return; if (k !== qaKey) { qaKey = k; qaHold = 0; } }
  const dt = QA ? 0.016 : Math.min(0.05, (now - (last || now)) / 1000); last = now;
  t += reduce ? 0 : dt;

  const target = dwell(rawProgress());
  p = reduce || QA ? target : damp(p, target, 10, dt);
  smx = damp(smx, mx, 3, dt); smy = damp(smy, my, 3, dt);

  const ha = anchorOf(heroAnchor), sa = anchorOf(spiceAnchor), da = anchorOf(deghAnchor);
  const heroOn = ha.bottom > -vh * 0.3 && ha.top < vh * 1.3;
  const spOn = sa.bottom > -vh * 0.25 && sa.top < vh * 1.25;
  const dgOn = da.bottom > -vh * 0.25 && da.top < vh * 1.25;
  spIn = damp(spIn, spOn ? 1 : 0, 4, dt); dgIn = damp(dgIn, dgOn ? 1 : 0, 4, dt);

  if (!(heroOn || spIn > 0.01 || dgIn > 0.01)) {
    if (!wasIdle) { renderer.clear(); wasIdle = true; canvas.style.opacity = '0'; }
    return;
  }
  if (wasIdle) { wasIdle = false; canvas.style.opacity = '1'; }

  let shadowObj = null, shadowR = 0, best = 0;
  for (let i = 0; i < N; i++) {
    const d = hero[i], k = p - i, s = 1 - ease(Math.min(1, Math.abs(k)));
    const vis = heroOn && s > 0.002; d.visible = vis;
    if (vis) {
      const sc = place(d, ha, 0.45 + 0.55 * s);
      d.position.y += k * 2.1 * sc + Math.sin(t * 0.9 + i) * 0.025 * sc;
      d.position.x += k * -0.35 * sc;
      d.rotation.set(0.12 + smy * 0.22 + k * 0.35, baseRot[i] + k * 1.9 + t * 0.1 + smx * 0.45, smx * -0.05 + k * 0.08);
      tickOrbiters(d, t, dt);
      if (s > best) { best = s; shadowObj = d; shadowR = RADIUS * d.scale.x; }
    }
    d.userData.steam.forEach((o, j) => steams[i][j].update(dt, vis ? d.localToWorld(tmpV.copy(o)) : tmpV, d.scale.x, vis ? s : 0, t));
  }

  spices.visible = spIn > 0.01;
  if (spices.visible) {
    place(spices, sa, 0.85 * (0.6 + 0.4 * spIn));
    spices.rotation.set(smy * 0.2, t * 0.07 + smx * 0.55, 0);
    tickOrbiters(spices, t, dt);
    if (!shadowObj) { shadowObj = spices; shadowR = RADIUS * 1.4 * spices.scale.x; }
  }
  pot.visible = dgIn > 0.01;
  if (pot.visible) {
    place(pot, da, 0.95 * (0.7 + 0.3 * dgIn));
    pot.position.y += Math.sin(t * 0.8) * 0.02 * pot.scale.x;
    pot.rotation.set(0.1 + smy * 0.15, -0.4 + t * 0.12 + smx * 0.4, 0);
    if (!shadowObj) { shadowObj = pot; shadowR = RADIUS * pot.scale.x; }
  }
  pot.userData.steam.forEach((o, j) => potSteam[j].update(dt, pot.visible ? pot.localToWorld(tmpV.copy(o)) : tmpV, pot.scale.x, pot.visible ? dgIn : 0, t));

  if (heroOn || pot.visible) {
    const pos = embGeo.attributes.position;
    for (let i = 0; i < EMB; i++) { let y = pos.getY(i) + embSp[i] * dt; if (y > 4.5) y = -4.5; pos.setY(i, y); }
    pos.needsUpdate = true; embers.visible = true;
  } else embers.visible = false;

  fitShadow(shadowObj, shadowR);
  renderer.render(scene, camera);
  adapt(dt * 1000);
}

/* ---------- boot ---------- */
preload().then(() => {
  ready = true;
  canvas.classList.add('is-ready');
  if (QA) (function qaLoop() { frame(performance.now()); setTimeout(qaLoop, 1500); })();
  else if (GH.tickers) GH.tickers.push(frame);
  else (function loop(n) { frame(n); requestAnimationFrame(loop); })(0);
  if (/[?&]perf\b/.test(location.search)) {
    const out = {};
    for (let i = 0; i < N; i++) {
      hero.forEach((h) => (h.visible = false)); hero[i].visible = true; hero[i].position.set(0, 0, 0); hero[i].scale.setScalar(1);
      fitShadow(hero[i], RADIUS); renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera);
      out['dish' + i] = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; renderer.info.autoReset = true;
    }
    hero.forEach((h) => (h.visible = false));
    window.__perf = out;
  }
  GH.done();
});
