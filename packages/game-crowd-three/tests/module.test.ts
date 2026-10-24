import { quadrupedLayout, birdSize } from '@adatechnology/game-animals'
import { getSpecies } from '@adatechnology/game-animals-species'
import { createAnimalsThree } from '@adatechnology/game-animals-three'
import { createBestBuilder } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import type { CrowdPack } from '@adatechnology/game-crowd'
import type { BenchChange, ModuleHost } from '@adatechnology/game-contracts'
import { create } from '@adatechnology/game-infection'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { CROWD_AREA_ID, createCrowdTestModule } from '../src'
import type { CrowdBenchSpecies, CrowdTestModuleOptions } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack
/** A canvas without pixels for the coat textures (happy-dom has no 2D context). */
const stubDocument = () => {
  const gradient = { addColorStop() {} }
  const context = new Proxy({}, { get: (_t, key) => (key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : key === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) }) : () => {}), set: () => true })
  return { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as never
}
const sizeOf = (species: CrowdBenchSpecies): number => {
  const body = (species as unknown as { body: Parameters<typeof quadrupedLayout>[0] & { kind: string } }).body
  return body.kind === 'quadruped' ? quadrupedLayout(body).size : body.kind === 'bird' ? birdSize(body as never) : 1
}
const options = (extra: Partial<CrowdTestModuleOptions> = {}): CrowdTestModuleOptions => ({
  pack,
  locale: 'en',
  builders: (three) => {
    const best = createBestBuilder(three, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: () => 0.5 })
    return { buildBest: (spec, lod) => (best.setLOD(lod), best.build(spec) as THREE.Object3D), topMaterial: () => best.topM() as THREE.Material | null }
  },
  typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.name['pt-BR'] ?? type.id,
  civilianBodies: [{ type: 'Lento', human: true, decay: 0, seed: 813, skin: 0x8a5a3a, fem: false, life: 2 }],
  animals: { species: (id) => getSpecies(id) as CrowdBenchSpecies | undefined, size: sizeOf, drawer: (three) => createAnimalsThree(three, { seed: 7, document: stubDocument() }) as never },
  infection: {
    create: () => {
      const model = create({ seed: 5, incubationHours: 48, startHour: 0, regions: [{ id: 'town', pop: 2000, density: 1, police: 2 }], links: [], phases: [{ id: 'routine', dayMin: -99, dayMax: -99, threshold: 0, awareness: 0, cullFixed: 0, cullFraction: 0, shelter: 0, flee: 0, exit: 0, focusTransfer: 0 }], events: [{ id: 'seed', hour: 0, action: 'seed', region: 'town', n: 400 }] })
      model.advance(96)
      return model
    },
    region: 'town',
    active: (model) => (model as ReturnType<typeof create>).region('town').active,
  },
  ...extra,
})

const fakeHost = () => {
  const frames: ((dt: number) => void)[] = []
  const listeners: ((change: BenchChange) => void)[] = []
  const sounds: string[] = []
  const effects: string[] = []
  const banks: unknown[] = []
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.7, 6)
  camera.lookAt(0, 1.2, -45)
  const host = {
    THREE,
    scene,
    camera,
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({ kind: 'none' }),
    on: () => () => {},
    onFrame: (f: (dt: number) => void) => (frames.push(f), () => {}),
    log: () => {},
    bench: { value: () => undefined, layer: () => true, onChange: (l: (change: BenchChange) => void) => (listeners.push(l), () => {}), patch: () => {}, look: () => {} },
    audio: { play: (r: { sound: string }) => (sounds.push(r.sound), null), stop: () => {}, register: (bank: unknown) => void banks.push(bank) },
    effects: { play: (r: { effect: string }) => (effects.push(r.effect), null), stop: () => {} },
  } as unknown as ModuleHost
  return { host, scene, sounds, effects, banks, step: (n: number) => { for (let k = 0; k < n; k++) for (const f of frames) f(1 / 30) }, act: (id: string) => listeners.forEach((l) => l({ kind: 'action', id })), set: (id: string, value: number | boolean | string) => listeners.forEach((l) => l({ kind: 'control', id, value })) }
}

describe('createCrowdTestModule', () => {
  it('passes its scenarios', async () => {
    const module = createCrowdTestModule(options())
    const failures: string[] = []
    const ids: string[] = []
    for (const scenario of module.scenarios!('en')) {
      ids.push(scenario.id)
      await scenario.run({ expect: (ok, label, data) => void (ok || failures.push(`${scenario.id}: ${label} ${JSON.stringify(data)}`)) })
    }
    expect(failures).toEqual([])
    expect(ids).toEqual(['crowd_relevance', 'crowd_lod', 'crowd_attack_pose', 'crowd_corpse_darkens', 'crowd_civilians_flee', 'crowd_herd_calls', 'crowd_vultures', 'crowd_infection', 'crowd_determinism'])
  })

  it('draws a crowd, civilians and animals in the host scene; sounds go to host.audio, effects to host.effects', () => {
    const module = createCrowdTestModule(options({ startCount: 200 }))
    expect(module.id).toBe(CROWD_AREA_ID)
    const room = fakeHost()
    const detach = module.attach!(room.host)
    expect(room.banks).toHaveLength(1)
    room.act('herd')
    room.step(60)
    const metrics = Object.fromEntries(module.metrics!('en').map((m) => [m.id, m.read()]))
    expect(metrics.agents).toBe(200)
    expect(metrics.drawn).toBeGreaterThan(0)
    expect(metrics.draw_calls).toBeGreaterThan(0)
    expect(room.scene.getObjectByName('crowd')).toBeDefined()
    expect(room.scene.getObjectByName('herd')!.children.length).toBe(15)
    room.step(240)
    expect(room.sounds.length).toBeGreaterThan(0)
    expect(room.sounds.every((id) => ['groan', 'runner_groan', 'scream_hoarse', 'step', 'impact', 'flesh', 'wood', 'dog_bark', 'hen_cluck', 'lapwing_call', 'cow_moo'].includes(id))).toBe(true)
    room.act('hit')
    room.step(2)
    expect(room.effects).toContain('blood_hit')
    expect(module.crowd.corpses.count).toBe(1)
    room.act('materialize')
    expect(module.crowd.store.n).toBe(249)
    room.set('count', 0)
    expect(module.crowd.store.n).toBe(0)
    room.act('reset')
    room.step(1)
    detach()
    expect(room.scene.getObjectByName('crowd')).toBeUndefined()
  })

  it('stays calm by default (no agents) and knows no game', () => {
    const module = createCrowdTestModule({ pack })
    expect(module.crowd.store.n).toBe(0)
    expect(module.controls!('pt-BR').find((c) => c.id === 'count')).toMatchObject({ default: 0 })
    expect(module.controls!('pt-BR').some((c) => c.id === 'herd' || c.id === 'materialize')).toBe(false)
  })
})
