import { extent } from './geometry'
import type { CarClearance, FurnitureDef, Rect, Slot, Vec2 } from './types'

const STEP = 0.05
const MAX_CANDIDATES = 80

/**
 * Where a car may stand in a parking slot: `rect` is the car, `clear` the car plus the space it must keep from walls
 * (the driver side, on the left of whoever looks along the front, keeps more than the passenger side). Candidates are sorted by
 * their distance to the slot centre; the car always stays whole inside the zone.
 */
export function carCandidates(slot: Slot, item: FurnitureDef, car: CarClearance): { rect: Rect; clear: Rect }[] {
  const front: Vec2 = [slot.frontU, slot.frontV]
  const zone: Rect = slot._cell.R
  const alongV = Math.abs(front[1]) === 1
  const [extentU, extentV] = extent([item.w, item.d], front)
  const across = alongV ? extentU : extentV
  const along = alongV ? extentV : extentU
  const a = alongV ? 0 : 1
  const b = alongV ? 1 : 0
  const driverSign = alongV ? front[1] : -front[0]
  const frontSign = alongV ? front[1] : front[0]
  const lowClear = driverSign < 0 ? car.driver : car.side
  const highClear = driverSign < 0 ? car.side : car.driver
  const lo = zone[a] + lowClear
  const hi = zone[a + 2] - highClear - across
  const alongLo = zone[b] + car.end
  const alongHi = zone[b + 2] - car.end - along
  if (hi < lo - 1e-6 || alongHi < alongLo - 1e-6) return []
  const preferred = (alongV ? slot.x : slot.z) - across / 2
  const alongStart = frontSign < 0 ? alongHi : alongLo
  const positions: number[] = []
  for (let p = lo; p <= hi + 1e-6; p += STEP) positions.push(Math.min(p, hi))
  positions.sort((x, y) => Math.abs(x - preferred) - Math.abs(y - preferred))
  return positions.slice(0, MAX_CANDIDATES).map((p) => {
    const rect: Rect = alongV ? [p, alongStart, p + across, alongStart + along] : [alongStart, p, alongStart + along, p + across]
    const clear: Rect = alongV ? [p - lowClear, alongStart - car.end, p + across + highClear, alongStart + along + car.end] : [alongStart - car.end, p - lowClear, alongStart + along + car.end, p + across + highClear]
    return { rect, clear }
  })
}
