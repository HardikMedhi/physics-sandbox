import * as THREE from 'three';
import type { ForceBreakdown, TableSpec, Vec3 } from '../core';
import { FORCE_COLORS, cssVar } from '../theme';
import { ArrowTooltip } from './arrowTooltip';
import { AxisGizmo } from './axisGizmo';
import { createBall } from './ball';
import { CameraRig } from './camera';
import { FORCE_SCALE, ForceArrow, type VectorLike } from './forceArrow';
import { ForceHandle } from './forceHandle';
import { followCamera } from './infiniteGrid';
import { type Quality, detectQuality } from './quality';
import { createRenderer } from './renderer';
import { createScene } from './scene';
import { SelectionTool, type TransformOptions } from './selection';
import { TableObject } from './table';

export interface ViewportOptions {
  table: TableSpec | null;
  ballRadius: number;
  ballStart: Vec3;
}

/** Owns the three.js renderer, scene and camera rig. Knows nothing about the UI. */
export class Viewport {
  readonly rig: CameraRig;
  readonly quality: Quality;
  /** Called while the user drags the force-preview handle (force in N). */
  onPreviewDrag: (force: VectorLike) => void = () => {};

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly floor: THREE.Mesh;
  private readonly ball: THREE.Mesh;
  private radius: number;
  private readonly table = new TableObject();
  readonly selection: SelectionTool;
  private readonly arrows = {
    applied: new ForceArrow(FORCE_COLORS.applied),
    gravity: new ForceArrow(FORCE_COLORS.gravity),
    normal: new ForceArrow(FORCE_COLORS.normal),
    friction: new ForceArrow(FORCE_COLORS.friction),
  };
  /** Preview arrow is exactly linear (no clamping) so its tip can be dragged. */
  private readonly preview = new ForceArrow(FORCE_COLORS.preview, FORCE_SCALE, Infinity, 0);
  private readonly handle: ForceHandle;
  private readonly gizmo: AxisGizmo;
  private readonly tooltip: ArrowTooltip;
  private forces: ForceBreakdown | null = null;

  constructor(container: HTMLElement, opts: ViewportOptions) {
    this.quality = detectQuality();
    this.renderer = createRenderer(this.quality);
    container.appendChild(this.renderer.domElement);
    const built = createScene(this.quality);
    this.scene = built.scene;
    this.floor = built.floor;
    this.applyBackground();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyBackground());

    this.scene.add(this.table.group);
    this.setTable(opts.table);
    this.radius = opts.ballRadius;
    this.ball = createBall();
    this.ball.scale.setScalar(opts.ballRadius);
    this.setBallPosition(opts.ballStart);
    this.scene.add(this.ball);
    for (const a of Object.values(this.arrows)) this.scene.add(a.object);
    this.preview.object.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) Object.assign(m, { transparent: true, opacity: 0.55 });
    });
    this.scene.add(this.preview.object);

    this.rig = new CameraRig(this.renderer.domElement);
    this.rig.home.target.set(0, (opts.table?.top ?? 0.4) * 0.75, 0);
    this.rig.resetView(false);
    this.rig.onFrameBall = () => this.frameBall();

    this.handle = new ForceHandle(this.rig, this.renderer.domElement);
    this.handle.onDrag = (f) => this.onPreviewDrag(f);
    this.scene.add(this.handle.object);

    this.selection = new SelectionTool(this.rig, this.renderer.domElement, this.scene, () => [this.ball, this.table.group, this.floor]);

    this.gizmo = new AxisGizmo(this.rig);
    container.append(this.gizmo.element);

    this.tooltip = new ArrowTooltip(this.rig, this.renderer.domElement, [
      { arrow: this.arrows.applied, label: () => 'Applied force (sum of active forces)', color: FORCE_COLORS.applied },
      { arrow: this.arrows.gravity, label: () => 'Gravity', color: FORCE_COLORS.gravity },
      { arrow: this.arrows.normal, label: () => 'Normal force', color: FORCE_COLORS.normal },
      { arrow: this.arrows.friction, label: () => `Friction (${this.forces?.frictionKind ?? 'none'})`, color: FORCE_COLORS.friction },
      { arrow: this.preview, label: () => 'Preview: force to apply (drag the tip)', color: FORCE_COLORS.preview },
    ]);
    container.append(this.tooltip.element);

    const resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      this.renderer.setSize(w, h, false);
      this.rig.setAspect(w / h);
    };
    new ResizeObserver(resize).observe(container);
    resize();
  }

  /** Update the table (null hides it). */
  setTable(spec: TableSpec | null): void {
    // Do not fight the gizmo while the user is scaling the table.
    if (this.selection?.isDragging && this.selection.mode === 'scale') return;
    this.table.set(spec);
  }

  setBallRadius(r: number): void {
    this.radius = r;
    if (!(this.selection?.isDragging && this.selection.mode === 'scale')) this.ball.scale.setScalar(r);
  }

  /** The 3D object for a selectable id (null if none/hidden). */
  objectFor(id: string | null): THREE.Object3D | null {
    if (id === 'ball') return this.ball;
    if (id === 'table') return this.table.group.visible ? this.table.group : null;
    if (id === 'floor') return this.floor;
    return null;
  }

  /** Select an object in the 3D view (highlight + gizmo). */
  select(id: string | null, options: TransformOptions | null): void {
    this.selection.setSelected(id, this.objectFor(id), options);
  }

  setBallPosition(p: Vec3): void {
    this.ball.position.set(p.x, p.y, p.z);
  }

  /** Show force arrows (null hides them). Friction is drawn at the contact point. */
  setForces(f: ForceBreakdown | null): void {
    this.forces = f;
    const c = this.ball.position;
    const contact = { x: c.x, y: c.y - this.radius, z: c.z };
    this.arrows.applied.set(c, f?.applied ?? null);
    this.arrows.gravity.set(c, f?.gravity ?? null);
    this.arrows.normal.set(contact, f?.normal ?? null);
    this.arrows.friction.set(contact, f?.friction ?? null);
  }

  /** Preview of a force about to be applied, with a draggable tip (null hides both). */
  setPreview(force: Vec3 | null): void {
    this.preview.set(this.ball.position, force);
    this.handle.set(this.ball.position, force);
  }

  frameBall(): void {
    this.rig.frame(this.ball.position.clone(), 0.35);
  }

  frameAll(): void {
    this.rig.resetView();
  }

  render(dt: number): void {
    this.rig.track(this.ball.position);
    this.rig.update(dt);
    followCamera(this.floor, this.rig.camera);
    this.selection.update();
    this.gizmo.update();
    this.tooltip.update();
    this.renderer.render(this.scene, this.rig.camera);
  }

  private applyBackground(): void {
    const bg = new THREE.Color(cssVar('--scene-bg', '#cfd8e3'));
    this.scene.background = bg;
    if (this.scene.fog) this.scene.fog.color.copy(bg);
  }
}
