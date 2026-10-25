// Shared renderer + studio lighting (custom softbox environment for realistic reflections)
import * as THREE from 'three';

function studioEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x080504, side: THREE.BackSide }));
  room.scale.set(24, 14, 24); s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: 0x1a0f08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -6.9; s.add(floor);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(7, 4, 0xffe2bc, 7, [0, 6.5, 1.5]);      // big overhead softbox (warm)
  panel(1.4, 7, 0xff8a3c, 6, [-6.5, 1, -3]);    // warm rim strip, back-left
  panel(1.2, 6, 0xffcf9a, 3.5, [6.5, 1.5, -2]); // amber strip, back-right
  panel(5, 3, 0xfff2e2, 1.6, [2.5, 2, 7]);      // gentle front fill
  panel(2, 2, 0xffffff, 10, [-3, 4, 4]);        // small hard key for crisp speculars
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return tex;
}

export function makeStage(canvas, { alpha = true, preserve = false, shadowSize = 1024 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft penumbra

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.62;

  const key = new THREE.DirectionalLight(0xffd6a0, 3.8); key.position.set(4.5, 5, 1.2); scene.add(key); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  key.shadow.bias = -0.0003;
  const rim = new THREE.DirectionalLight(0xff7a2e, 2.6); rim.position.set(-5, 2.5, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffb36b, 1.2); rim2.position.set(5, 1, -3); scene.add(rim2);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a0c05, 0.25));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.6, 8.2); camera.lookAt(0, 0, 0);
  // aim the key light's shadow frustum tightly around one object
  const KEY_DIR = new THREE.Vector3(4.5, 5, 1.2).normalize();
  function fitShadow(obj, radius) {
    if (!obj) return; // keep shadows enabled: toggling would force a shader recompile (a visible hitch)
    const r = radius * 1.25;
    key.target.position.copy(obj.position);
    key.position.copy(obj.position).addScaledVector(KEY_DIR, r * 4);
    const c = key.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = r * 1.5; c.far = r * 7;
    c.updateProjectionMatrix();
    key.shadow.normalBias = r * 0.006;
  }
  return { renderer, scene, camera, key, fitShadow };
}
