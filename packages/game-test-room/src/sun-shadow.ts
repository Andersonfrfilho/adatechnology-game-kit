import type { Vec3 } from '@adatechnology/game-destruction'

/** Where the sun's shadow frustum sits for a focus: the point it looks at and the light's own position. */
export interface SunShadowFrame {
  readonly target: Vec3
  readonly position: Vec3
}

const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The sun's frustum follows the focus (the camera) so the shadows near the player are always inside it, and its centre moves only in whole texels of the
 * shadow map along the light's own axes: a shadow edge never swims as the player walks. `half` is the frustum's half width, `mapSize` the map's side in texels.
 */
export function snapSunShadow(options: { readonly focus: Vec3; readonly offset: Vec3; readonly half: number; readonly mapSize: number }): SunShadowFrame {
  const { focus, offset, half, mapSize } = options
  const toLight = normalize(offset)
  const right = normalize(cross([0, 1, 0], toLight))
  const up = cross(toLight, right)
  const texel = (2 * half) / mapSize
  const snapR = Math.round(dot(focus, right) / texel) * texel - dot(focus, right)
  const snapU = Math.round(dot(focus, up) / texel) * texel - dot(focus, up)
  const target: Vec3 = [focus[0] + right[0] * snapR + up[0] * snapU, focus[1] + right[1] * snapR + up[1] * snapU, focus[2] + right[2] * snapR + up[2] * snapU]
  return { target, position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]] }
}
