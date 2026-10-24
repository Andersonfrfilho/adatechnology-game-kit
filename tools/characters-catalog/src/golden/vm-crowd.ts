import { cutDeclaration, cutFunction } from '@adatechnology/golden-tool/cut-source'
import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventRecorder, EventValue, GoldenRecord } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from '../paths'
import { fromMarker, readSource } from '../read-source'
import { evaluateGameSlice } from './game-context'

const HORDE_MARKER = '// ===== Horda: simulação com relevância (R0..R3), percepção, combate, corpos ====='
const WORLD_MARKER = '// ===== Mundo: quarteirão do Jardim Aurora (brief da fatia vertical) e arredores ====='
const BANDS_MARKER = '// Relevância (revisão, seção 4)'
/** Room for a population run: 170 agents and a migration of 120. */
const CAPACITY = 400

/** An agent placed at the start: the type by its index in the game's catalog (-1 draws it), and optionally its state and outfit. */
export type CrowdScenarioAgent = { readonly x: number; readonly z: number; readonly type: number; readonly st?: number; readonly outfit?: number }
/** A hit at a frame: agent, region, damage, calibre id (null for melee), distance, cut. */
export type CrowdScenarioHit = readonly [frame: number, agent: number, region: number, amount: number, caliber: string | null, distance: number, cut: number]
export type CrowdScenario = {
  readonly id: string
  readonly seed: number
  readonly fps: number
  readonly frames: number
  /** A snapshot every this many frames (and after the last). */
  readonly every: number
  /** Only the first agents go into a snapshot (all when left out). */
  readonly snapshotAgents?: number
  readonly target: { readonly x: number; readonly z: number; readonly crouch?: boolean; readonly bleeding?: number; readonly walk?: readonly [number, number] }
  /** The camera's yaw (forward `(-sin, -cos)`): the stalker wakes when the target turns its back, nobody is born in view. */
  readonly viewYaw: number
  readonly night?: number
  readonly walls?: readonly (readonly [number, number, number, number, number, number])[]
  readonly pool?: readonly [number, number, number, number]
  readonly doors?: readonly (readonly [number, number, 'x' | 'z', number])[]
  readonly agents: readonly CrowdScenarioAgent[]
  /** Far agents drawn at the start, in a ring around the target: count, inner and outer radius. */
  readonly ring?: readonly [count: number, inner: number, outer: number]
  readonly noises?: readonly (readonly [frame: number, x: number, z: number, radius: number])[]
  readonly hits?: readonly CrowdScenarioHit[]
  /** Runs the population (refill toward `target`, excess removal, the migration). */
  readonly population?: number
}

const FAR_POOL = [1000, 1000, 1001, 1001] as const
/** The golden keeps 4 decimals: a scenario's numbers are already rounded so the replay starts from the same place. */
const round4 = (value: number): number => Math.round(value * 1e4) / 1e4

/** The scripted runs of the horde: chase and slots, the pyramid on a wall, doors, the special moves, corpses and the trail, damage, population. */
export const CROWD_SCENARIOS: readonly CrowdScenario[] = [
  {
    id: 'chase_alerts_and_slots',
    seed: 101,
    fps: 30,
    frames: 300,
    every: 30,
    target: { x: 0, z: 0 },
    viewYaw: 0,
    agents: [
      ...Array.from({ length: 16 }, (_, k) => ({ x: round4(Math.cos(k * 0.39) * (5 + (k % 5) * 4)), z: round4(Math.sin(k * 0.39) * (5 + (k % 5) * 4)), type: k % 4 === 1 ? 1 : k % 4 === 3 ? 2 : 0 })),
      { x: 0, z: -2, type: 0, st: 1 },
      { x: 0.5, z: 1.2, type: 0, st: 1 },
      { x: -1.0, z: 0.3, type: 0, st: 1 },
      { x: 60, z: 0, type: 0 },
      { x: 140, z: 0, type: 0 },
    ],
    noises: [[45, 30, 30, 50]],
  },
  {
    id: 'night_crouch_smell',
    seed: 102,
    fps: 20,
    frames: 200,
    every: 20,
    night: 1,
    target: { x: 0, z: 0, crouch: true, bleeding: 1 },
    viewYaw: 1,
    agents: Array.from({ length: 10 }, (_, k) => ({ x: 4 + k * 2, z: (k % 3) - 1, type: k % 2 ? 4 : 0 })),
  },
  {
    id: 'wall_pyramid',
    seed: 103,
    fps: 30,
    frames: 600,
    every: 60,
    target: { x: 0, z: -6 },
    viewYaw: 0,
    walls: [[-30, -3, 30, -2.6, 2, 2.6]],
    agents: Array.from({ length: 18 }, (_, k) => ({ x: -2.5 + (k % 6), z: 1 + Math.floor(k / 6) * 0.9, type: 0, st: 1 })),
  },
  {
    id: 'door_bash',
    seed: 104,
    fps: 30,
    frames: 900,
    every: 90,
    target: { x: 0, z: 0 },
    viewYaw: 0,
    walls: [
      [-2.2, -2.2, -0.6, -2, 1, 3],
      [0.6, -2.2, 2.2, -2, 1, 3],
      [-2.2, 2, 2.2, 2.2, 1, 3],
      [-2.2, -2.2, -2, 2.2, 1, 3],
      [2, -2.2, 2.2, 2.2, 1, 3],
    ],
    doors: [[0, -2.1, 'x', 1.2]],
    agents: [
      { x: 0, z: -7, type: 3, st: 1 },
      { x: -1, z: -8, type: 0, st: 1 },
      { x: 1, z: -8, type: 0, st: 1 },
      { x: 0.4, z: -9, type: 0, st: 1 },
    ],
  },
  {
    id: 'special_moves',
    seed: 105,
    fps: 30,
    frames: 360,
    every: 30,
    target: { x: 0, z: 0 },
    viewYaw: 0,
    pool: [-3, 6, 3, 10],
    walls: [[3, -9, 6, -8.6, 1, 1.2]],
    agents: [
      { x: 5, z: 0, type: 5, st: 1 },
      { x: 0, z: -3.5, type: 6, st: 1 },
      { x: 14, z: 6, type: 9, st: 1 },
      { x: 0, z: 6, type: 7 },
      { x: 0, z: 8, type: 11 },
      { x: -20, z: 0, type: 8 },
      { x: 3.5, z: 2, type: 10, st: 1 },
      { x: -2, z: -6, type: 3, st: 1 },
      { x: 4.5, z: -12, type: 1, st: 1 },
      { x: -4, z: 4, type: 2, st: 1 },
    ],
    noises: [[20, -1, 0, 40]],
  },
  {
    id: 'corpses_devourer_trail_sniffer',
    seed: 106,
    fps: 20,
    frames: 500,
    every: 50,
    target: { x: 0, z: 0, bleeding: 1, walk: [0.8, 0] },
    viewYaw: 0,
    agents: [
      { x: 30, z: 30, type: 0 },
      { x: 31, z: 30.5, type: 0 },
      { x: 30.5, z: 31.5, type: 0 },
      { x: 34, z: 30, type: 12 },
      { x: -30, z: -2, type: 4 },
      { x: -32, z: 2, type: 0 },
      { x: -33, z: -4, type: 0 },
      { x: -35, z: 1, type: 0 },
    ],
    hits: [
      [0, 2, 0, 35, '9x19', 10, 0],
      [0, 1, 0, 35, '9x19', 10, 0],
      [0, 0, 0, 35, '9x19', 10, 0],
    ],
  },
  {
    id: 'damage_regions_calibres_outfits',
    seed: 107,
    fps: 10,
    frames: 40,
    every: 10,
    target: { x: 300, z: 300 },
    viewYaw: 0,
    agents: [
      { x: 0, z: 0, type: 0, outfit: 2 },
      { x: 2, z: 0, type: 0, outfit: 1 },
      { x: 4, z: 0, type: 3, outfit: 0 },
      { x: 6, z: 0, type: 1, outfit: 3 },
      { x: 8, z: 0, type: 2, outfit: 0 },
      { x: 10, z: 0, type: 11, outfit: 0 },
      { x: 12, z: 0, type: 6, outfit: 0 },
      { x: 14, z: 0, type: 0, outfit: 0 },
    ],
    hits: [
      [1, 0, 0, 35, '9x19', 10, 0],
      [2, 0, 0, 35, '9x19', 10, 0],
      [3, 1, 1, 35, '9x19', 10, 0],
      [3, 1, 1, 55, '762x39', 40, 0],
      [4, 2, 0, 12, '12ga', 4, 0],
      [5, 3, 4, 60, null, 1, 0.8],
      [5, 3, 2, 40, null, 1, 0.2],
      [6, 3, 4, 60, null, 1, 0.8],
      [6, 4, 3, 50, '308', 80, 0],
      [7, 5, 0, 30, null, 1, 0],
      [8, 6, 1, 200, '308', 30, 0],
      [9, 7, 5, 45, null, 1, 0],
      [10, 7, 5, 45, null, 1, 0],
      [11, 7, 0, 10, null, 1, 0],
      [12, 7, 0, 40, '12ga', 9, 0],
    ],
  },
  {
    id: 'population_and_migration',
    seed: 108,
    fps: 4,
    frames: 300,
    every: 20,
    snapshotAgents: 12,
    target: { x: 0, z: 0 },
    viewYaw: 0.5,
    agents: [],
    ring: [170, 150, 200],
    population: 40,
  },
]

type Field = { [index: number]: number }
type CrowdContext = {
  readonly Z: { n: number } & Readonly<Record<string, Field>>
  readonly zSpawn: (x: number, z: number, type?: number) => number
  readonly zDamage: (i: number, region: number, amount: number, caliber: string | null, distance: number, cut: number) => unknown
  readonly emitNoise: (x: number, z: number, r: number) => void
  readonly fillRect: (x0: number, z0: number, x1: number, z1: number, kind: number, h: number) => void
  readonly addDoor: (x: number, z: number, axis: string, w: number, b: unknown) => unknown
  readonly DOORS: { hp: number; open: boolean; broken: boolean }[]
  readonly CP: { n: number } & Readonly<Record<string, Field>>
  readonly TRAIL: { x: number; z: number; t: number }[]
  readonly stats: { kills: number; heads: number; slots: number; bands: number[] }
  readonly ROUPAS: readonly { capacete?: number }[]
  readonly CALIBRES: Readonly<Record<string, { classe: string; cranio: number }>>
  readonly POOL: { x0: number; z0: number; x1: number; z1: number }
  readonly __tick: (dt: number, population: boolean) => void
  readonly __pileCount: () => number
}

const r6 = (value: number): number => Math.round(value * 1e6) / 1e6
/** The game's sound names in the SDK's ids. */
export const CROWD_SOUND_OF: Readonly<Record<string, string>> = { gemido: 'groan', corredor: 'runner_groan', grito: 'scream_hoarse', passo: 'step', impacto: 'impact', carne: 'flesh', madeira: 'wood' }
/** The game's HUD lines in the SDK's message ids. */
const MESSAGE_OF: readonly (readonly [RegExp, string])[] = [
  [/Gritador chamou/, 'called'],
  [/Bile do Inchado/, 'burst_hit'],
  [/Brutamonte te derrubou/, 'swing_knock'],
  [/Saltador te derrubou/, 'pounce_knock'],
  [/horda está migrando/, 'migration'],
  [/porta cedeu/, 'door_broken'],
]

/** The agent fields of a snapshot: the game's name and the SDK's. */
export const CROWD_FIELDS = [
  ['x', 'x'],
  ['z', 'z'],
  ['y', 'y'],
  ['vx', 'vx'],
  ['vz', 'vz'],
  ['yaw', 'yaw'],
  ['ry', 'renderYaw'],
  ['st', 'state'],
  ['stT', 'stateTimer'],
  ['band', 'band'],
  ['hp', 'hp'],
  ['hpMax', 'hpMax'],
  ['miss', 'missing'],
  ['crawl', 'crawl'],
  ['limp', 'limp'],
  ['atkT', 'attackTimer'],
  ['cool', 'cooldown'],
  ['aT', 'abilityTimer'],
  ['lost', 'lost'],
  ['h', 'height'],
  ['b', 'build'],
  ['cat', 'type'],
  ['age', 'age'],
  ['roupa', 'outfit'],
  ['col', 'color'],
  ['vr', 'variant'],
  ['ph', 'phase'],
  ['arm', 'arms'],
  ['eat', 'eaten'],
] as const

const createCrowdHarness = (scenario: CrowdScenario) => {
  const source = readSource(SOURCE_PATHS.game)
  const horde = fromMarker(source, HORDE_MARKER)
  const worldSection = fromMarker(source, WORLD_MARKER)
  let stream = createSeededRandom(scenario.seed)
  let recorder: EventRecorder = createEventRecorder()
  const target = {
    x: scenario.target.x,
    z: scenario.target.z,
    y: 0,
    andar: 0,
    alive: true,
    turned: false,
    crouch: scenario.target.crouch ?? false,
    bleeding: scenario.target.bleeding ?? 0,
    scentT: 0,
    screamBoost: 0,
    grabbedBy: -1,
    blind: 0,
    burnT: 0,
    grab(i: number, noJaw: boolean, drown: boolean) {
      target.grabbedBy = i
      recorder.record('target', { verb: 'grab', by: i, noJaw, drown })
    },
    hurt(amount: number, by: number) {
      recorder.record('target', { verb: 'hurt', amount: r6(amount), by })
    },
    knock(seconds: number) {
      recorder.record('target', { verb: 'knock', seconds })
    },
    release() {
      recorder.record('target', { verb: 'release', by: target.grabbedBy })
      target.grabbedBy = -1
    },
  }
  const view = { yaw: scenario.viewYaw }
  const effect = (kind: string, payload: Record<string, EventValue>) => recorder.record('effect', { effect: kind, ...payload })
  const tail = [
    cutDeclaration(source, 'WORLD'),
    cutDeclaration(worldSection, 'GC'),
    cutDeclaration(worldSection, 'occ'),
    cutDeclaration(worldSection, 'occH'),
    cutDeclaration(worldSection, 'cellOf'),
    cutFunction(worldSection, 'solidAt'),
    cutFunction(worldSection, 'fillRect'),
    cutDeclaration(fromMarker(source, BANDS_MARKER), 'BANDS'),
    cutDeclaration(fromMarker(source, BANDS_MARKER), 'HYST'),
    cutDeclaration(fromMarker(source, BANDS_MARKER), 'CORPOS_MAX'),
    cutFunction(source, 'walkCad'),
    cutDeclaration(source, 'DOORS'),
    cutDeclaration(source, 'doorAt'),
    cutDeclaration(source, 'PORTA_VIDA'),
    cutFunction(source, 'addDoor'),
    cutFunction(source, 'setDoor'),
    cutFunction(source, 'doorHit'),
    cutDeclaration(horde, 'FW'),
    cutDeclaration(horde, 'FLOW_R'),
    cutDeclaration(horde, 'flow'),
    cutDeclaration(horde, 'HC'),
    cutDeclaration(horde, 'hHead'),
    cutDeclaration(horde, 'noises'),
    cutFunction(horde, 'emitNoise'),
    cutDeclaration(horde, 'stats'),
    cutDeclaration(horde, 'nightF'),
    cutDeclaration(horde, 'groanBudget'),
    cutDeclaration(horde, 'CP'),
    'CP.searched = new Uint8Array(CORPOS_MAX);',
    cutDeclaration(horde, 'popTarget'),
    cutDeclaration(horde, 'migrateT'),
    cutDeclaration(horde, 'pile'),
    cutDeclaration(horde, 'PILE_STEP'),
    cutDeclaration(horde, 'pileN'),
    cutDeclaration(horde, 'POOL'),
    cutDeclaration(horde, 'inWater'),
    cutDeclaration(horde, 'TRAIL'),
    cutDeclaration(horde, 'trailLast'),
    cutDeclaration(horde, 'killQ'),
    // the game loop's order: the groan budget, the trail, the horde, the population, the corpses (G 69xxx `loop`)
    'function __tick(dt, population) { groanBudget -= dt; trailUpdate(dt); hordeUpdate(dt); if (population) populationUpdate(dt); corpsesUpdate(dt); }',
    'function __pileCount() { return pileN; }',
    'function __setNight(v) { nightF = v; }',
  ].join('\n')
  const camera = { position: { x: scenario.target.x, z: scenario.target.z } }
  const scope = {
    R: () => stream(),
    performance: { now: () => 0 },
    location: { search: scenario.population === undefined ? '' : `?pop=${scenario.population}` },
    URLSearchParams,
    player: target,
    view,
    camera,
    scene: { fog: { far: 150 } },
    ROOF: { on: false },
    ANDARES: { lista: [], andarP: 0, casaP: null, casaEm: () => null },
    voz: (kind: string, d: number) => recorder.record('sound', { sound: CROWD_SOUND_OF[kind] ?? kind, volume: 1, distance: Math.round(d * 1e4) / 1e4 }),
    sfx: (kind: string, volume: number, d: number) => recorder.record('sound', { sound: CROWD_SOUND_OF[kind] ?? kind, volume, distance: Math.round(d * 1e4) / 1e4 }),
    hudMsg: (text: string, seconds: number) => recorder.record('message', { id: MESSAGE_OF.find(([pattern]) => pattern.test(text))?.[1] ?? text, seconds }),
    fxSpark: () => effect('spark', {}),
    fxBlood: (_x: number, _y: number, _z: number, _age: unknown, amount: number, died: boolean) => effect('blood', { amount, died: !!died }),
    fxLimb: (_i: number, region: number, severed: boolean) => effect('limb', { region, severed: !!severed }),
    fxCloud: (_x: number, _z: number, radius: number, color: number) => effect('cloud', { radius, color }),
    fxDust: () => effect('dust', {}),
    zChaseNpc: () => false,
  }
  const context = evaluateGameSlice<CrowdContext & { __setNight: (v: number) => void }>({
    functions: [
      'zSpawn',
      'zRemove',
      'flowStart',
      'flowStep',
      'zBlocked',
      'losClear',
      'hordeUpdate',
      'groan',
      'screamAt',
      'zAttack',
      'zDamage',
      'zKill',
      'inchadoBurst',
      'corpseAdd',
      'corpsesUpdate',
      'spawnAway',
      'populationUpdate',
      'groundAt',
      'zBlockedAt',
      'tryStep',
      'stepRelease',
      'pileBlast',
      'trailUpdate',
      'zSpecialSpawn',
      'zAbility',
      'zChaseSpeed',
      'zHurtOther',
      'zDeferKill',
      'killQFlush',
      'zFrame',
    ],
    exports: ['Z', 'zSpawn', 'zDamage', 'emitNoise', 'fillRect', 'addDoor', 'DOORS', 'CP', 'TRAIL', 'stats', 'ROUPAS', 'CALIBRES', 'POOL', '__tick', '__pileCount', '__setNight'],
    scope,
    tail,
    capacity: CAPACITY,
  })
  context.__setNight(scenario.night ?? 0)
  return { context, target, setRecorder: (next: EventRecorder) => void (recorder = next), setSeed: (seed: number) => void (stream = createSeededRandom(seed)) }
}

/** G-crowd: the game's horde (`hordeUpdate` and everything it calls, doors, corpses, the trail and the population) on scripted scenes. */
export const recordCrowdGolden = (): GoldenRecord => {
  const recorder = createEventRecorder()
  {
    // the game's calibres as the crowd reads them (class and skull distance), for the SDK replay
    const { context } = createCrowdHarness(CROWD_SCENARIOS[0]!)
    const calibres: Record<string, EventValue> = {}
    for (const [id, c] of Object.entries(context.CALIBRES)) calibres[id] = { id, class: c.classe === 'pistola' ? 'pistol' : 'rifle', skull: c.cranio }
    recorder.record('calibres', calibres)
  }
  for (const scenario of CROWD_SCENARIOS) {
    const harness = createCrowdHarness(scenario)
    const { context, target } = harness
    const { Z } = context
    harness.setRecorder(recorder)
    const pool = scenario.pool ?? FAR_POOL
    Object.assign(context.POOL, { x0: pool[0], z0: pool[1], x1: pool[2], z1: pool[3] })
    for (const wall of scenario.walls ?? []) context.fillRect(...wall)
    for (const [x, z, axis, w] of scenario.doors ?? []) context.addDoor(x, z, axis, w, null)
    recorder.record('scenario', { scenario: scenario as unknown as EventValue })
    for (const agent of scenario.agents) {
      const i = context.zSpawn(agent.x, agent.z, agent.type)
      if (agent.st !== undefined) Z.st![i] = agent.st
      if (agent.outfit !== undefined) {
        Z.roupa![i] = agent.outfit
        Z.capacete![i] = context.ROUPAS[agent.outfit]?.capacete ? 1 : 0
      }
    }
    if (scenario.ring) {
      const [count, inner, outer] = scenario.ring
      for (let k = 0; k < count; k++) {
        const a = (k / count) * 6.28318
        const r = inner + ((k * 37) % 50) / 50 * (outer - inner)
        context.zSpawn(target.x + Math.cos(a) * r, target.z + Math.sin(a) * r)
      }
    }
    let frame = 0
    const snapshot = () => {
      const agents: EventValue[] = []
      const shown = Math.min(Z.n, scenario.snapshotAgents ?? Z.n)
      for (let i = 0; i < shown; i++) {
        const row: Record<string, EventValue> = {}
        for (const [from, to] of CROWD_FIELDS) row[to] = r6(Z[from]![i]!)
        agents.push(row)
      }
      recorder.record('state', {
        frame,
        n: Z.n,
        kills: context.stats.kills,
        heads: context.stats.heads,
        slots: context.stats.slots,
        bands: context.stats.bands.join(','),
        corpses: context.CP.n,
        trail: context.TRAIL.length,
        pile: context.__pileCount(),
        doors: context.DOORS.map((d) => `${d.hp}:${d.broken ? 1 : 0}`).join(','),
        target: { grabbedBy: target.grabbedBy, blind: r6(target.blind), scent: r6(target.scentT), boost: r6(target.screamBoost), burn: r6(target.burnT) },
        agents,
      })
    }
    const dt = 1 / scenario.fps
    for (let k = 0; k < scenario.frames; k++) {
      for (const [at, x, z, r] of scenario.noises ?? []) if (at === k) context.emitNoise(x, z, r)
      for (const [at, agent, region, amount, caliber, distance, cut] of scenario.hits ?? []) if (at === k && agent < Z.n) context.zDamage(agent, region, amount, caliber, distance, cut)
      if (scenario.target.walk) {
        target.x += scenario.target.walk[0] * dt
        target.z += scenario.target.walk[1] * dt
      }
      context.__tick(dt, scenario.population !== undefined)
      frame++
      if (frame % scenario.every === 0) snapshot()
    }
    if (frame % scenario.every !== 0) snapshot()
  }
  return createGoldenRecord({ name: 'game-crowd', seed: 20261022, events: recorder.events() })
}
