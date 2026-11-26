---
'@adatechnology/game-physics': minor
'@adatechnology/game-physics-jolt': minor
'@adatechnology/game-player': minor
---

Controlador de personagem atrás do contrato (spec 008, T4.1). `game-physics` ganha `createCharacter`, `moveCharacter`, `pushCharacter`, `readCharacter`, `teleportCharacter`, `characterSupported` e `removeCharacter` (sobe degrau de 18 cm, rampa de 30 graus, empurra caixa de 30 kg, é empurrado); `game-physics-jolt` os implementa com o `CharacterVirtual` por `CharacterId`; `game-player` aceita `PlayerWorld.controller` e traz `createPhysicsController`. Sem controlador o jogador anda pela grade como antes.
