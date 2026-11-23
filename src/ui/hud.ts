import type { SimulationController } from '../sim/controller';
import { fmt, h } from './dom';

/** Small live readout in the corner of the 3D view. */
export function createHud(container: HTMLElement, sim: SimulationController): () => void {
  const el = h('div', { class: 'hud', 'aria-live': 'off' });
  container.append(el);
  return () => {
    const s = sim.currentSample();
    const f = sim.currentForces();
    const where = f.support ? `on ${f.support.id} (${f.frictionKind} friction)` : 'airborne';
    el.textContent =
      `t = ${fmt(s.t, 3)} s\n` +
      `|v| = ${fmt(Math.hypot(s.vel.x, s.vel.y, s.vel.z))} m/s\n` +
      `|a| = ${fmt(Math.hypot(s.acc.x, s.acc.y, s.acc.z))} m/s²\n` +
      where;
  };
}
