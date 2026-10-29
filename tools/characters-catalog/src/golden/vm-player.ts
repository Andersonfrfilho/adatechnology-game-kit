import { cutDeclaration, cutFunction } from '@adatechnology/golden-tool/cut-source'
import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { EventRecorder, EventValue, GoldenRecord } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from '../paths'
import { fromMarker, readSource } from '../read-source'
import { evaluateGameSlice } from './game-context'

const HORDE_MARKER = '// ===== Horda: simulação com relevância (R0..R3), percepção, combate, corpos ====='
const CORE_MARKER = '// ===== Núcleo: render, entrada, som, utilidades ====='
const WORLD_MARKER = '// ===== Mundo: quarteirão do Jardim Aurora (brief da fatia vertical) e arredores ====='

/** One step of a scripted run: what is held for `frames` frames, what is pressed on the first one, and a call on the player before it. */
export type PlayerStep = {
  readonly frames: number
  readonly forward?: number
  readonly right?: number
  readonly run?: boolean
  readonly aim?: boolean
  readonly bandage?: boolean
  readonly yaw?: number
  readonly press?: readonly ('crouch' | 'push' | 'knife' | 'vault' | 'throw')[]
  readonly call?: readonly [string, ...(number | boolean | string)[]]
}
export type PlayerScenarioZombie = { readonly x: number; readonly z: number; readonly st?: number; readonly crawl?: number; readonly runner?: boolean }
export type PlayerScenario = {
  readonly id: string
  readonly seed: number
  /** Frames per second: every frame is `1 / fps` seconds. */
  readonly fps: number
  /** A snapshot every this many frames (and after the last). */
  readonly every: number
  readonly start: { readonly x: number; readonly z: number }
  /** `fillRect` boxes of the game grid: x0, z0, x1, z1, occupancy code, height. */
  readonly walls?: readonly (readonly [number, number, number, number, number, number])[]
  /** The water box (the game's `POOL`). */
  readonly pool?: readonly [x0: number, z0: number, x1: number, z1: number]
  readonly zombies?: readonly PlayerScenarioZombie[]
  readonly steps: readonly PlayerStep[]
}

const FAR_POOL = [1000, 1000, 1001, 1001] as const

/** The scripted runs: every branch of playerUpdate the slice can reach without a car, a roof or floors. */
export const PLAYER_SCENARIOS: readonly PlayerScenario[] = [
  { id: 'walk_and_stop', seed: 1, fps: 30, every: 3, start: { x: 0, z: 0 }, steps: [{ frames: 90, forward: 1, yaw: 0.3 }, { frames: 30 }, { frames: 45, forward: 1, right: 1, yaw: -1.2 }] },
  { id: 'sprint_to_empty', seed: 2, fps: 30, every: 6, start: { x: 0, z: 0 }, steps: [{ frames: 300, forward: 1, run: true, yaw: 2 }, { frames: 90, forward: 1, run: true, yaw: 2 }, { frames: 60 }] },
  { id: 'crouch_and_aim', seed: 3, fps: 30, every: 3, start: { x: 0, z: 0 }, steps: [{ frames: 1, press: ['crouch'] }, { frames: 60, forward: 1, run: true }, { frames: 1, press: ['crouch'] }, { frames: 60, forward: -1, aim: true, yaw: 1 }] },
  {
    id: 'hurts_bleed_and_bandage',
    seed: 4,
    fps: 30,
    every: 10,
    start: { x: 0, z: 0 },
    steps: [
      { frames: 10, call: ['hurt', 9] },
      { frames: 10, call: ['hurt', 9] },
      { frames: 10, call: ['hurt', 9] },
      { frames: 10, call: ['hurt', 9] },
      { frames: 60, call: ['hurt', 9] },
      { frames: 5, bandage: true },
      { frames: 30, call: ['hurt', 9] },
      { frames: 30, call: ['hurt', 9] },
      { frames: 30, call: ['hurt', 9] },
    ],
  },
  { id: 'bite_infection_to_death', seed: 5, fps: 10, every: 20, start: { x: 0, z: 0 }, steps: [{ frames: 1, call: ['bite'] }, { frames: 2, bandage: true }, { frames: 1300, forward: 1, yaw: 0.5 }, { frames: 120 }] },
  { id: 'many_wounds_seed_6', seed: 6, fps: 30, every: 30, start: { x: 0, z: 0 }, steps: Array.from({ length: 14 }, () => ({ frames: 4, call: ['hurt', 7] as const, bandage: true })) },
  { id: 'many_wounds_seed_7', seed: 7, fps: 30, every: 30, start: { x: 0, z: 0 }, steps: Array.from({ length: 14 }, () => ({ frames: 4, call: ['hurt', 7] as const, bandage: true })) },
  {
    id: 'grab_push_off',
    seed: 8,
    fps: 30,
    every: 2,
    start: { x: 0, z: 0 },
    zombies: [{ x: 0, z: 0.6, st: 2 }],
    steps: [{ frames: 1, call: ['grab', 0, false, false] }, ...Array.from({ length: 6 }, () => ({ frames: 4, press: ['push'] as const, yaw: 0.2 })), { frames: 20 }],
  },
  {
    id: 'grab_knife',
    seed: 9,
    fps: 30,
    every: 2,
    start: { x: 0, z: 0 },
    zombies: [{ x: 0.4, z: 0.4, st: 2 }],
    steps: [{ frames: 1, call: ['grab', 0, false, false] }, { frames: 3, press: ['knife'] }, { frames: 3, press: ['knife'] }, { frames: 3, press: ['knife'] }, { frames: 3, press: ['knife'] }, { frames: 10 }],
  },
  { id: 'grab_timeout_bite', seed: 10, fps: 30, every: 5, start: { x: 0, z: 0 }, zombies: [{ x: 0, z: -0.6, st: 2 }], steps: [{ frames: 1, call: ['grab', 0, false, false] }, { frames: 100, press: ['push'] }, { frames: 30 }] },
  { id: 'grab_no_jaw', seed: 11, fps: 30, every: 5, start: { x: 0, z: 0 }, zombies: [{ x: 0.6, z: 0, st: 2 }], steps: [{ frames: 1, call: ['grab', 0, true, false] }, { frames: 100 }, { frames: 10 }] },
  { id: 'grab_drown', seed: 12, fps: 30, every: 10, start: { x: 0, z: 26 }, pool: [-3, 23.5, 3, 29.5], zombies: [{ x: 0, z: 26.6, st: 2 }], steps: [{ frames: 1, call: ['grab', 0, false, true] }, { frames: 400 }] },
  {
    id: 'water_walk_and_burn',
    seed: 13,
    fps: 30,
    every: 5,
    start: { x: -6, z: 26 },
    pool: [-3, 23.5, 3, 29.5],
    steps: [{ frames: 1, call: ['burn', 4] }, { frames: 120, forward: 1, yaw: -1.5708 }, { frames: 60, forward: 1, run: true, yaw: -1.5708 }],
  },
  {
    id: 'vault_low_wall',
    seed: 14,
    fps: 30,
    every: 2,
    start: { x: 0, z: 0 },
    walls: [[-5, -1.6, 5, -1.2, 2, 1.1]],
    steps: [{ frames: 20, forward: 1 }, { frames: 1, forward: 1, press: ['vault'] }, { frames: 30, forward: 1 }, { frames: 30 }],
  },
  {
    id: 'walls_block_and_slide',
    seed: 15,
    fps: 30,
    every: 3,
    start: { x: 0, z: 0 },
    walls: [[-5, -2, 5, -1.5, 1, 3], [1.5, -5, 2, 5, 4, 3]],
    steps: [{ frames: 90, forward: 1, right: 1, yaw: 0 }, { frames: 60, right: 1 }],
  },
  {
    id: 'shove_and_melee',
    seed: 16,
    fps: 30,
    every: 2,
    start: { x: 0, z: 0 },
    zombies: [{ x: 0, z: -1.0, st: 1 }, { x: 0.3, z: -1.2, st: 1, runner: true }, { x: 0, z: 3, st: 1 }, { x: -0.2, z: -0.9, st: 0, crawl: 1 }],
    steps: [{ frames: 5, press: ['push'] }, { frames: 5, press: ['knife'] }, { frames: 5, press: ['knife'] }, { frames: 5, press: ['knife'] }, { frames: 5, press: ['knife'] }, { frames: 60 }],
  },
  {
    id: 'pushed_out_of_the_crowd_and_panic',
    seed: 17,
    fps: 30,
    every: 3,
    start: { x: 0, z: 0 },
    zombies: [{ x: 0.2, z: 0.1, st: 1 }, { x: -0.3, z: 0.2, st: 1, runner: true }, { x: 0.1, z: -0.35, st: 1 }],
    steps: [{ frames: 60, forward: 1, yaw: 0.7 }, { frames: 60 }],
  },
  { id: 'knock_down', seed: 18, fps: 30, every: 3, start: { x: 0, z: 0 }, steps: [{ frames: 1, forward: 1 }, { frames: 60, forward: 1, call: ['knock', 1.5] }, { frames: 20, forward: 1, press: ['throw'] }] },
]

type Field = { [index: number]: number }
type PlayerContext = {
  readonly player: Record<string, unknown> & { hurt(d: number, i?: number): void; bite(): void; grab(i: number, noJaw: boolean, drown?: boolean): void; knock(t: number): void }
  readonly playerUpdate: (dt: number) => void
  readonly Z: { n: number } & Readonly<Record<string, Field>>
  readonly CAT: Readonly<Record<string, number>>
  readonly POOL: { x0: number; z0: number; x1: number; z1: number }
  readonly fillRect: (x0: number, z0: number, x1: number, z1: number, kind: number, h: number) => void
  readonly occ: Uint8Array
  readonly occH: Float32Array
}

const KEY_OF_PRESS = { crouch: 'KeyC', push: 'KeyE', knife: 'KeyF', vault: 'Space', throw: 'KeyT' } as const
const SOUND_OF = { passo: 'step', carne: 'flesh' } as Readonly<Record<string, string>>
const r6 = (value: unknown): EventValue => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : (value as EventValue))

/** The player fields the golden keeps, in the SDK's names. */
export const PLAYER_FIELDS = [
  ['x', 'x'],
  ['z', 'z'],
  ['y', 'y'],
  ['vx', 'vx'],
  ['vz', 'vz'],
  ['yaw', 'yaw'],
  ['vida', 'health'],
  ['folego', 'stamina'],
  ['crouch', 'crouch'],
  ['running', 'running'],
  ['bleeding', 'bleeding'],
  ['infected', 'infected'],
  ['infT', 'infectionTime'],
  ['grabbedBy', 'grabbedBy'],
  ['grabT', 'grabTimer'],
  ['grabPush', 'grabPushes'],
  ['downT', 'downTimer'],
  ['burnT', 'burnTimer'],
  ['vaultT', 'vaultTimer'],
  ['panic', 'panic'],
  ['alive', 'alive'],
  ['ph', 'phase'],
  ['hip', 'hip'],
  ['stepT', 'stepTimer'],
] as const

const createPlayerHarness = () => {
  const source = readSource(SOURCE_PATHS.game)
  const horde = fromMarker(source, HORDE_MARKER)
  const core = fromMarker(source, CORE_MARKER)
  const worldSection = fromMarker(source, WORLD_MARKER)
  let stream = createSeededRandom(1)
  let recorder: EventRecorder = createEventRecorder()
  const keys: Record<string, boolean> = {}
  const pressed: Record<string, boolean> = {}
  const view = { yaw: 0, aim: false, pitch: 0 }
  const dead: { player?: Record<string, unknown> } = {}
  const tail = [
    cutDeclaration(source, 'FICHA'),
    cutDeclaration(source, 'DERIV'),
    cutDeclaration(source, 'INFEC'),
    cutDeclaration(source, 'FERIDA'),
    cutDeclaration(core, 'lerp'),
    cutFunction(core, 'wasPressed'),
    cutDeclaration(source, 'WORLD'),
    cutDeclaration(worldSection, 'GC'),
    cutDeclaration(worldSection, 'occ'),
    cutDeclaration(worldSection, 'occH'),
    cutDeclaration(worldSection, 'cellOf'),
    cutFunction(worldSection, 'solidAt'),
    cutFunction(worldSection, 'fillRect'),
    cutFunction(source, 'walkCad'),
    cutFunction(horde, 'solidAtA'),
    cutDeclaration(horde, 'POOL'),
    cutDeclaration(horde, 'inWater'),
    cutDeclaration(horde, 'DV'),
    cutDeclaration(horde, 'player'),
    cutFunction(horde, 'playerUpdate'),
    cutFunction(horde, 'frontZombies'),
    cutFunction(horde, 'shove'),
    cutFunction(horde, 'knife'),
  ].join('\n')
  const scope = {
    R: () => stream(),
    keys,
    pressed,
    view,
    mouse: { l: false, lPressed: false },
    inv: { cool: 0 },
    bag: { melee: null },
    ITEM: {},
    ROOF: { climb: 0, on: false },
    ANDARES: { lista: [] },
    carUpdate: () => false,
    hudMsg: (text: string, seconds: number) => recorder.record('message', { text, seconds }),
    sfx: (name: string, volume: number) => recorder.record('sound', { sound: SOUND_OF[name] ?? name, volume }),
    emitNoise: (x: number, z: number, radius: number) => recorder.record('noise', { x: r6(x), z: r6(z), radius: r6(radius) }),
    footStep: (x: number, z: number, yaw: number) => recorder.record('step', { x: r6(x), z: r6(z), yaw: r6(yaw) }),
    throwItem: () => recorder.record('throw', {}),
    zDamage: (i: number, region: number, amount: number, _caliber: unknown, distance: number, cut: number) =>
      recorder.record('damage', { i, region, amount: r6(amount), distance: r6(distance), cut: r6(cut) }),
    onPlayerDeath: () => {
      recorder.record('message', { text: r6(dead.player?.cause), seconds: 6 })
      recorder.record('died', { cause: r6(dead.player?.cause) })
    },
  }
  const context = evaluateGameSlice<PlayerContext>({
    functions: [],
    exports: ['player', 'playerUpdate', 'Z', 'CAT', 'POOL', 'fillRect', 'occ', 'occH'],
    scope,
    tail,
  })
  dead.player = context.player
  return { context, keys, pressed, view, setSeed: (seed: number) => void (stream = createSeededRandom(seed)), setRecorder: (next: EventRecorder) => void (recorder = next) }
}

/** G-player: the game's `player`, `playerUpdate`, `frontZombies`, `shove` and `knife`, run on scripted inputs with the game's own grid, pool and zombie table. */
export const recordPlayerGolden = (): GoldenRecord => {
  const recorder = createEventRecorder()
  for (const scenario of PLAYER_SCENARIOS) {
    const harness = createPlayerHarness()
    const { context, keys, pressed, view } = harness
    const { player, Z, CAT } = context
    harness.setSeed(scenario.seed)
    harness.setRecorder(recorder)
    const pool = scenario.pool ?? FAR_POOL
    Object.assign(context.POOL, { x0: pool[0], z0: pool[1], x1: pool[2], z1: pool[3] })
    for (const wall of scenario.walls ?? []) context.fillRect(...wall)
    Object.assign(player, { x: scenario.start.x, z: scenario.start.z })
    Z.n = scenario.zombies?.length ?? 0
    scenario.zombies?.forEach((zombie, i) => {
      Z.x![i] = zombie.x
      Z.z![i] = zombie.z
      Z.st![i] = zombie.st ?? 0
      Z.crawl![i] = zombie.crawl ?? 0
      Z.cat![i] = zombie.runner ? CAT.corredor! : CAT.lento!
      Z.band![i] = 0
      Z.andar![i] = 0
      Z.y![i] = 0
    })
    recorder.record('scenario', { scenario: scenario as unknown as EventValue })
    let frame = 0
    const snapshot = () => {
      const state: Record<string, EventValue> = { frame }
      for (const [from, to] of PLAYER_FIELDS) state[to] = r6(player[from] ?? 0) // hip starts undefined in the game (`P.hip || 0`)
      state.wounds = (player.wounds as string[]).join(',')
      recorder.record('state', state)
    }
    const zombies = () => {
      for (let i = 0; i < Z.n; i++) recorder.record('zombie', { frame, i, x: r6(Z.x![i]), z: r6(Z.z![i]), yaw: r6(Z.yaw![i]), vx: r6(Z.vx![i]), vz: r6(Z.vz![i]), st: Z.st![i], stT: r6(Z.stT![i]), atkT: r6(Z.atkT![i]) })
    }
    for (const step of scenario.steps) {
      const [call, ...args] = step.call ?? []
      if (call === 'hurt') player.hurt(args[0] as number)
      else if (call === 'bite') player.bite()
      else if (call === 'grab') player.grab(args[0] as number, args[1] as boolean, args[2] as boolean)
      else if (call === 'knock') player.knock(args[0] as number)
      else if (call === 'burn') player.burnT = args[0]
      for (let k = 0; k < step.frames; k++) {
        keys.KeyW = (step.forward ?? 0) > 0
        keys.KeyS = (step.forward ?? 0) < 0
        keys.KeyD = (step.right ?? 0) > 0
        keys.KeyA = (step.right ?? 0) < 0
        keys.ShiftLeft = step.run === true
        keys.KeyB = step.bandage === true
        view.yaw = step.yaw ?? 0
        view.aim = step.aim === true
        for (const id of Object.values(KEY_OF_PRESS)) pressed[id] = false
        if (k === 0) for (const id of step.press ?? []) pressed[KEY_OF_PRESS[id]] = true
        context.playerUpdate(1 / scenario.fps)
        frame++
        if (frame % scenario.every === 0) snapshot()
      }
      zombies()
    }
    snapshot()
  }
  return createGoldenRecord({ name: 'game-player', seed: 20261022, events: recorder.events() })
}
