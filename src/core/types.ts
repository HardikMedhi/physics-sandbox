import type { Vec3 } from './vec3';

/** The simulated body. v1 treats it as a sliding point mass with a radius for contact. */
export interface Ball {
  /** kg */
  readonly mass: number;
  /** m — used for contact height and rendering only (no rotation in v1). */
  readonly radius: number;
  /** coefficient of restitution ("bounciness"), 0 = no bounce, 1 = perfectly elastic */
  readonly restitution: number;
}

/**
 * A horizontal, axis-aligned supporting surface (table top, floor).
 * Bounds may be ±Infinity for an unbounded floor.
 */
export interface Surface {
  readonly id: string;
  /** y-coordinate of the top face, m */
  readonly top: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly zMin: number;
  readonly zMax: number;
  /** coefficient of static friction */
  readonly muS: number;
  /** coefficient of kinetic friction */
  readonly muK: number;
  /** surface restitution; the effective value for an impact is ball.restitution × this */
  readonly restitution: number;
}

export interface WorldParams {
  /** magnitude of gravitational acceleration, m/s² (acts along −y) */
  readonly gravity: number;
  readonly ball: Ball;
  readonly surfaces: readonly Surface[];
  /** initial position of the ball's centre, m */
  readonly initialPosition: Vec3;
  /** initial velocity, m/s */
  readonly initialVelocity: Vec3;
}

/**
 * A user-applied force with constant magnitude and direction acting on the
 * time window [start, start + duration).
 * Direction: azimuth in the x–z plane measured from +x toward −z (counter-
 * clockwise seen from above), elevation measured from the horizontal toward +y.
 */
export interface AppliedForce {
  readonly id: string;
  /** N */
  readonly magnitude: number;
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  /** s */
  readonly start: number;
  /** s */
  readonly duration: number;
}

export type AppliedForceSpec = Omit<AppliedForce, 'id' | 'start'>;

export interface BodyState {
  /** position of the centre, m */
  readonly pos: Vec3;
  /** velocity, m/s */
  readonly vel: Vec3;
}

export type FrictionKind = 'none' | 'static' | 'kinetic';

/** Every force acting on the ball at one instant, for display and integration. */
export interface ForceBreakdown {
  readonly gravity: Vec3;
  readonly applied: Vec3;
  readonly normal: Vec3;
  readonly friction: Vec3;
  readonly net: Vec3;
  readonly support: Surface | null;
  readonly frictionKind: FrictionKind;
}

/** One recorded instant of the simulation. */
export interface Sample {
  /** s */
  readonly t: number;
  readonly pos: Vec3;
  readonly vel: Vec3;
  /** instantaneous acceleration F_net / m at this state, m/s² */
  readonly acc: Vec3;
  /** per-axis path length ∫|v_i| dt, m */
  readonly pathAxes: Vec3;
  /** total path length ∫|v| dt, m */
  readonly path: number;
  /** kinetic energy ½ m |v|², J */
  readonly ke: number;
  /** gravitational potential energy m g (y − r), zero when resting on the floor, J */
  readonly pe: number;
}
