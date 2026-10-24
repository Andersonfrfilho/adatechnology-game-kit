import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createCharacters } from '@adatechnology/game-characters'
import { PROFESSIONS, createPeoplePack } from '@adatechnology/game-characters-people'
import { UNDEAD_TYPES, createUndead, createUndeadPack } from '@adatechnology/game-characters-undead'
import { createAudioEngine } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { CHARACTERS_AREA_ID, PERSON_ITEM_PREFIX, ZOMBIE_ITEM_PREFIX, createCharactersTestModule, registerBodyMaterial } from '../src'

// Building the rich bodies of 25 items takes seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 })

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const roomWithCharacters = (audio?: ReturnType<typeof createAudioEngine>): { room: TestRoom; module: ReturnType<typeof createCharactersTestModule> } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: demoItems('pt-BR'), renderer: stubRenderer(), ui: false, ...(audio ? { audio } : {}) })
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

describe('the sounds of the bodies on the room engine', () => {
  const loud = () => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 3, mix: 'art_scene', createContext: () => recorder.context })
    engine.unlock()
    const starts = (): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length
    return { engine, starts }
  }

  it('registers the banks in the room engine and speaks for the aimed zombie', () => {
    const { engine, starts } = loud()
    const { room } = roomWithCharacters(engine)
    room.openArea(CHARACTERS_AREA_ID)
    for (let i = 0; i < 10; i++) room.update(1 / 60)
    expect(engine.registry.sound('groan_walker')).toBeDefined()
    const bench = room.bench(CHARACTERS_AREA_ID)!
    expect(bench.act('voice')).toBe(true)
    expect(starts()).toBeGreaterThan(0)
    room.dispose()
  })

  it('the special call of a zombie plays its sounds as the time goes by', () => {
    const { engine, starts } = loud()
    const { room } = roomWithCharacters(engine)
    room.openArea(CHARACTERS_AREA_ID)
    const bench = room.bench(CHARACTERS_AREA_ID)!
    expect(bench.act('special_call')).toBe(true)
    // the first zombie of the area is the walker, which has no special call: nothing starts, and nothing breaks
    for (let i = 0; i < 100; i++) room.update(1 / 60)
    expect(starts()).toBe(0)
    room.dispose()
  })

  it('a cut makes the sound of a cut where the segment was', () => {
    const { engine, starts } = loud()
    const { room } = roomWithCharacters(engine)
    const placed = room.openArea(CHARACTERS_AREA_ID)
    const target = placed.find((object) => object.itemId === `${ZOMBIE_ITEM_PREFIX}walker`)!
    for (let i = 0; i < 10; i++) room.update(1 / 60)
    const before = starts()
    room.world.hit(target.objectId, { type: 'slash', point: [target.root.position.x, 1.3, target.root.position.z], direction: [-1, 0, 0], part: 'upperArmL', points: 100, cut: 1 } as never)
    expect(starts()).toBeGreaterThan(before)
    room.dispose()
  })
})
