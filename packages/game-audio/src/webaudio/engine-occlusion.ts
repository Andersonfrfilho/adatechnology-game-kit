import type { Vec3 } from '@adatechnology/game-contracts'

import { OCCLUSION_DEFAULTS } from '../occlusion'
import type { OcclusionSetup, OcclusionState } from '../occlusion'
import { createOcclusionTracker } from '../occlusion-tracker'

type VoiceNodes = { readonly filter: BiquadFilterNode; readonly gain: GainNode }

export type OccludedVoiceInfo = { readonly id: number; readonly lossDb: number; readonly gain: number; readonly cutoff: number }

export type EngineOcclusion = {
  /** A lowpass into a gain into `destination`: what the voice plays into. It starts at the state the query gave, with no ramp. */
  attach(voice: { readonly id: number; readonly source: Vec3; readonly level: number; readonly listener: Vec3 }, destination: AudioNode): AudioNode
  /** Re-queries the due voices within the budget and ramps the ones that changed. */
  update(listener: Vec3): void
  /** Drops the voices `alive` no longer holds. */
  prune(alive: (id: number) => boolean): void
  voices(): readonly OccludedVoiceInfo[]
  clear(): void
}

export function createEngineOcclusion(setup: OcclusionSetup, context: () => AudioContext | null): EngineOcclusion {
  const tracker = createOcclusionTracker(setup)
  const nodes = new Map<number, VoiceNodes>()
  const smoothing = Math.max(0.005, setup.smoothing ?? OCCLUSION_DEFAULTS.smoothing)

  // a target approach, not a jump: three time constants settle 95 % of the move in `smoothing` seconds
  const glide = (param: AudioParam, value: number, now: number): void => {
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.setTargetAtTime(value, now, smoothing / 3)
  }

  const drop = (id: number): void => {
    tracker.remove(id)
    const voice = nodes.get(id)
    if (!voice) return
    voice.filter.disconnect()
    voice.gain.disconnect()
    nodes.delete(id)
  }

  return {
    attach({ id, source, level, listener }, destination) {
      const audio = context() as AudioContext
      const state = tracker.add({ id, source, level, listener, now: audio.currentTime })
      const filter = audio.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = state.cutoff
      const gain = audio.createGain()
      gain.gain.value = state.gain
      filter.connect(gain)
      gain.connect(destination)
      nodes.set(id, { filter, gain })
      return filter
    },
    update(listener) {
      const audio = context()
      if (!audio) return
      const now = audio.currentTime
      for (const { id, state } of tracker.update(listener, now)) {
        const voice = nodes.get(id)
        if (!voice) continue
        glide(voice.gain.gain, state.gain, now)
        glide(voice.filter.frequency, state.cutoff, now)
      }
    },
    prune(alive) {
      for (const id of [...nodes.keys()]) if (!alive(id)) drop(id)
    },
    voices() {
      return [...nodes.keys()].flatMap((id) => {
        const state: OcclusionState | undefined = tracker.state(id)
        return state ? [{ id, lossDb: state.lossDb, gain: state.gain, cutoff: state.cutoff }] : []
      })
    },
    clear() {
      for (const id of [...nodes.keys()]) drop(id)
    },
  }
}
