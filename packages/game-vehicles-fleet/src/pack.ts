import type { KitConfiguration, Plugin, VehicleKit, VehicleSpec } from '@adatechnology/game-vehicles'
import type { FleetContext, FleetLabel, FleetShared } from './context'
import { fleetGroupIds } from './groups'
import type { FleetGroupId, FleetVehicleId } from './groups'
import { legacyGlassLabels, legacyVehicleSeeds, legacyZoneIds } from './legacy-seeds'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'
import { createScenarios } from './scenarios'
import type { FleetScenarioId } from './scenarios'
import { installBoatsExtra } from './vehicles/boats-extra'
import { installCarsExtra } from './vehicles/cars-extra'
import { installHeavy } from './vehicles/heavy'
import { installHelicoptersExtra } from './vehicles/helicopters-extra'
import { installMilitary } from './vehicles/military'
import { installMotorcyclesCars } from './vehicles/motorcycles-cars'
import { installMotorcyclesExtra } from './vehicles/motorcycles-extra'
import { installPlanesExtra } from './vehicles/planes-extra'
import { installSuvPickupVan } from './vehicles/suv-pickup-van'
import { installWaterAir } from './vehicles/water-air'

export const version = '0.1.0'

export interface FleetOptions {
  /** Groups to install (default: all of them). */
  groups?: readonly FleetGroupId[]
  /** Only these vehicles (default: every vehicle of the chosen groups). */
  vehicles?: readonly FleetVehicleId[]
  /** Vehicles to leave out. */
  exclude?: readonly FleetVehicleId[]
  /** Register the generic damage scenarios and make the front crash the default damage (default `true`). */
  scenarios?: boolean
}

/** A fuel of the `kit.fuels` registry. The texts follow the locale of the kit. */
export interface FleetFuel {
  id: string
  name: string
  yield: string
  shelfLife: string
  where: string
  effect: string
}

/** The vehicle files, in the order the vehicles are registered (and shown). The water/air file must come before the files that use its helpers. */
const installers: Array<(fx: FleetContext) => void> = [
  installMotorcyclesCars,
  installSuvPickupVan,
  installHeavy,
  installMilitary,
  installWaterAir,
  installMotorcyclesExtra,
  installCarsExtra,
  installBoatsExtra,
  installPlanesExtra,
  installHelicoptersExtra,
]

const FUEL_FIELDS: Record<string, keyof FleetFuel> = {
  name: 'name',
  yield: 'yield',
  shelf_life: 'shelfLife',
  where: 'where',
  effect: 'effect',
}

/** Reads a table of the pack from the strings in use by the kit (`fleet.<section>`). */
function section(kit: VehicleKit, name: string): Record<string, any> {
  return ((kit.strings as unknown as Record<string, any>).fleet || {})[name] || {}
}

function createContext(kit: VehicleKit, options: FleetOptions): FleetContext {
  const groups = new Set<string>(options.groups || fleetGroupIds)
  const only = options.vehicles ? new Set<string>(options.vehicles) : null
  const skip = new Set<string>(options.exclude || [])
  const shared: FleetShared = {}
  const t = (key: string, vars?: Record<string, unknown>) => kit.t('fleet.' + key, vars)
  return {
    kit,
    shared,
    t,
    label: (key: string): FleetLabel => ({ key, label: t('labels.' + key) }),
    register(spec: VehicleSpec, build) {
      if (!groups.has(spec.group as string) || (only && !only.has(spec.key)) || skip.has(spec.key)) return
      kit.register({ ...spec, seedKey: legacyVehicleSeeds[spec.key] }, build)
    },
  }
}

/**
 * The fleet pack as a plugin for `createVehicleKit` (or `kit.plugin`). It adds the en and pt-BR texts, the vehicles, the groups, the fuels, the
 * effect texts of the part and zone kinds that are free of any story, and the generic damage scenarios.
 * Texts that tie the damage to a story (zone effects such as panel, door or glass) are left to the game: set them with `kit.configure({ zoneEffects })`.
 */
export function createFleetPack(options: FleetOptions = {}): Plugin {
  return {
    name: 'game-vehicles-fleet',
    install(kit: VehicleKit) {
      kit.registerLocale('en', enLocale)
      kit.registerLocale('pt-BR', ptBrLocale)
      kit.registerLegacySeeds({ zones: legacyZoneIds, glassLabels: legacyGlassLabels })
      const groups = fleetGroupIds.filter((g) => !options.groups || options.groups.includes(g))
      const fuels: Record<string, FleetFuel> = {}
      const fuelTable = section(kit, 'fuels')
      for (const id of Object.keys(fuelTable)) {
        const fuel: Record<string, string> = { id }
        for (const [field, prop] of Object.entries(FUEL_FIELDS)) fuel[prop] = fuelTable[id][field]
        fuels[id] = fuel as unknown as FleetFuel
      }
      const config: KitConfiguration = {
        fuels,
        groups: [...groups],
        waterGroups: { water: true },
        defaultGroup: 'cars',
        partEffects: section(kit, 'part_effects'),
        zoneEffects: section(kit, 'zone_effects'),
      }
      if (options.scenarios !== false) {
        config.scenarios = createScenarios((id: FleetScenarioId) => kit.t('fleet.scenarios.' + id))
        config.damagedScenario = 'front_crash'
      }
      kit.configure(config)
      const fx = createContext(kit, options)
      for (const install of installers) install(fx)
    },
  }
}

/** The whole fleet with the default options. */
export const fleetPack: Plugin = createFleetPack()

/** Installs the fleet into a kit made by `createVehicleKit`. Same as `kit.plugin(createFleetPack(options))`. */
export function installFleet(kit: VehicleKit, options: FleetOptions = {}): VehicleKit {
  return kit.plugin(createFleetPack(options))
}

export { enLocale, ptBrLocale }
