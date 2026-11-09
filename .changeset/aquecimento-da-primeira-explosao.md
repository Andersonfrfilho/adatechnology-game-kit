---
'@adatechnology/game-render-three': minor
'@adatechnology/game-vfx': minor
'@adatechnology/game-audio': minor
'@adatechnology/game-destruction-three': minor
'@adatechnology/game-test-room': patch
---

A primeira explosão não liga programa nem decodifica som no meio do jogo.

- `createProgramWarmup`: no primeiro desenho do aquecimento, todo objeto que projeta sombra entra nos mapas de sombra (sem o recorte pela câmera da sombra; `shadowCasters: 'visible'` volta ao de antes). O three r160 só liga o programa de profundidade de um objeto quando a passada de sombra o desenha, e o `compile` nunca faz isso: a parede texturizada da calçada da casa, fora da caixa do sol na carga, ligava o programa `USE_MAP ... DEPTH_PACKING 3201` quando entrava na caixa, no meio do jogo.
- `shadowCasterProbes(THREE)`: sondas que projetam sombra com material iluminado, com e sem textura, nos três lados; a sala registra.
- `explosionEffectIds(explosions?)` do `game-vfx`: toda explosão do catálogo de efeitos. A sala aquece todas (antes, uma lista à mão de nove, sem o P13, o barril, o tanque do carro e os foguetes).
- `AudioEngine.preload(ids)`: decodifica agora os arquivos desses sons (e das variantes de um conjunto), uma vez só. `blastSoundIds()` do `game-destruction-three`: o estrondo de cada família, o eco distante, a cauda em lugar fechado, o fogo e os destroços por material. A sala pré-carrega esses e o `water_splash` na primeira tecla ou clique.
