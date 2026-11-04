/**
 * The openings of a built vehicle worked by hand: each door, the hood and the trunk lid swing on the hinges the vehicle destructible draws (their open
 * pose is the one of its `open_*` clips, so the door takes its skin, glass and trim with it), each side window slides down into its door, a sunroof
 * slides back when the model has one, the wiper blades sweep, and the central locking keeps the doors and the lid shut. It moves only what the kit
 * drew and puts every part back on `dispose`.
 */
import type { AnimationClipSpec } from '@adatechnology/game-contracts'

import type { BuiltVehicle } from './build'

type Vec = { x: number; y: number; z: number; copy(v: Vec): Vec; clone(): Vec; sub(v: Vec): Vec; add(v: Vec): Vec; applyQuaternion(q: Quat): Vec }
type Quat = { copy(q: Quat): Quat; clone(): Quat; setFromAxisAngle(axis: Vec, angle: number): Quat; multiply(q: Quat): Quat }
/** What the body needs of three.js: vectors and quaternions to turn a wiper about its spindle. */
export type BodyThree = { Vector3: new (x?: number, y?: number, z?: number) => Vec; Quaternion: new () => Quat }
type Obj = { name: string; parent: Obj | null; position: Vec; quaternion: Quat; rotation: { x: number; y: number; z: number; set(x: number, y: number, z: number): void }; userData: Record<string, unknown>; visible: boolean; traverse(fn: (o: Obj) => void): void; getObjectByName(name: string): Obj | undefined }
type Pane = Obj & { geometry?: { boundingBox: { min: { y: number }; max: { y: number } } | null; computeBoundingBox(): void } }

/** A side window by where it sits: `front_left`, `rear_right`... */
export type WindowId = `${'front' | 'rear'}_${'left' | 'right'}`

export type BodyEvent = { type: 'sound'; key: string; part: string } | { type: 'refused'; part: string; reason: 'locked' | 'missing' }

export interface VehicleBodyOptions {
  THREE: BodyThree
  /** The open and close clips of the vehicle destructible (`animations()`): the open pose of each door, the hood and the lid. */
  clips: readonly AnimationClipSpec[]
  /** Seconds a door, the hood or the lid takes to open. Default 1.2 (the clips'). */
  swingSeconds?: number
  /** Seconds a window takes from shut to open. Default 3.5. */
  windowSeconds?: number
  /** Share of the pane's height that goes into the door. Default 0.92 (the top edge stays in the seal). */
  windowTravel?: number
}

export interface VehicleBody {
  /** Part ids the body can open: `door_front_left`..., `hood`, `lid`. */
  readonly parts: readonly string[]
  readonly windows: readonly WindowId[]
  readonly hasSunroof: boolean
  readonly wipers: number
  readonly locked: boolean
  /** 0 shut to 1 open. */
  openness(part: string): number
  /** Opens a shut part or shuts an open one. Locked doors and lid refuse. */
  toggle(part: string): BodyEvent[]
  /** Window opening, 0 shut to 1 down. */
  window(id: WindowId): number
  toggleWindow(id: WindowId): void
  setWindow(id: WindowId, open: number): void
  toggleSunroof(): void
  /** Locks or unlocks the doors and the lid (the key or the remote). */
  lock(locked: boolean): BodyEvent[]
  /** Advances the moving parts; `wipe` is the wipers' sweeps per second (0 parked). */
  update(dt: number, wipe?: number): BodyEvent[]
  dispose(): void
}

/** The kit's own sounds (`VEHICLE_SOUND_BANK`): the latch opening any of them, and each one's slam shut. */
const OPEN_SOUND = 'car_door_open'
const SHUT_SOUND: Record<string, string> = { door: 'car_door_close', hood: 'car_hood_close', lid: 'car_trunk_close' }
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))

export function createVehicleBody(built: BuiltVehicle, options: VehicleBodyOptions): VehicleBody {
  const swing = options.swingSeconds ?? 1.2
  const windowSeconds = options.windowSeconds ?? 3.5
  const travel = options.windowTravel ?? 0.92
  const root = (built.context as { vehicle?: Obj } | null)?.vehicle ?? (built.group as Obj)
  // the open pose of each part, from the clips
  const poses = new Map<string, [number, number, number]>()
  for (const clip of options.clips) {
    if (!clip.id.startsWith('open_')) continue
    const last = clip.keys[clip.keys.length - 1]
    for (const [id, pose] of Object.entries(last?.parts ?? {})) if (pose.rotation) poses.set(id, pose.rotation as [number, number, number])
  }
  const hinges = new Map<string, { pivot: Obj; open: [number, number, number]; now: number; target: number }>()
  for (const [id, open] of poses) {
    const pivot = root.getObjectByName(id)
    if (pivot) hinges.set(id, { pivot, open, now: 0, target: 0 })
  }
  const kind = (part: string): string => (part.startsWith('door') ? 'door' : part === 'hood' ? 'hood' : 'lid')
  // side windows: the kit's panes keyed window_front / window_rear, side by the sign of z (left negative)
  const panes = new Map<WindowId, { pane: Pane; drop: number; now: number; target: number; applied: number }>()
  for (const glass of ((built.context as { glass?: Pane[] } | null)?.glass ?? [])) {
    const g = glass.userData.glass as { key?: string; side?: number } | undefined
    if (!g || (g.key !== 'window_front' && g.key !== 'window_rear')) continue
    const id = `${g.key === 'window_front' ? 'front' : 'rear'}_${(g.side ?? 1) < 0 ? 'left' : 'right'}` as WindowId
    if (panes.has(id) || !glass.geometry) continue
    glass.geometry.computeBoundingBox()
    const box = glass.geometry.boundingBox
    if (box) panes.set(id, { pane: glass, drop: (box.max.y - box.min.y) * travel, now: 0, target: 0, applied: 0 })
  }
  const sunroofs: Array<{ obj: Obj; slide: number; base: number }> = []
  // a wiper piece turns about its spindle on the windshield's normal; parked it is back exactly where the builder drew it
  const wipers: Array<{ obj: Obj; arm: number; sweep: number; spindle: Vec; axis: Vec; rest: Vec; restQ: Quat }> = []
  const T = options.THREE
  const turn = new T.Quaternion()
  root.traverse((o) => {
    const sun = o.userData.sunroof as { slide: number } | undefined
    if (sun) sunroofs.push({ obj: o, slide: sun.slide, base: o.position.x })
  })
  for (const { part, tag } of ((built.context as { wipers?: Array<{ part: Obj; tag: { arm: number; sweep: number; spindle: readonly number[]; axis: readonly number[] } }> } | null)?.wipers ?? []))
    wipers.push({ obj: part, arm: tag.arm, sweep: tag.sweep, spindle: new T.Vector3(...tag.spindle), axis: new T.Vector3(...tag.axis), rest: part.position.clone(), restQ: part.quaternion.clone() })
  let sunNow = 0
  let sunTarget = 0
  let wipePhase = 0
  let locked = false
  const placeWiper = (w: (typeof wipers)[number], angle: number): void => {
    if (angle === 0) {
      w.obj.position.copy(w.rest)
      w.obj.quaternion.copy(w.restQ)
      return
    }
    turn.setFromAxisAngle(w.axis, angle)
    w.obj.position.copy(w.rest).sub(w.spindle).applyQuaternion(turn).add(w.spindle)
    w.obj.quaternion.copy(turn).multiply(w.restQ)
  }
  const ease = (now: number, target: number, seconds: number, dt: number): number => now + clamp(target - now, -dt / seconds, dt / seconds)

  return {
    parts: [...hinges.keys()],
    windows: [...panes.keys()],
    hasSunroof: sunroofs.length > 0,
    wipers: new Set(wipers.map((w) => w.arm)).size,
    get locked() {
      return locked
    },
    openness: (part) => hinges.get(part)?.now ?? 0,
    toggle(part) {
      const h = hinges.get(part)
      if (!h) return [{ type: 'refused', part, reason: 'missing' }]
      if (locked && kind(part) !== 'hood' && h.target === 0) return [{ type: 'refused', part, reason: 'locked' }]
      h.target = h.target > 0 ? 0 : 1
      return h.target > 0 ? [{ type: 'sound', key: OPEN_SOUND, part }] : []
    },
    window: (id) => panes.get(id)?.now ?? 0,
    toggleWindow(id) {
      const w = panes.get(id)
      if (w) w.target = w.target > 0.5 ? 0 : 1
    },
    setWindow(id, open) {
      const w = panes.get(id)
      if (w) w.target = clamp(open, 0, 1)
    },
    toggleSunroof() {
      sunTarget = sunTarget > 0.5 ? 0 : 1
    },
    lock(on) {
      locked = on
      return [{ type: 'sound', key: 'blinker_tick', part: 'doors' }]
    },
    update(dt, wipe = 0) {
      const events: BodyEvent[] = []
      for (const [id, h] of hinges) {
        if (h.now === h.target) continue
        h.now = ease(h.now, h.target, swing, dt)
        h.pivot.rotation.set(h.open[0] * h.now, h.open[1] * h.now, h.open[2] * h.now)
        if (h.now === 0) events.push({ type: 'sound', key: SHUT_SOUND[kind(id)] ?? 'car_door_close', part: id })
      }
      // a window moves in its parent's frame: it may be the body or, once the door has swung, the door's hinge (both keep y up)
      for (const w of panes.values()) {
        if (w.now === w.target) continue
        w.now = ease(w.now, w.target, windowSeconds, dt)
        const offset = -w.drop * w.now
        w.pane.position.y += offset - w.applied
        w.applied = offset
      }
      if (sunNow !== sunTarget) {
        sunNow = ease(sunNow, sunTarget, 2.5, dt)
        for (const s of sunroofs) s.obj.position.x = s.base - s.slide * sunNow
      }
      // the blades sweep out and back; parked they come down to rest
      wipePhase = wipe > 0 ? (wipePhase + dt * wipe) % 1 : wipePhase > 0 ? Math.min(1, wipePhase + dt * 1.5) % 1 : 0
      const sweep = Math.sin(Math.PI * wipePhase)
      for (const w of wipers) placeWiper(w, w.sweep * sweep)
      return events
    },
    dispose() {
      for (const h of hinges.values()) h.pivot.rotation.set(0, 0, 0)
      for (const w of panes.values()) w.pane.position.y -= w.applied
      for (const s of sunroofs) s.obj.position.x = s.base
      for (const w of wipers) placeWiper(w, 0)
    },
  }
}
