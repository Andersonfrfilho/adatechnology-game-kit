import { VOICE_GROUPS } from '@adatechnology/game-audio'
import type { VoiceGroup } from '@adatechnology/game-audio'

/** The voice group every impact, break and ricochet of the destruction sounds plays in (`createDestructionSound` passes it as `PlayOptions.group`). */
export const IMPACT_BURST_GROUP = 'impact_burst'

/**
 * `VOICE_GROUPS` plus the cap on a burst of impacts: one blast with fragments makes hundreds of them in one frame (276 voices, about 12 ms), and only the
 * 16 loudest are built, 1.4x louder when others were dropped. 16 is half the engine's 32-voice cap, so impacts cannot take the weapons' and voices' places.
 * The host passes it as the engine's `groups`, which needs `deferredStart`.
 */
export const DESTRUCTION_VOICE_GROUPS: Readonly<Record<string, VoiceGroup>> = {
  ...VOICE_GROUPS,
  [IMPACT_BURST_GROUP]: {
    maxPerBurst: 16,
    burstBoost: 1.4,
    sources: ['sdk: a blast with fragments asks for hundreds of impact voices in one frame (room log: 276 voices, about 12 ms); the sixteen loudest play'],
  },
}
