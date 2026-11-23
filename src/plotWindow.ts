/**
 * Entry point of plot.html — a pop-out window showing one plot. It reads the
 * simulation from the main window (window.opener) and runs its own uPlot and
 * animation loop in this window, so resizing, hovering and zooming all work.
 */
import './ui/styles.css';
import './sandboxHost';
import { QUANTITIES, type Quantity } from './core';
import { h } from './ui/dom';
import { PlotChart } from './ui/plotChart';

const root = document.getElementById('plot-root')!;
const q = new URLSearchParams(location.search).get('q') as Quantity | null;
let host: Window['physicsSandbox'];
try {
  host = window.opener?.physicsSandbox;
} catch {
  host = undefined; // opener on a different origin
}

if (!host || !q || !(q in QUANTITIES)) {
  root.append(h('p', { class: 'muted', text: 'This window shows a plot from the Physics Sandbox. Open it with the ⧉ button on a plot.' }));
} else {
  const sim = host.sim;
  const info = QUANTITIES[q];
  document.title = `${info.label} vs time · Physics Sandbox`;
  const time = h('span', { class: 'time-readout' });
  const header = h('header', { class: 'plot-window-header' }, h('h1', { text: `${info.label} vs time` }), time);
  const body = h('div', { class: 'plot-body' });
  root.append(header, body);

  const legendHeight = () => (body.querySelector('.u-legend') as HTMLElement | null)?.offsetHeight ?? 56;
  const chart = new PlotChart(sim, q, body, () => Math.max(160, window.innerHeight - header.offsetHeight - legendHeight() - 24));
  window.addEventListener('resize', () => chart.resize());
  requestAnimationFrame(() => chart.resize()); // legend height is known after first layout

  let running = true;
  window.addEventListener('pagehide', () => {
    running = false;
    chart.destroy();
  });
  const frame = () => {
    if (!running) return;
    if (!window.opener || window.opener.closed) {
      window.close();
      return;
    }
    chart.update();
    time.textContent = `t = ${sim.time.toFixed(3)} s`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
