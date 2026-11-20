# Perfil do f0, segunda rodada (T2.0 da spec 017) — 2026-11-20, 02:04 a 02:42

Medição apenas: sondas temporárias, nenhuma commitada (`git checkout -- packages tools`, build refeito, `grep -c __probe017 test-room.html` = 0,
`git status` só com arquivos desta pasta). Base `6751c2d9f` (branch `spec/017-explode` com `spec/017-quadro-da-explosao` mesclada).
O diff das sondas ficou só no rascunho da sessão (não versionado).

## Método

Régua curta no modo de prazo, três f0 por tipo (média), uma página por f0, sob `flock perf-measure.lock`:

```text
PROBE_SET=<a|b|c|d|e|f> ROOM_EXPLOSION_BUDGET=deadline ROOM_EXPLOSION_KINDS=blast,crater ROOM_EXPLOSION_THROTTLES=1
ROOM_EXPLOSION_STAGE_THROTTLES=1 ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1 ROOM_EXPLOSION_FRAME_PARTS=1
ROOM_EXPLOSION_OUT=specs/017-quadro-da-explosao/medicoes/perfil-t20b-<letra>-6751c2d9f.json flock ... node tools/gpu/perf-gate.mjs room-explosion
```

`globalThis.__probe017` com um método por rótulo; cada rótulo vira um `stage` (tempo próprio, filhos descontados) e, no mesmo método, conta chamadas e
guarda o tempo inclusivo (a coluna "incl" abaixo). Os rótulos foram acrescentados a `FRAME_LABELS`; as contagens do f0 estão em
`medicoes/perfil-t20b-contagens-6751c2d9f.json`. Para atribuir a resolução estrutural a quem a chamou, uma pilha dos "donos" (`knockOutUnits`,
`bendByBlast`, `failPart`, `closeRun`...) dá o rótulo `solve@<dono>` / `groups@<dono>`.

| Rodada | Sondas | Hora | Carga início / fim | JSON |
|---|---|---|---|---|
| a | `world.ts`: resolução estrutural por dono, fecho do `run()`, `knockOutUnits`, `blastUnits`, `blastPanel`, `blastPart`/`blastObject`/`blastPlain`/`blastWorld`, `lightLeaksNear`, `exposeRebar`, `bendByBlast`, `failPart` | 02:04 a 02:09 | 1,26 / 1,44 | `perfil-t20b-a-6751c2d9f.json` |
| b | `emit`, ouvintes, `applyDamage`, `partLost` (**descartada**: o tempo por ouvinte lia `toString()` dentro da janela cronometrada) | 02:10 a 02:15 | 0,94 / 1,58 | `perfil-t20b-b-6751c2d9f.json` |
| c | renderer: tempo por tipo de evento, `onFracture`, `hide`, `spawnFragments`, `splitGroups`... | 02:15 a 02:20 | 1,46 / 2,12 | `perfil-t20b-c-6751c2d9f.json` |
| d | `action`: `effects.explosion`, `renderer.explode` por dentro, `emitHost`, `water`, sons | 02:20 a 02:25 | 1,40 / 1,99 | `perfil-t20b-d-6751c2d9f.json` |
| e | por dentro do `adoptSplit` (`extract`, `measure`, `fitSurface`...) | 02:25 a 02:30 | **1,99** / 0,93 | `perfil-t20b-e-6751c2d9f.json` |
| b2 | `emit` (corrigida) + ouvintes por função + casa por tipo de evento | 02:32 a 02:37 | 1,24 / 1,29 | `perfil-t20b-b2-6751c2d9f.json` |
| f | tudo do renderer junto, com contagem e som por chave | 02:37 a 02:42 | 1,29 / 1,56 | `perfil-t20b-f-6751c2d9f.json` |

A rodada e começou com carga 1,99 (acima do limite de 1,5); as demais começaram abaixo. O relógio do Chrome tem 0,1 ms de resolução com jitter: item
abaixo de ~0,3 ms não é confiável, e somas de muitas chamadas curtas valem pela média.

**A sonda distorce pouco ou muito?** `explode` sem sondas no mundo (rodadas c, d, e, f): 19,5 a 20,4 ms no blast e 20,7 a 21,5 no crater.
Soma dos rótulos do `explode` com sondas: rodada a **21,2 / 21,8** (+0,8 / +1,4, ~5%: boa); rodada b2 **22,5 / 24,0** (+2 / +3,6, 10 a 17%: as
sondas quentes de `emit` ×700, `applyDamage` ×506 e da casa ×474 inflam). Por isso as tabelas de resolução estrutural e do laço vêm da rodada a, e
b2 só fornece a repartição dos ouvintes e das contagens quentes. O f0 inteiro (update) com sondas: 56,4 / 57,0 (a) contra 56,7 / 56,9 (c, só renderer).

## A. Dentro do `world.explode` (ms; excl = tempo próprio, incl = com filhos; média de 3 f0)

### A1. Resolução estrutural (rodada a; b2 como segunda leitura)

| Item | chamadas blast / crater | blast ms | crater ms | quem chama |
|---|---|---|---|---|
| `solveStructure` dentro do `knockOutUnits` (~4087) | 2 / 3 | **2,97** | **2,43** | direto, uma por chamada de `knockOutUnits` (b2: 1,93 / 2,27) |
| `solveStructure` via `bendByBlast` | 2 / 2 | 0,63 | 0,60 | `bendByBlast` |
| `solveStructure` no fecho do `run()` (`settleAllStructure`) | 1 / 1 | 0,20 | 0,20 | `closeRun` |
| **`solveStructure` total dentro do `explode`** | **5 / 6** | **3,80** | **3,23** | |
| `recomputeGroups` (bend / fecho) | 3 / 3 | 0,26 | 0,30 | `bendByBlast` 2 + fecho 1 |
| **Resolução estrutural + grupos no `explode`** | | **~4,1** | **~3,5** | 20% e 17% dos 20,4 / 20,8 |
| `solveStructure` + `recomputeGroups` fora do `explode` (rótulo `none`) | 9 / 11 | 0,20 + 0,17 | 0,20 + 0,10 | **provavelmente o `world.update` do mesmo f0** (assenta a estrutura de cada objeto); não é do `explode` |
| `exposeRebar`, `bearBeam`, `bearPlate` (`judgePlate`), `failPart` → solve | 0 / 1 (`exposeRebar` crater) | 0 | 0 | `exposeRebar` crater custa 0,63 (incl.), sem solve visível |

Uma chamada de `solveStructure` dentro do `knockOutUnits` custa 1,0 a 1,5 ms; as outras, 0,3 ms ou menos. O item E (desfeito) era exatamente essa linha: 2 a 3
chamadas, ~2,4 a 3,0 ms (12 a 15% do `explode`), a maior fatia isolada da resolução estrutural.

### A2. O resto do `explode` (rodada a, salvo indicação)

| Item | chamadas blast / crater | incl blast / crater | excl blast / crater |
|---|---|---|---|
| `blastWorld` | 1 / 1 | 21,1 / 21,8 | — |
| `blastPlain` (laço dos objetos e dos `impls`) | 1 / 1 | 21,0 / 21,6 | 2,70 / 3,10 |
| `blastObject` | 14 / 14 | 18,0 / 18,2 | 0,13 / 0,07 |
| `blastCandidates` | 14 / 14 | 0,23 / 0,17 | 0,23 / 0,17 |
| **laço de `blastPart` inteiro** | **521 / 523 peças** | **17,6 / 17,7** (84% do `explode`) | 6,73 / 7,13 (a); 3,90 / 3,83 (b2, com `applyDamage` e `emit` separados) |
| `blastPanel` | 25 / 25 | 4,67 / 3,53 | 1,50 / 1,07 |
| `blastUnits` | 83 / 84 | 3,47 / 4,50 | 0,30 / 0,40 |
| `knockOutUnits` (sem a resolução estrutural) | 2 / 3 | 6,43 / 6,60 | **3,23 / 3,33** |
| `bendByBlast` | 22 / 22 | 1,20 / 1,23 | 0,47 / 0,47 |
| `applyDamage` (b2) | 506 / 508 | 3,83 / 3,97 | 0,57 / 0,53 |
| `failPart` | 11 / 10 | 1,37 / 1,53 | 1,40 / 1,50 |
| `partLost` (b2) | 11 / 10 | 0,07 / 0,07 | ~0 |
| `collapseCheck` | 26 / 28 | ~0 | ~0 |
| `flushCollapse` / `emitDetaches` / `revealHostedIn` | 2 / 2 / 2 | 0,03 / 0,00 / 0,07 | ~0 |
| `settleAllStructure` / fecho do `run()` inteiro (`closeRun`) | 4 / 2 | 0,33 / 0,43 | — (o fecho todo é 0,4 a 0,5 ms) |
| `lightLeaksNear` | 1 / 1 | 0,13 / 0,13 | 0,13 / 0,13 |

`applyDamage` → `failPart` → `partLost`: 506 `applyDamage` custam ~3,9 ms incluindo o `emit` do evento `damage`; só 10 a 11 viram `failPart` (1,4 ms),
e `partLost` é desprezível.

### A3. `emit` e os ouvintes dentro do `explode` (rodada b2; inflada, valem as proporções)

| Item | eventos blast / crater | blast ms | crater ms |
|---|---|---|---|
| `emit` inteiro (incl) | 700 / 707 | 6,0 | 5,7 |
| ouvintes `'*'` (incl) | 700 / 707 | 5,3 | 4,7 |
| `options.onEvent` | 700 / 707 | 0,1 | 0,2 |
| **casa** (`handleEvent`, `floorplan-three/destruction/world.ts`) | 700 / 707 | **3,5 a 4,7** (média 4,2) | 3,0 a 4,0 (média 3,5) |
| &nbsp;&nbsp;dos quais `breach.spall` (6 chamadas) | 6 / 6 | **2,33** | **2,17** |
| &nbsp;&nbsp;dos quais `breach.chip` | 2 / 3 | 0,53 | 0,47 |
| &nbsp;&nbsp;`houseDamage` (337 eventos) / `houseStage` / `onWreck` | | 0,10 / 0,03 / 0,03 | 0,07 / 0,03 / 0,07 |
| segundo ouvinte da casa (`breach.stage`) | 700 / 707 | 0,3 | 0,4 |
| **renderer** (`coverWhenWentOff` + fila `push`) | 700 / 707 | 0,2 | 0,15 |
| **sala** (vazamento do tanque) | 700 / 707 | 0,1 | 0,03 |

Os ouvintes são ~25% do `explode`, quase tudo da casa, e dentro dela a pintura do estilhaço (`spall`, 6 chamadas, 2,2 a 2,3 ms): é apresentação rodando
dentro do passo do mundo. O renderer não faz trabalho no ouvinte (só enfileira).

## B. Eventos estruturais no tique (`applyStructuralEvents` → `applyEvent`; rodada f, inclusive; `fracture` é onde o tempo está)

| Tipo | eventos blast / crater | blast ms | crater ms |
|---|---|---|---|
| `fracture` | 11 / 10 | **9,3** | **8,4** |
| `crack` | 20 / 22 | 2,9 | 2,8 |
| `chip` | 2 / 3 | 1,5 | 1,5 |
| `damage` | 559 / 561 | 1,4 | 1,8 |
| `stage` | 10 / 11 | 0,8 | 1,0 |
| `debris` | 68 / 68 | 0,7 | 0,8 |
| `spall` | 7 / 7 | 0,7 | 0,6 |
| `detach` | 21 / 22 | 0,4 | 0,3 |
| `dent` / `expose` | 2 / 0 e 2 / 1 | 0,3 / 0 | 0,2 / 0,3 |
| **soma** | | **18,0** | **17,7** |

Dentro do `fracture` (blast; crater parecido). O `onFracture` inteiro é 9,2 ms; os filhos se sobrepõem (o `rebuildHost` roda dentro do `hide` e do
`batchRebuilds`), por isso a tabela dá o tempo **próprio** de cada um (rodadas e/f):

| Item | chamadas blast / crater | próprio blast / crater (ms) | natureza |
|---|---|---|---|
| `rebuildHost` (reescreve a malha fundida da casa) | 19 / 21 | **3,10 / 2,27** | apresentação (malha) |
| `world.splitGroups` | 1 / 1 | **1,50 / 1,60** | mudança do mundo |
| `visuals.extract` (malha própria da peça solta) | 8 / 10 | 0,67 / 0,90 | apresentação |
| `visuals.hide` | 11 / 10 | 0,63 / 0,37 | apresentação |
| `onFracture` (o resto: cor, `partColor`, explosões do vfx) | 11 / 10 | 0,30 / 0,40 | apresentação |
| `batchRebuilds` (o resto) | 1 / 1 | 0,30 / 0,40 | apresentação |
| `spawnFragments` | 11 / 10 | 0,27 / 0,27 | apresentação |
| `loosenIfFootless` (`measure`, `setContacts`) | 11 / 10 | 0,33 / 0,13 | corpo (caixas e contatos) |
| `adoptSplit` (o resto) + `fitSurface` + `fitPartBoxes`/`fitBoxes` + `setContacts` | 8 / 10 | ~0,4 / ~0,4 | corpo |
| `pieceSys.create` (`createBodies`) | 8 / 10 | **0,03 / 0,03** | corpo |
| `makePiece`, `afterSplit`, `tetherTorn`, `hangOnHinge` | 0 a 1 | ~0 | — |
| `splitLoose` (o resto) | 32 / 32 | 0,2 a 0,4 | |
| som (`onSound`: `shatter_glass`, `crumble`, `impact_*`) | | ~1,5 a 1,7 | áudio |

Sons no tique inteiro (56 / 59 chamadas, ~4,3 ms): `impact_glass` 10/11 chamadas 1,0 a 1,4; `shatter_glass` 8/8, 0,8 a 1,2; `impact_masonry` 12/14, 0,7 a 1,0;
`detach` 21/22, 0,2; `explode` 1/1, 0,2 a 0,4 (1,7 numa página); o resto menor. Esse tempo está dentro dos eventos acima e dentro do `action`.

## C. `action` (6,3 ms; rodadas d e f)

| Item | blast ms | crater ms |
|---|---|---|
| `context.effects.explosion` (faíscas, fumaça, luz do vfx) | 2,77 | 2,70 |
| `renderer.explode` (incl) | 2,73 | 2,30 |
| &nbsp;&nbsp;`onExplode` próprio (laço do empurrão sobre 17 peças: `shove`, `waveArea`) | 1,6 | 1,2 a 1,7 |
| &nbsp;&nbsp;`loosen` | 0,5 a 0,6 | 0,4 a 0,6 |
| &nbsp;&nbsp;`sound('explode')` | 0,3 | 0,4 |
| &nbsp;&nbsp;`layGroundAt`, `fragments.blast`, `vfx.push` | ~0 / ~0 / 0,03 | ~0 / ~0 / 0,07 |
| `context.emitHost('explosion')` | 0,47 | 0,43 |
| `context.water` | 0,07 | 0,07 |
| `told` + `action(...)` (log) | 0,10 | 0,17 |
| resto do `action` | 0,2 | 0,3 |

## D. O que mais há no f0 acima de 1 ms sem rótulo próprio (rodada f / c, ms)

| Item | blast | crater | o que é |
|---|---|---|---|
| `renderCpu` (a chamada de desenho) | 7,9 a 8,9 | 8,3 a 8,8 | 960 chamadas, 380 mil triângulos; GPU 1,2 a 1,5 |
| `matrices` (`updateMatrixWorld` do three) | 1,7 | 1,6 | |
| `sysOther` (fechamentos do agendador que nenhum rótulo nomeia) | 1,5 a 1,7 | 1,4 a 1,8 | |
| `modules` (soma dos módulos; maiores: `floorplan_area` 0,47 + 0,23, `vehicles_area` 0,17, `crowd_area` 0,13 + 0,13) | 1,2 | 1,3 | |
| `world` (`world.update`, onde ficam os `solve@none`) | 1,1 | 1,1 | |
| fila `audio.voices` | 1,1 | 1,1 | |
| `sysSimulate` / `sysInput` / `sysPresent` | 0,9 / 0,8 / 0,5 | 0,9 / 0,8 / 0,8 | |

## Os cinco maiores itens do f0 de hoje (blast; o crater sai 0 a 1 ms maior)

1. **`world.explode`: 20,4 ms.** 84% é o laço de `blastPart` (521 peças); `knockOutUnits` 6,4 incl (3,2 próprio + 3,0 de `solveStructure`); ouvintes ~5 (casa ~4, com
   `spall` 2,3); resolução estrutural + grupos ~4,1.
2. **Eventos estruturais aplicados no tique: ~18,0 ms** (`fracture` 9,3: malha ~5,3, mundo 1,5, corpos ~0,8, som ~1,7).
3. **`renderCpu`: ~8,3 ms.**
4. **`action`: 6,3 ms** (`effects.explosion` 2,8; `renderer.explode` 2,5; `emitHost` 0,5).
5. **`matrices`: 1,7 ms** (empata com `sysOther` 1,6 e `modules` 1,2; abaixo disso é cauda).

Soma: 20,4 + 18,0 + 8,3 + 6,3 + 1,7 = 54,7 de um quadro de ~64 (update 56 + desenho 8,3): o resto são ~10 itens de 0,5 a 1,7 ms.

## Leitura

1. **Resolução estrutural no `explode`: ~4,1 ms de 20,4 (20%) no blast e ~3,5 de 20,8 (17%) no crater, em 5 a 6 chamadas de `solveStructure` e 3 de `recomputeGroups`.** O
   grosso é o `solveStructure` dentro do `knockOutUnits` (2 a 3 chamadas, 2,4 a 3,0 ms; 1,0 a 1,5 ms cada). O fecho do `run()` inteiro custa só 0,4 a 0,5 ms; `bendByBlast`
   0,6. As 9 a 11 chamadas "sem dono" não são do `explode` (são do `world.update`). Ou seja: a resolução estrutural é a maior fatia que **uma** linha concentra, mas
   não é a maioria do `explode`: **80% do `explode` não é resolução estrutural.** Os 20 ms são sobretudo o laço de 521 peças (`blastPart` 17,6 incl.), dos quais ~5 ms são
   ouvintes (quase tudo da casa pintando estilhaço) e ~6,4 `knockOutUnits`.
2. **Eventos estruturais (~18 ms): ~85% é apresentação, ~13% é mundo e corpo.** Mundo: `splitGroups` 1,5 ms + caixas e contatos ~0,8 (a criação dos corpos em si, `pieceSys.create`,
   custa 0,03 ms em 8 a 10 chamadas). Apresentação: ~11,8 ms de malha (`rebuildHost` 3,1, `extract`, `hide`, `crack`, `chip`, `debris`, marcas) e ~3,9 ms de som
   (`onSound`: o vidro sozinho 2 ms). Só `fracture` é 9,3 dos 18; nele a malha do `rebuildHost` (3,1) é duas vezes o que o mundo gasta (`splitGroups` 1,5).
3. **Limites.** Resolução do relógio de 0,1 ms; as rodadas b2 e f têm sondas quentes (b2 +10 a 17% no `explode`); a rodada e começou com carga 1,99. Não foi repartido por dentro:
   `knockOutUnits` próprio (3,2 ms: fragmentos e células), `blastPlain` próprio (2,7 ms: laço dos objetos e `implInRange`), `onExplode` próprio (1,6: o `shove`), `effects.explosion` (2,8),
   o `renderCpu` (8,3) e os 1,5 ms de `sysOther`. Quem chama os `solve@none` foi inferido (não provado: uma sonda no `update` confirmaria). O som foi atribuído ao
   tique pela soma das chaves; a divisão `fracture` × `crack`/`chip`/`damage` do som é estimada.
