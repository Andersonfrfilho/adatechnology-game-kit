import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { installPortableMath, snapshotScene } from '@adatechnology/golden-tool'
import { createRng } from '@adatechnology/game-characters'

import { EXTRAS, FACE_FEATURES, HAND_ITEMS, HATS, createPersonBuilder } from '../src'
import golden from './fixtures/team-golden/portraits-people.json'

// Recorded from the Retratos do Vale page (three r128) by tools/characters-catalog: the page's `buildPerson` for the 44 PEOPLE, built in order from one
// shared `rng(77)`, hashed node by node. The specs are the generated game slice (`people.json`, a copy of the page's PEOPLE).
const PEOPLE = JSON.parse(readFileSync(join(__dirname, '../../../specs/001-migracao-entregas-dos-times/game-slice/characters/people.json'), 'utf8')) as Record<string, any>[]

type Scene = { objects: number; hash: string }
const scenes = golden.scenes as unknown as Record<string, Scene>

// The page had already drawn 8606 numbers from its shared `rng(77)` when the capture ran: it builds a portrait, a base diorama and the first thumbnail on load.
const PAGE_STREAM_OFFSET = 8606

describe('G-people: the Retratos do Vale survivors', () => {
  it('builds the 44 recorded people in order with the same node count and scene hash', () => {
    const restore = installPortableMath()
    const random = createRng(77)
    for (let drawn = 0; drawn < PAGE_STREAM_OFFSET; drawn++) random()
    const builder = createPersonBuilder(THREE, { random, createCanvas: () => document.createElement('canvas') })
    const mismatches: string[] = []
    for (const person of PEOPLE) {
      const built = builder.buildPerson(person, false)
      const snapshot = snapshotScene(built.root)
      const expected = scenes[`person_${person.id}`]!
      if (snapshot.hash !== expected.hash || snapshot.objects !== expected.objects) mismatches.push(`${person.id}: ${expected.hash}/${expected.objects} -> ${snapshot.hash}/${snapshot.objects}`)
    }
    restore()
    expect(PEOPLE).toHaveLength(44)
    expect(mismatches).toEqual([])
  })
})

describe('accessory registries', () => {
  const builder = createPersonBuilder(THREE)

  it('every clothing and gear id, hat, face feature and hand item draws without a missing name', () => {
    const base = { skin: 0xc49070, hair: { s: 'short', c: 0x222222 }, top: { c: 0x445566, sl: 'long' }, pants: { c: 0x333333 }, shoes: 0x111111 }
    for (const id of Object.keys(EXTRAS)) expect(() => builder.build({ ...base, ex: [[id, 0x884422, 0x2255aa]] }), `extra ${id}`).not.toThrow()
    for (const hat of HATS) for (const kind of hat.kinds) expect(() => builder.build({ ...base, hat: { k: kind, c: 0x884422, tape: 0x111111, photo: 1, nvg: 1 } }), `hat ${kind}`).not.toThrow()
    for (const feature of FACE_FEATURES) expect(() => builder.build({ ...base, face: feature.ids }), `face ${feature.ids}`).not.toThrow()
    for (const kind of Object.keys(HAND_ITEMS)) expect(() => builder.build({ ...base, hand: kind, lhand: kind }), `hand ${kind}`).not.toThrow()
    expect(() => builder.build({ ...base, back: 'shotgun', dog: 1, ex: [['backpack', 1]] })).not.toThrow()
  })

  it('has the page counts: 62 extras and ids, 8 hats, 12 face features and the hand items', () => {
    expect(Object.keys(EXTRAS).length).toBeGreaterThanOrEqual(62)
    expect(HATS.flatMap((hat) => hat.kinds)).toContain('helmet')
    expect(FACE_FEATURES).toHaveLength(12)
    expect(Object.keys(HAND_ITEMS)).toEqual(expect.arrayContaining(['axe', 'medbag', 'shovel', 'mic', 'flare']))
  })

  it('fingers are drawn at the highest level of detail only', () => {
    const base = { skin: 0xc49070, hair: { s: 'short', c: 0x222222 }, top: { c: 0x445566, sl: 'long' }, pants: { c: 0x333333 }, shoes: 0x111111 }
    const near = createPersonBuilder(THREE, { detail: 0 }).build(base)
    const far = createPersonBuilder(THREE, { detail: 1 }).build(base)
    expect(near.arms[0].fingers).toHaveLength(8)
    expect(far.arms[0].fingers).toHaveLength(0)
    expect(snapshotScene(near.root).objects - snapshotScene(far.root).objects).toBe(2 * (4 * 5 + 3))
  })
})
