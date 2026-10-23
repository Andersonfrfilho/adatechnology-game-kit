import { fitsSlot, generateLoot } from './loot'
import { format, resolveStrings } from './locale'
import { clamp, dist3, localToWorld, rotateAxis, rotY, worldToLocal } from './math'
import type {
  ActiveEmitter,
  BurnerSpec,
  DeviceSpec,
  FixtureSpec,
  FuelSourceSpec,
  Interactable,
  InteractionSpec,
  ItemStack,
  ObjectSpec,
  PartSpec,
  SeatResult,
  SoftSpec,
  TankSpec,
  Transform,
  Vec3,
  World,
  WorldEvent,
  WorldObject,
  WorldOptions,
  WorldState,
} from './types'

// ---------------------------------------------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------------------------------------------

const DEFAULT_ACTOR = 'player'
const DEFAULT_RADIUS = 1.2
const AUTO_RANGE = 2
const SMOKE_TAIL = 20
const FLUSH_SECONDS = 2
const ACTOR_HEIGHT = 1.7
const PUSH_GAIN = 1.2
const SWEEP_STEPS = 24
const FLOW_DEFAULTS: Record<string, number> = { tap: 6, shower: 8, utility_sink: 6, flush: 0, hose: 10, filter: 1 }

// ---------------------------------------------------------------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------------------------------------------------------------

interface PartState {
  spec: PartSpec
  t: number
  target: number
  maxT: number
}

interface DeviceState {
  spec: DeviceSpec
  on: boolean
  channel: number
}

interface FuelState {
  spec: FuelSourceSpec
  level: number
}

interface BurnerState {
  spec: BurnerSpec
  on: boolean
  lit: boolean
  /** Seconds of smoke left after a solid-fuel fire went out. */
  smoke: number
}

interface TankState {
  spec: TankSpec
  level: number
}

interface FixtureState {
  spec: FixtureSpec
  on: boolean
  flowing: boolean
  /** Delivered / wanted in the last step, 0..1. */
  frac: number
  /** Seconds left of a flush. */
  timer: number
}

interface SoftState {
  spec: SoftSpec
  ax: number
  az: number
  vax: number
  vaz: number
  phase: number
}

interface DamageState {
  max: number
  hp: number
}

interface ObjState {
  id: string
  public: WorldObject
  spec: ObjectSpec
  parts: Map<string, PartState>
  contents: Map<string, Array<ItemStack | null>>
  devices: Map<string, DeviceState>
  fuels: Map<string, FuelState>
  burners: Map<string, BurnerState>
  tanks: Map<string, TankState>
  fixtures: Map<string, FixtureState>
  soft: Map<string, SoftState>
  hp: Map<string, DamageState>
  interactions: InteractionSpec[]
}

function cloneStack(s: ItemStack | null): ItemStack | null {
  return s ? { type: s.type, qty: s.qty, ...(s.data ? { data: JSON.parse(JSON.stringify(s.data)) as Record<string, unknown> } : {}) } : null
}

function humanize(id: string): string {
  const s = id.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------------------------------------------

export function createWorld(options: WorldOptions = {}): World {
  const seed = options.seed ?? 1
  const objs = new Map<string, ObjState>()
  const breakers = new Map<string, boolean>()
  const seats = new Map<string, { object: string; seat: string }>()
  const plugs = new Map<string, string | null>()
  let locale = options.locale ?? 'en'
  let table = resolveStrings(locale, options.strings)
  let grid = options.grid ?? true
  let rain = options.rain ?? 0
  let wind: [number, number] = options.wind ? [options.wind[0], options.wind[1]] : [0, 0]
  let defaultTank: string | null = null
  let defaultTankExplicit = false
  let time = 0

  // ------------------------------------------------------------------ text & events
  function t(key: string, vars?: Record<string, string | number>): string {
    return format(table[key] ?? key, vars)
  }

  function emit(e: WorldEvent): void {
    options.onEvent?.(e)
  }

  function message(key: string): void {
    emit({ type: 'message', key, text: t(key) })
  }

  // ------------------------------------------------------------------ lookup helpers
  function gid(o: ObjState, local: string): string {
    return `${o.id}:${local}`
  }

  /** Find the first entity matching a world-wide id `objectId:localId`. */
  function findGlobal<T>(id: string, pick: (o: ObjState, local: string) => T | undefined): { o: ObjState; value: T; local: string } | null {
    for (const o of objs.values()) {
      if (!id.startsWith(o.id + ':')) continue
      const local = id.slice(o.id.length + 1)
      const value = pick(o, local)
      if (value !== undefined) return { o, value, local }
    }
    return null
  }

  function objectOrThrow(id: string): ObjState {
    const o = objs.get(id)
    if (!o) throw new Error(`Unknown object "${id}"`)
    return o
  }

  function originOf(o: ObjState): Vec3 {
    const tr = o.public.transform
    return [tr.x, tr.y, tr.z]
  }

  function toWorld(o: ObjState, v: Vec3): Vec3 {
    return localToWorld(o.public.transform, v)
  }

  // ------------------------------------------------------------------ parts
  function openThreshold(p: PartState): number {
    return Math.min(0.5, p.maxT * 0.9)
  }

  function isOpen(o: ObjState, partId: string | undefined): boolean {
    if (!partId) return true
    const p = o.parts.get(partId)
    if (!p) return true
    return p.maxT >= 0.1 && p.t >= openThreshold(p)
  }

  function targetIsOpen(p: PartState): boolean {
    return p.maxT >= 0.1 && p.target >= openThreshold(p)
  }

  function writeT(o: ObjState, p: PartState, v: number): void {
    p.t = v
    o.public.parts[p.spec.id] = v
  }

  function gated(o: ObjState, p: PartState): boolean {
    return !!p.spec.requires && o.parts.has(p.spec.requires) && !isOpen(o, p.spec.requires)
  }

  function setOnePart(o: ObjState, p: PartState, target: number, instant: boolean): void {
    const next = clamp(target, 0, p.maxT)
    const changed = next !== p.target
    p.target = next
    if (instant) writeT(o, p, next)
    if (changed || instant) emit({ type: 'part', object: o.id, part: p.spec.id, t: p.t, target: p.target })
  }

  function setPartTarget(o: ObjState, partId: string, target: number, instant = false): void {
    const p = o.parts.get(partId)
    if (!p) return
    const group = p.spec.group
    const members = group ? [...o.parts.values()].filter((q) => q.spec.group === group) : [p]
    for (const q of members) {
      setOne(o, q, target, instant)
    }
  }

  function setOne(o: ObjState, p: PartState, target: number, instant: boolean): void {
    setOnePart(o, p, target, instant)
    // a part that other parts require closes them with it (the drawer behind a door closes with the door)
    if (!targetIsOpen(p)) {
      for (const q of o.parts.values()) {
        if (q.spec.requires === p.spec.id && q.target > 0) setPartTarget(o, q.spec.id, 0, instant)
      }
    }
  }

  /** Frame of a part right now: rotation (axis in object-local, angle) and translation, both about its pivot. */
  function partFrame(o: ObjState, partId: string | undefined): { pivot: Vec3; axis: Vec3; angle: number; offset: Vec3 } | null {
    if (!partId) return null
    const p = o.parts.get(partId)
    if (!p) return null
    const m = p.spec.motion
    const axis = rotY(m.axis ?? [0, 1, 0], p.spec.ry ?? 0)
    const frame = { pivot: p.spec.pivot, axis, angle: 0, offset: [0, 0, 0] as Vec3 }
    if (m.kind === 'slide') {
      const d = (m.distance ?? 0.4) * p.t
      frame.offset = [axis[0] * d, axis[1] * d, axis[2] * d]
    } else if (m.kind !== 'scale') {
      frame.angle = (m.angle ?? Math.PI / 2) * p.t
    }
    return frame
  }

  function applyPart(o: ObjState, partId: string | undefined, local: Vec3): Vec3 {
    const f = partFrame(o, partId)
    if (!f) return local
    const rel: Vec3 = [local[0] - f.pivot[0], local[1] - f.pivot[1], local[2] - f.pivot[2]]
    const r = f.angle !== 0 ? rotateAxis(rel, f.axis, f.angle) : rel
    return [f.pivot[0] + r[0] + f.offset[0], f.pivot[1] + r[1] + f.offset[1], f.pivot[2] + r[2] + f.offset[2]]
  }

  /** Moves the full closed-pose slab of a part and returns the largest t whose pose keeps every sampled point clear. */
  function fitBounds(o: ObjState, p: PartState, b: NonNullable<PartSpec['bounds']>, blockedAt: (x: number, z: number) => boolean): number {
    const STEP = 0.05
    const ANGLES = 48
    const m = p.spec.motion
    const axis = rotY(m.axis ?? [0, 1, 0], p.spec.ry ?? 0)
    const lo: Vec3 = [Math.min(b[0], b[3]), Math.min(b[1], b[4]), Math.min(b[2], b[5])]
    const hi: Vec3 = [Math.max(b[0], b[3]), Math.max(b[1], b[4]), Math.max(b[2], b[5])]
    const axisPoints = (i: number): number[] => {
      const n = Math.max(1, Math.ceil((hi[i] - lo[i]) / STEP))
      return Array.from({ length: n + 1 }, (_, k) => lo[i] + ((hi[i] - lo[i]) * k) / n)
    }
    const xs = axisPoints(0)
    const ys = axisPoints(1)
    const zs = axisPoints(2)
    // `blocked` only sees x/z, so only the floor footprint matters. About a vertical axis (and for slides) y never changes
    // the footprint, so the x/z outline is enough; otherwise the footprint boundary is the projection of the box edges.
    const flat = m.kind === 'slide' || Math.abs(axis[1]) > 0.999
    const seen = new Set<string>()
    const pts: Vec3[] = []
    const add = (x: number, y: number, z: number): void => {
      const key = `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`
      if (seen.has(key)) return
      seen.add(key)
      pts.push([x, y, z])
    }
    if (flat) {
      for (const x of xs) for (const z of [lo[2], hi[2]]) add(x, lo[1], z)
      for (const z of zs) for (const x of [lo[0], hi[0]]) add(x, lo[1], z)
    } else {
      for (const x of xs) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) add(x, y, z)
      for (const y of ys) for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) add(x, y, z)
      for (const z of zs) for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) add(x, y, z)
    }
    const tr = o.public.transform
    const pivot = p.spec.pivot
    for (let i = 1; i <= ANGLES; i++) {
      const tt = i / ANGLES
      const angle = m.kind === 'slide' ? 0 : (m.angle ?? Math.PI / 2) * tt
      const d = m.kind === 'slide' ? (m.distance ?? 0.4) * tt : 0
      for (const [x, y, z] of pts) {
        let q: Vec3 = [x, y, z]
        if (angle !== 0) {
          const r = rotateAxis([x - pivot[0], y - pivot[1], z - pivot[2]], axis, angle)
          q = [pivot[0] + r[0], pivot[1] + r[1], pivot[2] + r[2]]
        }
        const w = localToWorld(tr, [q[0] + axis[0] * d, 0, q[2] + axis[2] * d])
        if (blockedAt(w[0], w[2])) return (i - 1) / ANGLES
      }
    }
    return 1
  }

  function fitSweep(objectId: string, partId: string, blocked: (x: number, z: number) => boolean): number {
    const o = objectOrThrow(objectId)
    const p = o.parts.get(partId)
    if (!p) throw new Error(`Unknown part "${partId}" on "${objectId}"`)
    const sweep = p.spec.sweep
    let result = 1
    const bounds = p.spec.bounds
    const mk = p.spec.motion.kind
    if (bounds && (mk === 'hinge' || mk === 'rocker' || mk === 'knob' || mk === 'slide')) {
      result = fitBounds(o, p, bounds, blocked)
    } else if (sweep) {
      const x0 = Math.min(sweep[0], sweep[2])
      const x1 = Math.max(sweep[0], sweep[2])
      const z0 = Math.min(sweep[1], sweep[3])
      const z1 = Math.max(sweep[1], sweep[3])
      const tr = o.public.transform
      const hit = (lx: number, lz: number): boolean => {
        const w = localToWorld(tr, [lx, 0, lz])
        return blocked(w[0], w[2])
      }
      const m = p.spec.motion
      const axis = rotY(m.axis ?? [0, 1, 0], p.spec.ry ?? 0)
      if (m.kind === 'hinge' || m.kind === 'rocker' || m.kind === 'knob') {
        if (Math.abs(axis[1]) >= 0.5) {
          const angle = m.angle ?? Math.PI / 2
          const total = -angle * Math.sign(axis[1])
          const [px, , pz] = p.spec.pivot
          const cx = (x0 + x1) / 2
          const cz = (z0 + z1) / 2
          const w = x1 - x0
          const d = z1 - z0
          const radius = Math.abs(angle) > 1.7 ? Math.min(w, d) : Math.max(w, d)
          const tol = 0.05
          const inRect = (x: number, z: number) => x >= x0 - tol && x <= x1 + tol && z >= z0 - tol && z <= z1 + tol
          const centered = Math.hypot(cx - px, cz - pz) < 1e-6
          const mid = Math.atan2(cz - pz, cx - px)
          for (let i = 1; i <= SWEEP_STEPS && result === 1; i++) {
            const tt = i / SWEEP_STEPS
            let isHit = false
            if (centered) {
              for (let x = x0; x <= x1 + 1e-9 && !isHit; x += 0.1) for (let z = z0; z <= z1 + 1e-9 && !isHit; z += 0.1) isHit = hit(x, z)
            } else {
              const phi = mid - total / 2 + total * tt
              const steps = Math.max(2, Math.ceil(radius / 0.1))
              for (let k = 1; k <= steps && !isHit; k++) {
                const r = (radius * k) / steps
                const x = px + Math.cos(phi) * r
                const z = pz + Math.sin(phi) * r
                if (inRect(x, z)) isHit = hit(x, z)
              }
            }
            if (isHit) result = (i - 1) / SWEEP_STEPS
          }
        }
      } else if (m.kind === 'slide') {
        const len = Math.hypot(axis[0], axis[2])
        if (len > 1e-6) {
          const dx = axis[0] / len
          const dz = axis[2] / len
          const proj = [x0 * dx + z0 * dz, x1 * dx + z0 * dz, x0 * dx + z1 * dz, x1 * dx + z1 * dz]
          const pmin = Math.min(...proj)
          const pmax = Math.max(...proj)
          const nx = Math.max(1, Math.ceil((x1 - x0) / 0.1))
          const nz = Math.max(1, Math.ceil((z1 - z0) / 0.1))
          for (let i = 1; i <= SWEEP_STEPS && result === 1; i++) {
            const limit = pmin + (pmax - pmin) * (i / SWEEP_STEPS)
            let isHit = false
            for (let a = 0; a <= nx && !isHit; a++) {
              for (let b = 0; b <= nz && !isHit; b++) {
                const x = x0 + ((x1 - x0) * a) / nx
                const z = z0 + ((z1 - z0) * b) / nz
                if (x * dx + z * dz <= limit + 1e-9 && hit(x, z)) isHit = true
              }
            }
            if (isHit) result = (i - 1) / SWEEP_STEPS
          }
        }
      }
    }
    p.maxT = result
    if (p.target > result) p.target = result
    if (p.t > result) writeT(o, p, result)
    return result
  }

  // ------------------------------------------------------------------ containers
  function containerOf(o: ObjState, id: string) {
    return o.spec.containers?.find((c) => c.id === id)
  }

  function accessible(objectId: string, containerId: string): boolean {
    const o = objs.get(objectId)
    if (!o) return false
    const c = containerOf(o, containerId)
    if (!c) return false
    return isOpen(o, c.access)
  }

  function contents(objectId: string, containerId: string): Array<ItemStack | null> {
    return (objs.get(objectId)?.contents.get(containerId) ?? []).map(cloneStack)
  }

  function take(objectId: string, containerId: string, slot: number, actor: string = DEFAULT_ACTOR): ItemStack | null {
    const o = objs.get(objectId)
    if (!o) return null
    const list = o.contents.get(containerId)
    if (!list || !accessible(objectId, containerId)) return null
    const stack = list[slot]
    if (!stack) return null
    const def = options.items?.[stack.type]
    if (def && def.pickable === false) return null
    list[slot] = null
    emit({ type: 'pickup', object: objectId, container: containerId, slot, stack: cloneStack(stack) as ItemStack, actor })
    return stack
  }

  function put(objectId: string, containerId: string, stack: ItemStack): number | null {
    const o = objs.get(objectId)
    if (!o) return null
    const c = containerOf(o, containerId)
    const list = o.contents.get(containerId)
    if (!c || !list || !accessible(objectId, containerId)) return null
    const maxStack = options.items?.[stack.type]?.stack ?? 1
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]
      if (cur && cur.type === stack.type && !cur.data && !stack.data && cur.qty + stack.qty <= maxStack) {
        cur.qty += stack.qty
        return i
      }
    }
    for (let i = 0; i < list.length; i++) {
      if (!list[i] && fitsSlot(stack.type, c.slots[i], options.items)) {
        list[i] = cloneStack(stack)
        return i
      }
    }
    message('full')
    return null
  }

  function slotPosition(objectId: string, containerId: string, slot: number): Vec3 {
    const o = objectOrThrow(objectId)
    const c = containerOf(o, containerId)
    const s = c?.slots[slot]
    if (!c || !s) throw new Error(`Unknown slot ${slot} of "${containerId}" on "${objectId}"`)
    return toWorld(o, applyPart(o, s.part, s.pos))
  }

  // ------------------------------------------------------------------ power
  function rebuildPlugs(): void {
    plugs.clear()
    const sockets: Array<{ id: string; pos: Vec3; circuit?: string; local: string }> = []
    for (const o of objs.values()) {
      for (const s of o.spec.sockets ?? []) sockets.push({ id: gid(o, s.id), local: s.id, pos: toWorld(o, s.pos), circuit: s.circuit })
    }
    const used = new Set<string>()
    const autos: Array<{ o: ObjState; d: DeviceState }> = []
    for (const o of objs.values()) {
      for (const d of o.devices.values()) {
        const key = gid(o, d.spec.id)
        const want = d.spec.socket
        if (want === undefined || d.spec.circuit) {
          plugs.set(key, null)
        } else if (want === 'auto') {
          plugs.set(key, null)
          autos.push({ o, d })
        } else {
          const s = sockets.find((x) => x.id === want) ?? sockets.find((x) => x.id === gid(o, want)) ?? sockets.find((x) => x.local === want)
          plugs.set(key, s ? s.id : null)
          if (s) used.add(s.id)
        }
      }
    }
    for (const { o, d } of autos) {
      const from = d.spec.plug ? toWorld(o, d.spec.plug) : originOf(o)
      let best: (typeof sockets)[number] | null = null
      let bestD = AUTO_RANGE
      for (const s of sockets) {
        if (used.has(s.id)) continue
        const dd = dist3(from, s.pos)
        if (dd <= bestD) {
          best = s
          bestD = dd
        }
      }
      if (best) {
        used.add(best.id)
        plugs.set(gid(o, d.spec.id), best.id)
      }
    }
  }

  function breaker(circuit: string): boolean {
    return breakers.get(circuit) ?? true
  }

  function devicePowered(o: ObjState, d: DeviceState): boolean {
    if (d.spec.electric === false) return true
    if (!grid) return false
    if (d.spec.circuit) return breaker(d.spec.circuit)
    if (d.spec.socket === undefined) return false
    const sid = plugs.get(gid(o, d.spec.id))
    if (!sid) return false
    const found = findGlobal(sid, (oo, local) => oo.spec.sockets?.find((s) => s.id === local))
    if (!found) return false
    return found.value.circuit ? breaker(found.value.circuit) : true
  }

  function getDevice(objectId: string, deviceId: string): { o: ObjState; d: DeviceState } | null {
    const o = objs.get(objectId)
    const d = o?.devices.get(deviceId)
    return o && d ? { o, d } : null
  }

  function powerSnapshot(): Map<string, boolean> {
    const m = new Map<string, boolean>()
    for (const o of objs.values()) for (const d of o.devices.values()) m.set(gid(o, d.spec.id), d.on && devicePowered(o, d))
    return m
  }

  function emitPowerChanges(before: Map<string, boolean>): void {
    for (const o of objs.values()) {
      for (const d of o.devices.values()) {
        const key = gid(o, d.spec.id)
        const now = d.on && devicePowered(o, d)
        if (before.get(key) !== now && d.on) emit({ type: 'device', object: o.id, device: d.spec.id, on: d.on, powered: devicePowered(o, d), channel: d.spec.kind === 'screen' ? d.channel : undefined })
      }
    }
  }

  function setDeviceOn(o: ObjState, d: DeviceState, on: boolean): void {
    d.on = on
    if (d.spec.part) setPartTarget(o, d.spec.part, on ? 1 : 0)
    const powered = devicePowered(o, d)
    emit({ type: 'device', object: o.id, device: d.spec.id, on, powered, channel: d.spec.kind === 'screen' ? d.channel : undefined })
    if (on && !powered) message('no_power')
  }

  function resolveDevice(o: ObjState, id: string): { o: ObjState; d: DeviceState } | null {
    if (id.includes(':')) {
      const f = findGlobal(id, (oo, local) => oo.devices.get(local))
      return f ? { o: f.o, d: f.value } : null
    }
    const local = o.devices.get(id)
    if (local) return { o, d: local }
    for (const oo of objs.values()) {
      const d = oo.devices.get(id)
      if (d) return { o: oo, d }
    }
    return null
  }

  function switchIsOn(o: ObjState, spec: { part?: string; controls: string[] }): boolean {
    if (spec.part && o.parts.has(spec.part)) return targetIsOpen(o.parts.get(spec.part) as PartState)
    return spec.controls.some((id) => resolveDevice(o, id)?.d.on)
  }

  function toggleSwitch(o: ObjState, id: string): boolean {
    const sw = o.spec.switches?.find((s) => s.id === id)
    if (!sw) return false
    const on = !switchIsOn(o, sw)
    if (sw.part) setPartTarget(o, sw.part, on ? 1 : 0)
    let unpowered = false
    for (const ref of sw.controls) {
      const r = resolveDevice(o, ref)
      if (!r) continue
      r.d.on = on
      if (r.d.spec.part) setPartTarget(r.o, r.d.spec.part, on ? 1 : 0)
      const powered = devicePowered(r.o, r.d)
      if (on && !powered) unpowered = true
      emit({ type: 'device', object: r.o.id, device: r.d.spec.id, on, powered })
    }
    emit({ type: 'switch', object: o.id, switch: sw.id, on })
    if (unpowered) message('no_power')
    return true
  }

  // ------------------------------------------------------------------ fuel
  function resolveFuel(o: ObjState, b: BurnerState): { o: ObjState; f: FuelState } | null {
    const want = b.spec.fuel
    if (want === 'auto') {
      const from = toWorld(o, b.spec.pos)
      let best: { o: ObjState; f: FuelState } | null = null
      let bestD = AUTO_RANGE
      for (const oo of objs.values()) {
        for (const f of oo.fuels.values()) {
          if (f.spec.kind !== 'gas') continue
          const d = dist3(from, originOf(oo))
          if (d <= bestD) {
            best = { o: oo, f }
            bestD = d
          }
        }
      }
      return best
    }
    if (want.includes(':')) {
      const f = findGlobal(want, (oo, local) => oo.fuels.get(local))
      return f ? { o: f.o, f: f.value } : null
    }
    const local = o.fuels.get(want)
    return local ? { o, f: local } : null
  }

  function valveOpen(o: ObjState, f: FuelState): boolean {
    const v = f.spec.valve
    if (!v || !o.parts.has(v)) return true
    return targetIsOpen(o.parts.get(v) as PartState)
  }

  function canBurn(b: BurnerState, ref: { o: ObjState; f: FuelState } | null): boolean {
    return !!ref && ref.f.level > 0 && valveOpen(ref.o, ref.f)
  }

  function isSolid(ref: { f: FuelState } | null): boolean {
    return !!ref && ref.f.spec.kind !== 'gas'
  }

  function emitBurner(o: ObjState, b: BurnerState): void {
    emit({ type: 'burner', object: o.id, burner: b.spec.id, on: b.on, lit: b.lit })
  }

  function extinguish(o: ObjState, b: BurnerState, turnOff: boolean): void {
    const ref = resolveFuel(o, b)
    const wasLit = b.lit
    b.lit = false
    if (turnOff) b.on = false
    if (b.spec.part) setPartTarget(o, b.spec.part, b.on ? 1 : 0)
    if (wasLit && isSolid(ref)) b.smoke = SMOKE_TAIL
    emitBurner(o, b)
  }

  function toggleBurner(o: ObjState, id: string): boolean {
    const b = o.burners.get(id)
    if (!b) return false
    if (b.on || b.lit) {
      extinguish(o, b, true)
      return true
    }
    if (b.spec.needsIgnition) return false
    const ref = resolveFuel(o, b)
    b.on = true
    b.lit = canBurn(b, ref)
    if (b.lit) b.smoke = 0
    if (b.spec.part) setPartTarget(o, b.spec.part, 1)
    emitBurner(o, b)
    if (!b.lit) message(ref && ref.f.level <= 0 ? 'empty' : 'no_gas')
    return true
  }

  function ignite(o: ObjState, id: string): boolean {
    const b = o.burners.get(id)
    if (!b || b.lit) return false
    const ref = resolveFuel(o, b)
    if (!canBurn(b, ref)) {
      message(ref && ref.f.level <= 0 ? 'empty' : 'no_gas')
      return false
    }
    b.on = true
    b.lit = true
    b.smoke = 0
    if (b.spec.part) setPartTarget(o, b.spec.part, 1)
    emitBurner(o, b)
    return true
  }

  function toggleFuel(o: ObjState, id: string): boolean {
    const f = o.fuels.get(id)
    if (!f || !f.spec.valve || !o.parts.has(f.spec.valve)) return false
    const p = o.parts.get(f.spec.valve) as PartState
    setPartTarget(o, f.spec.valve, targetIsOpen(p) ? 0 : 1)
    return true
  }

  // ------------------------------------------------------------------ water
  function resolveTank(o: ObjState, id: string | undefined): { o: ObjState; t: TankState } | null {
    const want = id === undefined || id === 'auto' ? defaultTank : id
    if (!want) return null
    const f = findGlobal(want, (oo, local) => oo.tanks.get(local))
    if (f) return { o: f.o, t: f.value }
    const local = o.tanks.get(want)
    return local ? { o, t: local } : null
  }

  function drawWater(o: ObjState, fx: FixtureState, liters: number): number {
    if (liters <= 0) return 0
    if (options.waterSupply) return Math.max(0, Math.min(liters, options.waterSupply.draw(gid(o, fx.spec.id), liters)))
    const tank = resolveTank(o, fx.spec.tank)
    if (!tank) return 0
    const got = Math.min(liters, tank.t.level)
    tank.t.level -= got
    return got
  }

  function emitFixture(o: ObjState, fx: FixtureState): void {
    emit({ type: 'fixture', object: o.id, fixture: fx.spec.id, on: fx.on, flowing: fx.flowing })
  }

  function flowOf(fx: FixtureState): number {
    return fx.spec.flow ?? FLOW_DEFAULTS[fx.spec.kind] ?? 6
  }

  function stepFixture(o: ObjState, fx: FixtureState, dt: number): void {
    if (!fx.on) return
    if (fx.spec.kind === 'flush') {
      fx.timer -= dt
      if (fx.timer <= 0) {
        fx.on = false
        fx.flowing = false
        fx.frac = 0
        if (fx.spec.part) setPartTarget(o, fx.spec.part, 0)
        emitFixture(o, fx)
      }
      return
    }
    if (dt <= 0) return
    const wanted = (flowOf(fx) / 60) * dt
    const got = drawWater(o, fx, wanted)
    const flowing = got > 1e-9
    fx.frac = wanted > 0 ? Math.min(1, got / wanted) : 0
    if (flowing !== fx.flowing) {
      fx.flowing = flowing
      emitFixture(o, fx)
    }
  }

  function toggleFixture(o: ObjState, id: string): boolean {
    const fx = o.fixtures.get(id)
    if (!fx) return false
    if (fx.on) {
      fx.on = false
      fx.flowing = false
      fx.frac = 0
      if (fx.spec.part) setPartTarget(o, fx.spec.part, 0)
      emitFixture(o, fx)
      return true
    }
    fx.on = true
    if (fx.spec.part) setPartTarget(o, fx.spec.part, 1)
    if (fx.spec.kind === 'flush') {
      const volume = fx.spec.volume ?? 6
      const got = drawWater(o, fx, volume)
      fx.flowing = got > 1e-9
      fx.frac = fx.flowing ? 1 : 0
      fx.timer = FLUSH_SECONDS
      if (!fx.flowing) {
        fx.on = false
        if (fx.spec.part) setPartTarget(o, fx.spec.part, 0)
      }
    } else {
      fx.flowing = false
      fx.frac = 0
      stepFixture(o, fx, 1 / 60)
    }
    emitFixture(o, fx)
    if (!fx.flowing) message('no_water')
    return true
  }

  // ------------------------------------------------------------------ seats
  function seatTaken(objectId: string, seatId: string): string | null {
    for (const [actor, s] of seats) if (s.object === objectId && s.seat === seatId) return actor
    return null
  }

  function stand(actor: string = DEFAULT_ACTOR): Vec3 | null {
    const s = seats.get(actor)
    if (!s) return null
    seats.delete(actor)
    const o = objs.get(s.object)
    const spec = o?.spec.seats?.find((x) => x.id === s.seat)
    emit({ type: 'seat', object: s.object, seat: s.seat, actor, seated: false })
    if (!o || !spec) return null
    return toWorld(o, spec.exit)
  }

  function sit(objectId: string, seatId: string, actor: string = DEFAULT_ACTOR): SeatResult | null {
    const o = objs.get(objectId)
    const seat = o?.spec.seats?.find((s) => s.id === seatId)
    if (!o || !seat) return null
    const holder = seatTaken(objectId, seatId)
    if (holder && holder !== actor) return null
    if (seats.has(actor) && !holder) stand(actor)
    seats.set(actor, { object: objectId, seat: seatId })
    const eye = seat.eye ?? (seat.pose === 'lie' ? 0.18 : 0.62)
    emit({ type: 'seat', object: objectId, seat: seatId, actor, seated: true })
    return { eye: toWorld(o, [seat.pos[0], seat.pos[1] + eye, seat.pos[2]]), yaw: o.public.transform.ry + seat.ry + Math.PI, pose: seat.pose }
  }

  // ------------------------------------------------------------------ soft volumes
  function push(pos: Vec3, radius: number, vel: Vec3): void {
    for (const o of objs.values()) {
      if (!o.soft.size) continue
      const tr = o.public.transform
      const lp = worldToLocal(tr, pos)
      const lv = rotY(vel, -tr.ry)
      for (const s of o.soft.values()) {
        const [w, h, d] = s.spec.size
        const hx = w / 2
        const hz = Math.max(d, 0.1) / 2
        const dx = Math.max(Math.abs(lp[0] - s.spec.anchor[0]) - hx, 0)
        const dz = Math.max(Math.abs(lp[2] - s.spec.anchor[2]) - hz, 0)
        if (Math.hypot(dx, dz) > radius) continue
        const top = tr.y + s.spec.anchor[1]
        if (pos[1] + ACTOR_HEIGHT < top - h || pos[1] > top) continue
        const cap = 8
        s.vax = clamp(s.vax - lv[2] * PUSH_GAIN, -cap, cap)
        s.vaz = clamp(s.vaz + lv[0] * PUSH_GAIN, -cap, cap)
        if (s.spec.kind === 'panel' && s.spec.part && lv[2] < -0.05 && lp[2] > s.spec.anchor[2]) setPartTarget(o, s.spec.part, 1)
      }
    }
  }

  function stepSoft(dt: number): void {
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / sub
    for (const o of objs.values()) {
      if (!o.soft.size) continue
      const wl = rotY([wind[0], 0, wind[1]], -o.public.transform.ry)
      for (const s of o.soft.values()) {
        const k = s.spec.stiffness ?? 30
        const c = s.spec.damping ?? 4
        const max = s.spec.maxAngle ?? 0.7
        const gain = s.spec.wind ?? (s.spec.kind === 'panel' ? 0 : 1)
        const gust = gain * (0.6 + 0.4 * Math.sin(time * 1.7 + s.phase)) * 0.1
        const fx = -wl[2] * gust
        const fz = wl[0] * gust
        for (let i = 0; i < sub; i++) {
          s.vax += (-k * s.ax - c * s.vax + fx) * h
          s.vaz += (-k * s.az - c * s.vaz + fz) * h
          s.ax += s.vax * h
          s.az += s.vaz * h
        }
        if (Math.abs(s.ax) > max) {
          s.ax = Math.sign(s.ax) * max
          s.vax = 0
        }
        if (Math.abs(s.az) > max) {
          s.az = Math.sign(s.az) * max
          s.vaz = 0
        }
      }
    }
  }

  // ------------------------------------------------------------------ damage
  function damage(objectId: string, target: string, amount: number, _kind?: string): { hp: number; destroyed: boolean } | null {
    const o = objs.get(objectId)
    if (o && options.destruction) {
      const pos = toWorld(o, [0, 0.5, 0])
      const type = _kind === 'gas' ? 'explosive' : _kind === 'fabric' ? 'slash' : 'blunt'
      const result = options.destruction.hitPart(objectId, target, { type, point: pos, energy: Math.max(0, amount), source: 'interactables' }) as { events?: Array<{ type?: string; part?: string }> } | null | undefined
      const destroyed = !!result?.events?.some((e) => e.type === 'fracture' && e.part === target)
      emit({ type: 'damage', object: objectId, target, hp: -1, destroyed })
      return { hp: -1, destroyed }
    }
    const st = o?.hp.get(target)
    if (!o || !st) return null
    if (st.hp <= 0) return { hp: 0, destroyed: true }
    const before = st.hp
    st.hp = Math.max(0, st.hp - Math.max(0, amount))
    const destroyed = st.hp <= 0
    emit({ type: 'damage', object: objectId, target, hp: st.hp, destroyed })
    const pos = toWorld(o, [0, 0.5, 0])
    const fuel = o.fuels.get(target)
    if (fuel && destroyed && fuel.spec.kind === 'gas' && fuel.level > 0) {
      emit({ type: 'explosion', object: objectId, pos, radius: 2 + fuel.level / 5 })
      fuel.level = 0
    }
    const tank = o.tanks.get(target)
    if (tank && before === st.max && st.hp < before) emit({ type: 'leak', object: objectId, target, pos })
    return { hp: st.hp, destroyed }
  }

  // ------------------------------------------------------------------ interactions
  function deriveInteractions(spec: ObjectSpec): InteractionSpec[] {
    const out: InteractionSpec[] = []
    const used = new Set<string>()
    const partPos = (id: string | undefined, fallback: Vec3): Vec3 => spec.parts?.find((p) => p.id === id)?.pivot ?? fallback
    const partLabel = (id: string | undefined): string => spec.parts?.find((p) => p.id === id)?.label ?? ''
    const claim = (id: string | undefined) => {
      if (id) used.add(id)
    }
    for (const d of spec.devices ?? []) {
      claim(d.part)
      const pos = d.part ? partPos(d.part, [0, 1, 0]) : (d.plug ?? [0, 1, 0])
      out.push({ id: `device.${d.id}`, pos, action: { do: 'toggle_device', device: d.id }, label: partLabel(d.part) })
      if (d.kind === 'screen' && (d.channels ?? 1) > 1) out.push({ id: `channel.${d.id}`, pos, action: { do: 'cycle_device', device: d.id }, label: '' })
    }
    for (const s of spec.switches ?? []) {
      claim(s.part)
      out.push({ id: `switch.${s.id}`, pos: partPos(s.part, [0, 1.2, 0]), action: { do: 'toggle_switch', switch: s.id }, label: partLabel(s.part) })
    }
    const driven = new Set((spec.devices ?? []).map((d) => d.fixture))
    for (const f of spec.fixtures ?? []) {
      claim(f.part)
      if (driven.has(f.id)) continue
      out.push({ id: `fixture.${f.id}`, pos: f.part ? partPos(f.part, f.outlet) : f.outlet, action: { do: 'toggle_fixture', fixture: f.id }, label: partLabel(f.part) })
    }
    for (const b of spec.burners ?? []) {
      claim(b.part)
      const pos = b.part ? partPos(b.part, b.pos) : b.pos
      if (b.needsIgnition) out.push({ id: `ignite.${b.id}`, pos, action: { do: 'ignite', burner: b.id }, label: '' })
      out.push({ id: `burner.${b.id}`, pos, action: { do: 'toggle_burner', burner: b.id }, label: partLabel(b.part) })
    }
    for (const f of spec.fuels ?? []) {
      if (!f.valve) continue
      claim(f.valve)
      out.push({ id: `fuel.${f.id}`, pos: partPos(f.valve, [0, 0.5, 0]), action: { do: 'toggle_fuel', fuel: f.id }, label: partLabel(f.valve) })
    }
    for (const c of spec.containers ?? []) {
      if (!c.access) out.push({ id: `open.${c.id}`, pos: c.volume.center, action: { do: 'open_container', container: c.id }, label: '' })
    }
    for (const p of spec.parts ?? []) {
      if (used.has(p.id)) continue
      if (p.label) out.push({ id: `part.${p.id}`, pos: p.pivot, action: { do: 'toggle_part', part: p.id }, label: p.label })
    }
    for (const c of spec.containers ?? []) {
      if (c.access && !spec.parts?.find((p) => p.id === c.access)?.label) {
        out.push({ id: `open.${c.id}`, pos: partPos(c.access, c.volume.center), action: { do: 'open_container', container: c.id }, label: '' })
      }
    }
    for (const s of spec.seats ?? []) out.push({ id: `seat.${s.id}`, pos: s.pos, action: { do: 'sit', seat: s.id }, label: '' })
    return out
  }

  function typeName(o: ObjState): string {
    return table[`type.${o.spec.type}`] ?? humanize(o.spec.type)
  }

  function labelOf(o: ObjState, i: InteractionSpec): string {
    const a = i.action
    let state: string | null = null
    let def = ''
    switch (a.do) {
      case 'toggle_part': {
        const p = o.parts.get(a.part)
        const open = !!p && targetIsOpen(p)
        state = open ? 'open' : 'closed'
        def = open ? 'prompt.close' : 'prompt.open'
        break
      }
      case 'open_container': {
        const c = containerOf(o, a.container)
        const p = c?.access ? o.parts.get(c.access) : undefined
        const open = p ? targetIsOpen(p) : false
        state = p ? (open ? 'open' : 'closed') : null
        def = open ? 'prompt.close' : 'prompt.open'
        break
      }
      case 'toggle_device': {
        const on = !!o.devices.get(a.device)?.on
        state = on ? 'on' : 'off'
        def = on ? 'prompt.turn_off' : 'prompt.turn_on'
        break
      }
      case 'toggle_switch': {
        const sw = o.spec.switches?.find((s) => s.id === a.switch)
        const on = !!sw && switchIsOn(o, sw)
        state = on ? 'on' : 'off'
        def = on ? 'prompt.turn_off' : 'prompt.turn_on'
        break
      }
      case 'toggle_breaker': {
        const on = breaker(a.circuit)
        state = on ? 'on' : 'off'
        def = on ? 'prompt.breaker_off' : 'prompt.breaker_on'
        break
      }
      case 'toggle_fixture': {
        const on = !!o.fixtures.get(a.fixture)?.on
        state = on ? 'on' : 'off'
        def = on ? 'prompt.turn_off' : 'prompt.turn_on'
        break
      }
      case 'toggle_burner': {
        const b = o.burners.get(a.burner)
        const on = !!b && (b.on || b.lit)
        state = on ? 'on' : 'off'
        def = on ? 'prompt.turn_off' : 'prompt.turn_on'
        break
      }
      case 'toggle_fuel': {
        const f = o.fuels.get(a.fuel)
        const open = !!f && valveOpen(o, f)
        state = open ? 'open' : 'closed'
        def = open ? 'prompt.close_valve' : 'prompt.open_valve'
        break
      }
      case 'take':
        def = 'prompt.take'
        break
      case 'read':
        def = 'prompt.read'
        break
      case 'ignite':
        def = 'prompt.light'
        break
      case 'cycle_device':
        def = 'prompt.change_channel'
        break
      case 'sit': {
        const seat = o.spec.seats?.find((s) => s.id === a.seat)
        const mine = seats.get(DEFAULT_ACTOR)
        def = mine && mine.object === o.id && mine.seat === a.seat ? 'prompt.get_up' : seat?.pose === 'lie' ? 'prompt.lie_down' : 'prompt.sit'
        break
      }
    }
    let key = def
    if (i.label) {
      if (state && table[`${i.label}.${state}`] !== undefined) key = `${i.label}.${state}`
      else if (table[i.label] !== undefined) key = i.label
    }
    return t(key, { name: typeName(o), circuit: a.do === 'toggle_breaker' ? (a.name ?? a.circuit) : '' })
  }

  function requirementMet(i: InteractionSpec): boolean {
    if (!i.requires) return true
    const p = objs.get(i.requires.object)?.parts.get(i.requires.part)
    return !!p && targetIsOpen(p)
  }

  function applicable(o: ObjState, i: InteractionSpec): boolean {
    const a = i.action
    if (!requirementMet(i)) return false
    if (a.do === 'toggle_breaker' && a.part) {
      const rocker = o.parts.get(a.part)
      if (rocker && gated(o, rocker)) return false
    }
    if (a.do === 'take' || a.do === 'read') return accessible(o.id, a.container)
    if (a.do === 'ignite') return !o.burners.get(a.burner)?.lit
    if (a.do === 'toggle_burner') {
      const b = o.burners.get(a.burner)
      return !b?.spec.needsIgnition || !!b.lit
    }
    return true
  }

  function interactablesOf(o: ObjState): Array<{ item: Interactable; spec: InteractionSpec; o: ObjState }> {
    return o.interactions.map((i) => {
      const id = gid(o, i.id)
      const item: Interactable = {
        id,
        object: o.id,
        kind: i.action.do,
        pos: toWorld(o, i.pos),
        radius: i.radius ?? DEFAULT_RADIUS,
        label: labelOf(o, i),
        act: (actor) => act(id, actor),
      }
      return { item, spec: i, o }
    })
  }

  function interactables(): Interactable[] {
    const out: Interactable[] = []
    for (const o of objs.values()) for (const e of interactablesOf(o)) out.push(e.item)
    return out
  }

  function target(
    eye: { x: number; y: number; z: number; yaw: number; pitch: number },
    opts: { reach?: number; cone?: number } = {},
  ): Interactable | null {
    const reach = opts.reach ?? 1.8
    const cone = opts.cone ?? 0.45
    const dir: Vec3 = [-Math.sin(eye.yaw) * Math.cos(eye.pitch), Math.sin(eye.pitch), -Math.cos(eye.yaw) * Math.cos(eye.pitch)]
    let best: Interactable | null = null
    let bestScore = Infinity
    for (const o of objs.values()) {
      for (const e of interactablesOf(o)) {
        if (!applicable(o, e.spec)) continue
        const v: Vec3 = [e.item.pos[0] - eye.x, e.item.pos[1] - eye.y, e.item.pos[2] - eye.z]
        const d = Math.hypot(v[0], v[1], v[2])
        if (d > reach) continue
        const cos = d < 1e-6 ? 1 : clamp((v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]) / d, -1, 1)
        const angle = Math.acos(cos)
        if (angle > cone) continue
        const score = (angle / cone) * 0.6 + (d / reach) * 0.4
        if (score < bestScore) {
          bestScore = score
          best = e.item
        }
      }
    }
    return best
  }

  function act(interactableId: string, actor: string = DEFAULT_ACTOR): boolean {
    let found: { item: Interactable; spec: InteractionSpec; o: ObjState } | null = null
    for (const o of objs.values()) {
      if (!interactableId.startsWith(o.id + ':')) continue
      const local = interactableId.slice(o.id.length + 1)
      if (!o.interactions.some((i) => i.id === local)) continue
      found = interactablesOf(o).find((e) => e.spec.id === local) ?? null
      if (found) break
    }
    if (!found) return false
    if (!requirementMet(found.spec)) return false
    if (options.canInteract?.(found.item, actor) === false) return false
    return execute(found.o, found.spec.action, actor)
  }

  function execute(o: ObjState, a: InteractionSpec['action'], actor: string): boolean {
    switch (a.do) {
      case 'toggle_part': {
        const p = o.parts.get(a.part)
        if (!p || gated(o, p)) return false
        setPartTarget(o, a.part, targetIsOpen(p) ? 0 : 1)
        return true
      }
      case 'open_container': {
        const c = containerOf(o, a.container)
        if (!c) return false
        if (c.access) return execute(o, { do: 'toggle_part', part: c.access }, actor)
        emit({ type: 'container', object: o.id, container: c.id, open: true })
        return true
      }
      case 'take': {
        if (!accessible(o.id, a.container)) return false
        const list = o.contents.get(a.container)
        if (!list) return false
        const slot = a.slot ?? list.findIndex((s) => s !== null)
        if (slot < 0 || !list[slot]) {
          message('empty')
          return false
        }
        return take(o.id, a.container, slot, actor) !== null
      }
      case 'read': {
        if (!accessible(o.id, a.container)) return false
        const stack = o.contents.get(a.container)?.[a.slot]
        if (!stack) {
          message('empty')
          return false
        }
        const key = typeof stack.data?.text === 'string' ? stack.data.text : null
        if (!key) return false
        message(key)
        return true
      }
      case 'toggle_device': {
        const d = o.devices.get(a.device)
        if (!d) return false
        setDeviceOn(o, d, !d.on)
        return true
      }
      case 'cycle_device': {
        const d = o.devices.get(a.device)
        if (!d || !d.on) return false
        if (!devicePowered(o, d)) {
          message('no_power')
          return false
        }
        d.channel = (d.channel + 1) % Math.max(1, d.spec.channels ?? 1)
        emit({ type: 'device', object: o.id, device: d.spec.id, on: true, powered: true, channel: d.channel })
        return true
      }
      case 'toggle_switch':
        return toggleSwitch(o, a.switch)
      case 'toggle_breaker': {
        const rocker = a.part ? o.parts.get(a.part) : undefined
        if (rocker && gated(o, rocker)) return false
        const on = !breaker(a.circuit)
        if (a.part) setPartTarget(o, a.part, on ? 1 : 0)
        world.power.setBreaker(a.circuit, on)
        return true
      }
      case 'toggle_fixture':
        return toggleFixture(o, a.fixture)
      case 'toggle_burner':
        return toggleBurner(o, a.burner)
      case 'ignite':
        return ignite(o, a.burner)
      case 'toggle_fuel':
        return toggleFuel(o, a.fuel)
      case 'sit': {
        const mine = seats.get(actor)
        if (mine && mine.object === o.id && mine.seat === a.seat) {
          stand(actor)
          return true
        }
        return sit(o.id, a.seat, actor) !== null
      }
    }
  }

  // ------------------------------------------------------------------ emitters, mirrors, colliders
  function emitters(): ActiveEmitter[] {
    const out: ActiveEmitter[] = []
    for (const o of objs.values()) {
      for (const e of o.spec.emitters ?? []) {
        let intensity = 0
        const b = o.burners.get(e.source)
        const fx = o.fixtures.get(e.source)
        const dev = o.devices.get(e.source)
        const fuel = o.fuels.get(e.source)
        if (b) {
          const ref = resolveFuel(o, b)
          const frac = ref ? clamp(ref.f.level / ref.f.spec.capacity, 0, 1) : 0
          if (b.lit) intensity = 0.35 + 0.65 * frac
          else if (e.kind === 'smoke' && b.smoke > 0) intensity = 0.6 * (b.smoke / SMOKE_TAIL)
        } else if (fx) {
          if (fx.on && fx.flowing) intensity = fx.frac
        } else if (dev) {
          if (dev.on && devicePowered(o, dev)) intensity = 1
        } else if (fuel) {
          const lit = [...o.burners.values()].some((bb) => bb.lit && resolveFuel(o, bb)?.f === fuel)
          if (lit) intensity = 0.35 + 0.65 * clamp(fuel.level / fuel.spec.capacity, 0, 1)
        }
        if (intensity <= 0) continue
        const dir = rotY(e.dir ?? [0, 1, 0], o.public.transform.ry)
        out.push({ id: gid(o, e.id), object: o.id, kind: e.kind, pos: toWorld(o, e.pos), dir, size: e.size ?? 0.3, ...(e.reach !== undefined ? { reach: e.reach } : {}), intensity: clamp(intensity, 0, 1) })
      }
    }
    return out
  }

  function mirrors(eye: Vec3, maxDistance = 10, count = 4) {
    const out: Array<{ id: string; center: Vec3; normal: Vec3; w: number; h: number; distance: number }> = []
    for (const o of objs.values()) {
      for (const m of o.spec.mirrors ?? []) {
        const center = toWorld(o, applyPart(o, m.part, m.center))
        const f = partFrame(o, m.part)
        const ln = f && f.angle !== 0 ? rotateAxis(m.normal, f.axis, f.angle) : m.normal
        const normal = rotY(ln, o.public.transform.ry)
        const len = Math.hypot(normal[0], normal[1], normal[2]) || 1
        const n: Vec3 = [normal[0] / len, normal[1] / len, normal[2] / len]
        const to: Vec3 = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]
        if (n[0] * to[0] + n[1] * to[1] + n[2] * to[2] <= 0) continue
        const distance = Math.hypot(to[0], to[1], to[2])
        if (distance > maxDistance) continue
        out.push({ id: gid(o, m.id), center, normal: n, w: m.w, h: m.h, distance })
      }
    }
    return out.sort((a, b) => a.distance - b.distance).slice(0, count)
  }

  function colliders() {
    const out: ReturnType<World['colliders']> = []
    for (const o of objs.values()) {
      const tr = o.public.transform
      for (const c of o.spec.colliders ?? []) {
        if (c.part && c.offWhenOpen && (o.parts.get(c.part)?.t ?? 0) > 0.5) continue
        let extra = 0
        if (c.part) {
          const f = partFrame(o, c.part)
          if (f && f.angle !== 0 && Math.abs(f.axis[1]) >= 0.5) extra = f.angle * Math.sign(f.axis[1])
        }
        const center = toWorld(o, applyPart(o, c.part, c.center))
        out.push({
          id: gid(o, c.id),
          object: o.id,
          cx: center[0],
          cz: center[2],
          hw: c.half[0],
          hd: c.half[2],
          ry: tr.ry + (c.ry ?? 0) + extra,
          y0: center[1] - c.half[1],
          y1: center[1] + c.half[1],
        })
      }
    }
    return out
  }

  // ------------------------------------------------------------------ update
  function update(dt: number): void {
    if (!(dt > 0)) return
    time += dt
    for (const o of objs.values()) {
      for (const p of o.parts.values()) {
        if (p.t === p.target) continue
        if (gated(o, p) && p.target > p.t) continue // a gated part may still close
        const step = (p.spec.motion.speed ?? 2.5) * dt
        const next = p.t < p.target ? Math.min(p.target, p.t + step) : Math.max(p.target, p.t - step)
        writeT(o, p, next)
        if (next === p.target) emit({ type: 'part', object: o.id, part: p.spec.id, t: next, target: p.target })
      }
    }
    stepSoft(dt)
    for (const o of objs.values()) {
      for (const b of o.burners.values()) {
        if (b.lit) {
          const ref = resolveFuel(o, b)
          if (!ref || !valveOpen(ref.o, ref.f)) {
            extinguish(o, b, !!b.spec.needsIgnition)
          } else {
            ref.f.level = Math.max(0, ref.f.level - b.spec.rate * dt)
            if (ref.f.level <= 0) extinguish(o, b, !!b.spec.needsIgnition)
          }
        } else if (b.on && !b.spec.needsIgnition && canBurn(b, resolveFuel(o, b))) {
          // a gas knob left open without gas lights as soon as the bottle valve opens
          b.lit = true
          b.smoke = 0
          emitBurner(o, b)
        } else if (b.smoke > 0) {
          b.smoke = Math.max(0, b.smoke - dt)
        }
      }
      if (rain > 0) {
        for (const tk of o.tanks.values()) {
          if (tk.spec.rainArea) tk.level = Math.min(tk.spec.capacity, tk.level + ((rain * tk.spec.rainArea) / 3600) * dt)
        }
      }
      for (const tk of o.tanks.values()) {
        const st = o.hp.get(tk.spec.id)
        if (st && st.hp < st.max && tk.level > 0) {
          const rate = 0.5 + 2.5 * (1 - st.hp / st.max)
          tk.level = Math.max(0, tk.level - rate * dt)
        }
      }
    }
    for (const o of objs.values()) {
      for (const d of o.devices.values()) {
        const fx = d.spec.fixture ? o.fixtures.get(d.spec.fixture) : undefined
        if (!fx) continue
        const run = d.on && devicePowered(o, d)
        if (fx.on === run) continue
        fx.on = run
        if (!run) {
          fx.flowing = false
          fx.frac = 0
          emitFixture(o, fx)
        }
      }
      for (const fx of o.fixtures.values()) stepFixture(o, fx, dt)
    }
  }

  // ------------------------------------------------------------------ add / remove
  function add(id: string, spec: ObjectSpec, transform: Transform): WorldObject {
    if (objs.has(id)) throw new Error(`Object "${id}" already exists`)
    const pub: WorldObject = { id, spec, transform: { ...transform }, parts: {} }
    const o: ObjState = {
      id,
      public: pub,
      spec,
      parts: new Map(),
      contents: new Map(),
      devices: new Map(),
      fuels: new Map(),
      burners: new Map(),
      tanks: new Map(),
      fixtures: new Map(),
      soft: new Map(),
      hp: new Map(),
      interactions: spec.interactions ?? deriveInteractions(spec),
    }
    for (const p of spec.parts ?? []) {
      const t0 = clamp(p.t0 ?? 0, 0, 1)
      o.parts.set(p.id, { spec: p, t: t0, target: t0, maxT: 1 })
      pub.parts[p.id] = t0
    }
    for (const c of spec.containers ?? []) {
      let list: Array<ItemStack | null>
      if (c.contents) list = c.slots.map((_, i) => cloneStack(c.contents?.[i] ?? null))
      else if (c.loot) list = generateLoot(options.loot, c.loot, c.slots, `${seed}|${id}|${c.id}`, options.items)
      else list = c.slots.map(() => null)
      o.contents.set(c.id, list)
    }
    for (const d of spec.devices ?? []) {
      o.devices.set(d.id, { spec: d, on: !!d.on, channel: 0 })
      if (d.on && d.part) {
        const p = o.parts.get(d.part)
        if (p) {
          p.target = p.maxT
          writeT(o, p, p.maxT)
        }
      }
    }
    for (const f of spec.fuels ?? []) o.fuels.set(f.id, { spec: f, level: clamp(f.level ?? f.capacity, 0, f.capacity) })
    for (const b of spec.burners ?? []) o.burners.set(b.id, { spec: b, on: false, lit: false, smoke: 0 })
    for (const tk of spec.tanks ?? []) o.tanks.set(tk.id, { spec: tk, level: clamp(tk.level ?? tk.capacity, 0, tk.capacity) })
    for (const f of spec.fixtures ?? []) o.fixtures.set(f.id, { spec: f, on: false, flowing: false, frac: 0, timer: 0 })
    let n = 0
    for (const s of spec.soft ?? []) {
      o.soft.set(s.id, { spec: s, ax: 0, az: 0, vax: 0, vaz: 0, phase: (n++ * 2.399963) % (Math.PI * 2) })
    }
    for (const d of spec.damage ?? []) o.hp.set(d.target, { max: d.hp, hp: d.hp })
    objs.set(id, o)
    if (!defaultTankExplicit && defaultTank === null && o.tanks.size) defaultTank = gid(o, [...o.tanks.keys()][0])
    rebuildPlugs()
    return pub
  }

  function remove(id: string): void {
    const o = objs.get(id)
    if (!o) return
    for (const [actor, s] of [...seats]) if (s.object === id) seats.delete(actor)
    objs.delete(id)
    if (defaultTank && defaultTank.startsWith(id + ':')) defaultTank = null
    rebuildPlugs()
  }

  // ------------------------------------------------------------------ save / load
  function serialize(): WorldState {
    const objects: WorldState['objects'] = {}
    for (const o of objs.values()) {
      objects[o.id] = {
        parts: Object.fromEntries([...o.parts].map(([k, p]) => [k, p.t])),
        contents: Object.fromEntries([...o.contents].map(([k, v]) => [k, v.map(cloneStack)])),
        devices: Object.fromEntries([...o.devices].map(([k, d]) => [k, { on: d.on, channel: d.channel }])),
        fuels: Object.fromEntries([...o.fuels].map(([k, f]) => [k, { level: f.level, open: valveOpen(o, f) }])),
        burners: Object.fromEntries([...o.burners].map(([k, b]) => [k, { on: b.on, lit: b.lit }])),
        tanks: Object.fromEntries([...o.tanks].map(([k, tk]) => [k, tk.level])),
        fixtures: Object.fromEntries([...o.fixtures].map(([k, f]) => [k, f.on])),
        hp: Object.fromEntries([...o.hp].map(([k, h]) => [k, h.hp])),
      }
    }
    return {
      version: 1,
      objects,
      grid,
      breakers: Object.fromEntries(breakers),
      seats: Object.fromEntries([...seats].map(([a, s]) => [a, { object: s.object, seat: s.seat }])),
      defaultTank,
    }
  }

  function load(state: WorldState): void {
    for (const [id, st] of Object.entries(state.objects)) {
      const o = objs.get(id)
      if (!o) continue
      for (const [k, v] of Object.entries(st.parts)) {
        const p = o.parts.get(k)
        if (p) {
          // keep the limit found by fitSweep: a loaded save must not let a door open through a wall again
          p.target = clamp(v, 0, p.maxT)
          writeT(o, p, p.target)
        }
      }
      for (const [k, v] of Object.entries(st.contents)) {
        const c = containerOf(o, k)
        if (c) o.contents.set(k, c.slots.map((_, i) => cloneStack(v[i] ?? null)))
      }
      for (const [k, v] of Object.entries(st.devices)) {
        const d = o.devices.get(k)
        if (d) {
          d.on = v.on
          d.channel = v.channel
        }
      }
      for (const [k, v] of Object.entries(st.fuels)) {
        const f = o.fuels.get(k)
        if (f) f.level = v.level
      }
      for (const [k, v] of Object.entries(st.burners)) {
        const b = o.burners.get(k)
        if (b) {
          b.on = v.on
          b.lit = v.lit
          b.smoke = 0
        }
      }
      for (const [k, v] of Object.entries(st.tanks)) {
        const tk = o.tanks.get(k)
        if (tk) tk.level = v
      }
      for (const [k, v] of Object.entries(st.fixtures)) {
        const f = o.fixtures.get(k)
        if (f) {
          f.on = v
          f.flowing = false
          f.frac = 0
          f.timer = v && f.spec.kind === 'flush' ? FLUSH_SECONDS : 0
        }
      }
      for (const [k, v] of Object.entries(st.hp)) {
        const h = o.hp.get(k)
        if (h) h.hp = v
      }
    }
    grid = state.grid
    breakers.clear()
    for (const [k, v] of Object.entries(state.breakers)) breakers.set(k, v)
    seats.clear()
    for (const [a, s] of Object.entries(state.seats)) if (objs.has(s.object)) seats.set(a, { object: s.object, seat: s.seat })
    defaultTank = state.defaultTank
    defaultTankExplicit = true
  }

  // ------------------------------------------------------------------ public surface
  const world: World = {
    add,
    remove,
    get: (id) => objs.get(id)?.public,
    objects: () => [...objs.values()].map((o) => o.public),
    update,
    interactables,
    target,
    act,
    partT: (objectId, partId) => objs.get(objectId)?.parts.get(partId)?.t ?? 0,
    setPart: (objectId, partId, targetT, instant) => {
      const o = objs.get(objectId)
      if (o) setPartTarget(o, partId, targetT, instant)
    },
    fitSweep,
    contents,
    accessible,
    take,
    put,
    slotPosition,
    power: {
      get grid() {
        return grid
      },
      set grid(on: boolean) {
        world.power.setGrid(on)
      },
      setGrid(on) {
        if (on === grid) return
        const before = powerSnapshot()
        grid = on
        emit({ type: 'power', grid })
        emitPowerChanges(before)
      },
      setBreaker(circuit, on) {
        if (breaker(circuit) === on) {
          breakers.set(circuit, on)
          return
        }
        const before = powerSnapshot()
        breakers.set(circuit, on)
        emitPowerChanges(before)
      },
      breaker,
      isPowered: (objectId, deviceId) => {
        const r = getDevice(objectId, deviceId)
        return r ? devicePowered(r.o, r.d) : false
      },
      isOn: (objectId, deviceId) => getDevice(objectId, deviceId)?.d.on ?? false,
      pluggedInto: (objectId, deviceId) => plugs.get(`${objectId}:${deviceId}`) ?? null,
      channel: (objectId, deviceId) => getDevice(objectId, deviceId)?.d.channel ?? 0,
    },
    fuelLevel: (objectId, fuelId) => objs.get(objectId)?.fuels.get(fuelId)?.level ?? 0,
    isLit: (objectId, burnerId) => objs.get(objectId)?.burners.get(burnerId)?.lit ?? false,
    water: {
      setDefaultTank(tankId) {
        defaultTank = tankId
        defaultTankExplicit = true
      },
      level(tankId) {
        return findGlobal(tankId, (oo, local) => oo.tanks.get(local))?.value.level ?? 0
      },
      refill(tankId, liters) {
        const f = findGlobal(tankId, (oo, local) => oo.tanks.get(local))
        if (!f) return 0
        const added = Math.max(0, Math.min(liters, f.value.spec.capacity - f.value.level))
        f.value.level += added
        return added
      },
      setRain(mm) {
        rain = Math.max(0, mm)
      },
      isFlowing: (objectId, fixtureId) => {
        const fx = objs.get(objectId)?.fixtures.get(fixtureId)
        return !!fx && fx.on && fx.flowing
      },
    },
    sit,
    stand,
    seatOf: (actor = DEFAULT_ACTOR) => {
      const s = seats.get(actor)
      return s ? { object: s.object, seat: s.seat } : null
    },
    push,
    sway: (objectId, softId) => {
      const s = objs.get(objectId)?.soft.get(softId)
      return s ? { ax: s.ax, az: s.az } : { ax: 0, az: 0 }
    },
    setWind: (x, z) => {
      wind = [x, z]
    },
    emitters,
    mirrors,
    colliders,
    damage,
    hp: (objectId, target) => (options.destruction ? null : (objs.get(objectId)?.hp.get(target)?.hp ?? null)),
    t,
    setLocale: (l) => {
      locale = l
      table = resolveStrings(locale, options.strings)
    },
    serialize,
    load,
  }
  return world
}
