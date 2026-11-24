import cabinData from './data/cabin.json'

/** Vehicle cabin categories covered by the R6 interior clearance table. */
export const CABIN_CATEGORIES = [
  'passenger_car',
  'suv_pickup',
  'van',
  'truck',
  'bus',
  'agricultural',
  'military_light',
  'military_armored',
  'open_vehicle',
  'boat_cabin',
  'aircraft_enclosed',
] as const

export type CabinCategory = (typeof CABIN_CATEGORIES)[number]

/** Minimum door opening dimensions for a cabin category, in metres. */
export type CabinDoorMinimum = {
  readonly widthMetres: number
  readonly heightMetres: number
}

/** Minimum interior clearances for one vehicle cabin category, in metres (`Infinity` means unobstructed/open). */
export type CabinMinimum = {
  readonly frontHeadroomMetres: number
  readonly rearHeadroomMetres: number | undefined
  readonly frontLegroomMetres: number
  readonly widthMetres: number
  readonly door: CabinDoorMinimum | undefined
}

type RawCabinEntry = {
  readonly frontHeadroomMetres: number | null
  readonly rearHeadroomMetres: number | null
  readonly frontLegroomMetres: number | null
  readonly widthMetres: number | null
  readonly door: { readonly widthMetres: number; readonly heightMetres: number } | null
}

const toClearance = (value: number | null): number => (value === null ? Number.POSITIVE_INFINITY : value)

const toCabinMinimum = (category: CabinCategory, raw: RawCabinEntry): CabinMinimum => {
  if (category === 'open_vehicle') {
    return {
      frontHeadroomMetres: Number.POSITIVE_INFINITY,
      rearHeadroomMetres: Number.POSITIVE_INFINITY,
      frontLegroomMetres: Number.POSITIVE_INFINITY,
      widthMetres: Number.POSITIVE_INFINITY,
      door: undefined,
    }
  }
  return {
    frontHeadroomMetres: toClearance(raw.frontHeadroomMetres),
    rearHeadroomMetres: raw.rearHeadroomMetres === null ? undefined : raw.rearHeadroomMetres,
    frontLegroomMetres: toClearance(raw.frontLegroomMetres),
    widthMetres: toClearance(raw.widthMetres),
    door: raw.door === null ? undefined : { widthMetres: raw.door.widthMetres, heightMetres: raw.door.heightMetres },
  }
}

/** Documented source of the cabin clearance table and entry duck factor. */
export const CABIN_SOURCE: string = cabinData.source

/** Fraction of standing height required vertically when ducking through a side vehicle door. */
export const ENTRY_DUCK_FACTOR: number = cabinData.entryDuckFactor

/** Minimum interior clearances by cabin category (Spec 012 R6). */
export const CABIN_MINIMUMS: Readonly<Record<CabinCategory, CabinMinimum>> = Object.fromEntries(
  CABIN_CATEGORIES.map((category) => [category, toCabinMinimum(category, cabinData.categories[category])]),
) as Readonly<Record<CabinCategory, CabinMinimum>>

/** Returns the minimum interior clearances for a cabin category. */
export const cabinMinimumOf = (category: CabinCategory): CabinMinimum => CABIN_MINIMUMS[category]
