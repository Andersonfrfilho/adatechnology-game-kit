import { outwardOf, groundExteriorWalls, HALF_WALL, round2, sideNameOf } from './shared'
import type { Json, Rng } from './shared'
import type { EnergyConfig } from './electrical'

const PANEL_WIDTH = 1.0
const PANEL_LENGTH = 1.65
const NO_PANELS_UNDER: readonly string[] = ['void', 'elevator', 'stairs', 'balcony', 'terrace', 'porch']

export interface SolarContext {
  plan: Json
  rng: Rng
  energy?: EnergyConfig
}

/** Inverter on a side wall of the ground floor, 1.5 m up. */
function placeInverter(plan: Json): Json | null {
  const wall = groundExteriorWalls(plan).filter((q) => q.sides.includes('outside')).sort((a, b) => (a.axis === 'v' ? 0 : 1) - (b.axis === 'v' ? 0 : 1))[0]
  if (!wall) return null
  const vector = outwardOf(wall)
  const centre = wall.axis === 'u' ? (wall.u0 + wall.u1) / 2 : (wall.v0 + wall.v1) / 2
  const offset = HALF_WALL + 0.08
  return { id: 'inverter', u: round2(wall.axis === 'u' ? centre : wall.u0 + vector[0] * offset), v: round2(wall.axis === 'u' ? wall.v0 + vector[1] * offset : centre), y: 1.5, side: sideNameOf(vector), w: 0.4, d: 0.15, h: 0.5, outdoor: true, link: 'panel' }
}

/**
 * Solar panels: about 6% of budget houses, 25% of mid and 50% of the rest; on the roof slope that faces north or on tilted racks on a flat roof, with the
 * inverter on the wall. A template with its own energy decides (`energy.solar`).
 */
export function planSolar(context: SolarContext): Json | null {
  const { plan, rng, energy } = context
  if (!plan.lot || plan.style === 'commercial' || !plan.facade) return null
  const chance = plan.style === 'budget' ? 0.06 : plan.style === 'mid' ? 0.25 : 0.5
  const forced = energy ? (energy.solar ? 1 : 0) : null
  const draw = rng()
  if (forced !== null ? !forced : draw >= chance) return null
  const floor = plan.floors.length - 1
  const level = plan.floors[floor]
  const flat = plan.facade.roof === 'slab'
  const tops = plan.rooms.filter((c: Json) => c.floor === floor && !NO_PANELS_UNDER.includes(c.type))
  if (!tops.length) return null
  const parts: number[][] = tops.flatMap((c: Json) => c.parts)
  const box = [Math.min(...parts.map((q) => q[0]!)), Math.min(...parts.map((q) => q[1]!)), Math.max(...parts.map((q) => q[2]!)), Math.max(...parts.map((q) => q[3]!))] as [number, number, number, number]
  const north = rng() < 0.5 ? 'front' : 'back'
  const angle = flat ? 15 : 25
  const projection = round2(PANEL_LENGTH * Math.cos((angle * Math.PI) / 180))
  const margin = 0.6
  const uStart = box[0] + margin
  const uEnd = box[2] - margin
  const columns = Math.max(1, Math.floor((uEnd - uStart) / (PANEL_WIDTH + 0.05)))
  const vMiddle = (box[1] + box[3]) / 2
  const vArea = flat ? [box[1] + margin, box[3] - margin] : north === 'front' ? [box[1] + 0.4, vMiddle - 0.2] : [vMiddle + 0.2, box[3] - 0.4]
  const step = flat ? projection + 0.5 : projection + 0.05
  const rowsMax = Math.max(1, Math.floor((vArea[1]! - vArea[0]!) / step))
  const wanted = forced !== null ? 1 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * (plan.style === 'high' ? 12 : 8))
  const rows = Math.max(1, Math.min(rowsMax, Math.ceil(wanted / columns)))
  const count = Math.min(wanted, rows * columns)
  const u0 = uStart + (uEnd - uStart - columns * (PANEL_WIDTH + 0.05)) / 2
  const vStart = north === 'front' ? vArea[0]! : vArea[1]! - rows * step
  const panels: Json[] = []
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / columns)
    const column = k % columns
    panels.push({ id: `pv${k + 1}`, u: round2(u0 + column * (PANEL_WIDTH + 0.05) + PANEL_WIDTH / 2), v: round2(vStart + row * step + (flat ? 0.25 : 0) + projection / 2), w: PANEL_WIDTH, d: projection, length: PANEL_LENGTH })
  }
  const area = [round2(u0), round2(vStart), round2(u0 + columns * (PANEL_WIDTH + 0.05)), round2(vStart + rows * step)]
  return { type: flat ? 'slab_rack' : 'roof', orientation: 'north', north, slopeSide: flat ? null : north, tilt: angle, area, areaM2: round2(count * PANEL_WIDTH * PANEL_LENGTH), count, floor, y: round2(level.y0 + level.ceiling), panels, inverter: placeInverter(plan) }
}
