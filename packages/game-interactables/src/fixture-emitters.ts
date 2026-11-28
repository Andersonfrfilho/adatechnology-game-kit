// The water a piece runs while its handle is worked, for a host that moves the parts itself (a test room plays the part's clip, a game its own animation) and has
// no interactables world: from the piece's spec and how open each part is now, which of its water emitters run and how hard. A tap runs as far as its handle
// is turned; a flush runs for its seconds once its button goes down, whatever the button does next. Pure: no three.js, object-local, no allocation per call once
// warmed up but the answer list.
import type { EmitterSpec, FixtureSpec, ObjectSpec } from './types'

/** Seconds a flush runs once its button goes down (the interactables world's own flush time). */
export const FLUSH_RUN_SECONDS = 2
/** How open a handle has to be before the water starts, 0..1: a tap barely touched drips nothing. */
const START_OPENING = 0.05
/** A flush button counts as pressed past this far down. */
const PRESSED = 0.5
/** Seconds the end of a flush takes to die down. */
const FLUSH_FADE = 0.4

/** One emitter running now, object-local, with its strength 0..1. */
export interface RunningEmitter {
  readonly emitter: EmitterSpec
  readonly intensity: number
}

export interface FixtureEmitters {
  /** The water emitters of the piece that run now: `opening(part)` is how open that part is, 0 closed to 1 open. Advances the flushes by `dt` seconds. */
  update(dt: number, opening: (part: string) => number): RunningEmitter[]
  /** Whether the piece has any emitter a handle runs (a sink, a shower, a toilet): a host can skip the others. */
  readonly runs: boolean
}

interface Driven {
  readonly emitter: EmitterSpec
  readonly fixture: FixtureSpec & { part: string }
  /** Flush only: seconds of run left, and whether the button was down the last time. */
  left: number
  down: boolean
}

/** The driver of one piece's water emitters by its handles. */
export function createFixtureEmitters(spec: Pick<ObjectSpec, 'emitters' | 'fixtures'>): FixtureEmitters {
  const fixtures = new Map((spec.fixtures ?? []).map((fixture) => [fixture.id, fixture]))
  const driven: Driven[] = []
  for (const emitter of spec.emitters ?? []) {
    if (emitter.kind !== 'water') continue
    const fixture = fixtures.get(emitter.source)
    if (!fixture?.part) continue
    driven.push({ emitter, fixture: { ...fixture, part: fixture.part }, left: 0, down: false })
  }
  return {
    runs: driven.length > 0,
    update(dt, opening) {
      const out: RunningEmitter[] = []
      for (const d of driven) {
        const open = Math.min(1, Math.max(0, opening(d.fixture.part)))
        if (d.fixture.kind === 'flush') {
          const down = open >= PRESSED
          if (down && !d.down) d.left = FLUSH_RUN_SECONDS
          d.down = down
          if (d.left <= 0) continue
          d.left = Math.max(0, d.left - dt)
          out.push({ emitter: d.emitter, intensity: Math.min(1, (d.left + 1e-6) / FLUSH_FADE) })
          continue
        }
        if (open > START_OPENING) out.push({ emitter: d.emitter, intensity: open })
      }
      return out
    },
  }
}
