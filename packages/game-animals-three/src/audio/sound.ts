import type { SoundRequest, Vec3 } from '@adatechnology/game-contracts'

import { ANIMAL_SOUND_BANK } from './recipes'
import callsData from './calls.json'

/** The call of a species: the recipe, the seconds the page waits before the same animal calls again, and the metres its noise reaches the AI (`emitNoise`). */
export type AnimalCall = { readonly sound: string; readonly cooldown: number; readonly noiseMetres: number }

type CallsData = { readonly sources: readonly string[]; readonly species: Readonly<Record<string, AnimalCall>> }

const DATA = callsData as unknown as CallsData

/** The calls the page delivered, by species id. The other species (horse, pig, boar, capybara, jaguar, cat, vulture, snake, rat) have none: the page gives them no sound. */
export const ANIMAL_CALLS: Readonly<Record<string, AnimalCall>> = DATA.species
export const ANIMAL_CALL_SOURCES: readonly string[] = DATA.sources

/** The part of the host's sound an animal needs: `play`, and `register` to put the bank in its engine (`createAudioSink(...)` has both). */
export type AnimalSoundSink = {
  play(request: SoundRequest): unknown
  register?(bank: unknown): void
}

export type AnimalSoundOptions = {
  /** Replaces a species' call; `null` silences it. */
  readonly calls?: Readonly<Record<string, AnimalCall | null>>
}

export type AnimalSound = {
  /** The call of a species, if it has one. */
  callOf(speciesId: string): AnimalCall | undefined
  /**
   * Makes the species call where the animal is. `key` is the animal (default the species): the same animal waits out its cooldown, and the call is
   * refused (false) until then. Returns whether a sound was asked for.
   */
  call(speciesId: string, position: Vec3, options?: { readonly volume?: number; readonly key?: string }): boolean
  /** Counts the cooldowns down: call it each frame. */
  update(dt: number): void
  dispose(): void
}

/**
 * Plays the calls of the animals on the host's sound: the four of the Bichos do Vale (hen, lapwing, cow, dog), positional with the page's linear 70 m
 * fall, each animal waiting out the page's cooldown. The bank is registered in the host's engine.
 */
export function createAnimalSound(sink: AnimalSoundSink, options: AnimalSoundOptions = {}): AnimalSound {
  sink.register?.(ANIMAL_SOUND_BANK)
  const calls: Record<string, AnimalCall | null | undefined> = { ...ANIMAL_CALLS, ...options.calls }
  const waiting = new Map<string, number>()
  const callOf = (speciesId: string): AnimalCall | undefined => calls[speciesId] ?? undefined
  return {
    callOf,
    call(speciesId, position, o = {}) {
      const found = callOf(speciesId)
      if (!found) return false
      const key = o.key ?? speciesId
      if ((waiting.get(key) ?? 0) > 0) return false
      waiting.set(key, found.cooldown)
      sink.play({ sound: found.sound, position, ...(o.volume === undefined ? {} : { volume: o.volume }) })
      return true
    },
    update(dt) {
      for (const [key, seconds] of waiting) {
        if (seconds - dt <= 0) waiting.delete(key)
        else waiting.set(key, seconds - dt)
      }
    },
    dispose: () => waiting.clear(),
  }
}
