import type { Sources } from './sources'

export type UseEffectRecord = {
  id: string
  effect: string
  /** Final ids of the items the effect applies to. */
  items?: string[]
  /** Or every item of this category. */
  category?: string[]
  params?: Record<string, number | string>
  /** The item is used up. */
  consumes: boolean
}

type EffectRule = { id: string; effect: string; items?: string[]; category?: string[]; params?: Record<string, number | string>; consumes: boolean; guard: string }

/** `useItem` of the game (jogo.js L68831): each rule carries the source text that proves it is still there. */
const RULES: readonly EffectRule[] = [
  { id: 'eat_and_drink', effect: 'consume_nutrition', category: ['food', 'drink'], consumes: true, guard: 'needs.fome - (it.f || 0)' },
  { id: 'dress_wound', effect: 'stop_bleeding', items: ['curativo', 'atadura', 'gaze', 'esparadrapo'], consumes: true, guard: '/curativo|atadura|gaze|esparadrapo/' },
  { id: 'painkiller', effect: 'heal', items: ['analgesico', 'ibuprofeno', 'opioide'], params: { amount: 15 }, consumes: true, guard: 'player.vida + 15' },
  { id: 'calm_down', effect: 'calm', items: ['calmante'], consumes: true, guard: 'player.panic = 0' },
  { id: 'clean_wound', effect: 'clean_wound', items: ['alcool70', 'pvpi'], consumes: true, guard: '/alcool|pvpi/' },
  { id: 'assemble_molotov', effect: 'assemble_molotov', items: ['garrafa_vidro', 'gasolina', 'cachaca'], params: { output: 'molotov' }, consumes: true, guard: "bag.items.push('molotov')" },
  { id: 'toggle_light', effect: 'toggle_light', items: ['lanterna'], consumes: false, guard: '/lanterna/.test(id)' },
  { id: 'swap_bag', effect: 'swap_bag', category: ['bags'], consumes: true, guard: "it.cat === 'moc' && it.cap" },
  { id: 'equip_melee', effect: 'equip_melee', category: ['melee'], consumes: false, guard: "it.cat === 'bra'" },
]

export const buildUseEffects = (sources: Sources, resolve: (reference: string) => string): UseEffectRecord[] =>
  RULES.map(({ guard, items, ...rule }) => {
    if (!sources.game.useItemSource.includes(guard)) throw new Error(`items-catalog: "${guard}" is no longer in useItem of the game; the effect "${rule.id}" has to be re-read`)
    return { ...rule, ...(items ? { items: items.map(resolve) } : {}) }
  })
