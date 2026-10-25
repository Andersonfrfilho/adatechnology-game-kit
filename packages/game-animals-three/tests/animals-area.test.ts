// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { SPECIES } from '@adatechnology/game-animals-species'
import { createAnimalOutbreak } from '@adatechnology/game-characters-undead'
import { createAudioEngine } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { ANIMALS_AREA_ID, ANIMAL_ITEM_PREFIX, createAnimalsTestModule } from '../src'
import { stubDocument } from './helpers'

// Building 13 species and 40 skins takes seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 })

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const roomWithAnimals = (audio?: ReturnType<typeof createAudioEngine>): { room: TestRoom; module: ReturnType<typeof createAnimalsTestModule> } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: false, ...(audio ? { audio } : {}) })
  const module = createAnimalsTestModule({
    locale: 'pt-BR',
    species: SPECIES,
    document: stubDocument(),
    createOutbreak: ({ species, enabled, timeScale }) => createAnimalOutbreak({ species: species as never, enabled, timeScale }) as never,
  })
  const report = room.loadModule(module as never)
  expect(report.problems).toEqual([])
  return { room, module }
}

describe('animals test area', () => {
  it('passes the contract checks of the host and lays the 13 species', () => {
    const { room, module } = roomWithAnimals()
    const placed = room.openArea(ANIMALS_AREA_ID)
    expect(placed.filter((object) => object.itemId.startsWith(ANIMAL_ITEM_PREFIX))).toHaveLength(13)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    expect(module.placed.size).toBe(13)
  })

  it('the bench sets the look, the gait and the layers, and the bite clock turns what turns', () => {
    const { room } = roomWithAnimals()
    room.openArea(ANIMALS_AREA_ID)
    const bench = room.bench(ANIMALS_AREA_ID)!
    expect(bench.set('visual_state', 'infected')).toBe(true)
    expect(bench.set('gait', 'run')).toBe(true)
    expect(bench.setLayer('joints', true)).toBe(true)
    expect(bench.setLayer('sound_range', true)).toBe(true)
    expect(bench.setLayer('carcass_lure', true)).toBe(true)
    expect(bench.set('visual_state', 'alive')).toBe(true)
    expect(bench.act('bite_all')).toBe(true)
    // 600 game seconds per real second: every incubation ends within a few frames
    expect(bench.set('time_scale', 600)).toBe(true)
    expect(bench.act('bite_all')).toBe(true)
    for (let i = 0; i < 120; i++) room.update(0.5)
    const metrics = room.metrics().module
    expect(Number(metrics.turned) + Number(metrics.dead)).toBeGreaterThan(0)
    expect(bench.act('recover')).toBe(true)
    expect(room.metrics().module.turned).toBe(0)
  })

  it('every scenario passes and 40 skins draw in about 40 calls', async () => {
    const { room } = roomWithAnimals()
    room.openArea(ANIMALS_AREA_ID)
    const ids = ['visual_states', 'gait_moves_legs', 'outbreak_rule', 'carcass_lure', 'bite_to_turn_timer', 'skins_40']
    const report = await room.runScenarios(room.scenarios.filter((scenario) => ids.some((id) => scenario.id.includes(id))))
    const failed = report.results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')}`)
    expect(report.results).toHaveLength(ids.length)
    expect(failed).toEqual([])
  })
})

describe('the calls of the animals on the room engine', () => {
  it('the call action makes the species with a call call, once per cooldown', () => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 3, mix: 'art_scene', createContext: () => recorder.context })
    engine.unlock()
    const starts = (): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length
    const { room } = roomWithAnimals(engine)
    room.openArea(ANIMALS_AREA_ID)
    for (let i = 0; i < 10; i++) room.update(1 / 60)
    expect(engine.registry.sound('cow_moo')).toBeDefined()
    const bench = room.bench(ANIMALS_AREA_ID)!
    expect(bench.act('call')).toBe(true)
    const first = starts()
    expect(first).toBeGreaterThan(0)
    expect(bench.act('call')).toBe(true)
    expect(starts()).toBe(first)
    for (let i = 0; i < 60 * 31; i++) room.update(1 / 60)
    expect(bench.act('call')).toBe(true)
    expect(starts()).toBeGreaterThan(first)
    room.dispose()
  })
})
