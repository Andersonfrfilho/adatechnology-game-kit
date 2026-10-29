import type { AnimationClipSpec } from '@adatechnology/game-contracts'
import { composeClip, cue, move, turn } from './clip-builder'
import type { Tween } from './clip-builder'
import { magazineSwap } from './magazine-clips'
import { BOLT_TRAVEL, BOLT_TURN, LEVER_TURN, PUMP_TRAVEL, blowbackPart, strokeOf } from './context'
import type { ClipContext } from './context'

/** The bolt handle turns up, the bolt runs back and forth with the handle, and the handle turns down: the page's `cycleBolt` from `start`. */
export function boltStroke(start: number, hold = 0): Tween[] {
  return [
    turn('boltHandle', 'x', start, 0.09, 0, BOLT_TURN),
    move('boltHandle', 'x', start + 0.1, 0.12, 0, BOLT_TRAVEL),
    move('bolt', 'x', start + 0.1, 0.12, 0, BOLT_TRAVEL),
    move('boltHandle', 'x', start + 0.26 + hold, 0.12, BOLT_TRAVEL, 0),
    move('bolt', 'x', start + 0.26 + hold, 0.12, BOLT_TRAVEL, 0),
    turn('boltHandle', 'x', start + 0.4 + hold, 0.09, BOLT_TURN, 0),
  ]
}

/** The manual action after each shot: the pump slides, the bolt cycles or the lever works. The gallery's times (0.5, 0.82 and 0.55 s) are the rule's `timings.cycle`. */
export function cycleClip(context: ClipContext): AnimationClipSpec | undefined {
  const { parts, family } = context
  if (family === 'pump' && parts.pump) return composeClip('cycle', [move('pump', 'x', 0.22, 0.11, 0, PUMP_TRAVEL), move('pump', 'x', 0.36, 0.11, PUMP_TRAVEL, 0)], [cue(0.3, 'eject_casing', { down: false })], 0.5)
  if ((family === 'bolt' || family === 'boltmag') && parts.bolt && parts.boltHandle) return composeClip('cycle', boltStroke(0.3), [cue(0.5, 'eject_casing', { down: false })], 0.82)
  if (family === 'lever' && parts.lever) return composeClip('cycle', [turn('lever', 'z', 0.22, 0.13, 0, LEVER_TURN), turn('lever', 'z', 0.38, 0.13, LEVER_TURN, 0)], [cue(0.3, 'eject_casing', { down: false })], 0.55)
  return undefined
}

// where the slide sits when a fault is cleared, as a fraction of its travel, and what is thrown out
const STUCK_AT: Record<string, number> = { stovepipe: 0.35, double_feed: 0.6, misfire: 0, failure_to_extract: 0 }
// the page's clear of a bolt gun holds the bolt back 0.04 s longer than its cycle (eject at 0.22, handle down at 0.44)
const CLEAR_HOLD = 0.04

/** Clearing a jam on a mechanism that blows back: the slide goes all the way back, throws out what was stuck and returns. */
function clearBlowback(context: ClipContext, fault: string): AnimationClipSpec {
  const { parts, family } = context
  const part = blowbackPart(context)
  const travel = strokeOf(parts)
  const stuck = travel * (STUCK_AT[fault] ?? 0)
  const swap = fault === 'double_feed' && parts.mag ? magazineSwap(parts, 0) : undefined
  const start = swap?.end ?? 0
  const tweens: Tween[] = [...(swap?.tweens ?? [])]
  const events = [...(swap?.events ?? [])]
  if (family === 'belt' && parts.cover) {
    tweens.push(turn('cover', 'z', start, 0.18, 0, 0.9), turn('cover', 'z', start + 0.3, 0.15, 0.9, 0))
    return composeClip(`clear_${fault}`, [...tweens, ...slideOut(part, stuck, travel, start + 0.5)], [...events, cue(start + 0.5 + 0.1, 'fly_jam', { jam: fault })])
  }
  return composeClip(`clear_${fault}`, [...tweens, ...slideOut(part, stuck, travel, start)], [...events, cue(start + 0.1, 'fly_jam', { jam: fault })])
}

const slideOut = (part: 'slide' | 'bolt', from: number, travel: number, start: number): Tween[] => [move(part, 'x', start, 0.12, from, travel), move(part, 'x', start + 0.2, 0.07, travel, 0)]

/** Clearing on a manual action: the same stroke as a cycle, throwing out what was stuck halfway through. */
function clearManual(context: ClipContext, fault: string): AnimationClipSpec | undefined {
  const { parts, family } = context
  const fly = (t: number) => [cue(t, 'fly_jam', { jam: fault })]
  if (family === 'pump' && parts.pump) return composeClip(`clear_${fault}`, [move('pump', 'x', 0, 0.12, 0, PUMP_TRAVEL), move('pump', 'x', 0.2, 0.12, PUMP_TRAVEL, 0)], fly(0.12), 0.4)
  if ((family === 'bolt' || family === 'boltmag') && parts.bolt && parts.boltHandle) return composeClip(`clear_${fault}`, boltStroke(0, CLEAR_HOLD), fly(0.22), 0.6)
  if (family === 'lever' && parts.lever) return composeClip(`clear_${fault}`, [turn('lever', 'z', 0, 0.13, 0, LEVER_TURN), turn('lever', 'z', 0.16, 0.13, LEVER_TURN, 0)], fly(0.1), 0.35)
  return undefined
}

/** One clear clip per fault the rule can raise. Mechanisms without a bolt or slide (revolver, break, launcher) only throw out what was stuck. */
export function clearClips(context: ClipContext): AnimationClipSpec[] {
  return ['misfire', 'stovepipe', 'double_feed', 'failure_to_extract'].map((fault) => {
    const manual = clearManual(context, fault)
    if (manual) return manual
    const part = blowbackPart(context)
    if (context.parts[part] && ['pistol', 'rifle', 'semiint', 'semi12', 'p90', 'belt'].includes(context.family)) return clearBlowback(context, fault)
    return composeClip(`clear_${fault}`, [], [cue(0, 'fly_jam', { jam: fault })], 0.1)
  })
}
