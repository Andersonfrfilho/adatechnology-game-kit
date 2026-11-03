import { buildItem } from './build-item'
import { hasItemModel } from './models/registry'

/** The item models as a source a weapon or an explosive can draw with (`ItemModels` of game-weapons-three): a host lends it as `items`. */
export const itemModels = { has: hasItemModel, build: buildItem } as const
