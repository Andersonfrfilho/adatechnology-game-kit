/**
 * Uses of an item in the hand that holds no liquid (spec 015 R5): eating with the hand, taking a pill, putting on a dressing, rubbing soap in. A use is keys of where the
 * item goes from the hand that holds it, in the frame of the eye (x to the right, y up, z back towards the eye; the mouth is near `[0, 0.02, -0.2]`), the same frame
 * as the fluid uses of game-fluids, so a host moves the hand and the item alike for both. `body` tells the body which arms take part. Engine-agnostic and pure:
 * the host reads `pose()` each frame and acts on the events (a bite shrinks the food, the end spends it). Data in `data/hand-uses.json`; a game adds its own.
 */
import handUsesJson from './data/hand-uses.json'

/** What happens at a key: a bite taken, a pill or a sip swallowed, the dressing pressed on, soap rubbed. */
export type HandUseAction = 'bite' | 'swallow' | 'apply' | 'scrub'
/** Which arms the use takes: the item to the `mouth`, or both hands together in front of the body. */
export type HandUseBody = 'mouth' | 'two_hands'

export interface HandUseKey {
  readonly t: number
  readonly position: readonly [number, number, number]
  readonly rotation: readonly [number, number, number]
  readonly action?: HandUseAction
}

export interface HandUseDef {
  readonly id: string
  readonly body: HandUseBody
  readonly duration: number
  readonly keys: readonly HandUseKey[]
  readonly note?: string
}

/** An action reached: which one, and the share of the use's actions done with it (the third bite of three is 1). */
export interface HandUseEvent {
  readonly action: HandUseAction
  readonly share: number
}

export interface HandUsePlayer {
  readonly def: HandUseDef
  readonly time: number
  readonly done: boolean
  /** Where the item is now, from the hand's rest: position in the eye's frame and rotation as Euler XYZ. */
  pose(): { position: [number, number, number]; rotation: [number, number, number] }
  /** Advances the use; answers the actions reached in this step. */
  update(dt: number): HandUseEvent[]
  cancel(): void
}

export const HAND_USES: readonly HandUseDef[] = handUsesJson as unknown as readonly HandUseDef[]

/** The hand use with that id, among `defs`. */
export const handUseOf = (id: string, defs: readonly HandUseDef[] = HAND_USES): HandUseDef | undefined => defs.find((def) => def.id === id)

const lerp = (a: readonly number[], b: readonly number[], k: number): [number, number, number] => [
  a[0]! + (b[0]! - a[0]!) * k,
  a[1]! + (b[1]! - a[1]!) * k,
  a[2]! + (b[2]! - a[2]!) * k,
]

/** Plays a hand use: the pose between its keys, and its actions as the time passes them. */
export const createHandUse = (def: HandUseDef): HandUsePlayer => {
  const keys = [...def.keys].sort((a, b) => a.t - b.t)
  const actions = keys.filter((key) => key.action !== undefined)
  let time = 0
  let reached = 0
  let done = keys.length === 0 || def.duration <= 0
  const pose = (): { position: [number, number, number]; rotation: [number, number, number] } => {
    const first = keys[0]
    if (!first) return { position: [0, 0, 0], rotation: [0, 0, 0] }
    let index = 0
    while (index + 1 < keys.length && keys[index + 1]!.t <= time) index++
    const a = keys[index]!
    const b = keys[Math.min(index + 1, keys.length - 1)]!
    const k = b.t > a.t ? Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t))) : 1
    return { position: lerp(a.position, b.position, k), rotation: lerp(a.rotation, b.rotation, k) }
  }
  return {
    def,
    get time() {
      return time
    },
    get done() {
      return done
    },
    pose,
    update(dt) {
      if (done) return []
      time = Math.min(def.duration, time + Math.max(0, dt))
      const events: HandUseEvent[] = []
      while (reached < actions.length && actions[reached]!.t <= time) {
        reached++
        events.push({ action: actions[reached - 1]!.action!, share: reached / actions.length })
      }
      done = time >= def.duration
      return events
    },
    cancel() {
      done = true
    },
  }
}
