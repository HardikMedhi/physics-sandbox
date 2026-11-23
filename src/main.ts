import './ui/styles.css';
import './sandboxHost';
import { DEFAULT_SCENE, type SceneSettings, type Vec3, buildWorldParams, tableSpec, vec3 } from './core';
import type { TransformOptions } from './render/selection';
import { Viewport } from './render/viewport';
import { SimulationController } from './sim/controller';
import { type ObjectId, SceneEditor } from './sim/sceneEditor';
import { createDocsPanel } from './ui/docsPanel';
import { createForcePanel } from './ui/forcePanel';
import { createHud } from './ui/hud';
import { createInspector } from './ui/inspector';
import { createOutliner } from './ui/outliner';
import { createPlotPanel } from './ui/plotPanel';
import { createTimeline } from './ui/timeline';
import { createViewControls } from './ui/viewControls';

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
};

// ---- model -------------------------------------------------------------------
const params = buildWorldParams(DEFAULT_SCENE);
const sim = new SimulationController(params, 0.01, 20);
const editor = new SceneEditor(sim, DEFAULT_SCENE);
window.physicsSandbox = { sim }; // read by pop-out plot windows

// ---- view --------------------------------------------------------------------
const viewportEl = $('viewport');
const viewport = new Viewport(viewportEl, {
  table: tableSpec(DEFAULT_SCENE.table),
  ballRadius: DEFAULT_SCENE.ball.radius,
  ballStart: params.initialPosition,
});
createViewControls(viewportEl, viewport);
const updateHud = createHud(viewportEl, sim);

// ---- selection & direct manipulation in the 3D view ---------------------------
const TRANSFORM: Partial<Record<ObjectId, TransformOptions>> = {
  ball: { modes: ['translate', 'scale'], translateY: true, uniformScale: true },
  table: { modes: ['translate', 'scale'], translateY: false, uniformScale: false },
};
const sel = viewport.selection;
sel.onPick = (id) => editor.select(id as ObjectId | null);
sel.onTransformStart = () => editor.beginDirectEdit();
sel.onTransformChange = (id, obj, mode) => {
  if (mode !== 'translate') return; // scaling previews in 3D and is committed on release
  if (id === 'ball') editor.updateBall({ position: vec3(obj.position.x, obj.position.y, obj.position.z) });
  if (id === 'table') {
    obj.position.y = 0;
    editor.updateTable({ x: obj.position.x, z: obj.position.z });
  }
};
sel.onTransformEnd = (id, obj, mode) => {
  if (mode !== 'scale') return;
  if (id === 'ball') editor.updateBall({ radius: obj.scale.x }); // unit sphere: scale = radius
  if (id === 'table') {
    const t = editor.scene.table;
    editor.updateTable({ length: t.length * obj.scale.x, width: t.width * obj.scale.z, height: t.height * obj.scale.y });
  }
};

const applyScene = (s: SceneSettings) => {
  viewport.setTable(tableSpec(s.table));
  viewport.setBallRadius(s.ball.radius);
};
editor.events.on('scene', applyScene);
editor.events.on('selection', (id) => viewport.select(id, id ? (TRANSFORM[id] ?? null) : null));

// ---- panels --------------------------------------------------------------------
let preview: Vec3 | null = null;
let showForces = true;
const forcePanel = createForcePanel(sim, (f) => (preview = f));
viewport.onPreviewDrag = (f) => forcePanel.setVector(f);
const plots = createPlotPanel(sim, $('plots'));
const inspector = createInspector(editor, { get: () => sel.mode, set: (m) => sel.setMode(m) });
$('sidebar').append(
  createOutliner(editor, (show) => (showForces = show)),
  inspector.element,
  forcePanel.element,
  plots.element,
  createDocsPanel(),
);
createTimeline($('timeline'), sim);

// ---- editing shortcuts ------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyG') sel.setMode('translate');
  else if (e.code === 'KeyT') sel.setMode('scale');
  else if (e.code === 'Delete' || e.code === 'Backspace') editor.deleteSelected();
  else if (e.code === 'Escape') editor.select(null);
  else return;
  inspector.syncMode();
  e.preventDefault();
});

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
