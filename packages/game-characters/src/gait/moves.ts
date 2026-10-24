import gait from '../data/gait.json'

export type MoveId = keyof typeof gait.moves
export type MoveBlend = { gait: number; freq: number; amp: number; knee: number; bob: number; lean: number; arm: number; elb: number; crouch: number; aim: number; turn: number; grip: number }

/** The human movement states the Elenco blends every frame. */
export const MOVES: Readonly<Record<MoveId, Readonly<MoveBlend>>> = gait.moves

export const MOVE_BLEND_RATE = 4

export const moveBlendOf = (move: MoveId): MoveBlend => ({ ...MOVES[move] })

/** Moves `current` toward the target move: each number covers `dt · 4` of the distance (never past it). Mutates and returns `current`. */
export const blendMoves = (current: MoveBlend, target: MoveId | Readonly<MoveBlend>, dt: number): MoveBlend => {
  const goal = typeof target === 'string' ? MOVES[target] : target
  const amount = Math.min(1, dt * MOVE_BLEND_RATE)
  for (const key of Object.keys(goal) as (keyof MoveBlend)[]) current[key] += (goal[key] - current[key]) * amount
  return current
}

export type HumanArm = { readonly side: 1 | -1; readonly hold?: boolean }

export type HumanPoseParams = {
  readonly moves: Readonly<MoveBlend>
  /** Seconds since the start. */
  readonly time: number
  /** The character's own phase offset. */
  readonly phase: number
  /** `phase + offset`: the walking cycle's angle, advanced by `dt · freq`. */
  readonly cycle: number
  /** The character's resting hunch plus the stage's. */
  readonly hunch: number
  /** The infection stage's arm raise (0 healthy .. 1 reanimated). */
  readonly armRaise: number
  /** Stage index: 3 and up adds a spine tremor, 4 is the reanimated body. */
  readonly stage: number
  /** The `prefers-reduced-motion` mode: no idle motion, no gait. */
  readonly reduced?: boolean
  readonly skirt?: boolean
  /** [right, left] as built: side and whether the hand holds an item. */
  readonly arms: readonly [HumanArm, HumanArm]
  /** [left, right] leg sides. */
  readonly legSides: readonly [1 | -1, 1 | -1]
}

export type HumanPose = {
  readonly chestScaleY: number
  readonly hip: { readonly x: number; readonly y: number; readonly zRotation: number }
  readonly upper: { readonly x: number; readonly y: number; readonly z: number }
  readonly head: { readonly x: number; readonly y: number; readonly z: number }
  readonly legs: readonly { readonly hip: number; readonly knee: number; readonly hipZ: number }[]
  readonly arms: readonly { readonly shoulder: number; readonly shoulderZ: number; readonly elbow: number; readonly wrist: number; readonly grip: number }[]
}

const REANIMATED_STAGE = 4
const TREMOR_STAGE = 3

/** The blended walk of the Elenco for one frame (hips, spine, head, legs, arms), as joint targets. Pure: the caller keeps the phase and the blend. */
export const humanPose = (params: HumanPoseParams): HumanPose => {
  const { moves, time, phase, cycle, hunch, armRaise, stage, reduced = false, skirt = false } = params
  const zombie = stage === REANIMATED_STAGE
  const walking = reduced ? 0 : moves.gait
  const phased = phase + time
  const shift = reduced ? 0 : Math.sin(time * 0.45 + phase) * (1 - walking) * (1 - moves.aim)
  const upperX = hunch + moves.crouch * 0.15 + (stage >= TREMOR_STAGE && !reduced ? Math.sin(phased * 2.3) * 0.03 : 0)
  const upperY = walking * Math.sin(cycle - 0.35) * (0.08 + moves.arm * 0.12) - moves.aim * 0.35 + moves.turn * 0.25
  const upperZ = -shift * 0.025 + walking * Math.sin(cycle - 0.35) * 0.02 + (zombie ? 0.05 + Math.sin(cycle * 0.5) * 0.06 * walking : 0)
  const legs = params.legSides.map((side, index) => {
    const legCycle = cycle + (index ? Math.PI : 0)
    const amplitude = moves.amp * (zombie && index === 0 ? 0.45 : 1) * (skirt ? 0.75 : 1)
    return {
      hip: -walking * Math.sin(legCycle) * amplitude - moves.crouch * 0.95 + (zombie && !walking ? (index ? -0.1 : 0.08) : 0),
      knee:
        walking * (Math.max(0, Math.cos(legCycle)) * moves.knee * (zombie && index === 0 ? 0.3 : 1) + 0.06) +
        moves.crouch * 1.55 +
        (1 - walking) * (0.03 + Math.max(0, shift * (index ? 1 : -1)) * 0.18),
      hipZ: side * (0.02 + moves.aim * 0.1 + moves.crouch * 0.06),
    }
  })
  const arms = params.arms.map(({ side, hold = false }, index) => {
    const raise = armRaise * (hold && !zombie ? 0.2 : 1)
    const swing = cycle - 0.25
    const shoulderX =
      (hold ? -0.2 : 0) -
      raise * (zombie ? 1.12 : 1.3) -
      side * Math.sin(swing) * moves.arm * walking * (zombie ? 0.3 : 1) +
      (reduced || walking ? 0 : Math.sin(phased * 1.6 + side) * 0.04) +
      (zombie && !reduced ? Math.sin(phased * 3 + side * 2) * 0.08 : 0)
    const aimX = index === 0 ? -1.45 : -1.32
    return {
      shoulder: shoulderX * (1 - moves.aim) + aimX * moves.aim,
      shoulderZ: side * (0.07 + (zombie ? 0.1 : 0)) * (1 - moves.aim) - side * 0.32 * moves.aim,
      elbow: zombie ? -0.18 : -((moves.elb + (hold ? 0.25 : 0) + walking * Math.max(0, side * Math.sin(swing - 0.3)) * 0.3) * (1 - moves.aim) + (index === 0 ? 0.15 : 0.55) * moves.aim),
      wrist: reduced ? 0 : -walking * Math.sin(swing - 0.6) * 0.15 * side * (1 - moves.aim),
      grip: (hold ? 1.25 : moves.grip) * (zombie ? 0.5 : 1),
    }
  })
  const headY = (reduced ? 0 : Math.sin(phased * 0.5) * 0.25 * (1 - walking) * (1 - moves.aim) * (zombie ? 0.3 : 1)) - upperY * 0.75 * (1 - moves.turn) + moves.turn * 0.45 + moves.aim * 0.3
  return {
    chestScaleY: 1 + (reduced ? 0 : Math.sin(phased * (1.6 + moves.freq * 0.12)) * (0.012 + moves.freq * 0.0012)),
    hip: { x: shift * 0.025 + walking * Math.sin(cycle) * 0.018, y: -walking * moves.bob * Math.abs(Math.sin(cycle)) - moves.crouch * 0.26, zRotation: shift * 0.02 - walking * Math.sin(cycle) * 0.022 },
    upper: { x: upperX, y: upperY, z: upperZ },
    head: { x: -hunch * 0.6 - moves.crouch * 0.12 + (zombie ? 0.15 : 0) + walking * Math.sin(cycle * 2 - 0.6) * 0.02, y: headY, z: (zombie ? 0.22 : 0) - upperZ * 0.6 },
    legs,
    arms,
  }
}

/** A leg that cannot carry weight (limp): the swing shrinks to 30%, the knee straightens, the spine leans toward the good leg. */
export const LIMP = { swing: 0.3, knee: 0.05, lean: 0.07 } as const
