import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { NAV_OBSTACLE_KIND } from '@adatechnology/game-contracts'
import type { NavObstacle, NavObstacleBox, NavObstacleSource } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { CELL, STATE, bindNavObstacles, createCrowd, createNavGrid } from '../src'
import type { Crowd, CrowdPack, CrowdTarget } from '../src'

// The horde and the obstacles an SDK publishes (a house: its walls, a door, a lot wall): nobody walks through a wall; the door is the way in, closed it is hit until it breaks.
const pack = undeadCrowdPack() as unknown as CrowdPack
const STEP = 1 / 30
const WALL_HEIGHT = 2.8
const HALF_SIDE = 5
const THICKNESS = 0.2
const DOOR_HALF_WIDTH = 0.6

const box = (x0: number, z0: number, x1: number, z1: number, height = WALL_HEIGHT): NavObstacleBox => ({ rect: [x0, z0, x1, z1], height })
const solid = (id: string, boxes: readonly NavObstacleBox[]): NavObstacle => ({ id, kind: NAV_OBSTACLE_KIND.SOLID, boxes, open: false, boards: 0 })

/** A closed room of 10 m round the origin, its only way in a door in the south wall (z = +5). */
function roomSource(options: { readonly open: boolean }) {
  const s = HALF_SIDE
  const t = THICKNESS / 2
  const list: NavObstacle[] = [
    solid('north', [box(-s, -s - t, s, -s + t)]),
    solid('west', [box(-s - t, -s, -s + t, s)]),
    solid('east', [box(s - t, -s, s + t, s)]),
    solid('south-left', [box(-s, s - t, -DOOR_HALF_WIDTH, s + t)]),
    solid('south-right', [box(DOOR_HALF_WIDTH, s - t, s, s + t)]),
    { id: 'door', kind: NAV_OBSTACLE_KIND.DOOR, boxes: [box(-DOOR_HALF_WIDTH, s - t, DOOR_HALF_WIDTH, s + t, 2.1)], open: options.open, boards: 0 },
  ]
  const pending: NavObstacle[] = []
  const broken: string[] = []
  const source: NavObstacleSource = {
    obstacles: () => list,
    changes: () => pending.splice(0),
    breakDoor: (id) => {
      broken.push(id)
      const at = list.findIndex((obstacle) => obstacle.id === id)
      list[at] = { ...list[at]!, open: true }
      pending.push(list[at]!)
    },
  }
  const change = (obstacle: NavObstacle): void => {
    list[list.findIndex((other) => other.id === obstacle.id)] = obstacle
    pending.push(obstacle)
  }
  return { source, broken, change }
}

const makeTarget = (x: number, z: number): CrowdTarget => {
  const target: CrowdTarget = {
    state: { x, z, y: 0, floor: 0, alive: true, turned: false, crouch: false, bleeding: 0, scentTimer: 0, screamBoost: 0, grabbedBy: -1, blind: 0, burnTimer: 0, yaw: 0 },
    grab: () => undefined,
    hurt: () => undefined,
    knock: () => undefined,
    release: () => undefined,
  }
  return target
}

const isWandering = (crowd: Crowd, i: number): boolean => crowd.store.hp[i]! > 0 && (crowd.store.state[i] === STATE.WANDER || crowd.store.state[i] === STATE.SEEKING_SOUND)

const isInside = (crowd: Crowd, i: number): boolean => Math.abs(crowd.store.x[i]!) < HALF_SIDE - THICKNESS && Math.abs(crowd.store.z[i]!) < HALF_SIDE - THICKNESS

/** A horde north of the room, the target inside it making noise: every step checks no agent stands on a wall cell. */
function hunt(options: { readonly open: boolean; readonly seconds: number; readonly onStep?: (step: number, crowd: Crowd) => void }) {
  const grid = createNavGrid({ size: 64, border: false })
  const target = makeTarget(0, 0)
  const crowd = createCrowd({ pack, seed: 7, capacity: 32, grid, flow: { clock: () => 0 }, target })
  const room = roomSource({ open: options.open })
  const binding = bindNavObstacles(crowd, room.source)
  for (let k = 0; k < 12; k++) crowd.spawn(-6 + k, -12 - (k % 3))
  let onWall = 0
  let firstInside = -1
  const steps = Math.round(options.seconds / STEP)
  for (let step = 0; step < steps; step++) {
    binding.sync()
    crowd.emitNoise(0, 0, 40)
    for (let i = 0; i < crowd.store.n; i++) if (isWandering(crowd, i)) crowd.asPlayerCrowd().chase(i, 0.5)
    crowd.update(STEP)
    options.onStep?.(step, crowd)
    for (let i = 0; i < crowd.store.n; i++) {
      if (!(crowd.store.hp[i]! > 0)) continue
      const kind = grid.cellKind(crowd.store.x[i]!, crowd.store.z[i]!)
      if (kind === CELL.SOLID) onWall++
      if (firstInside < 0 && isInside(crowd, i)) firstInside = step
    }
  }
  return { crowd, grid, binding, room, onWall, firstInside }
}

describe('the horde and the obstacles of a house (bindNavObstacles)', () => {
  it('writes walls as solid cells and the door as a crowd door', () => {
    const grid = createNavGrid({ size: 64, border: false })
    const crowd = createCrowd({ pack, seed: 1, capacity: 4, grid })
    const binding = bindNavObstacles(crowd, roomSource({ open: false }).source)
    expect(grid.cellKind(0, -HALF_SIDE)).toBe(CELL.SOLID)
    expect(grid.cellKind(-HALF_SIDE, 0)).toBe(CELL.SOLID)
    expect(grid.cellKind(0, HALF_SIDE)).toBe(CELL.CLOSED_DOOR)
    expect(binding.doorOf('door')).toBe(0)
    expect(grid.cellKind(0, 0)).toBe(CELL.FREE)
  })

  it('an agent heading to a target behind a wall never stands on a wall cell, and finds the open door', () => {
    const result = hunt({ open: true, seconds: 40 })
    expect(result.onWall).toBe(0)
    expect(result.firstInside).toBeGreaterThan(0)
  })

  it('a closed door holds them until they break it; then they come in and the source is told', () => {
    let insideWhileClosed = 0
    const result = hunt({
      open: false,
      seconds: 90,
      onStep: (_step, crowd) => {
        const door = crowd.doors.list[0]!
        if (door.broken) return
        for (let i = 0; i < crowd.store.n; i++) if (crowd.store.hp[i]! > 0 && isInside(crowd, i)) insideWhileClosed++
      },
    })
    expect(result.onWall).toBe(0)
    expect(insideWhileClosed).toBe(0)
    expect(result.crowd.doors.list[0]!.broken).toBe(true)
    expect(result.room.broken).toEqual(['door'])
    expect(result.firstInside).toBeGreaterThan(0)
  })

  it('a blast hole in a wall becomes passable, and a stub of wall a low wall', () => {
    const grid = createNavGrid({ size: 64, border: false })
    const crowd = createCrowd({ pack, seed: 1, capacity: 4, grid })
    const room = roomSource({ open: false })
    const binding = bindNavObstacles(crowd, room.source)
    const t = THICKNESS / 2
    // what stands of the north wall: its two ends, a stub of 0.4 m between them
    room.change(solid('north', [box(-HALF_SIDE, -HALF_SIDE - t, -2, -HALF_SIDE + t), box(-1, -HALF_SIDE - t, 1, -HALF_SIDE + t, 0.4), box(2, -HALF_SIDE - t, HALF_SIDE, -HALF_SIDE + t)]))
    binding.sync()
    expect(grid.cellKind(-3, -HALF_SIDE)).toBe(CELL.SOLID)
    expect(grid.cellKind(-1.5, -HALF_SIDE)).toBe(CELL.FREE)
    expect(grid.cellKind(0, -HALF_SIDE)).toBe(CELL.LOW_WALL)
    expect(grid.cellKind(3, -HALF_SIDE)).toBe(CELL.SOLID)
    // the corner cells the west wall shares stay solid
    expect(grid.cellKind(-HALF_SIDE, -HALF_SIDE)).toBe(CELL.SOLID)
    room.change(solid('north', []))
    binding.sync()
    expect(grid.cellKind(-3, -HALF_SIDE)).toBe(CELL.FREE)
    expect(grid.cellKind(-HALF_SIDE, -HALF_SIDE)).toBe(CELL.SOLID)
  })

  it('the horde comes in through the hole a blast opened', () => {
    const t = THICKNESS / 2
    const grid = createNavGrid({ size: 64, border: false })
    const target = makeTarget(0, 0)
    const crowd = createCrowd({ pack, seed: 7, capacity: 32, grid, flow: { clock: () => 0 }, target })
    const room = roomSource({ open: false })
    const binding = bindNavObstacles(crowd, room.source)
    room.change(solid('north', [box(-HALF_SIDE, -HALF_SIDE - t, -1, -HALF_SIDE + t), box(1, -HALF_SIDE - t, HALF_SIDE, -HALF_SIDE + t)]))
    for (let k = 0; k < 12; k++) crowd.spawn(-6 + k, -12 - (k % 3))
    let inside = 0
    for (let step = 0; step < 30 / STEP; step++) {
      binding.sync()
      crowd.emitNoise(0, 0, 40)
      for (let i = 0; i < crowd.store.n; i++) if (isWandering(crowd, i)) crowd.asPlayerCrowd().chase(i, 0.5)
      crowd.update(STEP)
      for (let i = 0; i < crowd.store.n; i++) if (crowd.store.hp[i]! > 0 && isInside(crowd, i)) inside++
    }
    expect(crowd.doors.list[0]!.broken).toBe(false)
    expect(inside).toBeGreaterThan(0)
  })
})
