# Physics Sandbox

Interactive, educational 3D physics sandbox.

**Live demo:** https://hardikmedhi.github.io/physics-sandbox/ (nothing to install; works in a desktop or phone browser).
 It's a web app first; desktop and Android wrappers come later.

**Milestone 1:** a ball on a table. Apply timed forces and plot distance, displacement, velocity
and acceleration (x, y, z and overall). Scrub a time bar, set the step size (minimum 1 ms), and
use full camera controls.

**Milestone 1.1:** an axis gizmo in the corner of the view, adjustable table size and height (or no
table at all), a force arrow you can drag to set the force, and plots that pop out into their own
windows (`plot.html`).

## Setup
Requires Node.js ≥ 20.19 (22 or 24 LTS recommended).

```sh
npm install three uplot
npm install -D typescript vite vitest @types/three
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
make -C docs     # docs/build/{physics,math,code}.pdf
```

## Layout
- `src/core/`: pure physics (no DOM, no three.js). To be ported to Rust/WASM later.
- `src/sim/`: simulation controller: timeline, commands, events.
- `src/render/`: three.js viewport and camera rig.
- `src/ui/`: DOM panels, plots, time bar.
- `docs/`: living documents (physics, math, code) in LaTeX.

## Deployment
Every push to `main` runs the tests, builds the app and publishes it to GitHub Pages
(`.github/workflows/deploy.yml`).
