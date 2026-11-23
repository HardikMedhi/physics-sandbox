import * as THREE from 'three';
import { AXIS_COLORS } from '../theme';

/**
 * Floor size and tessellation. The plane is recentred under the camera every
 * frame (in whole cells, which changes nothing visible because the grid is
 * computed from world coordinates), so it only needs to reach past the fog.
 *
 * It is deliberately split into many small triangles: interpolating
 * per-pixel world positions and shadow coordinates across a few huge
 * (kilometre-sized) triangles loses float precision, which showed up as the
 * floor grid and shadows shimmering while the camera moved.
 */
export const FLOOR_SIZE = 2000;
export const FLOOR_CELL = 20;

/** sRGB hex colour → linear-space GLSL vec3 (lit materials work in linear space). */
const hex = (c: string) => {
  const v = new THREE.Color(c);
  return `vec3(${v.r.toFixed(4)}, ${v.g.toFixed(4)}, ${v.b.toFixed(4)})`;
};

// Grid computed per pixel inside the floor's own (lit, shadowed, fogged) material.
// Lines are anti-aliased with screen-space derivatives (fwidth) and fade with
// distance from the camera so they melt into the horizon instead of aliasing.
// The fade distance grows with camera height so the grid stays visible when zoomed out.
const GRID_GLSL = /* glsl */ `
  float gridLineMask(vec2 p, float spacing, float width) {
    vec2 c = p / spacing;
    vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
    return 1.0 - clamp(min(g.x, g.y) - 0.5 * width + 0.5, 0.0, 1.0);
  }
  vec4 gridColor(vec3 world) {
    vec2 p = world.xz;
    float minor = gridLineMask(p, 1.0, 1.2);
    float major = gridLineMask(p, 10.0, 1.8);
    float onX = 1.0 - clamp(abs(p.y) / fwidth(p.y) - 0.75, 0.0, 1.0); // x-axis: z = 0
    float onZ = 1.0 - clamp(abs(p.x) / fwidth(p.x) - 0.75, 0.0, 1.0); // z-axis: x = 0
    float fadeFar = max(40.0, 12.0 * abs(cameraPosition.y));
    float fade = 1.0 - smoothstep(0.25 * fadeFar, fadeFar, distance(cameraPosition, world));
    vec3 color = ${hex('#4a535c')};
    float alpha = minor * 0.55;
    if (major * 0.75 > alpha) { color = ${hex('#262c33')}; alpha = major * 0.75; }
    if (onZ > 0.0) { color = mix(color, ${hex(AXIS_COLORS.z)}, onZ); alpha = max(alpha, onZ * 0.9); }
    if (onX > 0.0) { color = mix(color, ${hex(AXIS_COLORS.x)}, onX); alpha = max(alpha, onX * 0.9); }
    return vec4(color, alpha * fade);
  }
`;

/** A very large floor whose material draws an infinite-looking grid. */
export function createInfiniteFloor(): THREE.Mesh {
  const size = FLOOR_SIZE;
  const segments = FLOOR_SIZE / FLOOR_CELL;
  const material = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.95 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGridWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGridWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vGridWorld;\n${GRID_GLSL}`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nvec4 gridC = gridColor(vGridWorld);\ndiffuseColor.rgb = mix(diffuseColor.rgb, gridC.rgb, gridC.a);',
      );
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size, segments, segments), material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.selectId = 'floor';
  return floor;
}

/** Keep the floor centred under the camera, snapped to whole cells. */
export function followCamera(floor: THREE.Object3D, camera: THREE.Camera): void {
  floor.position.x = Math.round(camera.position.x / FLOOR_CELL) * FLOOR_CELL;
  floor.position.z = Math.round(camera.position.z / FLOOR_CELL) * FLOOR_CELL;
}
