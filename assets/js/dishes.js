// Ghousia Nalli Biryani — procedural, physically-based 3D dishes (Three.js)
import * as THREE from 'three';
import * as TX from './textures.js';

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
// displace along normals; returns per-vertex displacement for AO
function displace(geo, amp, freq, seed = 0) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const v = new THREE.Vector3(), nn = new THREE.Vector3(); const D = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    const d = noise3(v.x * freq + seed, v.y * freq - seed, v.z * freq + seed * 0.5) * amp;
    D[i] = d; v.addScaledVector(nn, d); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.userData.disp = D;
  return geo;
}
function aoFromDisp(geo, amp, lo = 0.45) {
  const D = geo.userData.disp, cols = new Float32Array(D.length * 3);
  for (let i = 0; i < D.length; i++) { const a = lo + (1 - lo) * Math.min(1, Math.max(0, (D[i] / amp) * 0.5 + 0.6)); cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = a; }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
function lathe(pts, seg = 96) { return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg); }
const UP = new THREE.Vector3(0, 1, 0);
let Q = { rice: 1 }; // quality scale set by caller
export function setQuality(q) { Q = { ...Q, ...q }; }

/* ---------- materials (shared) ---------- */
const M = {};
const once = (k, f) => M[k] || (M[k] = f());
const mat = {
  steel: () => once('steel', () => { const t = TX.steel(); return new THREE.MeshPhysicalMaterial({ color: 0xdde0e4, metalness: 1, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.35, 0.35), anisotropy: 0.65, clearcoat: 0.15, clearcoatRoughness: 0.2 }); }),
  copper: () => once('copper', () => { const t = TX.copper(); return new THREE.MeshPhysicalMaterial({ map: t.map, metalness: 1, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.9, 0.9), clearcoat: 0.3, clearcoatRoughness: 0.3 }); }),
  brass: () => once('brass', () => { const t = TX.brass(); return new THREE.MeshPhysicalMaterial({ map: t.map, metalness: 1, roughness: 0.85, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), clearcoat: 0.3, clearcoatRoughness: 0.25 }); }),
  darkBrass: () => once('dbrass', () => new THREE.MeshStandardMaterial({ color: 0x7a4e22, metalness: 1, roughness: 0.38 })),
  clay: () => once('clay', () => { const t = TX.clay(); return new THREE.MeshStandardMaterial({ map: t.map, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.45, 0.45) }); }),
  dough: () => once('dough', () => { const t = TX.dough(); return new THREE.MeshStandardMaterial({ map: t.map, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(1.4, 1.4) }); }),
  meat: () => once('meat', () => { const t = TX.meat(); for (const k of ['map', 'normal', 'rough']) t[k].repeat.set(3, 2); return new THREE.MeshPhysicalMaterial({ map: t.map, vertexColors: true, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.9, 0.9), clearcoat: 0.75, clearcoatRoughness: 0.28, sheen: 0.25, sheenColor: new THREE.Color(0xff9a60), sheenRoughness: 0.5 }); }),
  bone: () => once('bone', () => { const t = TX.bone(); return new THREE.MeshStandardMaterial({ map: t.map, roughness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(1.1, 1.1) }); }),
  boneEnd: () => once('boneEnd', () => { const t = TX.bone(); return new THREE.MeshStandardMaterial({ map: t.map, color: 0xd8c39a, roughness: 0.55, normalMap: t.normal }); }),
  marrow: () => once('marrow', () => { const t = TX.marrow(); return new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normal, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: new THREE.Color(0xffb08a) }); }),
  rice: () => once('rice', () => new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff7e8) })),
  glossRice: () => once('grice', () => new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.3, sheenColor: new THREE.Color(0xffe2a0) })),
  leaf: (kind) => once('leaf' + kind, () => { const t = TX.leaf(kind); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, alphaTest: 0.5, side: THREE.DoubleSide, roughness: kind === 'mint' ? 0.45 : 0.62 }); }),
  organic: (kind, color, rough = 1, extra = {}) => once('o' + kind + color, () => { const t = TX.organic(kind); return new THREE.MeshPhysicalMaterial({ color, roughness: rough, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.55, 0.55), ...extra }); }),
  plain: (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra }),
  gloss: (c, r = 0.3, extra = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: 0.9, clearcoatRoughness: 0.15, ...extra }),
};

/* ---------- vessels ---------- */
function thali() {
  const g = new THREE.Group();
  const pts = [[0, .02], [1.22, .02], [1.34, .05], [1.52, .17], [1.64, .21], [1.68, .2], [1.66, .185], [1.55, .145], [1.3, .005], [1.2, -.015], [0, -.015]];
  g.add(new THREE.Mesh(lathe(pts, 160), mat.steel()));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.665, .024, 16, 200), mat.steel()); rim.rotation.x = Math.PI / 2; rim.position.y = .2; g.add(rim);
  return g;
}
function bowl({ r = 1, depth = .7, base = .45, wall = .05, m, lip = true, belly = .1 }) {
  const out = [], inn = [], N = 28;
  for (let i = 0; i <= N; i++) { const t = i / N; out.push([base + (r - base) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly, t * depth]); }
  for (let i = N; i >= 0; i--) { const t = i / N; inn.push([Math.max(0, base - wall + (r - base) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly - wall * .2), t * depth + wall * (1 - t) + .001]); }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(lathe([[0, 0], ...out, ...inn, [0, wall]], 160), m));
  if (lip) { const t = new THREE.Mesh(new THREE.TorusGeometry(r - wall / 2 + belly * 0, wall * .62, 16, 200), m); t.rotation.x = Math.PI / 2; t.position.y = depth; g.add(t); }
  g.userData.innerAt = (y) => { const t = Math.min(1, Math.max(0, y / depth)); return base - wall + (r - base) * Math.sin(t * Math.PI / 2) + Math.sin(t * Math.PI) * belly - wall * 1.1; };
  return g;
}

/* ---------- food parts ---------- */
function pickColor(palette, r) { let x = r(), acc = 0; for (const [c, w] of palette) { acc += w; if (x <= acc) return c; } return palette[0][0]; }
let grainGeo;
function basmati() {
  if (grainGeo) return grainGeo;
  const g = new THREE.CapsuleGeometry(0.0175, 0.085, 3, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + y * y * 0.9); p.setZ(i, p.getZ(i) * 0.86); } // slight curve, flattened
  g.computeVertexNormals();
  return (grainGeo = g);
}
function riceMound({ R = 1.2, H = .7, count = 4200, palette, zones, seed = 1, material, base = true, baseColor = 0xd7c39b, exp = .85 }) {
  count = Math.round(count * Q.rice);
  const g = new THREE.Group(), r = rng(seed);
  const h = (rr) => H * Math.pow(Math.max(0, 1 - (rr / R) ** 2), exp);
  if (base) {
    const pts = []; for (let i = 0; i <= 30; i++) { const rr = R * (1 - i / 30); pts.push([rr * .985, Math.max(0, h(rr) - .025)]); }
    g.add(new THREE.Mesh(lathe(pts, 64), mat.plain(baseColor, .75)));
  }
  const im = new THREE.InstancedMesh(basmati(), material || mat.rice(), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const rr = R * Math.sqrt(r()) * .995, th = r() * Math.PI * 2;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr, z_ = z;
    const depth = Math.pow(r(), 2.2) * .045;
    const y = h(rr) - depth + .008;
    const e = .01, dh = (h(rr + e) - h(Math.max(0, rr - e))) / (2 * e);
    nrm.set(-Math.cos(th) * dh, 1, -Math.sin(th) * dh).normalize();
    dir.set(r() - .5, r() - .5, r() - .5).normalize(); dir.addScaledVector(nrm, -dir.dot(nrm)).normalize();
    dir.addScaledVector(nrm, (r() - .5) * .7).normalize();
    q.setFromUnitVectors(UP, dir);
    const broken = r() < .12 ? .55 + r() * .3 : 1;
    const sc = .85 + r() * .3; s.set(sc, sc * broken, sc); p.set(x, y, z);
    m4.compose(p, q, s); im.setMatrixAt(i, m4);
    if (zones) {
      const z = noise3(x * 2.2 + seed, y * 2.4 + 1.7, z_ * 2.2 - seed) + noise3(x * 6.1, y * 5.3, z_ * 6.7) * .35;
      const pal = z > .08 ? zones.saffron : z < -.3 ? zones.masala : zones.white;
      col.set(pickColor(pal, r));
    } else col.set(pickColor(palette, r));
    const jitter = .93 + r() * .1, ao = 1 - (depth / .045) * .4 - (rr / R) * .08;
    col.multiplyScalar(jitter * ao);
    im.setColorAt(i, col);
  }
  g.add(im);
  g.userData.surface = h;
  return g;
}
function meatChunk(r, size = .2) {
  const geo = new THREE.SphereGeometry(size, 56, 40);
  displace(geo, size * .42, 1.15 / size, r() * 10);
  const d1 = geo.userData.disp.slice();
  displace(geo, size * .1, 4.2 / size, r() * 10);
  const d2 = geo.userData.disp; for (let i = 0; i < d2.length; i++) d2[i] = d1[i] + d2[i] * 1.5;
  aoFromDisp(geo, size * .42, .35);
  geo.scale(1.25, .64 + r() * .2, .9 + r() * .35);
  const m = new THREE.Mesh(geo, mat.meat());
  m.rotation.set(r() * 3, r() * 3, r() * 3);
  return m;
}
export function nalliBone({ scale = 1, meat = true, seed = 4 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const pts = [[.13, -.405], [.165, -.4], [.195, -.37], [.205, -.3], [.18, -.2], [.145, -.08], [.138, .08], [.152, .2], [.19, .3], [.218, .36], [.214, .4], [.19, .412]];
  const geo = displace(lathe(pts, 72), .014, 7, 2);
  g.add(new THREE.Mesh(geo, mat.bone()));
  // cut faces: compact bone ring + spongy end
  for (const [y, rad, flip] of [[.41, .19, 1], [-.403, .135, -1]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(rad * .7, rad * 1.01, 48, 2), mat.boneEnd());
    ring.rotation.x = -Math.PI / 2 * flip; ring.position.y = y; g.add(ring);
  }
  const marrow = new THREE.Mesh(displace(new THREE.SphereGeometry(.14, 40, 20), .012, 18), mat.marrow());
  marrow.scale.set(1, .3, 1); marrow.position.y = .395; g.add(marrow);
  const marrow2 = marrow.clone(); marrow2.scale.set(.7, .25, .7); marrow2.position.y = -.39; g.add(marrow2);
  if (meat) {
    for (let i = 0; i < 6; i++) {
      const ch = meatChunk(r, .14 + r() * .06), a = i / 6 * Math.PI * 2 + r() * .6;
      ch.position.set(Math.cos(a) * .17, -.24 + r() * .4, Math.sin(a) * .17); g.add(ch);
    }
  }
  g.scale.setScalar(scale);
  return g;
}
function bentPlane(w, h, curl = .3, seg = 8) {
  const geo = new THREE.PlaneGeometry(w, h, seg, seg * 1.5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / w, y = p.getY(i) / h; p.setZ(i, (x * x * 1.6 - y * y * .4) * curl * h); }
  geo.computeVertexNormals(); return geo;
}
function mintLeaf(r) { const m = new THREE.Mesh(bentPlane(.1 + r() * .03, .15 + r() * .04, .3), mat.leaf('mint')); return m; }
function bayLeaf() { return new THREE.Mesh(bentPlane(.12, .38, .18), mat.leaf('bay')); }
function birista(r) {
  const pts = []; let a = r() * 6, x = 0, y = 0, z = 0;
  for (let i = 0; i < 6; i++) { pts.push(new THREE.Vector3(x, y, z)); a += (r() - .5) * 1.6; x += Math.cos(a) * .03; z += Math.sin(a) * .03; y += (r() - .5) * .012; }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, .0055 + r() * .004, 5);
  geo.scale(1, .55, 1);
  const c = new THREE.Color().setHSL(.07 + r() * .02, .75, .16 + r() * .14);
  return new THREE.Mesh(geo, mat.gloss(c, .45, { clearcoat: .5 }));
}
function greenChili(r) {
  const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([.028 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * .55) + .001, t * .42 - .21]); }
  const geo = lathe(pts, 20); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + (y + .21) ** 2 * .6); }
  geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat.organic('chili', 0x3c8a24, .3, { clearcoat: 1, clearcoatRoughness: .1 })));
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .01, .05, 6), mat.plain(0x5f7a2a, .6)); st.position.y = -.235; g.add(st);
  return g;
}
function onionRing(r) {
  const g = new THREE.Group(), R = .1 + r() * .06;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R, .013, 12, 64), mat.gloss(0xf0e2ea, .2, { transparent: true, opacity: .9, sheen: .6, sheenColor: new THREE.Color(0xffffff) })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R + .012, .006, 8, 64), mat.gloss(0x8a3068, .3)));
  return g;
}
function lemonWedge() {
  const g = new THREE.Group(), R = .2;
  const rind = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 20, 0, Math.PI / 2.4, 0, Math.PI), mat.organic('rind', 0xf0c22a, .55, { clearcoat: .4 }));
  rind.scale.set(1, 1.25, 1); g.add(rind);
  const fl = once('lemonFlesh', () => new THREE.MeshPhysicalMaterial({ map: TX.citrus(), roughness: .2, clearcoat: 1, clearcoatRoughness: .05, side: THREE.DoubleSide }));
  const f1 = new THREE.Mesh(new THREE.CircleGeometry(R * .985, 32, -Math.PI / 2, Math.PI), fl); f1.scale.set(1, 1.25, 1); g.add(f1);
  const f2 = f1.clone(); f2.rotation.y = Math.PI / 2.4; g.add(f2);
  return g;
}
function slice(tex, side, R, h = .025) {
  const top = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .25, clearcoat: .9, clearcoatRoughness: .08 });
  return new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 48), [mat.gloss(side, .35), top, top]);
}
function almond(r) { const m = new THREE.Mesh(displace(new THREE.SphereGeometry(.05, 24, 14), .003, 40, r() * 9), mat.organic('anise', 0xb77b45, .7)); m.scale.set(1, .42, 1.8); return m; }
function sliver(c) { return new THREE.Mesh(new THREE.BoxGeometry(.07, .008, .022, 2, 1, 1), mat.plain(c, .5)); }
function raisin(r) { return new THREE.Mesh(displace(new THREE.SphereGeometry(.03, 16, 12), .008, 60, r() * 9), mat.gloss(0x3b170e, .35)); }
function saffronStrand() { return new THREE.Mesh(new THREE.CylinderGeometry(.0025, .004, .09, 5), mat.gloss(0xc4331a, .4)); }

/* ---------- spices ---------- */
function starAnise(r) {
  const g = new THREE.Group(), m = mat.organic('anise', 0x6a2e16, 1);
  for (let i = 0; i < 8; i++) {
    const lobe = new THREE.Mesh(displace(new THREE.SphereGeometry(.05, 16, 12), .006, 40, i), m);
    lobe.scale.set(.75, .6, 2.2); const a = i / 8 * Math.PI * 2;
    lobe.position.set(Math.cos(a) * .1, 0, Math.sin(a) * .1); lobe.rotation.y = -a + Math.PI / 2; g.add(lobe);
    const sd = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), mat.gloss(0x9a6a34, .35)); sd.scale.set(1, .7, 1.3); sd.position.set(Math.cos(a) * .1, .026, Math.sin(a) * .1); g.add(sd);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), m));
  return g;
}
function cardamom() {
  const geo = new THREE.SphereGeometry(.06, 32, 18), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.cos(a * 3) * .09; p.setX(i, x * k); p.setZ(i, z * k); }
  geo.scale(1, 1.75, 1); geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat.organic('cardamom', 0x8a9a4c, 1));
}
function peppercorn(r) { return new THREE.Mesh(displace(new THREE.SphereGeometry(.035, 20, 14), .006, 70, r() * 9), mat.organic('pepper', 0x241812, 1)); }
function clove() {
  const g = new THREE.Group(), m = mat.organic('clove', 0x4a2414, 1);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.018, .008, .16, 10), m));
  const head = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 10), m); head.position.y = .09; g.add(head);
  for (let i = 0; i < 4; i++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 6), m); const a = i / 4 * 7; pt.position.set(Math.cos(a) * .028, .1, Math.sin(a) * .028); g.add(pt); }
  return g;
}
function cinnamon() {
  const g = new THREE.Group(), m = mat.organic('bark', 0x8b4a22, 1, { side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .62, 32, 1, true, 0, Math.PI * 1.75), m));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, .62, 28, 1, true, 1, Math.PI * 1.5), m));
  return g;
}
function redChili() {
  const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push([.045 * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t * .7) + .002, t * .5 - .25]); }
  const geo = lathe(pts, 22), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + (y + .25) ** 2 * .7); p.setZ(i, p.getZ(i) + Math.sin(y * 9) * .006); }
  geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat.organic('chili', 0x8a140c, .5, { clearcoat: .8, clearcoatRoughness: .25 })));
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .07, 6), mat.plain(0x6b6a2a, .6)); st.position.y = -.28; g.add(st);
  return g;
}

/* ---------- orbiters ---------- */
function addOrbiters(group, items, radius = 1.9, yRange = [-.4, 1], seed = 2) {
  const r = rng(seed), list = [];
  items.forEach((o, i) => {
    const a = i / items.length * Math.PI * 2 + r() * .5;
    o.userData.orbit = { a, rad: radius * (.8 + r() * .35), y: yRange[0] + r() * (yRange[1] - yRange[0]), sp: .06 + r() * .07, spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(.8), bob: r() * 6 };
    o.rotation.set(r() * 6, r() * 6, r() * 6); group.add(o); list.push(o);
  });
  group.userData.orbiters = list;
}
export function tickOrbiters(group, t, dt) {
  const L = group.userData.orbiters; if (!L) return;
  for (const o of L) {
    const d = o.userData.orbit, a = d.a + t * d.sp;
    o.position.set(Math.cos(a) * d.rad, d.y + Math.sin(t * .6 + d.bob) * .07, Math.sin(a) * d.rad * .55);
    o.rotation.x += d.spin.x * dt; o.rotation.y += d.spin.y * dt; o.rotation.z += d.spin.z * dt;
  }
}
function onTop(o, surf, R, r, lift = .02) {
  const rr = R * Math.sqrt(r()) * .85, th = r() * 7;
  o.position.set(Math.cos(th) * rr, surf(rr) + lift, Math.sin(th) * rr);
  o.rotation.set(r() * 3, r() * 3, r() * 3);
}
function scatter(group, n, make, place, r) { for (let i = 0; i < n; i++) { const o = make(r, i); place(o, r, i); group.add(o); } }
function shadows(root) {
  const orb = new Set(); (root.userData.orbiters || []).forEach((o) => o.traverse((c) => orb.add(c)));
  root.traverse((o) => { if (o.isMesh) { const f = !orb.has(o); o.castShadow = f; o.receiveShadow = f; } });
}
function wrap(g, steam, y) { g.position.y = y; shadows(g); const w = new THREE.Group(); w.add(g); w.userData.steam = steam; w.userData.orbiters = g.userData.orbiters; return w; }

/* ---------- palettes ---------- */
const BIRYANI_Z = {
  white: [[0xf5ead4, .66], [0xfdf6e8, .12], [0xf1d08a, .12], [0xeaa24a, .1]],
  saffron: [[0xf0a03a, .4], [0xf7c454, .3], [0xe5782a, .14], [0xf5ead4, .16]],
  masala: [[0xb85e2a, .36], [0x9a3f1c, .24], [0xd4843e, .22], [0xc9452a, .1], [0xf0dcb8, .08]],
};
const PULAO_Z = {
  white: [[0xe2c896, .5], [0xd2ae74, .32], [0xeedcb6, .18]],
  saffron: [[0xd8b47a, .5], [0xc79a5c, .35], [0xeedcb4, .15]],
  masala: [[0xb07a44, .45], [0x96612e, .3], [0xd2aa70, .25]],
};
const ZARDA = [[0xf6b82e, .38], [0xf07c1e, .24], [0xd6302a, .13], [0x4f9a2e, .09], [0xfbe6a8, .16]];

/* ---------- dishes ---------- */
export function biryaniPlate({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(21);
  g.add(thali());
  const rice = riceMound({ R: 1.2, H: .74, zones: BIRYANI_Z, seed: 3, baseColor: 0xe6c690, count: 4600 }); rice.position.y = .02; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .02;
  for (let i = 0; i < 7; i++) { const c = meatChunk(r, .15 + r() * .06); onTop(c, surf, 1.1, r, -.04); g.add(c); }
  const bone = nalliBone({ scale: 1.05, seed: 8 }); bone.position.set(.12, .8, -.05); bone.rotation.set(.15, .4, -.95); g.add(bone);
  scatter(g, 70, birista, (o, r) => onTop(o, surf, 1.05, r, .004), r);
  scatter(g, 16, mintLeaf, (o, r) => onTop(o, surf, 1.0, r, .012), r);
  const ch = greenChili(r); ch.position.set(-.55, .52, .35); ch.rotation.set(1.2, .3, .8); g.add(ch);
  const lw = lemonWedge(); lw.position.set(.98, .3, .55); lw.rotation.set(.2, -.6, .3); lw.scale.setScalar(.85); g.add(lw);
  if (orbit) addOrbiters(g, [mintLeaf(r), mintLeaf(r), birista(r), birista(r), greenChili(r), starAnise(r), bayLeaf(), peppercorn(r), peppercorn(r), cardamom()].map(o => { o.scale.multiplyScalar(1.6); return o; }), 1.72, [-.1, 1.2], 5);
  return wrap(g, [new THREE.Vector3(0, .6, 0)], -.35);
}
export function pulaoHandi({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(31);
  g.add(bowl({ r: 1.45, depth: .55, base: 1.0, wall: .06, m: mat.copper(), belly: .12 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.52, .025, 12, 200), mat.darkBrass()); band.rotation.x = Math.PI / 2; band.position.y = .28; g.add(band);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(.17, .032, 12, 40, Math.PI), mat.brass()); h.position.set(s * 1.52, .5, 0); h.rotation.set(0, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI); g.add(h); }
  const rice = riceMound({ R: 1.3, H: .55, count: 4200, zones: PULAO_Z, seed: 4, baseColor: 0xc9a46c }); rice.position.y = .36; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .38;
  for (let i = 0; i < 9; i++) { const c = meatChunk(r, .16 + r() * .07); onTop(c, surf, 1.15, r, -.04); g.add(c); }
  const bone = nalliBone({ scale: .9, seed: 12 }); bone.position.set(-.25, 1.0, .1); bone.rotation.set(-.2, -.5, .85); g.add(bone);
  scatter(g, 50, birista, (o, r) => onTop(o, surf, 1.1, r, .004), r);
  scatter(g, 4, () => bayLeaf(), (o, r) => { onTop(o, surf, .9, r, .01); o.scale.setScalar(.6); }, r);
  scatter(g, 10, (r) => peppercorn(r), (o, r) => onTop(o, surf, 1.0, r, 0), r);
  if (orbit) addOrbiters(g, [bayLeaf(), bayLeaf(), cinnamon(), starAnise(r), peppercorn(r), peppercorn(r), clove(), cardamom()].map(o => { o.scale.multiplyScalar(1.4); return o; }), 1.8, [0, 1.2], 9);
  return wrap(g, [new THREE.Vector3(0, .6, 0)], -.55);
}
export function nalliHero({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(41);
  const bone = nalliBone({ scale: 2.4, seed: 15 }); bone.rotation.set(.35, .3, -.25); g.add(bone);
  const drops = []; for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.03 + r() * .04, 18, 12), mat.gloss(0x6e220e, .12, { sheen: .5, sheenColor: new THREE.Color(0xff8040) })); d.scale.y = 1.3; drops.push(d); }
  if (orbit) addOrbiters(g, [...drops, mintLeaf(r), birista(r), birista(r), greenChili(r)].map((o, i) => { if (i >= 10) o.scale.multiplyScalar(1.6); return o; }), 1.4, [-1, 1.2], 13);
  return wrap(g, [new THREE.Vector3(.25, 1.2, 0)], 0);
}
export function zardaBowl({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(51);
  g.add(bowl({ r: 1.2, depth: .62, base: .5, wall: .05, m: mat.brass(), belly: .05 }));
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.45, .52, .08, 96), mat.brass()); foot.position.y = -.04; g.add(foot);
  const rice = riceMound({ R: 1.1, H: .5, count: 3600, palette: ZARDA, seed: 6, material: mat.glossRice(), baseColor: 0xe9a43a }); rice.position.y = .5; g.add(rice);
  const surf = (x) => rice.userData.surface(x) + .52;
  scatter(g, 12, almond, (o, r) => onTop(o, surf, .95, r, .01), r);
  scatter(g, 14, raisin, (o, r) => onTop(o, surf, .95, r, .01), r);
  scatter(g, 18, () => sliver(0xf5f0e4), (o, r) => onTop(o, surf, .95, r, .01), r);
  if (orbit) addOrbiters(g, [almond(r), almond(r), raisin(r), raisin(r), sliver(0xf5f0e4), saffronStrand(), saffronStrand(), cardamom()].map(o => { o.scale.multiplyScalar(1.7); return o; }), 1.65, [0, 1.2], 17);
  return wrap(g, [], -.55);
}
export function kheerBowl({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(61);
  const b = bowl({ r: 1.15, depth: .75, base: .55, wall: .07, m: mat.clay(), belly: .12 }); g.add(b);
  const lvl = .6, sr = b.userData.innerAt(lvl) + .02;
  const sg = new THREE.CircleGeometry(sr, 128); sg.rotateX(-Math.PI / 2);
  const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 5) * Math.cos(z * 4) * .012); }
  sg.computeVertexNormals();
  const t = TX.kheer();
  const surface = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(.8, .8), roughness: .34, clearcoat: .45, clearcoatRoughness: .3, sheen: .9, sheenColor: new THREE.Color(0xfff6e0), sheenRoughness: .35 }));
  surface.position.y = lvl; g.add(surface);
  // soft rice grains just breaking the surface
  const grains = new THREE.InstancedMesh(basmati(), mat.plain(0xf6ecd4, .5), 160), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 160; i++) { const rr = sr * Math.sqrt(r()) * .92, th = r() * 7; e.set(Math.PI / 2, 0, r() * 7); q.setFromEuler(e); m4.compose(new THREE.Vector3(Math.cos(th) * rr, lvl + .002, Math.sin(th) * rr), q, new THREE.Vector3(1.1, 1, .7)); grains.setMatrixAt(i, m4); }
  g.add(grains);
  const top = lvl + .016;
  const put = (o, r, k = .8) => { const rr = sr * Math.sqrt(r()) * k, th = r() * 7; o.position.set(Math.cos(th) * rr, top, Math.sin(th) * rr); o.rotation.y = r() * 7; };
  scatter(g, 26, () => sliver(0x93b04a), (o, r) => put(o, r), r);
  scatter(g, 18, () => sliver(0xe9d3a6), (o, r) => put(o, r), r);
  scatter(g, 14, saffronStrand, (o, r) => { put(o, r, .7); o.rotation.set(Math.PI / 2, 0, r() * 7); }, r);
  if (orbit) addOrbiters(g, [sliver(0x93b04a), sliver(0x93b04a), sliver(0xe9d3a6), saffronStrand(), saffronStrand(), cardamom(), cardamom(), almond(r)].map(o => { o.scale.multiplyScalar(1.8); return o; }), 1.6, [.1, 1.3], 19);
  return wrap(g, [], -.5);
}
export function raitaSalad({ orbit = true } = {}) {
  const g = new THREE.Group(), r = rng(71);
  const b = bowl({ r: 1.05, depth: .62, base: .5, wall: .045, m: mat.steel(), belly: .06 }); g.add(b);
  const lvl = .5, sr = b.userData.innerAt(lvl) + .02;
  const sg = new THREE.CircleGeometry(sr, 128); sg.rotateX(-Math.PI / 2);
  const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 6 + z * 3) * .01); }
  sg.computeVertexNormals();
  const t = TX.raita();
  const s = new THREE.Mesh(sg, new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normal, roughness: .3, clearcoat: .5, clearcoatRoughness: .2, sheen: .6, sheenColor: new THREE.Color(0xffffff) })); s.position.y = lvl; g.add(s);
  scatter(g, 14, mintLeaf, (o, r) => { const rr = sr * Math.sqrt(r()) * .7, th = r() * 7; o.position.set(Math.cos(th) * rr, lvl + .02, Math.sin(th) * rr); o.rotation.set(-Math.PI / 2 + (r() - .5) * .4, 0, r() * 7); o.scale.setScalar(.7); }, r);
  const items = [];
  for (let i = 0; i < 3; i++) items.push(onionRing(r));
  for (let i = 0; i < 2; i++) items.push(slice(TX.cucumber(), 0x2f5a1f, .13));
  for (let i = 0; i < 2; i++) items.push(slice(TX.tomato(), 0xb8231a, .16));
  items.push(lemonWedge(), lemonWedge(), greenChili(r), mintLeaf(r), mintLeaf(r));
  if (orbit) addOrbiters(g, items.map((o, i) => { o.scale.multiplyScalar(i < 7 ? 1.7 : 1.5); return o; }), 1.75, [-.1, 1.3], 23);
  return wrap(g, [], -.45);
}
export function degh() {
  const g = new THREE.Group();
  const pts = [[0, 0], [.5, 0], [.58, .02], [.75, .12], [1.0, .38], [1.15, .68], [1.14, .95], [1.04, 1.15], [.9, 1.28], [.82, 1.35], [.84, 1.42], [.96, 1.48], [.99, 1.52], [.93, 1.55], [.85, 1.5]];
  g.add(new THREE.Mesh(lathe(pts, 160), mat.copper()));
  for (const y of [.62, .78]) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.155, .022, 12, 200), mat.darkBrass()); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.97, .05, 16, 200), mat.brass()); lip.rotation.x = Math.PI / 2; lip.position.y = 1.52; g.add(lip);
  const seal = new THREE.Mesh(displace(new THREE.TorusGeometry(.9, .13, 32, 200), .035, 7, 3), mat.dough()); seal.rotation.x = Math.PI / 2; seal.position.y = 1.58; g.add(seal);
  const dome = new THREE.Mesh(displace(new THREE.SphereGeometry(.92, 128, 40, 0, Math.PI * 2, 0, Math.PI / 2), .03, 5, 8), mat.dough());
  dome.scale.set(1, .32, 1); dome.position.y = 1.56; g.add(dome);
  for (const s of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .028, 12, 40), mat.brass()); ring.position.set(s * 1.13, 1.05, 0); ring.rotation.y = Math.PI / 2; g.add(ring); }
  return wrap(g, [new THREE.Vector3(-.35, .72, 0), new THREE.Vector3(.35, .72, .1)], -.95);
}
export function spiceCloud() {
  const g = new THREE.Group(), r = rng(81), list = [];
  const makers = [starAnise, starAnise, starAnise, cardamom, cardamom, cardamom, cardamom, peppercorn, peppercorn, peppercorn, peppercorn, peppercorn, clove, clove, clove, cinnamon, cinnamon, bayLeaf, bayLeaf, bayLeaf, redChili, redChili, redChili];
  makers.forEach((mk) => {
    const o = mk(r); o.scale.multiplyScalar([starAnise, cinnamon, bayLeaf, redChili].includes(mk) ? 2.2 : 2.6);
    const a = r() * Math.PI * 2, rad = .3 + Math.pow(r(), .7) * 1.6;
    o.userData.orbit = { a, rad, y: (r() - .5) * 2.4, sp: (.03 + r() * .05) * (r() > .5 ? 1 : -1), spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(.7), bob: r() * 6 };
    o.rotation.set(r() * 6, r() * 6, r() * 6); g.add(o); list.push(o);
  });
  g.userData.orbiters = list; g.userData.steam = [];
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export const DISHES = { biryaniPlate, pulaoHandi, nalliHero, zardaBowl, kheerBowl, raitaSalad, degh, spiceCloud };
