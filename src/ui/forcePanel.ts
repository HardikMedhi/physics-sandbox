import { type AppliedForce, type Vec3, appliedForceVector, directionFromAngles, isActive, scale } from '../core';
import type { SimulationController } from '../sim/controller';
import { MIN_DT } from '../sim/controller';
import { fmt, h, numberField, panel } from './dom';

const QUICK_DIRECTIONS: { label: string; az: number; el: number }[] = [
  { label: '+x', az: 0, el: 0 },
  { label: '−x', az: 180, el: 0 },
  { label: '+z', az: 270, el: 0 },
  { label: '−z', az: 90, el: 0 },
  { label: '+y', az: 0, el: 90 },
  { label: '−y', az: 0, el: -90 },
];

export interface ForcePanel {
  readonly element: HTMLElement;
  /** Set magnitude/azimuth/elevation from a force vector (e.g. dragged arrow), N. */
  setVector(f: { x: number; y: number; z: number }): void;
}

const RAD = 180 / Math.PI;
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Panel for defining and applying forces, plus the list of applied forces. */
export function createForcePanel(
  sim: SimulationController,
  onPreview: (force: Vec3 | null) => void,
): ForcePanel {
  const magnitude = numberField({ label: 'Magnitude', unit: 'N', value: 3, min: 0, step: 0.1, onInput: refresh });
  const azimuth = numberField({
    label: 'Azimuth', unit: '°', value: 0, min: -360, max: 360, step: 5, onInput: refresh,
    title: 'Angle in the horizontal x–z plane, from +x toward −z (counter-clockwise seen from above).',
  });
  const elevation = numberField({
    label: 'Elevation', unit: '°', value: 0, min: -90, max: 90, step: 5, onInput: refresh,
    title: 'Angle above the horizontal plane (+90° = straight up).',
  });
  const duration = numberField({ label: 'Duration', unit: 's', value: 1, min: MIN_DT, step: 0.1 });
  for (const f of [magnitude, azimuth, elevation]) f.input.addEventListener('change', refresh);

  const quick = h(
    'div',
    { class: 'button-grid' },
    ...QUICK_DIRECTIONS.map((d) =>
      h('button', {
        type: 'button',
        text: d.label,
        title: `Point the force along ${d.label}`,
        onclick: () => {
          azimuth.value = d.az;
          elevation.value = d.el;
          refresh();
        },
      }),
    ),
  );

  const components = h('div', { class: 'readout' });
  const showPreview = h('input', { type: 'checkbox', checked: true, onchange: refresh });
  const applyBtn = h('button', { type: 'button', class: 'primary', onclick: apply });
  const list = h('ul', { class: 'force-list' });

  function currentVector(): Vec3 {
    return scale(directionFromAngles(azimuth.value, elevation.value), magnitude.value);
  }

  function refresh(): void {
    const F = currentVector();
    components.textContent = `F = (${fmt(F.x, 2)}, ${fmt(F.y, 2)}, ${fmt(F.z, 2)}) N`;
    // The preview stays visible at zero magnitude so its handle can still be dragged.
    onPreview(showPreview.checked ? F : null);
  }

  function setVector(f: { x: number; y: number; z: number }): void {
    const mag = Math.hypot(f.x, f.y, f.z);
    magnitude.value = round(mag, 2);
    if (mag > 1e-9) {
      elevation.value = round(Math.asin(Math.max(-1, Math.min(1, f.y / mag))) * RAD, 1);
      // Only meaningful when there is a horizontal part.
      if (Math.hypot(f.x, f.z) > 1e-9 * mag) {
        let az = Math.atan2(-f.z, f.x) * RAD;
        if (az < 0) az += 360;
        azimuth.value = round(az, 1);
      }
    }
    refresh();
  }

  function apply(): void {
    if (magnitude.value <= 0) return;
    sim.applyForce({
      magnitude: magnitude.value,
      azimuthDeg: azimuth.value,
      elevationDeg: elevation.value,
      duration: Math.max(MIN_DT, duration.value),
    });
  }

  function renderList(): void {
    const t = sim.time;
    list.replaceChildren(
      ...sim.schedule.map((f: AppliedForce) => {
        const v = appliedForceVector(f);
        return h(
          'li',
          { class: isActive(f, t) ? 'active' : '' },
          h('span', {
            text: `${f.id}: ${fmt(f.magnitude, 2)} N (${fmt(v.x, 2)}, ${fmt(v.y, 2)}, ${fmt(v.z, 2)}) · ${fmt(f.start, 3)}–${fmt(f.start + f.duration, 3)} s`,
          }),
          h('button', { type: 'button', class: 'icon', title: 'Remove force (re-simulates from t = 0)', text: '×', onclick: () => sim.removeForce(f.id) }),
        );
      }),
    );
    if (sim.schedule.length === 0) list.append(h('li', { class: 'muted', text: 'No forces applied yet.' }));
  }

  function renderApplyLabel(): void {
    applyBtn.textContent = `Apply force at t = ${fmt(sim.time, 3)} s`;
  }

  // Rebuild the list only when the set of active forces changes, so buttons
  // are not replaced under the pointer every frame during playback.
  let lastSignature = '';
  sim.events.on('time', () => {
    renderApplyLabel();
    const t = sim.time;
    const signature = sim.schedule.map((f) => (isActive(f, t) ? f.id : '')).join(',');
    if (signature !== lastSignature) {
      lastSignature = signature;
      renderList();
    }
  });
  sim.events.on('schedule', renderList);
  refresh();
  renderList();
  renderApplyLabel();

  const hint = h('p', { class: 'muted', text: 'Tip: drag the orange handle at the arrow tip in the 3D view. The drag moves in the plane facing the camera (use the Top view for horizontal pushes); hold Shift to keep it horizontal.' });

  const element = panel(
    'Force',
    magnitude.row,
    azimuth.row,
    elevation.row,
    quick,
    duration.row,
    components,
    h('label', { class: 'check' }, showPreview, h('span', { text: 'Show preview arrow' })),
    applyBtn,
    hint,
    h('h4', { text: 'Applied forces' }),
    list,
  );
  return { element, setVector };
}
