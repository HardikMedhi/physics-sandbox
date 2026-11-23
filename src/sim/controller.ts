import {
  type AppliedForce,
  type AppliedForceSpec,
  type ForceBreakdown,
  type Sample,
  type WorldParams,
  History,
  World,
  evaluateForces,
} from '../core';
import { Emitter } from './emitter';

export const MIN_DT = 0.001;
export const MAX_DT = 0.1;
export const MIN_DURATION = 1;
export const MAX_DURATION = 120;

export interface SimEvents extends Record<string, unknown> {
  /** playhead moved; payload = current time, s */
  time: number;
  /** recorded history changed (grew, truncated or rebuilt) */
  history: void;
  schedule: readonly AppliedForce[];
  playing: boolean;
  /** dt, duration or physical parameters changed */
  config: void;
}

let nextForceId = 1;

/**
 * Owns the simulation state and the timeline. UI and rendering talk to it
 * only through these commands and the events above, so this is the seam
 * where native shells or a WASM core will plug in later.
 */
export class SimulationController {
  readonly events = new Emitter<SimEvents>();
  readonly history = new History();

  private world!: World;
  private _schedule: AppliedForce[] = [];
  private _params: WorldParams;
  private _dt: number;
  private _duration: number;
  private index = 0;
  private _playing = false;
  private _rate = 1;
  /** sim-time clock while playing (fractional steps accumulate here) */
  private clock = 0;

  constructor(params: WorldParams, dt = 0.01, duration = 20) {
    this._params = params;
    this._dt = clampDt(dt);
    this._duration = clampDuration(duration);
    this.rebuild();
  }

  // ---- queries --------------------------------------------------------------
  get params(): WorldParams { return this._params; }
  get dt(): number { return this._dt; }
  get duration(): number { return this._duration; }
  get schedule(): readonly AppliedForce[] { return this._schedule; }
  get playing(): boolean { return this._playing; }
  get rate(): number { return this._rate; }
  get time(): number { return this.index * this._dt; }
  get maxIndex(): number { return Math.round(this._duration / this._dt); }
  get recordedTime(): number { return (this.history.length - 1) * this._dt; }

  currentSample(): Sample {
    return this.history.sample(this.index);
  }

  /** Force breakdown at the playhead (for force arrows). */
  currentForces(): ForceBreakdown {
    const s = this.currentSample();
    return evaluateForces({ pos: s.pos, vel: s.vel }, s.t, this._params, this._schedule);
  }

  // ---- playback -------------------------------------------------------------
  play(): void {
    if (this._playing) return;
    if (this.index >= this.maxIndex) this.seekIndex(0);
    this._playing = true;
    this.clock = this.time;
    this.events.emit('playing', true);
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    this.events.emit('playing', false);
  }

  togglePlay(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  setRate(rate: number): void {
    this._rate = Math.max(0.01, rate);
  }

  /** Advance the playhead by real elapsed seconds (call once per frame). */
  tick(realSeconds: number): void {
    if (!this._playing) return;
    this.clock += realSeconds * this._rate;
    let idx = Math.floor(this.clock / this._dt + 1e-9);
    if (idx >= this.maxIndex) {
      idx = this.maxIndex;
      this.pause();
    }
    if (idx !== this.index) this.seekIndex(idx);
  }

  seek(t: number): void {
    this.seekIndex(Math.round(t / this._dt));
  }

  stepForward(): void { this.pause(); this.seekIndex(this.index + 1); }
  stepBack(): void { this.pause(); this.seekIndex(this.index - 1); }

  // ---- editing ----------------------------------------------------------------
  /** Apply a force starting at the current playhead time. Discards any future history. */
  applyForce(spec: AppliedForceSpec): AppliedForce {
    const t = this.time;
    const force: AppliedForce = { ...spec, id: `F${nextForceId++}`, start: t };
    // Forces that started after the playhead belong to a discarded future.
    this._schedule = [...this._schedule.filter((f) => f.start <= t + 1e-9), force];
    const sample = this.currentSample();
    this.world = new World(this._params, this._schedule, this._dt);
    this.world.restore(this.index, sample);
    this.history.truncate(this.index + 1);
    this.events.emit('schedule', this._schedule);
    this.events.emit('history', undefined);
    return force;
  }

  /** Remove a force; the timeline is recomputed from t = 0. */
  removeForce(id: string): void {
    this._schedule = this._schedule.filter((f) => f.id !== id);
    this.recompute();
    this.events.emit('schedule', this._schedule);
  }

  setParams(params: WorldParams): void {
    this._params = params;
    this.recompute();
    this.events.emit('config', undefined);
  }

  setDt(dt: number): void {
    const t = this.time;
    this._dt = clampDt(dt);
    this.rebuild();
    this.seekIndex(Math.round(t / this._dt));
    this.events.emit('config', undefined);
  }

  setDuration(duration: number): void {
    this._duration = clampDuration(duration);
    this.recompute();
    this.events.emit('config', undefined);
  }

  /** Clear all forces and return to t = 0. */
  reset(): void {
    this.pause();
    this._schedule = [];
    this.rebuild();
    this.index = 0;
    this.events.emit('schedule', this._schedule);
    this.events.emit('time', 0);
  }

  // ---- internals ----------------------------------------------------------------
  private seekIndex(idx: number): void {
    const target = Math.max(0, Math.min(this.maxIndex, idx));
    this.ensureComputed(target);
    this.index = target;
    this.events.emit('time', this.time);
  }

  /** Re-run from t = 0 with the current schedule, keeping the playhead time. */
  private recompute(): void {
    const idx = Math.min(this.index, this.maxIndex);
    this.rebuild();
    this.ensureComputed(idx);
    this.index = idx;
    this.events.emit('time', this.time);
  }

  private rebuild(): void {
    this.world = new World(this._params, this._schedule, this._dt);
    this.history.clear();
    this.history.push(this.world.sample());
    this.index = Math.min(this.index, this.maxIndex);
    this.events.emit('history', undefined);
  }

  private ensureComputed(idx: number): void {
    if (this.history.length - 1 >= idx) return;
    while (this.history.length - 1 < idx) this.history.push(this.world.advance());
    this.events.emit('history', undefined);
  }
}

function clampDt(dt: number): number {
  if (!Number.isFinite(dt)) return 0.01;
  return Math.min(MAX_DT, Math.max(MIN_DT, dt));
}

function clampDuration(d: number): number {
  if (!Number.isFinite(d)) return 20;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, d));
}
