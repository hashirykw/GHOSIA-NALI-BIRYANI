// Ghousia — live 3D theatre. Objects are pinned to DOM anchors so layout stays in CSS.
import * as THREE from 'three';
import { makeStage } from './stage.js';
import { biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad, degh, spiceCloud, tickOrbiters } from './dishes.js';

const canvas = document.getElementById('gl');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QA = /[?&]qa\b/.test(location.search);
const next = (f) => (QA ? setTimeout(f, 1500) : requestAnimationFrame(f));
const { renderer, scene, camera } = makeStage(canvas);
const DIST = camera.position.length();

/* ---------- objects ---------- */
const heroDishes = [biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad].map((f) => f());
const baseRot = [0.5, -0.4, 0.2, 0.6, 0.3, 0.1];
heroDishes.forEach((d) => { d.visible = false; scene.add(d); });
const spices = spiceCloud(); spices.visible = false; scene.add(spices);
const pot = degh(); pot.visible = false; scene.add(pot);
const RADIUS = 1.75; // nominal object radius in world units

/* ---------- steam ---------- */
const steamTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,248,235,0.55)'); gr.addColorStop(0.45, 'rgba(255,240,220,0.18)'); gr.addColorStop(1, 'rgba(255,240,220,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
class Steam {
  constructor(count = 34) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m); s.renderOrder = 5; scene.add(s);
      this.items.push({ s, life: Math.random(), speed: 0.12 + Math.random() * 0.1, dx: (Math.random() - 0.5) * 0.6, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.4 });
    }
  }
  update(dt, origin, scale, strength, t) {
    for (const p of this.items) {
      p.life += dt * p.speed; if (p.life > 1) { p.life -= 1; p.dx = (Math.random() - 0.5) * 0.6; }
      const L = p.life;
      p.s.position.set(origin.x + (p.dx * L + Math.sin(t * 0.8 + p.ph + L * 3) * 0.12) * scale, origin.y + L * 1.5 * scale, origin.z + p.dx * 0.3 * scale);
      const sz = (0.35 + L * 1.15) * scale; p.s.scale.set(sz, sz, 1);
      p.s.material.rotation += p.rot * dt;
      p.s.material.opacity = Math.sin(Math.PI * L) * Math.min(1, L * 3) * 0.2 * strength;
      p.s.visible = strength > 0.01;
    }
  }
}
const steams = heroDishes.map((d) => d.userData.steam.map(() => new Steam(reduce ? 10 : 30)));
const potSteam = pot.userData.steam.map(() => new Steam(reduce ? 10 : 30));

/* ---------- embers ---------- */
const EMB = 160;
const embGeo = new THREE.BufferGeometry();
const embPos = new Float32Array(EMB * 3); const embSp = new Float32Array(EMB);
for (let i = 0; i < EMB; i++) { embPos[i * 3] = (Math.random() - 0.5) * 14; embPos[i * 3 + 1] = (Math.random() - 0.5) * 9; embPos[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1; embSp[i] = 0.1 + Math.random() * 0.35; }
embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ size: 0.07, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
scene.add(embers);

/* ---------- layout helpers ---------- */
let vw = innerWidth, vh = innerHeight;
function resize() {
  vw = innerWidth; vh = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, vw < 760 ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr); renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), tmpV = new THREE.Vector3(), ndc = new THREE.Vector2();
function worldAt(px, py, out) {
  ndc.set((px / vw) * 2 - 1, -(py / vh) * 2 + 1);
  ray.setFromCamera(ndc, camera); ray.ray.intersectPlane(plane, out); return out;
}
function pxToWorld() { return (2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / vh; }
function anchorOf(el) {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: Math.min(r.width, r.height), top: r.top, bottom: r.bottom };
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* ---------- DOM hooks ---------- */
const theatre = document.getElementById('theatre');
const heroAnchor = document.querySelector('[data-anchor="hero"]');
const spiceAnchor = document.querySelector('[data-anchor="spices"]');
const deghAnchor = document.querySelector('[data-anchor="degh"]');
const N = heroDishes.length;

let p = 0, pTarget = 0, mx = 0, my = 0, smx = 0, smy = 0;
addEventListener('pointermove', (e) => { mx = e.clientX / vw - 0.5; my = e.clientY / vh - 0.5; }, { passive: true });
window.__theatre = { get progress() { return p; } };

function heroProgress() {
  const r = theatre.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - vh)) * (N - 1);
}

/* ---------- loop ---------- */
const clock = new THREE.Clock(); let t = 0, wasIdle = false, running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(frame); } });
const wp = new THREE.Vector3();

function place(obj, a, scaleMul) {
  worldAt(a.cx, a.cy, wp); obj.position.copy(wp);
  const s = ((a.size * 0.5) * pxToWorld() / RADIUS) * scaleMul; obj.scale.setScalar(Math.max(0.0001, s));
  return s;
}

function frame() {
  if (!running) return;
  const dt = QA ? 0.016 : Math.min(0.05, clock.getDelta()); t += reduce ? 0 : dt;
  pTarget = heroProgress();
  p += (pTarget - p) * (reduce || QA ? 1 : 1 - Math.pow(0.0015, dt));
  smx += (mx - smx) * 0.05; smy += (my - smy) * 0.05;

  const ha = anchorOf(heroAnchor), sa = anchorOf(spiceAnchor), da = anchorOf(deghAnchor);
  const heroOn = ha.bottom > -vh * 0.3 && ha.top < vh * 1.3;
  const spOn = sa.bottom > -vh * 0.2 && sa.top < vh * 1.2;
  const dgOn = da.bottom > -vh * 0.2 && da.top < vh * 1.2;
  const any = heroOn || spOn || dgOn;

  if (!any) {
    if (!wasIdle) { renderer.clear(); wasIdle = true; canvas.style.opacity = '0'; }
    next(frame); return;
  }
  if (wasIdle) { wasIdle = false; canvas.style.opacity = '1'; }

  // hero dishes
  heroDishes.forEach((d, i) => {
    const k = p - i, a = Math.min(1, Math.abs(k)), s = 1 - ease(a);
    const vis = heroOn && s > 0.002; d.visible = vis;
    const strength = vis ? s : 0;
    if (vis) {
      const sc = place(d, ha, 0.35 + 0.65 * s);
      d.position.y += k * 2.4 * sc;
      d.rotation.set(0.12 + smy * 0.25 + k * 0.4, baseRot[i] + k * 2.4 + t * 0.12 + smx * 0.5, smx * -0.05);
      tickOrbiters(d, t, dt);
    }
    d.userData.steam.forEach((o, j) => {
      const e = d.localToWorld(tmpV.copy(o));
      steams[i][j].update(dt, e, d.scale.x, strength, t);
    });
  });

  // spice cloud
  spices.visible = spOn;
  if (spOn) {
    place(spices, sa, 0.85);
    spices.rotation.set(smy * 0.2, t * 0.08 + smx * 0.6, 0);
    tickOrbiters(spices, t, dt);
  }

  // degh
  pot.visible = dgOn;
  if (dgOn) { place(pot, da, 0.95); pot.rotation.set(0.1 + smy * 0.15, -0.4 + t * 0.15 + smx * 0.4, 0); }
  pot.userData.steam.forEach((o, j) => { const e = pot.localToWorld(tmpV.copy(o)); potSteam[j].update(dt, e, pot.scale.x, dgOn ? 1 : 0, t); });

  // embers drift upward
  const pos = embGeo.attributes.position;
  for (let i = 0; i < EMB; i++) { let y = pos.getY(i) + embSp[i] * dt; if (y > 4.5) y = -4.5; pos.setY(i, y); pos.setX(i, pos.getX(i) + Math.sin(t + i) * 0.002); }
  pos.needsUpdate = true;
  embers.visible = heroOn || dgOn;

  renderer.render(scene, camera);
  next(frame);
}
renderer.compile(scene, camera);
requestAnimationFrame(() => { canvas.classList.add('is-ready'); frame(); });
