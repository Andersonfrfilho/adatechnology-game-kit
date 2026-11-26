---
'@adatechnology/game-destruction-three': patch
'@adatechnology/game-floorplan-three': minor
---

Nada fica no ar sobre uma cratera (CLAUDE.md §12). `wakeRegion` acorda também a peça cuja raiz está fora do disco (a peça cortada de um objeto inteiro, a calçada da casa, tem a raiz na origem do objeto) quando ela está no disco e o chão sob parte da sua pegada desceu mais de 5 cm; a que o disco só toca segue dormindo. `BuildOptions.groundSurfaces: false` (novo): quando o terreno do host desenha o lote (`groundLayoutOfPlans`: zonas, coberturas de chão e caminhos), a casa não desenha mais as próprias placas planas por cima dele — elas não podiam ser cavadas e ficavam como um tampo sobre a cratera. A área de casas da sala liga a opção.
