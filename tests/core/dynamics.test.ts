import { describe, expect, it } from 'vitest';
import { World, directionFromAngles } from '../../src/core';
import { G, R, TOP, force, makeParams } from './helpers';

function run(world: World, seconds: number) {
  const n = Math.round(seconds / world.dt);
  let s = world.sample();
  for (let i = 0; i < n; i++) s = world.advance();
  return s;
}

describe('direction convention', () => {
  it('azimuth 0 is +x, 90 is −z, elevation 90 is +y', () => {
    const a = directionFromAngles(0, 0);
    const b = directionFromAngles(90, 0);
    const c = directionFromAngles(0, 90);
    expect([a.x, a.y, a.z].map((v) => +v.toFixed(12))).toEqual([1, 0, 0]);
    expect([b.x, b.y, b.z].map((v) => +v.toFixed(12))).toEqual([0, 0, -1]);
    expect([c.x, c.y, c.z].map((v) => +v.toFixed(12))).toEqual([0, 1, 0]);
  });
});

describe('frictionless table, constant force', () => {
  it('matches x = ½ a t² up to the first-order Euler error ½ a Δt t', () => {
    const dt = 0.001;
    const F = 2, m = 1, T = 2;
    const w = new World(makeParams({ mass: m }), [force(F, 0, 10)], dt);
    const s = run(w, T);
    const a = F / m;
    // Semi-implicit Euler gives exactly x_n = ½ a t_n² + ½ a Δt t_n for constant a.
    expect(s.pos.x).toBeCloseTo(0.5 * a * T * T + 0.5 * a * dt * T, 9);
    expect(s.vel.x).toBeCloseTo(a * T, 9);
    expect(s.acc.x).toBeCloseTo(a, 12);
    expect(s.pos.y).toBeCloseTo(TOP + R, 12); // stays on the table
  });

  it('stops accelerating when the force ends and coasts at constant velocity', () => {
    const w = new World(makeParams(), [force(3, 0, 1)], 0.01);
    const s = run(w, 3);
    expect(s.vel.x).toBeCloseTo(3, 9);
    expect(s.acc.x).toBe(0);
  });
});

describe('friction', () => {
  it('static friction holds the ball when F ≤ μs·m·g', () => {
    const w = new World(makeParams({ muS: 0.5, muK: 0.4 }), [force(0.5 * G - 0.01, 0, 5)], 0.01);
    const s = run(w, 2);
    expect(s.pos.x).toBe(0);
    expect(s.vel.x).toBe(0);
  });

  it('starts sliding with a = (F − μk·m·g)/m when F > μs·m·g', () => {
    const muS = 0.3, muK = 0.2, F = 5;
    const w = new World(makeParams({ muS, muK }), [force(F, 0, 5)], 0.001);
    const s = run(w, 1);
    expect(s.acc.x).toBeCloseTo(F - muK * G, 9);
  });

  it('kinetic friction stops the ball at t = v₀/(μk·g) and it stays stopped', () => {
    const muK = 0.2, dt = 0.0005;
    // Impulse-like push: 10 N for 0.1 s on a frictionless-to-start? Use μs = μk, measure from the end of the push.
    const w = new World(makeParams({ muS: muK, muK }), [force(10, 0, 0.1)], dt);
    const afterPush = run(w, 0.1);
    const v0 = afterPush.vel.x;
    const expectedStop = v0 / (muK * G);
    let s = afterPush;
    let stopTime = NaN;
    while (s.t < 0.1 + 2 * expectedStop) {
      s = w.advance();
      if (Number.isNaN(stopTime) && s.vel.x === 0) stopTime = s.t - 0.1;
    }
    expect(stopTime).toBeGreaterThan(0);
    expect(Math.abs(stopTime - expectedStop)).toBeLessThan(2 * dt);
    expect(s.vel.x).toBe(0);
    expect(s.acc.x).toBe(0);
  });
});

describe('leaving the table', () => {
  it('falls freely past the edge and reaches the floor after √(2h/g)', () => {
    const dt = 0.0005;
    const v = 1;
    // Start right at the edge moving outward on a frictionless table.
    const params = { ...makeParams({ tableHalfX: 0.5 }), initialPosition: { x: 0.5, y: TOP + R, z: 0 } };
    const w = new World(params, [force(v / 0.001, 0, 0.001)], dt);
    let s = w.sample();
    let landed = NaN;
    while (s.t < 2) {
      s = w.advance();
      if (Number.isNaN(landed) && s.pos.y <= R + 1e-12) landed = s.t;
    }
    const h = TOP;
    expect(Math.abs(landed - Math.sqrt((2 * h) / G))).toBeLessThan(0.01);
    expect(s.pos.y).toBeCloseTo(R, 12); // resting on the floor
    expect(s.vel.y).toBe(0);
  });

  it('lifts off when the upward force exceeds the weight', () => {
    const w = new World(makeParams(), [force(2 * G, 0, 0.5, 0, 90)], 0.001);
    const s = run(w, 0.2);
    expect(s.pos.y).toBeGreaterThan(TOP + R + 0.1);
  });
});

describe('determinism and path length', () => {
  it('same inputs give bit-identical results', () => {
    const mk = () => new World(makeParams({ muS: 0.3, muK: 0.2 }), [force(4, 0, 1, 30, 10)], 0.01);
    const a = run(mk(), 3);
    const b = run(mk(), 3);
    expect(a).toEqual(b);
  });

  it('distance ≥ |displacement| and equals it for straight-line motion', () => {
    const w = new World(makeParams(), [force(1, 0, 1)], 0.01);
    const s = run(w, 2);
    expect(s.path).toBeCloseTo(s.pos.x - 0, 12);
    expect(s.pathAxes.x).toBeCloseTo(s.path, 12);
  });
});
