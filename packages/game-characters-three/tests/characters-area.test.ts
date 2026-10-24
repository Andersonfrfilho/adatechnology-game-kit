import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createCharacters } from '@adatechnology/game-characters'
import { PROFESSIONS, createPeoplePack } from '@adatechnology/game-characters-people'
import { UNDEAD_TYPES, createUndead, createUndeadPack } from '@adatechnology/game-characters-undead'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { CHARACTERS_AREA_ID, PERSON_ITEM_PREFIX, ZOMBIE_ITEM_PREFIX, createCharactersTestModule, registerBodyMaterial } from '../src'

// Building the rich bodies of 25 items takes seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 })

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const roomWithCharacters = (): { room: TestRoom; module: ReturnType<typeof createCharactersTestModule> } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: demoItems('pt-BR'), renderer: stubRenderer(), ui: false })
  registerBodyMaterial(room.world as never)
  const module = createCharactersTestModule({
    locale: 'pt-BR',
    packs: [createPeoplePack(), createUndeadPack()],
    undeadTypes: UNDEAD_TYPES as never,
    professions: PROFESSIONS as never,
    createUndead: (kit) => createUndead(kit) as never,
  })
  const report = room.loadModule(module as never)
  expect(report.problems).toEqual([])
  return { room, module }
}

describe('characters test area', () => {
  it('passes the contract checks of the host and lays the 13 types, the professions and the lane', () => {
    const { room, module } = roomWithCharacters()
    const placed = room.openArea(CHARACTERS_AREA_ID)
    expect(placed.filter((object) => object.itemId.startsWith(ZOMBIE_ITEM_PREFIX))).toHaveLength(13)
    expect(placed.filter((object) => object.itemId.startsWith(PERSON_ITEM_PREFIX)).length).toBeGreaterThanOrEqual(PROFESSIONS.length)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    expect(module.entries.size).toBe(placed.length)
  })

  it('a shot at a body arrives as events of its own object and the metrics read', () => {
    const { room } = roomWithCharacters()
    const placed = room.openArea(CHARACTERS_AREA_ID)
    const target = placed.find((object) => object.itemId === `${ZOMBIE_ITEM_PREFIX}walker`)!
    room.setTool('pistol_9mm')
    room.waitUntilReady()
    room.look([target.root.position.x, 1.6, target.root.position.z + 2], [target.root.position.x, 1.5, target.root.position.z])
    room.use()
    room.update(0.3)
    expect(room.log.entries().some((entry) => entry.channel === 'event' && entry.objectId === target.objectId)).toBe(true)
    const metrics = room.metrics().module
    expect(metrics.bodies).toBeGreaterThan(20)
  })

  it('the bench changes the rules and runs the actions', () => {
    const { room } = roomWithCharacters()
    room.openArea(CHARACTERS_AREA_ID)
    const bench = room.bench(CHARACTERS_AREA_ID)!
    expect(bench.set('penetration', 'team-game')).toBe(true)
    expect(bench.set('moment', 'sprint')).toBe(true)
    expect(bench.act('fire_preset')).toBe(true)
    expect(bench.act('spawn_100')).toBe(true)
    room.update(0.1)
    expect(Number(room.metrics().module.instances)).toBe(100)
    expect(bench.setLayer('capsules', true)).toBe(true)
    expect(bench.setLayer('eyes_only', true)).toBe(true)
  })

  it('every scenario passes', async () => {
    const { room } = roomWithCharacters()
    room.openArea(CHARACTERS_AREA_ID)
    const report = await room.runScenarios(room.scenarios.filter((scenario) => scenario.id.startsWith(`${CHARACTERS_AREA_ID}.`) || ['region_x_caliber', 'cut_at_every_joint', 'broken_bone_dangles', 'leg_limp_crawl', 'head_kill', 'grenade_by_radius', 'penetration_line', 'age_0_3', 'vest_and_helmet', 'bite_to_turn', 'benchmark_1000'].some((id) => scenario.id.includes(id))))
    const failed = report.results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')}`)
    expect(report.results).toHaveLength(11)
    expect(failed).toEqual([])
  })

  it('works without packs: no types, no professions, nothing breaks', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, renderer: stubRenderer(), ui: false, catalog: demoItems('en') })
  registerBodyMaterial(room.world as never)
    const module = createCharactersTestModule({ locale: 'en', createKit: () => createCharacters() })
    expect(module.items('en')).toEqual([])
    expect(room.loadModule(module as never).problems).toEqual([])
  })
})
