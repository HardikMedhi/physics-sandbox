import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, DEFAULT_SETTINGS, TABLE_LIMITS, World, buildWorldParams, tableSpec } from '../../src/core';

describe('table settings', () => {
  it('uses the given dimensions for the table surface and starts the ball on it', () => {
    const p = buildWorldParams({ ...DEFAULT_SETTINGS, tableLength: 3, tableWidth: 2, tableHeight: 1 });
    const table = p.surfaces.find((s) => s.id === 'table')!;
    expect([table.xMin, table.xMax, table.zMin, table.zMax, table.top]).toEqual([-1.5, 1.5, -1, 1, 1]);
    expect(p.initialPosition.y).toBe(1 + BALL_RADIUS);
    expect(p.initialPosition.x).toBeCloseTo(-1, 12);
  });

  it('clamps dimensions to the allowed limits', () => {
    const t = tableSpec({ ...DEFAULT_SETTINGS, tableLength: 1000, tableHeight: 0 })!;
    expect(2 * t.halfX).toBe(TABLE_LIMITS.length.max);
    expect(t.top).toBe(TABLE_LIMITS.height.min);
  });

  it('without a table the ball rests on the floor', () => {
    const s = { ...DEFAULT_SETTINGS, tableEnabled: false };
    expect(tableSpec(s)).toBeNull();
    const p = buildWorldParams(s);
    expect(p.surfaces.map((x) => x.id)).toEqual(['floor']);
    const w = new World(p, [], 0.01);
    for (let i = 0; i < 100; i++) w.advance();
    expect(w.sample().pos.y).toBe(BALL_RADIUS);
  });
});
