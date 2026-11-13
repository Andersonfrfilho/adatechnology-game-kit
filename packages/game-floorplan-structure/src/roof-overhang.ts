import type { Rect } from './types'

/** Most metres a rafter or a truss runs past the last thing that holds it (an eave overhang; past it, a timber cantilever that sags and breaks). */
export const MAX_ROOF_OVERHANG = 1

/** Metres `member` runs past the stretch the boxes `holds` hold it over, at its low and its high end along its length (its whole length where nothing holds it). */
export function overhangs(member: Rect, holds: readonly Rect[]): [number, number] {
  const alongU = member[2] - member[0] >= member[3] - member[1]
  const [from, to] = alongU ? [member[0], member[2]] : [member[1], member[3]]
  const ranges = holds.map((box): [number, number] => (alongU ? [Math.max(from, box[0]), Math.min(to, box[2])] : [Math.max(from, box[1]), Math.min(to, box[3])])).filter(([a, b]) => b >= a)
  if (!ranges.length) return [to - from, to - from]
  return [Math.min(...ranges.map(([a]) => a)) - from, to - Math.max(...ranges.map(([, b]) => b))]
}

/**
 * Metres a rafter or truss runs past what holds it at its eaves: both ends of a truss; the eave end of a rafter (`rafter…_a_k` at its low end, `…_b_k` at its
 * high end), whose ridge end leans on the rafter across.
 */
export function eaveOverhang(member: { id: string; aabb: Rect }, holds: readonly Rect[]): number {
  const [low, high] = overhangs(member.aabb, holds)
  const side = /_([ab])_\d+$/.exec(member.id)?.[1]
  if (!member.id.startsWith('rafter') || side === undefined) return Math.max(low, high)
  return side === 'a' ? low : high
}
