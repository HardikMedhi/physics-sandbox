import type { History, HistoryField } from './history';

export type Quantity = 'distance' | 'displacement' | 'velocity' | 'acceleration';

export interface QuantityInfo {
  readonly id: Quantity;
  readonly label: string;
  /** symbol used for the overall (magnitude) line */
  readonly symbol: string;
  readonly unit: string;
  /** history columns: x, y, z components then the overall quantity */
  readonly fields: readonly [HistoryField, HistoryField, HistoryField, HistoryField];
  readonly componentLabels: readonly [string, string, string, string];
}

export const QUANTITIES: Readonly<Record<Quantity, QuantityInfo>> = {
  distance: {
    id: 'distance', label: 'Distance', symbol: 's', unit: 'm',
    fields: ['sx', 'sy', 'sz', 's'],
    componentLabels: ['∫|vₓ|dt', '∫|v_y|dt', '∫|v_z|dt', 's = ∫|v|dt'],
  },
  displacement: {
    id: 'displacement', label: 'Displacement', symbol: '|Δr|', unit: 'm',
    fields: ['rx', 'ry', 'rz', 'r'],
    componentLabels: ['Δx', 'Δy', 'Δz', '|Δr|'],
  },
  velocity: {
    id: 'velocity', label: 'Velocity', symbol: '|v|', unit: 'm/s',
    fields: ['vx', 'vy', 'vz', 'v'],
    componentLabels: ['vₓ', 'v_y', 'v_z', '|v|'],
  },
  acceleration: {
    id: 'acceleration', label: 'Acceleration', symbol: '|a|', unit: 'm/s²',
    fields: ['ax', 'ay', 'az', 'a'],
    componentLabels: ['aₓ', 'a_y', 'a_z', '|a|'],
  },
};

/** Zero-copy series [t, x, y, z, overall] for a quantity. */
export function quantitySeries(h: History, q: Quantity): [Float64Array, Float64Array, Float64Array, Float64Array, Float64Array] {
  const [fx, fy, fz, fm] = QUANTITIES[q].fields;
  return [h.column('t'), h.column(fx), h.column(fy), h.column(fz), h.column(fm)];
}
