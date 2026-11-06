import type * as THREE_NS from 'three'

import type { installArmor } from './armor'
import type { installContext } from './context'
import type { installBody } from './body'
import type { installCar } from './car'
import type { installDamagePanels } from './damage-panels'
import type { installDamageParts } from './damage-parts'
import type { installExplosion } from './explosion'
import type { installFluids } from './fluids'
import type { installGeometry } from './geometry'
import type { installGlassDamage } from './glass-damage'
import type { installGlass } from './glass'
import type { installHood } from './hood'
import type { installImpact } from './impact'
import type { installInterior } from './interior'
import type { installLights } from './lights'
import type { installMaterials } from './materials'
import type { installParticles } from './particles'
import type { installRollover } from './rollover'
import type { installScenarios } from './scenarios'
import type { installTick } from './tick'
import type { installTrucks } from './trucks'
import type { installWarp } from './warp'
import type { installWheels } from './wheels'
import type { installZoneApply } from './zone-apply'
import type { installZoneAuto } from './zone-auto'
import type { installZoneCore } from './zone-core'
import type { installZoneDecals } from './zone-decals'
import type { installZoneDent } from './zone-dent'
import type { installZoneDerive } from './zone-derive'

/** The three.js namespace the host passes (typed by `@types/three`; the package binds to no version at runtime). */
export type Three = typeof THREE_NS

/** The helpers the modules share through `kit._`: what each `install*` puts there. */
export type KitShared = ReturnType<typeof installContext> &
  ReturnType<typeof installArmor> &
  ReturnType<typeof installBody> &
  ReturnType<typeof installCar> &
  ReturnType<typeof installDamagePanels> &
  ReturnType<typeof installDamageParts> &
  ReturnType<typeof installExplosion> &
  ReturnType<typeof installFluids> &
  ReturnType<typeof installGeometry> &
  ReturnType<typeof installGlassDamage> &
  ReturnType<typeof installGlass> &
  ReturnType<typeof installHood> &
  ReturnType<typeof installImpact> &
  ReturnType<typeof installInterior> &
  ReturnType<typeof installLights> &
  ReturnType<typeof installMaterials> &
  ReturnType<typeof installParticles> &
  ReturnType<typeof installRollover> &
  ReturnType<typeof installScenarios> &
  ReturnType<typeof installTick> &
  ReturnType<typeof installTrucks> &
  ReturnType<typeof installWarp> &
  ReturnType<typeof installWheels> &
  ReturnType<typeof installZoneApply> &
  ReturnType<typeof installZoneAuto> &
  ReturnType<typeof installZoneCore> &
  ReturnType<typeof installZoneDecals> &
  ReturnType<typeof installZoneDent> &
  ReturnType<typeof installZoneDerive>

/**
 * Internal shape of the kit while the modules are installing. Modules attach the public API to it (`kit.x = ...`)
 * and share helpers through `kit._`. The public, typed view of the same object is `VehicleKit` in `api.ts`.
 */
export interface Kit {
  THREE: Three
  V3: Three['Vector3']
  PI: number
  document: any
  strings: any
  t: (key: string, vars?: Record<string, unknown>) => string
  matchers: any
  hash: any
  clamp: any
  smooth: any
  /** Helpers shared between modules (not public). */
  _: KitShared
  [key: string]: any
}

/** The object a vehicle is built in (`kit.build` returns it): the groups, the parts, the zones and the builders `add`, `roundBox`, `part`, ... */
export type BuildContext = InstanceType<KitShared['BuildContext']>
