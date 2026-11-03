import type { PlannedAutomation, PlannedFilter, PlannedLayer, PlannedModulator, PlannedSource, SoundPlan } from './plan'
import type { SoundSet } from './recipe'

const tuneAutomation = (automation: PlannedAutomation, rate: number): PlannedAutomation => {
  const tuned: { -readonly [K in keyof PlannedAutomation]: PlannedAutomation[K] } = { ...automation }
  if (automation.value !== undefined) tuned.value = automation.value * rate
  if (automation.from !== undefined) tuned.from = automation.from * rate
  if (automation.to !== undefined) tuned.to = automation.to * rate
  if (automation.at !== undefined) tuned.at = automation.at / rate
  return tuned
}

const tuneFilter = (filter: PlannedFilter, rate: number): PlannedFilter => ({ ...filter, frequency: tuneAutomation(filter.frequency, rate) })

const tuneSource = (source: PlannedSource, rate: number): PlannedSource => {
  switch (source.kind) {
    case 'noise':
      return source
    case 'osc':
      return { ...source, frequency: tuneAutomation(source.frequency, rate) }
    case 'formant_voice':
      return {
        ...source,
        frequency: tuneAutomation(source.frequency, rate),
        formants: source.formants.map((formant) => ({ ...formant, frequency: formant.frequency * rate })),
        breath: { ...source.breath, frequency: source.breath.frequency * rate },
      }
  }
}

const tuneModulator = (modulator: PlannedModulator, rate: number): PlannedModulator => ({
  ...modulator,
  rate: modulator.rate * rate,
  ...(modulator.target === 'frequency' ? { depth: modulator.depth * rate } : {}),
})

const tuneLayer = (layer: PlannedLayer, rate: number): PlannedLayer => ({
  ...layer,
  at: layer.at / rate,
  duration: layer.duration / rate,
  tail: layer.tail / rate,
  source: tuneSource(layer.source, rate),
  ...(layer.filters ? { filters: { ...layer.filters, bank: layer.filters.bank.map((filter) => tuneFilter(filter, rate)) } } : {}),
  modulators: layer.modulators.map((modulator) => tuneModulator(modulator, rate)),
  envelope: layer.envelope.map((point) => ({ ...point, time: point.time / rate })),
})

/**
 * A plan played faster or slower, as a tape would: every frequency (tones, filters, formants, LFOs) times `rate`, every time divided by it. Noise
 * has no pitch of its own, so its colour moves with its filters. `rate` 1 gives the plan back.
 */
export function retunePlan(plan: SoundPlan, rate: number): SoundPlan {
  if (rate === 1 || !(rate > 0)) return plan
  return { ...plan, length: plan.length / rate, layers: plan.layers.map((layer) => tuneLayer(layer, rate)) }
}

/** Remembers the last variant of each set, so the next draw never repeats it. */
export type SetPicker = {
  /** The variant to play and its rate, drawn from `random` (two numbers: the variant, then the rate). */
  pick(set: SoundSet, random: () => number): { readonly id: string; readonly rate: number }
  /** Forget the last variants (a fresh scene). */
  reset(): void
}

export function createSetPicker(): SetPicker {
  const last = new Map<string, number>()
  return {
    pick(set, random) {
      const count = set.variants.length
      const previous = last.get(set.id)
      let index: number
      if (count === 1) index = 0
      else if (set.repeat || previous === undefined) index = Math.min(count - 1, Math.floor(random() * count))
      else {
        // one of the others: draw among count − 1 and skip the previous
        index = Math.min(count - 2, Math.floor(random() * (count - 1)))
        if (index >= previous) index += 1
      }
      last.set(set.id, index)
      const [min, max] = set.rate ?? [1, 1]
      const rate = min === max ? min : min + random() * (max - min)
      return { id: set.variants[index] as string, rate }
    },
    reset: () => last.clear(),
  }
}
