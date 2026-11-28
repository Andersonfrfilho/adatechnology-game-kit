/**
 * What an item used in the hand does to the body (the team game's `useItem`, G 57269-57279): food and drink take their satiety and hydration off hunger and thirst,
 * a painkiller gives back health, a dressing stops the bleeding, alcohol or iodine cleans the last wound, a sedative takes the panic away. The effect comes as the
 * catalogue resolved it (`ModuleItemUse.effect` of game-contracts, from `resolveUse` of game-items), so the numbers are the item's own. `createBodyVitals` is the
 * same body for a host that has no `createPlayer` (a test room): health, bleeding, wounds, panic and the needs, on the same rules.
 */
import type { ModuleItemUse } from '@adatechnology/game-contracts'

import { NEEDS_DEFAULTS, advanceNeeds, createNeedsState, nourish } from './needs'
import type { NeedsRules, NeedsState } from './needs'

/** The effect of an item as the catalogue gives it (`ModuleItemUse.effect`). */
export type ItemEffect = NonNullable<ModuleItemUse['effect']>

/** The part of a body an item's effect changes: `createPlayer`'s state has it all, and so does `createBodyVitals`. */
export interface VitalsBody extends NeedsState {
  health: number
  bleeding: number
  panic: number
  wounds: string[]
}

/** What an effect did: `applied` false when it means nothing to the body (washing, a light) or found nothing to do (no wound to clean). */
export interface ItemEffectResult {
  readonly applied: boolean
  /** How much each moved (negative: down). */
  readonly health: number
  readonly hunger: number
  readonly thirst: number
  readonly stoppedBleeding: boolean
  /** The wound kind cleaned, if one was. */
  readonly cleaned?: string
  readonly calmed: boolean
}

const NOTHING: ItemEffectResult = { applied: false, health: 0, hunger: 0, thirst: 0, stoppedBleeding: false, calmed: false }

const numberOf = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

/** Applies an item's effect to `body` and answers what changed. `maxHealth` caps a heal. */
export function applyItemEffect(body: VitalsBody, effect: ItemEffect, limits: { readonly maxHealth: number; readonly needs?: NeedsRules }): ItemEffectResult {
  switch (effect.id) {
    case 'consume_nutrition': {
      const moved = nourish(body, { satiety: numberOf(effect.satiety), hydration: numberOf(effect.hydration) }, limits.needs ?? NEEDS_DEFAULTS)
      return { ...NOTHING, applied: true, hunger: moved.hunger, thirst: moved.thirst }
    }
    case 'heal': {
      const before = body.health
      body.health = Math.min(limits.maxHealth, before + Math.max(0, numberOf(effect.params?.amount)))
      return { ...NOTHING, applied: true, health: body.health - before }
    }
    case 'stop_bleeding': {
      const stopped = body.bleeding > 0
      body.bleeding = 0
      return { ...NOTHING, applied: true, stoppedBleeding: stopped }
    }
    case 'clean_wound': {
      const cleaned = body.wounds.pop()
      return cleaned === undefined ? NOTHING : { ...NOTHING, applied: true, cleaned }
    }
    case 'calm': {
      const calmed = body.panic > 0
      body.panic = 0
      return { ...NOTHING, applied: true, calmed }
    }
    default:
      return NOTHING
  }
}

export interface BodyVitalsOptions {
  /** Health the body starts with and can be healed to. Default 100. */
  readonly maxHealth?: number
  /** Health lost per second while bleeding (`numbers.bleedPerSecond` of the player, 0.15). */
  readonly bleedPerSecond?: number
  /** Vigor of the body (the attribute, default 5): a stronger body gets hungry and thirsty slower. */
  readonly vigor?: number
  readonly needs?: Partial<NeedsRules>
}

export interface BodyVitalsState extends VitalsBody {
  alive: boolean
  /** Why it died (`hunger_thirst`, `bled_out`), empty while alive. */
  cause: string
}

/** A body's vitals without the rest of the player: the needs on the game clock, the bleeding, and the item effects. */
export interface BodyVitals {
  readonly state: BodyVitalsState
  readonly maxHealth: number
  readonly rules: NeedsRules
  /** Moves the body on `dt` seconds of the game. */
  update(dt: number, input?: { readonly running?: boolean }): void
  apply(effect: ItemEffect): ItemEffectResult
  reset(): void
}

export function createBodyVitals(options: BodyVitalsOptions = {}): BodyVitals {
  const maxHealth = options.maxHealth ?? 100
  const bleedPerSecond = options.bleedPerSecond ?? 0.15
  const vigor = options.vigor ?? 5
  const rules: NeedsRules = { ...NEEDS_DEFAULTS, ...options.needs, start: { ...NEEDS_DEFAULTS.start, ...options.needs?.start } }
  const fresh = (): BodyVitalsState => ({ ...createNeedsState(rules), health: maxHealth, bleeding: 0, panic: 0, wounds: [], alive: true, cause: '' })
  const state = fresh()
  return {
    state,
    maxHealth,
    rules,
    update(dt, input = {}) {
      if (!state.alive || dt <= 0) return
      state.health -= advanceNeeds(state, dt, { running: input.running ?? false, vigor }, rules)
      if (state.bleeding > 0) state.health -= bleedPerSecond * dt
      if (state.health <= 0) {
        state.health = 0
        state.alive = false
        state.cause = state.bleeding > 0 ? 'bled_out' : 'hunger_thirst'
      }
    },
    apply: (effect) => (state.alive ? applyItemEffect(state, effect, { maxHealth, needs: rules }) : NOTHING),
    reset() {
      Object.assign(state, fresh())
    },
  }
}
