/**
 * The lamps of a built vehicle switched on and off: position, low and high beam, fog lamps, the brake and reversing lamps and the cabin light. The glass of
 * each lamp the kit drew (`context.lights`) glows by the switch, its halo shows only when lit, and the beams that light the world are sources of the host's
 * light budget (`game-render-three`), never lights of their own. The beacon lamps of an emergency vehicle (meshes the fleet tags `userData.lamp = 'beacon'`
 * with their `beaconSide`, 0 or 1) flash one side and then the other. Everything it changes is put back by `dispose`.
 */
import { isLightBudget, LIGHT_PRIORITY } from '@adatechnology/game-render-three'
import type { LightBudget, SourceHandle } from '@adatechnology/game-render-three'

import type { Object3D } from 'three'

import type { BuiltVehicle } from './build'

export type LampSwitch = {
  mode: 'off' | 'position' | 'low' | 'high'
  fog: boolean
  interior: boolean
  brake: boolean
  reverse: boolean
  /** Indicator lamps lit this instant (the controls blink them). */
  left: boolean
  right: boolean
  /** The beacon: the side lit this instant (0 or 1), null with it off. Default off. */
  beacon?: 0 | 1 | null
}

/** Glow of the lamp glass by switch, as a share of what the kit drew (the kit draws them lit), and the beams. */
export const LAMP_RULES = {
  glow: { head: { off: 0.04, position: 0.3, low: 1, high: 1.35 }, tail: { off: 0.15, on: 0.7, brake: 1.6 }, fog: { off: 0.04, on: 1.1 }, amber: { off: 0.1, on: 2.2 }, beacon: { off: 0.35, dark: 0.12, lit: 2.8 } },
  low: { color: 0xfff1d0, intensity: 2.4, distance: 32, angle: 0.42, penumbra: 0.55, decay: 1.6, drop: 0.09 },
  high: { color: 0xfff6e2, intensity: 3.6, distance: 70, angle: 0.3, penumbra: 0.45, decay: 1.4, drop: 0.015 },
  fog: { color: 0xfff0c8, intensity: 1.6, distance: 16, angle: 0.75, penumbra: 0.7, decay: 1.8, drop: 0.12 },
  reverse: { color: 0xf4f6ff, intensity: 0.9, distance: 7, decay: 2 },
  interior: { color: 0xffe2b0, intensity: 0.5, distance: 2.4, decay: 2 },
} as const

export interface VehicleLamps {
  /** What this vehicle has: fog lamps only when the kit drew them. */
  readonly has: { head: boolean; tail: boolean; fog: boolean; indicators: boolean; beacon: boolean }
  set(lamps: LampSwitch): void
  readonly state: LampSwitch
  dispose(): void
}

/** A lamp's glass material: the kit's are emissive standard materials (`MATERIALS.head`, `tail`, `led`, `amber`). */
type Glass = { clone(): Glass; dispose?(): void; emissiveIntensity?: number; color?: { r: number; g: number; b: number } }
type Glazed = { material: Glass | Glass[] | null }
type Lamp = { kind: string; fog?: boolean; inner: Glazed[]; halo?: Array<{ visible: boolean; scale: { x: number; y: number; set(x: number, y: number, z: number): void } }>; group?: { position?: { x: number } } }

export function createVehicleLamps(THREE: { Object3D: new () => Object3D }, built: BuiltVehicle, options: { lights?: unknown; owner?: string } = {}): VehicleLamps {
  const budget: LightBudget | null = isLightBudget(options.lights) ? options.lights : null
  const owner = options.owner ?? 'vehicle-lamps'
  // the kit's lamps, a fog lamp drawn as a headlight marked `fog`, and the decorative fog bulbs a body lists in `context.fogBulbs` (or tags `userData.lamp = 'fog'`)
  const context = built.context as { lights?: Array<Lamp & { fog?: boolean }>; fogBulbs?: Glazed[] } | null
  const lamps: Lamp[] = (context?.lights ?? [])
    .filter((l) => l && Array.isArray(l.inner))
    .map((l) => (l.fog ? { ...l, kind: 'fog' } : l))
  const bulbs: Glazed[] = (context?.fogBulbs ?? []).filter((o) => o?.material)
  built.group.traverse((o: Object3D & Partial<Glazed>) => {
    if (o.userData?.lamp === 'fog' && o.material && !bulbs.includes(o as Glazed)) bulbs.push(o as Glazed)
  })
  if (bulbs.length) lamps.push({ kind: 'fog', inner: bulbs })
  const beacons: Array<{ mesh: Glazed; side: 0 | 1 }> = []
  built.group.traverse((o: Object3D & Partial<Glazed>) => {
    if (o.userData?.lamp === 'beacon' && o.material) beacons.push({ mesh: o as Glazed, side: o.userData.beaconSide === 1 ? 1 : 0 })
  })
  const has = { head: lamps.some((l) => l.kind === 'headlight'), tail: lamps.some((l) => l.kind === 'taillight'), fog: lamps.some((l) => l.kind === 'fog'), indicators: false, beacon: beacons.length > 0 }
  // the kit's lamp materials are shared by every vehicle: this one gets its own copies, given back on dispose
  const originals = new Map<Glazed, Glass>()
  const copies = new Map<Glass, Glass>()
  const base = new Map<Glass, number>()
  const own = (mesh: Glazed): Glass | null => {
    const mat = mesh.material
    if (!mat || Array.isArray(mat)) return null
    if (copies.has(mat) || base.has(mat)) return mat
    const copy = mat.clone()
    originals.set(mesh, mat)
    copies.set(copy, mat)
    base.set(copy, mat.emissiveIntensity ?? 1)
    mesh.material = copy
    return copy
  }
  for (const b of beacons) own(b.mesh)
  const haloBase = new Map<object, number>()
  for (const l of lamps) {
    for (const m of l.inner) own(m)
    for (const h of l.halo ?? []) haloBase.set(h, h.scale.x)
  }
  // the amber parts of a lamp (indicators) blink on their own: told by the colour of the kit's amber, and by the side of the lamp (left is +x)
  const amber = new Set<Glazed>()
  const sideOf = new Map<Glazed, 'left' | 'right'>()
  for (const l of lamps) {
    const x = l.group?.position?.x ?? 0
    for (const m of l.inner) {
      const mat = Array.isArray(m.material) ? null : m.material
      const c = (mat && (copies.get(mat) ?? mat))?.color
      if (c && c.r > 0.5 && c.r - c.b > 0.35 && c.g < c.r * 0.8 && c.g > c.b) {
        amber.add(m)
        sideOf.set(m, x >= 0 ? 'left' : 'right')
      }
    }
  }
  has.indicators = amber.size > 0
  const glowMesh = (m: Glazed, share: number): void => {
    const mat = m.material
    if (mat && !Array.isArray(mat) && base.has(mat) && 'emissiveIntensity' in mat) mat.emissiveIntensity = (base.get(mat) as number) * share
  }
  const glow = (l: Lamp, share: number): void => {
    for (const m of l.inner) {
      if (amber.has(m)) continue
      glowMesh(m, share)
    }
    for (const h of l.halo ?? []) {
      h.visible = share > 0.5
      const s = (haloBase.get(h) ?? 1) * Math.min(1.4, share)
      h.scale.set(s, s, 1)
    }
  }

  // anchors on the vehicle for the beams: its front is +z, a spot shines down its anchor's -z
  const L = built.length
  const W = built.width
  const H = built.height
  const anchors: Object3D[] = []
  const anchor = (x: number, y: number, z: number, yaw: number, drop: number): Object3D => {
    const a = new THREE.Object3D()
    a.position.set(x, y, z)
    a.rotation.set(-drop, yaw, 0, 'YXZ')
    built.group.add(a)
    anchors.push(a)
    return a
  }
  const front = [-1, 1].map((s) => anchor(s * W * 0.34, Math.min(0.9, H * 0.48), L / 2 - 0.05, Math.PI, 0))
  const fogAnchors = [-1, 1].map((s) => anchor(s * W * 0.38, Math.min(0.45, H * 0.25), L / 2 - 0.03, Math.PI, 0))
  const rear = anchor(0, Math.min(0.9, H * 0.45), -L / 2 - 0.3, 0, 0)
  const cabin = anchor(0, H * 0.85, 0, 0, 0)

  const sources = new Map<string, SourceHandle[]>()
  const beam = (id: string, on: boolean, make: () => SourceHandle[]): void => {
    const now = sources.get(id)
    if (on && !now && budget) sources.set(id, make())
    if (!on && now) {
      for (const s of now) s.remove()
      sources.delete(id)
    }
  }
  const spots = (at: Object3D[], rule: { color: number; intensity: number; distance: number; angle: number; penumbra: number; decay: number; drop: number }): SourceHandle[] =>
    at.map((a) => {
      a.rotation.x = -rule.drop
      return (budget as LightBudget).addSource({ owner, kind: 'spot', priority: LIGHT_PRIORITY.headlight, color: rule.color, intensity: rule.intensity, distance: rule.distance, decay: rule.decay, angle: rule.angle, penumbra: rule.penumbra, position: [0, 0, 0], follow: a })
    })
  const point = (a: Object3D, rule: { color: number; intensity: number; distance: number; decay: number }): SourceHandle[] => [
    (budget as LightBudget).addSource({ owner, kind: 'point', priority: LIGHT_PRIORITY.lamp, color: rule.color, intensity: rule.intensity, distance: rule.distance, decay: rule.decay, position: [0, 0, 0], follow: a }),
  ]

  const state: LampSwitch = { mode: 'off', fog: false, interior: false, brake: false, reverse: false, left: false, right: false }
  const apply = (): void => {
    const g = LAMP_RULES.glow
    for (const l of lamps) {
      if (l.kind === 'headlight') glow(l, g.head[state.mode])
      else if (l.kind === 'taillight') glow(l, state.brake ? g.tail.brake : state.mode === 'off' ? g.tail.off : g.tail.on)
      else if (l.kind === 'fog') glow(l, state.fog ? g.fog.on : g.fog.off)
    }
    for (const m of amber) glowMesh(m, state[sideOf.get(m) ?? 'left'] ? g.amber.on : g.amber.off)
    const lit = state.beacon ?? null
    for (const b of beacons) glowMesh(b.mesh, lit === null ? g.beacon.off : lit === b.side ? g.beacon.lit : g.beacon.dark)
    // the low and the high beam are the same two spots, re-aimed: switching re-adds them with the other cone
    const beamId = state.mode === 'low' || state.mode === 'high' ? state.mode : null
    for (const id of ['low', 'high'] as const) beam(id, beamId === id, () => spots(front, LAMP_RULES[id]))
    beam('fog', state.fog && has.fog, () => spots(fogAnchors, LAMP_RULES.fog))
    beam('reverse', state.reverse, () => point(rear, LAMP_RULES.reverse))
    beam('interior', state.interior, () => point(cabin, LAMP_RULES.interior))
  }
  apply()

  return {
    has,
    get state() {
      return { ...state }
    },
    set(next) {
      if (next.mode === state.mode && next.fog === state.fog && next.interior === state.interior && next.brake === state.brake && next.reverse === state.reverse && next.left === state.left && next.right === state.right && (next.beacon ?? null) === (state.beacon ?? null)) return
      Object.assign(state, next)
      apply()
    },
    dispose() {
      for (const list of sources.values()) for (const s of list) s.remove()
      sources.clear()
      for (const a of anchors) a.removeFromParent()
      anchors.length = 0
      const giveBack = (m: Glazed): void => {
        const copy = m.material
        const original = originals.get(m)
        if (!original) return
        originals.delete(m)
        m.material = original
        if (copy && !Array.isArray(copy)) copy.dispose?.()
      }
      for (const b of beacons) giveBack(b.mesh)
      for (const l of lamps) {
        for (const m of l.inner) giveBack(m)
        for (const h of l.halo ?? []) {
          h.visible = true
          const s = haloBase.get(h) ?? 1
          h.scale.set(s, s, 1)
        }
      }
      originals.clear()
      copies.clear()
      base.clear()
    },
  }
}
