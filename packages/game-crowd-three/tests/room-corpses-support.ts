import * as THREE from 'three'

import { GUIDE, corpseBodyKit, createRig } from '@adatechnology/game-characters'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import type { CrowdPack } from '@adatechnology/game-crowd'
import { KIT_WORLD, createPhysicsLoop, isPhysicsServices } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsServices, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import type { TestableModule } from '@adatechnology/game-contracts'
import { createBestBuilder } from '@adatechnology/game-characters-three'

import { createCrowdTestModule } from '../src'
import type { CrowdTestModule, CrowdTestModuleOptions } from '../src'

export const STEP = 1 / 60
/** The pile the T5.4 cost tests drop, as the T5.4 `heapAt` lays it, but on the ground: the room's dead stand where they died. */
export const heapAt = (index: number): readonly [number, number] => [((index % 10) - 5) * 0.8, 0.6 + (index % 3) * 0.3]
export const BIRTH_EVERY_FRAMES = 3

const pack = undeadCrowdPack() as unknown as CrowdPack

const stubRenderer = (): THREE.WebGLRenderer =>
  ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer

export type CrowdRoom = {
  readonly room: TestRoom
  readonly module: CrowdTestModule
  readonly world: PhysicsWorld
  readonly loop: PhysicsLoop | null
  readonly services: () => PhysicsServices | undefined
}

/** The room the game runs: the crowd module in a `createTestRoom`, on the real Jolt engine (or as a seam the room steps itself, which lends the module no engine), with no ground laid by hand. */
export const crowdRoom = async (physics: 'engine' | 'seam', extra: Partial<CrowdTestModuleOptions> = {}, wall = false): Promise<CrowdRoom> => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
  if (wall) world.createBody({ shape: { kind: 'box', half: [6, 1.5, 0.2] }, motion: 'static', position: [0, 1.5, -0.2], user: -1 })
  const loop = physics === 'engine' ? createPhysicsLoop(world) : null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: loop ?? world })
  const module = createCrowdTestModule({ pack, locale: 'en', seed: 3, center: [0, 0], ...extra })
  expectNoProblems(room.loadModule(module).problems)
  let lent: unknown
  const spy: TestableModule = { id: 'probe', name: 'probe', group: 'probe', items: () => [], attach: (host) => ((lent = host.physics), () => undefined) }
  room.loadModule(spy)
  room.look([0, 1.7, 8], [0, 1.2, 0])
  return { room, module, world, loop, services: () => (isPhysicsServices(lent) ? lent : undefined) }
}

const expectNoProblems = (problems: readonly unknown[]): void => {
  if (problems.length > 0) throw new Error(`the crowd module has problems: ${JSON.stringify(problems)}`)
}

export const drawing = (): Partial<CrowdTestModuleOptions> => ({
  builders: (three) => {
    const best = createBestBuilder(three, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: () => 0.5 })
    return { buildBest: (spec, lod) => (best.setLOD(lod), best.build(spec) as THREE.Object3D), topMaterial: () => best.topM() as THREE.Material | null }
  },
  typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.name['pt-BR'] ?? type.id,
})

export const step = (room: TestRoom, frames: number): void => {
  for (let frame = 0; frame < frames; frame++) room.update(STEP)
}

/** An agent of the crowd at (x, z), as tall and as wide as the guide, killed where it stands: the id of the corpse it leaves. */
export const killAt = (module: CrowdTestModule, x: number, z: number): number => {
  const { crowd } = module
  const index = crowd.spawn(x, z, 0)
  crowd.store.height[index] = 1.8
  crowd.store.build[index] = 1
  crowd.kill(index)
  return crowd.corpses.entries[crowd.corpses.count - 1]!.id
}

export const torsoOf = (services: PhysicsServices, id: number): Vec3 => {
  const out = new Float64Array(7)
  services.corpses().readTorso(id, out, 0)
  return [out[0] as number, out[1] as number, out[2] as number]
}

/** A hash of what the crowd's own simulation holds: the agents and the bodies on the ground, exactly. */
export const crowdHash = (module: CrowdTestModule): string => {
  const { store } = module.crowd
  const agents = Array.from({ length: store.n }, (_, i) => [store.x[i], store.z[i], store.state[i], store.hp[i]])
  return JSON.stringify({ agents, corpses: module.crowd.corpses.entries.map((entry) => ({ id: entry.id, age: entry.age, data: entry.data })) })
}

const kit = corpseBodyKit({ rig: createRig({ body: GUIDE, height: 1.8, build: 1 }), body: GUIDE, build: 1 })

/** The body of the T5.4 pile test, in the world of the room: the same place (a heap dropped from 0.3 m up, 0.45 m a layer) and turn, made straight in the corpse applier. */
const bodyAt = (room: CrowdRoom, id: number): number => {
  const index = id - 1
  const [x, z] = heapAt(index)
  room.services()!.corpses().add({ id, kit, position: [x, 0.3 + Math.floor(index / 10) * 0.45, z], yaw: id * 0.7 })
  return id
}

export type PileRun = { readonly costs: readonly number[]; readonly asleepAtS: number; readonly ids: readonly number[] }

const allAsleep = (room: CrowdRoom, ids: readonly number[]): boolean => {
  const corpses = room.services()!.corpses()
  return ids.every((id) => corpses.partsOf(id).every((body) => room.world!.isSleeping(body)))
}

/**
 * 100 agents killed one every 3 frames against a wall, as the T5.4 pile test drops 100 bodies, but through the crowd and the room: the step of the loop is timed in each frame
 * (the quantity the T5.4 test reads), and the run goes on until every body of the pile sleeps or `limitSeconds` pass.
 */
export const dropPile = (room: CrowdRoom, limitSeconds: number, how: 'crowd' | 'engine' = 'crowd'): PileRun => {
  const loop = room.loop!
  const costs: number[] = []
  // the room drives the loop with the fixed steps its own clock decided (`stepFixed`); a host without a clock calls `step`
  const stepLoop = loop.step.bind(loop)
  const stepFixedLoop = loop.stepFixed.bind(loop)
  const timed = (run: () => void): void => {
    const started = performance.now()
    run()
    costs.push(performance.now() - started)
  }
  ;(loop as { step: PhysicsLoop['step'] }).step = (dt) => timed(() => stepLoop(dt))
  ;(loop as { stepFixed: PhysicsLoop['stepFixed'] }).stepFixed = (steps) => timed(() => stepFixedLoop(steps))
  const ids: number[] = []
  let asleepAtS = -1
  const lastBirthFrame = 99 * BIRTH_EVERY_FRAMES
  for (let frame = 0; frame < limitSeconds * 60 && asleepAtS < 0; frame++) {
    if (frame % BIRTH_EVERY_FRAMES === 0 && ids.length < 100) {
      const [x, z] = heapAt(ids.length)
      ids.push(how === 'crowd' ? killAt(room.module, x, z) : bodyAt(room, ids.length + 1))
    }
    room.room.update(STEP)
    if (frame > lastBirthFrame && frame % 6 === 0 && allAsleep(room, ids)) asleepAtS = frame / 60
  }
  ;(loop as { step: PhysicsLoop['step'] }).step = stepLoop
  ;(loop as { stepFixed: PhysicsLoop['stepFixed'] }).stepFixed = stepFixedLoop
  return { costs, asleepAtS, ids }
}
