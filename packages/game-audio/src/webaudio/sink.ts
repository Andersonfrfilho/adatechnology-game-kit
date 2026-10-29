import type { AudioListener, AudioSink, LoopHandle, SoundHandle, SoundRequest } from '@adatechnology/game-contracts'

import type { SoundBank } from '../recipe'
import type { AudioEngine, VoiceHandle } from './engine'

/** An `AudioSink` (what a host lends its modules) that carries the engine behind it, so a module that wants more than `play` can use the engine. */
export type EngineSink = AudioSink & { readonly engine: AudioEngine }

/** Lends an engine as the host's `audio`: sounds by key, loops, the listener, and banks registered into the same engine. */
export function createAudioSink(engine: AudioEngine): EngineSink {
  const playing = new Map<number, VoiceHandle>()
  return {
    engine,
    play(request: SoundRequest): SoundHandle | null {
      const handle = engine.play(request.sound, {
        ...(request.position ? { position: request.position } : {}),
        ...(request.volume === undefined ? {} : { volume: request.volume }),
        ...(request.params ? { params: request.params } : {}),
        ...(request.seed === undefined ? {} : { seed: request.seed }),
      })
      if (!handle) return null
      playing.set(handle.id, handle)
      return { id: handle.id }
    },
    stop(handle) {
      playing.get(handle.id)?.stop()
      playing.delete(handle.id)
    },
    loop(sound): LoopHandle {
      const loop = engine.loop(sound)
      return { set: (state) => loop.set({ ...(state.volume === undefined ? {} : { volume: state.volume }), ...(state.frequency === undefined ? {} : { frequency: state.frequency }) }), stop: () => loop.stop() }
    },
    setListener(listener: AudioListener) {
      engine.setListener(listener)
    },
    register(bank: unknown) {
      engine.register(bank as SoundBank)
    },
  }
}
