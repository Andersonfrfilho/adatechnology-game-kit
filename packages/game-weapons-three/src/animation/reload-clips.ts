import type { AnimationClipSpec, AnimationEventSpec } from '@adatechnology/game-contracts'
import { RELOAD_STAGES } from '@adatechnology/game-weapons'
import type { ReloadKind } from '@adatechnology/game-weapons'
import { ROOT, composeClip, cue, move, renamed, sound, stage, turn } from './clip-builder'
import type { Tween } from './clip-builder'
import { BOLT_TRAVEL, BOLT_TURN, LEVER_TURN, PUMP_TRAVEL, strokeOf } from './context'
import type { ClipContext } from './context'
import { boltStroke } from './cycle-clips'
import { magazineSwap } from './magazine-clips'

const KINDS: readonly ReloadKind[] = ['tactical', 'empty', 'one_by_one']

/** Charging handle pulled and released (the page's `charge`): the bolt goes back 0.12 s, then forward 0.06 s, from `start`. */
const chargeSounds = (start: number): AnimationEventSpec[] => [sound(start, 'charging_handle_pull'), sound(start + 0.2, 'charging_handle_release')]
const charge = (context: ClipContext, start: number): Tween[] => {
  const travel = strokeOf(context.parts)
  return [move('bolt', 'x', start, 0.12, 0, travel), move('bolt', 'x', start + 0.18, 0.06, travel, 0)]
}

interface Draft {
  tweens: Tween[]
  events: AnimationEventSpec[]
  end: number
}

/** The bolt of a bolt action worked from `start` (the cycle of `boltStroke`): the handle up, back, forward and down. */
const boltSounds = (start: number): AnimationEventSpec[] => [sound(start, 'bolt_lift'), sound(start + 0.1, 'bolt_pull'), sound(start + 0.26, 'bolt_push'), sound(start + 0.45, 'bolt_lock')]

const cycleWithoutEject = (start: number): Draft => ({ tweens: boltStroke(start), events: [], end: start + 0.55 })

/** Reloads that take a magazine: swap it (0.82 s), then what the mechanism needs. `kind` `empty` also works the action. */
function magazineReload(context: ClipContext, kind: ReloadKind): Draft {
  const { parts, family } = context
  const swap = magazineSwap(parts, 0)
  const draft: Draft = { tweens: [...swap.tweens], events: [...swap.events], end: swap.end }
  if (family === 'pistol') {
    if (kind === 'empty' && parts.slide) {
      draft.tweens.push(move('slide', 'x', 0, 0, 0, strokeOf(parts)), move('slide', 'x', swap.end, 0.05, strokeOf(parts), 0))
      draft.events.push(sound(swap.end + 0.03, 'slide_release'))
      draft.end += 0.12
    }
  } else if (family === 'boltmag') {
    const stroke = cycleWithoutEject(swap.end)
    draft.tweens.push(...stroke.tweens)
    draft.events.push(...boltSounds(swap.end))
    draft.end = stroke.end
  } else if (kind === 'empty' && parts.bolt) {
    draft.tweens.push(...charge(context, swap.end))
    draft.events.push(...chargeSounds(swap.end))
    draft.end += 0.35
  }
  return draft
}

/** Revolver: crane opens, spent cases fall, rounds go in (all at once with a speed loader), crane closes: 1.3 s. */
function revolverReload(kind: ReloadKind): Draft {
  const events = [sound(0, 'cylinder_open'), cue(0.32, 'eject_casing', { from: 'chambers', down: false }), sound(0.32, 'cylinder_eject'), sound(1.2, 'cylinder_close')]
  if (kind !== 'one_by_one') events.push(cue(0.7, 'move_in', { from: 'chambers' }), sound(0.7, 'speedloader'))
  return { tweens: [turn('crane', 'x', 0, 0.22, 0, -1.25), turn('crane', 'x', 1.05, 0.2, -1.25, 0)], events, end: 1.3 }
}

/** Break action: the barrels fold down, both cases drop, two shells go in and the barrels close: 1.2 s. */
const breakReload = (): Draft => ({
  tweens: [turn('barrels', 'z', 0, 0.2, 0, -0.5), turn('barrels', 'z', 1.0, 0.15, -0.5, 0)],
  events: [sound(0, 'barrels_open'), cue(0.25, 'eject_casing', { from: 'breech', down: false }), sound(0.25, 'casings_eject'), cue(0.65, 'move_in', { from: 'breech' }), sound(0.65, 'shell_insert'), sound(0.8, 'shell_insert'), sound(1.13, 'barrels_close')],
  end: 1.2,
})

/** Belt: the cover lifts, the belt box swaps, the cover closes and the bolt is charged: 1.55 s. */
const beltReload = (context: ClipContext): Draft => ({
  tweens: [turn('cover', 'z', 0, 0.2, 0, 0.9), move('belt', 'z', 0.2, 0.25, 0, -0.3), move('belt', 'z', 0.55, 0.3, -0.3, 0), turn('cover', 'z', 0.9, 0.18, 0.9, 0), ...charge(context, 1.15)],
  events: [sound(0, 'belt_cover_open'), sound(0.8, 'belt_insert'), sound(1.05, 'belt_cover_close'), ...chargeSounds(1.15)],
  end: 1.55,
})

// loading round by round has no fixed length (the rule sets it by the rounds), so these are written over one unit and stretched to the rule's duration
const UNIT = 1

function tubeReload(context: ClipContext, kind: ReloadKind): Draft {
  const { parts, family } = context
  const draft: Draft = { tweens: [], events: [], end: UNIT }
  if (kind !== 'empty') return draft
  // the shells go into the tube, then the action is worked
  draft.events.push(sound(0.2, 'shell_insert'), sound(0.5, 'shell_insert'))
  if (family === 'pump' && parts.pump) {
    draft.tweens.push(move('pump', 'x', 0.88, 0.05, 0, PUMP_TRAVEL), move('pump', 'x', 0.94, 0.05, PUMP_TRAVEL, 0))
    draft.events.push(sound(0.88, 'pump_back'), sound(0.94, 'pump_forward'))
  } else if (family === 'lever' && parts.lever) {
    draft.tweens.push(turn('lever', 'z', 0.87, 0.06, 0, LEVER_TURN), turn('lever', 'z', 0.94, 0.06, LEVER_TURN, 0))
    draft.events.push(sound(0.87, 'lever_open'), sound(0.94, 'lever_close'))
  } else if (parts.bolt) {
    draft.tweens.push(move('bolt', 'x', 0.88, 0.07, 0, strokeOf(parts)), move('bolt', 'x', 0.95, 0.04, strokeOf(parts), 0))
    draft.events.push(sound(0.88, 'charging_handle_pull'), sound(0.95, 'charging_handle_release'))
  }
  return draft
}

/** Bolt action loaded from the top: the bolt opens, rounds go in one by one, the bolt closes. */
function boltReload(context: ClipContext): Draft {
  if (!context.parts.boltHandle || !context.parts.bolt) return { tweens: [], events: [], end: UNIT }
  return {
    tweens: [
      turn('boltHandle', 'x', 0, 0.05, 0, BOLT_TURN),
      move('boltHandle', 'x', 0.05, 0.07, 0, BOLT_TRAVEL),
      move('bolt', 'x', 0.05, 0.07, 0, BOLT_TRAVEL),
      move('boltHandle', 'x', 0.86, 0.07, BOLT_TRAVEL, 0),
      move('bolt', 'x', 0.86, 0.07, BOLT_TRAVEL, 0),
      turn('boltHandle', 'x', 0.93, 0.05, BOLT_TURN, 0),
    ],
    events: [sound(0, 'bolt_lift'), sound(0.05, 'bolt_pull'), sound(0.86, 'bolt_push'), sound(0.95, 'bolt_lock')],
    end: UNIT,
  }
}

/** A semi-automatic with an internal magazine: the bolt back, rounds in from the top, the bolt forward. */
function internalMagazineReload(context: ClipContext): Draft {
  const travel = strokeOf(context.parts)
  return { tweens: context.parts.bolt ? [move('bolt', 'x', 0, 0.04, 0, travel), move('bolt', 'x', 0.89, 0.04, travel, 0)] : [], events: context.parts.bolt ? [sound(0.04, 'charging_handle_pull'), sound(0.89, 'charging_handle_release')] : [], end: UNIT }
}

/** The rocket launchers and flamethrowers: a round slid in, a disposable tube dropped and a new one seated, a hinged breech, or a tank swapped (needle sweeps). */
function heavyReload(context: ClipContext): Draft {
  const { parts, family } = context
  if (family === 'flame') return { tweens: parts.gauge ? [turn('gauge', 'z', 0, 1, -2.4, 0)] : [], events: [], end: 1.1 }
  if (parts.disposable) {
    return {
      tweens: [move(ROOT, 'y', 0.6, 0, 0, -0.6), move(ROOT, 'y', 0.6, 0.5, -0.6, 0)],
      events: [cue(0, 'drop_tube'), sound(0, 'tube_drop'), cue(0.6, 'seat_tube'), sound(1.08, 'tube_seat')],
      end: 1.15,
    }
  }
  if (parts.round) {
    return {
      tweens: [move('round', 'x', 0, 0.55, 0.45, 0), move('round', 'y', 0, 0.55, 0.12, 0)],
      events: [cue(0, 'show_round'), sound(0, 'rocket_load'), sound(0.55, 'rocket_seat')],
      end: 0.6,
    }
  }
  return {
    tweens: [turn('breech_0', 'y', 0, 0.25, 0, -1.6), turn('breech_0', 'y', 0.76, 0.22, -1.6, 0)],
    events: [sound(0, 'breech_open'), cue(0.3, 'breech_round'), sound(0.3, 'grenade_load'), sound(0.96, 'breech_close')],
    end: 1.05,
  }
}

const isTube = (context: ClipContext): boolean => ['pump', 'semi12', 'lever'].includes(context.family)

function draftFor(context: ClipContext, kind: ReloadKind): Draft | undefined {
  const { parts, family } = context
  if (family === 'rocket' || family === 'flame') return heavyReload(context)
  if (parts.mag) return magazineReload(context, kind)
  if (family === 'revolver' && parts.crane) return revolverReload(kind)
  if (family === 'break' && parts.barrels) return breakReload()
  if (family === 'belt' && parts.cover && parts.belt) return beltReload(context)
  if (isTube(context)) return tubeReload(context, kind)
  if (family === 'bolt') return boltReload(context)
  if (family === 'semiint') return internalMagazineReload(context)
  return undefined
}

/** The stages of the rule's reload as markers of the clip, at the fractions the rule puts them. */
const markers = (context: ClipContext, kind: ReloadKind, duration: number): AnimationEventSpec[] =>
  context.reloadFamily ? RELOAD_STAGES[context.reloadFamily][kind].map((entry) => stage(entry.stage, entry.at * duration)) : []

/** `reload` (a magazine swap or the like), `reload_empty` and `reload_one_by_one`, each only when it differs from the first. */
export function reloadClips(context: ClipContext): AnimationClipSpec[] {
  const clips: AnimationClipSpec[] = []
  let first: AnimationClipSpec | undefined
  for (const kind of KINDS) {
    const draft = draftFor(context, kind)
    if (!draft) return []
    const clip = composeClip(kind === 'tactical' ? 'reload' : `reload_${kind}`, draft.tweens, [...draft.events, ...markers(context, kind, draft.end)], draft.end)
    if (!first) first = clip
    else if (JSON.stringify({ ...clip, id: first.id }) === JSON.stringify(first)) continue
    clips.push(clip)
  }
  return clips.length > 0 ? clips : first ? [renamed(first, 'reload')] : []
}

/** One more round goes in while a tube, a top-loaded or a revolver loads round by round. */
export function feedClip(context: ClipContext): AnimationClipSpec | undefined {
  const { family } = context
  if (family === 'revolver') return composeClip('feed', [], [cue(0, 'move_in', { from: 'chambers', next: true }), sound(0.1, 'shell_insert')], 0.24)
  if (family === 'bolt' || family === 'semiint') return composeClip('feed', [], [cue(0, 'move_in', { from: 'topLoad' }), sound(0.1, 'shell_insert')], 0.24)
  if (isTube(context)) return composeClip('feed', [], [cue(0, 'move_in', { from: 'loadPort' }), sound(0.1, 'shell_insert')], 0.24)
  return undefined
}
