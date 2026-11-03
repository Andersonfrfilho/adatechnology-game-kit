import type { DestructibleImpl, DestructionEvent, Hit, Vec3 } from '@adatechnology/game-contracts'

import type { BodyState } from '../body/body-state'
import { segmentNode } from '../body/segment-tree'
import type { SegmentId, SegmentSide } from '../body/segment-tree'
import { toLocal, toWorld } from '../body/transform'
import { characterView } from '../character'
import type { Character, CharacterCore } from '../character'
import { stepBleeding } from './bleeding'
import type { Bleeder } from './bleeding'
import { createBodyOps } from './body-ops'
import type { BodyOps } from './body-ops'
import { segmentResistance } from './penetration'
import { applyBlow } from './pipeline'
import { createRng } from './points'
import { layeredProtection, layersOn } from './protection'
import { resolveSegment } from './resolve-part'
import type { BodyHit, CaliberEntry, DamageRules, HitReport, PenetrationModel, ProtectionLayer } from './types'

/** A character with the damage model: a `DestructibleImpl` a destruction world can host next to its own objects. */
export type DamageCharacter = Character &
  DestructibleImpl & {
    readonly alive: boolean
    /** The sides that limp, in the order they started. */
    readonly limping: readonly SegmentSide[]
    /** Seconds of stagger left from a heavy hit. */
    readonly stunSeconds: number
    /** What the last `hit` did (points, kill, headshot, through). */
    readonly lastHit?: HitReport
    /** The bleeding wounds, oldest first. */
    bleeders(): readonly Readonly<Bleeder>[]
    /** 0..1 protection of the layers over a segment against a bite or a scratch (the layered T3 formula, capped at 90 %). */
    protectionAgainst(attack: 'bite' | 'scratch', part: SegmentId): number
    /** Ids of the protection layers worn and not used up (a helmet that took its shot is gone). */
    intactProtection(): readonly string[]
    /** Penetration resistance R of the path through a part (a segment or a region id), with the protection worn over it. */
    resistanceOf(part: string): number
    hit(hit: Hit | BodyHit): DestructionEvent[]
    /** Ages bleeders (a `leak` per second each) and the stun. */
    update(dt: number): DestructionEvent[]
    serialize(): unknown
    load(data: unknown): void
  }

export type DamageSetup = {
  readonly rules: DamageRules
  readonly model: PenetrationModel
  readonly protection: ReadonlyMap<string, ProtectionLayer>
  readonly calibers: ReadonlyMap<string, CaliberEntry>
}

type Saved = { body: Omit<BodyState, 'consumed'> & { consumed: string[] }; bleeders: Bleeder[]; hitCounter: number; clock: number }

export const createDamageCharacter = (core: CharacterCore, setup: DamageSetup): DamageCharacter => {
  const view = characterView(core)
  const worn = core.spec.protection.map((id) => setup.protection.get(id)).filter((layer): layer is ProtectionLayer => layer !== undefined)
  let bleeders: Bleeder[] = []
  let hitCounter = 0
  let clock = 0
  let lastHit: HitReport | undefined
  const transform = () => ({ position: core.position, rotation: core.rotation })
  const jointOf = (id: SegmentId): Vec3 => core.rig.joints[segmentNode(id).joint]
  const pointOf = (id: SegmentId): Vec3 => toWorld(transform(), jointOf(id))
  const opsFor = (random: () => number, source?: string): BodyOps =>
    createBodyOps({ body: core.body, spec: core.spec, rules: setup.rules, random, time: clock, pointOf, bleeders, ...(source !== undefined ? { source } : {}) })

  const character: DamageCharacter = {
    ...view,
    get segments() {
      return core.body.segments
    },
    get detail() {
      return core.body.detail
    },
    get alive() {
      return core.body.alive
    },
    get limping() {
      return [...core.body.limping]
    },
    get stunSeconds() {
      return core.body.stunSeconds
    },
    get lastHit() {
      return lastHit
    },
    name: core.spec.kind,
    hit(raw) {
      const hit = raw as BodyHit
      hitCounter += 1
      const random = core.spec.random ?? createRng((core.spec.seed ^ hitCounter) >>> 0)
      const ops = opsFor(random, hit.source)
      core.invalidateState()
      lastHit = applyBlow({ ops, hit, setup, worn, localPoint: toLocal(transform(), hit.point), jointOf, describe: core.describe })
      core.invalidateState()
      return ops.events
    },
    update(dt) {
      clock += dt
      core.body.stunSeconds = Math.max(0, core.body.stunSeconds - dt)
      const ops = opsFor(() => 0)
      stepBleeding({ bleeders, dt, emit: ops.emit, pointOf })
      return ops.events
    },
    bleeders: () => bleeders.map((bleeder) => ({ ...bleeder })),
    intactProtection: () => core.spec.protection.filter((id) => !core.body.consumed.has(id)),
    resistanceOf(part) {
      const id = resolveSegment(core.body, core.describe(), part, [0, 0, 0])
      const layers = layersOn(worn, segmentNode(id).slots, core.body.consumed)
      const protection = layers.reduce((sum, layer) => sum + (layer.ballistic?.resistance ?? 0), 0)
      return segmentResistance({ kind: segmentNode(id).kind, bodyCount: core.spec.bodyCount, protection })
    },
    protectionAgainst: (attack, part) => layeredProtection({ layers: layersOn(worn, segmentNode(part).slots, core.body.consumed), attack }),
    reset() {
      core.resetBody()
      bleeders = []
      hitCounter = 0
      lastHit = undefined
    },
    serialize(): Saved {
      const { consumed, ...rest } = core.body
      return { body: { ...structuredClone(rest), consumed: [...consumed] }, bleeders: structuredClone(bleeders), hitCounter, clock }
    },
    load(data) {
      const saved = data as Saved
      Object.assign(core.body, structuredClone(saved.body), { consumed: new Set(saved.body.consumed) })
      bleeders = structuredClone(saved.bleeders)
      hitCounter = saved.hitCounter
      clock = saved.clock
      core.invalidateState()
    },
  }
  return character
}
