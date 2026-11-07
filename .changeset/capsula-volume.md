---
'@adatechnology/game-audio': patch
'@adatechnology/game-weapons-three': patch
---

A cápsula e o carregador caindo deixam de tocar no nível do tiro: o banco do kit não dava ganho aos arquivos `casing_drop_*` e `mag_drop_*` (ficavam a 0 dB do tiro, os dois normalizados a -1 dBFS). Agora o nível vem de `data/sample-levels.json` (cápsula 32 dB abaixo do tiro, carregador 24 dB), com no máximo 3 cápsulas e 2 carregadores soando ao mesmo tempo por chão, e `SampleDefaults` aceita `choke`.
