import { GROUND } from '../types'
import type { Rect, StructurePart, WaterTank } from '../types'
import { touches } from '../geometry'
import type { BuildContext } from './context'

const TANK_FILL = 0.08

const squareAround = (u: number, v: number, side: number): Rect => [u - side / 2, v - side / 2, u + side / 2, v + side / 2]

function addTank(context: BuildContext, tank: WaterTank, floor: number, y0: number): StructurePart {
  return context.builder.add({ id: 'water_tank', role: 'none', material: tank.material ?? 'plastic', aabb: tank.aabb, y0, y1: y0 + tank.h }, { floor, fill: TANK_FILL, liters: tank.capacity })
}

/** The slab under the roof that carries a tank in the attic or on a raised platform: a ceiling slab on the top plates, pillars and bearing walls. */
function ensureCeilingSlab(context: BuildContext, y: number): StructurePart {
  const { builder, construction, system } = context
  const existing = builder.find('slab_ceiling')
  if (existing) return existing
  const top = context.floorCount - 1
  const box = context.topBox
  const carriers = builder.parts.filter(
    (part) =>
      ((part.role === 'beam' && part.id.startsWith(`plate_${top}_`)) || (part.role === 'column' && part.floor === top) || (part.role === 'wall' && part.floor === top && !part.id.startsWith('basement'))) &&
      touches(box, part.aabb, 0.1),
  )
  const slab = builder.add({ id: 'slab_ceiling', role: 'slab', material: construction.frame.slabs, aabb: box, y0: y - 0.12, y1: y }, { floor: top, footprint: [box] })
  for (const carrier of carriers) builder.rest(slab, carrier, system.joints.slab)
  return slab
}

function addRaisedPlatform(context: BuildContext, tank: WaterTank): void {
  const { builder, construction } = context
  const platform = tank.platform!
  const top = context.floorCount - 1
  const ceiling = ensureCeilingSlab(context, platform.baseY)
  const pillars = platform.pillars.map((q, k) => {
    const pillar = builder.add({ id: `tank_column_${k}`, role: 'column', material: construction.frame.pillars, aabb: squareAround(q.u, q.v, q.side), y0: platform.baseY, y1: platform.topY - platform.thickness }, { floor: top })
    builder.rest(pillar, ceiling, 'rebar')
    return pillar
  })
  const slab = builder.add({ id: 'tank_slab', role: 'slab', material: construction.frame.slabs, aabb: platform.aabb, y0: platform.topY - platform.thickness, y1: platform.topY }, { floor: top })
  for (const pillar of pillars) builder.rest(slab, pillar, 'rebar')
  builder.rest(addTank(context, tank, top, tank.y), slab, 'resting')
}

function addAtticTank(context: BuildContext, tank: WaterTank): void {
  const { builder } = context
  const top = context.floorCount - 1
  if (!context.isTimber) {
    const ceiling = ensureCeilingSlab(context, tank.y)
    builder.rest(addTank(context, tank, top, tank.y), ceiling, 'resting')
    return
  }
  const supports = context.topSlab ? [context.topSlab] : (context.ceilingJoists ?? builder.parts.filter((part) => part.role === 'beam' && part.id.startsWith(`plate_${top}_`)))
  const y0 = supports[0] ? supports[0].y1 : tank.y - 0.03
  const floor = builder.add({ id: 'attic_floor', role: 'slab', material: 'plywood', aabb: context.topBox, y0, y1: y0 + 0.03 }, { floor: top })
  for (const support of supports) if (touches(floor.aabb, support.aabb, 0.1)) builder.rest(floor, support, 'nail')
  builder.rest(addTank(context, tank, top, tank.y), floor, 'resting')
}

function addSlabTank(context: BuildContext, tank: WaterTank): void {
  const { builder } = context
  const supports = builder.parts.filter((part) => part.role === 'slab' && Math.abs(part.y1 - tank.y) < 0.3 && touches(part.aabb, tank.aabb, 0.1))
  const carrier = supports.sort((a, b) => Math.abs(a.y1 - tank.y) - Math.abs(b.y1 - tank.y))[0] ?? context.topSlab
  const part = addTank(context, tank, tank.floor, tank.y)
  builder.rest(part, carrier ?? GROUND, 'resting')
}

function addTrestleTank(context: BuildContext, tank: WaterTank): void {
  const { builder } = context
  const stand = tank.stand!
  const columns = stand.pillars.map((q, k) => {
    const column = builder.add({ id: `trestle_column_${k}`, role: 'column', material: stand.material, aabb: squareAround(q.u, q.v, q.side), y0: 0, y1: stand.height }, { floor: 0 })
    builder.rest(column, GROUND, stand.baseJoint ?? 'resting')
    return column
  })
  const [u0, v0, u1, v1] = tank.aabb
  const beams = ([[u0 - 0.1, v0 - 0.1, u1 + 0.1, v0 + 0.05], [u0 - 0.1, v1 - 0.05, u1 + 0.1, v1 + 0.1]] as Rect[]).map((aabb, k) => {
    const beam = builder.add({ id: `trestle_beam_${k}`, role: 'beam', material: stand.material, aabb, y0: stand.height - 0.12, y1: stand.height }, { floor: 0 })
    for (const column of columns.filter((c) => touches(beam.aabb, c.aabb, 0.15))) builder.rest(beam, column, stand.joint ?? 'nail')
    return beam
  })
  const part = addTank(context, tank, 0, stand.height)
  for (const beam of beams) builder.rest(part, beam, stand.tie ?? 'resting')
}

/** The water tank as a part (role `none`: it weighs on what holds it and carries nothing) with whatever holds it up. */
export function addWaterTank(context: BuildContext): void {
  const tank = context.tank
  if (!tank) return
  switch (tank.place) {
    case 'slab':
      return addSlabTank(context, tank)
    case 'raised_slab':
      return addRaisedPlatform(context, tank)
    case 'attic':
      return addAtticTank(context, tank)
    case 'trestle':
      return addTrestleTank(context, tank)
  }
}
