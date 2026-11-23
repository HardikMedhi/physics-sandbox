import { describe, expect, it } from 'vitest';
import { History, World, quantitySeries } from '../../src/core';
import { force, makeParams } from './helpers';

describe('History', () => {
  it('stores samples column-wise, grows past its capacity and truncates', () => {
    const w = new World(makeParams(), [force(1, 0, 1)], 0.01);
    const h = new History(4);
    h.push(w.sample());
    for (let i = 0; i < 99; i++) h.push(w.advance());
    expect(h.length).toBe(100);
    expect(h.column('t')[99]).toBeCloseTo(0.99, 12);
    expect(h.sample(50)).toEqual(h.sample(50));
    h.truncate(10);
    expect(h.length).toBe(10);
    expect(() => h.sample(10)).toThrow(RangeError);
  });

  it('derives displacement relative to the first sample and magnitudes', () => {
    const w = new World(makeParams(), [force(1, 0, 1, 90)], 0.01);
    const h = new History();
    h.push(w.sample());
    for (let i = 0; i < 50; i++) h.push(w.advance());
    const [t, x, , z, mag] = quantitySeries(h, 'displacement');
    expect(t.length).toBe(51);
    expect(x[50]).toBeCloseTo(0, 12);
    expect(z[50]).toBeLessThan(0); // azimuth 90° points along −z
    expect(mag[50]).toBeCloseTo(-z[50], 12);
  });
});
