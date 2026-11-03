import { residentialItems } from '@adatechnology/game-floorplan-residential'

/** The furniture catalogue of `game-floorplan-residential`, as the `catalog` option of `furnitureSpec` of `game-floorplan-three` takes it (sizes in metres by type). */
export function defaultFurnitureCatalog(): typeof residentialItems {
  return residentialItems
}
