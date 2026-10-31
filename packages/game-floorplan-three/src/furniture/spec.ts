import { inferJoints } from '@adatechnology/game-destruction'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { DestructibleSpec, JointSpec, PartSpec } from '@adatechnology/game-contracts'

import { create } from '../create.js'

/** What `furnitureSpec` reads of a catalogue entry (the items of `game-floorplan-residential` and the other packs have more). */
export interface FurnitureCatalogEntry {
  type: string
  w: number
  d: number
  h: number
}

export interface FurnitureSpecOptions {
  /** Size in metres (default: the catalogue entry of the type). */
  w?: number
  d?: number
  h?: number
  /** Seed of the builder's random (the books of a shelf, the crates): same seed, same piece (default 1). */
  seed?: number
  /** Builder-level choices. */
  options?: {
    /** Material of the destruction world per builder material key (`wood`, `metal`, `plain`, `fabric`, `glass`...), overriding the defaults. */
    materials?: Record<string, string>
    /** Keep the chairs a table draws (default true). Chairs are drawn by the builder in a frame of their own, so this drops everything drawn in another frame than the piece's. */
    chairs?: boolean
    /** Colour roles of the builder (`wood`, `fabric_main`, `fabric_accent`, `metal`...) as `0xRRGGBB`. */
    palette?: Record<string, number>
  }
  /** Catalogue the default size is read from (`residentialItems` of `game-floorplan-residential`, or `defaultFurnitureCatalog()` of `game-kit-defaults`); without it give `w`, `d` and `h`. */
  catalog?: readonly FurnitureCatalogEntry[]
  /** The `document` the house renderer makes its textures with (default the global one). */
  document?: unknown
}

export interface FurnitureSpecResult {
  /** One part per box or cylinder the builder drew, origin at the centre of the footprint on the floor. */
  spec: DestructibleSpec
  /** Draws the piece: one mesh per part, named by the part id, coloured as the builder coloured it. */
  build(THREE: any): any
  /** The widest high horizontal part and the height of its upper face (what loose things rest on), or null when the piece has none. */
  /** What loose things rest on. A solid top is boards: `parts` are all of them, `part` the one in the middle. */
  top: { part: string; y: number; parts?: string[] } | null
  /** Size the piece was drawn at. */
  size: { w: number; d: number; h: number }
  /** Where the water leaves the taps the builder drew (a sink, a tub), in the space of the spec; empty for furniture without a tap. */
  spouts: Array<[number, number, number]>
}

interface Drawn {
  id: string
  key: string
  shape: PartSpec['shape']
  position: [number, number, number]
  rotation: [number, number, number] | null
  color: number
  min: [number, number, number]
  max: [number, number, number]
}

const WOOD_THIN = 0.035
/** A solid wooden top is boards glued edge to edge: thicker than this it is a block and stays whole; narrower than `BOARD_TOP_WIDTH` it is one board. */
const BOARD_TOP_THICK = 0.07
const BOARD_TOP_WIDTH = 0.5
const BOARD_WIDTH = 0.16
/** A shelf falls when what holds it leaves it this many times its own length of span (one side gone: twice its length). */
const SHELF_SPAN = 1.5
/** Types that are cases with shelves: their `plain` boxes are books and boxes, and they stand as a carcass. */
const SHELVING = /shelf|bookcase|rack/

/**
 * The frame of a case piece (a bookcase, a shelf unit, a rack): the uprights stand on the floor and carry, each shelf rests on them and needs both
 * ends held (`structure.maxSpan`), and the back panel carries nothing. Break a side and the shelves it held fall with what is on them.
 */
function carcass(parts: PartSpec[], drawn: Map<string, Drawn>): void {
  const all = [...drawn.values()]
  const width = Math.max(...all.map((p) => p.max[0])) - Math.min(...all.map((p) => p.min[0]))
  for (const part of parts) {
    if (LOOSE.has(part.material) || part.shape.kind !== 'box' || part.rotation) continue
    const [x, y, z] = part.shape.size
    if (y >= x && y >= z) {
      // upright: a side (thin across the width) carries; a back or front panel (thin in depth, as wide as the piece) does not
      if (z < x && x >= 0.6 * width) continue
      part.structure = { role: 'column' }
    } else if (y <= x && y <= z) part.structure = { role: 'beam', maxSpan: SHELF_SPAN * Math.max(x, z) }
  }
}
/** Each solid top of the drawing becomes its boards (`<id>_b<n>`), along its length, so that it breaks board by board where it is hit. Returns the boards of each top. */
function splitTopsIntoBoards(drawn: Drawn[], materialOf: Record<string, string>, carcassed: boolean): Map<string, Drawn[]> {
  const tops = new Map<string, Drawn[]>()
  if (carcassed) return tops
  for (let i = drawn.length - 1; i >= 0; i--) {
    const p = drawn[i]
    if (p.key !== 'wood' || materialOf.wood !== 'wood_hard' || p.shape.kind !== 'box' || p.rotation) continue
    const [sx, sy, sz] = p.shape.size
    const across = sx < sz ? 0 : 2
    const width = Math.min(sx, sz)
    if (sy < WOOD_THIN || sy > BOARD_TOP_THICK || sy >= width || width < BOARD_TOP_WIDTH) continue
    const count = Math.round(width / BOARD_WIDTH)
    const boards: Drawn[] = []
    for (let b = 0; b < count; b++) {
      const size: [number, number, number] = [sx, sy, sz]
      size[across] = width / count
      const position: [number, number, number] = [...p.position]
      position[across] += (b + 0.5) * size[across] - width / 2
      const min: [number, number, number] = [...p.min]
      const max: [number, number, number] = [...p.max]
      min[across] = position[across] - size[across] / 2
      max[across] = position[across] + size[across] / 2
      boards.push({ ...p, id: `${p.id}_b${b}`, shape: { kind: 'box', size }, position, min, max, color: shadeBoard(p.color, b) })
    }
    drawn.splice(i, 1, ...boards)
    tops.set(p.id, boards)
  }
  return tops
}

/** Boards of one top are not cut from the same tree: each has its own tone. */
function shadeBoard(color: number, board: number): number {
  const k = [1, 0.94, 1.05, 0.97, 1.03][board % 5]
  const channel = (shift: number): number => Math.min(255, Math.round(((color >> shift) & 255) * k)) << shift
  return channel(16) | channel(8) | channel(0)
}

const FLOOR_TOUCH = 0.005
const LOOSE = new Set(['paper'])
const BASE_MATERIAL: Record<string, string> = {
  wood: 'wood_hard',
  metal: 'steel',
  fabric: 'fabric',
  glass: 'glass',
  plain: 'plastic',
  plant: 'foliage',
  picture: 'paper',
  emissive: 'glass',
}

// one house renderer per three.js namespace: it makes the type table the builders hang from
const renderers = new WeakMap<object, any>()
function rendererOf(THREE: any, document: unknown): any {
  let r = renderers.get(THREE)
  if (!r) {
    r = create(THREE, document ? { document: document as never } : {})
    renderers.set(THREE, r)
  }
  return r
}

interface RecordOptions {
  /** Destruction material per builder material key, over the defaults. */
  materials: Record<string, string>
  chairs?: boolean
  /** The piece is a case with shelves (`carcass`). */
  carcass?: boolean
}

/** Runs `run` with a recording stand-in for the drawing api and turns what it drew into a spec, a drawing and the top. `root` is the frame of the piece (the builder's `M`). */
function recordSpec(THREE: any, name: string, root: any, run: (A: any) => void, opts: RecordOptions): { spec: DestructibleSpec; build: (T3: any) => any; top: FurnitureSpecResult['top'] } {
  const o = { chairs: opts.chairs }
  const materialOf = { ...BASE_MATERIAL, ...opts.materials }
  const drawn: Drawn[] = []
  const counters = new Map<string, number>()
  const q = new THREE.Quaternion()
  const eul = new THREE.Euler()
  const xyz = new THREE.Euler()
  const v = new THREE.Vector3()

  const loc = (M: any, lx: number, lz: number): [number, number] => {
    const c = Math.cos(M.ry)
    const s = Math.sin(M.ry)
    return [M.x + lx * c + lz * s, M.z - lx * s + lz * c]
  }
  const record = (M: any, key: string, shape: PartSpec['shape'], px: number, py: number, pz: number, rx: number, ry: number, rz: number, color: number): void => {
    if ((o.chairs === false && M !== root) || key === 'water') return // water is not a solid
    q.setFromEuler(eul.set(rx, ry, rz, 'YXZ'))
    const turned = rx !== 0 || ry !== 0 || rz !== 0
    const size: [number, number, number] = shape.kind === 'box' ? shape.size : shape.kind === 'cylinder' ? [shape.radius * 2, shape.height, shape.radius * 2] : [shape.radius * 2, shape.radius * 2, shape.radius * 2]
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
      v.set(sx * size[0], sy * size[1], sz * size[2]).applyQuaternion(q)
      const c = [v.x + px - root.x, v.y + py, v.z + pz - root.z]
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], c[k])
        max[k] = Math.max(max[k], c[k])
      }
    }
    const n = counters.get(key) ?? 0
    counters.set(key, n + 1)
    let rotation: [number, number, number] | null = null
    if (turned) {
      xyz.setFromQuaternion(q, 'XYZ')
      rotation = [xyz.x, xyz.y, xyz.z]
    }
    drawn.push({ id: `${key}_${n}`, key, shape, position: [px - root.x, py, pz - root.z], rotation, color, min, max })
  }

  const A = {
    box(M: any, mat: string, x: number, y: number, z: number, bw: number, bh: number, bd: number, color: number, ry = 0, rx = 0, rz = 0): void {
      const [px, pz] = loc(M, x, z)
      record(M, mat, { kind: 'box', size: [bw, bh, bd] }, px, M.base + y + bh / 2, pz, rx, M.ry + ry, rz, color)
    },
    cylinder(M: any, mat: string, x: number, y: number, z: number, r: number, ch: number, color: number, rx = 0, rz = 0): void {
      const [px, pz] = loc(M, x, z)
      record(M, mat, { kind: 'cylinder', radius: r, height: ch }, px, M.base + y + (rx || rz ? 0 : ch / 2), pz, rx || 0, M.ry, rz || 0, color)
    },
    leaf(): void {},
    plane(): void {},
    light(): void {},
  }
  run(A)
  if (!drawn.length) throw new Error(`game-floorplan-three: the builder of "${name}" drew no box or cylinder`)

  const boardsOf = splitTopsIntoBoards(drawn, materialOf, Boolean(opts.carcass))
  const parts: PartSpec[] = drawn.map((p) => {
    const thin = Math.min(...(p.shape.kind === 'box' ? p.shape.size : p.shape.kind === 'cylinder' ? [p.shape.radius * 2, p.shape.height] : [p.shape.radius * 2]))
    let material = materialOf[p.key] ?? 'plastic'
    // a case with shelves is MDF (as bought); elsewhere thin boards are pine and thick ones hardwood
    if (p.key === 'wood' && material === 'wood_hard' && opts.carcass && !opts.materials?.wood) material = 'mdf'
    else if (p.key === 'wood' && material === 'wood_hard' && thin < WOOD_THIN) material = 'wood_soft'
    const part: PartSpec = { id: p.id, material, shape: p.shape, position: p.position }
    if (p.rotation) part.rotation = p.rotation
    if (!LOOSE.has(material) && p.min[1] <= FLOOR_TOUCH) part.anchored = true
    return part
  })
  const byId = new Map(drawn.map((p) => [p.id, p]))

  const joints: JointSpec[] = []
  for (const j of inferJoints(parts, 0.01)) {
    const a = parts.find((p) => p.id === j.a)!
    const b = parts.find((p) => p.id === j.b)!
    const la = LOOSE.has(a.material)
    const lb = LOOSE.has(b.material)
    if (la && lb) continue
    if (la || lb) {
      // paper rests on what is under it: its lower face on the other's upper face
      const [loose, other] = la ? [a, b] : [b, a]
      if (Math.abs(byId.get(loose.id)!.min[1] - byId.get(other.id)!.max[1]) > 0.02) continue
      joints.push({ id: j.id, a: j.a, b: j.b, kind: 'resting' })
      continue
    }
    joints.push(j)
  }

  // the top: among the boxes that cover most of the footprint, the highest upper face (not fabric: a cloth lies on the top)
  const all = drawn.reduce(
    (m, p) => ({ x0: Math.min(m.x0, p.min[0]), x1: Math.max(m.x1, p.max[0]), z0: Math.min(m.z0, p.min[2]), z1: Math.max(m.z1, p.max[2]) }),
    { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
  )
  const footprint = (all.x1 - all.x0) * (all.z1 - all.z0)
  let top: FurnitureSpecResult['top'] = null
  for (const p of drawn) {
    const part = parts.find((x) => x.id === p.id)!
    if (part.shape.kind === 'sphere' || part.rotation || part.material === 'fabric' || LOOSE.has(part.material)) continue
    const area = (p.max[0] - p.min[0]) * (p.max[2] - p.min[2])
    if (area < 0.6 * footprint || p.max[1] < 0.2) continue
    if (!top || p.max[1] > top.y + 1e-6) top = { part: p.id, y: p.max[1] }
  }
  for (const boards of boardsOf.values()) {
    if (top && boards[0].max[1] <= top.y - 1e-6) continue
    const mid = boards[boards.length >> 1]
    const min = [Math.min(...boards.map((b) => b.min[0])), Math.min(...boards.map((b) => b.min[2]))]
    const max = [Math.max(...boards.map((b) => b.max[0])), Math.max(...boards.map((b) => b.max[2]))]
    if ((max[0] - min[0]) * (max[1] - min[1]) >= 0.6 * footprint && mid.max[1] >= 0.2) top = { part: mid.id, y: mid.max[1], parts: boards.map((b) => b.id) }
  }

  if (opts.carcass) carcass(parts, byId)
  const spec: DestructibleSpec = { name, parts, joints, tags: ['furniture'] }
  const colors = new Map(drawn.map((p) => [p.id, p.color]))

  const build = (T3: any): any => {
    const group = markKitOrigin(new T3.Group(), { owner: 'game-floorplan-three', kind: 'furniture', id: name })
    group.name = name
    const mats = new Map<string, any>()
    for (const p of parts) {
      const color = colors.get(p.id) ?? 0x888888
      const metal = p.material === 'steel'
      const glass = p.material === 'glass'
      const key = `${color}:${metal}:${glass}`
      let mat = mats.get(key)
      if (!mat) {
        mat = new T3.MeshStandardMaterial({ color, roughness: metal ? 0.45 : 0.85, metalness: metal ? 0.7 : 0, transparent: glass, opacity: glass ? 0.4 : 1 })
        mats.set(key, mat)
      }
      const s = p.shape
      const geo = s.kind === 'box' ? new T3.BoxGeometry(s.size[0], s.size[1], s.size[2]) : s.kind === 'cylinder' ? new T3.CylinderGeometry(s.radius, s.radius, s.height, 14) : new T3.SphereGeometry(s.radius, 12, 8)
      const mesh = new T3.Mesh(geo, mat)
      mesh.name = p.id
      mesh.userData.destructionPart = p.id
      mesh.userData.destructionMaterial = p.material
      mesh.position.set(p.position[0], p.position[1], p.position[2])
      if (p.rotation) mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')
      mesh.castShadow = !glass
      mesh.receiveShadow = true
      group.add(mesh)
    }
    return group
  }

  return { spec, build, top }
}

/**
 * The team's furniture as a destructible spec. It runs the builder of `type` (`FURNITURE.shelf` for `bookcase`, `FURNITURE.table` for `dining_table`,
 * mapped in `furniture/type-table.ts`) unchanged, with a recording stand-in for the drawing api instead of the house's accumulators: every box and
 * cylinder it draws becomes a part, named `<material key>_<n>` in drawing order (`wood_0`, `plain_17`), with the colour the builder gave it.
 * Planes and leaves (flat, no volume) and water are left out.
 *
 * Materials: `wood` is `wood_hard`, and `wood_soft` for thin boards and panels (under 3.5 cm); `metal` is `steel`; `fabric`, `glass` and `plant` keep
 * their name; `plain` is `plastic`, or `paper` for shelves and racks (their books and boxes). Parts that touch the floor are anchored. Joints come from
 * `inferJoints` (screws between wood, welds or bolts between metal...), except that paper rests on what it lies on with a `resting` joint (weak: it falls when
 * the board breaks) and is not joined to its neighbours. Shelves and racks stand as a carcass: the sides carry, each shelf needs both of its ends
 * held, and the back panel carries nothing, so a broken side drops the shelves it held, with their books.
 *
 * @example
 * const { spec, build, top } = furnitureSpec(THREE, 'bookcase') // 1.2 x 0.35 x 2 m, boards and books
 */
export function furnitureSpec(THREE: any, type: string, opts: FurnitureSpecOptions = {}): FurnitureSpecResult {
  const renderer = rendererOf(THREE, opts.document)
  const ent = renderer.types[type]
  if (!ent) throw new Error(`game-floorplan-three: no builder for the furniture type "${type}"`)
  const entry = opts.catalog?.find((i) => i.type === type)
  const w = opts.w ?? entry?.w
  const d = opts.d ?? entry?.d
  const h = opts.h ?? entry?.h
  if (w === undefined || d === undefined || h === undefined) throw new Error(`game-floorplan-three: furniture type "${type}" is not in the catalogue (pass catalog), so give w, d and h`)
  const o = opts.options ?? {}
  const seed = Math.round(opts.seed ?? 1)
  const plain = SHELVING.test(type) ? 'paper' : 'plastic'
  const root: any = { x: seed, z: 0, ry: 0, w, d, h, y: 0, base: 0, palette: o.palette, seed: `furniture_${type}_${seed}` }
  const { K, shared } = renderer.internals
  const before = K.PARTS.length
  const made = recordSpec(
    THREE,
    type,
    root,
    (A) => {
      const saved = { api0: shared.api0, ctx: shared.ctx }
      shared.api0 = A // the levers and taps that the kit draws as moving parts go through its own api
      shared.ctx = shared.ctx ?? {} // outside a house the builders read the style of the plan from here
      try {
        ent.f(root, A)
      } finally {
        shared.api0 = saved.api0
        shared.ctx = saved.ctx
      }
    },
    { materials: { plain, ...o.materials }, chairs: o.chairs, carcass: SHELVING.test(type) },
  )
  const spouts = K.PARTS.slice(before)
    .filter((p: any) => p.type === 'water_tap')
    .map((p: any): [number, number, number] => [p.pos[0] - root.x, p.pos[1], p.pos[2] - root.z])
  K.PARTS.length = before
  return { spec: made.spec, build: made.build, top: made.top, size: { w, d, h }, spouts }
}

export interface TapSpecOptions {
  /** `counter` (default): the tap of a sink, standing on the counter; `wall`: the tap of a laundry tub or a garden, with its plate on the wall. */
  kind?: 'counter' | 'wall'
  /** How far the counter tap's spout reaches, metres (default 0.2: the kitchen sink's). */
  reach?: number
  /** The `document` the house renderer makes its textures with (default the global one). */
  document?: unknown
}

export interface TapSpecResult {
  /** The tap as parts (base, column, spout, lever), origin on the counter under the column (`counter`) or on the wall plate's centre line at the floor (`wall`). */
  spec: DestructibleSpec
  /** Draws the tap: one mesh per part, named by the part id. */
  build(THREE: any): any
  /** Where the water leaves the spout, in the space of the spec. */
  spout: [number, number, number]
}

/**
 * The team's tap (`counterTap` of the sink, `wallTap` of the laundry tub: `furniture/taps.ts`) drawn by the same code into parts, with the lever at rest. `spout` is where its
 * water thread starts, so a host can put a tap of the fluids world there; the water thread itself is not drawn.
 */
export function tapSpec(THREE: any, opts: TapSpecOptions = {}): TapSpecResult {
  const renderer = rendererOf(THREE, opts.document)
  const { K, shared } = renderer.internals
  const kind = opts.kind ?? 'counter'
  const root: any = { x: 1, z: 0, ry: 0, w: 0.3, d: 0.3, h: 0.3, y: 0, base: 0, seed: `tap_${kind}` }
  const before = K.PARTS.length
  const made = recordSpec(THREE, kind === 'counter' ? 'tap' : 'wall_tap', root, (A) => {
    const kit = K.kit2(root, A)
    const saved = shared.api0
    shared.api0 = A // the lever and the water thread are parts that the kit draws through its own api
    try {
      if (kind === 'counter') K.counterTap(kit, 0, 0, 0, opts.reach ?? 0.2, 0.17, {})
      else K.wallTap(kit, 0, 0.3, 0, 1, 0.1, {})
    } finally {
      shared.api0 = saved
    }
  }, { materials: {} })
  const water = K.PARTS.slice(before).find((p: any) => p.type === 'water_tap')
  if (!water) throw new Error('game-floorplan-three: the tap drew no water thread')
  K.PARTS.length = before
  return { spec: made.spec, build: made.build, spout: [water.pos[0] - root.x, water.pos[1], water.pos[2] - root.z] }
}
