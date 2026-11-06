import type { LoopRecipe, SampleAlias, SampleRef, SoundBank, SoundRecipe, SoundSet } from './recipe'
import type { SampleSound } from './sample'

export type DeepPartial<TValue> = TValue extends readonly unknown[] ? TValue : TValue extends object ? { readonly [Key in keyof TValue]?: DeepPartial<TValue[Key]> } : TValue

/** Every sound and loop the engine knows, by id. Banks register in order; a later bank replaces an earlier recipe with the same id. */
export type SoundRegistry = {
  register(bank: SoundBank): void
  /** Merged into the recipe by id (objects merge, arrays such as `layers` are replaced); an unknown id is ignored. */
  patch(id: string, patch: DeepPartial<SoundRecipe> | DeepPartial<LoopRecipe> | DeepPartial<SampleSound>): void
  remove(id: string): void
  /** Drops only the sample sound of an id; a recipe or loop of the same id stays. */
  removeSample(id: string): void
  sound(id: string): SoundRecipe | undefined
  loop(id: string): LoopRecipe | undefined
  /** The set an id names (`SoundBank.sets`), if any; a recipe with the same id wins in `play`. */
  set(id: string): SoundSet | undefined
  /** The sample sound of an id: its own, or the takes of the sound a bank's `sampleAliases` points it at (once that one is registered). */
  sample(id: string): SampleSound | undefined
  soundIds(): string[]
  setIds(): string[]
  loopIds(): string[]
  /** Every id `sample` answers, aliases whose file is registered included. */
  sampleIds(): string[]
  /** Which bank each id came from. */
  bankOf(id: string): string | undefined
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// keys keep their place, so a patched range is still drawn where it was
function mergeRecords(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const current = merged[key]
    merged[key] = isPlainObject(current) && isPlainObject(value) ? mergeRecords(current, value) : value
  }
  return merged
}

const trimmed = (refs: readonly SampleRef[], alias: SampleAlias): SampleRef[] =>
  refs.filter((ref) => alias.only === undefined || ref.url.includes(alias.only)).map((ref) => ({
    ...ref,
    ...(alias.offset === undefined ? {} : { offset: alias.offset }),
    ...(alias.duration === undefined ? {} : { duration: alias.duration }),
  }))

/**
 * The sample an alias names: the file's takes (those `only` keeps) and numbers, with the alias's id and its own numbers; the recipe of the alias id is
 * the fallback. `undefined` when `only` keeps no take.
 */
export function aliasSample(alias: SampleAlias, file: SampleSound): SampleSound | undefined {
  const close = trimmed(file.close, alias)
  if (close.length === 0) return undefined
  const { tiers: _tiers, fallback: _fallback, choke: _choke, ...rest } = file
  return {
    ...rest,
    id: alias.id,
    close,
    ...(file.far ? { far: trimmed(file.far, alias) } : {}),
    ...(alias.loop === undefined ? {} : { loop: alias.loop }),
    ...(alias.baseFrequency === undefined ? {} : { baseFrequency: alias.baseFrequency }),
    ...(alias.gain === undefined ? {} : { gain: alias.gain }),
    ...(alias.pitch === undefined ? {} : { pitch: alias.pitch }),
    ...(alias.falloff ? { falloff: alias.falloff } : {}),
    fallback: alias.id,
    sources: [...file.sources, `alias: ${alias.id} → ${alias.file}`],
  }
}

export function createSoundRegistry(banks: readonly SoundBank[] = []): SoundRegistry {
  const sounds = new Map<string, SoundRecipe>()
  const loops = new Map<string, LoopRecipe>()
  const sets = new Map<string, SoundSet>()
  const samples = new Map<string, SampleSound>()
  const owners = new Map<string, string>()
  const aliases = new Map<string, SampleAlias>()
  // the sample of each alias, made on its first lookup; any change to the samples makes them again
  const derived = new Map<string, SampleSound>()
  const resolveAlias = (id: string): SampleSound | undefined => {
    const alias = aliases.get(id)
    if (!alias) return undefined
    const cached = derived.get(id)
    if (cached) return cached
    const file = samples.get(alias.file)
    if (!file) return undefined
    const sample = aliasSample(alias, file)
    if (sample) derived.set(id, sample)
    return sample
  }
  const registry: SoundRegistry = {
    register(bank) {
      for (const sound of bank.sounds ?? []) {
        sounds.set(sound.id, sound)
        owners.set(sound.id, bank.id)
      }
      for (const loop of bank.loops ?? []) {
        loops.set(loop.id, loop)
        owners.set(loop.id, bank.id)
      }
      for (const set of bank.sets ?? []) {
        if (set.variants.length === 0) throw new Error(`sound set ${set.id} has no variant`)
        sets.set(set.id, set)
        owners.set(set.id, bank.id)
      }
      for (const sample of bank.samples ?? []) {
        samples.set(sample.id, sample)
        owners.set(sample.id, bank.id)
      }
      for (const alias of bank.sampleAliases ?? []) {
        aliases.set(alias.id, alias)
        if (!owners.has(alias.id)) owners.set(alias.id, bank.id)
      }
      derived.clear()
    },
    patch(id, patch) {
      const sound = sounds.get(id)
      if (sound) sounds.set(id, mergeRecords(sound, patch as Record<string, unknown>) as SoundRecipe)
      const loop = loops.get(id)
      if (loop) loops.set(id, mergeRecords(loop, patch as Record<string, unknown>) as LoopRecipe)
      const sample = samples.get(id)
      if (sample) samples.set(id, mergeRecords(sample, patch as Record<string, unknown>) as SampleSound)
      derived.clear()
    },
    remove(id) {
      sounds.delete(id)
      loops.delete(id)
      sets.delete(id)
      samples.delete(id)
      aliases.delete(id)
      owners.delete(id)
      derived.clear()
    },
    removeSample(id) {
      samples.delete(id)
      aliases.delete(id)
      if (!sounds.has(id) && !loops.has(id) && !sets.has(id)) owners.delete(id)
      derived.clear()
    },
    sound: (id) => sounds.get(id),
    loop: (id) => loops.get(id),
    set: (id) => sets.get(id),
    sample: (id) => samples.get(id) ?? resolveAlias(id),
    soundIds: () => [...sounds.keys()],
    setIds: () => [...sets.keys()],
    loopIds: () => [...loops.keys()],
    sampleIds: () => [...samples.keys(), ...[...aliases.keys()].filter((id) => !samples.has(id) && resolveAlias(id) !== undefined)],
    bankOf: (id) => owners.get(id),
  }
  for (const bank of banks) registry.register(bank)
  return registry
}
