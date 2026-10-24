import type { DamageType, DestructionEvent, Vec3 } from '@adatechnology/game-contracts'

import type { BodyState } from '../body/body-state'
import { segmentOf } from '../body/body-state'
import { segmentNode, segmentsBelow } from '../body/segment-tree'
import type { SegmentId, SegmentSide } from '../body/segment-tree'
import type { ResolvedCharacterSpec } from '../character'
import type { SegmentState } from '../types'
import { BLOOD_LITERS_PER_DROP } from './bleeding'
import type { Bleeder } from './bleeding'
import type { DamageRules, DeathRule } from './types'

type BodyChange = Extract<DestructionEvent, { type: 'body' }>['change']
type KillCause = 'head' | 'vitality' | 'bleed' | 'explosion'
type EventDraft = DestructionEvent extends infer E ? (E extends DestructionEvent ? Omit<E, 'object' | 'time'> : never) : never

export type BleedParams = { readonly segment: SegmentState; readonly rate: number; readonly duration: number; readonly spurt: boolean; readonly point?: Vec3; readonly direction?: Vec3 }

/** How severing treats what hangs below: the Arsenal only detaches it, the Elenco also zeroes it and marks it cut. */
export type SeverBelow = 'detach' | 'zero'

/** Every change a damage rule can make to a body, each emitting its events. The rules (kit, arsenal, elenco, regions) only decide. */
export type BodyOps = {
  readonly body: BodyState
  readonly spec: ResolvedCharacterSpec
  readonly rules: DamageRules
  readonly random: () => number
  readonly events: DestructionEvent[]
  emit(event: EventDraft): void
  pointOf(id: SegmentId): Vec3
  change(change: BodyChange, part?: SegmentId, extra?: { cause?: KillCause; below?: string[] }): void
  damage(segment: SegmentState, amount: number, damageType: DamageType): void
  wound(segment: SegmentState): void
  breakBone(segment: SegmentState): void
  sever(segment: SegmentState, below?: SeverBelow): void
  destroy(segment: SegmentState): void
  kill(cause: KillCause): void
  limp(side: SegmentSide): void
  crawl(): void
  /** A heavy hit staggers the body for the spec's `stunSeconds`. */
  stun(): void
  bleed(params: BleedParams): void
}

export type CreateBodyOpsParams = {
  readonly body: BodyState
  readonly spec: ResolvedCharacterSpec
  readonly rules: DamageRules
  readonly random: () => number
  readonly time: number
  readonly source?: string
  readonly pointOf: (id: SegmentId) => Vec3
  readonly bleeders: Bleeder[]
}

const killAllowed = (rule: DeathRule, cause: KillCause): boolean => rule === 'vitality-or-head' || cause === 'head' || cause === 'explosion'

export const createBodyOps = ({ body, spec, rules, random, time, source, pointOf, bleeders }: CreateBodyOpsParams): BodyOps => {
  const events: DestructionEvent[] = []
  const emit = (event: EventDraft): void => void events.push({ ...event, object: spec.id, time, ...(source !== undefined ? { source } : {}) } as DestructionEvent)
  const change: BodyOps['change'] = (kind, part, extra) => emit({ type: 'body', change: kind, ...(part ? { part } : {}), ...extra })
  const detachBelow = (segment: SegmentState, below: SeverBelow): SegmentId[] => {
    const fallen = segmentsBelow(segment.id).filter((id) => segmentOf(body, id).attached)
    segment.attached = false
    for (const id of fallen) {
      const part = segmentOf(body, id)
      part.attached = false
      if (below === 'zero') Object.assign(part, { hp: 0, status: 'severed' })
    }
    return fallen
  }
  const ops: BodyOps = {
    body,
    spec,
    rules,
    random,
    events,
    emit,
    pointOf,
    change,
    damage: (segment, amount, damageType) => emit({ type: 'damage', part: segment.id, amount, hp: Math.max(0, segment.hp), damageType }),
    wound(segment) {
      if (segment.status === 'ok') segment.status = 'wounded'
      change('wound', segment.id)
    },
    breakBone(segment) {
      segment.status = 'broken'
      change('broken', segment.id)
    },
    sever(segment, below = 'detach') {
      if (!segment.attached) return
      const fallen = detachBelow(segment, below)
      segment.status = 'severed'
      body.pieces.push([segment.id, ...fallen])
      const parent = segmentNode(segment.id).parent
      change('severed', segment.id, { below: fallen })
      if (parent) emit({ type: 'detach', joint: `${parent}~${segment.id}`, parts: [parent, segment.id], by: 'break', groups: [[segment.id, ...fallen]] })
    },
    destroy(segment) {
      if (!segment.attached) return
      const fallen = detachBelow(segment, 'detach')
      segment.status = 'destroyed'
      if (fallen.length > 0) body.pieces.push(fallen)
      change('destroyed', segment.id, { below: fallen })
      emit({ type: 'fracture', part: segment.id, style: 'tear', fragments: [], point: pointOf(segment.id) })
    },
    kill(cause) {
      if (!body.alive || !killAllowed(rules.deathRule, cause)) return
      body.alive = false
      change('killed', undefined, { cause })
    },
    limp(side) {
      if (body.limping.includes(side)) return
      body.limping.push(side)
      change('limp')
    },
    crawl() {
      if (body.crawl) return
      body.crawl = true
      change('crawl')
    },
    stun() {
      body.stunSeconds = spec.stunSeconds
      change('stunned')
    },
    bleed({ segment, rate, duration, spurt, point, direction }) {
      const scaled = rate * spec.bloodFactor
      bleeders.push({ part: segment.id, rate: scaled, duration, spurt, age: 0, reported: 0 })
      emit({ type: 'leak', part: segment.id, fluid: 'blood', point: point ?? pointOf(segment.id), direction: direction ?? [0, -1, 0], rate: scaled * BLOOD_LITERS_PER_DROP, pressurized: spurt })
    },
  }
  return ops
}
