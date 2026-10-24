---
'@adatechnology/game-characters': minor
---

Modelo de dano do corpo (fase 4): o personagem é um `DestructibleImpl`. Resolve a parte, proteção em camadas (presets que reproduzem as roupas do jogo: coletes, capacete de uma bala, roupa de bombeiro; mordida e arranhão pela fórmula em camadas), penetração `physical` (P = √(E·m/A), calibrada: 9 mm atravessa 2 corpos, 5,56 três, .308 quatro) e `team-game`, pontos `3,5·E^0,37` ou tabela por calibre, multiplicadores, gravidade por segmento (quebra, arranca, destrói, cascata, manca, rasteja, partido ao meio, cabeça e mandíbula), regra de morte, sangramento em eventos `leak`, os dois níveis de detalhe (segmentos e as regiões do jogo) e `penetrateLine`. Presets `arsenal` e `elenco` reproduzem as páginas dos times.
