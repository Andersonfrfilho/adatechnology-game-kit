/**
 * Types of the hull-surface toolkit the car files share (`mkSurf`, `sgrid`, `skin`, `mkKit`): a sampler of the body shell, the grids
 * laid on its ends, the skin layers drawn over them and the end-detail kit (headlights, taillights, bumpers, plates, grilles) bound to a car.
 */
import type { Greenhouse, LabelArgument } from '@adatechnology/game-vehicles'
import type { Box3, Material, Mesh, Vector3 } from 'three'

/** A point on the bodywork and its outward normal. */
export interface SurfHit {
  p: Vector3
  n: Vector3
}

/** A sampler of a hull mesh (in the car's frame, before the warp). */
export interface Surf {
  bb: Box3
  /** Half width of the body. */
  hw: number
  /** First hit of the ray from `o` along `d` (the third argument names the end for the caller, it is not read). */
  hit(o: Vector3, d: Vector3, which?: string): SurfHit | null
  /** x of the skin at the front (E = +1) or the rear (E = -1) at height y. */
  endX(E: number, y: number): number
}

/** Where a grid lies on an end: along the face (z0..z1), round the corner and `wrap` metres along the side, from y0 to y1. */
export interface GridSpec {
  z0?: number
  z1?: number | null
  wrap?: number
  nu?: number
  nv?: number
  du?: number
  dv?: number
  y0: number
  y1: number
}

/** A grid of points and normals sampled on an end of the body. */
export interface SurfGrid {
  P: Vector3[][]
  N: Vector3[][]
  nu: number
  nv: number
  y0: number
  y1: number
  len: number
  E: number
  sd: number
  /** Point and normal at u (0..1 along the grid) and height y. */
  at(u: number, y: number): SurfHit
  /** u of the point at z (face only). */
  uz(z: number): number
  zu(u: number): number
}

/** A number, or a function of u. */
export type AlongU = number | ((u: number) => number)

/** A layer drawn over a grid region u0..u1, yb(u)..yt(u), `off` from the bodywork; `thick` gives it a visible edge. */
export interface SkinSpec {
  u0?: number
  u1?: number | null
  yb: AlongU
  yt: AlongU
  off?: number | null
  nu?: number
  nv?: number
  thick?: number
  tile?: number
  crease?: number
  shadow?: boolean
  order?: number
  def?: boolean
}

/** A region of a grid for `outline`: u0..u1, yb..yt, open between two of its points. */
export interface OutlineSpec {
  u0?: number
  u1?: number | null
  yb: AlongU
  yt: AlongU
  open?: number[]
}

/** A light region on a headlight or taillight (DRL strip, amber, reverse). */
export interface LampRegion {
  u0?: number
  u1?: number
  yb: AlongU
  yt: AlongU
  mat?: Material
}

/** A headlight or taillight drawn on the body: the face (z0, z1, wrap), its outline shape(u) -> [yb, yt] and the regions inside it. */
export interface EndLampSpec {
  z0?: number
  z1?: number
  wrap?: number
  shape: (u: number) => number[]
  pad?: number | null
  label?: LabelArgument
  /** Headlight: projectors [u, dy, r], the DRL and amber strips, bezel and reflector materials. */
  proj?: number[][]
  drl?: LampRegion[]
  amber?: LampRegion[]
  bezel?: Material
  refl?: Material
  /** Taillight: the main area, the bright and reverse regions and the lens. */
  main?: Material
  hi?: LampRegion[]
  rev?: LampRegion[]
  lens?: Material
}

/** A bumper shell over an end. */
export interface BumperSpec {
  wrap?: number
  y0: number
  y1: number
  yb?: AlongU
  yt?: AlongU
  off?: number
  mat: Material
}

/** A grille over a full-width grid. */
export interface GrilleSpec {
  z1?: number
  y0: number
  y1: number
  u0?: number
  u1?: number
  yb?: AlongU
  yt?: AlongU
  off?: number
  tex?: string
  tile?: number
  frame?: Material
  frameR?: number
}

/** A point of a trunk lid seam: on the rear face (y, z) or on the top (x, z, top). */
export interface LidPoint {
  x: number
  y: number
  z: number
  top?: boolean
}

/** The end-detail kit bound to one car (`mkKit`). */
export interface CarDetailKit {
  S: Surf
  I: unknown
  grid(E: number, sd: number, o: GridSpec): SurfGrid
  skin(Gd: SurfGrid, mat: Material, o: SkinSpec): Mesh
  head(sd: number, o: EndLampSpec): SurfGrid
  tail(sd: number, o: EndLampSpec): SurfGrid
  bumper(E: number, o: BumperSpec): Mesh
  plate(E: number, y: number, o?: { off?: number } | null): Mesh
  lid(pts: LidPoint[]): Mesh
  reflector(sd: number, z0: number, y: number, w?: number): Mesh
  grille(E: number, o: GrilleSpec): Mesh
  [extra: string]: unknown
}

/** A vertex of a skin layer. */
export interface SkinVertex {
  p: Vector3
  n: Vector3
  uv: number[]
}

/** The greenhouse of a fleet car: the kit's, plus a lower rear roof (`roofR`), a crown in the middle and a rising beltline. */
export type CarGreenhouse = Greenhouse & { k: number; roofR?: number; crown?: number; rise?: number; r1?: number; r2?: number }
