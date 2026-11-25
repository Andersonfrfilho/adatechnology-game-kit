---
'@adatechnology/game-kit-defaults': minor
'@adatechnology/game-test-room': patch
---

O indicador de carga (`createLoading`, `KitLoading`, `loadingMarkup`, `LOADING_CSS`, `nextPaint`) passa a morar em `@adatechnology/game-kit-defaults/world`, ao lado de `createKitWorld`: um jogo mostra o mesmo cartão da sala enquanto monta o mundo. A sala de teste usa e reexporta de lá com os nomes antigos (`RoomLoading`), sem mudança de comportamento.
