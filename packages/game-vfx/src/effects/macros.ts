import type { WorkshopEngine } from '../workshop/engine'
import type { Vec3Tuple } from '../workshop/types'
import { bloodHit, impact } from './builders/blood'
import type { ImpactMaterial } from './builders/blood'
import { explode, fireEmit } from './builders/fire'
import type { FireEmitOptions } from './builders/fire'
import { chips, rustAt, sparkAt } from './builders/shared'
import { casing, muzzle } from './builders/weapon'
import type { CasingType, WeaponName } from './builders/weapon'

export interface MacroContext {
  readonly engine: WorkshopEngine
  readonly cameraPosition: Vec3Tuple
  readonly dt: number
}

type MacroArgs = readonly unknown[]

/** The helpers the page's recipes share (`bloodHit`, `impact`, `fireEmit`, `explode`, `muzzle`, `casing`, `chips`, `sparkAt`, `rustAt`), called by name from a step. */
export const MACROS: Readonly<Record<string, (context: MacroContext, args: MacroArgs) => void>> = {
  blood_hit: ({ engine }, [point, direction, age, scale]) => bloodHit(engine, point as Vec3Tuple, direction as Vec3Tuple, age as number, scale as number | undefined),
  impact: ({ engine }, [material, point, normal, scale, age]) => impact(engine, material as ImpactMaterial, point as Vec3Tuple, normal as Vec3Tuple, scale as number | undefined, age as number | undefined),
  fire_emit: ({ engine, dt }, [key, centre, radius, factor, options]) => fireEmit(engine, key as string, dt, centre as Vec3Tuple, radius as number, factor as number, options as FireEmitOptions | undefined),
  explode: ({ engine, cameraPosition }, [point, scale, chipColor]) => explode(engine, point as Vec3Tuple, scale as number, cameraPosition, chipColor as number | undefined),
  muzzle: ({ engine }, [weapon, tip, direction]) => muzzle(engine, weapon as WeaponName, tip as Vec3Tuple, direction as Vec3Tuple),
  casing: ({ engine }, [port, type]) => casing(engine, port as Vec3Tuple, type as CasingType),
  chips: ({ engine }, [point, direction, count, spread]) => chips(engine, point as Vec3Tuple, direction as Vec3Tuple, count as number, spread as number | undefined),
  spark_at: ({ engine }, [point, direction, count, spread]) => sparkAt(engine, point as Vec3Tuple, direction as Vec3Tuple, count as number, spread as number | undefined),
  rust_at: ({ engine }, [point, count]) => rustAt(engine, point as Vec3Tuple, count as number),
}
