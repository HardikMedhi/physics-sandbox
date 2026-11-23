import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewPreset = 'front' | 'side' | 'top' | 'perspective';

const FOV = 45;
const HALF_FOV_TAN = Math.tan((FOV * Math.PI) / 360);
const TWEEN_SECONDS = 0.45;

/** Direction from the target toward the camera for each preset. */
const PRESET_DIRS: Record<ViewPreset, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  side: new THREE.Vector3(1, 0, 0),
  // tiny z offset avoids the orbit-controls singularity at the pole
  top: new THREE.Vector3(0, 1, 1e-4).normalize(),
  perspective: new THREE.Vector3(1.1, 0.9, 1.6).normalize(),
};

interface Tween {
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  elapsed: number;
}

const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE']);

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

const easeInOut = (k: number): number => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/**
 * Perspective + orthographic cameras driven by OrbitControls, with animated
 * view presets, Blender-style keyboard shortcuts, WASD/QE fly and follow mode.
 *
 * Mouse: left-drag orbit · right-drag / shift+left-drag pan · wheel zoom (to cursor)
 * Touch: one finger orbit · two fingers pinch-zoom + pan
 */
export class CameraRig {
  readonly perspective = new THREE.PerspectiveCamera(FOV, 1, 0.01, 2000);
  readonly orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 2000);
  readonly controls: OrbitControls;
  readonly home = { target: new THREE.Vector3(0, 0.6, 0), distance: 4 };

  /** Called when projection or follow state changes (for UI buttons). */
  onStateChange: () => void = () => {};
  /** Called for the "frame ball" shortcut. */
  onFrameBall: () => void = () => {};

  private active: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.perspective;
  private aspect = 1;
  private orthoHalfHeight = 1;
  private tween: Tween | null = null;
  private keys = new Set<string>();
  private _follow = false;
  private lastFollow: THREE.Vector3 | null = null;

  constructor(dom: HTMLElement) {
    const c = new OrbitControls(this.perspective, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.zoomToCursor = true;
    c.screenSpacePanning = true;
    c.minDistance = 0.05;
    c.maxDistance = 300;
    c.addEventListener('start', () => (this.tween = null));
    this.controls = c;
    this.resetView(false);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.active;
  }

  get isOrthographic(): boolean {
    return this.active === this.orthographic;
  }

  get follow(): boolean {
    return this._follow;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
    this.updateOrthoFrustum();
  }

  distance(): number {
    return this.active.position.distanceTo(this.controls.target);
  }

  setView(preset: ViewPreset, opposite = false, animate = true): void {
    const dir = PRESET_DIRS[preset].clone();
    if (opposite) dir.multiplyScalar(-1);
    const target = this.controls.target.clone();
    this.moveTo(target.clone().addScaledVector(dir, this.distance()), target, animate);
  }

  resetView(animate = true): void {
    const { target, distance } = this.home;
    if (this.isOrthographic) {
      this.orthographic.zoom = this.orthoHalfHeight / (distance * HALF_FOV_TAN);
      this.orthographic.updateProjectionMatrix();
    }
    this.moveTo(target.clone().addScaledVector(PRESET_DIRS.perspective, distance), target.clone(), animate);
  }

  /** Centre the view on a sphere of the given radius, keeping the viewing direction. */
  frame(center: THREE.Vector3, radius: number, animate = true): void {
    const dir = this.active.position.clone().sub(this.controls.target).normalize();
    const dist = radius / HALF_FOV_TAN;
    if (this.isOrthographic) {
      this.orthographic.zoom = this.orthoHalfHeight / radius;
      this.orthographic.updateProjectionMatrix();
    }
    this.moveTo(center.clone().addScaledVector(dir, dist), center.clone(), animate);
  }

  toggleProjection(): void {
    const target = this.controls.target;
    const p = this.perspective;
    const o = this.orthographic;
    if (!this.isOrthographic) {
      // Match the visible height at the target distance so the switch is seamless.
      this.orthoHalfHeight = this.distance() * HALF_FOV_TAN;
      o.zoom = 1;
      o.position.copy(p.position);
      o.quaternion.copy(p.quaternion);
      this.updateOrthoFrustum();
      this.active = o;
    } else {
      const visibleHalf = this.orthoHalfHeight / o.zoom;
      const dir = o.position.clone().sub(target).normalize();
      p.position.copy(target).addScaledVector(dir, visibleHalf / HALF_FOV_TAN);
      p.quaternion.copy(o.quaternion);
      this.active = p;
    }
    this.controls.object = this.active;
    this.controls.update();
    this.onStateChange();
  }

  setFollow(on: boolean): void {
    this._follow = on;
    this.lastFollow = null;
    this.onStateChange();
  }

  /** Call every frame with the followed object's position. */
  track(p: THREE.Vector3): void {
    if (!this._follow) return;
    if (this.lastFollow) {
      const delta = p.clone().sub(this.lastFollow);
      this.active.position.add(delta);
      this.controls.target.add(delta);
      if (this.tween) {
        this.tween.toPos.add(delta);
        this.tween.toTarget.add(delta);
      }
    } else {
      // Entering follow mode: glide so the ball becomes the orbit centre.
      const offset = this.active.position.clone().sub(this.controls.target);
      this.moveTo(p.clone().add(offset), p.clone(), true);
    }
    this.lastFollow = p.clone();
  }

  update(dt: number): void {
    if (this.tween) {
      const t = this.tween;
      t.elapsed += dt;
      const k = easeInOut(Math.min(1, t.elapsed / TWEEN_SECONDS));
      this.active.position.lerpVectors(t.fromPos, t.toPos, k);
      this.controls.target.lerpVectors(t.fromTarget, t.toTarget, k);
      if (k >= 1) this.tween = null;
    }
    if (this.keys.size > 0) this.fly(dt);
    this.controls.update();
  }

  private moveTo(pos: THREE.Vector3, target: THREE.Vector3, animate: boolean): void {
    if (!animate) {
      this.tween = null;
      this.active.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.tween = {
      fromPos: this.active.position.clone(),
      toPos: pos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      elapsed: 0,
    };
  }

  private fly(dt: number): void {
    const speed = Math.max(0.5, this.distance()) * dt;
    const forward = new THREE.Vector3();
    this.active.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.active.up).normalize();
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(forward);
    if (this.keys.has('KeyS')) move.sub(forward);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);
    if (this.keys.has('KeyE')) move.y += 1;
    if (this.keys.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(speed);
    this.tween = null;
    this.active.position.add(move);
    this.controls.target.add(move);
  }

  private updateOrthoFrustum(): void {
    const h = this.orthoHalfHeight;
    const o = this.orthographic;
    o.left = -h * this.aspect;
    o.right = h * this.aspect;
    o.top = h;
    o.bottom = -h;
    o.updateProjectionMatrix();
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target) || e.metaKey || e.altKey) return;
    const opposite = e.ctrlKey;
    switch (e.code) {
      case 'Numpad1': case 'Digit1': this.setView('front', opposite); break;
      case 'Numpad3': case 'Digit3': this.setView('side', opposite); break;
      case 'Numpad7': case 'Digit7': this.setView('top', opposite); break;
      case 'Numpad0': case 'Digit0': this.setView('perspective', opposite); break;
      case 'Numpad5': case 'Digit5': this.toggleProjection(); break;
      case 'NumpadDecimal': case 'Period': this.onFrameBall(); break;
      case 'Home': this.resetView(); break;
      case 'KeyF': this.setFollow(!this._follow); break;
      default:
        if (FLY_KEYS.has(e.code) && !e.ctrlKey) this.keys.add(e.code);
        return;
    }
    e.preventDefault();
  };
}
