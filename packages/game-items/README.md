# @adatechnology/game-items

Engine-agnostic item catalog engine. It defines what an item is (category, real size in metres, weight in kg, rarity, durability, shelf life, nutrition,
protection, carry capacity, weapon link, where it is found), a registry that games extend and patch, and the default rules for finds, freshness, storage,
carry weight and clothing protection. It has no content (the catalog lives in `@adatechnology/game-items-goods`) and no renderer (3D lives in
`@adatechnology/game-items-three`), and it knows nothing about any game.

> Status: engine complete (T3.1a and T3.1e of spec 001): registry, rules, lazy aging, carry, protection, use effects, recipes, finds and the arsenal bridge. Everything is pure; the host keeps the state.

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

## Logic

```ts
import { createFindsProvider, freshness, blockChance, maxLoadKg, placeFinds } from '@adatechnology/game-items'

freshness(milk, { ageDays: 0, since: 0, storage: 'fridge', storedAt: 0 }, 20)   // closes the account lazily, then 'fresh' | 'stale' | 'spoiled' | 'rotten'
blockChance(pieces, 'arms', 'bite')                                              // 1 - PROD(1 - value x condition), capped at 90%
maxLoadKg(strength)                                                              // (8 + 2.5 x strength) x 1.2
const stacks = createFindsProvider(items).findsFor({ place: 'house', container: 'fridge', state: 'fortified', rng, day: 12 })
const { contents, leftover } = placeFinds(stacks, slots, items)                  // the floorplan's `contents`
```

- **Aging is lazy.** Nothing ticks: `advanceAge` closes `ageDays += (now - since) x multiplier` when an item moves or is looked at. Fridge and freezer need power (the host passes
  `powered`); a freezer without power makes the food fresh with 2 days to go; a cooler ages at x0.5 for its first 2 days; batteries lose 10% of charge per month; gasoline past 180 days fails 10% of the starts.
- **Finds are two ports behind one provider.** A container with an explicit pool (the 3D viewer's `sorteiaConteudo`: count by footprint, weighted order, fortified x2.5 and +1 on supplies,
  abandoned 40% empty plus junk) draws from it; any other draws like the game's `rollItems` (count range, category weights, rarity 60/28/9/2.5 among the items of the place). Both keep the
  order of the random draws of their source; the stacks are chosen first and the state of each (age, condition, charge, fill) is drawn after. The count falls with the days of the outbreak
  (`max(floor, 1 - perDay x days)`, none on day 0) and can be scaled by region.
- **The provider is the floorplan's `FindsProvider` by shape** (`findsFor(query) -> FindStack[]`); this package does not import `game-floorplan`.
- **The arsenal becomes items:** `itemsFromArsenal(arsenal, { records })` makes `ammo_<caliber>`, `firearm_<id>` and `throwable_<id>`; the game's boxes (`records`) give rounds, weight and rarity, the rest is estimated.
- Packs also carry `pools` (what a kind of furniture holds), `poolAliases`, `useEffects` and `recipes`; `resolveUse`, `canCraft` and `craft` read them and leave applying the result to the host.

## API

| Name | What it is |
|---|---|
| `createItems(options?)` | `ItemsCatalog`: maps `items`, `categories`, `places`, `containers`, `pools`, `recipes`, `useEffects`, `rules`; `has`, `get` (throws on unknown), `list`, `byCategory`, `byPlace`, `byTag` |
| `ItemDef` | extends the interactables `ItemDef`; fields in `src/types.ts` |
| `ITEM_CATEGORIES` | the 14 categories (`food`, `drink`, `medical`, `tools`, `melee`, `materials`, `clothing`, `bags`, `electronics`, `fuel`, `outdoors`, `books`, `collectibles`, `keys`); games add more with `categories` |
| `DEFAULT_RULES`, `ItemRules` | rarity weights 60/28/9/2.5/0.5 (legendary and unique only at fixed spots), freshness 0.5/1/1.5, storage multipliers, carry `(8 + 2.5 × strength) × 1.2` with 100% / 150%, protection cap 90%, wear -8 / -3, torn 25%, `aging`, `inventory`, `use` (past-its-best food), `spawn` (new shop stock, condition by rarity, age, charge, fill), `finds` (depletion by day, states, pool numbers) |
| `advanceAge`, `moveToStorage`, `storageMultiplier`, `freshness`, `shelfRatio`, `chargeLevel`, `failsToStart` | aging and decay |
| `blockChance`, `wearBlocked`, `repairPiece`, `pieceBlock` | layered clothing protection |
| `maxLoadKg`, `carriedKg`, `loadState`, `bagOption`, `canTake` | carry weight and slots |
| `resolveUse` | what using an item does, as data |
| `canCraft`, `craft` | recipes |
| `createFindsProvider`, `rollByCategory`, `rollExplicitPool`, `spawnData`, `depletionFactor`, `placeFinds`, `toLootTables` | finds |
| `itemsFromArsenal` | the arsenal as items |
| `checkItems(parts)` | the consistency check `createItems` runs |
| `RARITIES`, `BODY_SLOTS`, `DURABILITY_KINDS` | the closed vocabularies |

Places are a registry too: none ships, the pack or the game declares them; `finds.places` is checked only when at least one place is registered.

## Goldens against the team's code

`tests/team-golden.test.ts` compares the two ports with what the team's own code answers: `rollByCategory` with the game's `rollItems` (2400 cases) and `rollExplicitPool` with the 3D house viewer's `sorteiaConteudo` (1875 cases), same result and same number of random draws. The fixtures in `tests/fixtures/team-golden/` are recorded once by `pnpm --filter @adatechnology/game-items record:team-golden`, which cuts the functions out of the delivered sources and runs them in a `vm` with a seeded random stream.
