import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { VIEWMODEL_EFFECTS } from '@adatechnology/game-vfx'
import { VIEWMODEL_EFFECT_IDS, createEffects } from '../src/fx/effects'
import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function roomWith(): TestRoom {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: demoItems('en'), renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return room
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const alive = (room: TestRoom): number => {
  const engine = room.vfx.peekWorkshop()
  return engine ? engine.add.count + engine.normal.count : 0
}

describe('the effects of the weapon in the hands go through the host sink', () => {
  it('knows the ids of the recipes of game-vfx', () => {
    const ids = VIEWMODEL_EFFECTS.map((effect) => effect.id)
    for (const id of Object.values(VIEWMODEL_EFFECT_IDS)) expect(ids).toContain(id)
  })

  it('plays what the gallery drew: the flash along the barrel, a puff, the backblast and the jet, each with its numbers and none of the mesh', () => {
    const played: Array<Record<string, unknown>> = []
    const effects = createEffects(THREE, { play: (request) => (played.push({ ...request }), played.length), stop: () => undefined }, () => 0.5)
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    effects.muzzleFlash(new THREE.Vector3(1, 2, 3), quaternion, 1.6)
    effects.smoke(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.01, 0.1, 0.02), 0.007, 1.6, 0.3)
    effects.backblast(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))
    effects.flameJet(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1), 1 / 60, 0.6)
    expect(played.map((request) => request.effect)).toEqual(['viewmodel_muzzle_flash', 'weapon_smoke_puff', 'launcher_backblast', 'flame_jet'])
    expect(played[0]!.values).toEqual({ size: 1.6 })
    expect((played[0]!.direction as number[])[2]).toBeCloseTo(-1, 10)
    expect(played[1]!.values).toEqual({ vx: 0.01, vy: 0.1, vz: 0.02, radius: 0.007, life: 1.6, opacity: 0.3 })
    expect(played[3]!.values).toEqual({ dt: 1 / 60, scale: 0.6 })
  })

  it('shows nothing without a sink', () => {
    const effects = createEffects(THREE, undefined, () => 0.5)
    expect(() => effects.muzzleFlash(new THREE.Vector3(), new THREE.Quaternion(), 1)).not.toThrow()
  })

  it('a shot in the hands puts the flash and its smoke in the Workshop pools; the muzzle flash layer turns them off', () => {
    const room = roomWith()
    room.setTool('glock_17')
    run(room, 0.5)
    expect(alive(room)).toBe(0)
    room.use()
    run(room, 0.1)
    expect(alive(room)).toBeGreaterThanOrEqual(6)
    run(room, 4)
    expect(alive(room)).toBe(0)
    room.bench('weapons_area')?.setLayer('muzzle_flash', false)
    room.use()
    run(room, 0.2)
    expect(alive(room)).toBe(0)
  })

  it('a launcher throws its backblast: 26 puffs and 14 bits of fire', () => {
    const room = roomWith()
    room.setTool('m72_law')
    run(room, 0.5)
    room.use()
    run(room, 0.1)
    expect(alive(room)).toBeGreaterThanOrEqual(40)
  })

  it('a flamethrower throws fire every frame it burns', () => {
    const room = roomWith()
    room.setTool('m2_flamethrower')
    run(room, 0.5)
    for (let burst = 0; burst < 6; burst++) {
      room.use()
      run(room, 0.1)
    }
    expect(alive(room)).toBeGreaterThan(40)
  })
})
