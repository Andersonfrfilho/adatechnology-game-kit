import type { LoopRecipe, SoundBank, SoundRecipe } from './recipe'

export type DeepPartial<TValue> = TValue extends readonly unknown[] ? TValue : TValue extends object ? { readonly [Key in keyof TValue]?: DeepPartial<TValue[Key]> } : TValue

/** Every sound and loop the engine knows, by id. Banks register in order; a later bank replaces an earlier recipe with the same id. */
export type SoundRegistry = {
  register(bank: SoundBank): void
  /** Merged into the recipe by id (objects merge, arrays such as `layers` are replaced); an unknown id is ignored. */
  patch(id: string, patch: DeepPartial<SoundRecipe> | DeepPartial<LoopRecipe>): void
  remove(id: string): void
  sound(id: string): SoundRecipe | undefined
  loop(id: string): LoopRecipe | undefined
  soundIds(): string[]
  loopIds(): string[]
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

export function createSoundRegistry(banks: readonly SoundBank[] = []): SoundRegistry {
  const sounds = new Map<string, SoundRecipe>()
  const loops = new Map<string, LoopRecipe>()
  const owners = new Map<string, string>()
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
    },
    patch(id, patch) {
      const sound = sounds.get(id)
      if (sound) sounds.set(id, mergeRecords(sound, patch as Record<string, unknown>) as SoundRecipe)
      const loop = loops.get(id)
      if (loop) loops.set(id, mergeRecords(loop, patch as Record<string, unknown>) as LoopRecipe)
    },
    remove(id) {
      sounds.delete(id)
      loops.delete(id)
      owners.delete(id)
    },
    sound: (id) => sounds.get(id),
    loop: (id) => loops.get(id),
    soundIds: () => [...sounds.keys()],
    loopIds: () => [...loops.keys()],
    bankOf: (id) => owners.get(id),
  }
  for (const bank of banks) registry.register(bank)
  return registry
}
