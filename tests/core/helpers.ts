import { type AppliedForce, type Surface, type WorldParams, vec3 } from '../../src/core';

export const G = 9.81;
export const R = 0.05;
export const TOP = 0.8;

export function makeParams(opts: { muS?: number; muK?: number; mass?: number; tableHalfX?: number; restitution?: number } = {}): WorldParams {
  const table: Surface = {
    id: 'table', top: TOP,
    xMin: -(opts.tableHalfX ?? 100), xMax: opts.tableHalfX ?? 100, zMin: -1, zMax: 1,
    muS: opts.muS ?? 0, muK: opts.muK ?? 0, restitution: 1,
  };
  const floor: Surface = {
    id: 'floor', top: 0,
    xMin: -Infinity, xMax: Infinity, zMin: -Infinity, zMax: Infinity,
    muS: 0, muK: 0, restitution: 1,
  };
  return {
    gravity: G,
    ball: { mass: opts.mass ?? 1, radius: R, restitution: opts.restitution ?? 0 },
    surfaces: [table, floor],
    initialPosition: vec3(0, TOP + R, 0),
    initialVelocity: vec3(),
  };
}

export const force = (magnitude: number, start: number, duration: number, azimuthDeg = 0, elevationDeg = 0): AppliedForce => ({
  id: 'F', magnitude, start, duration, azimuthDeg, elevationDeg,
});
