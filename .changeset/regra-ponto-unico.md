---
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-kit-defaults': minor
'@adatechnology/game-test-room': minor
---

As regras do kit que movem uma peça por conta própria (`goOverIfBalanced`, `checkUndermined`, `loosenIfFootless`, `topple`) passam por um ponto único com o
nome da regra e são medidas por uma régua de energia (`KitEnergyLedger`): o que cada uma dá é contado (`renderer.kitEnergy()`) e, quando passa da queda da
própria peça, avisado (`RendererOptions.onKitEnergy`, evento `kitEnergy` no `game-kit-defaults`). A sala registra `check`/`fail` com
`invariant: kit_energy`. Nada é cortado: o comportamento das regras não muda.
