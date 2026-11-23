/**
 * Editable scene description (what the user builds in the sandbox) and its
 * translation into physics parameters. Pure functions, no DOM.
 */
import type { Surface, WorldParams } from './types';
import { type Vec3, vec3 } from './vec3';

export interface BallSettings {
  /** kg */
  mass: number;
  /** m */
  radius: number;
  /** bounciness (coefficient of restitution), 0–1 */
  restitution: number;
  /** initial position of the centre (t = 0), m */
  position: Vec3;
  /** initial velocity (t = 0), m/s */
  velocity: Vec3;
}

export interface TableSettings {
  enabled: boolean;
  /** size along x, m */
  length: number;
  /** size along z, m */
  width: number;
  /** height of the top above the floor, m */
  height: number;
  /** centre of the table in the floor plane, m */
  x: number;
  z: number;
  muS: number;
  muK: number;
  restitution: number;
}

export interface FloorSettings {
  muS: number;
  muK: number;
  restitution: number;
}

export interface SceneSettings {
  /** m/s² */
  gravity: number;
  ball: BallSettings;
  table: TableSettings;
  floor: FloorSettings;
}

export const TABLE_THICKNESS = 0.04;

export const LIMITS = {
  tableLength: { min: 0.2, max: 20 },
  tableWidth: { min: 0.2, max: 20 },
  tableHeight: { min: 0.1, max: 3 },
  ballRadius: { min: 0.005, max: 1 },
  ballMass: { min: 0.001, max: 1000 },
  restitution: { min: 0, max: 1 },
} as const;

const DEFAULT_TABLE: TableSettings = {
  enabled: true, length: 2.4, width: 1.2, height: 0.8, x: 0, z: 0, muS: 0.25, muK: 0.2, restitution: 1,
};
const DEFAULT_RADIUS = 0.05;

export const DEFAULT_SCENE: Readonly<SceneSettings> = {
  gravity: 9.81,
  ball: {
    mass: 1,
    radius: DEFAULT_RADIUS,
    restitution: 0.6,
    // left third of the table, resting on it
    position: vec3((-2 / 3) * (DEFAULT_TABLE.length / 2), DEFAULT_TABLE.height + DEFAULT_RADIUS, 0),
    velocity: vec3(),
  },
  table: DEFAULT_TABLE,
  floor: { muS: 0.5, muK: 0.4, restitution: 1 },
};

/** Geometry of the table top (physics bounds and rendering). */
export interface TableSpec {
  top: number;
  halfX: number;
  halfZ: number;
  thickness: number;
  /** centre in the floor plane */
  x: number;
  z: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const EPS = 1e-6;

export function tableSpec(t: TableSettings): TableSpec | null {
  if (!t.enabled) return null;
  return {
    top: clamp(t.height, LIMITS.tableHeight.min, LIMITS.tableHeight.max),
    halfX: clamp(t.length, LIMITS.tableLength.min, LIMITS.tableLength.max) / 2,
    halfZ: clamp(t.width, LIMITS.tableWidth.min, LIMITS.tableWidth.max) / 2,
    thickness: TABLE_THICKNESS,
    x: t.x,
    z: t.z,
  };
}

const overTable = (t: TableSpec, p: Vec3) => Math.abs(p.x - t.x) <= t.halfX && Math.abs(p.z - t.z) <= t.halfZ;

/** True when the ball is resting on the table top. */
export function ballOnTable(s: SceneSettings): boolean {
  const t = tableSpec(s.table);
  return !!t && overTable(t, s.ball.position) && Math.abs(s.ball.position.y - (t.top + s.ball.radius)) < EPS;
}

/**
 * Keep the ball out of solid objects: never below the floor, and never
 * inside the table top (it is lifted onto it). A ball under the table is allowed.
 */
export function constrainBallPosition(s: SceneSettings, p: Vec3): Vec3 {
  const r = s.ball.radius;
  let y = Math.max(r, p.y);
  const t = tableSpec(s.table);
  if (t && overTable(t, p) && y < t.top + r && y > t.top - t.thickness - r) y = t.top + r;
  return vec3(p.x, y, p.z);
}

export function updateBall(s: SceneSettings, patch: Partial<BallSettings>): SceneSettings {
  const wasOnTable = ballOnTable(s);
  const wasOnFloor = Math.abs(s.ball.position.y - s.ball.radius) < EPS;
  const ball: BallSettings = { ...s.ball, ...patch };
  ball.radius = clamp(ball.radius, LIMITS.ballRadius.min, LIMITS.ballRadius.max);
  ball.mass = clamp(ball.mass, LIMITS.ballMass.min, LIMITS.ballMass.max);
  ball.restitution = clamp(ball.restitution, LIMITS.restitution.min, LIMITS.restitution.max);
  // A resting ball keeps resting on its surface when only its radius changes.
  if (patch.radius !== undefined && patch.position === undefined) {
    const t = tableSpec(s.table);
    if (wasOnTable && t) ball.position = vec3(ball.position.x, t.top + ball.radius, ball.position.z);
    else if (wasOnFloor) ball.position = vec3(ball.position.x, ball.radius, ball.position.z);
  }
  const next = { ...s, ball };
  next.ball.position = constrainBallPosition(next, ball.position);
  return next;
}

/** Edit the table; a ball resting on it is carried along (moved and raised/lowered). */
export function updateTable(s: SceneSettings, patch: Partial<TableSettings>): SceneSettings {
  const table: TableSettings = { ...s.table, ...patch };
  table.length = clamp(table.length, LIMITS.tableLength.min, LIMITS.tableLength.max);
  table.width = clamp(table.width, LIMITS.tableWidth.min, LIMITS.tableWidth.max);
  table.height = clamp(table.height, LIMITS.tableHeight.min, LIMITS.tableHeight.max);
  table.restitution = clamp(table.restitution, LIMITS.restitution.min, LIMITS.restitution.max);
  let ball = s.ball;
  if (ballOnTable(s) && table.enabled) {
    const p = s.ball.position;
    ball = { ...ball, position: vec3(p.x + table.x - s.table.x, table.height + ball.radius, p.z + table.z - s.table.z) };
  }
  const next = { ...s, table, ball };
  next.ball = { ...ball, position: constrainBallPosition(next, ball.position) };
  return next;
}

export function updateFloor(s: SceneSettings, patch: Partial<FloorSettings>): SceneSettings {
  const floor = { ...s.floor, ...patch };
  floor.restitution = clamp(floor.restitution, LIMITS.restitution.min, LIMITS.restitution.max);
  return { ...s, floor };
}

export function buildWorldParams(s: SceneSettings): WorldParams {
  const floor: Surface = {
    id: 'floor',
    top: 0,
    xMin: -Infinity, xMax: Infinity,
    zMin: -Infinity, zMax: Infinity,
    muS: s.floor.muS, muK: s.floor.muK, restitution: s.floor.restitution,
  };
  const t = tableSpec(s.table);
  const surfaces: Surface[] = [floor];
  if (t) {
    surfaces.unshift({
      id: 'table',
      top: t.top,
      xMin: t.x - t.halfX, xMax: t.x + t.halfX,
      zMin: t.z - t.halfZ, zMax: t.z + t.halfZ,
      muS: s.table.muS, muK: s.table.muK, restitution: s.table.restitution,
    });
  }
  return {
    gravity: s.gravity,
    ball: { mass: s.ball.mass, radius: s.ball.radius, restitution: s.ball.restitution },
    surfaces,
    initialPosition: constrainBallPosition(s, s.ball.position),
    initialVelocity: s.ball.velocity,
  };
}
