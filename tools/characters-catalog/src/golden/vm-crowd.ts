import { cutBetween, cutDeclaration, cutFunction } from '@adatechnology/golden-tool/cut-source'
import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventRecorder, EventValue, GoldenRecord } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from '../paths'
import { fromMarker, readSource } from '../read-source'
import { evaluateGameSlice } from './game-context'

const HORDE_MARKER = '// ===== Horda: simulação com relevância (R0..R3), percepção, combate, corpos ====='
const WORLD_MARKER = '// ===== Mundo: quarteirão do Jardim Aurora (brief da fatia vertical) e arredores ====='
const BANDS_MARKER = '// Relevância (revisão, seção 4)'
const CORE_MARKER = '// ===== Núcleo: render, entrada, som, utilidades ====='
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
  /** Survivors on the block (the game's `NPC`, `npcUpdate`): buildings, people, the hour, and when they join the group or leave. */
  readonly civilians?: CivilianScenario
  /** Animals (the game's `BICHO`, `bichosUpdate`) and the vultures. */
  readonly herd?: HerdScenario
}

/** One animal: the game's species id (the code reads `cao` and `galinha`), the SDK's, the gait rates and size, and `bichoNovo`'s options. */
export type HerdScenarioAnimal = {
  readonly game: string
  readonly species: string
  readonly x: number
  readonly z: number
  readonly walkHz: number
  readonly runHz: number
  readonly size: number
  readonly o: { readonly raio?: number; readonly medo?: number; readonly alarme?: number; readonly mugido?: number; readonly companheiro?: number; readonly ceu?: number }
  readonly dead?: boolean
}
export type HerdScenario = { readonly animals: readonly HerdScenarioAnimal[]; readonly buildings?: readonly (readonly [number, number, number, number])[] }

export type CivilianScenarioBuilding = { readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly house?: boolean; readonly front: -1 | 1 }
export type CivilianScenarioPerson = {
  readonly id: string
  readonly home: string
  readonly child?: boolean
  readonly color?: number
  readonly routine?: readonly (readonly [number, string])[]
  readonly leader?: string
  readonly followDistance?: number
}
export type CivilianScenario = {
  readonly buildings: Readonly<Record<string, CivilianScenarioBuilding>>
  readonly people: readonly CivilianScenarioPerson[]
  /** The hour at the start and how many hours pass per second. */
  readonly hour: readonly [start: number, perSecond: number]
  readonly join?: readonly (readonly [frame: number, id: string])[]
  readonly flee?: readonly (readonly [frame: number, id: string, path: readonly (readonly [number, number])[]])[]
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

const BLOCK: CivilianScenario['buildings'] = {
  'Casa 2': { x: 6, z: -20, w: 8, d: 10, house: true, front: -1 },
  'Casa 5': { x: -6, z: 10, w: 8, d: 10, house: true, front: 1 },
  Mercadinho: { x: 20, z: 10, w: 10, d: 10, front: 1 },
}

/** The survivors' scenes: routines through a door with agents around, a group that follows and then leaves, a bitten survivor that turns. */
export const CIVILIAN_SCENARIOS: readonly CrowdScenario[] = [
  {
    id: 'routine_door_and_hunt',
    seed: 201,
    fps: 20,
    frames: 900,
    every: 45,
    target: { x: 0, z: 40 },
    viewYaw: 0,
    doors: [[10, -10, 'x', 1.2]],
    agents: [
      { x: 18, z: 2, type: 0 },
      { x: 16, z: 4, type: 0 },
      { x: 30, z: 3, type: 0 },
      { x: -3, z: 4, type: 0 },
    ],
    civilians: {
      buildings: BLOCK,
      people: [
        { id: 'cicero', home: 'Casa 2', color: 0x6a5a3a, routine: [[19, 'Mercadinho']] },
        { id: 'sandra', home: 'Casa 5', color: 0x8a3a5a, routine: [[19.5, 'Mercadinho']] },
      ],
      hour: [18.95, 0.02],
    },
  },
  {
    id: 'group_follow_and_flee',
    seed: 202,
    fps: 20,
    frames: 600,
    every: 30,
    target: { x: -2, z: 6, walk: [1, 0] },
    viewYaw: 0,
    agents: [
      { x: 30, z: 0, type: 1 },
      { x: 26, z: -3, type: 0 },
    ],
    civilians: {
      buildings: BLOCK,
      people: [
        { id: 'helena', home: 'Casa 5', color: 0x3e6a8a },
        { id: 'davi', home: 'Casa 5', child: true, color: 0xd0a030, leader: 'helena', followDistance: 1.2 },
      ],
      hour: [9, 0],
      join: [
        [0, 'helena'],
        [0, 'davi'],
      ],
      flee: [[300, 'helena', [[10, 6], [30, 6], [40, 20]]]],
    },
  },
  {
    id: 'bitten_turns',
    seed: 203,
    fps: 5,
    frames: 800,
    every: 40,
    target: { x: 0, z: -60 },
    viewYaw: 0,
    agents: [
      { x: 0, z: 7, type: 0, st: 1 },
      { x: 2, z: 7, type: 0, st: 1 },
      { x: -2, z: 6, type: 0, st: 1 },
      { x: 4, z: 8, type: 0, st: 1 },
    ],
    civilians: {
      buildings: BLOCK,
      people: [{ id: 'sandra', home: 'Casa 5', color: 0x8a3a5a, routine: [[12, 'Mercadinho']] }],
      hour: [12, 0],
    },
  },
]

/** The animals' scenes: a yard and a farm with a companion dog, hens, a lapwing, cows, a horse, a pig, capybaras, a dead cow and vultures. */
export const HERD_SCENARIOS: readonly CrowdScenario[] = [
  {
    id: 'yard_farm_and_vultures',
    seed: 301,
    fps: 20,
    frames: 700,
    every: 35,
    target: { x: 0, z: 0, walk: [0.4, 0.2] },
    viewYaw: 0,
    agents: [
      { x: 22, z: 2, type: 0 },
      { x: -16, z: 9, type: 0 },
      { x: 9, z: -14, type: 1 },
    ],
    herd: {
      buildings: [[-30, 20, 8, 8]],
      animals: [
        { game: 'cao', species: 'dog', x: 2, z: 3, walkHz: 1.6, runHz: 2.9, size: 0.8, o: { companheiro: 1, raio: 6, medo: 0 } },
        { game: 'gato', species: 'cat', x: 12, z: -6, walkHz: 1.9, runHz: 3.4, size: 0.45, o: { raio: 6, medo: 5 } },
        { game: 'galinha', species: 'chicken', x: -8, z: 4, walkHz: 2.2, runHz: 4, size: 0.4, o: { raio: 4, medo: 4 } },
        { game: 'galinha', species: 'chicken', x: -8.5, z: 5, walkHz: 2.2, runHz: 4, size: 0.4, o: { raio: 4, medo: 4 } },
        { game: 'galinha', species: 'chicken', x: -7.5, z: 4.6, walkHz: 2.2, runHz: 4, size: 0.4, o: { raio: 4, medo: 4 } },
        { game: 'queroquero', species: 'southern_lapwing', x: 8, z: 5, walkHz: 2.5, runHz: 1.6, size: 0.35, o: { raio: 5, medo: 0, alarme: 12 } },
        { game: 'vaca', species: 'cow', x: -20, z: -10, walkHz: 1, runHz: 2, size: 1.7, o: { raio: 10, medo: 6, mugido: 1 } },
        { game: 'vaca', species: 'cow', x: -24, z: -12, walkHz: 1, runHz: 2, size: 1.7, o: { raio: 10, medo: 6, mugido: 1 } },
        { game: 'cavalo', species: 'horse', x: -26, z: -4, walkHz: 1, runHz: 2.1, size: 1.9, o: { raio: 10, medo: 7 } },
        { game: 'porco', species: 'pig', x: -14, z: -16, walkHz: 1.4, runHz: 2.6, size: 0.9, o: { raio: 5, medo: 3 } },
        { game: 'capivara', species: 'capybara', x: 18, z: 14, walkHz: 1.2, runHz: 2.6, size: 0.9, o: { raio: 8, medo: 15 } },
        { game: 'vaca', species: 'cow', x: -18, z: -24, walkHz: 1, runHz: 2, size: 1.7, o: { raio: 0 }, dead: true },
        { game: 'urubu', species: 'vulture', x: 0, z: 0, walkHz: 1.4, runHz: 1, size: 0.6, o: { ceu: 1 } },
        { game: 'urubu', species: 'vulture', x: 0, z: 0, walkHz: 1.4, runHz: 1, size: 0.6, o: { ceu: 1 } },
        { game: 'urubu', species: 'vulture', x: 0, z: 0, walkHz: 1.4, runHz: 1, size: 0.6, o: { ceu: 1 } },
      ],
    },
    hits: [
      [400, 0, 0, 35, '9x19', 10, 0],
    ],
  },
]

type Field = { [index: number]: number }
type CrowdContext = {
  readonly NPC?: unknown
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
  [/Quero-quero gritando/, 'alarm'],
  [/Caramelo latindo/, 'bark'],
  [/Caramelo rosnando/, 'growl'],
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
  ['npc', 'hunts'],
  ['named', 'named'],
] as const

/** The game's survivor states in the SDK's names. */
export const CIVILIAN_STATE_OF: Readonly<Record<string, string>> = { casa: 'home', andando: 'walking', grupo: 'group', fugindo: 'fleeing', partiu: 'gone', morto: 'dead', zumbi: 'undead' }

/**
 * What the survivors' code reads from the rest of the game: the people as the game's `NPC` rows (no lines, items or radio), the buildings by name
 * (`casaDe`), the hour, and the diary and the news as records of what happened.
 */
const civilianScope = (civilians: CivilianScenario, hourOf: () => number, record: (type: string, payload: Record<string, EventValue>) => void): Record<string, unknown> => {
  const buildings = Object.fromEntries(Object.entries(civilians.buildings).map(([name, b]) => [name, { x: b.x, z: b.z, w: b.w, d: b.d, tipo: b.house ? 'casa' : 'loja', frente: b.front, nome: name }]))
  const people = civilians.people.map((p) => ({ id: p.id, n: p.id, curto: p.id, casa: p.home, cor: p.color ?? 0x808080, item: 'Item', loot: [], fala: [], ...(p.child ? { crianca: 1 } : {}), ...(p.routine ? { rotina: p.routine.map((r) => [...r]) } : {}) }))
  return {
    __civ: people,
    casaDe: (name: string) => buildings[name],
    hourNow: () => hourOf(),
    valeClock: () => undefined,
    radioTick: () => undefined,
    noticia: () => undefined,
    diario: (text: string, fonte: string) => {
      const bitten = / foi mordid/.exec(text)
      if (bitten) record('civilian', { event: 'bitten', id: text.slice(0, bitten.index), near: fonte === 'vista' })
    },
    morteNoticia: (n: { id: string; zi?: number }, what: string) =>
      record('civilian', what.includes('mortos') ? { event: 'turned', id: n.id, agent: n.zi ?? -1 } : { event: 'died', id: n.id, cause: 'attacked' }),
  }
}

const BICHO_SOUND_OF: Readonly<Record<string, string>> = { latido: 'bark', cacarejo: 'cluck', queroquero: 'lapwing', mugido: 'moo' }

/** What the animals' code reads from the rest of the game: no rig and no skin (the drawing), the buildings as rectangles, the calls as records. */
const herdScope = (herd: HerdScenario, record: (type: string, payload: Record<string, EventValue>) => void): Record<string, unknown> => ({
  BICHOS: { st: {}, animSnake: () => undefined, animBird: () => undefined, animQuad: () => undefined },
  bichoOssos: () => undefined,
  bichoSom: (kind: string, dist: number) => record('sound', { sound: BICHO_SOUND_OF[kind] ?? kind, distance: Math.round(dist * 1e4) / 1e4 }),
  wasPressed: () => false,
  BUILDINGS: (herd.buildings ?? []).map(([x, z, w, d]) => ({ x, z, w, d })),
  state: 'play',
  __noise: (x: number, z: number, radius: number) => record('noise', { x: Math.round(x * 1e4) / 1e4, z: Math.round(z * 1e4) / 1e4, radius }),
})

/** A mesh stand-in that keeps what `bichosUpdate` writes (the vultures' place is read back from it). */
const meshStub = () => {
  const position = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { Object.assign(position, { x, y, z }) } }
  const rotation = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { Object.assign(rotation, { x, y, z }) } }
  return { visible: true, position, rotation, castShadow: false }
}

/** One instance the game's `BodyBatch.push` took: the batch (variant and level; -1 the plain corpse batch, -2-k the k-th survivor batch), the 12 shader numbers, the colour as hex and shade, the eye and the height. */
type RenderPush = { v: number; l: number; n: number[]; color: number; shade: number; eye: number | null; y: number }

/**
 * The drawing side of a frame (G 67098 `hordeRender`, G 70177 `npcRender`) with the meshes stubbed: `BodyBatch` keeps what each `push` gets and `THREE.Color` keeps
 * the hex and the shade it is multiplied by. A variant's `s` and `bulk` are fixed numbers (the bake is the drawing's; the SDK test gives the same ones).
 */
const renderTail = (source: string, horde: string, civilians: boolean): string[] => [
  cutFunction(source, 'walkGait'),
  'class BodyBatch { constructor(geo, max) { this.geo = geo; this.max = max; this.n = 0; } begin() { this.n = 0; } push(...a) { if (this.n >= this.max) return; this.n++; __push(this.geo, a); } end() {} }',
  'const BODY_LOD = [{ v: -1, l: 0 }, { v: -1, l: 1 }, { v: -1, l: 2 }];',
  'const ZVAR = ZVAR_OF.flat().map((g) => ({ s: __variantS(g), bulk: __variantBulk(g), B: [0, 1, 2].map((l) => new BodyBatch({ v: g, l }, [160, 700, 2600][l])) }));',
  cutDeclaration(horde, 'ZB'),
  cutDeclaration(horde, 'CB'),
  cutDeclaration(horde, '_c1'),
  cutDeclaration(horde, 'LOD_D'),
  cutDeclaration(horde, 'lodCounts'),
  cutFunction(horde, 'hordeRender'),
  ...(civilians
    ? [
        // one batch per survivor (the game has five portraits and caps `use` at the last one; the instance numbers are the same)
        'const PB = (() => { const B = Array.from({ length: 16 }, (_, k) => new BodyBatch({ v: -2 - k, l: 0 }, 4)); let cur = 0; return { use(k) { cur = Math.min(k, B.length - 1); }, begin() { B.forEach((b) => b.begin()); cur = 0; }, end() {}, push(...a) { B[cur].push(...a); } }; })();',
        cutDeclaration(source, 'NPC_COL'),
        cutFunction(source, 'npcRender'),
      ]
    : []),
  `function __render() { ${civilians ? 'PB.begin(); PB.use(0); ' : ''}hordeRender(); ${civilians ? 'npcRender(); PB.end(); ' : ''}}`,
]

/** The fixed `s` and `bulk` of variant `g` in the render golden. */
export const RENDER_VARIANT = (g: number): { s: number; bulk: number } => ({ s: 1.6 + (g % 5) * 0.03, bulk: 0.9 + (g % 3) * 0.05 })

/** THREE.Color as the render golden reads it: the hex it was set to and the shade it was multiplied by. */
class ColorStub {
  hex = 0
  k = 1
  constructor(value?: number) {
    if (value !== undefined) this.set(value)
  }
  set(value: number | ColorStub): this {
    if (typeof value === 'number') {
      this.hex = value
      this.k = 1
    } else {
      this.hex = value.hex
      this.k = value.k
    }
    return this
  }
  multiplyScalar(k: number): this {
    this.k *= k
    return this
  }
}

/** The game code the harness cuts in around the slice; it depends only on the scenario kind, so each kind is cut once per process. */
const crowdTailCache = new Map<string, string>()
const crowdTail = (scenario: CrowdScenario, render: boolean): string => {
  const key = `${!!scenario.civilians}|${!!scenario.herd}|${render}`
  const cached = crowdTailCache.get(key)
  if (cached !== undefined) return cached
  const source = readSource(SOURCE_PATHS.game)
  const horde = fromMarker(source, HORDE_MARKER)
  const worldSection = fromMarker(source, WORLD_MARKER)
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
    ...(scenario.civilians
      ? [
          cutDeclaration(source, 'INFEC'),
          cutDeclaration(fromMarker(source, CORE_MARKER), 'lerp'),
          'const NPC = __civ;',
          cutBetween(source, 'for (const n of NPC) {\n  const b = casaDe', 'const nIdx'),
        ]
      : []),
    ...(scenario.herd
      ? [
          cutDeclaration(source, 'BICHO'),
          cutDeclaration(source, 'bichosProntos'),
          cutDeclaration(source, 'URUBUS'),
          cutDeclaration(source, 'bichoT'),
          cutFunction(source, 'bichoLivre'),
          cutFunction(source, 'zumbiPerto'),
          cutFunction(source, 'bichosUpdate'),
          'bichosProntos = true;',
          "function __addBicho(E) { BICHO.push(E); if (E.ceu) URUBUS.push(E); if (E.companheiro && E.id === 'cao') caramelo = E; }",
          // the noises the animals make reach the horde as in the game; the golden notes each one
          'const __emitNoise0 = emitNoise; emitNoise = function (x, z, r) { __noise(x, z, r); __emitNoise0(x, z, r); };',
        ]
      : []),
    `function __tick(dt, population) { groanBudget -= dt; trailUpdate(dt); ${scenario.civilians ? 'npcUpdate(dt); ' : ''}${scenario.herd ? 'bichosUpdate(dt); ' : ''}hordeUpdate(dt); if (population) populationUpdate(dt); corpsesUpdate(dt); }`,
    'function __pileCount() { return pileN; }',
    'function __setNight(v) { nightF = v; }',
    ...(render ? renderTail(source, horde, !!scenario.civilians) : []),
  ].join('\n')
  crowdTailCache.set(key, tail)
  return tail
}

const createCrowdHarness = (scenario: CrowdScenario, render = false) => {
  let stream = createSeededRandom(scenario.seed)
  let recorder: EventRecorder = createEventRecorder()
  const target = {
    x: scenario.target.x,
    z: scenario.target.z,
    y: 0,
    andar: 0,
    yaw: 0,
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
  let hour = scenario.civilians?.hour[0] ?? 12
  const effect = (kind: string, payload: Record<string, EventValue>) => recorder.record('effect', { effect: kind, ...payload })
  const pushes: RenderPush[] = []
  const tail = crowdTail(scenario, render)
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
    hudMsg: (text: string, seconds: number) => {
      if (/ foi mordid| reanimou\./.test(text)) return // a survivor's line: recorded from the diary and the news
      recorder.record('message', { id: MESSAGE_OF.find(([pattern]) => pattern.test(text))?.[1] ?? text, seconds })
    },
    fxSpark: () => effect('spark', {}),
    fxBlood: (_x: number, _y: number, _z: number, _age: unknown, amount: number, died: boolean) => effect('blood', { amount, died: !!died }),
    fxLimb: (_i: number, region: number, severed: boolean) => effect('limb', { region, severed: !!severed }),
    fxCloud: (_x: number, _z: number, radius: number, color: number) => effect('cloud', { radius, color }),
    fxDust: () => effect('dust', {}),
    ...(scenario.herd ? herdScope(scenario.herd, (type, payload) => recorder.record(type, payload)) : {}),
    ...(scenario.civilians ? civilianScope(scenario.civilians, () => hour, (type, payload) => recorder.record(type, payload)) : { zChaseNpc: () => false }),
    ...(render
      ? {
          THREE: { Color: ColorStub },
          __variantS: (g: number) => RENDER_VARIANT(g).s,
          __variantBulk: (g: number) => RENDER_VARIANT(g).bulk,
          __push: (geo: { v: number; l: number }, a: unknown[]) => {
            const col = a[12] as ColorStub
            const eye = a[13] as ColorStub | null
            pushes.push({ v: geo.v, l: geo.l, n: (a.slice(0, 12) as number[]).map(Number), color: col.hex, shade: col.k, eye: eye ? eye.hex : null, y: (a[14] as number | undefined) ?? 0 })
          },
        }
      : {}),
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
      ...(scenario.civilians ? ['solidAtA', 'pontos', 'rota', 'npcExposed', 'npcZombies', 'zChaseNpc', 'npcMorre', 'npcVira', 'npcMove', 'npcUpdate'] : []),
    ],
    exports: [...(render ? ['__render'] : []), ...(scenario.civilians ? ['NPC'] : []), ...(scenario.herd ? ['BICHO', 'URUBUS', '__addBicho'] : []), 'Z', 'zSpawn', 'zDamage', 'emitNoise', 'fillRect', 'addDoor', 'DOORS', 'CP', 'TRAIL', 'stats', 'ROUPAS', 'CALIBRES', 'POOL', '__tick', '__pileCount', '__setNight'],
    scope,
    tail,
    capacity: CAPACITY,
  })
  context.__setNight(scenario.night ?? 0)
  if (scenario.herd) {
    // bichoNovo without the rig: the heading and the first rest are drawn in its order (the rig's own draw is the drawing's)
    for (const a of scenario.herd.animals) {
      const E: Record<string, unknown> = {
        A: { ph: 0, wings: [], legs: [] },
        pele: { mesh: meshStub() },
        id: a.game,
        sp: { walkHz: a.walkHz, runHz: a.runHz },
        x: a.x,
        z: a.z,
        yaw: stream() * 6.28,
        hx: a.x,
        hz: a.z,
        raio: 8,
        clip: 'idle',
        t: stream() * 4,
        tx: a.x,
        tz: a.z,
        medo: 5,
        voa: 0,
        cool: 0,
        vAnda: a.walkHz * a.size * 1.05 + 0.25,
        vCorre: a.runHz * a.size * 2.2 + 0.8,
        ...a.o,
      }
      if (a.dead) E.morto = 1
      ;(context as unknown as { __addBicho: (e: unknown) => void }).__addBicho(E)
    }
  }
  return { context, target, camera, view, pushes, setHour: (next: number) => void (hour = next), setRecorder: (next: EventRecorder) => void (recorder = next), setSeed: (seed: number) => void (stream = createSeededRandom(seed)) }
}

type Civ = { id: string; x: number; z: number; vx: number; vz: number; yaw: number; hp: number; st: string; bitT: number; pi: number; ph: number; path: unknown; zi?: number }

/** The game's survivor states in the codes the render golden packs (the SDK's order of `CIVILIAN_STATE_OF`). */
const CIVILIAN_CODE: Readonly<Record<string, number>> = { casa: 0, andando: 1, grupo: 2, fugindo: 3, partiu: 4, morto: 5, zumbi: 6 }
/** The fields of an agent `hordeRender` reads, in the order the render golden packs them (exact numbers, as text: the 4-decimal rounding would move the start). */
export const RENDER_AGENT_FIELDS = ['x', 'z', 'ry', 'ph', 'h', 'b', 'rs', 'st', 'stT', 'miss', 'age', 'arm', 'skin', 'col', 'cat', 'y', 'crawl', 'vr', 'lod', 'ap'] as const
export const RENDER_CORPSE_FIELDS = ['x', 'z', 'yaw', 'seed', 'h', 'b', 't', 'miss', 'skin', 'col', 'vr'] as const

const recordScenes = (name: string, scenes: readonly CrowdScenario[], withCalibres: boolean, render = false): GoldenRecord => {
  const recorder = createEventRecorder()
  if (withCalibres) {
    // the game's calibres as the crowd reads them (class and skull distance), for the SDK replay
    const { context } = createCrowdHarness(CROWD_SCENARIOS[0]!)
    const calibres: Record<string, EventValue> = {}
    for (const [id, c] of Object.entries(context.CALIBRES)) calibres[id] = { id, class: c.classe === 'pistola' ? 'pistol' : 'rifle', skull: c.cranio }
    recorder.record('calibres', calibres)
  }
  for (const scenario of scenes) {
    const harness = createCrowdHarness(scenario, render)
    const { context, target } = harness
    const { Z } = context
    // the render golden keeps only what the drawing got; the horde's own events are in the other goldens
    harness.setRecorder(render ? createEventRecorder() : recorder)
    const pool = scenario.pool ?? FAR_POOL
    Object.assign(context.POOL, { x0: pool[0], z0: pool[1], x1: pool[2], z1: pool[3] })
    for (const wall of scenario.walls ?? []) context.fillRect(...wall)
    for (const [x, z, axis, w] of scenario.doors ?? []) context.addDoor(x, z, axis, w, null)
    if (render) recorder.record('scene', { id: scenario.id, fps: scenario.fps })
    else recorder.record('scenario', { scenario: scenario as unknown as EventValue })
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
      if (scenario.herd) {
        const herd = (context as unknown as { BICHO: Record<string, number & string>[] }).BICHO
        herd.forEach((E, index) => {
          if (E.ceu) return
          recorder.record('animal', { frame, index, x: r6(E.x), z: r6(E.z), yaw: r6(E.yaw), clip: E.clip, timer: r6(E.t), cooldown: r6(E.cool), fly: r6(E.voa), targetX: r6(E.tx), targetZ: r6(E.tz) })
        })
        const vultures = (context as unknown as { URUBUS: { pele: { mesh: ReturnType<typeof meshStub> } }[] }).URUBUS
        vultures.forEach((U, i) => {
          const m = U.pele.mesh
          recorder.record('vulture', { frame, i, x: r6(m.position.x), y: r6(m.position.y), z: r6(m.position.z), yaw: r6(m.rotation.y), visible: m.visible })
        })
      }
      if (scenario.civilians)
        for (const n of context.NPC as Civ[])
          recorder.record('civilian_state', { frame, id: n.id, x: r6(n.x), z: r6(n.z), vx: r6(n.vx), vz: r6(n.vz), yaw: r6(n.yaw), hp: r6(n.hp), state: CIVILIAN_STATE_OF[n.st] ?? n.st, biteTimer: r6(n.bitT), pathIndex: n.pi, phase: r6(n.ph) })
    }
    // the game draws every frame (the attack pose it sets is read back by the horde); a frame on the beat is written with what the drawing read
    const drawFrame = (write: boolean) => {
      const pack = (rows: number, fields: readonly string[], of: Readonly<Record<string, Field>>) =>
        Array.from({ length: rows }, (_, i) => fields.map((f) => String(of[f]![i]!)).join(',')).join(';')
      const agents = write ? pack(Z.n, RENDER_AGENT_FIELDS, Z) : ''
      const corpses = write ? pack(context.CP.n, RENDER_CORPSE_FIELDS, context.CP) : ''
      const people = scenario.civilians && write ? (context.NPC as (Civ & { crianca?: number; k: number; y?: number; cor: number })[]).map((n) => [n.x, n.z, n.yaw, n.ph, n.vx, n.vz, n.crianca ? 1 : 0, n.bitT, n.k, CIVILIAN_CODE[n.st] ?? -1, n.y ?? 0, n.cor].map(String).join(',')).join(';') : ''
      harness.pushes.length = 0
      ;(context as unknown as { __render: () => void }).__render()
      if (!write) return
      recorder.record('render', {
        frame,
        camera: `${harness.camera.position.x},${harness.camera.position.z}`,
        viewYaw: String(harness.view.yaw),
        target: `${target.x},${target.z},${target.alive ? 1 : 0}`,
        agents,
        corpses,
        ...(scenario.civilians ? { civilians: people } : {}),
        out: harness.pushes.map((p) => ({ ...p })) as unknown as EventValue,
        lod: Array.from({ length: Z.n }, (_, i) => Z.lod![i]!).join(','),
        ap: Array.from({ length: Z.n }, (_, i) => Z.ap![i]!).join(','),
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
      if (scenario.civilians) {
        const civ = scenario.civilians
        harness.setHour(civ.hour[0] + k * dt * civ.hour[1])
        const people = context.NPC as Civ[]
        for (const [at, id] of civ.join ?? []) if (at === k) for (const n of people) if (n.id === id) n.st = 'grupo' // helenaGrupo
        for (const [at, id, path] of civ.flee ?? [])
          if (at === k)
            for (const n of people)
              if (n.id === id) {
                n.st = 'fugindo' // helenaSai
                n.path = path.map((q) => [...q])
                n.pi = 0
              }
      }
      context.__tick(dt, scenario.population !== undefined)
      frame++
      if (render) drawFrame(frame % scenario.every === 0 || k === scenario.frames - 1)
      else if (frame % scenario.every === 0) snapshot()
    }
    if (!render && frame % scenario.every !== 0) snapshot()
  }
  return createGoldenRecord({ name, seed: 20261022, events: recorder.events() })
}

/** G-crowd: the game's horde (`hordeUpdate` and everything it calls, doors, corpses, the trail and the population) on scripted scenes. */
export const recordCrowdGolden = (): GoldenRecord => recordScenes('game-crowd', CROWD_SCENARIOS, true)

/** G-crowd-civilians: the survivors of the block (`npcUpdate`, `npcMove`, `npcZombies`, `zChaseNpc`, `npcMorre`, `npcVira`) with the horde. */
export const recordCrowdCiviliansGolden = (): GoldenRecord => recordScenes('game-crowd-civilians', CIVILIAN_SCENARIOS, false)

/** G-crowd-herd: the animals (`bichoLivre`, `zumbiPerto`, `bichosUpdate`) and the vultures with the horde. */
export const recordCrowdHerdGolden = (): GoldenRecord => recordScenes('game-crowd-herd', HERD_SCENARIOS, false)

/** G-crowd-render: the game's drawing of the horde, its bodies on the ground and the survivors (`hordeRender`, `npcRender`) on the scenes of the horde and the survivors. */
export const recordCrowdRenderGolden = (): GoldenRecord => {
  const horde = recordScenes('game-crowd-render', CROWD_SCENARIOS, false, true)
  const civilians = recordScenes('game-crowd-render', CIVILIAN_SCENARIOS, false, true)
  return { ...horde, events: [...horde.events, ...civilians.events] }
}
