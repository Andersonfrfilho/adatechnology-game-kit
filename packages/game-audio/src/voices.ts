import voiceGroupsJson from './data/voice-groups.json'
import type { BusId } from './recipe'

/**
 * Rules for a group of voices (`undead_voice`...). A request passes when every rule passes:
 * - `maxConcurrent`: at most this many of the group play at once (`steal` replaces the group's oldest instead of refusing);
 * - `cooldown`: seconds after an accepted voice before the next one (the game's `groanBudget`, jogo L66986 and L70472);
 * - `maxDistance`: only voices nearer than this (the game's `d < 40`).
 */
export type VoiceGroup = {
  readonly maxConcurrent?: number
  readonly cooldown?: number
  readonly maxDistance?: number
  readonly steal?: boolean
  readonly sources?: readonly string[]
}

/** `undead_voice`: the art scene's five at once with the game's 0.25 s cooldown and 40 m. */
export const VOICE_GROUPS: Readonly<Record<string, VoiceGroup>> = voiceGroupsJson

/** Q7: weapons > voices > world > ambience; the interface above all, weather with the ambience. */
export const BUS_PRIORITY: Readonly<Record<BusId, number>> = { ui: 5, weapons: 4, voices: 3, world: 2, weather: 1, ambience: 1 }
export const DEFAULT_MAX_VOICES = 32

export function busPriority(bus: BusId): number {
  return BUS_PRIORITY[bus]
}

export type VoiceRequest = {
  readonly group?: string
  readonly priority: number
  /** Planned level; the global cap drops the lowest `priority × gain`. */
  readonly gain: number
  readonly distance?: number
  /** Seconds the voice lasts. */
  readonly length: number
}

export type VoiceRefusal = 'cooldown' | 'distance' | 'group_full' | 'global_full'

export type VoiceDecision =
  | { readonly accepted: true; readonly id: number; readonly evicted: readonly number[] }
  | { readonly accepted: false; readonly reason: VoiceRefusal }

export type VoiceStats = { readonly active: number; readonly peak: number; readonly dropped: number; readonly maxVoices: number }

export type VoiceManager = {
  request(request: VoiceRequest): VoiceDecision
  /** Ends a voice early (stopped by the host). */
  release(id: number): void
  /** Sets how long an accepted voice lasts (the engine admits a voice before its random length is drawn). */
  setLength(id: number, seconds: number): void
  /** Moves time on: cooldowns count down and finished voices leave. Returns the ids that ended. */
  advance(dt: number): number[]
  setGroup(id: string, group: VoiceGroup | undefined): void
  stats(): VoiceStats
}

export type VoiceManagerOptions = {
  /** Default `VOICE_GROUPS`. */
  readonly groups?: Readonly<Record<string, VoiceGroup>>
  readonly maxVoices?: number
}

type ActiveVoice = { readonly id: number; readonly group?: string; readonly score: number; remaining: number }

/** The voice limiter: per-group rules, a global cap and priority dropping. Pure and time-driven (`advance`), so goldens script it frame by frame. */
export function createVoiceManager(options: VoiceManagerOptions = {}): VoiceManager {
  const groups = new Map(Object.entries(options.groups ?? VOICE_GROUPS))
  const maxVoices = options.maxVoices ?? DEFAULT_MAX_VOICES
  const budgets = new Map<string, number>()
  let voices: ActiveVoice[] = []
  let nextId = 1
  let peak = 0
  let dropped = 0

  const refuse = (reason: VoiceRefusal): VoiceDecision => {
    dropped += 1
    return { accepted: false, reason }
  }

  const groupCheck = (request: VoiceRequest, evicted: number[]): VoiceRefusal | undefined => {
    const group = request.group === undefined ? undefined : groups.get(request.group)
    if (!group) return undefined
    if (group.maxDistance !== undefined && !((request.distance ?? 0) < group.maxDistance)) return 'distance'
    if (group.cooldown !== undefined && (budgets.get(request.group as string) ?? 0) > 0) return 'cooldown'
    const members = voices.filter((voice) => voice.group === request.group)
    if (group.maxConcurrent === undefined || members.length < group.maxConcurrent) return undefined
    if (!group.steal) return 'group_full'
    evicted.push((members[0] as ActiveVoice).id)
    return undefined
  }

  return {
    request(request) {
      const evicted: number[] = []
      const refusal = groupCheck(request, evicted)
      if (refusal) return refuse(refusal)
      const score = request.priority * request.gain
      const remaining = voices.filter((voice) => !evicted.includes(voice.id))
      if (remaining.length >= maxVoices) {
        const lowest = remaining.reduce((low, voice) => (voice.score < low.score ? voice : low))
        if (score <= lowest.score) return refuse('global_full')
        evicted.push(lowest.id)
        dropped += 1
      }
      const group = request.group === undefined ? undefined : groups.get(request.group)
      if (group?.cooldown !== undefined) budgets.set(request.group as string, group.cooldown)
      const id = nextId++
      voices = [...voices.filter((voice) => !evicted.includes(voice.id)), { id, ...(request.group === undefined ? {} : { group: request.group }), score, remaining: request.length }]
      peak = Math.max(peak, voices.length)
      return { accepted: true, id, evicted }
    },
    release(id) {
      voices = voices.filter((voice) => voice.id !== id)
    },
    setLength(id, seconds) {
      const voice = voices.find((entry) => entry.id === id)
      if (voice) voice.remaining = seconds
    },
    advance(dt) {
      for (const [group, budget] of budgets) budgets.set(group, budget - dt)
      const ended: number[] = []
      for (const voice of voices) {
        voice.remaining -= dt
        if (voice.remaining <= 0) ended.push(voice.id)
      }
      if (ended.length > 0) voices = voices.filter((voice) => voice.remaining > 0)
      return ended
    },
    setGroup(id, group) {
      if (group) groups.set(id, group)
      else groups.delete(id)
    },
    stats: () => ({ active: voices.length, peak, dropped, maxVoices }),
  }
}
