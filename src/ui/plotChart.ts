import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { QUANTITIES, type Quantity, type SeriesRole, quantitySeries } from '../core';
import type { SimulationController } from '../sim/controller';
import { AXIS_COLORS, ENERGY_COLORS, cssVar } from '../theme';
import { h } from './dom';

/** Minimum time between full data refreshes while playing (keeps low-end devices smooth). */
const REFRESH_MS = 100;

/**
 * One uPlot chart of a quantity versus time: x, y, z components plus the
 * overall quantity, and a dashed marker at the playhead. Used both inline and
 * in pop-out windows (where this module runs in the pop-out's own realm).
 */
export class PlotChart {
  readonly plot: uPlot;
  private readonly marker: HTMLElement;
  private readonly unsubscribe: () => void;
  private readonly resizeObserver: ResizeObserver;
  private dirty = true;
  private lastRefresh = 0;

  constructor(
    private readonly sim: SimulationController,
    readonly quantity: Quantity,
    private readonly body: HTMLElement,
    private readonly height: () => number,
  ) {
    const empty = [[], ...QUANTITIES[quantity].series.map(() => [])] as unknown as uPlot.AlignedData;
    this.plot = new uPlot(this.options(), empty, body);
    this.marker = h('div', { class: 'plot-marker' });
    this.plot.over.append(this.marker);
    this.unsubscribe = sim.events.on('history', () => (this.dirty = true));
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(body);
    this.refresh();
  }

  resize(): void {
    this.plot.setSize({ width: Math.max(200, this.body.clientWidth), height: this.height() });
  }

  /** Call once per animation frame. */
  update(): void {
    const now = performance.now();
    if (this.dirty && (!this.sim.playing || now - this.lastRefresh >= REFRESH_MS)) this.refresh();
    // Playhead marker: cheap DOM move, no chart redraw.
    const x = this.plot.valToPos(this.sim.time, 'x');
    const visible = Number.isFinite(x) && x >= 0 && x <= this.plot.over.clientWidth;
    this.marker.style.display = visible ? 'block' : 'none';
    if (visible) this.marker.style.transform = `translateX(${x}px)`;
  }

  destroy(): void {
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.plot.destroy();
  }

  private refresh(): void {
    this.plot.setData(quantitySeries(this.sim.history, this.quantity) as unknown as uPlot.AlignedData);
    this.dirty = false;
    this.lastRefresh = performance.now();
  }

  private options(): uPlot.Options {
    const info = QUANTITIES[this.quantity];
    const text = cssVar('--text', '#1d2329');
    const grid = cssVar('--grid', 'rgba(127,127,127,0.2)');
    const axis = (label: string): uPlot.Axis => ({
      label,
      stroke: text,
      grid: { stroke: grid, width: 1 },
      ticks: { stroke: grid, width: 1 },
    });
    const value = (_u: uPlot, v: number | null) => (v === null || v === undefined ? '—' : v.toFixed(3));
    const color: Record<SeriesRole, string> = {
      x: AXIS_COLORS.x, y: AXIS_COLORS.y, z: AXIS_COLORS.z, total: text,
      ke: ENERGY_COLORS.ke, pe: ENERGY_COLORS.pe, te: text,
    };
    const thick = (r: SeriesRole) => r === 'total' || r === 'te';
    return {
      width: Math.max(200, this.body.clientWidth),
      height: this.height(),
      scales: { x: { time: false } },
      axes: [axis('t (s)'), axis(`${info.label} (${info.unit})`)],
      series: [
        { label: 't (s)', value },
        ...info.series.map((s) => ({ label: s.label, stroke: color[s.role], width: thick(s.role) ? 2.5 : 1.5, value })),
      ],
      legend: { live: true },
      cursor: { drag: { x: true, y: false } },
    };
  }
}
