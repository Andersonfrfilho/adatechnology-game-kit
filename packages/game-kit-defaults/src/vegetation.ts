import * as vegetationSpecies from '@adatechnology/game-vegetation-species'
import { toSpec } from '@adatechnology/game-vegetation-species'

/** The generator spec of a species id of `game-vegetation-species` (`toSpec`), as the plant resolvers and test areas of the `-three` adapters take it (`toSpec`, `plantSpec`). */
export const defaultPlantSpec: typeof toSpec = (id) => toSpec(id)

/** The whole species pack, as the `GameVegetationSpecies` option of `createVegetationTestModule` of `game-vegetation-three` takes it. */
export function defaultVegetationSpecies(): typeof vegetationSpecies {
  return vegetationSpecies
}
