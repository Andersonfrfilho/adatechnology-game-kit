/**
 * The room's body (game-player `createBodyVitals`): hunger and thirst on the room's clock, and what the items do to it. Food and pills used with F give the
 * effect the catalogue resolved (`ModuleItemUse.effect`, the item's own satiety, hydration and amounts); a drink gives the thirst its liquid quenches per litre
 * (`drink` events of game-fluids); food eaten from its container feeds by the share of it eaten. The HUD reads `view()` (game-player `PlayerHudView`) and the log
 * line says how each need moved.
 */
import type { ModuleItemUse } from '@adatechnology/game-contracts'
import { createBodyVitals } from '@adatechnology/game-player'
import type { BodyVitals, ItemEffect, ItemEffectResult } from '@adatechnology/game-player'
import type { MutablePlayerHudView, PlayerHudView } from '@adatechnology/game-player/hud'

type Translate = (key: string, vars?: Record<string, string | number>) => string

export interface RoomVitals {
  readonly body: BodyVitals
  update(dt: number, running: boolean): void
  /** Applies an effect and answers how the body moved, in words (`''` when nothing changed). */
  apply(effect: ItemEffect): string
  /** The end of a hand use: its effect, if it has one. */
  used(use: ModuleItemUse): string
  /** Food eaten from its container: `share` of the item's nutrition (0..1), without its hydration (the liquid's own `drink` event gives that). */
  ate(use: ModuleItemUse | undefined, share: number): string
  /** A `drink` event of the fluids: the thirst it quenched. */
  drank(thirst: number): string
  view(): PlayerHudView
}

const round = (value: number): number => Math.round(value)

export function createRoomVitals(t: Translate): RoomVitals {
  const body = createBodyVitals()
  const view: MutablePlayerHudView = { alive: true, health: 0, maxHealth: body.maxHealth, stamina: 0, maxStamina: 0, bleeding: false, wounds: [], infection: 'none', hunger: 0, thirst: 0, needMax: body.rules.max, needStarving: body.rules.starvingAt }
  const words = (result: ItemEffectResult, before: { hunger: number; thirst: number; health: number }): string => {
    if (!result.applied) return ''
    const s = body.state
    const parts: string[] = []
    if (round(result.hunger) !== 0) parts.push(t('vitals.moved', { need: t('vitals.hunger'), from: round(before.hunger), to: round(s.hunger) }))
    if (round(result.thirst) !== 0) parts.push(t('vitals.moved', { need: t('vitals.thirst'), from: round(before.thirst), to: round(s.thirst) }))
    if (round(result.health) !== 0) parts.push(t('vitals.moved', { need: t('vitals.health'), from: round(before.health), to: round(s.health) }))
    if (result.stoppedBleeding) parts.push(t('vitals.bleeding_stopped'))
    return parts.join(', ')
  }
  const apply = (effect: ItemEffect): string => {
    const s = body.state
    const before = { hunger: s.hunger, thirst: s.thirst, health: s.health }
    return words(body.apply(effect), before)
  }
  return {
    body,
    update: (dt, running) => body.update(dt, { running }),
    apply,
    used: (use) => (use.effect ? apply(use.effect) : ''),
    ate(use, share) {
      const effect = use?.effect
      if (effect?.id !== 'consume_nutrition' || !(share > 0)) return ''
      return apply({ id: 'consume_nutrition', satiety: (effect.satiety ?? 0) * Math.min(1, share) })
    },
    drank: (thirst) => (thirst > 0 ? apply({ id: 'consume_nutrition', hydration: thirst }) : ''),
    view() {
      const s = body.state
      view.alive = s.alive
      view.health = s.health
      view.bleeding = s.bleeding > 0
      view.wounds = s.wounds
      view.hunger = s.hunger
      view.thirst = s.thirst
      return view
    },
  }
}
