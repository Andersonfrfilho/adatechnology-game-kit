# Desenho do passo fixo (T3.1, D5, D6, D7)

Lido no código em 2026-11-19, branch `spec/010-quadro-com-prazo` (`0cd473bf2`). Decide o que T3.2 a T3.7 implementam. Só desenho: nenhum código
mudou. **Pendente: validação do `engenheiro-estrutural` (tasks.md, T3.1 🧠) e a decisão do dono da §1.**

## 0. Decisões em uma tabela

| # | Decisão | Por quê |
|---|---|---|
| A | **Um acumulador, o do agendador, com tique de 1/60 s; a física anda 2 passos de `h = 1/120` (`KIT_WORLD.fixedStep`) por tique** (leitura R2 da §1; precisa do dono) | É a única leitura da decisão de 2026-11-19 em que "física e goldens não mudam" vale: hoje as regras (`world.update`, fogo, fluido, pavio, peças) andam 1/60 por quadro e a física 2×1/120 |
| B | `createScheduler` não muda o padrão (`fixedDt` 1/60, `maxSubsteps` 4). A sala passa `fixedDt: STEPS_PER_TICK * world.fixedStep` explicitamente, com `STEPS_PER_TICK = 2` validado como inteiro | Nenhum outro host muda; a sala deixa claro de onde vem o tique |
| C | `PhysicsLoop.stepFixed(steps)` roda exatamente `steps` passos, sem acumulador, sem `maxDt`; `step(dt)` vira acumulador + o mesmo núcleo | D5; bytes iguais (§3) |
| D | A sala chama `physicsLoop.stepFixed(STEPS_PER_TICK)` **uma vez por tique**, dentro do sistema `room.simulate` em `fixedSimulate` | O sistema de peças prepara uma vez por chamada do laço (`pieces.ts:418-456`); chamar `stepFixed(1)` por passo muda `prepare`/`finish` |
| E | `simulateBeforeModules` se divide em duas listas, sem função nova além do corte: `simulateFixed` (§5, `fixedSimulate`, ordem 1000) e `simulateFrame` (§5, `lateSimulate`, ordem −1000). `simulateAfterModules` fica inteiro em `lateSimulate` | Lista fechada da D6 |
| F | Quadro síncrono (`room.update`, `step`/`advance`) com `dt` igual a um tique vai pelo caminho fixo; com qualquer outro `dt` vai pelo caminho de hoje (as duas listas em `lateSimulate`, com o `dt` dado, `physicsLoop.step(dt)`) | 196 chamadas `room.update(1/60)` passam a cobrir o caminho novo; as 250 com 0,4, 0,05, 1/30... continuam idênticas (§9) |
| G | `fastForward` continua dentro do tique: 10 repetições de `world.update` + `fluids.update`, fogo uma vez, física uma vez | É o que faz hoje; `timeScale = 10` mudaria a física e o custo |
| H | Teto: `maxSubsteps: 3` na sala (= `maxFrameSeconds 0.05 / tique`), o mesmo teto de 6 passos de física de hoje | §4; a 4x é o maior risco de custo (R5) |
| I | `alpha` = `ctx.alpha` do agendador na fase `present` (já calculado depois de `runFixed`, `scheduler.ts:73`). Quadro síncrono e `ctx.scripted` desenham com `alpha = 1` | D7; goldens e prints síncronos iguais |
| J | No início de cada tique o renderer devolve às malhas a pose do passo (só das acordadas que interpolou) | A sala lê `root` das peças dentro da simulação (§10) |
| K | Módulos de área **não mudam de fase na T3.4**. A §8 lista os que deveriam ir para `fixedSimulate`, cada um no seu pacote, depois | §2 (pacote dono); a 60 Hz nada muda |

## 1. ⚠ A decisão de 2026-11-19 tem duas leituras (precisa do dono)

D5: "o agendador adota o `fixedStep` do `KIT_WORLD` (1/120); a física e os goldens não mudam, porque o `PhysicsLoop` já anda a 1/120". As
duas metades não valem juntas. O `PhysicsLoop` anda a 1/120, mas **o resto da simulação anda uma vez por quadro com `dt = 1/60`**:
`world.update(dt)`, `updateFires(dt)` (que gasta `rnd()` por chamada), `fluids.update(dt)`, `explosives.update(dt)`, `renderer.update(dt)` e o
`prepare`/`finish` das peças (uma vez por `step` do laço, com `frame.steps * h`). A bancada da multidão já está em `fixedSimulate` e recebe
`ctx.dt = 1/60` (`game-crowd-three/src/bench/module.ts:735`).

| | R1: agendador a 1/120, tudo por passo | R2 (recomendada): tique 1/60 = 2 passos de 1/120 |
|---|---|---|
| Física (Jolt, `h`) | igual | igual |
| `world.update`, fogo, fluido, pavio | 2 chamadas de 1/120 por quadro a 60 Hz: **hash muda** (fogo gasta o dobro de `rnd()`, fluido integra outro `dt`) | 1 chamada de 1/60: igual |
| Peças (`prepare`/`finish`/`measure`) | 2 por quadro a 60 Hz (`stepFixed(1)` por passo): **hash muda e o custo P3 dobra** | 1 por tique: igual |
| Multidão (`fixedSimulate`) | `stepCrowd(1/120)`: muda | igual |
| Goldens e hash de eventos | mudam: decisão do dono, regravar | sem diff |
| C5 (mesmo hash por passo a 60/120/144 Hz) | vale por passo de 1/120 | vale por tique de 1/60 |
| Deriva do relógio | `toMicros(1/120) = 8333`, 2×8333 ≠ 16667: um passo a mais a cada ~8.333 quadros (139 s a 60 Hz) | `toMicros(1/60) = 16667`, igual ao de hoje: sem deriva |
| Custo a 60 Hz | sobe (tudo que é por chamada roda 2×) | igual |
| Atraso de entrada a 144 Hz | ≤ 8,3 ms | ≤ 16,7 ms, desenho suave pela D7 |

**Recomendação: R2.** Se o dono quiser R1, a T3.2 deixa de ser "mesmo hash" e vira "hash novo aprovado"; os riscos da §12 viram mudança certa,
não risco; e o relógio do agendador precisa de base mais fina que microssegundos (ou a deriva da linha acima entra nos testes longos).

## 2. Agendador

| Item | Hoje | Depois (R2) |
|---|---|---|
| `createScheduler` padrão | `fixedDt` 1/60, `maxSubsteps` 4, `snapMs` 0,25 | **sem mudança** (outros hosts iguais) |
| Sala (`room.ts:4078`) | `{ maxFrameSeconds: 0.05, budgetMs, targetMs, onError }` | + `fixedDt: STEPS_PER_TICK * world.fixedStep` (com laço; sem laço, `FIXED_DT`), + `maxSubsteps: 3` |
| Validação | — | `Math.abs(tick / h − STEPS_PER_TICK) < 1e-9`, senão erro no boot (mundo com outro `fixedStep`) |
| `snap` | 0,25 ms | igual: a 60 Hz o quadro de 16,5 a 16,9 ms vira 1 tique exato; a 120/144 Hz não encaixa (deriva > 0,25 ms) e acumula |
| Fase nova, contexto novo | — | nenhum. `ctx.tick` e `ctx.substep` já existem |

## 3. `PhysicsLoop.stepFixed(steps)` (T3.3)

| Item | Decisão |
|---|---|
| Assinatura | `stepFixed(steps: number): void`, `steps` inteiro ≥ 0; não toca `accumulator`, sem `maxDt` (o agendador já limita) |
| Núcleo comum | `run(steps, afterDt)`: `frame.steps = steps`, `world.clearEvents()`, `beforeStep(h)` por passo, `frame.time += h`, `stepMs`, `afterSteps(afterDt)` uma vez |
| `step(dt)` | clamp, acumula, `steps = floor((acc + ε)/h)`, `frame.alpha`, depois `run(steps, clamped)`: **passa o `clamped` de hoje**, não `steps*h` (0,05 ≠ 6·h no último bit) |
| `stepFixed` | `run(steps, steps * h)`; `frame.alpha = 0` (quem desenha lê o `alpha` do agendador; ninguém lê o do laço, P2) |
| Bytes iguais a 60 Hz | `1/60 === 2 * (1/120)` e `floor((1/60 + 1e-9)/(1/120)) = 2` (conferido no node): `step(1/60)` e `stepFixed(2)` dão os mesmos `beforeStep(h, frame)` e `afterSteps(1/60, frame)` |
| Misturar os dois | caminho síncrono de outro `dt` usa `step(dt)` e o acumulador do laço; o fixo usa `stepFixed` e não o toca. Ver R8 |
| Teste T3.3 | os dois caminhos dão a mesma sequência de chamadas (`h`, `frame.steps`, `frame.time`, `afterSteps` dt em bits) e o mesmo hash do mundo em 600 quadros |

## 4. Passos por quadro (R2, sem queda de quadro)

| Monitor | `dt` do quadro | Tiques por quadro | Passos de física por quadro | `alpha` |
|---|---|---|---|---|
| 60 Hz | 16,67 ms (snap) | 1 | 2 | 0 |
| 120 Hz | 8,33 ms | 0, 1, 0, 1... | 0 ou 2 | 0,5 / 0 |
| 144 Hz | 6,94 ms | 5 em cada 12 quadros (0,0,1,0,1,...) | 0 ou 2 | varia em [0, 1) |
| 30 Hz / quadro lento | 33 ms | 2 | 4 | |
| ≥ 50 ms (clamp da sala) | 50 ms | 3 (`maxSubsteps`) | 6 (o teto de hoje) | resto vai para `droppedSeconds` |

A 120/144 Hz todo o custo da simulação cai num quadro e o seguinte fica leve (alternância). É o preço da R2; a T3.7 mede o histograma.

## 5. `simulateBeforeModules` (`room.ts:4160`), lista fechada

"Fixo" = `simulateFixed`, roda por tique com `dt = 1/60`. "Quadro" = `simulateFrame`, `lateSimulate`, `dt` do quadro. A ordem dentro de cada
lista é a de hoje; cada item de quadro que passa para depois de um item fixo foi conferido (coluna "reordenar").

| # | Chamada | Fase | Motivo | Reordenar é seguro? |
|---|---|---|---|---|
| 1 | `simTime += dt` | fixo | relógio da simulação (`lastImpact`, `progress`, status) | — |
| 2 | `stepWalk(dt)` | fixo | caminhada roteirizada dos cenários; duração em tempo simulado | — |
| 3 | `stepStrikes(dt)` | fixo | golpe agendado bate no mundo (`strike.land`) | — |
| 4 | `updateAnimations(dt)` | **fixo** (desvio da D6) | não é a animação do corpo: é o clipe do objeto (`applyClip`), que pode mover a raiz de um recipiente lida em seguida por `syncContainers`, e solta `action` que os cenários conferem | — |
| 5 | `updateItemUse(dt)` | fixo | beber/despejar muda litros (estado do fluido) | — |
| 6 | `explosives.update(dt)` | fixo | pavio e detonação (D6) | — |
| 7 | `syncContainers(dt)` | fixo | velocidade e pose dos recipientes entram no `fluids` | — |
| 8 | laço `reps`: `world.update(dt)`, `updateFires(dt)` (só `i = 0`), `fluids.update(dt)` | fixo | D6; fogo gasta `rnd()` semeado | — |
| 9 | `syncLiters()` | fixo | litros → massa da peça (`setPieceMass`) | — |
| 10 | `simulationStamp++` | fixo | o comentário (`room.ts:331`) já diz "conta os passos da simulação" | — |
| 11 | `physicsLoop?.step(dt)` | fixo | vira `stepFixed(STEPS_PER_TICK)` | — |
| 12 | `arena.followSun(camera)` | quadro | sombra segue a câmera (D6) | sim: só mexe na luz |
| 13 | `renderer.update(dt)` | **fixo, inteiro** | tem peças (`pieceSys.update`), fragmentos, assentamento, fogo/vazamento por parte, chão; também tem visual (`ownVfx`, `updateFading`, `syncTransforms`, `settledBatches`). Dividir em `step`/`present` é do pacote dono, depois da T3.5 (R9) | — |
| 14 | `destructionSound?.update(dt)` | quadro | som | sim: lê eventos, não muda estado |
| 15 | `e.follower?.update?.()` | quadro | visual preso à malha | sim |
| 16 | `terrainView.sync(camera)` | quadro | malhas do terreno | sim: `showGroundFire` lê `terrain.burningPoints()`, dado, não malha |
| 17 | `showGroundFire(dt)` | **fixo** | é efeito, mas gasta `rnd()` (o mesmo de `updateFires`) | — |
| 18 | `vfx.update(dt)` | quadro | efeito visual | sim: nada da lista fixa lê o `vfx` |
| 19 | `water.setCamera(...)` + `water.update(dt)` | fixo | as ondas empurram o que boia (`updateWater`) e o jogador (`rockPlayer`) | — |
| 20 | `waterView.sync()` | quadro | desenho da água | sim |
| 21 | `updateImpacts()` | fixo | bate peça voando no mundo (`world.hitPart`, `pushPiece`) | — |
| 22 | `updateWater(dt)` | fixo | empuxo nas peças | — |
| 23 | `rockPlayer(dt)` | fixo | empurrão da onda no jogador, lido do estado da água | — |
| 24 | `updateLoads(dt)` | fixo | `terrain.bear` cede o chão (estado do terreno) | — |
| 25 | `footprints.update(...)` | quadro | marca visual | sim (R10: conferir que não muda `heightAt`) |
| 26 | `dropStainsOffFallenTops()` | fixo | tira superfície e manchas do `fluids` | — |
| 27 | `fluidView.update(dt)` | quadro | desenho do fluido | sim |
| 28 | `filmBridge.update(dt)`, `film.update(dt)` | quadro | filme é só desenho (fila `idle` da fase 1); usa `filmRandom` próprio, que nada da simulação lê | sim |
| 29 | `tools` / `offTool`: `s.update(dt)`, `flushEvents`, `dualReload.step(dt)` | quadro | o gatilho (`useTool`) roda na fase `input` com o `dt` do quadro e `WeaponCore.update` casa com ele pelo `pend` (`weapon-core.ts:165`): relógios diferentes desfazem esse casamento | sim: é o último hoje |
| 30 | `audio.setListener(...)` | quadro | som | sim |

Ordem final: `simulateFixed` = 1-11, 13, 17, 19, 21-24, 26, + `flush()` no fim (§6). `simulateFrame` = 12, 14-16, 18, 20, 25, 27-30.

## 6. `simulateAfterModules` (`room.ts:4213`)

| Chamada | Fase | Motivo |
|---|---|---|
| traçantes (`tr.life -= dt`, posição na boca) | quadro | visual |
| `vfx.present()` | quadro | desenha o clarão na boca deste quadro |
| `flush()` | quadro **e** fim do tique | os eventos do mundo (`leak` → `puncture`, `ignite`, `explode` → `emitHost`) mudam estado; num quadro com 2+ tiques, os do tique 1 têm de valer antes do tique 2 (C5). Fica também aqui para o que os módulos produzem. Ver R7 |

## 7. Fora da lista, mas quebra a C5: a fase `input` mexe na física

`updateInput` (`room.ts:4232`) roda com o `dt` real e chama `push.step`, `shoves.step`, `doors.step`, `kickLight`, `pushByPlayer`,
`followHeld`, `stepAvatar`, `stepFeet` e `useTool`. Os que empurram peças ou o alvo da peça na mão integram com o `dt` do quadro: a 144 Hz o
resultado por tique difere do de 60 Hz. **Não entram na T3.4** (o jogador sente a entrada no quadro dela); o teste C5 roda sem entrada do
jogador, e isso fica escrito no teste. Mover a parte física deles para o tique é outra task (pergunta P4).

## 8. Módulos de área que simulam (`lent.onFrame`, padrão `lateSimulate`)

| Módulo | O que roda | Deveria ser | T3.4 |
|---|---|---|---|
| `game-crowd-three` bancada (`module.ts:735`) | `stepCrowd(step)` em `fixedSimulate` | já é fixo; recebe 1/60 (R2 mantém) | igual; `room.simulate` fixo fica com ordem 1000 para a multidão continuar antes do mundo, como hoje |
| `game-crowd-three` bancada (`frame`) | jogador, `stepCrowd(dt)` só sem física | quadro | igual |
| `game-weapons-three` `explosives-bench.ts:481` | `shove` (empurra o botijão), `ignite` depois do atraso | fixo | igual; mover no pacote |
| `game-vehicles-three` `proving/module.ts:757` | `run.step(dt * timeScale)`; `run.ts:47,82` tem **acumulador próprio a 1/120** | fixo, `run.step(ctx.dt)`; o `timeScale` do módulo vira pergunta (P5) | igual; terceiro acumulador anotado (§15 "ninguém cria outro") |
| `game-vehicles-three` `module.ts:507` | `measure`, LOD, `lane?.step(dt)` (dano da pista, não lido a fundo), `cabins.sync` | LOD quadro; `lane` a confirmar | igual |
| `game-weather` bancada | `weather.advance(dt)`, `bridges.update(dt)` | a confirmar: se a ponte molha o mundo da destruição, fixo | igual |
| `game-vegetation-three` | materiais, `nursery.step(dt)` (não lido a fundo) | quadro, a confirmar | igual |
| `game-animals-three`, `game-characters-three`, `game-urban-three`, `game-items-three`, `game-floorplan-three` (LOD, reconstrução adiada), `game-weapons-three` `area.ts:518` (`created.update`), `game-player`, `game-audio`, `game-vfx-three` bancadas | animação, som, LOD, giro de vitrine | quadro | igual |

## 9. Caminhos síncronos e `fastForward`

| Chamada | `dt` | Caminho | Por quê |
|---|---|---|---|
| `room.update(dt)` (`room.ts:5233`, `exact: true`) | igual a um tique (±1 µs) | fixo, depois de `scheduler.resetClock()` | exatamente 1 tique; byte igual ao de hoje pelo §3 e pela ordem do §5 |
| `room.update(dt)` | qualquer outro (0,4, 0,05, 0,02, 1/30, 1...) | hoje: o sistema fixo se cala, `room.simulate` em `lateSimulate` roda as duas listas com o `dt` dado e `physicsLoop.step(dt)` | por tique, 0,4 viraria 24 `world.update` em vez de 1 (e a física, que hoje corta em 0,1, andaria 0,4): hash e goldens mudariam |
| `step(seconds)` dos cenários (`room.ts:4961`) | `FIXED_DT` | fixo (o `advance` zera o acumulador e dá 1 tique por iteração) | igual |
| `step(seconds)`, `seconds > 6` | 1/30 | hoje | 2 tiques mudariam o `world.update` |
| `use(hold)`, `useOff(hold)` | `FIXED_DT` via `advance` | fixo | igual; `directStep` continua |
| `waitUntilReady` | `room.update(FIXED_DT)` | fixo | igual |
| `fastForward` (`room.ts:5275`) | — | dentro do tique, como hoje (G) | |

Mecanismo: uma variável da sala ao lado de `directStep`, ligada por `update` e `step` quando o `dt` não é um tique. O sistema fixo retorna se
ela está ligada; a entrada de `lateSimulate` roda `simulateFixed(dt)` antes de `simulateFrame(dt)` só nesse caso. `room.ts` não cresce: o corte
da função e a variável cabem nas linhas que saem (`wc -l` contra `origin/main`, §15).

## 10. `alpha` e interpolação (D7, T3.5/T3.6)

| Item | Decisão |
|---|---|
| Fonte | `ctx.alpha` na fase `present` (o agendador recalcula depois de `runFixed`); a sala registra `renderer.present(alpha)` em `present` antes de `room.present` |
| Quadro síncrono, `ctx.scripted`, `interpolate` desligado | `alpha = 1`: desenha a pose do passo (o de hoje) |
| Pausado | `alpha` congelado, desenho parado |
| Pose anterior | guardada no fim de cada tique (depois de `stepFixed`), só das acordadas; dormindo não interpola |
| **A simulação lê a pose desenhada hoje** | `syncContainers` (`host.root.matrixWorld`), `updateImpacts` e `restingLoad` (`setFromObject(piece.root)`), `holderTopAt` (`renderer.shownBoxes`), `updateItemUse` (posição do som) e, dentro do `renderer.update`, o que lê a parte depois que os corpos se moveram. Antes do `renderer.update` do tique a malha está com a pose interpolada do quadro anterior |
| Correção (J) | primeira coisa do tique: o renderer reescreve a pose do passo nas malhas que interpolou (O(acordadas)). Nenhum leitor da sala muda. Alternativa (trocar cada leitor pela pose do passo) espalha a regra |

## 11. Testes

### T3.2 (CI, antes de mover; equivalência)

| # | Teste | Aceite |
|---|---|---|
| 1 | Fixture gravada **no commit anterior à T3.3**: cenas sobrado + explosão, fogo (`fireZone` + mancha queimando), fluido derramado, pavio, `fastForward` ligado, com `physics` laço (Jolt, ou laço falso se o wasm não roda no CI) e `own`; 180 quadros de `room.update(1/60)`; por quadro: hash de eventos (tipo, objeto, parte, `time`) e hash de estado (`world.snapshot` de cada objeto, pose e velocidade das peças em bits, litros e manchas, `rng`, fragmentos, `physicsLoop.frame.time/steps`) | depois da mudança, os mesmos 180 pares |
| 2 | Mesma cena pelo caminho ao vivo: `scheduler.frame(1/60)` sem `exact` (gancho de teste, P6) | mesmos hashes do #1 |
| 3 | `room.update(0.05)`, `(0.4)`, `(1/30)`, `(0.02)` e `step(7)` (1/30) | iguais à fixture (caminho de hoje) |
| 4 | Sequência mista `0.02, 1/60, 0.02, 1/60...` | igual à fixture (R8) |
| 5 | Ordem das fases (C4, `game-runtime`): `input → fixedSimulate × n → lateSimulate → present`, `room.simulate` em `fixedSimulate` | passa |
| 6 | `rg "accumulator" packages/game-physics/src/loop.ts` só no `step(dt)` de quem usa o laço sozinho | C4 |

### T3.6 (C5)

| # | Teste | Aceite |
|---|---|---|
| 1 | Cenas do T3.2 sem entrada do jogador (§7), caminho ao vivo a 60, 120 e 144 Hz pelo mesmo tempo simulado (3 s = 180 tiques); hash de estado gravado por um sistema em `fixedSimulate` com ordem 2000, indexado por `ctx.tick` | as três listas de 180 hashes iguais |
| 2 | 144 Hz com jitter de ±1 ms semeado | igual ao #1 |
| 3 | Quadros de 40 ms no meio (2 a 3 tiques num quadro) | igual ao #1 (precisa do `flush` no fim do tique, R7) |
| 4 | `interpolate` ligado e desligado | mesmo hash de estado (a simulação não lê o desenho, J) |
| 5 | `alpha` 0 e 1 | pose desenhada = anterior / atual; 0 alocações por quadro em `present` |
| 6 | Print da sala a 60 e a 144 Hz; §5 (primeira e terceira pessoa) se o jogador ou a arma se movem | evidence.md |

## 12. Riscos

| # | Risco | Muda a 60 Hz (R2)? | Muda a 120/144 Hz? | O que fazer |
|---|---|---|---|---|
| R1 | Fogo (`updateFires`, `showGroundFire`, `world.update` espalhando) | não: mesma chamada, mesmo `dt`, mesmo `rnd()` | sim, e para melhor: hoje gasta `rnd()` e emite partículas por quadro (144/s); passa a 60/s, igual em qualquer monitor | nada; T3.6 prova |
| R2 | Fluido (`fluids.update`, `syncContainers`, empuxo) | não | sim: passa de 1/144 por quadro para 1/60 por tique (o mesmo de 60 Hz, que é o testado) | nada; se alguém achar o fluido pior a 144 Hz, é a D7 que suaviza, não um `dt` menor |
| R3 | Pavio (`explosives.update`) | não | sim: detona com resolução de 16,7 ms em vez de 6,9 ms; igual em todo monitor | nada |
| R4 | Sob R1 (§1) os três acima mudam a 60 Hz com certeza | — | — | dono |
| R5 | **Custo a 4x**: hoje um quadro de 50 ms faz 1 `world.update(0.05)` + 6 passos; agora 3 tiques fazem 3× `world.update`, `renderer.update`, `prepare`/`finish`. Espiral de quadros lentos | não | só em quadro lento | `maxSubsteps: 3` (H) e medir na T3.7; se o p99 a 4x piorar contra a C8, baixar para 2 (a simulação fica lenta em vez de recuperar): **decisão do dono** |
| R6 | 120/144 Hz alternam quadro pesado e leve | — | sim | T3.7 mede; não é regressão de ms (a 60 Hz igual) |
| R7 | `flush()` no fim do tique roda antes dos módulos (hoje depois): o `narrator` e o `igniteNear` podem mudar de ordem relativa a `explosives-bench` | talvez | — | T3.2 #1 decide; se o hash mudar, tirar o `flush` do tique e a C5 vale só com ≤ 1 tique por quadro (T3.6 #3 cai): dono |
| R8 | Laço misturando `step(dt)` (síncrono de outro `dt`) e `stepFixed`: hoje `acc + 1/60 − 2h` pode diferir de `acc` no último bit; agora o `acc` fica intocado | improvável (`ε = 1e-9` absorve) | — | T3.2 #4 |
| R9 | `renderer.update` inteiro no tique: `ownVfx`, desbotar e lotes assentados andam a 60/s a 144 Hz | não | visual em degraus de 1/60 | dividir `renderer.update` em `step(h)` e `present(dt)` no `game-destruction-three`, depois da T3.5 |
| R10 | Reordenar itens de quadro para depois dos fixos (§5) | só se algum item de quadro mudar estado (`footprints` e `terrain`) | — | T3.2 #1 prova |
| R11 | Interpolação lida pela simulação (§10) | não (desligada nos síncronos) | sim sem a J | J, teste T3.6 #4 |
| R12 | Câmera e `rockPlayer`/`stepWalk` no tique dão degraus de 1/60 na posição do jogador a 144 Hz | — | visual | aceitar; ou interpolar a câmera (fora da D7) |
| R13 | O portão (`room-explosion.mjs`) usa `room.update(job.frameSeconds)`: mede o caminho fixo só a 1/60 e nunca o recuperar passos | — | — | a T3.7 precisa de um modo ao vivo (`frame` sem `exact`) para o histograma |

## 13. Perguntas abertas para o dono

| # | Pergunta | Recomendação |
|---|---|---|
| P1 | R1 ou R2 (§1)? | R2: tique 1/60 no agendador, física 2×1/120 por tique |
| P2 | Teto de tiques por quadro na sala | 3 (= hoje); 2 se a T3.7 mostrar regressão a 4x |
| P3 | `flush()` também no fim do tique (R7), se mudar o hash | só se a T3.2 der o mesmo hash |
| P4 | A parte física da fase `input` (§7) entra no tique numa task nova? | sim, task própria depois da T3.6 |
| P5 | `proving`: o terceiro acumulador (`run.ts`) sai na spec 010 ou fica anotado? E o `timeScale` do módulo, como fica num tique fixo? | anotar; sair no pacote dos veículos |
| P6 | Gancho público para quadro ao vivo sem render (`room.frame(dt)` ou opção de `update`), para T3.2 #2, T3.6 e T3.7 | uma opção em `update` (`{ live: true }`) em vez de função nova |

## Decisões do dono (2026-11-19)

1. **R2.** Um acumulador só, o do agendador, com tique de 1/60 (`fixedDt = 2 * world.fixedStep`, passado pela sala) que roda 2 passos de física de 1/120 (`stepFixed(2)`). O padrão do agendador não muda para os outros hosts. Física, goldens e hashes iguais a 60 Hz.
2. **Teto de 3 tiques por quadro** (até 6 passos de física, como hoje). Se a régua final (T4.1) mostrar piora a 4x, baixa para 2.
3. **Física na fase de entrada** (empurrar, objeto na mão, portas, ferramentas) fica para uma spec própria; o teste da C5 roda sem jogador.
4. **O acumulador do banco de provas** (`game-vehicles-proving/src/run.ts`) sai nesta spec, numa task própria (T3.8).
5. `flush()` no fim de cada tique: se o hash da T3.2 mudar, para e pergunta. Gancho de teste para quadro vivo sem render: sim.
