import * as THREE from 'three';
import type { TableSpec } from '../core';

/**
 * A table whose top face sits at y = top. The group's origin is on the floor
 * under the table centre, so scaling the group in y scales the height and
 * scaling in x/z scales length/width about the centre.
 */
export class TableObject {
  readonly group = new THREE.Group();
  private readonly wood = new THREE.MeshStandardMaterial({ color: 0xb07a4a, roughness: 0.7 });
  private readonly legMat = new THREE.MeshStandardMaterial({ color: 0x6d4a2c, roughness: 0.8 });
  private key = '';

  constructor() {
    this.group.userData.selectId = 'table';
  }

  /** Show the table with the given geometry (null hides it). Rebuilds only when the size changes. */
  set(spec: TableSpec | null): void {
    this.group.visible = !!spec;
    if (!spec) return;
    this.group.position.set(spec.x, 0, spec.z);
    this.group.scale.set(1, 1, 1);
    const key = `${spec.top}|${spec.halfX}|${spec.halfZ}|${spec.thickness}`;
    if (key === this.key) return;
    this.key = key;
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as THREE.Mesh).geometry.dispose();
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2 * spec.halfX, spec.thickness, 2 * spec.halfZ), this.wood);
    top.position.y = spec.top - spec.thickness / 2;
    top.castShadow = top.receiveShadow = true;
    this.group.add(top);

    const legH = spec.top - spec.thickness;
    const inset = Math.min(0.1, 0.3 * Math.min(spec.halfX, spec.halfZ));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), this.legMat);
        leg.position.set(sx * (spec.halfX - inset), legH / 2, sz * (spec.halfZ - inset));
        leg.castShadow = true;
        this.group.add(leg);
      }
    }
  }
}
