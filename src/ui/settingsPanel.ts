import { type PhysicsSettings, TABLE_LIMITS } from '../core';
import { h, numberField, panel } from './dom';

export interface SettingsPanelCallbacks {
  /** Any physical setting changed (the caller re-simulates and updates the scene). */
  onChange: (settings: PhysicsSettings) => void;
  onShowForces: (show: boolean) => void;
}

type NumericKey = { [K in keyof PhysicsSettings]: PhysicsSettings[K] extends number ? K : never }[keyof PhysicsSettings];

/** Physical parameters and table setup. Any change re-simulates from t = 0 with the same forces. */
export function createSettingsPanel(initial: PhysicsSettings, cb: SettingsPanelCallbacks): HTMLElement {
  const s: PhysicsSettings = { ...initial };
  const commit = () => cb.onChange({ ...s });
  const field = (key: NumericKey, label: string, unit: string, min: number, step: number, max?: number) =>
    numberField({ label, unit, value: s[key], min, max, step, onChange: (v) => { s[key] = v; commit(); } });

  const L = TABLE_LIMITS;
  const tableFields = [
    field('tableLength', 'Length (x)', 'm', L.length.min, 0.1, L.length.max),
    field('tableWidth', 'Width (z)', 'm', L.width.min, 0.1, L.width.max),
    field('tableHeight', 'Height', 'm', L.height.min, 0.05, L.height.max),
    field('tableMuS', 'Static μₛ', '', 0, 0.01),
    field('tableMuK', 'Kinetic μₖ', '', 0, 0.01),
  ];
  const tableBox = h('div', { class: 'subgroup' }, ...tableFields.map((f) => f.row));
  const syncTableEnabled = () => {
    for (const f of tableFields) f.input.disabled = !s.tableEnabled;
    tableBox.classList.toggle('disabled', !s.tableEnabled);
  };
  const tableToggle = h('input', {
    type: 'checkbox',
    checked: s.tableEnabled,
    onchange: () => {
      s.tableEnabled = tableToggle.checked;
      syncTableEnabled();
      commit();
    },
  });
  syncTableEnabled();

  const showForces = h('input', { type: 'checkbox', checked: true, onchange: () => cb.onShowForces(showForces.checked) });

  return panel(
    'Physics settings',
    field('mass', 'Ball mass', 'kg', 0.001, 0.1).row,
    field('gravity', 'Gravity g', 'm/s²', 0, 0.01).row,
    h('h4', { text: 'Table' }),
    h('label', { class: 'check' }, tableToggle, h('span', { text: 'Table present (off = ball starts on the floor)' })),
    tableBox,
    h('h4', { text: 'Floor friction' }),
    field('floorMuS', 'Static μₛ', '', 0, 0.01).row,
    field('floorMuK', 'Kinetic μₖ', '', 0, 0.01).row,
    h('label', { class: 'check' }, showForces, h('span', { text: 'Show force arrows' })),
  );
}
