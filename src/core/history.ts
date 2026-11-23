import type { Sample } from './types';
import { vec3 } from './vec3';

/**
 * Column names stored per sample. Derived magnitudes and displacement are
 * stored too, so plots can read zero-copy views without per-frame allocation.
 */
export const HISTORY_FIELDS = [
  't',
  'px', 'py', 'pz',
  'rx', 'ry', 'rz', 'r', // displacement from the first sample and its magnitude
  'vx', 'vy', 'vz', 'v', // velocity and speed
  'ax', 'ay', 'az', 'a', // acceleration and its magnitude
  'sx', 'sy', 'sz', 's', // per-axis and total path length (distance)
  'ke', 'pe', 'te', // kinetic, potential and total mechanical energy
] as const;

export type HistoryField = (typeof HISTORY_FIELDS)[number];

/** Columnar, growable time series of samples (struct-of-arrays, Float64). */
export class History {
  private cols = {} as Record<HistoryField, Float64Array>;
  private n = 0;
  private capacity = 0;

  constructor(initialCapacity = 1024) {
    this.allocate(initialCapacity);
  }

  get length(): number {
    return this.n;
  }

  push(s: Sample): void {
    if (this.n === this.capacity) this.allocate(this.capacity * 2);
    const i = this.n;
    const c = this.cols;
    const x0 = i === 0 ? s.pos.x : c.px[0];
    const y0 = i === 0 ? s.pos.y : c.py[0];
    const z0 = i === 0 ? s.pos.z : c.pz[0];
    const rx = s.pos.x - x0;
    const ry = s.pos.y - y0;
    const rz = s.pos.z - z0;
    c.t[i] = s.t;
    c.px[i] = s.pos.x; c.py[i] = s.pos.y; c.pz[i] = s.pos.z;
    c.rx[i] = rx; c.ry[i] = ry; c.rz[i] = rz; c.r[i] = Math.hypot(rx, ry, rz);
    c.vx[i] = s.vel.x; c.vy[i] = s.vel.y; c.vz[i] = s.vel.z; c.v[i] = Math.hypot(s.vel.x, s.vel.y, s.vel.z);
    c.ax[i] = s.acc.x; c.ay[i] = s.acc.y; c.az[i] = s.acc.z; c.a[i] = Math.hypot(s.acc.x, s.acc.y, s.acc.z);
    c.sx[i] = s.pathAxes.x; c.sy[i] = s.pathAxes.y; c.sz[i] = s.pathAxes.z; c.s[i] = s.path;
    c.ke[i] = s.ke; c.pe[i] = s.pe; c.te[i] = s.ke + s.pe;
    this.n++;
  }

  /** Zero-copy view of a column over the recorded range. */
  column(f: HistoryField): Float64Array {
    return this.cols[f].subarray(0, this.n);
  }

  sample(i: number): Sample {
    if (i < 0 || i >= this.n) throw new RangeError(`sample ${i} out of range [0, ${this.n})`);
    const c = this.cols;
    return {
      t: c.t[i],
      pos: vec3(c.px[i], c.py[i], c.pz[i]),
      vel: vec3(c.vx[i], c.vy[i], c.vz[i]),
      acc: vec3(c.ax[i], c.ay[i], c.az[i]),
      pathAxes: vec3(c.sx[i], c.sy[i], c.sz[i]),
      path: c.s[i],
      ke: c.ke[i],
      pe: c.pe[i],
    };
  }

  /** Keep only the first `n` samples. */
  truncate(n: number): void {
    this.n = Math.max(0, Math.min(this.n, n));
  }

  clear(): void {
    this.n = 0;
  }

  private allocate(capacity: number): void {
    const next = {} as Record<HistoryField, Float64Array>;
    for (const f of HISTORY_FIELDS) {
      const arr = new Float64Array(capacity);
      if (this.capacity > 0) arr.set(this.cols[f].subarray(0, this.n));
      next[f] = arr;
    }
    this.cols = next;
    this.capacity = capacity;
  }
}
