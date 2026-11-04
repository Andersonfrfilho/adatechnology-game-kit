/** Matches a damage model's wheels to a driver's: each wheel of the spec takes the health of the tyre nearest to it. */
import type { SemiSimSpec, VehicleCondition } from './types'

export type DamagedTyre = {
  /** Where the tyre is in the vehicle's space, metres: x forward, z to the side. */
  readonly x: number
  readonly z: number
  /** 0 flat or gone, 1 whole. */
  readonly health: number
  /** The tyre is gone and the rim is on the road. */
  readonly rim?: boolean
}

export type DamageReport = {
  readonly tyres: readonly DamagedTyre[]
  readonly brakes?: number
  readonly engine?: number
  readonly suspension?: number
}

export function conditionFromDamage(spec: Pick<SemiSimSpec, 'wheels'>, report: DamageReport): VehicleCondition {
  const tyres = spec.wheels.map((wheel) => {
    let best: DamagedTyre | undefined
    let distance = Infinity
    for (const tyre of report.tyres) {
      const d = Math.hypot(tyre.x - wheel.x, tyre.z - wheel.z)
      if (d < distance) {
        distance = d
        best = tyre
      }
    }
    return best
  })
  return {
    tyres: tyres.map((tyre) => tyre?.health ?? 1),
    rims: tyres.map((tyre) => !!tyre?.rim),
    ...(report.brakes != null ? { brakes: report.brakes } : {}),
    ...(report.engine != null ? { engine: report.engine } : {}),
    ...(report.suspension != null ? { suspension: report.suspension } : {}),
  }
}
