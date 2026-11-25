import type { Point3, ServiceMast } from './electrical-types'

/** The galvanised pipe of a mast (pontalete): outer radius, metres (a 1¼" pipe). */
export const MAST_PIPE_RADIUS = 0.021
/** The weatherhead: the pipe bends half a circle of this radius toward the street, and its open end, pointing down, carries a cap this wide and long. */
export const WEATHERHEAD = { bend: 0.08, capRadius: 0.032, capLength: 0.06, segments: 8 } as const

const round3 = (value: number): number => Math.round(value * 1000) / 1000

/**
 * The axis of a mast in the plan (`[u, v, y]`): up the facade from `y0` to `y1`, then half a circle over the top toward the street (−v), its open end pointing
 * down. Whoever draws the mast (the house, or the interactables kit) runs the pipe along it and puts the weatherhead's cap on the last point.
 */
export function mastPathOf(mast: ServiceMast): Point3[] {
  const { bend, segments } = WEATHERHEAD
  const arc = Array.from({ length: segments }, (_, index): Point3 => {
    const angle = (Math.PI * (index + 1)) / segments
    return [mast.u, round3(mast.v - bend + bend * Math.cos(angle)), round3(mast.y1 + bend * Math.sin(angle))]
  })
  return [[mast.u, mast.v, mast.y0], [mast.u, mast.v, mast.y1], ...arc]
}
