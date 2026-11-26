/**
 * The level of detail of a dead body's physics (spec 008 T5.3/T5.4, `design/pilha-e-lod.md`): which rung it is on, as a pure rule of numbers. No engine here: the applier
 * (`engine-corpses.ts`) reads the world, asks, and changes the bodies.
 */

/** R0 ragdoll (about 17 rigid bodies), R1 chain (3), R2 capsule (1), R2f frozen into a pile's static compound (0 dynamic), R3 no body in the engine. */
export type BodyRung = 'r0' | 'r1' | 'r2' | 'r2f' | 'r3'

export interface BodyLodOptions {
  /** Metres from the nearest point of interest beyond which a ragdoll becomes a chain. Default 18 (the renderer's corpse LOD step, so drawing and physics change together). */
  readonly ragdollDistance?: number
  /** Beyond it, a sleeping chain becomes a capsule. Default 55. */
  readonly chainDistance?: number
  /** Within it, a capsule that was woken becomes a chain again (the gap to `chainDistance` is the hysteresis). Default 50. */
  readonly chainReturnDistance?: number
  /** Beyond it, a sleeping capsule leaves the engine. Default 80. */
  readonly unloadDistance?: number
  /** Within it, a body without one comes back as a sleeping capsule. Default 75. */
  readonly loadDistance?: number
  /** Seconds a body must have slept before it goes down a rung or freezes. Default 2. */
  readonly sleepSeconds?: number
  /** Seconds a body stays on a rung before a change of distance moves it: a body walking along the edge does not flicker. Default 1. */
  readonly dwellSeconds?: number
  /** Dead bodies a corpse touches that make it part of a pile (a pile has no ragdoll). Default 2. */
  readonly pileContacts?: number
  /** Height (m) of the mound under a corpse that makes it part of a pile. Default 0.5 (twice a body's thickness). */
  readonly pileHeight?: number
  /** Most ragdolls (R0) at once. Default 1 (measured, T5.1: the most that keeps 20 dead bodies inside the C7 at 120 Hz). */
  readonly ragdollsMax?: number
  /** Most rigid bodies (R0 + R1 + R2) at once. Default 900. */
  readonly dynamicBodiesMax?: number
  /** Most rigid bodies of one island (bodies that touch, directly or through others) at once. Default 300 (the cascade of 500 is past condition 10). */
  readonly islandBodiesMax?: number
}

export type BodyLodNumbers = Required<BodyLodOptions>

export const DEFAULT_BODY_LOD: BodyLodNumbers = {
  ragdollDistance: 18,
  chainDistance: 55,
  chainReturnDistance: 50,
  unloadDistance: 80,
  loadDistance: 75,
  sleepSeconds: 2,
  dwellSeconds: 1,
  pileContacts: 2,
  pileHeight: 0.5,
  ragdollsMax: 1,
  dynamicBodiesMax: 900,
  islandBodiesMax: 300,
}

/** What the policy reads of one dead body. */
export interface BodyLodInput {
  readonly rung: BodyRung
  /** Metres from the nearest point of interest, sampled in the fixed step. */
  readonly distance: number
  /** Seconds it has slept (0 while awake). */
  readonly asleepSeconds: number
  /** Seconds since its last change of rung. */
  readonly sinceChangeSeconds: number
  /** Dead bodies it touches now. */
  readonly touchingCorpses: number
  /** Height (m) of the mound under it. */
  readonly moundHeight: number
  /** Something touches it from above. */
  readonly hasBodyAbove: boolean
  /** Something woke it since it went down a rung (a blow, a body that fell on it). */
  readonly woken: boolean
}

/** Where a body goes, and whether it may not wait (a pile, a quota, a removal go in the fixed step they are seen in; distance spends the frame's units). */
export interface BodyLodDecision {
  to: BodyRung
  forced: boolean
}

export const newBodyLodDecision = (): BodyLodDecision => ({ to: 'r1', forced: false })

export interface BodyLod {
  readonly numbers: BodyLodNumbers
  /** Whether a body of this input is in a pile (touches `pileContacts` dead bodies or stands on a mound higher than `pileHeight`). */
  inPile(input: BodyLodInput): boolean
  /** The rung the input asks for, into `out` (no allocation): its own rung when nothing changes. */
  decide(input: BodyLodInput, out: BodyLodDecision): BodyLodDecision
}

export const createBodyLod = (options: BodyLodOptions = {}): BodyLod => {
  const numbers: BodyLodNumbers = { ...DEFAULT_BODY_LOD, ...options }
  const inPile = (input: BodyLodInput): boolean => input.touchingCorpses >= numbers.pileContacts || input.moundHeight > numbers.pileHeight
  const settled = (input: BodyLodInput): boolean => input.asleepSeconds >= numbers.sleepSeconds
  const dwelt = (input: BodyLodInput): boolean => input.sinceChangeSeconds >= numbers.dwellSeconds

  const decide = (input: BodyLodInput, out: BodyLodDecision): BodyLodDecision => {
    out.to = input.rung
    out.forced = false
    switch (input.rung) {
      case 'r0':
        // a pile never holds a ragdoll; it goes at once, in the step it is seen in
        if (inPile(input)) {
          out.to = 'r1'
          out.forced = true
        } else if (input.distance > numbers.ragdollDistance && dwelt(input)) out.to = 'r1'
        break
      case 'r1':
        // the base of a pile that sleeps under another body is frozen into the pile's compound; the rest goes by distance
        if (inPile(input) && input.hasBodyAbove && settled(input)) out.to = 'r2f'
        else if (input.distance > numbers.chainDistance && settled(input) && dwelt(input)) out.to = 'r2'
        break
      case 'r2':
        if (input.distance < numbers.chainReturnDistance && input.woken && dwelt(input)) out.to = 'r1'
        else if (input.distance > numbers.unloadDistance && settled(input) && dwelt(input)) out.to = 'r3'
        break
      case 'r3':
        if (input.distance < numbers.loadDistance && dwelt(input)) out.to = 'r2'
        break
      case 'r2f':
        break
    }
    return out
  }

  return { numbers, inPile, decide }
}

/** The rung below: ragdoll to chain to capsule to nothing; a frozen body stays frozen. */
export const rungBelow = (rung: BodyRung): BodyRung => (rung === 'r0' ? 'r1' : rung === 'r1' ? 'r2' : rung === 'r2' ? 'r3' : rung)

/** A body a quota may take down: the one that sleeps and is farthest goes first, the lowest id among equals (the same order on every run). */
export interface QuotaCandidate {
  readonly id: number
  readonly rung: BodyRung
  readonly distance: number
  readonly asleep: boolean
}

/** The id of the farthest sleeping body on `rung`, or -1 when none sleeps. */
export const farthestSleeping = (candidates: Iterable<QuotaCandidate>, rung: BodyRung): number => {
  let best = -1
  let bestDistance = -Infinity
  for (const candidate of candidates) {
    if (candidate.rung !== rung || !candidate.asleep) continue
    if (candidate.distance > bestDistance || (candidate.distance === bestDistance && candidate.id < best)) {
      best = candidate.id
      bestDistance = candidate.distance
    }
  }
  return best
}
