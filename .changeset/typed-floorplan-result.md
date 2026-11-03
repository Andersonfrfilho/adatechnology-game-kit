---
'@adatechnology/game-floorplan': patch
'@adatechnology/game-floorplan-residential': patch
'@adatechnology/game-floorplan-rural': patch
'@adatechnology/game-floorplan-post-apocalyptic': patch
'@adatechnology/game-floorplan-structure': patch
---

Typed floorplan: `Json` is now `unknown`, and the plan records (`PlanDoor`, `PlanWall`, `PlanWindow`, `PlanGate`, `LotPath`, `Lot`, `Facade`), the resolved slots, the walkability grid (`WalkGrid`), the `placeOnFloor` options and the `generate` result (`FloorplanResult`) have their own types. Template-specific fields (`config`, `building`, extension outputs) are `unknown` and narrowed by the pack that writes them. Generated plans are unchanged.
