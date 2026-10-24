import type { SegmentKind } from '@adatechnology/game-contracts'

import type { Detail, SegmentState } from '../types'
import { LIMB_REGIONS, REGION_HIT_POINTS, REGION_SEGMENTS } from './regions'
import type { LimbRegion } from './regions'
import { SEGMENT_TREE } from './segment-tree'
import type { SegmentId, SegmentSide } from './segment-tree'

/** The mutable state of one body. Both detail levels live here: the 17 segments and the hit points of the 5 crowd regions. */
export type BodyState = {
  readonly segments: SegmentState[]
  readonly regions: Record<LimbRegion, number>
  vitality: number
  readonly maxVitality: number
  alive: boolean
  /** The game's `MISSING_BITS` mask. */
  missing: number
  /** Sides that limp, in the order they started. */
  readonly limping: SegmentSide[]
  crawl: boolean
  stunSeconds: number
  /** Loose pieces: each severed segment with what fell with it. */
  readonly pieces: SegmentId[][]
  /** Protection layers used up (a helmet that took its one shot). */
  readonly consumed: Set<string>
  detail: Detail
}

export type CreateBodyStateParams = { readonly vitality: number; readonly detail: Detail; readonly hitPointsOf: (kind: SegmentKind) => number }

export const createBodyState = ({ vitality, detail, hitPointsOf }: CreateBodyStateParams): BodyState => ({
  segments: SEGMENT_TREE.map((node) => {
    const max = hitPointsOf(node.kind)
    return { id: node.id, kind: node.kind, region: node.region, hp: max, max, status: 'ok', attached: true, ...(node.side ? { side: node.side } : {}) }
  }),
  regions: { ...REGION_HIT_POINTS },
  vitality,
  maxVitality: vitality,
  alive: true,
  missing: 0,
  limping: [],
  crawl: false,
  stunSeconds: 0,
  pieces: [],
  consumed: new Set(),
  detail,
})

export const segmentOf = (body: BodyState, id: SegmentId): SegmentState => {
  const segment = body.segments.find((candidate) => candidate.id === id)
  if (!segment) throw new Error(`game-characters: unknown segment "${id}"`)
  return segment
}

/** Region hit points from the segments: the share of the region's segment hit points left, scaled to the region's own hit points. */
export const regionsFromSegments = (body: BodyState): void => {
  for (const region of LIMB_REGIONS) {
    const parts = REGION_SEGMENTS[region].map((id) => segmentOf(body, id))
    const left = parts.reduce((sum, part) => sum + (part.attached ? Math.max(0, part.hp) : 0), 0)
    const total = parts.reduce((sum, part) => sum + part.max, 0)
    body.regions[region] = (REGION_HIT_POINTS[region] * left) / total
  }
}

/** Segment hit points from the regions (the reverse is lossy: every segment of a region keeps the region's share). */
export const segmentsFromRegions = (body: BodyState): void => {
  for (const region of LIMB_REGIONS) {
    const share = Math.max(0, body.regions[region]) / REGION_HIT_POINTS[region]
    for (const id of REGION_SEGMENTS[region]) {
      const part = segmentOf(body, id)
      if (part.attached) part.hp = Math.min(part.hp, part.max * share)
    }
  }
}
