import data from '../presets/pose-clips.json'

import type { PoseClip } from './pose-clip'

export type PoseClipRegistry = {
  /** Adds a clip, or replaces the one with the same id. Returns the registry. */
  register(clip: PoseClip): PoseClipRegistry
  get(id: string): PoseClip | undefined
  list(): PoseClip[]
  remove(id: string): boolean
}

/** A registry of clips by id: games add or replace clips without touching the core. */
export const createPoseClipRegistry = (initial: readonly PoseClip[] = []): PoseClipRegistry => {
  const clips = new Map<string, PoseClip>()
  const registry: PoseClipRegistry = {
    register(clip) {
      clips.set(clip.id, clip)
      return registry
    },
    get: (id) => clips.get(id),
    list: () => [...clips.values()],
    remove: (id) => clips.delete(id),
  }
  for (const clip of initial) registry.register(clip)
  return registry
}

/** The clips ported from the Bestiário "grab and bite" scene (human and zombie). Phase labels are locale keys, see `POSE_CLIP_LOCALES`. */
export const POSE_CLIPS: readonly PoseClip[] = data.clips as PoseClip[]

/** Texts of the phase labels by locale (`pt-BR` is the team's text). */
export const POSE_CLIP_LOCALES: Readonly<Record<string, Readonly<Record<string, string>>>> = data.locales
