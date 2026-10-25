// Ghousia Nalli Biryani — procedural 3D dishes (Three.js)
// Every dish is built from geometry + canvas textures: no image downloads.
import * as THREE from 'three';

/* ---------- utilities ---------- */
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise3(x, y, z) {
  return (
    Math.sin(x * 1.7 + y * 2.3 + 0.3) * Math.sin(y * 1.3 + z * 2.9 + 1.1) * Math.sin(z * 1.9 + x * 2.1 + 2.2) * 0.6 +
    Math.sin(x * 4.1 - z * 3.3) * Math.sin(y * 3.7 + x * 1.9) * 0.4
  );
}
function displace(geo, amp, freq, seed = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    const d = noise3(v.x * freq + seed, v.y * freq - seed, v.z * freq + seed * 0.5) * amp;
    v.addScaledVector(nn, d); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function canvasTex(size, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}
function blob(g, x, y, r, color, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

/* ---------- shared textures (lazy) ---------- */
const T = {};
function hammerTex() {
  return T.hammer ||= canvasTex(512, (g, s) => {
    const r = rng(7); g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const x = r() * s, y = r() * s, rad = 5 + r() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(40,40,40,.55)'); gr.addColorStop(.7, 'rgba(150,150,150,.25)'); gr.addColorStop(1, 'rgba(128,128,128,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
  }, { srgb: false, repeat: [5, 2] });
}
function grainTex() {
  return T.grain ||= canvasTex(256, (g, s) => {
    const r = rng(3); const d = g.createImageData(s, s);
    for (let i = 0; i < d.data.length; i += 4) { const v = 100 + r() * 80; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }, { srgb: false, repeat: [3, 3] });
}
function doughTex() {
  return T.dough ||= canvasTex(512, (g, s) => {
    const r = rng(11);
    g.fillStyle = '#d9a75c'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) blob(g, r() * s, r() * s, 30 + r() * 70, 'rgba(240,200,130,A)', .35);
    for (let i = 0; i < 90; i++) blob(g, r() * s, r() * s, 6 + r() * 26, 'rgba(110,52,14,A)', .55 + r() * .35);
    for (let i = 0; i < 40; i++) blob(g, r() * s, r() * s, 3 + r() * 8, 'rgba(45,20,6,A)', .8);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,235,190,${r() * .35})`; g.fillRect(r() * s, r() * s, 1.5, 1.5); }
  });
}
function kheerTex() {
  return T.kheer ||= canvasTex(512, (g, s) => {
    const r = rng(5);
    g.fillStyle = '#efe0bf'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) blob(g, r() * s, r() * s, 20 + r() * 60, 'rgba(214,180,120,A)', .25);
    for (let i = 0; i < 260; i++) blob(g, r() * s, r() * s, 2 + r() * 5, 'rgba(250,246,232,A)', .7); // rice grains in milk
  });
}
function raitaTex() {
  return T.raita ||= canvasTex(512, (g, s) => {
    const r = rng(9);
    g.fillStyle = '#f2efe4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) blob(g, r() * s, r() * s, 20 + r() * 50, 'rgba(225,218,196,A)', .35);
    for (let i = 0; i < 520; i++) { g.fillStyle = `rgba(150,40,20,${.4 + r() * .4})`; g.fillRect(r() * s, r() * s, 2, 2); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(95,62,30,${.5 + r() * .4})`; g.fillRect(r() * s, r() * s, 3, 1.5); }
  });
}
function citrusTex() {
  return T.citrus ||= canvasTex(256, (g, s) => {
    const c = s / 2; g.fillStyle = '#f4d64e'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#f9ec9e'; g.beginPath(); g.arc(c, c, c * .92, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,240,.9)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * c * .9, c + Math.sin(a) * c * .9); g.stroke(); }
  });
}
function cucumberTex() {
  return T.cuc ||= canvasTex(256, (g, s) => {
    const c = s / 2; g.fillStyle = '#2f5a1f'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#cfe3a2'; g.beginPath(); g.arc(c, c, c * .9, 0, 7); g.fill();
    g.fillStyle = '#e8f1c4'; g.beginPath(); g.arc(c, c, c * .45, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,190,110,.9)';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 7; g.beginPath(); g.ellipse(c + Math.cos(a) * c * .33, c + Math.sin(a) * c * .33, 6, 3, a, 0, 7); g.fill(); }
  });
}
function tomatoTex() {
  return T.tom ||= canvasTex(256, (g, s) => {
    const c = s / 2; g.fillStyle = '#b8231a'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#d9372a'; g.beginPath(); g.arc(c, c, c * .9, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + .4;
      g.fillStyle = '#f07a55'; g.beginPath(); g.ellipse(c + Math.cos(a) * c * .45, c + Math.sin(a) * c * .45, c * .28, c * .2, a, 0, 7); g.fill();
      g.fillStyle = '#f3d27a'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(c + Math.cos(a) * c * (.35 + k * .04), c + Math.sin(a) * c * (.35 + k * .04) + (k % 2 ? 8 : -8), 4, 2.5, a, 0, 7); g.fill(); }
    }
  });
}

/* ---------- materials ---------- */
const M = {};
const mat = {
  copper: () => M.copper ||= new THREE.MeshPhysicalMaterial({ color: 0xc0683a, metalness: 1, roughness: .3, bumpMap: hammerTex(), bumpScale: 1.2, clearcoat: .35, clearcoatRoughness: .35 }),
  brass: () => M.brass ||= new THREE.MeshPhysicalMaterial({ color: 0xd6a84e, metalness: 1, roughness: .28, bumpMap: hammerTex(), bumpScale: .8, clearcoat: .3 }),
  darkBrass: () => M.dbrass ||= new THREE.MeshStandardMaterial({ color: 0x8a5a26, metalness: 1, roughness: .35 }),
  steel: () => M.steel ||= new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: 1, roughness: .16 }),
  clay: () => M.clay ||= new THREE.MeshStandardMaterial({ color: 0xa44f2a, roughness: .92, bumpMap: grainTex(), bumpScale: 2 }),
  dough: () => M.dough ||= new THREE.MeshStandardMaterial({ map: doughTex(), roughness: .82, bumpMap: doughTex(), bumpScale: 3 }),
  meat: () => M.meat ||= new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .4, clearcoat: .85, clearcoatRoughness: .22 }),
  bone: () => M.bone ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, bumpMap: grainTex(), bumpScale: 1 }),
  marrow: () => M.marrow ||= new THREE.MeshPhysicalMaterial({ color: 0x5c1f12, roughness: .25, clearcoat: 1, clearcoatRoughness: .1 }),
  rice: () => M.rice ||= new THREE.MeshStandardMaterial({ roughness: .42, metalness: 0 }),
  glossRice: () => M.grice ||= new THREE.MeshPhysicalMaterial({ roughness: .28, clearcoat: .6, clearcoatRoughness: .2 }),
  plain: (c, r = .6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra }),
  gloss: (c, r = .3) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: .8, clearcoatRoughness: .2 }),
};

/* ---------- vessels ---------- */
function lathe(pts, seg = 96) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg); }

function thali() {
  const g = new THREE.Group();
  const pts = [[0, .02], [1.22, .02], [1.34, .05], [1.52, .17], [1.64, .21], [1.67, .19], [1.55, .14], [1.3, 0], [1.2, -.02], [0, -.02]];
  const m = new THREE.Mesh(lathe(pts, 128), mat.steel()); g.add(m);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.655, .022, 12, 160), mat.steel()); rim.rotation.x = Math.PI / 2; rim.position.y = .2; g.add(rim);
  return g;
}
function bowl({ r = 1, depth = .7, base = .45, wall = .05, m, lip = true, belly = .1 }) {
  const out = [], inn = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rad = base + (r - base) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly;
    out.push([rad, t * depth]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const rad = Math.max(0, base - wall + (r - wall - base + wall) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly - wall * .2);
    inn.push([rad, t * depth + wall * (1 - t) + .001]);
  }
  const pts = [[0, 0], ...out, ...inn, [0, wall]];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe(pts, 128), m));
  if (lip) { const t = new THREE.Mesh(new THREE.TorusGeometry(r - wall / 2, wall * .62, 12, 160), m); t.rotation.x = Math.PI / 2; t.position.y = depth; g.add(t); }
  g.userData.innerAt = (y) => { const t = Math.min(1, Math.max(0, y / depth)); return base - wall + (r - base) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly - wall * 1.1; };
  return g;
}

/* ---------- food parts ---------- */
const UP = new THREE.Vector3(0, 1, 0);
function pickColor(palette, r) {
  let x = r(), acc = 0;
  for (const [c, w] of palette) { acc += w; if (x <= acc) return c; }
  return palette[0][0];
}
function riceMound({ R = 1.2, H = .7, count = 2600, palette, seed = 1, grainR = .017, grainL = .075, material, base = true, baseColor = 0xd7c39b, exp = .85 }) {
  const g = new THREE.Group(); const r = rng(seed);
  const h = (rr) => H * Math.pow(Math.max(0, 1 - (rr / R) ** 2), exp);
  if (base) {
    const pts = []; for (let i = 0; i <= 30; i++) { const rr = R * (1 - i / 30); pts.push([rr * .985, Math.max(0, h(rr) - .02)]); }
    g.add(new THREE.Mesh(lathe(pts, 64), mat.plain(baseColor, .7)));
  }
  const geo = new THREE.CapsuleGeometry(grainR, grainL, 2, 6);
  const im = new THREE.InstancedMesh(geo, material || mat.rice(), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const rr = R * Math.sqrt(r()) * .99, th = r() * Math.PI * 2;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    const y = h(rr) - r() * .03 + .01;
    const e = .01, dh = (h(rr + e) - h(Math.max(0, rr - e))) / (2 * e);
    nrm.set(-Math.cos(th) * dh, 1, -Math.sin(th) * dh).normalize();
    dir.set(r() - .5, r() - .5, r() - .5).normalize(); dir.addScaledVector(nrm, -dir.dot(nrm)).normalize();
    dir.addScaledVector(nrm, (r() - .5) * .9).normalize();
    q.setFromUnitVectors(UP, dir);
    const sc = .85 + r() * .35; s.set(sc, sc, sc); p.set(x, y, z);
    m4.compose(p, q, s); im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set(pickColor(palette, r)));
  }
  g.add(im);
  g.userData.surface = h;
  return g;
}
function meatChunk(r, size = .2) {
  const geo = displace(new THREE.SphereGeometry(size, 40, 28), size * .38, 1.1 / size, r() * 10);
  displace(geo, size * .08, 4 / size, r() * 10);
  geo.scale(1.25, .62 + r() * .2, .9 + r() * .35);
  const cols = []; const c = new THREE.Color(), a = new THREE.Color(0x2a0c05), b = new THREE.Color(0x8e3412);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const n = (noise3(p.getX(i) * 18, p.getY(i) * 18, p.getZ(i) * 18) + 1) / 2; c.copy(a).lerp(b, n); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, mat.meat());
  m.rotation.set(r() * 3, r() * 3, r() * 3);
  return m;
}
export function nalliBone({ scale = 1, meat = true, seed = 4 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const pts = [[0, -.4], [.14, -.4], [.19, -.37], [.2, -.3], [.17, -.2], [.14, -.08], [.135, .08], [.15, .2], [.19, .3], [.215, .36], [.21, .4], [.165, .41]];
  const geo = displace(lathe(pts, 64), .016, 7, 2);
  const cols = [], c = new THREE.Color(), ca = new THREE.Color(0xe6d2ad), cb = new THREE.Color(0x9a6a3a), pp = geo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const n = Math.max(0, noise3(pp.getX(i) * 9, pp.getY(i) * 9, pp.getZ(i) * 9)); c.copy(ca).lerp(cb, Math.min(1, n * 1.3)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.add(new THREE.Mesh(geo, mat.bone()));
  const ringIn = new THREE.Mesh(new THREE.TorusGeometry(.175, .03, 12, 48), M.boneRing ||= mat.plain(0xd9bf92, .5)); ringIn.rotation.x = Math.PI / 2; ringIn.position.y = .405; g.add(ringIn);
  const marrow = new THREE.Mesh(displace(new THREE.SphereGeometry(.16, 32, 16), .012, 18), mat.marrow());
  marrow.scale.set(1, .35, 1); marrow.position.y = .39; g.add(marrow);
  if (meat) {
    for (let i = 0; i < 5; i++) {
      const ch = meatChunk(r, .15 + r() * .05);
      const a = i / 5 * Math.PI * 2 + r() * .6;
      ch.position.set(Math.cos(a) * .16, -.22 + r() * .38, Math.sin(a) * .16);
      g.add(ch);
    }
  }
  g.scale.setScalar(scale);
  return g;
}
function leafShape(len = .2, w = .07) {
  const s = new THREE.Shape();
  s.moveTo(0, -len / 2);
  s.bezierCurveTo(w, -len / 4, w, len / 4, 0, len / 2);
  s.bezierCurveTo(-w, len / 4, -w, -len / 4, 0, -len / 2);
  const geo = new THREE.ShapeGeometry(s, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, x * x * 6 * len); }
  geo.computeVertexNormals();
  return geo;
}
function scatter(group, n, make, place, r) {
  for (let i = 0; i < n; i++) { const o = make(r, i); place(o, r, i); group.add(o); }
}
function onTop(o, surf, R, r, lift = .02) {
  const rr = R * Math.sqrt(r()) * .85, th = r() * 7;
  o.position.set(Math.cos(th) * rr, surf(rr) + lift, Math.sin(th) * rr);
  o.rotation.set(r() * 3, r() * 3, r() * 3);
}
function birista(r) { const m = new THREE.Mesh(new THREE.TorusGeometry(.045 + r() * .02, .009, 4, 10, Math.PI * (.8 + r() * .6)), mat.gloss(r() > .5 ? 0x6e2f0e : 0x9a4a16, .35)); return m; }
function mintLeaf(r) { const m = new THREE.Mesh(leafShape(.1 + r() * .05, .04), mat.plain(r() > .5 ? 0x3c7a2c : 0x2f6624, .45, { side: THREE.DoubleSide })); return m; }
function greenChili(r) {
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([.028 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * .55), t * .42 - .21]); }
  const geo = lathe(pts, 16); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + (y + .21) ** 2 * .6); }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.gloss(0x3f8a25, .25));
}
function onionRing(r) {
  const g = new THREE.Group(); const R = .1 + r() * .06;
  const a = new THREE.Mesh(new THREE.TorusGeometry(R, .013, 10, 48), mat.plain(0xeedbe8, .3, { transparent: true, opacity: .92 }));
  const b = new THREE.Mesh(new THREE.TorusGeometry(R + .012, .006, 8, 48), mat.plain(0x8c3570, .35));
  g.add(a, b); return g;
}
function lemonWedge() {
  const g = new THREE.Group(); const R = .2;
  const rind = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI / 2.4, 0, Math.PI), mat.plain(0xf0c52a, .4));
  rind.scale.set(1, 1.25, 1); g.add(rind);
  const fl = mat.plain(0xffffff, .3, { map: citrusTex(), side: THREE.DoubleSide });
  const f1 = new THREE.Mesh(new THREE.CircleGeometry(R * .97, 24, -Math.PI / 2, Math.PI), fl); f1.scale.set(1, 1.25, 1); g.add(f1);
  const f2 = f1.clone(); f2.rotation.y = Math.PI / 2.4; g.add(f2);
  return g;
}
function slice(tex, side, R, h = .025) {
  const geo = new THREE.CylinderGeometry(R, R, h, 40);
  const top = mat.plain(0xffffff, .35, { map: tex });
  return new THREE.Mesh(geo, [mat.plain(side, .4), top, top]);
}
function almond(r) { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 10), mat.plain(0xb77b45, .55)); m.scale.set(1, .42, 1.8); return m; }
function sliver(c) { return new THREE.Mesh(new THREE.BoxGeometry(.07, .008, .022), mat.plain(c, .5)); }
function raisin(r) { return new THREE.Mesh(displace(new THREE.SphereGeometry(.03, 12, 8), .008, 60, r() * 9), mat.gloss(0x3b170e, .3)); }
function saffronStrand() { return new THREE.Mesh(new THREE.CylinderGeometry(.003, .004, .09, 5), mat.plain(0xc4331a, .4)); }

/* ---------- spices ---------- */
function starAnise(r) {
  const g = new THREE.Group(); const m = mat.plain(0x5e2d16, .75);
  for (let i = 0; i < 8; i++) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), m);
    lobe.scale.set(.75, .6, 2.2); const a = i / 8 * Math.PI * 2;
    lobe.position.set(Math.cos(a) * .1, 0, Math.sin(a) * .1); lobe.rotation.y = -a + Math.PI / 2;
    g.add(lobe);
    const seed = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), mat.gloss(0x8a5a2a, .3)); seed.position.set(Math.cos(a) * .1, .025, Math.sin(a) * .1); g.add(seed);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), m));
  return g;
}
function cardamom(r) {
  const geo = new THREE.SphereGeometry(.06, 24, 14); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x); const k = 1 + Math.cos(a * 3) * .08; p.setX(i, x * k); p.setZ(i, z * k); }
  geo.scale(1, 1.75, 1); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.plain(0x8a9c4c, .65));
}
function peppercorn(r) { return new THREE.Mesh(displace(new THREE.SphereGeometry(.035, 16, 12), .006, 70, r() * 9), mat.plain(0x231710, .7)); }
function clove(r) {
  const g = new THREE.Group(); const m = mat.plain(0x4a2414, .7);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.018, .008, .16, 8), m); g.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), m); head.position.y = .09; g.add(head);
  for (let i = 0; i < 4; i++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 6), m); const a = i / 4 * 7; pt.position.set(Math.cos(a) * .028, .1, Math.sin(a) * .028); g.add(pt); }
  return g;
}
function cinnamon() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x8b4a22, roughness: .85, bumpMap: grainTex(), bumpScale: 2, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .62, 28, 1, true, 0, Math.PI * 1.75), m));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .62, 24, 1, true, 1, Math.PI * 1.5), m));
  return g;
}
function bayLeaf() { return new THREE.Mesh(leafShape(.34, .09), mat.plain(0x7a7d3a, .6, { side: THREE.DoubleSide })); }
function redChili() {
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([.045 * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t * .7) + .002, t * .5 - .25]); }
  const geo = lathe(pts, 18); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + (y + .25) ** 2 * .7); p.setZ(i, p.getZ(i) + Math.sin(y * 9) * .006); }
  geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat.gloss(0x8c160d, .35)));
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .07, 6), mat.plain(0x6b6a2a, .6)); st.position.y = -.28; g.add(st);
  return g;
}

/* ---------- orbiters: garnish that floats around a dish ---------- */
function addOrbiters(group, items, radius = 1.9, yRange = [-.4, 1], seed = 2) {
  const r = rng(seed); const list = [];
  items.forEach((o, i) => {
    const a = i / items.length * Math.PI * 2 + r() * .5;
    o.userData.orbit = { a, rad: radius * (.8 + r() * .35), y: yRange[0] + r() * (yRange[1] - yRange[0]), sp: .08 + r() * .1, spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(1.2), bob: r() * 6 };
    o.rotation.set(r() * 6, r() * 6, r() * 6);
    group.add(o); list.push(o);
  });
  group.userData.orbiters = list;
}
export function tickOrbiters(group, t, dt) {
  const L = group.userData.orbiters; if (!L) return;
  for (const o of L) {
    const d = o.userData.orbit;
    const a = d.a + t * d.sp;
    o.position.set(Math.cos(a) * d.rad, d.y + Math.sin(t * .7 + d.bob) * .08, Math.sin(a) * d.rad * .55);
    o.rotation.x += d.spin.x * dt; o.rotation.y += d.spin.y * dt; o.rotation.z += d.spin.z * dt;
  }
}

/* ---------- palettes ---------- */
const BIRYANI = [[0xf5eddc, .44], [0xeaa046, .18], [0xf3c759, .12], [0xb06a30, .12], [0xc8452a, .08], [0x7a3a16, .03], [0xfffaf0, .03]];
const PULAO = [[0xe6cfa2, .5], [0xcc9f63, .26], [0xa06a36, .14], [0xf3e8cf, .1]];
const ZARDA = [[0xf4b52e, .4], [0xee7a1f, .24], [0xd2302a, .13], [0x4f9a2e, .09], [0xfbe6a8, .14]];

/* ---------- dishes ---------- */
// Each returns a Group centred near the origin, ~1.6 units in radius, with userData.steam = [Vector3...] (local emit points)

export function biryaniPlate({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(21);
  g.add(thali());
  const rice = riceMound({ R: 1.2, H: .72, count: 3200, palette: BIRYANI, seed: 3 });
  rice.position.y = .02; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .02;
  for (let i = 0; i < 6; i++) { const c = meatChunk(r, .15 + r() * .06); onTop(c, surf, 1.1, r, -.03); g.add(c); }
  const bone = nalliBone({ scale: 1.05, seed: 8 }); bone.position.set(.12, .78, -.05); bone.rotation.set(.15, .4, -.95); g.add(bone);
  scatter(g, 46, birista, (o, r) => onTop(o, surf, 1.05, r, .0), r);
  scatter(g, 16, mintLeaf, (o, r) => onTop(o, surf, 1.0, r, .01), r);
  const ch = greenChili(r); ch.position.set(-.55, .5, .35); ch.rotation.set(1.2, .3, .8); g.add(ch);
  const lw = lemonWedge(); lw.position.set(.95, .3, .55); lw.rotation.set(.2, -.6, .3); lw.scale.setScalar(.85); g.add(lw);
  if (orbit) addOrbiters(g, [mintLeaf(r), mintLeaf(r), birista(r), birista(r), greenChili(r), starAnise(r), bayLeaf(), peppercorn(r), peppercorn(r), cardamom(r)].map(o => { o.scale.multiplyScalar(1.6); return o; }), 1.72, [-.1, 1.2], 5);
  g.position.y = -.35;
  const w = new THREE.Group(); w.add(g); w.userData.steam = [new THREE.Vector3(0, .65, 0)]; w.userData.inner = g; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function pulaoHandi({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(31);
  const b = bowl({ r: 1.45, depth: .55, base: 1.0, wall: .06, m: mat.copper(), belly: .12 }); g.add(b);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, .025, 10, 160), mat.darkBrass()); band.rotation.x = Math.PI / 2; band.position.y = .28; g.add(band);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(.17, .03, 10, 32, Math.PI), mat.brass());
    h.position.set(s * 1.5, .5, 0); h.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI / 2 * 0); h.rotation.z = Math.PI; g.add(h);
  }
  const rice = riceMound({ R: 1.3, H: .55, count: 3000, palette: PULAO, seed: 4, baseColor: 0xc9a774 });
  rice.position.y = .36; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .38;
  for (let i = 0; i < 9; i++) { const c = meatChunk(r, .16 + r() * .07); onTop(c, surf, 1.15, r, -.03); g.add(c); }
  const bone = nalliBone({ scale: .9, seed: 12 }); bone.position.set(-.25, .98, .1); bone.rotation.set(-.2, -.5, .85); g.add(bone);
  scatter(g, 30, birista, (o, r) => onTop(o, surf, 1.1, r, 0), r);
  scatter(g, 8, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), mat.plain(0x2a1a12, .6)); m.scale.set(1, .5, 1.4); return m; }, (o, r) => onTop(o, surf, 1.0, r, 0), r);
  if (orbit) addOrbiters(g, [bayLeaf(), bayLeaf(), cinnamon(), starAnise(r), peppercorn(r), peppercorn(r), clove(r), cardamom(r)].map(o => { o.scale.multiplyScalar(1.4); return o; }), 1.8, [0, 1.2], 9);
  g.position.y = -.55;
  const w = new THREE.Group(); w.add(g); w.userData.steam = [new THREE.Vector3(0, .6, 0)]; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function nalliHero({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(41);
  const bone = nalliBone({ scale: 2.4, seed: 15 }); bone.rotation.set(.35, .3, -.25); g.add(bone);
  // drips of gravy
  const drops = [];
  for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.03 + r() * .04, 14, 10), mat.gloss(0x7a2a12, .15)); d.scale.y = 1.3; drops.push(d); }
  if (orbit) addOrbiters(g, [...drops, mintLeaf(r), birista(r), birista(r), greenChili(r)].map((o, i) => { if (i >= 10) o.scale.multiplyScalar(1.6); return o; }), 1.4, [-1, 1.2], 13);
  const w = new THREE.Group(); w.add(g); w.userData.steam = [new THREE.Vector3(.25, 1.25, 0)]; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function zardaBowl({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(51);
  const b = bowl({ r: 1.2, depth: .62, base: .5, wall: .05, m: mat.brass(), belly: .05 }); g.add(b);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.45, .52, .08, 64), mat.brass()); foot.position.y = -.04; g.add(foot);
  const rice = riceMound({ R: 1.1, H: .5, count: 2600, palette: ZARDA, seed: 6, material: mat.glossRice(), baseColor: 0xe9a43a, grainR: .018 });
  rice.position.y = .5; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .52;
  scatter(g, 12, almond, (o, r) => onTop(o, surf, .95, r, .01), r);
  scatter(g, 14, raisin, (o, r) => onTop(o, surf, .95, r, .01), r);
  scatter(g, 18, () => sliver(0xf5f0e4), (o, r) => onTop(o, surf, .95, r, .01), r);
  if (orbit) addOrbiters(g, [almond(r), almond(r), raisin(r), raisin(r), sliver(0xf5f0e4), saffronStrand(), saffronStrand(), cardamom(r)].map(o => { o.scale.multiplyScalar(1.7); return o; }), 1.65, [0, 1.2], 17);
  g.position.y = -.55;
  const w = new THREE.Group(); w.add(g); w.userData.steam = []; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function kheerBowl({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(61);
  const b = bowl({ r: 1.15, depth: .75, base: .55, wall: .07, m: mat.clay(), belly: .12 }); g.add(b);
  const lvl = .6;
  const surfR = b.userData.innerAt(lvl) + .02;
  const sg = new THREE.CircleGeometry(surfR, 96); sg.rotateX(-Math.PI / 2);
  const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 5) * Math.cos(z * 4) * .012); }
  sg.computeVertexNormals();
  const surf = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ map: kheerTex(), roughness: .3, clearcoat: .5, clearcoatRoughness: .25, sheen: .6, sheenColor: new THREE.Color(0xfff4dc) }));
  surf.position.y = lvl; g.add(surf);
  const top = () => lvl + .015;
  scatter(g, 26, () => sliver(0x93b04a), (o, r) => { const rr = surfR * Math.sqrt(r()) * .8, th = r() * 7; o.position.set(Math.cos(th) * rr, top(), Math.sin(th) * rr); o.rotation.y = r() * 7; }, r);
  scatter(g, 18, () => sliver(0xe9d3a6), (o, r) => { const rr = surfR * Math.sqrt(r()) * .8, th = r() * 7; o.position.set(Math.cos(th) * rr, top(), Math.sin(th) * rr); o.rotation.y = r() * 7; }, r);
  scatter(g, 14, saffronStrand, (o, r) => { const rr = surfR * Math.sqrt(r()) * .7, th = r() * 7; o.position.set(Math.cos(th) * rr, top(), Math.sin(th) * rr); o.rotation.set(Math.PI / 2, 0, r() * 7); }, r);
  if (orbit) addOrbiters(g, [sliver(0x93b04a), sliver(0x93b04a), sliver(0xe9d3a6), saffronStrand(), saffronStrand(), cardamom(r), cardamom(r), almond(r)].map(o => { o.scale.multiplyScalar(1.8); return o; }), 1.6, [.1, 1.3], 19);
  g.position.y = -.5;
  const w = new THREE.Group(); w.add(g); w.userData.steam = []; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function raitaSalad({ orbit = true } = {}) {
  const g = new THREE.Group(); const r = rng(71);
  const b = bowl({ r: 1.05, depth: .62, base: .5, wall: .045, m: mat.steel(), belly: .06 }); g.add(b);
  const lvl = .5; const sr = b.userData.innerAt(lvl) + .02;
  const sg = new THREE.CircleGeometry(sr, 96); sg.rotateX(-Math.PI / 2);
  const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 6 + z * 3) * .01); }
  sg.computeVertexNormals();
  const s = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ map: raitaTex(), roughness: .32, clearcoat: .4 })); s.position.y = lvl; g.add(s);
  scatter(g, 14, mintLeaf, (o, r) => { const rr = sr * Math.sqrt(r()) * .7, th = r() * 7; o.position.set(Math.cos(th) * rr, lvl + .02, Math.sin(th) * rr); o.rotation.set(-Math.PI / 2 + (r() - .5) * .4, 0, r() * 7); }, r);
  const items = [];
  for (let i = 0; i < 3; i++) items.push(onionRing(r));
  for (let i = 0; i < 2; i++) items.push(slice(cucumberTex(), 0x2f5a1f, .13));
  for (let i = 0; i < 2; i++) items.push(slice(tomatoTex(), 0xb8231a, .16));
  items.push(lemonWedge(), lemonWedge(), greenChili(r), mintLeaf(r), mintLeaf(r));
  if (orbit) addOrbiters(g, items.map((o, i) => { o.scale.multiplyScalar(i < 7 ? 1.7 : 1.5); return o; }), 1.75, [-.1, 1.3], 23);
  g.position.y = -.45;
  const w = new THREE.Group(); w.add(g); w.userData.steam = []; w.userData.orbiters = g.userData.orbiters;
  return w;
}

export function degh({ orbit = false } = {}) {
  const g = new THREE.Group();
  const pts = [[0, 0], [.5, 0], [.58, .02], [.75, .12], [1.0, .38], [1.15, .68], [1.14, .95], [1.04, 1.15], [.9, 1.28], [.82, 1.35], [.84, 1.42], [.96, 1.48], [.99, 1.52], [.93, 1.55], [.85, 1.5]];
  g.add(new THREE.Mesh(lathe(pts, 128), mat.copper()));
  for (const y of [.62, .78]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.155, .022, 10, 160), mat.darkBrass()); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.97, .05, 14, 160), mat.brass()); lip.rotation.x = Math.PI / 2; lip.position.y = 1.52; g.add(lip);
  const seal = new THREE.Mesh(displace(new THREE.TorusGeometry(.9, .13, 24, 160), .035, 7, 3), mat.dough()); seal.rotation.x = Math.PI / 2; seal.position.y = 1.58; g.add(seal);
  const dome = new THREE.Mesh(displace(new THREE.SphereGeometry(.92, 96, 32, 0, Math.PI * 2, 0, Math.PI / 2), .03, 5, 8), mat.dough());
  dome.scale.set(1, .32, 1); dome.position.y = 1.56; g.add(dome);
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .028, 10, 32), mat.brass());
    ring.position.set(s * 1.13, 1.05, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
  }
  g.position.y = -.95;
  const w = new THREE.Group(); w.add(g); w.userData.steam = [new THREE.Vector3(-.35, .72, 0), new THREE.Vector3(.35, .72, .1)];
  return w;
}

export function spiceCloud() {
  const g = new THREE.Group(); const r = rng(81); const list = [];
  const makers = [starAnise, starAnise, starAnise, cardamom, cardamom, cardamom, cardamom, peppercorn, peppercorn, peppercorn, peppercorn, peppercorn, clove, clove, clove, cinnamon, cinnamon, bayLeaf, bayLeaf, bayLeaf, redChili, redChili, redChili];
  makers.forEach((mk, i) => {
    const o = mk(r); const big = [starAnise, cinnamon, bayLeaf, redChili].includes(mk) ? 2.2 : 2.6;
    o.scale.multiplyScalar(big);
    const a = r() * Math.PI * 2, rad = .3 + Math.pow(r(), .7) * 1.6;
    o.userData.orbit = { a, rad, y: (r() - .5) * 2.4, sp: (.04 + r() * .06) * (r() > .5 ? 1 : -1), spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(.9), bob: r() * 6 };
    o.rotation.set(r() * 6, r() * 6, r() * 6);
    g.add(o); list.push(o);
  });
  g.userData.orbiters = list; g.userData.steam = [];
  return g;
}

export const DISHES = { biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad, degh, spiceCloud };
