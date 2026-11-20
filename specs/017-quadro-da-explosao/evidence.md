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

## T3.1 — ajuste medido, e a régua mede em modo de cota (2026-11-19, 22:30 a 22:49)

Três rodadas alternadas, mesma régua curta, carga 1,27 / 1,43 / 1,30 no início: ajuste `858d64862`, antes `3bdbc8c1c`, ajuste de novo.
JSONs: `medicoes/regua-t31-{ajuste,ajuste2}-858d64862.json`, `regua-t31-antes3-3bdbc8c1c.json`.

| f0 a 1x (ms; antes = média de 3 rodadas, T3.1 e ajuste = 2 cada) | antes, blast / crater | T3.1 `7c3c373bc` | ajuste `858d64862` |
|---|---|---|---|
| f0 inteiro | 84,4 / 81,4 | 78,5 / 74,8 | 74,0 / 76,8 |
| f0 sem o `explode` | 62,5 / 60,2 | 55,0 / 53,6 | 53,5 / 55,3 |
| `breach-cut` | 8,8 / 7,9 | 0,0 / 0,0 | 0,0 / 0,0 |
| `breach-paint` | 5,2 / 5,1 | 7,5 / 8,6 | 8,4 / 10,8 |
| `audio.voices` | 3,5 / 3,5 | 1,2 / 1,1 | 1,1 / 1,1 |
| pior quadro dos 7 seguintes | 22,1 / 23,3 | 27,2 / 23,6 | 22,6 / 23,9 |

- **O ajuste não mudou o f0 na régua** (~54 ms sem o `explode`, igual à T3.1 sem ajuste): a fila de prazo continua gastando 8 a 11 ms no f0.
- **Causa, lida no código:** a régua move a sala com `room.update(dt)` (`tools/gpu/room-explosion.mjs:382`), que chama
  `scheduler.frame(dt, { render: false, exact })` **sem `frameStartMs`** (`room.ts`, `update`). Sem ele o orçamento fica em **modo de cota**
  (`budget.ts`, `beginFrame`): as filas recebem os 8 ms da sala em todo quadro, por mais atrasado que ele esteja. No jogo (laço `startLoop`,
  modo de prazo) um quadro que já estourou dá às filas só o piso de 1 ms. Na régua a fila de pintura sempre tem "folga" e pinta enquanto
  cabe nos 8 ms; o ajuste (1 parede no quadro sem folga) nunca é exercitado.
- **Consequência:** a régua não mede o f0 na configuração que a página usa (§15, "na configuração que a página usa por padrão"). Ela
  superestima o trabalho das filas de prazo no f0, e subestimou o ganho da T3.1 e do ajuste. O `audio.voices` em 1,1 ms é o mesmo efeito:
  a pintura gasta a cota comum e sobra ao áudio a reserva de 1 ms.
- **Próximo passo:** a régua ganha o modo de prazo (o `frameStartMs` passado à sala) e as rodadas antes/depois são refeitas nele.

## T3.1 — régua no modo de prazo (2026-11-19, 22:55 a 23:20)

A régua ganhou `ROOM_EXPLOSION_BUDGET=deadline` (`54853aff6`): a sala recebe o início do quadro (o instante antes da ação do golpe) e o
orçamento das filas fica no modo que o jogo usa. O relatório grava o modo e, por quadro, a cota e o gasto `mustDrain`; no f0 a cota das filas
foi de 1 ms (o piso), como no jogo. Padrão da régua inalterado (`quota`).

Quatro rodadas alternadas, régua curta, carga no início 1,38 / 1,42 / 1,33 / 1,37 e no fim 1,47 / 1,69 / 0,95 / 1,37. "Antes" = `3bdbc8c1c` mais
só o commit da régua (`7e3c262c5`, não publicado); "depois" = `54853aff6` (T3.1 com o ajuste). JSONs: `medicoes/regua-prazo-*.json`.

| f0 a 1x, modo de prazo (média de 2 rodadas × 3 piores f0, ms) | antes, blast / crater | depois, blast / crater |
|---|---|---|
| f0 inteiro (update + `renderCpu`) | 76,0 / 80,2 | **68,0 / 67,8** |
| f0 sem o `explode` | 54,9 / 57,0 | 47,9 / 47,3 |
| `mustDrain` gasto no quadro | 28,4 / 29,4 | 18,1 / 18,0 |
| fila `floorplan.breach-cut` | 9,1 / 9,2 | 0,0 / 0,0 |
| fila `floorplan.breach-paint` | 0,0 / 0,0 | 4,4 / 4,0 |
| fila `destruction.events` | 19,3 / 20,1 | 18,1 / 18,0 |
| `explode` | 21,1 / 23,2 | 20,1 / 20,4 |
| `action` / `renderCpu` | 7,1 / 8,5 e 6,9 / 9,6 | 6,5 / 8,9 e 6,5 / 8,4 |
| pior quadro dos 7 seguintes | 20,9 / 20,1 | 24,1 / 23,3 |

- **Ganho da T3.1 no modo do jogo: ~8 a 12 ms no f0** (78 → 68 ms na média; 56 → 47,6 sem o `explode`). Uma rodada "antes" do `crater` saiu em
  85,2 e a outra em 75,3: o intervalo honesto é 8 a 12.
- **Resto na fila de prazo:** 4 ms no f0 para "uma parede". Uma parede custa ~4 ms (a casa da régua tem poucas paredes cortadas, não vinte), e o
  piso de 1 ms deixa a fila começar uma. Ajuste seguinte: não começar parede que não cabe no que sobra do quadro, salvo se venceu a janela.
- **Quadros seguintes:** o pior sobe de ~20,5 para ~23,7 ms (a pintura adiada cai no quadro 1: ~8 ms). Dentro dos 33,3.
- **Base da spec no modo de prazo:** f0 ~78 ms antes da T3.1 (a base de 84 a 92 ms da 010 e da parte 1 foi medida em modo de cota).
- `audio.voices` gasta ~1,1 ms no f0 nos dois lados: no modo de prazo as vozes só têm a reserva de 1 ms no quadro do golpe. Se o som do golpe
  sai no f0 (C5) precisa de conferência própria.

## T3.1 — ajuste 2 medido no modo de prazo (2026-11-19 23:41 a 2026-11-20 00:00)

A fila de prazo não começa parede não vencida que não cabe no que resta do quadro (`f35e64ce4`). Régua curta, `ROOM_EXPLOSION_BUDGET=deadline`.
Rodadas válidas (carga no início / fim): `depois3-54853aff6` 1,34 / 1,22; `ajuste2b-f35e64ce4` 1,47 / 1,36; `ajuste2c-f35e64ce4` 1,43 / 1,57.
**Descartada:** `ajuste2-f35e64ce4` (23:33), terminou com carga 16,84 (testes de outra task rodando junto; crater em 83 ms, quadro seguinte em 43 ms).

| f0 a 1x, modo de prazo (ms) | antes da T3.1 (2 rodadas) | T3.1 `54853aff6` (3 rodadas) | ajuste 2 `f35e64ce4` (2 rodadas) |
|---|---|---|---|
| f0 inteiro, blast / crater | 76,0 / 80,2 | 68,1 / 67,8 | 65,7 / 64,2 |
| f0 sem o `explode` | 54,9 / 57,0 | 47,8 / 47,2 | 44,7 / 43,1 |
| `breach-cut` + `breach-paint` | 9,1 / 9,2 | 4,4 / 4,2 | 0,2 / 0,1 |
| `destruction.events` | 19,3 / 20,1 | 18,1 / 17,7 | 18,6 / 18,4 |
| `explode` | 21,1 / 23,2 | 20,3 / 20,6 | 21,1 / 21,1 |
| pior quadro dos 7 seguintes | 20,9 / 20,1 | 24,2 / 23,6 | 25,3 / 24,5 |

- **T3.1 inteira: f0 de ~78 para ~65 ms (−13), e a pintura da casa sai do quadro do golpe** (9 → 0,2 ms). As duas rodadas do ajuste deram
  62,4 / 63,3 e 69,0 / 65,1: o `explode` e os eventos variam ±1,5 ms entre rodadas do mesmo código.
- **Quadros seguintes:** ~25 ms no pior (a pintura adiada, ~10 ms, cai no quadro 1), abaixo de 33,3.
- **O que sobra no f0 (~65 ms):** `explode` ~21, `destruction.events` ~18,5, `renderCpu` ~8,5, `action` ~6,5, resto ~10.

## Push barrado em 2026-11-19 23:30 — teste lento sob carga

`tests/test-area.test.ts › every typology of the engine builds` (game-floorplan-three) falhou no pre-push depois de 142 s, com a máquina em
carga 13 (pre-push e testes de outra task ao mesmo tempo). Sozinho, com a máquina quieta: passa em 52 s (arquivo inteiro: 17 testes, 95 s).
É estouro de tempo por carga, não erro do código.

## Eventos visuais adiados, primeira versão (`083277451`) — sem ganho (2026-11-20, 00:23 a 00:48)

Quatro rodadas alternadas, modo de prazo, carga 1,31 a 1,46 no início e 0,90 a 1,50 no fim. Antes `91aa9ee8a` (T3.1 + T2.2), depois `083277451`.
JSONs: `medicoes/regua-visual-*.json`.

| f0 a 1x, modo de prazo (ms, 2 rodadas cada) | antes, blast / crater | depois, blast / crater |
|---|---|---|
| f0 inteiro | 65,7 / 63,6 | 65,3 / 63,7 |
| f0 sem o `explode` | 44,8 / 43,4 | 44,8 / 43,5 |
| pior quadro dos 7 seguintes | 24,9 / 26,1 | 24,4 / 25,5 |

- **Nenhum ganho medido.** Bate com a revisão de código, que reprovou a versão: no laço real o tique roda antes do dreno do quadro, e
  `applyStructuralEvents` aplicava no tique todos os visuais que vêm antes do último estrutural, sem adiar. Os testes rodavam na ordem inversa.
- **A T2.2 não mudou o f0:** 65,7 / 63,6 aqui contra 65,7 / 64,2 antes dela (ajuste 2 da T3.1).
- **A régua perdeu o rótulo dos eventos:** desde a T2.2 a fila `destruction.events` gasta 0 ms no f0 e o `mustDrain` do quadro é 0; o custo
  (~18 ms) passou para o tique e aparece em `sysOther` (~14 ms) sem nome. A régua ganhou o rótulo `destrEvents` também para
  `applyStructuralEvents`, para as próximas rodadas.

## Rodada 3 — eventos visuais adiados e cortes do `explode` (2026-11-20, 01:13 a 01:51)

Seis rodadas alternadas, modo de prazo, carga no início 1,30 a 1,47 e no fim 1,10 a 1,50. Base `49eee5cc2`; eventos visuais adiados por peça
`68019e19a` (branch `spec/017-visual`); cortes do `explode` A–D+F `b244d1323` (branch `spec/017-explode`). JSONs: `medicoes/regua-r3-*.json`.

| f0 a 1x, modo de prazo (ms, 2 rodadas cada) | base, blast / crater | visuais adiados | cortes do `explode` |
|---|---|---|---|
| f0 inteiro | 64,6 / 64,1 | 63,8 / 63,0 | 63,8 / 62,9 |
| `explode` | 20,5 / 20,2 | 20,6 / 20,7 | 19,4 / 19,8 |
| eventos aplicados no tique | 11,8 / 12,1 | 12,0 / 12,5 (sem rótulo: em `sysOther`) | 12,4 / 11,9 |
| pior quadro dos 7 seguintes | 25,3 / 24,7 | 26,4 / 26,0 | 25,1 / 24,5 |

- **Eventos visuais adiados: ~1 ms, dentro do ruído (±1,5 ms entre rodadas do mesmo código).** O custo dos eventos no tique não cai (12 ms nos
  dois lados): ele é dos estruturais (`fracture` e o que ela chama), não das 647 marcas. A estimativa de ~6 ms (T2.0) não se confirmou.
  **Decisão: não entra.** Três rodadas de revisão, uma fila nova e um conjunto de peças tocadas para um ganho que a régua não mostra.
  A branch `spec/017-visual` fica guardada.
- **Cortes do `explode` (A–D+F): ~1 ms, também dentro do ruído.** A–D (parar na primeira peça do `implInRange`, ouvintes copiados só na
  escrita, pose reaproveitada, `knockOutUnits` sem trabalho repetido) foram aprovados na revisão, não mudam nenhum bit e tiram alocação:
  entram. O F (corte da parede adiado) não mostra ganho e tem um defeito achado na revisão (amassado gravado na casca): sai.
- **O item E** (a resolução estrutural dentro do `knockOutUnits`) foi desfeito: trocar por pendência mudou `blast-presentation` e
  `exact-golden destruction/fracture`, sem causa isolada.

### O f0 hoje (base `49eee5cc2`, média de 12 quadros, ms)

`explode` 20,4 · eventos estruturais no tique 11,9 + o que eles chamam na física (`rebuildHost` 2,8, `splitLoose` 1,9, `adoptSplit` 1,3) 6,1 ·
`renderCpu` 8,4 · `action` 6,3 · matrizes 1,8 · sistemas e módulos ~5 · mundo 1,2 · áudio 1,2. Total ~64,4 (update 56,0 + desenho 8,4).

**O que não muda a simulação já saiu do quadro do golpe** (pintura da casa: 9 → 0,2 ms). O que sobra de grande (`explode` ~20 e eventos
estruturais ~18) é trabalho que muda a simulação: é a fronteira da decisão D5.

## Rodada 4 — malha da casa uma vez por lote e som fora do tique (2026-11-20, 03:02 a 03:40)

Seis rodadas alternadas, modo de prazo, carga no início 1,31 a 1,46 e no fim 1,17 a 1,76. Base `6751c2d9f` (com os cortes A–D do `explode`);
malha `6676e2c74`; malha + som `11f04e48c` (branch `spec/017-explode`, versões ANTES das correções da revisão). JSONs: `medicoes/regua-r4-*.json`.
Perfil que apontou os dois itens: `evidence-perfil2.md` (~85% dos ~18 ms dos eventos estruturais é apresentação).

| f0 a 1x, modo de prazo (ms, 2 rodadas cada) | base, blast / crater | malha por lote | malha + som na fila |
|---|---|---|---|
| f0 inteiro | 66,9 / 66,7 | 64,0 / 66,7 | 63,8 / 62,5 |
| eventos estruturais no tique | 12,4 / 12,3 | 11,9 / 13,1 | 10,8 / 10,6 |
| `rebuildHost` | 2,7 / 2,8 | 2,0 / 1,3 | 1,7 / 1,4 |
| `explode` | 21,2 / 21,5 | 20,4 / 22,4 | 21,0 / 20,8 |
| pior quadro dos 7 seguintes | 25,3 / 25,3 | 25,4 / 25,4 | 25,4 / 25,0 |

- **Malha por lote: ~1 ms** (`rebuildHost` 2,7 → 1,3 a 2,0). Menos que os ~2,5 esperados; a revisão achou o motivo provável: cada marca
  desenhada força a reescrita de todos os hosts pendentes (`onFace` → `flushRebuilds`). Correção em andamento.
- **Som montado pela fila: ~1,5 a 2 ms** nos eventos do tique (12,4 → 10,7). A versão medida tinha o teto de 4 sons por tipo, que a revisão
  mandou retirar (mantinha os primeiros, não os mais próximos); a versão corrigida precisa ser medida de novo.
- **Os dois juntos: ~3 a 4 ms; f0 em ~63 ms.** A base desta rodada saiu ~2 ms acima da base da rodada 3 (66,8 contra 64,4) com código que
  só difere pelos cortes A–D: é a deriva entre sessões de medição, e é por isso que cada rodada mede a própria base.

## Rodada 5 — versões corrigidas da malha por lote e do som (2026-11-20, 03:47 a 04:12)

Quatro rodadas alternadas, modo de prazo, carga no início 1,43 a 1,47 e no fim 1,18 a 1,55. Base `6751c2d9f`; versão com as correções da
revisão `670f2fd78` (malha por lote com descarga só da malha lida; som com o golpe urgente, rota lida no pedido e SEM o teto de 4 por tipo).
JSONs: `medicoes/regua-r5-*.json`.

| f0 a 1x, modo de prazo (ms, 2 rodadas cada) | base, blast / crater | malha + som corrigidos |
|---|---|---|
| f0 inteiro | 67,0 / 66,1 | 64,2 / 67,4 |
| `rebuildHost` | 3,0 / 2,4 | 1,1 / 0,9 |
| o que os eventos chamam na física (`stagesOut`) | 6,2 / 6,0 | 4,3 / 4,6 |
| eventos estruturais no tique | 12,0 / 12,6 | 12,6 / 13,1 |
| `action` | 6,7 / 6,6 | 7,2 / 7,5 |
| `explode` | 21,6 / 21,2 | 20,1 / 21,5 |

- **Malha por lote: ganho confirmado, ~1,7 ms** (`rebuildHost` 2,7 → 1,0, depois de a marca descarregar só a malha que lê). **Entra**
  (`3897188ee`, `1ebf68716`).
- **Som montado pela fila: sem ganho na versão correta.** O 1,5 a 2 ms da rodada 4 vinha do teto de 4 sons por tipo, que descartava sons e
  saiu na revisão; com o som do golpe de volta à montagem na hora (C5), os eventos no tique e o `action` voltam ao que eram. **Não entra**; os
  commits ficam na branch `spec/017-explode`.
- **f0 inteiro:** 66,6 → 65,8 na média dos dois tipos; o `blast` da base variou de 63,4 a 70,7 entre as duas rodadas. Um ganho de ~1,7 ms não
  aparece com segurança no total; aparece no rótulo.

### Fecho da frente "sem mudar a simulação" (o que foi medido nesta spec)

| Mudança | Ganho medido no f0 (modo de prazo) | Estado |
|---|---|---|
| T3.1 pintura da casa fora do quadro do golpe | ~13 ms (78 → 65) | na branch |
| Malha da casa reescrita uma vez por lote | ~1,7 ms no rótulo | na branch |
| Cortes A–D do `explode` | ~1 ms (dentro do ruído) | na branch |
| T2.2 eventos estruturais no tique | 0 (é correção de determinismo) | na branch |
| Eventos visuais adiados (3 revisões) | ~1 ms (dentro do ruído) | não entrou |
| Som montado pela fila | 0 na versão correta | não entrou |
| Corte da parede adiado (item F) | 0 | não entrou |
| Cache do furo (parte 1) | 8 a 13 ms no modo de cota, antes desta série | na branch |

f0 hoje: **~64 a 66 ms** (meta C1: 33,3). O que sobra de grande é o laço por peça do `explode` (~17,6 ms, 521 peças) e a aplicação dos eventos
estruturais (~17 ms, dos quais ~2,3 são mundo e corpo e o resto é malha, marcas, efeitos e som espalhados por muitos itens pequenos).

## C8 — portão completo contra a `main` (2026-11-20, `29a9fc82d` × `origin/main` `0161749d`)

Log: `medicoes/perf-gate-c8-29a9fc82d.log`. **Resultado: o portão barrou a branch**, numa fase só.

A medição saiu com a máquina ocupada (carga 8 a 14: a rodada noturna de GPU rodou junto e o portão desistiu de esperar a
máquina livre). Os números absolutos estão inflados; o que vale é a comparação, medida duas vezes de cada lado.

| Fase | `main` → branch | Leitura |
|---|---|---|
| explosões a frio (9 armas) | p99 17–33 → 14–17 ms; pior quadro menor em 8 de 9 | melhor |
| `warm_all` | p99 39,5 → 28,2 ms | melhor |
| `storm` | p99 44,1 → 34,4 ms; pior quadro 1216 → 250 ms | melhor |
| `dense_horde` / `chain_horde` | p99 36,2 → 28,6 / 57,4 → 35,4 ms | melhor |
| **`after_storm`** | p99 17,5 → 25,6 ms; pior quadro 31,6 → 154,6 ms; tarefa longa 0 → 130 ms; desenhos 401 → 454 | **pior, barra** |

`after_storm` nas duas medições de cada lado: branch com 2 e 3 engasgos (154,6 e 164,3 ms), `main` com nenhum (14,3 e
31,6 ms). Dois em dois contra zero em dois: tratado como regressão real até prova em contrário, não como ruído. Causa em
investigação (suspeitas: pintura de parede com prazo acumulando durante a tempestade; eventos estruturais no tique).
Alvos absolutos perdidos: 52 na branch, 55 na `main`.

### C8 — conferência com a máquina quieta: não há regressão em `after_storm`

Medições alternadas branch × `main` (`0161749d`, build própria, não a base compartilhada), carga 1,6 a 1,9 no começo de
cada uma, com as fases a frio rodando antes da tempestade como no portão:

| Medição | pior quadro de `after_storm` | tarefa longa | p99 | desenhos por quadro |
|---|---|---|---|---|
| só tempestade, branch (2) | 16,1 / 17,5 ms | 0 / 0 | 13,7 / 14,8 | 431 / 413 |
| completa, branch (2) | 15,7 / 17,2 ms | 0 / 0 | 13,5 / 13,0 | 557 / 385 |
| completa, `main` (2) | 13,4 / 17,8 ms | 0 / 0 | 11,0 / 10,9 | 479 / 458 |

Branch limpa em 6 de 6 (contando as duas medições só de tempestade da primeira série). O engasgo de ~150 ms do portão foi
a carga da rodada noturna: o quadro lento tinha 13 ms de desenho e 13 ms de script, e os outros ~147 ms ficaram antes do
desenho, sem script acima de 5 ms. `applyStructuralEvents` cronometrado em `after_storm`: ~182 chamadas, máximo 0 ms, fila
vazia. `floorplan.breach-paint` nem existe na área `vfx`. A queda de `ranUnits` de `destruction.events` (~30 mil → ~4 mil)
é contabilidade: os eventos estruturais rodam no tique, que a fila não conta.

**O ganho na fase `storm` que o portão mostrou (1216 → 250 ms) também era carga, e não vale como ganho da spec.** Com a
máquina quieta, medições completas: pior quadro 267,6 / 379,2 ms na branch contra 441,5 / 216,6 ms na `main`; p99 34,1 /
34,9 contra 35,3 / 32,0. Empate. A `main` cabe um pouco mais de quadros nos 3 s de `after_storm` (615 / 622 contra 487 /
600), sem engasgo em nenhum dos lados.

Lições para a régua: (1) o portão mede mesmo com a máquina ocupada depois de 10 minutos de espera, e foi assim que o
bloqueio falso passou; (2) a base compartilhada em `~/.cache/adatechnology-game-kit/perf/base-worktree` foi movida por
outra sessão no meio da série, então comparar contra ela não é seguro com mais de uma sessão medindo.
Falta: uma passada do portão completo com a máquina quieta, para o veredito formal do C8 (hordas incluídas).

### C8 — veredito formal: o portão passa com a máquina quieta (`9498ddda3` × `origin/main` `0161749d`)

Log: `medicoes/perf-gate-c8-9498ddda3-quieta.log` (carga 1,97 no começo). `perf passes`, 0 `FAIL`. `main` → branch:

| Fase | p99 | pior quadro | tarefa longa |
|---|---|---|---|
| explosões a frio (9 armas) | 16,9–25,4 → 11,6–13,9 ms | menor nas 9 (ex.: m79 166 → 86, at4 56 → 32, dinamite 126 → 59) | menor ou igual nas 9 |
| `warm_all` | 28,5 → 18,1 | 370 → 348 | 366 → 347 |
| `storm` | 44,1 → 26,9 | 974 → 196 | 980 → 205 |
| `after_storm` | 13,2 → 13,1 | 16,8 → 14,2 | 0 → 0 |
| `dense_horde` | 34,5 → 17,7 | 44,3 → 34,1 | 0 → 0 |
| `chain_horde` | 34,4 → 28,0 | 212 → 119 | 210 → 113 |

Alvos absolutos perdidos: 46 na branch, 44 na `main` (o alvo, não o portão). Sobre a fase `storm`: esta passada mostra
ganho, a série alternada da seção anterior mostrou empate; o pior quadro dessa fase varia de 200 a 450 ms entre medições
do mesmo lado, então **não se afirma ganho em `storm`**, só que não há regressão.

### Revisão do conjunto (PR #408) e correções

A revisão da branch inteira não achou nada crítico; três correções entraram:

- **Colisão lia a pintura** (bug real, introduzido pela pintura com prazo): `breach.standing()`, que alimenta o que o corpo
  encontra na parede, vinha de `view.kept`, escrito só por `paint()`. Com a pintura atrasando até 3 quadros, o jogador podia
  ser barrado por um vão já aberto, em tique diferente conforme o orçamento do quadro. Agora vem do dano registrado
  (`splitUnits`, refeito sob demanda). Teste: `breach-standing-timing.test.ts`.
- **Trava do `mustDrain`**: a auditoria passa a enxergar `mustDrainIds`; um teste liga `MUST_DRAIN_QUEUE_IDS` a
  `must-drain-allowed.json`.
- `strike.inRenderer` volta em `finally`.

Régua com as correções (`abda41ce4`, carga 1,8–1,9): explosão 68,1 / 63,8 ms; cratera 72,9 / 68,4 ms. Base sem elas, na
mesma manhã: 65,7–69,0 e 60,0–67,3. Explosão igual; cratera ~3 ms acima, no limite do ruído da régua (±2 ms), sem rótulo
novo nas partes do quadro. Lido como sem regressão clara, não como prova de custo zero.

Pendências conhecidas que a revisão levantou e ficam fora deste PR: (1) parede atingida com a casa em LOD 1 ou 2 não
registra o dano na vista, então `standing()` ainda depende do histórico de LOD (anterior à spec); (2) o portão do quadro do
impacto só roda na rodada noturna (§9), então uma regressão chega à `main` e é vista na noite seguinte; (3) `hole` deixou
de sobreviver ao teto da fila de eventos (`QUEUE_CAP`).

## Depois do merge do #408 (`a8239e972`, 2026-11-20)

**Base da rodada noturna no modo de prazo: não gravada.** A régua completa rodou 48 min com carga 1,9 no começo (`f0dfb7417`), mas a página
travou em rodadas isoladas: explosão a 1x com f0 de 66 e 82 ms em duas rodadas e 475 ms na terceira; a 4x, 235, 243 e 1565 ms. Como
`f0Ms` olha os piores quadros, o relatório deu 248 ms a 1x, que não é o quadro do impacto. Gravar isso como base deixaria passar qualquer
regressão até uma noite limpa. As mesmas travadas (quadros de 400–700 ms, tudo ~10x mais lento num quadro só) apareceram hoje nas medições
dos dois lados de todo par, desde as 9 h. Causa não provada; o processador estava a 90 °C depois de ~7 h de medição seguida, e
estrangulamento térmico é a hipótese. Fica: rodar o comando de `docs/desempenho-explosoes.md` com a máquina fria e conferir que as três
rodadas de explosão a 1x ficam entre 60 e 75 ms antes de copiar.

## Fecho da spec (2026-11-20)

| Critério | Resultado |
|---|---|
| C1, quadro do impacto ≤ 33,3 ms | **não atingido**: ~78 → ~65 ms (modo de prazo, 1x, explosão e cratera) |
| C4, mesmos bytes fora de 60 Hz | atingido: 30/60/120/144 Hz e tempo de quadro aleatório, nos dois motores |
| C8, sem regressão contra a `main` | atingido: portão completo passa com a máquina quieta |
| Travas | `mustDrain` por lista (execução e auditoria), portão do quadro do impacto na rodada noturna |

D5 fechada como (a). O que foi tentado depois do #408 e não entrou: explosão em fatias por pesos (~15 ms, calibrada numa casa só) e
frente de onda física (3 a 6 ms), em `design-onda.md` §1 e §9. Branch do protótipo: `spec/017-d5b-prototipo` (local, não enviada).

Pendências que saem desta spec: gravar a base da rodada noturna no modo de prazo com a máquina fria; o caminho `workBudget` ainda lê a
pose desenhada (`it.fails` documentado); `standing()` depende do histórico de LOD; `hole` não sobrevive ao teto da fila de eventos; a
causa do item E (trocar o `solveStructure` de dentro do `knockOutUnits` por pendente) não foi isolada.
