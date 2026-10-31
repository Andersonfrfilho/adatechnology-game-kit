import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE_NS from 'three'
import type { BenchChange, BenchSheet, DestructionEvent, Hit, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, Vec3 } from '@adatechnology/game-contracts'
import type { ExplosiveDef } from '@adatechnology/game-weapons'
import type { ItemModels } from '../item-models'
import { fillText } from './explosives-text'
import type { ExplosivesText } from './explosives-text'
import { WORLD_EXPLOSIVE_PREFIX, worldExplosiveShell, worldExplosiveValve } from '../world-explosives'

/** Id of the explosives module (`?area=explosives_area` opens it). */
export const EXPLOSIVES_AREA_ID = 'explosives_area'

/** The parts of a part state the bench reads (structural: `PartState` of the destruction world fits). */
interface PartView {
  readonly liters?: number
  readonly temperature: number
  readonly status: string
  readonly holes: ReadonlyArray<{ readonly diameter: number; readonly through: boolean }>
  readonly cracks: readonly unknown[]
  readonly burning: boolean
}

/** What the explosives module needs from the room it drives (structural: the `TestRoom` of game-test-room fits). */
export interface ExplosivesRoom {
  readonly world: {
    readonly time: number
    ids(): string[]
    on(type: '*', fn: (event: DestructionEvent) => void): () => void
    hit(objectId: string, hit: Hit): unknown
    vent(objectId: string, partId: string, opening?: { point?: Vec3; normal?: Vec3; diameter?: number }): boolean
    seal(objectId: string, partId: string): number
    part(objectId: string, partId: string): PartView | null
    state(objectId: string): { readonly parts: readonly (PartView & { readonly id: string; readonly hp: number; readonly maxHp: number })[] } | null
  }
  readonly renderer: { impulse(objectId: string, impulse: Vec3, point?: Vec3): void }
  readonly vfx: {
    spawn(kind: string, point: Vec3, velocity: Vec3, options?: { color?: number; size?: number; life?: number; alpha?: number }): void
    burst(kind: string, point: Vec3, normal: Vec3, count: number, speed?: number): void
    fire(options: { point: Vec3; radius: number; life: number }): number
    stop(handle: number): void
  }
  spawned(): ReadonlyArray<{ readonly objectId: string; readonly itemId: string; readonly root: unknown }>
  openArea(group: string): unknown
  clear(): void
  spawn(itemId: string, position?: Vec3, rotationY?: number): { readonly objectId: string; readonly itemId: string; readonly root: unknown }
  setTool(weaponId: string): void
  waitUntilReady(maxSeconds?: number): number
  look(position: Vec3, target: Vec3): void
  use(hold?: number): void
  on(type: 'spawn', fn: (data: unknown) => void): () => void
}

/** The bench of the explosives area as the module and its scenarios see it. */
export interface ExplosivesBench {
  readonly room: ExplosivesRoom | undefined
  readonly def: ExplosiveDef
  /** The strength multiplier now (the next cylinder laid takes it). */
  blastScale(): number
  /** Called by the module's `area`: the cylinders spawned from now on belong to the area (they get their rings). */
  areaOpened(): void
  controls(): ModuleControl[]
  layers(): ModuleLayer[]
  metrics(): ModuleMetric[]
  attach(host: ModuleHost): () => void
  /** The actions of the bench, by the id of their button. Each answers whether it did something. */
  readonly actions: Readonly<Record<'shoot' | 'valve' | 'light' | 'fire' | 'reset', () => boolean>>
  /** The cylinder of the scene (the first one alive), with what the bench knows about it. */
  vessel(): VesselView | undefined
  /** The wall of the scene, the zombie and the survivor, as the aftermath reads them. */
  /** The last explosion the host told (a part of the world or a thrown explosive): where, how strong and how far; undefined before the first, and after the area is cleared. */
  lastBlast(): { readonly point: Vec3; readonly energy: number; readonly radius: number; readonly cause: string; readonly explosive?: string } | undefined
  witnesses(): Array<{ kind: 'person' | 'wall' | 'object'; id: string; itemId: string; distance: number; alive?: boolean; vitality?: number; broken?: number; marks?: number; pieces?: number }>
}

export interface VesselView {
  readonly objectId: string
  /** World time of the first leak, of the jet catching fire and of the blast (seconds); undefined until they happen. */
  readonly leakAt: number | undefined
  readonly litAt: number | undefined
  readonly explodedAt: number | undefined
  readonly cause: 'shot' | 'valve' | undefined
  readonly valveOpen: boolean
  readonly lit: boolean
  readonly exploded: boolean
  readonly point: Vec3 | undefined
}

interface Leak {
  point: Vec3
  direction: Vec3
  rate: number
}

interface Vessel {
  objectId: string
  root: THREE_NS.Object3D
  /** The strength multiplier it was laid with. */
  scale: number
  leaks: Leak[]
  leakAt?: number
  cause?: 'shot' | 'valve'
  valveRequested: boolean
  valveOpen: boolean
  lit: boolean
  litAt?: number
  explodeAt?: number
  explodedAt?: number
  exploded: boolean
  centre?: Vec3
  fireUntil?: number
  fireHandle?: number
  firePoint?: Vec3
  nextHeatLog: number
  torchFrame: number
  rings?: THREE_NS.Object3D
}

interface Shell {
  mesh: THREE_NS.Object3D
  position: [number, number, number]
  velocity: [number, number, number]
  spin: [number, number, number]
  age: number
  trail: number
  landed: boolean
  start: Vec3
}

// How the flame of a lighter or of the burning jet acts on the cylinder: a source hotter than the auto-ignition of propane, held for a moment
const FLAME_C = 1100
const FLAME_RADIUS = 0.2
const FLAME_SECONDS = 0.3
/** The fire chain of a part primes at 300 °C when it has no `atC` (game-destruction `FIRE_PRIME_C`). */
const FIRE_CHAIN_C = 300
/** Where the fire of "throw it in the fire" is lit, metres from the cylinder (toward +x, the table) and for how many seconds the bench keeps it hot. */
const FIRE_OFFSET: Vec3 = [0.4, 0, 0.15]
const FIRE_VISUAL_RADIUS = 0.6
/** The shove of the gas jet on the cylinder while it hisses (N·s per frame, against the jet) and the seconds the aftermath waits after the blast. */
const HISS_SHOVE = 0.35
const AFTERMATH_DELAY = 2
/** The shot: the weapon of the bench and the height of the aim above the foot of the cylinder. */
const SHOOTER = 'pistol_9mm'
const AIM_HEIGHT = 0.2
const GRAVITY = 9.81
/** The table and the other pieces whose state the aftermath reports. */
const REPORTED_OBJECTS = ['fridge', 'kitchen_cabinet_base', 'stove', 'camp_table']
const RING_SEGMENTS = 128
/** The room's brick target wall (id `target_wall`, at z = -11): the aftermath reads it and the pieces it breaks into. */
const WALL_ID = 'target_wall'
const WALL_Z = -11

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const num = (value: number, digits = 1): string => value.toFixed(digits)

export interface ExplosivesBenchOptions {
  readonly locale: string
  readonly text: ExplosivesText
  readonly def: ExplosiveDef
  readonly scene: { readonly cylinder: Vec3 }
  readonly room: ExplosivesRoom | undefined
  readonly blastScale: number
  readonly items?: ItemModels
  readonly profile: { readonly visualRadius?: number; readonly residualFires?: ReadonlyArray<{ readonly radius: number; readonly life: number }> } | undefined
}

/**
 * The state and the actions of the explosives area: it follows the world's events of the cylinder (leak, primed, explode), tells each phase in the room's log, plays the torch and the flight
 * of the shell (the Laboratório de Explosões, `SC.p13`) and drives the destruction world for the bench actions. The module wraps it in a `TestableModule`.
 */
export function createExplosivesBench(options: ExplosivesBenchOptions): ExplosivesBench {
  const { text, def, room, profile } = options
  const log = text.log
  let host: ModuleHost | null = null
  let strength = options.blastScale
  let inArea = false
  let lastBlast: ReturnType<ExplosivesBench['lastBlast']>
  let ringsOn = true
  let initial = true
  let aftermathDue: Array<{ at: number; vessel: Vessel; point: Vec3 }> = []
  const vessels = new Map<string, Vessel>()
  const wallParts = new Set<string>()
  const shells: Shell[] = []
  const T = (): typeof THREE_NS => host?.THREE as typeof THREE_NS
  const now = (): number => room?.world.time ?? 0
  const say = (message: string, data: Record<string, unknown> = {}): void => host?.log(message, { source: EXPLOSIVES_AREA_ID, ...data })

  const leakConfig = def.leak
  const igniteDelay = leakConfig?.igniteDelay ?? 0.8
  const hissSeconds = leakConfig?.hissSeconds ?? igniteDelay
  const chainFire = (() => {
    const fire = def.chain?.fire
    return fire === undefined ? 1.4 : typeof fire === 'number' ? fire : fire[0]
  })()

  // ------------------------------------------------------------------------------------------------------------------------------------
  // The cylinder in the world
  // ------------------------------------------------------------------------------------------------------------------------------------
  const liters = (vessel: Vessel): number => room?.world.part(vessel.objectId, 'tank')?.liters ?? 0
  const throughHoles = (vessel: Vessel): number => room?.world.part(vessel.objectId, 'tank')?.holes.filter((hole) => hole.through).length ?? 0
  const leaking = (vessel: Vessel): boolean => !vessel.exploded && liters(vessel) > 0 && throughHoles(vessel) > 0
  const centreOf = (vessel: Vessel): Vec3 => {
    const p = vessel.root.getWorldPosition(new (T().Vector3)())
    return [p.x, p.y + AIM_HEIGHT, p.z]
  }
  const valveOf = (vessel: Vessel): Vec3 => worldExplosiveValve(T(), vessel.root) ?? centreOf(vessel)
  const target = (): Vessel | undefined => [...vessels.values()].find((vessel) => !vessel.exploded) ?? [...vessels.values()][0]
  const lethalOf = (vessel: Vessel): number => def.lethalRadius * vessel.scale
  const injuryOf = (vessel: Vessel): number => def.injuryRadius * vessel.scale

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Rings on the floor at the lethal and injury radii
  // ------------------------------------------------------------------------------------------------------------------------------------
  const labelSprite = (words: string, colour: string, at: Vec3): THREE_NS.Object3D | null => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) return null
      context.fillStyle = colour
      context.font = 'bold 40px sans-serif'
      context.textAlign = 'center'
      context.fillText(words, 128, 46)
      const sprite = new (T().Sprite)(new (T().SpriteMaterial)({ map: new (T().CanvasTexture)(canvas), transparent: true, depthWrite: false }))
      sprite.scale.set(2.4, 0.6, 1)
      sprite.position.set(...at)
      return sprite
    } catch {
      return null
    }
  }
  const ringLine = (radius: number, colour: number): THREE_NS.Object3D => {
    const points: number[] = []
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const angle = (i / RING_SEGMENTS) * Math.PI * 2
      points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    }
    const geometry = new (T().BufferGeometry)()
    geometry.setAttribute('position', new (T().Float32BufferAttribute)(points, 3))
    return new (T().LineLoop)(geometry, new (T().LineBasicMaterial)({ color: colour }))
  }
  const drawRings = (vessel: Vessel): void => {
    // a measuring overlay of the bench, not a piece
    const group = markKitOrigin(new (T().Group)(), { owner: 'game-weapons-three', kind: 'aid' })
    group.name = 'blast_rings'
    const lethal = lethalOf(vessel)
    const injury = injuryOf(vessel)
    group.add(ringLine(lethal, 0xff3b30), ringLine(injury, 0xffb020))
    const lethalLabel = labelSprite(`${num(lethal, 0)} m ${text.rings.lethal}`, '#ff6a5e', [0, 0.35, lethal])
    const injuryLabel = labelSprite(`${num(injury, 0)} m ${text.rings.injury}`, '#ffc44d', [0, 0.35, injury])
    for (const label of [lethalLabel, injuryLabel]) if (label) group.add(label)
    const p = vessel.root.getWorldPosition(new (T().Vector3)())
    group.position.set(p.x, 0.03, p.z)
    group.visible = ringsOn
    ;(host?.scene as THREE_NS.Scene).add(group)
    vessel.rings = group
  }
  const clearRings = (vessel: Vessel): void => {
    vessel.rings?.removeFromParent()
    vessel.rings = undefined
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Phases
  // ------------------------------------------------------------------------------------------------------------------------------------
  const phaseOf = (vessel: Vessel | undefined): keyof ExplosivesText['phases'] => {
    if (!vessel) return 'rest'
    if (vessel.exploded) return 'exploded'
    if (vessel.explodeAt !== undefined) return 'primed'
    if (vessel.lit) return 'torch'
    return vessel.leakAt === undefined ? 'rest' : 'leaking'
  }

  /** The flame reaches the leak: the gas lights (a `heat` hit at the leak), and the world primes the fire chain. */
  const ignite = (vessel: Vessel, by: 'shot' | 'lighter'): void => {
    if (vessel.lit || vessel.exploded || !room) return
    const leak = vessel.leaks[vessel.leaks.length - 1]
    const point = leak?.point ?? valveOf(vessel)
    room.world.hit(vessel.objectId, { type: 'heat', point, temperature: FLAME_C, radius: FLAME_RADIUS, duration: FLAME_SECONDS, source: 'p13_flame' })
    vessel.lit = true
    vessel.litAt = now()
    const rest = vessel.explodeAt === undefined ? chainFire : Math.max(0, vessel.explodeAt - now())
    if (by === 'shot') say(fillText(log.jet_lit, { seconds: num(now() - (vessel.leakAt ?? now()), 1), rest: num(rest, 1) }), { phase: 'torch', objectId: vessel.objectId, seconds: now() - (vessel.leakAt ?? now()), rest })
    else say(fillText(log.lighter_lit, {}), { phase: 'torch', objectId: vessel.objectId, by })
  }

  const shove = (vessel: Vessel): void => {
    const leak = vessel.leaks[vessel.leaks.length - 1]
    if (!room || !leak) return
    const [dx, dy, dz] = leak.direction
    const length = Math.hypot(dx, dy, dz) || 1
    room.renderer.impulse(vessel.objectId, [(-dx / length) * HISS_SHOVE, (-dy / length) * HISS_SHOVE * 0.2, (-dz / length) * HISS_SHOVE], leak.point)
  }

  const torchSprites = (vessel: Vessel): void => {
    const leak = vessel.leaks[vessel.leaks.length - 1]
    if (!room || !leak) return
    const [dx, dy, dz] = leak.direction
    const length = Math.hypot(dx, dy, dz) || 1
    const flame = (): number => 3 + Math.random() * 2.5
    for (let i = 0; i < 3; i++) room.vfx.spawn('fire', leak.point, [(dx / length) * flame() + (Math.random() - 0.5) * 0.7, (dy / length) * flame() + 0.6 + (Math.random() - 0.5) * 0.7, (dz / length) * flame() + (Math.random() - 0.5) * 0.7], { size: 0.45 + Math.random() * 0.35, life: 0.7 })
    if (vessel.torchFrame++ % 3 === 0) room.vfx.spawn('smoke', leak.point, [(dx / length) * 2, 1.5, (dz / length) * 2], { size: 0.7, life: 1 })
  }

  const launchShell = (vessel: Vessel, point: Vec3): void => {
    const config = def.shell
    if (!config || !host) return
    const mesh = worldExplosiveShell(T(), def.id, options.items)
    if (!mesh) return
    mesh.position.set(point[0], Math.max(point[1], 0.3), point[2])
    ;(host.scene as THREE_NS.Scene).add(mesh)
    shells.push({
      mesh,
      position: [point[0], Math.max(point[1], 0.3), point[2]],
      velocity: [(Math.random() - 0.5) * 3, config.launchSpeed, (Math.random() - 0.5) * 3],
      spin: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12],
      age: 0,
      trail: config.trailSeconds,
      landed: false,
      start: point,
    })
    say(fillText(log.shell, { speed: num(config.launchSpeed, 0), trail: num(config.trailSeconds, 1) }), { phase: 'shell', speed: config.launchSpeed, trailSeconds: config.trailSeconds })
    void vessel
  }

  const stepShells = (dt: number): void => {
    if (!host) return
    for (const shell of shells) {
      if (shell.landed) continue
      shell.age += dt
      shell.velocity[1] -= GRAVITY * dt
      for (let axis = 0; axis < 3; axis++) shell.position[axis] = (shell.position[axis] as number) + (shell.velocity[axis] as number) * dt
      const ground = host.groundAt(shell.position[0], shell.position[2]) + 0.18
      if (shell.position[1] <= ground && shell.velocity[1] < 0) {
        shell.position[1] = ground
        if (Math.abs(shell.velocity[1]) > 1.5) {
          shell.velocity = [shell.velocity[0] * 0.5, -shell.velocity[1] * 0.35, shell.velocity[2] * 0.5]
        } else {
          shell.landed = true
          shell.mesh.rotation.set(Math.PI / 2, shell.mesh.rotation.y, 0)
          const away = dist(shell.start, [shell.position[0], shell.position[1], shell.position[2]])
          say(fillText(log.shell_landed, { distance: num(away, 1), seconds: num(shell.age, 1) }), { phase: 'shell_landed', distance: away, seconds: shell.age })
        }
      } else {
        shell.mesh.rotation.x += shell.spin[0] * dt
        shell.mesh.rotation.y += shell.spin[1] * dt
        shell.mesh.rotation.z += shell.spin[2] * dt
      }
      shell.mesh.position.set(shell.position[0], shell.position[1], shell.position[2])
      if (room && shell.age < shell.trail) {
        const at: Vec3 = [shell.position[0], shell.position[1], shell.position[2]]
        room.vfx.spawn('fire', at, [(Math.random() - 0.5) * 0.6, -0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6], { size: 0.6, life: 0.6 })
        room.vfx.spawn('smoke', at, [(Math.random() - 0.5) * 0.4, 0.2, (Math.random() - 0.5) * 0.4], { size: 0.7, life: 1.2 })
      }
    }
  }

  const clearShells = (): void => {
    for (const shell of shells) shell.mesh.removeFromParent()
    shells.length = 0
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // What the blast left
  // ------------------------------------------------------------------------------------------------------------------------------------
  /** The most vitality each person was seen with (the body counts raw points, 100 for a fit one): what the fraction that is left is measured against. Read at the first leak, before any blast. */
  const fullVitality = new Map<string, number>()
  const witnesses = (): ReturnType<ExplosivesBench['witnesses']> => {
    if (!room) return []
    const origin = [...vessels.values()][0]?.centre ?? options.scene.cylinder
    const found: ReturnType<ExplosivesBench['witnesses']> = []
    for (const spawned of room.spawned()) {
      const position = (spawned.root as THREE_NS.Object3D).getWorldPosition(new (T().Vector3)())
      const at: Vec3 = [position.x, position.y, position.z]
      const distance = dist([at[0], 0, at[2]], [origin[0], 0, origin[2]])
      if (spawned.itemId.startsWith('zombie_') || spawned.itemId.startsWith('person_')) {
        const state = room.world.state(spawned.objectId) as { body?: { alive?: boolean; vitality?: number } } | null
        const alive = state?.body?.alive ?? true
        const raw = state?.body?.vitality
        if (raw !== undefined) fullVitality.set(spawned.objectId, Math.max(fullVitality.get(spawned.objectId) ?? 0, raw))
        const vitality = raw === undefined ? undefined : Math.max(0, raw) / Math.max(1e-9, fullVitality.get(spawned.objectId) ?? raw)
        found.push({ kind: 'person', id: spawned.objectId, itemId: spawned.itemId, distance, alive, ...(vitality === undefined ? {} : { vitality }) })
      } else if (REPORTED_OBJECTS.includes(spawned.itemId)) {
        const parts = room.world.state(spawned.objectId)?.parts ?? []
        found.push({ kind: 'object', id: spawned.objectId, itemId: spawned.itemId, distance, broken: parts.filter((part) => part.status === 'broken').length, marks: parts.filter((part) => part.burning).length })
      }
    }
    // the wall breaks loose into pieces that are objects of their own (ids of the world), still holding the parts the wall had: count by those
    if (wallParts.size > 0) {
      let broken = 0
      let marks = 0
      let pieces = 0
      for (const id of room.world.ids()) {
        const mine = (room.world.state(id)?.parts ?? []).filter((part) => wallParts.has(part.id))
        if (mine.length === 0) continue
        pieces++
        broken += mine.filter((part) => part.status === 'broken').length
        marks += mine.reduce((n, part) => n + part.cracks.length + part.holes.length, 0)
      }
      found.push({ kind: 'wall', id: 'target_wall', itemId: 'target_wall', distance: Math.abs(WALL_Z - origin[2]), broken, marks, pieces })
    }
    return found
  }

  const whoIs = (itemId: string): string => (itemId.startsWith('zombie_') ? text.things.zombie : text.things.survivor)

  const aftermath = (point: Vec3): void => {
    for (const w of witnesses()) {
      const distance = num(w.distance, 1)
      if (w.kind === 'person') {
        const verdict = w.alive === false ? text.verdicts.dead : w.vitality !== undefined && w.vitality < 0.999 ? fillText(text.verdicts.hurt, { vitality: num(w.vitality * 100, 0) }) : text.verdicts.unhurt
        say(fillText(log.aftermath_person, { who: whoIs(w.itemId), distance, verdict }), { phase: 'aftermath', kind: w.kind, objectId: w.id, distance: w.distance, alive: w.alive, vitality: w.vitality, point })
      } else if (w.kind === 'wall') {
        const verdict = (w.pieces ?? 1) > 1 ? fillText(text.verdicts.wall_pieces, { pieces: w.pieces ?? 0, n: w.marks ?? 0 }) : (w.broken ?? 0) > 0 ? fillText(text.verdicts.wall_broken, { n: w.broken ?? 0 }) : (w.marks ?? 0) > 0 ? fillText(text.verdicts.wall_cracked, { n: w.marks ?? 0 }) : text.verdicts.wall_intact
        say(fillText(log.aftermath_wall, { verdict }), { phase: 'aftermath', kind: w.kind, objectId: w.id, broken: w.broken, marks: w.marks, pieces: w.pieces })
      } else {
        const verdict = (w.broken ?? 0) > 0 ? fillText(text.verdicts.lost_parts, { n: w.broken ?? 0 }) : (w.marks ?? 0) > 0 ? text.verdicts.burning : text.verdicts.standing
        say(fillText(log.aftermath_object, { what: text.things[w.itemId] ?? w.itemId, distance, verdict }), { phase: 'aftermath', kind: w.kind, objectId: w.id, distance: w.distance, broken: w.broken })
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Events of the world
  // ------------------------------------------------------------------------------------------------------------------------------------
  const onEvent = (event: DestructionEvent): void => {
    const vessel = vessels.get(event.object)
    if (!vessel || !('part' in event) || event.part !== 'tank') return
    if (event.type === 'leak') {
      witnesses()
      if (vessel.leakAt === undefined) {
        vessel.leakAt = event.time
        vessel.cause = vessel.valveRequested ? 'valve' : 'shot'
      }
      vessel.valveRequested = false
      vessel.leaks.push({ point: event.point, direction: event.direction, rate: event.rate })
      if (vessel.leaks.length > 8) vessel.leaks.shift()
      const holes = room?.world.part(vessel.objectId, 'tank')?.holes ?? []
      const diameter = (holes[holes.length - 1]?.diameter ?? 0.009) * 1000
      const vars = { diameter: num(diameter, 0), rate: num(event.rate, 2), liters: num(liters(vessel), 1) }
      say(fillText(vessel.cause === 'valve' && vessel.leaks.length === 1 ? log.leak_valve : log.leak_shot, vars), { phase: 'leak', objectId: vessel.objectId, cause: vessel.cause, ratePerS: event.rate, diameterMm: diameter, liters: liters(vessel), pressurized: event.pressurized })
    } else if (event.type === 'primed') {
      vessel.explodeAt = event.time + event.delay
      say(fillText(log.primed, { trigger: text.triggers[event.trigger], delay: num(event.delay, 1) }), { phase: 'primed', objectId: vessel.objectId, trigger: event.trigger, delaySeconds: event.delay })
    } else if (event.type === 'explode') {
      vessel.exploded = true
      vessel.explodedAt = event.time
      vessel.centre = event.point
      const radius = profile?.visualRadius
      const fireball = (radius ?? 2) * 2
      const lethal = lethalOf(vessel)
      const injury = injuryOf(vessel)
      say(fillText(log.explode, { fireball: num(fireball, 1), lethal: num(lethal, 1), injury: num(injury, 1), energy: num((def.energy * vessel.scale) / 1000, 0), scale: num(vessel.scale, 2) }), {
        phase: 'explode', objectId: vessel.objectId, fireballMetres: fireball, lethalRadius: lethal, injuryRadius: injury, energyJ: def.energy * vessel.scale, scale: vessel.scale, point: event.point,
        sinceLeakSeconds: vessel.leakAt === undefined ? undefined : event.time - vessel.leakAt,
      })
      const residual = profile?.residualFires?.[0]
      if (residual) say(fillText(log.residual, { radius: num(residual.radius, 1), seconds: num(residual.life, 0) }), { phase: 'residual', radius: residual.radius, seconds: residual.life })
      if (vessel.fireHandle !== undefined) room?.vfx.stop(vessel.fireHandle)
      launchShell(vessel, event.point)
      aftermathDue.push({ at: now() + AFTERMATH_DELAY, vessel, point: event.point })
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // The frame
  // ------------------------------------------------------------------------------------------------------------------------------------
  const frame = (dt: number): void => {
    const t = now()
    for (const vessel of vessels.values()) {
      if (vessel.exploded) {
        vessel.lit = false
        continue
      }
      if (vessel.leakAt !== undefined) {
        // the white jet hisses and shoves the cylinder; a hole in the shell lights after the delay of the arsenal (the valve waits for a flame)
        if (t - vessel.leakAt <= hissSeconds && leaking(vessel)) shove(vessel)
        if (vessel.cause === 'shot' && !vessel.lit && t - vessel.leakAt >= igniteDelay && leaking(vessel)) ignite(vessel, 'shot')
      }
      if (vessel.lit) {
        if (leaking(vessel)) torchSprites(vessel)
        else vessel.lit = false
      }
      if (vessel.fireUntil !== undefined && t < vessel.fireUntil && room && vessel.firePoint) {
        const fire = def.fire
        room.world.hit(vessel.objectId, { type: 'heat', point: vessel.firePoint, temperature: fire?.temperature ?? 700, radius: fire?.radius ?? 1.4, duration: dt, source: 'p13_fire' })
        if (vessel.explodeAt === undefined && t >= vessel.nextHeatLog) {
          vessel.nextHeatLog = t + 1
          say(fillText(log.heating, { temperature: num(room.world.part(vessel.objectId, 'tank')?.temperature ?? 0, 0), limit: num(FIRE_CHAIN_C, 0) }), { phase: 'heating', objectId: vessel.objectId })
        }
      }
    }
    stepShells(dt)
    if (aftermathDue.length > 0) {
      const ready = aftermathDue.filter((entry) => entry.at <= t)
      aftermathDue = aftermathDue.filter((entry) => entry.at > t)
      for (const entry of ready) aftermath(entry.point)
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // The actions of the bench
  // ------------------------------------------------------------------------------------------------------------------------------------
  const needRoom = (): boolean => {
    if (room) return true
    say(log.no_room)
    return false
  }
  const withVessel = (): Vessel | undefined => {
    const vessel = target()
    if (!vessel || vessel.exploded) say(log.no_vessel)
    return vessel && !vessel.exploded ? vessel : undefined
  }

  const shoot = (): boolean => {
    if (!needRoom() || !room || !host) return false
    const vessel = withVessel()
    if (!vessel) return false
    if (host.tool().weapon !== SHOOTER) room.setTool(SHOOTER)
    room.waitUntilReady()
    const eye = (host.camera as THREE_NS.Camera).position
    const aim = centreOf(vessel)
    room.look([eye.x, eye.y, eye.z], aim)
    say(fillText(log.shoot, { distance: num(dist([eye.x, eye.y, eye.z], aim), 1) }), { phase: 'shoot', objectId: vessel.objectId, weapon: SHOOTER })
    room.use()
    return true
  }

  const valve = (): boolean => {
    if (!needRoom() || !room) return false
    const vessel = withVessel()
    if (!vessel) return false
    if (vessel.valveOpen) {
      if (vessel.explodeAt !== undefined) {
        say(log.valve_closed_late, { phase: 'valve', objectId: vessel.objectId })
        return false
      }
      room.world.seal(vessel.objectId, 'tank')
      vessel.valveOpen = false
      if (throughHoles(vessel) === 0) {
        vessel.leakAt = undefined
        vessel.cause = undefined
        vessel.leaks = []
        vessel.lit = false
      }
      say(fillText(log.valve_closed, { liters: num(liters(vessel), 1) }), { phase: 'valve_closed', objectId: vessel.objectId, liters: liters(vessel) })
      return true
    }
    vessel.valveRequested = true
    const opened = room.world.vent(vessel.objectId, 'tank', { point: valveOf(vessel), normal: [0, 1, 0] })
    vessel.valveRequested = false
    vessel.valveOpen = opened
    return opened
  }

  const light = (): boolean => {
    if (!needRoom() || !room) return false
    const vessel = withVessel()
    if (!vessel) return false
    const at = vessel.leaks[vessel.leaks.length - 1]?.point ?? valveOf(vessel)
    room.vfx.burst('fire', at, [0, 1, 0], 6, 0.8)
    if (!leaking(vessel)) {
      say(log.lighter_none, { phase: 'lighter', objectId: vessel.objectId, leaking: false })
      return false
    }
    ignite(vessel, 'lighter')
    return true
  }

  const fire = (): boolean => {
    if (!needRoom() || !room) return false
    const vessel = withVessel()
    if (!vessel) return false
    const base = vessel.root.getWorldPosition(new (T().Vector3)())
    const point: Vec3 = [base.x + FIRE_OFFSET[0], base.y + FIRE_OFFSET[1], base.z + FIRE_OFFSET[2]]
    const config = def.fire ?? { temperature: 700, radius: 1.4, seconds: 7 }
    vessel.firePoint = point
    vessel.fireUntil = now() + config.seconds + 3
    vessel.nextHeatLog = now()
    vessel.fireHandle = room.vfx.fire({ point, radius: FIRE_VISUAL_RADIUS, life: config.seconds + 3 })
    // the table next to it catches too
    for (const spawned of room.spawned()) {
      if (spawned.itemId !== 'camp_table') continue
      const top = (spawned.root as THREE_NS.Object3D).getWorldPosition(new (T().Vector3)())
      room.world.hit(spawned.objectId, { type: 'heat', point: [top.x, top.y + 0.7, top.z], temperature: config.temperature + 200, radius: 0.9, duration: 3, source: 'p13_fire' })
    }
    say(fillText(log.fire_set, { temperature: num(config.temperature, 0), radius: num(config.radius, 1) }), { phase: 'fire', objectId: vessel.objectId, temperatureC: config.temperature, radius: config.radius })
    return true
  }

  const reset = (): boolean => {
    if (!needRoom() || !room) return false
    room.openArea(EXPLOSIVES_AREA_ID)
    say(fillText(log.reset, { scale: num(strength, 2) }), { phase: 'reset', scale: strength })
    return true
  }

  // ------------------------------------------------------------------------------------------------------------------------------------
  // Bench declaration
  // ------------------------------------------------------------------------------------------------------------------------------------
  const actionIds = ['shoot', 'valve', 'light', 'fire', 'reset'] as const
  const actions = { shoot, valve, light, fire, reset }

  const sheet = (): BenchSheet => {
    const energy = (def.energy * strength) / 1000
    return {
      kicker: text.sheet.kicker,
      title: text.sheet.title,
      body: text.sheet.body,
      facts: [
        { label: text.sheet.facts.energy, value: `${num(energy, 0)} kJ (x${num(strength, 2)})` },
        { label: text.sheet.facts.lethal, value: `${num(def.lethalRadius * strength, 1)} m` },
        { label: text.sheet.facts.injury, value: `${num(def.injuryRadius * strength, 1)} m` },
        { label: text.sheet.facts.gas, value: `${num(leakConfig?.liters ?? 0, 0)} l` },
        { label: text.sheet.facts.mass, value: `${num(def.mass ?? 0, 0)} kg` },
        { label: text.sheet.facts.torch, value: `${num(igniteDelay, 1)} s` },
        { label: text.sheet.facts.shot_chain, value: `${num(typeof def.chain?.shot === 'number' ? def.chain.shot : (def.chain?.shot?.[0] ?? 0), 1)} s` },
        { label: text.sheet.facts.fire_chain, value: `${num(chainFire, 1)} s` },
      ],
      steps: text.sheet.steps,
      note: text.sheet.note,
      timeline: {
        segments: [
          { name: text.sheet.segments.jet, start: 0, end: igniteDelay, color: '#e8eef2' },
          { name: text.sheet.segments.torch, start: igniteDelay, end: chainFire, color: '#ff9a2e' },
          { name: text.sheet.segments.blast, start: chainFire, end: chainFire + 1, color: '#ff4d2e' },
        ],
        ticks: [0, igniteDelay, chainFire],
        metric: 'clock',
      },
    }
  }

  const adopt = (data: unknown): void => {
    const spawned = data as { objectId: string; itemId: string; root: THREE_NS.Object3D }
    if (spawned.itemId !== `${WORLD_EXPLOSIVE_PREFIX}${def.id}`) return
    const vessel: Vessel = { objectId: spawned.objectId, root: spawned.root, scale: strength, leaks: [], valveRequested: false, valveOpen: false, lit: false, exploded: false, nextHeatLog: 0, torchFrame: 0 }
    vessels.set(vessel.objectId, vessel)
    if (wallParts.size === 0) for (const part of room?.world.state(WALL_ID)?.parts ?? []) wallParts.add(part.id)
    if (inArea && host) drawRings(vessel)
  }

  const change = (change: BenchChange): void => {
    if (change.kind === 'action') {
      if ((actionIds as readonly string[]).includes(change.id)) actions[change.id as (typeof actionIds)[number]]()
    } else if (change.kind === 'layer' && change.id === 'rings') {
      ringsOn = change.on
      for (const vessel of vessels.values()) if (vessel.rings) vessel.rings.visible = ringsOn
    } else if (change.kind === 'control' && change.id === 'blast_scale' && typeof change.value === 'number') {
      // the first change is the host's echo of the declared default
      const first = initial
      initial = false
      if (change.value === strength && !first) return
      strength = change.value
      host?.bench?.sheet?.(sheet())
      if (first) return
      say(fillText(log.scale, { scale: num(strength, 2), energy: num((def.energy * strength) / 1000, 0), lethal: num(def.lethalRadius * strength, 1), injury: num(def.injuryRadius * strength, 1) }), { phase: 'scale', scale: strength })
      if (inArea) reset()
    }
  }

  return {
    room,
    def,
    blastScale: () => strength,
    areaOpened: () => {
      inArea = true
    },
    controls: (): ModuleControl[] => [
      ...actionIds.map((id) => ({ kind: 'action' as const, id, name: text.actions[id].name, hint: text.actions[id].hint })),
      { kind: 'number', id: 'blast_scale', name: text.blastScale.name, hint: text.blastScale.hint, unit: 'x', min: 0.25, max: 3, step: 0.05, default: options.blastScale },
    ],
    layers: (): ModuleLayer[] => [{ id: 'rings', name: text.layers.rings }],
    metrics: (): ModuleMetric[] => [
      { id: 'gas', name: text.metrics.gas, unit: 'l', digits: 1, max: leakConfig?.liters ?? 24, read: () => liters(target() ?? ({ objectId: '' } as Vessel)) },
      { id: 'clock', name: text.metrics.clock, unit: 's', digits: 2, read: () => { const v = target(); return v?.leakAt === undefined ? 0 : (v.explodedAt ?? now()) - v.leakAt } },
      { id: 'phase', name: text.metrics.phase, read: () => text.phases[phaseOf(target())] },
    ],
    attach(lent: ModuleHost): () => void {
      host = lent
      const offs: Array<() => void> = []
      if (room) {
        offs.push(room.world.on('*', onEvent))
        offs.push(room.on('spawn', adopt))
        for (const spawned of room.spawned()) adopt(spawned)
      }
      offs.push(
        lent.on((event) => {
          if (event.type === 'explosion') lastBlast = { point: event.point, energy: event.energy, radius: event.radius, cause: event.cause, ...(event.explosive === undefined ? {} : { explosive: event.explosive }) }
        }),
      )
      offs.push(lent.onFrame(frame))
      offs.push(lent.bench?.onChange(change) ?? (() => undefined))
      offs.push(
        lent.onClear?.(() => {
          for (const vessel of vessels.values()) clearRings(vessel)
          vessels.clear()
          clearShells()
          wallParts.clear()
          aftermathDue = []
          lastBlast = undefined
          inArea = false
        }) ?? (() => undefined),
      )
      lent.bench?.sheet?.(sheet())
      return () => {
        for (const off of offs) off()
        for (const vessel of vessels.values()) clearRings(vessel)
        vessels.clear()
        clearShells()
        host = null
      }
    },
    actions,
    vessel: (): VesselView | undefined => {
      const v = target()
      if (!v) return undefined
      return { objectId: v.objectId, leakAt: v.leakAt, litAt: v.litAt, explodedAt: v.explodedAt, cause: v.cause, valveOpen: v.valveOpen, lit: v.lit, exploded: v.exploded, point: v.leaks[v.leaks.length - 1]?.point }
    },
    lastBlast: () => lastBlast,
    witnesses,
  }
}
