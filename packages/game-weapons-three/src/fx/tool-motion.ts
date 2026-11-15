/**
 * The motions a tool in hand makes (a shovel's shovelful, its swing): keyframes of where it goes from where it is held, in the frame of the view (x to the
 * right, y up, z back towards the eye) and turned about its own grip. The hands close on the tool's grips, so they follow it: one motion moves the tool and
 * the arms alike, in the first-person view and on the body.
 */

/** One key of a motion: the share of its time (0..1), the offset from the hold (metres) and the turn about the grip (radians, x then y then z). */
export interface ToolMotionKey {
  readonly at: number
  readonly offset: readonly [number, number, number]
  readonly turn: readonly [number, number, number]
}

/** A motion of a tool: its keys, from the hold back to the hold. */
export interface ToolMotion {
  readonly keys: readonly ToolMotionKey[]
}

const HOLD: Omit<ToolMotionKey, 'at'> = { offset: [0, 0, 0], turn: [0, 0, 0] }

/**
 * A shovelful, as one digs: the blade goes up and points down, the foot drives it into the ground, the handle is levered down and back, the load comes up
 * and is thrown to the right, and the tool comes back to the hold. Its `bite` share is when the earth comes loose (the body clip's impact).
 */
const SHOVEL_DIG: ToolMotion = {
  keys: [
    { at: 0, ...HOLD },
    { at: 0.14, offset: [0, 0.025, -0.04], turn: [-0.275, 0, 0] },
    { at: 0.32, offset: [0.01, -0.1, -0.06], turn: [-0.4, 0, 0] },
    { at: 0.5, offset: [0.01, -0.08, -0.02], turn: [-0.2, 0, 0] },
    { at: 0.66, offset: [0.03, -0.05, -0.09], turn: [-0.125, 0, -0.05] },
    { at: 0.82, offset: [0.12, 0.02, -0.06], turn: [-0.15, -0.175, -0.475] },
    { at: 1, ...HOLD },
  ],
}

/** Earth thrown back into a hole: the blade scoops low at the heap, comes up loaded and is turned over the hole. */
const SHOVEL_FILL: ToolMotion = {
  keys: [
    { at: 0, ...HOLD },
    { at: 0.25, offset: [0.125, -0.175, -0.125], turn: [-0.45, 0.15, 0] },
    { at: 0.5, offset: [0.05, -0.06, -0.1], turn: [-0.175, 0.05, 0] },
    { at: 0.75, offset: [-0.025, -0.09, -0.16], turn: [-0.3, 0, 0.45] },
    { at: 1, ...HOLD },
  ],
}

/** A shovel swung flat from the right shoulder across the body: drawn back, swept through where it hits, carried past and back. */
const SHOVEL_SWING: ToolMotion = {
  keys: [
    { at: 0, ...HOLD },
    { at: 0.3, offset: [0.11, 0.06, 0.06], turn: [0.05, 0.45, 0.1] },
    { at: 0.47, offset: [-0.025, 0, -0.16], turn: [0, -0.15, 0] },
    { at: 0.67, offset: [-0.16, -0.03, -0.1], turn: [0, -0.5, -0.075] },
    { at: 1, ...HOLD },
  ],
}

/** The motions of each tool by weapon id, then by motion name. A game adds its own tools' motions to this map. */
export const TOOL_MOTIONS: ReadonlyMap<string, ReadonlyMap<string, ToolMotion>> = new Map([
  ['shovel', new Map([['dig', SHOVEL_DIG], ['fill', SHOVEL_FILL], ['swing', SHOVEL_SWING]])],
])

/** Smooth in and out between two keys. */
const ease = (s: number): number => s * s * (3 - 2 * s)

/** Where a motion has the tool at a share of its time (0..1): its offset and turn, eased between the keys. */
export function sampleToolMotion(motion: ToolMotion, at: number): Omit<ToolMotionKey, 'at'> {
  const keys = motion.keys
  const t = Math.min(1, Math.max(0, at))
  let k = 0
  while (k + 1 < keys.length - 1 && keys[k + 1]!.at <= t) k++
  const a = keys[k]!, b = keys[Math.min(k + 1, keys.length - 1)]!
  const s = b.at > a.at ? ease((t - a.at) / (b.at - a.at)) : 1
  const mix = (p: readonly number[], q: readonly number[]): [number, number, number] => [p[0]! + (q[0]! - p[0]!) * s, p[1]! + (q[1]! - p[1]!) * s, p[2]! + (q[2]! - p[2]!) * s]
  return { offset: mix(a.offset, b.offset), turn: mix(a.turn, b.turn) }
}
