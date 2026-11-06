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
// a pixel wider than FAR_PIXEL_TO metres shows only the average of the pattern, PATTERN_MEAN of the base colour
const float FAR_PIXEL_FROM = 0.03;
const float FAR_PIXEL_TO = 0.12;
const float PATTERN_MEAN = 0.92;
// metres one pixel covers on the ground here: a line or a grain finer than that cannot be drawn, only its average can
float tsPixel = 0.0;
float tsLine(float value, float period, float width) {
  float drawn = max(width, tsPixel);
  float d = abs(fract(value / period + 0.5) - 0.5) * period;
  return (1.0 - smoothstep(drawn * 0.6, drawn, d)) * (width / drawn);
}
vec3 terrainPattern(vec3 base, vec2 xz, float kind) {
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
  if (k < 8.5) {
    vec2 cell = floor(xz / 0.22);
    float seams = max(tsLine(xz.x, 0.22, 0.012), tsLine(xz.y, 0.22, 0.012));
    return base * (0.7 + 0.6 * tsHash(cell)) * (0.85 + 0.3 * tsFbm(xz * 16.0)) * (1.0 - 0.55 * seams);
  }
  if (k < 9.5) {
    float wet = smoothstep(0.42, 0.62, tsFbm(xz * 2.6));
    return base * (0.65 + 0.7 * tsFbm(xz * 11.0)) * mix(1.25, 0.55, wet);
  }
  if (k < 10.5) {
    vec2 grid = xz / 0.045;
    vec2 cell = floor(grid);
    vec2 inside = fract(grid) - 0.5 + (vec2(tsHash(cell), tsHash(cell + 9.0)) - 0.5) * 0.5;
    float stone = 1.0 - smoothstep(0.22, 0.5, length(inside));
    return base * (0.45 + 1.15 * tsHash(cell + 4.0)) * (0.35 + 0.85 * stone);
  }
  if (k < 11.5) {
    vec2 p = xz / 0.45 + (vec2(tsNoise(xz * 3.0), tsNoise(xz * 3.0 + 5.0)) - 0.5) * 0.7;
    vec2 cell = floor(p);
    float nearest = 8.0;
    float second = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 other = cell + vec2(float(i), float(j));
        vec2 at = other + vec2(tsHash(other), tsHash(other + 3.0));
        float d = length(at - p);
        if (d < nearest) { second = nearest; nearest = d; } else if (d < second) second = d;
      }
    }
    float crack = 1.0 - smoothstep(0.0, 0.06, second - nearest);
    return base * (0.82 + 0.3 * tsFbm(xz * 9.0)) * (1.0 - 0.78 * crack);
  }
  if (k < 12.5) return min(base * (0.97 + 0.08 * tsFbm(xz * 1.8)) + 0.05 * tsNoise(xz * 140.0), vec3(1.0));
  if (k < 13.5) {
    float row = floor(xz.y / 0.2);
    float along = xz.x - mod(abs(row), 2.0) * 0.1;
    vec2 cell = vec2(floor(along / 0.3), row);
    float seam = max(tsLine(xz.y, 0.2, 0.014), tsLine(along, 0.3, 0.014));
    return base * (0.72 + 0.6 * tsHash(cell)) * (0.82 + 0.36 * tsFbm(xz * 22.0)) * (1.0 - 0.8 * seam);
  }
  if (k < 14.5) {
    float row = floor(xz.y / 0.2);
    float along = xz.x - mod(abs(row), 2.0) * 0.1;
    vec2 cell = vec2(floor(along / 0.2), row);
    float seam = max(tsLine(xz.y, 0.2, 0.008), tsLine(along, 0.2, 0.008));
    return base * (0.86 + 0.26 * tsHash(cell)) * (0.92 + 0.16 * tsNoise(xz * 70.0)) * (1.0 - 0.7 * seam);
  }
  // bare rock: weathered blotches, lichen-dark patches and a few long joints, no grid
  float blotch = tsFbm(xz * 0.9) * 0.6 + tsFbm(xz * 4.0 + 2.0) * 0.4;
  float joint = 1.0 - smoothstep(0.0, 0.035, abs(tsNoise(xz * vec2(0.7, 1.9)) - 0.5));
  float grain = tsNoise(xz * 95.0);
  return base * (0.62 + 0.75 * blotch) * (0.88 + 0.24 * grain) * (1.0 - 0.6 * joint);
}
/** The pattern where a pixel can hold it; far off, where a pixel covers more ground than the finest grain, its average, so that the grain does not sparkle as dots. */
vec3 terrainSurface(vec3 base, vec2 xz, float kind) {
  tsPixel = max(length(dFdx(xz)), length(dFdy(xz)));
  vec3 near = terrainPattern(base, xz, kind);
  return mix(near, base * PATTERN_MEAN, smoothstep(FAR_PIXEL_FROM, FAR_PIXEL_TO, tsPixel));
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
