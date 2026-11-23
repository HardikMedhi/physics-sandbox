import { describe, expect, it } from 'vitest';
import { World, vec3 } from '../../src/core';
import { G, R, makeParams } from './helpers';

/** Ball released from rest at height h (centre above its floor contact height), away from the table. */
function dropWorld(h: number, restitution: number, dt = 0.0005) {
  const p = { ...makeParams({ restitution, tableHalfX: 0.5 }), initialPosition: vec3(50, R + h, 0) };
  return new World(p, [], dt);
}

/** Highest point reached between the first and second impact. */
function firstReboundPeak(w: World): number {
  let s = w.sample();
  let bounced = false;
  let peak = 0;
  for (let i = 0; i < 20000; i++) {
    const prevVy = s.vel.y;
    s = w.advance();
    if (!bounced && prevVy < 0 && s.vel.y > 0) bounced = true;
    else if (bounced) {
      peak = Math.max(peak, s.pos.y - R);
      if (s.vel.y < 0 && s.pos.y - R < peak * 0.5) break;
    }
  }
  return peak;
}

describe('bouncing (coefficient of restitution)', () => {
  it('rebounds to e² of the drop height', () => {
    const h = 1;
    for (const e of [0.3, 0.6, 0.9]) {
      const peak = firstReboundPeak(dropWorld(h, e));
      expect(Math.abs(peak - e * e * h)).toBeLessThan(0.01);
    }
  });

  it('e = 0 does not bounce and comes to rest on the floor', () => {
    const w = dropWorld(1, 0);
    let s = w.sample();
    for (let i = 0; i < 4000; i++) s = w.advance();
    expect(s.pos.y).toBe(R);
    expect(s.vel.y).toBe(0);
  });

  it('a bouncing ball eventually comes to rest (no endless micro-bounces)', () => {
    const w = dropWorld(1, 0.7, 0.001);
    let s = w.sample();
    for (let i = 0; i < 20000; i++) s = w.advance();
    expect(s.pos.y).toBe(R);
    expect(s.vel.y).toBe(0);
  });
});

describe('energy', () => {
  it('KE = ½mv², PE = mg(y − r), and TE is conserved in free fall and elastic bounces', () => {
    const w = dropWorld(1, 1, 0.0005);
    const s0 = w.sample();
    expect(s0.ke).toBe(0);
    expect(s0.pe).toBeCloseTo(1 * G * 1, 12);
    let maxErr = 0;
    let s = s0;
    for (let i = 0; i < 6000; i++) {
      s = w.advance();
      expect(s.ke).toBeCloseTo(0.5 * (s.vel.x ** 2 + s.vel.y ** 2 + s.vel.z ** 2), 12);
      maxErr = Math.max(maxErr, Math.abs(s.ke + s.pe - s0.pe));
    }
    expect(maxErr / s0.pe).toBeLessThan(0.01);
  });

  it('friction removes kinetic energy from a sliding ball', () => {
    const p = { ...makeParams({ muS: 0.3, muK: 0.3 }), initialVelocity: vec3(2, 0, 0) };
    const w = new World(p, [], 0.001);
    const ke0 = w.sample().ke;
    let s = w.sample();
    for (let i = 0; i < 2000; i++) s = w.advance();
    expect(ke0).toBeCloseTo(2, 12);
    expect(s.ke).toBe(0); // v0²/(2μg) ≈ 0.68 m, stops after ≈ 0.68 s
  });
});
