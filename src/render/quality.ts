export type Quality = 'low' | 'high';

/** Rough device capability guess used to scale rendering cost on low-end hardware. */
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const params = new URLSearchParams(location.search);
  const forced = params.get('quality');
  if (forced === 'low' || forced === 'high') return forced;
  return cores <= 4 || memory <= 2 ? 'low' : 'high';
}
