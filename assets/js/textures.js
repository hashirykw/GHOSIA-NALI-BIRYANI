// Procedural PBR textures (colour / normal / roughness) generated on the client.
// No image downloads: every surface detail is computed from seeded noise.
import * as THREE from 'three';

/* ---------- seeded, tileable value noise ---------- */
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNoise(seed) {
  const r = rng(seed), P = 256, tab = new Float32Array(P * P);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const s = (t) => t * t * (3 - 2 * t);
  // period-wrapped value noise: x,y in lattice units, wraps every `per` cells
  function n(x, y, px, py = px) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = tab[y0 * P + x0], b = tab[y0 * P + x1], c = tab[y1 * P + x0], d = tab[y1 * P + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  // fbm over unit square [0,1)^2, tileable; base = lattice cells at octave 0
  function fbm(u, v, base = 4, oct = 5, gain = 0.5, sx = 1, sy = 1) {
    let sum = 0, amp = 1, norm = 0, f = base;
    for (let o = 0; o < oct; o++) {
      sum += amp * n(u * f * sx, v * f * sy, Math.max(1, Math.min(P, Math.round(f * sx))), Math.max(1, Math.min(P, Math.round(f * sy))));
      norm += amp; amp *= gain; f *= 2;
    }
    return sum / norm;
  }
  return { n, fbm };
}

/* ---------- image helpers ---------- */
function field(size, fn) { // returns Float32Array heights
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = fn(x / size, y / size);
  return H;
}
function toTexture(size, pixel, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const img = g.createImageData(size, size); const d = img.data;
  for (let i = 0, y = 0; y < size; y++) for (let x = 0; x < size; x++, i += 4) {
    const p = pixel(x, y, i / 4); d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p[3] ?? 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function normalMap(H, size, strength = 4, repeat) {
  return toTexture(size, (x, y) => {
    const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
    const u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255];
  }, { srgb: false, repeat });
}
function grayMap(H, size, lo, hi, repeat) {
  return toTexture(size, (x, y) => { const v = (lo + (hi - lo) * H[y * size + x]) * 255; return [v, v, v]; }, { srgb: false, repeat });
}
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];
const sat = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

/* ---------- surfaces ---------- */
// Brushed stainless: lathe UVs run v along the profile, so rows become concentric brushing.
export const steel = () => once('steel', () => {
  const S = 512, N = makeNoise(101);
  const H = field(S, (u, v) => 0.7 * N.fbm(u, v, 2, 3, 0.6, 1, 96) + 0.3 * N.fbm(u, v, 8, 4));
  const R = field(S, (u, v) => 0.6 * N.fbm(u, v, 3, 4) + 0.4 * N.fbm(u, v, 1, 2, 0.5, 1, 128));
  return { normal: normalMap(H, S, 0.9), rough: grayMap(R, S, 0.1, 0.32) };
});

// Hammered copper: dimples + patina + polished highlights
export const copper = () => once('copper', () => {
  const S = 512, r = rng(7), N = makeNoise(102);
  const H = new Float32Array(S * S).fill(0.5);
  for (let k = 0; k < 900; k++) {
    const cx = r() * S, cy = r() * S, rad = 6 + r() * 14, dep = 0.25 + r() * 0.3;
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d2 = (x * x + y * y) / (rad * rad); if (d2 > 1) continue;
      const px = ((Math.round(cx + x) % S) + S) % S, py = ((Math.round(cy + y) % S) + S) % S;
      H[py * S + px] -= dep * (1 - d2) * (1 - d2);
    }
  }
  const patina = field(S, (u, v) => N.fbm(u, v, 3, 5));
  const map = toTexture(S, (x, y, i) => {
    const p = patina[i], h = H[i];
    let c = mixC([196, 108, 62], [140, 66, 36], sstep(0.45, 0.75, p));      // copper → darker oxide
    c = mixC(c, [226, 150, 98], sstep(0.55, 0.3, p) * 0.35);                 // polished streaks
    c = mixC(c, [70, 40, 24], sat(0.5 - h) * 0.5);                           // grime in dimples
    return c;
  });
  const rough = toTexture(S, (x, y, i) => { const v = (0.2 + 0.25 * sstep(0.4, 0.8, patina[i]) + sat(0.5 - H[i]) * 0.2) * 255; return [v, v, v]; }, { srgb: false });
  return { map, normal: normalMap(H, S, 6), rough };
});

export const brass = () => once('brass', () => {
  const c = copper(); const S = 512, N = makeNoise(103);
  const P = field(S, (u, v) => N.fbm(u, v, 3, 5));
  const map = toTexture(S, (x, y, i) => mixC([214, 168, 78], [150, 104, 40], sstep(0.45, 0.8, P[i])));
  return { map, normal: c.normal, rough: c.rough };
});

// Unglazed terracotta
export const clay = () => once('clay', () => {
  const S = 512, N = makeNoise(104), r = rng(9);
  const H = field(S, (u, v) => 0.75 * N.fbm(u, v, 8, 5) + 0.25 * N.fbm(u, v, 48, 2));
  const C = field(S, (u, v) => N.fbm(u, v, 3, 4));
  const map = toTexture(S, (x, y, i) => {
    let c = mixC([170, 84, 46], [128, 58, 32], sstep(0.35, 0.7, C[i]));
    c = mixC(c, [196, 118, 74], sstep(0.62, 0.75, H[i]) * 0.5);
    if (r() < 0.004) c = mixC(c, [235, 200, 160], 0.6); // mineral specks
    return c;
  });
  return { map, normal: normalMap(H, S, 5), rough: grayMap(H, S, 0.78, 0.98) };
});

// Slow-cooked beef: stringy fibres + glaze pooling in crevices
export const meat = () => once('meat', () => {
  const S = 512, N = makeNoise(105);
  const fib = field(S, (u, v) => {
    const f = N.fbm(u, v, 6, 5, 0.55, 1, 5);          // stretched along v → fibres
    const crev = N.fbm(u, v, 3, 4);
    return 0.65 * f + 0.35 * crev;
  });
  const map = toTexture(S, (x, y, i) => {
    const h = fib[i];
    let c = mixC([52, 16, 8], [138, 54, 22], sstep(0.3, 0.75, h));          // crevice → fibre top
    c = mixC(c, [176, 78, 30], sstep(0.7, 0.85, h) * 0.6);                  // caramelised ridges
    c = mixC(c, [96, 22, 10], sstep(0.45, 0.25, h) * 0.6);                  // red masala in gaps
    return c;
  });
  const rough = toTexture(S, (x, y, i) => { const v = (0.22 + 0.4 * sstep(0.35, 0.8, fib[i])) * 255; return [v, v, v]; }, { srgb: false });
  return { map, normal: normalMap(fib, S, 9), rough };
});

// Shank bone: ivory with cooked stains and pores
export const bone = () => once('bone', () => {
  const S = 512, N = makeNoise(106), r = rng(11);
  const H = field(S, (u, v) => 0.6 * N.fbm(u, v, 8, 5, 0.55, 1, 3) + 0.4 * N.fbm(u, v, 32, 3));
  const C = field(S, (u, v) => N.fbm(u, v, 3, 5));
  const pores = new Float32Array(S * S);
  for (let k = 0; k < 2200; k++) { const x = (r() * S) | 0, y = (r() * S) | 0; pores[y * S + x] = 1; pores[y * S + ((x + 1) % S)] = 0.6; }
  for (let i = 0; i < H.length; i++) H[i] -= pores[i] * 0.35;
  const map = toTexture(S, (x, y, i) => {
    let c = mixC([236, 222, 194], [206, 176, 128], sstep(0.35, 0.7, C[i]));
    c = mixC(c, [140, 86, 42], sstep(0.62, 0.82, C[i]) * 0.75);             // masala stains
    c = mixC(c, [90, 56, 30], pores[i] * 0.7);
    return c;
  });
  return { map, normal: normalMap(H, S, 5), rough: grayMap(C, S, 0.35, 0.7) };
});

export const marrow = () => once('marrow', () => {
  const S = 256, N = makeNoise(107);
  const H = field(S, (u, v) => N.fbm(u, v, 6, 5));
  const map = toTexture(S, (x, y, i) => {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2;
    let c = mixC([120, 46, 26], [62, 18, 10], sstep(0.2, 0.9, d));
    c = mixC(c, [170, 92, 60], sstep(0.55, 0.85, H[i]) * 0.5 * (1 - d));     // gelatinous sheen
    return c;
  }, { repeat: [1, 1] });
  return { map, normal: normalMap(H, S, 3) };
});

// Dough seal: baked, blistered, charred spots
export const dough = () => once('dough', () => {
  const S = 512, N = makeNoise(108), r = rng(13);
  const H = field(S, (u, v) => 0.6 * N.fbm(u, v, 6, 5) + 0.4 * N.fbm(u, v, 24, 3));
  const blist = new Float32Array(S * S);
  for (let k = 0; k < 160; k++) {
    const cx = r() * S, cy = r() * S, rad = 4 + r() * 16;
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d2 = (x * x + y * y) / (rad * rad); if (d2 > 1) continue;
      const i = (((Math.round(cy + y) % S) + S) % S) * S + (((Math.round(cx + x) % S) + S) % S);
      blist[i] = Math.max(blist[i], 1 - d2);
    }
  }
  for (let i = 0; i < H.length; i++) H[i] += blist[i] * 0.4;
  const map = toTexture(S, (x, y, i) => {
    let c = mixC([232, 196, 132], [204, 150, 80], sstep(0.4, 0.7, H[i]));
    c = mixC(c, [120, 62, 20], sstep(0.55, 0.95, blist[i]) * 0.85);          // browned blister tops
    c = mixC(c, [40, 20, 8], sstep(0.85, 1, blist[i]) * 0.7);                // char
    return c;
  });
  return { map, normal: normalMap(H, S, 6), rough: grayMap(H, S, 0.7, 0.92) };
});

// Milk-pudding skin
export const kheer = () => once('kheer', () => {
  const S = 512, N = makeNoise(109);
  const H = field(S, (u, v) => 0.7 * N.fbm(u, v, 5, 5) + 0.3 * N.fbm(u, v, 20, 3));
  const map = toTexture(S, (x, y, i) => mixC([246, 234, 206], [224, 196, 148], sstep(0.45, 0.85, H[i])));
  return { map, normal: normalMap(H, S, 2.5) };
});

export const raita = () => once('raita', () => {
  const S = 512, N = makeNoise(110), r = rng(17);
  const H = field(S, (u, v) => N.fbm(u, v, 6, 5));
  const map = toTexture(S, (x, y, i) => {
    let c = mixC([246, 244, 234], [226, 222, 204], sstep(0.4, 0.8, H[i]));
    const q = r();
    if (q < 0.010) c = [150, 42, 22];             // red chilli powder
    else if (q < 0.016) c = [96, 64, 32];         // roasted cumin
    else if (q < 0.03) c = mixC(c, [120, 170, 80], 0.6); // grated cucumber
    return c;
  });
  return { map, normal: normalMap(H, S, 2) };
});

// Leaf (alpha-cut, veined). kind: 'mint' | 'bay'
export const leaf = (kind = 'mint') => once('leaf' + kind, () => {
  const W = 256, N = makeNoise(kind === 'mint' ? 111 : 112);
  const base = kind === 'mint' ? [[44, 98, 36], [86, 150, 60]] : [[96, 98, 48], [146, 140, 82]];
  const H = new Float32Array(W * W), A = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const u = x / W - 0.5, v = y / W;                                 // v: 0 tip → 1 stem
    const half = Math.sin(Math.PI * Math.pow(v, kind === 'mint' ? 0.8 : 0.95)) * (kind === 'mint' ? 0.36 : 0.22);
    const serr = kind === 'mint' ? (Math.abs(Math.sin(v * 46)) * 0.03) : 0;
    const edge = half - serr - Math.abs(u);
    A[y * W + x] = sstep(0, 0.01, edge);
    const mid = sstep(0.012, 0, Math.abs(u));
    const side = Math.abs(Math.sin((v * 7 - Math.abs(u) * 5) * Math.PI));
    const vein = Math.max(mid, sstep(0.08, 0, 1 - side) * 0.6 * (edge > 0.02 ? 1 : 0));
    H[y * W + x] = 0.5 + vein * 0.5 - (kind === 'mint' ? N.fbm(x / W, y / W, 12, 3) * 0.25 : 0);
  }
  const map = toTexture(W, (x, y, i) => {
    const c = mixC(base[0], base[1], sat(H[i] - 0.35));
    return [...c, A[i] * 255];
  }, { repeat: [1, 1] });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const n = normalMap(H, W, 4); n.wrapS = n.wrapT = THREE.ClampToEdgeWrapping;
  return { map, normal: n };
});

// Generic organic bump for spices; kind tweaks frequency/stretch
export const organic = (kind) => once('org' + kind, () => {
  const S = 256, N = makeNoise(120 + kind.length);
  const cfg = { anise: [10, 1, 3], bark: [6, 1, 14], cardamom: [4, 1, 10], pepper: [14, 1, 1], chili: [6, 1, 6], rind: [40, 1, 1], clove: [12, 1, 2] }[kind] || [8, 1, 1];
  const H = field(S, (u, v) => N.fbm(u, v, cfg[0], 5, 0.55, cfg[1], cfg[2]));
  return { normal: normalMap(H, S, kind === 'rind' ? 3 : 7), rough: grayMap(H, S, 0.45, 0.85), H, S };
});

// Wispy smoke puffs (4 variants)
export const smoke = () => once('smoke', () => {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const S = 128, N = makeNoise(200 + k);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, dx = u - 0.5, dy = v - 0.5;
      const d = Math.hypot(dx, dy) * 2;
      const n = N.fbm(u, v, 3, 5, 0.55);
      const a = sat((1 - d) * 1.2) * sstep(0.35, 0.8, n + (1 - d) * 0.3);
      const i = (y * S + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 246; img.data[i + 2] = 232; img.data[i + 3] = a * 200;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; out.push(t);
  }
  return out;
});

// Citrus flesh (lemon) + slices
export const citrus = () => once('citrus', () => {
  const S = 256, N = makeNoise(130);
  return toTexture(S, (x, y) => {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    if (d > 0.97) return [240, 204, 52];
    if (d > 0.88) return [250, 244, 214];
    const seg = Math.abs(Math.sin(a * 4.5));
    const ves = N.fbm(x / S, y / S, 24, 3);
    let c = mixC([246, 222, 92], [252, 238, 150], ves);
    c = mixC(c, [255, 250, 225], sstep(0.06, 0, seg) * 0.9 + sstep(0.12, 0, d) * 0.8);
    return c;
  }, { repeat: [1, 1] });
});
export const cucumber = () => once('cuc', () => {
  const S = 256, N = makeNoise(131);
  return toTexture(S, (x, y) => {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    if (d > 0.95) return [38, 74, 26];
    if (d > 0.86) return mixC([120, 170, 70], [60, 110, 40], (d - 0.86) / 0.09);
    let c = mixC([206, 226, 160], [226, 238, 190], N.fbm(x / S, y / S, 10, 3));
    const seedRing = sstep(0.1, 0, Math.abs(d - 0.32));
    const seeds = Math.abs(Math.sin(a * 6)) > 0.8 ? 1 : 0;
    c = mixC(c, [238, 242, 210], seedRing * seeds);
    return c;
  }, { repeat: [1, 1] });
});
export const tomato = () => once('tom', () => {
  const S = 256, N = makeNoise(132);
  return toTexture(S, (x, y) => {
    const dx = x / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    if (d > 0.95) return [168, 26, 18];
    let c = [214, 50, 36];
    const cham = Math.cos(a * 3) * 0.5 + 0.5;
    if (d > 0.25 && d < 0.78 && cham > 0.35) {
      c = mixC([236, 110, 76], [244, 150, 100], N.fbm(x / S, y / S, 10, 3));
      if (N.fbm(x / S, y / S, 30, 2) > 0.62) c = [240, 214, 120];        // seeds
    }
    return c;
  }, { repeat: [1, 1] });
});
