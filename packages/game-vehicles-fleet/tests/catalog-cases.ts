import { fleetGroups } from '../src'
import { makeFleetKit } from './helpers/kit'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
export type Root = { traverse(f: (o: unknown) => void): void }
const kit = makeFleetKit('pt-BR')
export const cases: Array<[string, () => Root]> = []
for (const keys of Object.values(fleetGroups)) {
  for (const key of keys) for (const state of ['intact', 'damaged'] as const) cases.push([`${key}/${state}`, () => kit.build(key, state).root])
  const first = keys[0] as string
  cases.push([
    `${first}/front_crash`,
    () => {
      const c = kit.build(first, 'intact')
      kit.applyZones(c, kit.zoneScenario(c, 'front_crash'))
      return c.root
    },
  ])
}
