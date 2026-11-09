import type { DestructibleSpec, PartAperture, PartSpec } from '@adatechnology/game-contracts'

import type { Opening } from './types'

/** The plane axes of a part thin along `thin` (as the destruction world reads an aperture): x and y across z, z and y across x, x and z across y. */
const planeAxes = (thin: number): [number, number] => (thin === 1 ? [0, 2] : [thin === 0 ? 2 : 0, 1])

/** A point of the object's frame in the part's own frame (the walls of a plan turn about y only). */
function toPartFrame(part: PartSpec, point: readonly [number, number, number]): [number, number, number] {
  const dx = point[0] - part.position[0]
  const dz = point[2] - part.position[2]
  const angle = -(part.rotation?.[1] ?? 0)
  return [dx * Math.cos(angle) + dz * Math.sin(angle), point[1] - part.position[1], -dx * Math.sin(angle) + dz * Math.cos(angle)]
}

/** The window gaps of one wall part as its `apertures`, or none when the part is not a box thin across its length. */
function wallApertures(part: PartSpec, windows: readonly Opening[]): PartAperture[] {
  if (part.shape.kind !== 'box') return []
  const size = part.shape.size
  const thin = size.indexOf(Math.min(...size))
  if (thin === 1) return []
  // across a wall (thin along x or z) the first plane axis is the length of the wall and the second the height
  const [along] = planeAxes(thin)
  const turn = part.rotation?.[1] ?? 0
  const alongU = Math.abs(Math.cos(turn)) * size[0] + Math.abs(Math.sin(turn)) * size[2] >= Math.abs(Math.sin(turn)) * size[0] + Math.abs(Math.cos(turn)) * size[2]
  return windows.map((opening) => {
    const middle = (opening.from + opening.to) / 2
    const centre: [number, number, number] = alongU ? [middle, (opening.y0 + opening.y1) / 2, part.position[2]] : [part.position[0], (opening.y0 + opening.y1) / 2, middle]
    const local = toPartFrame(part, centre)
    return { size: [opening.to - opening.from, opening.y1 - opening.y0], offset: [local[along], local[1]] }
  })
}

/**
 * Puts the window gaps of the plan in the walls of a spec made with one part per wall (`wallDetail: 'coarse'`, as the houses are drawn): a shot through a
 * window meets the frame, the glass and what is behind, never the brick of a wall drawn with a hole there. Finer details cut the wall around the gap already.
 */
export function withWindowApertures(spec: DestructibleSpec, openings: readonly Opening[]): DestructibleSpec {
  const byWall = new Map<string, Opening[]>()
  for (const opening of openings) if (opening.kind === 'window') byWall.set(opening.wall, [...(byWall.get(opening.wall) ?? []), opening])
  if (!byWall.size) return spec
  return {
    ...spec,
    parts: spec.parts.map((part) => {
      const windows = byWall.get(part.id)
      if (!windows) return part
      const apertures = wallApertures(part, windows)
      return apertures.length ? { ...part, apertures: [...(part.apertures ?? []), ...apertures] } : part
    }),
  }
}
