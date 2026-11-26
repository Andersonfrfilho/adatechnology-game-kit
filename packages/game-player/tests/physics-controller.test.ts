import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createPhysicsController, createPlayer } from '../src/index'
import type { Player, PlayerController, PlayerInput } from '../src/index'

const H = KIT_WORLD.fixedStep ?? 1 / 120

const walkInput: PlayerInput = { forward: 1, yaw: 0 }

/** A physics world with a floor, a player in it walking by the engine's controller, and the loop that steps both. */
const scene = async (at: readonly [number, number, number] = [0, 0, 0]) => {
  const engine = await createJoltEngine()
  const world: PhysicsWorld = engine.createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const player = createPlayer({ position: { x: at[0], z: at[2] } })
  const controller = createPhysicsController(world, { position: at, collider: player.collider() })
  player.setWorld({ controller })
  const loop = createPhysicsLoop(world)
  let input: PlayerInput = {}
  loop.add({ beforeStep: (h) => player.update(h, input) }, 'actors')
  const run = (seconds: number, next: PlayerInput): void => {
    input = next
    for (let i = 0; i < Math.round(seconds / H); i++) loop.stepFixed(1)
  }
  return { world, player, controller, run }
}

describe('the player walked by the physics controller (spec 008 T4.1)', () => {
  it('climbs an 18 cm step: its y is the controller feet', { timeout: 60000 }, async () => {
    const { world, player, run } = await scene()
    world.createBody({ shape: { kind: 'box', half: [2, 0.09, 10] }, motion: 'static', position: [0, 0.09, -11], user: -1 })
    run(3, walkInput)
    expect(player.state.z).toBeLessThan(-3)
    expect(player.state.y).toBeCloseTo(0.18, 2)
    world.dispose()
  })

  it('is stopped by a wall of the physics world, with no `blocked` callback at all', { timeout: 60000 }, async () => {
    const { world, player, run } = await scene()
    world.createBody({ shape: { kind: 'box', half: [3, 1, 0.1] }, motion: 'static', position: [0, 1, -2], user: -1 })
    run(4, walkInput)
    expect(player.state.z).toBeGreaterThan(-1.7)
    expect(player.state.z).toBeLessThan(-1.4)
    world.dispose()
  })

  it('pushes a 30 kg crate it walks into', { timeout: 60000 }, async () => {
    const { world, player, run } = await scene()
    const crate = world.createBody({ shape: { kind: 'box', half: [0.3, 0.3, 0.3] }, motion: 'dynamic', mass: 30, position: [0, 0.3, -2], layer: 'prop', user: 5 })
    run(4, walkInput)
    const pose = new Float64Array(7)
    world.readPose(crate, pose, 0)
    expect(pose[2]).toBeLessThan(-3)
    expect(player.state.z).toBeLessThan(-2.5)
    world.dispose()
  })

  it('is pushed by a shove and settles where it was pushed to', { timeout: 60000 }, async () => {
    const { world, player, controller, run } = await scene()
    run(0.5, {})
    expect(Math.hypot(player.state.x, player.state.z)).toBeLessThan(0.01)
    controller.push([225, 0, 0])
    run(2, {})
    expect(player.state.x).toBeGreaterThan(0.6)
    expect(player.state.x).toBeLessThan(0.9)
    world.dispose()
  })

  it('a loaded game puts the controller where the save was', { timeout: 60000 }, async () => {
    const { world, player, run } = await scene()
    const save = player.save()
    run(2, walkInput)
    expect(player.state.z).toBeLessThan(-1)
    player.load(save)
    run(0.2, {})
    expect(Math.hypot(player.state.x, player.state.z)).toBeLessThan(0.05)
    world.dispose()
  })
})

describe('the controller port (no engine)', () => {
  const fakeController = (): PlayerController & { moves: number[][]; teleports: number[][] } => {
    const fake = {
      moves: [] as number[][],
      teleports: [] as number[][],
      at: [4, 1.5, -7],
      move: (vx: number, vz: number, dt: number) => void fake.moves.push([vx, vz, dt]),
      read: (out: Float64Array) => out.set(fake.at),
      teleport: (x: number, y: number, z: number) => void fake.teleports.push([x, y, z]),
    }
    return fake
  }

  it('takes the position from the controller and does not ask `blocked`', () => {
    const controller = fakeController()
    let asked = 0
    const player: Player = createPlayer({ world: { controller, blocked: () => (asked++, true) } })
    player.update(1 / 120, { forward: 1, yaw: 0 })
    expect([player.state.x, player.state.y, player.state.z]).toEqual([4, 1.5, -7])
    expect(controller.moves).toHaveLength(1)
    expect(controller.moves[0]?.[2]).toBe(1 / 120)
    expect(asked).toBe(0)
  })

  it('without a controller the grid still decides: `blocked` stops the body', () => {
    const player = createPlayer({ world: { blocked: () => true } })
    for (let i = 0; i < 60; i++) player.update(1 / 60, { forward: 1, yaw: 0 })
    expect(player.state.z).toBe(0)
  })
})
