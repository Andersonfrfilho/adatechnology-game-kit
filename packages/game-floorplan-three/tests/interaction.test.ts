import * as GameVegetation from '@adatechnology/game-vegetation'
import * as GameVegetationThree from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { en, ptBR } from '../src'
import { houseOf, planOf } from './helpers/houses'

// The fourth slice: what the player does in the house (doors, lights, collision, prompts), the furniture map and the bridges that get their
// packages injected (interactables, vegetation).
afterEach(() => { vi.restoreAllMocks() })

/** An eye one metre in front of a door of the ground floor, looking at it. */
function facing(house: any) {
  const door = house.doors.find((d: any) => d.floor === 0)
  return { door, eye: { x: door.cx, y: 1.6, z: door.cz - 0.9, floor: 0, yaw: 0, pitch: 0 } }
}

describe('doors', () => {
  const plan = planOf('casaA', 3)

  it('names the door to open in the language of the house', () => {
    for (const [locale, open, close] of [['en', 'E: open the door', 'E: close the door'], ['pt-BR', 'E: abrir a porta', 'E: fechar a porta']] as const) {
      const { house } = houseOf(plan, { locale })
      const { eye } = facing(house)
      expect(house.target(eye).text).toBe(open)
      house.interact(eye)
      for (let i = 0; i < 4; i++) house.update(1, 1000 * (i + 1))
      expect(house.target(eye).text).toBe(close)
    }
  })

  it('opens a door by id, takes its collider away while open and closes it again', () => {
    const { house } = houseOf(plan)
    const { door } = facing(house)
    expect(door.open).toBe(false)
    expect(door.col.off).toBeFalsy()
    house.toggleDoor(door.id)
    expect(door.open).toBe(true)
    expect(door.col.off).toBe(true)
    for (let i = 0; i < 4; i++) house.update(1, 1000 * (i + 1))
    house.toggleDoor(door)
    expect(door.open).toBe(false)
    expect(door.col.off).toBe(false)
  })

  it('swings the leaf while time passes and keeps the state across a rebuild with the same state', () => {
    const state = houseOf(plan).renderer.newState()
    const first = houseOf(plan, {}, { state }).house
    first.toggleDoor(first.doors[0].id)
    const again = houseOf(plan, {}, { state }).house
    expect(again.doors[0].open).toBe(first.doors[0].open)
  })

  it('rattles a locked door and says so', () => {
    const { house } = houseOf(plan, { locale: 'pt-BR' })
    const { door } = facing(house)
    door.locked = true
    house.toggleDoor(door)
    expect(door.open).toBe(false)
    expect(door.phase).toBe('rattle')
    expect(house.message()).toBe(ptBR['message.locked'])
  })

  it('answers nothing when there is nothing to act on', () => {
    const { house } = houseOf(plan)
    expect(house.target({ x: -30, y: 1.6, z: -30, floor: 0, yaw: 0, pitch: 0 })).toBeNull()
    expect(house.interact({ x: -30, y: 1.6, z: -30, floor: 0, yaw: 0, pitch: 0 })).toBe(false)
  })
})

describe('lights and rooms', () => {
  const plan = planOf('casaA', 3)

  it('switches the lamps of a room', () => {
    const { house } = houseOf(plan, {}, { night: true })
    const room = house.lights.list[0].roomId
    expect(house.lightOn(room)).toBe(true)
    house.toggleLight(room)
    expect(house.lightOn(room)).toBe(false)
    house.toggleLight(room)
    expect(house.lightOn(room)).toBe(true)
  })

  it('says in which room a point is, on which floor', () => {
    const { house } = houseOf(plan)
    expect(house.roomAt(0, 3, 2)?.id).toBe('living')
    expect(house.roomAt(0, -50, -50)).toBeNull()
    expect(house.y0(0)).toBe(0)
  })
})

describe('collision', () => {
  const plan = planOf('casaA', 3)
  const { house } = houseOf(plan)

  it('stops at walls and furniture and lets the open air and an open door through', () => {
    const wall = house.colliders.find((c: any) => c.type === 'wall')
    expect(house.collide((wall.x0 + wall.x1) / 2, (wall.z0 + wall.z1) / 2, wall.f)).toBe(true)
    const piece = house.colliders.find((c: any) => c.type === 'furniture')
    expect(house.collide(piece.obb.cx, piece.obb.cz, piece.f)).toBe(true)
    const free = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].flatMap((x) => [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((z): [number, number] => [x, z])).find(([x, z]) => house.roomAt(0, x, z) && !house.collide(x, z, 0))
    expect(free).toBeTruthy()
    expect(house.collide(-30, -30, 0)).toBe(false)
    const { door } = facing(house)
    expect(house.collide(door.cx, door.cz, 0)).toBe(true) // the closed door
    house.toggleDoor(door)
    expect(house.collide(door.cx, door.cz, 0)).toBe(false) // the gap of the open one
    house.toggleDoor(door)
  })

  it('takes the radius of the walker', () => {
    const wall = house.colliders.find((c: any) => c.type === 'wall')
    const x = (wall.x0 + wall.x1) / 2, z = wall.z1 + 0.3
    expect(house.collide(x, z, wall.f, { radius: 0.1 })).toBe(false)
    expect(house.collide(x, z, wall.f, { radius: 0.5 })).toBe(true)
  })
})

describe('level of detail by distance', () => {
  const plan = planOf('casaA', 3)

  it('simplifies the interior from 45 m and hides the house from 220 m, and comes back', () => {
    const { house } = houseOf(plan)
    house.update(0.016, 0, { x: 300, y: 1, z: 300 })
    expect(house.lod).toBe(2)
    expect(house.group.visible).toBe(false)
    house.update(0.016, 0, { x: 100, y: 1, z: 0 })
    expect(house.lod).toBe(1)
    house.update(0.016, 0, { x: 3, y: 1, z: 3 })
    expect(house.lod).toBe(0)
    expect(house.group.visible).toBe(true)
  })

  it('takes the distances from the options and can switch them off', () => {
    const near = houseOf(plan, { lod: { interior: 5, hide: 20 } }).house
    near.update(0.016, 0, { x: 30, y: 1, z: 30 })
    expect(near.lod).toBe(2)
    const off = houseOf(plan, { lod: false }).house
    off.update(0.016, 0, { x: 300, y: 1, z: 300 })
    expect(off.lod).toBe(0)
  })
})

describe('the furniture map', () => {
  const plan = planOf('sobrado', 3)

  it('has a builder for every type of item the plan places, except the stairs (their own module)', () => {
    const { renderer } = houseOf(plan)
    const types = new Set<string>(plan.items.map((i: any) => i.type))
    expect([...types].filter((t) => !renderer.types[t])).toEqual(['stairs'])
    for (const entry of Object.values<any>(renderer.types)) expect(typeof entry.f).toBe('function')
  })

  it('says where each builder comes from', () => {
    const { renderer } = houseOf(plan)
    const sources = new Set(Object.values<any>(renderer.types).map((entry) => entry.source).filter((source) => source !== undefined))
    expect(sources.has('props3d')).toBe(true)
    expect([...sources].every((source) => /^(game|props3d)/.test(source))).toBe(true)
    expect(renderer.types.fountain.source).toBe('game')
    expect(renderer.types.breakfast_bar.source).toBe('props3d (alias of breakfast_bar)')
  })
})

describe('bridges that get their packages injected', () => {
  const plan = planOf('sobrado', 3)

  it('warns once, in the language of the house, when the interactables are incomplete, and draws the plain furniture', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { house } = houseOf(plan, { interactives: {}, locale: 'pt-BR' })
    expect(warn).toHaveBeenCalledWith(ptBR['warn.interactablesIncomplete'])
    expect(house.interactives).toBeNull()
    houseOf(plan, { interactives: {} })
    expect(warn).toHaveBeenCalledWith(en['warn.interactablesIncomplete'])
  })

  it('draws no vegetation package without one, and the props keep their plants', () => {
    const { house } = houseOf(plan)
    expect(house.vegetation).toBeNull()
  })

  it('plants the garden with the vegetation package it is given, one merged object per group', () => {
    const vegetation = { GameVegetation: { ...GameVegetation, ...GameVegetationThree }, GameVegetationSpecies }
    const { house } = houseOf(plan, { vegetation })
    expect(house.vegetation.plants).toBeGreaterThan(5)
    expect(house.vegetation.triangles).toBeGreaterThan(1000)
    expect(house.vegetation.colliders.length).toBeGreaterThan(0)
    const objects: any[] = []
    house.group.traverse((o: any) => { if (o.name === 'vegetation') objects.push(o) })
    expect(objects.length).toBeGreaterThan(0)
    expect(new Set(objects.map((o) => o.parent.name || o.parent.userData.group)).size).toBeGreaterThan(0)
    const meshes: string[] = []
    objects[0].traverse((o: any) => { if (o.isMesh) meshes.push(o.name) })
    expect(meshes.every((n) => n.startsWith('veg/'))).toBe(true)
    house.update(0.016, 100, { x: 3, y: 1.6, z: 3 })
  })

  it('draws the same plants for the same seed', () => {
    const vegetation = { GameVegetation: { ...GameVegetation, ...GameVegetationThree }, GameVegetationSpecies }
    const a = houseOf(plan, { vegetation }).house.vegetation
    const b = houseOf(plan, { vegetation }).house.vegetation
    expect({ plants: a.plants, triangles: a.triangles, lodCounts: a.lodCounts }).toEqual({ plants: b.plants, triangles: b.triangles, lodCounts: b.lodCounts })
  })
})
