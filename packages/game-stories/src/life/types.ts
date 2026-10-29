import type lifeNumbers from '../data/life.json'
import type lifeText from '../data/life-text.json'
import type { Condition, Group, Person, Relation, StateId } from '../types'

type Numbers = Omit<typeof lifeNumbers, 'sources' | 'livingStates' | 'activeStates' | 'infection'>
/** Every number of the life simulation (`data/life.json`, each with its source line). */
export type LifeNumbers = Numbers & { readonly livingStates: readonly StateId[]; readonly activeStates: readonly StateId[]; readonly infection: boolean }
type DeepPartial<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
export type LifeNumbersPatch = DeepPartial<LifeNumbers>

/** The texts of the life simulation in one language (`data/life-text.json`). */
export type LifeText = (typeof lifeText)['pt-BR']
export type LifeTextPatch = { [K in keyof LifeText]?: Partial<LifeText[K]> }

/** A rule of the life simulation: what each chronicle line of the simulation is. */
export type LifeRule = keyof LifeText['titles']

/**
 * What a game tells the life simulation about its world. All of it is optional: without places, exposure, raids or origins the simulation runs on the
 * defaults (a normal world: no bites, no raids unless the game lists them).
 */
export type LifeOptions = {
  readonly numbers?: LifeNumbersPatch
  readonly text?: LifeTextPatch
  /** The bases people live in (the team's `GROUPS`). The nomads' base is one of them. */
  readonly groups: Readonly<Record<string, Group>>
  /** The relations the world starts with (`RELS`); `kind` is a key of `numbers.affinity`. */
  readonly relations?: readonly Relation[]
  /** Couples the world starts with. */
  readonly couples?: readonly (readonly [string, string])[]
  /** Couples a flag forms (the team's `F.casalRT`), when neither has a partner. */
  readonly flagCouples?: readonly { readonly flag: string; readonly a: string; readonly b: string }[]
  /** The daily risk of each base (`REG`); others take `numbers.risk.defaultPlace`. */
  readonly placeRisk?: Readonly<Record<string, number>>
  /** How much each person goes out (`EXPO`); others take `numbers.risk.defaultExposure`. */
  readonly exposure?: Readonly<Record<string, number>>
  /** Flags that multiply everyone's risk (the team's `F.radioMuda ? 1.3 : 1`). */
  readonly riskFlags?: Readonly<Record<string, number>>
  /** Bases nobody moves to or trades with: always (`true`) or while a condition holds (`HOSTB`). */
  readonly hostileBases?: Readonly<Record<string, true | Condition>>
  /** Bases nobody is sent to by the simulation (besides the nomads' own). */
  readonly closedBases?: readonly string[]
  /** Bases a raid never targets. */
  readonly raidImmune?: readonly string[]
  readonly nomadBase?: string
  /** The base of the people who are with the player (`grupo` → `jogador`). */
  readonly playerBase?: string
  /** The people whose presence at a base makes a birth safe. */
  readonly midwives?: readonly string[]
  /** People kept out of the daily risk until a day (the team's `id === 'taina' && d < 38`). */
  readonly anchors?: readonly { readonly id: string; readonly beforeDay: number }[]
  /** People who stand for orphans a couple can adopt, with the words the text uses for one of them. */
  readonly orphans?: Readonly<Record<string, string>>
  /** Each base's daily food change instead of `numbers.food.drift`; `{ flag, value }` applies while the flag is set. */
  readonly foodDrift?: Readonly<Record<string, number | { readonly flag: string; readonly value: number }>>
  /** Where a traitor goes: the first whose condition holds and is not their own base; else the nomads. */
  readonly traitorDestinations?: readonly { readonly base: string; readonly when?: Condition }[]
  /** The raiders: from which base, while what holds, and who they are in the text. */
  readonly raids?: readonly { readonly from: string; readonly when: Condition; readonly who: string }[]
  /** Newcomers: the ways in, a note a way in adds while a condition holds, and the announcements. `false` turns arrivals off. */
  readonly arrivals?:
    | false
    | {
        readonly origins?: readonly string[]
        readonly notes?: readonly { readonly origin: string; readonly when: Condition; readonly text: string }[]
        readonly announcements?: readonly { readonly when: Condition; readonly text: string }[]
      }
}

export type LifeStats = { births: number; arrivals: number; deaths: number; couples: number; fights: number; betrayals: number; caravans: number; raids: number; pregnancies: number }

export type LifeTimer = { heal?: number; turn?: number; back?: number; due?: number; father?: string }

/** The world the life simulation keeps (the team's `W`). */
export type LifeWorld = {
  readonly raid: Record<string, number>
  readonly food: Record<string, number>
  readonly defence: Record<string, number>
  readonly affinity: Record<string, number>
  readonly partner: Record<string, string>
  readonly rival: Record<string, 1>
  readonly adopted: Record<string, 1>
  readonly timers: Record<string, LifeTimer>
  /** The people the simulation made (newcomers, babies, the fill), by id. */
  readonly made: Record<string, Person>
  count: number
  readonly lastNews: Record<string, number>
  readonly stats: LifeStats
  readonly usedNames: Set<string>
}
