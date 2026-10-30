import type * as THREE_NS from 'three'
import { TERRAIN_PATTERNS } from '@adatechnology/game-terrain'

type ThreeLib = typeof THREE_NS

/** Index of a pattern in the shader's branches. */
export const patternIndex = (pattern: string | undefined): number => Math.max(0, TERRAIN_PATTERNS.indexOf((pattern ?? 'plain') as (typeof TERRAIN_PATTERNS)[number]))

const SURFACE_GLSL = /* glsl */ `
float tsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tsNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tsHash(i), tsHash(i + vec2(1.0, 0.0)), f.x), mix(tsHash(i + vec2(0.0, 1.0)), tsHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tsFbm(vec2 p) { return tsNoise(p) * 0.55 + tsNoise(p * 2.3 + 7.1) * 0.3 + tsNoise(p * 5.1 + 3.3) * 0.15; }
float tsLine(float value, float period, float width) { float d = abs(fract(value / period + 0.5) - 0.5) * period; return 1.0 - smoothstep(width * 0.6, width, d); }
vec3 terrainSurface(vec3 base, vec2 xz, float kind) {
  float k = floor(kind + 0.5);
  if (k < 0.5) return base * (0.86 + 0.28 * tsFbm(xz * 9.0));
  if (k < 1.5) {
    float blades = tsNoise(xz * vec2(70.0, 55.0)) * 0.6 + tsNoise(xz * 22.0) * 0.4;
    float patches = tsFbm(xz * 1.3);
    return base * (0.55 + 0.8 * blades) * mix(vec3(1.25, 1.05, 0.7), vec3(0.8, 1.1, 0.85), patches);
  }
  if (k < 2.5) return base * (0.6 + 0.75 * tsFbm(xz * 6.0)) * (0.82 + 0.36 * tsNoise(xz * 48.0));
  if (k < 3.5) return base * (0.88 + 0.12 * sin(xz.x * 22.0 + tsFbm(xz * 2.0) * 9.0)) * (0.92 + 0.16 * tsNoise(xz * 90.0));
  if (k < 4.5) { float grain = tsNoise(xz * 120.0); return base * (0.55 + 1.1 * grain * grain) * (0.85 + 0.3 * tsFbm(xz * 0.8)); }
  if (k < 5.5) {
    float joint = max(tsLine(xz.x, 3.0, 0.012), tsLine(xz.y, 3.0, 0.012));
    return base * (0.82 + 0.3 * tsFbm(xz * 3.5)) * (0.94 + 0.12 * tsNoise(xz * 130.0)) * (1.0 - 0.6 * joint);
  }
  if (k < 6.5) {
    vec2 cell = floor(xz / 0.6);
    float grout = max(tsLine(xz.x, 0.6, 0.006), tsLine(xz.y, 0.6, 0.006));
    return mix(base * (0.93 + 0.14 * tsHash(cell)) * (0.97 + 0.06 * tsFbm(xz * 7.0)), vec3(0.14, 0.13, 0.12), grout);
  }
  if (k < 7.5) {
    float row = floor(xz.y / 0.14);
    float along = xz.x + tsHash(vec2(row, 3.0)) * 2.4;
    float seam = max(tsLine(xz.y, 0.14, 0.004), tsLine(along, 2.4, 0.004));
    float grain = tsNoise(vec2(along * 3.0, xz.y * 70.0)) * 0.6 + tsNoise(vec2(along * 11.0, xz.y * 180.0)) * 0.4;
    return base * (0.72 + 0.56 * tsHash(vec2(row, floor(along / 2.4)))) * (0.75 + 0.5 * grain) * (1.0 - 0.75 * seam);
  }
  vec2 cell = floor(xz / 0.22);
  float seams = max(tsLine(xz.x, 0.22, 0.012), tsLine(xz.y, 0.22, 0.012));
  return base * (0.7 + 0.6 * tsHash(cell)) * (0.85 + 0.3 * tsFbm(xz * 16.0)) * (1.0 - 0.55 * seams);
}
`

/** The ground's material: the colour of what is exposed comes per vertex, flat so that the edge between two materials stays sharp, its pattern (blades of grass, grout, planks) is drawn per pixel from the world position so that it never tiles or stretches. */
export function createSurfaceMaterial(THREE: ThreeLib): THREE_NS.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPattern;\nattribute vec3 aBase;\nattribute vec2 aShade;\nflat varying float vPattern;\nflat varying vec3 vBase;\nvarying vec2 vShade;\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPattern = aPattern;\nvBase = aBase;\nvShade = aShade;\nvGroundXZ = position.xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nflat varying float vPattern;\nflat varying vec3 vBase;\nvarying vec2 vShade;\nvarying vec2 vGroundXZ;\n${SURFACE_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(terrainSurface(vBase, vGroundXZ, vPattern), vec3(0.012, 0.011, 0.01), vShade.y) * vShade.x;')
  }
  material.customProgramCacheKey = () => 'game-terrain-surface'
  return material
}
