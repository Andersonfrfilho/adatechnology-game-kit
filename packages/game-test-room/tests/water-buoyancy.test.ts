import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DestructibleSpec, ObjectState } from '@adatechnology/game-destruction'
import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { displacedVolume } from '../src/displaced-volume'
import { makeRoom } from './helpers'

type PartDraft = DestructibleSpec['parts'][number]
const box = (id: string, material: string, mass: number, size: [number, number, number], at: [number, number, number] = [0, size[1] / 2, 0]): PartDraft => ({ id, material, mass, shape: { kind: 'box', size }, position: at })
const spec = (name: string, parts: PartDraft[]): DestructibleSpec => ({ name, parts, joints: [] })
const item = (id: string, drawn: DestructibleSpec): TestRoomItem => ({ id, name: id, group: 'test', build: (T) => buildFromSpec(T, drawn), spec: drawn })

/** Things of the real catalogue at their real measures and masses. */
const SINKERS = {
  sledgehammer: spec('sledgehammer', [box('handle', 'wood_hard', 0.8, [0.9, 0.035, 0.035], [0, 0.0175, 0]), box('head', 'steel', 4.2, [0.12, 0.12, 0.25], [0.35, 0.06, 0])]),
  wrench: spec('wrench', [box('body', 'steel', 0.5, [0.25, 0.02, 0.06])]),
  bricks: spec('bricks', [box('body', 'brick', 25, [0.19, 0.18, 0.29])]),
  can_of_beans: spec('can_of_beans', [box('body', 'steel', 0.45, [0.08, 0.068, 0.079])]),
}
const FLOATERS = {
  plank: spec('plank', [box('body', 'wood_soft', 2, [0.8, 0.05, 0.25])]),
  empty_can: spec('empty_can', [box('body', 'steel', 0.05, [0.066, 0.12, 0.066])]),
  empty_bottle: spec('empty_bottle', [box('body', 'plastic', 0.03, [0.07, 0.25, 0.07])]),
}
const CATALOG = Object.entries({ ...SINKERS, ...FLOATERS }).map(([id, drawn]) => item(id, drawn))
const SECONDS = 6
const SETTLED = 0.02

/** Where the thing ends up after it is dropped over the middle of a pool: the underside and the top of its box, and the water line and the bed. */
function dropInPool(id: string) {
  const room = makeRoom({ catalog: CATALOG, ground: { surface: 'shallow_water' } })
  const spawned = room.spawn(id, [0, 0.8, 0], 0)
  for (let i = 0; i < 60 * SECONDS; i++) room.update(1 / 60)
  const bounds = new THREE.Box3().setFromObject(spawned.root)
  const water = room.terrain.waterAt(0, 0)!
  return { bottom: bounds.min.y, top: bounds.max.y, level: water.level, bed: room.terrain.heightAt(0, 0) }
}

describe('a thing dropped in water', () => {
  for (const id of Object.keys(SINKERS)) {
    it(`${id} is denser than water and goes to the bed`, () => {
      const { bottom, bed } = dropInPool(id)
      expect(bottom).toBeLessThan(bed + SETTLED)
    })
  }
  for (const id of Object.keys(FLOATERS)) {
    it(`${id} is lighter than the water it displaces and floats at the surface`, () => {
      const { top, bottom, level, bed } = dropInPool(id)
      expect(top).toBeGreaterThan(level - SETTLED)
      expect(bottom).toBeGreaterThan(bed + 0.1)
    })
  }
})

describe('the volume a body displaces', () => {
  const hammer = SINKERS.sledgehammer
  const state = (statuses: Record<string, string>): ObjectState => ({ id: 'h', position: [0, 0, 0], rotation: [0, 0, 0, 1], parts: hammer.parts.map((part) => ({ id: part.id, status: statuses[part.id] ?? 'intact' })) as unknown as ObjectState['parts'], joints: [], groups: [], destroyed: false })

  it('is the volume of the parts as drawn, not the box round them', () => {
    const boundsVolume = 0.9 * 0.12 * 0.25
    const volume = displacedVolume(hammer, state({}), boundsVolume)
    expect(volume).toBeCloseTo(0.9 * 0.035 * 0.035 + 0.12 * 0.12 * 0.25, 6)
    expect(volume).toBeLessThan(boundsVolume / 4)
  })
  it('leaves out a part that came off, and is never more than the box', () => {
    expect(displacedVolume(hammer, state({ head: 'broken' }), 1)).toBeCloseTo(0.9 * 0.035 * 0.035, 6)
    expect(displacedVolume(hammer, state({}), 0.001)).toBe(0.001)
  })
  it('is the box when there is nothing else to go by', () => {
    expect(displacedVolume(undefined, undefined, 0.5)).toBe(0.5)
    expect(displacedVolume(hammer, state({ head: 'broken', handle: 'ashes' }), 0.5)).toBe(0.5)
  })
})
