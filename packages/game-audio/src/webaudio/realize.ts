import type { SoundPlan } from '../plan'
import type { BuildOrder } from '../recipe'
import type { RealizedVoice, RealizeTarget } from './nodes'
import { realizeBoom, realizeBurst, realizeCalls, realizeChord, realizeGroan, realizeScream, realizeStatic } from './realize-game'
import { realizeLayered, realizeSiren } from './realize-layered'
import { realizeWeapon } from './realize-weapon'

const BUILDERS: Readonly<Record<BuildOrder, (plan: SoundPlan, target: RealizeTarget) => RealizedVoice>> = {
  layered: realizeLayered,
  burst: realizeBurst,
  scream: realizeScream,
  groan: realizeGroan,
  boom: realizeBoom,
  static: realizeStatic,
  chord: realizeChord,
  calls: realizeCalls,
  siren: realizeSiren,
  weapon: realizeWeapon,
}

/** Builds a plan's nodes on `target`, in the node order of the team routine its `order` names. */
export function realize(plan: SoundPlan, target: RealizeTarget): RealizedVoice {
  return BUILDERS[plan.order](plan, target)
}
