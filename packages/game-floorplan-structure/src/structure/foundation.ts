import type { StructurePart, Rect } from '../types'
import { GROUND } from '../types'
import type { BuildContext } from './context'
import { addDeck, addJoists } from './floor-deck'

const raft = (context: BuildContext, thickness: number, material: string): StructurePart => {
  const [u0, v0, u1, v1] = context.houseBox
  const part = context.builder.add({ id: 'foundation_raft', role: 'slab', material, aabb: [u0 - 0.1, v0 - 0.1, u1 + 0.1, v1 + 0.1], y0: 0, y1: thickness }, { floor: 0 })
  context.builder.rest(part, GROUND, 'resting')
  return part
}

/** A unit in a building: the building's pillars go down to the ground and carry a slab under the unit. */
function addBuildingBase(context: BuildContext): void {
  const { builder, construction, houseBox: box } = context
  const corners: [number, number][] = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]
  const top = context.level(0) - context.system.slabThickness
  const pillars = corners.map(([u, v], k) => {
    const pillar = builder.add({ id: `building_column_${k}`, role: 'column', material: construction.frame.pillars, aabb: [u - 0.15, v - 0.15, u + 0.15, v + 0.15], y0: 0, y1: top }, { floor: 0 })
    builder.rest(pillar, GROUND, 'rebar')
    return pillar
  })
  const slab = builder.add({ id: 'slab_base', role: 'slab', material: construction.frame.slabs, aabb: box, y0: top, y1: context.level(0) }, { floor: 0, footprint: [box] })
  for (const pillar of pillars) builder.rest(slab, pillar, 'rebar')
  context.base0 = slab
}

function addBasement(context: BuildContext): StructurePart[] {
  const { builder, houseBox: box, elevation } = context
  const depth = context.construction.foundation.depth || 2.4
  const floor = builder.add({ id: 'basement_slab', role: 'slab', material: 'concrete', aabb: box, y0: -depth - 0.15, y1: -depth }, { floor: -1 })
  builder.rest(floor, GROUND, 'resting')
  const sides: [string, Rect][] = [
    ['front', [box[0], box[1] - 0.1, box[2], box[1] + 0.1]], ['back', [box[0], box[3] - 0.1, box[2], box[3] + 0.1]],
    ['left', [box[0] - 0.1, box[1], box[0] + 0.1, box[3]]], ['right', [box[2] - 0.1, box[1], box[2] + 0.1, box[3]]],
  ]
  const carried: StructurePart[] = []
  for (const [name, aabb] of sides) {
    const wall = builder.add({ id: `basement_wall_${name}`, role: 'wall', material: 'concrete', aabb, y0: -depth, y1: elevation }, { floor: -1 })
    builder.rest(wall, GROUND, 'rebar')
    builder.rest(wall, floor, 'rebar')
    carried.push(wall)
  }
  const count = Math.max(1, Math.floor((box[2] - box[0]) / 3.0))
  for (let k = 0; k < count; k++) {
    const u = box[0] + ((k + 0.5) * (box[2] - box[0])) / count
    const v = (box[1] + box[3]) / 2
    const column = builder.add({ id: `basement_column_${k}`, role: 'column', material: 'concrete', aabb: [u - 0.15, v - 0.15, u + 0.15, v + 0.15], y0: -depth, y1: elevation - 0.3 }, { floor: -1 })
    builder.rest(column, floor, 'rebar')
    builder.rest(column, GROUND, 'rebar')
    carried.push(column)
  }
  context.hasBasement = true
  return carried
}

/** Pier footings every ~2 m with a base beam through each line of them (crawl space, piles). */
function addPiers(context: BuildContext): StructurePart[] {
  const { builder, houseBox: box, elevation, construction } = context
  const columns = Math.max(2, Math.ceil((box[2] - box[0]) / 2.0) + 1)
  const rows = Math.max(2, Math.ceil((box[3] - box[1]) / 2.0) + 1)
  const height = Math.max(0.1, elevation - context.system.slabThickness - 0.15)
  const piers: StructurePart[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const u = box[0] + (i * (box[2] - box[0])) / (columns - 1)
      const v = box[1] + (j * (box[3] - box[1])) / (rows - 1)
      const pier = builder.add({ id: `footing_pier_${j}_${i}`, role: 'column', material: construction.foundation.material || 'concrete', aabb: [u - 0.12, v - 0.12, u + 0.12, v + 0.12], y0: 0, y1: height }, { floor: 0 })
      builder.rest(pier, GROUND, 'resting')
      piers.push(pier)
    }
  }
  const alongU = box[2] - box[0] >= box[3] - box[1]
  const beams: StructurePart[] = []
  const lines = alongU ? rows : columns
  for (let line = 0; line < lines; line++) {
    const at = alongU ? box[1] + (line * (box[3] - box[1])) / (rows - 1) : box[0] + (line * (box[2] - box[0])) / (columns - 1)
    const aabb: Rect = alongU ? [box[0], at - 0.07, box[2], at + 0.07] : [at - 0.07, box[1], at + 0.07, box[3]]
    const beam = builder.add({ id: `base_beam_${line}`, role: 'beam', material: construction.frame.timber, aabb, y0: height, y1: elevation - context.system.slabThickness }, { floor: 0 })
    const centre = (q: StructurePart): number => (alongU ? (q.aabb[1] + q.aabb[3]) / 2 : (q.aabb[0] + q.aabb[2]) / 2)
    for (const pier of piers.filter((q) => Math.abs(centre(q) - at) < 0.05)) builder.rest(beam, pier, 'bolt')
    beams.push(beam)
  }
  return beams
}

function addRaisedFloor(context: BuildContext): void {
  const { construction, system, houseBox: box } = context
  const carriers = construction.foundation.type === 'basement' ? addBasement(context) : addPiers(context)
  const thickness = system.slabThickness
  const joists = addJoists(context, { floor: 0, box, thickness, carriers, material: construction.frame.timber, joint: construction.foundation.type === 'basement' ? 'bolt' : 'nail' })
  const deckMaterial = context.isTimber ? (construction.floor.material === 'wood_hard' ? 'wood_hard' : 'plywood') : construction.frame.slabs
  context.base0 = addDeck(context, 'slab_0', deckMaterial, { floor: 0, box, thickness, joint: 'nail' }, joists)
}

/** Foundation and floor of the ground storey: raft, crawl space, piles, basement, a unit's building base or nothing (strip footing). */
export function addFoundation(context: BuildContext): void {
  const { type, material } = context.construction.foundation
  if (context.isUnit) return addBuildingBase(context)
  if (type === 'raft') context.base0 = raft(context, Math.max(0.1, context.elevation), material || 'concrete')
  else if (type === 'crawl_space' || type === 'piles' || type === 'basement') addRaisedFloor(context)
  else if (context.isTimber && type !== 'ground') context.base0 = raft(context, Math.max(0.12, context.elevation), 'concrete')
}
