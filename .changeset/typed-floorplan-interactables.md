---
'@adatechnology/game-floorplan-interactables': patch
---

Tipa o adaptador entre a planta e o kit de interativos: `Json` vira `unknown`, o plano que `plan` devolve (`AdapterPlan`, `PlanEntry`), as opções de `plan`, `createWorld`, `add` e `blockedOf` e os módulos do kit (`InteractablesKit`, `HouseholdKit`) têm tipos exportados, e o `src` fica sem `any`. Os pacotes do kit entram como `peerDependencies` opcionais, só pelos tipos.
