import type { DestructibleSpec, ObjectState, Quat, Vec3 } from '@adatechnology/game-contracts'

import type { BodySpec } from './body/body-spec'
import { createBodyState, regionsFromSegments, segmentsFromRegions } from './body/body-state'
import type { BodyState } from './body/body-state'
import { describeBody } from './body/describe'
import { toObjectState } from './body/object-state'
import type { LimbRegion } from './body/regions'
import { createRig } from './body/rig'
import type { Rig } from './body/rig'
import { SEGMENT_NUMBERS } from './body/segment-tree'
import type { BodyMultipliers, CharacterSpec, Detail, SegmentState } from './types'

/** A spec with every default filled in. */
export type ResolvedCharacterSpec = CharacterSpec & {
  readonly id: string
  readonly height: number
  readonly build: number
  readonly vitality: number
  readonly multipliers: BodyMultipliers
  readonly limbFactor: number
  readonly bloodFactor: number
  readonly bodyCount: number
  readonly stunSeconds: number
  readonly protection: readonly string[]
  readonly detail: Detail
}

export type Character = {
  readonly id: string
  readonly spec: ResolvedCharacterSpec
  readonly rig: Rig
  /** Live view of the 17 segments. */
  readonly segments: readonly SegmentState[]
  readonly detail: Detail
  /** Hit points of the 5 crowd regions (head, arms, legs). */
  regionHitPoints(): Readonly<Record<LimbRegion, number>>
  /** Swaps the detail level: segments to regions sums each region (lossless); regions to segments spreads the region's share (lossy). */
  setDetail(detail: Detail): void
  setTransform(position: Vec3, rotation?: Quat): void
  describe(): DestructibleSpec
  state(): ObjectState
  reset(): void
}

export const DEFAULT_VITALITY = 100
export const DEFAULT_STUN_SECONDS = 0.45
const NO_MULTIPLIERS: BodyMultipliers = { head: 1, torso: 1, arms: 1, legs: 1 }

export const resolveSpec = (spec: CharacterSpec, body: BodySpec, counter: number): ResolvedCharacterSpec => ({
  ...spec,
  id: spec.id ?? `${spec.kind}_${counter}`,
  height: spec.height ?? body.heightMetres,
  build: spec.build ?? 1,
  vitality: spec.vitality ?? DEFAULT_VITALITY,
  multipliers: { ...NO_MULTIPLIERS, ...spec.multipliers },
  limbFactor: spec.limbFactor ?? 1,
  bloodFactor: spec.bloodFactor ?? 1,
  bodyCount: spec.bodyCount ?? 1,
  stunSeconds: spec.stunSeconds ?? DEFAULT_STUN_SECONDS,
  protection: spec.protection ?? [],
  detail: spec.detail ?? 'segments',
})

export type CharacterCore = {
  readonly spec: ResolvedCharacterSpec
  readonly rig: Rig
  readonly body: BodyState
  position: Vec3
  rotation: Quat
  readonly describe: () => DestructibleSpec
  /** Back to the state at creation (full health, every segment attached). */
  readonly resetBody: () => void
}

export type CreateCharacterCoreParams = { readonly spec: ResolvedCharacterSpec; readonly bodySpec: BodySpec; readonly hitPointsOf?: (kind: SegmentState['kind']) => number }

/** The state every character shares: rig, body state, transform and the cached part list. */
export const createCharacterCore = ({ spec, bodySpec, hitPointsOf }: CreateCharacterCoreParams): CharacterCore => {
  const rig = createRig({ body: bodySpec, height: spec.height, build: spec.build })
  const parts = describeBody({ rig, body: bodySpec, build: spec.build, name: spec.kind })
  const fresh = (): BodyState => createBodyState({ vitality: spec.vitality, detail: spec.detail, hitPointsOf: hitPointsOf ?? ((kind) => SEGMENT_NUMBERS[kind].hitPoints) })
  const body = fresh()
  return { spec, rig, body, position: [0, 0, 0], rotation: [0, 0, 0, 1], describe: () => parts, resetBody: () => void Object.assign(body, fresh()) }
}

/** The plain-data part of a character (state, detail and transform); the damage model is added on top of it. */
export const characterView = (core: CharacterCore): Character => ({
  id: core.spec.id,
  spec: core.spec,
  rig: core.rig,
  get segments() {
    return core.body.segments
  },
  get detail() {
    return core.body.detail
  },
  regionHitPoints: () => ({ ...core.body.regions }),
  setDetail(detail) {
    if (detail === core.body.detail) return
    if (detail === 'regions') regionsFromSegments(core.body)
    else segmentsFromRegions(core.body)
    core.body.detail = detail
  },
  setTransform(position, rotation) {
    core.position = [...position]
    if (rotation) core.rotation = [...rotation]
  },
  describe: core.describe,
  state: () => toObjectState({ id: core.spec.id, name: core.spec.kind, position: core.position, rotation: core.rotation, body: core.body, spec: core.describe() }),
  reset: core.resetBody,
})
