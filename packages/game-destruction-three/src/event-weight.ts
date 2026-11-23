import type { DestructionEvent, DestructionEventType } from '@adatechnology/game-destruction'

/**
 * What applying one event of each type costs the renderer, in fixed units (a bullet hole is 10), for spreading the structural events of a large blast over frames
 * (`applyStructuralEventsSliced`). A table, never a clock: the same events give the same slices on any machine, so the world the slices build is the same.
 * Derived from the cost per event measured applying the M67's 1687 events in the room house (spec 018, 2026-11-22, `m2`: a fracture ~1.7 ms, a hole ~0.05 ms, a
 * stage ~0.1 ms, a chip ~0.04 ms, a spall ~0.01 ms, a debris ~0.005 ms); types not measured there take the weight of the nearest measured kind of work. Every
 * event costs at least 1, so a slice always moves. A new type does not compile until it is listed.
 */
export const EVENT_APPLY_WEIGHT = {
  fracture: 340,
  collapse: 340,
  destroyed: 120,
  expose: 60,
  subside: 30,
  settle: 30,
  detach: 10,
  stage: 20,
  dent: 20,
  bend: 20,
  burnout: 20,
  explode: 20,
  hole: 10,
  chip: 8,
  ignite: 4,
  primed: 2,
  extinguish: 2,
  spall: 2,
  leak: 2,
  drip: 1,
  crack: 1,
  debris: 1,
  ricochet: 1,
  damage: 1,
  melt: 1,
  disassemble_progress: 1,
  reveal: 1,
  stress: 1,
  sway: 1,
  blast: 1,
  body: 1,
  fragment_hit: 1,
} as const satisfies Readonly<Record<DestructionEventType, number>>

/** Units of `EVENT_APPLY_WEIGHT` a frame of a spread blast applies by default: ~5 ms of the measured costs, about a quarter of the M67's structural events. */
export const STRUCTURAL_UNITS_PER_FRAME = 1000

export function eventApplyWeight(event: DestructionEvent): number {
  return EVENT_APPLY_WEIGHT[event.type]
}
