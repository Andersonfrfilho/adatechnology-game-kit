---
'@adatechnology/game-contracts': minor
'@adatechnology/game-items': minor
'@adatechnology/game-items-goods': minor
'@adatechnology/game-fluids': minor
'@adatechnology/game-items-three': minor
'@adatechnology/game-test-room': minor
---

Cans open before they are eaten, and a holed or leaking can is no longer food.

- `game-contracts`: `SealSpec` (what opens a closed container: `openWith` tools or `byHand`; `spoilsWhenBreached`), `sealOpener` and `sealBlock`, and `TestableItem.seal` (`ModuleItemSeal`, with `open` and `contents` to draw the item open and what is left in it). `ItemUseDef` keys take the `eat` action.
- `game-items`: `ItemDef.seal`; `resolveUse` with `UseContext.seal` does not spend a sealed item that is still closed, holed through or leaking (`UseResult.blocked`).
- `game-items-goods`: the `canned_food` kind opens with a can opener, a pocket knife or a knife; `canned_drink` and the sardines open by hand; both are spoiled by a hole or a leak. The kind's seal is on every item of the catalog.
- `game-fluids`: the `eat` use (spoonfuls from an open tin); `drink(id, liters, { eaten })` takes the liquid packed with the food without the effects of drinking it.
- `game-items-three`: `openItem` draws a model open (`data/opening.json`): the cut lid of a tin bent up with the food inside the rim, the peeled lid of the sardines, the mouth of a drink can; `setOpeningContents` empties it as it is eaten. The items area gives the tins `seal` and the `eat` use.
- `game-test-room`: a use that empties a sealed item opens it first, by hand or with a tool of the seal within reach or in the loadout, and says what is missing; a holed or leaking item is refused for eating and drinking; eating logs what was eaten.
