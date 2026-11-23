import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENE, LIMITS, World, ballOnTable, buildWorldParams, tableSpec, updateBall, updateTable, vec3,
} from '../../src/core';

const r = DEFAULT_SCENE.ball.radius;

describe('scene settings → physics', () => {
  it('uses the table size and position for its surface', () => {
    const s = updateTable(DEFAULT_SCENE, { length: 3, width: 2, height: 1, x: 2, z: -1 });
    const table = buildWorldParams(s).surfaces.find((x) => x.id === 'table')!;
    expect([table.xMin, table.xMax, table.zMin, table.zMax, table.top]).toEqual([0.5, 3.5, -2, 0, 1]);
  });

  it('clamps table dimensions to the limits', () => {
    const t = tableSpec(updateTable(DEFAULT_SCENE, { length: 1000, height: 0 }).table)!;
    expect(2 * t.halfX).toBe(LIMITS.tableLength.max);
    expect(t.top).toBe(LIMITS.tableHeight.min);
  });

  it('without a table only the floor remains', () => {
    const s = updateTable(DEFAULT_SCENE, { enabled: false });
    expect(tableSpec(s.table)).toBeNull();
    expect(buildWorldParams(s).surfaces.map((x) => x.id)).toEqual(['floor']);
  });

  it('passes the initial velocity to the world', () => {
    const s = updateBall(DEFAULT_SCENE, { velocity: vec3(1, 0, 0) });
    expect(new World(buildWorldParams(s), [], 0.01).sample().vel.x).toBe(1);
  });
});

describe('editing rules', () => {
  it('a ball resting on the table is carried when the table moves or changes height', () => {
    expect(ballOnTable(DEFAULT_SCENE)).toBe(true);
    const s = updateTable(DEFAULT_SCENE, { x: 1, z: 0.5, height: 1.2 });
    expect(s.ball.position.x).toBeCloseTo(DEFAULT_SCENE.ball.position.x + 1, 12);
    expect(s.ball.position.z).toBeCloseTo(0.5, 12);
    expect(s.ball.position.y).toBeCloseTo(1.2 + r, 12);
    expect(ballOnTable(s)).toBe(true);
  });

  it('a ball is never placed inside the table top or below the floor', () => {
    const inside = updateBall(DEFAULT_SCENE, { position: vec3(0, 0.79, 0) });
    expect(inside.ball.position.y).toBeCloseTo(0.8 + r, 12);
    const under = updateBall(DEFAULT_SCENE, { position: vec3(0, 0.3, 0) });
    expect(under.ball.position.y).toBe(0.3); // under the table is allowed
    const below = updateBall(DEFAULT_SCENE, { position: vec3(5, -1, 0) });
    expect(below.ball.position.y).toBe(r);
  });

  it('changing the radius keeps a resting ball on its surface', () => {
    const s = updateBall(DEFAULT_SCENE, { radius: 0.2 });
    expect(s.ball.position.y).toBeCloseTo(0.8 + 0.2, 12);
  });
});
