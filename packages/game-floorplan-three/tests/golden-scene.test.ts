import { readFileSync } from 'node:fs'

import { createGoldenRecord, diffGolden } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { planLod } from '../src'
import type { House } from '../src'
import { houseOf, planOf } from './helpers/houses'

// The scene the team's Casa3DSDK drew in the Visor de casas 3D (headless Chrome, three r160), six template/seed pairs: whole house, lot, roof and
// each floor, node by node (names, transforms, vertex counts and hash, bounding boxes, material colours), then the LOD planner for five foci and
// five draw-call budgets with the houses 60 m apart. Recorded by tools/golden/captures/house-scene.js.
const golden = JSON.parse(readFileSync(new URL('./fixtures/team-golden/vc3-house-scene.json', import.meta.url), 'utf8')) as GoldenRecord

type HouseEvent = { key: string; template: string; seed: number; state: string; ids: { template: string; rooms: string[]; doors: string[]; windows: string[]; items: string[] } }
const houseEvents = golden.events.filter((event) => event.type === 'house').map((event) => event.data as unknown as HouseEvent)

/** The new plan with the legacy ids the page's plan had: the seeded draws of the renderer key on them (`seedKey`). */
function build(event: HouseEvent): { house: House; plan: any } {
  const plan = planOf(event.template, event.seed, event.state)
  const legacy = new Map<string, string>()
  const pair = (now: any[], before: string[]): void => now.forEach((entry, index) => { if (before[index] !== undefined) legacy.set(entry.id, before[index] as string) })
  pair(plan.items, event.ids.items)
  pair(plan.rooms, event.ids.rooms)
  pair(plan.doors, event.ids.doors)
  pair(plan.windows, event.ids.windows)
  legacy.set(plan.template, event.ids.template)
  const seedKey = (id: string): string => legacy.get(id) ?? id.replace(/^backyard\.outbuilding\./, 'quintal.edicula.').replace(/\.ceiling_light$/, '.plafon')
  return { plan, ...houseOf(plan, { seedKey }) }
}

const built = new Map<string, House>()
for (const event of houseEvents) built.set(event.key, build(event).house)

describe('team golden: the scene of the Visor de casas 3D', () => {
  it('has the six pairs of the capture', () => {
    expect(houseEvents.map((event) => event.key)).toEqual(['casaA_3', 'sobrado_3', 'apartamento_1', 'media_terrea_moderna_3', 'mercado_3', 'farmacia_2'])
  })

  it('draws the same plan ids in the same order (so the legacy id map above is by position)', () => {
    for (const event of houseEvents) {
      const plan = planOf(event.template, event.seed, event.state)
      expect(plan.rooms).toHaveLength(event.ids.rooms.length)
      expect(plan.doors).toHaveLength(event.ids.doors.length)
      expect(plan.windows).toHaveLength(event.ids.windows.length)
      expect(plan.items).toHaveLength(event.ids.items.length)
    }
  })

  // The golden snapshots the scenes after the planner ran (the last plan hides what it sent to LOD 1 and 2), so this test goes first and the scene tests read that state.
  it('plans the level of detail like planejaLOD, for five foci and five budgets', () => {
    const houses = houseEvents.map((event) => built.get(event.key) as House)
    houses.forEach((house, index) => { house.group.position.x = index * 60; house.group.updateMatrixWorld(true) })
    const plans = golden.events.filter((event) => event.type === 'lod-plan')
    expect(plans).toHaveLength(25)
    for (const event of plans) {
      const { focus, budget, total, levels, order, applied } = event.data as any
      const plan = planLod(houses, { x: focus[0], y: focus[1], z: focus[2] }, budget)
      expect({ total: plan.total, levels: plan.levels, order: plan.houses.map((h: House) => houses.indexOf(h)), applied: houses.map((h) => h.lod) }, `focus ${focus} budget ${budget}`).toEqual({ total, levels, order, applied })
    }
  })

  for (const event of houseEvents) {
    it(`${event.key}: house, lot, roof and every floor match node by node`, () => {
      const house = built.get(event.key) as House
      const scenes: Record<string, any> = { [`${event.key}/house`]: house.group }
      if (house.lot) scenes[`${event.key}/lot`] = house.lot
      if (house.roof) scenes[`${event.key}/roof`] = house.roof
      house.floors.forEach((floor, index) => { scenes[`${event.key}/floor${index}`] = floor })
      const expected = { ...golden, events: [], scenes: Object.fromEntries(Object.entries(golden.scenes).filter(([label]) => label.startsWith(`${event.key}/`))) }
      const actual = createGoldenRecord({ name: golden.name, seed: golden.seed, scenes, hashOptions: { ignoreNames: true } })
      expect(diffGolden(expected, actual)).toEqual([])
      expect(Object.keys(actual.scenes).sort()).toEqual(Object.keys(expected.scenes).sort())
    })

    it(`${event.key}: draw calls match`, () => {
      const house = built.get(event.key) as House
      const stats = golden.events.find((e) => e.type === 'stats' && (e.data as any).key === event.key)?.data as any
      expect(house.stats.drawCalls).toBe(stats.drawCalls)
      expect(house.stats.drawCallsLOD1).toBe(stats.drawCallsLOD1)
      expect(house.stats.triangles).toBe(stats.triangles)
    })
  }
})
