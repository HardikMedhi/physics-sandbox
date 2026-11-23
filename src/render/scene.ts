import * as THREE from 'three';
import { createInfiniteFloor } from './infiniteGrid';
import type { Quality } from './quality';

/** Lights, an infinite-looking floor with grid, and fog. (The axis triad is the screen-corner AxisGizmo.) */
export function createScene(quality: Quality): { scene: THREE.Scene; floor: THREE.Mesh } {
  const scene = new THREE.Scene();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 6, 4);
  if (quality === 'high') {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // Small biases prevent "shadow acne" (self-shadowing stripes) on the floor and table.
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    const cam = sun.shadow.camera;
    cam.left = -6; cam.right = 6; cam.top = 6; cam.bottom = -6; cam.near = 0.5; cam.far = 20;
  }
  scene.add(sun);

  const floor = createInfiniteFloor();
  scene.add(floor);
  // Fog blends the far floor into the background colour so there is no visible edge.
  // Its colour is kept in sync with the background by the Viewport.
  scene.fog = new THREE.Fog(0xcfd8e3, 60, 400);


  return { scene, floor };
}
