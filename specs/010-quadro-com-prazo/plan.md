# Plano — Spec 010

## Ordem e porquê

Ordem decidida pelo dono em 2026-11-19 (T0.3): P1 → P3 → P2. P3 é a maior causa nos quadros sem f0; P2 explica 2 a 3% do tempo a 1x e vale por correção.

A régua vem primeiro porque as três correções foram escolhidas por leitura do código, não por medição. A fase 0 pode mudar a ordem das outras:
se a tabela mostrar que um módulo fora desta lista domina o pior quadro, para-se e o dono decide (T0.3).

| Fase | Entrega | Critérios |
|---|---|---|
| 0 | Régua na configuração padrão, gravada, com o quadro 0 inteiro (T0.4) | C1 |
| 1 | Orçamento único pelo prazo do quadro | C2, C3 |
| 2 | Estrutura adiada e custo por peça acordada (P3) | C6, C7 |
| 3 | Um passo fixo só (`h = 1/120`) e desenho interpolado (P2) | C4, C5 |
| 4 | Régua final, documentação e regra conferida | C8, C9 |

## Camadas

- `game-contracts/src/frame.ts`: ids e prioridades das filas novas (`DEFERRED_QUEUE_ID`, `DEFERRED_PRIORITY`), contrato do prazo do quadro.
- `game-runtime`: o prazo (`budget.ts`, `scheduler.ts`), o único acumulador, `alpha`. Nenhum outro pacote lê relógio para decidir trabalho adiado.
- `game-render-three/src/static-batcher.ts`: deixa de ter relógio próprio; expõe uma `DeferredQueue`.
- `game-physics/src/loop.ts`: perde o acumulador; recebe os passos do agendador.
- `game-destruction` e `game-destruction-three`: estrutura adiada, laços por peça acordada, pose anterior para interpolar.
- Sala (`game-test-room`): registra as filas e move a simulação de fase. Só troca chamadas; nenhuma função nova entra no `room.ts`.

## Decisões

- **D1. Prazo, não cota.** O orçamento de um quadro é `inicioDoQuadro + alvoMs − renderEstimadoMs − agora`, calculado quando o `drain('present')`
  começa, com piso de 1 ms. `alvoMs` vem do host (16,6 por padrão; a sala passa o do monitor). `renderEstimadoMs` é a média móvel do tempo da
  fase `render` medido pelo próprio agendador. O `budgetMs` de hoje vira o **teto** do trabalho adiado, não a cota garantida.
- **D2. Fila é o único jeito de adiar.** Cada relógio próprio vira uma `DeferredQueue` registrada pelo host. Sem host (API direta, testes,
  goldens) a fila drena por dentro como hoje (`attach`/`detach` já existem no contrato): o padrão continua síncrono (lição dos goldens de
  2026-10-31, `docs/desempenho-explosoes.md`).
- **D3. Prioridade por efeito visível.** O que precisa aparecer no quadro do golpe (`destruction.events`, `floorplan.breach-cut`) fica em
  `present` com prioridade alta; lotes, sombra, filme e suavização vão para `idle`. Reserva (`reserveMs`) só para o áudio, como hoje.
- **D4. O `WorkBudget` da física continua em unidades**, sem relógio (determinismo, spec 008 E2). O que muda: o `tier` e o `budgetMs` dele
  passam a ser dados pelo host junto do orçamento do quadro, e o tempo que ele gastou entra no desconto da D1. Ele não vira `DeferredQueue`.
- **D5. Um acumulador: o do agendador, com `h = 1/120`.** O agendador adota o `fixedStep` do `KIT_WORLD`
  (`game-physics/src/contract.ts:266`); a física e os goldens não mudam, porque o `PhysicsLoop` já anda a 1/120. `PhysicsLoop.step(dt)`
  continua para quem usa a física sozinha, mas ganha `stepFixed(steps)`: com agendador, a sala chama esse na fase `fixedSimulate` e o
  acumulador do laço não é usado. O `alpha` é o do agendador. O valor é correção (C4, C5, 144 Hz), não ms.
- **D6. O que anda no passo fixo (`h = 1/120`).** Tudo que entra na física ou muda estado semeado: `explosives.update`, `world.update`,
  `fluids.update`, `physicsLoop`, sistema de peças, fragmentos. Ficam em `lateSimulate`, com o `dt` do quadro: animação, câmera, som, efeitos
  visuais, `arena.followSun`. A T3.1 fecha a lista linha por linha de `simulateBeforeModules`/`simulateAfterModules`.
- **D7. Interpolação só no desenho.** Peça e fragmento guardam a pose do passo anterior (posição e quatérnio em arrays, sem objeto novo por
  quadro); na fase `present` o renderer escreve `lerp`/`slerp` por `alpha` na malha. A simulação lê sempre a pose do passo, nunca a desenhada.
  Peça dormindo não interpola. Atrás de opção (`interpolate`), ligada pela sala; desligada, o desenho é o de hoje (goldens).
- **D8. Acordadas numa lista à parte.** O sistema de peças mantém `awake` (peças que não dormem, estão presas na mão ou acabaram de mudar) ao
  lado de `list`; `prepare`, `readBack`, `measure` e `syncTransforms` percorrem `awake`. Uma peça entra em `awake` ao acordar (evento do motor
  ou regra do kit) e sai ao dormir dos dois lados. O sono do motor é lido em lote (`GetActiveBodies`, como `friction.ts` já faz), não por peça.
- **D9. Estrutura adiada para o fim do `run()`, e no desenho uma vez por objeto por drenagem.** `partLost` marca `o.dirty` e guarda as juntas abertas; `solveStructure` + `recomputeGroups`
  rodam uma vez por objeto sujo antes de o `run()` devolver os eventos (junto do `flushCollapse` que já existe ali). No renderer, `splitLoose`, `adoptSplit` e `rebuildHost` (`renderer.ts:1570`, `:2120`) rodam uma vez por objeto por drenagem, não por evento `detach`/`collapse`. A ordem dos eventos dentro
  de um `run()` pode mudar: se o hash de eventos dos testes de explosão mudar, é decisão do dono (parar e perguntar), não se regrava golden sozinho.

## Riscos

- **A régua desmente a ordem.** Tratado na T0.3; fechado em 2026-11-19 com a ordem P1 → P3 → P2.
- **O f0 sem dono.** O `rest` do quadro 0 (53% a 1x) não tem rótulo e `solveStructure` roda fora do quadro medido; a T0.4 fecha isso antes da fase 1.
- **Passo fixo muda o comportamento** de regras que hoje recebem o `dt` do quadro (fogo, fluido, pavio). A 60 Hz com um passo por quadro o
  resultado deve ser igual; a T3.2 prova isso antes de mover qualquer coisa.
- **Colapso em outra ordem** (D9) pode soltar peças num quadro diferente. Testes de construção e o `engenheiro-estrutural` antes do PR (§11).
- **Fila de `idle` com fome**: lotes que nunca fecham numa máquina fraca. `minEveryFrames` de cada fila nova é escolhido na T1.2 e conferido
  a 4x de throttle.

## Medição

Sempre com `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, carga de 1 minuto abaixo de 4, GPU de verdade (helios), fora do CI e do
pre-push (§9). Variante padrão da página (`jolt-d4-worker` até a spec 008 mudar o padrão), `ROOM_EXPLOSION_FRAME_PARTS=1`,
`ROOM_EXPLOSION_KINDS=blast,hammer,crater`, `ROOM_EXPLOSION_THROTTLES=1,4`, 5 rodadas. O JSON vai para `specs/010-quadro-com-prazo/medicoes/`
e a tabela para o `evidence.md`, com o commit medido.
