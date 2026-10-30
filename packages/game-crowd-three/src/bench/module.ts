import { HERD_ROLES, STATE, bindInfection, carrionCenter, createCivilians, createCrowd, createFlock, createHerd, createRng } from '@adatechnology/game-crowd'
import type { CivilianBuilding, CivilianSpec, Civilians, Crowd, CrowdEventMap, CrowdPack, CrowdType, Flock, Herd, InfectionBinding, InfectionModelLike } from '@adatechnology/game-crowd'
import type { BakeBuilders, BakeSpec, Three } from '@adatechnology/game-characters-three'
import type { BenchChange, ModuleArea, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableModule } from '@adatechnology/game-contracts'
import { createPlayer } from '@adatechnology/game-player'
import type { Player, PlayerAction } from '@adatechnology/game-player'
import type * as THREE_NS from 'three'

import { CROWD_SOUND_BANK, HERD_SOUND_IDS } from '../audio/bank'
import { createHerdView } from '../herd-view'
import type { AnimalDrawer, HerdView } from '../herd-view'
import { createCrowdInstances } from '../instances'
import type { CrowdInstance } from '../instances'
import { createCrowdRenderer } from '../renderer'
import type { CrowdRenderer } from '../renderer'
import { crowdBenchTextOf } from './locale'
import type { CrowdBenchText } from './locale'

export const CROWD_AREA_ID = 'crowd_area'

/** The species card the bench reads: the gait rates (`game-animals-species` cards are these). */
export type CrowdBenchSpecies = { readonly walkHz: number; readonly runHz: number }

/** What a crowd effect is in the host's effect catalogue (`host.effects`): its id and, optionally, the option it plays with. */
export type CrowdEffectMap = Readonly<Record<string, { readonly effect: string; readonly param?: number | string } | null>>

/** The room's effects for the crowd's (the Oficina de VFX recipes of `game-vfx`): blood on a hit, a severed limb, the bloater's cloud, a spark, dust. */
export const CROWD_EFFECTS: CrowdEffectMap = {
  blood: { effect: 'blood_hit' },
  limb: { effect: 'dismember' },
  cloud: { effect: 'bloater_cloud' },
  spark: { effect: 'impact', param: 'metal' },
  dust: { effect: 'impact', param: 'concrete' },
}

export type CrowdTestModuleOptions = {
  readonly locale?: string
  /** The bodies the crowd draws from (types, ages, outfits): the host's content (`game-characters-undead` `undeadCrowdPack()`, or a game's own). */
  readonly pack: CrowdPack
  /** The rich builders the bodies are baked from, made once three.js is lent. Without it the crowd runs and nothing is drawn. */
  readonly builders?: (three: Three) => BakeBuilders
  /** The name the rich builder knows a type by (default its id). */
  readonly typeName?: (type: CrowdType, index: number) => string
  /** The bench's name of a type (default its id). */
  readonly typeLabel?: (type: CrowdType, locale: string) => string
  /** The bodies of the civilians (baked human specs), one per civilian, in order; without them the civilians run but are not drawn. */
  readonly civilianBodies?: readonly BakeSpec[]
  /** The animals: the species card of an id, its size (`game-animals` `quadrupedLayout(body).size`, `birdSize(body)`) and, optionally, what draws them. */
  readonly animals?: {
    readonly species: (id: string) => CrowdBenchSpecies | undefined
    readonly size: (species: CrowdBenchSpecies) => number
    readonly drawer?: (three: Three) => AnimalDrawer<CrowdBenchSpecies>
  }
  /** A region model to bring agents from (`game-infection` `create(...)`) and the region the area is in. */
  readonly infection?: { readonly create: () => InfectionModelLike; readonly region: string; readonly active?: (model: InfectionModelLike) => number }
  /** The effect ids of the host for the crowd's effects (default `CROWD_EFFECTS`; null leaves one out). */
  readonly effects?: CrowdEffectMap
  readonly seed?: number
  /** Agents when the area opens (default 0, so a room that only carries the module stays calm). */
  readonly startCount?: number
  /** Where the crowd is born around (default 0, -45: in front of the room's start). */
  readonly center?: readonly [number, number]
}

/** What the scenarios use of the context the test room passes. */
export interface CrowdScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type CrowdTestModule = TestableModule<CrowdScenarioLike> & {
  readonly crowd: Crowd
  readonly player: Player
  readonly renderer: CrowdRenderer | null
}

type CameraLike = { position: { x: number; y: number; z: number }; rotation?: { y: number }; getWorldDirection?(target: unknown): { x: number; z: number } }
type ThreeLike = Three & { Vector3: new () => { x: number; y: number; z: number } }

const CAPACITY = 4000
const FRAME = 1 / 30
const RING = [10, 90] as const
/** Two lots of the area for the civilians (a house and a shop) and the way out of the area: the test area's own ground, not a delivery's. */
const LOTS: Readonly<Record<string, CivilianBuilding>> = { home: { x: -14, z: -14, w: 8, d: 10, house: true, front: 1 }, shop: { x: 8, z: -14, w: 10, d: 10, front: 1 } }
/** Four civilians with the shirts of the game's block (G 69947-69953: an adult and a child at home, two more next door), without names. */
const CIVILIANS: readonly CivilianSpec[] = [
  { id: 'civilian_1', home: 'home', color: 0x3e6a8a },
  { id: 'civilian_2', home: 'home', color: 0xd0a030, child: true },
  { id: 'civilian_3', home: 'shop', color: 0x6a5a3a },
  { id: 'civilian_4', home: 'shop', color: 0x8a3a5a },
]
const WAY_OUT: readonly (readonly [number, number])[] = [
  [0, 4],
  [30, 4],
  [60, 20],
]
/** The yard and the farm of the herd golden scene (`bichosPovoar` G 66607-66623 laid out round one point): offsets, the species and its role. */
const FARM: readonly (readonly [string, number, number, { companion?: boolean; dead?: boolean }?])[] = [
  ['dog', 2, 3, { companion: true }],
  ['cat', 12, -6],
  ['chicken', -8, 4],
  ['chicken', -8.5, 5],
  ['chicken', -7.5, 4.6],
  ['southern_lapwing', 8, 5],
  ['cow', -20, -10],
  ['cow', -24, -12],
  ['horse', -26, -4],
  ['pig', -14, -16],
  ['capybara', 18, 14],
  ['cow', -18, -24, { dead: true }],
  ['vulture', 0, 0],
  ['vulture', 0, 0],
  ['vulture', 0, 0],
]

const messageText = (text: CrowdBenchText, id: string): string => (text.messages as Readonly<Record<string, string>>)[id] ?? id

/**
 * The crowd area of a test room, against the generic contracts only: a horde of any pack drawn on the instanced path (the baked variants of
 * `game-characters-three`), the room's camera as the `game-player` body it hunts, civilians, the herd and the vultures, and a bridge to a region
 * model. Sounds go to `host.audio` (the crowd's bank is registered there), effects to `host.effects`. The pack and the bodies come in by option:
 * this package knows no game.
 */
export function createCrowdTestModule(options: CrowdTestModuleOptions): CrowdTestModule {
  const locale = options.locale ?? 'pt-BR'
  const text = crowdBenchTextOf(locale)
  const effects = options.effects ?? CROWD_EFFECTS
  const [cx, cz] = options.center ?? [0, -45]
  const settings = { count: options.startCount ?? 0, type: 'mix', night: false, seed: options.seed ?? 1 }
  const layers = { corpses: true, civilians: true, animals: true }
  let host: ModuleHost | null = null
  let three: Three | null = null
  let renderer: CrowdRenderer | null = null
  let herdView: HerdView | null = null
  let lastMessage = ''
  let pending: Partial<Record<PlayerAction, boolean>> = {}
  let last: { x: number; z: number } | null = null
  const offs: (() => void)[] = []

  type World = { crowd: Crowd; player: Player; civilians: Civilians; herd: Herd; flock: Flock; vultures: number; binding: InfectionBinding | null; model: InfectionModelLike | null; place: () => number }
  const build = (seed: number): World => {
    const player = createPlayer({ seed })
    const crowd = createCrowd({ pack: options.pack, seed, capacity: CAPACITY, target: player })
    const civilians = createCivilians(crowd, { people: CIVILIANS.map((c) => ({ ...c })), buildings: LOTS })
    const herd = createHerd(crowd, { view: () => ({ x: player.state.x, z: player.state.z }) })
    const flock = createFlock({ count: 0, mode: 'carrion' })
    const model = options.infection?.create() ?? null
    const spot = createRng(seed + 7)
    const binding = model ? bindInfection(crowd, model, { place: () => [cx + (spot() - 0.5) * 40, cz - 20 - spot() * 40], civilians, regionOf: () => options.infection!.region }) : null
    const place = (): number => {
      const a = spot() * Math.PI * 2
      const r = RING[0] + spot() * (RING[1] - RING[0])
      const type = settings.type === 'mix' ? -1 : crowd.typeIndex(settings.type)
      return crowd.spawn(cx + Math.cos(a) * r, cz + Math.sin(a) * r, type)
    }
    return { crowd, player, civilians, herd, flock, vultures: 0, binding, model, place }
  }
  let world = build(settings.seed)

  const wire = (): void => {
    for (const off of offs.splice(0)) off()
    const { crowd, herd, civilians } = world
    offs.push(crowd.on('sound', (e) => void host?.audio?.play({ sound: e.sound, volume: e.volume, position: e.position })))
    offs.push(herd.on('sound', (e) => void host?.audio?.play({ sound: HERD_SOUND_IDS[e.sound] ?? e.sound, volume: e.volume, position: e.position })))
    offs.push(crowd.on('effect', (e: CrowdEventMap['effect']) => playEffect(e)))
    offs.push(crowd.on('message', (e) => void (lastMessage = messageText(text, e.id))))
    offs.push(herd.on('message', (e) => void (lastMessage = messageText(text, e.id))))
    offs.push(civilians.on('bitten', () => void (lastMessage = text.messages.bitten)))
    offs.push(civilians.on('turned', () => void (lastMessage = text.messages.turned)))
    offs.push(civilians.on('died', () => void (lastMessage = text.messages.died)))
    offs.push(crowd.on('kill', (e) => host?.log(`crowd kill: ${e.type}`, { agent: e.agent, headshot: e.headshot })))
  }
  const playEffect = (e: CrowdEventMap['effect']): void => {
    const map = effects[e.effect]
    if (!map || !host?.effects) return
    host.effects.play({ effect: map.effect, point: e.point, ...(map.param !== undefined ? { param: map.param } : {}), ...(e.amount !== undefined ? { scale: Math.max(0.3, Math.min(2, e.amount / 30)) } : {}) })
  }

  const fit = (): void => {
    const { crowd } = world
    while (crowd.store.n < settings.count && world.place() >= 0) {
      /* born in the ring */
    }
    while (crowd.store.n > settings.count) crowd.remove(crowd.store.n - 1)
  }

  const bringHerd = (): void => {
    const animals = options.animals
    if (!animals || world.herd.list.length) return
    for (const [id, dx, dz, extra] of FARM) {
      const species = animals.species(id)
      if (!species) continue
      world.herd.add({ ...HERD_ROLES[id], ...extra, species: id, x: cx + dx, z: cz + 30 + dz, walkHz: species.walkHz, runHz: species.runHz, size: animals.size(species) })
    }
    world.vultures = world.herd.list.filter((E) => E.spec.sky).length
    world.flock = createFlock({ count: world.vultures, mode: 'carrion' })
    herdView?.clear()
    herdView = null
  }

  const reset = (): void => {
    world.binding?.unbind()
    renderer?.dispose()
    if (renderer) (host?.scene as THREE_NS.Object3D | undefined)?.remove(renderer.group)
    renderer = null
    herdView?.clear()
    if (herdView) (host?.scene as THREE_NS.Object3D | undefined)?.remove(herdView.group)
    herdView = null
    world = build(settings.seed)
    wire()
    fit()
    lastMessage = ''
  }

  const view = (): { x: number; z: number; yaw: number } | null => {
    const camera = host?.camera as CameraLike | undefined
    if (!camera?.position) return null
    const Vector3 = (host?.THREE as ThreeLike | undefined)?.Vector3
    if (camera.getWorldDirection && Vector3) {
      const look = camera.getWorldDirection(new Vector3())
      return { x: camera.position.x, z: camera.position.z, yaw: Math.atan2(-look.x, -look.z) }
    }
    return { x: camera.position.x, z: camera.position.z, yaw: camera.rotation?.y ?? 0 }
  }

  const ensureDrawing = (): void => {
    if (!host || !three) return
    const scene = host.scene as THREE_NS.Object3D
    if (!renderer && options.builders) {
      const bodies = options.civilianBodies ?? []
      renderer = createCrowdRenderer(three, {
        crowd: world.crowd,
        builders: options.builders(three),
        ...(options.typeName ? { typeName: options.typeName } : {}),
        drawCorpses: () => layers.corpses,
        ...(bodies.length ? { civilians: { list: () => (layers.civilians ? world.civilians.list : []), body: (n) => bodies[n.k % bodies.length]! } } : {}),
      })
      scene.add(renderer.group)
    }
    if (!herdView && options.animals?.drawer && world.herd.list.length) {
      herdView = createHerdView(three, { herd: world.herd, flock: world.flock, drawer: options.animals.drawer(three), species: options.animals.species })
      scene.add(herdView.group)
    }
  }

  const frame = (dt: number): void => {
    const { crowd, player, civilians, herd, flock } = world
    const here = view()
    const speed = here && last && dt > 0 ? Math.hypot(here.x - last.x, here.z - last.z) / dt : 0
    if (here) {
      player.state.x = here.x
      player.state.z = here.z
    }
    player.update(dt, { forward: speed > 0.2 ? 1 : 0, run: speed > 3.4, yaw: here?.yaw ?? 0, pressed: pending }, { crowd: crowd.asPlayerCrowd() })
    pending = {}
    if (here) {
      player.state.x = here.x
      player.state.z = here.z
      last = { x: here.x, z: here.z }
    }
    crowd.updateTrail(dt)
    civilians.update(dt)
    if (herd.list.length) {
      herd.update(dt)
      const carcass = herd.list.find((E) => E.dead)
      flock.update(herd.time, dt, carrionCenter(crowd.corpses.entries.map((e) => e.data), carcass ? [carcass.x, carcass.z] : null), [player.state.x, player.state.z])
    }
    crowd.update(dt, { viewYaw: here?.yaw ?? 0, nightFactor: settings.night ? 1 : 0 })
    crowd.updateCorpses(dt)
    ensureDrawing()
    if (renderer && (crowd.store.n || crowd.corpses.count || civilians.list.length)) {
      renderer.update(dt, { camera: { x: player.state.x, z: player.state.z }, viewYaw: here?.yaw ?? 0, target: { x: player.state.x, z: player.state.z, alive: player.state.alive } })
    }
    if (herdView) {
      herdView.group.visible = layers.animals
      herdView.update(dt)
    }
  }
  const hitNearest = (): void => {
    const { crowd, player } = world
    const Z = crowd.store
    let best = -1
    let bd = Infinity
    for (let i = 0; i < Z.n; i++) {
      const d = Math.hypot(Z.x[i]! - player.state.x, Z.z[i]! - player.state.z)
      if (d < bd) [best, bd] = [i, d]
    }
    if (best >= 0) crowd.damage(best, { region: 0, amount: 200, distance: bd, cut: 0, caliber: null })
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      if (change.id in layers) layers[change.id as keyof typeof layers] = change.on
      return
    }
    if (change.kind === 'action') {
      const id = change.id
      if (id === 'spawn') {
        settings.count = Math.min(CAPACITY, world.crowd.store.n + 100)
        host?.bench?.patch('count', { value: settings.count })
        fit()
      } else if (id === 'noise') world.crowd.emitNoise(world.player.state.x, world.player.state.z, 80)
      else if (id === 'hit') hitNearest()
      else if (id === 'kill_all') for (let i = world.crowd.store.n - 1; i >= 0; i--) world.crowd.kill(i)
      else if (id === 'join') for (const n of world.civilians.list) world.civilians.join(n.id)
      else if (id === 'flee') for (const n of world.civilians.list) world.civilians.flee(n.id, WAY_OUT.map(([x, z]) => [cx + x, cz + 40 + z] as const))
      else if (id === 'herd') bringHerd()
      else if (id === 'materialize' && world.binding && options.infection) world.binding.materialize(options.infection.region, 50)
      else if (id === 'push') pending = { ...pending, push: true }
      else if (id === 'reset') reset()
      return
    }
    const { id, value } = change
    if (id === 'count' && typeof value === 'number') {
      settings.count = value
      fit()
    } else if (id === 'type' && typeof value === 'string') settings.type = value
    else if (id === 'night' && typeof value === 'boolean') settings.night = value
    else if (id === 'seed' && typeof value === 'number' && value !== settings.seed) {
      settings.seed = value
      reset()
    }
  }

  const typeOptions = () => [{ id: 'mix', name: text.mix }, ...options.pack.types.map((type) => ({ id: type.id, name: options.typeLabel?.(type, locale) ?? type.id }))]
  const controls = (): ModuleControl[] => [
    { kind: 'number', id: 'count', name: text.controls.count, hint: text.hints.count, min: 0, max: 3000, step: 100, default: settings.count },
    { kind: 'choice', id: 'type', name: text.controls.type, hint: text.hints.type, options: typeOptions(), default: 'mix' },
    { kind: 'boolean', id: 'night', name: text.controls.night, hint: text.hints.night, default: false },
    { kind: 'number', id: 'seed', name: text.controls.seed, min: 1, max: 9999, step: 1, default: settings.seed },
    { kind: 'action', id: 'spawn', name: text.controls.spawn, slow: true },
    { kind: 'action', id: 'noise', name: text.controls.noise, hint: text.hints.noise },
    { kind: 'action', id: 'hit', name: text.controls.hit, hint: text.hints.hit },
    { kind: 'action', id: 'kill_all', name: text.controls.kill_all },
    { kind: 'action', id: 'join', name: text.controls.join, hint: text.hints.join },
    { kind: 'action', id: 'flee', name: text.controls.flee, hint: text.hints.flee },
    ...(options.animals ? [{ kind: 'action', id: 'herd', name: text.controls.herd, hint: text.hints.herd } as const] : []),
    ...(options.infection ? [{ kind: 'action', id: 'materialize', name: text.controls.materialize, hint: text.hints.materialize } as const] : []),
    { kind: 'action', id: 'push', name: text.controls.push, hint: text.hints.push },
    { kind: 'action', id: 'reset', name: text.controls.reset, slow: true },
  ]
  const benchLayers = (): ModuleLayer[] => [
    { id: 'corpses', name: text.layers.corpses },
    { id: 'civilians', name: text.layers.civilians },
    { id: 'animals', name: text.layers.animals },
  ]
  const metrics = (): ModuleMetric[] => [
    { id: 'agents', name: text.metrics.agents, digits: 0, max: CAPACITY, read: () => world.crowd.store.n },
    { id: 'drawn', name: text.metrics.drawn, digits: 0, read: () => (renderer ? renderer.lodCounts[0] + renderer.lodCounts[1] + renderer.lodCounts[2] : 0) },
    { id: 'lod_near', name: text.metrics.lod_near, digits: 0, read: () => renderer?.lodCounts[0] ?? 0 },
    { id: 'lod_middle', name: text.metrics.lod_middle, digits: 0, read: () => renderer?.lodCounts[1] ?? 0 },
    { id: 'lod_far', name: text.metrics.lod_far, digits: 0, read: () => renderer?.lodCounts[2] ?? 0 },
    { id: 'draw_calls', name: text.metrics.draw_calls, digits: 0, read: () => renderer?.drawCalls ?? 0 },
    { id: 'bake_ms', name: text.metrics.bake_ms, unit: 'ms', digits: 0, read: () => renderer?.bakeMs ?? 0 },
    { id: 'active', name: text.metrics.active, digits: 0, read: () => world.crowd.stats.bands[0] },
    { id: 'kills', name: text.metrics.kills, digits: 0, read: () => world.crowd.stats.kills },
    { id: 'bodies', name: text.metrics.corpses, digits: 0, read: () => world.crowd.corpses.count },
    { id: 'civilians_alive', name: text.metrics.civilians, digits: 0, read: () => world.civilians.list.filter((n) => n.state !== 'dead' && n.state !== 'undead' && n.state !== 'gone').length },
    { id: 'health', name: text.metrics.health, digits: 0, read: () => Math.max(0, world.player.state.health) },
    { id: 'grabbed', name: text.metrics.grabbed, read: () => (world.player.state.grabbedBy >= 0 ? text.yes : text.no) },
    { id: 'message', name: text.metrics.message, read: () => lastMessage },
  ]

  // each scenario runs its own crowd, so the bench's live one is not touched
  const fresh = (seed = 1, capacity = 600): { crowd: Crowd; player: Player } => {
    const player = createPlayer({ seed })
    return { crowd: createCrowd({ pack: options.pack, seed, capacity, flow: { clock: () => 0 }, target: player }), player }
  }
  const run = (crowd: Crowd, seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) {
      crowd.update(FRAME)
      crowd.updateCorpses(FRAME)
    }
  }
  const eyes = options.pack.types.map((type) => type.eye ?? null)
  const sizes = Array.from({ length: options.pack.types.reduce((sum, type) => sum + (type.variants ?? 1), 0) }, () => ({ s: 1.7, bulk: 1 }))
  const drawOnce = (crowd: Crowd, player: Player): { level: number; pose: number }[] => {
    const out: { level: number; pose: number }[] = []
    createCrowdInstances({ eyes }).agents(crowd.store, sizes, { camera: { x: player.state.x, z: player.state.z }, viewYaw: 0, target: { x: player.state.x, z: player.state.z, alive: true } }, (_v, level, instance: CrowdInstance) => out.push({ level, pose: instance.b[3] }))
    return out
  }
  const scenarios = (): Array<ModuleScenario<CrowdScenarioLike>> => [
    {
      id: 'crowd_relevance',
      name: text.scenarios.relevance,
      run: ({ expect }) => {
        const { crowd } = fresh(3)
        const spot = createRng(3)
        for (let k = 0; k < 500; k++) crowd.spawn((spot() - 0.5) * 600, (spot() - 0.5) * 600)
        run(crowd, 1)
        const [near, , mid, far] = crowd.stats.bands
        expect(crowd.store.n === 500, '500 agents', { n: crowd.store.n })
        expect(near < 50 && mid + far > 400, 'few think every frame, most are far and slow', { bands: [...crowd.stats.bands] })
      },
    },
    {
      id: 'crowd_lod',
      name: text.scenarios.lod,
      run: ({ expect }) => {
        const { crowd, player } = fresh(1, 4)
        player.state.x = 0
        player.state.z = 0
        const i = crowd.spawn(0, -17, 0)
        const levels: number[] = []
        for (const z of [-17, -19, -19.6, -17.5, -16]) {
          crowd.store.z[i] = z
          levels.push(drawOnce(crowd, player)[0]!.level)
        }
        expect(levels.join() === '0,0,1,1,0', 'in at 19.5 m, back under 16.5 m', { levels })
      },
    },
    {
      id: 'crowd_attack_pose',
      name: text.scenarios.attack_pose,
      run: ({ expect }) => {
        const { crowd, player } = fresh(1, 4)
        const i = crowd.spawn(0, -1.5, 0)
        crowd.store.state[i] = STATE.CHASE
        const poses: number[] = []
        for (const z of [-1.5, -2, -2.3, -1.9]) {
          crowd.store.z[i] = z
          poses.push(drawOnce(crowd, player)[0]!.pose)
        }
        expect(poses.join() === '3,3,0,0', 'the attack pose holds to 2.2 m and comes back under 1.6 m', { poses })
      },
    },
    {
      id: 'crowd_corpse_darkens',
      name: text.scenarios.corpse_darkens,
      run: ({ expect }) => {
        const { crowd, player } = fresh(1, 4)
        crowd.kill(crowd.spawn(0, -5, 0))
        const life = crowd.numbers.corpseSeconds
        crowd.updateCorpses(life / 2)
        const shades: number[] = []
        const heights: number[] = []
        const take = (_v: number, _l: number, instance: CrowdInstance): void => {
          shades.push(instance.shade)
          heights.push(instance.b[0])
        }
        const instances = createCrowdInstances({ eyes })
        const frameOf = { camera: { x: player.state.x, z: player.state.z }, viewYaw: 0 }
        instances.corpses(crowd.corpses.entries, sizes, frameOf, life, take, (i) => take(-1, 1, i))
        crowd.updateCorpses(life / 2 - 30)
        instances.corpses(crowd.corpses.entries, sizes, frameOf, life, take, (i) => take(-1, 1, i))
        expect(Math.abs(shades[0]! - 0.65) < 1e-9, 'half its life: 65% of the colour', { shades })
        expect(Math.abs(heights[1]! / heights[0]! - 0.5) < 1e-6, '30 s before the end: half its height', { heights })
      },
    },
    {
      id: 'crowd_civilians_flee',
      name: text.scenarios.civilians_flee,
      run: ({ expect }) => {
        const { crowd, player } = fresh(2, 4)
        player.state.x = 0
        player.state.z = 6
        const civilians = createCivilians(crowd, { people: [{ id: 'c', home: 'home' }], buildings: LOTS })
        civilians.join('c')
        for (let t = 0; t < 10; t += 0.05) civilians.update(0.05)
        const c = civilians.get('c')!
        expect(Math.hypot(c.x - 0, c.z - 6) < 2.5, 'it follows', { x: c.x, z: c.z })
        civilians.flee('c', [[5, 6], [10, 6]])
        for (let t = 0; t < 20; t += 0.05) civilians.update(0.05)
        expect(c.state === 'gone', 'it ran off and is gone', { state: c.state })
      },
    },
    {
      id: 'crowd_herd_calls',
      name: text.scenarios.herd_calls,
      run: ({ expect }) => {
        const { crowd } = fresh(4, 4)
        const herd = createHerd(crowd)
        const hen = herd.add({ ...HERD_ROLES.chicken, species: 'chicken', x: 20, z: 0, walkHz: 2.2, runHz: 4, size: 0.4 })
        herd.add({ ...HERD_ROLES.southern_lapwing, species: 'southern_lapwing', x: 5, z: 0, walkHz: 2.5, runHz: 1.6, size: 0.35 })
        crowd.spawn(21.5, 0, 0)
        const sounds: string[] = []
        herd.on('sound', (e) => sounds.push(HERD_SOUND_IDS[e.sound] ?? e.sound))
        for (let f = 0; f < 40; f++) herd.update(0.05)
        expect(sounds.includes('hen_cluck') && sounds.includes('lapwing_call'), 'the hen clucks, the lapwing calls', { sounds })
        expect(hen.x < 20, 'the hen ran', { x: hen.x })
      },
    },
    {
      id: 'crowd_vultures',
      name: text.scenarios.vultures,
      run: ({ expect }) => {
        const centre = carrionCenter([{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 0, z: 3 }], null)
        const vultures = createFlock({ count: 3, mode: 'carrion' })
        vultures.update(10, 0.05, centre, [0, 0])
        const r = vultures.birds.map((U) => Math.hypot(U.x - centre[0], U.z - centre[1]))
        expect(r.every((d, i) => Math.abs(d - (7 + i * 2)) < 1e-9), 'each at its radius over the centre of the bodies', { r })
      },
    },
    ...(options.infection
      ? [
          {
            id: 'crowd_infection',
            name: text.scenarios.infection,
            run: ({ expect }: CrowdScenarioLike) => {
              const infection = options.infection!
              const model = infection.create()
              const { crowd } = fresh(6, 64)
              const binding = bindInfection(crowd, model, { place: (_r, seed, k) => [(seed % 100) - 50 + k * 0.01, 500 + k] })
              const before = infection.active?.(model)
              const born = binding.materialize(infection.region, 10)
              crowd.update(0.1)
              const back = binding.giveBack(infection.region)
              expect(born.length > 0 && back === born.length && crowd.store.n === 0, 'brought out, given back', { born: born.length, back })
              if (before !== undefined) expect(infection.active!(model) === before, 'the region keeps its numbers', { before, after: infection.active!(model) })
              binding.unbind()
            },
          },
        ]
      : []),
    {
      id: 'crowd_determinism',
      name: text.scenarios.determinism,
      run: ({ expect }) => {
        const trace = (seed: number): string => {
          const { crowd } = fresh(seed, 40)
          for (let k = 0; k < 30; k++) crowd.spawn((k % 6) * 3 - 8, -10 - Math.floor(k / 6) * 3)
          run(crowd, 3)
          return Array.from({ length: crowd.store.n }, (_, i) => `${crowd.store.x[i]!.toFixed(4)},${crowd.store.z[i]!.toFixed(4)}`).join(';')
        }
        expect(trace(9) === trace(9), 'the same seed gives the same crowd')
        expect(trace(9) !== trace(10), 'another seed gives another')
      },
    },
  ]

  wire()
  fit()

  const module: CrowdTestModule = {
    id: CROWD_AREA_ID,
    name: text.name,
    ground: { surface: 'road' },
    group: text.group,
    get crowd() {
      return world.crowd
    },
    get player() {
      return world.player
    },
    get renderer() {
      return renderer
    },
    items: () => [],
    area: (): ModuleArea => ({ placements: [], view: { eye: [0, 1.7, 6], target: [cx, 1.2, cz] } }),
    controls: () => controls(),
    layers: () => benchLayers(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    attach(lent) {
      host = lent
      three = lent.THREE as Three
      last = null
      lent.audio?.register?.(CROWD_SOUND_BANK)
      const off = lent.bench?.onChange(onChange)
      const offFrame = lent.onFrame(frame)
      return () => {
        off?.()
        offFrame()
        if (renderer) (lent.scene as THREE_NS.Object3D).remove(renderer.group)
        if (herdView) (lent.scene as THREE_NS.Object3D).remove(herdView.group)
        renderer?.dispose()
        renderer = null
        herdView = null
        host = null
      }
    },
  }
  return module
}
