import * as THREE from 'three';
import type { CameraRig } from './camera';
import type { ForceArrow, VectorLike } from './forceArrow';

export interface LabelledArrow {
  arrow: ForceArrow;
  /** Label, possibly depending on the current state (e.g. friction kind). */
  label: () => string;
  color: string;
}

const RAD = 180 / Math.PI;
const PICK_PX = { mouse: 8, touch: 22 } as const;

function describe(f: VectorLike): string {
  const mag = Math.hypot(f.x, f.y, f.z);
  const el = Math.asin(Math.max(-1, Math.min(1, f.y / mag))) * RAD;
  const horizontal = Math.hypot(f.x, f.z) > 1e-9 * mag;
  let az = Math.atan2(-f.z, f.x) * RAD;
  if (az < 0) az += 360;
  const n = (v: number) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(2);
  return (
    `|F| = ${mag.toFixed(2)} N\n` +
    `F = (${n(f.x)}, ${n(f.y)}, ${n(f.z)}) N\n` +
    `azimuth ${horizontal ? `${az.toFixed(1)}°` : '—'} · elevation ${el.toFixed(1)}°`
  );
}

/** Distance from point p to segment ab, all in screen pixels. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Shows magnitude and direction of a force arrow under the mouse (hover) or
 * under a tap (touch). Picking is done in screen space against each arrow's
 * projected segment, and re-evaluated every frame so it stays correct while
 * the simulation plays.
 */
export class ArrowTooltip {
  readonly element: HTMLDivElement;
  private pointer: { x: number; y: number; type: 'mouse' | 'touch' } | null = null;
  private suppressed = false;
  private downAt: { x: number; y: number } | null = null;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  constructor(
    private readonly rig: CameraRig,
    private readonly dom: HTMLElement,
    private readonly arrows: LabelledArrow[],
  ) {
    this.element = document.createElement('div');
    this.element.className = 'arrow-tooltip';
    this.element.hidden = true;

    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.pointer = { x: e.clientX, y: e.clientY, type: 'mouse' };
      this.suppressed = e.buttons !== 0; // hide while orbiting/panning/dragging
    });
    dom.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.pointer = null;
    });
    // Touch: a tap (little movement) shows the tooltip; the next tap elsewhere hides it.
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') this.downAt = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || !this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      this.downAt = null;
      if (moved < 10) {
        this.pointer = { x: e.clientX, y: e.clientY, type: 'touch' };
        this.suppressed = false;
      }
    });
  }

  /** Call once per frame after arrows have been updated. */
  update(): void {
    if (!this.pointer || this.suppressed) {
      this.element.hidden = true;
      return;
    }
    const rect = this.dom.getBoundingClientRect();
    const px = this.pointer.x - rect.left;
    const py = this.pointer.y - rect.top;
    const toScreen = (v: THREE.Vector3) => {
      v.project(this.rig.camera);
      return [((v.x + 1) / 2) * rect.width, ((1 - v.y) / 2) * rect.height] as const;
    };
    let best: LabelledArrow | null = null;
    let bestD: number = PICK_PX[this.pointer.type];
    for (const la of this.arrows) {
      if (!la.arrow.force || !la.arrow.object.visible) continue;
      const [ax, ay] = toScreen(this.a.copy(la.arrow.start));
      const [bx, by] = toScreen(this.b.copy(la.arrow.end));
      const d = segmentDistance(px, py, ax, ay, bx, by);
      if (d <= bestD) {
        bestD = d;
        best = la;
      }
    }
    if (!best || !best.arrow.force) {
      this.element.hidden = true;
      return;
    }
    this.element.hidden = false;
    this.element.style.setProperty('--accent-color', best.color);
    this.element.textContent = `${best.label()}\n${describe(best.arrow.force)}`;
    // Keep the tooltip inside the view.
    const w = this.element.offsetWidth;
    const h = this.element.offsetHeight;
    const x = Math.min(px + 14, rect.width - w - 4);
    const y = py + 16 + h > rect.height ? py - h - 12 : py + 16;
    this.element.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
  }
}
