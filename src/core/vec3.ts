/**
 * Minimal immutable 3-vector math. Kept dependency-free so the core can be
 * ported to Rust (or any other language) one-to-one.
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const ZERO: Vec3 = Object.freeze(vec3());

export const add = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => vec3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
/** Length of the horizontal (x–z) part of a vector. */
export const horizontalLength = (a: Vec3): number => Math.hypot(a.x, a.z);
export const sum = (...vs: Vec3[]): Vec3 => vs.reduce(add, ZERO);
