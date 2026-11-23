import type { SimulationController } from './sim/controller';

/** What the main window exposes to pop-out windows (same origin). */
export interface SandboxHost {
  readonly sim: SimulationController;
}

declare global {
  interface Window {
    physicsSandbox?: SandboxHost;
  }
}
