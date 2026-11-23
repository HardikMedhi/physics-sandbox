import { LIMITS, TABLE_THICKNESS } from '../core';
import type { TransformMode } from '../render/selection';
import type { ObjectId, SceneEditor } from '../sim/sceneEditor';
import { type NumberField, type VectorField, h, numberField, panel, vectorField } from './dom';

export interface TransformModeApi {
  get(): TransformMode;
  set(mode: TransformMode): void;
}

const TITLES: Record<ObjectId, string> = { ball: 'Ball', table: 'Table', floor: 'Floor', world: 'World' };

/**
 * Properties of the selected object (like Blender's properties editor).
 * Fields write straight into the scene; the simulation re-runs from t = 0.
 */
export function createInspector(editor: SceneEditor, modes: TransformModeApi): { element: HTMLElement; syncMode: () => void } {
  const body = h('div', { class: 'inspector' });
  const element = panel('Properties', body);
  let syncers: (() => void)[] = [];
  let modeButtons: HTMLButtonElement[] = [];

  /** Set a field from the scene unless the user is typing in it. */
  const keep = (f: NumberField, get: () => number) => () => {
    if (document.activeElement !== f.input) f.value = +get().toFixed(6);
  };

  function modeBar(available: TransformMode[]): HTMLElement {
    modeButtons = available.map((m) =>
      h('button', {
        type: 'button',
        text: m === 'translate' ? 'Move (G)' : 'Scale (T)',
        'data-mode': m,
        onclick: () => {
          modes.set(m);
          syncMode();
        },
      }),
    );
    syncMode();
    return h('div', { class: 'mode-bar' }, h('span', { class: 'muted', text: '3D gizmo:' }), ...modeButtons);
  }

  function syncMode(): void {
    for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === modes.get()));
  }

  function num(label: string, unit: string, get: () => number, set: (v: number) => void, o: { min?: number; max?: number; step?: number; title?: string } = {}) {
    const f = numberField({ label, unit, value: +get().toFixed(6), min: o.min, max: o.max, step: o.step ?? 0.01, title: o.title, onChange: set });
    syncers.push(keep(f, get));
    return f.row;
  }

  function vec(label: string, unit: string, get: () => { x: number; y: number; z: number }, set: (v: { x: number; y: number; z: number }) => void, title?: string) {
    const f: VectorField = vectorField({ label, unit, value: get(), title, onChange: set });
    syncers.push(() => f.set(get()));
    return f.row;
  }

  function render(): void {
    syncers = [];
    modeButtons = [];
    const id = editor.selection;
    const s = () => editor.scene;
    const R = LIMITS.restitution;
    if (!id) {
      body.replaceChildren(h('p', { class: 'muted', text: 'Nothing selected. Click the ball, the table or the floor in the 3D view, or pick an item in the Scene list.' }));
      return;
    }
    const content: (HTMLElement | null)[] = [h('h4', { text: TITLES[id] })];
    if (id === 'world') {
      content.push(num('Gravity g', 'm/s²', () => s().gravity, (v) => editor.setGravity(v), { min: 0, step: 0.01, title: 'Earth 9.81, Moon 1.62, Mars 3.71' }));
    } else if (id === 'ball') {
      content.push(
        modeBar(['translate', 'scale']),
        num('Mass', 'kg', () => s().ball.mass, (v) => editor.updateBall({ mass: v }), { min: LIMITS.ballMass.min, max: LIMITS.ballMass.max, step: 0.1 }),
        num('Radius', 'm', () => s().ball.radius, (v) => editor.updateBall({ radius: v }), { min: LIMITS.ballRadius.min, max: LIMITS.ballRadius.max, step: 0.01 }),
        num('Bounciness e', '', () => s().ball.restitution, (v) => editor.updateBall({ restitution: v }), {
          min: R.min, max: R.max, step: 0.05,
          title: 'Coefficient of restitution: 0 = no bounce, 1 = perfectly elastic. Effective value = e_ball × e_surface.',
        }),
        vec('Start position', 'm', () => s().ball.position, (p) => editor.updateBall({ position: p }), 'Position of the centre at t = 0'),
        vec('Start velocity', 'm/s', () => s().ball.velocity, (v) => editor.updateBall({ velocity: v }), 'Velocity at t = 0'),
      );
    } else if (id === 'table') {
      const L = LIMITS;
      content.push(
        modeBar(['translate', 'scale']),
        num('Length (x)', 'm', () => s().table.length, (v) => editor.updateTable({ length: v }), { min: L.tableLength.min, max: L.tableLength.max, step: 0.1 }),
        num('Width (z)', 'm', () => s().table.width, (v) => editor.updateTable({ width: v }), { min: L.tableWidth.min, max: L.tableWidth.max, step: 0.1 }),
        num('Height', 'm', () => s().table.height, (v) => editor.updateTable({ height: v }), { min: L.tableHeight.min, max: L.tableHeight.max, step: 0.05, title: `Height of the top surface (thickness ${TABLE_THICKNESS} m)` }),
        num('Centre x', 'm', () => s().table.x, (v) => editor.updateTable({ x: v }), { step: 0.1 }),
        num('Centre z', 'm', () => s().table.z, (v) => editor.updateTable({ z: v }), { step: 0.1 }),
        num('Static μₛ', '', () => s().table.muS, (v) => editor.updateTable({ muS: v }), { min: 0 }),
        num('Kinetic μₖ', '', () => s().table.muK, (v) => editor.updateTable({ muK: v }), { min: 0 }),
        num('Bounciness e', '', () => s().table.restitution, (v) => editor.updateTable({ restitution: v }), { min: R.min, max: R.max, step: 0.05 }),
        effective(() => s().ball.restitution * s().table.restitution),
        h('button', { type: 'button', class: 'danger wide', text: 'Remove table (Delete)', onclick: () => editor.updateTable({ enabled: false }) }),
      );
    } else if (id === 'floor') {
      content.push(
        num('Static μₛ', '', () => s().floor.muS, (v) => editor.updateFloor({ muS: v }), { min: 0 }),
        num('Kinetic μₖ', '', () => s().floor.muK, (v) => editor.updateFloor({ muK: v }), { min: 0 }),
        num('Bounciness e', '', () => s().floor.restitution, (v) => editor.updateFloor({ restitution: v }), { min: R.min, max: R.max, step: 0.05 }),
        effective(() => s().ball.restitution * s().floor.restitution),
        h('p', { class: 'muted', text: 'The floor is the plane y = 0 and extends forever.' }),
      );
    }
    body.replaceChildren(...content.filter((c): c is HTMLElement => !!c));
  }

  function effective(get: () => number): HTMLElement {
    const p = h('p', { class: 'muted' });
    const sync = () => (p.textContent = `Ball bounce on this surface: e = e_ball × e_surface = ${get().toFixed(2)}`);
    syncers.push(sync);
    sync();
    return p;
  }

  editor.events.on('selection', render);
  editor.events.on('scene', () => syncers.forEach((f) => f()));
  render();
  return { element, syncMode };
}
