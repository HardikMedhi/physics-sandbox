import {
  type BallSettings,
  type FloorSettings,
  type SceneSettings,
  type TableSettings,
  buildWorldParams,
  updateBall,
  updateFloor,
  updateTable,
} from '../core';
import type { SimulationController } from './controller';
import { Emitter } from './emitter';

/** Things that can be selected and edited. 'world' holds global settings (gravity). */
export type ObjectId = 'ball' | 'table' | 'floor' | 'world';

export interface EditorEvents extends Record<string, unknown> {
  scene: SceneSettings;
  selection: ObjectId | null;
}

/**
 * Owns the editable scene and the current selection. Every edit is applied to
 * the scene, then the simulation is rebuilt from the new initial conditions.
 */
export class SceneEditor {
  readonly events = new Emitter<EditorEvents>();
  private _scene: SceneSettings;
  private _selection: ObjectId | null = null;

  constructor(
    private readonly sim: SimulationController,
    initial: SceneSettings,
  ) {
    this._scene = structuredClone(initial);
  }

  get scene(): SceneSettings {
    return this._scene;
  }

  get selection(): ObjectId | null {
    return this._selection;
  }

  select(id: ObjectId | null): void {
    if (id === 'table' && !this._scene.table.enabled) id = null;
    if (id === this._selection) return;
    this._selection = id;
    this.events.emit('selection', id);
  }

  /**
   * Called when the user starts dragging an object in the 3D view: editing
   * moves the initial conditions, so show t = 0 where the edit is visible.
   */
  beginDirectEdit(): void {
    this.sim.pause();
    this.sim.seek(0);
  }

  updateBall(patch: Partial<BallSettings>): void {
    this.commit(updateBall(this._scene, patch));
  }

  updateTable(patch: Partial<TableSettings>): void {
    this.commit(updateTable(this._scene, patch));
    if (!this._scene.table.enabled && this._selection === 'table') this.select(null);
  }

  updateFloor(patch: Partial<FloorSettings>): void {
    this.commit(updateFloor(this._scene, patch));
  }

  setGravity(g: number): void {
    this.commit({ ...this._scene, gravity: Math.max(0, g) });
  }

  /** Remove the selected object, if it can be removed (only the table, for now). */
  deleteSelected(): void {
    if (this._selection === 'table') this.updateTable({ enabled: false });
  }

  private commit(next: SceneSettings): void {
    this._scene = next;
    this.sim.setParams(buildWorldParams(next));
    this.events.emit('scene', next);
  }
}
