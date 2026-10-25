import type * as THREE_NS from 'three'
import { createDestruction, JOINT_DEFAULTS, resolveStrings as resolveDestructionStrings } from '@adatechnology/game-destruction'
import type { BlastOptions, DestructibleImpl, DestructibleSpec, DestructionEvent, JointState, Quat, RayHit, ToolKind, Vec3 } from '@adatechnology/game-destruction'
import { createAudioEngine, createAudioSink } from '@adatechnology/game-audio'
import type { AudioEngine } from '@adatechnology/game-audio'
import { createDestructionRenderer, createDestructionSound, specFromObject3D } from '@adatechnology/game-destruction-three'
import type { Piece } from '@adatechnology/game-destruction-three'
import { createArsenal, DEFAULT_LOADOUT } from '@adatechnology/game-weapons'
import type { MountKind, Shot, TriggerResult, Use, WeaponState } from '@adatechnology/game-weapons'
import { createFilmLcg, createFluids, createItemUse, ITEM_USES, resolveStrings as resolveFluidStrings } from '@adatechnology/game-fluids'
import type { FluidEvent, ItemUsePlayer, StainState } from '@adatechnology/game-fluids'
import { createFilmBridge, createFilmManager, createFluidRenderer } from '@adatechnology/game-fluids-three'
import { createGroundField, createVfx } from '@adatechnology/game-vfx'
import { createGroundPatch, createVfxRenderer } from '@adatechnology/game-vfx-three'
import type { FluidRenderer } from '@adatechnology/game-fluids-three'
import { checkAnimation, checkBench, checkDestructible, checkSpec, createEnvironmentBus, shotExtras } from '@adatechnology/game-contracts'
import type { AnimationClipSpec, HandTargetSource, HandTargets, HostEvent, ModuleArea, ModuleBench, ModuleHost, TestableModule, ToolCommand, ToolCommandResult } from '@adatechnology/game-contracts'
import { createArena } from './arena'
import type { Arena } from './arena'
import { createBenchStore } from './bench'
import type { BenchStore } from './bench'
import type { BenchView, MetricRow } from './bench-panel'
import { buildFromSpec } from './build-from-spec'
import { createExplosives } from './explosives'
import type { BlastSummary } from './explosives'
import { toHostEvent } from './host-events'
import { createLog } from './log'
import { createRoomMetrics, ROOM_METRICS } from './metrics'
import { createNarrator } from './narrate'
import { createPlayer, PLAYER_RADIUS } from './player'
import { DEFAULT_HAND_STANCES, DEFAULT_STRIKE_CLIPS, THIRD_PERSON_DEFAULTS, thirdPersonPose } from './avatar'
import type { CameraMode, RoomAvatar, RoomAvatarState, ThirdPersonOptions, ThirdPersonPose } from './avatar'
import { resolveStrings } from './locale'
import { createUi } from './ui'
import type { HudState, InspectInfo, RoomUi } from './ui'
import type {
  AnimationInfo,
  ModuleReport,
  RoomMetricId,
  ScenarioContext,
  ScenarioReport,
  SpawnedObject,
  TestRoom,
  TestRoomItem,
  TestRoomOptions,
  TestRoomScenario,
} from './types'

type Vars = Record<string, string | number>

interface Entry {
  so: SpawnedObject
  item?: TestRoomItem
  name: string
  arena: boolean
  containerId?: string
  fluidPart?: string
  fluidOffset: Vec3
  uses: string[]
  piece: Piece | null
  last: Vec3
  velocity: Vec3
}

interface FireZone {
  point: Vec3
  radius: number
  temperature: number
  remaining: number
  acc: number
}

interface BurningStain {
  center: Vec3
  remaining: number
  acc: number
}

const FIXED_DT = 1 / 60
const METRICS_INTERVAL_S = 0.25
/** The carried item in first person: how far the nearest of a small item is held (m), how far the palm sits under it and how closed the fingers are. */
const CARRY_NEAR = 0.62
const CARRY_PALM = 0.012
const CARRY_GRIP = 0.45
/** Faster than this (m/s) a change of the player's position is a teleport, not walking: the avatar does not stride for it. The player runs at 6.2. */
const MAX_STRIDE_SPEED = 10

const v3 = (v: THREE_NS.Vector3): Vec3 => [v.x, v.y, v.z]
const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Create the test room. See `TestRoomOptions`. The room owns a renderer, scene and camera unless you pass them; with your own renderer you call
 * `room.update(dt)` every frame and render yourself.
 */
export function createTestRoom(options: TestRoomOptions): TestRoom {
  const THREE = options.THREE
  const locale = options.locale ?? 'en'
  const S = resolveStrings(locale)
  const dStrings = resolveDestructionStrings(locale)
  const fStrings = resolveFluidStrings(locale)
  const t = (key: string, vars?: Vars): string => {
    let s = S.text[key] ?? key
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
    return s
  }
  const num = (n: number, digits = 1): string => {
    const s = (Math.round(n * 10 ** digits) / 10 ** digits).toFixed(digits)
    return locale.toLowerCase().startsWith('pt') ? s.replace('.', ',') : s
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Renderer, scene, camera
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const ownRenderer = !options.renderer
  const gl: THREE_NS.WebGLRenderer = options.renderer ?? new THREE.WebGLRenderer({ antialias: true })
  const container = options.container
  const width = (): number => container.clientWidth || 960
  const height = (): number => container.clientHeight || 600
  if (ownRenderer) {
    const r = gl as THREE_NS.WebGLRenderer
    r.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2))
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1
    r.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(r.domElement)
  }
  gl.setSize(width(), height())
  const dom = gl.domElement
  if (dom && !dom.hasAttribute?.('tabindex')) dom.setAttribute?.('tabindex', '0')
  const scene = options.scene ?? new THREE.Scene()
  const camera = options.camera ?? new THREE.PerspectiveCamera(72, width() / height(), 0.05, 140)
  if (!options.camera) scene.add(camera)
  const resize = (): void => {
    const w = width()
    const h = height()
    gl.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const onResize = (): void => resize()
  window.addEventListener('resize', onResize)

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Worlds
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const arenaSize = options.arenaSize ?? 14
  const arena: Arena = createArena(THREE, arenaSize, scene)
  scene.add(arena.group)

  const ownWorld = !options.world
  const world = options.world ?? createDestruction({ seed: 1, ...options.worldOptions, materials: [...(options.worldOptions?.materials ?? [])] })
  const pristineWorld = ownWorld ? world.serialize() : null
  const tableOk = (): boolean => {
    const p = world.part(arena.table.id, arena.table.topPart)
    return !!p && p.status !== 'broken' && p.status !== 'melted' && p.status !== 'ashes'
  }
  // tops of spawned objects that hold others (a module's counter, a shelf board): loose things rest on them while the object is in the world
  const restingTops: Array<{ objectId: string; minX: number; maxX: number; minZ: number; maxZ: number; top: number }> = []
  const restingTopAt = (x: number, z: number): number => {
    let top = 0
    for (const c of restingTops) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && world.has(c.objectId)) top = Math.max(top, c.top)
    return top
  }
  const groundAt = (x: number, z: number): number =>
    Math.max(x > arena.table.minX && x < arena.table.maxX && z > arena.table.minZ && z < arena.table.maxZ && tableOk() ? arena.table.top : 0, restingTopAt(x, z))

  const ownFluids = !options.fluids
  const fluids = options.fluids ?? createFluids({ seed: 1, locale, liquids: options.liquids, groundAt })
  const pristineFluids = ownFluids ? fluids.serialize() : null
  for (const s of [...arena.surfaces, ...(options.surfaces ?? [])]) fluids.addSurface(s)
  const itemUseDefs = [...ITEM_USES, ...(options.itemUses ?? [])]

  const quality = options.quality ?? 'medium'
  const pointScale = height() / (2 * Math.tan((camera.fov * Math.PI) / 360))
  const rendererPieces = new Map<string, Piece>()
  const entries = new Map<string, Entry>()
  const splitOf = new Map<string, Entry>()
  let simTime = 0
  const log = createLog({ exportCancelled: () => t('log.export_cancelled') })
  log.setClock(() => simTime)

  // sound: one engine for the room (no AudioContext until the first sound), and the destruction renderer's sound keys play on it
  const ownAudio = options.audio === undefined
  const audio: AudioEngine | null = options.audio === false ? null : (options.audio ?? createAudioEngine())
  const destructionSound = audio ? createDestructionSound(audio) : null
  const playSound = (key: string, point: Vec3, volume: number): void => {
    destructionSound?.onSound(key, point, volume)
    options.onSound?.(key, point, volume)
  }

  // one effects world for the whole room: the destruction and fluid renderers and every module draw into it, and the room steps it once per frame
  const craterField = options.craters ? createGroundField() : undefined
  const craterPatch = craterField ? createGroundPatch(THREE, { field: craterField, material: new THREE.MeshStandardMaterial({ color: 0x8e8e8a, roughness: 0.95 }) }) : undefined
  if (craterPatch) {
    const floor = arena.group.getObjectByName('floor')
    if (floor) floor.visible = false
    scene.add(craterPatch.mesh)
  }
  const vfx = createVfxRenderer(THREE, {
    scene,
    camera,
    overlay: container,
    quality,
    pointScale,
    vfx: createVfx({
      profile: quality,
      groundAt: (x, z) => groundAt(x, z) + (craterField?.heightAt(x, z) ?? 0),
      ...(craterField ? { ground: craterField } : {}),
    }),
  })
  const renderer = createDestructionRenderer(THREE, {
    scene,
    world,
    vfx: vfx.world,
    quality,
    groundAt,
    pointScale,
    onSound: playSound,
    onPiece: (piece) => {
      rendererPieces.set(piece.objectId, piece)
      loose.push(piece)
      // find the entry it came from: the one whose spec holds all its parts and that is nearest
      const st = world.state(piece.objectId)
      if (!st) return
      let best: Entry | null = null
      let bestD = Infinity
      for (const e of entries.values()) {
        const spec = specs.get(e.so.objectId)
        if (!spec) continue
        const ids = new Set(spec.parts.map((p) => p.id))
        if (!st.parts.every((p) => ids.has(p.id))) continue
        const d = e.so.root.position.distanceTo(piece.root.position)
        if (d < bestD) {
          bestD = d
          best = e
        }
      }
      if (best) splitOf.set(piece.objectId, best)
    },
  })
  const fluidView: FluidRenderer = createFluidRenderer(THREE, { scene, fluids, quality, pointScale, vfx: vfx.world })
  // the running film of the liquids that have one (blood, fuel, oil): grids near the player, fed by the leaks of the fluid world
  const filmRandom = createFilmLcg(1)
  const film = createFilmManager(THREE, {
    scene,
    camera,
    random: filmRandom,
    fluids,
    groundAt,
    ...(typeof (gl as Partial<THREE_NS.WebGLRenderer>).copyTextureToTexture === 'function' ? { gpu: gl as THREE_NS.WebGLRenderer } : {}),
  })
  const filmBridge = createFilmBridge({ fluids, manager: film, random: filmRandom })
  const specs = new Map<string, DestructibleSpec>()
  const loose: Piece[] = []

  const arsenal = options.arsenal ?? createArsenal({ locale, weapons: options.weapons, seed: 1 })
  const loadout = (options.loadout ?? DEFAULT_LOADOUT).filter((id) => arsenal.weapons.has(id))
  const tools = new Map<string, WeaponState>()
  let toolIndex = Math.max(0, loadout.indexOf('hand'))
  let toolId = loadout[toolIndex] ?? 'hand'
  const toolSettings: { condition?: string; ammoQuality?: string } = {}
  let fuseLength: number | undefined
  const SETTING_IDS = { condition: 'condition', ammoQuality: 'ammo_quality', fuseLength: 'fuse_length' } as const
  const toolState = (id: string): WeaponState => {
    let s = tools.get(id)
    if (!s) {
      s = arsenal.create(id, { seed: 7, reserve: 999, ...toolSettings })
      s.setFuseLength(fuseLength)
      s.refill()
      tools.set(id, s)
    }
    return s
  }
  let tool = toolState(toolId)

  const catalogMap = new Map<string, TestRoomItem>()
  for (const i of options.catalog) catalogMap.set(i.id, i)
  const catalog = [...options.catalog]

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Names and narration
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const entryOf = (objectId: string): Entry | undefined => entries.get(objectId) ?? splitOf.get(objectId)
  const nameOf = (objectId: string): string => {
    const e = entries.get(objectId)
    if (e) return e.name
    const s = splitOf.get(objectId)
    return s ? `${s.name} (${t('piece')})` : objectId
  }
  const narrator = createNarrator({
    world,
    fluids,
    log,
    now: () => simTime,
    t,
    num,
    nameOf,
    itemIdOf: (id) => entryOf(id)?.so.itemId,
    materialName: (id) => S.text[`material.${id}`] ?? dStrings.materialNames[id] ?? id,
    liquidName: (id) => fStrings.liquids[id] ?? id,
    jointKind: (k) => dStrings.jointKinds[k as keyof typeof dStrings.jointKinds] ?? k,
    toolName: (k) => dStrings.toolKinds[k as keyof typeof dStrings.toolKinds] ?? k,
    locatePart: (objectId, partId) => {
      const own = world.part(objectId, partId)
      if (own) return { objectId, part: own }
      for (const [id, owner] of splitOf) {
        if (owner.so.objectId !== objectId) continue
        const p = world.part(id, partId)
        if (p) return { objectId: id, part: p }
      }
      return null
    },
    containerName: (cid) => {
      for (const e of entries.values()) if (e.containerId === cid) return { name: e.name, objectId: e.so.objectId, itemId: e.so.itemId }
      return undefined
    },
  })

  let pending: DestructionEvent[] = []
  const eventListeners = new Set<(d: unknown) => void>()
  const listeners: Record<string, Set<(d: unknown) => void>> = { spawn: new Set(), tool: new Set(), grab: new Set(), throw: new Set(), event: eventListeners, camera: new Set() }
  const fire = (type: string, data: unknown): void => {
    for (const fn of listeners[type] ?? []) fn(data)
  }
  world.on('*', (ev) => {
    pending.push(ev)
  })
  fluids.on('*', (ev: FluidEvent) => {
    narrator.fluid(ev)
    fire('event', ev)
  })

  const action = (type: string, text: string, extra: Partial<{ objectId: string; itemId: string; part: string; data: Record<string, unknown>; material: string }> = {}): void => {
    log.add({ channel: 'action', type, text, ...extra })
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Flush: events of the frame -> log, fluids glue, fire glue
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const tmpV = new THREE.Vector3()
  const tmpV2 = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const tmpM = new THREE.Matrix4()

  const hostOf = (e: Entry): { objectId: string; root: THREE_NS.Object3D } => {
    if (e.fluidPart && !e.arena && !world.part(e.so.objectId, e.fluidPart)) {
      for (const [id, owner] of splitOf) {
        if (owner === e && world.part(id, e.fluidPart)) {
          const p = rendererPieces.get(id)
          if (p) return { objectId: id, root: p.root }
        }
      }
    }
    return { objectId: e.so.objectId, root: e.so.root }
  }

  const puncture = (ev: Extract<DestructionEvent, { type: 'leak' }>): void => {
    const e = entryOf(ev.object)
    if (!e?.containerId || e.fluidPart !== ev.part) return
    const host = hostOf(e)
    host.root.updateMatrixWorld(true)
    tmpM.copy(host.root.matrixWorld).invert()
    const local = tmpV.set(ev.point[0], ev.point[1], ev.point[2]).applyMatrix4(tmpM)
    local.x -= e.fluidOffset[0]
    local.y -= e.fluidOffset[1]
    local.z -= e.fluidOffset[2]
    host.root.getWorldQuaternion(tmpQ).invert()
    const n = tmpV2.set(ev.direction[0], ev.direction[1], ev.direction[2]).applyQuaternion(tmpQ)
    const part = world.part(host.objectId, ev.part)
    const hole = part?.holes[part.holes.length - 1]
    fluids.puncture(e.containerId, [local.x, local.y, local.z], [n.x, n.y, n.z], hole?.diameter ?? 0.009)
  }

  const flush = (): void => {
    if (pending.length === 0) return
    const batch = pending
    pending = []
    narrator.events(batch)
    for (const ev of batch) {
      if (ev.type === 'leak') puncture(ev)
      else if (ev.type === 'ignite') igniteNear(ev.point, 0.9)
      else if (ev.type === 'explode') emitHost({ type: 'explosion', source: ev.object, point: ev.point, energy: ev.energy, radius: ev.radius, cause: 'part', ...(ev.effect !== undefined ? { explosive: ev.effect } : {}) })
      fire('event', ev)
      options.onEvent?.(ev)
    }
  }
  log.setBeforeRead(flush)

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let useHeld = false
  let useFirst = false
  /** What modules ask the walking player to stay out of (`ModuleHost.addBlocker`). */
  const blockers = new Set<(x: number, z: number, radius: number) => boolean>()
  const player = createPlayer(THREE, {
    camera,
    dom,
    colliders: arena.colliders,
    blockers,
    limit: arenaSize,
    start: arena.playerStart,
    hooks: {
      primaryDown: () => {
        useHeld = true
        useFirst = true
      },
      primaryUp: () => {
        useHeld = false
        releaseTrigger()
      },
      secondary: () => {
        if (heldEntry) throwHeld()
        else grab()
      },
      key: (code, down, e) => onKey(code, down, e),
      wheel: (dir) => cycleTool(dir),
    },
  })
  player.look(arena.playerStart, [0, 1.5, arena.wallZ])

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Spawning
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let counter = 0
  let slot = 0
  const maxCarry = options.maxCarryKg ?? 60

  const massOfObject = (id: string): number => {
    const st = world.state(id)
    let m = 0
    for (const p of st?.parts ?? []) if (p.status !== 'broken' && p.status !== 'melted' && p.status !== 'ashes') m += p.mass
    return m
  }

  const registerEntry = (
    objectId: string,
    itemId: string,
    root: THREE_NS.Object3D,
    spec: DestructibleSpec,
    name: string,
    parts: Record<string, THREE_NS.Object3D | THREE_NS.Object3D[]> | undefined,
    item: TestRoomItem | undefined,
    arenaObject: boolean,
    movable: boolean,
  ): Entry => {
    specs.set(objectId, spec)
    renderer.bind(objectId, root, parts ? { parts } : undefined)
    const so: SpawnedObject = { objectId, itemId, root, movable }
    const e: Entry = { so, item, name, arena: arenaObject, fluidOffset: [0, 0, 0], uses: [], piece: null, last: [root.position.x, root.position.y, root.position.z], velocity: [0, 0, 0] }
    entries.set(objectId, e)
    if (movable) {
      e.piece = renderer.makePiece(objectId, { mass: Math.max(0.2, massOfObject(objectId)) })
      rendererPieces.set(objectId, e.piece)
    }
    const f = item?.fluid
    if (f) {
      e.fluidPart = f.part
      e.fluidOffset = f.offset ?? [0, 0, 0]
      e.uses = f.uses ?? ['drink', 'sip', 'pour']
      root.updateMatrixWorld(true)
      const q = root.getWorldQuaternion(tmpQ)
      const p = tmpV.set(e.fluidOffset[0], e.fluidOffset[1], e.fluidOffset[2]).applyMatrix4(root.matrixWorld)
      e.containerId = fluids.addContainer(f.container, { id: `${objectId}_fluid`, position: [p.x, p.y, p.z], rotation: [q.x, q.y, q.z, q.w] })
      fluidView.bindContainer(e.containerId, root, { innerOffset: e.fluidOffset })
    }
    return e
  }

  const resolveSpec = (item: TestRoomItem, root: THREE_NS.Object3D): { spec: DestructibleSpec; parts?: Record<string, THREE_NS.Object3D[]> } => {
    if (typeof item.spec === 'function') return { spec: structuredCloneSpec(item.spec(root)) }
    if (item.spec) return { spec: structuredCloneSpec(item.spec) }
    const r = specFromObject3D(THREE, root, { name: item.id, ...item.specOptions })
    return { spec: r.spec, parts: r.parts }
  }

  const addArena = (): void => {
    for (const o of arena.objects) {
      const root = buildFromSpec(THREE, o.spec, { colors: o.colors })
      root.position.set(o.position[0], o.position[1], o.position[2])
      scene.add(root)
      root.updateMatrixWorld(true)
      world.add(structuredCloneSpec(o.spec), { id: o.id, position: o.position })
      registerEntry(o.id, o.id, root, o.spec, S.text[`arena.${o.id}`] ?? o.id, undefined, undefined, true, false)
    }
  }
  addArena()

  const spawn = (itemId: string, position?: Vec3, rotationY?: number): SpawnedObject => {
    const item = catalogMap.get(itemId)
    if (!item) throw new Error(`game-test-room: unknown item "${itemId}"`)
    const root = item.build(THREE)
    let pos: Vec3
    if (position) pos = [position[0], position[1], position[2]]
    else {
      const fx = -Math.sin(player.yaw)
      const fz = -Math.cos(player.yaw)
      const rx = Math.cos(player.yaw)
      const rz = -Math.sin(player.yaw)
      const side = ((slot++ % 5) - 2) * 0.55
      const x = camera.position.x + fx * 2.4 + rx * side
      const z = camera.position.z + fz * 2.4 + rz * side
      const lim = arenaSize - 1
      pos = [Math.max(-lim, Math.min(lim, x)), groundAt(x, z), Math.max(-lim, Math.min(lim, z))]
    }
    root.position.set(pos[0], pos[1], pos[2])
    root.rotation.y = rotationY ?? player.yaw
    root.name = item.id
    scene.add(root)
    root.updateMatrixWorld(true)
    const objectId = `${item.id}_${++counter}`
    let own: DestructibleImpl | undefined
    let resolved: { spec: DestructibleSpec; parts?: Record<string, THREE_NS.Object3D[]> }
    if (item.impl) {
      own = item.impl(root, objectId)
      if (own.id !== objectId) throw new Error(`game-test-room: item "${item.id}": DestructibleImpl.id is "${own.id}", the room gave it "${objectId}" (use the id passed to impl)`)
      resolved = { spec: structuredCloneSpec(own.describe()) }
    } else resolved = resolveSpec(item, root)
    const { spec, parts } = resolved
    root.updateMatrixWorld(true)
    const mass = spec.parts.reduce((m, p) => m + (p.mass ?? 0), 0)
    const heavy = (mass || massGuess(spec)) > maxCarry
    const movable = own ? false : (item.movable ?? !heavy)
    if (movable) {
      // things that can fall rest on the floor or the table by the bottom of their bounding box (or hang at the height asked for): no drop on spawn
      const box = new THREE.Box3().setFromObject(root)
      const base = Math.max(pos[1], groundAt(pos[0], pos[2]))
      pos = [pos[0], pos[1] + (base - box.min.y), pos[2]]
      root.position.set(pos[0], pos[1], pos[2])
      root.updateMatrixWorld(true)
    }
    const q = root.getWorldQuaternion(tmpQ)
    if (own) world.register(own, { id: objectId, position: pos, rotation: [q.x, q.y, q.z, q.w] })
    else world.add(spec, { id: objectId, position: pos, rotation: [q.x, q.y, q.z, q.w] })
    const e = registerEntry(objectId, item.id, root, spec, item.name, parts, item, false, movable)
    action('spawn', t('act.spawn', { name: item.name, x: num(pos[0], 1), z: num(pos[2], 1) }), { objectId, itemId: item.id, data: { position: pos, movable, massKg: Math.round(massOfObject(objectId) * 10) / 10 } })
    fire('spawn', e.so)
    return e.so
  }
  const massGuess = (spec: DestructibleSpec): number => {
    let m = 0
    for (const p of spec.parts) {
      const s = p.shape
      const vol = s.kind === 'box' ? s.size[0] * s.size[1] * s.size[2] : s.kind === 'cylinder' ? Math.PI * s.radius * s.radius * s.height : (4 / 3) * Math.PI * s.radius ** 3
      m += p.mass ?? vol * (world.materials.get(p.material)?.density ?? 500) * (p.fill ?? 1)
    }
    return m
  }

  const removeEntry = (id: string): void => {
    const e = entries.get(id)
    if (!e) return
    if (heldEntry === e) releaseHeld()
    for (let i = playing.length - 1; i >= 0; i--) if (playing[i].entry === e) playing.splice(i, 1)
    if (e.containerId) {
      fluidView.unbindContainer(e.containerId)
      fluids.removeContainer(e.containerId)
    }
    try {
      renderer.unbind(id)
    } catch {
      // not bound
    }
    if (world.has(id)) world.remove(id)
    e.so.root.removeFromParent()
    entries.delete(id)
    rendererPieces.delete(id)
    specs.delete(id)
  }

  const clearLoose = (): void => {
    for (const [id, owner] of [...splitOf]) {
      void owner
      const p = rendererPieces.get(id)
      try {
        renderer.unbind(id)
      } catch {
        // gone already
      }
      if (world.has(id)) world.remove(id)
      p?.root.removeFromParent()
      rendererPieces.delete(id)
      splitOf.delete(id)
    }
    loose.length = 0
  }

  const clearEverything = (): void => {
    if (heldEntry || heldPiece) releaseHeld()
    useItemPlayer = null
    playing.length = 0
    explosives.clear()
    fireZones.length = 0
    burningStains.length = 0
    for (const id of [...entries.keys()]) if (!entries.get(id)?.arena) removeEntry(id)
    clearLoose()
    for (const e of entries.values()) {
      world.reset(e.so.objectId)
      renderer.restore(e.so.objectId)
    }
    renderer.clear()
    vfx.world.clear()
    fluids.clearStains([0, 0, 0], 1e4)
    fluidView.clear()
    film.clear()
    fluids.setTap(TAP_ID, false)
  }

  const clearListeners = new Set<() => void>()
  const clear = (): void => {
    clearEverything()
    for (const listener of [...clearListeners]) listener()
    restingTops.length = 0
    pending = []
    action('clear', t('act.clear'))
  }

  const resetAll = (): void => {
    for (const e of entries.values()) {
      if (heldEntry === e) continue
      world.reset(e.so.objectId)
      renderer.restore(e.so.objectId)
      if (e.containerId) {
        const c = fluids.container(e.containerId)
        const f = e.item?.fluid?.container
        if (c && f && f.liquid) fluids.fill(e.containerId, f.liquid, Math.max(0, (f.liters ?? 0) - c.liters), f.temperature)
      }
    }
    action('reset', t('act.reset'))
  }

  /** Reset the worlds to their seeded start: used by scenarios so that each one is deterministic. */
  const hardReset = (): void => {
    clearEverything()
    for (const id of [...entries.keys()]) removeEntry(id)
    tools.clear()
    tool = toolState(toolId)
    if (pristineWorld) {
      for (const id of world.ids()) world.remove(id)
      world.load(pristineWorld)
    }
    if (pristineFluids) {
      fluids.load(pristineFluids)
      for (const s of [...arena.surfaces, ...(options.surfaces ?? [])]) fluids.addSurface(s)
    }
    pending = []
    strikes = []
    rng = 12345
    counter = 0
    slot = 0
    prevVy.clear()
    lastImpact.clear()
    addArena()
    timeScale = 1
    fastForward = false
    walkPlan = null
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Aiming
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const aimO: Vec3 = [0, 0, 0]
  const aimD: Vec3 = [0, 0, -1]
  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Avatar and third-person camera. The simulation always sees the first-person camera (the eye: tools, grabs, walks, listener); the shoulder
  // view only moves the camera for the render (`applyCamera`), and the aim ray goes from the eye through the point the camera ray hits.
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const third: Required<ThirdPersonOptions> = { ...THIRD_PERSON_DEFAULTS, ...options.thirdPerson }
  let avatar: RoomAvatar | null = null
  let cameraMode: CameraMode = options.cameraMode ?? 'first'
  const avatarState: RoomAvatarState = { speed: 0, running: false, crouch: false, down: false, armed: false, pitch: 0 }
  let feetPrev: [number, number] | null = null
  /** `armed` forced by a module (the bench); null follows the tool in hand. */
  let armedForced: boolean | null = null
  let camDistance = Infinity
  const tmpHand = new THREE.Vector3()

  const thirdPose = (dt: number): ThirdPersonPose => {
    const pose = thirdPersonPose({ x: player.x, z: player.z, feet: player.feet, yaw: player.yaw, pitch: player.pitch, crouch: avatarState.crouch }, third, (o, d, max) =>
      withoutHeld(() => world.raycast(o, d, max))?.distance ?? null,
    )
    // a wall pulls the camera in at once, the way back is slow (`view.cd`, line 76559 of the team game)
    camDistance = pose.free <= camDistance ? pose.free : dt > 0 ? camDistance + (pose.free - camDistance) * (1 - Math.exp(-dt * third.recover)) : camDistance
    return { ...pose, position: pose.at(camDistance), free: camDistance }
  }

  const thirdActive = (): boolean => cameraMode === 'third' && avatar !== null
  const syncAvatarVisible = (): void => {
    if (!avatar) return
    avatar.root.visible = cameraMode === 'third'
    if (avatar.firstPerson) avatar.firstPerson.root.visible = cameraMode === 'first'
  }
  const setCameraMode = (mode: CameraMode): void => {
    if (mode !== 'first' && mode !== 'third') return
    if (mode === cameraMode) return
    cameraMode = mode
    camDistance = Infinity
    syncAvatarVisible()
    action('camera', t('act.camera', { mode: t(`camera.${mode}`) }), { data: { mode, avatar: avatar !== null } })
    fire('camera', mode)
  }
  const setAvatar = (next: RoomAvatar | null): void => {
    if (avatar === next) return
    avatar?.root.removeFromParent()
    avatar?.firstPerson?.root.removeFromParent()
    avatar = next
    feetPrev = null
    if (avatar) {
      scene.add(avatar.root)
      if (avatar.firstPerson) scene.add(avatar.firstPerson.root)
      syncAvatarVisible()
      stepAvatar(0)
    }
    ui?.hud(hudState())
  }
  const stepAvatar = (dt: number): void => {
    if (!avatar) return
    const x = player.x
    const z = player.z
    if (dt > 0 && feetPrev) {
      // a jump of position faster than the player can run is a teleport (`look`, an area opening), not a stride
      const raw = Math.hypot(x - feetPrev[0], z - feetPrev[1]) / dt
      avatarState.speed = raw > MAX_STRIDE_SPEED ? 0 : avatarState.speed + (raw - avatarState.speed) * (1 - Math.exp(-dt * 15))
      if (avatarState.speed < 0.02) avatarState.speed = 0
    }
    feetPrev = [x, z]
    avatarState.running = player.keys.has('ShiftLeft') || player.keys.has('ShiftRight')
    avatarState.armed = armedForced ?? tool.def.action.kind === 'firearm'
    avatarState.pitch = player.pitch
    avatar.root.position.set(x, player.feet, z)
    avatar.root.rotation.set(0, player.yaw + Math.PI, 0) // the body's front is +z (the three.js way, as the catalogue items), the view looks down -z at yaw 0
    avatar.update(dt, avatarState)
    avatar.root.updateMatrixWorld(true)
  }
  // ----- the first-person arms: where the tool in the hands asks them to be (a module lends it), else the carried item, else nothing
  let handSource: HandTargetSource | null = null
  let carriedHand: HandTargets | null = null
  const strikeClips: Readonly<Record<string, string>> = options.strikeClips ?? DEFAULT_STRIKE_CLIPS
  const handStances: Readonly<Record<string, string>> = options.handStances ?? DEFAULT_HAND_STANCES
  const stepFirstPerson = (dt: number): void => {
    const arms = avatar?.firstPerson
    if (!arms) return
    const targets = handSource?.() ?? carriedHand
    arms.update(dt, {
      camera,
      targets,
      stance: handStances[toolId] ?? (targets ? 'hold' : 'relaxed'),
      speed: avatarState.speed,
      running: avatarState.running,
      crouch: avatarState.crouch,
      contact: (origin, direction, maxDistance) => rayWorld(origin, direction, maxDistance)?.distance ?? null,
    })
  }
  /** Moves the camera to the shoulder view for the render that follows, and answers the function that puts it back. */
  const applyThirdView = (): (() => void) => {
    if (!thirdActive()) return () => undefined
    const home = camera.position.clone()
    const pose = thirdPose(0)
    camera.position.set(pose.position[0], pose.position[1], pose.position[2])
    camera.updateMatrixWorld(true)
    return () => {
      camera.position.copy(home)
      camera.updateMatrixWorld(true)
    }
  }

  const aim = (): void => {
    camera.updateMatrixWorld(true)
    camera.getWorldPosition(tmpV)
    camera.getWorldDirection(tmpV2)
    aimO[0] = tmpV.x
    aimO[1] = tmpV.y
    aimO[2] = tmpV.z
    aimD[0] = tmpV2.x
    aimD[1] = tmpV2.y
    aimD[2] = tmpV2.z
    if (thirdActive()) {
      // shoulder view: the camera ray finds the target, the shot leaves the eye for it (a shot from the camera would cross the player's own back)
      const pose = thirdPose(0)
      const reach = 80
      const hit = withoutHeld(() => world.raycast(pose.position, pose.direction, reach))
      const dist = hit ? hit.distance : reach
      const tx = pose.position[0] + pose.direction[0] * dist - aimO[0]
      const ty = pose.position[1] + pose.direction[1] * dist - aimO[1]
      const tz = pose.position[2] + pose.direction[2] * dist - aimO[2]
      const len = Math.hypot(tx, ty, tz)
      if (len > 0.5 && (tx * pose.direction[0] + ty * pose.direction[1] + tz * pose.direction[2]) / len > 0.5) {
        aimD[0] = tx / len
        aimD[1] = ty / len
        aimD[2] = tz / len
      }
    }
  }

  const FAR: Quat = [0, 0, 0, 1]
  /** Run `fn` with the held object moved away, so that rays and bullets do not hit what the player carries. */
  const withoutHeld = <T,>(fn: () => T): T => {
    const e = heldEntry
    if (!e || !world.has(e.so.objectId)) return fn()
    const p = e.so.root.position
    const q = e.so.root.quaternion
    world.setTransform(e.so.objectId, [0, -5000, 0], FAR)
    try {
      return fn()
    } finally {
      world.setTransform(e.so.objectId, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w])
    }
  }

  const rayWorld = (o: Vec3, d: Vec3, max: number): RayHit | null => withoutHeld(() => world.raycast(o, d, max))

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Particles helpers and a tiny seeded rng for visuals
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let rng = 12345
  const rnd = (): number => {
    rng = (rng * 1664525 + 1013904223) >>> 0
    return rng / 4294967296
  }

  const muzzle = (): Vec3 => {
    aim()
    const e = camera.matrixWorld.elements
    // right = x axis, up = y axis of the camera
    return [
      aimO[0] + aimD[0] * 0.45 + e[0] * 0.16 - e[4] * 0.1,
      aimO[1] + aimD[1] * 0.45 + e[1] * 0.16 - e[5] * 0.1,
      aimO[2] + aimD[2] * 0.45 + e[2] * 0.16 - e[6] * 0.1,
    ]
  }

  // tracers
  const tracers: Array<{ line: THREE_NS.Line; life: number }> = []
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })
  const tracer = (a: Vec3, b: Vec3): void => {
    let tr = tracers.find((x) => x.life <= 0)
    if (!tr) {
      if (tracers.length >= 12) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(6, 3))
      const line = new THREE.Line(g, tracerMat)
      line.frustumCulled = false
      scene.add(line)
      tr = { line, life: 0 }
      tracers.push(tr)
    }
    const attr = tr.line.geometry.getAttribute('position') as THREE_NS.BufferAttribute
    attr.setXYZ(0, a[0], a[1], a[2])
    attr.setXYZ(1, b[0], b[1], b[2])
    attr.needsUpdate = true
    tr.line.visible = true
    tr.life = 0.07
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Fire glue: stains of flammable liquids, fire zones (molotov), dry water near fire
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const fireZones: FireZone[] = []
  const burningStains: BurningStain[] = []
  const stainRadius = (s: StainState): number => {
    let sum = 0
    for (const r of s.front) sum += r
    return s.front.length ? sum / s.front.length : 0.1
  }
  const stainBurning = (s: StainState): boolean => burningStains.some((b) => dist3(b.center, s.center) < 0.05)

  function igniteNear(point: Vec3, reach: number): void {
    let lit = false
    let water = false
    for (const s of fluids.stains()) {
      if (s.wetness < 0.05) continue
      if (Math.hypot(s.center[0] - point[0], s.center[2] - point[2]) > reach + stainRadius(s) || Math.abs(s.center[1] - point[1]) > 1.5) continue
      if (fluids.liquids.get(s.liquid)?.flammable) {
        if (stainBurning(s)) continue
        const seconds = Math.max(3, Math.min(20, 4 + s.liters * 30 + stainRadius(s) * 6))
        burningStains.push({ center: [s.center[0], s.center[1], s.center[2]], remaining: seconds, acc: 0 })
        lit = true
        log.add({
          channel: 'event',
          type: 'stain_ignite',
          text: t('ev.stain_ignite', { liquid: fStrings.liquids[s.liquid] ?? s.liquid, x: num(s.center[0], 1), z: num(s.center[2], 1), seconds: num(seconds, 0) }),
          data: { stain: s.id, liquid: s.liquid, seconds },
        })
      } else water = true
    }
    if (water && !lit) {
      fluids.clearStains(point, Math.max(0.5, reach))
      log.coalesce('dry', { channel: 'event', type: 'stain_dried_by_fire', text: t('ev.fire_dries'), data: { point } }, 2)
    }
  }

  const hitFireAround = (point: Vec3, radius: number, temperature: number, duration: number): void => {
    for (const id of world.ids()) world.hit(id, { type: 'fire', point, temperature, radius, duration, source: 'fire' })
  }

  const updateFires = (dt: number): void => {
    for (let i = fireZones.length - 1; i >= 0; i--) {
      const z = fireZones[i]
      z.remaining -= dt
      z.acc += dt
      if (z.acc >= 0.1) {
        hitFireAround(z.point, z.radius, z.temperature, z.acc)
        igniteNear(z.point, z.radius)
        z.acc = 0
      }
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * z.radius
      renderer.emit('fire', [z.point[0] + Math.cos(a) * r, z.point[1] + 0.05, z.point[2] + Math.sin(a) * r], [0, 1, 0], 2, 1.5)
      if (z.remaining <= 0) fireZones.splice(i, 1)
    }
    if (burningStains.length) {
      const stains = fluids.stains()
      for (let i = burningStains.length - 1; i >= 0; i--) {
        const b = burningStains[i]
        b.remaining -= dt
        b.acc += dt
        const st = stains.find((s) => dist3(s.center, b.center) < 0.05)
        const r = st ? stainRadius(st) : 0.3
        if (b.acc >= 0.1) {
          hitFireAround([b.center[0], b.center[1] + 0.1, b.center[2]], r + 0.2, 800, b.acc)
          b.acc = 0
        }
        const a = rnd() * Math.PI * 2
        const rr = Math.sqrt(rnd()) * r
        renderer.emit('fire', [b.center[0] + Math.cos(a) * rr, b.center[1] + 0.05, b.center[2] + Math.sin(a) * rr], [0, 1, 0], 3, 1.8)
        if (rnd() < 0.2) renderer.emit('smoke', [b.center[0], b.center[1] + 0.3, b.center[2]], [0, 1, 0], 1, 1)
        if (b.remaining <= 0 || !st) {
          fluids.clearStains(b.center, r + 0.1)
          log.add({ channel: 'event', type: 'stain_burned', text: t('ev.stain_burned'), data: { point: b.center } })
          burningStains.splice(i, 1)
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let progress: { label: string; value: number; at: number } | null = null
  let statusLine = ''
  let statusAt = 0
  const say = (msg: string): void => {
    statusLine = msg
    statusAt = simTime
    ui?.toast(msg)
  }

  const toolName = (id = toolId): string => arsenal.name(id)
  const hitWhere = (r: RayHit): string => {
    const p = world.part(r.object, r.part)
    return `${nameOf(r.object)} › ${r.part}${p ? ` (${dStrings.materialNames[p.material] ?? p.material})` : ''}`
  }

  const pushPiece = (objectId: string, dir: Vec3, momentum: number, point: Vec3): void => {
    if (!rendererPieces.has(objectId)) return
    renderer.impulse(objectId, [dir[0] * momentum, dir[1] * momentum, dir[2] * momentum], point)
  }

  const fireShots = (shots: Shot[], recoil: [number, number]): void => {
    if (shots.length === 0) return
    const w = toolName()
    const m = muzzle()
    renderer.emit('flash', m, [aimD[0], aimD[1], aimD[2]], 1, 0)
    renderer.emit('sparks', m, [aimD[0], aimD[1], aimD[2]], 4, 6)
    let hits = 0
    let first: RayHit | null = null
    let energy = 0
    withoutHeld(() => {
      for (const s of shots) {
        energy = Math.max(energy, s.energy)
        const results = world.shoot(s.origin, s.direction, s.energy, s.caliber, 'player', shotExtras(s))
        const r0 = results.find((r) => r.part && r.point)
        let end: Vec3 = [s.origin[0] + s.direction[0] * 40, s.origin[1] + s.direction[1] * 40, s.origin[2] + s.direction[2] * 40]
        if (r0?.point && r0.part) {
          hits++
          end = r0.point
          if (!first) first = { object: r0.object, part: r0.part, point: r0.point, normal: [0, 1, 0], distance: dist3(s.origin, r0.point) }
          const speed = Math.max(80, s.speed)
          pushPiece(r0.object, s.direction, (2 * s.energy) / speed, r0.point)
        }
        if (shots.length <= 3 || rnd() < 0.34) tracer(m, end)
      }
    })
    player.kick(recoil[0], recoil[1])
    const f = first as RayHit | null
    const d = f ? num(f.distance, 1) : ''
    let text: string
    if (shots.length === 1) text = t(f ? 'act.shoot.hit' : 'act.shoot.miss', { weapon: w, energy: num(energy, 0), where: f ? hitWhere(f) : '', dist: d })
    else text = t('act.shoot.pellets', { weapon: w, n: shots.length, energy: num(energy, 0), hits, where: f ? hitWhere(f) : '', dist: d })
    action('shoot', text, {
      objectId: f?.object,
      itemId: f ? entryOf(f.object)?.so.itemId : undefined,
      part: f?.part,
      data: { weapon: toolId, shots: shots.length, hits, energyJ: Math.round(energy), caliberMm: shots[0].caliber, distanceM: f ? Math.round(f.distance * 100) / 100 : null },
    })
  }

  const fireRays = (u: { origin: Vec3; direction: Vec3; range: number; cone: boolean; radius: number }): Array<Vec3> => {
    const d = new THREE.Vector3(u.direction[0], u.direction[1], u.direction[2]).normalize()
    const out: Vec3[] = [[d.x, d.y, d.z]]
    if (u.cone) {
      const a = Math.min(0.2, Math.atan2(u.radius, Math.max(0.1, u.range)))
      const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0))
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
      right.normalize()
      const up = new THREE.Vector3().crossVectors(right, d).normalize()
      for (const [x, y] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const r = d.clone().addScaledVector(right, x * a).addScaledVector(up, y * a).normalize()
        out.push([r.x, r.y, r.z])
      }
    }
    return out
  }

  const heatRays = (u: Extract<Use, { kind: 'flame' | 'heat' }>, type: 'fire' | 'heat'): void => {
    const w = toolName()
    const cone = u.kind === 'flame' ? u.cone : false
    const rays = fireRays({ origin: u.origin, direction: u.direction, range: u.range, cone, radius: u.radius })
    let target: RayHit | null = null
    const m = muzzle()
    withoutHeld(() => {
      for (const d of rays) {
        const r = world.raycast(u.origin, d, u.range)
        if (!r) continue
        if (!target) target = r
        world.hit(r.object, { type, point: r.point, direction: d, temperature: u.temperature, radius: Math.min(u.radius, 0.3), duration: u.duration, source: 'player' })
        if (type === 'fire') igniteNear(r.point, 0.25)
        else renderer.emit('sparks', r.point, r.normal, 2, 4)
      }
    })
    if (type === 'fire') {
      renderer.emit('fire', m, [u.direction[0], u.direction[1], u.direction[2]], cone ? 5 : 1, Math.max(0.6, u.range * 1.1))
      if (cone) renderer.emit('smoke', m, [u.direction[0], u.direction[1] + 0.3, u.direction[2]], 1, u.range * 0.5)
      // nothing hit: the stain on the ground in front may still catch
      if (!target && u.direction[1] < -0.2) {
        const t0 = (0.05 - u.origin[1]) / u.direction[1]
        if (t0 > 0 && t0 < u.range) igniteNear([u.origin[0] + u.direction[0] * t0, 0.05, u.origin[2] + u.direction[2] * t0], 0.3)
      }
    }
    const tg = target as RayHit | null
    log.coalesce(
      `use:${toolId}`,
      {
        channel: 'action',
        type,
        text: tg ? t(type === 'fire' ? 'act.flame.hit' : 'act.heat.hit', { weapon: w, where: hitWhere(tg), temp: num(u.temperature, 0) }) : t(type === 'fire' ? 'act.flame.air' : 'act.heat.air', { weapon: w }),
        objectId: tg?.object,
        part: tg?.part,
        data: { weapon: toolId, temperatureC: u.temperature },
      },
      1,
    )
  }

  const meleeUse = (u: Extract<Use, { kind: 'melee' }>, id = toolId): void => {
    const w = toolName(id)
    const r = rayWorld(u.origin, u.direction, u.reach)
    if (!r) {
      action('melee', t('act.melee.miss', { weapon: w }), { data: { weapon: id } })
      return
    }
    world.hitPart(r.object, r.part, { type: u.damage, point: r.point, direction: u.direction, energy: u.energy, radius: u.radius, source: 'player' })
    pushPiece(r.object, u.direction, (2 * u.energy) / 6, r.point)
    action('melee', t('act.melee.hit', { weapon: w, energy: num(u.energy, 0), where: hitWhere(r), dist: num(r.distance, 1) }), {
      objectId: r.object,
      itemId: entryOf(r.object)?.so.itemId,
      part: r.part,
      data: { weapon: id, damage: u.damage, energyJ: u.energy, distanceM: Math.round(r.distance * 100) / 100 },
    })
  }

  /** Strikes that have begun and whose blow has not landed yet: the tool they belong to, the simulated seconds left and what lands. */
  let strikes: Array<{ key: string; remaining: number; land: () => void }> = []
  /**
   * A melee blow. A tool with a strike clip (`strikeClips`) on an avatar that plays it starts the clip, on the arms and on the body, and the blow lands when the clip reaches its
   * impact, with the aim read again then; any other blow lands now.
   */
  const kickLeg = options.kickLeg ?? 'alternate'
  let nextLeg: 'left' | 'right' = 'right'
  const strikeUse = (u: Extract<Use, { kind: 'melee' }>, id = toolId): void => {
    const clip = strikeClips[id]
    // a kick uses the leg the option says (alternating from the right), whatever the avatar does with it
    const leg = id === 'kick' ? (kickLeg === 'alternate' ? nextLeg : kickLeg) : undefined
    const seconds = clip === undefined ? null : (avatar?.strike?.(clip, leg ? { leg } : undefined) ?? null)
    if (leg && seconds !== null && kickLeg === 'alternate') nextLeg = leg === 'right' ? 'left' : 'right'
    if (clip === undefined || seconds === null) {
      meleeUse(u, id)
      return
    }
    action('strike', t(leg ? 'act.strike.leg' : 'act.strike', { weapon: toolName(id), clip, seconds: num(seconds, 2), leg: leg ? t(`leg.${leg}`) : '' }), { data: { weapon: id, clip, impactIn: seconds, ...(leg ? { leg } : {}) } })
    strikes.push({
      key: id,
      remaining: seconds,
      land: () => {
        aim()
        meleeUse({ ...u, origin: [aimO[0], aimO[1], aimO[2]], direction: [aimD[0], aimD[1], aimD[2]] }, id)
      },
    })
  }
  const stepStrikes = (dt: number): void => {
    if (strikes.length === 0) return
    for (const strike of strikes) strike.remaining -= dt
    const landed = strikes.filter((strike) => strike.remaining <= 0)
    strikes = strikes.filter((strike) => strike.remaining > 0)
    for (const strike of landed) strike.land()
  }

  const toolWork = (u: Extract<Use, { kind: 'tool' }>, dt: number): void => {
    const w = toolName()
    const r = rayWorld(u.origin, u.direction, u.reach)
    if (!r) {
      progress = null
      log.coalesce(`use:${toolId}`, { channel: 'action', type: 'tool', text: t('act.tool.none', { weapon: w }), data: { weapon: toolId } }, 1)
      return
    }
    const j: JointState | null = world.nearestJoint(r.object, r.point, 0.45, u.tool as ToolKind)
    if (!j) {
      progress = null
      log.coalesce(`use:${toolId}`, { channel: 'action', type: 'tool', text: t('act.tool.nojoint', { weapon: w, where: hitWhere(r) }), objectId: r.object, part: r.part }, 1)
      return
    }
    const tool_ = u.tool as ToolKind
    const p = world.disassemble(r.object, j.id, tool_, dt)
    const kind = dStrings.jointKinds[j.kind] ?? j.kind
    if (p < 0) {
      const need = JOINT_DEFAULTS[j.kind].tools.map((k) => dStrings.toolKinds[k] ?? k).join(', ') || t('tool.none')
      progress = { label: t('hud.refused', { kind }), value: 0, at: simTime }
      log.coalesce(
        `refuse:${r.object}:${j.id}:${toolId}`,
        {
          channel: 'action',
          type: 'tool_refused',
          text: t('act.tool.refused', { weapon: w, kind, obj: nameOf(r.object), need }),
          objectId: r.object,
          itemId: entryOf(r.object)?.so.itemId,
          data: { weapon: toolId, joint: j.id, kind: j.kind, needs: JOINT_DEFAULTS[j.kind].tools },
        },
        2,
      )
      return
    }
    progress = { label: `${kind} (${j.id})`, value: p, at: simTime }
    renderer.emit('sparks', r.point, r.normal, 1, 2)
  }

  const extinguishUse = (u: Extract<Use, { kind: 'extinguish' }>): void => {
    const w = toolName()
    const rays = fireRays({ origin: u.origin, direction: u.direction, range: u.range, cone: true, radius: 0.6 })
    const m = muzzle()
    renderer.emit('foam', m, [u.direction[0], u.direction[1], u.direction[2]], 8, u.range * 1.2)
    const hit = new Set<string>()
    withoutHeld(() => {
      for (const d of rays) {
        const r = world.raycast(u.origin, d, u.range)
        if (!r) continue
        hit.add(r.object)
        world.extinguish(r.object, undefined, u.coolC * Math.max(u.duration, 0.05) * 6)
        fluids.clearStains(r.point, 0.5)
        for (let i = burningStains.length - 1; i >= 0; i--) if (Math.hypot(burningStains[i].center[0] - r.point[0], burningStains[i].center[2] - r.point[2]) < 1.2) burningStains.splice(i, 1)
        for (let i = fireZones.length - 1; i >= 0; i--) if (Math.hypot(fireZones[i].point[0] - r.point[0], fireZones[i].point[2] - r.point[2]) < 1.5) fireZones.splice(i, 1)
      }
    })
    log.coalesce(
      `use:${toolId}`,
      { channel: 'action', type: 'extinguish', text: hit.size ? t('act.extinguish.hit', { weapon: w, what: [...hit].map(nameOf).join(', ') }) : t('act.extinguish.air', { weapon: w }), data: { objects: [...hit] } },
      1,
    )
  }

  const startFire = (weapon: string, at: Vec3, fire: { temperature: number; radius: number; seconds: number }, impact: boolean): void => {
    fluids.splash('fuel', [at[0], Math.max(at[1], groundAt(at[0], at[2])), at[2]], 0.5)
    fireZones.push({ point: [at[0], Math.max(0.02, groundAt(at[0], at[2])), at[2]], radius: fire.radius, temperature: fire.temperature, remaining: fire.seconds, acc: 0 })
    renderer.emit('fire', at, [0, 1, 0], 24, 3)
    action('molotov_fire', t('act.molotov_fire', { weapon: toolName(weapon), seconds: num(fire.seconds, 0), radius: num(fire.radius, 1) }), { data: { weapon, impact } })
  }

  /** The bodies that trip a wire: the player (a column from the ground to the eyes) and every object of the room that is not the arena. */
  function crossingBodies(): { id: string; box: THREE_NS.Box3 }[] {
    const bodies = [...entries.values()].filter((e) => !e.arena).map((e) => ({ id: e.so.objectId, box: new THREE.Box3().setFromObject(e.so.root) }))
    const { x, y, z } = camera.position
    const feet = groundAt(x, z)
    bodies.push({ id: 'player', box: new THREE.Box3(new THREE.Vector3(x - PLAYER_RADIUS, feet, z - PLAYER_RADIUS), new THREE.Vector3(x + PLAYER_RADIUS, y + 0.1, z + PLAYER_RADIUS)) })
    return bodies
  }

  // ----- the blast options of the room's explosions (the HUD toggles them), and what the last blast did
  let blastOptions: BlastOptions = { ...options.blast }
  let lastBlast: BlastSummary | undefined
  const blastOn = (key: 'shelter' | 'fragmentHits' | 'confinement'): boolean => Boolean(blastOptions[key])
  const toggleBlast = (key: 'shelter' | 'fragmentHits' | 'confinement'): void => {
    blastOptions = { ...blastOptions, [key]: blastOn(key) ? false : true }
  }

  // ----- projectiles (grenades, molotovs, rockets) and charges set down: the room lends the explosives its world, log and host
  const explosives = createExplosives({
    THREE,
    scene,
    camera,
    world,
    renderer,
    effects: vfx.world,
    arsenal,
    objects: () => [...entries.values()].filter((e) => !e.arena).map((e) => e.so.root),
    bodies: crossingBodies,
    toolId: () => toolId,
    toolName,
    withoutHeld,
    groundAt,
    blast: () => blastOptions,
    blasted: (summary) => {
      lastBlast = summary
    },
    translate: t,
    format: num,
    action,
    emitHost,
    startFire,
    say,
  })

  // ----- the trigger
  const useTool = (dt: number, held: boolean): void => {
    aim()
    const cat = tool.def.category
    if (cat === 'hand') return
    if (strikes.some((strike) => strike.key === toolId)) return // the blow of this tool is still on its way
    const res = tool.trigger([aimO[0], aimO[1], aimO[2]], [aimD[0], aimD[1], aimD[2]], dt, held, 'player')
    flushEvents(toolId, tool, res.recoil)
    if (res.status === 'empty') {
      if (!tool.reloading && tool.reserve > 0) startReload()
      say(t(tool.reloading ? 'hud.reloading' : 'hud.empty'))
      return
    }
    if (res.status !== 'ok') {
      if (res.status === 'reloading') say(t('hud.reloading'))
      else if (res.status === 'no_fuel') say(t('hud.no_fuel'))
      else if (res.status === 'fault' && res.fault) say(t('hud.fault', { fault: t(`fault.${res.fault}`) }))
      else if (res.status === 'safe') say(t('hud.safe'))
      return
    }
    applyUses(res, dt)
  }

  const applyUses = (res: TriggerResult, dt: number): void => {
    if (res.shots.length) fireShots(res.shots, res.recoil)
    for (const u of res.uses) {
      switch (u.kind) {
        case 'melee':
          strikeUse(u)
          break
        case 'flame':
          heatRays(u, 'fire')
          break
        case 'heat':
          heatRays(u, 'heat')
          break
        case 'throw':
          explosives.throwUse(u)
          break
        case 'place':
          explosives.placeUse(u)
          break
        case 'backblast':
          explosives.backblastUse(u)
          break
        case 'tool':
          toolWork(u, dt)
          break
        case 'extinguish':
          extinguishUse(u)
          break
        default:
          break
      }
    }
  }

  /** The trigger goes up: a grenade being cooked leaves the hand now, with the fuse that is left (or has already gone off in it). */
  const releaseTrigger = (): void => {
    if (!tool.cooking) {
      tool.release()
      return
    }
    aim()
    const res = tool.release([aimO[0], aimO[1], aimO[2]], [aimD[0], aimD[1], aimD[2]])
    flushEvents(toolId, tool)
    if (res) applyUses(res, 0)
  }

  /** The V shortcut: a kick with the `kick` tool, whatever tool is selected (it keeps its own cooldown). */
  const kick = (): void => {
    if (!arsenal.weapons.has('kick') || strikes.some((strike) => strike.key === 'kick')) return
    aim()
    const res = toolState('kick').trigger([aimO[0], aimO[1], aimO[2]], [aimD[0], aimD[1], aimD[2]], 0, false, 'player')
    if (res.status !== 'ok') return
    for (const u of res.uses) if (u.kind === 'melee') strikeUse(u, 'kick')
  }
  const setTool = (id: string): void => {
    if (!arsenal.weapons.has(id)) throw new Error(`game-test-room: unknown weapon "${id}"`)
    releaseTrigger()
    toolId = id
    const i = loadout.indexOf(id)
    if (i >= 0) toolIndex = i
    tool = toolState(id)
    progress = null
    action('tool', t('act.tool', { weapon: toolName(id) }), { data: { weapon: id } })
    fire('tool', id)
    tool.draw()
    flushEvents(id, tool)
  }
  const cycleTool = (dir: 1 | -1): void => {
    if (!loadout.length) return
    toolIndex = (toolIndex + dir + loadout.length) % loadout.length
    setTool(loadout[toolIndex])
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Grabbing, carrying, throwing
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let heldEntry: Entry | null = null
  let heldPiece: Piece | null = null
  let heldName = ''
  let heldYaw = 0
  let heldTilt = 0
  let tiltKey = 0
  const heldLocal = new THREE.Vector3()
  let heldRadius = 0.2
  const heldVel: Vec3 = [0, 0, 0]
  let useItemPlayer: ItemUsePlayer | null = null
  let useItemName = ''

  const releaseHeld = (): void => {
    if (heldPiece) {
      heldPiece.held = false
      heldPiece.sleeping = false
      heldPiece.velocity = [heldVel[0], heldVel[1], heldVel[2]]
    }
    useItemPlayer?.cancel()
    useItemPlayer = null
    heldEntry = null
    heldPiece = null
    heldTilt = 0
  }

  const grab = (): boolean => {
    if (heldPiece) {
      const name = heldName
      releaseHeld()
      action('drop', t('act.drop', { name }))
      fire('grab', { held: false })
      return true
    }
    aim()
    const r = rayWorld([aimO[0], aimO[1], aimO[2]], [aimD[0], aimD[1], aimD[2]], 3.2)
    if (!r) {
      say(t('hud.nothing_to_grab'))
      return false
    }
    const piece = rendererPieces.get(r.object)
    if (!piece) {
      say(t('hud.cannot_grab', { name: nameOf(r.object) }))
      return false
    }
    const kg = piece.mass
    if (kg > maxCarry) {
      say(t('hud.too_heavy', { name: nameOf(r.object), kg: num(kg, 0) }))
      return false
    }
    heldPiece = piece
    heldEntry = entries.get(r.object) ?? null
    heldName = nameOf(r.object)
    piece.held = true
    piece.sleeping = false
    // centre of the object's bounding box in its own space, to hold it by its middle
    const box = new THREE.Box3().setFromObject(piece.root)
    const c = box.getCenter(new THREE.Vector3())
    piece.root.updateMatrixWorld(true)
    heldLocal.copy(c).sub(piece.root.position)
    heldLocal.applyQuaternion(piece.root.quaternion.clone().invert())
    heldRadius = box.getSize(new THREE.Vector3()).length() / 3
    heldYaw = 0
    heldTilt = 0
    heldVel[0] = heldVel[1] = heldVel[2] = 0
    action('grab', t('act.grab', { name: heldName, kg: num(kg, 1) }), { objectId: r.object, itemId: entryOf(r.object)?.so.itemId, data: { massKg: Math.round(kg * 10) / 10 } })
    fire('grab', { held: true, objectId: r.object })
    return true
  }

  const throwHeld = (speed = 9): boolean => {
    if (!heldPiece) return false
    const piece = heldPiece
    const name = heldName
    const id = piece.objectId
    aim()
    releaseHeld()
    piece.velocity = [0, 0, 0]
    renderer.impulse(id, [aimD[0] * speed * piece.mass, (aimD[1] * speed + 1.2) * piece.mass, aimD[2] * speed * piece.mass])
    action('throw', t('act.throw', { name, speed: num(speed, 1) }), { objectId: id, itemId: entryOf(id)?.so.itemId, data: { speedMs: speed, massKg: piece.mass } })
    fire('throw', { objectId: id, speed })
    return true
  }

  /** The right hand under the carried item, palm up, for the first-person arms: under the middle of its underside, the fingers the way the player faces. */
  const carriedTargets = (root: THREE_NS.Object3D): HandTargets => {
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const forward = camera.getWorldDirection(new THREE.Vector3())
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
    forward.normalize()
    const back = new THREE.Vector3(0, -1, 0) // the back of the hand faces down: the palm carries
    const z = forward.clone().cross(back).normalize()
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, back, z))
    return { R: { position: [center.x, box.min.y - CARRY_PALM, center.z], quaternion: [q.x, q.y, q.z, q.w] }, grip: CARRY_GRIP }
  }

  const followHeld = (dt: number): void => {
    const piece = heldPiece
    carriedHand = null
    if (!piece) return
    camera.updateMatrixWorld(true)
    const root = piece.root
    let pos: THREE_NS.Vector3
    const targetQ = tmpQ
    const hand = thirdActive() ? avatar?.hand?.('R') : undefined
    if (hand) {
      // shoulder view: the item rides the avatar's weapon hand (the body is in view, the camera is not at the eye)
      pos = hand.getWorldPosition(tmpHand)
      targetQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw + heldYaw)
      targetQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -heldTilt))
    } else if (useItemPlayer) {
      // the hand frame follows the camera's yaw only, so looking down at the item does not tilt it
      const pose = useItemPlayer.pose()
      const handQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw)
      pos = tmpV.set(pose.position[0], pose.position[1], pose.position[2]).applyQuaternion(handQ).add(camera.position)
      const eq = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ'))
      targetQ.copy(handQ).multiply(eq)
      targetQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heldYaw))
    } else {
      // with arms to reach it, a small item is held close; a big one stays out to the usual distance
      pos = tmpV.set(0.05, -0.28, avatar?.firstPerson ? -Math.min(1.15, CARRY_NEAR + heldRadius) : -1.15).applyMatrix4(camera.matrixWorld)
      targetQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.yaw + heldYaw)
      targetQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -heldTilt))
    }
    const k = Math.min(1, (useItemPlayer ? 30 : 16) * dt)
    const px = root.position.x
    const py = root.position.y
    const pz = root.position.z
    root.quaternion.slerp(targetQ, Math.min(1, k * 0.9))
    // the middle of the carried object follows the target; the offset uses the current rotation so it does not orbit
    const off2 = tmpV2.copy(heldLocal).applyQuaternion(root.quaternion)
    root.position.set(root.position.x + (pos.x - off2.x - root.position.x) * k, root.position.y + (pos.y - off2.y - root.position.y) * k, root.position.z + (pos.z - off2.z - root.position.z) * k)
    if (dt > 0) {
      heldVel[0] = (root.position.x - px) / dt
      heldVel[1] = (root.position.y - py) / dt
      heldVel[2] = (root.position.z - pz) / dt
    }
    root.updateMatrixWorld(true)
    if (avatar?.firstPerson && cameraMode === 'first') carriedHand = carriedTargets(root)
  }

  const useItem = (useId: string): boolean => {
    const e = heldEntry
    if (!e?.containerId) return false
    const def = itemUseDefs.find((u) => u.id === useId)
    if (!def) return false
    const c = fluids.container(e.containerId)
    if (!c) return false
    if (def.liquids && def.liquids.length > 0 && (!c.liquid || !def.liquids.includes(c.liquid))) return false
    if ((useId === 'drink' || useId === 'sip' || useId === 'chug' || useId === 'pour' || useId === 'pour_out') && c.liters <= 1e-6) {
      say(t('hud.empty_container', { name: e.name }))
      return false
    }
    if (useItemPlayer && !useItemPlayer.done) return false
    useItemPlayer = createItemUse(fluids, e.containerId, def)
    useItemName = def.id
    action('use_item', t('act.use_item', { name: e.name, use: S.text[`use.${def.id}`] ?? def.id }), { objectId: e.so.objectId, itemId: e.so.itemId, data: { use: def.id } })
    return true
  }

  const updateItemUse = (dt: number): void => {
    if (!useItemPlayer) return
    useItemPlayer.update(dt)
    if (useItemPlayer.done) {
      useItemPlayer = null
      useItemName = ''
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Tap
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const TAP_ID = 'room_tap'
  const TAP_RATE = 0.25
  fluids.addTap({ id: TAP_ID, position: arena.tapSpout, liquid: 'water', rate: TAP_RATE, temperature: 16, on: false })
  const isTapOn = (): boolean => fluids.taps().some((x) => x.id === TAP_ID && x.on)
  const toggleTap = (on = !isTapOn()): boolean => {
    fluids.setTap(TAP_ID, on)
    action('tap', t(on ? 'act.tap.on' : 'act.tap.off'))
    return on
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Thrown and falling pieces: damage to what they hit
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const lastImpact = new Map<string, number>()
  /** Landings slower than this (m/s) are not logged (the renderer only treats 3 m/s and up as a hard landing; nothing below 1.5 m/s is ever worth a line). */
  const MIN_LANDING_LOG = 3
  const updateImpacts = (): void => {
    const check = (piece: Piece): void => {
      if (piece.held || piece.sleeping) return
      const v = piece.velocity
      const speed = Math.hypot(v[0], v[1], v[2])
      if (speed < 3.5) return
      if ((lastImpact.get(piece.objectId) ?? -9) > simTime - 0.25) return
      const dir: Vec3 = [v[0] / speed, v[1] / speed, v[2] / speed]
      const c = tmpV.copy(new THREE.Vector3(0, 0, 0))
      void c
      const box = tmpBox.setFromObject(piece.root)
      const centre = box.getCenter(tmpV)
      const size = box.getSize(tmpV2)
      const reach = Math.max(size.x, size.y, size.z) * 0.5
      const origin: Vec3 = [centre.x + dir[0] * (reach + 0.02), centre.y + dir[1] * (reach + 0.02), centre.z + dir[2] * (reach + 0.02)]
      const r = withoutHeld(() => world.raycast(origin, dir, speed * FIXED_DT * 2 + 0.06))
      if (!r || r.object === piece.objectId) return
      const energy = 0.5 * piece.mass * speed * speed
      lastImpact.set(piece.objectId, simTime)
      world.hitPart(r.object, r.part, { type: 'blunt', point: r.point, direction: dir, energy, radius: 0.08, source: 'thrown' })
      if (world.has(piece.objectId)) world.hit(piece.objectId, { type: 'blunt', point: r.point, direction: [-dir[0], -dir[1], -dir[2]], energy: energy * 0.4, radius: 0.08, source: 'thrown' })
      pushPiece(r.object, dir, piece.mass * speed * 0.5, r.point)
      piece.velocity = [-v[0] * 0.25, Math.abs(v[1]) * 0.3 + 0.5, -v[2] * 0.25]
      action('impact', t('act.impact', { name: nameOf(piece.objectId), where: hitWhere(r), energy: num(energy, 0), speed: num(speed, 1) }), {
        objectId: piece.objectId,
        itemId: entryOf(piece.objectId)?.so.itemId,
        data: { energyJ: Math.round(energy), speedMs: Math.round(speed * 10) / 10, target: r.object, targetPart: r.part },
      })
    }
    const land = (piece: Piece): void => {
      const vy = piece.velocity[1]
      const prev = prevVy.get(piece.objectId) ?? 0
      prevVy.set(piece.objectId, vy)
      // the renderer applies the landing damage itself (source 'fall'); here we only describe it in the log
      if (piece.held || prev > -MIN_LANDING_LOG || vy < prev + 2 || !world.has(piece.objectId)) return
      const energy = 0.5 * piece.mass * prev * prev
      action('landing', t('act.landing', { name: nameOf(piece.objectId), speed: num(-prev, 1), energy: num(energy, energy < 100 ? 1 : 0) }), {
        objectId: piece.objectId,
        itemId: entryOf(piece.objectId)?.so.itemId,
        data: { energyJ: Math.round(energy * 10) / 10, speedMs: Math.round(-prev * 10) / 10 },
      })
    }
    for (const e of entries.values()) if (e.piece) { check(e.piece); land(e.piece) }
    for (const p of loose) { check(p); land(p) }
  }
  const prevVy = new Map<string, number>()
  const tmpBox = new THREE.Box3()

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Keys
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const onKey = (code: string, down: boolean, e: KeyboardEvent): void => {
    if (!down) {
      if (code === 'KeyZ') tiltKey = 0
      return
    }
    const digit = /^Digit(\d)$/.exec(code)
    if (digit && !e.ctrlKey && !e.metaKey) {
      const n = (Number(digit[1]) + 9) % 10
      const page = Math.floor(toolIndex / 10)
      const idx = page * 10 + n
      if (idx < loadout.length) setTool(loadout[idx])
      return
    }
    switch (code) {
      case 'KeyE':
        grab()
        break
      case 'KeyG':
        throwHeld()
        break
      case 'KeyR':
        if (heldPiece) heldYaw += Math.PI / 8
        else {
          startReload()
          say(t('hud.reloading'))
        }
        break
      case 'KeyQ': {
        tool.cycleMode()
        flushEvents(toolId, tool)
        break
      }
      case 'KeyX':
        clearToolFault()
        break
      case 'KeyB':
        toggleSafety()
        break
      case 'KeyZ':
        tiltKey = 1
        break
      case 'KeyF':
        if (heldEntry?.uses[0]) useItem(heldEntry.uses[0])
        break
      case 'KeyC':
        if (heldEntry?.uses[1]) useItem(heldEntry.uses[1])
        break
      case 'KeyV':
        if (heldEntry?.uses[2]) useItem(heldEntry.uses[2])
        else if (avatar && !e.shiftKey) setCameraMode(cameraMode === 'first' ? 'third' : 'first')
        else kick()
        break
      case 'KeyT':
        toggleTap()
        break
      case 'KeyY':
        explosives.detonateCharges()
        break
      case 'KeyH': {
        const w = (heldEntry ?? entryOf(inspectTarget()?.object ?? ''))?.item?.weapon
        if (w) equip(w)
        break
      }
      case 'BracketRight':
        toolIndex = Math.min(loadout.length - 1, (Math.floor(toolIndex / 10) + 1) * 10)
        setTool(loadout[toolIndex])
        break
      case 'BracketLeft':
        toolIndex = Math.max(0, (Math.floor(toolIndex / 10) - 1) * 10)
        setTool(loadout[toolIndex])
        break
      case 'Tab':
        ui?.togglePanels()
        break
      default:
        break
    }
  }

  const equip = (weaponId: string): void => {
    if (!arsenal.weapons.has(weaponId)) return
    if (!loadout.includes(weaponId)) loadout.push(weaponId)
    setTool(weaponId)
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Inspector
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const inspectTarget = (): RayHit | null => {
    aim()
    return rayWorld(aimO, aimD, 14)
  }

  const inspectInfo = (): InspectInfo | null => {
    const r = inspectTarget()
    if (!r) return null
    const st = world.state(r.object)
    const p = world.part(r.object, r.part)
    if (!st || !p) return null
    const e = entryOf(r.object)
    const joints = st.joints
      .filter((j) => j.a === r.part || j.b === r.part)
      .map((j) => ({
        id: j.id,
        kind: dStrings.jointKinds[j.kind] ?? j.kind,
        tools: JOINT_DEFAULTS[j.kind].tools.map((k) => dStrings.toolKinds[k] ?? k),
        open: j.open,
        progress: j.progress,
      }))
    const ext = p as unknown as { load?: number; stress?: number }
    return {
      object: nameOf(r.object),
      objectId: r.object,
      part: r.part,
      material: S.text[`material.${p.material}`] ?? dStrings.materialNames[p.material] ?? p.material,
      status: dStrings.partStatus[p.status] ?? p.status,
      hp: p.hp,
      maxHp: p.maxHp,
      temperature: p.temperature,
      burning: p.burning,
      char: p.char,
      melt: p.melt,
      liters: p.liters,
      dents: p.dents.length,
      holes: p.holes.length,
      cracks: p.cracks.length,
      mass: p.mass,
      load: ext.load,
      stress: ext.stress,
      joints,
      note: e?.item?.note,
      thumbnail: e?.item?.thumbnail,
      thumbnailCredit: e?.item?.thumbnailCredit,
      distance: r.distance,
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let timeScale = 1
  let fastForward = false
  let hudAcc = 1
  let metricsAcc = 0
  // when the room runs its own loop it feeds the counters the unclamped real delta; otherwise update(dt) is the only source
  let ownsLoop = false
  const roomMetricIds: readonly RoomMetricId[] = options.metrics === false ? [] : options.metrics ?? ROOM_METRICS
  const roomMetrics = createRoomMetrics({ gl, destruction: renderer, fluids: fluidView, effects: vfx.world, ids: roomMetricIds, blast: () => lastBlast })
  let qualityName: 'low' | 'medium' | 'high' = quality

  const syncContainers = (sdt: number): void => {
    for (const e of entries.values()) {
      if (!e.containerId) continue
      const host = hostOf(e)
      host.root.updateMatrixWorld(true)
      const q = host.root.getWorldQuaternion(tmpQ)
      const p = tmpV.set(e.fluidOffset[0], e.fluidOffset[1], e.fluidOffset[2]).applyMatrix4(host.root.matrixWorld)
      const vel: Vec3 | undefined = sdt > 0 ? [(p.x - e.last[0]) / sdt, (p.y - e.last[1]) / sdt, (p.z - e.last[2]) / sdt] : undefined
      e.last = [p.x, p.y, p.z]
      fluids.setTransform(e.containerId, [p.x, p.y, p.z], [q.x, q.y, q.z, q.w], vel)
    }
  }

  const syncLiters = (): void => {
    for (const e of entries.values()) {
      if (!e.containerId || !e.fluidPart) continue
      const c = fluids.container(e.containerId)
      if (!c) continue
      const host = hostOf(e)
      const part = world.part(host.objectId, e.fluidPart)
      if (part && part.liters !== undefined && Math.abs(part.liters - c.liters) > 1e-4) world.setLiters(host.objectId, e.fluidPart, c.liters)
    }
  }

  let paused = false
  let walkPlan: { x: number; z: number; remaining: number } | null = null
  const stepWalk = (dt: number): void => {
    if (!walkPlan) return
    const f = walkPlan.remaining <= dt ? 1 : dt / walkPlan.remaining
    player.moveBy((walkPlan.x - camera.position.x) * f, (walkPlan.z - camera.position.z) * f)
    walkPlan.remaining -= dt
    if (walkPlan.remaining <= 1e-9) walkPlan = null
  }

  const stepSim = (dt: number): void => {
    if (paused) return
    // `dt` is simulated seconds; real time only drives input
    simTime += dt
    stepWalk(dt)
    stepStrikes(dt)
    const reps = fastForward ? 10 : 1
    updateAnimations(dt)
    updateItemUse(dt)
    explosives.update(dt)
    syncContainers(dt)
    for (let i = 0; i < reps; i++) {
      world.update(dt)
      if (i === 0) updateFires(dt)
      fluids.update(dt)
    }
    syncLiters()
    renderer.update(dt)
    vfx.update(dt)
    craterPatch?.sync()
    updateImpacts()
    fluidView.update(dt)
    filmBridge.update(dt)
    film.update(dt)
    for (const [id, s] of tools) {
      s.update(dt)
      flushEvents(id, s)
    }
    if (audio) {
      // the listener is the camera: where it stands and which way it looks (yaw 0 faces -z)
      const look = camera.getWorldDirection(listenerDirection)
      audio.setListener({ position: [camera.position.x, camera.position.y, camera.position.z], yaw: Math.atan2(-look.x, -look.z) })
    }
    for (const update of frameListeners) update(dt)
    for (const tr of tracers) {
      if (tr.life > 0) {
        tr.life -= dt
        if (tr.life <= 0) tr.line.visible = false
      }
    }
    flush()
  }

  const update = (dt: number): void => {
    if (!ownsLoop) roomMetrics.frame(dt)
    player.update(dt)
    stepAvatar(paused ? 0 : dt)
    if (tiltKey || heldTilt > 0) {
      heldTilt = Math.max(0, Math.min(2.4, heldTilt + (tiltKey ? 2.2 : -3) * dt))
    }
    if (useHeld && !paused) {
      if (tool.def.category === 'hand') {
        if (useFirst) grab()
      } else useTool(dt, !useFirst)
      useFirst = false
    }
    if (!paused) followHeld(dt)
    stepSim(dt * timeScale)
    stepFirstPerson(paused ? 0 : dt)
    if (progress && simTime - progress.at > 0.25) progress = null
    hudAcc += dt
    if (hudAcc >= 0.1 && ui) {
      hudAcc = 0
      ui.hud(hudState())
    }
    metricsAcc += dt
    if (metricsAcc >= METRICS_INTERVAL_S && ui) {
      metricsAcc = 0
      if (ui.benchVisible) ui.metrics(metricRows())
    }
  }

  const hudState = (): HudState => {
    const page = Math.floor(toolIndex / 10)
    const slots = loadout.slice(page * 10, page * 10 + 10).map((id) => arsenal.name(id))
    const ammo = tool.def.action.kind === 'firearm' ? `${tool.ammo}/${tool.capacity}${tool.reserve ? ` · ${tool.reserve}` : ''}` : tool.def.action.kind === 'hand' ? '' : tool.def.action.kind === 'melee' || tool.def.action.kind === 'tool' ? '' : `${num(tool.ammo, 0)}`
    return {
      toolName: toolName(),
      toolId,
      ammo,
      slots,
      slot: toolIndex - page * 10,
      page: page + 1,
      pages: Math.max(1, Math.ceil(loadout.length / 10)),
      status: simTime - statusAt < 2 ? statusLine : '',
      progress: progress ? { label: progress.label, value: progress.value } : null,
      held: heldEntry || heldPiece ? { name: heldName, uses: (heldEntry?.uses ?? []).map((u, i) => ({ key: ['F', 'C', 'V'][i] ?? '', label: S.text[`use.${u}`] ?? u })), weapon: heldEntry?.item?.weapon ? arsenal.name(heldEntry.item.weapon) : undefined, using: useItemName } : null,
      inspect: inspectInfo(),
      animations: animationsOf(),
      locked: player.locked,
      timeScale,
      fast: fastForward,
      tap: isTapOn(),
      blast: { shelter: blastOn('shelter'), fragmentHits: blastOn('fragmentHits'), confinement: blastOn('confinement') },
      quality: qualityName,
      camera: avatar ? cameraMode : null,
      objects: [...entries.values()].filter((e) => !e.arena).length,
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Item animations (clips of AnimationClipSpec)
  // ---------------------------------------------------------------------------------------------------------------------------------------
  interface Playing {
    entry: Entry
    clip: AnimationClipSpec
    t: number
    fired: number
    targets: Map<string, THREE_NS.Object3D>
  }
  const playing: Playing[] = []
  const restPose = new WeakMap<THREE_NS.Object3D, { p: Vec3; r: Vec3 }>()
  const ZERO: Vec3 = [0, 0, 0]
  const animTarget = (): Entry | undefined => {
    if (heldEntry) return heldEntry
    const r = inspectTarget()
    return r ? entryOf(r.object) : undefined
  }
  const poseAt = (clip: AnimationClipSpec, id: string | null, time: number): { position: Vec3; rotation: Vec3 } => {
    const pick = (k: AnimationClipSpec['keys'][number]): { position?: Vec3; rotation?: Vec3 } | undefined => (id === null ? k : k.parts?.[id])
    const pts = clip.keys.map((k) => ({ t: k.t, position: pick(k)?.position ?? ZERO, rotation: pick(k)?.rotation ?? ZERO }))
    if (pts.length === 0 || pts[0].t > 0) pts.unshift({ t: 0, position: ZERO, rotation: ZERO })
    let a = pts[0]
    let b = pts[pts.length - 1]
    if (time >= b.t) a = b
    else for (let i = 0; i < pts.length - 1; i++) if (time >= pts[i].t && time < pts[i + 1].t) [a, b] = [pts[i], pts[i + 1]]
    const f = a === b || b.t <= a.t ? 0 : (time - a.t) / (b.t - a.t)
    const mix = (x: Vec3, y: Vec3): Vec3 => [x[0] + (y[0] - x[0]) * f, x[1] + (y[1] - x[1]) * f, x[2] + (y[2] - x[2]) * f]
    return { position: mix(a.position, b.position), rotation: mix(a.rotation, b.rotation) }
  }
  const applyClip = (pl: Playing): void => {
    for (const [id, obj] of pl.targets) {
      const rest = restPose.get(obj)
      if (!rest) continue
      const pose = poseAt(pl.clip, id === '' ? null : id, pl.t)
      obj.position.set(rest.p[0] + pose.position[0], rest.p[1] + pose.position[1], rest.p[2] + pose.position[2])
      obj.rotation.set(rest.r[0] + pose.rotation[0], rest.r[1] + pose.rotation[1], rest.r[2] + pose.rotation[2])
      // animations are visual only: move the part's collision/raycast shape to the same pose (spec rest + clip offset)
      const ps = id === '' ? undefined : specs.get(pl.entry.so.objectId)?.parts.find((p) => p.id === id)
      if (ps) {
        const r0 = ps.rotation ?? ZERO
        world.setPartPose(
          pl.entry.so.objectId, id,
          [ps.position[0] + pose.position[0], ps.position[1] + pose.position[1], ps.position[2] + pose.position[2]],
          [r0[0] + pose.rotation[0], r0[1] + pose.rotation[1], r0[2] + pose.rotation[2]],
        )
      }
    }
  }
  const updateAnimations = (dt: number): void => {
    for (let i = playing.length - 1; i >= 0; i--) {
      const pl = playing[i]
      pl.t = Math.min(pl.clip.duration, pl.t + dt)
      applyClip(pl)
      const evs = pl.clip.events ?? []
      while (pl.fired < evs.length && evs[pl.fired].t <= pl.t) {
        const ev = evs[pl.fired++]
        action('animation_event', t('act.anim_event', { name: pl.entry.name, clip: pl.clip.id, type: ev.type }), { objectId: pl.entry.so.objectId, itemId: pl.entry.so.itemId, data: { clip: pl.clip.id, type: ev.type, at: ev.t, ...(ev.data ?? {}) } })
        const key = ev.type === 'sound' ? ev.data?.key : undefined
        if (typeof key === 'string') playSound(key, v3(pl.entry.so.root.getWorldPosition(tmpV)), 1)
      }
      if (pl.t >= pl.clip.duration) {
        playing.splice(i, 1)
        action('animation_end', t('act.anim_end', { name: pl.entry.name, clip: pl.clip.id }), { objectId: pl.entry.so.objectId, itemId: pl.entry.so.itemId, data: { clip: pl.clip.id } })
      }
    }
  }
  const animationsOf = (): AnimationInfo | null => {
    const e = animTarget()
    if (!e || e.arena) return null
    const clips = (e.item?.animations ?? []).map((c) => ({ id: c.id, duration: c.duration }))
    return { objectId: e.so.objectId, itemId: e.so.itemId, name: e.name, clips, playing: playing.find((p) => p.entry === e)?.clip.id ?? null }
  }
  const playAnimation = (clipId: string, objectId?: string): boolean => {
    const e = objectId ? entries.get(objectId) : animTarget()
    const clip = e?.item?.animations?.find((c) => c.id === clipId)
    if (!e || !clip) return false
    for (let i = playing.length - 1; i >= 0; i--) if (playing[i].entry === e && playing[i].clip.id === clipId) playing.splice(i, 1)
    const targets = new Map<string, THREE_NS.Object3D>()
    const ids = new Set<string>()
    for (const k of clip.keys) for (const id of Object.keys(k.parts ?? {})) ids.add(id)
    const grab = (key: string, obj: THREE_NS.Object3D | undefined): void => {
      if (!obj) return
      if (!restPose.has(obj)) restPose.set(obj, { p: [obj.position.x, obj.position.y, obj.position.z], r: [obj.rotation.x, obj.rotation.y, obj.rotation.z] })
      targets.set(key, obj)
    }
    if (clip.keys.some((k) => k.position || k.rotation)) grab('', e.so.root)
    for (const id of ids) grab(id, e.so.root.getObjectByName(id) ?? undefined)
    const pl: Playing = { entry: e, clip, t: 0, fired: 0, targets }
    playing.push(pl)
    applyClip(pl)
    action('animation', t('act.anim_start', { name: e.name, clip: clip.id, seconds: num(clip.duration, 1) }), { objectId: e.so.objectId, itemId: e.so.itemId, data: { clip: clip.id, duration: clip.duration } })
    return true
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // Scenarios and modules
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const extraScenarios: TestRoomScenario[] = [...(options.scenarios ?? [])]
  const moduleCheck = (ok: boolean, text: string, data: Record<string, unknown>, itemId?: string): void => {
    log.add({ channel: 'check', type: ok ? 'pass' : 'fail', text: `${ok ? '✓' : '✗'} ${text}`, itemId, data: { ok, ...data } })
  }
  // ---------------------------------------------------------------------------------------------------------------------------------------
  // What modules get from the room (game-contracts ModuleHost): the scene, the tool events and the frame
  // ---------------------------------------------------------------------------------------------------------------------------------------
  const modules = new Map<string, TestableModule<ScenarioContext>>()
  const detachers = new Map<string, () => void>()
  const benches = new Map<string, BenchStore>()
  let activeBench: string | null = null
  const lastBench = (): string | null => [...benches.keys()].pop() ?? null
  const benchView = (): BenchView | null => {
    const store = activeBench ? benches.get(activeBench) : undefined
    if (!store) return null
    return { title: modules.get(store.moduleId)?.name ?? store.moduleId, controls: store.controls(), layers: store.layers(), sheet: store.sheet() }
  }
  const METRIC_UNAVAILABLE = 'n/a'
  const metricText = (value: number | string | undefined, digits: number, unit?: string): string =>
    typeof value === 'number' ? `${num(value, digits)}${unit ? ` ${unit}` : ''}` : value ?? METRIC_UNAVAILABLE
  const reportedFailures = new Set<string>()
  // a module's failure is told once (not every metrics tick) in the room log
  const reportOnce = (key: string, text: string): void => {
    if (reportedFailures.has(key)) return
    reportedFailures.add(key)
    host.log(text)
  }
  const failureText = (error: unknown): string => (error instanceof Error ? error.message : String(error))
  const moduleMetrics = (): Record<string, number | string> => {
    const store = activeBench ? benches.get(activeBench) : undefined
    const out: Record<string, number | string> = {}
    for (const metric of store?.metrics ?? []) {
      try {
        out[metric.id] = metric.read()
      } catch (error) {
        out[metric.id] = METRIC_UNAVAILABLE
        reportOnce(`${store?.moduleId}:metric:${metric.id}`, t('mod.metric_failed', { name: modules.get(store?.moduleId ?? '')?.name ?? '', metric: metric.id, error: failureText(error) }))
      }
    }
    return out
  }
  const metricRows = (): { room: MetricRow[]; module: MetricRow[] } => {
    const sampled = roomMetrics.sample()
    const room = roomMetricIds.flatMap((id) => {
      const value = sampled[id]
      return value === undefined ? [] : [{ id, name: t(`metric.${id}`), text: num(value, id === 'frame_ms' ? 1 : 0) }]
    })
    const values = moduleMetrics()
    const declared = (activeBench ? benches.get(activeBench)?.metrics : undefined) ?? []
    const module = declared.map((metric) => {
      const value = values[metric.id]
      const ratio = metric.max && typeof value === 'number' ? value / metric.max : undefined
      return { id: metric.id, name: metric.name, text: metricText(value, metric.digits ?? 0, metric.unit), ...(typeof value === 'number' ? { value } : {}), ...(ratio === undefined ? {} : { ratio }) }
    })
    return { room, module }
  }
  const showBench = (): void => {
    if (!ui) return
    ui.bench(benchView())
    ui.metrics(metricRows())
  }
  const hostListeners = new Set<(event: HostEvent) => void>()
  const frameListeners = new Set<(dt: number) => void>()
  const listenerDirection = new THREE.Vector3()
  const environment = options.environment ?? createEnvironmentBus()
  const audioSink = audio ? createAudioSink(audio) : undefined
  function emitHost(event: HostEvent): void {
    for (const listener of hostListeners) listener(event)
  }
  function flushEvents(id: string, state: WeaponState, recoil?: [number, number]): void {
    const phase = state.phase
    for (const event of state.drain()) {
      const hostEvent = toHostEvent(id, event, { ...(recoil ? { recoil } : {}), phase })
      if (hostEvent) emitHost(hostEvent)
    }
  }
  function startReload(): void {
    tool.reload()
    flushEvents(toolId, tool)
  }
  function clearToolFault(): void {
    if (!tool.clearFault()) return
    flushEvents(toolId, tool)
    say(t('hud.clearing'))
  }
  function toggleSafety(): void {
    tool.setSafety(!tool.safety)
    flushEvents(toolId, tool)
    say(t(tool.safety ? 'hud.safety_on' : 'hud.safety_off'))
  }
  function runToolCommand(request: ToolCommand): ToolCommandResult {
    // the room is the bench: every accessory can be fitted here, whatever it needs (a tool, a workbench)
    const work = (done: ReturnType<WeaponState['fit']>): ToolCommandResult => (done.ok ? { ok: true, seconds: done.seconds } : { ok: false, reason: done.reason })
    switch (request.type) {
      case 'fit':
        return work(tool.fit(request.attachment, { install: 'bench', ...(request.mount ? { mount: request.mount as MountKind } : {}) }))
      case 'remove':
        return work(tool.remove(request.attachment, { install: 'bench' }))
      case 'toggle':
        return tool.toggle(request.attachment) === null ? { ok: false, reason: 'not_fitted' } : { ok: true }
      case 'stock':
        return tool.setStock(request.state) ? { ok: true } : { ok: false, reason: 'busy' }
      case 'underbarrel':
        return tool.useUnderbarrel(request.on) ? { ok: true } : { ok: false, reason: 'busy' }
      case 'stance':
        tool.setStance({ ...(request.aiming === undefined ? {} : { aiming: request.aiming }), ...(request.supported === undefined ? {} : { supported: request.supported }) })
        return { ok: true }
      default:
        return { ok: false, reason: 'unknown' }
    }
  }
  const host: ModuleHost = {
    THREE,
    scene,
    camera,
    locale,
    ...(audioSink ? { audio: audioSink } : {}),
    environment,
    groundAt,
    effects: vfx,
    tool: () => ({
      weapon: toolId,
      category: tool.def.category,
      ammo: tool.ammo,
      capacity: tool.capacity,
      reserve: tool.reserve,
      reloading: tool.reloading,
      mode: tool.mode,
      ...(tool.fault ? { fault: tool.fault } : {}),
      safety: tool.safety,
      heat: tool.heatLevel,
      attachments: tool.attachments.map((part) => ({ id: part.id, mount: part.mount, ...(part.integral ? { integral: true } : {}), ...(part.on === undefined ? {} : { on: part.on }) })),
      stock: tool.stock,
      suppressed: tool.suppressed,
      underbarrelActive: tool.underbarrelActive,
      mass: tool.mass,
      aimSeconds: tool.aimSeconds,
    }),
    command(request) {
      const result = runToolCommand(request)
      flushEvents(toolId, tool)
      return result
    },
    configureTool(settings) {
      const condition = settings[SETTING_IDS.condition]
      const ammoQuality = settings[SETTING_IDS.ammoQuality]
      if (condition !== undefined) toolSettings.condition = condition
      if (ammoQuality !== undefined) toolSettings.ammoQuality = ammoQuality
      const fuseMetres = settings[SETTING_IDS.fuseLength] === undefined ? undefined : Number(settings[SETTING_IDS.fuseLength])
      if (fuseMetres !== undefined && fuseMetres > 0) fuseLength = fuseMetres
      for (const state of tools.values()) {
        if (condition !== undefined) state.setCondition(condition)
        if (ammoQuality !== undefined) state.setAmmoQuality(ammoQuality)
        if (fuseMetres !== undefined && fuseMetres > 0) state.setFuseLength(fuseMetres)
      }
    },
    on(listener) {
      hostListeners.add(listener)
      return () => hostListeners.delete(listener)
    },
    onFrame(update) {
      frameListeners.add(update)
      return () => frameListeners.delete(update)
    },
    setHandTargets(source) {
      handSource = source
      return () => {
        if (handSource === source) handSource = null
      }
    },
    log(text, data, type) {
      action(type ?? 'module_note', text, { data })
    },
    addBlocker(blocked) {
      blockers.add(blocked)
      return () => blockers.delete(blocked)
    },
    onClear(listener) {
      clearListeners.add(listener)
      return () => clearListeners.delete(listener)
    },
  }
  const lendBench = (store: BenchStore): ModuleBench => ({
    value: store.value,
    layer: store.layer,
    onChange: store.onChange,
    patch: store.patch,
    sheet: store.setSheet,
    look: (eye, target) => room.look(eye, target),
  })
  const checkModuleBench = (mod: TestableModule<ScenarioContext>, fail: (problem: string) => void): BenchStore | null => {
    const store = createBenchStore(mod, locale, (error) => reportOnce(`${mod.id}:listener`, t('mod.listener_failed', { name: mod.name, error: failureText(error) })))
    const { controls, layers, metrics } = store.declared
    if (controls.length + layers.length + metrics.length === 0) return null
    const r = checkBench(store.declared)
    const text = r.ok ? t('mod.bench_ok', { name: mod.name, controls: controls.length, layers: layers.length, metrics: metrics.length }) : t('mod.bench_fail', { name: mod.name, problems: r.problems.join('; ') })
    moduleCheck(r.ok, text, { module: mod.id, check: 'bench', problems: r.problems })
    for (const p of r.problems) fail(`bench: ${p}`)
    return r.ok ? store : null
  }

  const loadModule = (mod: TestableModule<ScenarioContext>): ModuleReport => {
    const report: ModuleReport = { module: mod.id, items: [], scenarios: [], ok: true, problems: [] }
    const fail = (problem: string): void => {
      report.ok = false
      report.problems.push(problem)
    }
    const added = mod.items(locale)
    for (const ti of added) {
      const item: TestRoomItem = {
        id: ti.id,
        name: ti.name,
        group: mod.group,
        build: (T) => ti.build(T) as THREE_NS.Object3D,
        spec: ti.spec as TestRoomItem['spec'],
        movable: ti.movable,
        fluid: ti.fluid,
        weapon: ti.weapon,
        impl: ti.impl as TestRoomItem['impl'],
        animations: ti.animations,
        thumbnail: ti.thumbnail,
        thumbnailCredit: ti.thumbnailCredit,
      }
      catalogMap.set(item.id, item)
      const at = catalog.findIndex((c) => c.id === item.id)
      if (at >= 0) catalog[at] = item
      else catalog.push(item)
      report.items.push(item.id)
      // contract checks on a throwaway build of the item (never added to the scene)
      let partIds: string[] = []
      const base = { module: mod.id, item: item.id }
      try {
        const root = item.build(THREE)
        root.updateMatrixWorld(true)
        if (item.impl) {
          const probe = item.impl(root, `${item.id}_check`)
          const r = checkDestructible(probe, { materials: world.materials.keys() })
          partIds = probe.describe().parts.map((p) => p.id)
          moduleCheck(r.ok, r.ok ? t('mod.destructible_ok', { name: item.name, parts: partIds.length }) : t('mod.destructible_fail', { name: item.name, problems: r.problems.join('; ') }), { ...base, check: 'destructible', problems: r.problems }, item.id)
          for (const p of r.problems) fail(`${item.id}: ${p}`)
        }
        if (!item.impl || item.spec) {
          // the spec is resolved after the build (it may be a function of the root, or derived from the meshes)
          const spec = resolveSpec(item, root).spec
          if (!item.impl) partIds = spec.parts.map((p) => p.id)
          const r = checkSpec(spec, { materials: world.materials.keys() })
          moduleCheck(r.ok, r.ok ? t('mod.spec_ok', { name: item.name, parts: spec.parts.length }) : t('mod.spec_fail', { name: item.name, problems: r.problems.join('; ') }), { ...base, check: 'spec', problems: r.problems, warnings: r.warnings }, item.id)
          for (const p of r.problems) fail(`${item.id}: ${p}`)
          for (const w of r.warnings) log.add({ channel: 'check', type: 'warn', text: `⚠ ${t('mod.spec_warn', { name: item.name, warning: w })}`, itemId: item.id, data: { ok: true, ...base, check: 'spec', warning: w } })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        moduleCheck(false, t('mod.destructible_fail', { name: item.name, problems: msg }), { ...base, check: 'destructible', problems: [msg] }, item.id)
        fail(`${item.id}: ${msg}`)
      }
      for (const clip of item.animations ?? []) {
        const r = checkAnimation(clip, partIds)
        moduleCheck(r.ok, r.ok ? t('mod.animation_ok', { name: item.name, clip: clip.id, seconds: num(clip.duration, 1) }) : t('mod.animation_fail', { name: item.name, clip: clip.id, problems: r.problems.join('; ') }), { ...base, check: 'animation', clip: clip.id, problems: r.problems }, item.id)
        for (const p of r.problems) fail(`${item.id}: ${p}`)
      }
    }
    for (const ms of mod.scenarios?.(locale) ?? []) {
      const sc: TestRoomScenario = { id: ms.id, name: ms.name, run: ms.run }
      const at = extraScenarios.findIndex((x) => x.id === sc.id)
      if (at >= 0) extraScenarios[at] = sc
      else extraScenarios.push(sc)
      report.scenarios.push(sc.id)
    }
    action('module', t('act.module_loaded', { name: mod.name, items: report.items.length, scenarios: report.scenarios.length, result: t(report.ok ? 'mod.all_ok' : 'mod.some_failed') }), { data: { module: mod.id, items: report.items, scenarios: report.scenarios, ok: report.ok } })
    const bench = checkModuleBench(mod, fail)
    detachers.get(mod.id)?.()
    detachers.delete(mod.id)
    // a reloaded module keeps its live bench state; the host's state only seeds a module the room has not seen
    const previous = benches.get(mod.id)
    const kept = previous?.encode()
    previous?.dispose()
    benches.delete(mod.id)
    for (const key of [...reportedFailures]) if (key.startsWith(`${mod.id}:`)) reportedFailures.delete(key)
    modules.set(mod.id, mod)
    if (bench) {
      const seed = options.bench?.state?.[mod.id]
      const restored = kept ?? (typeof seed === 'string' ? seed : undefined)
      if (restored !== undefined) bench.restore(restored)
      benches.set(mod.id, bench)
      bench.watch(() => {
        options.bench?.onChange?.(mod.id, bench.encode())
        if (activeBench === mod.id) ui?.bench(benchView())
      })
      if (!activeBench || !benches.has(activeBench)) activeBench = mod.id
    } else if (activeBench === mod.id) activeBench = lastBench()
    if (mod.attach) detachers.set(mod.id, mod.attach(bench ? { ...host, bench: lendBench(bench) } : host))
    bench?.sendInitial()
    showBench()
    ui?.refresh()
    return report
  }

  const allScenarios = (): TestRoomScenario[] => [...extraScenarios]
  let scenarioRunning = false

  const step = (seconds: number): void => {
    const dt = seconds > 6 ? 1 / 30 : FIXED_DT
    const n = Math.max(1, Math.round(seconds / dt))
    for (let i = 0; i < n; i++) {
      player.update(0)
      followHeld(dt)
      stepSim(dt)
    }
  }

  const runScenarios = async (list?: TestRoomScenario[]): Promise<ScenarioReport> => {
    const all = list ?? allScenarios()
    const report: ScenarioReport = { passed: 0, failed: 0, results: [] }
    scenarioRunning = true
    const wasPaused = paused
    paused = false
    try {
      for (const sc of all) {
        hardReset()
        player.look(arena.playerStart, [0, 1.5, arena.wallZ])
        useHeld = false
        const checks: Array<{ label: string; ok: boolean }> = []
        log.add({ channel: 'check', type: 'scenario', text: t('sc.start', { name: sc.name }), data: { id: sc.id } })
        const ctx: ScenarioContext = {
          room,
          step,
          expect(condition, label, data) {
            checks.push({ label, ok: !!condition })
            log.add({ channel: 'check', type: condition ? 'pass' : 'fail', text: `${condition ? '✓' : '✗'} ${label}`, data: { scenario: sc.id, ok: !!condition, ...(data ?? {}) } })
          },
        }
        try {
          await sc.run(ctx)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          ctx.expect(false, t('sc.error', { msg }))
        }
        flush()
        const ok = checks.length > 0 && checks.every((c) => c.ok)
        report.results.push({ id: sc.id, name: sc.name, ok, checks })
        if (ok) report.passed++
        else report.failed++
        log.add({ channel: 'check', type: ok ? 'scenario_pass' : 'scenario_fail', text: t(ok ? 'sc.pass' : 'sc.fail', { name: sc.name }), data: { id: sc.id, ok } })
        await new Promise<void>((res) => setTimeout(res, 0))
      }
    } finally {
      scenarioRunning = false
      paused = wasPaused
    }
    return report
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // The room object
  // ---------------------------------------------------------------------------------------------------------------------------------------
  // lays a module area: things that hold others first, so what goes on them finds their top
  const layArea = (layout: ModuleArea): SpawnedObject[] => {
    const holders = layout.placements.filter((p) => p.surface)
    const rest = layout.placements.filter((p) => !p.surface)
    const placed = [...holders, ...rest].map((p) => {
      const so = spawn(p.item, p.position, p.rotationY ?? 0)
      if (p.surface) {
        const [hx, hz] = p.surface.halfSize
        restingTops.push({ objectId: so.objectId, minX: p.position[0] - hx, maxX: p.position[0] + hx, minZ: p.position[2] - hz, maxZ: p.position[2] + hz, top: p.surface.height })
      }
      return { so, asleep: p.asleep === true }
    })
    for (const { so, asleep } of placed) {
      const piece = asleep ? rendererPieces.get(so.objectId) : undefined
      if (piece) piece.sleeping = true
    }
    if (layout.view) room.look(layout.view.eye, layout.view.target)
    return placed.map(({ so }) => so)
  }

  // a test environment per catalogue group, the way the demo site links each area of the index: a loaded module brings its own area,
  // any other group is laid in rows (small things in front, fixed big ones behind)
  const openArea = (area: string): SpawnedObject[] => {
    clear()
    const mod = [...modules.values()].find((m) => m.id === area || m.group === area)
    const label = mod?.group ?? S.groups[area] ?? area
    ui?.showGroup(label)
    activeBench = mod && benches.has(mod.id) ? mod.id : lastBench()
    showBench()
    const layout = mod?.area?.(locale)
    if (layout) return layArea(layout)
    const items = catalog.filter((item) => item.group === label)
    const front = items.filter((item) => item.movable !== false)
    const back = items.filter((item) => item.movable === false)
    const row = (list: TestRoomItem[], gap: number, z: number): SpawnedObject[] => list.map((item, index) => spawn(item.id, [(index - (list.length - 1) / 2) * gap, 0, z], 0))
    return [...row(front, 1.6, 1.5), ...row(back, 4.5, -4)]
  }

  const room: TestRoom & {
    tilt(rad: number): void
    toggleTap(on?: boolean): boolean
    blast(): BlastOptions
    setBlast(options: BlastOptions): void
    setSlowMotion(on: boolean): void
    setFastForward(on: boolean): void
    equip(weaponId: string): void
    readonly scenarios: TestRoomScenario[]
    readonly fluidRenderer: FluidRenderer
    inspectInfo(): InspectInfo | null
  } = {
    world,
    renderer,
    scene,
    camera,
    arsenal,
    fluids,
    film: filmBridge,
    vfx: vfx.world,
    fluidRenderer: fluidView,
    audio,
    environment,
    log,
    get tool() {
      return tool
    },
    get scenarios() {
      return allScenarios()
    },
    spawn,
    clear,
    resetAll,
    setTool,
    useItem,
    use(hold = 0) {
      if (tool.def.category === 'hand') {
        grab()
        return
      }
      useTool(FIXED_DT, false)
      flush()
      let t0 = 0
      while (t0 < hold) {
        useTool(FIXED_DT, true)
        stepSim(FIXED_DT)
        t0 += FIXED_DT
      }
      releaseTrigger()
    },
    grab,
    throwHeld,
    look(position, target) {
      player.look(position, target)
    },
    inspect() {
      const r = inspectTarget()
      if (!r) return null
      return { objectId: r.object, partId: r.part, itemId: entryOf(r.object)?.so.itemId ?? '' }
    },
    inspectInfo,
    spawned() {
      return [...entries.values()].filter((e) => !e.arena).map((e) => e.so)
    },
    update,
    waitUntilReady(maxSeconds = 5) {
      let waited = 0
      while (tool.phase && waited < maxSeconds) {
        update(FIXED_DT)
        waited += FIXED_DT
      }
      // the trigger judges a frame by where it starts: one more frame, or the first pull of a fresh draw still answers `drawing`
      update(FIXED_DT)
      return waited + FIXED_DT
    },
    on(type, fn) {
      listeners[type].add(fn)
      return () => listeners[type].delete(fn)
    },
    runScenarios,
    tilt(rad) {
      heldTilt = rad
    },
    toggleTap,
    blast: () => ({ ...blastOptions }),
    setBlast: (next) => {
      blastOptions = { ...blastOptions, ...next }
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
    },
    get paused() {
      return paused
    },
    walk(to, seconds) {
      walkPlan = seconds > 0 ? { x: to[0], z: to[2], remaining: seconds } : null
      if (!walkPlan) player.moveBy(to[0] - camera.position.x, to[2] - camera.position.z)
    },
    setSlowMotion(on) {
      timeScale = on ? 0.25 : 1
    },
    setFastForward(on) {
      fastForward = on
    },
    equip,
    openArea,
    loadModule,
    animations: animationsOf,
    playAnimation,
    bench(moduleId) {
      const id = moduleId ?? activeBench
      return (id ? benches.get(id) : undefined) ?? null
    },
    applyCamera: () => {
      const back = applyThirdView()
      const shake = vfx.applyCamera()
      return () => {
        shake()
        back()
      }
    },
    setAvatar,
    get avatar() {
      return avatar
    },
    setAvatarState(state) {
      if (state.crouch !== undefined) avatarState.crouch = state.crouch
      if (state.down !== undefined) avatarState.down = state.down
      if (state.armed !== undefined) armedForced = state.armed
    },
    avatarState: () => ({ ...avatarState }),
    setCameraMode,
    get cameraMode() {
      return cameraMode
    },
    metrics() {
      return { room: roomMetrics.sample(), module: moduleMetrics() }
    },
    dispose() {
      destructionSound?.dispose()
      if (ownAudio) audio?.dispose()
      for (const detach of detachers.values()) detach()
      detachers.clear()
      for (const store of benches.values()) store.dispose()
      benches.clear()
      cancelAnimationFrame?.(raf)
      window.removeEventListener('resize', onResize)
      player.dispose()
      ui?.dispose()
      renderer.dispose()
      vfx.dispose()
      craterPatch?.dispose()
      fluidView.dispose()
      filmBridge.dispose()
      film.dispose()
      for (const tr of tracers) tr.line.removeFromParent()
      explosives.clear()
      if (ownRenderer) {
        gl.dispose()
        dom.remove()
      }
    },
  }

  // ---------------------------------------------------------------------------------------------------------------------------------------
  // UI and loop
  // ---------------------------------------------------------------------------------------------------------------------------------------
  let ui: RoomUi | null = null
  if (options.ui !== false) {
    const groups = (): Map<string, TestRoomItem[]> => {
      const m = new Map<string, TestRoomItem[]>()
      for (const i of catalog) {
        const g = m.get(i.group) ?? []
        g.push(i)
        m.set(i.group, g)
      }
      return m
    }
    ui = createUi({
      container,
      strings: S,
      t,
      log,
      groups,
      loadout: () => loadout.map((id) => ({ id, name: arsenal.name(id) })),
      onSpawn: (id) => {
        spawn(id)
      },
      onEquip: (itemId) => {
        const w = catalogMap.get(itemId)?.weapon
        if (w) equip(w)
      },
      onClear: clear,
      onResetAll: resetAll,
      onSlow: (on) => room.setSlowMotion(on),
      onFast: (on) => room.setFastForward(on),
      onQuality: (q) => {
        qualityName = q
        if (ownRenderer) {
          gl.shadowMap.enabled = q !== 'low'
          gl.setPixelRatio(q === 'low' ? 1 : Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2))
          arena.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024)
          arena.sun.shadow.map?.dispose()
          arena.sun.shadow.map = null
          resize()
        }
      },
      quality: qualityName,
      scenarios: allScenarios,
      onRun: async (sc) => {
        await runScenarios([sc])
      },
      onRunAll: async () => {
        await runScenarios()
      },
      onTool: (index) => {
        toolIndex = index
        setTool(loadout[index])
      },
      onTap: () => toggleTap(),
      onBlast: (key) => toggleBlast(key),
      onPlay: (objectId, clipId) => {
        playAnimation(clipId, objectId)
      },
      onResize: resize,
      onControl: (id, value) => {
        if (activeBench) benches.get(activeBench)?.set(id, value)
      },
      onLayer: (id, on) => {
        if (activeBench) benches.get(activeBench)?.setLayer(id, on)
      },
      onAction: (id) => {
        if (activeBench) benches.get(activeBench)?.act(id)
      },
    })
    ui.hud(hudState())
    showBench()
  }

  let raf = 0
  if (ownRenderer && typeof requestAnimationFrame === 'function') {
    let last = performance.now()
    ownsLoop = true
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop)
      const realDelta = (now - last) / 1000
      roomMetrics.frame(realDelta)
      const dt = Math.min(0.05, realDelta)
      last = now
      if (!scenarioRunning) update(dt)
      const restoreCamera = room.applyCamera()
      gl.render(scene, camera)
      restoreCamera()
      roomMetrics.rendered()
    }
    raf = requestAnimationFrame(loop)
  }

  if (options.initial) {
    for (const [i, id] of options.initial.entries()) spawn(id, [(i - (options.initial.length - 1) / 2) * 1.3, 0, 0.5])
  }
  if (options.avatar) setAvatar(options.avatar)
  if (options.area) openArea(options.area)

  return room
}

function structuredCloneSpec(spec: DestructibleSpec): DestructibleSpec {
  return JSON.parse(JSON.stringify(spec)) as DestructibleSpec
}
