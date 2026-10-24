import type { AnimationClipSpec, ToolClipSet } from '@adatechnology/game-contracts'
import type { ClipContext } from './context'
import { clearClips, cycleClip } from './cycle-clips'
import { feedClip, reloadClips } from './reload-clips'
import { drawClip, emptyClip, faultClips, misfireClip, safetyClips, shotClips } from './shot-clips'

/** Every clip a weapon model brings, by the ids `toolAnimationStep` asks for (`shot`, `cycle`, `reload`, `reload_empty`, `fault_<id>`, `clear_<id>`...). */
export function buildToolClips(context: ClipContext): ToolClipSet {
  const clips: Array<AnimationClipSpec | undefined> = [
    ...shotClips(context),
    misfireClip(context),
    emptyClip(context),
    cycleClip(context),
    ...reloadClips(context),
    feedClip(context),
    ...faultClips(context),
    ...clearClips(context),
    ...safetyClips(context),
    drawClip(),
  ]
  const set: Record<string, AnimationClipSpec> = {}
  for (const clip of clips) if (clip) set[clip.id] = clip
  return set
}
