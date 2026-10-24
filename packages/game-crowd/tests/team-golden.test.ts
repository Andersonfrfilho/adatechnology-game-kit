import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventValue, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createCrowd, createNavGrid } from '../src'
import type { CrowdCaliber, CrowdPack, CrowdStore, CrowdTarget, Region } from '../src'

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
}

const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures/team-golden/game-crowd.json'), 'utf8')) as GoldenRecord
const scenarios = golden.events.filter((event) => event.type === 'scenario').map((event) => (event.data as { scenario: Scenario }).scenario)
const calibres = golden.events.find((event) => event.type === 'calibres')!.data as unknown as Record<string, CrowdCaliber>

/** The snapshot fields, in the order the game golden writes them. */
const FIELDS = ['x', 'z', 'y', 'vx', 'vz', 'yaw', 'renderYaw', 'state', 'stateTimer', 'band', 'hp', 'hpMax', 'missing', 'crawl', 'limp', 'attackTimer', 'cooldown', 'abilityTimer', 'lost', 'height', 'build', 'type', 'age', 'outfit', 'color', 'variant', 'phase', 'arms', 'eaten'] as const
const r6 = (value: number): number => Math.round(value * 1e6) / 1e6
const r4 = (value: number): number => Math.round(value * 1e4) / 1e4
// The migration of the game (G 67166-67175): 120 agents every 90 s on the north avenue, walking to the centre.
const MIGRATION = { every: 90, count: 120, x: 68, z: -120, width: 6, depth: 30, goal: [0, 0] as const }

const replay = (scenario: Scenario): GoldenRecord['events'] => {
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
    crowd.updateTrail(dt)
    crowd.update(dt, { viewYaw: scenario.viewYaw, nightFactor: scenario.night ?? 0 })
    if (scenario.population !== undefined) crowd.updatePopulation(dt, view, { target: scenario.population, migration: MIGRATION })
    crowd.updateCorpses(dt)
    frame++
    if (frame % scenario.every === 0) snapshot()
  }
  if (frame % scenario.every !== 0) snapshot()
  return createGoldenRecord({ name: 'game-crowd', seed: 20261022, events: recorder.events() }).events
}

describe('G-crowd: the SDK crowd replays the game horde frame by frame', () => {
  it('has the 8 scripted scenes of the fixture', () => {
    expect(scenarios).toHaveLength(8)
  })

  it.each(scenarios.map((scenario) => [scenario.id, scenario] as const))('%s', (id, scenario) => {
    const start = golden.events.findIndex((event) => event.type === 'scenario' && (event.data as { scenario: Scenario }).scenario.id === id)
    const expected = golden.events.slice(start)
    const next = expected.findIndex((event, index) => index > 0 && event.type === 'scenario')
    const events = replay(scenario)
    const want = next < 0 ? expected : expected.slice(0, next)
    // first difference, to read the failure
    const at = events.findIndex((event, index) => JSON.stringify(event) !== JSON.stringify(want[index]))
    if (at >= 0) expect({ at, got: events[at], want: want[at] }).toEqual({ at, got: want[at], want: want[at] })
    expect(events).toEqual(want)
  })
})
