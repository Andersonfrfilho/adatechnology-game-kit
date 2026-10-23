import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { HostEvent, ModuleHost, TestableModule } from '@adatechnology/game-contracts'
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
