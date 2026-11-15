import type { Triangle, Vec3 } from './coincident-geometry'

/** One draw batch with its triangles already in world space (metres). */
export interface CoincidentBatch {
  readonly positions: ArrayLike<number>
  readonly indices?: ArrayLike<number>
  /** Names the batch in the report: mesh name, part, material. */
  readonly label?: string
  /** The material draws both sides: back-to-back faces of a thin wall then show through each other. */
  readonly doubleSided?: boolean
  /**
   * Near mode: how the batch is shaded (a material's identity). Two faces of one look, facing exactly alike, with the same vertex colour and the same texture
   * coordinates where they overlap, draw the very same pixels whichever wins the depth test: their overlap cannot flicker and is not reported.
   */
  readonly look?: string
  /** Near mode: red, green and blue per vertex (indexed as `positions`), when the look takes its colour from the vertices. */
  readonly colors?: ArrayLike<number>
  /** Near mode: texture coordinates per vertex (indexed as `positions`), when the look has a texture. */
  readonly uvs?: ArrayLike<number>
}

/** The camera whose depth buffer decides how close two faces can be before they flicker. */
export interface DepthPrecision {
  /** Distance (m) at which two faces are compared. */
  readonly viewDistance: number
  readonly near: number
  readonly far: number
  readonly depthBits: number
}

/** The game's main camera (near 0.05, far 140, 24-bit depth) seen from 30 m. */
export const GAME_DEPTH_PRECISION: DepthPrecision = { viewDistance: 30, near: 0.05, far: 140, depthBits: 24 }

/** Smallest separation (m) the depth buffer tells apart at `viewDistance`: z² (far - near) / (far near 2^bits). About 1.07 mm for the game camera at 30 m. */
export function depthResolution(precision: DepthPrecision = GAME_DEPTH_PRECISION): number {
  const { viewDistance: z, near, far, depthBits } = precision
  return (z * z * (far - near)) / (far * near * 2 ** depthBits)
}

export interface CoincidentFacesOptions {
  /** Two parallel faces nearer than this (metres) are on the same plane and z-fight. Default 0.001. */
  readonly eps?: number
  /** Overlaps smaller than this (m²) are edge contacts nobody sees. Default 1e-4 (one square centimetre). */
  readonly minArea?: number
  /** Stop after this many hits (a broken house can have thousands). Default 200. */
  readonly maxHits?: number
  /**
   * Near mode: besides exactly coplanar faces, also catches nearly parallel faces (under 2°) whose separation inside the overlap is under the
   * depth-buffer resolution at that distance (it replaces `eps`), and back-to-back faces of a thin double-sided wall. Default off.
   */
  readonly depth?: DepthPrecision
  /** Near mode: hits kept per pair of part kinds (digits in names ignored), so one broken pair does not drown the rest. Default 3. */
  readonly maxPerPair?: number
}

/** Two triangles on the same plane, facing the same way, that overlap: the renderer flickers between them. */
export interface CoincidentFaceHit {
  readonly normal: Vec3
  readonly offset: number
  readonly area: number
  /** A point inside the overlap, in world space. */
  readonly point: Vec3
  readonly labelA: string
  readonly labelB: string
  /** Near mode: `coplanar` (same facing) or `opposed` (back to back, double-sided), with the gap in metres. */
  readonly kind?: 'coplanar' | 'opposed'
  readonly separation?: number
  /** Index in the input of the batch of each triangle. */
  readonly batchA: number
  readonly batchB: number
}

/** The box of a triangle: min x, y, z then max x, y, z. */
export function boxOf(t: Triangle): readonly [number, number, number, number, number, number] {
  const xs = [t[0][0], t[1][0], t[2][0]], ys = [t[0][1], t[1][1], t[2][1]], zs = [t[0][2], t[1][2], t[2][2]]
  return [Math.min(...xs), Math.min(...ys), Math.min(...zs), Math.max(...xs), Math.max(...ys), Math.max(...zs)]
}
