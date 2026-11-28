import { inferJoints } from '@adatechnology/game-destruction'
import { structureFill } from './structure-fill.js'
import { holdLooseGroups } from './hold-loose.js'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { DestructibleSpec, JointSpec, PartSpec } from '@adatechnology/game-contracts'

import { residentialItems } from '@adatechnology/game-floorplan-residential'

import { create } from '../create.js'
import type * as THREE_NS from 'three'
import type { BuildContext, Frame, FurnitureApi, HouseRendererInternal, Mount, Three } from '../kernel-types.js'

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
  /** Catalogue the default size is read from (`defaultFurnitureCatalog()` of `game-kit-defaults`, or the game's own). Default `residentialItems`, which is deprecated: pass the catalogue. */
  catalog?: readonly FurnitureCatalogEntry[]
  /** The `document` the house renderer makes its textures with (default the global one). */
  document?: unknown
}

export interface FurnitureSpecResult {
  /** One part per box or cylinder the builder drew, origin at the centre of the footprint on the floor. */
  spec: DestructibleSpec
  /** Draws the piece: one mesh per part, named by the part id, coloured as the builder coloured it. */
  build(THREE: Three): THREE_NS.Group
  /** The widest high horizontal part and the height of its upper face (what loose things rest on), or null when the piece has none. */
  /** What loose things rest on. A solid top is boards: `parts` are all of them, `part` the one in the middle. */
  top: { part: string; y: number; parts?: string[] } | null
  /** Size the piece was drawn at. */
  size: { w: number; d: number; h: number }
  /** Where the water leaves the taps the builder drew (a sink, a tub), in the space of the spec; empty for furniture without a tap. */
  spouts: Array<[number, number, number]>
  /**
   * The piece is fixed where it is laid, not a loose body: a part hangs on the wall behind it (a range hood, a shower head, a curtain rod), it is set into the ground
   * (the legs of a swing), it is a tree standing in the ground by its trunk, or it is installed (a toilet, a basin, a shower stall: plumbed and bolted in).
   */
  fixed: boolean
}

interface Drawn {
  id: string
  key: string
  /** Destruction material of this box when it is not the one of its key (the boards of a case: `hollowCases`). */
  material?: string
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
      // upright: a side (thin across the width) carries; a back or front panel (thin in depth, as wide as the piece) carries nothing and is nailed to the sides,
      // not to the floor: it needs both of them, as a shelf does (a back left on one side tears off it and falls, it does not stand as an L with that side)
      if (z < x && x >= 0.6 * width) {
        part.anchored = false
        part.structure = { role: 'beam', maxSpan: SHELF_SPAN * x }
        continue
      }
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
    if (p.material || p.key !== 'wood' || materialOf.wood !== 'wood_hard' || p.shape.kind !== 'box' || p.rotation) continue
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

/**
 * Case furniture (cupboards, sideboards, chests of drawers, wardrobes): the builders draw its body as one solid block behind the doors and drawer fronts, which
 * broke into solid blocks. As bought it is a box of boards, and `hollowCases` makes it one.
 */
const CASES = /^(tv_unit|tv_unit_small|tv_unit_large|sideboard|china_cabinet|pantry|laundry_cabinet|wardrobe|wardrobe_small|wardrobe_large|closet_wardrobe|kitchen_cabinet|kitchen_cabinet_large|kitchen_cabinet_small|display_stand|dresser|nightstand|console_table|vanity_table)$/
/** Of those, the ones whose fronts are drawers (`interaction/items.ts`, DRAWER_ITEM): each front pulls out a drawer box. */
const DRAWER_CASES = /^(dresser|nightstand|console_table|vanity_table)$/
/** A block of a case is its body when it is at least this deep, wide and tall (m). */
const CASE_BODY_MIN = 0.2
/** A front (a door, a drawer front) is a board at most this thick lying on the front face of the body, within `FRONT_REACH` of it. */
const FRONT_THICK = 0.03
const FRONT_REACH = 0.03
/** Boards of the case (sides, top, bottom, shelves, rails), its back, and the drawers' sides and bottom, metres: an 18 mm MDF case on a 6 mm plywood back. */
const CASE_BOARD = 0.018
const CASE_BACK = 0.006
const DRAWER_SIDE = 0.012
const DRAWER_BOTTOM = 0.006
/** Shelves of a door case: one every `SHELF_PITCH` of inner height (none under it); a wardrobe has one shelf `HANGING_SHELF_DROP` under its top, over the hanging space. */
const SHELF_PITCH = 0.45
const WARDROBES = /wardrobe/
const HANGING_SHELF_DROP = 0.35

/** A box of the case, from its corners, with the body's key and colour. */
function board(body: Drawn, suffix: string, material: string, min: [number, number, number], max: [number, number, number], color = body.color): Drawn {
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const position: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  return { id: `${body.id}_${suffix}`, key: body.key, material, shape: { kind: 'box', size }, position, rotation: null, color, min, max }
}

/**
 * Each solid body of a case piece becomes the boards it is made of (`<id>_side_l`, `_side_r`, `_top`, `_bottom`, `_back`, `_shelf<n>`, `_rail<n>`): an 18 mm MDF
 * carcass on a 6 mm plywood back, open at the front behind its doors and drawer fronts, which become MDF too. Behind each drawer front of a chest of drawers
 * there is a drawer box (`_drawer<n>_side_l`, `_side_r`, `_back`, `_bottom`), with a rail between one drawer and the next. A shot breaks the board it hits,
 * as MDF breaks (lumps and dust) or plywood (plies and splinters), and the case stays a box of what is left. Returns the ids of the boards made.
 */
function hollowCases(drawn: Drawn[], type: string): Set<string> {
  const made = new Set<string>()
  if (!CASES.test(type)) return made
  const drawers = DRAWER_CASES.test(type)
  for (let i = drawn.length - 1; i >= 0; i--) {
    const body = drawn[i] as Drawn
    if ((body.key !== 'wood' && body.key !== 'plain') || body.shape.kind !== 'box' || body.rotation) continue
    const [sx, sy, sz] = body.shape.size
    if (Math.min(sx, sy, sz) < CASE_BODY_MIN) continue
    const fronts = drawn.filter((p) => {
      if (p === body || p.shape.kind !== 'box' || p.rotation || (p.key !== 'wood' && p.key !== 'plain')) return false
      const thick = p.max[2] - p.min[2]
      if (thick > FRONT_THICK || thick >= p.max[0] - p.min[0] || thick >= p.max[1] - p.min[1]) return false
      const cx = (p.min[0] + p.max[0]) / 2
      const cy = (p.min[1] + p.max[1]) / 2
      return Math.abs(p.min[2] - body.max[2]) <= FRONT_REACH && cx > body.min[0] && cx < body.max[0] && cy > body.min[1] && cy < body.max[1]
    })
    if (fronts.length === 0) continue
    const [x0, y0, z0] = body.min
    const [x1, y1, z1] = body.max
    const T = CASE_BOARD
    const zi = z0 + CASE_BACK
    const inner = 0.92
    const tone = (k: number): number => {
      const c = (s: number): number => Math.min(255, Math.round(((body.color >> s) & 255) * k)) << s
      return c(16) | c(8) | c(0)
    }
    const boards: Drawn[] = [
      board(body, 'back', 'plywood', [x0, y0, z0], [x1, y1, zi], tone(0.8)),
      board(body, 'side_l', 'mdf', [x0, y0, zi], [x0 + T, y1, z1]),
      board(body, 'side_r', 'mdf', [x1 - T, y0, zi], [x1, y1, z1]),
      board(body, 'top', 'mdf', [x0 + T, y1 - T, zi], [x1 - T, y1, z1]),
      board(body, 'bottom', 'mdf', [x0 + T, y0, zi], [x1 - T, y0 + T, z1], tone(inner)),
    ]
    const ix0 = x0 + T
    const ix1 = x1 - T
    const iy0 = y0 + T
    const iy1 = y1 - T
    if (drawers) {
      const stack = [...fronts].sort((a, b) => a.min[1] - b.min[1])
      stack.forEach((front, k) => {
        // the drawer: its sides 2 mm in from the case's, its bottom between them, its back 1 cm in front of the case's back; its front is the drawer front
        const dy0 = Math.max(front.min[1] + 0.01, iy0 + 0.002)
        const dy1 = Math.min(front.max[1] - 0.02, iy1 - 0.002)
        const dz0 = zi + 0.01
        const dz1 = front.min[2]
        if (dy1 - dy0 < 0.04 || dz1 - dz0 < 0.1) return
        const a = ix0 + 0.002
        const b = ix1 - 0.002
        boards.push(
          board(body, `drawer${k}_side_l`, 'mdf', [a, dy0, dz0], [a + DRAWER_SIDE, dy1, dz1], tone(inner)),
          board(body, `drawer${k}_side_r`, 'mdf', [b - DRAWER_SIDE, dy0, dz0], [b, dy1, dz1], tone(inner)),
          board(body, `drawer${k}_back`, 'mdf', [a + DRAWER_SIDE, dy0, dz0], [b - DRAWER_SIDE, dy1, dz0 + DRAWER_SIDE], tone(inner)),
          board(body, `drawer${k}_bottom`, 'mdf', [a + DRAWER_SIDE, dy0, dz0 + DRAWER_SIDE], [b - DRAWER_SIDE, dy0 + DRAWER_BOTTOM, dz1], tone(inner)),
        )
        // the rail the drawer above runs over, in the gap between the two fronts
        const above = stack[k + 1]
        if (!above) return
        const mid = (front.max[1] + above.min[1]) / 2
        if (above.min[1] - front.max[1] < T || mid - T / 2 < dy1 || mid + T / 2 > iy1) return
        boards.push(board(body, `rail${k}`, 'mdf', [ix0, mid - T / 2, zi], [ix1, mid + T / 2, z1], tone(inner)))
      })
    } else {
      const height = iy1 - iy0
      const count = Math.max(0, Math.round(height / SHELF_PITCH) - 1)
      const levels = WARDROBES.test(type) ? [iy1 - HANGING_SHELF_DROP] : Array.from({ length: count }, (_, k) => iy0 + ((k + 1) * height) / (count + 1))
      levels.forEach((y, k) => boards.push(board(body, `shelf${k}`, 'mdf', [ix0, y - T / 2, zi], [ix1, y + T / 2, z1 - 0.02], tone(inner))))
    }
    for (const front of fronts) front.material = 'mdf'
    drawn.splice(i, 1, ...boards)
    for (const b of boards) made.add(b.id)
  }
  return made
}

/** Boards of one top are not cut from the same tree: each has its own tone. */
function shadeBoard(color: number, board: number): number {
  const k = [1, 0.94, 1.05, 0.97, 1.03][board % 5]
  const channel = (shift: number): number => Math.min(255, Math.round(((color >> shift) & 255) * k)) << shift
  return channel(16) | channel(8) | channel(0)
}

const FLOOR_TOUCH = 0.005
const LOOSE = new Set(['paper'])
/** Never loose in the world: set in the ground by a post or roots (a mailbox, a clothesline, a small tree) or built in masonry on the spot (a brick barbecue). */
const PLANTED = new Set(['mailbox', 'correio', 'clothesline', 'tree_small', 'bbq_simple'])
/** Installed in the house: plumbed and bolted to the floor or the wall (a toilet, a basin, a shower stall, a laundry tub). Fixed until blows tear it off. */
const INSTALLED = new Set(['toilet', 'washbasin', 'pedestal_basin', 'shower', 'shower_large', 'laundry_tub'])
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
const renderers = new WeakMap<object, HouseRendererInternal>()
function rendererOf(THREE: Three, document: unknown): HouseRendererInternal {
  let r = renderers.get(THREE)
  if (!r) {
    r = create(THREE, document ? { document: document as never } : {}) as HouseRendererInternal /* `buildApi` hands out the kernel too */
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
function recordSpec(THREE: Three, name: string, root: Mount, run: (A: FurnitureApi) => void, opts: RecordOptions): Pick<FurnitureSpecResult, 'spec' | 'build' | 'top' | 'fixed'> {
  const o = { chairs: opts.chairs }
  const materialOf = { ...BASE_MATERIAL, ...opts.materials }
  const drawn: Drawn[] = []
  const counters = new Map<string, number>()
  const q = new THREE.Quaternion()
  const eul = new THREE.Euler()
  const xyz = new THREE.Euler()
  const v = new THREE.Vector3()

  const loc = (M: Frame, lx: number, lz: number): [number, number] => {
    const c = Math.cos(M.ry)
    const s = Math.sin(M.ry)
    return [M.x + lx * c + lz * s, M.z - lx * s + lz * c]
  }
  const record = (M: Frame, key: string, shape: PartSpec['shape'], px: number, py: number, pz: number, rx: number, ry: number, rz: number, color: number): void => {
    if ((o.chairs === false && M !== root) || key === 'water') return // water is not a solid
    q.setFromEuler(eul.set(rx, ry, rz, 'YXZ'))
    const turned = rx !== 0 || ry !== 0 || rz !== 0
    const size: [number, number, number] = shape.kind === 'box' ? shape.size : shape.kind === 'cylinder' ? [shape.radius * 2, shape.height, shape.radius * 2] : [shape.radius * 2, shape.radius * 2, shape.radius * 2]
    const min: [number, number, number] = [Infinity, Infinity, Infinity]
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
      v.set(sx * size[0], sy * size[1], sz * size[2]).applyQuaternion(q)
      const c = [v.x + px - root.x, v.y + py, v.z + pz - root.z] as [number, number, number]
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

  const A: FurnitureApi = {
    box(M: Frame, mat: string, x: number, y: number, z: number, bw: number, bh: number, bd: number, color: number, ry = 0, rx = 0, rz = 0): void {
      const [px, pz] = loc(M, x, z)
      record(M, mat, { kind: 'box', size: [bw, bh, bd] }, px, M.base + y + bh / 2, pz, rx, M.ry + ry, rz, color)
    },
    cylinder(M: Frame, mat: string, x: number, y: number, z: number, r: number, ch: number, color: number, rx = 0, rz = 0): void {
      const [px, pz] = loc(M, x, z)
      record(M, mat, { kind: 'cylinder', radius: r, height: ch }, px, M.base + y + (rx || rz ? 0 : ch / 2), pz, rx || 0, M.ry, rz || 0, color)
    },
    leaf(): void {},
    plane(): void {},
    light(): void {},
  }
  run(A)
  if (!drawn.length) throw new Error(`game-floorplan-three: the builder of "${name}" drew no box or cylinder`)

  hollowCases(drawn, name)
  const boardsOf = splitTopsIntoBoards(drawn, materialOf, Boolean(opts.carcass))
  const parts: PartSpec[] = drawn.map((p) => {
    const thin = Math.min(...(p.shape.kind === 'box' ? p.shape.size : p.shape.kind === 'cylinder' ? [p.shape.radius * 2, p.shape.height] : [p.shape.radius * 2]))
    let material = p.material ?? materialOf[p.key] ?? 'plastic'
    // a case with shelves is MDF (as bought); elsewhere thin boards are pine and thick ones hardwood
    if (p.material) {
      // a board of a case (`hollowCases`) keeps the material it was made of
    } else if (p.key === 'wood' && material === 'wood_hard' && opts.carcass && !opts.materials?.wood) material = 'mdf'
    else if (p.key === 'wood' && material === 'wood_hard' && thin < WOOD_THIN) material = 'wood_soft'
    const part: PartSpec = { id: p.id, material, shape: p.shape, position: p.position }
    // what the block is built as: boards around air, a sheet around insulation, foam in a cover (its mass, not a solid block's)
    const fill = structureFill(material, p.shape)
    if (fill < 1) part.fill = Math.round(fill * 1e4) / 1e4
    if (p.rotation) part.rotation = p.rotation
    if (!LOOSE.has(material) && p.min[1] <= FLOOR_TOUCH) part.anchored = true
    // a book on a shelf is taken off it with one hand, and is called a book once it is off
    if (opts.carcass && LOOSE.has(material)) {
      part.hands = 1
      part.tags = ['book']
    }
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
  holdLooseGroups({ parts, joints, boxOf: (id) => byId.get(id) as Drawn })
  const low = (part: PartSpec): number => (byId.get(part.id) as Drawn).min[1]
  const wallMounted = parts.some((part) => part.anchored && low(part) > FLOOR_TOUCH)
  const sunk = parts.some((part) => low(part) < -FLOOR_TOUCH)
  const rooted = parts.some((part) => part.material === 'foliage') && parts.some((part) => part.material.startsWith('wood') && low(part) <= FLOOR_TOUCH)
  const fixed = wallMounted || sunk || rooted || PLANTED.has(name) || INSTALLED.has(name)

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
  const spec: DestructibleSpec = { name, parts, joints, tags: ['furniture'], ...(fixed ? { fixed } : {}) }
  const colors = new Map(drawn.map((p) => [p.id, p.color]))

  const build = (T3: Three): THREE_NS.Group => {
    const group = markKitOrigin(new T3.Group(), { owner: 'game-floorplan-three', kind: 'furniture', id: name })
    group.name = name
    const mats = new Map<string, THREE_NS.MeshStandardMaterial>()
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

  return { spec, build, top, fixed }
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
 * the board breaks) and is not joined to its neighbours. Nothing is left hanging when the piece is laid (`holdLooseGroups`): a part drawn a little apart is joined
 * to what holds it, and one at the back of the piece (a shower head, a range hood, a curtain rod) is screwed to the wall behind it. Shelves and racks stand as a carcass: the sides carry, each shelf needs both of its ends
 * held, and the back panel carries nothing, so a broken side drops the shelves it held, with their books.
 *
 * @example
 * const { spec, build, top } = furnitureSpec(THREE, 'bookcase') // 1.2 x 0.35 x 2 m, boards and books
 */
export function furnitureSpec(THREE: Three, type: string, opts: FurnitureSpecOptions = {}): FurnitureSpecResult {
  const renderer = rendererOf(THREE, opts.document)
  const ent = renderer.types[type]
  if (!ent) throw new Error(`game-floorplan-three: no builder for the furniture type "${type}"`)
  const entry = (opts.catalog ?? (residentialItems as unknown as readonly FurnitureCatalogEntry[])).find((i) => i.type === type)
  const w = opts.w ?? entry?.w
  const d = opts.d ?? entry?.d
  const h = opts.h ?? entry?.h
  if (w === undefined || d === undefined || h === undefined) throw new Error(`game-floorplan-three: furniture type "${type}" is not in the catalogue, so give w, d and h`)
  const o = opts.options ?? {}
  const seed = Math.round(opts.seed ?? 1)
  const plain = SHELVING.test(type) ? 'paper' : 'plastic'
  const root: Mount = { x: seed, z: 0, ry: 0, w, d, h, y: 0, base: 0, palette: o.palette, seed: `furniture_${type}_${seed}` }
  const { K, shared } = renderer.internals
  const before = K.PARTS.length
  const made = recordSpec(
    THREE,
    type,
    root,
    (A) => {
      const saved = { api0: shared.api0, ctx: shared.ctx }
      shared.api0 = A // the levers and taps that the kit draws as moving parts go through its own api
      shared.ctx = shared.ctx ?? ({} as BuildContext) // outside a house the builders read the style of the plan from here
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
    .filter((p) => p.type === 'water_tap')
    .map((p): [number, number, number] => [p.pos[0] - root.x, p.pos[1], p.pos[2] - root.z])
  K.PARTS.length = before
  return { spec: made.spec, build: made.build, top: made.top, size: { w, d, h }, spouts, fixed: made.fixed }
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
  build(THREE: Three): THREE_NS.Group
  /** Where the water leaves the spout, in the space of the spec. */
  spout: [number, number, number]
}

/**
 * The team's tap (`counterTap` of the sink, `wallTap` of the laundry tub: `furniture/taps.ts`) drawn by the same code into parts, with the lever at rest. `spout` is where its
 * water thread starts, so a host can put a tap of the fluids world there; the water thread itself is not drawn.
 */
export function tapSpec(THREE: Three, opts: TapSpecOptions = {}): TapSpecResult {
  const renderer = rendererOf(THREE, opts.document)
  const { K, shared } = renderer.internals
  const kind = opts.kind ?? 'counter'
  const root: Mount = { x: 1, z: 0, ry: 0, w: 0.3, d: 0.3, h: 0.3, y: 0, base: 0, seed: `tap_${kind}` }
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
  const water = K.PARTS.slice(before).find((p) => p.type === 'water_tap')
  if (!water) throw new Error('game-floorplan-three: the tap drew no water thread')
  K.PARTS.length = before
  return { spec: made.spec, build: made.build, spout: [water.pos[0] - root.x, water.pos[1], water.pos[2] - root.z] }
}
