import * as THREE from 'three';
import { AXIS_COLORS } from '../theme';
import type { CameraRig, ViewPreset } from './camera';

const SIZE = 96;
const C = SIZE / 2;
const REACH = 34;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface AxisEnd {
  dir: THREE.Vector3;
  color: string;
  label: string;
  positive: boolean;
  preset: ViewPreset;
  opposite: boolean;
  group: SVGGElement;
  line: SVGLineElement | null;
  circle: SVGCircleElement;
}

/**
 * Orientation gizmo (SVG overlay) showing the world x/y/z axes as seen from
 * the current camera. Clicking an axis end snaps the view to look along it.
 */
export class AxisGizmo {
  readonly element: SVGSVGElement;
  private readonly ends: AxisEnd[] = [];
  private readonly inv = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private lastOrder = '';

  constructor(private readonly rig: CameraRig) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'axis-gizmo');
    svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
    svg.setAttribute('width', String(SIZE));
    svg.setAttribute('height', String(SIZE));
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Axis orientation; click an axis to view along it');
    const bg = document.createElementNS(SVG_NS, 'circle');
    bg.setAttribute('class', 'gizmo-bg');
    bg.setAttribute('cx', String(C));
    bg.setAttribute('cy', String(C));
    bg.setAttribute('r', String(C - 2));
    svg.append(bg);
    this.element = svg;

    const axes: [THREE.Vector3, string, string, ViewPreset][] = [
      [new THREE.Vector3(1, 0, 0), AXIS_COLORS.x, 'X', 'side'],
      [new THREE.Vector3(0, 1, 0), AXIS_COLORS.y, 'Y', 'top'],
      [new THREE.Vector3(0, 0, 1), AXIS_COLORS.z, 'Z', 'front'],
    ];
    for (const [dir, color, label, preset] of axes) {
      for (const positive of [true, false]) {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', positive ? 'gizmo-axis' : 'gizmo-axis negative');
        let line: SVGLineElement | null = null;
        if (positive) {
          line = document.createElementNS(SVG_NS, 'line');
          line.setAttribute('x1', String(C));
          line.setAttribute('y1', String(C));
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', '2.5');
          g.append(line);
        }
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', positive ? '9' : '7');
        circle.setAttribute('fill', positive ? color : 'transparent');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '1.5');
        g.append(circle);
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = positive ? label : '';
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        g.append(text);
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = `View along ${positive ? '' : '−'}${label} axis`;
        g.append(title);
        const end: AxisEnd = {
          dir: positive ? dir.clone() : dir.clone().negate(),
          color, label, positive, preset, opposite: !positive, group: g, line, circle,
        };
        g.addEventListener('click', () => this.rig.setView(end.preset, end.opposite));
        this.ends.push(end);
        svg.append(g);
      }
    }
  }

  update(): void {
    this.inv.copy(this.rig.camera.quaternion).invert();
    const depth: [number, AxisEnd][] = [];
    for (const e of this.ends) {
      this.v.copy(e.dir).applyQuaternion(this.inv); // world axis in camera space
      const x = C + this.v.x * REACH;
      const y = C - this.v.y * REACH;
      e.circle.setAttribute('cx', x.toFixed(1));
      e.circle.setAttribute('cy', y.toFixed(1));
      const text = e.group.querySelector('text')!;
      text.setAttribute('x', x.toFixed(1));
      text.setAttribute('y', y.toFixed(1));
      e.line?.setAttribute('x2', x.toFixed(1));
      e.line?.setAttribute('y2', y.toFixed(1));
      depth.push([this.v.z, e]);
    }
    // Paint far axes first so nearer ones are on top.
    depth.sort((a, b) => a[0] - b[0]);
    const order = depth.map(([, e]) => e.label + e.positive).join();
    if (order !== this.lastOrder) {
      this.lastOrder = order;
      for (const [, e] of depth) this.element.append(e.group);
    }
  }
}
