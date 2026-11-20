import type { DestructionEvent, DestructionEventType } from '@adatechnology/game-destruction'

export type EventClass = 'structural' | 'visual'

/**
 * What applying each event of the world does in the renderer. Structural: makes a body, changes the world, touches a collision mesh, enters the registry or draws on the
 * renderer's generator (`spall`, `drip` and `leak` do, until they get a generator of their own), so it applies inside the fixed step, on the step pose. Visual: only marks,
 * sounds and particles, so it may wait for the frame. A type that is in doubt is structural; a new type does not compile until it is listed here.
 */
export const EVENT_CLASS = {
  detach: 'structural',
  collapse: 'structural',
  fracture: 'structural',
  expose: 'structural',
  settle: 'structural',
  subside: 'structural',
  burnout: 'structural',
  destroyed: 'structural',
  explode: 'structural',
  chip: 'structural',
  stage: 'structural',
  dent: 'structural',
  bend: 'structural',
  spall: 'structural',
  drip: 'structural',
  leak: 'structural',
  ignite: 'structural',
  primed: 'structural',
  extinguish: 'structural',
  hole: 'visual',
  crack: 'visual',
  ricochet: 'visual',
  debris: 'visual',
  damage: 'visual',
  melt: 'visual',
  disassemble_progress: 'visual',
  reveal: 'visual',
  stress: 'visual',
  sway: 'visual',
  blast: 'visual',
  body: 'visual',
  fragment_hit: 'visual',
} as const satisfies Readonly<Record<DestructionEventType, EventClass>>

export function isStructuralEvent(event: DestructionEvent): boolean {
  return EVENT_CLASS[event.type] === 'structural'
}

/**
 * Orders the events of a batch for applying: a visual event of an object that has a structural event in the batch applies before the first of them (after it the part
 * may belong to another object and its mark is lost). Everything else keeps the order of emission. Returns `batch` itself when nothing moves; reuses its own scratch.
 */
export class EventOrder {
  private readonly firstStructural = new Map<string, number>()
  private readonly ordered: DestructionEvent[] = []

  arrange(batch: DestructionEvent[]): DestructionEvent[] {
    this.firstStructural.clear()
    let isMovable = false
    for (let i = 0; i < batch.length; i++) {
      const event = batch[i]!
      if (isStructuralEvent(event)) {
        if (!this.firstStructural.has(event.object)) this.firstStructural.set(event.object, i)
      } else if (this.firstStructural.has(event.object)) isMovable = true
    }
    if (!isMovable) return batch
    this.ordered.length = 0
    for (let i = 0; i < batch.length; i++) {
      const event = batch[i]!
      const first = this.firstStructural.get(event.object)
      if (first === undefined) this.ordered.push(event)
      else if (!isStructuralEvent(event)) {
        if (i < first) this.ordered.push(event)
      } else {
        if (i === first) for (let j = i + 1; j < batch.length; j++) if (batch[j]!.object === event.object && !isStructuralEvent(batch[j]!)) this.ordered.push(batch[j]!)
        this.ordered.push(event)
      }
    }
    const result = this.ordered.slice()
    this.ordered.length = 0
    return result
  }
}
