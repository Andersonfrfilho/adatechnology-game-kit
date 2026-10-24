---
'@adatechnology/game-contracts': minor
'@adatechnology/game-destruction': minor
---

Contratos de parede em camadas e estágios de dano (todos opcionais): `PartSpec.layers` (`SurfaceLayer`), `reinforcement` (`Reinforcement`), `units` (`PartUnits`) e `breach` (`PartBreach`); `PartState.stage` (`DamageStage` 0 a 3), `stripped` e `opening`; `Fragment.marks` (`FragmentMark`); eventos `spall`, `stage` (com `opening` e `fragments`) e `expose`. `checkSpec` valida os campos novos. Módulos existentes compilam sem mudança.
