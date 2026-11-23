import { evaluateForces, step } from './dynamics';
import type { AppliedForce, BodyState, Sample, WorldParams } from './types';
import { type Vec3, ZERO, length, scale, vec3 } from './vec3';

/**
 * Stateful wrapper around the pure step function. Time is always computed as
 * t = n·dt (never accumulated) so that it stays exact and reproducible.
 */
export class World {
  private n = 0;
  private state: BodyState;
  private pathAxes: Vec3 = ZERO;
  private path = 0;

  constructor(
    readonly params: WorldParams,
    readonly schedule: readonly AppliedForce[],
    readonly dt: number,
  ) {
    this.state = { pos: params.initialPosition, vel: ZERO };
  }

  get stepIndex(): number {
    return this.n;
  }

  get time(): number {
    return this.n * this.dt;
  }

  sample(): Sample {
    const f = evaluateForces(this.state, this.time, this.params, this.schedule);
    return {
      t: this.time,
      pos: this.state.pos,
      vel: this.state.vel,
      acc: scale(f.net, 1 / this.params.ball.mass),
      pathAxes: this.pathAxes,
      path: this.path,
    };
  }

  /** Advance one step and return the new sample. */
  advance(): Sample {
    const next = step(this.state, this.time, this.dt, this.params, this.schedule);
    const v = next.vel;
    // x_{n+1} − x_n = v_{n+1}·dt, so this is the exact length of the computed polyline.
    this.pathAxes = vec3(
      this.pathAxes.x + Math.abs(v.x) * this.dt,
      this.pathAxes.y + Math.abs(v.y) * this.dt,
      this.pathAxes.z + Math.abs(v.z) * this.dt,
    );
    this.path += length(v) * this.dt;
    this.state = next;
    this.n++;
    return this.sample();
  }

  /** Resume from a previously recorded sample (used when the timeline is rewound). */
  restore(stepIndex: number, s: Sample): void {
    this.n = stepIndex;
    this.state = { pos: s.pos, vel: s.vel };
    this.pathAxes = s.pathAxes;
    this.path = s.path;
  }
}
