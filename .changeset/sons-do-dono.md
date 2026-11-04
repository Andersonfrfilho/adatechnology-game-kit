---
'@adatechnology/game-audio': minor
'@adatechnology/game-test-room': minor
'@adatechnology/game-weapons-three': patch
---

Sons do dono fora do git: `loadUserSamples` registra os arquivos convertidos por `sfx:user` (em `.sfx-local/`, a partir de `user-sounds/picks.json`). Onde o SDK não tem gravação toca o do dono; onde tem, o SDK toca primeiro e o do dono fica de reserva (e em `user:<id>`). O painel de som mostra a fonte do que tocou (SDK, seu som, sintetizado) e ganha "Tocar o seu"; o catálogo ganha os usos novos (rajada .45, sacar, supressor, granada quicando, C4, passos em azulejo/grade/água/duto, escada, nadar, zumbis, helicóptero).
