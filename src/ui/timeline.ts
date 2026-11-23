import type { SimulationController } from '../sim/controller';
import { MAX_DT, MAX_DURATION, MIN_DT, MIN_DURATION } from '../sim/controller';
import { fmt, h, numberField } from './dom';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
}

/**
 * Bottom time bar: reset, step back/forward, play/pause, scrubber, step size
 * (dt, with a minimum) and simulated duration.
 * Keys: Space = play/pause, ←/→ = step.
 */
export function createTimeline(container: HTMLElement, sim: SimulationController): void {
  const playBtn = h('button', { type: 'button', class: 'primary play', title: 'Play / pause (Space)', onclick: () => sim.togglePlay() });
  const backBtn = h('button', { type: 'button', text: '⏮︎', 'aria-label': 'Step back', title: 'Step back one dt (←)', onclick: () => sim.stepBack() });
  const fwdBtn = h('button', { type: 'button', text: '⏭︎', 'aria-label': 'Step forward', title: 'Step forward one dt (→)', onclick: () => sim.stepForward() });
  const resetBtn = h('button', { type: 'button', class: 'danger', text: 'Reset', title: 'Remove all forces and return to t = 0', onclick: () => sim.reset() });

  const readout = h('output', { class: 'time-readout' });
  const slider = h('input', { type: 'range', class: 'scrubber', min: '0', 'aria-label': 'Simulation time' });
  slider.addEventListener('input', () => {
    sim.pause();
    sim.seek(slider.valueAsNumber);
  });

  const speed = h(
    'select',
    { title: 'Playback speed', onchange: () => sim.setRate(Number(speed.value)) },
    ...SPEEDS.map((s) => h('option', { value: String(s), text: `${s}×`, selected: s === 1 })),
  );

  const dt = numberField({
    label: 'Step dt',
    unit: 's',
    value: sim.dt,
    min: MIN_DT,
    max: MAX_DT,
    step: 0.001,
    title: `Integration / timeline step size (min ${MIN_DT} s). Changing it re-simulates from t = 0.`,
    onChange: (v) => sim.setDt(v),
  });
  const duration = numberField({
    label: 'Length',
    unit: 's',
    value: sim.duration,
    min: MIN_DURATION,
    max: MAX_DURATION,
    step: 1,
    title: 'Total simulated time span',
    onChange: (v) => sim.setDuration(v),
  });

  function syncRange(): void {
    slider.max = String(sim.duration);
    slider.step = String(sim.dt);
    const recorded = Math.min(100, (sim.recordedTime / sim.duration) * 100);
    slider.style.setProperty('--recorded', `${recorded}%`);
  }

  function syncTime(): void {
    slider.value = String(sim.time);
    readout.textContent = `t = ${fmt(sim.time, 3)} / ${fmt(sim.duration, 1)} s`;
  }

  function syncPlaying(): void {
    playBtn.textContent = sim.playing ? '⏸︎ Pause' : '▶︎ Play';
    playBtn.setAttribute('aria-pressed', String(sim.playing));
  }

  sim.events.on('time', syncTime);
  sim.events.on('history', syncRange);
  sim.events.on('playing', syncPlaying);
  sim.events.on('config', () => {
    dt.value = sim.dt;
    duration.value = sim.duration;
    syncRange();
    syncTime();
  });

  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') sim.togglePlay();
    else if (e.code === 'ArrowLeft') sim.stepBack();
    else if (e.code === 'ArrowRight') sim.stepForward();
    else return;
    e.preventDefault();
  });

  container.append(
    h(
      'div',
      { class: 'timeline-row' },
      resetBtn,
      backBtn,
      playBtn,
      fwdBtn,
      readout,
      h('span', { class: 'timeline-fields' }, h('label', { class: 'inline' }, h('span', { text: 'Speed' }), speed), dt.row, duration.row),
    ),
    slider,
  );
  syncRange();
  syncTime();
  syncPlaying();
}
