---
"@adatechnology/game-physics": minor
"@adatechnology/game-characters-three": minor
"@adatechnology/game-crowd-three": minor
---

Os mortos da multidão da sala são corpos do motor (TS.7). `game-crowd-three`: o módulo da multidão faz cada cadáver do registro virar corpo pelo aplicador `services.corpses()` (R0 a R3, interesse na posição da câmera, a morte cai sobre a pilha que já existe), o corpo que foi empurrado e dormiu longe avisa a horda por `relocateCorpse`, `room.clear()` e o detach tiram os corpos do mundo, e o desenho segue o corpo pelo canal novo de instância (`CrowdInstance.rotation`, `CrowdFrame.lying`). `game-characters-three`: `createBodyBatch({ oriented: true })` e `BodyInstance.rotation` (atributo `iQ`). `game-physics`: `CorpseBodies.restoreFresh` restaura os cadáveres num mundo novo, `PhysicsServices.onCorpseSettled`, e os serviços criam o orçamento do 'lod' e o enchem a cada quadro quando o host não dá um. Sem motor (`own`) nada muda.
