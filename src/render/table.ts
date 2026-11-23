import * as THREE from 'three';
import type { TableSpec } from '../core';

/** Table top + four legs. The top face sits exactly at y = top. */
export function createTable(g: TableSpec): THREE.Group {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xb07a4a, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6d4a2c, roughness: 0.8 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(2 * g.halfX, g.thickness, 2 * g.halfZ), wood);
  top.position.y = g.top - g.thickness / 2;
  top.castShadow = top.receiveShadow = true;
  group.add(top);

  const legH = g.top - g.thickness;
  const legGeo = new THREE.BoxGeometry(0.06, legH, 0.06);
  const inset = Math.min(0.1, 0.3 * Math.min(g.halfX, g.halfZ));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * (g.halfX - inset), legH / 2, sz * (g.halfZ - inset));
      leg.castShadow = true;
      group.add(leg);
    }
  }
  return group;
}
