import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { HostEvent, ModuleHost, TestableModule } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

const board = (name: string, size: [number, number, number]): DestructibleSpec => ({
  name,
  parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size }, position: [0, size[1] / 2, 0], anchored: name === 'bench' }],
  joints: [],
})
const mesh = (size: [number, number, number]) => (T: unknown) => {
  const three = T as typeof THREE
  const m = new three.Mesh(new three.BoxGeometry(...size), new three.MeshStandardMaterial())
  m.name = 'body'
  m.position.y = size[1] / 2
  const g = new three.Group()
  g.add(m)
  return g
}

// a module of nothing in particular: a bench to lay things on and long sticks laid side by side across it
function benchModule(onAttach?: (host: ModuleHost) => void): TestableModule<ScenarioContext> {
  const sticks = ['a', 'b', 'c', 'd', 'e']
  return {
    id: 'bench_module',
    name: 'Bench module',
    group: 'Bench',
    items: () => [
      { id: 'bench', name: 'Bench', build: mesh([1.6, 0.9, 4]), spec: board('bench', [1.6, 0.9, 4]), movable: false },
      ...sticks.map((s) => ({ id: `stick_${s}`, name: `Stick ${s}`, build: mesh([1.1, 0.05, 0.08]), spec: board(`stick ${s}`, [1.1, 0.05, 0.08]), movable: true })),
    ],
    area: () => ({
      placements: [
        ...sticks.map((s, i) => ({ item: `stick_${s}`, position: [-8, 0.91, -1.6 + i * 0.3] as [number, number, number], asleep: true })),
        { item: 'bench', position: [-8, 0, -1], surface: { halfSize: [0.8, 2], height: 0.9 } },
      ],
      view: { eye: [-4, 1.7, 2], target: [-8, 0.9, -1] },
    }),
    attach(host) {
      onAttach?.(host)
      return () => undefined
    },
  }
}

describe('areas', () => {
  it('a group without a module area is laid in rows, and only its items', () => {
    const room = makeRoom()
    room.spawn('chair', [0, 0, -3])
    const placed = room.openArea('containers')
    expect(placed.map((o) => o.itemId).sort()).toEqual(['gas_bottle', 'jerrycan', 'plastic_bucket', 'steel_drum', 'wooden_crate'])
    expect(room.spawned().some((o) => o.itemId === 'chair')).toBe(false)
  })

  it('a module area lays its holders first and what goes on them stays on their top, asleep side by side', () => {
    const room = makeRoom()
    room.loadModule(benchModule())
    const placed = room.openArea('bench_module')
    expect(placed[0].itemId).toBe('bench')
    const sticks = placed.filter((o) => o.itemId.startsWith('stick_'))
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(Math.min(...sticks.map((o) => o.root.position.y))).toBeGreaterThan(0.85)
  })
})

describe('module host', () => {
  it('configureTool sets the wear and the ammunition of the tool in hand and of the ones taken later', () => {
    const room = makeRoom()
    let lent: ModuleHost | null = null
    room.loadModule(benchModule((host) => (lent = host)))
    room.setTool('pistol_9mm')
    lent!.configureTool?.({ condition: 'rusty', ammo_quality: 'reloaded' })
    expect(room.tool.condition).toBe('rusty')
    expect(room.tool.ammoQuality).toBe('reloaded')
    room.setTool('rifle_5_56')
    expect(room.tool.condition).toBe('rusty')
    expect(room.tool.ammoQuality).toBe('reloaded')
  })

  it('command fits, toggles and removes accessories of the tool in hand, folds the stock and switches the launcher, and the tool tells what is on it', () => {
    const room = makeRoom()
    const events: HostEvent[] = []
    let lent: ModuleHost | null = null
    room.loadModule(benchModule((host) => (lent = host)))
    lent!.on((event) => events.push(event))
    room.setTool('colt_m4a1')
    for (let i = 0; i < 60; i++) room.update(0.02)
    expect(lent!.tool().attachments?.map((part) => part.id)).toContain('acog_4x')
    expect(lent!.tool().stock).toBe('extended')
    expect(lent!.command?.({ type: 'fit', attachment: 'suppressor', mount: 'muzzle' })).toEqual({ ok: true, seconds: 15 })
    expect(lent!.command?.({ type: 'remove', attachment: 'acog_4x' })).toEqual({ ok: false, reason: 'busy' })
    for (let i = 0; i < 800; i++) room.update(0.02)
    expect(lent!.tool().suppressed).toBe(true)
    expect(lent!.tool().mass).toBeGreaterThan(room.arsenal.weapons.get('colt_m4a1')!.mass)
    expect(events.find((event) => event.type === 'attachment')).toMatchObject({ action: 'fit', attachment: 'suppressor', mount: 'muzzle', duration: 15 })
    expect(lent!.command?.({ type: 'fit', attachment: 'weapon_light' })).toMatchObject({ ok: true })
    for (let i = 0; i < 200; i++) room.update(0.02)
    expect(lent!.command?.({ type: 'toggle', attachment: 'weapon_light' })).toEqual({ ok: true })
    expect(lent!.tool().attachments?.find((part) => part.id === 'weapon_light')?.on).toBe(true)
    expect(events.find((event) => event.type === 'toggle')).toMatchObject({ attachment: 'weapon_light', on: true })
    expect(lent!.command?.({ type: 'toggle', attachment: 'laser_sight' })).toEqual({ ok: false, reason: 'not_fitted' })
    expect(lent!.command?.({ type: 'fit', attachment: 'gp_25' })).toEqual({ ok: false, reason: 'interface' })
    expect(lent!.command?.({ type: 'stock', state: 'collapsed' })).toEqual({ ok: true })
    for (let i = 0; i < 60; i++) room.update(0.02)
    expect(lent!.tool().stock).toBe('collapsed')
    expect(lent!.command?.({ type: 'stance', aiming: true })).toEqual({ ok: true })
    expect(lent!.command?.({ type: 'underbarrel', on: true })).toEqual({ ok: false, reason: 'busy' })
    room.setTool('glock_17')
    expect(lent!.command?.({ type: 'stock', state: 'collapsed' })).toEqual({ ok: false, reason: 'busy' })
  })

  it('a suppressed shot reaches the module with the flag', () => {
    const room = makeRoom()
    const events: HostEvent[] = []
    let lent: ModuleHost | null = null
    room.loadModule(benchModule((host) => (lent = host)))
    lent!.on((event) => events.push(event))
    room.setTool('colt_m4a1')
    for (let i = 0; i < 60; i++) room.update(0.02)
    lent!.command?.({ type: 'fit', attachment: 'suppressor', mount: 'muzzle' })
    for (let i = 0; i < 800; i++) room.update(0.02)
    room.use()
    for (let i = 0; i < 20; i++) room.update(0.02)
    expect(events.find((event) => event.type === 'shot')).toMatchObject({ suppressed: true })
  })

  it('lends the scene and the camera and reports the tool events', () => {
    const room = makeRoom()
    const events: HostEvent[] = []
    let frames = 0
    let lent: ModuleHost | null = null
    room.loadModule(
      benchModule((host) => {
        lent = host
        host.on((e) => events.push(e))
        host.onFrame(() => frames++)
      }),
    )
    expect(lent).not.toBeNull()
    expect(lent!.scene).toBeInstanceOf(THREE.Scene)
    room.setTool('pistol_9mm')
    room.update(0.4)
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.use()
    while (room.tool.ammo > 0) {
      room.update(0.3)
      room.use()
    }
    room.update(0.3)
    room.use()
    for (let i = 0; i < 40; i++) room.update(0.25)
    const types = events.map((e) => (e.type === 'reload' ? `reload_${e.phase}` : e.type))
    expect(types[0]).toBe('tool')
    expect(types).toContain('shot')
    expect(types).toContain('empty')
    expect(types.indexOf('reload_start')).toBeGreaterThan(types.indexOf('empty'))
    expect(types.indexOf('reload_end')).toBeGreaterThan(types.indexOf('reload_start'))
    expect(frames).toBeGreaterThan(40)
    expect(lent!.tool().weapon).toBe('pistol_9mm')
  })
})

describe('tool cycle events', () => {
  const recording = (): { room: ReturnType<typeof makeRoom>; events: HostEvent[] } => {
    const room = makeRoom()
    const events: HostEvent[] = []
    room.loadModule(benchModule((host) => host.on((e) => events.push(e))))
    room.look([0, 1.7, 5], [0, 1.2, -11])
    return { room, events }
  }

  it('Q reports the new mode, and a burst spends three rounds in that mode', () => {
    const { room, events } = recording()
    room.setTool('rifle_5_56')
    room.update(0.4)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    expect(events.find((e) => e.type === 'mode')).toEqual({ type: 'mode', weapon: 'rifle_5_56', mode: 'burst' })
    room.use()
    const shot = events.find((e) => e.type === 'shot')
    expect(shot).toMatchObject({ type: 'shot', weapon: 'rifle_5_56', shots: 3, rounds: 3, mode: 'burst' })
    room.dispose()
  })

  it('a shotgun shell is many projectiles and one round', () => {
    const { room, events } = recording()
    room.setTool('shotgun_pump_12')
    room.update(0.4)
    room.use()
    const shot = events.find((e) => e.type === 'shot')
    expect(shot?.type === 'shot' && shot.shots).toBeGreaterThan(1)
    expect(shot).toMatchObject({ rounds: 1 })
    room.dispose()
  })

  it('a manual action reports its cycle with the seconds the rule gave, and a reload its kind, duration, stages and rounds', () => {
    const { room, events } = recording()
    room.setTool('remington_870')
    room.update(0.4)
    room.use()
    const cycle = events.find((e) => e.type === 'cycle' && e.phase === 'start')
    expect(cycle).toMatchObject({ type: 'cycle', weapon: 'remington_870' })
    expect(cycle?.type === 'cycle' && cycle.duration).toBeGreaterThan(0)
    for (let i = 0; i < 20; i++) room.update(0.1)
    expect(events.some((e) => e.type === 'cycle' && e.phase === 'end')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    const reload = events.find((e) => e.type === 'reload' && e.phase === 'start')
    expect(reload?.type === 'reload' && reload.kind).toBe('one_by_one')
    expect(reload?.type === 'reload' && reload.duration).toBeGreaterThan(0)
    for (let i = 0; i < 80; i++) room.update(0.1)
    expect(events.some((e) => e.type === 'feed')).toBe(true)
    room.dispose()
  })

  it('picking up a tool starts its draw: the host hears the seconds, and the trigger waits them out', () => {
    const { room, events } = recording()
    room.setTool('glock_17')
    const tool = events.find((e) => e.type === 'tool' && e.weapon === 'glock_17')
    expect(tool).toMatchObject({ type: 'tool', weapon: 'glock_17', duration: 0.35 })
    const before = events.filter((e) => e.type === 'shot').length
    room.use()
    expect(events.filter((e) => e.type === 'shot').length).toBe(before)
    room.update(0.4)
    room.use()
    expect(events.filter((e) => e.type === 'shot').length).toBe(before + 1)
    room.dispose()
  })

  it('X clears the jam the weapon stopped with, taking the seconds of the rule, and B turns the safety on and off', () => {
    const room = makeRoom({ arsenal: createArsenal({ seed: 1, rules: { faultChance: () => 1 } }) })
    const events: HostEvent[] = []
    room.loadModule(benchModule((host) => host.on((e) => events.push(e))))
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.setTool('glock_17')
    room.update(0.4)
    room.use()
    expect(events.some((e) => e.type === 'fault')).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }))
    const clear = events.find((e) => e.type === 'clear' && e.phase === 'start')
    expect(clear).toMatchObject({ type: 'clear', weapon: 'glock_17', duration: 1.2 })
    room.update(1.3)
    expect(events.some((e) => e.type === 'clear' && e.phase === 'end')).toBe(true)
    room.tool.setCondition('new')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    expect(events.filter((e) => e.type === 'safety').map((e) => e.type === 'safety' && e.on)).toEqual([true])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    expect(events.filter((e) => e.type === 'safety').map((e) => e.type === 'safety' && e.on)).toEqual([true, false])
    room.dispose()
  })
})

describe('clearing', () => {
  it('tells the modules that follow it when the area is cleared, and stops after the unsubscribe', () => {
    const room = makeRoom()
    let cleared = 0
    let stop: (() => void) | undefined
    room.loadModule(benchModule((host) => { stop = host.onClear?.(() => cleared++) }))
    room.clear()
    expect(cleared).toBe(1)
    room.openArea('bench_module')
    expect(cleared).toBe(2)
    stop?.()
    room.clear()
    expect(cleared).toBe(2)
    room.dispose()
  })
})

describe('blockers', () => {
  it('a module can keep the walking player out of a place, and take it away', () => {
    const room = makeRoom()
    let remove: (() => void) | undefined
    room.loadModule(benchModule((host) => { remove = host.addBlocker?.((x, z) => x > 0.8 && x < 1.2 && z > -2 && z < 6) }))
    expect(remove).toBeTypeOf('function')
    room.look([0, 1.6, 4], [1, 1.6, 4])
    // the walk ends on a point inside the blocked place: the player stops at its edge
    room.walk([1, 0, 4], 2)
    for (let i = 0; i < 40; i++) room.update(0.05)
    expect(room.camera.position.x).toBeLessThan(0.9)
    remove?.()
    room.look([0, 1.6, 4], [1, 1.6, 4])
    room.walk([2, 0, 4], 2)
    for (let i = 0; i < 40; i++) room.update(0.05)
    expect(room.camera.position.x).toBeGreaterThan(1.8)
    room.dispose()
  })
})
