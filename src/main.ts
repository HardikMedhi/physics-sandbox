import './ui/styles.css';
import './sandboxHost';
import { BALL_RADIUS, DEFAULT_SETTINGS, type PhysicsSettings, type Vec3, buildWorldParams, tableSpec } from './core';
import { Viewport } from './render/viewport';
import { SimulationController } from './sim/controller';
import { createForcePanel } from './ui/forcePanel';
import { createHud } from './ui/hud';
import { createPlotPanel } from './ui/plotPanel';
import { createSettingsPanel } from './ui/settingsPanel';
import { createTimeline } from './ui/timeline';
import { createViewControls } from './ui/viewControls';

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
};

// ---- model -------------------------------------------------------------------
const params = buildWorldParams(DEFAULT_SETTINGS);
const sim = new SimulationController(params, 0.01, 20);
window.physicsSandbox = { sim }; // read by pop-out plot windows

// ---- view --------------------------------------------------------------------
const viewportEl = $('viewport');
const viewport = new Viewport(viewportEl, {
  table: tableSpec(DEFAULT_SETTINGS),
  ballRadius: BALL_RADIUS,
  ballStart: params.initialPosition,
});
createViewControls(viewportEl, viewport);
const updateHud = createHud(viewportEl, sim);

// ---- controls ----------------------------------------------------------------
let preview: Vec3 | null = null;
let showForces = true;
const forcePanel = createForcePanel(sim, (f) => (preview = f));
viewport.onPreviewDrag = (f) => forcePanel.setVector(f);
const plots = createPlotPanel(sim, $('plots'));
const applySettings = (s: PhysicsSettings) => {
  sim.setParams(buildWorldParams(s));
  viewport.setTable(tableSpec(s));
};
$('sidebar').append(
  forcePanel.element,
  plots.element,
  createSettingsPanel(DEFAULT_SETTINGS, { onChange: applySettings, onShowForces: (show) => (showForces = show) }),
);
createTimeline($('timeline'), sim);

// ---- frame loop --------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); // clamp after tab switches
  last = now;
  sim.tick(dt);
  viewport.setBallPosition(sim.currentSample().pos);
  viewport.setForces(showForces ? sim.currentForces() : null);
  viewport.setPreview(preview);
  plots.update();
  updateHud();
  viewport.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
