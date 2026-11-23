import type { BodyState, FrictionKind, Surface, WorldParams } from './types';
import { type Vec3, ZERO, vec3 } from './vec3';

/** Distance tolerance for "touching a surface", m. */
export const CONTACT_EPS = 1e-6;
/** Speed below which the ball is considered at rest relative to a surface, m/s. */
export const REST_SPEED = 1e-6;

export function withinBounds(s: Surface, x: number, z: number): boolean {
  return x >= s.xMin && x <= s.xMax && z >= s.zMin && z <= s.zMax;
}

/** The highest surface the ball is resting/sliding on, or null if airborne. */
export function findSupport(state: BodyState, params: WorldParams): Surface | null {
  const r = params.ball.radius;
  let best: Surface | null = null;
  for (const s of params.surfaces) {
    if (Math.abs(state.pos.y - (s.top + r)) > CONTACT_EPS) continue;
    if (state.vel.y > REST_SPEED) continue; // moving away from the surface
    if (!withinBounds(s, state.pos.x, state.pos.z)) continue;
    if (!best || s.top > best.top) best = s;
  }
  return best;
}

export interface ContactForces {
  readonly normal: Vec3;
  readonly friction: Vec3;
  readonly kind: FrictionKind;
}

const NO_CONTACT: ContactForces = { normal: ZERO, friction: ZERO, kind: 'none' };

/**
 * Normal force and Coulomb friction from a horizontal support.
 * @param external all non-contact forces (gravity + applied), N
 */
export function contactForces(support: Surface | null, external: Vec3, vel: Vec3): ContactForces {
  if (!support) return NO_CONTACT;
  // The surface can only push, never pull: N = max(0, −F_ext,y).
  const N = Math.max(0, -external.y);
  if (N === 0) return NO_CONTACT;
  const normal = vec3(0, N, 0);

  const vh = Math.hypot(vel.x, vel.z);
  if (vh > REST_SPEED) {
    // Sliding: kinetic friction opposes the velocity.
    const k = (-support.muK * N) / vh;
    return { normal, friction: vec3(vel.x * k, 0, vel.z * k), kind: 'kinetic' };
  }
  // At rest: static friction cancels the horizontal push up to μs·N.
  const fh = Math.hypot(external.x, external.z);
  if (fh === 0) return { normal, friction: ZERO, kind: 'static' };
  if (fh <= support.muS * N) {
    return { normal, friction: vec3(-external.x, 0, -external.z), kind: 'static' };
  }
  // Push exceeds the static limit: starts sliding, kinetic friction opposes the push.
  const k = (-support.muK * N) / fh;
  return { normal, friction: vec3(external.x * k, 0, external.z * k), kind: 'kinetic' };
}
