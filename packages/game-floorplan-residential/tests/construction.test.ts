import { engine } from '@adatechnology/game-floorplan'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec, DestructionEvent, ObjectState, PartSpec } from '@adatechnology/game-destruction'
import { GROUND, register as registerStructure, toDestructibleSpec, validateSpec, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { buildResidentialTower, register, residentialTemplateIds } from '../src'

register(engine, { region: 'br' })
registerStructure(engine)

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
/** The tower is a spec built straight from its layout (`buildResidentialTower`), checked below. */
const HOUSES = residentialTemplateIds.filter((id) => id !== 'residential_tower')

const FIXED_JOINTS = new Set(['rebar', 'fused', 'weld'])

/** Standing horizontal slabs and roofs that only rest (no joint that takes a moment) whose centre is outside the box of where they still bear. */
function slabsOnOneEdge(spec: DestructibleSpec, state: ObjectState): string[] {
  const up = (id: string) => state.parts.find((part) => part.id === id)
  const stands = (id: string) => ['broken', 'collapsed'].indexOf(up(id)?.status ?? 'broken') < 0
  const box = (part: PartSpec) => {
    const size = part.shape.kind === 'box' ? part.shape.size : [0, 0, 0]
    return { min: part.position.map((v, k) => v - size[k]! / 2), max: part.position.map((v, k) => v + size[k]! / 2) }
  }
  const out: string[] = []
  for (const part of spec.parts) {
    const role = part.structure?.role
    if ((role !== 'slab' && role !== 'roof') || part.shape.kind !== 'box' || part.rotation || !stands(part.id)) continue
    const size = part.shape.size
    if (size[1] > Math.min(size[0], size[2])) continue
    const supports = (spec.joints ?? []).filter((j) => j.a === part.id && j.bears === 'a_on_b' && stands(j.b) && !state.joints.find((s) => s.id === (j.id ?? `${j.a}~${j.b}`))?.open)
    if (supports.length === 0 || supports.some((j) => FIXED_JOINTS.has(j.kind))) continue
    const mine = box(part)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const j of supports) {
      const other = spec.parts.find((q) => q.id === j.b)
      if (!other) continue
      const b = box(other)
      x0 = Math.min(x0, Math.max(mine.min[0]!, b.min[0]!))
      x1 = Math.max(x1, Math.min(mine.max[0]!, b.max[0]!))
      z0 = Math.min(z0, Math.max(mine.min[2]!, b.min[2]!))
      z1 = Math.max(z1, Math.min(mine.max[2]!, b.max[2]!))
    }
    const [cx, , cz] = part.position
    if (!(cx > x0 && cx < x1 && cz > z0 && cz < z1)) out.push(part.id)
  }
  return out
}

/** Construction tests (CLAUDE.md §11): every residential typology is a structure a structural engineer signs, the validator of the SDK finds nothing. */
describe('residential construction', () => {
  for (const id of HOUSES) {
    it(`${id}: confined masonry, concrete and load paths on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
      for (const seed of SEEDS) {
        const plan = engine.generate(id, { seed }) as unknown as { structure: Structure; doors: SourceDoor[] }
        expect(validateStructure(plan.structure, { doors: plan.doors }), `${id} seed ${seed}`).toEqual([])
      }
    })
  }

  it('residential_tower: the frame, core and piles reach the ground with NBR 6118 sections', () => {
    expect(validateSpec(buildResidentialTower({ storeys: 20 }))).toEqual([])
  }, 180000)

  /**
   * A crater under a corner of the house (3 m in radius, 2 m deep): the ground beams, the pillars and the wall pillars over it lose their support and fall, and
   * the load path solved again leaves nothing standing without one (no part floats, CLAUDE.md §12).
   */
  for (const id of HOUSES) {
    it(`${id}: a crater under a corner leaves no unsupported part standing`, () => {
      const plan = engine.generate(id, { seed: 1 }) as unknown as { structure: Structure; doors: SourceDoor[] }
      expect(validateStructure(plan.structure, { doors: plan.doors })).toEqual([])
      const spec = toDestructibleSpec(plan.structure, { wallDetail: 'coarse' })
      // what bears on the ground: the ground beams of a house, the pillars of a building
      const onGround = new Set((spec.joints ?? []).filter((joint) => joint.b === GROUND).map((joint) => joint.a))
      const bearers = spec.parts.filter((part) => onGround.has(part.id))
      expect(bearers.length).toBeGreaterThan(0)
      const world = createDestruction({ seed: 1 })
      const house = world.add(spec)
      const events: DestructionEvent[] = []
      world.on('*', (event) => events.push(event))
      const bearing = new Set(world.state(house)!.parts.filter((part) => (part.stress ?? 0) > 0).map((part) => part.id))
      world.groundLoss({ x: Math.min(...bearers.map((part) => part.position[0])), z: Math.min(...bearers.map((part) => part.position[2])), radius: 3, depth: 2, source: 'crater' })
      for (let t = 0; t < 30; t += 0.1) world.update(0.1)
      const parts = world.state(house)!.parts
      const standing = parts.filter((part) => part.status !== 'broken' && part.status !== 'collapsed')
      expect(events.some((event) => event.type === 'subside' && event.status === 'unsupported')).toBe(true)
      expect(events.some((event) => event.type === 'collapse')).toBe(true)
      expect(standing.filter((part) => bearing.has(part.id) && !((part.stress ?? 0) > 0)).map((part) => part.id)).toEqual([])
      // and no slab or roof that only rests is left standing on one edge: its centre is over what it still bears on
      expect(slabsOnOneEdge(spec, world.state(house)!)).toEqual([])
      expect(standing.length).toBeGreaterThan(parts.length / 2)
    })
  }
})
