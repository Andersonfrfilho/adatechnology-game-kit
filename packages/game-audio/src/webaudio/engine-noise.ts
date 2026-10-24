import { bufferOf, fillNoise } from './noise'

/** One noise buffer and the stream it is filled from. The samples are drawn before the sound that first needs them draws its own numbers. */
export type NoiseStore = { readonly random: () => number; samples?: Float32Array; buffer?: AudioBuffer; reset(): void }

export function createNoiseStore(random: () => number): NoiseStore {
  const store: NoiseStore = {
    random,
    reset() {
      store.samples = undefined
      store.buffer = undefined
    },
  }
  return store
}

/** Draws the samples (once): `sampleRate × seconds` of them, as the team code sizes its buffer. */
export function prepareNoise(store: NoiseStore, context: AudioContext, seconds: number): Float32Array {
  store.samples ??= fillNoise(store.random, Math.floor(context.sampleRate * seconds))
  return store.samples
}

/** The AudioBuffer (made on the first call, which is where the team code calls its `noise()`). */
export function noiseBuffer(store: NoiseStore, context: AudioContext, seconds: number): AudioBuffer {
  const samples = prepareNoise(store, context, seconds)
  store.buffer ??= bufferOf(context, [samples], context.sampleRate * seconds)
  return store.buffer
}
