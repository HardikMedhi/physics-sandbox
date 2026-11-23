import type { Surface, WorldParams } from './types';
import { vec3 } from './vec3';

/** User-editable physical settings. */
export interface PhysicsSettings {
  mass: number;
  gravity: number;
  /** When false there is no table and the ball starts on the floor. */
  tableEnabled: boolean;
  /** table size along x, m */
  tableLength: number;
  /** table size along z, m */
  tableWidth: number;
  /** height of the table top above the floor, m */
  tableHeight: number;
  tableMuS: number;
  tableMuK: number;
  floorMuS: number;
  floorMuK: number;
}

export const DEFAULT_SETTINGS: Readonly<PhysicsSettings> = {
  mass: 1,
  gravity: 9.81,
  tableEnabled: true,
  tableLength: 2.4,
  tableWidth: 1.2,
  tableHeight: 0.8,
  tableMuS: 0.25,
  tableMuK: 0.2,
  floorMuS: 0.5,
  floorMuK: 0.4,
};

/** Allowed ranges for the table dimensions, m. */
export const TABLE_LIMITS = {
  length: { min: 0.2, max: 20 },
  width: { min: 0.2, max: 20 },
  height: { min: 0.1, max: 3 },
} as const;

export const TABLE_THICKNESS = 0.04;
export const BALL_RADIUS = 0.05;

/** Geometry of the table top (for physics bounds and rendering). */
export interface TableSpec {
  top: number;
  halfX: number;
  halfZ: number;
  thickness: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function tableSpec(s: PhysicsSettings): TableSpec | null {
  if (!s.tableEnabled) return null;
  return {
    top: clamp(s.tableHeight, TABLE_LIMITS.height.min, TABLE_LIMITS.height.max),
    halfX: clamp(s.tableLength, TABLE_LIMITS.length.min, TABLE_LIMITS.length.max) / 2,
    halfZ: clamp(s.tableWidth, TABLE_LIMITS.width.min, TABLE_LIMITS.width.max) / 2,
    thickness: TABLE_THICKNESS,
  };
}

export function buildWorldParams(s: PhysicsSettings): WorldParams {
  const floor: Surface = {
    id: 'floor',
    top: 0,
    xMin: -Infinity, xMax: Infinity,
    zMin: -Infinity, zMax: Infinity,
    muS: s.floorMuS, muK: s.floorMuK,
  };
  const t = tableSpec(s);
  if (!t) {
    return {
      gravity: s.gravity,
      ball: { mass: s.mass, radius: BALL_RADIUS },
      surfaces: [floor],
      initialPosition: vec3(0, BALL_RADIUS, 0),
    };
  }
  const table: Surface = {
    id: 'table',
    top: t.top,
    xMin: -t.halfX, xMax: t.halfX,
    zMin: -t.halfZ, zMax: t.halfZ,
    muS: s.tableMuS, muK: s.tableMuK,
  };
  return {
    gravity: s.gravity,
    ball: { mass: s.mass, radius: BALL_RADIUS },
    surfaces: [table, floor],
    // Start on the left third of the table so there is room to push toward +x.
    initialPosition: vec3((-2 / 3) * t.halfX, t.top + BALL_RADIUS, 0),
  };
}
