import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { COUNTER_ITEM_ID, createWeaponsTestModule, WEAPON_ITEM_PREFIX } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function roomWithWeapons(): { room: TestRoom; module: ReturnType<typeof createWeaponsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'pt-BR', catalog: demoItems('pt-BR'), renderer: stubRenderer(), ui: false })
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
    expect(weapons.length).toBe([...room.arsenal.weapons.keys()].filter((id) => !['hand', 'kick', 'shove', 'fists'].includes(id)).length)
    expect(placed.filter((o) => o.itemId === COUNTER_ITEM_ID).length).toBe(3)
    expect(placed.some((o) => o.itemId === 'target_steel_plate')).toBe(true)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(Math.min(...weapons.map((o) => o.root.position.y))).toBeGreaterThan(0.85)
  })

  it('shows the equipped weapon in the hands and ejects one casing per shot', () => {
    const { room, module } = roomWithWeapons()
    room.setTool('pistol_9mm')
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
    fireUntilEmpty(room)
    expect(module.fx?.casings).toBe(0)
    room.use()
    room.update(0.1)
    expect(module.fx?.casings).toBe(6)
    expect(module.fx?.magazines).toBe(0)
  })
})
