import type { AppliedForce } from './types';
import { type Vec3, ZERO, add, scale, vec3 } from './vec3';

const DEG = Math.PI / 180;
/** Tolerance for comparing simulation times (t = n·dt is exact up to rounding). */
export const TIME_EPS = 1e-9;

/** Unit vector for an azimuth/elevation pair (see AppliedForce for conventions). */
export function directionFromAngles(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return vec3(Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az));
}

export function isActive(f: AppliedForce, t: number): boolean {
  return t >= f.start - TIME_EPS && t < f.start + f.duration - TIME_EPS;
}

export function appliedForceVector(f: AppliedForce): Vec3 {
  return scale(directionFromAngles(f.azimuthDeg, f.elevationDeg), f.magnitude);
}

/** Sum of all applied forces active at time t. */
export function totalAppliedForce(schedule: readonly AppliedForce[], t: number): Vec3 {
  let total = ZERO;
  for (const f of schedule) if (isActive(f, t)) total = add(total, appliedForceVector(f));
  return total;
}

export const gravityForce = (mass: number, g: number): Vec3 => vec3(0, -mass * g, 0);
