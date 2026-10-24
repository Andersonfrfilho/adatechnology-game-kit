import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { describe, expect, it } from 'vitest'

import { CELL, CROWD_DEFAULTS, STATE, createCrowd, createDoors, createNavGrid, createRng } from '../src'
import type { CrowdPack, CrowdTarget, CrowdType } from '../src'

const pack = undeadCrowdPack() as unknown as CrowdPack

const makeTarget = (x = 0, z = 0) => {
  const log: string[] = []
  const target: CrowdTarget = {
    state: { x, z, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 },
    grab(by) {
      target.state.grabbedBy = by
      log.push(`grab:${by}`)
    },
    hurt(amount) {
      log.push(`hurt:${amount}`)
    },
    knock(seconds) {
      log.push(`knock:${seconds}`)
    },
    release() {
      target.state.grabbedBy = -1
      log.push('release')
    },
  }
  return { target, log }
}

describe('grid and doors', () => {
  it('blocks walls, lets open doors through and sees over low walls', () => {
    const grid = createNavGrid({ size: 64, border: false })
    grid.fillRect(-1, -10, 1, 10, CELL.SOLID, 3)
    expect(grid.blocked(0, 0)).toBe(true)
    expect(grid.blocked(5, 0)).toBe(false)
    expect(grid.losClear(-5, 0, 5, 0)).toBe(false)
    grid.fillRect(-1, -10, 1, 10, CELL.LOW_WALL, 1)
    expect(grid.losClear(-5, 0, 5, 0)).toBe(true)
  })

  it('a door takes blows, sheds planks and breaks open with a noise', () => {
    const grid = createNavGrid({ size: 64, border: false })
    const doors = createDoors(grid, { random: createRng(3) })
    const events: string[] = []
    doors.on('noise', () => events.push('noise'))
    doors.on('broken', () => events.push('broken'))
    const d = doors.add(0, 0, 'x', 1.2)
    expect(grid.cellKind(0, 0)).toBe(CELL.CLOSED_DOOR)
    doors.plank(d)
    expect(doors.list[d]!.hp).toBe(450)
    for (let k = 0; k < 15; k++) doors.hit(d, 30)
    expect(doors.list[d]!.broken).toBe(true)
    expect(grid.cellKind(0, 0)).toBe(CELL.OPEN_DOOR)
    expect(events).toEqual(['noise', 'broken'])
  })
})

describe('createCrowd', () => {
  it('starts from the game numbers, every one overridable', () => {
    expect(CROWD_DEFAULTS.numbers.attackSlots).toBe(6)
    expect(CROWD_DEFAULTS.bands.map((b) => b.max)).toEqual([35, 120, 400, Infinity])
    const crowd = createCrowd({ pack, seed: 1, capacity: 10, numbers: { attackSlots: 2 } })
    expect(crowd.numbers.attackSlots).toBe(2)
    expect(crowd.numbers.loseAfter).toBe(15)
  })

  it('is deterministic for a seed', () => {
    const run = () => {
      const { target } = makeTarget()
      const crowd = createCrowd({ pack, seed: 9, capacity: 40, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 }, target })
      for (let k = 0; k < 20; k++) crowd.spawn(Math.cos(k) * 12, Math.sin(k) * 12)
      for (let f = 0; f < 120; f++) crowd.update(1 / 30)
      return Array.from(crowd.store.x.slice(0, 20))
    }
    expect(run()).toEqual(run())
  })

  it('walks in the normal world: with no target nobody chases, agents wander and pause', () => {
    const crowd = createCrowd({ pack, seed: 4, capacity: 20, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 } })
    for (let k = 0; k < 10; k++) crowd.spawn(k * 3 - 15, 0, 0)
    const x0 = Array.from(crowd.store.x.slice(0, 10))
    for (let f = 0; f < 300; f++) crowd.update(1 / 30)
    expect(Array.from(crowd.store.state.slice(0, 10)).every((s) => s === STATE.WANDER)).toBe(true)
    expect(Array.from(crowd.store.x.slice(0, 10)).some((x, i) => Math.abs(x - x0[i]!) > 0.5)).toBe(true)
  })

  it('a hunting crowd perceives the target, chases, takes the attack slots and grabs', () => {
    const { target, log } = makeTarget()
    const crowd = createCrowd({ pack, seed: 2, capacity: 20, grid: createNavGrid({ size: 128 }), flow: { clock: () => 0 }, target })
    for (let k = 0; k < 8; k++) crowd.spawn(Math.cos(k) * 6, Math.sin(k) * 6, 0)
    for (let f = 0; f < 400; f++) crowd.update(1 / 30)
    expect(Array.from(crowd.store.state.slice(0, 8)).some((s) => s === STATE.CHASE || s === STATE.GRAB)).toBe(true)
    expect(log.some((line) => line.startsWith('hurt') || line.startsWith('grab'))).toBe(true)
    expect(crowd.stats.slots).toBeLessThanOrEqual(6)
  })

  it('a headshot kills, leaves a corpse and frees the grabbed target', () => {
    const { target, log } = makeTarget()
    const crowd = createCrowd({ pack, seed: 5, capacity: 4, target })
    const i = crowd.spawn(0, 0.5, 0)
    target.grab(i)
    const result = crowd.damage(i, { region: 0, amount: 35, distance: 3, caliber: { id: '9x19', class: 'pistol', skull: 1 } })
    expect(result).toEqual({ died: true, headshot: true })
    expect(crowd.store.n).toBe(0)
    expect(crowd.corpses.count).toBe(1)
    expect(log).toContain('release')
  })

  it('a type without traits never uses a special move, and a plugin adds one', () => {
    const calm: CrowdType = { id: 'calm', weight: 1, health: 50, speed: { wander: 1, chase: 2 }, damage: 1, bite: 0, multipliers: { head: 1, torso: 1, arms: 1, legs: 1 }, perception: { sight: 0, hearing: 0, smell: 0 }, traits: {} }
    const calls: number[] = []
    const crowd = createCrowd({
      pack: { ...pack, types: [calm] },
      seed: 3,
      capacity: 4,
      grid: createNavGrid({ size: 64 }),
      flow: { clock: () => 0 },
      plugins: [{ id: 'freeze', ability: (_crowd, i) => (calls.push(i), true) }],
    })
    crowd.spawn(0, 0)
    for (let f = 0; f < 30; f++) crowd.update(1 / 30)
    expect(calls.length).toBeGreaterThan(0)
  })

  it('gives game-player the crowd interface', () => {
    const crowd = createCrowd({ pack, seed: 1, capacity: 4 })
    const i = crowd.spawn(1, 1, crowd.typeIndex('runner'))
    const view = crowd.asPlayerCrowd()
    expect(view.count()).toBe(1)
    expect(view.panicWeight(i)).toBe(2.5)
    view.stun(i, 0.5, 1, 0)
    expect(crowd.store.state[i]).toBe(STATE.STUNNED)
    view.chase(i, 1)
    expect(view.chasing(i)).toBe(true)
  })

  it('refills toward the population target away from the view and sends a migration', () => {
    const messages: string[] = []
    const crowd = createCrowd({ pack, seed: 8, capacity: 200, numbers: { migrationFirst: 1 } })
    crowd.on('message', (e) => messages.push(e.id))
    const view = { x: 0, z: 0, yaw: 0, far: 150 }
    crowd.updatePopulation(0.5, view, { target: 30, migration: { every: 90, count: 20, x: 50, z: 50, width: 4, depth: 4, goal: [0, 0] } })
    expect(crowd.store.n).toBe(20)
    crowd.updatePopulation(0.6, view, { target: 30, migration: { every: 90, count: 20, x: 50, z: 50, width: 4, depth: 4, goal: [0, 0] } })
    expect(crowd.store.n).toBe(50)
    expect(messages).toEqual(['migration'])
  })
})
