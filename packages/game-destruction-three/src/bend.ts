/** Metres: how far either side of the hinge the fold is rounded, so a bent plate shows a curve and not a crease. */
export const BEND_SMOOTH_RADIUS = 0.012

type Triple = readonly [number, number, number]

/**
 * Bend the vertices `from..to` (indices into `positions`, three numbers each) of a plate by `angle` radians about the line through `point` along `axis`:
 * what lies beyond the hinge in the direction `side` turns about it, and the stretch of `radius` either side of the line turns by a share of the angle
 * (smoothstep), so the fold is rounded. All three are unit-free vectors in the positions' own space and `radius` is in that space.
 */
export function bendPositions(positions: Float32Array, from: number, to: number, point: Triple, axis: Triple, side: Triple, angle: number, radius: number): void {
  const length = Math.hypot(axis[0], axis[1], axis[2])
  if (length === 0 || angle === 0) return
  const [kx, ky, kz] = [axis[0] / length, axis[1] / length, axis[2] / length]
  for (let i = from; i < to; i += 3) {
    const rx = positions[i]! - point[0]
    const ry = positions[i + 1]! - point[1]
    const rz = positions[i + 2]! - point[2]
    const along = rx * side[0] + ry * side[1] + rz * side[2]
    const share = radius > 0 ? Math.min(1, Math.max(0, (along + radius) / (2 * radius))) : along > 0 ? 1 : 0
    if (share === 0) continue
    const turn = angle * share * share * (3 - 2 * share)
    const cos = Math.cos(turn)
    const sin = Math.sin(turn)
    const dot = kx * rx + ky * ry + kz * rz
    // Rodrigues' rotation of the offset from the hinge point about the unit axis
    positions[i] = point[0] + rx * cos + (ky * rz - kz * ry) * sin + kx * dot * (1 - cos)
    positions[i + 1] = point[1] + ry * cos + (kz * rx - kx * rz) * sin + ky * dot * (1 - cos)
    positions[i + 2] = point[2] + rz * cos + (kx * ry - ky * rx) * sin + kz * dot * (1 - cos)
  }
}
