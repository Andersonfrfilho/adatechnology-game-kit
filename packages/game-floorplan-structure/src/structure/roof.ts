import type { JointKind } from '@adatechnology/game-contracts'

import { distanceBetween, round2, touches, unionOf } from '../geometry'
import { ROOF_COVERINGS } from '../registry'
import type { Rect, RoofPane, StructurePart } from '../types'
import type { BuildContext } from './context'
import { OPEN_ROOM_TYPES } from './context'

const TRUSS_PITCH = 1.2
const DEFAULT_PITCH = 20
const DEFAULT_EAVE = 0.4
const CLOSED_ONLY: readonly string[] = [...OPEN_ROOM_TYPES, 'void']

interface RoofUnit {
  suffix: string
  box: Rect
  floor: number
  annex: boolean
}

/** The main roof, plus an own roof for every room of a lower storey that the storey above does not cover (a ground floor wider than the upper one). */
function roofUnits(context: BuildContext, bearing: number): RoofUnit[] {
  const units: RoofUnit[] = [{ suffix: '', box: context.topBox, floor: bearing, annex: false }]
  if (context.floorCount <= 1 || context.isUnit || bearing !== context.floorCount - 1) return units
  for (let floor = 0; floor < context.floorCount - 1; floor++) {
    const above = context.source.rooms.filter((room) => room.floor === floor + 1).flatMap((room) => room.parts)
    const rooms = context.source.rooms.filter((room) => room.floor === floor && !OPEN_ROOM_TYPES.includes(room.type) && room.type !== 'void' && room.type !== 'elevator')
    for (const room of rooms) {
      const area = room.parts.reduce((total, part) => total + (part[2] - part[0]) * (part[3] - part[1]), 0)
      const covered = room.parts.reduce((total, part) => total + above.reduce((sum, other) => sum + Math.max(0, Math.min(part[2], other[2]) - Math.max(part[0], other[0])) * Math.max(0, Math.min(part[3], other[3]) - Math.max(part[1], other[1])), 0), 0)
      if (covered < area * 0.7) units.push({ suffix: `_${room.id}`, box: unionOf(room.parts), floor, annex: true })
    }
  }
  return units
}

/** Everything that carries the roof of one unit: the plates at its height, the pillars and the inner bearing walls under it. */
function roofCarriers(context: BuildContext, unit: RoofUnit): StructurePart[] {
  const platesHere = context.plates.get(unit.floor) ?? []
  const allPlates = [...context.plates.values()].flat()
  const eaveHeight = platesHere.length ? Math.max(...platesHere.map((plate) => plate.y1)) : 0
  const plates = allPlates.filter((plate) => Math.abs(plate.y1 - eaveHeight) < 0.4 && touches(plate.aabb, unit.box, 0.3))
  const pillars = (context.pillars.get(unit.floor) ?? []).filter((pillar) => touches(pillar.aabb, unit.box, 0.3))
  const walls = context.walls.filter((wall) => wall.floor === unit.floor && wall.role === 'wall' && !wall.exterior && touches(wall.box, unit.box, 0.2)).map((wall) => context.wallParts.get(wall.id)!)
  return [...plates, ...pillars, ...walls]
}

function addFlatRoof(context: BuildContext, unit: RoofUnit, carriers: StructurePart[]): RoofPane {
  const { builder, construction, system } = context
  const top = context.level(unit.floor) + context.ceilingOf(unit.floor)
  const [u0, v0, u1, v1] = unit.box
  const slab = builder.add({ id: `slab_top${unit.suffix}`, role: 'slab', material: construction.frame.slabs, aabb: [u0 - 0.15, v0 - 0.15, u1 + 0.15, v1 + 0.15], y0: top, y1: top + 0.12 }, { floor: unit.floor, cover: true, footprint: [unit.box] })
  for (const carrier of carriers.length ? carriers : (context.plates.get(unit.floor) ?? [])) builder.rest(slab, carrier, system.joints.slab)
  if (unit.suffix === '') context.topSlab = slab
  return { id: slab.id, aabb: slab.aabb, y0: slab.y0, y1: slab.y1, flat: true }
}

function addTrusses(context: BuildContext, unit: RoofUnit, carriers: StructurePart[], geometry: GableGeometry): StructurePart[] {
  const { builder, construction, system } = context
  const { box } = unit
  const { axis, length, eave, rise, eaveY } = geometry
  const count = Math.max(2, Math.ceil(length / TRUSS_PITCH) + 1)
  const trusses: StructurePart[] = []
  for (let k = 0; k < count; k++) {
    const at = (axis === 'u' ? box[0] : box[1]) + (k * length) / (count - 1)
    const aabb: Rect = axis === 'u' ? [at - 0.04, box[1] - eave * 0.5, at + 0.04, box[3] + eave * 0.5] : [box[0] - eave * 0.5, at - 0.04, box[2] + eave * 0.5, at + 0.04]
    const truss = builder.add({ id: `truss${unit.suffix}_${k}`, role: 'beam', material: construction.frame.timber, aabb, y0: eaveY, y1: eaveY + rise }, { floor: unit.floor, fill: 0.25 })
    const touching = carriers.filter((carrier) => touches(aabb, carrier.aabb, 0.2) && carrier.role !== 'slab')
    const chosen = touching.length ? touching : carriers.slice().sort((a, b) => distanceBetween(aabb, a.aabb) - distanceBetween(aabb, b.aabb)).slice(0, 2)
    for (const carrier of chosen) builder.rest(truss, carrier, system.joints.truss)
    trusses.push(truss)
  }
  return trusses
}

interface GableGeometry {
  axis: 'u' | 'v'
  length: number
  eave: number
  rise: number
  eaveY: number
}

function geometryOf(context: BuildContext, unit: RoofUnit): GableGeometry {
  const { box } = unit
  const roof = context.construction.roof
  const platesHere = context.plates.get(unit.floor) ?? []
  const width = box[2] - box[0]
  const depth = box[3] - box[1]
  const axis = roof.axis ?? (width >= depth ? 'u' : 'v')
  const span = axis === 'u' ? depth : width
  const pitch = unit.annex ? Math.min(roof.pitch || DEFAULT_PITCH, 20) : roof.pitch || DEFAULT_PITCH
  const eaveY = platesHere.length ? Math.max(...platesHere.map((plate) => plate.y1)) : context.level(unit.floor) + context.ceilingOf(unit.floor)
  return { axis, length: axis === 'u' ? width : depth, eave: roof.eave ?? DEFAULT_EAVE, rise: round2((span / 2) * Math.tan((pitch * Math.PI) / 180)), eaveY }
}

interface Frames {
  all: StructurePart[]
  sideA: StructurePart[]
  sideB: StructurePart[]
}

/** Rafters of each side at the truss positions, each resting only on what is under its own side, and a ridge beam that rests on all of them. */
function addRafters(context: BuildContext, unit: RoofUnit, carriers: StructurePart[], geometry: GableGeometry): Frames {
  const { builder, construction, system } = context
  const { box } = unit
  const { axis, length, eave, rise, eaveY } = geometry
  const count = Math.max(2, Math.ceil(length / TRUSS_PITCH) + 1)
  const middle = axis === 'u' ? (box[1] + box[3]) / 2 : (box[0] + box[2]) / 2
  const frames: Frames = { all: [], sideA: [], sideB: [] }
  for (let k = 0; k < count; k++) {
    const at = (axis === 'u' ? box[0] : box[1]) + (k * length) / (count - 1)
    const halves: [string, Rect][] =
      axis === 'u'
        ? [['a', [at - 0.04, box[1] - eave * 0.5, at + 0.04, middle]], ['b', [at - 0.04, middle, at + 0.04, box[3] + eave * 0.5]]]
        : [['a', [box[0] - eave * 0.5, at - 0.04, middle, at + 0.04]], ['b', [middle, at - 0.04, box[2] + eave * 0.5, at + 0.04]]]
    for (const [side, aabb] of halves) {
      const rafter = builder.add({ id: `rafter${unit.suffix}_${side}_${k}`, role: 'beam', material: construction.frame.timber, aabb, y0: eaveY, y1: eaveY + rise }, { floor: unit.floor, fill: 0.25 })
      const touching = carriers.filter((carrier) => touches(aabb, carrier.aabb, 0.2) && carrier.role !== 'slab')
      const chosen = touching.length ? touching : carriers.slice().sort((x, y) => distanceBetween(aabb, x.aabb) - distanceBetween(aabb, y.aabb)).slice(0, 2)
      for (const carrier of chosen) builder.rest(rafter, carrier, system.joints.truss)
      frames.all.push(rafter)
      if (side === 'a') frames.sideA.push(rafter)
      else frames.sideB.push(rafter)
    }
  }
  if (!unit.annex) {
    const ridgeBox: Rect = axis === 'u' ? [box[0] - eave, middle - 0.05, box[2] + eave, middle + 0.05] : [middle - 0.05, box[1] - eave, middle + 0.05, box[3] + eave]
    const ridge = builder.add({ id: `ridge${unit.suffix}`, role: 'beam', material: construction.frame.timber, aabb: ridgeBox, y0: eaveY + rise - 0.12, y1: eaveY + rise }, { floor: unit.floor })
    for (const rafter of frames.all) builder.rest(ridge, rafter, system.joints.truss)
  }
  context.roof.trusses += count
  return frames
}

function panesOf(unit: RoofUnit, geometry: GableGeometry): Rect[] {
  const [u0, v0, u1, v1] = unit.box
  const { eave, axis } = geometry
  if (unit.annex) return [[u0 - eave, v0 - eave, u1 + eave, v1 + eave]]
  const midV = (v0 + v1) / 2
  const midU = (u0 + u1) / 2
  return axis === 'u'
    ? [[u0 - eave, v0 - eave, u1 + eave, midV], [u0 - eave, midV, u1 + eave, v1 + eave]]
    : [[u0 - eave, v0 - eave, midU, v1 + eave], [midU, v0 - eave, u1 + eave, v1 + eave]]
}

function coarseFrames(context: BuildContext, unit: RoofUnit, carriers: StructurePart[], geometry: GableGeometry): Frames {
  const trusses = addTrusses(context, unit, carriers, geometry)
  context.roof.trusses += trusses.length
  return { all: trusses, sideA: trusses, sideB: trusses }
}

function addGableRoof(context: BuildContext, unit: RoofUnit, carriers: StructurePart[], covering: JointKind): RoofPane[] {
  const { builder, construction } = context
  const geometry = geometryOf(context, unit)
  const frames: Frames = context.rafterRoof ? addRafters(context, unit, carriers, geometry) : coarseFrames(context, unit, carriers, geometry)
  const panes: RoofPane[] = []
  panesOf(unit, geometry).forEach((aabb, k) => {
    const name = unit.annex ? 'annex' : k === 0 ? 'a' : 'b'
    const options = { floor: unit.floor, fill: construction.roof.covering === 'colonial' ? 0.12 : 0.05, ...(construction.roof.pitch === undefined ? {} : { pitch: construction.roof.pitch }) }
    const pane = builder.add({ id: `roof${unit.suffix}_${name}`, role: 'roof', material: construction.roof.material, aabb, y0: geometry.eaveY, y1: geometry.eaveY + geometry.rise + 0.05 }, options)
    const carried = unit.annex || !context.rafterRoof ? frames.all : k === 0 ? frames.sideA : frames.sideB
    for (const frame of carried) builder.rest(pane, frame, covering)
    panes.push({ id: pane.id, aabb: pane.aabb, y0: pane.y0, y1: pane.y1 })
  })
  if (!unit.annex) {
    const roof = context.roof
    roof.axis = geometry.axis
    roof.ridge = round2(geometry.eaveY + geometry.rise)
    roof.eave = geometry.eave
    roof.y0 = round2(geometry.eaveY)
    roof.aabb = [unit.box[0] - geometry.eave, unit.box[1] - geometry.eave, unit.box[2] + geometry.eave, unit.box[3] + geometry.eave].map(round2) as Rect
  }
  return panes
}

/** Roof of a timber house: ceiling joists every 0.6 m tie the trusses and carry the attic floor. */
function addCeilingJoists(context: BuildContext): void {
  const { builder, construction } = context
  const bearing = context.roof.bearingFloor
  const rects = context.rectsOf(bearing, CLOSED_ONLY)
  const box = unionOf(rects.length ? rects : [context.topBox])
  const carriers = [...(context.plates.get(bearing) ?? []), ...context.walls.filter((w) => w.floor === bearing && w.role === 'wall' && !w.exterior).map((w) => context.wallParts.get(w.id)!)]
  const length = box[2] - box[0]
  const depth = box[3] - box[1]
  const alongU = length >= depth
  const span = alongU ? length : depth
  const count = Math.max(2, Math.round(span / 0.6) + 1)
  const beamTops = carriers.filter((carrier) => carrier.role === 'beam').map((carrier) => carrier.y0)
  const y0 = carriers.length ? Math.max(...beamTops, context.level(bearing) + 1) : context.topOf(bearing)
  const joists: StructurePart[] = []
  for (let k = 0; k < count; k++) {
    const at = (alongU ? box[0] : box[1]) + 0.05 + (k * (span - 0.1)) / (count - 1)
    const aabb: Rect = alongU ? [at - 0.025, box[1], at + 0.025, box[3]] : [box[0], at - 0.025, box[2], at + 0.025]
    const joist = builder.add({ id: `ceiling_joist_${k}`, role: 'beam', material: construction.frame.timber, aabb, y0: y0 - 0.02, y1: y0 + context.system.plateThickness - 0.02 }, { floor: bearing, spacing: 0.6 })
    const beams = carriers.filter((carrier) => carrier.role === 'beam' && touches(aabb, carrier.aabb, 0.2))
    for (const carrier of beams.length ? beams : carriers.slice(0, 2)) builder.rest(joist, carrier, 'nail')
    joists.push(joist)
  }
  context.ceilingJoists = joists
}

/** The roof over the top storey: a flat slab or trusses and two panes, and the ceiling joists of a timber house. */
export function addRoof(context: BuildContext): void {
  const { construction } = context
  const covering = ROOF_COVERINGS.get(construction.roof.covering)
  const bearing = construction.roof.bearingFloor ?? context.floorCount - 1
  const open = context.rectsOf(context.floorCount - 1, OPEN_ROOM_TYPES)
  const topRects = context.rectsOf(context.floorCount - 1, CLOSED_ONLY)
  const body = unionOf(open.length ? open : topRects)
  context.topBox = context.floorCount - 1 === bearing ? body : unionOf(context.rectsOf(bearing, OPEN_ROOM_TYPES))
  context.roof = { shape: construction.roof.shape, covering: construction.roof.covering, material: construction.roof.material, pitch: construction.roof.pitch || 0, bearingFloor: bearing, panes: [], trusses: 0 }
  for (const unit of roofUnits(context, bearing)) {
    const carriers = roofCarriers(context, unit)
    if (construction.roof.shape === 'slab') context.roof.panes.push(addFlatRoof(context, unit, carriers))
    else context.roof.panes.push(...addGableRoof(context, unit, carriers, covering?.joint ?? 'nail'))
  }
  if (context.isTimber && construction.roof.shape !== 'slab') addCeilingJoists(context)
}
