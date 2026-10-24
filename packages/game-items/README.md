# @adatechnology/game-items

Engine-agnostic item catalog engine. It defines what an item is (category, real size in metres, weight in kg, rarity, durability, shelf life, nutrition,
protection, carry capacity, weapon link, where it is found), a registry that games extend and patch, and the default rules for finds, freshness, storage,
carry weight and clothing protection. It has no content (the catalog lives in `@adatechnology/game-items-goods`) and no renderer (3D lives in
`@adatechnology/game-items-three`), and it knows nothing about any game.

> Status: skeleton (T3.1a of spec 001). Types, the `createItems` registry and the default rules are in; aging, carry, protection, recipes and finds logic come with T3.1e.

Units: metres, kilograms, litres, days.

## Install

```sh
pnpm add @adatechnology/game-items
```

A plain `<script src=".../dist/index.global.js">` exposes the `GameItems` global.

## Usage

```ts
import { createItems } from '@adatechnology/game-items'
import type { ItemDef } from '@adatechnology/game-items'

const beans: ItemDef = { id: 'canned_beans', category: 'food', size: [0.075, 0.11, 0.075], weight: 0.43, rarity: 'common', shelfLife: 1460, portions: 2 }

const items = createItems({
  packs: [{ id: 'mine', items: [beans], places: [{ id: 'house' }] }],
  patch: { canned_beans: { weight: 0.45 } },        // field by field; arrays replace
  rules: { carry: { baseKg: 10 } },                 // merged over DEFAULT_RULES
})
items.get('canned_beans').volume // 0.928 L, derived from size
items.byCategory('food')
```

Order: packs (a later item with the same id replaces), `patch`, `remove`, `include`. Every inconsistency (unknown category, rarity or place, invalid size,
weight, shelf life, protection, carry or rule) is reported in one error.

## API

| Name | What it is |
|---|---|
| `createItems(options?)` | `ItemsCatalog`: maps `items`, `categories`, `places`, `containers`, `rules`; `has`, `get` (throws on unknown), `list`, `byCategory`, `byPlace`, `byTag` |
| `ItemDef` | extends the interactables `ItemDef`; fields in `src/types.ts` |
| `ITEM_CATEGORIES` | the 14 categories (`food`, `drink`, `medical`, `tools`, `melee`, `materials`, `clothing`, `bags`, `electronics`, `fuel`, `outdoors`, `books`, `collectibles`, `keys`); games add more with `categories` |
| `DEFAULT_RULES`, `ItemRules` | rarity weights 60/28/9/2.5/0.5 (unique only at fixed spots), freshness 0.5/1/1.5, storage multipliers, carry `(8 + 2.5 × strength) × 1.2` with 100% / 150%, protection cap 90%, wear -8 / -3, torn 25%, `spawn.retailNew` |
| `checkItems(parts)` | the consistency check `createItems` runs |
| `RARITIES`, `BODY_SLOTS`, `DURABILITY_KINDS` | the closed vocabularies |

Places are a registry too: none ships, the pack or the game declares them; `finds.places` is checked only when at least one place is registered.
