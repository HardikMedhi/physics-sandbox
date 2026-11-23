import { describe, expect, it } from 'vitest';
import { MIN_DT, SimulationController } from '../../src/sim/controller';
import { makeParams } from './helpers';

const spec = { magnitude: 2, azimuthDeg: 0, elevationDeg: 0, duration: 1 };

describe('SimulationController', () => {
  it('seeks forward by computing, and back by indexing', () => {
    const sim = new SimulationController(makeParams(), 0.01, 10);
    sim.applyForce(spec);
    sim.seek(2);
    const x2 = sim.currentSample().pos.x;
    sim.seek(1);
    expect(sim.history.length).toBe(201);
    sim.seek(2);
    expect(sim.currentSample().pos.x).toBe(x2);
  });

  it('applying a force after rewinding discards the old future', () => {
    const sim = new SimulationController(makeParams(), 0.01, 10);
    sim.seek(3);
    sim.seek(1);
    sim.applyForce(spec);
    expect(sim.history.length).toBe(101);
    expect(sim.schedule[0].start).toBeCloseTo(1, 12);
  });

  it('clamps dt to the minimum and keeps the playhead time', () => {
    const sim = new SimulationController(makeParams(), 0.01, 10);
    sim.seek(0.5);
    sim.setDt(0.00001);
    expect(sim.dt).toBe(MIN_DT);
    expect(sim.time).toBeCloseTo(0.5, 12);
  });

  it('reset clears forces and returns to t = 0', () => {
    const sim = new SimulationController(makeParams(), 0.01, 10);
    sim.applyForce(spec);
    sim.seek(2);
    sim.reset();
    expect(sim.schedule.length).toBe(0);
    expect(sim.time).toBe(0);
    expect(sim.history.length).toBe(1);
  });

  it('tick advances the playhead while playing and pauses at the end', () => {
    const sim = new SimulationController(makeParams(), 0.01, 1);
    sim.play();
    sim.tick(0.5);
    expect(sim.time).toBeCloseTo(0.5, 9);
    sim.tick(1);
    expect(sim.time).toBeCloseTo(1, 9);
    expect(sim.playing).toBe(false);
  });
});
