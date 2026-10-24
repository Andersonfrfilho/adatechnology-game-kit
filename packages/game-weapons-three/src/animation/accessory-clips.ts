import type { AnimationClipSpec } from '@adatechnology/game-contracts'
import { ROOT, composeClip, cue, move, stage, turn } from './clip-builder'
import type { ClipContext } from './context'

const PI = Math.PI
// the SDK's own motions (the gallery has none for accessories): seconds when the rule does not give the duration, and the sizes of the moves
const STOCK_SECONDS = 0.6
const TOGGLE_SECONDS = 0.14
const TOGGLE_TILT = 0.02
const LAUNCHER_SLIDE = 0.05
const LAUNCHER_RELOAD = { open: 0, loaded: 0.4, close: 0.8, end: 1.05, slide: 0.3, back: 0.25 }
const LAUNCHER_KICK = 0.03

/** The stock folds a half turn about the side of the rule, or slides in along the weapon; the pose is held at the end, so the stock stays where the rule put it. */
export function stockClips(context: ClipContext): AnimationClipSpec[] {
  const { stock, stockMove } = context.parts
  if (!stock || !stockMove) return []
  if (stockMove.kind === 'fold') {
    return [
      composeClip('stock_fold', [turn('stock', stockMove.axis, 0, STOCK_SECONDS, 0, PI)]),
      composeClip('stock_unfold', [turn('stock', stockMove.axis, 0, STOCK_SECONDS, PI, 0)]),
    ]
  }
  return [
    composeClip('stock_collapse', [move('stock', 'x', 0, STOCK_SECONDS, 0, stockMove.travel)]),
    composeClip('stock_extend', [move('stock', 'x', 0, STOCK_SECONDS, stockMove.travel, 0)]),
  ]
}

/** A light or a laser is switched: the weapon tilts a hair and comes back. */
export const toggleClip = (): AnimationClipSpec => composeClip('toggle', [turn(ROOT, 'z', 0, TOGGLE_SECONDS / 2, 0, TOGGLE_TILT), turn(ROOT, 'z', TOGGLE_SECONDS / 2, TOGGLE_SECONDS / 2, TOGGLE_TILT, 0)])

/**
 * The launcher under the barrel: its shot flashes at its own muzzle and kicks the weapon, and its reload goes through the stages of the rule (`breech_open`, `round_in`, `breech_close`):
 * the tube slides forward, takes the round and slides back. Only on a weapon with a place for one.
 */
export function launcherClips(context: ClipContext): AnimationClipSpec[] {
  if (!context.parts.ugl) return []
  const { open, loaded, close, end, slide, back } = LAUNCHER_RELOAD
  const reload = composeClip(
    'reload_ugl',
    [move('ugl', 'x', open, slide, 0, LAUNCHER_SLIDE), move('ugl', 'x', close, back, LAUNCHER_SLIDE, 0)],
    [stage('breech_open', open), stage('round_in', loaded), stage('breech_close', close)],
    end,
  )
  const shot = composeClip('shot_ugl', [move(ROOT, 'x', 0, 0.04, 0, -LAUNCHER_KICK), move(ROOT, 'x', 0.04, 0.2, -LAUNCHER_KICK, 0)], [cue(0, 'muzzle_flash', { at: 'ugl' })])
  return [reload, shot]
}
