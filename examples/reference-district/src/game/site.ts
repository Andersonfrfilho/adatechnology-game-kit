import type { PlanPoint, PlanRect } from '@adatechnology/game-urban'

import {
  readField,
  readList,
  readNumber,
  readOneOf,
  readOptional,
  readPositive,
  readPoint,
  readRecord,
  readRect,
  readString,
} from './read'
import type { Reader } from './read'

export type LotFront = 'n' | 's' | 'e' | 'w'
export type LotState = 'none' | 'fortified' | 'abandoned' | 'draw'
export type PropKind = 'vehicle' | 'prop'
export type HordeProfile = 'runner' | 'walker'

export type Lot = {
  readonly id: string
  /** The lot in metres; `front` is the side facing the street. */
  readonly rect: PlanRect
  readonly front: LotFront
  /** Id of a template of a floorplan engine; the owning package resolves it. */
  readonly typology: string
  /** Zone of the lot when it differs from the district's (a pharmacy in the popular quarter is `zc`). */
  readonly zone?: string
  readonly state?: LotState
  /** `lod`: enterable when the house LOD (`planLod`) comes close. */
  readonly enterable?: 'lod' | 'never'
}

export type Prop = {
  readonly id: string
  readonly kind: PropKind
  readonly ref: string
  readonly at: PlanPoint
  readonly ry?: number
  readonly y?: number
}

export type HordeZone = {
  readonly id: string
  readonly rect: PlanRect
  readonly share: number
  readonly profile: HordeProfile
}

/** A piece the kit still lacks: drawn as a warning box until its task puts the real piece in its place. */
export type Missing = {
  readonly id: string
  readonly what: string
  /** Packages that own the piece (`packages/<folder>`). */
  readonly owner: readonly string[]
  readonly task: string
  readonly rect: PlanRect
  readonly height: number
}

export type Site = {
  /** Id of the plan in `game-urban`. */
  readonly plan: string
  readonly seed: number
  readonly lots: readonly Lot[]
  readonly props: readonly Prop[]
  readonly hordes: readonly HordeZone[]
  readonly missing: readonly Missing[]
}

const readLot: Reader<Lot> = (value, path) => {
  const record = readRecord(value, path)
  return {
    id: readField(record, path, 'id', readString),
    rect: readField(record, path, 'rect', readRect),
    front: readField(record, path, 'front', readOneOf(['n', 's', 'e', 'w'])),
    typology: readField(record, path, 'typology', readString),
    zone: readOptional(record, path, 'zone', readString),
    state: readOptional(record, path, 'state', readOneOf(['none', 'fortified', 'abandoned', 'draw'])),
    enterable: readOptional(record, path, 'enterable', readOneOf(['lod', 'never'])),
  }
}

const readProp: Reader<Prop> = (value, path) => {
  const record = readRecord(value, path)
  return {
    id: readField(record, path, 'id', readString),
    kind: readField(record, path, 'kind', readOneOf(['vehicle', 'prop'])),
    ref: readField(record, path, 'ref', readString),
    at: readField(record, path, 'at', readPoint),
    ry: readOptional(record, path, 'ry', readNumber),
    y: readOptional(record, path, 'y', readNumber),
  }
}

const readHordeZone: Reader<HordeZone> = (value, path) => {
  const record = readRecord(value, path)
  return {
    id: readField(record, path, 'id', readString),
    rect: readField(record, path, 'rect', readRect),
    share: readField(record, path, 'share', readPositive),
    profile: readField(record, path, 'profile', readOneOf(['runner', 'walker'])),
  }
}

const readMissing: Reader<Missing> = (value, path) => {
  const record = readRecord(value, path)
  return {
    id: readField(record, path, 'id', readString),
    what: readField(record, path, 'what', readString),
    owner: readField(record, path, 'owner', readList(readString)),
    task: readField(record, path, 'task', readString),
    rect: readField(record, path, 'rect', readRect),
    height: readField(record, path, 'height', readPositive),
  }
}

/** Checks the parsed JSON of a site file; an error names the field (`$.lots[2].rect`). */
export function parseSite(json: unknown): Site {
  const record = readRecord(json, '$')
  return {
    plan: readField(record, '$', 'plan', readString),
    seed: readField(record, '$', 'seed', readNumber),
    lots: readField(record, '$', 'lots', readList(readLot)),
    props: readField(record, '$', 'props', readList(readProp)),
    hordes: readField(record, '$', 'hordes', readList(readHordeZone)),
    missing: readField(record, '$', 'missing', readList(readMissing)),
  }
}
