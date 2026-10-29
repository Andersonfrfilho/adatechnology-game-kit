# @adatechnology/game-items-goods

Catalog of real-world items for [`@adatechnology/game-items`](../game-items): **327 items** with their true size (metres) and weight (kg), plus everything the engine needs to use them
(17 categories, 24 places, 17 containers, 6 rarities, 7 storage kinds, 33 recipes, 9 use effects, the explicit pools of the house furniture, depletion and spawn numbers, ammo boxes,
melee reach and noise) and the texts in pt-BR (the team's own names) and en. It is data and a thin typed wrapper: no logic, no renderer, no game.

The data is **generated** by `tools/items-catalog` from the Vale Cinzento delivery (Itens page, the game, the 3D house viewer) and the household items of the SDK; do not edit
`src/data/*.json` by hand (except `src/data/locales/en.json`, the English translation, `kinds.json`, `item-contracts.json` and `known-gaps.json`, which are kept by hand; what the kinds add to each item lives in `tools/items-catalog/kinds-overlay.json`). Run `pnpm --filter @adatechnology/items-catalog-tool catalog` after changing `decisions.json`.

## Install

```sh
pnpm add @adatechnology/game-items @adatechnology/game-items-goods
```

A plain `<script src=".../dist/index.global.js">` exposes the `GameItemsGoods` global (the engine bundled in).

## Usage

```ts
import { createGoodsItems, goodsPack, GOODS_STRINGS, goodsText } from '@adatechnology/game-items-goods'
import { createItems, createFindsProvider } from '@adatechnology/game-items'

const items = createGoodsItems({ patch: { canned_beans: { weight: 0.5 } }, remove: ['dvd'] })   // goods first, then your packs and options
// the same, by hand: createItems({ packs: [goodsPack, myPack], ... })
items.get('hammer').size                       // [w, h, d] in metres
createFindsProvider(items).findsFor({ place: 'house', container: 'fridge', state: 'normal', rng, day: 0 })

goodsText('item.canned_beans', 'pt-BR')        // 'Feijão em lata'
GOODS_STRINGS.en['place.pharmacy']             // 'Pharmacy'
```

## What is in it

| Export | Content |
|---|---|
| `goodsPack`, `createGoodsItems(options?)` | the `ItemPack` (items, categories, places, containers, use effects, recipes, pools) and `createItems` with it first |
| `GOODS_ITEMS`, `GOODS_CATEGORIES`, `GOODS_PLACES`, `GOODS_CONTAINERS`, `GOODS_RECIPES`, `GOODS_USE_EFFECTS` | the typed data |
| `GOODS_HOUSE_POOLS` | explicit pools by the 3D viewer's furniture key, plus the keys that share a pool |
| `GOODS_TABLES` | rarities, storage, depletion, spawn numbers and melee stats as read (the `DEFAULT_RULES` of the engine are proven equal to them by test) |
| `GOODS_ARSENAL_RECORDS` | ammo boxes, three firearms and two throwables of the game's `EXTRA`, for `itemsFromArsenal(arsenal, { records })` |
| `GOODS_PROVENANCE` | per item: the team id, the household id, the viewer pool types, the game ids, and where the id and the measure come from |
| `GOODS_KINDS`, `createGoodsKinds(options?)`, `checkGoodsItems(options?)`, `ITEM_CONTRACTS`, `createItemContracts(options?)`, `GOODS_KNOWN_GAPS` | the tree of kinds, its registry, the validator over the catalog, the contract checkers and the allowed gaps |
| `GOODS_STRINGS`, `goodsText(key, locale?)`, `pickGoodsLocale` | texts by key: `item.<id>`, `kind.<id>`, `kind.<id>.description`, `category.<id>`, `place.<id>`, `rarity.<id>`, `container.<id>`, `recipe.<id>` |

## Where the items come from

327 = 245 of the team (the other 12 team items are story items that belong to the game) + 54 household items with no team equivalent + 28 items the catalog needed (pool entries and recipe terms
the sources lacked). 38 household items were merged with their team equivalent and keep the household id. Measures are the household's where it had one, the model box times a real scale for the 24
modelled items, and a reference measure for the rest (`provenance.sizeSource`). Story items (diary, military map, evacuation order...) are not here: they live in the game's slice.

## Adding an item

Every item has a `kind` (`src/data/kinds.json`, a tree: `item > consumable > food_ready > canned_food`, `item > equipment > electronics`...). The kind carries the defaults (parts and
materials, impact response, use animation and sounds, leftover, raw effect...) and the **contracts** the item must meet (`physical`, `destructible`, `impact`, `edible`, `use_animation`,
`leftover`, `preparation`, `recipe_input`, `liquid_container`, `heat_resistant`, `weapon`, `wearable`, `battery`: see `src/contracts.ts`). An item declares only what differs from its kind.

1. Pick the closest kind (`createGoodsKinds().ids()`; each has a name and description in the locales as `kind.<id>`). Tuning a kind (say `metal_can`) changes every item of it.
2. Add the item the way `tools/items-catalog` says (an `extraItems` decision plus its `dimensions`), and give it a row in `tools/items-catalog/kinds-overlay.json`: `{ "kind": "canned_food", ...only what
   differs }`. The generator refuses an item without a row. A real-world value you filled in for lack of a team number goes in the row's `"estimated": ["field", ...]` list: it means "estimated from the real world,
   the teams may adjust it".
3. Regenerate (`pnpm --filter @adatechnology/items-catalog-tool catalog`) and run **`pnpm check:items`**: it prints every problem (for example `"x" (canned_food): missing nutrition, required by food_ready`) and exits
   non-zero. `known-gaps.json` lists the few gaps allowed so far; it only shrinks (a test fails when a gap stops applying, and caps its size), so a new item has to meet its kind.
4. A new kind, or a parent inserted between two kinds, is data too, never a change of the engine:

```ts
import { checkGoodsItems, createGoodsKinds } from '@adatechnology/game-items-goods'

const kinds = createGoodsKinds({
  extra: [{ id: 'sealed_can', extends: 'food_ready', defaults: { impact: { response: 'dent', pushImpulse: true, shed: false } } }],   // a new kind...
  patches: { canned_food: { extends: 'sealed_can' } },                                                                              // ...inserted above canned_food
})
const report = checkGoodsItems({ kinds, entries: myItems })    // { ok, problems, allowed }
```

## Português

**Adicionando um item.** Todo item tem um `kind` (`src/data/kinds.json`, uma árvore). O kind traz os padrões (partes, impacto, animação de uso, sobra, efeito cru) e os contratos que o item tem de cumprir;
o item só declara o que muda. Escolha o kind mais próximo, dê ao item uma linha em `tools/items-catalog/kinds-overlay.json` (`"estimated": [...]` marca o que foi estimado do mundo real e os times podem ajustar),
regenere o catálogo e rode `pnpm check:items`: ele lista cada problema e sai com erro. Kind novo, ou um pai inserido no meio, é dado (`extra` e `patches` de `createGoodsKinds`), não mudança de motor.

## Tests

`pnpm --filter @adatechnology/game-items-goods test`: the pack validates in `createItems`, ids are unique and English, every reference (category, place, rarity, pool, recipe, effect) exists, provenance covers
every item, every key has a text in both languages. The tool's own tests prove the data against the team sources.
