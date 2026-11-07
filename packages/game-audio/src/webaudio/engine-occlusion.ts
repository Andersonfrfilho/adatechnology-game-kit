import type { Vec3 } from '@adatechnology/game-contracts'

import { OCCLUSION_DEFAULTS } from '../occlusion'
import type { OcclusionSetup, OcclusionState } from '../occlusion'
import { createOcclusionTracker } from '../occlusion-tracker'

type Pair = { readonly filter: BiquadFilterNode; readonly gain: GainNode }
type VoiceNodes = { readonly dry: Pair; readonly wet?: Pair; releasedAt?: number }

export type OccludedVoiceInfo = { readonly id: number; readonly lossDb: number; readonly gain: number; readonly cutoff: number }

export type OcclusionRoute = { readonly input: AudioNode; readonly wet?: AudioNode }

/** Seconds a released voice keeps its nodes, so a fade or a tail already scheduled plays out. */
const RELEASE_GRACE = 0.1

export type EngineOcclusion = {
  /**
   * A lowpass into a gain into `destination` (and the same into `wet`, so the reverb send is as quiet and as dull as the dry sound): what the voice plays
   * into. It starts at the state the query gave, with no ramp; a voice that waited for the budget starts shut until the next `update` measures it.
   */
  attach(voice: { readonly id: number; readonly source: Vec3; readonly level: number; readonly listener: Vec3 }, destination: AudioNode, wet?: AudioNode): OcclusionRoute
  /** Drops the voices `alive` no longer holds (their nodes stay a moment), re-queries the due voices within the budget and ramps the ones that changed. */
  update(listener: Vec3, alive: (id: number) => boolean): void
  /** Releases the voices `alive` no longer holds. */
  prune(alive: (id: number) => boolean): void
  voices(): readonly OccludedVoiceInfo[]
  clear(): void
}

export function createEngineOcclusion(setup: OcclusionSetup, context: () => AudioContext | null): EngineOcclusion {
  const tracker = createOcclusionTracker(setup)
  const nodes = new Map<number, VoiceNodes>()
  const smoothing = Math.max(0.005, setup.smoothing ?? OCCLUSION_DEFAULTS.smoothing)

  const pairTo = (audio: AudioContext, destination: AudioNode, state: OcclusionState | undefined): Pair => {
    const filter = audio.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = state?.cutoff ?? OCCLUSION_DEFAULTS.openCutoff
    const gain = audio.createGain()
    gain.gain.value = state?.gain ?? 0
    filter.connect(gain)
    gain.connect(destination)
    return { filter, gain }
  }

  // a target approach, not a jump: three time constants settle 95 % of the move in `smoothing` seconds
  const move = (param: AudioParam, value: number, now: number, immediate: boolean): void => {
    param.cancelScheduledValues(now)
    if (immediate) {
      param.setValueAtTime(value, now)
      return
    }
    param.setValueAtTime(param.value, now)
    param.setTargetAtTime(value, now, smoothing / 3)
  }

  const apply = (pair: Pair, state: OcclusionState, now: number, immediate: boolean): void => {
    move(pair.gain.gain, state.gain, now, immediate)
    move(pair.filter.frequency, state.cutoff, now, immediate)
  }

  const drop = (id: number): void => {
    const voice = nodes.get(id)
    if (!voice) return
    for (const pair of [voice.dry, voice.wet]) {
      pair?.filter.disconnect()
      pair?.gain.disconnect()
    }
    nodes.delete(id)
  }

  const prune = (alive: (id: number) => boolean): void => {
    const now = context()?.currentTime ?? 0
    for (const [id, voice] of [...nodes]) {
      if (voice.releasedAt === undefined) {
        if (alive(id)) continue
        voice.releasedAt = now
        tracker.remove(id)
      } else if (now - voice.releasedAt > RELEASE_GRACE) drop(id)
    }
  }

  return {
    attach({ id, source, level, listener }, destination, wet) {
      const audio = context() as AudioContext
      const state = tracker.add({ id, source, level, listener, now: audio.currentTime })
      const dry = pairTo(audio, destination, state)
      const wetPair = wet ? pairTo(audio, wet, state) : undefined
      nodes.set(id, { dry, ...(wetPair ? { wet: wetPair } : {}) })
      return { input: dry.filter, ...(wetPair ? { wet: wetPair.filter } : {}) }
    },
    update(listener, alive) {
      const audio = context()
      if (!audio) return
      prune(alive)
      const now = audio.currentTime
      for (const { id, state, immediate } of tracker.update(listener, now)) {
        const voice = nodes.get(id)
        if (!voice) continue
        apply(voice.dry, state, now, immediate)
        if (voice.wet) apply(voice.wet, state, now, immediate)
      }
    },
    prune,
    voices() {
      return [...nodes].flatMap(([id, voice]) => {
        const state = voice.releasedAt === undefined ? tracker.state(id) : undefined
        return state ? [{ id, lossDb: state.lossDb, gain: state.gain, cutoff: state.cutoff }] : []
      })
    },
    clear() {
      for (const id of [...nodes.keys()]) {
        tracker.remove(id)
        drop(id)
      }
    },
  }
}
