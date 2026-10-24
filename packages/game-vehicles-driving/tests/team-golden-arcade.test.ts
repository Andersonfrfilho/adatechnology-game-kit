import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'
import { describe, expect, it } from 'vitest'
import { createArcadeDriver, vehicleCorners } from '../src'
import type { DriveInput, DrivingEvent } from '../src'

/** The game: `carUpdate`, `carCorners` and `carBlocked` cut from jogo.js and run against stubs for everything the game owns. */
const GAME = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'specs', '001-migracao-entregas-dos-times', 'artefatos', '2UG1Mhe9LqJkQKKVsJkTWR', 'jogo.js')
const source = readFileSync(GAME, 'utf8')

type Log = Array<[string, ...number[]]>
const r = (x: number): number => Math.round(x * 1e9) / 1e9 + 0

interface Scene {
  x: number
  z: number
  yaw: number
  v: number
  /** Wall: solid when x is beyond this (or z beyond `±wallZ`). */
  wallX: number
  wallZ: number
  /** Bodies as [x, z]. */
  bodies: Array<[number, number]>
}

interface Frame {
  state: [number, number, number, number, number]
  log: Log
}

const DT = 1 / 60

/** Runs the team's code for the scripted inputs. */
function runTeam(scene: Scene, inputs: DriveInput[]): Frame[] {
  const log: Log = []
  const code = `
    const CAR = { x: ${scene.x}, z: ${scene.z}, yaw: ${scene.yaw}, v: ${scene.v}, steer: 0, on: true, moved: true, hitT: 0, engT: 0, e: { hp: 1000, st: 0 }, L: 4.3, W: 1.9 };
    const keys = {}; let pressedH = false;
    const wasPressed = (k) => k === 'KeyH' && pressedH;
    const player = { alive: true, hurt: (a) => log.push(['hurt', a]) };
    const Z = { n: bodies.length, band: bodies.map(() => 0), x: bodies.map((b) => b[0]), z: bodies.map((b) => b[1]), hp: bodies.map(() => 100), st: bodies.map(() => 0), stT: bodies.map(() => 0), vx: bodies.map(() => 0), vz: bodies.map(() => 0), age: bodies.map(() => 0) };
    Z.vz = new Proxy(Z.vz, { set(t, k, v) { t[k] = v; if (k !== 'length') log.push(['knock', Number(k), 100 - Z.hp[k], Z.vx[k], v]); return true; } });
    Z.x = new Proxy(Z.x, { set(t, k, v) { if (k !== 'length') log.push(['push', Number(k), v - t[k]]); t[k] = v; return true; } });
    const IDADES = [0];
    const solidAt = (x, z) => x > wall.x || Math.abs(z) > wall.z;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, t) => a + (b - a) * t;
    let shake = 0;
    const exploDamage = () => log.push(['crash', 1000 - CAR.e.hp]);
    const sfx = () => {}; const hudMsg = () => {};
    const emitNoise = (x, z, rad) => log.push(['noise', rad]);
    const fxLimb = (i) => log.push(['limb', i]); const fxBlood = () => {};
    const parabrisa = () => {}; const buzina = () => log.push(['horn']);
    const zKill = (i) => { Z.band[i] = 1; log.push(['kill', i]); };
    const carExit = () => {}; const carSync = () => {};
    ${cutFunction(source, 'carCorners')}
    ${cutFunction(source, 'carBlocked')}
    ${cutFunction(source, 'carUpdate')}
    return { step(input, dt) { keys.KeyW = input.throttle > 0; keys.KeyS = input.brake > 0; keys.KeyA = input.steer > 0; keys.KeyD = input.steer < 0; keys.Space = input.handbrake; pressedH = !!input.horn; carUpdate(dt); }, CAR, Z };
  `
  const world = evaluateSlice<{ step: (input: DriveInput, dt: number) => void; CAR: any; Z: any }>(
    `const { log, bodies, wall } = __scope;\n${code.replace('return { step', 'return { step').replace(/^\s*return \{ step[\s\S]*$/m, (m) => m)}`.replace('return { step(input, dt)', 'return { step(input, dt)'),
    ['step', 'CAR', 'Z'],
    { __scope: { log, bodies: scene.bodies, wall: { x: scene.wallX, z: scene.wallZ } }, Math },
  )
  const frames: Frame[] = []
  for (const input of inputs) {
    log.length = 0
    world.step(input, DT)
    frames.push({ state: [r(world.CAR.x), r(world.CAR.z), r(world.CAR.yaw), r(world.CAR.v), r(world.CAR.steer)], log: log.map((entry) => entry.map((x) => (typeof x === 'number' ? r(x) : x)) as Log[number]) })
  }
  return frames
}

/** Runs the SDK driver for the same inputs and writes its events in the shape of the team's log. */
function runSdk(scene: Scene, inputs: DriveInput[]): Frame[] {
  const driver = createArcadeDriver()
  driver.place(scene.x, scene.z, scene.yaw)
  driver.state.v = scene.v
  // the host owns the bodies: positions, hit points and who is dead
  const bodies = scene.bodies.map(([x, z]) => ({ x, z, hp: 100, dead: false }))
  const world = {
    blocked: (x: number, z: number, yaw: number) => vehicleCorners(driver.spec, x, z, yaw).some(([a, b]) => a > scene.wallX || Math.abs(b) > scene.wallZ),
    bodies: () => bodies.map((body) => (body.dead ? undefined : body)),
  }
  const frames: Frame[] = []
  for (const input of inputs) {
    const { state, events } = driver.step(input, DT, world)
    const log: Log = []
    const kills: number[] = []
    const flush = (): void => {
      kills.sort((a, b) => b - a)
      for (const i of kills.splice(0)) {
        ;(bodies[i] as { dead: boolean }).dead = true
        log.push(['kill', i])
      }
    }
    for (const e of events as DrivingEvent[]) {
      if (e.type === 'crash') {
        log.push(['crash', e.damage])
        log.push(['noise', driver.spec.crash.noiseRadius])
        if (e.hurtDriver > 0) log.push(['hurt', e.hurtDriver])
      } else if (e.type === 'run_over') {
        const body = bodies[e.index] as { x: number; hp: number }
        if (e.outcome === 'kill') {
          log.push(['limb', e.index])
          kills.push(e.index)
        } else if (e.outcome === 'knock') {
          body.hp -= e.damage
          log.push(['knock', e.index, 100 - body.hp, e.vx, e.vz])
          if (body.hp <= 0) kills.push(e.index)
        } else {
          body.x += e.dx
          log.push(['push', e.index, e.dx])
        }
      } else if (e.type === 'noise' && e.source !== 'crash') {
        flush()
        log.push(['noise', e.radius])
      } else if (e.type === 'horn') log.push(['horn'])
    }
    flush()
    frames.push({ state: [r(state.x), r(state.z), r(state.yaw), r(state.v), r(state.steer)], log: log.map((entry) => entry.map((x) => (typeof x === 'number' ? r(x) : x)) as Log[number]) })
  }
  return frames
}

const hold = (n: number, input: Partial<DriveInput>): DriveInput[] => Array.from({ length: n }, () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...input }))

describe('team golden: the arcade car (G-arcade)', () => {
  it('drives like the game: full throttle, coast, brake, reverse, handbrake and a steering sweep', () => {
    const scene: Scene = { x: 0, z: 0, yaw: 0, v: 0, wallX: 1e9, wallZ: 1e9, bodies: [] }
    const inputs = [
      ...hold(360, { throttle: 1 }),
      ...hold(120, {}),
      ...hold(120, { brake: 1 }),
      ...hold(240, { brake: 1 }),
      ...hold(60, { throttle: 1, handbrake: true }),
      ...hold(180, { throttle: 1, steer: 1 }),
      ...hold(180, { throttle: 1, steer: -1 }),
      ...hold(60, { throttle: 1, brake: 1 }),
      ...hold(90, { brake: 1, steer: 1, horn: true }),
    ]
    expect(runSdk(scene, inputs)).toEqual(runTeam(scene, inputs))
  })

  it('hits a wall the same way: damage, noise, bounce and hurt above 9 m/s', () => {
    const scene: Scene = { x: 0, z: 0, yaw: 0, v: 0, wallX: 40, wallZ: 1e9, bodies: [] }
    const inputs = hold(600, { throttle: 1 })
    const sdk = runSdk(scene, inputs)
    const team = runTeam(scene, inputs)
    expect(sdk).toEqual(team)
    expect(team.some((f) => f.log.some((e) => e[0] === 'crash'))).toBe(true)
    expect(team.some((f) => f.log.some((e) => e[0] === 'hurt'))).toBe(true)
  })

  it.each([2, 5, 10])('runs over bodies at %s m/s as the game does', (speed) => {
    const scene: Scene = { x: 0, z: 0, yaw: 0, v: speed, wallX: 1e9, wallZ: 1e9, bodies: [[1.5, 0.2], [2.5, -0.5], [20, 0]] }
    const inputs = hold(40, speed < 3 ? {} : { throttle: 1 })
    const sdk = runSdk(scene, inputs)
    const team = runTeam(scene, inputs)
    expect(sdk).toEqual(team)
    expect(team.some((f) => f.log.some((e) => e[0] === 'knock' || e[0] === 'kill' || e[0] === 'limb'))).toBe(speed >= 3 ? true : false)
  })
})
