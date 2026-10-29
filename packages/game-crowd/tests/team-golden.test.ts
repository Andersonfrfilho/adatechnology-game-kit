import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventValue, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { HERD_ROLES, carrionCenter, createCivilians, createCrowd, createFlock, createHerd, createNavGrid } from '../src'
import type { CivilianBuilding, CivilianSpec, CrowdCaliber, CrowdPack, CrowdStore, CrowdTarget, Region } from '../src'

type Scenario = {
  id: string
  seed: number
  fps: number
  frames: number
  every: number
  snapshotAgents?: number
  target: { x: number; z: number; crouch?: boolean; bleeding?: number; walk?: [number, number] }
  viewYaw: number
  night?: number
  walls?: [number, number, number, number, number, number][]
  pool?: [number, number, number, number]
  doors?: [number, number, 'x' | 'z', number][]
  agents: { x: number; z: number; type: number; st?: number; outfit?: number }[]
  ring?: [number, number, number]
  noises?: [number, number, number, number][]
  hits?: [number, number, number, number, string | null, number, number][]
  population?: number
  civilians?: {
    buildings: Record<string, CivilianBuilding>
    people: CivilianSpec[]
    hour: [number, number]
    join?: [number, string][]
    flee?: [number, string, [number, number][]][]
  }
  herd?: {
    buildings?: [number, number, number, number][]
    animals: { game: string; species: string; x: number; z: number; walkHz: number; runHz: number; size: number; o: { raio?: number; medo?: number; alarme?: number; mugido?: number; companheiro?: number; ceu?: number }; dead?: boolean }[]
  }
}

const readGolden = (file: string): GoldenRecord => JSON.parse(readFileSync(join(__dirname, 'fixtures/team-golden', file), 'utf8')) as GoldenRecord
const scenesOf = (golden: GoldenRecord): Scenario[] => golden.events.filter((event) => event.type === 'scenario').map((event) => (event.data as { scenario: Scenario }).scenario)
const golden = readGolden('game-crowd.json')
const civiliansGolden = readGolden('game-crowd-civilians.json')
const herdGolden = readGolden('game-crowd-herd.json')
const calibres = golden.events.find((event) => event.type === 'calibres')!.data as unknown as Record<string, CrowdCaliber>

/** The snapshot fields, in the order the game golden writes them. */
const FIELDS = ['x', 'z', 'y', 'vx', 'vz', 'yaw', 'renderYaw', 'state', 'stateTimer', 'band', 'hp', 'hpMax', 'missing', 'crawl', 'limp', 'attackTimer', 'cooldown', 'abilityTimer', 'lost', 'height', 'build', 'type', 'age', 'outfit', 'color', 'variant', 'phase', 'arms', 'eaten', 'hunts', 'named'] as const
const r6 = (value: number): number => Math.round(value * 1e6) / 1e6
const r4 = (value: number): number => Math.round(value * 1e4) / 1e4
// The migration of the game (G 67166-67175): 120 agents every 90 s on the north avenue, walking to the centre.
const MIGRATION = { every: 90, count: 120, x: 68, z: -120, width: 6, depth: 30, goal: [0, 0] as const }

const replay = (scenario: Scenario, name: string): GoldenRecord['events'] => {
  const recorder = createEventRecorder()
  recorder.record('scenario', { scenario: scenario as unknown as EventValue })
  const random = createSeededRandom(scenario.seed)
  const grid = createNavGrid({ border: false })
  for (const wall of scenario.walls ?? []) grid.fillRect(...wall)
  const pool = scenario.pool ?? [1000, 1000, 1001, 1001]
  const water = (x: number, z: number) => x > pool[0] && x < pool[2] && z > pool[1] && z < pool[3]
  const pack = undeadCrowdPack() as unknown as CrowdPack
  const crowd = createCrowd({ pack, random, grid, water, capacity: 400, flow: { clock: () => 0 } })
  for (const [x, z, axis, w] of scenario.doors ?? []) crowd.doors.add(x, z, axis, w)
  const state: CrowdTarget['state'] = {
    x: scenario.target.x,
    z: scenario.target.z,
    y: 0,
    floor: 0,
    alive: true,
    turned: false,
    crouch: scenario.target.crouch ?? false,
    bleeding: scenario.target.bleeding ?? 0,
    scentTimer: 0,
    screamBoost: 0,
    grabbedBy: -1,
    blind: 0,
    burnTimer: 0,
    yaw: 0,
  }
  const target: CrowdTarget = {
    state,
    grab(by, noJaw = false, drown = false) {
      state.grabbedBy = by
      recorder.record('target', { verb: 'grab', by, noJaw, drown })
    },
    hurt(amount, by = -1) {
      recorder.record('target', { verb: 'hurt', amount: r6(amount), by })
    },
    knock(seconds) {
      recorder.record('target', { verb: 'knock', seconds })
    },
    release() {
      recorder.record('target', { verb: 'release', by: state.grabbedBy })
      state.grabbedBy = -1
    },
  }
  crowd.target = target
  crowd.on('sound', (e) => recorder.record('sound', { sound: e.sound, volume: e.volume, distance: r4(e.distance) }))
  crowd.on('message', (e) => recorder.record('message', { id: e.id, seconds: e.seconds }))
  crowd.on('effect', (e) => {
    if (e.effect === 'blood') recorder.record('effect', { effect: 'blood', amount: e.amount!, died: !!e.died })
    else if (e.effect === 'limb') recorder.record('effect', { effect: 'limb', region: e.region!, severed: !!e.severed })
    else if (e.effect === 'cloud') recorder.record('effect', { effect: 'cloud', radius: e.radius!, color: e.color! })
    else recorder.record('effect', { effect: e.effect })
  })
  const Z: CrowdStore = crowd.store
  // the animals come first, as in the game (they are born before the horde of the scene)
  const herdScene = scenario.herd
  const herd = herdScene
    ? createHerd(crowd, {
        view: () => ({ x: scenario.target.x, z: scenario.target.z }),
        blocked: (x, z) => (herdScene.buildings ?? []).some(([bx, bz, bw, bd]) => x > bx - 1 && x < bx + bw + 1 && z > bz - 1 && z < bz + bd + 1),
      })
    : null
  for (const a of herdScene?.animals ?? [])
    herd!.add({
      ...HERD_ROLES[a.species],
      species: a.species,
      x: a.x,
      z: a.z,
      walkHz: a.walkHz,
      runHz: a.runHz,
      size: a.size,
      ...(a.o.raio === undefined ? {} : { range: a.o.raio }),
      ...(a.o.medo === undefined ? {} : { fear: a.o.medo }),
      companion: !!a.o.companheiro,
      sky: !!a.o.ceu,
      dead: !!a.dead,
    })
  const vultures = herd ? createFlock({ count: herd.list.filter((E) => E.spec.sky).length, mode: 'carrion' }) : null
  herd?.on('noise', (e) => recorder.record('noise', { x: r4(e.x), z: r4(e.z), radius: e.radius }))
  herd?.on('sound', (e) => recorder.record('sound', { sound: e.sound, distance: r4(e.distance) }))
  herd?.on('message', (e) => recorder.record('message', { id: e.id, seconds: e.seconds }))
  let hour = scenario.civilians?.hour[0] ?? 12
  const civilians = scenario.civilians ? createCivilians(crowd, { people: scenario.civilians.people, buildings: scenario.civilians.buildings, hour: () => hour, turnInto: 0 }) : null
  civilians?.on('bitten', (e) => recorder.record('civilian', { event: 'bitten', id: e.id, near: e.near }))
  civilians?.on('turned', (e) => recorder.record('civilian', { event: 'turned', id: e.id, agent: e.agent }))
  civilians?.on('died', (e) => recorder.record('civilian', { event: 'died', id: e.id, cause: e.cause }))
  for (const agent of scenario.agents) {
    const i = crowd.spawn(agent.x, agent.z, agent.type)
    if (agent.st !== undefined) Z.state[i] = agent.st
    if (agent.outfit !== undefined) {
      Z.outfit[i] = agent.outfit
      Z.helmet[i] = pack.outfits[agent.outfit]?.helmet ? 1 : 0
    }
  }
  if (scenario.ring) {
    const [count, inner, outer] = scenario.ring
    for (let k = 0; k < count; k++) {
      const a = (k / count) * 6.28318
      const r = inner + (((k * 37) % 50) / 50) * (outer - inner)
      crowd.spawn(state.x + Math.cos(a) * r, state.z + Math.sin(a) * r)
    }
  }
  const view = { x: scenario.target.x, z: scenario.target.z, yaw: scenario.viewYaw, far: 150 }
  let frame = 0
  const snapshot = () => {
    const agents: EventValue[] = []
    const shown = Math.min(Z.n, scenario.snapshotAgents ?? Z.n)
    for (let i = 0; i < shown; i++) {
      const row: Record<string, EventValue> = {}
      for (const field of FIELDS) row[field] = r6(Z[field][i]!)
      agents.push(row)
    }
    recorder.record('state', {
      frame,
      n: Z.n,
      kills: crowd.stats.kills,
      heads: crowd.stats.heads,
      slots: crowd.stats.slots,
      bands: crowd.stats.bands.join(','),
      corpses: crowd.corpses.count,
      trail: crowd.trail.length,
      pile: crowd.pileCount(),
      doors: crowd.doors.list.map((d) => `${d.hp}:${d.broken ? 1 : 0}`).join(','),
      target: { grabbedBy: state.grabbedBy, blind: r6(state.blind), scent: r6(state.scentTimer), boost: r6(state.screamBoost), burn: r6(state.burnTimer) },
      agents,
    })
    if (herd && vultures) {
      for (const E of herd.list) {
        if (E.spec.sky) continue
        recorder.record('animal', { frame, index: E.index, x: r6(E.x), z: r6(E.z), yaw: r6(E.yaw), clip: E.clip, timer: r6(E.timer), cooldown: r6(E.cooldown), fly: r6(E.fly), targetX: r6(E.targetX), targetZ: r6(E.targetZ) })
      }
      vultures.birds.forEach((U, i) => recorder.record('vulture', { frame, i, x: r6(U.x), y: r6(U.y), z: r6(U.z), yaw: r6(U.yaw), visible: U.visible }))
    }
    for (const n of civilians?.list ?? [])
      recorder.record('civilian_state', { frame, id: n.id, x: r6(n.x), z: r6(n.z), vx: r6(n.vx), vz: r6(n.vz), yaw: r6(n.yaw), hp: r6(n.hp), state: n.state, biteTimer: r6(n.biteTimer), pathIndex: n.pathIndex, phase: r6(n.phase) })
  }
  const dt = 1 / scenario.fps
  for (let k = 0; k < scenario.frames; k++) {
    for (const [at, x, z, r] of scenario.noises ?? []) if (at === k) crowd.emitNoise(x, z, r)
    for (const [at, agent, region, amount, caliber, distance, cut] of scenario.hits ?? [])
      if (at === k && agent < Z.n) crowd.damage(agent, { region: region as Region, amount, distance, cut, caliber: caliber ? calibres[caliber]! : null })
    if (scenario.target.walk) {
      state.x += scenario.target.walk[0] * dt
      state.z += scenario.target.walk[1] * dt
    }
    if (scenario.civilians && civilians) {
      const civ = scenario.civilians
      hour = civ.hour[0] + k * dt * civ.hour[1]
      for (const [at, id] of civ.join ?? []) if (at === k) civilians.join(id)
      for (const [at, id, path] of civ.flee ?? []) if (at === k) civilians.flee(id, path)
    }
    crowd.updateTrail(dt)
    civilians?.update(dt)
    if (herd && vultures) {
      herd.update(dt)
      const carcass = herd.list.find((E) => E.dead)
      vultures.update(herd.time, dt, carrionCenter(crowd.corpses.entries.map((e) => e.data), carcass ? [carcass.x, carcass.z] : null), [scenario.target.x, scenario.target.z])
    }
    crowd.update(dt, { viewYaw: scenario.viewYaw, nightFactor: scenario.night ?? 0 })
    if (scenario.population !== undefined) crowd.updatePopulation(dt, view, { target: scenario.population, migration: MIGRATION })
    crowd.updateCorpses(dt)
    frame++
    if (frame % scenario.every === 0) snapshot()
  }
  if (frame % scenario.every !== 0) snapshot()
  return createGoldenRecord({ name, seed: 20261022, events: recorder.events() }).events
}

const compare = (record: GoldenRecord, scenario: Scenario): void => {
  const start = record.events.findIndex((event) => event.type === 'scenario' && (event.data as { scenario: Scenario }).scenario.id === scenario.id)
  const expected = record.events.slice(start)
  const next = expected.findIndex((event, index) => index > 0 && event.type === 'scenario')
  const want = next < 0 ? expected : expected.slice(0, next)
  const events = replay(scenario, record.name)
  // the first difference, to read a failure
  const at = events.findIndex((event, index) => JSON.stringify(event) !== JSON.stringify(want[index]))
  if (at >= 0) expect({ at, got: events[at] }).toEqual({ at, got: want[at] })
  expect(events).toEqual(want)
}

describe('G-crowd: the SDK crowd replays the game horde frame by frame', () => {
  it('has the 8 scripted scenes of the fixture', () => {
    expect(scenesOf(golden)).toHaveLength(8)
  })
  it.each(scenesOf(golden).map((scenario) => [scenario.id, scenario] as const))('%s', (_id, scenario) => compare(golden, scenario))
})

describe('G-crowd-civilians: the SDK civilians replay the game survivors with the horde', () => {
  it('has the 3 scripted scenes of the fixture', () => {
    expect(scenesOf(civiliansGolden)).toHaveLength(3)
  })
  it.each(scenesOf(civiliansGolden).map((scenario) => [scenario.id, scenario] as const))('%s', (_id, scenario) => compare(civiliansGolden, scenario))
})

describe('G-crowd-herd: the SDK herd and the vultures replay the game animals with the horde', () => {
  it('has the scripted scene of the fixture', () => {
    expect(scenesOf(herdGolden)).toHaveLength(1)
  })
  it.each(scenesOf(herdGolden).map((scenario) => [scenario.id, scenario] as const))('%s', (_id, scenario) => compare(herdGolden, scenario))
})
