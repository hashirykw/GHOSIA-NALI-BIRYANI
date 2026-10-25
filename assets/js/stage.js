// Shared renderer / lighting setup
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

export function makeStage(canvas, { alpha = true, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: preserve, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pm.dispose();

  const key = new THREE.DirectionalLight(0xffd6a0, 3.2); key.position.set(3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7a2e, 3.0); rim.position.set(-5, 2.5, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffb36b, 1.4); rim2.position.set(5, 1, -3); scene.add(rim2);
  const fill = new THREE.HemisphereLight(0xfff1dc, 0x1a0c05, 0.35); scene.add(fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 2.6, 8.2); camera.lookAt(0, 0, 0);
  return { renderer, scene, camera };
}
