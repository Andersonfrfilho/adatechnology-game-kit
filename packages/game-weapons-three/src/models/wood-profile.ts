import type * as THREE_NS from 'three'
import type { ModelKit, Parent } from './kit'

/** One point of a side profile: the x along the weapon and the y of the top and of the bottom edge there. */
export type ProfilePoint = readonly [x: number, top: number, bottom: number]

const SLICE_LENGTH = 0.02

const at = (points: readonly ProfilePoint[], x: number): readonly [number, number] => {
  const last = points[points.length - 1] as ProfilePoint
  if (x >= last[0]) return [last[1], last[2]]
  const nextIndex = points.findIndex((point) => point[0] >= x)
  const next = points[Math.max(nextIndex, 1)] as ProfilePoint
  const previous = points[Math.max(nextIndex, 1) - 1] as ProfilePoint
  const fraction = (x - previous[0]) / (next[0] - previous[0])
  return [previous[1] + (next[1] - previous[1]) * fraction, previous[2] + (next[2] - previous[2]) * fraction]
}

/** A wooden piece cut from its side profile: short slanted slices as wide as the weapon, so that the piece tapers and bends like the photo's stock does. */
export function profileBlock(kit: ModelKit, parent: Parent, points: readonly ProfilePoint[], width: number, material: THREE_NS.Material): void {
  const first = points[0] as ProfilePoint
  const last = points[points.length - 1] as ProfilePoint
  const count = Math.max(1, Math.ceil((last[0] - first[0]) / SLICE_LENGTH))
  const step = (last[0] - first[0]) / count
  for (let index = 0; index < count; index++) {
    const [rearTop, rearBottom] = at(points, first[0] + step * index)
    const [frontTop, frontBottom] = at(points, first[0] + step * (index + 1))
    const rise = (frontTop + frontBottom - rearTop - rearBottom) / 2
    const height = (frontTop - frontBottom + rearTop - rearBottom) / 2
    const centre = (rearTop + rearBottom + frontTop + frontBottom) / 4
    kit.box(parent, Math.hypot(step, rise) * 1.12, height, width, material, first[0] + step * (index + 0.5), centre, 0, Math.atan2(rise, step))
  }
}
