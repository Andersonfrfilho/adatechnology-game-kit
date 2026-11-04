# @adatechnology/game-floorplan-interactables

## 1.0.0

### Patch Changes

- 11308d7: Tipa o adaptador entre a planta e o kit de interativos: `Json` vira `unknown`, o plano que `plan` devolve (`AdapterPlan`, `PlanEntry`), as opções de `plan`, `createWorld`, `add` e `blockedOf` e os módulos do kit (`InteractablesKit`, `HouseholdKit`) têm tipos exportados, e o `src` fica sem `any`. Os pacotes do kit entram como `peerDependencies` opcionais, só pelos tipos.
- Updated dependencies [ebb9479]
  - @adatechnology/game-interactables-household@0.5.0

## 0.1.0

### Minor Changes

- 1cb7dc8: New package `@adatechnology/game-floorplan-interactables`: the team's `AdaptadorInterativos` ported (plan to objects of the interactables kit, wiring, gas, water, chairs, contents, doors fitted to the walls), every table a registry. `game-floorplan-three` uses it as the default of `interactives` (`adapter` still injects another, `adapterOptions` goes to `create`) and the bridge no longer misreads the plan (`floorY`, `panel`, `mats.floor`).
