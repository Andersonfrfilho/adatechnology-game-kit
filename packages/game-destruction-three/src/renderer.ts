import type * as THREE_NS from 'three'
import type { Crack, DamageType, DebrisKind, DestructionEvent, DestructionEventType, Fragment, MaterialDef, PartSettlement, PartSpec, Vec3 } from '@adatechnology/game-destruction'
import { breakSoundKeys, impactSoundKeys, ricochetSoundKeys } from './audio/impact-keys'
import { DEFERRED_QUEUE_ID, blastShove, warnOnce } from '@adatechnology/game-contracts'
import { createVfx, effectForEvent, EVENT_EFFECTS_MAP } from '@adatechnology/game-vfx'
import type { GameEvent } from '@adatechnology/game-vfx'
import type { VfxWorld } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'
import { FragmentSystem } from './fragments'
import { GroundSpots } from './ground'
import type { Bound, HostVis, MeshVis, PartVis, PieceBody, PieceRound } from './internal'
import { clamp, createRng, hashNumbers, hashString } from './math'
import { PieceSystem } from './pieces'
import type { PieceSweepHit } from './pieces'
import { RebarCages } from './rebar'
import { partHintOf, specFrameInverse } from './spec'
import { surfaceOf } from './friction'
import { kitOriginOf } from '@adatechnology/game-contracts'
import { debrisColor, debrisLook, fragmentTone } from '@adatechnology/game-destruction'
import { familyPlay, HitPoints } from './debris-events'
import type { FamilyPlay } from './debris-events'
import type { DeferredQueue, WarmUpProbes } from '@adatechnology/game-contracts'
import type { DestructionRenderer, BindOptions, MakePieceOptions, ExplodeOptions, Mesh, MeshRange, Object3D, Piece, RendererOptions, SolidBox, SoundDetail, ThreeNamespace } from './types'
import { showCollapsedRanges, Visuals } from './visual'
import { SettlementView } from './settlement'
import { SettledBatches } from './settled-batches'
import type { SettledBatchStats } from './settled-batches'
import { anchorOnMesh, anchorWorld } from './emitter-anchor'
import { stampSource } from './vfx-source'
import type { EmitterAnchor } from './emitter-anchor'

let rendererCount = 0
/** Most loose pieces and fragments simulated at once a game loop can start from (`RendererOptions.maxAwakePieces`, `maxAwakeFragments`; the default is no limit). */
export const SUGGESTED_MAX_AWAKE_PIECES = 24
export const SUGGESTED_MAX_AWAKE_FRAGMENTS = 64
/** Mass (kg) a collapse of furniture must bring down to raise the collapse effect's cloud; less (a shelf with its books) raises a puff of dust. */
const COLLAPSE_CLOUD_KG = 1000
/** Colour of bare rebar (the cages' material) and of a bar that came down; the steel of a bar weighs this much per cubic metre when the catalogue has no steel. */
const REBAR_COLOR = 0x74665c
const STEEL_DENSITY = 7850
/** Metres around a unit that came out within which its decals go too: the plaster over it and the ragged edge that breaks with it. */
const CHIP_DECAL_EDGE = 0.05
/** Radius of the rim of torn fibres around a hole in wood, in hole diameters. */
const WOOD_RIM = 1.5

type Ev<T extends DestructionEvent['type']> = Extract<DestructionEvent, { type: T }>

const GLOW_FROM_C = 430
/** A settlement crack is drawn at least this wide (m), so that a hairline still shows a few metres away; and in the colour of the open joint. */
const MIN_DRAWN_CRACK_WIDTH = 0.004
const SETTLEMENT_CRACK_COLOR = 0x2b2420
const QUEUE_CAP = 4000
/** Seconds the grit of a broken hard face keeps falling (least, most), how often a pinch of it at first, and how many places at once. */
const TRICKLE_SECONDS: readonly [number, number] = [2, 5]
const TRICKLE_EVERY = 0.25
const TRICKLE_MAX = 24
/**
 * Events the queue takes past `QUEUE_CAP`: what changes what is drawn (a part breaking off, a storey coming down, a fire starting or going out). A blast
 * floods the queue with damage, melt and drip events; dropping a collapse behind them leaves a fallen wall drawn standing.
 */
const STRUCTURAL_EVENTS: ReadonlySet<DestructionEventType> = new Set<DestructionEventType>([
  'fracture', 'detach', 'collapse', 'settle', 'destroyed', 'expose', 'stage', 'hole', 'ignite', 'primed', 'extinguish', 'burnout', 'leak', 'explode',
])
/** Fragments of a fracture spawned in one go before the frame budget is looked at, so a small break is never split over frames. */
const MIN_FRAGMENTS_PER_SLICE = 8
/** Seconds the boxes of the fixed objects the pieces land on are kept without an event (a host may move a root). */
const STATIC_REFRESH = 0.5
/**
 * Milliseconds of the periodic re-measure per call: the refresh walks the objects a slice at a time (the dirty ones are measured at once).
 * Measuring every object in one call cost up to 88 ms in a frame of the horde chain (perf.mjs, software GL, 2026-11-03).
 */
const STATIC_REFRESH_SLICE_MS = 1
/** Widest mesh (m, along x or z) a piece lands on by its box: furniture and things; a wider one (a roof, a merged room) would hold it on air. */
/** Rays down `surfaceAt` casts at most, the distance under which a hit is the part it starts inside, and how far below such a hit it looks again (m). */
const SURFACE_RAYS = 4
const SURFACE_INSIDE = 0.005
const SURFACE_STEP = 0.15
const STATIC_SPAN = 3
/** What counts as a foot of a piece (m above its lowest point); from what height (m) it can fall over and how close its feet are for that (share of the height). */
const FEET_BAND = 0.03
const TIP_MIN_HEIGHT = 0.3
const TIP_NARROW = 0.3
/** Most meshes a loose piece of furniture touches the ground by, each by its own corners (`setContacts`); one with more stands on its box. */
const CONTACT_MESHES = 12
/** Most meshes of a loose piece other pieces land on one by one (`partBoxes`: a shelf's boards, not the box around the shelf); one with more is landed on by its box. */
const PART_BOX_MESHES = 64
/** Points of the drawing looked at to tell a round piece (per mesh), how alike its two other sides must be (share of the larger) and how far past their circle a point may be. */
const ROUND_SAMPLES = 400
const ROUND_SIDES = 0.12
const ROUND_SLACK = 1.12
/** Points around each rim of a round piece (and around a ball's three great circles). */
const RIM_POINTS = 12

/** The contacts of a round piece: two rims of `RIM_POINTS` at its ends (a cylinder), or three great circles (a ball), in its frame from the centre. */
const rimPoints = (round: PieceRound, half: Vec3): Vec3[] => {
  const out: Vec3[] = []
  const circle = (axis: 0 | 1 | 2, at: number, radius: number): void => {
    const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
    for (let k = 0; k < RIM_POINTS; k++) {
      const a = (k / RIM_POINTS) * Math.PI * 2
      const p: Vec3 = [0, 0, 0]
      p[axis] = at
      p[i] = Math.cos(a) * radius
      p[j] = Math.sin(a) * radius
      out.push(p)
    }
  }
  if (round.kind === 'sphere') for (const axis of [0, 1, 2] as const) circle(axis, 0, round.radius)
  else {
    // each end by its own rim: a bottle stands on its base, and on its cap only as narrow as the cap is
    const ends = round.profile ?? []
    circle(round.axis, -half[round.axis], ends[0]?.[1] ?? round.radius)
    circle(round.axis, half[round.axis], ends[ends.length - 1]?.[1] ?? round.radius)
  }
  return out
}
/** Rings the profile of a round piece is measured in along its axis (`PieceRound.profile`): enough to tell a bottle's shoulder and neck from its body. */
const PROFILE_RINGS = 8
/** k of I = k m r^2 about the axis: a thin cylindrical shell, a solid cylinder, a thin spherical shell and a solid ball. */
const SHELL_CYLINDER = 1
const SOLID_CYLINDER = 0.5
const SHELL_SPHERE = 2 / 3
const SOLID_SPHERE = 0.4
/** Kg per litre of the liquid inside a round piece when its walls are weighed by what is left (water, soda, juice: about 1). */
const LIQUID_KG_PER_L = 1

/**
 * The radius of a round piece along its axis, from the points of its drawing (its frame, from the centre of mass): the widest point of each of `PROFILE_RINGS` rings, the end rings
 * at the ends. Its lower hull (what a flat floor can touch it by) is kept: a ring under the line between its neighbours never touches (the neck of a bottle whose cap is as wide).
 */
const profileOf = (points: readonly Vec3[], axis: 0 | 1 | 2, half: number, radius: number): Array<readonly [number, number]> => {
  const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
  const widest = new Array<number>(PROFILE_RINGS).fill(0)
  for (const p of points) {
    const ring = Math.min(PROFILE_RINGS - 1, Math.max(0, Math.floor(((p[axis] + half) / (2 * half)) * PROFILE_RINGS)))
    widest[ring] = Math.max(widest[ring], Math.hypot(p[i], p[j]))
  }
  const rings: Array<readonly [number, number]> = []
  for (let k = 0; k < PROFILE_RINGS; k++) {
    if (widest[k] <= 0) continue
    const at = k === 0 ? -half : k === PROFILE_RINGS - 1 ? half : -half + ((k + 0.5) / PROFILE_RINGS) * 2 * half
    rings.push([at, Math.min(radius, widest[k])])
  }
  // the outer hull of (at, radius): a ring inside the line from the one before it to the one after it is not touched
  const hull: Array<readonly [number, number]> = []
  for (const ring of rings) {
    while (hull.length >= 2) {
      const [a0, r0] = hull[hull.length - 2]
      const [a1, r1] = hull[hull.length - 1]
      // the middle one is under the line from the first to this ring: it never reaches the floor
      if ((r1 - r0) * (ring[0] - a0) <= (ring[1] - r0) * (a1 - a0)) hull.pop()
      else break
    }
    hull.push(ring)
  }
  return hull
}

/** How far (m) over its support what is left of a broken object may be and still stand; where under its lowest boxes the support is looked for (shares of the box). */
const BROKEN_GAP = 0.03
const BROKEN_SAMPLES: ReadonlyArray<readonly [number, number]> = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]
/** Kinds of object that answer to a load path of their own (a house, a wall, the ground), not to `checkBroken`. */
const UNCHECKED_KINDS: ReadonlySet<string> = new Set(['structure', 'room', 'ground'])
/** A part's fire lasts until the part stops burning (`stopFire`); this is only the ceiling the effects world needs. */
const FIRE_CEILING_SECONDS = 3600
/** The `generic` explosion is the M67's (15 m injury radius): a blast with no effect id of its own scales with its radius. */
const GENERIC_REFERENCE_RADIUS = 15
/** Largest half size (m) of the core of a piece swept for what it runs into: a sofa sweeps a small box at its centre, not the whole of it. */
const SWEEP_CORE = 0.15
/** The small flame of a part that a bullet or fire primed: it burns until the part goes off. */
const PRIMED_FIRE_RADIUS = 0.2

interface FireEmitter {
  object: string
  part: string
  point: Vec3
  /** The burning part's position, moved every frame; the effects world's fire follows it. */
  follow: { x: number; y: number; z: number }
  /** Handle of the fire in the effects world, once the part's box is known. */
  handle?: number
}

interface Leak {
  object: string
  part: string
  fluid: string
  point: Vec3
  direction: Vec3
  rate: number
  pressurized: boolean
  acc: number
  /** The part had a through opening when the leak began: the leak ends when it has none (a valve shut with `seal`). */
  opened: boolean
  localPoint?: Vec3
  localDirection?: Vec3
  lastLiters?: number
  idleSeconds?: number
  life?: number
}

const FLUID_COLORS: Record<string, number> = {
  water: 0x8cc8ff,
  fuel: 0xd9a032,
  oil: 0x2a2018,
  gas: 0xf2f2f2,
  sap: 0xb89b3a,
  acid: 0x9bd23c,
  blood: 0x8a0a0a,
  soda: 0x3a1e12,
  coffee: 0x3b2414,
  beer: 0xd9953c,
  milk: 0xf4f1ea,
  wine: 0x6b101f,
  juice: 0xe8870b,
}
const SMOKE_TONES: Record<string, number> = { white: 0xe6e6e6, grey: 0x8a8a8a, black: 0x2a2a2a }

const DEFAULT_SPEED: Record<string, number> = {
  sparks: 3,
  splinters: 2.5,
  dust: 1,
  shards: 2.5,
  fibers: 1.2,
  leaves: 1.2,
  drips: 0.5,
  ash: 0.8,
  chips: 2.5,
  smoke: 0.8,
  steam: 1,
  fire: 1.2,
  flash: 0,
  foam: 2.5,
}

/** Sound key for an impact on a material. */
export function impactKey(def: MaterialDef | undefined): string {
  if (!def) return 'impact_wood'
  const tags = def.tags ?? []
  if (tags.includes('metal')) return 'impact_metal'
  if (def.visual?.transparent || def.fracture === 'shatter') return 'impact_glass'
  if (def.fracture === 'crumble') return 'impact_masonry'
  if (def.fracture === 'tear') return 'impact_soft'
  return def.fracture === 'none' ? 'impact_metal' : 'impact_wood'
}

/** Sound key (`shot_*`) of a round striking this material: sharper than a blow (a tink on steel, a crack on glass); a host without it plays the `impact_*`. */
export const shotKey = (def: MaterialDef | undefined): string => impactKey(def).replace('impact_', 'shot_')

/** Sound key (`drag_*`) of a base of this material dragged on a floor. */
export const dragSoundKey = (def: MaterialDef | undefined): string => impactKey(def).replace('impact_', 'drag_')

function fractureKey(def: MaterialDef | undefined, style: string): string {
  switch (style) {
    case 'shatter':
      return 'shatter_glass'
    case 'crumble':
      return 'crumble'
    case 'splinter':
      return 'splinter'
    default:
      return impactKey(def)
  }
}

/** Colour of a material when the part gives none: its inside, a unit of it, or its family's (never wood brown on stone). */
function fallbackColor(def: MaterialDef | undefined): number {
  return debrisColor(def)
}

function materialsOf(m: THREE_NS.Material | THREE_NS.Material[]): THREE_NS.Material[] {
  return Array.isArray(m) ? m : [m]
}

function isMeshRange(v: Object3D | MeshRange): v is MeshRange {
  const r = v as Partial<MeshRange>
  return !!r.mesh && Array.isArray(r.range)
}

/** Create the renderer. See `DestructionRenderer`. */
/** The seed of the renderer's random stream; `reset` takes it back here. */
const RNG_SEED = 0xc0ffee

/** The renderer this package makes always has its `deferredQueue`; a third-party `DestructionRenderer` may leave it out. */
export function createDestructionRenderer(THREE: ThreeNamespace, options: RendererOptions): DestructionRenderer & { deferredQueue(): DeferredQueue } {
  return new Renderer(THREE, options)
}

class Renderer implements DestructionRenderer {
  private readonly world: RendererOptions['world']
  private readonly scene: THREE_NS.Scene
  private readonly quality: 'low' | 'medium' | 'high'
  private readonly low: boolean
  private readonly groundAt: (x: number, z: number) => number
  private readonly gravity: number
  private readonly autoSplit: boolean
  private readonly maxFragments: number
  private readonly eventBudgetMs: number
  private readonly bounds = new Map<string, Bound>()
  /** World boxes (min xyz, max xyz) of the drawn meshes of the bound objects that are not pieces, for the pieces to land on. */
  private readonly staticBoxes = new Map<string, number[]>()
  /** Objects to measure again; `staticAll` measures every one. */
  private readonly staticDirty = new Set<string>()
  private staticAll = true
  /** The periodic refresh: the objects still to measure again in this round, a slice per call. */
  private staticRound: string[] = []
  /** Boxes of the pieces' meshes (as `staticBoxes`), with the time they were measured. */
  private readonly pieceBoxes = new WeakMap<PieceBody, { at: number; boxes: number[] }>()
  /** Objects broken since the last update: `checkBroken` looks at what is left of them. */
  private readonly broken = new Set<string>()
  private staticAt = 0
  private readonly queue: DestructionEvent[] = []
  /** The cover of each body around a part of the world that went off, read as the event is emitted: before the blast tore or moved anything. */
  private readonly coverWhenWentOff = new WeakMap<DestructionEvent, Map<string, number>>()
  /** Places a blow broke a hard face at: grit and dust keep coming off them for a few seconds, less and less (`TRICKLE_SECONDS`). */
  private readonly trickles: Array<{ point: Vec3; normal: Vec3; anchor: EmitterAnchor | null; color: number | undefined; left: number; total: number; next: number; source: string | undefined }> = []
  /** Presentation work an event left for later frames (fragments still to spawn, loose groups still to split), run in order within the frame budget. */
  private readonly slices: Array<() => void> = []
  /** When the work of this frame must stop; `Infinity` outside a drain, where a call finishes what it started. */
  private sliceDeadline = Infinity
  /** The clock the drain reads; a budget lends its own while it runs the queue. */
  private drainClock: () => number = () => performance.now()
  /** true once a frame budget owns the draining: `update` no longer drains by itself. */
  private attached = false
  private readonly eventQueue: DeferredQueue = {
    id: DEFERRED_QUEUE_ID.DESTRUCTION_EVENTS,
    pending: () => this.queue.length + this.slices.length,
    run: (deadline, clock) => this.runBudgeted(deadline, clock),
    flush: () => {
      for (let guard = 0; guard < 16 && this.queue.length + this.slices.length > 0; guard++) this.runBudgeted(Infinity, () => 0)
    },
    attach: () => {
      this.attached = true
    },
    detach: () => {
      this.attached = false
    },
  }
  private readonly unsubscribe: () => void
  private readonly visuals: Visuals
  /** The parts the ground went down under, drawn going down (`subside`). */
  private readonly settlement: SettlementView
  private readonly fragments: FragmentSystem
  private readonly ground: GroundSpots
  private readonly pieceSys: PieceSystem
  private readonly cages: RebarCages
  /** The debris at rest drawn in batches. */
  private readonly settledBatches: SettledBatches
  private readonly hitPoints = new HitPoints()
  private readonly active = new Map<string, { object: string; part: string }>()
  private readonly fires = new Map<string, FireEmitter>()
  /** Primed parts burning in the effects world until they go off: their burn loop ends when they are put out. */
  private readonly primedBurning = new Set<string>()
  /** The burn loops asked of the host and not yet ended, by part: whatever stops a part's fire ends its loop, once, with what it started with. */
  private readonly burnSounds = new Map<string, { readonly object: string; readonly point: Vec3; readonly detail: SoundDetail | undefined }>()
  private readonly leaks: Leak[] = []
  private readonly homeTags: string[] = []
  private readonly throttles = new Map<string, number>()
  private rng = createRng(RNG_SEED)
  private readonly vfx: VfxWorld
  /** The object whose event is being applied: what the effects world is given while it is set is that object's (`stampSource`). */
  private emitting: string | undefined
  /** Names this renderer to the world's drips, so a shared world tells each renderer where its own landed. */
  private readonly owner = `destruction-${++rendererCount}`
  private readonly stopLanding: () => void
  /** The effects renderer made here when the host gave no shared world; it is stepped in `update`. */
  private readonly ownVfx: VfxRenderer | undefined
  private time = 0
  private scanTimer = 0
  private disposed = false
  private readonly box: THREE_NS.Box3
  private readonly tmpQ: THREE_NS.Quaternion
  private readonly v1: THREE_NS.Vector3
  private readonly v2: THREE_NS.Vector3
  private readonly v3: THREE_NS.Vector3
  private readonly q1: THREE_NS.Quaternion

  constructor(
    private readonly THREE: ThreeNamespace,
    private readonly o: RendererOptions,
  ) {
    this.world = o.world
    this.scene = o.scene
    this.quality = o.quality ?? 'medium'
    this.low = this.quality === 'low'
    this.groundAt = o.groundAt ?? (() => 0)
    this.gravity = o.gravity ?? 9.81
    this.autoSplit = o.autoSplit !== false
    this.maxFragments = o.maxFragments ?? 160
    this.eventBudgetMs = o.eventBudgetMs ?? Infinity
    this.box = new THREE.Box3()
    this.tmpQ = new THREE.Quaternion()
    this.v1 = new THREE.Vector3()
    this.v2 = new THREE.Vector3()
    this.v3 = new THREE.Vector3()
    this.q1 = new THREE.Quaternion()
    const maxParticles = Math.max(8, Math.floor((o.maxParticles ?? 2500) * (this.low ? 0.5 : 1)))
    this.visuals = new Visuals(THREE, this.low, 600)
    this.settlement = new SettlementView(THREE, this.visuals)
    this.ground = new GroundSpots(THREE, o.scene, this.groundAt, 48)
    if (!o.vfx) warnOnce('game-destruction-three.own-effects-world', 'game-destruction-three made an effects world of its own because the host lent none (options.vfx); pass the host effects so the effects share one budget')
    this.vfx = stampSource(o.vfx ?? createVfx({ profile: this.quality, gravity: this.gravity, groundAt: this.groundAt, sprites: { capacity: maxParticles, density: this.low ? 0.6 : 1 } }), () => this.emitting)
    this.ownVfx = o.vfx ? undefined : createVfxRenderer(THREE, { scene: o.scene, camera: o.camera ?? new THREE.PerspectiveCamera(), vfx: this.vfx, pointScale: o.pointScale ?? 700 })
    this.stopLanding = this.vfx.onLand(this.owner, (x, _y, z, color, tag) => {
      const home = this.homeTags[tag - 1] ?? ''
      this.ground.add('puddle', x, z, 0.05 + this.rng() * 0.04, color, home)
    })
    this.fragments = new FragmentSystem(THREE, {
      scene: o.scene,
      groundAt: this.groundAt,
      gravity: this.gravity,
      max: this.maxFragments,
      life: o.fragmentLife ?? 12,
      formOf: (id) => this.world.materials.get(id)?.splitForm,
      crumbles: (id) => this.world.materials.get(id)?.fracture === 'crumble',
      // rubble lands on what is still built (a slab, a wall's top, a floor), not only on the terrain under it
      surfaceAt: (x, y, z) => this.surfaceAt(x, y, z),
      maxAwake: o.maxAwakeFragments ?? Infinity,
    })
    this.cages = new RebarCages(THREE, o.scene)
    this.settledBatches = new SettledBatches(THREE, o.scene, o.settledBatches ?? { enabled: false })
    this.pieceSys = new PieceSystem(THREE, {
      groundAt: this.groundAt,
      staticTopAt: (x, z, y, step) => this.staticTopAt(x, z, y, step),
      gravity: this.gravity,
      scene: o.scene,
      maxAwake: o.maxAwakePieces ?? Infinity,
      onHardLanding: (p, point, speed) => this.hardLanding(p, point, speed),
      sweep: (p, from, to) => this.sweepPiece(p, from, to),
      onSlam: (p, hit, speed) => this.slam(p, hit, speed),
      // two pieces knocked together: each sounds as its material does (a can on a can, a bottle on a table's leg)
      onKnock: (a, b, point, speed) => {
        this.landingSound(a.objectId, point, clamp(speed / 10, 0.2, 1))
        this.landingSound(b.objectId, point, clamp(speed / 10, 0.2, 1))
      },
    })
    this.unsubscribe = this.world.on('*', (ev) => {
      if (ev.type === 'explode') this.coverWhenWentOff.set(ev, this.coverAround(ev))
      if (this.queue.length < QUEUE_CAP || STRUCTURAL_EVENTS.has(ev.type)) this.queue.push(ev)
    })
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Binding
  // ----------------------------------------------------------------------------------------------------------------------------------

  bind(objectId: string, root: Object3D, options: BindOptions = {}): void {
    this.staticDirty.add(objectId)
    if (this.bounds.has(objectId)) this.unbind(objectId)
    const state = this.world.state(objectId)
    const partIds = new Set((state?.parts ?? []).map((p) => p.id))
    const byPart = new Map<string, Array<{ mesh: Mesh; range?: [number, number] }>>()
    const taken = new Set<Mesh>()
    const put = (pid: string, e: { mesh: Mesh; range?: [number, number] }): void => {
      const l = byPart.get(pid)
      if (l) l.push(e)
      else byPart.set(pid, [e])
    }
    const add = (pid: string, m: Mesh): void => {
      if (taken.has(m)) return
      taken.add(m)
      put(pid, { mesh: m })
    }
    const addRange = (pid: string, r: MeshRange): void => {
      const n = (r.mesh.geometry.getAttribute('position')?.count ?? 0) as number
      const [v0, v1] = r.range
      if (!Number.isInteger(v0) || !Number.isInteger(v1) || v0 < 0 || v1 <= v0 || v1 > n) {
        throw new Error(`game-destruction-three: invalid vertex range [${v0}, ${v1}) for part "${pid}" (the mesh has ${n} vertices)`)
      }
      put(pid, { mesh: r.mesh, range: [v0, v1] })
    }
    const meshesIn = (o: Object3D): Mesh[] => {
      const out: Mesh[] = []
      o.traverse((c) => {
        if ((c as Mesh).isMesh) out.push(c as Mesh)
      })
      return out
    }
    if (options.parts) {
      for (const [pid, v] of Object.entries(options.parts)) {
        for (const o of Array.isArray(v) ? v : [v]) {
          if (isMeshRange(o)) addRange(pid, o)
          else for (const m of meshesIn(o)) add(pid, m)
        }
      }
    } else {
      const leftovers: Mesh[] = []
      for (const m of meshesIn(root)) {
        const ud = partHintOf(m.userData?.destructionPart)?.id
        if (ud !== undefined && partIds.has(ud)) add(ud, m)
        else if (partIds.has(m.name)) add(m.name, m)
        else leftovers.push(m)
      }
      if (leftovers.length) this.matchByBox(objectId, root, leftovers, add)
    }
    const bound: Bound = { id: objectId, root, sync: options.syncTransform !== false, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: false }
    if (options.onFrame) bound.onFrame = options.onFrame
    const hosts = new Map<Mesh, HostVis>()
    for (const pid of partIds) bound.parts.set(pid, this.makePartVis(objectId, pid, state?.parts.find((p) => p.id === pid)?.material ?? '', byPart.get(pid) ?? [], hosts))
    for (const [pid, meshes] of byPart) {
      if (!bound.parts.has(pid)) bound.parts.set(pid, this.makePartVis(objectId, pid, this.world.part(objectId, pid)?.material ?? '', meshes, hosts))
    }
    this.bounds.set(objectId, bound)
    for (const pv of bound.parts.values()) this.tagPart(pv, objectId)
  }

  /**
   * Label the meshes of a part so a host can go from a raycast hit to the world: `userData.destructionPart` (the part id) and
   * `userData.destructionObject` (the id of the world object that part belongs to now; a loose piece has an id of its own). Parts drawn by a range
   * of a merged mesh share that mesh with others and are left alone until they get a mesh of their own. Decals are marked `destructionDebris`.
   */
  private tagPart(pv: PartVis, objectId: string): void {
    for (const mv of pv.meshes) {
      if (mv.merged && !mv.loose) continue
      mv.mesh.traverse((c) => {
        if (!(c as Mesh).isMesh) return
        const ud = c.userData as Record<string, unknown>
        if (ud.destructionDebris) return
        if (partHintOf(ud.destructionPart)?.id !== pv.id) ud.destructionPart = pv.id
        ud.destructionObject = objectId
      })
    }
  }

  private makePartVis(home: string, id: string, material: string, meshes: Array<{ mesh: Mesh; range?: [number, number] }>, hosts: Map<Mesh, HostVis>): PartVis {
    return { id, home, material, meshes: meshes.map((m) => this.visuals.makeMeshVis(m.mesh, home, m.range, hosts)), charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' }
  }

  /** Match unlabelled meshes to the part whose shape contains the centre of the mesh's bounding box. */
  private matchByBox(objectId: string, root: Object3D, meshes: Mesh[], add: (pid: string, m: Mesh) => void): void {
    let specParts: PartSpec[] | undefined
    try {
      specParts = this.world.serialize?.().objects.find((o) => o.id === objectId)?.spec.parts
    } catch {
      specParts = undefined
    }
    if (!specParts) return
    const frame = specFrameInverse(this.THREE, root)
    const e = new this.THREE.Euler()
    const q = new this.THREE.Quaternion()
    for (const m of meshes) {
      this.box.setFromObject(m)
      if (this.box.isEmpty()) continue
      const c = this.box.getCenter(this.v1).applyMatrix4(frame)
      let best: PartSpec | null = null
      let bestVol = Infinity
      for (const p of specParts) {
        const l = this.v2.set(c.x - p.position[0], c.y - p.position[1], c.z - p.position[2])
        if (p.rotation) l.applyQuaternion(q.setFromEuler(e.set(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')).invert())
        let inside = false
        let vol = 0
        const s = p.shape
        if (s.kind === 'box') {
          inside = Math.abs(l.x) <= s.size[0] / 2 && Math.abs(l.y) <= s.size[1] / 2 && Math.abs(l.z) <= s.size[2] / 2
          vol = s.size[0] * s.size[1] * s.size[2]
        } else if (s.kind === 'cylinder') {
          inside = Math.hypot(l.x, l.z) <= s.radius && Math.abs(l.y) <= s.height / 2
          vol = Math.PI * s.radius * s.radius * s.height
        } else {
          inside = l.length() <= s.radius
          vol = (4 / 3) * Math.PI * s.radius ** 3
        }
        if (inside && vol < bestVol) {
          best = p
          bestVol = vol
        }
      }
      if (best) add(best.id, m)
    }
  }

  unbind(objectId: string): void {
    this.staticDirty.add(objectId)
    const b = this.bounds.get(objectId)
    if (!b) return
    this.restore(objectId)
    this.pieceSys.remove(objectId)
    this.bounds.delete(objectId)
    this.hitPoints.forget(objectId)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Pieces
  // ----------------------------------------------------------------------------------------------------------------------------------

  /** Half extents and centre of the box around some meshes, in the metric frame of `root` (its pose removed, its scale kept). */
  private measure(root: Object3D, meshes: MeshVis[]): { half: Vec3; center: THREE_NS.Vector3 } {
    const inv = specFrameInverse(this.THREE, root)
    const total = new this.THREE.Box3()
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    for (const mv of meshes) {
      const m = mv.mesh
      m.updateWorldMatrix(true, false)
      this.visuals.localBox(mv, lb)
      if (lb.isEmpty()) continue
      total.union(lb.clone().applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld)))
    }
    if (total.isEmpty()) return { half: [0.25, 0.25, 0.25], center: new this.THREE.Vector3() }
    const size = total.getSize(new this.THREE.Vector3())
    return { half: [Math.max(0.02, size.x / 2), Math.max(0.02, size.y / 2), Math.max(0.02, size.z / 2)], center: total.getCenter(new this.THREE.Vector3()) }
  }

  private meshesOf(b: Bound): MeshVis[] {
    const out: MeshVis[] = []
    for (const pv of b.parts.values()) if (pv.gone === 'none') for (const mv of pv.meshes) out.push(mv)
    return out
  }

  private massOf(objectId: string): number {
    const st = this.world.state(objectId)
    if (!st) return 5
    let m = 0
    for (const p of st.parts) if (p.status !== 'broken' && p.status !== 'melted' && p.status !== 'ashes') m += p.mass
    return m > 0 ? m : 5
  }

  makePiece(objectId: string, options: MakePieceOptions = {}): Piece {
    this.staticDirty.add(objectId)
    const b = this.bounds.get(objectId)
    if (!b) throw new Error(`game-destruction-three: object "${objectId}" is not bound`)
    if (b.root.parent && b.root.parent !== this.scene) this.scene.attach(b.root)
    const { half, center } = this.measure(b.root, this.meshesOf(b))
    const piece = this.pieceSys.create(objectId, b.root, half, center, options.mass ?? this.massOf(objectId), options.velocity)
    b.piece = piece
    this.fitSurface(b, piece, options.inertia)
    this.fitPartBoxes(b, piece)
    return piece
  }

  /**
   * What lands on or runs into a piece of several meshes meets its parts as drawn (`partBoxes`: a bench's slats, a table's top and legs), from the moment it is made a piece, not
   * the box around them all: a board laid on a bench rests on its seat, a can rolls under a table between its legs. Its own contacts with the ground are left as they were.
   */
  private fitPartBoxes(b: Bound, body: PieceBody): void {
    if (body.round) return
    const contacts = body.contacts
    this.setContacts(b, body, this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
    body.contacts = contacts
  }

  /** What the piece's surface is (the friction of the material it stands on) and whether it is round (`round`: it rolls on rings of contacts). */
  private fitSurface(b: Bound, body: PieceBody, inertia?: number): void {
    // the surface it stands on is its lowest part (a sofa's feet, a can's steel), whatever most of its weight is
    const box = new this.THREE.Box3()
    let low = Infinity
    let material: string | null = null
    for (const [partId, pv] of b.parts) {
      if (pv.gone !== 'none') continue
      for (const mv of pv.meshes) {
        if (!this.visuals.shown(mv)) continue
        this.visuals.worldBox(mv, box)
        if (box.isEmpty() || box.min.y >= low - 0.005) continue
        low = box.min.y
        material = this.world.part(b.id, partId)?.material ?? pv.material ?? null
      }
    }
    const surface = material ? surfaceOf(material, this.world.materials.get(material)) : undefined
    body.friction = surface && { static: surface.static, dynamic: surface.dynamic, rolling: surface.rolling }
    body.restitution = surface?.restitution
    const wasRound = body.round !== undefined
    if (inertia !== undefined) body.inertiaGiven = inertia
    const round = this.roundOf(b, body)
    body.round = round ?? undefined
    if (round) {
      body.contacts = rimPoints(round, body.halfExtents)
      body.partBoxes = undefined
    } else if (wasRound) body.contacts = undefined
  }

  /**
   * k of a round piece's moment of inertia about its axis (I = k m r^2), from where its mass is. A piece that is not hollow is a solid (k 1/2 for a cylinder, 2/5 for a ball).
   * A hollow one (`userData.hollow`) with nothing inside (no `destructionContains` liquid, no `destructionPowder`) is all wall, a thin shell (k 1, 2/3): an empty can. One with
   * contents weighs its walls as their area times their thickness (`destructionThickness`) times density, or, without a thickness, as what is left of its mass besides the liquid
   * (`LIQUID_KG_PER_L`), and the rest as a solid: a full 350 ml can comes to about 0.53 and rolls down a slope at g sin t / 1.53, an empty one at g sin t / 2.
   */
  private inertiaOf(b: Bound, body: PieceBody, kind: PieceRound['kind'], axis: 0 | 1 | 2, radius: number): number {
    const shell = kind === 'sphere' ? SHELL_SPHERE : SHELL_CYLINDER
    const solid = kind === 'sphere' ? SOLID_SPHERE : SOLID_CYLINDER
    let hollow = false
    let filled = false
    let liters = 0
    let thickness = 0
    let material: string | null = null
    for (const [partId, pv] of b.parts) {
      if (pv.gone !== 'none') continue
      for (const mv of pv.meshes) {
        const ud = mv.mesh.userData as { hollow?: unknown; destructionThickness?: unknown; destructionContains?: { liters?: unknown }; destructionPowder?: unknown }
        if (ud.hollow !== true) continue
        hollow = true
        if (ud.destructionPowder) filled = true
        if (ud.destructionContains) {
          filled = true
          // what is left in it now (drunk or leaked), else what it was filled with
          const left = this.world.part(b.id, partId)?.liters
          liters += left ?? (typeof ud.destructionContains.liters === 'number' ? ud.destructionContains.liters : 0)
        }
        const t = typeof ud.destructionThickness === 'number' ? ud.destructionThickness : 0
        if (t > thickness) {
          thickness = t
          material = this.world.part(b.id, partId)?.material ?? pv.material
        }
      }
    }
    if (!hollow) return solid
    if (!filled) return shell
    const density = material ? this.world.materials.get(material)?.density : undefined
    const area = kind === 'sphere' ? 4 * Math.PI * radius * radius : 2 * Math.PI * radius * 2 * body.halfExtents[axis] + 2 * Math.PI * radius * radius
    const walls = density && thickness > 0 ? area * thickness * density : body.mass - liters * LIQUID_KG_PER_L
    const share = clamp(walls / body.mass, 0, 1)
    return share * shell + (1 - share) * solid
  }

  /**
   * Whether what is drawn of the piece is round about one of its axes (a can, a bottle, a plate) or all of them (a ball): its points, in its frame from the centre of
   * mass, all lie within the circle the box's two other sides draw (a box's corners would stick out of it by sqrt 2). Null for anything else.
   */
  private roundOf(b: Bound, body: PieceBody): PieceRound | null {
    const half = body.halfExtents
    const inv = specFrameInverse(this.THREE, b.root)
    const m4 = new this.THREE.Matrix4()
    const p = new this.THREE.Vector3()
    const [cx, cy, cz] = body.localCenter
    const points: Vec3[] = []
    for (const mv of this.meshesOf(b)) {
      if (!this.visuals.shown(mv) || mv.host) continue
      const pos = (mv.mesh.geometry as THREE_NS.BufferGeometry).getAttribute('position')
      if (!pos) continue
      mv.mesh.updateWorldMatrix(true, false)
      m4.multiplyMatrices(inv, mv.mesh.matrixWorld)
      const stride = Math.max(1, Math.floor(pos.count / ROUND_SAMPLES))
      for (let i = 0; i < pos.count; i += stride) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m4)
        points.push([p.x - cx, p.y - cy, p.z - cz])
      }
    }
    if (points.length < 12) return null
    const fits = (axis: 0 | 1 | 2): number | null => {
      const [i, j] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1]
      // the two other sides alike, and no point out past the circle they draw
      if (Math.abs(half[i] - half[j]) > ROUND_SIDES * Math.max(half[i], half[j])) return null
      const radius = (half[i] + half[j]) / 2
      for (const q of points) if (Math.hypot(q[i], q[j]) > radius * ROUND_SLACK) return null
      return radius
    }
    const radii = ([0, 1, 2] as const).map(fits)
    if (radii.every((r) => r !== null)) {
      const radius = (half[0] + half[1] + half[2]) / 3
      return { kind: 'sphere', axis: 1, radius, inertia: body.inertiaGiven ?? this.inertiaOf(b, body, 'sphere', 1, radius) }
    }
    const axis = ([0, 1, 2] as const).find((k) => radii[k] !== null)
    if (axis === undefined) return null
    const radius = radii[axis] ?? 0
    return { kind: 'cylinder', axis, radius, inertia: body.inertiaGiven ?? this.inertiaOf(b, body, 'cylinder', axis, radius), profile: profileOf(points, axis, half[axis], radius) }
  }

  pieces(): Piece[] {
    return [...this.pieceSys.list]
  }

  piece(objectId: string): Piece | null {
    return this.pieceSys.get(objectId)
  }

  impulse(objectId: string, impulse: Vec3, point?: Vec3): void {
    const p = this.pieceSys.get(objectId)
    if (p) this.pieceSys.impulse(p, impulse, point)
  }

  /**
   * What a piece moving from `from` to `to` runs into: the core of its box (its thinnest half each way, at most `SWEEP_CORE`) swept through the world, the piece itself left out,
   * so a crate thrown by a blast stops at the wall instead of passing through it. Null for a world that cannot sweep.
   */
  private sweepPiece(p: PieceBody, from: Vec3, to: Vec3): PieceSweepHit | null {
    if (typeof this.world.sweepBox !== 'function') return null
    const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
    const travel = Math.hypot(d[0], d[1], d[2])
    if (travel < 1e-4) return null
    const core = Math.min(SWEEP_CORE, ...p.halfExtents)
    const box = { min: [from[0] - core, from[1] - core, from[2] - core] as Vec3, max: [from[0] + core, from[1] + core, from[2] + core] as Vec3 }
    const hit = this.world.sweepBox(box, d, travel, { ignore: p.objectId, spacing: Math.max(0.05, core) })
    if (!hit) return null
    // a round piece and another piece meet by their shapes and trade momentum (`PieceSystem.knock`), not as a piece against a wall
    const other = this.pieceSys.get(hit.object)
    if (other && (p.round || other.round)) return null
    const material = this.world.part(hit.object, hit.part)?.material
    const restitution = material === undefined ? undefined : surfaceOf(material, this.world.materials.get(material))?.restitution
    return { object: hit.object, part: hit.part, distance: hit.distance, point: hit.point, normal: hit.normal, ...(restitution === undefined ? {} : { restitution }) }
  }

  /** A piece thrown into a wall: the wall takes the blow of its weight where it met it, the piece takes it too, and each sounds as its material does. */
  private slam(p: PieceBody, hit: PieceSweepHit, speed: number): void {
    const energy = 0.5 * p.mass * speed * speed
    const direction: Vec3 = [-hit.normal[0], -hit.normal[1], -hit.normal[2]]
    this.landingSound(hit.object, hit.point, clamp(speed / 10, 0.2, 1))
    this.syncBound(p.objectId)
    try {
      this.world.hitPart(hit.object, hit.part, { type: 'blunt', point: hit.point, energy, radius: 0.1, direction, normal: hit.normal, source: p.objectId })
      this.world.hit(p.objectId, { type: 'blunt', point: hit.point, energy, radius: 0.08, direction: hit.normal, source: 'slam' })
    } catch {
      // either may have left the world
    }
  }

  private hardLanding(p: PieceBody, point: Vec3, speed: number): void {
    this.landingSound(p.objectId, point, clamp(speed / 10, 0.2, 1))
    // the piece just moved this frame: the world must know where it is before the hit is resolved against its parts
    this.syncBound(p.objectId)
    try {
      this.world.hit(p.objectId, { type: 'blunt', point, energy: 0.5 * p.mass * speed * speed, radius: 0.08, direction: [0, -1, 0], source: 'fall' })
    } catch {
      // the object may have been removed from the world
    }
  }

  /** The impact of the heaviest part of an object (a piece landing): its material and the blunt blow of the fall. */
  private landingSound(objectId: string, point: Vec3, volume: number): void {
    const st = this.world.state(objectId)
    let best = ''
    let mass = -1
    for (const p of st?.parts ?? []) {
      if (p.mass > mass) {
        mass = p.mass
        best = p.material
      }
    }
    this.impactSound(best, point, volume, 'blunt')
  }

  /** The impact on a material by a blow: the legacy family key (`impactKey`) with the more specific keys to try first (`impactSoundKeys`). */
  private impactSound(material: string, point: Vec3, volume: number, blow?: DamageType): void {
    const def = this.world.materials.get(material)
    this.sound(impactKey(def), point, volume, impactSoundKeys(material, def, blow))
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Update
  // ----------------------------------------------------------------------------------------------------------------------------------

  update(dt: number): void {
    if (this.disposed) return
    dt = clamp(dt, 0, 0.1)
    this.time += dt
    if (!this.attached) this.drainQueue()
    this.checkBroken()
    for (const b of this.bounds.values()) b.onFrame?.(dt)
    // a settling object keeps moving between its (throttled) `settle` events
    for (const b of this.bounds.values()) if (b.soilNode && this.world.state(b.id)?.soil?.status === 'yielding') this.onSettle(b.id)
    this.settlement.update(dt)
    this.pieceSys.update(dt)
    this.fragments.update(dt)
    // what goes on at a part (fire, leaks, trickling grit) reads where the part is after the bodies moved this frame, not a frame behind
    this.updateActive(dt)
    this.updateLeaks(dt)
    this.updateTrickles(dt)
    this.ground.update(dt)
    this.ownVfx?.update(dt)
    this.syncTransforms()
    this.settledBatches.update(dt, () => this.restingDebris())
  }

  /** An event of the object (a blow, fire, char): its meshes leave the batches before it is drawn (`SettledBatches.release`). */
  private releaseBatched(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (b) this.settledBatches.release(this.meshesOf(b).map((mv) => mv.mesh))
  }

  /**
   * The meshes of the debris at rest: the fragments asleep (without marks on them) and the meshes of their own of the pieces asleep, but for an object with a part burning,
   * hot or still charring (`active`): its colours change in place.
   */
  private restingDebris(): Mesh[] {
    const meshes = new Set(this.fragments.restingMeshes())
    const changing = new Set<string>()
    for (const a of this.active.values()) changing.add(a.object)
    for (const piece of this.pieceSys.list) {
      const b = piece.sleeping && !piece.held && !changing.has(piece.objectId) ? this.bounds.get(piece.objectId) : undefined
      if (!b) continue
      // a part drawn by a range of a mesh it shares with others (a house) is left in that mesh
      for (const mv of this.meshesOf(b)) if ((!mv.host || mv.loose) && !mv.hidden && this.visuals.shown(mv)) meshes.add(mv.mesh)
    }
    return [...meshes]
  }

  settledBatchStats(): SettledBatchStats {
    return this.settledBatches.stats()
  }

  deferredQueue(): DeferredQueue {
    return this.eventQueue
  }

  private drainQueue(): void {
    this.runBudgeted(performance.now() + this.eventBudgetMs, () => performance.now())
  }

  /** Applies the waiting events in order until the deadline, after the slices earlier events left; always at least one unit when something waits. Returns the units run. */
  private runBudgeted(deadline: number, clock: () => number): number {
    // events produced while applying (a hard landing calls `hit`) wait for the next frame
    const batch = this.queue.splice(0, this.queue.length)
    const outerClock = this.drainClock
    this.drainClock = clock
    this.sliceDeadline = deadline
    let ran = 0
    try {
      ran = this.runSlices(deadline)
      for (let i = 0; i < batch.length; i++) {
        if ((i > 0 || (ran > 0 && this.attached)) && clock() >= deadline) {
          this.queue.unshift(...batch.slice(i))
          return ran
        }
        try {
          this.apply(batch[i]!)
        } catch (err) {
          if (typeof console !== 'undefined') console.error('game-destruction-three: failed to apply', batch[i]!.type, err)
        }
        ran++
      }
    } finally {
      this.sliceDeadline = Infinity
      this.drainClock = outerClock
    }
    return ran
  }

  /** Runs the work left by earlier frames until the deadline; at least one piece per frame, so it always finishes. */
  private runSlices(deadline: number): number {
    let ran = 0
    for (; this.slices.length > 0 && (ran === 0 || this.drainClock() < deadline); ran++) {
      try {
        this.slices.shift()!()
      } catch (err) {
        if (typeof console !== 'undefined') console.error('game-destruction-three: failed to run deferred work', err)
      }
    }
    return ran
  }

  /**
   * The ground under an object settled or tilted: its parts are drawn under a node with the soil's offset (`ObjectState.soil.offset`), so the host's
   * root keeps the pose the host gave and the world keeps getting it from `syncTransform`.
   */
  private onSettle(objectId: string): void {
    const b = this.bounds.get(objectId)
    const soil = this.world.state(objectId)?.soil
    if (!b || !soil) return
    let node = b.soilNode
    if (!node) {
      node = new this.THREE.Group()
      node.name = 'destruction-soil'
      for (const c of [...b.root.children]) node.add(c)
      b.root.add(node)
      b.soilNode = node
    }
    const { position: p, rotation: q } = soil.offset
    node.position.set(p[0], p[1], p[2])
    node.quaternion.set(q[0], q[1], q[2], q[3])
    node.updateMatrixWorld(true)
  }

  /** The ground went down under some parts of an object: each part with a settlement (`PartState.settlement`) starts going down to it. */
  private onSubside(objectId: string): void {
    const b = this.bounds.get(objectId)
    const state = this.world.state(objectId)
    if (!b || !state) return
    const parts: Array<readonly [PartVis, PartSettlement | undefined]> = []
    for (const ps of state.parts) {
      const pv = b.parts.get(ps.id)
      if (pv && ps.settlement) parts.push([pv, ps.settlement])
    }
    this.settlement.follow(b.soilNode ?? b.root, parts)
  }

  private syncTransforms(): void {
    for (const b of this.bounds.values()) this.syncOne(b)
  }

  /** Push the current transform of one bound object to the world right now (used before a landing hit). */
  private syncBound(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (b) this.syncOne(b)
  }

  private syncOne(b: Bound): void {
    if (!b.sync) return
    const p = this.v1
    const q = this.tmpQ
    b.root.updateWorldMatrix(true, false)
    b.root.matrixWorld.decompose(p, q, this.v2)
    const last = b.lastPos
    const lq = b.lastQuat
    const moved = !last || !lq || Math.abs(p.x - last[0]) + Math.abs(p.y - last[1]) + Math.abs(p.z - last[2]) > 1e-5 || Math.abs(q.x - lq[0]) + Math.abs(q.y - lq[1]) + Math.abs(q.z - lq[2]) + Math.abs(q.w - lq[3]) > 1e-6
    if (!moved) return
    b.lastPos = [p.x, p.y, p.z]
    b.lastQuat = [q.x, q.y, q.z, q.w]
    if (this.world.has(b.id)) this.world.setTransform(b.id, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w])
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Events
  // ----------------------------------------------------------------------------------------------------------------------------------

  /**
   * The highest top of a bound object that is not a piece under (x, z) a corner at height `y` can land on (at most `step` above it). The world boxes
   * of their drawn meshes are kept until an event or a moved root changes them; parts drawn inside a merged mesh and meshes wider than `STATIC_SPAN`
   * are left out (walls, floors, roofs: the terrain under them is the host's `groundAt`).
   */
  private staticTopAt(x: number, z: number, y: number, step: number): number {
    let top = -Infinity
    for (const a of this.staticNow().values()) {
      // the first six numbers are the box around all of the object's boxes
      if (a.length === 0 || x < a[0] || x > a[3] || z < a[2] || z > a[5]) continue
      for (let i = 6; i < a.length; i += 6) {
        if (x < a[i] || x > a[i + 3] || z < a[i + 2] || z > a[i + 5]) continue
        const t = a[i + 4]
        if (t > top && t <= y + step) top = t
      }
    }
    return top
  }

  /** The boxes of the fixed objects (per object: the box around them all, then each one), each object measured again when an event touched it (all of them every `STATIC_REFRESH` s). */
  private staticNow(): Map<string, number[]> {
    if (this.time - this.staticAt > STATIC_REFRESH) {
      this.staticAt = this.time
      if (this.staticRound.length === 0) this.staticRound = [...this.bounds.keys()].reverse()
    }
    if (!this.staticAll && this.staticDirty.size === 0 && this.staticRound.length === 0) return this.staticBoxes
    const box = new this.THREE.Box3()
    const measure = (b: Bound): void => {
      if (b.piece || this.pieceSys.get(b.id)) {
        this.staticBoxes.delete(b.id)
        return
      }
      const out: number[] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
      for (const mv of this.meshesOf(b)) {
        if (mv.host || mv.loose || !this.visuals.shown(mv)) continue
        this.visuals.worldBox(mv, box)
        if (box.isEmpty() || box.max.x - box.min.x > STATIC_SPAN || box.max.z - box.min.z > STATIC_SPAN) continue
        this.visuals.fittedBoxes(mv, out)
        for (let k = 0; k < 3; k++) {
          out[k] = Math.min(out[k], box.min.getComponent(k))
          out[k + 3] = Math.max(out[k + 3], box.max.getComponent(k))
        }
      }
      this.staticBoxes.set(b.id, out.length > 6 ? out : [])
    }
    const measureId = (id: string): void => {
      const b = this.bounds.get(id)
      if (b) measure(b)
      else this.staticBoxes.delete(id)
    }
    if (this.staticAll) {
      this.staticBoxes.clear()
      for (const b of this.bounds.values()) measure(b)
      this.staticRound = []
    } else {
      for (const id of this.staticDirty) measureId(id)
      const until = performance.now() + STATIC_REFRESH_SLICE_MS
      while (this.staticRound.length > 0) {
        measureId(this.staticRound.pop() as string)
        if (performance.now() >= until) break
      }
    }
    this.staticAll = false
    this.staticDirty.clear()
    return this.staticBoxes
  }

  /** The boxes of a piece's drawn meshes, measured once per frame. */
  private pieceBoxesOf(pc: PieceBody): number[] {
    const cached = this.pieceBoxes.get(pc)
    if (cached && cached.at === this.time) return cached.boxes
    const boxes: number[] = []
    const b = this.bounds.get(pc.objectId)
    if (b) {
      for (const mv of this.meshesOf(b)) {
        if (this.visuals.shown(mv)) this.visuals.fittedBoxes(mv, boxes)
      }
    }
    this.pieceBoxes.set(pc, { at: this.time, boxes })
    return boxes
  }

  solidsNear(x: number, z: number, radius: number): SolidBox[] {
    const found: SolidBox[] = []
    const scan = (a: number[], id: string, piece: Piece | null, from: number): void => {
      if (from > 0 && (a.length === 0 || x < a[0] - radius || x > a[3] + radius || z < a[2] - radius || z > a[5] + radius)) return
      for (let i = from; i < a.length; i += 6) {
        if (x < a[i] - radius || x > a[i + 3] + radius || z < a[i + 2] - radius || z > a[i + 5] + radius) continue
        found.push({ objectId: id, min: [a[i], a[i + 1], a[i + 2]], max: [a[i + 3], a[i + 4], a[i + 5]], piece })
      }
    }
    for (const [id, a] of this.staticNow()) scan(a, id, null, 6)
    const c = this.v1
    for (const pc of this.pieceSys.list) {
      if (pc.held) continue
      // only the pieces whose box can reach the point are measured
      this.pieceSys.centerOf(pc, c)
      const reach = Math.hypot(pc.halfExtents[0], pc.halfExtents[1], pc.halfExtents[2]) + radius
      if (Math.abs(c.x - x) > reach || Math.abs(c.z - z) > reach) continue
      scan(this.pieceBoxesOf(pc), pc.objectId, pc, 0)
    }
    this.fragments.solidsNear(x, z, radius, (home, min, max, loose) => found.push({ objectId: home, min, max, piece: null, loose }))
    return found
  }

  private apply(ev: DestructionEvent): void {
    const outer = this.emitting
    // an event of no object (a blast set off in the air) makes effects of no one
    this.emitting = ev.object || undefined
    try {
      this.applyEvent(ev)
    } finally {
      this.emitting = outer
    }
  }

  private applyEvent(ev: DestructionEvent): void {
    this.staticDirty.add(ev.object)
    this.releaseBatched(ev.object)
    this.hitPoints.note(ev, this.time)
    if (ev.type === 'fracture' || ev.type === 'detach' || ev.type === 'collapse' || ev.type === 'burnout' || ev.type === 'destroyed') this.broken.add(ev.object)
    switch (ev.type) {
      case 'damage':
        if (ev.damageType === 'heat' || ev.damageType === 'fire' || ev.damageType === 'explosive') this.activate(ev.object, ev.part)
        break
      case 'dent':
        this.onDent(ev)
        break
      case 'bend':
        this.onBend(ev)
        break
      case 'hole':
        this.onHole(ev)
        break
      case 'crack':
        this.onCrack(ev)
        break
      case 'ricochet': {
        const d = ev.direction
        this.vfx.burst('sparks', ev.point, d, 4 + Math.min(10, ev.energy / 150), 4)
        // the whine of a round off steel, the short crack off stone: by what the part it glanced off is made of
        const glanced = this.partVis(ev.object, ev.part)?.material ?? ''
        this.sound('ricochet', ev.point, 0.7, ricochetSoundKeys(glanced, this.world.materials.get(glanced)))
        break
      }
      case 'debris':
        this.vfx.burst(ev.kind, ev.point, ev.normal, ev.count, ev.speed > 0 ? ev.speed : DEFAULT_SPEED[ev.kind] ?? 1, this.debrisOptions(ev.kind, ev.object, ev.part, ev.material))
        break
      case 'fracture': {
        const pv = this.partVis(ev.object, ev.part)
        if (pv) this.settlement.forget(pv)
        this.onFracture(ev)
        break
      }
      case 'subside':
        this.onSubside(ev.object)
        break
      case 'detach':
        this.onDetach(ev)
        break
      case 'settle':
        this.onSettle(ev.object)
        break
      case 'collapse': {
        // a storey coming down raises the cloud of the collapse effect; a piece of furniture (a shelf and its books) only a puff
        const root = this.bounds.get(ev.object)?.root
        const furniture = !!root && kitOriginOf(root)?.kind === 'furniture'
        // what was still going down goes the rest of the way before it falls on its own
        for (const part of ev.parts) {
          const pv = this.partVis(ev.object, part)
          if (pv) this.settlement.finish(pv)
        }
        this.splitLoose(ev.object)
        if (!furniture || ev.mass >= COLLAPSE_CLOUD_KG) this.playEvent({ kind: 'collapse' }, this.rootPoint(ev.object), this.partPlay(ev.object, ev.parts[0] ?? ''))
        else this.vfx.burst('dust', this.rootPoint(ev.object), [0, 1, 0], clamp(Math.round(ev.mass / 4), 4, 24), 0.8)
        break
      }
      case 'disassemble_progress': {
        const k = `unscrew:${ev.joint}`
        if (this.time - (this.throttles.get(k) ?? -1) > 0.25) {
          this.throttles.set(k, this.time)
          this.sound('unscrew', this.rootPoint(ev.object), clamp(0.3 + ev.progress * 0.5, 0, 1))
        }
        break
      }
      case 'ignite':
        this.startFire(ev)
        this.activate(ev.object, ev.part)
        this.sound('ignite', ev.point, 0.7)
        this.startBurnSound(ev.object, ev.part, ev.point, this.burning(ev.object, ev.part))
        break
      case 'primed':
        // a bullet or fire sets the part burning until its delay runs out; a blast nearby only waits for the explosion
        if (ev.trigger !== 'explosion') {
          this.vfx.fire({ point: ev.point, radius: PRIMED_FIRE_RADIUS, life: ev.delay })
          this.primedBurning.add(`${ev.object}|${ev.part}`)
          this.activate(ev.object, ev.part)
          // the vessel is venting until it bursts: the gas leak for as long as the delay, and the flame it feeds
          this.sound('primed', ev.point, 0.7, { seconds: ev.delay })
          if (!this.burnSounds.has(`${ev.object}|${ev.part}`)) this.startBurnSound(ev.object, ev.part, ev.point, { fuel: 'gas' })
        }
        break
      case 'spall':
        this.onSpall(ev)
        break
      case 'stage':
        this.onStage(ev)
        break
      case 'chip':
        this.onChip(ev)
        break
      case 'expose':
        if (ev.bars.length > 0) this.cages.set(`${ev.object}|${ev.part}`, ev.bars, this.bounds.get(ev.object)?.root)
        else this.dropCage(ev.object, ev.part)
        if (ev.bars.length > 0) {
          const [a, b] = ev.bars[0] as [Vec3, Vec3]
          this.playEvent({ kind: 'expose' }, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], this.partPlay(ev.object, ev.part))
        }
        break
      case 'extinguish': {
        const f = this.fires.get(`${ev.object}|${ev.part}`)
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        if (f) {
          this.stopFire(`${ev.object}|${ev.part}`)
          this.vfx.burst('steam', f.point, [0, 1, 0], 14, 1.2)
        }
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.activate(ev.object, ev.part)
        this.sound('extinguish', f?.point ?? this.rootPoint(ev.object), 0.6)
        break
      }
      case 'burnout': {
        this.stopFire(`${ev.object}|${ev.part}`)
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.vfx.burst('ash', ev.point, [0, 1, 0], 16, 1)
        this.vfx.burst('smoke', ev.point, [0, 1, 0], 6, 0.8, { color: SMOKE_TONES.grey })
        const pv = this.partVis(ev.object, ev.part)
        if (pv) {
          const def = this.world.materials.get(pv.material)
          this.visuals.setChar(pv, 1, def?.visual?.charColor ?? 0x1a1410)
        }
        this.activate(ev.object, ev.part)
        break
      }
      case 'melt':
        this.activate(ev.object, ev.part)
        // one sizzle per melting object every 1.5 s, not one per part (a plastic bin has dozens)
        if (this.time - (this.throttles.get(`melt:${ev.object}`) ?? -9) > 1.5) {
          this.throttles.set(`melt:${ev.object}`, this.time)
          this.sound('melt_sizzle', this.rootPoint(ev.object), 0.4)
        }
        break
      case 'drip': {
        const b = this.bounds.get(ev.object)
        const pv = b?.parts.get(ev.part)
        const def = this.world.materials.get(ev.material)
        const color = (pv && this.partColor(pv, def)) ?? fallbackColor(def)
        let tag = this.homeTags.indexOf(ev.object) + 1
        if (tag === 0) tag = this.homeTags.push(ev.object)
        this.vfx.spawn('drips', ev.point, [(this.rng() - 0.5) * 0.1, -0.1, (this.rng() - 0.5) * 0.1], { color, tag, owner: this.owner })
        break
      }
      case 'leak': {
        const key = `${ev.object}|${ev.part}`
        const b = this.bounds.get(ev.object)
        let localPoint: Vec3 | undefined
        let localDirection: Vec3 | undefined
        if (b) {
          b.root.updateWorldMatrix(true, false)
          const inv = new this.THREE.Matrix4().copy(b.root.matrixWorld).invert()
          const lp = this.v1.set(ev.point[0], ev.point[1], ev.point[2]).applyMatrix4(inv)
          const ld = this.v2.set(ev.direction[0], ev.direction[1], ev.direction[2]).transformDirection(inv).normalize()
          localPoint = [lp.x, lp.y, lp.z]
          localDirection = [ld.x, ld.y, ld.z]
        }
        const same = this.leaks.find((l) => l.object === ev.object && l.part === ev.part && Math.hypot(l.point[0] - ev.point[0], l.point[1] - ev.point[1], l.point[2] - ev.point[2]) < 0.03)
        if (same) {
          same.rate = ev.rate
          same.direction = ev.direction
          if (localPoint) same.localPoint = localPoint
          if (localDirection) same.localDirection = localDirection
        } else {
          if (this.leaks.length >= 24) this.leaks.shift()
          this.leaks.push({
            object: ev.object,
            part: ev.part,
            fluid: ev.fluid,
            point: ev.point,
            direction: ev.direction,
            rate: ev.rate,
            pressurized: ev.pressurized,
            acc: 0,
            opened: this.world.part(ev.object, ev.part)?.holes.some((h) => h.through) ?? false,
            localPoint,
            localDirection,
            life: 0,
          })
        }
        void key
        break
      }
      case 'explode':
        // the vessel that vented into its flame bursts: the gas jet ends with it
        this.primedBurning.delete(`${ev.object}|${ev.part}`)
        this.endBurnSound(`${ev.object}|${ev.part}`)
        this.onExplode(ev)
        break
      case 'destroyed':
        break
    }
  }

  /** Where the object's root is now, in the world: a body that tipped or fell is there, not where it was bound. */
  private rootPoint(objectId: string): Vec3 {
    const b = this.bounds.get(objectId)
    if (!b) return [0, 0, 0]
    const p = b.root.getWorldPosition(new this.THREE.Vector3())
    return [p.x, p.y, p.z]
  }

  private sound(key: string, point: Vec3, volume: number, detail?: SoundDetail): void {
    if (detail) this.o.onSound?.(key, point, volume, detail)
    else this.o.onSound?.(key, point, volume)
  }

  /** What a burning part is made of, for the fire's sound. */
  private burning(objectId: string, partId: string): SoundDetail | undefined {
    const material = this.partVis(objectId, partId)?.material || this.world.part(objectId, partId)?.material
    return material ? { material } : undefined
  }

  private partVis(objectId: string, partId: string): PartVis | null {
    return this.bounds.get(objectId)?.parts.get(partId) ?? null
  }

  private activate(objectId: string, partId: string): void {
    this.active.set(`${objectId}|${partId}`, { object: objectId, part: partId })
  }

  /** Current colour of the part's first mesh (char included), or null. */
  private partColor(pv: PartVis, def: MaterialDef | undefined): number | null {
    // the colour of what most of the part is drawn with (a roof's tiles, not the strip of plaster drawn with it first)
    const size = (m: MeshVis): number => (m.range ? m.range[1] - m.range[0] : (m.mesh.geometry.getAttribute('position')?.count ?? 0))
    const mv = pv.meshes.reduce<MeshVis | undefined>((best, m) => (!best || size(m) > size(best) ? m : best), undefined)
    if (!mv) return null
    const mat = materialsOf(mv.mesh.material)[0] as THREE_NS.MeshStandardMaterial | undefined
    const c = mat?.color
    if (c && (c as THREE_NS.Color).isColor) {
      const tint = this.visuals.vertexTint(mv)
      return tint ? c.clone().multiply(tint).getHex() : c.getHex()
    }
    return def ? fallbackColor(def) : null
  }

  private debrisOptions(kind: DebrisKind, objectId: string, partId: string, material?: string): { color?: number } | undefined {
    const pv = this.partVis(objectId, partId)
    const def = this.world.materials.get(material ?? pv?.material ?? '')
    if (kind === 'smoke') return { color: SMOKE_TONES[def?.thermal.smoke ?? 'grey'] }
    // crushed masonry is the colour of its inside (brick orange, plaster light, concrete grey), not of the paint over it
    if ((kind === 'dust' || kind === 'chips') && def?.visual?.innerColor !== undefined) return { color: def.visual.innerColor }
    if (kind === 'fibers' || kind === 'leaves') {
      if (def?.visual?.innerColor !== undefined) return { color: def.visual.innerColor }
      // a part drawn by its host (a house piece) has no mesh of its own here: the burst keeps its default colour
      const c = pv && pv.meshes[0] ? this.visuals.baseColorHex(pv.meshes[0]) : -1
      return c >= 0 ? { color: c } : undefined
    }
    if (kind === 'dust' || kind === 'chips') {
      const c = pv && pv.meshes[0] ? this.visuals.baseColorHex(pv.meshes[0]) : -1
      return c >= 0 && kind === 'chips' ? { color: c } : undefined
    }
    return undefined
  }

  /** Mesh of the part closest to a world point. */
  private nearestMesh(pv: PartVis, p: THREE_NS.Vector3): PartVis['meshes'][number] | null {
    let best: PartVis['meshes'][number] | null = null
    let bd = Infinity
    for (const mv of pv.meshes) {
      if (!this.visuals.shown(mv)) continue
      const d = this.visuals.worldBox(mv, this.box).distanceToPoint(p)
      if (d < bd) {
        bd = d
        best = mv
      }
    }
    return best
  }

  private worldDir(b: Bound, v: Vec3): THREE_NS.Vector3 {
    b.root.updateWorldMatrix(true, false)
    return new this.THREE.Vector3(v[0], v[1], v[2]).applyQuaternion(b.root.getWorldQuaternion(this.tmpQ)).normalize()
  }

  /** A plate bent: every mesh of the part turns about the hinge line together (a shovel's blade pieces), on top of the dents they already have. */
  private onBend(ev: Ev<'bend'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    // the object's frame is in metres whatever the scale of the model root (a model drawn in centimetres): its pose is the root's position and rotation only
    b.root.updateWorldMatrix(true, false)
    const point = new this.THREE.Vector3(ev.hinge.point[0], ev.hinge.point[1], ev.hinge.point[2])
    const origin = this.v1
    const rotation = this.tmpQ
    b.root.matrixWorld.decompose(origin, rotation, this.v2)
    point.applyQuaternion(rotation).add(origin)
    const axis = this.worldDir(b, ev.hinge.axis)
    const side = this.worldDir(b, ev.hinge.side)
    for (const mv of pv.meshes) if (this.visuals.shown(mv)) this.visuals.applyBend(mv, point, axis, side, ev.angle)
  }

  private onDent(ev: Ev<'dent'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const wp = new this.THREE.Vector3(ev.worldPoint[0], ev.worldPoint[1], ev.worldPoint[2])
    const wn = this.worldDir(b, ev.dent.normal)
    const shown = pv.meshes.filter((mv) => this.visuals.shown(mv))
    const reach = shown.reduce((widest, mv) => Math.max(widest, this.visuals.dentReach(mv, wp, ev.dent)), ev.dent.radius)
    this.visuals.applyPartDent(shown, wp, wn, ev.dent, reach)
    if (def?.tags?.includes('metal')) this.vfx.burst('sparks', ev.worldPoint, [wn.x, wn.y, wn.z], 4 + Math.min(8, ev.dent.depth * 150), 3.2)
    this.impactSound(pv.material, ev.worldPoint, clamp(0.3 + ev.dent.depth * 12, 0.3, 1), ev.blow)
  }

  private onHole(ev: Ev<'hole'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    const def = this.world.materials.get(pv.material)
    const n = this.worldDir(b, ev.hole.normal)
    const look = debrisLook(def, 'shot')
    this.drawHoleMark(pv, ev.worldPoint, n, ev.hole.diameter, ev.time)
    if (ev.hole.through && ev.exitPoint) this.drawHoleMark(pv, ev.exitPoint, n.clone().negate(), ev.hole.diameter, ev.time)
    if (look.sparks) this.vfx.burst('sparks', ev.worldPoint, [n.x, n.y, n.z], 6, 3.5)
    if (ev.powder) {
      // what the part holds loose (flakes, flour) puffs out: a little back out of the entry, most out of the exit along the shot
      const puff = { color: ev.powder.color, size: 0.6, life: 1.6, alpha: 1.3 }
      this.vfx.burst('dust', ev.worldPoint, [n.x, n.y, n.z], this.low ? 5 : 10, 0.7, puff)
      if (ev.hole.through && ev.exitPoint) this.vfx.burst('dust', ev.exitPoint, [-n.x, -n.y, -n.z], this.low ? 10 : 20, 1.3, puff)
    }
    // the blow's own keys first (`impact_steel_ballistic`...), then the round's per-family key (`shot_metal`), which falls back to the plain impact
    this.sound(shotKey(def), ev.worldPoint, 0.6, impactSoundKeys(pv.material, def, ev.blow))
  }

  /** The mark of one hole on the mesh of `pv` nearest to the world `point`: a star crack in glass, a ragged rim and a dark disc elsewhere. */
  private drawHoleMark(pv: PartVis, point: Vec3, normal: THREE_NS.Vector3, diameter: number, time: number): void {
    const def = this.world.materials.get(pv.material)
    const look = debrisLook(def, 'shot')
    const wp = new this.THREE.Vector3(point[0], point[1], point[2])
    const mv = this.nearestMesh(pv, wp)
    if (!mv) return
    if (look.mark === 'star_crack') {
      const seed = hashNumbers(time, point[0], point[1], point[2])
      this.visuals.addCrack(mv, wp, normal, 7, Math.max(0.05, diameter * 5), 0xe8f4ff, seed)
      return
    }
    // wood tears its fibres around the hole: a ragged rim of fresh wood under it
    const fresh = look.mark === 'splintered_hole' ? def?.visual?.innerColor : undefined
    if (fresh !== undefined) this.visuals.addSpall(mv, wp, normal, Math.max(0.006, diameter * WOOD_RIM), fresh)
    this.visuals.addHole(mv, wp, normal, diameter)
  }

  private onCrack(ev: Ev<'crack'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    if (!b || !pv) return
    this.drawCrackMark(b, pv, ev.crack, ev.worldPoint, ev.time)
    this.impactSound(pv.material, ev.worldPoint, 0.5, ev.blow)
  }

  /** The mark of one crack: the mortar gap of a settlement crack on both faces of a wall, or the star lines of glass; an opaque body shows chips, holes and dents instead. */
  private drawCrackMark(b: Bound, pv: PartVis, crack: Crack, worldPoint: Vec3, time: number): void {
    const def = this.world.materials.get(pv.material)
    const stair = crack.stair
    // a stair-step crack of settlement opens the mortar joints of the wall: a dark gap drawn on its face, as wide as it opened (and wide enough to be seen)
    if (stair && !def?.visual?.transparent) {
      const wp = new this.THREE.Vector3(worldPoint[0], worldPoint[1], worldPoint[2])
      const seed = hashNumbers(time, worldPoint[0], worldPoint[1], worldPoint[2])
      const width = Math.max(stair.width, MIN_DRAWN_CRACK_WIDTH)
      const normal = this.worldDir(b, crack.normal)
      const toward = this.worldDir(b, stair.along)
      const look = { length: crack.length, step: stair.step, width, color: SETTLEMENT_CRACK_COLOR, seed }
      // the same crack on both faces of the wall (the far one seen from behind: its side runs the other way round, its path the same)
      for (const face of [wp, wp.clone().addScaledVector(normal, -stair.through)]) {
        const out = face === wp ? normal : normal.clone().negate()
        const mv = this.nearestMesh(pv, face)
        if (mv) this.visuals.addStairCrack(mv, face, out, toward, look)
      }
    }
    // only glass shows a crack as lines (the break runs inside a clear body); an opaque body shows its damage as chips, holes and dents, never lines drawn over it
    else if (def?.visual?.transparent) {
      const wp = new this.THREE.Vector3(worldPoint[0], worldPoint[1], worldPoint[2])
      const mv = this.nearestMesh(pv, wp)
      const seed = hashNumbers(time, worldPoint[0], worldPoint[1], worldPoint[2])
      if (mv) this.visuals.addCrack(mv, wp, this.worldDir(b, crack.normal), crack.rays, crack.length, 0xe8f4ff, seed)
    }
  }

  /** Outward normal of the face of `mv` nearest to a world point: the thin axis of its world box (right for a wall; a sloped face is left to the vertex-range binding). */
  private faceNormal(mv: PartVis['meshes'][number], point: THREE_NS.Vector3): THREE_NS.Vector3 {
    const box = this.visuals.worldBox(mv, this.box)
    const size = box.getSize(this.v1)
    const axis = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z'
    const side = point[axis] >= (box.min[axis] + box.max[axis]) / 2 ? 1 : -1
    return new this.THREE.Vector3(axis === 'x' ? side : 0, axis === 'y' ? side : 0, axis === 'z' ? side : 0)
  }

  /**
   * Plays the effect the event map names for a destruction event (`data/event-effects.json` of `game-vfx`, or `RendererOptions.eventEffects`) at a point.
   * `play` gives the family of the material (the map's `{material}`) and the colours of its debris and dust. Answers whether one played, so the caller can
   * leave out the burst it replaces.
   */
  private playEvent(event: GameEvent, point: Vec3, play?: FamilyPlay): boolean {
    const id = effectForEvent(play && event.material === undefined ? { ...event, material: play.material } : event, this.o.eventEffects ?? EVENT_EFFECTS_MAP)
    if (!id) return false
    return this.vfx.play(id, point, { seed: hashNumbers(point[0], point[1], point[2], this.time), ...(play ? { values: play.values } : {}) }) !== null
  }

  /** The family and colours of a part's material, for the effects of the event map. */
  private partPlay(objectId: string, partId: string): FamilyPlay {
    const pv = this.partVis(objectId, partId)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    return familyPlay(def, pv ? (this.partColor(pv, def) ?? undefined) : undefined)
  }

  /** A coat came off: a patch in the colour of the core under it, below the bullet holes and cracks. */
  private onSpall(ev: Ev<'spall'>): void {
    const pv = this.partVis(ev.object, ev.part)
    if (!pv) return
    const wp = new this.THREE.Vector3(ev.point[0], ev.point[1], ev.point[2])
    const mv = this.nearestMesh(pv, wp)
    if (!mv) return
    const def = this.world.materials.get(pv.material)
    const normal = this.faceNormal(mv, wp)
    const core = def?.visual?.innerColor
    const look = debrisLook(def, 'spall', { partColor: this.partColor(pv, def) ?? undefined })
    // masonry crumbles in the colour of what is under the coat (brick orange, concrete grey); the generic impact would throw dark grey chips, and a
    // material with no impact recipe of its own (plastic, fabric, soil) throws its own debris in its colour, not the concrete impact
    if (core !== undefined || look.impact === undefined) this.vfx.burst(look.debris, ev.point, [normal.x, normal.y, normal.z], 5, 2.5, { color: look.color })
    else this.playEvent({ kind: 'spall', material: look.impact }, ev.point)
    if (core !== undefined) this.trickleFrom(ev.point, [normal.x, normal.y, normal.z], core, mv)
    // a drawing that shows the coat coming off itself (the house renderer cuts its plaster and draws the bricks under it) takes no flat patch
    if ((mv.mesh.userData.drawnSpalls as string[] | undefined)?.includes(ev.part)) return
    this.visuals.addSpall(mv, wp, normal, Math.sqrt(ev.area / Math.PI), core ?? fallbackColor(def))
  }

  /**
   * Grit and dust go on falling from where a blow broke a hard face (masonry, concrete, wood) for `TRICKLE_SECONDS`, a pinch at a time and less and
   * less. The place is held on the mesh it broke on (`mv`), so it falls with the object when it tips or a piece of it comes away.
   */
  private trickleFrom(point: Vec3, normal: Vec3, color: number | undefined, mv: MeshVis | null): void {
    if (this.trickles.length >= TRICKLE_MAX) this.trickles.shift()
    const total = TRICKLE_SECONDS[0] + (TRICKLE_SECONDS[1] - TRICKLE_SECONDS[0]) * this.rng()
    const anchor = mv ? anchorOnMesh(this.THREE, mv, point, normal) : null
    this.trickles.push({ point: [point[0], point[1], point[2]], normal, anchor, color, left: total, total, next: TRICKLE_EVERY, source: this.emitting ?? mv?.home })
  }

  private updateTrickles(dt: number): void {
    for (let i = this.trickles.length - 1; i >= 0; i--) {
      const t = this.trickles[i]!
      t.left -= dt
      t.next -= dt
      if (t.left <= 0) {
        this.trickles.splice(i, 1)
        continue
      }
      if (t.next > 0) continue
      if (t.anchor) {
        // nothing left to crumble from: the part broke into fragments or is gone
        if (!anchorWorld(t.anchor, this.visuals.shown(t.anchor.mv), this.v1, this.v2)) {
          this.trickles.splice(i, 1)
          continue
        }
        t.point = [this.v1.x, this.v1.y, this.v1.z]
        t.normal = [this.v2.x, this.v2.y, this.v2.z]
      }
      // falling off the face, slower as the loose grit runs out
      const share = t.left / t.total
      t.next = TRICKLE_EVERY / Math.max(share, 0.25)
      const out: Vec3 = [t.normal[0] * 0.2, -1, t.normal[2] * 0.2]
      const options = { ...(t.color !== undefined ? { color: t.color } : {}), ...(t.source !== undefined ? { source: t.source } : {}) }
      this.vfx.burst('chips', t.point, out, this.low ? 1 : 2, 0.3, options)
      if (this.rng() < 0.5) this.vfx.burst('dust', t.point, out, 1, 0.2, options)
    }
  }

  /**
   * Stage 2 of a staged part: the unit-sized fragments come out and the part stays drawn (hiding it is what `fracture` does). The opening itself
   * (cutting the wall's faces) is not drawn yet: it needs the per-vertex binding of the house renderer.
   */
  private onStage(ev: Ev<'stage'>): void {
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const at = ev.opening?.center ?? this.hitPoints.of(ev.object, ev.part, this.time) ?? this.rootPoint(ev.object)
    const played = this.playEvent({ kind: 'stage', stage: ev.stage }, at, this.partPlay(ev.object, ev.part))
    if (!ev.fragments || !ev.opening) return
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = 0; i < ev.fragments.length; i += step) {
      const fr = ev.fragments[i] as Fragment
      const fdef = this.world.materials.get(fr.material)
      this.fragments.spawn(fr, this.fragments.materialFor(fr.material, fdef === def || !fdef ? color : fallbackColor(fdef), false), ev.object, maxAlive)
    }
    if (!played) this.vfx.burst('dust', ev.opening.center, [0, 1, 0], 14, 1.2, { color })
    this.impactSound(pv?.material ?? '', ev.opening.center, 0.8, ev.blow)
  }

  /**
   * A unit came out of a wall of units: the unit flies as a fragment with a puff of its dust, and the marks drawn on it (bullet holes, spalls, the impact
   * marks of the effects) go with it. The gap itself is the drawing's (the house renderer cuts the wall where the unit was); a part drawn as one box
   * keeps its box.
   */
  private onChip(ev: Ev<'chip'>): void {
    const pv = this.partVis(ev.object, ev.part)
    const def = pv ? this.world.materials.get(pv.material) : undefined
    const color = (pv ? this.partColor(pv, def) : null) ?? fallbackColor(def)
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    for (const fr of ev.fragments) {
      const fdef = this.world.materials.get(fr.material)
      // the inside of the material (fresh wood) when the piece came from it, else the part's colour
      const tone = fragmentTone(fdef, fr, fdef === def ? color : fallbackColor(fdef))
      this.fragments.spawn(fr as Fragment, this.fragments.materialFor(fr.material, tone, false), ev.object, maxAlive)
    }
    // a unit knocked out of masonry or concrete leaves a broken edge that goes on crumbling
    if (def?.visual?.innerColor !== undefined || pv?.material === 'concrete' || pv?.material === 'brick') {
      this.trickleFrom(ev.center, [0, 0, 0], color, pv ? this.nearestMesh(pv, new this.THREE.Vector3(ev.center[0], ev.center[1], ev.center[2])) : null)
    }
    // what a blow tore off a face leaves the hole it made where it is
    if (ev.torn) {
      this.impactSound(pv?.material ?? '', ev.center, 0.5, ev.blow)
      return
    }
    // the holes and spalls drawn on the unit leave with it (also those on the wall a beam is drawn inside), and on the ragged edge of plaster around it
    const T = this.THREE
    const center = new T.Vector3(ev.center[0], ev.center[1], ev.center[2])
    const half = new T.Vector3(ev.size[0] / 2 + CHIP_DECAL_EDGE, ev.size[1] / 2 + CHIP_DECAL_EDGE, ev.size[2] / 2 + CHIP_DECAL_EDGE)
    const rotation = new T.Quaternion(ev.rotation[0], ev.rotation[1], ev.rotation[2], ev.rotation[3])
    for (const part of this.bounds.get(ev.object)?.parts.values() ?? []) for (const mv of part.meshes) this.visuals.clearDecals(mv, center, half, rotation)
    this.vfx.peekWorkshop()?.decals.clearInside(ev.center, [half.x, half.y, half.z], ev.rotation)
    // a puff of the unit's own dust; not the bullet impact effect, which would leave its black mark on the hole the unit left
    this.vfx.burst('dust', ev.center, [0, 1, 0], ev.units ? Math.min(40, 8 + ev.units.length) : 8, ev.units ? 1.6 : 0.8, { color })
    this.impactSound(pv?.material ?? '', ev.center, 0.7, ev.blow)
  }

  private onFracture(ev: Ev<'fracture'>): void {
    const b = this.bounds.get(ev.object)
    const pv = b?.parts.get(ev.part)
    const matId = pv?.material || (ev.fragments[0]?.material ?? '')
    const def = this.world.materials.get(matId)
    let color = fallbackColor(def)
    let opacity = 0.5
    const transparent = def?.visual?.transparent === true
    if (pv) {
      const c = this.partColor(pv, def)
      if (c !== null) color = c
      const m = pv.meshes[0] ? (materialsOf(pv.meshes[0].origMaterial)[0] as THREE_NS.Material | undefined) : undefined
      if (m && m.transparent) opacity = clamp(m.opacity, 0.2, 0.8)
      this.visuals.hide(pv, 'broken')
    }
    this.spawnFragments(ev, 0, { def, color, opacity, transparent })
    this.loosenIfFootless(ev.object)
    const up: Vec3 = [0, 1, 0]
    const sizeK = clamp(ev.fragments.length / 10, 0.5, 2)
    // what flies off is of the material that broke, in its colour: grey chips of concrete, orange of brick, splinters and pale dust of wood
    const look = debrisLook(def, 'fracture', { style: ev.style, partColor: color })
    const dust = look.dust !== undefined ? { color: look.dust } : undefined
    switch (ev.style) {
      case 'shatter':
        this.vfx.burst('shards', ev.point, up, 18 * sizeK, 3)
        break
      case 'crumble':
        this.vfx.burst('dust', ev.point, up, 16 * sizeK, 1.2, dust)
        this.vfx.burst(look.family === 'glass' ? 'shards' : 'chips', ev.point, up, 6, 3, { color: look.color })
        break
      case 'splinter':
        this.vfx.burst('splinters', ev.point, up, 14 * sizeK, 3, { color: look.color })
        this.vfx.burst('dust', ev.point, up, 5, 0.8, dust)
        break
      case 'tear':
        this.vfx.burst('fibers', ev.point, up, 12 * sizeK, 1.6, { color: look.color })
        break
      case 'snap':
        this.vfx.burst('chips', ev.point, up, 8 * sizeK, 3, { color: look.color })
        break
      default:
        this.vfx.burst('sparks', ev.point, up, 10, 4)
    }
    this.sound(fractureKey(def, ev.style), ev.point, clamp(0.4 + ev.fragments.length * 0.03, 0.4, 1), breakSoundKeys(matId, def, ev.blow))
  }

  /** Spawns the fragments of a fracture from index `from`; what does not fit in this frame's budget is spawned by the next frames. */
  private spawnFragments(ev: Ev<'fracture'>, from: number, look: { def: MaterialDef | undefined; color: number; opacity: number; transparent: boolean }): void {
    const maxAlive = this.low ? Math.floor(this.maxFragments / 2) : this.maxFragments
    const step = this.low ? 2 : 1
    for (let i = from; i < ev.fragments.length; i += step) {
      if (i - from >= MIN_FRAGMENTS_PER_SLICE * step && this.drainClock() >= this.sliceDeadline) {
        this.slices.push(() => this.spawnFragments(ev, i, look))
        return
      }
      const fr = ev.fragments[i]
      const fdef = this.world.materials.get(fr.material)
      const tone = fragmentTone(fdef, fr, fdef === look.def || !fdef ? look.color : fallbackColor(fdef))
      const mat = this.fragments.materialFor(fr.material, tone, look.transparent || fdef?.visual?.transparent === true, look.opacity)
      this.fragments.spawn(fr, mat, ev.object, maxAlive)
    }
  }

  private onDetach(ev: Ev<'detach'>): void {
    this.sound('detach', this.rootPoint(ev.object), 0.5)
    this.splitLoose(ev.object)
  }

  /**
   * The cage of a part gave way (`expose` with no bars): nothing holds its bars any more, so each comes down where it is, as steel debris that stays on the
   * ground with a body (`FragmentSystem.spawn` with `lasting`), not as bars left standing in the air.
   */
  private dropCage(objectId: string, partId: string): void {
    const bars = this.cages.take(`${objectId}|${partId}`)
    if (bars.length === 0) return
    const radius = this.cages.barRadius
    const density = this.world.materials.get('steel')?.density ?? STEEL_DENSITY
    const material = this.fragments.materialFor('steel', REBAR_COLOR, false)
    const rnd = createRng(hashString(`${objectId}|${partId}`))
    bars.forEach((bar, i) => {
      const fragment: Fragment = {
        id: `${partId}#bar${i}`, part: partId, material: 'steel', shape: 'chunk', center: bar.center, size: [2 * radius, bar.length, 2 * radius], rotation: bar.rotation,
        velocity: [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4], angularVelocity: [(rnd() - 0.5) * 1.5, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 1.5],
        mass: density * Math.PI * radius * radius * bar.length,
      }
      this.fragments.spawn(fragment, material, objectId, this.maxFragments, true)
    })
  }

  /**
   * What goes on at a part (its fire, its leak, its burn sound, its heat) moves with the part to the object a split made of it: it goes on where the
   * part is, as it falls, not where the object stood, and does not end because the part has a new id.
   */
  private followSplit(from: Bound, to: Bound): void {
    for (const part of to.parts.keys()) {
      const was = `${from.id}|${part}`
      const now = `${to.id}|${part}`
      const fire = this.fires.get(was)
      if (fire) {
        this.fires.delete(was)
        fire.object = to.id
        this.fires.set(now, fire)
      }
      const sound = this.burnSounds.get(was)
      if (sound) {
        this.burnSounds.delete(was)
        this.burnSounds.set(now, { ...sound, object: to.id })
      }
      if (this.active.delete(was)) this.active.set(now, { object: to.id, part })
    }
    from.root.updateWorldMatrix(true, false)
    to.root.updateWorldMatrix(true, false)
    const into = new this.THREE.Matrix4().copy(to.root.matrixWorld).invert()
    for (const leak of this.leaks) {
      if (leak.object !== from.id || !to.parts.has(leak.part)) continue
      leak.object = to.id
      const point = leak.localPoint ? this.v1.set(...leak.localPoint).applyMatrix4(from.root.matrixWorld) : this.v1.set(...leak.point)
      const direction = leak.localDirection ? this.v2.set(...leak.localDirection).transformDirection(from.root.matrixWorld) : this.v2.set(...leak.direction)
      point.applyMatrix4(into)
      direction.transformDirection(into)
      leak.localPoint = [point.x, point.y, point.z]
      leak.localDirection = [direction.x, direction.y, direction.z]
    }
  }

  /** Turn every loose group of the object (a detach, a collapse) into a piece of its own. */
  private splitLoose(objectId: string): void {
    if (!this.autoSplit) return
    const b = this.bounds.get(objectId)
    if (!b) return
    const st = this.world.state(objectId)
    if (!st || st.groups.length < 2) return
    const loose = st.groups.length - 1
    for (let i = 0; i < loose; i++) {
      if (i > 0 && this.drainClock() >= this.sliceDeadline) {
        this.slices.push(() => {
          this.staticDirty.add(objectId)
          this.splitLoose(objectId)
        })
        return
      }
      // the loose groups are always read from index 1: each split renumbers the rest
      let newId: string
      try {
        newId = this.world.splitGroup(objectId, 1)
      } catch {
        break
      }
      this.adoptSplit(b, newId)
    }
    const old = b.piece
    if (old) {
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      old.halfExtents = half
      this.pieceSys.setCenter(old, center)
      old.mass = Math.max(0.05, this.massOf(objectId))
      // what came off no longer touches the ground for it: its contacts are those of what is left
      // and what others meet it by are the boxes of what is left (`partBoxes`): nothing invisible collides
      if (old.contacts || old.round) {
        this.fitSurface(b, old)
        if (!old.round) this.setContacts(b, old, this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
      } else if (old.partBoxes) this.fitPartBoxes(b, old)
      old.sleeping = false
    } else if (kitOriginOf(b.root)?.kind === 'furniture') {
      // furniture only stands on the floor: what stayed (a leg, two legs and a board) is loose too, and what cannot stand on its own topples
      const piece = this.makePiece(objectId)
      this.tipIfTopHeavy(b)
      // the host stops keeping the footprint it had where it stood: it is a body that moves now
      this.o.onLoosened?.(objectId, piece, 'apart')
    }
  }

  /** The renderer side of `splitGroup`: a new group holding the meshes of the new object, made a piece. */
  private adoptSplit(from: Bound, newId: string): void {
    const state = this.world.state(newId)
    const root = from.root
    root.updateWorldMatrix(true, false)
    const group = new this.THREE.Group()
    group.name = `destruction-piece-${newId}`
    root.getWorldPosition(group.position)
    root.getWorldQuaternion(group.quaternion)
    this.scene.add(group)
    group.updateMatrixWorld(true)
    const nb: Bound = { id: newId, root: group, sync: true, parts: new Map(), lastPos: null, lastQuat: null, piece: null, isSplit: true }
    for (const p of state?.parts ?? []) {
      const pv = from.parts.get(p.id)
      if (!pv) continue
      from.parts.delete(p.id)
      nb.parts.set(p.id, pv)
      // its bare bars go with it
      this.cages.move(`${from.id}|${p.id}`, `${newId}|${p.id}`, group)
      for (const mv of pv.meshes) {
        // a part drawn by a range of a merged mesh leaves its faces behind: it gets a mesh of its own
        if (mv.host && !mv.loose) this.visuals.extract(mv, group)
        else {
          group.attach(mv.mesh)
          showCollapsedRanges(mv.mesh)
          mv.moved = true
        }
      }
    }
    this.bounds.set(newId, nb)
    for (const pv of nb.parts.values()) this.tagPart(pv, newId)
    this.followSplit(from, nb)
    const meshes = this.meshesOf(nb)
    if (meshes.length === 0) return
    const { half, center } = this.measure(group, meshes)
    let vel: Vec3 = [0, 0, 0]
    let ang: Vec3 = [0, 0, 0]
    const op = from.piece
    if (op) {
      vel = [...op.velocity]
      ang = [...op.angularVelocity]
      // linear velocity at the loose piece's centre
      const c = this.pieceSys.centerOf(op, new this.THREE.Vector3())
      const nc = center.clone().applyQuaternion(group.quaternion).add(group.position)
      vel[0] += ang[1] * (nc.z - c.z) - ang[2] * (nc.y - c.y)
      vel[1] += ang[2] * (nc.x - c.x) - ang[0] * (nc.z - c.z)
      vel[2] += ang[0] * (nc.y - c.y) - ang[1] * (nc.x - c.x)
    }
    const piece = this.pieceSys.create(newId, group, half, center, this.massOf(newId), vel, ang)
    nb.piece = piece
    this.fitSurface(nb, piece)
    if (kitOriginOf(from.root)?.kind === 'furniture') this.tipIfTopHeavy(nb)
    this.o.onPiece?.(piece)
  }

  /**
   * What lost what it stood on falls (furniture, a stand, a crate, a car; not a structure): with every leg of a table broken the top is loose, and with the legs of one side
   * gone what is left topples. Feet are the meshes at the bottom of the object as it was whole; while the ones left still span the same floor (a cupboard with a broken door,
   * a table missing one leg) it stands. A piece that lost a part is the box of what is left, touching the ground by the corners of each part (`setContacts`).
   */
  private loosenIfFootless(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b || !this.autoSplit) return
    const left = this.meshesOf(b).filter((mv) => this.visuals.shown(mv))
    if (left.length === 0) return
    // a house, a wall, the ground answer to their own load path: their pieces only take the box of what is left
    const structural = UNCHECKED_KINDS.has(this.kindOf(b))
    const body = b.piece ?? this.pieceSys.get(objectId)
    if (body) {
      // a piece is the box of what is left of it: the legs that broke off no longer hold it up
      const { half, center } = this.measure(b.root, left)
      body.halfExtents = half
      this.pieceSys.setCenter(body, center)
      body.mass = Math.max(0.05, this.massOf(objectId))
      if (!structural) {
        // what is left may be round (a can's label torn off) or not any more (a stool that lost its legs): its contacts follow
        this.fitSurface(b, body)
        if (!body.round) this.setContacts(b, body, left)
      }
      body.sleeping = false
      return
    }
    if (structural) return
    const boxOf = (mv: MeshVis): THREE_NS.Box3 => this.visuals.worldBox(mv, new this.THREE.Box3())
    const whole = [...b.parts.values()].flatMap((pv) => pv.meshes).map(boxOf).filter((one) => !one.isEmpty())
    // what hangs (a wall cabinet, a lamp) is held by what it hangs on: only what stood on something can lose its footing
    if (!this.standsOn(objectId, whole.map((one): [number, number, number, number, number, number] => [one.min.x, one.min.y, one.min.z, one.max.x, one.max.y, one.max.z]))) return
    const floor = Math.min(...whole.map((one) => one.min.y))
    const feetOf = (boxes: THREE_NS.Box3[]): THREE_NS.Box3 => boxes.filter((one) => one.min.y < floor + FEET_BAND).reduce((feet, one) => feet.union(one), new this.THREE.Box3())
    const was = feetOf(whole)
    const now = feetOf(left.map(boxOf).filter((one) => !one.isEmpty()))
    const same = !now.isEmpty() && now.min.x <= was.min.x + FEET_BAND && now.max.x >= was.max.x - FEET_BAND && now.min.z <= was.min.z + FEET_BAND && now.max.z >= was.max.z - FEET_BAND
    if (same) return
    if (!now.isEmpty()) {
      const box = left.map(boxOf).reduce((all, one) => all.union(one), new this.THREE.Box3())
      const centreX = (box.min.x + box.max.x) / 2
      const centreZ = (box.min.z + box.max.z) / 2
      const height = box.max.y - box.min.y
      const narrow = height >= TIP_MIN_HEIGHT && Math.min(now.max.x - now.min.x, now.max.z - now.min.z) < TIP_NARROW * height
      if (!narrow && centreX > now.min.x && centreX < now.max.x && centreZ > now.min.z && centreZ < now.max.z) return
    }
    const piece = this.makePiece(objectId)
    this.setContacts(b, b.piece ?? (piece as PieceBody), left)
    this.tipIfTopHeavy(b)
    // the host stops keeping the footprint it had where it stood: it is a body that moves now
    this.o.onLoosened?.(objectId, piece, 'apart')
  }

  shownBoxes(objectId: string, partId?: string): Array<[number, number, number, number, number, number]> {
    const b = this.bounds.get(objectId)
    if (!b) return []
    const box = new this.THREE.Box3()
    const out: Array<[number, number, number, number, number, number]> = []
    const pv = partId === undefined ? null : b.parts.get(partId)
    if (partId !== undefined && (!pv || pv.gone !== 'none')) return out
    for (const mv of pv ? pv.meshes : this.meshesOf(b)) {
      if (!this.visuals.shown(mv)) continue
      this.visuals.worldBox(mv, box)
      if (!box.isEmpty()) out.push([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z])
    }
    return out
  }

  /**
   * What is left of each object broken since the last update stands on something, or falls: an object that is not a piece whose lowest drawn box has neither the ground, a
   * fixed top nor a piece within `BROKEN_GAP` under it is made a piece on the spot (see `onBrokenChecked`).
   */
  private checkBroken(): void {
    if (this.broken.size === 0) return
    const ids = [...this.broken]
    this.broken.clear()
    for (const id of ids) {
      const released = this.releaseIfFloating(id)
      this.o.onBrokenChecked?.(id, released)
    }
  }

  private releaseIfFloating(objectId: string): boolean {
    const b = this.bounds.get(objectId)
    if (!b || b.piece || this.pieceSys.get(objectId) || !this.autoSplit || UNCHECKED_KINDS.has(this.kindOf(b))) return false
    const boxes = this.shownBoxes(objectId)
    if (boxes.length === 0) return false
    // the object as it was whole (it has not moved: it is no piece): one that hung (a wall cabinet, a lamp) is held by what it hangs on, not checked here
    const whole = new this.THREE.Box3()
    const wholeBoxes: Array<[number, number, number, number, number, number]> = []
    for (const pv of b.parts.values()) {
      for (const mv of pv.meshes) {
        this.visuals.worldBox(mv, whole)
        if (!whole.isEmpty()) wholeBoxes.push([whole.min.x, whole.min.y, whole.min.z, whole.max.x, whole.max.y, whole.max.z])
      }
    }
    if (!this.standsOn(objectId, wholeBoxes) || this.standsOn(objectId, boxes)) return false
    const piece = this.makePiece(objectId)
    this.setContacts(b, b.piece ?? (piece as PieceBody), this.meshesOf(b).filter((mv) => this.visuals.shown(mv)))
    this.tipIfTopHeavy(b)
    this.o.onLoosened?.(objectId, piece, 'apart')
    return true
  }

  /** Whether the lowest of `boxes` (world boxes of the object `objectId`) has the ground, a fixed top or a piece within `BROKEN_GAP` under it. */
  private standsOn(objectId: string, boxes: ReadonlyArray<readonly [number, number, number, number, number, number]>): boolean {
    if (boxes.length === 0) return false
    const low = Math.min(...boxes.map((one) => one[1]))
    for (const [x0, y0, z0, x1, , z1] of boxes) {
      if (y0 > low + FEET_BAND) continue
      for (const [fx, fz] of BROKEN_SAMPLES) {
        const x = x0 + (x1 - x0) * fx
        const z = z0 + (z1 - z0) * fz
        const under = Math.max(this.groundAt(x, z), this.staticTopAtBut(objectId, x, z, y0, BROKEN_GAP), this.pieceSys.topAt(x, z, y0, BROKEN_GAP, objectId))
        if (under >= y0 - BROKEN_GAP) return true
      }
    }
    return false
  }

  /** The kind of kit piece a bound object is, by the mark on its root or the nearest one above it (a house binds a group inside its marked root); '' when unmarked. */
  private kindOf(b: Bound): string {
    for (let o: THREE_NS.Object3D | null = b.root; o; o = o.parent) {
      const kind = kitOriginOf(o)?.kind
      if (kind) return kind
    }
    return ''
  }

  /** The top of the ground or of a standing part of the world under (x, z), below height y: a ray straight down through the destruction world. */
  private surfaceAt(x: number, y: number, z: number): number {
    const ground = this.groundAt(x, z)
    // a world that casts no rays (a stand-in in a test) has only the ground to land on
    if (y <= ground || typeof this.world.raycast !== 'function') return ground
    // a piece of rubble spawned inside a part (the top course of a wall under its bond beam) sees that part first, at no distance: look under it
    let from = y
    for (let k = 0; k < SURFACE_RAYS && from > ground; k++) {
      const hit = this.world.raycast([x, from, z], [0, -1, 0], from - ground)
      if (!hit) return ground
      if (hit.distance > SURFACE_INSIDE) return Math.max(ground, hit.point[1])
      from -= SURFACE_STEP
    }
    return ground
  }

  /** `staticTopAt` without the boxes of `objectId` itself. */
  private staticTopAtBut(objectId: string, x: number, z: number, y: number, step: number): number {
    let top = -Infinity
    for (const [id, a] of this.staticNow()) {
      if (id === objectId || a.length === 0 || x < a[0] || x > a[3] || z < a[2] || z > a[5]) continue
      for (let i = 6; i < a.length; i += 6) {
        if (x < a[i] || x > a[i + 3] || z < a[i + 2] || z > a[i + 5]) continue
        const t = a[i + 4]
        if (t > top && t <= y + step) top = t
      }
    }
    return top
  }

  /**
   * The piece touches the ground by the corners of each part left of it, not by the box around them all: on one leg, or on the legs of one side, its centre of mass is off
   * what holds it and it goes over until the top meets the floor. Past `CONTACT_MESHES` meshes it keeps the corners of its box; up to `PART_BOX_MESHES`, what lands on it lands
   * on its parts.
   */
  private setContacts(b: Bound, body: PieceBody, meshes: MeshVis[]): void {
    if (meshes.length > PART_BOX_MESHES) {
      body.contacts = undefined
      body.partBoxes = undefined
      return
    }
    const inv = specFrameInverse(this.THREE, b.root)
    const m4 = new this.THREE.Matrix4()
    const lb = new this.THREE.Box3()
    const [cx, cy, cz] = body.localCenter
    const points: Vec3[] = []
    const boxes: Array<{ center: Vec3; half: Vec3 }> = []
    for (const mv of meshes) {
      mv.mesh.updateWorldMatrix(true, false)
      this.visuals.localBox(mv, lb)
      if (lb.isEmpty()) continue
      lb.applyMatrix4(m4.multiplyMatrices(inv, mv.mesh.matrixWorld))
      for (let i = 0; i < 8; i++) points.push([(i & 1 ? lb.max.x : lb.min.x) - cx, (i & 2 ? lb.max.y : lb.min.y) - cy, (i & 4 ? lb.max.z : lb.min.z) - cz])
      boxes.push({
        center: [(lb.min.x + lb.max.x) / 2 - cx, (lb.min.y + lb.max.y) / 2 - cy, (lb.min.z + lb.max.z) / 2 - cz],
        half: [Math.max(0.005, (lb.max.x - lb.min.x) / 2), Math.max(0.005, (lb.max.y - lb.min.y) / 2), Math.max(0.005, (lb.max.z - lb.min.z) / 2)],
      })
    }
    body.contacts = points.length > 0 && meshes.length <= CONTACT_MESHES ? points : undefined
    body.partBoxes = boxes.length > 1 ? boxes : undefined
  }

  /**
   * A piece of furniture standing on feet too close for its height (a board on two legs in a line, a lone leg) does not stay up: the box of a piece hides that its weight is up
   * high and its feet are thin, so it gets the start of the fall, across the line of its feet.
   */
  private tipIfTopHeavy(b: Bound): void {
    const piece = b.piece
    if (!piece) return
    const box = new this.THREE.Box3()
    const boxes = this.meshesOf(b).filter((mv) => this.visuals.shown(mv)).map((mv) => this.visuals.worldBox(mv, new this.THREE.Box3()))
    if (boxes.length === 0) return
    for (const one of boxes) box.union(one)
    const height = box.max.y - box.min.y
    const feet = new this.THREE.Box3()
    for (const one of boxes) if (one.min.y < box.min.y + FEET_BAND) feet.union(one)
    const spanX = feet.max.x - feet.min.x
    const spanZ = feet.max.z - feet.min.z
    if (height < TIP_MIN_HEIGHT || Math.min(spanX, spanZ) >= TIP_NARROW * height) return
    const across = spanX <= spanZ ? 0 : 2
    const lean = across === 0 ? box.min.x + box.max.x - feet.min.x - feet.max.x : box.min.z + box.max.z - feet.min.z - feet.max.z
    const away = lean < 0 ? -1 : 1
    // rotating about -z moves the top toward +x; rotating about +x moves it toward +z
    if (across === 0) this.pieceSys.tip(piece, 0, -away)
    else this.pieceSys.tip(piece, away, 0)
  }

  private onExplode(ev: Ev<'explode'>, options: ExplodeOptions = {}): void {
    const p = ev.point
    if (options.visual !== false) this.playExplosion(ev, options)
    this.vfx.push(p, ev.radius, 4)
    // shove pieces and fragments
    const c = this.v1
    const report = options.report
    const confinement = report?.find((r) => r.blast !== undefined)?.blast?.confinement ?? 1
    const energy = ev.energy * confinement
    // the energy that got to an object after what stood in the way: the world's shelter of this blast when it carries one, else the cover between the centre and the
    // object's centre (`blastReach`, always on: a wall, a car or a cupboard between them takes the push), as it stood when the part went off: the cupboard the wave
    // tears apart still met it, and the stove it throws was not in the way yet
    const wentOff = this.coverWhenWentOff.get(ev)
    const reachOf = (objectId: string, at: Vec3): number =>
      report?.find((r) => r.object === objectId)?.blast?.shelter ??
      wentOff?.get(objectId) ??
      this.world.blastReach?.(p, at, { ignore: ev.object ? [ev.object, objectId] : [objectId] }) ??
      1
    // the wave presses on the whole face it meets, so the push has no lever arm beyond the thinnest side of the body: a thin long piece (a shovel) is not spun by it
    const shove = (pc: PieceBody): void => {
      this.pieceSys.centerOf(pc, c)
      if (c.distanceTo(this.v2.set(p[0], p[1], p[2])) > ev.radius) return
      const area = this.waveArea(pc.halfExtents, pc.root.quaternion, c, p)
      const hit = blastShove({ point: p, energy, radius: ev.radius, reach: reachOf(pc.objectId, [c.x, c.y, c.z]) }, { position: [c.x, c.y, c.z], mass: pc.mass, ...(area !== undefined ? { area } : {}) }, this.o.blastShove)
      if (!hit) return
      const spread = Math.min(...pc.halfExtents)
      const momentum = hit.speed * pc.mass
      this.pieceSys.impulse(pc, [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum], [c.x + (this.rng() - 0.5) * spread, c.y + spread * 0.5, c.z + (this.rng() - 0.5) * spread])
    }
    for (const pc of [...this.pieceSys.list]) shove(pc)
    if (this.o.shoveable) this.loosen(p, ev.radius, energy, reachOf)
    this.fragments.blast(p, ev.radius, Math.min(20, Math.sqrt(energy) * 0.08))
    this.sound('explode', p, clamp(0.5 + ev.radius / 10, 0.5, 1), {
      radius: ev.radius,
      ...(ev.effect !== undefined ? { effect: ev.effect } : {}),
      ...(options.effect !== undefined ? { effect: options.effect } : {}),
      ...(report ? { confinement } : {}),
    })
  }

  /** The area a body shows the blast, or undefined when the host gave the numbers of the game rule (`blastShove`): then the push is that rule, not the blast wave. */
  private waveArea(half: Vec3, quaternion: THREE_NS.Quaternion, centre: THREE_NS.Vector3, point: Vec3): number | undefined {
    return this.o.blastShove === undefined ? this.areaFacing(half, quaternion, centre, point) : undefined
  }

  /** Square metres a box of half sizes `half` (its own axes, turned by `quaternion`) at `centre` shows a blast at `point`: the sum of its faces seen from there, by the cosine of each. */
  private areaFacing(half: Vec3, quaternion: THREE_NS.Quaternion, centre: THREE_NS.Vector3, point: Vec3): number {
    const toward = this.v3.set(centre.x - point[0], centre.y - point[1], centre.z - point[2])
    if (toward.lengthSq() < 1e-12) return 0
    toward.normalize().applyQuaternion(this.q1.copy(quaternion).invert())
    return 4 * (half[1] * half[2] * Math.abs(toward.x) + half[0] * half[2] * Math.abs(toward.y) + half[0] * half[1] * Math.abs(toward.z))
  }

  /** The cover between a part of the world that goes off and the centre of each piece and each shoveable body within its radius, as the world stands at that moment. */
  private coverAround(ev: Ev<'explode'>): Map<string, number> {
    const cover = new Map<string, number>()
    const reach = this.world.blastReach
    if (!reach) return cover
    const point = new this.THREE.Vector3(ev.point[0], ev.point[1], ev.point[2])
    const centre = new this.THREE.Vector3()
    const read = (objectId: string): void => {
      if (centre.distanceTo(point) <= ev.radius) cover.set(objectId, reach.call(this.world, ev.point, [centre.x, centre.y, centre.z], { ignore: [ev.object, objectId] }))
    }
    for (const pc of this.pieceSys.list) {
      this.pieceSys.centerOf(pc, centre)
      read(pc.objectId)
    }
    const shoveable = this.o.shoveable
    if (!shoveable) return cover
    for (const b of this.bounds.values()) {
      if (b.piece || cover.has(b.id) || !shoveable(b.id) || !this.world.has(b.id)) continue
      centre.copy(this.measure(b.root, this.meshesOf(b)).center).applyQuaternion(b.root.quaternion).add(b.root.position)
      read(b.id)
    }
    return cover
  }

  /** The bound objects without a piece that the host lets a blast move (`shoveable`): the ones it reaches with enough speed become pieces and get the shove. */
  private loosen(point: Vec3, radius: number, energy: number, reachOf: (objectId: string, at: Vec3) => number): void {
    const shoveable = this.o.shoveable
    if (!shoveable) return
    for (const b of [...this.bounds.values()]) {
      if (b.piece || this.pieceSys.get(b.id) || !shoveable(b.id) || !this.world.has(b.id)) continue
      const { half, center } = this.measure(b.root, this.meshesOf(b))
      const world = center.clone().applyQuaternion(b.root.quaternion).add(b.root.position)
      const mass = this.massOf(b.id)
      if (world.distanceTo(this.v2.set(point[0], point[1], point[2])) > radius) continue
      const area = this.waveArea(half, b.root.quaternion, world, point)
      const hit = blastShove({ point, energy, radius, reach: reachOf(b.id, [world.x, world.y, world.z]) }, { position: [world.x, world.y, world.z], mass, ...(area !== undefined ? { area } : {}) }, this.o.blastShove)
      if (!hit) continue
      const piece = this.makePiece(b.id, { mass })
      const body = this.pieceSys.get(b.id)
      if (!body) continue
      this.o.onLoosened?.(b.id, piece, 'blast')
      const spread = Math.min(...half)
      const momentum = hit.speed * mass
      this.pieceSys.impulse(body, [hit.direction[0] * momentum, hit.direction[1] * momentum, hit.direction[2] * momentum], [world.x + (this.rng() - 0.5) * spread, world.y + spread * 0.5, world.z + (this.rng() - 0.5) * spread])
    }
  }

  private playExplosion(ev: Ev<'explode'>, options: ExplodeOptions): void {
    const named = options.effect ?? ev.effect
    const direction = options.direction
    const scale = clamp(ev.radius / GENERIC_REFERENCE_RADIUS, 0.2, 3)
    if (named !== undefined && this.vfx.explosion(named, ev.point, direction ? { direction } : {}) !== null) return
    this.vfx.explosion('generic', ev.point, { scale, ...(direction ? { direction } : {}) })
  }

  private startFire(ev: { object: string; part: string; point: Vec3 }): void {
    const key = `${ev.object}|${ev.part}`
    this.stopFire(key)
    this.fires.set(key, { object: ev.object, part: ev.part, point: ev.point, follow: { x: ev.point[0], y: ev.point[1], z: ev.point[2] } })
  }

  private stopFire(key: string): void {
    const fire = this.fires.get(key)
    if (fire) {
      if (fire.handle !== undefined) this.vfx.stop(fire.handle)
      this.fires.delete(key)
    }
    this.endBurnSound(key)
  }

  /** A part's fire loop starts; one already running for the part (it caught again) is ended first, so the host never counts a fire twice. */
  private startBurnSound(object: string, part: string, point: Vec3, detail: SoundDetail | undefined): void {
    const key = `${object}|${part}`
    this.endBurnSound(key)
    this.burnSounds.set(key, { object, point, detail })
    this.sound('burn_loop', point, 0.5, detail)
  }

  /** The part's fire loop ends, with the point and the fuel it started with; nothing when it has none running. */
  private endBurnSound(key: string): void {
    const started = this.burnSounds.get(key)
    if (!started) return
    this.burnSounds.delete(key)
    this.sound('burn_end', started.point, 0.5, started.detail)
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Fire, heat, char, melt, leaks
  // ----------------------------------------------------------------------------------------------------------------------------------

  private updateActive(dt: number): void {
    this.scanTimer += dt
    if (this.scanTimer >= 0.4) {
      this.scanTimer = 0
      for (const b of this.bounds.values()) {
        for (const pv of b.parts.values()) {
          if (pv.gone !== 'none' && pv.gone !== 'broken') continue
          const ps = this.world.part(b.id, pv.id)
          if (!ps) continue
          const def = this.world.materials.get(pv.material)
          if (
            ps.burning ||
            (def?.visual?.glows && ps.temperature > GLOW_FROM_C) ||
            Math.abs(ps.char - pv.charApplied) > 0.01 ||
            Math.abs(ps.melt - pv.meltApplied) > 0.01 ||
            (pv.gone === 'none' && (ps.status === 'melted' || ps.status === 'ashes'))
          ) {
            this.activate(b.id, pv.id)
          }
        }
      }
    }
    for (const [key, a] of this.active) {
      const pv = this.partVis(a.object, a.part)
      const ps = pv ? this.world.part(a.object, a.part) : null
      if (!pv || !ps) {
        this.active.delete(key)
        this.stopFire(key)
        continue
      }
      const def = this.world.materials.get(pv.material)
      if (pv.gone === 'none') {
        this.visuals.setChar(pv, ps.char, def?.visual?.charColor ?? 0x1a1410)
        if (def?.visual?.glows) this.visuals.setGlow(pv, ps.temperature)
        this.visuals.setMelt(pv, ps.melt)
        if (ps.status === 'melted') this.onGone(a.object, pv, 'melted', def)
        else if (ps.status === 'ashes') this.onGone(a.object, pv, 'ashes', def)
      }
      const fire = this.fires.get(key)
      if (fire) {
        if (ps.burning && ps.status !== 'broken' && ps.status !== 'ashes' && ps.status !== 'melted') this.emitFire(fire, pv, def)
        else this.stopFire(key)
      }
      const hot = def?.visual?.glows === true && ps.temperature > GLOW_FROM_C
      if (!ps.burning && !hot && Math.abs(ps.char - pv.charApplied) < 0.01 && Math.abs(ps.melt - pv.meltApplied) < 0.01) {
        if (def?.visual?.glows && pv.gone === 'none') this.visuals.setGlow(pv, 0)
        this.active.delete(key)
      }
    }
  }

  private onGone(objectId: string, pv: PartVis, reason: 'melted' | 'ashes', def: MaterialDef | undefined): void {
    const bb = new this.THREE.Box3()
    for (const mv of pv.meshes) bb.union(this.visuals.worldBox(mv, this.box))
    this.visuals.hide(pv, reason)
    if (bb.isEmpty()) return
    const c = bb.getCenter(new this.THREE.Vector3())
    const s = bb.getSize(new this.THREE.Vector3())
    const footprint = Math.sqrt(Math.max(s.x * s.z, 1e-4))
    if (reason === 'melted') {
      this.ground.add('puddle', c.x, c.z, clamp(footprint * 0.55, 0.05, 1), this.partColor(pv, def) ?? fallbackColor(def), objectId)
    } else {
      this.ground.add('ash', c.x, c.z, clamp(footprint * 0.35, 0.04, 0.5), 0x1d1a18, objectId)
      this.vfx.burst('ash', [c.x, bb.max.y, c.z], [0, 1, 0], 10, 0.8, { source: objectId })
    }
  }

  private emitFire(f: FireEmitter, pv: PartVis, def: MaterialDef | undefined): void {
    const bb = this.box
    bb.makeEmpty()
    const tmp = new this.THREE.Box3()
    for (const mv of pv.meshes) if (this.visuals.shown(mv)) bb.union(this.visuals.worldBox(mv, tmp))
    if (bb.isEmpty()) {
      // nothing of the part is drawn (a roof rafter has no mesh, or the part broke or burnt away): no flame may hang where it was
      if (f.handle !== undefined) this.vfx.stop(f.handle)
      delete f.handle
      return
    }
    const c = bb.getCenter(this.v1)
    f.follow.x = c.x
    f.follow.y = bb.min.y
    f.follow.z = c.z
    if (f.handle !== undefined) return
    const size = bb.getSize(this.v2)
    const radius = clamp(Math.max(size.x, size.z) * 0.5, 0.12, 1.2)
    const smokeColor = SMOKE_TONES[def?.thermal.smoke ?? 'grey']
    f.handle = this.vfx.fire({ point: [f.follow.x, f.follow.y, f.follow.z], radius, life: FIRE_CEILING_SECONDS, follow: f.follow, source: f.object, ...(smokeColor !== undefined ? { smokeColor } : {}) })
  }

  private updateLeaks(dt: number): void {
    for (let i = this.leaks.length - 1; i >= 0; i--) {
      const l = this.leaks[i]
      const b = this.bounds.get(l.object)
      const ps = this.world.part(l.object, l.part)
      // a leak ends when the container is empty or the opening is closed (a valve shut, `seal`)
      if (!b || !ps || ps.liters === undefined || ps.liters <= 1e-4 || (l.opened && !ps.holes.some((h) => h.through))) {
        this.leaks.splice(i, 1)
        continue
      }
      l.life = (l.life ?? 0) + dt
      if (l.pressurized && l.life > 0.8) l.pressurized = false

      if (l.lastLiters !== undefined && Math.abs(ps.liters - l.lastLiters) < 1e-5) {
        l.idleSeconds = (l.idleSeconds ?? 0) + dt
        if (l.idleSeconds > 0.4) {
          this.leaks.splice(i, 1)
          continue
        }
      } else {
        l.idleSeconds = 0
        l.lastLiters = ps.liters
      }

      let pt = l.point
      let dir = l.direction
      if (l.localPoint && l.localDirection) {
        b.root.updateWorldMatrix(true, false)
        const wp = this.v1.set(l.localPoint[0], l.localPoint[1], l.localPoint[2]).applyMatrix4(b.root.matrixWorld)
        const wd = this.v2.set(l.localDirection[0], l.localDirection[1], l.localDirection[2]).transformDirection(b.root.matrixWorld).normalize()
        pt = [wp.x, wp.y, wp.z]
        dir = [wd.x, wd.y, wd.z]
        l.point = pt
        l.direction = dir
      }

      l.acc += clamp(20 + l.rate * 400, 15, 120) * dt
      const color = FLUID_COLORS[l.fluid] ?? 0xaaaaaa
      const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
      const sp = l.pressurized ? 2.5 + this.rng() * 1.5 : 0.3 + this.rng() * 0.3
      while (l.acc >= 1) {
        l.acc -= 1
        const vel: Vec3 = [(dir[0] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[1] / dl) * sp + (this.rng() - 0.5) * 0.25, (dir[2] / dl) * sp + (this.rng() - 0.5) * 0.25]
        if (l.fluid === 'gas') this.vfx.spawn('steam', pt, vel, { color, size: 0.5, alpha: 0.5, source: l.object })
        else this.vfx.spawn('drips', pt, vel, { color, tag: this.rng() < 0.03 ? this.tagOf(l.object) : 0, owner: this.owner, source: l.object })
      }
    }
  }

  private tagOf(object: string): number {
    let tag = this.homeTags.indexOf(object) + 1
    if (tag === 0) tag = this.homeTags.push(object)
    return tag
  }

  // ----------------------------------------------------------------------------------------------------------------------------------
  // Emit, clear, restore, stats, dispose
  // ----------------------------------------------------------------------------------------------------------------------------------

  emit(kind: DebrisKind | 'fire' | 'flash' | 'foam', point: Vec3, normal: Vec3, count: number, speed?: number): void {
    this.vfx.burst(kind, point, normal, count, speed ?? DEFAULT_SPEED[kind] ?? 1, kind === 'smoke' ? { color: SMOKE_TONES.grey } : undefined)
  }

  explode(point: Vec3, energy: number, radius: number, options?: ExplodeOptions): void {
    this.onExplode({ type: 'explode', object: '', part: '', time: this.time, point, energy, radius }, options)
  }

  restore(objectId: string): void {
    const homes = new Set<string>([objectId])
    const self = this.bounds.get(objectId)
    if (self?.isSplit) for (const pv of self.parts.values()) homes.add(pv.home)
    for (const home of homes) this.restoreHome(home)
    for (const [key, a] of [...this.active]) if (homes.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (homes.has(f.object)) this.stopFire(key)
    for (const [key, started] of [...this.burnSounds]) if (homes.has(started.object)) this.endBurnSound(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (homes.has(this.leaks[i].object)) this.leaks.splice(i, 1)
    for (const home of homes) {
      this.fragments.removeHome(home)
      this.ground.removeHome(home)
      this.cages.removeObject(home)
    }
  }

  /**
   * Draws a bound object again from the state its world holds now: the host put it back damaged (`DestructionWorld.loadObject`) and the meshes, still whole, take its dents, holes,
   * cracks, bend and char, with the broken, melted and burned parts hidden, as the live path drew them. Marks the meshes already carry are wiped first.
   */
  redraw(objectId: string): void {
    const b = this.bounds.get(objectId)
    if (!b) return
    this.restoreHome(objectId)
    b.root.updateWorldMatrix(true, false)
    for (const pv of b.parts.values()) this.drawPartState(b, pv)
  }

  private drawPartState(b: Bound, pv: PartVis): void {
    const ps = this.world.part(b.id, pv.id)
    if (!ps) return
    if (ps.status === 'broken' || ps.status === 'melted' || ps.status === 'ashes') {
      this.visuals.hide(pv, ps.status)
      return
    }
    const toWorld = (local: Vec3): Vec3 => {
      const at = new this.THREE.Vector3(local[0], local[1], local[2]).applyMatrix4(b.root.matrixWorld)
      return [at.x, at.y, at.z]
    }
    const shown = pv.meshes.filter((mv) => this.visuals.shown(mv))
    for (const dent of ps.dents) {
      const at = toWorld(dent.point)
      const wp = new this.THREE.Vector3(at[0], at[1], at[2])
      const reach = shown.reduce((widest, mv) => Math.max(widest, this.visuals.dentReach(mv, wp, dent)), dent.radius)
      this.visuals.applyPartDent(shown, wp, this.worldDir(b, dent.normal), dent, reach)
    }
    for (const hole of ps.holes) this.drawHoleMark(pv, toWorld(hole.point), this.worldDir(b, hole.normal), hole.diameter, 0)
    for (const crack of ps.cracks) this.drawCrackMark(b, pv, crack, toWorld(crack.point), 0)
    if (ps.bend !== undefined && ps.bendHinge) {
      const hinge = new this.THREE.Vector3(...toWorld(ps.bendHinge.point))
      const axis = this.worldDir(b, ps.bendHinge.axis)
      const side = this.worldDir(b, ps.bendHinge.side)
      for (const mv of shown) this.visuals.applyBend(mv, hinge, axis, side, ps.bend)
    }
    if (ps.char > 0 || ps.melt > 0) this.activate(b.id, pv.id)
  }

  release(objectId: string): string[] {
    const removed = this.releasePieces(objectId)
    this.unbind(objectId)
    return removed
  }

  releasePieces(objectId: string): string[] {
    const family = this.familyOf(objectId)
    const pieces = [...family].filter((id) => id !== objectId)
    const ofFamily = (key: string): boolean => [...family].some((id) => key.startsWith(`${id}|`))
    // an event still waiting would bring an effect of theirs back after they left
    for (let i = this.queue.length - 1; i >= 0; i--) if (family.has(this.queue[i]!.object)) this.queue.splice(i, 1)
    for (const [key, a] of [...this.active]) if (family.has(a.object)) this.active.delete(key)
    for (const [key, f] of [...this.fires]) if (family.has(f.object)) this.stopFire(key)
    for (const [key, started] of [...this.burnSounds]) if (family.has(started.object)) this.endBurnSound(key)
    for (const key of [...this.primedBurning]) if (ofFamily(key)) this.primedBurning.delete(key)
    for (let i = this.leaks.length - 1; i >= 0; i--) if (family.has(this.leaks[i]!.object)) this.leaks.splice(i, 1)
    for (let i = this.trickles.length - 1; i >= 0; i--) if (family.has(this.trickles[i]!.source ?? '')) this.trickles.splice(i, 1)
    for (const id of family) {
      this.fragments.removeHome(id)
      this.ground.removeHome(id)
      this.cages.removeObject(id)
      this.vfx.clearSource(id)
    }
    // the parts of the pieces go back to the object's binding (their meshes to where they were drawn, the ones made for them disposed)
    this.restore(objectId)
    for (const id of pieces) {
      this.pieceSys.remove(id)
      this.bounds.delete(id)
      this.hitPoints.forget(id)
      this.broken.delete(id)
      this.staticDirty.add(id)
      if (this.world.has(id)) this.world.remove(id)
    }
    if (pieces.length > 0) this.o.onReleased?.(pieces)
    return pieces
  }

  /** The object and every piece split from it (a piece holds parts whose home is the object, also a piece of a piece). */
  private familyOf(objectId: string): Set<string> {
    const family = new Set([objectId])
    for (const b of this.bounds.values()) {
      if (!b.isSplit) continue
      for (const pv of b.parts.values()) {
        if (pv.home !== objectId) continue
        family.add(b.id)
        break
      }
    }
    return family
  }

  private restoreHome(home: string): void {
    const homeBound = this.bounds.get(home)
    for (const b of [...this.bounds.values()]) {
      for (const [pid, pv] of [...b.parts]) {
        if (pv.home !== home) continue
        this.settlement.forget(pv)
        this.visuals.restorePart(pv)
        this.tagPart(pv, home)
        if (b !== homeBound && homeBound) {
          b.parts.delete(pid)
          homeBound.parts.set(pid, pv)
        }
      }
      if (b.isSplit && b.parts.size === 0) {
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.bounds.delete(b.id)
        // its box leaves now: the periodic round only walks the objects still bound
        this.staticDirty.add(b.id)
      }
    }
  }

  clear(): void {
    // the meshes go back to their own draw before they are restored or removed
    this.settledBatches.clear()
    // what was bound is gone: the next read measures what is left, all of it
    this.staticAll = true
    this.queue.length = 0
    this.slices.length = 0
    this.active.clear()
    for (const key of [...this.fires.keys()]) this.stopFire(key)
    for (const key of [...this.burnSounds.keys()]) this.endBurnSound(key)
    this.leaks.length = 0
    this.trickles.length = 0
    this.settlement.clear()
    for (const id of [...this.bounds.keys()]) if (this.bounds.has(id)) this.restore(id)
    // anything left of a split object whose home is gone
    for (const b of [...this.bounds.values()]) {
      if (b.isSplit) {
        for (const pv of b.parts.values()) this.visuals.restorePart(pv)
        this.scene.remove(b.root)
        this.pieceSys.remove(b.id)
        this.bounds.delete(b.id)
      }
    }
    this.fragments.clear()
    this.ground.clear()
    this.cages.clear()
    this.primedBurning.clear()
    this.vfx.sprites().clear()
    this.ownVfx?.world.clear()
  }

  reset(): void {
    this.clear()
    this.rng = createRng(RNG_SEED)
    this.time = 0
    this.staticAt = 0
    this.staticRound = []
    this.staticAll = true
    this.throttles.clear()
    this.fragments.reset()
    this.pieceSys.reset()
  }

  wakeRegion(x: number, z: number, radius: number): void {
    this.fragments.wakeRegion(x, z, radius)
    this.pieceSys.wakeRegion(x, z, radius)
  }

  stats(): { fragments: number; particles: number; pieces: number; decals: number } {
    return { fragments: this.fragments.count, particles: this.vfx.sprites().live + this.ownedVfxParticles(), pieces: this.pieceSys.list.length, decals: this.visuals.decalCount + this.ground.count }
  }

  private ownedVfxParticles(): number {
    if (!this.ownVfx) return 0
    const { puffs, sparks, glows, chunks } = this.vfx.stats()
    return puffs + sparks + glows + chunks
  }

  // The last warm-up keeps its materials until the next one: a material that does not use lights keeps the program of the lights it was first drawn with, so each warm-up needs materials of its own.
  private warmProbes: { readonly group: THREE_NS.Group; readonly geometry: THREE_NS.BufferGeometry; readonly materials: THREE_NS.Material[] } | undefined

  warmUpProbes(): WarmUpProbes {
    this.releaseWarmProbes()
    const { kit } = this.visuals
    const T = this.THREE
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
    const materials = [kit.discMaterial().clone(), kit.patchMaterial(0x808080).clone(), kit.lineMaterial(0x000000).clone()]
    const group = new T.Group()
    group.add(new T.Mesh(kit.discGeometry(), materials[0]), new T.Mesh(kit.discGeometry(), materials[1]), new T.LineSegments(geometry, materials[2] as THREE_NS.LineBasicMaterial))
    group.add(...this.fragments.warmMeshes())
    for (const probe of group.children) probe.frustumCulled = false
    this.warmProbes = { group, geometry, materials }
    return { group, dispose: () => {} }
  }

  private releaseWarmProbes(): void {
    if (!this.warmProbes) return
    this.warmProbes.geometry.dispose()
    for (const material of this.warmProbes.materials) material.dispose()
    this.warmProbes = undefined
  }

  rebarCount(): number {
    return this.cages.count
  }

  dispose(): void {
    this.releaseWarmProbes()
    if (this.disposed) return
    this.unsubscribe()
    this.clear()
    for (const id of [...this.bounds.keys()]) this.unbind(id)
    this.fragments.dispose()
    this.ground.dispose()
    this.cages.dispose()
    this.stopLanding()
    this.visuals.dispose()
    this.ownVfx?.dispose()
    this.disposed = true
  }
}
