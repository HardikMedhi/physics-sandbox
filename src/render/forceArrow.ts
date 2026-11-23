import * as THREE from 'three';

export interface VectorLike {
  x: number;
  y: number;
  z: number;
}

/** Arrow length per newton, m/N. Shared by all force arrows so they are comparable. */
export const FORCE_SCALE = 0.06;

/** An arrow whose length is proportional to a force (optionally clamped for readability). */
export class ForceArrow {
  readonly object: THREE.ArrowHelper;
  private readonly dir = new THREE.Vector3();
  /** World-space tail and tip of the drawn arrow (for hover picking). */
  readonly start = new THREE.Vector3();
  readonly end = new THREE.Vector3();
  /** The force currently shown, N (null when hidden). */
  force: VectorLike | null = null;

  constructor(
    color: string,
    private readonly metresPerNewton = FORCE_SCALE,
    private readonly maxLength = 1.5,
    private readonly minLength = 0.08,
  ) {
    this.object = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.1, color);
    this.object.visible = false;
    // Draw on top of geometry so arrows hidden by the table are still readable.
    // renderOrder is not inherited, so set it on the line and cone too.
    this.object.traverse((o) => {
      o.renderOrder = 10;
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) {
        m.depthTest = false;
        m.depthWrite = false;
      }
    });
  }

  set(origin: VectorLike, force: VectorLike | null): void {
    const mag = force ? Math.hypot(force.x, force.y, force.z) : 0;
    if (!force || mag < 1e-9) {
      this.object.visible = false;
      this.force = null;
      return;
    }
    this.force = { x: force.x, y: force.y, z: force.z };
    this.dir.set(force.x / mag, force.y / mag, force.z / mag);
    const len = Math.min(this.maxLength, Math.max(this.minLength, mag * this.metresPerNewton));
    this.object.position.set(origin.x, origin.y, origin.z);
    this.object.setDirection(this.dir);
    this.object.setLength(len, Math.min(0.08, len * 0.35), Math.min(0.05, len * 0.2));
    this.object.visible = true;
    this.start.set(origin.x, origin.y, origin.z);
    this.end.copy(this.start).addScaledVector(this.dir, len);
  }
}
