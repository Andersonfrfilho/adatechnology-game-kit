import type { AnimationClipSpec } from '@adatechnology/game-contracts'
import { ROOT, composeClip, cue, move, turn } from './clip-builder'
import type { Tween } from './clip-builder'
import { BLOWBACK, blowbackPart, kickOf, strokeOf } from './context'
import type { ClipContext } from './context'

// how far the slide stays back for each fault, as a fraction of its travel: the page's `k` (stovepipe .35, double feed .6)
const FAULT_SLIDE_BACK: Record<string, number> = { stovepipe: 0.35, double_feed: 0.6 }

/** The trigger finger: the trigger turns back 0.35 rad and returns (the page's `pull`). */
const pullTrigger = (context: ClipContext): Tween[] => (context.parts.trigger ? [turn('trigger', 'z', 0, 0.04, 0, 0.35), turn('trigger', 'z', 0.06, 0.08, 0.35, 0)] : [])

/** The whole weapon kicks back and tilts up, then settles (the page's `recoil`). */
const recoil = (context: ClipContext): Tween[] => {
  const kick = kickOf(context)
  return [
    move(ROOT, 'x', 0, 0.03, 0, -0.014 * kick),
    turn(ROOT, 'z', 0, 0.03, 0, 0.045 * kick),
    move(ROOT, 'x', 0.03, 0.18, -0.014 * kick, 0),
    turn(ROOT, 'z', 0.03, 0.18, 0.045 * kick, 0),
  ]
}

/** A rotary gun turns its barrels a sixth of a turn with each shot; six barrels look the same every sixth, so the next shot starts over from rest. */
const spinBarrels = (context: ClipContext): Tween[] => (context.parts.barrels && context.family === 'belt' ? [turn('barrels', 'x', 0, 0.03, 0, Math.PI / 3)] : [])

const hammerFall = (context: ClipContext): Tween[] => (context.parts.hammer && context.family !== 'revolver' ? [turn('hammer', 'z', 0, 0.02, 0, -0.5), turn('hammer', 'z', 0.05, 0.06, -0.5, 0)] : [])

/** What every shot does, then what the mechanism does by family. `locked` leaves the pistol slide back, as after the last round. */
function shotClip(id: string, context: ClipContext, locked: boolean): AnimationClipSpec {
  const { parts, family } = context
  const tweens = [...pullTrigger(context), ...recoil(context), ...hammerFall(context), ...spinBarrels(context)]
  const events = [cue(0, 'muzzle_flash')]
  if (BLOWBACK.has(family)) {
    const part = blowbackPart(context)
    const travel = strokeOf(parts)
    if (parts[part]) {
      tweens.push(move(part, 'x', 0, 0.025, 0, travel))
      if (!locked) tweens.push(move(part, 'x', 0.025, 0.045, travel, 0))
    }
    events.push(cue(0.012, 'eject_casing', { down: family === 'p90' || family === 'belt' }))
  } else if (family === 'revolver' && parts.cylinder && parts.hammer) {
    tweens.push(turn('cylinder', 'x', 0, 0.05, 0, Math.PI / 3), turn('hammer', 'z', 0, 0.05, 0, 0.5), turn('hammer', 'z', 0.05, 0.03, 0.5, -0.5), turn('hammer', 'z', 0.12, 0.08, -0.5, 0))
  }
  return composeClip(id, tweens, events)
}

/** A weapon with a mechanism that moves between shots (pump, bolt, lever) leaves that to the `cycle` clip, which the rule times. */
export function shotClips(context: ClipContext): AnimationClipSpec[] {
  const clips = [shotClip('shot', context, false)]
  if (context.family === 'pistol') clips.push(shotClip('shot_last', context, true))
  return clips
}

/** The trigger pulls and the hammer falls on a round that does not fire. */
const dudTweens = (context: ClipContext): Tween[] => [...pullTrigger(context), ...(context.parts.hammer ? [turn('hammer', 'z', 0, 0.03, 0, -0.5)] : [])]

/** A dud that does not stop the weapon (revolver, break action): the cylinder of a revolver still turns. */
export function misfireClip(context: ClipContext): AnimationClipSpec {
  const tweens = dudTweens(context)
  if (context.family === 'revolver' && context.parts.cylinder) tweens.push(turn('cylinder', 'x', 0, 0.07, 0, Math.PI / 3))
  return composeClip('misfire', tweens)
}

export const emptyClip = (context: ClipContext): AnimationClipSpec => composeClip('empty', pullTrigger(context))

/**
 * A jam after the shot: the slide is stopped part of the way back (`FAULT_SLIDE_BACK`) and the case sticks in the port of a stovepipe. The clip lasts as long
 * as the shot's, so that it holds the slide where the shot would have returned it.
 */
export function faultClips(context: ClipContext): AnimationClipSpec[] {
  const { parts, family } = context
  const misfire = composeClip('fault_misfire', dudTweens(context))
  const part = blowbackPart(context)
  if (!BLOWBACK.has(family) || !parts[part]) return [misfire]
  const travel = strokeOf(parts)
  const stopped = Object.entries(FAULT_SLIDE_BACK).map(([fault, back]) =>
    composeClip(`fault_${fault}`, [move(part, 'x', 0, 0.025, 0, travel), move(part, 'x', 0.025, 0.04, travel, travel * back)], fault === 'stovepipe' ? [cue(0.03, 'stuck_case')] : [], 0.25),
  )
  return [misfire, ...stopped]
}

/** The selector or safety lever flicks over: on turns it down, off brings it back. The gallery draws the lever and does not move it. */
export function safetyClips(context: ClipContext): AnimationClipSpec[] {
  if (!context.parts.safety) return []
  return [composeClip('safety_on', [turn('safety', 'z', 0, 0.12, 0, -0.6)]), composeClip('safety_off', [turn('safety', 'z', 0, 0.12, -0.6, 0)]), composeClip('mode', [turn('safety', 'z', 0, 0.07, 0, 0.4), turn('safety', 'z', 0.07, 0.07, 0.4, 0)])]
}

/** Raising the weapon: it comes up from low with the muzzle down. The gallery shows no hands, so this is the SDK's own motion. */
export const drawClip = (): AnimationClipSpec => composeClip('draw', [move(ROOT, 'y', 0, 0.35, -0.1, 0), turn(ROOT, 'z', 0, 0.35, -0.6, 0)])
