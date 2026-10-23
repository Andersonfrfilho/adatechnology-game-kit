import type { DamageZone, ScenarioContext, ScenarioDefinition } from '@adatechnology/game-vehicles'
import { legacyScenarioSeeds } from './legacy-seeds'

/** Ids of the damage scenarios of the pack, in the order they are registered. */
export const scenarioIds = ['front_crash', 'left_side_crash', 'rollover', 'abandoned', 'burnt'] as const

export type FleetScenarioId = (typeof scenarioIds)[number]

/**
 * The generic damage scenarios (front crash, left side crash, rolled over, abandoned, burnt out). `name` translates the display name
 * (`fleet.scenarios.<id>`). A scenario that tells a story is left to the game.
 */
export function createScenarios(name: (id: FleetScenarioId) => string): ScenarioDefinition[] {
  return [
    {
      id: 'front_crash',
      seedId: legacyScenarioSeeds.front_crash,
      name: name('front_crash'),
      zone(z: DamageZone, X: ScenarioContext) {
        const cen = X.center!
        const ty = z.type
        const s = X.clamp((cen.x - (X.front - 0.42 * X.length)) / (0.42 * X.length), 0, 1)
        if (s <= 0 && !X.isWindshield) return
        let k =
          {
            bumper: 1,
            light: z.fxKey === 'taillight' ? 0 : 1,
            hood: 0.85,
            panel: 0.78,
            door: 0.6,
            glass: 0.55,
            internal: z.sub === 'radiator' ? 1 : z.sub === 'engine' ? 0.85 : 0.4,
            wheel: 0.55,
            roof: 0.3,
            part: 0.85,
          }[ty as string] || 0.6
        if (z.tags.indexOf('front') >= 0) k = Math.max(k, 0.95)
        let v = 100 - Math.pow(s, 0.85) * 92 * k
        if (X.isWindshield) v = Math.min(v, 42)
        if (v < 99) X.set(z, v)
      },
    },
    {
      id: 'left_side_crash',
      seedId: legacyScenarioSeeds.left_side_crash,
      name: name('left_side_crash'),
      zone(z: DamageZone, X: ScenarioContext) {
        const cen = X.center!
        const ty = z.type
        const x0 = (X.front + X.rear) / 2 + 0.12 * X.length
        const dd = X.clamp(1 - Math.abs(cen.x - x0) / (0.42 * X.length), 0, 1)
        let sideK = z.side < 0 ? 1 : z.side > 0 ? 0 : 0.35
        if (ty === 'internal' && z.side === 0) sideK = 0.15
        const kk =
          { door: 1, panel: 0.85, glass: 1.05, wheel: 0.7, light: 0.5, roof: 1, bumper: 0.4, hood: 0.5, part: 0.8, lid: 0.4 }[
            ty as string
          ] || 0.5
        const val = 100 - Math.pow(dd, 0.7) * 95 * kk * sideK
        if (val < 99) X.set(z, val)
      },
    },
    {
      id: 'rollover',
      seedId: legacyScenarioSeeds.rollover,
      name: name('rollover'),
      zone(z: DamageZone, X: ScenarioContext) {
        const cen = X.center!
        const ty = z.type
        const s2 = X.clamp((cen.y - X.clearance) / Math.max(0.3, X.top - X.clearance), 0, 1)
        let val = 100
        if (ty === 'roof' || z.id === 'deck' || z.id === 'rotor') val = 14
        else if (ty === 'glass') val = X.isWindshield ? 22 : z.side > 0 ? 8 : 30
        else if (X.bodyTypes[ty as string] || ty === 'part') val = 100 - s2 * 70 - (z.side > 0 ? 25 : 0)
        else if (ty === 'light') val = 55
        else if (ty === 'wheel') val = 70
        else if (ty === 'internal') val = z.sub === 'fuel_tank' ? 45 : z.sub === 'engine' ? 50 : 80
        if (val < 99) X.set(z, val)
        X.flags.flipped = true
      },
    },
    {
      id: 'abandoned',
      seedId: legacyScenarioSeeds.abandoned,
      name: name('abandoned'),
      zone(z: DamageZone, X: ScenarioContext) {
        const ty = z.type as string
        const r = X.rand
        const val =
          X.bodyTypes[ty] || ty === 'part'
            ? 56 + r() * 16
            : ty === 'glass'
              ? r() < 0.45
                ? 15
                : 40
              : ty === 'wheel'
                ? 38
                : ty === 'light'
                  ? 42
                  : ty === 'internal'
                    ? z.sub === 'fuel_tank'
                      ? 70
                      : z.sub === 'engine'
                        ? 32
                        : 45
                    : 60
        X.set(z, val)
        X.flags.abandoned = true
      },
    },
    {
      id: 'burnt',
      seedId: legacyScenarioSeeds.burnt,
      name: name('burnt'),
      zone(z: DamageZone, X: ScenarioContext) {
        const ty = z.type as string
        const val = X.bodyTypes[ty]
          ? 34
          : ty === 'part'
            ? 22
            : ty === 'glass' || ty === 'light' || ty === 'wheel'
              ? 0
              : ty === 'internal'
                ? z.sub === 'radiator'
                  ? 10
                  : 4
                : 30
        X.set(z, val)
        X.flags.burnt = true
      },
    },
  ]
}
