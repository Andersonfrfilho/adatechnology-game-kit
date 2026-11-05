/**
 * The kernel `K` is the closure the team's Casa3DSDK kept in one function: every installer of a module reads what the earlier ones
 * defined from it and adds what it defines (`Object.assign(K, ...)`). `Shared` holds the per-house state `enter(house)` swaps.
 *
 * The members are typed module by module (`KernelGeometry`, ...). Until every installer is typed, the index signature keeps the members
 * of the modules not yet typed reachable; it goes away with the last one (docs/migracao-typescript.md). The modules already typed are
 * checked with `strict` by `tsconfig.strict.json`.
 */
import type * as THREE_NS from 'three'

export type Three = typeof THREE_NS
export type Vec3 = [number, number, number]
/** A colour as three.js takes it: `0xrrggbb`. */
export type Hex = number

/** Vertex arrays of a template geometry (`GEO.box`, `GEO.cyl`...). */
export interface GeoData {
  p: ArrayLike<number>
  n: ArrayLike<number>
  u: ArrayLike<number>
  i: ArrayLike<number> | null
  nv: number
}

/** Atlas cell of a face (`u0..v1`), its rotation in quarter turns, a mirror flag and a per-vertex colour multiplier. */
export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
  rot?: number
  fx?: boolean | number
  vc?: (x: number, z: number) => readonly number[]
}

/** A destruction piece being drawn: the meshes record where it starts so a hit finds it again. */
export interface PieceRecord {
  id: string
  mat: string
  role: string | null
  floor?: number
  [extra: string]: unknown
}

/** Where a piece starts inside an accumulator. */
export interface PieceLimit {
  pc: PieceRecord | null
  v: number
  i: number
}

/** Vertex and index buffers of one group and material (one mesh per pair). */
export interface Accumulator {
  cv: number
  ci: number
  p: Float32Array
  n: Float32Array
  c: Float32Array
  u: Float32Array
  i: Uint32Array
  nv: number
  ni: number
  lim: PieceLimit[]
  cur: PieceRecord | null
  piece0: PieceRecord | null
  mat: string
  group: string
  ensure(nv: number, ni: number): void
}

/** The drawing cursor: the group and piece being drawn, the accumulators, and the origin and rotation of the part in progress. */
export interface Cursor {
  group: string
  accs: Map<string, Accumulator>
  rot: unknown[]
  org: readonly number[]
  ry: number
  pc?: PieceRecord | null
  separate?: boolean
}

/** How a moving part opens: `swing`/`toggle` turn about `axis` by `angle`, `slide` moves `dist`, `scale` scales by `k`. */
export interface PartOpens {
  type: string
  axis?: readonly number[]
  angle?: number
  dist?: number
  k?: number
  [extra: string]: unknown
}

/** Metadata of a moving part (userData of its group). */
export interface PartMeta {
  id?: string
  opens?: PartOpens
  hidden?: boolean
  t0?: number
  [extra: string]: unknown
}

export interface PartRecord {
  name: string
  parent: string
  pos: number[]
  type: string
  meta: PartMeta
  ry: number
}

/** A real mirror to assemble at the end of the build (`furniture/fixtures` writes it, `mirrors.ts` assembles it). */
export interface MirrorRecord {
  x: number
  y: number
  z: number
  ry: number
  w: number
  h: number
  room: unknown
  floor: number
  parent: string
}

/** Axis-aligned box by its corners: material, min corner, max corner, colour. */
export type BoxFn = (mat: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Hex) => void

/** What `kernel/geometry` puts on the kernel: the accumulators and the primitives every builder draws with. */
export interface KernelGeometry {
  GEO: Record<string, GeoData>
  UV_SCALE: Record<string, number>
  WITH_MAP: Record<string, number>
  Accumulator: new () => Accumulator
  cursor: Cursor
  PARTS: PartRecord[]
  /** Real mirrors to assemble at the end (`mirrors.ts` writes them). */
  MIRRORS: MirrorRecord[]
  part(type: string, pos: readonly number[], fn: () => void, meta?: PartMeta, parent?: string | null, ry?: number): string
  applyPart(g: THREE_NS.Object3D, t: number): void
  _Y: THREE_NS.Vector3
  _qa: THREE_NS.Quaternion
  _qb: THREE_NS.Quaternion
  pieceRecord(id: string, mat: string, role?: string | null, extra?: Record<string, unknown>): PieceRecord
  structurePiece(id: string): PieceRecord | null
  accFor(mat: string): Accumulator
  _q: THREE_NS.Quaternion
  _e: THREE_NS.Euler
  _col: THREE_NS.Color
  rgbOf(h: Hex): Vec3
  put(mat: string, geo: string, px: number, py: number, pz: number, q: THREE_NS.Quaternion, sx: number, sy: number, sz: number, color: Hex, uvr?: UvRect | null): void
  boxC(mat: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Hex, rx?: number, ry?: number, rz?: number, uvr?: UvRect | null): void
  bx: BoxFn
  getBx(): BoxFn
  setBx(f: BoxFn): void
  cylBase(mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex, seg?: string): void
  polyFace(mat: string, pts: readonly (readonly number[])[], color: Hex, hint?: readonly number[] | null): void
}

/** What `kernel/noise` puts on the kernel. */
export interface KernelNoise {
  _h2(x: number, z: number): number
  vnoise(x: number, z: number): number
  /** Per-vertex RGB multiplier of a ground (`dirt` or other). */
  macroGround(x: number, z: number, type: string): Vec3
}

/** What `kernel/close-scene` puts on the kernel. */
export interface KernelCloseScene {
  markMesh(m: THREE_NS.Mesh, A: Accumulator): void
  closeScene(mats: Record<string, THREE_NS.Material>): Record<string, THREE_NS.Group>
}

/** The modules typed so far, and the members of the others by name until they are typed. */
export interface Kernel extends KernelGeometry, KernelNoise, KernelCloseScene {
  [member: string]: any
}

export type Shared = Record<string, any>
export type Installer = (K: Kernel, shared: Shared) => any
