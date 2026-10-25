// Ghousia — live 3D theatre. Objects are pinned to DOM anchors so layout stays in CSS.
import * as THREE from 'three';
import { makeStage } from './stage.js';
import { biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad, degh, spiceCloud, tickOrbiters, setQuality } from './dishes.js';
import { smoke } from './textures.js';

const canvas = document.getElementById('gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QA = /[?&]qa\b/.test(location.search);
const small = innerWidth < 760;
const next = (f) => (QA ? setTimeout(f, 1500) : requestAnimationFrame(f));
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 60));
setQuality({ rice: small ? 0.62 : 1 });

const { renderer, scene, camera } = makeStage(canvas);
const DIST = camera.position.length();
const RADIUS = 1.75;

/* ---------- smooth helpers ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
// each dish rests for the first/last 22% of its scroll segment, then hands off with an ease
const DWELL = 0.22;
export function dwell(raw) {
  const i = Math.floor(raw), f = raw - i;
  return i + ease(clamp((f - DWELL) / (1 - DWELL * 2)));
}

/* ---------- lazy object registry ---------- */
const heroFactories = [biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad];
const baseRot = [0.5, -0.4, 0.2, 0.6, 0.3, 0.1];
const N = heroFactories.length;
const hero = new Array(N).fill(null);
let spices = null, pot = null;
const steams = new Array(N).fill(null);
let potSteam = [];

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
      this.items.push({ s, life: Math.random(), speed: 0.09 + Math.random() * 0.07, dx: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.35 });
    }
  }
  update(dt, origin, scale, strength, t) {
    const on = strength > 0.01;
    for (const p of this.items) {
      p.s.visible = on; if (!on) continue;
      p.life += dt * p.speed; if (p.life > 1) { p.life -= 1; p.dx = (Math.random() - 0.5) * 0.5; }
      const L = p.life, curl = Math.sin(t * 0.7 + p.ph + L * 4) * 0.14 * L;
      p.s.position.set(origin.x + (p.dx * L + curl) * scale, origin.y + L * 1.6 * scale, origin.z + p.dx * 0.25 * scale);
      const sz = (0.3 + L * 1.25) * scale; p.s.scale.set(sz, sz * 1.15, 1);
      p.s.material.rotation += p.rot * dt;
      p.s.material.opacity = Math.sin(Math.PI * L) * Math.min(1, L * 4) * 0.26 * strength;
    }
  }
}
const steamCount = reduce ? 8 : small ? 18 : 28;

function buildHero(i) {
  if (hero[i]) return hero[i];
  const d = heroFactories[i](); d.visible = false; scene.add(d); hero[i] = d;
  steams[i] = d.userData.steam.map(() => new Steam(steamCount));
  if (renderer.compileAsync) renderer.compileAsync(d, camera, scene).catch(() => {});
  return d;
}
function buildSpices() { if (!spices) { spices = spiceCloud(); spices.visible = false; scene.add(spices); } return spices; }
function buildPot() { if (!pot) { pot = degh(); pot.visible = false; scene.add(pot); potSteam = pot.userData.steam.map(() => new Steam(steamCount)); } return pot; }

// first dish immediately, the rest one per idle slot so the first screen never stalls
buildHero(0);
const queue = [1, 2, 3, 4, 5, 'spices', 'pot'];
(function drain() {
  if (!queue.length) return;
  idle(() => { const k = queue.shift(); if (k === 'spices') buildSpices(); else if (k === 'pot') buildPot(); else buildHero(k); drain(); });
})();

/* ---------- embers ---------- */
const EMB = small ? 90 : 160;
const embGeo = new THREE.BufferGeometry();
const embPos = new Float32Array(EMB * 3), embSp = new Float32Array(EMB);
for (let i = 0; i < EMB; i++) { embPos[i * 3] = (Math.random() - 0.5) * 14; embPos[i * 3 + 1] = (Math.random() - 0.5) * 9; embPos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1; embSp[i] = 0.08 + Math.random() * 0.28; }
embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ size: 0.06, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
scene.add(embers);

/* ---------- sizing + adaptive resolution ---------- */
let vw = innerWidth, vh = innerHeight;
const maxDpr = Math.min(devicePixelRatio || 1, small ? 1.6 : 1.8);
let dpr = maxDpr;
function resize() {
  vw = innerWidth; vh = innerHeight;
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
let ftAvg = 16, ftFrames = 0;
function adapt(ms) {
  if (QA) return;
  ftAvg = ftAvg * 0.94 + ms * 0.06; ftFrames++;
  if (ftFrames < 45) return;
  if (ftAvg > 24 && dpr > 0.9) { dpr = Math.max(0.85, dpr - 0.2); resize(); ftFrames = 0; }
  else if (ftAvg < 13 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.1); resize(); ftFrames = 0; }
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

/* ---------- loop ---------- */
const clock = new THREE.Clock(); let t = 0, wasIdle = false, running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); next(frame); } });
const wp = new THREE.Vector3();
function place(obj, a, scaleMul) {
  worldAt(a.cx, a.cy, wp); obj.position.copy(wp);
  const s = ((a.size * 0.5) * pxToWorld() / RADIUS) * scaleMul; obj.scale.setScalar(Math.max(0.0001, s));
  return s;
}

let qaKey = '', qaHold = 0;
function frame() {
  if (!running) return;
  if (QA) { const k = scrollY + ':' + queue.length; if (k === qaKey && ++qaHold > 2) { next(frame); return; } if (k !== qaKey) { qaKey = k; qaHold = 0; } }
  const t0 = performance.now();
  const dt = QA ? 0.016 : Math.min(0.05, clock.getDelta()); t += reduce ? 0 : dt;

  const target = dwell(rawProgress());
  p = reduce || QA ? target : damp(p, target, 9, dt);
  smx = damp(smx, mx, 3.2, dt); smy = damp(smy, my, 3.2, dt);

  const ha = anchorOf(heroAnchor), sa = anchorOf(spiceAnchor), da = anchorOf(deghAnchor);
  const heroOn = ha.bottom > -vh * 0.3 && ha.top < vh * 1.3;
  const spOn = sa.bottom > -vh * 0.25 && sa.top < vh * 1.25;
  const dgOn = da.bottom > -vh * 0.25 && da.top < vh * 1.25;

  if (!(heroOn || spOn || dgOn)) {
    if (!wasIdle) { renderer.clear(); wasIdle = true; canvas.style.opacity = '0'; }
    next(frame); return;
  }
  if (wasIdle) { wasIdle = false; canvas.style.opacity = '1'; }

  // hero dishes: outgoing lifts away, incoming rises from below and settles
  for (let i = 0; i < N; i++) {
    const k = p - i, a = Math.min(1, Math.abs(k)), s = 1 - ease(a);
    const need = heroOn && s > 0.002;
    const d = need ? buildHero(i) : hero[i];
    if (!d) continue;
    d.visible = need;
    if (need) {
      const sc = place(d, ha, 0.45 + 0.55 * s);
      d.position.y += k * 2.1 * sc + Math.sin(t * 0.9 + i) * 0.025 * sc;
      d.position.x += k * -0.35 * sc;
      d.rotation.set(0.12 + smy * 0.22 + k * 0.35, baseRot[i] + k * 1.9 + t * 0.1 + smx * 0.45, smx * -0.05 + k * 0.08);
      tickOrbiters(d, t, dt);
    }
    d.userData.steam.forEach((o, j) => { steams[i][j].update(dt, d.localToWorld(tmpV.copy(o)), d.scale.x, need ? s : 0, t); });
  }

  // spice cloud: eases in as the section arrives
  spIn = damp(spIn, spOn ? 1 : 0, 4, dt);
  if (spOn || spIn > 0.01) {
    const sp = buildSpices(); sp.visible = spIn > 0.01;
    place(sp, sa, 0.85 * (0.6 + 0.4 * spIn));
    sp.rotation.set(smy * 0.2, t * 0.07 + smx * 0.55, 0);
    tickOrbiters(sp, t, dt);
  } else if (spices) spices.visible = false;

  // degh
  dgIn = damp(dgIn, dgOn ? 1 : 0, 4, dt);
  if (dgOn || dgIn > 0.01) {
    const pt = buildPot(); pt.visible = dgIn > 0.01;
    place(pt, da, 0.95 * (0.7 + 0.3 * dgIn));
    pt.position.y += Math.sin(t * 0.8) * 0.02 * pt.scale.x;
    pt.rotation.set(0.1 + smy * 0.15, -0.4 + t * 0.12 + smx * 0.4, 0);
  } else if (pot) pot.visible = false;
  if (pot) pot.userData.steam.forEach((o, j) => potSteam[j].update(dt, pot.localToWorld(tmpV.copy(o)), pot.scale.x, pot.visible ? dgIn : 0, t));

  // embers drift upward
  const pos = embGeo.attributes.position;
  for (let i = 0; i < EMB; i++) { let y = pos.getY(i) + embSp[i] * dt; if (y > 4.5) y = -4.5; pos.setY(i, y); pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + i) * 0.0015); }
  pos.needsUpdate = true;
  embers.visible = heroOn || dgOn;

  renderer.render(scene, camera);
  adapt(dt * 1000);
  next(frame);
}
const startRender = () => { canvas.classList.add('is-ready'); frame(); };
if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(() => requestAnimationFrame(startRender), () => requestAnimationFrame(startRender));
else requestAnimationFrame(startRender);
