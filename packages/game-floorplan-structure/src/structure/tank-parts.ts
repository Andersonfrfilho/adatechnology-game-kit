import { GROUND } from '../types'
import type { Rect, StructurePart, WaterTank } from '../types'
import { touches } from '../geometry'
import { pillarBox } from './context'
import type { BuildContext } from './context'

const TANK_FILL = 0.08
/** The sleepers under an attic tank span between its support beams: 15 cm deep (L/10 of their span). */
const SLEEPER_DEPTH = 0.15
/** The beam a castle wall stands on between its pillars where no support beam runs under it (L/10 of its span). */
const CASTLE_SILL = 0.2

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

/** A wall of the storey that a beam across (u or v) can bear on: its line and its plan box. */
function bearingWalls(context: BuildContext, floor: number): StructurePart[] {
  return context.builder.parts.filter((p) => (p.role === 'wall' || p.role === 'partition') && p.floor === floor && !p.unit)
}

/**
 * The beams under the ceiling slab that carry the tank (vigas de apoio): one along each support line, from the nearest bearing wall on one side to the nearest on
 * the other, as deep as a tenth of its span (NBR 6118, at least 25 cm). Whatever stands on the slab over the line stands on the beam, never mid-panel.
 * Lines along u at the given v (or along v at the given u, whichever spans less).
 */
function supportBeams(context: BuildContext, slab: StructurePart, lines: { readonly u: readonly [number, number]; readonly v: readonly [number, number] }): StructurePart[] {
  const { builder, construction, system } = context
  // the Visor de casas 3D stood its tanks on the slab as it was (the team's golden)
  if (context.visorSections) return []
  const top = context.floorCount - 1
  const storeyFloor = context.source.floors[top]?.y0 ?? 0
  const walls = bearingWalls(context, top)
  const span = (alongU: boolean, at: number, from: number, to: number): { a: StructurePart; b: StructurePart; a0: number; a1: number } | null => {
    // walls that cross the line: thin across the beam's run, reaching over `at`
    const crossing = walls.filter((w) => (alongU ? w.aabb[2] - w.aabb[0] < w.aabb[3] - w.aabb[1] && w.aabb[1] <= at && w.aabb[3] >= at : w.aabb[3] - w.aabb[1] < w.aabb[2] - w.aabb[0] && w.aabb[0] <= at && w.aabb[2] >= at))
    const mid = (w: StructurePart): number => (alongU ? (w.aabb[0] + w.aabb[2]) / 2 : (w.aabb[1] + w.aabb[3]) / 2)
    const before = crossing.filter((w) => mid(w) <= from).sort((x, y) => mid(y) - mid(x))[0]
    const after = crossing.filter((w) => mid(w) >= to).sort((x, y) => mid(x) - mid(y))[0]
    return before && after ? { a: before, b: after, a0: mid(before), a1: mid(after) } : null
  }
  const plan = (alongU: boolean): { beams: { a: StructurePart; b: StructurePart; a0: number; a1: number; at: number }[]; worst: number } | null => {
    const ats = alongU ? lines.v : lines.u
    const [from, to] = alongU ? lines.u : lines.v
    const beams = ats.map((at) => span(alongU, at, from, to)).map((b, k) => (b ? { ...b, at: ats[k]! } : null))
    if (beams.some((b) => !b)) return null
    const ok = beams as { a: StructurePart; b: StructurePart; a0: number; a1: number; at: number }[]
    return { beams: ok, worst: Math.max(...ok.map((b) => b.a1 - b.a0)) }
  }
  const alongU = plan(true), alongV = plan(false)
  const chosen = alongU && (!alongV || alongU.worst <= alongV.worst) ? { along: true, p: alongU } : alongV ? { along: false, p: alongV } : null
  if (!chosen) return []
  return chosen.p.beams.map((b, k) => {
    const depth = Math.max(0.25, (b.a1 - b.a0) / 10)
    const h = 0.075
    const aabb: Rect = chosen.along ? [b.a0, b.at - h, b.a1, b.at + h] : [b.at - h, b.a0, b.at + h, b.a1]
    // cast with the slab: its depth is measured to the slab's top, where what stands on it starts
    const beam = builder.add({ id: `tank_beam_${k}`, role: 'beam', material: construction.frame.slabs, aabb, y0: slab.y1 - depth, y1: slab.y1 }, { floor: top })
    // a pillar in the wall under each end carries it down (a beam on masonry alone crushes the bricks under its ends)
    for (const [end, wall] of [[b.a0, b.a], [b.a1, b.b]] as const) {
      // on a wall with a bond beam, the bond beam takes the end; on a partition, a pillar in it
      const bond = builder.parts.find((p) => p.beamKind === 'bond_beam' && builder.supports.some((x) => x.part === p.id && x.on === wall.id) && touches(p.aabb, chosen.along ? [end - 0.05, b.at - 0.05, end + 0.05, b.at + 0.05] : [b.at - 0.05, end - 0.05, b.at + 0.05, end + 0.05], 0.05))
      if (bond) {
        builder.rest(beam, bond, 'rebar')
        continue
      }
      // a timber wall carries it on its top plate and studs
      if (context.isTimber) continue
      // in the wall the beam ends on: its long side along that wall
      const at: Rect = chosen.along ? pillarBox(context.pillar, end, b.at, false) : pillarBox(context.pillar, b.at, end, true)
      const pillar = builder.add({ id: `tank_beam_pillar_${k}_${end === b.a0 ? 0 : 1}`, role: 'column', material: construction.frame.pillars, aabb: at, y0: storeyFloor, y1: slab.y1 - depth }, { floor: top })
      const base = builder.parts.find((p) => p.id !== pillar.id && (p.role === 'slab' || p.role === 'beam') && Math.abs(p.y1 - storeyFloor) < 0.06 && touches(p.aabb, at, 0.01))
      builder.rest(pillar, storeyFloor <= 0.05 ? GROUND : base ?? wall, 'rebar')
      builder.rest(beam, pillar, 'rebar')
    }
    builder.rest(beam, b.a, system.joints.slab)
    builder.rest(beam, b.b, system.joints.slab)
    builder.rest(slab, beam, 'rebar')
    return beam
  })
}

/** The castle: its corner pillars are the platform's, its walls stand on the support beams (along them) or on beams of their own between the pillars. */
function addCastle(context: BuildContext, tank: WaterTank, pillars: readonly StructurePart[], beams: readonly StructurePart[], ceiling: StructurePart): void {
  const { builder, construction } = context
  const castle = tank.castle!
  const top = context.floorCount - 1
  const [u0, v0, u1, v1] = castle.aabb
  const h = castle.thickness / 2
  const beamTop = castle.eaveY, beamBottom = castle.eaveY - 0.2
  const sides: readonly [string, Rect][] = [
    ['north', [u0 - h, v0 - h, u1 + h, v0 + h]],
    ['south', [u0 - h, v1 - h, u1 + h, v1 + h]],
    ['west', [u0 - h, v0 - h, u0 + h, v1 + h]],
    ['east', [u1 - h, v0 - h, u1 + h, v1 + h]],
  ]
  for (const [side, box] of sides) {
    const bond = builder.add({ id: `castle_bond_beam_${side}`, role: 'beam', material: construction.frame.slabs, aabb: box, y0: beamBottom, y1: beamTop }, { floor: top, beamKind: 'bond_beam' })
    for (const p of pillars.filter((q) => touches(q.aabb, box, 0.05))) builder.rest(bond, p, 'rebar')
    // the wall's foot: on a support beam that runs under it, else on a beam of its own cast between its two pillars
    const under = beams.find((b) => touches(b.aabb, box, 0.02) && (box[2] - box[0] >= box[3] - box[1]) === (b.aabb[2] - b.aabb[0] >= b.aabb[3] - b.aabb[1]))
    let foot: StructurePart = under ?? ceiling
    if (!under) {
      foot = builder.add({ id: `castle_sill_beam_${side}`, role: 'beam', material: construction.frame.slabs, aabb: box, y0: castle.baseY, y1: castle.baseY + CASTLE_SILL }, { floor: top })
      for (const p of pillars.filter((q) => touches(q.aabb, box, 0.05))) builder.rest(foot, p, 'rebar')
    }
    const wall = builder.add({ id: `castle_wall_${side}`, role: 'wall', material: 'brick', aabb: box, y0: under ? castle.baseY : castle.baseY + CASTLE_SILL, y1: beamBottom }, { floor: top, exterior: true })
    builder.rest(wall, foot, 'mortar')
    builder.rest(bond, wall, 'mortar')
  }
  const roof = builder.add({ id: 'castle_roof', role: 'roof', material: construction.roof.material || 'ceramic', aabb: [u0 - h - 0.3, v0 - h - 0.3, u1 + h + 0.3, v1 + h + 0.3], y0: beamTop, y1: beamTop + 0.6 }, { floor: top })
  for (const [side] of sides) builder.rest(roof, `castle_bond_beam_${side}`, 'nail')
}

function addRaisedPlatform(context: BuildContext, tank: WaterTank): void {
  const { builder, construction } = context
  const platform = tank.platform!
  const top = context.floorCount - 1
  const ceiling = ensureCeilingSlab(context, platform.baseY)
  const pu = [...new Set(platform.pillars.map((q) => q.u))].sort((a, b) => a - b), pv = [...new Set(platform.pillars.map((q) => q.v))].sort((a, b) => a - b)
  const beams = supportBeams(context, ceiling, { u: [pu[0]!, pu[pu.length - 1]!], v: [pv[0]!, pv[pv.length - 1]!] })
  const pillarTop = tank.castle ? tank.castle.eaveY - 0.2 : platform.topY - platform.thickness
  const pillars = platform.pillars.map((q, k) => {
    const pillar = builder.add({ id: `tank_column_${k}`, role: 'column', material: construction.frame.pillars, aabb: squareAround(q.u, q.v, q.side), y0: platform.baseY, y1: pillarTop }, { floor: top })
    const beam = beams.find((b) => touches(b.aabb, pillar.aabb, 0.01))
    builder.rest(pillar, beam ?? ceiling, 'rebar')
    return pillar
  })
  const slab = builder.add({ id: 'tank_slab', role: 'slab', material: construction.frame.slabs, aabb: platform.aabb, y0: platform.topY - platform.thickness, y1: platform.topY }, { floor: top })
  for (const pillar of pillars) builder.rest(slab, pillar, 'rebar')
  builder.rest(addTank(context, tank, top, tank.y), slab, 'resting')
  if (tank.castle) addCastle(context, tank, pillars, beams, ceiling)
}

function addAtticTank(context: BuildContext, tank: WaterTank): void {
  const { builder } = context
  const top = context.floorCount - 1
  if (!context.isTimber) {
    // on the ceiling slab, on two sleepers that span between the support beams under it: its weight goes to the beams, never to the middle of a panel
    const ceiling = ensureCeilingSlab(context, tank.y)
    const [u0, v0, u1, v1] = tank.aabb
    const beams = supportBeams(context, ceiling, { u: [u0 - 0.05, u1 + 0.05], v: [v0 - 0.05, v1 + 0.05] })
    const alongU = beams[0] ? beams[0].aabb[2] - beams[0].aabb[0] >= beams[0].aabb[3] - beams[0].aabb[1] : true
    const sleepers = beams.length === 2
      ? [0, 1].map((k) => {
          const at = alongU ? (k ? u1 - 0.2 : u0 + 0.2) : (k ? v1 - 0.2 : v0 + 0.2)
          const aabb: Rect = alongU ? [at - 0.075, v0 - 0.125, at + 0.075, v1 + 0.125] : [u0 - 0.125, at - 0.075, u1 + 0.125, at + 0.075]
          const sleeper = builder.add({ id: `tank_sleeper_${k}`, role: 'beam', material: context.construction.frame.slabs, aabb, y0: ceiling.y1, y1: ceiling.y1 + SLEEPER_DEPTH }, { floor: top })
          for (const b of beams) builder.rest(sleeper, b, 'rebar')
          return sleeper
        })
      : []
    const part = addTank(context, tank, top, sleepers.length ? ceiling.y1 + SLEEPER_DEPTH : tank.y)
    for (const sleeper of sleepers.length ? sleepers : [ceiling]) builder.rest(part, sleeper, 'resting')
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
