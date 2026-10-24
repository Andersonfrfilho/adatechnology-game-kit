// Bundle entry (IIFE global `ItemsArea`): the items module of @adatechnology/game-items-three over the goods catalog, ready for any room page:
// `ItemsArea.loadInto(room)` loads it and opens its area.
// Bench: category (shows one shelf), wear, age and storage of the food (with power or without), the place, container, state and outbreak day of the finds with a seed and a
// "roll finds" button (the stacks go on the finds table), the recipe and a "craft" button. Layers: labels, size boxes, highlight of the items that are still simple shapes.
import { createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { createItemsTestModule } from '@adatechnology/game-items-three'

export { createItemsTestModule, createGoodsItems }

/** Creates the module for the room's locale (`?lang=en` or pt-BR) over the goods catalog, loads it and opens the items area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const catalog = options.catalog ?? createGoodsItems()
  const report = room.loadModule(createItemsTestModule({ translate: goodsText, ...options, catalog, locale }))
  room.openArea('items_area')
  return report
}
