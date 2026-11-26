---
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-three': minor
---

Nada fica no ar sobre uma cratera (CLAUDE.md §12). `wakeRegion` acorda a peça pelo centro de massa e pelo tamanho dela, não pela raiz: a peça cortada de um objeto inteiro (a calçada da casa, a lixeira do lote) tem a raiz na origem do objeto e não acordava quando o chão sob ela era cavado. `BuildOptions.groundSurfaces: false` (novo): quando o terreno do host desenha o lote (`groundLayoutOfPlans`: zonas, coberturas de chão e caminhos), a casa não desenha mais as próprias placas planas por cima dele — elas não podiam ser cavadas e ficavam como um tampo sobre a cratera. A área de casas da sala liga a opção.
