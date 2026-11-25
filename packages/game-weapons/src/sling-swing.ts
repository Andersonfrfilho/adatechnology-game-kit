/**
 * A long gun hanging on its sling (decision of the owner, 2026-11-25: the rifle is not dropped, it hangs on the body and swings): a pendulum hung from the sling's point on the
 * chest, in the body's frame. It swings forward off the body and to the sides, never back into the body (`limits`), and settles under its own damping. Engine-agnostic and visual
 * only (it moves nothing of the simulation): the host gives the acceleration of the sling's point each frame and reads the two angles.
 */

export interface SlingSwingRules {
  /** From the sling's point to the gun's middle (m): the length of the pendulum. */
  readonly length: number
  /** Damping of the swing, per second (a strap rubbing on cloth stops a swing in a second or two). */
  readonly damping: number
  /** Forward off the body (+) is free up to `forward`; back into the body it stops at 0. Sideways up to `side` each way (radians). */
  readonly limits: { readonly forward: number; readonly side: number }
  /** What is kept of the speed when the gun knocks against the body or the end of its swing. */
  readonly restitution: number
  /** Longest step of the integration (s); a longer frame is cut in steps this long. */
  readonly maxStep: number
  readonly gravity: number
}

export const SLING_SWING_DEFAULTS: SlingSwingRules = { length: 0.34, damping: 2.6, limits: { forward: 0.9, side: 0.75 }, restitution: 0.25, maxStep: 1 / 240, gravity: 9.81 }

/** The swing now: `forward` the gun's bottom out from the body (radians about the body's side axis), `side` toward the body's right (about its forward axis). */
export interface SlingSwingState {
  readonly forward: number
  readonly side: number
}

export interface SlingSwing {
  /**
   * Moves the swing on by `dt` with the sling's point accelerating by `acceleration` in the body's frame (`[right, up, forward]`, m/s²): a body that speeds up leaves the gun
   * behind (against the body), one that stops throws it forward, a turn swings it to the side.
   */
  step(dt: number, acceleration: readonly [number, number, number]): SlingSwingState
  readonly state: SlingSwingState
  /** Back to hanging still. */
  reset(): void
}

export function createSlingSwing(rules: SlingSwingRules = SLING_SWING_DEFAULTS): SlingSwing {
  let forward = 0
  let side = 0
  let forwardSpeed = 0
  let sideSpeed = 0
  const bounce = (angle: number, speed: number, min: number, max: number): [number, number] => {
    if (angle < min) return [min, speed < 0 ? -speed * rules.restitution : speed]
    if (angle > max) return [max, speed > 0 ? -speed * rules.restitution : speed]
    return [angle, speed]
  }
  const substep = (h: number, acceleration: readonly [number, number, number]): void => {
    const gravity = Math.max(0.5, rules.gravity + acceleration[1])
    // the pivot speeding up one way pushes the bob the other way (the frame's own inertia)
    const forwardAccel = (-gravity * Math.sin(forward) - acceleration[2] * Math.cos(forward)) / rules.length - rules.damping * forwardSpeed
    const sideAccel = (-gravity * Math.sin(side) - acceleration[0] * Math.cos(side)) / rules.length - rules.damping * sideSpeed
    forwardSpeed += forwardAccel * h
    sideSpeed += sideAccel * h
    ;[forward, forwardSpeed] = bounce(forward + forwardSpeed * h, forwardSpeed, 0, rules.limits.forward)
    ;[side, sideSpeed] = bounce(side + sideSpeed * h, sideSpeed, -rules.limits.side, rules.limits.side)
  }
  return {
    step(dt, acceleration) {
      let left = Math.max(0, Math.min(dt, 0.25))
      while (left > 1e-9) {
        const h = Math.min(rules.maxStep, left)
        substep(h, acceleration)
        left -= h
      }
      return { forward, side }
    },
    get state() {
      return { forward, side }
    },
    reset() {
      forward = side = forwardSpeed = sideSpeed = 0
    },
  }
}
