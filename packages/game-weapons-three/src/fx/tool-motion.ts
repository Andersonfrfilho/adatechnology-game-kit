/**
 * The motions a tool in hand makes (a shovel's shovelful, its swing): keyframes of where it goes from where it is held, in the frame of the view (x to the
 * right, y up, z back towards the eye) and turned about its own grip. The hands close on the tool's grips, so they follow it: one motion moves the tool and
 * the arms alike, in the first-person view and on the body.
 */

import { MELEE_FAMILIES } from '@adatechnology/game-weapons'

/** One key of a motion: the share of its time (0..1), the offset from the hold (metres) and the turn (radians, Euler x then y then z: x raises the point, y swings it to the left, z rolls it about itself). */
export interface ToolMotionKey {
  readonly at: number
  readonly offset: readonly [number, number, number]
  readonly turn: readonly [number, number, number]
}

/**
 * A motion of a tool: its keys, from the hold back to the hold. `pivot: 'grip'` turns the tool about the hand that holds it (a wrist's cut, a bat's swing written as
 * the hands' path); left out, the turn is about where the hold hangs from (the eye in first person, the shoulder on the body), as the shovel's motions were written.
 */
export interface ToolMotion {
  readonly keys: readonly ToolMotionKey[]
  readonly pivot?: 'grip'
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

/**
 * A knife's cut (`short_blade` of game-weapons' melee families), turned about the grip: drawn up and back by the right shoulder with the edge laid back, then the hand
 * sweeps down and across the chest with the blade laid flat across the view, point to the left (the clip's impact, 0.2 s of 0.46), carried on past the left hip and back.
 */
const KNIFE_SLASH: ToolMotion = {
  pivot: 'grip',
  keys: [
    { at: 0, ...HOLD },
    { at: 0.28, offset: [0.07, 0.2, 0.05], turn: [0.5, -0.9, 0] },
    { at: 0.43, offset: [-0.14, 0.06, -0.07], turn: [0.1, 0.9, 0] },
    { at: 0.62, offset: [-0.2, -0.08, 0], turn: [-0.2, 1.3, 0] },
    { at: 1, ...HOLD },
  ],
}

/**
 * A knife's thrust, turned about the grip: the hand drawn back to the ribs, then driven out at chest height toward the aim with the point forward and leaning in, so the
 * blade shows beside the fist instead of behind it (the impact, 0.18 s of 0.42), held a moment and pulled back.
 */
const KNIFE_STAB: ToolMotion = {
  pivot: 'grip',
  keys: [
    { at: 0, ...HOLD },
    { at: 0.28, offset: [0.03, -0.05, 0.08], turn: [0.15, -0.1, 0] },
    { at: 0.43, offset: [-0.1, 0.07, -0.12], turn: [0.1, 0.55, 0] },
    { at: 0.6, offset: [-0.1, 0.07, -0.11], turn: [0.1, 0.52, 0] },
    { at: 1, ...HOLD },
  ],
}

/**
 * A bat's swing (`bat_swing`), the hands' path with the bat turned about them: drawn back behind the right shoulder, the barrel laid back and down over it; swung level
 * through the chest, the bat across the view pointing left where it hits (the clip's impact, 0.3 s of 0.7); carried round and up over the left shoulder (follow-through), and back.
 */
const BAT_SWING: ToolMotion = {
  pivot: 'grip',
  keys: [
    { at: 0, ...HOLD },
    { at: 0.29, offset: [0.12, 0.12, 0.1], turn: [1.9, -0.6, 0] },
    { at: 0.43, offset: [-0.1, 0.04, -0.07], turn: [-0.3, 1.2, 0] },
    { at: 0.64, offset: [-0.28, 0.1, 0], turn: [2, 1, 0] },
    { at: 0.8, offset: [-0.2, 0.06, 0.02], turn: [1.8, 0.8, 0] },
    { at: 1, ...HOLD },
  ],
}

/** A short heavy thing in one hand (machete, hatchet, hammer) chopped down from over the right shoulder in front of the face to below the chest (the impact, 0.2 s of 0.46). */
const ONE_HAND_CHOP: ToolMotion = {
  keys: [
    { at: 0, ...HOLD },
    { at: 0.3, offset: [0.04, 0.4, 0.04], turn: [0.5, 0, -0.2] },
    { at: 0.43, offset: [-0.03, 0.18, -0.22], turn: [-0.6, 0, 0.1] },
    { at: 0.62, offset: [-0.05, -0.03, -0.18], turn: [-1.1, 0, 0.2] },
    { at: 1, ...HOLD },
  ],
}

/** The motions of each family of melee blows (`MELEE_FAMILIES` of game-weapons), by the motion names of its blows. */
export const FAMILY_MOTIONS: ReadonlyMap<string, ReadonlyMap<string, ToolMotion>> = new Map([
  ['short_blade', new Map([['slash', KNIFE_SLASH], ['stab', KNIFE_STAB]])],
  ['one_hand_swing', new Map([['chop', ONE_HAND_CHOP]])],
  ['bat_swing', new Map([['bat_swing', BAT_SWING]])],
  // an axe or a pickaxe swung with both hands goes as the shovel's swing
  ['two_hand_swing', new Map([['swing', SHOVEL_SWING]])],
])

/** The motions of each tool by weapon id, then by motion name: the shovel's own, and every weapon of a melee family moves as its family. A game adds its own tools' motions to this map. */
export const TOOL_MOTIONS: ReadonlyMap<string, ReadonlyMap<string, ToolMotion>> = new Map([
  ['shovel', new Map([['dig', SHOVEL_DIG], ['fill', SHOVEL_FILL], ['swing', SHOVEL_SWING]])],
  ...MELEE_FAMILIES.flatMap((family) => {
    const motions = FAMILY_MOTIONS.get(family.id)
    return motions ? family.weapons.map((weapon) => [weapon, motions] as const) : []
  }),
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
