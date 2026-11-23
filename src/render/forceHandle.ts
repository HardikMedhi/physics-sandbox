import * as THREE from 'three';
import type { CameraRig } from './camera';
import { FORCE_SCALE, type VectorLike } from './forceArrow';

/**
 * Draggable handle at the tip of the force-preview arrow.
 * Drag moves the tip in the plane facing the camera (so the top view edits
 * the horizontal direction and the front/side views edit elevation).
 * Hold Shift when starting the drag to stay in the horizontal plane.
 */
export class ForceHandle {
  readonly object: THREE.Mesh;
  /** Called with the new force vector, N, while dragging. */
  onDrag: (force: VectorLike) => void = () => {};

  private readonly origin = new THREE.Vector3();
  private readonly plane = new THREE.Plane();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly hitPoint = new THREE.Vector3();
  private dragging = false;

  constructor(
    private readonly rig: CameraRig,
    private readonly dom: HTMLElement,
  ) {
    this.object = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xf5a524, depthTest: false, depthWrite: false }),
    );
    this.object.renderOrder = 11;
    this.object.visible = false;
    // Capture phase so we run before OrbitControls' own pointerdown listener.
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  /** Place the handle at origin + force·scale (null hides it). */
  set(origin: VectorLike, force: VectorLike | null): void {
    this.origin.set(origin.x, origin.y, origin.z);
    if (!force) {
      this.object.visible = false;
      return;
    }
    this.object.visible = true;
    this.object.position.set(
      origin.x + force.x * FORCE_SCALE,
      origin.y + force.y * FORCE_SCALE,
      origin.z + force.z * FORCE_SCALE,
    );
  }

  private pointerToNdc(e: PointerEvent): void {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  /** Screen-space hit test: generous radius, larger for touch. */
  private hits(e: PointerEvent): boolean {
    if (!this.object.visible) return false;
    const r = this.dom.getBoundingClientRect();
    const p = this.object.position.clone().project(this.rig.camera);
    const sx = r.left + ((p.x + 1) / 2) * r.width;
    const sy = r.top + ((1 - p.y) / 2) * r.height;
    const radius = e.pointerType === 'touch' ? 28 : 14;
    return Math.hypot(e.clientX - sx, e.clientY - sy) <= radius;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 || !this.hits(e)) return;
    this.dragging = true;
    this.rig.controls.enabled = false;
    this.dom.setPointerCapture(e.pointerId);
    const normal = new THREE.Vector3();
    if (e.shiftKey) normal.set(0, 1, 0);
    else this.rig.camera.getWorldDirection(normal);
    this.plane.setFromNormalAndCoplanarPoint(normal, this.object.position);
    this.dom.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) {
      if (e.pointerType === 'mouse') this.dom.style.cursor = this.hits(e) ? 'grab' : '';
      return;
    }
    this.pointerToNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hitPoint)) return;
    const f = this.hitPoint.sub(this.origin).divideScalar(FORCE_SCALE);
    this.onDrag({ x: f.x, y: f.y, z: f.z });
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.rig.controls.enabled = true;
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    this.dom.style.cursor = '';
  };
}
