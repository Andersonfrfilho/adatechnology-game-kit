export type WalkPlan = { x: number; z: number; remaining: number }

export type StepWalkPlanParams = {
  readonly plan: WalkPlan | null
  readonly dt: number
  readonly player: { moveBy(dx: number, dz: number): void }
  readonly camera: { readonly position: { readonly x: number; readonly z: number } }
}

/** Moves the player `dt` of the way along a scripted walk; the plan left, or null when it arrived. */
export function stepWalkPlan({ plan, dt, player, camera }: StepWalkPlanParams): WalkPlan | null {
  if (!plan) return null
  const fraction = plan.remaining <= dt ? 1 : dt / plan.remaining
  player.moveBy((plan.x - camera.position.x) * fraction, (plan.z - camera.position.z) * fraction)
  plan.remaining -= dt
  return plan.remaining <= 1e-9 ? null : plan
}
