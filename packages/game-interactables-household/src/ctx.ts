import type {
  Action,
  ContainerSpec,
  ItemStack,
  Motion,
  ObjectSpec,
  PartSpec,
  SlotSpec,
  Vec3,
} from '@adatechnology/game-interactables'
import type { CylinderShape, Material, Primitive } from '@adatechnology/game-props3d'
import type { HouseholdApi, HouseholdItem, HouseholdTypeDef, Region } from './types'
import { cornersOf, hex, rng, round3, seedOf, sweepOf } from './util'

/** Largest door opening angle used anywhere (100 degrees). */
export const MAX_OPEN = 1.74

export interface PartOptions {
  label?: string
  t0?: number
  requires?: string
  /** Parts with the same group move together (see `PartSpec.group`). */
  group?: string
  /** Where the default interaction is aimed (object-local). Default: center of the part. `false` = no interaction. */
  at?: Vec3 | false
  radius?: number
  /** Skip the computed sweep (parts that never leave their footprint, like a knob). */
  noSweep?: boolean
}

/**
 * Drawing + spec context handed to every builder. Drawing methods take object-local coordinates (front = +z, origin at the center of
 * the footprint on the floor). Inside `part(...)` they are converted to the part frame automatically, and the sweep rect of the part
 * is computed from what was drawn, so it always covers the open pose.
 */
export class Ctx {
  readonly spec: ObjectSpec
  readonly rnd: () => number
  readonly w: number
  readonly d: number
  readonly h: number
  /** Mounting height (base of the object). */
  readonly y0: number
  readonly hw: number
  readonly hd: number
  private off: Vec3 = [0, 0, 0]
  private cur: Vec3[] | null = null

  constructor(
    readonly type: string,
    readonly M: HouseholdItem,
    readonly api: HouseholdApi,
    readonly def: HouseholdTypeDef,
    readonly region: Region,
  ) {
    this.spec = { type }
    this.w = M.w ?? def.w
    this.d = M.d ?? def.d
    this.h = M.h ?? def.h
    this.y0 = M.y ?? def.y
    this.hw = this.w / 2
    this.hd = this.d / 2
    this.rnd = rng(seedOf(M.seed, M.x, M.z))
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // Colours
  // ------------------------------------------------------------------------------------------------------------------------------

  private role(name: string): number | null {
    const v = this.M.palette?.[name]
    return v != null ? hex(v) : null
  }
  main(fallback: number): number {
    return this.M.color != null ? hex(this.M.color) : fallback
  }
  wood(fallback: number): number {
    return this.M.color != null ? hex(this.M.color) : (this.role('wood') ?? fallback)
  }
  metal(fallback: number): number {
    return this.role('metal') ?? fallback
  }
  fabric(fallback: number): number {
    return this.M.color != null ? hex(this.M.color) : (this.role('fabric_main') ?? fallback)
  }
  accent(fallback: number): number {
    return this.role('fabric_accent') ?? fallback
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // Drawing (object-local coordinates)
  // ------------------------------------------------------------------------------------------------------------------------------

  private track(p: Primitive): void {
    if (this.cur) this.cur.push(...cornersOf(p))
  }

  /** Box given by its two opposite corners. */
  b(m: Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, ry = 0, rx = 0, rz = 0): void {
    this.box(m, (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), color, ry, rx, rz)
  }

  /** Box centered at x, z with its base at y (props3d convention). */
  box(m: Material, x: number, y: number, z: number, w: number, h: number, d: number, color: number, ry = 0, rx = 0, rz = 0): void {
    const o = this.off
    this.track({ kind: 'box', M: this.M, material: m, x, y, z, w, h, d, color, ry, rx, rz })
    this.api.box(this.M, m, x - o[0], y - o[1], z - o[2], w, h, d, color, ry, rx, rz)
  }

  /** Vertical cylinder with its base at y (center at y when rx / rz are not 0). */
  cyl(m: Material, x: number, y: number, z: number, r: number, h: number, color: number, shape?: CylinderShape, rx = 0, rz = 0): void {
    const o = this.off
    this.track({ kind: 'cylinder', M: this.M, material: m, x, y, z, r, h, color, rx, rz, shape })
    this.api.cylinder(this.M, m, x - o[0], y - o[1], z - o[2], r, h, color, rx, rz, shape)
  }

  /** Cylinder lying along x (`axis` 'x') or z (`axis` 'z'), centered at (x, y, z), length `len`. */
  rod(m: Material, axis: 'x' | 'z', x: number, y: number, z: number, r: number, len: number, color: number, shape?: CylinderShape): void {
    if (axis === 'x') this.cyl(m, x, y, z, r, len, color, shape, 0, Math.PI / 2)
    else this.cyl(m, x, y, z, r, len, color, shape, Math.PI / 2, 0)
  }

  plane(m: Material, x: number, y: number, z: number, w: number, h: number, color: number, ry = 0, rx = 0, rz = 0): void {
    const o = this.off
    this.track({ kind: 'plane', M: this.M, material: m, x, y, z, w, h, color, ry, rx, rz })
    this.api.plane(this.M, m, x - o[0], y - o[1], z - o[2], w, h, color, ry, rx, rz)
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  // Spec
  // ------------------------------------------------------------------------------------------------------------------------------

  private list<K extends keyof ObjectSpec>(key: K): NonNullable<ObjectSpec[K]> {
    const s = this.spec as unknown as Record<string, unknown>
    if (!s[key]) s[key] = []
    return s[key] as NonNullable<ObjectSpec[K]>
  }

  add<K extends 'sockets' | 'switches' | 'devices' | 'fuels' | 'burners' | 'tanks' | 'fixtures' | 'seats' | 'soft' | 'emitters' | 'mirrors' | 'colliders' | 'damage' | 'interactions' | 'wires'>(
    key: K,
    value: NonNullable<ObjectSpec[K]>[number],
  ): void {
    ;(this.list(key) as unknown[]).push(value)
  }

  /**
   * A movable part. `draw` uses the normal drawing methods with object-local coordinates; the part frame is applied for you.
   * Pushes the PartSpec (with the computed sweep) and, unless `at: false`, a `toggle_part` interaction.
   */
  part(id: string, pivot: Vec3, motion: Motion, draw: () => void, o: PartOptions = {}): PartSpec {
    const prevOff = this.off
    const prevCur = this.cur
    this.off = pivot
    this.cur = []
    let pts: Vec3[] = []
    try {
      this.api.part(id, pivot, 0, draw)
      pts = this.cur
    } finally {
      this.off = prevOff
      this.cur = prevCur
    }
    const spec: PartSpec = { id, pivot, motion }
    if (o.t0) spec.t0 = o.t0
    if (o.requires) spec.requires = o.requires
    if (o.group) spec.group = o.group
    if (o.label) spec.label = o.label
    if (!o.noSweep && pts.length) spec.sweep = sweepOf(pts, pivot, motion)
    if (!o.noSweep && pts.length && motion.kind !== 'scale') {
      const lo = [0, 1, 2].map((i) => round3(Math.min(...pts.map((q) => q[i]))))
      const hi = [0, 1, 2].map((i) => round3(Math.max(...pts.map((q) => q[i]))))
      spec.bounds = [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]]
    }
    this.list('parts').push(spec)
    if (o.at !== false && o.label) {
      let at = o.at
      if (!at && pts.length) {
        const c: Vec3 = [0, 0, 0]
        for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / pts.length
        at = [round3(c[0]), round3(c[1]), round3(c[2])]
      }
      this.toggle(id, at ?? pivot, o.label, o.radius)
    }
    return spec
  }

  toggle(part: string, pos: Vec3, label: string, radius?: number): void {
    this.interact(`toggle_${part}`, pos, { do: 'toggle_part', part }, label, radius)
  }

  interact(id: string, pos: Vec3, action: Action, label: string, radius?: number, requires?: { object: string; part: string }): void {
    const it: { id: string; pos: Vec3; action: Action; label: string; radius?: number; requires?: { object: string; part: string } } = { id, pos, action, label }
    if (radius) it.radius = radius
    if (requires) it.requires = requires
    this.list('interactions').push(it)
  }

  /** Evenly spaced slots on a line along x. Slot width is clamped to the spacing. */
  row(x0: number, x1: number, y: number, z: number, n: number, max: Vec3, part?: string): SlotSpec[] {
    const step = (x1 - x0) / n
    const m: Vec3 = [Math.min(max[0], step - 0.01), max[1], max[2]]
    const out: SlotSpec[] = []
    for (let i = 0; i < n; i++) {
      const s: SlotSpec = { pos: [round3(x0 + (i + 0.5) * step), round3(y), round3(z)], max: m }
      if (part) s.part = part
      out.push(s)
    }
    return out
  }

  /**
   * Container with its inner volume given by two corners. Explicit `item.contents[id]` wins over the loot table.
   * Slots are validated lazily by the tests, not here.
   */
  container(o: { id: string; access?: string; from: Vec3; to: Vec3; slots: SlotSpec[]; loot?: string }): ContainerSpec {
    const c: ContainerSpec = {
      id: o.id,
      volume: {
        center: [round3((o.from[0] + o.to[0]) / 2), round3((o.from[1] + o.to[1]) / 2), round3((o.from[2] + o.to[2]) / 2)],
        half: [round3(Math.abs(o.to[0] - o.from[0]) / 2), round3(Math.abs(o.to[1] - o.from[1]) / 2), round3(Math.abs(o.to[2] - o.from[2]) / 2)],
      },
      slots: o.slots,
    }
    if (o.access) c.access = o.access
    if (o.loot) c.loot = o.loot
    const given = this.M.contents?.[o.id]
    if (given) {
      c.contents = o.slots.map((_, i): ItemStack | null => {
        const g = given[i]
        if (!g) return null
        const s: ItemStack = { type: g.type, qty: g.qty }
        if (g.data) s.data = { ...g.data }
        return s
      })
    }
    this.list('containers').push(c)
    return c
  }

  /** Solid collider given by two corners. */
  collider(id: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, part?: string): void {
    this.add('colliders', {
      id,
      center: [round3((x0 + x1) / 2), round3((y0 + y1) / 2), round3((z0 + z1) / 2)],
      half: [round3(Math.abs(x1 - x0) / 2), round3(Math.abs(y1 - y0) / 2), round3(Math.abs(z1 - z0) / 2)],
      ...(part ? { part } : {}),
    })
  }

  /** Finishes the spec: default body collider for solid types, removes empty lists. */
  finish(): ObjectSpec {
    const s = this.spec as unknown as Record<string, unknown>
    if (this.def.solid && s.colliders === undefined) {
      this.collider('body', -this.hw, this.y0, -this.hd, this.hw, this.y0 + this.h, this.hd)
    }
    for (const k of Object.keys(s)) if (Array.isArray(s[k]) && (s[k] as unknown[]).length === 0) delete s[k]
    return this.spec
  }
}
