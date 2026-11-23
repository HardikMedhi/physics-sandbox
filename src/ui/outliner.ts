import type { ObjectId, SceneEditor } from '../sim/sceneEditor';
import { h, panel } from './dom';

const ROWS: { id: ObjectId; label: string; icon: string }[] = [
  { id: 'world', label: 'World', icon: '🌐' },
  { id: 'ball', label: 'Ball', icon: '●' },
  { id: 'table', label: 'Table', icon: '▭' },
  { id: 'floor', label: 'Floor', icon: '▦' },
];

/** Scene outliner (like Blender's): every object in the scene, click to select. */
export function createOutliner(editor: SceneEditor, onShowForces: (show: boolean) => void): HTMLElement {
  const list = h('ul', { class: 'outliner' });

  function render(): void {
    const sel = editor.selection;
    const tableOn = editor.scene.table.enabled;
    list.replaceChildren(
      ...ROWS.map(({ id, label, icon }) => {
        const missing = id === 'table' && !tableOn;
        const row = h(
          'li',
          {},
          h('button', {
            type: 'button',
            class: 'outliner-item',
            'aria-pressed': String(sel === id),
            disabled: missing,
            onclick: () => editor.select(sel === id ? null : id),
          }, h('span', { class: 'outliner-icon', text: icon }), label + (missing ? ' (removed)' : '')),
        );
        if (id === 'table') {
          row.append(
            missing
              ? h('button', { type: 'button', class: 'icon', title: 'Add the table back', text: '+', onclick: () => editor.updateTable({ enabled: true }) })
              : h('button', { type: 'button', class: 'icon', title: 'Remove the table (Delete)', text: '×', onclick: () => editor.updateTable({ enabled: false }) }),
          );
        }
        return row;
      }),
    );
  }
  editor.events.on('selection', render);
  editor.events.on('scene', render);
  render();

  const showForces = h('input', { type: 'checkbox', checked: true, onchange: () => onShowForces(showForces.checked) });
  return panel(
    'Scene',
    list,
    h('p', { class: 'muted', text: 'Click objects in the 3D view (or here) to select and edit them. G = move, T = scale, Delete = remove, Esc = deselect.' }),
    h('label', { class: 'check' }, showForces, h('span', { text: 'Show force arrows' })),
  );
}
