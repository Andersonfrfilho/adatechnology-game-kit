import type { BodyMeasures } from '@adatechnology/game-contracts'

import body from '../data/body.json'
import { assertHeight } from './height'

/** Documented anthropometric source for the ratios in `ANTHROPOMETRY_RATIOS`. */
export const ANTHROPOMETRY_SOURCE: string = body.anthropometry.source

/** Anthropometric ratios over standing `heightMetres` (from `data/body.json`). */
export const ANTHROPOMETRY_RATIOS = {
  seatedHeightRatio: body.anthropometry.seatedHeightRatio,
  seatedEyeHeightRatio: body.anthropometry.seatedEyeHeightRatio,
  shoulderWidthRatio: body.anthropometry.shoulderWidthRatio,
  thighLengthRatio: body.anthropometry.thighLengthRatio,
  shinLengthRatio: body.anthropometry.shinLengthRatio,
} as const

export type BodyMeasuresParams = {
  /** Standing skull-top stature in metres (validated via `assertHeight`). */
  readonly heightMetres: number
  /** Lateral build multiplier (default 1.0). */
  readonly build?: number
}

/** Pure anthropometric derivation of seated/standing body dimensions from `heightMetres` and `build` (Spec 012 R4). */
export const bodyMeasures = ({ heightMetres, build = 1 }: BodyMeasuresParams): BodyMeasures => {
  const h = assertHeight(heightMetres)
  if (!Number.isFinite(build) || build <= 0) {
    throw new RangeError(`Character build ${String(build)} must be a finite positive number.`)
  }
  return {
    heightMetres: h,
    build,
    seatedHeightMetres: h * ANTHROPOMETRY_RATIOS.seatedHeightRatio,
    seatedEyeHeightMetres: h * ANTHROPOMETRY_RATIOS.seatedEyeHeightRatio,
    shoulderWidthMetres: h * ANTHROPOMETRY_RATIOS.shoulderWidthRatio * build,
    thighLengthMetres: h * ANTHROPOMETRY_RATIOS.thighLengthRatio,
    shinLengthMetres: h * ANTHROPOMETRY_RATIOS.shinLengthRatio,
  }
}
