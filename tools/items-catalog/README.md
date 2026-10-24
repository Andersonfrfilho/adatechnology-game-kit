# items-catalog

Writes the reconciled data of the real-world items catalog (`packages/game-items-goods/src/data`) from the team deliveries, so every number has a traceable origin.

| Reads | What |
|---|---|
| Itens do Vale Cinzento data (`sources/armas-itens__itens-vale-cinzento.js`) | `DATA`: 257 items, 14 categories, 24 places, 6 rarities, 33 recipes, 16 containers, regions, region specialties (cut by bracket matching with `golden-tool` and evaluated in an empty `vm` context) |
| Itens do Vale Cinzento page (`artefatos/NKmk….html`) | the storage table and the rules in prose (freshness, protection, carry, spawn, supply events), each kept with its line number and exact words |
| Jogo (`artefatos/2UG1….../jogo.js`) | `CONT_TAB`, `RAR_W`, `EXTRA`, `FIXOS`, `LOOT`, `ITENS` (a drift guard: all inside the team data) and the text of `useItem` (guards the use effects) |
| Visor de casas 3D (`sources/jogo__visor-casas-3d.js`) | `CONTEUDO` (house container pools) and `COMIDA_SUP` |
| `base/household-items.sdk.json` | the 92 items of `game-interactables-household`, frozen |
| `decisions.json` | every reconciliation choice as `{ value, source, reason }` (merges with the household, English ids, created items, scope, categories, places, stacks, measures, recipe terms, viewer aliases) |

| Writes | |
|---|---|
| `packages/game-items-goods/src/data/{items,categories,places,rarities,storage,recipes,containers,depletion,spawn,house-pools,ammo-boxes,use-effects,melee,provenance}.json` | generated |
| `--game-out <dir>`: `{documents,regions,uses,damage-points,fixed,faction-loot,supply-events}.json` | the slice that belongs to the game, not to the SDK |

Every item has a definitive English id (`decisions.json.ids`, the household id for the 38 `merge`d pairs; `mergeRejected` keeps the look-alikes that stay apart). `extraItems` creates the 28 items the sources
lack (a viewer pool entry or a recipe term needs them; `provenance.json` marks them `created`). A recipe term that is not an item is a fluid, a thing of the world (furniture, fire, soil) or a trait (`match`), never a hole:
every recipe resolves. `dimensions` is the work of T3.1d; until it lands, sizes are placeholders derived from the weight (`provenance.json` says which).

```bash
pnpm --filter @adatechnology/items-catalog-tool build
pnpm --filter @adatechnology/items-catalog-tool catalog                          # regenerate
pnpm --filter @adatechnology/items-catalog-tool catalog:check                    # fail when the generated files are stale
node tools/items-catalog/dist/cli.js --game-out ../zombiada/content/items       # also write (or, with --check, compare) the game slice
```

To change a choice, edit its value in `decisions.json` and regenerate. `tests/sources.test.ts` checks the generated data against the sources (counts, weight, rarity, places, fields, durability and
recipe round trips through a pt-BR formatter, storage multipliers against the page and `DEFAULT_RULES`, every citation on its line, the game's `ITENS` inside the team data, the viewer pools against the aliases);
`tests/catalog-up-to-date.test.ts` is the same as `catalog:check`.
