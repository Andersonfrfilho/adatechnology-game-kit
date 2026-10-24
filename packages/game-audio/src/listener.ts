import type { Vec3 } from '@adatechnology/game-contracts'

/** Where the ears are. `yaw` turns around y like a three.js camera: the right ear points at `(cos yaw, 0, −sin yaw)`. */
export type Listener = { readonly position: Vec3; readonly yaw: number }

export type DistanceMode = 'xz' | '3d'

export const DEFAULT_LISTENER: Listener = { position: [0, 0, 0], yaw: 0 }

/** The art scene clamps the pan to ±0.85 and never divides by less than 2 m (cena L1319). */
export const PAN_LIMIT = 0.85
export const PAN_MIN_DISTANCE = 2

/** Distance from the listener: on the ground (`xz`, the teams' choice) or in 3D. */
export function listenerDistance(listener: Listener, position: Vec3, mode: DistanceMode = 'xz'): number {
  const dx = position[0] - listener.position[0]
  const dz = position[2] - listener.position[2]
  if (mode === 'xz') return Math.hypot(dx, dz)
  return Math.hypot(dx, position[1] - listener.position[1], dz)
}

/** The art scene's `panFor`: the side the sound is on, −0.85 (left) to 0.85 (right). No HRTF, for cost. */
export function panFor(listener: Listener, position: Vec3): number {
  const rightX = Math.cos(listener.yaw)
  const rightZ = -Math.sin(listener.yaw)
  const dx = position[0] - listener.position[0]
  const dz = position[2] - listener.position[2]
  const distance = Math.hypot(dx, dz) || 1
  const pan = (dx * rightX + dz * rightZ) / Math.max(distance, PAN_MIN_DISTANCE)
  return pan < -PAN_LIMIT ? -PAN_LIMIT : pan > PAN_LIMIT ? PAN_LIMIT : pan
}
