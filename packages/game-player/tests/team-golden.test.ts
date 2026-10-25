import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventValue, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createPlayer, playerTextOf } from '../src'
import type { PlayerAction, PlayerCrowd, PlayerWorld } from '../src'

type Step = {
  frames: number
  forward?: number
  right?: number
  run?: boolean
  aim?: boolean
  bandage?: boolean
  yaw?: number
  press?: PlayerAction[]
  call?: [string, ...(number | boolean | string)[]]
}
type Scenario = {
  id: string
  seed: number
  fps: number
  every: number
  start: { x: number; z: number }
  walls?: [number, number, number, number, number, number][]
  pool?: [number, number, number, number]
  zombies?: { x: number; z: number; st?: number; crawl?: number; runner?: boolean }[]
  steps: Step[]
}

const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures/team-golden/game-player.json'), 'utf8')) as GoldenRecord
const scenarios = golden.events.filter((event) => event.type === 'scenario').map((event) => (event.data as { scenario: Scenario }).scenario)

const FIELDS = ['x', 'z', 'y', 'vx', 'vz', 'yaw', 'health', 'stamina', 'crouch', 'running', 'bleeding', 'infected', 'infectionTime', 'grabbedBy', 'grabTimer', 'grabPushes', 'downTimer', 'burnTimer', 'vaultTimer', 'panic', 'alive', 'phase', 'hip', 'stepTimer'] as const
const r6 = (value: unknown): EventValue => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : (value as EventValue))

// The game grid (G 62160-62170): 0.5 m cells over 768 m, an occupancy code and a height per cell.
const WORLD = 768
const HALF = WORLD / 2
const GC = 0.5
const GN = WORLD / GC
const createGrid = (walls: Scenario['walls'] = []) => {
  const occ = new Uint8Array(GN * GN)
  const occH = new Float32Array(GN * GN)
  const cellOf = (x: number, z: number): number => {
    const gx = Math.floor((x + HALF) / GC)
    const gz = Math.floor((z + HALF) / GC)
    return gx < 0 || gz < 0 || gx >= GN || gz >= GN ? -1 : gz * GN + gx
  }
  for (const [x0, z0, x1, z1, kind, h] of walls) {
    const a = Math.floor((x0 + HALF) / GC)
    const b = Math.ceil((x1 + HALF) / GC)
    const c = Math.floor((z0 + HALF) / GC)
    const d = Math.ceil((z1 + HALF) / GC)
    for (let gz = Math.max(0, c); gz < Math.min(GN, d); gz++)
      for (let gx = Math.max(0, a); gx < Math.min(GN, b); gx++) {
        occ[gz * GN + gx] = kind
        occH[gz * GN + gx] = h
      }
  }
  const solidAt = (x: number, z: number, y = 0.5): boolean => {
    const c = cellOf(x, z)
    return c < 0 || (occ[c] !== 0 && occ[c] !== 3 && occH[c]! > y)
  }
  return { cellKind: (x: number, z: number) => (cellOf(x, z) < 0 ? -1 : occ[cellOf(x, z)]!), solidAt }
}

// The game's zombie table, the fields the player touches (Float32 like the game's `Z`).
const createCrowd = (zombies: Scenario['zombies'] = [], record: (type: string, data: Record<string, EventValue>) => void) => {
  const n = zombies.length
  const f = () => new Float32Array(Math.max(1, n))
  const Z = { x: f(), z: f(), y: f(), yaw: f(), vx: f(), vz: f(), dvx: f(), dvz: f(), stT: f(), atkT: f(), st: new Uint8Array(Math.max(1, n)), crawl: new Uint8Array(Math.max(1, n)), runner: new Uint8Array(Math.max(1, n)) }
  zombies.forEach((zombie, i) => {
    Z.x[i] = zombie.x
    Z.z[i] = zombie.z
    Z.st[i] = zombie.st ?? 0
    Z.crawl[i] = zombie.crawl ?? 0
    Z.runner[i] = zombie.runner ? 1 : 0
  })
  const crowd: PlayerCrowd = {
    count: () => n,
    active: () => true,
    x: (i) => Z.x[i]!,
    z: (i) => Z.z[i]!,
    y: (i) => Z.y[i]!,
    floor: () => 0,
    chasing: (i) => Z.st[i] === 1,
    down: (i) => Z.crawl[i] !== 0 || Z.st[i] === 3,
    panicWeight: (i) => (Z.runner[i] ? 2.5 : 1),
    hold(i, x, z, k, lookX, lookZ) {
      Z.x[i]! += (x - Z.x[i]!) * k
      Z.z[i]! += (z - Z.z[i]!) * k
      Z.vx[i] = Z.vz[i] = Z.dvx[i] = Z.dvz[i] = 0
      Z.yaw[i] = Math.atan2(lookX - Z.x[i]!, lookZ - Z.z[i]!)
    },
    stun(i, seconds, vx, vz) {
      Z.st[i] = 3
      Z.stT[i] = seconds
      Z.vx[i] = vx
      Z.vz[i] = vz
    },
    chase(i, cooldown) {
      Z.st[i] = 1
      Z.atkT[i] = cooldown
    },
    damage: (i, hit) => record('damage', { i, region: hit.region, amount: r6(hit.amount), distance: r6(hit.distance), cut: r6(hit.cut) }),
  }
  return { Z, crowd, n }
}

const replay = (scenario: Scenario): GoldenRecord['events'] => {
  const recorder = createEventRecorder()
  const record = (type: string, data: Record<string, EventValue>) => recorder.record(type, data)
  const grid = createGrid(scenario.walls)
  const pool = scenario.pool ?? [1000, 1000, 1001, 1001]
  const { Z, crowd, n } = createCrowd(scenario.zombies, record)
  const world: PlayerWorld = { ...grid, inWater: (x, z) => x > pool[0] && x < pool[2] && z > pool[1] && z < pool[3], crowd }
  const player = createPlayer({ random: createSeededRandom(scenario.seed), infection: true, position: scenario.start, world })
  player.on('sound', (e) => record('sound', { sound: e.sound, volume: e.volume }))
  player.on('noise', (e) => record('noise', { x: r6(e.x), z: r6(e.z), radius: r6(e.radius) }))
  player.on('step', (e) => record('step', { x: r6(e.x), z: r6(e.z), yaw: r6(e.yaw) }))
  player.on('message', (e) => record('message', { text: playerTextOf(e.id, 'pt-BR'), seconds: e.seconds }))
  player.on('died', (e) => record('died', { cause: playerTextOf(e.cause, 'pt-BR') }))
  player.on('throw', () => record('throw', {}))
  recorder.record('scenario', { scenario: scenario as unknown as EventValue })
  let frame = 0
  const P = player.state
  const snapshot = () => {
    const state: Record<string, EventValue> = { frame }
    for (const field of FIELDS) state[field] = r6(player.state[field])
    state.wounds = player.state.wounds.map((kind) => ({ scratch: 'arranhao', laceration: 'laceracao', bite: 'mordida' })[kind] ?? kind).join(',')
    recorder.record('state', state)
  }
  void P
  for (const step of scenario.steps) {
    const [call, ...args] = step.call ?? []
    if (call === 'hurt') player.hurt(args[0] as number)
    else if (call === 'bite') player.bite()
    else if (call === 'grab') player.grab(args[0] as number, args[1] as boolean, args[2] as boolean)
    else if (call === 'knock') player.knock(args[0] as number)
    else if (call === 'burn') player.state.burnTimer = args[0] as number
    for (let k = 0; k < step.frames; k++) {
      const pressed: Partial<Record<PlayerAction, boolean>> = {}
      if (k === 0) for (const id of step.press ?? []) pressed[id] = true
      player.update(1 / scenario.fps, { forward: step.forward ?? 0, right: step.right ?? 0, run: step.run === true, bandage: step.bandage === true, yaw: step.yaw ?? 0, aim: step.aim === true, pressed })
      frame++
      if (frame % scenario.every === 0) snapshot()
    }
    for (let i = 0; i < n; i++) recorder.record('zombie', { frame, i, x: r6(Z.x[i]), z: r6(Z.z[i]), yaw: r6(Z.yaw[i]), vx: r6(Z.vx[i]), vz: r6(Z.vz[i]), st: r6(Z.st[i]), stT: r6(Z.stT[i]), atkT: r6(Z.atkT[i]) })
  }
  snapshot()
  return createGoldenRecord({ name: 'game-player', seed: 20261022, events: recorder.events() }).events
}

describe('G-player: the SDK player replays the game player frame by frame', () => {
  it('has the 18 scripted runs of the fixture', () => {
    expect(scenarios).toHaveLength(18)
  })

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))('%s', (id, scenario) => {
    const expected = golden.events.slice(golden.events.findIndex((event) => event.type === 'scenario' && (event.data as { scenario: Scenario }).scenario.id === id))
    const next = expected.findIndex((event, index) => index > 0 && event.type === 'scenario')
    const events = replay(scenario)
    expect(events).toEqual(next < 0 ? expected : expected.slice(0, next))
  })
})
