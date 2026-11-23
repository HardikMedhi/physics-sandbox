import { contactForces, findSupport, withinBounds, CONTACT_EPS, REST_SPEED } from './contact';
import { gravityForce, totalAppliedForce } from './forces';
import type { AppliedForce, BodyState, ForceBreakdown, Surface, WorldParams } from './types';
import { add, scale, sum, vec3 } from './vec3';

/**
 * A bounce slower than this (m/s) is treated as coming to rest, which stops
 * an endless series of ever-smaller bounces. Equal to the speed gravity adds
 * in two steps.
 */
export const bounceRestSpeed = (g: number, dt: number): number => 2 * g * dt;

/** All forces on the ball in the given state at time t. */
export function evaluateForces(
  state: BodyState,
  t: number,
  params: WorldParams,
  schedule: readonly AppliedForce[],
): ForceBreakdown {
  const gravity = gravityForce(params.ball.mass, params.gravity);
  const applied = totalAppliedForce(schedule, t);
  const external = add(gravity, applied);
  const support = findSupport(state, params);
  const c = contactForces(support, external, state.vel);
  return {
    gravity,
    applied,
    normal: c.normal,
    friction: c.friction,
    net: sum(external, c.normal, c.friction),
    support: c.kind === 'none' ? null : support,
    frictionKind: c.kind,
  };
}

/**
 * Advance one step with semi-implicit (symplectic) Euler:
 *   v_{n+1} = v_n + a(x_n, v_n, t_n) Δt
 *   x_{n+1} = x_n + v_{n+1} Δt
 * plus two non-smooth corrections: kinetic friction may not reverse the
 * sliding direction within a step, and an impact with a surface reverses the
 * vertical velocity scaled by the restitution e (v_y → −e v_y); slow bounces
 * come to rest on the surface.
 */
export function step(
  state: BodyState,
  t: number,
  dt: number,
  params: WorldParams,
  schedule: readonly AppliedForce[],
): BodyState {
  const f = evaluateForces(state, t, params, schedule);
  const a = scale(f.net, 1 / params.ball.mass);
  let vel = add(state.vel, scale(a, dt));

  if (f.frictionKind === 'kinetic') {
    const vhx = state.vel.x;
    const vhz = state.vel.z;
    const wasSliding = Math.hypot(vhx, vhz) > REST_SPEED;
    // Friction alone would have reversed the motion: it stops the ball instead.
    if (wasSliding && vel.x * vhx + vel.z * vhz <= 0) vel = vec3(0, vel.y, 0);
  }

  let pos = add(state.pos, scale(vel, dt));
  const landed = landingSurface(state.pos.y, pos, params);
  if (landed) {
    const contactY = landed.top + params.ball.radius;
    const e = params.ball.restitution * landed.restitution;
    const vOut = -e * vel.y; // vel.y < 0 on impact
    if (vOut > bounceRestSpeed(params.gravity, dt)) {
      // Bounce: reflect the overshoot below the surface, scaled by e.
      pos = vec3(pos.x, contactY + e * (contactY - pos.y), pos.z);
      vel = vec3(vel.x, vOut, vel.z);
    } else {
      pos = vec3(pos.x, contactY, pos.z);
      vel = vec3(vel.x, Math.max(0, vel.y), vel.z);
    }
  }
  return { pos, vel };
}

/** Highest surface whose contact plane was crossed downward during the step. */
function landingSurface(prevY: number, pos: BodyState['pos'], params: WorldParams): Surface | null {
  const r = params.ball.radius;
  let best: Surface | null = null;
  for (const s of params.surfaces) {
    const contactY = s.top + r;
    if (prevY < contactY - CONTACT_EPS || pos.y >= contactY) continue;
    if (!withinBounds(s, pos.x, pos.z)) continue;
    if (!best || s.top > best.top) best = s;
  }
  return best;
}
