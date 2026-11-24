---
'@adatechnology/game-audio': minor
'@adatechnology/game-test-room': patch
---

`createRaycastOcclusion` (com `OcclusionRayFilter`, `OcclusionPartRef`, `RaycastOcclusionWorld`, `RaycastOcclusionOptions` e `OCCLUDER_MIN_RADIUS`) sai da sala de teste para o `game-audio`: monta a consulta de oclusão sobre qualquer mundo que responda raios e diga o material de uma parte (um mundo do `game-destruction` serve), sem o `game-audio` depender de outro núcleo. A sala importa do pacote; o comportamento não muda.
