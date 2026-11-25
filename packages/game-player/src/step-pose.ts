/**
 * Draws a body that moves in fixed steps between two of them: remember the last two step poses, blend by the scheduler's `alpha` (CLAUDE.md §15).
 * Drawn at the step pose, a body moves 0, 1 or 2 steps per frame at a display that is not the step's rate: it stutters.
 */

export type StepPosition = { readonly x: number; readonly y: number; readonly z: number }

export type StepPoseOptions = {
  /** A step longer than this (metres) is a teleport (a respawn, a placed body): drawn at the new pose at once, never swept across. Default 3. */
  readonly teleportDistance?: number
}

export type StepPose = {
  /** The body's pose after a fixed step. */
  record(position: StepPosition): void
  /** Puts both poses on `position`: nothing is blended from where the body was. */
  reset(position: StepPosition): void
  /** The pose to draw: `alpha` in [0, 1] is how far the frame is into the next step. */
  blend(alpha: number): StepPosition
}

export const STEP_POSE_DEFAULTS = { teleportDistance: 3 } as const

export function createStepPose(start: StepPosition, options: StepPoseOptions = {}): StepPose {
  const teleportDistance = options.teleportDistance ?? STEP_POSE_DEFAULTS.teleportDistance
  let previous = { x: start.x, y: start.y, z: start.z }
  let current = { x: start.x, y: start.y, z: start.z }
  return {
    record(position) {
      previous = current
      current = { x: position.x, y: position.y, z: position.z }
      if (Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z) > teleportDistance) previous = current
    },
    reset(position) {
      previous = { x: position.x, y: position.y, z: position.z }
      current = previous
    },
    blend(alpha) {
      const k = Math.min(1, Math.max(0, alpha))
      return { x: previous.x + (current.x - previous.x) * k, y: previous.y + (current.y - previous.y) * k, z: previous.z + (current.z - previous.z) * k }
    },
  }
}
