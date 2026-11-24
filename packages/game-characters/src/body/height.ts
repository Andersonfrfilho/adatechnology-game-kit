import body from '../data/body.json'

/** Nominal stature in metres of the reference adult body (from `data/body.json`). */
export const REFERENCE_HEIGHT_METRES: number = body.guide.heightMetres

/** Supported height range in metres for characters (children through Brutamonte). */
export const HEIGHT_RANGE_METRES: { readonly min: number; readonly max: number } = {
  min: body.heightRangeMetres.min,
  max: body.heightRangeMetres.max,
}

/** Body types that declare their own nominal height in metres in `data/body.json`. */
export const BODY_TYPE_IDS = [
  'human',
  'Lento',
  'Corredor',
  'Brutamonte',
  'Rastejante',
  'Gritador',
  'Inchado',
  'Espreitador',
  'Farejador',
  'Saltador',
  'Cego',
  'Afogado',
  'Carbonizado',
  'Devorador',
] as const

export type BodyTypeId = (typeof BODY_TYPE_IDS)[number]

/** Nominal standing skull-top height in metres for each body type. */
export const HEIGHTS_BY_TYPE_METRES: Readonly<Record<BodyTypeId, number>> = body.heightsByTypeMetres

/** Typed error thrown when a requested character height in metres is outside the supported range. */
export class InvalidHeightError extends RangeError {
  readonly code = 'INVALID_HEIGHT' as const
  readonly heightMetres: number
  readonly minMetres: number
  readonly maxMetres: number

  constructor(heightMetres: number, minMetres: number = HEIGHT_RANGE_METRES.min, maxMetres: number = HEIGHT_RANGE_METRES.max) {
    super(`Character height ${String(heightMetres)} m is outside the supported range [${minMetres}, ${maxMetres}] m.`)
    this.name = 'InvalidHeightError'
    this.heightMetres = heightMetres
    this.minMetres = minMetres
    this.maxMetres = maxMetres
  }
}

/** Validates that `heightMetres` is finite and within `HEIGHT_RANGE_METRES`, throwing `InvalidHeightError` otherwise. */
export const assertHeight = (heightMetres: number): number => {
  if (!Number.isFinite(heightMetres) || heightMetres < HEIGHT_RANGE_METRES.min || heightMetres > HEIGHT_RANGE_METRES.max) {
    throw new InvalidHeightError(heightMetres)
  }
  return heightMetres
}

/** Declared standing height in metres for `type`, falling back to `REFERENCE_HEIGHT_METRES`. */
export const defaultHeightMetres = (type?: string): number => {
  if (type && Object.prototype.hasOwnProperty.call(HEIGHTS_BY_TYPE_METRES, type)) {
    return HEIGHTS_BY_TYPE_METRES[type as BodyTypeId]
  }
  return REFERENCE_HEIGHT_METRES
}

/** Converts a standing height in metres to a scale factor relative to `type`'s declared height (or `REFERENCE_HEIGHT_METRES`). */
export const heightFactor = (heightMetres: number, type?: string): number => {
  const valid = assertHeight(heightMetres)
  return valid / defaultHeightMetres(type)
}
