import type { History, HistoryField } from './history';

export type Quantity = 'distance' | 'displacement' | 'velocity' | 'acceleration' | 'energy';

/** What a plotted line represents; the UI maps roles to colours. */
export type SeriesRole = 'x' | 'y' | 'z' | 'total' | 'ke' | 'pe' | 'te';

export interface SeriesInfo {
  readonly field: HistoryField;
  readonly label: string;
  readonly role: SeriesRole;
}

export interface QuantityInfo {
  readonly id: Quantity;
  readonly label: string;
  readonly unit: string;
  readonly series: readonly SeriesInfo[];
}

const vector = (fields: [HistoryField, HistoryField, HistoryField, HistoryField], labels: [string, string, string, string]): SeriesInfo[] =>
  (['x', 'y', 'z', 'total'] as const).map((role, i) => ({ field: fields[i], label: labels[i], role }));

export const QUANTITIES: Readonly<Record<Quantity, QuantityInfo>> = {
  distance: {
    id: 'distance', label: 'Distance', unit: 'm',
    series: vector(['sx', 'sy', 'sz', 's'], ['∫|vₓ|dt', '∫|v_y|dt', '∫|v_z|dt', 's = ∫|v|dt']),
  },
  displacement: {
    id: 'displacement', label: 'Displacement', unit: 'm',
    series: vector(['rx', 'ry', 'rz', 'r'], ['Δx', 'Δy', 'Δz', '|Δr|']),
  },
  velocity: {
    id: 'velocity', label: 'Velocity', unit: 'm/s',
    series: vector(['vx', 'vy', 'vz', 'v'], ['vₓ', 'v_y', 'v_z', '|v|']),
  },
  acceleration: {
    id: 'acceleration', label: 'Acceleration', unit: 'm/s²',
    series: vector(['ax', 'ay', 'az', 'a'], ['aₓ', 'a_y', 'a_z', '|a|']),
  },
  energy: {
    id: 'energy', label: 'Energy', unit: 'J',
    series: [
      { field: 'ke', label: 'KE = ½mv²', role: 'ke' },
      { field: 'pe', label: 'PE = mgh', role: 'pe' },
      { field: 'te', label: 'TE = KE + PE', role: 'te' },
    ],
  },
};

/** Zero-copy series [t, ...lines] for a quantity. */
export function quantitySeries(h: History, q: Quantity): Float64Array[] {
  return [h.column('t'), ...QUANTITIES[q].series.map((s) => h.column(s.field))];
}
