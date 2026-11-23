import { QUANTITIES, type Quantity } from '../core';
import type { SimulationController } from '../sim/controller';
import { h, panel } from './dom';
import { PlotChart } from './plotChart';

const INLINE_HEIGHT = 190;

/** URL of the pop-out plot page (works for the dev server and relative builds). */
const plotWindowUrl = (q: Quantity) => new URL(`plot.html?q=${q}`, location.href).toString();

/**
 * Plot toggles (in the sidebar) and chart cards (in the plot area). Each card
 * can be popped out into its own browser window.
 */
export function createPlotPanel(sim: SimulationController, plotArea: HTMLElement): { element: HTMLElement; update: () => void } {
  const charts = new Map<Quantity, { card: HTMLElement; chart: PlotChart }>();
  const buttons = new Map<Quantity, HTMLButtonElement>();

  function open(q: Quantity): void {
    const body = h('div', { class: 'plot-body' });
    const card = h(
      'article',
      { class: 'plot-card' },
      h(
        'header',
        {},
        h('h3', { text: `${QUANTITIES[q].label} vs time` }),
        h(
          'span',
          { class: 'plot-actions' },
          h('button', { type: 'button', class: 'icon', title: 'Open in a separate window', 'aria-label': 'Pop out', text: '⧉', onclick: () => popOut(q) }),
          h('button', { type: 'button', class: 'icon', title: 'Close plot', 'aria-label': 'Close', text: '×', onclick: () => close(q) }),
        ),
      ),
      body,
    );
    plotArea.append(card);
    charts.set(q, { card, chart: new PlotChart(sim, q, body, () => INLINE_HEIGHT) });
    buttons.get(q)?.setAttribute('aria-pressed', 'true');
  }

  function close(q: Quantity): void {
    const c = charts.get(q);
    if (!c) return;
    c.chart.destroy();
    c.card.remove();
    charts.delete(q);
    buttons.get(q)?.setAttribute('aria-pressed', 'false');
  }

  function popOut(q: Quantity): void {
    const w = window.open(plotWindowUrl(q), `physics-plot-${q}`, 'popup,width=760,height=480');
    if (w) close(q); // keep the inline plot if the pop-up was blocked
  }

  function update(): void {
    for (const c of charts.values()) c.chart.update();
  }

  // Re-create charts when the colour scheme changes so axis colours follow.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    for (const q of [...charts.keys()]) {
      close(q);
      open(q);
    }
  });

  const toggles = h(
    'div',
    { class: 'button-grid two' },
    ...(Object.keys(QUANTITIES) as Quantity[]).map((q) => {
      const b = h('button', {
        type: 'button',
        class: 'toggle',
        text: QUANTITIES[q].label,
        'aria-pressed': 'false',
        onclick: () => (charts.has(q) ? close(q) : open(q)),
      });
      buttons.set(q, b);
      return b;
    }),
  );

  return {
    element: panel(
      'Plots',
      h('p', { class: 'muted', text: 'Vector plots show the x, y, z components and the overall quantity; the energy plot shows kinetic, potential and total energy. Drag on a plot to zoom; double-click to reset; ⧉ opens it in its own window.' }),
      toggles,
    ),
    update,
  };
}
