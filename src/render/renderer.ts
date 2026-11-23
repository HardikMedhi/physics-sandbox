import * as THREE from 'three';
import type { Quality } from './quality';

export function createRenderer(quality: Quality): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: quality === 'high',
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1));
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}
