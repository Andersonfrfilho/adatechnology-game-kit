import type { ThreeLib, ThreeNS } from './types'

export interface SwayOptions {
  /** Strength of the idle flutter (wind) in meters per meter of hang, 0..1. Default 0.04. */
  amplitude?: number
  /** Local y (geometry space) of the line the cloth hangs from. Default: top of the mesh's bounding box. */
  anchorY?: number
}

export interface SwayUniforms {
  time: { value: number }
  ax: { value: number }
  az: { value: number }
  anchorY: { value: number }
}

/** Shared state of one swaying mesh: the three materials read the same uniforms. */
export interface SwayHandle {
  uniforms: SwayUniforms
  /** Sets the swing (radians around x and z) and, optionally, the clock for the idle flutter. */
  set(ax: number, az: number, time?: number): void
}

const VERTEX_PATCH = /* glsl */ `
#include <begin_vertex>
{
  float swayHang = max(swayAnchorY - position.y, 0.0);
  float swayFlutter = swayAmplitude * sin(swayTime * 1.9 + position.x * 4.0 + position.z * 3.0 + swayHang * 3.0);
  transformed.x += swayHang * (sin(swayAz) + swayFlutter);
  transformed.z += swayHang * (sin(swayAx) + swayFlutter * 0.6);
  transformed.y -= swayHang * (1.0 - cos(swayAz) * cos(swayAx)) * 0.5;
}
`

const VERTEX_UNIFORMS = /* glsl */ `
uniform float swayTime;
uniform float swayAx;
uniform float swayAz;
uniform float swayAnchorY;
uniform float swayAmplitude;
`

/** Patches a vertex shader so the vertices hang from the anchor line and swing with the shared uniforms. */
export function patchSwayShader(shader: { uniforms: Record<string, any>; vertexShader: string }, uniforms: SwayUniforms, amplitude: number): void {
  shader.uniforms.swayTime = uniforms.time
  shader.uniforms.swayAx = uniforms.ax
  shader.uniforms.swayAz = uniforms.az
  shader.uniforms.swayAnchorY = uniforms.anchorY
  shader.uniforms.swayAmplitude = { value: amplitude }
  shader.vertexShader = VERTEX_UNIFORMS + shader.vertexShader.replace('#include <begin_vertex>', VERTEX_PATCH)
}

function patch<M extends ThreeNS.Material>(material: M, uniforms: SwayUniforms, amplitude: number): M {
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer)
    patchSwayShader(shader, uniforms, amplitude)
  }
  material.customProgramCacheKey = () => `sway:${amplitude}`
  return material
}

/**
 * Clones `base` and patches it with a vertex-shader sway (uniforms `time`, `ax`, `az`, `anchorY`). The returned material carries
 * `userData.sway` (a `SwayHandle`), `customDepthMaterial` and `customDistanceMaterial` patched with the same uniforms, so
 * directional / spot shadow maps and point-light shadow cubes follow the animation. Assign it to a mesh, and set
 * `mesh.customDepthMaterial` / `mesh.customDistanceMaterial` from the material (or just use `attachSway`).
 */
export function swayMaterial(THREE: ThreeLib, base: ThreeNS.Material, options: SwayOptions = {}): ThreeNS.Material & {
  userData: { sway: SwayHandle; depthMaterial: ThreeNS.MeshDepthMaterial; distanceMaterial: ThreeNS.MeshDistanceMaterial }
} {
  const amplitude = options.amplitude ?? 0.04
  const uniforms: SwayUniforms = { time: { value: 0 }, ax: { value: 0 }, az: { value: 0 }, anchorY: { value: options.anchorY ?? 0 } }
  const handle: SwayHandle = {
    uniforms,
    set(ax, az, time) {
      uniforms.ax.value = ax
      uniforms.az.value = az
      if (time !== undefined) uniforms.time.value = time
    },
  }
  const material = patch(base.clone(), uniforms, amplitude)
  const depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, amplitude)
  const distance = patch(new THREE.MeshDistanceMaterial(), uniforms, amplitude)
  material.userData.sway = handle
  material.userData.depthMaterial = depth
  material.userData.distanceMaterial = distance
  return material as any
}

/**
 * Makes a mesh sway: replaces its material with `swayMaterial(...)` and sets `customDepthMaterial` and `customDistanceMaterial`.
 * `mesh.userData.sway` is the handle `syncObject` drives. Returns the handle.
 */
export function attachSway(THREE: ThreeLib, mesh: ThreeNS.Mesh, options: SwayOptions = {}): SwayHandle {
  let anchorY = options.anchorY
  if (anchorY === undefined) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    anchorY = mesh.geometry.boundingBox ? mesh.geometry.boundingBox.max.y : 0
  }
  const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const m = swayMaterial(THREE, base, { ...options, anchorY })
  m.userData.sway.uniforms.anchorY.value = anchorY
  mesh.material = m
  mesh.customDepthMaterial = m.userData.depthMaterial
  mesh.customDistanceMaterial = m.userData.distanceMaterial
  mesh.userData.sway = m.userData.sway
  return m.userData.sway
}
