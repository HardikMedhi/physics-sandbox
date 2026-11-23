/** Colours shared by the 3D view and the plots so x/y/z always look the same. */
export const AXIS_COLORS = {
  x: '#e5484d',
  y: '#30a46c',
  z: '#3e63dd',
} as const;

export const FORCE_COLORS = {
  applied: '#f5a524',
  preview: '#f5a524',
  gravity: '#8e4ec6',
  normal: '#12a594',
  friction: '#e5484d',
} as const;

/** Read a CSS custom property from :root (falls back if unavailable). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
