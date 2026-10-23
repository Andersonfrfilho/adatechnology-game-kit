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

const kits: Record<string, VehicleKit> = {}
function kitFor(locale: string): VehicleKit {
  return (kits[locale] ||= makeFleetKit(locale))
}

/**
 * The digests in `fixtures/golden.json` were produced by the ORIGINAL code (original SDK, game plugin and fleet files, run in Node on the real
 * three.js with a fake canvas document) for every vehicle: the scene graph of each state, the zones and parts with their original ids and
 * pt-BR names, and the health and look after each scenario. Matching them proves the pack renders and breaks every vehicle as it did.
 */
export function describeGolden(group: FleetGroupId): void {
  describe(`golden: ${group}`, () => {
    for (const key of fleetGroups[group]) {
      const g = G[key]
      describe(key, () => {
        it('has a golden entry', () => {
          expect(g, key).toBeTruthy()
        })

        for (const state of ['intact', 'damaged', 'modified'] as const) {
          it(`renders the ${state} state exactly like the original`, () => {
            expect(digest(kitFor('pt-BR').build(key, state))).toEqual(g[state])
          })
        }

        it('has the zones and the parts of the original, with the original pt-BR names', () => {
          const c = kitFor('pt-BR').build(key, 'intact')
          expect(c.zones.map((z: any) => [legacyZoneId(z), z.name])).toEqual(g.zones)
          expect(c.parts.map((p: any) => [p.kind, p.label])).toEqual(g.parts)
          expect(c.zoneErrors || []).toEqual([])
        })

        for (const id of Object.keys(FLAGS)) {
          it(`breaks like the original in the ${id} scenario`, () => {
            const kit = kitFor('pt-BR')
            const want = g.scenarios[id]
            const c = kit.build(key, 'intact')
            const res = kit.zoneScenario(c, id)
            const health: Record<string, number> = {}
            for (const z of c.zones as any[]) if (res.health[z.id] != null) health[legacyZoneId(z)] = res.health[z.id]
            expect(health, `${id} health`).toEqual(want.health)
            expect(
              Object.keys(res.flags)
                .filter((f) => res.flags[f])
                .sort(),
              `${id} flags`,
            ).toEqual(FLAGS[id])
            kit.applyZones(c, res)
            expect(kit.zoneOverall(c), `${id} overall`).toMatchObject(want.overall)
            expect(digest(c), id).toEqual({ objects: want.objects, hash: want.hash, counts: want.counts })
          })
        }

        it('looks the same in English and leaks no locale key', () => {
          const kit = kitFor('en')
          const c = kit.build(key, 'intact')
          expect(digest(c)).toEqual(g.intact)
          expect(c.zones.map((z: any) => legacyZoneId(z))).toEqual(g.zones.map((z) => z[0]))
          expect(c.parts.map((p: any) => p.kind)).toEqual(g.parts.map((p) => p[0]))
          expect(c.zones).toHaveLength(g.zones.length)
          for (const [where, text] of [
            ...strings(c.zones.map((z: any) => z.name)),
            ...strings(c.parts.map((p: any) => p.label)),
            ...strings(c.glass.map((p: any) => p.label)),
          ]) {
            expect(text, where).not.toMatch(/fleet\.|\{[a-z]+\}/)
            expect(text.trim(), where).not.toBe('')
          }
        })

        it('looks the same in English when damaged', () => {
          expect(digest(kitFor('en').build(key, 'damaged'))).toEqual(g.damaged)
        })
      })
    }
  })
}
