import type { DestructionEvent, SoundRequest, Vec3 } from '@adatechnology/game-contracts'
import { GAME_SFX_BANK } from '@adatechnology/game-audio'

import { CHARACTER_SOUND_BANK } from './recipes'
import voicesData from './voices.json'

/** One sound of a voice: the recipe and, for a sequence, the seconds after the first. */
export type VoiceStep = { readonly sound: string; readonly delay?: number }

/**
 * The voice of one undead type:
 * - `origin` says where it comes from: `team` (the page has a sound for this very type), `rule` (the page's class rule applied to the type: the Brutamonte,
 *   a chase speed above 3.4, or a walker) or `extra` (the nearest sound of the pages to the voice line of `types.json`, the kit's choice);
 * - `groan` / `gameGroan` is the groan of the art scene and of the game;
 * - `idle` (a body that wanders or chases) and `alert` (it noticed the player or woke up) default to the groan; `special` is what the type does at its
 *   ability (the screamer's call, the leaper's jump), and `gameSpecial` its game version (the game has no leap sound, so the art scene's is kept).
 */
export type UndeadVoice = {
  readonly origin: 'team' | 'rule' | 'extra'
  readonly groan: string
  readonly gameGroan: string
  readonly idle?: readonly VoiceStep[]
  readonly alert?: readonly VoiceStep[]
  readonly special?: readonly VoiceStep[]
  readonly gameSpecial?: readonly VoiceStep[]
}

type VoicesData = { readonly sources: readonly string[]; readonly types: Readonly<Record<string, UndeadVoice>> }

const DATA = voicesData as unknown as VoicesData

/** The voices of the 13 types of the Bestiario, by type id. */
export const UNDEAD_VOICES: Readonly<Record<string, UndeadVoice>> = DATA.types
export const UNDEAD_VOICE_SOURCES: readonly string[] = DATA.sources

export type VoiceMoment = 'idle' | 'alert' | 'special'

export type CharacterSoundStyle = 'art_scene' | 'game'

/** What a change of a body sounds like, by the `change` of the `body` event. A head or a jaw hit is brighter (`flesh_head`). */
export type BodySoundRule = { readonly sound: string; readonly head?: string }

/** Art scene: bloodHit (cena L1084) is `flesh`, a cut is `sever` (L1127, L1143), a burst or an opened belly is `gore` (L1101, L1132). Game: the flesh class of `sfx`. */
export const BODY_SOUNDS: Readonly<Record<CharacterSoundStyle, Readonly<Record<string, BodySoundRule>>>> = {
  art_scene: {
    wound: { sound: 'flesh', head: 'flesh_head' },
    severed: { sound: 'sever' },
    destroyed: { sound: 'gore' },
    split: { sound: 'gore' },
  },
  game: {
    wound: { sound: 'sfx_flesh' },
  },
}

/** What the player hears when a body grabs, bites or hurts him (cena L1350-L1352, at the listener). */
export const PLAYER_SOUNDS = { grab: 'grab', bite: 'bite', hurt: 'hurt' } as const

/** The part of the host's sound a body needs: `play`, and `register` to put the banks in its engine (`createAudioSink(...)` has both). */
export type CharacterSoundSink = {
  play(request: SoundRequest): unknown
  register?(bank: unknown): void
}

export type CharacterSoundOptions = {
  /** Which team answers (default `art_scene`, the kit mix). `game` plays the game's groans, scream and flesh, and the art scene for what the game lacks. */
  readonly style?: CharacterSoundStyle
  /** Replaces a type's voice; `null` silences it. */
  readonly voices?: Readonly<Record<string, UndeadVoice | null>>
  /** Replaces a `body` change's rule; `null` silences it. */
  readonly body?: Readonly<Record<string, BodySoundRule | null>>
  /** The type used for an id that has no voice (default none: silent). */
  readonly fallbackType?: string
}

export type CharacterSound = {
  /** The steps a type plays at a moment. */
  stepsOf(typeId: string, moment: VoiceMoment): readonly VoiceStep[]
  /** Plays the voice of a type at a moment where the body is. Returns how many sounds were started or queued. */
  voice(typeId: string, moment: VoiceMoment, position: Vec3, volume?: number): number
  /** Reads a `body` event of a body at `position`: a wound is flesh, a cut is `sever`, a burst or a split is `gore`. Other events are ignored. Returns true when a sound was asked for. */
  body(event: DestructionEvent, position: Vec3, volume?: number): boolean
  /** The player is grabbed, bitten or hurt (heard at the listener). */
  player(kind: keyof typeof PLAYER_SOUNDS, volume?: number): void
  /** Runs the sequences (the screamer's inhale, then the call): call it each frame. */
  update(dt: number): void
  /** Sounds waiting for their time. */
  readonly pending: () => number
  dispose(): void
}

const HEAD_PARTS = new Set(['head', 'jaw'])

/**
 * Plays the sounds of the bodies on the host's sound: the voices of the undead types (the Bestiario's 13), what a wound sounds like and what the player
 * hears. The banks are registered in the host's engine, the sounds are positional, and the groans go through the engine's `undead_voice` limiter
 * (five at once, one every 0.25 s, nearer than 40 m). The team sounds are the recipes of `./recipes`; the table of who says what is data.
 */
export function createCharacterSound(sink: CharacterSoundSink, options: CharacterSoundOptions = {}): CharacterSound {
  sink.register?.(CHARACTER_SOUND_BANK)
  sink.register?.(GAME_SFX_BANK)
  const style = options.style ?? 'art_scene'
  const voices: Record<string, UndeadVoice | null | undefined> = { ...UNDEAD_VOICES, ...options.voices }
  const rules: Record<string, BodySoundRule | null | undefined> = { ...BODY_SOUNDS.art_scene, ...(style === 'game' ? BODY_SOUNDS.game : {}), ...options.body }
  const queue: { sound: string; at: Vec3; volume: number; wait: number }[] = []

  const voiceOf = (typeId: string): UndeadVoice | undefined => {
    const own = voices[typeId]
    if (own === null) return undefined
    return own ?? (options.fallbackType ? (voices[options.fallbackType] ?? undefined) : undefined)
  }

  const stepsOf = (typeId: string, moment: VoiceMoment): readonly VoiceStep[] => {
    const voice = voiceOf(typeId)
    if (!voice) return []
    const groan = style === 'game' ? voice.gameGroan : voice.groan
    if (moment === 'special') return (style === 'game' ? (voice.gameSpecial ?? voice.special) : voice.special) ?? []
    // the game's `voz('corredor')` answers every body that notices the player (jogo L67275, L67328)
    if (moment === 'alert') return voice.alert ?? [{ sound: style === 'game' ? 'runner_groan' : groan }]
    return voice.idle ?? [{ sound: groan }]
  }

  const start = (sound: string, at: Vec3, volume: number): void => void sink.play({ sound, position: at, volume })

  return {
    stepsOf,
    voice(typeId, moment, position, volume = 1) {
      const steps = stepsOf(typeId, moment)
      for (const step of steps) {
        if (step.delay && step.delay > 0) queue.push({ sound: step.sound, at: position, volume, wait: step.delay })
        else start(step.sound, position, volume)
      }
      return steps.length
    },
    body(event, position, volume = 1) {
      if (event.type !== 'body') return false
      const rule = rules[event.change]
      if (!rule) return false
      const head = event.part !== undefined && HEAD_PARTS.has(event.part)
      start(head && rule.head ? rule.head : rule.sound, position, volume)
      return true
    },
    player: (kind, volume = 1) => void sink.play({ sound: PLAYER_SOUNDS[kind], volume }),
    update(dt) {
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i]!
        item.wait -= dt
        if (item.wait <= 0) {
          queue.splice(i, 1)
          start(item.sound, item.at, item.volume)
        }
      }
    },
    pending: () => queue.length,
    dispose() {
      queue.length = 0
    },
  }
}
