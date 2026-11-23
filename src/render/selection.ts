import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { CameraRig } from './camera';

export type TransformMode = 'translate' | 'scale';

/** How the selected object may be transformed with the gizmo. */
export interface TransformOptions {
  modes: readonly TransformMode[];
  /** allow moving along y (the table only moves in the floor plane) */
  translateY: boolean;
  /** force equal scale on all axes (a sphere stays a sphere) */
  uniformScale: boolean;
}

const CLICK_PX = 5;

/**
 * Click-to-select (raycast against objects tagged with userData.selectId),
 * a highlight box around the selection, and a move/scale gizmo
 * (three.js TransformControls) for objects that allow it.
 */
export class SelectionTool {
  readonly transform: TransformControls;
  /** User clicked an object (its selectId) or empty space (null). */
  onPick: (id: string | null) => void = () => {};
  onTransformStart: (id: string, mode: TransformMode) => void = () => {};
  /** Live during a drag. */
  onTransformChange: (id: string, object: THREE.Object3D, mode: TransformMode) => void = () => {};
  onTransformEnd: (id: string, object: THREE.Object3D, mode: TransformMode) => void = () => {};

  private readonly box: THREE.BoxHelper;
  private readonly raycaster = new THREE.Raycaster();
  private selected: THREE.Object3D | null = null;
  private selectedId: string | null = null;
  private options: TransformOptions | null = null;
  private _mode: TransformMode = 'translate';
  private downAt: { x: number; y: number } | null = null;
  private transformUsed = false;

  constructor(
    private readonly rig: CameraRig,
    private readonly dom: HTMLElement,
    scene: THREE.Scene,
    private readonly pickables: () => THREE.Object3D[],
  ) {
    this.box = new THREE.BoxHelper(new THREE.Object3D(), 0x2f6fde);
    this.box.visible = false;
    (this.box.material as THREE.LineBasicMaterial).depthTest = false;
    this.box.renderOrder = 9;
    scene.add(this.box);

    const tc = new TransformControls(rig.camera, dom);
    tc.setSize(0.8);
    tc.addEventListener('dragging-changed', (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      rig.controls.enabled = !dragging;
      if (!this.selected || !this.selectedId) return;
      if (dragging) {
        this.transformUsed = true;
        this.onTransformStart(this.selectedId, this._mode);
      } else {
        this.onTransformEnd(this.selectedId, this.selected, this._mode);
      }
    });
    tc.addEventListener('objectChange', () => {
      if (!this.selected || !this.selectedId) return;
      if (this._mode === 'scale' && this.options?.uniformScale) {
        // Use whichever axis the user changed most for all three.
        const s = this.selected.scale;
        const k = [s.x, s.y, s.z].reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a));
        s.setScalar(k);
      }
      this.onTransformChange(this.selectedId, this.selected, this._mode);
    });
    scene.add(tc.getHelper());
    this.transform = tc;

    dom.addEventListener('pointerdown', (e) => {
      this.downAt = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
    });
    dom.addEventListener('pointerup', (e) => {
      const down = this.downAt;
      const usedGizmo = this.transformUsed;
      this.downAt = null;
      this.transformUsed = false;
      if (!down || usedGizmo || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_PX) return;
      this.onPick(this.pick(e));
    });
  }

  get mode(): TransformMode {
    return this._mode;
  }

  get isDragging(): boolean {
    return this.transform.dragging;
  }

  /** Highlight an object and attach the gizmo if options allow transforming it. */
  setSelected(id: string | null, object: THREE.Object3D | null, options: TransformOptions | null): void {
    this.selectedId = id;
    this.selected = object;
    this.options = options;
    if (object && id !== 'floor') {
      this.box.setFromObject(object);
      this.box.visible = true;
    } else {
      this.box.visible = false;
    }
    if (object && options && options.modes.length > 0) {
      if (!options.modes.includes(this._mode)) this._mode = options.modes[0];
      this.transform.attach(object);
      this.applyMode();
    } else {
      this.transform.detach();
    }
  }

  setMode(mode: TransformMode): void {
    if (!this.options?.modes.includes(mode)) return;
    this._mode = mode;
    this.applyMode();
  }

  /** Call every frame: follows camera switches and moving objects. */
  update(): void {
    if (this.transform.camera !== this.rig.camera) this.transform.camera = this.rig.camera;
    if (this.box.visible && this.selected) this.box.setFromObject(this.selected);
  }

  private applyMode(): void {
    const tc = this.transform;
    tc.setMode(this._mode);
    const allowY = this._mode === 'scale' || (this.options?.translateY ?? true);
    tc.showY = allowY;
  }

  private pick(e: PointerEvent): string | null {
    const r = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    for (const hit of this.raycaster.intersectObjects(this.pickables(), true)) {
      let o: THREE.Object3D | null = hit.object;
      let visible = true;
      let id: string | null = null;
      while (o) {
        if (!o.visible) visible = false;
        if (!id && typeof o.userData.selectId === 'string') id = o.userData.selectId;
        o = o.parent;
      }
      if (visible && id) return id;
    }
    return null;
  }
}
