# @adatechnology/game-characters

## 0.1.1

### Patch Changes

- Updated dependencies [cb85470]
- Updated dependencies [6aa11f1]
  - @adatechnology/game-contracts@0.9.0

## 0.1.0

### Minor Changes

- d8177f4: Modelo de dano do corpo (fase 4): o personagem é um `DestructibleImpl`. Resolve a parte, proteção em camadas (presets que reproduzem as roupas do jogo: coletes, capacete de uma bala, roupa de bombeiro; mordida e arranhão pela fórmula em camadas), penetração `physical` (P = √(E·m/A), calibrada: 9 mm atravessa 2 corpos, 5,56 três, .308 quatro) e `team-game`, pontos `3,5·E^0,37` ou tabela por calibre, multiplicadores, gravidade por segmento (quebra, arranca, destrói, cascata, manca, rasteja, partido ao meio, cabeça e mandíbula), regra de morte, sangramento em eventos `leak`, os dois níveis de detalhe (segmentos e as regiões do jogo) e `penetrateLine`. Presets `arsenal` e `elenco` reproduzem as páginas dos times.
- 038d6f1: `game-characters`: passada e pose em números puros (`walkGait` igual ao do jogo, `animateProfile`, cascata, `MOVES` do Elenco, poses do corpo instanciado), `createConditionTimeline`, `kit.createCorpses()` (400 corpos, 900 s) e o gerador de aparência (`drawBodyVariance`, `drawAppearance`, regra ZVAR).
- 5e64ab9: Novo pacote `@adatechnology/game-characters` (fase 4): corpo vivo sem engine. Proporções `GUIDE` (guia do Elenco, 1,80 m, ombros 0,61 m) e `TEAM_GAME` (juntas do jogo), rig com 17 juntas e os 12 ossos do corpo instanciado, árvore de 17 segmentos (os 11 tipos do Arsenal) com as 6 regiões da multidão, registro de presets por pacote (`packs`, `patch`, `remove`) e `createCharacters`.

### Patch Changes

- Updated dependencies [76d15b6]
- Updated dependencies [cc182c7]
- Updated dependencies [9e58b50]
  - @adatechnology/game-contracts@0.8.0
