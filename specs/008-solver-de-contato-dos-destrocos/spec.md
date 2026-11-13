# Spec 008 — Solver de contato dos destroços soltos

Origem: item 6 da rodada 10 (destroços soltos que são lançados ao serem empurrados). Fechou **PARCIAL** em `74774f11` (branch
`fix/separate-pair-boxes-sat`): a cena do martelo ficou dentro do alvo, a cena do blast não. O dono aprovou, em 2026-11-13, reescrever o
solver de contato como spec própria, com os critérios de energia C1–C8 abaixo (aprovados com estes números). Decisão completa, com a
comparação dos dois spikes, em [`decision/DECISION-fable.md`](decision/DECISION-fable.md).

## Problema

`PieceSystem` (`packages/game-destruction-three/src/pieces.ts`) move os destroços em `integrate` (chão, apoios de canto, atrito, tombo) e só
depois, em `collide` (uma vez por update), conserta a sobreposição caixa contra caixa por posição (`separatePair`, `piece-contacts.ts`,
`applyPushes`, `slideApart`, `propped`/`proppedAt`). Consequências, já traçadas em `74774f11`:

1. a peça que só encosta num apoio (`if (resting) return`) não ganha escora, cai nele no passo seguinte e é devolvida para cima;
2. o apoio `propped` não tem atrito nem giro, e o empurrão age uma laje por vez: pode lançar;
3. a detecção chega um passo atrasada: a peça sobre um apoio que afunda é levantada de volta a cada quadro;
4. chão que se move sob as peças (deslizamento de terreno, `updateSlides` do `game-terrain`) amplifica tudo.

Quatro correções locais (H1–H4) só mudaram quais sementes falham. O defeito é de arquitetura: mover primeiro e consertar a posição depois.

## Decisão

**Opção A: solver próprio por impulsos sequenciais, levado a produção** (spike `spike/piece-solver-rewrite`). Rapier (spike B) fica arquivado.

| Medida | Baseline | A (próprio) | B (Rapier) |
|---|---|---|---|
| Bacia, critério original (32 casos) | 15 falham | 3 falham | 0 (com trava de velocidade; 8 sem ela) |
| Bacia, critério de energia (C2 aproximado) | 11 falham | **1 falha, por 1,6 mm** | 0 |
| Sala, blast: maior lift | 0,56 / 0,28–0,58 / 0,15–0,21 m | **0,083 / 0,023 / 0,031** | 0,050 / 0,047 / 0,079 |
| Sala, martelo: maior lift | 0,07–0,15 m | **0,033 / 0,028 / 0,014** | **0,59 / 0,58 / 0,13** |
| Dormindo no fim (blast; martelo) | 36/36; 37/37 | 34/36; 35/37 | 17–19/36; 7–19/37 |
| Testes do pacote que falham | só a bacia | 7 | 20 |
| Custo (razão sobre a baseline) | 1x | ~1,7x | ~1,5x |
| Tamanho da sala (gzip) | - | +3,5 KB | +1,67 MB |

Por que não Rapier: piora a sala real (levanta pedaços de 0,3 a 0,84 m no martelo), perde as regras do §12 do `CLAUDE.md` (atrito
estático/dinâmico, degraus viram rampa por heightfield de 10 cm, colisor invisível por caixas alinhadas aos eixos, sono e `maxAwake`
quebrados), troca de solver no meio do jogo enquanto o WASM carrega (determinismo só depois do `await`) e custa +1,67 MB. Reabrir só se o
kit passar a precisar de juntas/ragdoll ou de mais de ~500 corpos ativos, como motor de um pacote novo, nunca por baixo do `PieceSystem`.

## Fatos de base

- Baseline: `74774f11` em `fix/separate-pair-boxes-sat`. Ela **não está** no `main`; o `main` tem 13 commits que ela não tem.
- Spike A: branch `spike/piece-solver-rewrite` (`b8c84bd5` o solver, `675e4b8c` massas pré-calculadas, atrito em duas tangentes, teste de
  determinismo). É a base do trabalho de produção. Já traz `tests/bowl-scene.ts`, `tests/deepening-bowl.test.ts`, `tests/lift-measure.ts`,
  `tests/determinism.test.ts` e `tests/piece-bench.test.ts` em `packages/game-destruction-three/`.
- Spike B: branch `spike/piece-solver-rapier` (`4749202d`, `21447f73`, `468d243f`). **Arquivada, não apagada.** Os commits foram feitos com
  `--no-verify`: não servem de base nem de referência de qualidade, só de registro (`decision/REPORT-B-rapier.md`).
- A branch de produção parte do `origin/main` **atual, depois que `release/casa-a-pa-2026-11-13` entrar**, e traz o spike A por cima (T4).
- Cenas de sala usadas nas sondas: **blast** na parede `wall_0_0` da casa `single_storey_a` (pacote `residential`), semente 1, e **martelo**
  na mesma casa. Sondas em [`decision/probes/`](decision/probes/) (`blast.js`, `hammer.js`, `run.sh`, do spike A; `ag_blast.js`,
  `ag_hammer.js`, do spike B). As duas famílias medem coisas diferentes (ver DECISION, seção 1): a régua única de T2 as substitui.
- Bancada da bacia: [`decision/deepening-bowl-repro.test.ts`](decision/deepening-bowl-repro.test.ts) (chapa de 1,2 m sobre quatro placas
  inclinadas de 0,63x0,30x0,04 numa bacia que afunda de 0,25 a 0,45 m em 2 s, `wakeRegion` a cada quadro). O spike A já a transformou em
  `tests/bowl-scene.ts` + `tests/deepening-bowl.test.ts`; esta cópia é o original de referência.

## O alvo antigo e por que muda

"Nenhuma velocidade para cima > 0,05 m/s" **não é coerente** com "subida <= 3,5 cm": 0,05 m/s sobe 0,13 mm, e 3,5 cm pedem 0,83 m/s (16x mais
apertado em velocidade, 270x em energia). Contato real dá velocidade para cima (chapa em cunha, gangorra, peça parada atingida por outra do blast); a
baseline nunca fazia isso porque não transferia quantidade de movimento entre caixas, o que era defeito. O que o dono chama de "lançada" é: a
peça ganhou altura ou velocidade que ninguém pagou. Isso se mede com energia.

**Altura de energia** de uma peça = `y do centro de massa + (|v|^2 + omega.I.omega/m) / (2g)`. Em voo livre é constante; o chão só a reduz; contato entre peças a transfere.

## Critérios de aceite C1–C8 (aprovados pelo dono em 2026-11-13; manter os números)

| # | Critério | Como se prova |
|---|---|---|
| C1 | **Nenhuma energia criada (regra dura).** Em cada update sem golpe externo (`impulse`, blast, `hit`, chão subindo), a soma `sum m.altura de energia` de cada grupo de peças em contato não aumenta além de `m_total . g . 1 mm` | régua da T2, na bacia e na sala |
| C2 | **Peça em repouso não é lançada.** Peça que começou o update em repouso (`\|v\| < 0,05 m/s`, apoiada) e não foi atingida por contato fechando a mais de 1 m/s: ganho acumulado de altura de energia <= **3,5 cm** por episódio (de acordar a dormir). Equivale a 3,5 cm de subida, ou 0,83 m/s, ou qualquer combinação | régua da T2 |
| C3 | **Correção de posição limitada.** Subida do centro de massa devida só ao passe de posição <= 3,5 cm por peça por episódio (a métrica `lift` do spike A) | `lift-measure.ts` |
| C4 | **Assenta.** Bacia e sala: 100% das peças dormindo em até 3 s depois do último evento; nenhuma acordada no fim | bacia e sala |
| C5 | **§12 intacto.** Todos os testes atuais de `game-destruction-three` e `game-destruction` passam, incluindo atrito estático/dinâmico, borda de mesa, apoio perdido e catálogo quebrado | `pnpm --filter ... test` |
| C6 | **Robustez, não sorte.** Bacia em **64 sementes x dt 0,05 e 1/60**, e os mesmos casos com `SOLVER_PASSES` em 8/10/12 e as margens em +-20%: tudo passa. Constante que só passa no valor exato reprova | varredura como teste |
| C7 | **Custo.** Bench de 160 + 40: mediana e p90 <= 1,25x a baseline; `perf.mjs` da rodada diária sem regressão; medido também numa máquina AMD | `piece-bench.test.ts`, rodada diária |
| C8 | **Determinismo.** Mesma semente e dt: pose final de todas as peças idêntica, em dois processos separados | `determinism.test.ts` ampliado |

Aplicado aos dados brutos: a baseline falha 11/32 na bacia; A falha 1/32 (semente 10, dt 1/60, 3,66 cm). Na sala, A tem 1 peça em 1 de 6 rodadas acima (obj_41: lift 8,3 cm e 1,17 m/s).

## Fora de escopo

- Trocar de motor (Rapier). Juntas, ragdoll.
- Mudar a API pública do `PieceSystem` (`partBoxes`, `shownBoxes`, `onBrokenChecked`, `contacts`, cratera ficam como estão).
- Deploy, push e merge: só com o ok do dono.

## O que não foi verificado (herdado da decisão)

- A sala não foi medida de novo: os números vêm dos `.out` gravados, e as rodadas da sala não são determinísticas (a casa monta com `requestAnimationFrame` real antes da medição); 3 rodadas é amostra pequena.
- obj_41 a 1,17 m/s: cunha ou pancada vinda do blast? A régua da T2 responde.
- Causa do sono pior e da porta que balança em A: o item T8 é hipótese lida no código, não medida.
- Sensibilidade às passadas com o critério novo: só há dados de 10 passadas.
- Determinismo entre máquinas: os testes comparam duas execuções no mesmo processo. Entre CPUs/navegadores, nada medido.
- AMD / CPU fraca: nenhuma medição existe em nenhum dos spikes.
- Rapier 0.21: "limiares de sono não expostos" e "hooks só com EventQueue" não foram conferidos na documentação.

## Riscos

| Risco | Mitigação |
|---|---|
| Ajuste caótico: passa por sorte numa constante | C6 como gate; ponto de corte no fim da Fase 2 |
| Critério novo mascara lançamento real | C1 é regra dura de energia; a trava (T10) conta e reprova se acionar na bacia |
| Custo 1,7x e pausas de GC em máquina fraca | Fase 3 com meta 1,25x em mediana **e** p90; medir em AMD |
| Regressão do §12 (flutuar, colisor invisível) | caminho de `partBoxes`/`shownBoxes` não muda; testes do §12 no gate C5; catálogo quebrado no CI |
| Goldens mudam e escondem regressão de outra origem | recalibrar por último, num commit só, contra o `main` atual |
| `pieces.ts` com 1770 linhas vira o próximo ponto cego | na Fase 1, separar a geração de contatos (chão e pares) do arquivo |
