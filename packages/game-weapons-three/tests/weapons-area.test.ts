import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { ARCHETYPE_MODELS, COUNTER_ITEM_ID, createWeaponsTestModule, MOUNTED_M134_ITEM_ID, weaponsLayout, WEAPON_ITEM_PREFIX } from '../src'

// Building every weapon model takes seconds on a busy machine; the default 5 s limit made this file flaky under load.
vi.setConfig({ testTimeout: 30_000 })

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function roomWithWeapons(): { room: TestRoom; module: ReturnType<typeof createWeaponsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: [], renderer: stubRenderer(), ui: false })
  const module = createWeaponsTestModule({ locale: 'pt-BR', sound: false })
  const report = room.loadModule(module)
  expect(report.problems).toEqual([])
  return { room, module }
}

const fireUntilEmpty = (room: TestRoom): void => {
  room.look([0, 1.7, 5], [0, 1.2, -11])
  for (let i = 0; i < 200 && room.tool.ammo > 0; i++) {
    room.use()
    room.update(0.3)
  }
}

describe('weapons test area', () => {
  it('passes the contract checks of the host and lays every weapon on the counters, where they stay', () => {
    const { room } = roomWithWeapons()
    const placed = room.openArea('weapons_area')
    const weapons = placed.filter((o) => o.itemId.startsWith(WEAPON_ITEM_PREFIX))
    const laid = [...room.arsenal.weapons.values()].filter((def) => !['hand', 'kick', 'shove', 'fists'].includes(def.id) && !(def.id in ARCHETYPE_MODELS))
    expect(weapons.map((o) => o.itemId).sort()).toEqual(laid.map((def) => `${WEAPON_ITEM_PREFIX}${def.id}`).sort())
    expect(weapons.length).toBeGreaterThan(100)
    expect(placed.filter((o) => o.itemId === COUNTER_ITEM_ID).length).toBeLessThanOrEqual(8)
    expect(placed.some((o) => o.itemId === 'target_steel_plate')).toBe(true)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(Math.min(...weapons.map((o) => o.root.position.y))).toBeGreaterThan(0.85)
  })

  it('lays every weapon inside the length of a counter, none past the end', () => {
    const { room } = roomWithWeapons()
    const placements = room.openArea('weapons_area')
    const counters = placements.filter((o) => o.itemId === COUNTER_ITEM_ID)
    for (const weapon of placements.filter((o) => o.itemId.startsWith(WEAPON_ITEM_PREFIX))) {
      const counter = counters.find((c) => Math.abs(c.root.position.x - weapon.root.position.x) < 0.01 && Math.abs(c.root.position.z - weapon.root.position.z) < 2.4)
      expect(counter, weapon.itemId).toBeDefined()
    }
    expect(weaponsLayout(['weapon_a', 'weapon_b']).filter((p) => p.item === COUNTER_ITEM_ID).length).toBe(1)
  })

  it('throws when the weapons do not fit on the counters, or one is longer than a counter', () => {
    const many = Array.from({ length: 400 }, (_, index) => `weapon_${index}`)
    expect(() => weaponsLayout(many)).toThrow(/do not fit/)
    expect(() => weaponsLayout(['weapon_long'], () => 50)).toThrow(/a counter holds/)
  })

  it('shows the equipped weapon in the hands and ejects one casing per shot', () => {
    const { room, module } = roomWithWeapons()
    room.setTool('pistol_9mm')
    room.update(0.4)
    expect(module.fx?.inHand).toBe('pistol_9mm')
    room.look([0, 1.7, 5], [0, 1.2, -11])
    for (let i = 0; i < 3; i++) {
      room.use()
      room.update(0.3)
    }
    expect(module.fx?.casings).toBe(3)
  })

  it('drops the magazine on reload and logs the reload start and end', () => {
    const { room, module } = roomWithWeapons()
    room.setTool('pistol_9mm')
    room.update(0.4)
    fireUntilEmpty(room)
    room.use()
    for (let i = 0; i < 40; i++) room.update(0.25)
    expect(module.fx?.magazines).toBe(1)
    const text = room.log.toText()
    expect(text).toMatch(/Recarga iniciada: .*\(0\/15\)/)
    expect(text).toMatch(/Recarga completa: .*\(15\/15\)/)
  })

  it('a revolver keeps its cases until it is opened to reload', () => {
    const { room, module } = roomWithWeapons()
    room.setTool('revolver_357')
    room.update(0.4)
    fireUntilEmpty(room)
    expect(module.fx?.casings).toBe(0)
    room.use()
    for (let i = 0; i < 40; i++) room.update(0.1)
    expect(module.fx?.casings).toBe(6)
    expect(module.fx?.magazines).toBe(0)
  })

  it('takes the tool cycle events it does not handle yet without error', () => {
    const { room, module } = roomWithWeapons()
    room.setTool('rifle_5_56')
    room.update(0.4)
    const tool = { weapon: 'rifle_5_56', category: room.tool.def.category, ammo: room.tool.ammo, capacity: room.tool.capacity, reserve: room.tool.reserve, reloading: false, mode: 'burst', fault: 'stovepipe', safety: true, heat: 0.4 }
    expect(() => {
      module.fx?.handle({ type: 'mode', weapon: 'rifle_5_56', mode: 'burst' }, tool)
      module.fx?.handle({ type: 'fault', weapon: 'rifle_5_56', fault: 'stovepipe' }, tool)
      module.fx?.handle({ type: 'clear', weapon: 'rifle_5_56', fault: 'stovepipe', phase: 'end' }, tool)
      module.fx?.handle({ type: 'safety', weapon: 'rifle_5_56', on: true }, tool)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
      room.update(0.1)
    }).not.toThrow()
    expect(module.fx?.inHand).toBe('rifle_5_56')
  })

  it('draws a modeled weapon on a counter with one mesh per material, no shadow cast, all bound to the body part', () => {
    const { room } = roomWithWeapons()
    const placed = room.openArea('weapons_area')
    const rifle = placed.find((o) => o.itemId === `${WEAPON_ITEM_PREFIX}ak_47`) ?? placed.find((o) => o.itemId.startsWith(WEAPON_ITEM_PREFIX))
    expect(rifle).toBeDefined()
    const meshes: THREE.Mesh[] = []
    rifle?.root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
    })
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.length).toBeLessThanOrEqual(12)
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(meshes.length)
    for (const mesh of meshes) {
      expect(mesh.userData.destructionPart).toBe('body')
      expect(mesh.castShadow).toBe(false)
      expect(mesh.geometry.index).toBeNull()
    }
  })

  it('still takes the hits of a weapon lying on a counter when it is shot', () => {
    const { room } = roomWithWeapons()
    const placed = room.openArea('weapons_area')
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    const target = placed.find((o) => o.itemId === `${WEAPON_ITEM_PREFIX}ak_47`)
    expect(target).toBeDefined()
    const at = target?.root.position ?? new THREE.Vector3()
    room.setTool('barrett_m82a1')
    room.update(0.4)
    room.look([at.x, at.y + 1.2, at.z + 0.001], [at.x, at.y + 0.03, at.z])
    expect(room.inspect()?.objectId).toBe(target?.objectId)
    expect(room.world.part(target?.objectId ?? '', 'body')?.status).toBe('intact')
    for (let i = 0; i < 3; i++) {
      room.use()
      room.update(0.3)
    }
    const after = room.world.part(target?.objectId ?? '', 'body')
    expect(after?.status).not.toBe('intact')
    // a .50 ball has about 20 mm of steel in it (see the ammo table), so it dents the 6 cm solid body that stands for the gun instead of drilling it
    expect((after?.holes.length ?? 0) + (after?.dents.length ?? 0)).toBeGreaterThan(0)
  })

  it('lays the weapons T1.7.5 added on the counters like the others, all on four columns of counters at most', () => {
    const { room } = roomWithWeapons()
    const placed = room.openArea('weapons_area')
    const counters = placed.filter((o) => o.itemId === COUNTER_ITEM_ID)
    expect(counters.length).toBeLessThanOrEqual(8)
    for (const id of ['hk_mp5sd3', 'm134', 'pp19_bizon', 'mg3', 'vz61', 'taurus_th380']) {
      const weapon = placed.find((o) => o.itemId === `${WEAPON_ITEM_PREFIX}${id}`)
      expect(weapon, id).toBeDefined()
      expect(counters.some((c) => Math.abs(c.root.position.x - (weapon?.root.position.x ?? 0)) < 0.01), id).toBe(true)
    }
  })

  it('stands the M134 on its tripod apart from the counters, asleep, one mesh per material, and takes the gun from it', () => {
    const { room } = roomWithWeapons()
    const placed = room.openArea('weapons_area')
    const mounted = placed.find((o) => o.itemId === MOUNTED_M134_ITEM_ID)
    expect(mounted).toBeDefined()
    const before = mounted?.root.position.clone() ?? new THREE.Vector3()
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(mounted?.root.position.distanceTo(before)).toBeLessThan(0.01)
    const meshes: THREE.Mesh[] = []
    mounted?.root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
    })
    expect(meshes.length).toBeGreaterThan(0)
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(meshes.length)
    expect(meshes.length).toBeLessThanOrEqual(12)
    expect(placed.filter((o) => o.itemId.startsWith(WEAPON_ITEM_PREFIX)).some((o) => o.itemId === MOUNTED_M134_ITEM_ID)).toBe(false)
  })
})
