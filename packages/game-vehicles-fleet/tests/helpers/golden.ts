import { describe, expect, it } from 'vitest'
import { legacyZoneId } from '@adatechnology/game-vehicles'
import type { VehicleKit } from '@adatechnology/game-vehicles'
import golden from '../fixtures/golden.json'
import { fleetGroups } from '../../src'
import type { FleetGroupId } from '../../src'
import { digest } from './digest'
import type { Digest } from './digest'
import { makeFleetKit, strings } from './kit'

interface ScenarioGolden extends Digest {
  health: Record<string, number>
  overall: { health: number; band: number }
}

interface VehicleGolden {
  /** Id of the vehicle in the earlier game. */
  seed: string
  intact: Digest
  damaged: Digest
  modified: Digest
  /** `[original zone id, pt-BR name]` in the order the zones are built. */
  zones: Array<[string, string]>
  /** `[part kind, pt-BR label]` in the order the parts are built. */
  parts: Array<[string, string]>
  scenarios: Record<string, ScenarioGolden>
}

const G = golden as unknown as Record<string, VehicleGolden>
const FLAGS: Record<string, string[]> = {
  front_crash: [],
  left_side_crash: [],
  rollover: ['flipped'],
  abandoned: ['abandoned'],
  burnt: ['burnt'],
}

// Owner decision (2026-11-12, CLAUDE.md §13): a part drawn flush with another z-fights, so it now sits 1-3 mm off it or stops where the other begins; the spokes of a wheel are each a little thinner than the one before.
// The parts, their materials, the zones and the size of each vehicle stay the original's; only the sizes and positions of the flush parts moved, so the vertex hash differs.
const Z_FIGHTING_FIXES: ReadonlySet<string> = new Set(['adventure_bike', 'ambulance', 'amphibian_turboprop', 'apc_6x6', 'armored_car_6x6', 'armored_truck', 'attack_helicopter', 'battle_tank', 'box_truck', 'cargo_van', 'commuter_motorcycle', 'compact_hatch', 'compact_pickup', 'compact_suv', 'crop_duster', 'crossover_pickup', 'cruiser', 'delivery_bike', 'electric_hatch', 'family_hatch', 'fastback_sedan', 'fishing_boat', 'highway_police_bike', 'highway_police_sedan', 'hybrid_suv', 'jet_ski', 'large_suv', 'light_attack_turboprop', 'light_jet', 'midsize_pickup', 'midsize_sedan', 'midsize_suv', 'monster_truck', 'naked_bike', 'piston_helicopter', 'police_helicopter', 'police_sedan', 'quad_bike', 'regional_turboprop', 'rescue_dinghy', 'rescue_helicopter', 'rideshare_hatch', 'river_skiff', 'sailboat', 'single_engine_plane', 'speedboat', 'sport_bike', 'step_through_scooter', 'tandem_trainer', 'tanker_truck', 'tractor', 'trail_bike', 'trainer_helicopter', 'troop_truck', 'turbine_helicopter', 'turbo_hatch', 'v8_coupe'])

/** The look of a vehicle against the original: bit for bit, except for the vehicles whose flush parts moved, which keep the object and particle counts. */
function expectLook(actual: Digest, want: Digest, key: string, label?: string): void {
  if (Z_FIGHTING_FIXES.has(key)) expect({ objects: actual.objects, counts: actual.counts }, label).toEqual({ objects: want.objects, counts: want.counts })
  else expect(actual, label).toEqual({ objects: want.objects, hash: want.hash, counts: want.counts })
}

const kits: Record<string, VehicleKit> = {}
function kitFor(locale: string): VehicleKit {
  return (kits[locale] ||= makeFleetKit(locale))
}

/**
 * The digests in `fixtures/golden.json` were produced by the ORIGINAL code (original SDK, game plugin and fleet files, run in Node on the real
 * three.js with a fake canvas document) for every vehicle: the scene graph of each state, the zones and parts with their original ids and
 * pt-BR names, and the health and look after each scenario. Matching them proves the pack renders and breaks every vehicle as it did.
 */
export function describeGolden(group: FleetGroupId, slice?: { part: number; of: number }): void {
  const keys = fleetGroups[group]
  const size = slice ? Math.ceil(keys.length / slice.of) : keys.length
  const mine = slice ? keys.slice((slice.part - 1) * size, slice.part * size) : keys
  describe(slice ? `golden: ${group} ${slice.part}/${slice.of}` : `golden: ${group}`, () => {
    for (const key of mine) {
      const g = G[key]
      describe(key, () => {
        it('has a golden entry', () => {
          expect(g, key).toBeTruthy()
        })

        for (const state of ['intact', 'damaged', 'modified'] as const) {
          it(`renders the ${state} state exactly like the original`, () => {
            expectLook(digest(kitFor('pt-BR').build(key, state)), g[state], key)
          })
        }

        it('has the zones and the parts of the original, with the original pt-BR names', () => {
          const c = kitFor('pt-BR').build(key, 'intact')
          expect(c.zones.map((z) => [legacyZoneId(z), z.name])).toEqual(g.zones)
          expect(c.parts.map((p) => [p.kind, p.label])).toEqual(g.parts)
          expect(c.zoneErrors || []).toEqual([])
        })

        for (const id of Object.keys(FLAGS)) {
          it(`breaks like the original in the ${id} scenario`, () => {
            const kit = kitFor('pt-BR')
            const want = g.scenarios[id]
            const c = kit.build(key, 'intact')
            const res = kit.zoneScenario(c, id)
            const health: Record<string, number> = {}
            for (const z of c.zones) if (res.health[z.id] != null) health[legacyZoneId(z)] = res.health[z.id]
            expect(health, `${id} health`).toEqual(want.health)
            expect(
              Object.keys(res.flags)
                .filter((f) => res.flags[f])
                .sort(),
              `${id} flags`,
            ).toEqual(FLAGS[id])
            kit.applyZones(c, res)
            expect(kit.zoneOverall(c), `${id} overall`).toMatchObject(want.overall)
            expectLook(digest(c), want, key, id)
          })
        }

        it('looks the same in English and leaks no locale key', () => {
          const kit = kitFor('en')
          const c = kit.build(key, 'intact')
          expectLook(digest(c), g.intact, key)
          expect(c.zones.map((z) => legacyZoneId(z))).toEqual(g.zones.map((z) => z[0]))
          expect(c.parts.map((p) => p.kind)).toEqual(g.parts.map((p) => p[0]))
          expect(c.zones).toHaveLength(g.zones.length)
          for (const [where, text] of [
            ...strings(c.zones.map((z) => z.name)),
            ...strings(c.parts.map((p) => p.label)),
            ...strings(c.glass.map((p) => p.userData.glass?.label)),
          ]) {
            expect(text, where).not.toMatch(/fleet\.|\{[a-z]+\}/)
            expect(text.trim(), where).not.toBe('')
          }
        })

        it('looks the same in English when damaged', () => {
          expectLook(digest(kitFor('en').build(key, 'damaged')), g.damaged, key)
        })
      })
    }
  })
}
