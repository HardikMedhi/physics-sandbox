import type { Viewport } from '../render/viewport';
import { h } from './dom';

const HELP = [
  ['Orbit', 'Left-drag · one finger'],
  ['Pan', 'Right-drag · Shift+drag · two fingers'],
  ['Zoom', 'Wheel (toward cursor) · pinch'],
  ['Fly', 'W A S D, Q/E down/up'],
  ['Views', '1 front · 3 side · 7 top · 0 perspective (Ctrl = opposite)'],
  ['Projection', '5 toggles perspective / orthographic'],
  ['Frame ball', '. (period)'],
  ['Follow ball', 'F'],
  ['Reset view', 'Home'],
  ['Select', 'Click an object (ball, table, floor) · Esc deselects'],
  ['Edit', 'G move · T scale · drag the gizmo handles · Delete removes'],
  ['Axis gizmo', 'Click an axis end (bottom-left) to view along it'],
  ['Force arrow', 'Drag the orange tip handle (Shift = horizontal)'],
  ['Time', 'Space play/pause · ← → step'],
];

/** Camera buttons overlaid on the 3D view (essential on touch devices). */
export function createViewControls(container: HTMLElement, viewport: Viewport): void {
  const rig = viewport.rig;
  const btn = (text: string, title: string, onclick: () => void) => h('button', { type: 'button', text, title, onclick });

  const ortho = btn('Ortho', 'Toggle perspective / orthographic (5)', () => rig.toggleProjection());
  const follow = btn('Follow', 'Camera follows the ball (F)', () => rig.setFollow(!rig.follow));
  const help = h(
    'div',
    { class: 'help', hidden: true },
    h('table', {}, ...HELP.map(([k, v]) => h('tr', {}, h('th', { text: k }), h('td', { text: v })))),
  );

  const bar = h(
    'div',
    { class: 'view-controls' },
    btn('Persp', 'Perspective view (0)', () => rig.setView('perspective')),
    btn('Front', 'Front view (1)', () => rig.setView('front')),
    btn('Side', 'Side view (3)', () => rig.setView('side')),
    btn('Top', 'Top view (7)', () => rig.setView('top')),
    ortho,
    follow,
    btn('Ball', 'Frame the ball (.)', () => viewport.frameBall()),
    btn('Home', 'Reset view (Home)', () => viewport.frameAll()),
    btn('?', 'Camera & keyboard help', () => (help.hidden = !help.hidden)),
  );

  const sync = () => {
    ortho.setAttribute('aria-pressed', String(rig.isOrthographic));
    follow.setAttribute('aria-pressed', String(rig.follow));
  };
  rig.onStateChange = sync;
  sync();

  const legend = h(
    'div',
    { class: 'arrow-legend' },
    ...[
      ['applied', 'Applied'],
      ['gravity', 'Gravity'],
      ['normal', 'Normal'],
      ['friction', 'Friction'],
    ].map(([k, label]) => h('span', {}, h('i', { class: `swatch ${k}` }), label)),
  );

  container.append(bar, help, legend);
}
