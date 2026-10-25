import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { MUZZLE_SMOKE, createArsenal } from '@adatechnology/game-weapons'
import type { ArsenalOptions } from '@adatechnology/game-weapons'
import { VIEWMODEL_EFFECTS } from '@adatechnology/game-vfx'
import { VIEWMODEL_EFFECT_IDS, createEffects } from '../src/fx/effects'
import { createWeaponFx, createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function roomWith(options: ArsenalOptions = {}): TestRoom {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false }, ...options })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return room
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const alive = (room: TestRoom): number => {
  const engine = room.vfx.peekWorkshop()
  return engine ? engine.meshes.count : 0
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
    effects.backblast(new THREE.Vector3(0, 1, 0), quaternion)
    effects.flameJet(new THREE.Vector3(0, 1, 0), quaternion, 1 / 60, 0.6)
    expect(played.map((request) => request.effect)).toEqual(['viewmodel_muzzle_flash', 'weapon_smoke_puff', 'launcher_backblast', 'flame_jet'])
    expect(played[0]!.values).toEqual({ size: 1.6, ...MUZZLE_SMOKE.smokeless })
    expect((played[0]!.direction as number[])[2]).toBeCloseTo(-1, 10)
    expect(played[0]!.orientation).toEqual([quaternion.x, quaternion.y, quaternion.z, quaternion.w])
    expect(played[2]!.orientation).toEqual(played[0]!.orientation)
    expect(played[1]!.values).toEqual({ vx: 0.01, vy: 0.1, vz: 0.02, radius: 0.007, life: 1.6, opacity: 0.3 })
    expect(played[3]!.values).toEqual({ dt: 1 / 60, scale: 0.6 })
  })

  it('shows nothing without a sink, or when the smoke profile is none', () => {
    const played: Array<Record<string, unknown>> = []
    const effects = createEffects(THREE, { play: (request) => (played.push({ ...request }), played.length), stop: () => undefined }, () => 0.5)
    effects.muzzleFlash(new THREE.Vector3(), new THREE.Quaternion(), 1, MUZZLE_SMOKE.none)
    expect(played).toHaveLength(0)
    const silent = createEffects(THREE, undefined, () => 0.5)
    expect(() => silent.muzzleFlash(new THREE.Vector3(), new THREE.Quaternion(), 1)).not.toThrow()
  })

  it('a shot in the hands puts the flash and its thin smokeless puff in the Workshop pools; the muzzle flash layer turns them off', () => {
    const room = roomWith()
    room.setTool('glock_17')
    run(room, 0.5)
    expect(alive(room)).toBe(0)
    room.use()
    run(room, 0.1)
    expect(alive(room)).toBe(MUZZLE_SMOKE.smokeless.puffs)
    run(room, 1.5)
    expect(alive(room)).toBe(0)
    room.bench('weapons_area')?.setLayer('muzzle_flash', false)
    room.use()
    run(room, 0.2)
    expect(alive(room)).toBe(0)
  })

  it('resolves muzzle smoke per weapon: black powder lingers, a suppressor shrinks flash and smoke, and bows/crossbows/melee emit nothing', () => {
    const bpRoom = roomWith({ patch: { weapons: { winchester_1894: { action: { caliber: '45_70_bp' } } } } })
    bpRoom.setTool('winchester_1894')
    run(bpRoom, 0.5)
    bpRoom.use()
    run(bpRoom, 0.1)
    expect(alive(bpRoom)).toBe(MUZZLE_SMOKE.black_powder.puffs)
    run(bpRoom, 3)
    expect(alive(bpRoom)).toBe(MUZZLE_SMOKE.black_powder.puffs)

    const supRoom = roomWith()
    supRoom.setTool('hk_mp5sd3')
    run(supRoom, 0.5)
    supRoom.use()
    run(supRoom, 0.1)
    expect(alive(supRoom)).toBe(MUZZLE_SMOKE.suppressed.puffs)

    for (const id of ['bow_compound', 'crossbow', 'machete']) {
      const quietRoom = roomWith()
      quietRoom.setTool(id)
      run(quietRoom, 0.5)
      quietRoom.use()
      run(quietRoom, 0.1)
      expect(alive(quietRoom), id).toBe(0)
    }
  })

  it('a hot barrel emits a thin rising thread of smoke (fiozinho)', () => {
    const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const weapon = 'ak_47'
    const tool = { weapon, category: 'rifle', ammo: 30, capacity: 30, reserve: 90, reloading: false, heat: 0.5 }
    const played: Array<Record<string, unknown>> = []
    const fx = createWeaponFx({
      THREE,
      scene,
      camera,
      arsenal,
      groundAt: () => 0,
      audio: null,
      tool: () => tool,
      effects: { play: (request) => (played.push({ ...request }), played.length), stop: () => undefined },
    })
    fx.handle({ type: 'tool', weapon }, tool)
    for (let frame = 0; frame < 30; frame++) fx.update(1 / 60)
    const wisps = played.filter((entry) => entry.effect === 'weapon_smoke_puff')
    expect(wisps.length).toBeGreaterThan(0)
    for (const wisp of wisps) {
      const values = wisp.values as { radius: number; opacity: number; vy: number }
      expect(values.radius).toBeLessThanOrEqual(0.01)
      expect(values.opacity).toBeLessThanOrEqual(0.18)
      expect(values.vy).toBeGreaterThan(0.05)
    }
    fx.dispose()
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

  it('a viewer with no effect sink makes a world of its own and still shows the flash, the smoke and the light', () => {
    const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const weapon = 'glock_17'
    const tool = { weapon, category: 'handgun', ammo: 10, capacity: 17, reserve: 40, reloading: false }
    const fx = createWeaponFx({ THREE, scene, camera, arsenal, groundAt: () => 0, audio: null, tool: () => tool })
    fx.handle({ type: 'tool', weapon }, tool)
    for (let frame = 0; frame < 30; frame++) fx.update(1 / 60)
    const meshes = (): THREE.Object3D[] => scene.getObjectByName('workshop-meshes')?.children ?? []
    expect(meshes()).toHaveLength(0)
    fx.handle({ type: 'shot', weapon, shots: 1, recoil: [0, 0] }, tool)
    for (let frame = 0; frame < 2; frame++) fx.update(1 / 60)
    expect(meshes().length).toBe(6 + MUZZLE_SMOKE.smokeless.puffs)
    const seen = (): { cones: number; lit: number } => {
      let cones = 0
      let lit = 0
      scene.traverse((node) => {
        if ((node as THREE.Mesh).geometry?.type === 'ConeGeometry') cones++
        if ((node as THREE.PointLight).isPointLight && (node as THREE.PointLight).intensity > 0) lit++
      })
      return { cones, lit }
    }
    expect(seen()).toEqual({ cones: 5, lit: 1 })
    for (let frame = 0; frame < 10; frame++) fx.update(1 / 60)
    expect(seen()).toEqual({ cones: 0, lit: 0 })
    expect(meshes()).toHaveLength(MUZZLE_SMOKE.smokeless.puffs)
    fx.dispose()
    expect(scene.getObjectByName('workshop-meshes')).toBeUndefined()
  })
})
