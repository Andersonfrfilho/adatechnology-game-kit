# Evidence — Spec 017

## T1.1 (parte 1) — onde vai o tempo do `world.explode`

Perfil de CPU só das chamadas do `explode` (inspetor do Node, teste descartável sem commit; explosão de 4 MJ no sobrado de `structure-solves.test.ts`,
3 de aquecimento e 7 medidas, sem orçamento de quadro: o furo da parede roda dentro da explosão).

| Onde (tempo próprio por explosão, Node) | antes | depois do cache |
|---|---|---|
| `game-floorplan-three/src/destruction/breach.ts` (furo da parede) | 194 ms | 88 ms |
| `game-destruction` (o mundo, com `solveStructure`) | 31 ms | 26 ms |
| `stamp-mask`, `pieces`, `span-index`, `game-load-path` | ~20 ms | ~20 ms |
| `world.explode` inteiro (mediana) | ~250 ms | ~139 ms |

**Achado que muda o plano:** o mundo da destruição é pequeno; o peso é o desenho do furo. `riders(host)` varria as ~1.300 peças da casa e, para
cada uma, `specOf` fazia outro `find` nelas e `hostsOf` varria a casa de novo nas colunas (`wallsAround`): quadrático, refeito a cada evento.

**Correção (`b1f727beb`):** `specOf` por índice (um `Map` por objeto de spec) e `hostOf`/`hostsOf`/`wallsAround`/`riders` guardados por id. As peças da
estrutura e suas malhas só mudam enquanto a casa é montada (`pieces.ts:162`), então as respostas não mudam; `riders` só guarda quando a casa já tem
spec; `hosts()` devolve cópia. Mesma saída: suíte inteira do `game-floorplan-three` 1.353 passam (golden exato da casa, z-fighting, furos).

**No navegador** (régua curta: `blast,crater`, 1x, 3 rodadas de estágios, carga 1,33; JSON `medicoes/f0-cache-breach-b1f727beb.json`), contra a T4.1 da 010:

| | 010 final (T4.1, 2ª tomada) | com o cache |
|---|---|---|
| f0 inteiro (update + `renderCpu`), blast / crater | 92,0 / 98,4 ms | **84,1 / 85,2 ms** |
| `explode`, blast / crater | 29,8 / 33,2 | **21,6 / 22,0** |
| `queues` (`breach-cut`), blast / crater | 14,5 / 15,7 | 14,4 / 13,3 |
| `destrEvents`, blast / crater | 12,6 / 13,1 | 12,2 / 12,8 |

**O que sobra no furo:** `paint()` redesenha a máscara inteira da parede a cada passada (zera e carimba todos os furos texel por texel, com ruído
`noise2` por texel): o custo cresce com o dano acumulado. Torná-lo incremental é o próximo corte (`queues` ~14 ms), e muda goldens só se a
ordem de carimbo mudar o resultado (D2).

## T1.1 (parte 2) — o f0 repartido no navegador e o desenho

Sondas temporárias (sem commit) em `world.emit`, no ouvinte da casa e no `cut`/`paint` do furo, mais quatro rótulos na régua. Régua curta:
`ROOM_EXPLOSION_KINDS=blast,crater ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_STAGE_THROTTLES=1 ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1
ROOM_EXPLOSION_FRAME_PARTS=1`, sob `flock perf-measure.lock`, commit `c2953d167`, 2026-11-19 19:11. JSON: `medicoes/perfil-f0-sondas-c2953d167.json`.

**Carga de 2,31 no início e 3,75 no fim (acima do 1,5 da spec; uma aba do Chrome a ~100% de um núcleo). Vale pelas proporções; não é número
de fechamento.** f0 inteiro nesta rodada: blast 101,6 / crater 100,0 ms (rodada quieta do cache: 84,1 / 85,2).

| Parte do f0 (ms) | blast | crater |
|---|---|---|
| `explode`, só o mundo | 22,9 | 21,8 |
| ouvintes do `emit`: resto / casa / `cut` / `paint` do `drop` | 0,9 / 2,6 / 1,4 / 0,0 | 1,0 / 2,8 / 1,5 / 0,0 |
| fila `destruction.events` (inteira) | 22,1 | 21,3 |
| dentro dela: `splitLoose` / `adoptSplit` / `rebuildHost` | 2,3 / 1,4 / 3,2 | 2,4 / 1,7 / 2,7 |
| fila `floorplan.breach-cut` | 11,3 | 10,6 |
| fila `floorplan.breach-paint` | 5,5 | 5,2 |
| fila `audio.voices` | 3,0 | 3,5 |
| `action` | 7,9 | 9,7 |
| `stagesOut` | 6,9 | 6,9 |
| `renderCpu` | 11,9 | 10,6 |

- No navegador o `explode` é o mundo (~22 ms); os ouvintes síncronos somam ~5 ms. O perfil do Node da parte 1 incluía a pintura porque o teste
  não tem fila de quadro.
- ~34 ms do f0 são só apresentação (as duas filas da casa, o áudio e a parte visual dos eventos).
- Desenho, a razão de a D3 não caber com a D2 e a decisão pedida (D5): `design-tiques.md`.

**Push:** a primeira tentativa de `git push` caiu ("Connection to github.com closed by remote host") depois de 15 min 47 s de pre-push
(suíte do `game-floorplan-three` em série, o que o PR #406 corrige).

## T1.2 — testes escritos antes da Fase 2 (2026-11-19)

Commits: `b917192ef` (item 1), `fa625d7a5` (item 2), `ec7706283` (item 3), `bc45b82c1` (item 4). Fixture `step-equivalence.json` e goldens do
`game-floorplan-three` (`exact-golden`, `blast-presentation`): **sem diff**, nenhuma regravação.

| Item | Teste | O que cobre | Estado |
|---|---|---|---|
| 1. Mesmos bytes da janela (C4) | `game-test-room/tests/step-equivalence-window.test.ts` | Cena do `step-equivalence` pelo caminho de quadro de exibição (`update(dt, { live: true })`), ações disparadas dentro do `fixedSimulate` por índice de tique, hash no fim de cada tique, sem entrada do jogador. Taxas 30, 120, 144 Hz e tempo de quadro aleatório de semente fixa (em torno de 30, 60 e 144 Hz) contra a de 60 Hz | **passa** até o tique do golpe (tique 30) com o solver próprio e com Jolt; **`it.fails`** do tique 31 em diante (própria e Jolt) |
| 2. Visual antes do estrutural | `game-destruction-three/tests/event-class-order.test.ts` | `hole` emitido antes do `detach` da mesma peça é desenhado (som `shot_*` antes do `detach`); `hole` emitido depois do `detach` deve ser aplicado antes | controle **passa**; o segundo é **`it.fails`** até a T2.2 (hoje aplica na ordem de emissão e a peça já é de outro objeto: o furo se perde) |
| 3. Pintura adiada = mesma máscara | `game-floorplan-three/tests/breach-deferred-mask.test.ts` | Texels (`DataTexture.image.data`) de todas as máscaras da casa depois de `flush(Infinity)` síncrono contra filas anexadas drenadas uma unidade por vez (prazo já passado); um golpe, e dois golpes com o segundo no meio da pintura pendente | **passa** (o caminho adiado de hoje já dá a mesma máscara) |
| 4. `splitLoose` pelo relógio | `game-destruction-three/tests/split-without-clock.test.ts` | Um `run` da fila de eventos com relógio injetado: prazo longe e prazo já passado separam os mesmos grupos | vermelho antes da correção (`[['pole']]` contra 3 grupos), **verde depois**. Correção em `renderer.ts` (`splitLoose`): o ramo `now < loose` e a fatia que o continuava saíram |

**Falha esperada do item 1 (o que a Fase 2/3 precisa fechar).** Os eventos do golpe são aplicados na fila `destruction.events` (fase `present`), depois do
último tique do quadro que contém o golpe. A 30 Hz (2 tiques por quadro) o tique 31 roda com a cena de antes da explosão (1 peça; 15 depois da
drenagem) e o `world.serialize()` já difere. A 120 Hz as 15 peças já existem no tique 31, mas com outras poses e outro estado do mundo
(causa não isolada nesta task; candidatas: filas contadas em quadros, e não em tiques, e algo que ainda lê o `dt` do quadro). Tudo depois do tique 31
decorre disso. Primeiro tique diferente medido: 31 em 30, 120 e 144 Hz e nos três aleatórios. O `it.fails` sai quando a janela deixar o hash por tique
independente de onde o quadro termina.

**Mudança de teste existente (item 4).** `game-destruction-three/tests/presentation-slices.test.ts`, "splits the loose groups one per frame at 0 ms":
afirmava justamente o comportamento do relógio (um grupo por quadro com `eventBudgetMs: 0`). Passou a afirmar que todos saem no primeiro quadro.
`work-budget.test.ts` (o caminho em unidades do `WorkBudget`) não mudou e passa.

**Gates (2026-11-19).**

- `pnpm --filter @adatechnology/game-test-room typecheck`, `...game-destruction-three typecheck`, `...game-floorplan-three typecheck` (inclui `tsconfig.strict.json`): sem erro.
- `game-destruction-three`: suíte inteira, 85 arquivos passam, 654 testes (195 pulados já eram pulados), 0 falhas.
- `game-test-room`: `step-equivalence.test.ts` (2) e `step-equivalence-window.test.ts` (4, dois deles `it.fails`) passam.
- `game-floorplan-three` (só os arquivos relacionados; a suíte inteira leva ~15 min e não foi rodada): `blast-presentation`, `exact-golden` (44), `breach-queue` (7), `breach-deferred-mask` (2), `destruction` (21), `stamp-mask` (3): 81 testes passam.
- `pnpm check:layers`: sem violação nova (294 conhecidas ignoradas).
- `node tools/kit-audit/audit.mjs --check --strict-clocks`: 0 novos fora do SDK dono; `own-frame-clock: 0 novos, 0 pendentes`.

## T2.0 — o f0 repartido por dentro: `explode`, `action`, `stagesOut`, `destruction.events` (2026-11-19)

Commit de base `b0b5de1e5`, sondas temporárias (nenhuma commitada; `git status` limpo e `grep -c __probe017 test-room.html` = 0 depois). Régua curta:
`ROOM_EXPLOSION_KINDS=blast,crater ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_STAGE_THROTTLES=1 ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1
ROOM_EXPLOSION_FRAME_PARTS=1`, sob `flock perf-measure.lock`. Média dos 3 f0 por tipo. Duas rodadas (sondas diferentes, para não distorcer):

| Rodada | Hora | Carga antes / depois | JSON |
|---|---|---|---|
| a (sondas largas: `explode` em 14 rótulos) | 20:28 a 20:33 | 1,61 / 2,66 | `medicoes/perfil-t20-b0b5de1e5.json` |
| b (a mais `blastPart`, `blastObject`, `blastPlain`, `knockOutUnits`, `gridOf`, `panelEdge`, `waveWork`) | 20:38 a 20:44 | 1,53 / 2,25 | `medicoes/perfil-t20-b-b0b5de1e5.json` |

Contagens e tempos por tipo de evento (snapshot ao fim do f0, 3 páginas por tipo): `medicoes/perfil-t20-contagens-b0b5de1e5.json`.

**A carga ficou acima de 1,5 no fim de cada rodada (o ferramental da própria medição: Chrome + build). Vale pelas proporções, não é número de fechamento.**
A rodada b do crater pegou carga pior (f0 98 ms contra 80 do blast): os números do crater são mais ruidosos. Resolução do relógio do Chrome nesta página: 0,1 ms;
item abaixo de ~0,3 ms não é confiável, e as médias de 3 páginas só repartem o que passa de 0,3 ms.

### Qual caminho a sala usa (a pergunta de fundo)

- A sala chama `blastAt` com a configuração padrão: **`blastPlain`, nunca `blastScene`** (`plain: 1, scene: 0` nas seis páginas). Sem `shelter`, sem `frag`,
  sem `confinement`: **`reachAt` roda 0 vezes, `rayPart` 0 vezes, `confinementOf`, `items`/`distToPart` e a ordenação não rodam**.
- `blastWorld` roda **1 vez** por explosão (nenhuma carga em cadeia no cenário; `casing` ausente no `c4`, `throwCasing` 0).

### A. `explode` (só o mundo), ms

Soma dos rótulos: blast 23,6 / crater 30,5 (rodada b; na rodada a, 23,1 no blast). Cada rótulo é o tempo próprio (filhos descontados).

| Item | blast | crater | Nota |
|---|---|---|---|
| `knockOutUnits` (tira as unidades do tijolo/bloco, chamado por `blastPanel` e `blastUnits`) | 5,5 | 7,7 | maior |
| `blastPlain` (próprio: laço dos objetos e dos `impls`, resto de `blastWorld`) | 3,0 | 4,3 | composição não repartida |
| `spallOuter` | 2,9 | 3,3 | |
| `wearJoints` | 2,2 | 2,4 | |
| `blastPart` (próprio) | 1,7 | 2,8 | |
| `failPart` | 1,5 | 2,1 | |
| `blastPanel` (próprio) | 1,4 | 1,3 | na rodada a, com `knockOutUnits` dentro, dava 4,7 |
| `waveWork` | 1,3 | 0,7 | |
| `bendByBlast` | 1,3 | 2,0 | |
| `applyDamage` (próprio) | 0,8 | 1,1 | |
| `addDent`/`addCrack`/`debris` | 0,4 | 0,5 | |
| `blastUnits` (próprio) / `blastObject` / `blastCandidates` | 0,3 / 0,2 / 0,1 | 0,4 / 0,3 / 0,2 | |
| `lightLeaksNear` | 0,1 | 0,2 | |
| `settleAllStructure` + `flushCollapse` + `emitDetaches` + `revealHostedIn` (fecho do `run()`) | 0,5 | 0,8 | |
| `partLost`, `seesFireball`, `gridOf`, `panelEdge`, `withCollapses` | <0,15 cada | <0,25 cada | |
| `reachAt` | **0 (0 chamadas, 0 `rayPart`)** | **0** | |
| `confinementOf`, montagem e ordenação de `items`, `throwCasing`, fragmentos lançados | **0 (não rodam no `blastPlain`)** | **0** | |

Três maiores: `knockOutUnits`, `blastPlain` (próprio), `spallOuter`.

### B. `action` (o que `detonate` faz fora do `world.explode`), ms

O rótulo `action` inteiro some na repartição: o que sobra dele depois de tirar os filhos é 0,3 / 0,5 ms. Antes, os 8 a 10 ms eram estes:

| Item | blast | crater |
|---|---|---|
| `context.effects.explosion` (a explosão do vfx: faíscas, fumaça, luz) | 3,5 | 4,3 |
| `renderer.explode` (o desenho: marcas e queimadura) | 2,6 | 3,3 |
| `context.water(detonation)` | 0,8 | 1,1 |
| `context.emitHost('explosion')` | 0,5 | 0,6 |
| `told` (relatório) | 0,1 | 0,1 |
| `action(...)` e narrate (as linhas do log) | <0,1 | <0,1 |
| próprio de `blastAt`/`detonate`/`ExplosiveBody` | 0,3 | 0,5 |

Três maiores: `effects.explosion`, `renderer.explode`, `water`.

### C. `stagesOut`, ms

Quem são e quem chama (pilha capturada na primeira chamada fora da física): só os estágios que **a fila `destruction.events` aplica**, todos dentro de
`onFracture` de um evento `fracture`, que `runBudgeted` → `apply` → `applyEvent` chama. Nenhum é da física, e `waterAt` (12 chamadas) pesa 0 ms.

| Estágio | chamadas (blast / crater) | blast | crater | quem chama |
|---|---|---|---|---|
| `rebuildHost` | 19 / 21 | 2,7 | 2,8 | `onFracture` → `hide` → `collapse` |
| `splitLoose` | 32 / 32 | 2,1 | 3,7 | `onFracture` |
| `adoptSplit` | 8 / 10 | 1,7 | 1,8 | `splitLoose` → `batchRebuilds` |
| `fitBoxes` | 9 / 11 | 0,1 | 0,3 | `adoptSplit` → `fitPartBoxes` → `setContacts` |
| `waterAt` | 12 / 12 | 0,0 | 0,0 | `context.water` (do `detonate`) |
| **`stagesOut`** | | **6,6** | **8,6** | |

Não é custo à parte: é uma parte do `destruction.events` da seção D (o `destrEvents` do quadro, 14,1 / 17,6 ms, já vem sem estes filhos).

### D. `destruction.events` (fila inteira: blast 20,8 / crater 26,3 ms) por tipo de evento

Tempo inclusivo de `apply` por tipo (soma dos tipos: blast 20,0 / crater 25,1 ms; o resto da fila é `runSlices`/`runSplits`/`queueChecked`).

| Tipo | eventos (blast / crater) | blast ms | crater ms | dos quais `splitLoose` / `adoptSplit` / `rebuildHost` |
|---|---|---|---|---|
| `fracture` | 11 / 10 | 10,2 | 13,0 | 2,1 / 1,7 / 2,7 (blast); 3,6 / 1,8 / 2,8 (crater) |
| `crack` | 20 / 22 | 2,9 | 3,6 | |
| `damage` | 559 / 561 | 2,2 | 2,1 | |
| `chip` | 2 / 3 | 1,4 | 2,7 | |
| `debris` | 68 / 68 | 1,2 | 1,2 | |
| `stage` | 10 / 11 | 0,9 | 1,3 | |
| `spall` | 7 / 7 | 0,6 | 0,8 | |
| `detach` | 21 / 22 | 0,4 | 0,5 | |
| `dent` / `expose` | 2 / 2 e 0 / 1 | 0,2 / 0 | 0,4 / 0,4 | |
| `hole`, `ricochet`, `bend` | 0 | 0 | 0 | |

Três maiores: `fracture` (metade da fila; 6,5 ms dela são os três estágios com rótulo), `crack`, `damage`.

### Leitura

1. **O desenho supôs errado: `reachAt` não é o maior item do `explode`, é zero.** A sala usa `blastPlain`, que não faz abrigo. A etapa B da T2.1 (grade de
   peças para o `reachAt`) e o "`lightLeaksNear` só no alcance" não têm o que cortar neste cenário (`lightLeaksNear` pesa 0,1 a 0,2 ms). O que pesa no
   `explode` é a quebra por unidades (`knockOutUnits` 5,5 a 7,7 ms, com `spallOuter`, `wearJoints`, `failPart`, `bendByBlast` ao lado): o custo de ter
   muitos eventos de dano, não de busca. O `reachAt` só entra se a sala (ou o jogo) ligar `shelter`; isso não foi medido.
2. **Dos 22 ms de `destruction.events`, só 4,1 ms (blast; 4,8 ms no crater) são tipos que o desenho deixa adiar**: `crack` 2,9 + `debris` 1,2; `hole` e `ricochet`
   não ocorrem neste cenário (0 eventos). É 20% da fila, ~5% do f0 de 80 ms. A classe estrutural (`fracture` 10,2 + `stage` + `detach` + `damage`) fica
   no quadro do golpe e é ~75% da fila: a T2.2 sozinha tira pouco do f0 deste cenário. O maior bloco continua `fracture` com seus estágios (~6,5 ms), que o desenho trata como estrutural.
3. `stagesOut` não é custo novo: é `fracture` visto de outro ângulo. `action` (8 a 10 ms) é quase todo vfx e desenho (`effects.explosion` + `renderer.explode` ~6 a 7 ms) e `context.water` ~1 ms,
   nada de narrate nem do log.
4. **Limites:** `blastPlain` (próprio) 3,0 a 4,3 ms e `knockOutUnits` não foram repartidos por dentro (laço dos `impls` com `describe()`, o resto de `blastWorld`;
   o que `knockOutUnits` faz por unidade). Se a T2.1 for tocar nisso, a próxima rodada é por dentro deles. A carga acima de 1,5 e o relógio de 0,1 ms limitam tudo abaixo de ~0,3 ms.

## T0.1 — Régua de partida (medição, sem mudança de código)

- **Comando:** `flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/gpu/perf-gate.mjs` (o próprio portão define `PERF_MODE=gpu`, `tools/gpu/perf-gate.mjs:136`; não foi preciso passar a variável). Sala refeita antes com `pnpm build` e `pnpm check:area room --no-browser --no-unit --room`.
- **Commits:** branch `spec/017-quadro-da-explosao` = `95f0539bb`; `origin/main` = `443527b47` (base medida pelo portão).
- **Máquina:** ANGLE, NVIDIA GeForce RTX 5070 Laptop GPU (discreta), janela 1600x900, tier `discrete`. Não houve pulo por GPU de software nem por bateria.
- **Horário:** build e sala às 20:46 a 20:50. Tentativa 1: 20:50:20 a 21:00:20. Tentativa 2: 21:00:42 a 21:25:42.
- **Carga (1 min):** antes da tentativa 1: 1,49 (após espera). Antes da tentativa 2: 1,83. Depois da tentativa 2: 3,78. O portão imprimiu `waiting for a quiet machine (load 5.8/7.2/4.9/4.3, under 4 wanted)` em vários pontos, ou seja, a carga ficou acima do limite durante boa parte da medição: os números valem só como indicativos.

### O que aconteceu

1. **Tentativa 1 (morta pelo tempo limite de 10 min).** Passou pela medição do branch (fases tempestade, `dense_horde`, `chain_horde`) e foi interrompida pelo `timeout 600` na medição da `origin/main`, depois de `cold_molotov`. Nenhum veredito. Log: `specs/017-quadro-da-explosao/medicoes/perf-gate-t01-95f0539bb-try1-killed-at-10min.log` (`Target page, context or browser has been closed`, `exit 124`).
2. **Tentativa 2 (morta pelo tempo limite de 25 min).** Ampliei o limite porque a instrução dizia que a rodada pode passar de 10 min. O portão fez três passagens: branch, `origin/main` (completa) e branch de novo (`17 metric(s) over 10% worse: measuring both sides again`). Foi interrompido por `timeout 1500` (`EXIT=124`) enquanto esperava máquina tranquila antes da repetição. **Não imprimiu o veredito.** Log final: `specs/017-quadro-da-explosao/medicoes/perf-gate-t01-95f0539bb.log`.
3. Pelo critério do enunciado (mesmo passo falhou 2 vezes pelo mesmo motivo: a rodada não termina dentro do limite), registrei o bloqueio e parei. Não houve terceira tentativa.

### Números brutos do portão (sem interpretação)

Valores de frame p99, pior quadro e quadros acima de 33 ms, lidos das linhas `PHASE` do log. "passagem 1/2" são as duas medições do branch na tentativa 2.

| Fase | Lado | p99 (ms) | Pior quadro (ms) | Quadros > 33 ms |
|---|---|---|---|---|
| tempestade | origin/main (tentativa 2) | 19,7 | 527,2 | 57 |
| tempestade | branch (tentativa 1, morta no meio do main) | 20,3 | 593,6 | 55 |
| tempestade | branch, passagem 1 (tentativa 2) | 35,4 | 595,9 | 110 |
| tempestade | branch, passagem 2 (tentativa 2) | 27,6 | 319,8 | 61 |
| `dense_horde` | origin/main (tentativa 2) | 17,7 | 25,6 | 0 |
| `dense_horde` | branch (tentativa 1) | 17,7 | 31,7 | 0 |
| `dense_horde` | branch, passagem 1 (tentativa 2) | 21,3 | 72,9 | 4 |
| `dense_horde` | branch, passagem 2 (tentativa 2) | 17,7 | 41,5 | 1 |
| `chain_horde` | origin/main (tentativa 2) | 24,3 | 105,7 | 18 |
| `chain_horde` | branch (tentativa 1) | 21,9 | 99,4 | 12 |
| `chain_horde` | branch, passagem 1 (tentativa 2) | 30,4 | 122,9 | 25 |
| `chain_horde` | branch, passagem 2 (tentativa 2) | 33,0 | 125,2 | 33 |

### Veredito do portão

Não foi impresso. A última linha do log antes do corte é `pre-push: waiting for a quiet machine (load 4.3, under 4 wanted)`, seguida de `EXIT=124`. Linhas do portão que saíram antes do corte, copiadas como estão:

- `PERF  43 budget(s) broken (0 hard, the rest are targets)` (branch, passagem 1, tentativa 2)
- `PERF  37 budget(s) broken (0 hard, the rest are targets)` (origin/main)
- `pre-push: 17 metric(s) over 10% worse: measuring both sides again`
- `PERF  42 budget(s) broken (0 hard, the rest are targets)` (branch, passagem 2)

### Bloqueio e próximo passo

- Bloqueio: o portão inteiro (duas medições de cada lado, mais a repetição quando há regressão de mais de 10%) não cabe em 25 min nesta máquina com a carga atual. A carga ficou acima de 4 durante a medição, e o portão espera máquina tranquila antes de cada passagem.
- Não foi feito: veredito do portão; medição em janela sem carga; medição de `dense_horde`/`chain_horde` com `PERF_SHARD` separado. Próximo passo sugerido, fora desta task: rodar com a máquina ociosa (sem outra sessão pesada) e limite de pelo menos 40 min, ou fixar `PERF_BASE` num resultado de `origin/main` já cacheado.

## T3.1 — régua antes e depois (2026-11-19, 21:57 a 22:23)

Régua curta (`blast,crater`, 1x, 3 rodadas de estágios, `FRAME_PARTS=1`, `jolt-d4-worker`, sob `flock`), quatro rodadas alternadas com a página
refeita em cada commit: antes `3bdbc8c1c`, depois `7c3c373bc`. Carga de 1 minuto no início de cada rodada: 1,39 / 1,30 / 1,34 / 1,34; no fim:
2,33 / 2,54 / 1,94 / 1,49 (a própria régua sobe a carga). JSONs: `medicoes/regua-t31-{antes,depois,antes2,depois2}-<commit>.json`.

| f0 a 1x (média de 2 rodadas × 3 piores f0, ms) | antes, blast / crater | depois, blast / crater |
|---|---|---|
| f0 inteiro (update + `renderCpu`) | 83,6 / 81,2 | 78,5 / 74,8 |
| f0 sem o `explode` | 62,5 / 59,9 | 55,0 / 53,6 |
| fila `floorplan.breach-cut` | 8,9 / 7,9 | 0,0 / 0,0 |
| fila `floorplan.breach-paint` | 5,0 / 5,1 | 7,5 / 8,6 |
| `explode` (a T3.1 não toca) | 21,1 / 21,2 | 23,5 / 21,1 |
| fila `destruction.events` | 18,7 / 18,6 | 18,8 / 18,2 |
| pior quadro dos 7 seguintes | 22,0 / 22,6 | 27,2 / 23,6 |

- **Ganho medido: ~5 a 7 ms no f0** (~6 a 7 ms sem o `explode`, que variou 19,6 a 27,4 ms entre rodadas do mesmo código: o ruído é do tamanho
  do efeito). A estimativa do desenho era ~16 ms; não se confirmou.
- **Por que menos:** o `breach-cut` zerou, mas a fila de prazo passou a pintar mais no próprio f0 (5 → 8 ms), porque a cota mínima por quadro
  (um terço das pendentes) vale já no quadro em que as paredes entram. Ajuste pedido: no quadro do golpe sem folga, só 1 parede; o resto se
  divide nos dois quadros seguintes.
- **Quadro seguinte:** um quadro 1 do `blast` foi a 32,8 ms com 12,3 ms de pintura (pior caso visto); a média dos piores subiu de 22,0 para 27,2.
- **Não explicado:** a fila `audio.voices` caiu de ~3,7 para ~1,2 ms no f0 sem a T3.1 tocar em áudio. Em investigação (importa para a C5).
