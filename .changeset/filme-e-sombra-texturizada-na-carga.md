---
'@adatechnology/game-render-three': patch
'@adatechnology/game-fluids-three': minor
'@adatechnology/game-test-room': patch
---

- `shadowCasterProbes`: cada sonda vem depois de uma sonda instanciada (e vice-versa). Na passada de sombra o three r160 desenha todos os objetos com um material de profundidade compartilhado e só escolhe o programa de novo quando o objeto troca entre comum e instanciado; seis sondas comuns em fila ficavam todas com o programa da primeira, e o `USE_MAP` da parede texturizada ligava no jogo, quando ela era desenhada logo depois dos destroços (instanciados) de uma explosão.
- `FilmManager.warmUpProbes()`: o filme de combustível e sangue tem sondas para o aquecimento, com materiais que o gerenciador guarda até o `dispose`. Cada grade do filme liberava o próprio material, e o programa ia junto com a última; a próxima explosão que derramava combustível ligava de novo. A sala registra as sondas.
