import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { EXPLOSIVES_AREA_ID, EXPLOSIVES_TEXT, createExplosivesTestModule, createWeaponsTestModule, worldExplosiveItem, worldExplosiveShell, worldExplosiveValve } from '../src'
import { createArsenal } from '@adatechnology/game-weapons'

vi.setConfig({ testTimeout: 60_000 })

const keysOf = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null ? Object.entries(value).flatMap(([key, item]) => keysOf(item, prefix === '' ? key : `${prefix}.${key}`)) : [prefix]

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

/** Plain stand-ins for the goods and the chair the push scenarios lay around the blast (the page brings the team's models; here a box of the real size is enough to be pushed). */
const LOOSE_THINGS = [
  { id: 'item_canned_beans', size: [0.08, 0.1, 0.08] },
  { id: 'item_water_bottle', size: [0.07, 0.25, 0.07] },
  { id: 'dining_chair', size: [0.45, 0.9, 0.45] },
].map(({ id, size }) => ({
  id,
  name: id,
  group: 'probe',
  movable: true,
  build: () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0]!, size[1]!, size[2]!), new THREE.MeshStandardMaterial())
    mesh.position.y = size[1]! / 2
    mesh.userData.hollow = true
    const group = new THREE.Group()
    group.add(mesh)
    return group
  },
}))

function roomWithExplosives(locale = 'pt-BR', catalog: typeof LOOSE_THINGS = []): { room: TestRoom; module: ReturnType<typeof createExplosivesTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale, catalog: catalog as never, renderer: stubRenderer(), ui: false })
  room.loadModule(createWeaponsTestModule({ locale, sound: false }))
  const module = createExplosivesTestModule({ locale, room: room as never })
  const report = room.loadModule(module)
  expect(report.problems).toEqual([])
  return { room, module }
}

describe('explosives text', () => {
  it('en and pt-BR have the same keys', () => {
    expect(keysOf(EXPLOSIVES_TEXT.en).sort()).toEqual(keysOf(EXPLOSIVES_TEXT['pt-BR']).sort())
  })
})

describe('world P13', () => {
  const def = createArsenal({ locale: 'en' }).explosives.get('propane_p13')!

  it('is the team model, one part "tank", with a real mass and its gas', () => {
    const item = worldExplosiveItem(def, 'P13')!
    const spec = (item.spec as unknown as (root: unknown) => { parts: Array<{ id: string; mass?: number; contains?: { liters: number; pressurized: boolean } }> })(undefined)
    expect(spec.parts).toHaveLength(1)
    expect(spec.parts[0]).toMatchObject({ id: 'tank', mass: 28, contains: { liters: 24, pressurized: true } })
    const root = item.build(THREE) as THREE.Group
    const box = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
    expect(box.y).toBeCloseTo(0.49, 1)
    expect(worldExplosiveValve(THREE, root)).toBeDefined()
    let mapped = 0
    root.traverse((node) => { if ((node as THREE.Mesh).isMesh && node.userData.destructionPart === 'tank') mapped++ })
    expect(mapped).toBeGreaterThan(0)
    expect(worldExplosiveShell(THREE, 'propane_p13')).toBeDefined()
  })

  it('scales the blast with the multiplier', () => {
    const at = (k: number): number => ((worldExplosiveItem(def, 'P13', { scale: () => k })!.spec as unknown as (root: unknown) => { parts: Array<{ explodes: { energy: number } }> })(undefined).parts[0]!.explodes.energy)
    expect(at(2)).toBeCloseTo(at(1) * 2)
  })
})

describe('explosives area', () => {
  it('opens by id and group, and runs the scenarios (what needs the characters or the wall is left out here)', async () => {
    const { room } = roomWithExplosives()
    expect(room.openArea(EXPLOSIVES_AREA_ID).some((o) => o.itemId === 'world_propane_p13')).toBe(true)
    const ids = new Set(['explosives_p13_shot', 'explosives_p13_valve', 'explosives_p13_fire', 'explosives_p13_chain'])
    const report = await room.runScenarios(room.scenarios.filter((s) => ids.has(s.id)))
    expect(report.results).toHaveLength(4)
    const failed = report.results.flatMap((r) => r.checks.filter((c) => !c.ok && !/zumbi|zombie|sobrevivente|survivor|parede|wall/i.test(c.label)).map((c) => `${r.id}: ${c.label}`))
    expect(failed).toEqual([])
  })

  it('an explosion throws the loose things around it away, the nearer ones faster (the P13 shot and a thrown M67)', async () => {
    const { room } = roomWithExplosives('en', LOOSE_THINGS)
    const ids = new Set(['explosives_push_p13', 'explosives_push_grenade'])
    const report = await room.runScenarios(room.scenarios.filter((s) => ids.has(s.id)))
    expect(report.results).toHaveLength(2)
    const failed = report.results.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => `${r.id}: ${c.label}`))
    expect(failed).toEqual([])
    // the checks that were made: the three kinds, in both scenarios
    for (const r of report.results) expect(r.checks.filter((c) => /the nearer one moved more/.test(c.label)).length).toBe(3)
  })
})
