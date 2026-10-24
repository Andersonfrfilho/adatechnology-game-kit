// The two team voice limits, transcribed line for line, run over a scripted sequence of groan attempts. The voice limiter golden compares the
// accepted attempts with what `createVoiceManager` accepts.
import { createRng } from '../../src'

export type GroanAttempt = { readonly frame: number; readonly distance: number; readonly length: number }
export type LimitRule = 'game' | 'art_scene' | 'both'

export const FRAME_SECONDS = 1 / 60
export const FRAMES = 900

/** 15 s at 60 frames: 0 to 3 groans per frame from zombies 0 to 60 m away, each 0.5 to 2.65 s long (the art scene's `voice` lasts `dur + 0.05`). */
export function scriptGroans(seed: number): GroanAttempt[] {
  const random = createRng(seed)
  const attempts: GroanAttempt[] = []
  for (let frame = 0; frame < FRAMES; frame++) {
    const count = Math.floor(random() * 4)
    for (let index = 0; index < count; index++) attempts.push({ frame, distance: random() * 60, length: 0.5 + random() * 2.15 })
  }
  return attempts
}

/**
 * jogo L66986 `if (d < 40 && groanBudget <= 0) { voz(...); groanBudget = 0.25; }` with L70472 `groanBudget -= dt` once a frame, and Cena L1342
 * `if (!ok() || AU.groans > 4) return` with `AU.groans++` and `o.onended = () => AU.groans--` (the voice ends at its stop time).
 */
export function teamAccepted(attempts: readonly GroanAttempt[], rule: LimitRule): number[] {
  const accepted: number[] = []
  let groanBudget = 0
  let voices: number[] = []
  let next = 0
  for (let frame = 0; frame < FRAMES; frame++) {
    for (; next < attempts.length && (attempts[next] as GroanAttempt).frame === frame; next++) {
      const { distance: d, length } = attempts[next] as GroanAttempt
      const gamePasses = d < 40 && groanBudget <= 0
      const scenePasses = !(voices.length > 4)
      const passes = rule === 'game' ? gamePasses : rule === 'art_scene' ? scenePasses : gamePasses && scenePasses
      if (!passes) continue
      accepted.push(next)
      if (rule !== 'art_scene') groanBudget = 0.25
      voices.push(length)
    }
    groanBudget -= FRAME_SECONDS
    voices = voices.map((remaining) => remaining - FRAME_SECONDS).filter((remaining) => remaining > 0)
  }
  return accepted
}
