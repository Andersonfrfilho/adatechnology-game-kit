import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { describe, expect, it } from 'vitest'

import { PLASTER_PER_FACE } from '@adatechnology/game-floorplan-structure'
import { chaseDepth } from '../src/construction-stages/installation-routes'
import { partStagesOf } from '../src/construction-stages/split-pieces'
import { ROOF_TIMBER_MATERIAL, ROOF_TIMBER_STRETCH } from '../src/construction-stages/roof-framing-stage'
import { PLANT_MIN_REACH, freeReachOf } from '../src/furniture/plant-room'
import { THREE, houseOf, planOf } from './helpers/houses'

type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel(level: number, options?: { roofLayer?: boolean }): number }
interface Part { readonly id: string; readonly material: string; readonly aabb: readonly number[]; readonly y0: number; readonly y1: number; readonly tags?: readonly string[] }
interface Support { readonly part: string; readonly on: string }
type WithStructure = StagedHouse & { structure: { parts: readonly Part[]; supports: readonly Support[]; unheld?: readonly string[] } }

const staged = (): WithStructure => houseOf(planOf('single_storey_a', 1), { interactives: { GameInteractables, GameInteractablesHousehold, GameInteractablesThree } }, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as WithStructure
const visibleIn = (o: THREE.Object3D): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** Construction tests (CLAUDE.md §11) of what the house room of single_storey_a showed wrong: each item at its stage, the roof's timber a real structure. */
describe('the house room of single_storey_a', () => {
  const house = staged()

  it('builds the roof timber as pieces of the house: wood that breaks where a hit lands, every stretch held by the frame', () => {
    const timber = house.structure.parts.filter((p) => /^roof_(timber|batten):/.test(p.id))
    expect(timber.length).toBeGreaterThan(200)
    for (const p of timber) {
      expect(p.material).toBe(ROOF_TIMBER_MATERIAL)
      // a stretch is never longer than the cut (a blast breaks the stretches it reaches, not a whole batten across the roof)
      expect(Math.hypot(p.aabb[2]! - p.aabb[0]!, p.aabb[3]! - p.aabb[1]!)).toBeLessThan(ROOF_TIMBER_STRETCH + 0.15)
    }
    const held = new Set(house.structure.supports.map((s) => s.part))
    expect(timber.filter((p) => !held.has(p.id))).toEqual([])
    expect((house.structure.unheld ?? []).filter((id) => /^roof_/.test(id))).toEqual([])
    // a stretch broken off the frame keeps the frame's stage: hidden before the roof framing goes up
    const stages = partStagesOf(house.group)
    expect(timber.every((p) => stages.get(p.id) === 'roofFraming')).toBe(true)
  })

  it('brings the gas cylinder with the furniture: not on the bare lot nor in the rough-in, there when the house is lived in', () => {
    const meshes: THREE.Object3D[] = []
    house.group.traverse((o) => { if (/^iv:.*gas_cylinder/.test(o.name)) o.traverse((m) => { if ((m as THREE.Mesh).isMesh) meshes.push(m) }) })
    expect(meshes.length).toBeGreaterThan(0)
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7]) {
      house.setConstructionLevel(level)
      expect(meshes.filter(visibleIn), `level ${level}`).toEqual([])
    }
    house.setConstructionLevel(8)
    expect(meshes.some(visibleIn)).toBe(true)
  })

  it('lays the runs in the masonry deep enough that the render covers them', () => {
    expect(chaseDepth()).toBeGreaterThan(PLASTER_PER_FACE + 0.025 / 2)
  })
})

describe('a potted plant', () => {
  it('is not left out for the slab over the room: what hangs over its stem caps its height, not its spread', () => {
    const slab = [-5, 2.6, -5, 5, 2.75, 5] as const
    const self = { id: 'plant', type: 'table_plant', x: 0, z: 0, w: 0.3, d: 0.3, h: 0.45, floor: 0 }
    const reach = freeReachOf({ x: 0, z: 0, y: 0.45, boxes: [slab], items: [], self, base: 0 } as unknown as Parameters<typeof freeReachOf>[0])
    expect(reach).toBeGreaterThan(PLANT_MIN_REACH)
  })
})
