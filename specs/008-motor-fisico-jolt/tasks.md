# Tasks — Spec 008, Jolt como motor físico do kit

Leia `spec.md`, `plan.md`, `decision/GATE0-REPORT-jolt.md`, `decision/Q4-REPORT-jolt.md` e `decision/DECISION-ENGINE-fable.md` antes de começar.
Uma task por vez, na ordem.

Cada task responde: **Mecânica?** (o que fazer está todo descrito) e **Aceite por comando?** (um comando diz se passou). Duas vezes "sim" →
`haiku` (`model-economy.md` §1). 🧠 = task que produz decisão herdada por outras.

## Gates de toda task

1. Typecheck dos pacotes tocados: `pnpm --filter <pacote> typecheck` (e `pnpm -r typecheck` ao fim de cada fase).
2. Testes **sem GPU** dos pacotes tocados: `pnpm --filter <pacote> test` (sem `BENCH=1`).
3. Lint dos arquivos alterados: `pnpm exec eslint <arquivos>`; `node tools/kit-audit/audit.mjs --check`.
4. Commit isolado, só local, sem `--no-verify`. Hook falhou: corrigir a causa.
5. Evidência em `specs/008-motor-fisico-jolt/evidence.md`: comando, saída resumida, números, data, máquina.

Nunca afrouxar tolerância, tirar teste ou desligar regra: corrigir a causa. Gate falhou 2x no mesmo modelo → sobe um nível
(haiku → sonnet → opus) e registra em `evidence.md`. Sondas da sala, `perf.mjs`, `leak.mjs` e `browser-checks.mjs` só à mão ou na rodada
diária (`CLAUDE.md` §9), nunca em commit.

Pacotes, por nome curto: `physics` = `@adatechnology/game-physics`, `jolt` = `@adatechnology/game-physics-jolt`, `d3` =
`@adatechnology/game-destruction-three`, `dest` = `@adatechnology/game-destruction`.

## Fase 0 — Gate
> 🤖 Modelo: — (feito)

- T0.1 ✅ Gate 0: B1, B2, B3, B4, C9 passam; B5 misto; B6 falha. Commits `1e772895` … `11d7e369` em `spike/engine-jolt`. **Feito em 2026-11-13.**
- T0.2 ✅ Dono decide B6: atrito por corpo; pico de despertar ≈ 9,5 ms aceito. **Feito em 2026-11-13.**
- T0.3 ✅ Esta spec. **Feito em 2026-11-13.**

## Fase 1 — Atrito por corpo e arquitetura
> 🤖 Modelo: `opus` (fase inteira; T1.2 e T1.3 podem ir para `sonnet` depois que T1.1 fixar o desenho)

Worktree `adatechnology-game-kit-wt/engine-jolt`, branch `spike/engine-jolt`.

- T1.1 ✅ 🧠 **Desenho do atrito por corpo.** Feito em 2026-11-13 (`design/atrito-por-corpo.md`, revisado por `architect`, `evidence.md`). Fechar D1.1 do `plan.md`: quando um corpo vira `sticking`/`sliding`, a mistura com corpo estático,
  o caso de um corpo em dois apoios com estados diferentes, a restituição só no contato novo, o que fica no listener (eventos, sensores,
  `touching`) e como o estado fica determinístico. Escrito em `design/atrito-por-corpo.md` e revisado por `architect` antes de implementar.
  Mecânica? não · Aceite por comando? não (revisão) · `opus`.
> Já feito no spike (rodadas Q1–Q4, 2026-11-13): atrito por corpo (`62da7619`), `setShape` mantendo a massa (`36753ec0`), costura com 5× menos
> alocação (`0fea652f`), adaptador dividido (`72bb3a5e`), carro como corpo (`213878dc`), casa reformada no lugar (`f3187454`). A T1.1 passa a
> documentar e revisar o que já existe, e a T1.2 a conferir os testes listados contra o código atual, completando o que faltar.

- T1.2 ✅ **Implementar o atrito por corpo** (feito em 2026-11-13; `slope-friction.test.ts` 3/5 no Jolt, 2 pré-existentes vão para a T3.5) no adaptador, conforme T1.1. Teste novo em `jolt`: caixa μs 0,5 / μd 0,4 em 25° segura; μs 0,4 em 25°
  escorrega 0,42 ± 0,05 m em 1 s; corpo escorregando volta a `sticking` ao parar.
  Mecânica? sim (depois de T1.1) · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt test` e
  `pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/slope-friction.test.ts` · `sonnet`.
- T1.3 ✅ **Medir de novo B6, B5, B1 e o bug 2.** Feito em 2026-11-13: B6 passa (mediana 3,05 ms, pior 3,87, despertar ≤ 7,39); B5 1,17×; bacia 128/128 (`evidence.md`).
  - B6: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/cascade.test.ts -t "case 5b"`, 3 rodadas, máquina com carga < 3.
    Rodar 9 vezes, aquecido (o teste já separa frio e aquecido, `c23470f6`). Aceite (dono, 2026-11-13, até a medição em AMD): mediana dos p99
    ≤ 4 ms, nenhum p99 acima de 5 ms, e quadro de despertar ≤ 10 ms em todas.
  - B5: `BENCH=1 pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/bench-pieces.test.ts`, alternando com
    `PIECE_SOLVER=own`, ×3. Registrar mediana, p90, p99 e a razão.
  - B1: `BOWL_SEEDS=64 JOLT_ITERATIONS=20 pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/bowl-energy.test.ts`.
    Aceite: 128/128 em C1–C4 e C3b.
  - Bug 2: `pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/rolling.test.ts`. Registrar o deslize da lata.
  - **B6 reprovado: parar e levar ao dono** (o build próprio do wasm está descartado; não há saída prevista).
  Mecânica? sim · Aceite por comando? sim · `sonnet`.
- T1.4 ✅ 🧠 **Registro de decisão de arquitetura.** Feito em 2026-11-13 (`design/arquitetura.md`, revisado por `architect`). Contrato final de `game-physics` (o que entra e o que sai do spike), um mundo por jogo e
  quem o cria, carga assíncrona, ordem do passo, camadas, `tag` de parte, contrato do chão (móvel fora do `groundAt`, topos como malha
  desenhada, chão sólido do bug 3), eventos de contato para o dano. Em `design/arquitetura.md`, revisado por `architect`.
  Mecânica? não · Aceite por comando? não · `opus`.
- T1.5 ✅ Dono aprovou C1–C10 e respondeu as pendências (`spec.md` §11). **Feito em 2026-11-13.**

## Fase 2 — Contrato e adaptador de produção
> 🤖 Modelo: `sonnet` (T2.3, T2.6 e T2.7 → `haiku`)

- T2.1 ✅ **Branch de produção.** Feito em 2026-11-13 (`evidence.md`, branch `feat/motor-fisico-jolt`, base `origin/main` sem a release por decisão do dono). Conferir `git merge-base --is-ancestor <release/casa-a-pa-2026-11-13> origin/main`. Se não entrou: parar e
  perguntar. Se entrou: worktree `adatechnology-game-kit-wt/motor-fisico-jolt`, branch `feat/motor-fisico-jolt` do `origin/main`, trazendo
  `game-physics`, `game-physics-jolt`, `engine-*.ts`, `setup-physics.ts`, testes e boot da sala do spike e da fase 1, em commits limpos.
  Solver próprio como padrão (`plan.md` D3).
  Mecânica? sim · Aceite por comando? sim: `pnpm build && pnpm -r typecheck` e os testes de `physics`, `jolt`, `d3`, `dest` iguais aos do spike · `sonnet`.
- **T2.2 ✅ Contrato final** de `game-physics` conforme T1.4: tirar o que o spike deixou e a decisão cortou; tipos explícitos em todo export.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics typecheck` e `pnpm check:packages` · `sonnet`.
- **T2.3 ✅ Pacote de produção**: `jolt-physics` fixado na versão exata, `private` revisto, `LICENSE` com o texto MIT do Jolt, README de
  `game-physics` e `game-physics-jolt`, `pnpm-lock.yaml` commitado. Feito em 2026-11-13 (`evidence.md`, § T2.3).
  Mecânica? sim · Aceite por comando? sim: `pnpm install --frozen-lockfile` e `grep -q '"jolt-physics": "1.1.1"' packages/game-physics-jolt/package.json` · `haiku`.
- **T2.4 ✅ Bug 1: `setShape` mantém a massa do kit.** Reaplicar massa e inércia (com o contorno da condição 7) depois da troca de forma. Teste:
  peça de 2 kg troca de forma e continua com 2 kg e a inércia nova escalada para 2 kg.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt test` · `sonnet`.
- **T2.5 ✅ Descarte e memória (C9).** Todo objeto criado pelo adaptador tem `destroy`; `heap.test.ts` cobre ragdoll, veículo, junta, sensor e
  `setShape` em ciclos. Aceite: heap no mesmo byte; pico da cena pior ≤ 64 MB.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/heap.test.ts` · `sonnet`.
- **T2.6 ✅ Teste da inércia pequena**: cilindro r 5 mm, meia-altura 9,5 mm, 4 g → inversa da inércia ≈ (6,9e6; 2,0e7; 6,9e6), não 625.
  Texto da issue (spec §5.1) em `docs/`. **Abrir a issue no GitHub só com o ok do dono.**
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt test` · `haiku`.
- **T2.7 ✅ Skills** `game-physics` e `game-physics-jolt` (o que cada um faz, quem é dono de quê) e entrada em `tools/kit-audit/rules.json`.
  Mecânica? sim · Aceite por comando? sim: `node tools/kit-audit/audit.mjs --check` · `haiku`.

## Fase 3 — Destroços
> 🤖 Modelo: `sonnet` (T3.9 → `haiku`)

- T3.0a ✅ **Todo o desenhado vira colisor no Jolt** (feito em 2026-11-14; `evidence.md`, seção T3.0a) (`CLAUDE.md` §12: nenhum colisor sem geometria, nenhuma geometria sem colisor). A casa
  (malhas mescladas de parede, piso, telhado e lote, mais vigas, pilares, caibros, vergas e lajes), as malhas largas de móveis e alvos, e
  qualquer objeto fixo que outro módulo desenha. Caixas orientadas por parte desenhada; malha triangular só onde caixa não serve. Teste novo
  em `d3`: na cena da sala montada sem GPU, toda malha desenhada fixa tem um corpo no mundo (contagem e caixa batendo com a malha ± 1 cm).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction-three test` · `sonnet`.
- ✅ **T3.0b Caixas do carro a partir das malhas desenhadas.** Método tipado novo no `game-vehicles-three` que devolve as caixas de cada peça
  desenhada (sem retrovisor alargando a cabine), usado no lugar das caixas de dano cortadas (`dcfad8a2`). Teste: nenhuma caixa passa 1 cm da
  malha da sua peça, na frota inteira.
  Mecânica? não · Aceite por comando? sim: testes de `game-vehicles-three` e `d3` · `sonnet`.
- T3.0c ✅ **Regras antigas desligadas no modo Jolt** (feito em 2026-11-14; `evidence.md`, seção T3.0c). Com T3.0a e T3.0b prontos, o separar empurrando (`slideApart`/`applyPushes`), o levantar
  na criação além da condição 6 e a recusa de movimento (`c6c42d87`) não agem quando o solver é o Jolt; o contato é do motor. Medir a bacia
  (128/128) e a sala depois. Se a bacia cair, a causa vai para `evidence.md` e se corrige no colisor, não religando a regra.
  Mecânica? não · Aceite por comando? sim: bacia `BOWL_SEEDS=64 JOLT_ITERATIONS=20 ...bowl-energy.test.ts` · `sonnet`.
- T3.1 ✅ **Chão sólido (bug 3)** (feito em 2026-11-14; `evidence.md`, seção T3.1). Height field mais volume sólido por baixo (caixas ou prismas convexos por ladrilho), sem fork. Teste: chão que
  sobe 5 cm por baixo de uma peça dormindo a deixa em cima, nunca dentro nem abaixo; a rede `fellThrough` fica em 0.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/engine-ground.test.ts tests/ground-settlement.test.ts` · `sonnet`.
- T3.2 ✅ **Bug 2: lata na rampa de 10°** (feito em 2026-11-14; `evidence.md`, seção T3.2). Achar a causa do deslize de 2,14 cm (depois de T1.2, medir de novo). Aceite: ≤ 2 cm em 2 s sem
  amortecer a velocidade linear.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction-three exec vitest run tests/rolling.test.ts` · `sonnet`.
- **T3.3 Bug 4: C1 com 8 e 10 iterações.** Achar a causa dos 3/128 e 8/128 (excesso de 0,5–5,2 mm). Duas tentativas; se persistir, registrar  **Status 2026-11-14: levado ao dono** (8: 120/128, 10: 125/128; duas tentativas falharam; ver evidence.md `## T3.3`).
  e levar ao dono, mantendo 20 como piso de produção.
  Mecânica? não · Aceite por comando? sim: `BOWL_SEEDS=64 JOLT_ITERATIONS=8 ...bowl-energy.test.ts` e o mesmo com 10 · `sonnet`.
- T3.4 ✅ **Régua única de energia** (feito em 2026-11-14; `evidence.md`, seção T3.4) (C1 por ilha, C2 com a condição de C1, C3, C3b) em `tests/` de `d3`, usada pela bacia e pelas sondas da sala
  (`specs/008-motor-fisico-jolt/decision/probes/`; as de `008-solver-de-contato-dos-destrocos` só existem em `spike/engine-jolt`). Aceite: reproduz as colunas do gate 0 no Jolt e no próprio.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction-three test` · `sonnet`.
- **T3.5 C5: os 10 comportamentos do §12** (`spec.md` §6.1), um teste cada; reescrever os 14 que falham com apoio desenhado, motivo de cada
  um em `evidence.md`.
  **Status 2026-11-14: parcial** (`evidence.md`, seção T3.5): os 10 comportamentos têm teste (`tests/c5-behaviours.test.ts`, nos dois solvers) e 10 das 13 falhas do Jolt estão corrigidas;
  3 de `rolling` ficam para o dono (teto de giro de 47 rad/s e contato cilindro–cilindro).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction-three test` e `pnpm --filter @adatechnology/game-destruction test` sem falha · `sonnet`.
- **T3.6 C6: varredura de robustez** como teste: 64 sementes × dt {1/30, 0,05, 1/60, 1/144} × iterações {8, 10, 20} × push-out ±50%, pilha
  20:1 e pilha de 5. Roda por variável de ambiente, fora do `test` padrão.
  **Status 2026-11-14 (T3.6d, decisões do dono): produção 0 falhas (dt 1/60, ×1, 32 it.), piso com 19 falhas de 2304 (pilha 20:1 a 1/144: 18; bacia ×1,5 C3: 1); não ✅, ver `evidence.md` T3.6d.** Antes: parcial (`evidence.md`, seção T3.6): varredura pronta (`node tests/sweep-c6.mjs`, 678 s, 6912 corridas), mas 1742 falham: 31/64 da pilha 20:1 na produção (convergência com razão de massa 20:1; passa a ≥ 32 iterações), 8/10 iterações (conflito com a T3.3) e dt 1/144 (C2 0,3 m na semente 61). Decisão do dono pendente.
  Mecânica? sim · Aceite por comando? sim: o comando da varredura com 0 falhas · `sonnet`.
- **T3.7 C8: determinismo** entre dois processos e salvar/carregar bit a bit, como teste de `d3` e `jolt`. Chromium e Bun à mão; Firefox à mão. ✅ **Parte Node (2026-11-14, `evidence.md` T3.7):** testes em `game-physics-jolt/tests/determinism.test.ts` e `game-destruction-three/tests/determinism.test.ts`; política D4 com `debrisCost` (`fixed`/`replay`). **Pendente à mão:** Chromium, Bun e Firefox (lista na T3.7 da evidence).
  Mecânica? sim · Aceite por comando? sim (Node) · `sonnet`.
- **T3.8 Sala (à mão, `CLAUDE.md` §9):** blast e martelo, 5 rodadas cada, com a régua de T3.4, nos dois solvers. Aceite: C2 e C4 da sala.
  Régua: só o ganho sem entrada de fora (C2), sono contado da última entrada de fora (C4); 0 peças acima de 3,5 cm, tudo dormindo em ≤ 3 s e
  rede `fellThrough` em 0, nas 5 rodadas de cada. Falhou: parar e levar ao dono com os números (não ajustar regra do kit para passar).
  **Status 2026-11-14: reprovada no Jolt (C2 e C4 em 20/20 rodadas; `fellThrough` 0), levada ao dono; não ✅, ver `evidence.md` T3.8.**
  ✅ **2026-11-15, Jolt com D4, 5 de explosão e 5 de martelo (`evidence.md` T3.8w):** C2 condicionado 10/10, C4 10/10 (máximo de 1,75 s), `fellThrough` 0 em 10/10 e C3 10/10 com a régua R1–R3 aprovada pelo dono. As correções estão em T3.8b–T3.8w (PRs #302–#310 e este). **Limite conhecido, registrado por decisão do dono:** o C1, que fica fora do aceite desta tarefa, falha em 8/10 rodadas. A causa é o poste de 1 t, que ganha cerca de 0,4 mm por passo fixo a 120 Hz (0,38–1,35 kg·m por atualização nas explosões), mais resíduos abaixo de 0,1 mm. O solver próprio passa 0/10 na mesma sala.
  Nota (fechado/obsoleto pela spec 010 (data 2026-11-19)): o portão `tools/gpu/room-explosion.mjs` mede por padrão `jolt-d4-worker` (a variante que a página usa), não mais `jolt-d4`; `jolt-d4` segue por nome como linha de referência (T0.1). Medições de sala novas comparam com a régua da spec 010.
  Mecânica? sim · Aceite por comando? não (sondas à mão) · `sonnet`.
- **T3.9 Goldens dos destroços** (`plan.md` D4), num commit só, por último, comparados com o `origin/main` atual.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-floorplan-three test` · `haiku`.
- ✅ **T3.10 Ligar o Jolt como padrão** dos destroços (a chave `own` continua). Aceite: C1–C6, C8 verdes. **2026-11-26:** sala e testes abrem com Jolt (`own` é a exceção até a T8.1), 3 goldens de `destruction` regravados por decisão do dono (`evidence.md` rodadas 1–6); limite do motor: restituição do cilindro e = 0,46 (não 0,6).
  Mecânica? sim · Aceite por comando? sim: testes de `d3`, `dest`, `game-floorplan-three` · `sonnet`.

## Fase 4 — Props
> 🤖 Modelo: `sonnet` (T4.5 → `haiku`)

- ✅ **T4.1 Controlador de personagem** (`CharacterVirtual`) atrás do contrato, usado por `game-player`: degrau de 18 cm, rampa de 30°, empurrar
  caixa de 30 kg, ser empurrado. Aceite: testes novos; 50 controladores ≤ 0,5 ms.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-player test` e `... game-physics-jolt test` · `sonnet`.
- ✅ **T4.2 Segurar, soltar, arremessar** (dinâmico ↔ cinemático). Aceite: teste de pegar e arremessar sem atravessar parede.
  Mecânica? não · Aceite por comando? sim · `sonnet`.
- ✅ **T4.3 B2 em produção (reaberta e fechada em 2026-11-26):** granada como desenhada (corpo, espoleta, alavanca) com C_rr 0,015, **sem amortecimento**, e cápsulas com rolamento. Limite da granada decidido pelo dono em 2026-11-26: a desenhada rola e balança, então 6,5 s (não os 5 s da esfera) e 8 m. Aceite: granada em **Régua por distribuição (decisão do dono, 2026-11-26, depois da corrida entre #522 e #520):** em 100 arremessos semeados (400 a 499), ≥ 95% dormem em ≤ 6,5 s e a ≤ 8 m do pouso e nenhum passa de 8 s nem de 10 m; resultado {d["withinBoth"]}/100, quantil 95 {f(d["rest95"])} s, máximo {f(d["restMax"])} s e {f(d["reachMax"])} m (evidence.md, "Régua por distribuição").
  repouso ≤ 6,5 s e ≤ 8 m (cena aberta, parede, varredura e 48 sementes, 24 delas fora da calibração); ≥ 95% de 200 cápsulas dormindo a 5 s; nenhuma abaixo do chão.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/extras.test.ts` e testes de `game-weapons-three` · `sonnet`.
- ✅ **T4.4 Juntas dos interativos:** porta (dobradiça com limite), gaveta (deslizante), cortina e cabo; porta que quebra por impulso.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-interactables test` · `sonnet`.
- ✅ **T4.5 README e skills** dos pacotes tocados.
  Mecânica? sim · Aceite por comando? sim: `node tools/kit-audit/audit.mjs --check` · `haiku`.

## Fase 5 — Ragdoll
> 🤖 Modelo: `sonnet` (T5.3 é 🧠 → `opus`)

- ✅ **T5.1 Ragdoll de pessoa e zumbi** (2026-11-26: B3 passa no `KIT_WORLD`; 20 R0 davam 16,1 ms contra 3,0 do C7; decisão do dono: `ragdollsMax` 1 R0 + o resto R1, dentro do C7, `evidence.md` `## T5.1`) pelo ragdoll do Jolt, 20/8, `Stabilize`, a partir de `describeBody(createRig(...))`. Aceite (B3): nenhuma
  junta > 0,1 rad além do limite por mais de 3 quadros; dorme em ≤ 4 s; 20 corpos mortos (cota de R0 + o resto R1) dentro do orçamento do C7.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/ragdoll.test.ts` · `sonnet`.
- ✅ **T5.2 Desmembrar e cortar** (2026-11-26: `tearOff`/`cutSegment` em `game-characters`, `removeJoint` de junta de ragdoll e `massOf` no contrato, massa constante a 1e-7, `evidence.md` `## T5.2`) com `setShape` e juntas que quebram, mantendo a massa (bug 1 já corrigido).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-characters-three test` · `sonnet`.
- ✅ **T5.3 🧠 Regra da pilha** (feito em 2026-11-26: `design/pilha-e-lod.md` v2, reprovada a v1 pelo `architect` com 12 mudanças, todas aplicadas; D-T5.3a decidida pelo dono, opção A): pilhas são correntes ou cápsulas, nunca ragdolls inteiros (1 700 corpos não dormem em nenhum motor); LOD
  ragdoll → cápsula pela distância. Decisão em `design/pilha-e-lod.md`, revisada por `architect`.
  Mecânica? não · Aceite por comando? não · `opus`.
- **T5.4 Implementar a regra da pilha** (2026-11-26, **sem ✅**: 11 dos 13 testes do §7 passam; o T1 — 100 corpos a 5,9 ms e dormindo a ~12 s no `KIT_WORLD` contra 2,5 ms e 10 s — falha e o T5 fica no limite, R2 → R1 em 4,8–5,5 ms contra 5; `evidence.md` `## T5.4`, subseção "Fechamento": `pileChainsMax` de 0 a 30 não fecha o T1, T5 em 3,9–5,5 ms com o cache do adaptador; decisão do dono pedida). Aceite: 100 corpos empilhados dormem em ≤ 10 s a ≤ 4 ms; troca de LOD de 100 corpos ≤ 5 ms.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/body-lod.test.ts` · `sonnet`.
  Pendências nomeadas desta task (nada disso está feito):
  - **T5.4a** desenho de R0/R1 perto por esqueleto (`game-characters-three`, §5.3 do desenho): o `game-crowd-three` segue desenhando cadáver como instância de pose fixa e `y: 0` (`instances.ts`); troca nos mesmos 18 m. Exige §5 do CLAUDE.md (1ª e 3ª pessoa, print por câmera).
  - **T5.4b** canal novo de instância (y + quaternion) em `game-crowd-three` para R2, R2f e R3.
  - **T5.4c** ligar `createCorpseBodies` ao jogo/sala: `interest` do jogador, `follower` no registro de cadáveres, `onSettled` → `relocateCorpse`, `budget` do host (`beginFrame`); hoje só os testes usam.
  - **T5.4d** restaurar num mundo novo depois de trocas (C8): as chaves dos corpos levam o número de sequência, então `restoreState` só vale no mesmo mundo; recriar na ordem de criação exige o número de sequência no estado salvo.
  - **T5.4e** o orçamento somado do §2.3 (20 R0 + pilha + 1 000 agentes + destroços) na sala de teste.
- **T5.5 Ragdoll de quadrúpede** (`game-animals-three`). Aceite: mesmo critério de T5.1.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-animals-three test` · `sonnet`.

## Fase 6 — Veículos
> 🤖 Modelo: `sonnet` (T6.1 é 🧠 → `opus`; T6.5 → `haiku`)

- ✅ **T6.1 🧠 Mapa do arcade para o veículo de rodas** (feito em 2026-11-14, escopo ampliado pelo dono: batida que deforma, peças que soltam, toda a frota; `design/veiculos.md`, revisado por `architect` com 12 mudanças aplicadas; divisão 008/009 e D2, D3, D4, D9, D12, D13 decididas pelo dono em 2026-11-14; o plano de tasks da fase 6 está na seção 21 do desenho e entra aqui antes da T6.2): controles → `driveVehicle`; ajustes → curvas de atrito do pneu, curva de torque,
  marchas; carro criado já andando (rodas giradas e marcha); zonas de dano como filhos marcados. Em `design/veiculos.md`, revisado por
  `architect`. Mecânica? não · Aceite por comando? não · `opus`.
- **T6.2 Implementar o mapa** em `game-vehicles-driving` atrás do contrato. Aceite: testes do pacote (os de andar e bater recalibrados com
  motivo).
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-driving test` · `sonnet`.
- **T6.3 Regra de sono do carro** (roda no ar girando mantém o carro acordado). Aceite: carro parado dorme em ≤ 3 s; batida a 60 km/h no meio-fio
  de 30 cm dorme em ≤ 7 s.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/vehicle.test.ts` · `sonnet`.
- **T6.4 Teste de aceitação da frota** (`CLAUDE.md` §7) com o motor: tiro acerta o desenhado, marca vai com a peça. Goldens de geometria da
  frota iguais.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-fleet test` · `sonnet`.
- **T6.5 README, skills e `docs/veiculos-verificacao.md`.**
  Mecânica? sim · Aceite por comando? sim: `node tools/kit-audit/audit.mjs --check` · `haiku`.

## Fase 7 — Multidão, consultas e balística, reação em cadeia
> 🤖 Modelo: `sonnet`

- **T7.1 Multidão:** agentes como cápsulas cinemáticas (`game-crowd` move, o motor só empurra), corpos no chão como correntes, porta que cede
  por junta. Aceite: 1 000 agentes ≤ 0,5 ms; `state-hash` e `team-golden` de `game-crowd` iguais **quando nada empurra corpos** (D-T5.3a, opção A, dono em 2026-11-26: a física manda a posição do cadáver empurrado por `corpses.relocate`; `design/pilha-e-lod.md` §4).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-crowd test` e `... game-crowd-three test` · `sonnet`.
- **T7.2 Consultas:** broadphase do motor sob `surfaceRay` (o acerto final continua a superfície desenhada), raio com vários acertos, esfera
  varrida, corpos criados no mesmo quadro. Aceite: 1 000 raios ≤ 2 ms; mesmo resultado que o caminho antigo nos testes do §7.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction test` e `... game-physics-jolt exec vitest run tests/queries.test.ts` · `sonnet`.
- **T7.3 Blast e fragmentos:** ~300 raios de fragmento + sobreposição + linha de visada; sensores de fumaça (entra/sai). Aceite: um blast ≤ 1 ms.
  Mecânica? não · Aceite por comando? sim: testes de `game-weapons`, `game-vfx`, `jolt` · `sonnet`.
- **T7.4 Reação em cadeia:** eventos de contato com impulso viram `hit` do `game-destruction` sem alocação por quadro; despertar em massa
  dentro da condição 10. Aceite: caso 5 e 5b dentro do orçamento; heap de JS estável.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/cascade.test.ts` · `sonnet`.

## Fase 8 — Corte e validação
> 🤖 Modelo: `haiku` para o mecânico (T8.1, T8.2, T8.3); `sonnet` para a validação (T8.4, T8.5, T8.6)

- **T8.1 Apagar o solver próprio** dos destroços, a chave `PIECE_SOLVER`/`?solver=own`, a rede e o código só do spike. Commit próprio.
  Mecânica? sim · Aceite por comando? sim: `grep -rn "PIECE_SOLVER\|solver=own" packages examples` vazio; `pnpm -r typecheck`; `pnpm -r test` · `haiku`.
- **T8.2 Docs:** `docs/criterios-fisica-objetos.md`, `CLAUDE.md` §12 (a regra continua; o executor agora é o motor), skills de cada pacote
  migrado, e `REPORT-ENGINE-*` e `GATE0-REPORT-jolt.md` copiados para `specs/008-motor-fisico-jolt/decision/`.
  Mecânica? sim · Aceite por comando? sim: `node tools/kit-audit/audit.mjs --check` · `haiku`.
- **T8.3 Marcar a spec antiga** `specs/008-solver-de-contato-dos-destrocos/` como substituída (sem apagar).
  Mecânica? sim · Aceite por comando? sim: `grep -q "Substituída" specs/008-solver-de-contato-dos-destrocos/spec.md` · `haiku`.
- **T8.4 Sala em GPU real** (à mão): blast, martelo, carro, ragdoll, horda; 5 rodadas; print por câmera (`CLAUDE.md` §5). Aceite: C2 e C4 da sala.
  Mecânica? não · Aceite por comando? não · `sonnet`.
- **T8.5 Rodada diária à mão na branch:** `GPU_SCOPE=nightly PRE_PUSH_BROWSER=all node tools/gpu/browser-checks.mjs`, `node tools/gpu/perf-gate.mjs`,
  `node examples/test-room/leak.mjs` com a sonda do wasm nova (C9). Aceite: tudo verde.
  Mecânica? sim · Aceite por comando? sim (à mão, nunca em commit) · `sonnet`.
- **T8.6 AMD, Firefox e ARM** conforme a resposta do dono (`spec.md` §11). Aceite: orçamentos do C7 na faixa medida; C8 em Firefox.
  Mecânica? sim · Aceite por comando? sim (à mão) · `sonnet`.
- **Revisão final:** `code-reviewer` com `model=sonnet`. PR só com o ok do dono, aberto e mostrado no Chrome dele.

## Prompt de execução

Pendências do `spec.md` §11 respondidas pelo dono em 2026-11-13. Prompt para `/oh-my-claudecode:autopilot`:

```text
/oh-my-claudecode:autopilot Execute a spec specs/008-motor-fisico-jolt/ do adatechnology-game-kit (leia spec.md, plan.md e tasks.md
antes de começar, e decision/GATE0-REPORT-jolt.md e decision/Q4-REPORT-jolt.md). Uma task por vez, na ordem do tasks.md,
começando pela primeira não marcada ✅ (T1.1).
Siga o CLAUDE.md do repositório (SDK primeiro, §12 nada flutua e nenhum colisor sem geometria, §8 memória, §10 tudo tipado sem any).
Ambiente: fases 1 no worktree adatechnology-game-kit-wt/engine-jolt (branch spike/engine-jolt); da T2.1 em diante no worktree novo
motor-fisico-jolt criado da origin/main atualizada. Nunca a pasta principal, nunca a main. Commits só locais, um por task; nunca push,
nunca PR, nunca --no-verify (hook falhou: corrigir a causa).
Testes de GPU e de navegador não rodam em commit, pre-push nem CI: sondas da sala, perf.mjs, leak.mjs e browser-checks.mjs só à mão,
conforme o tasks.md. Nos commits, só testes sem GPU.
Modelos: Fase 1 → opus (T1.1 🧠 e T1.4 🧠 revisados por architect antes de implementar; T1.2 e T1.3 → executor model=sonnet) ·
Fase 2 → executor model=sonnet (T2.3, T2.6, T2.7 → haiku) · Fase 3 → executor model=sonnet (T3.9 → haiku) ·
Fase 4 → sonnet (T4.5 → haiku) · Fase 5 → sonnet (T5.3 🧠 → opus) · Fase 6 → sonnet (T6.1 🧠 → opus; T6.5 → haiku) ·
Fase 7 → sonnet · Fase 8 → haiku (T8.1–T8.3) e sonnet (T8.4–T8.6) · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes sem GPU dos pacotes tocados + lint dos arquivos + kit-audit --check + commit isolado, com
evidência (comando, números, data, máquina) em specs/008-motor-fisico-jolt/evidence.md. Nunca afrouxar tolerância, tirar teste ou
desligar regra para passar.
Pare e pergunte ao dono antes de: B6 reprovado na T1.3 (mediana dos p99 > 4 ms ou algum > 5 ms); T2.1 se release/casa-a-pa-2026-11-13
ainda não estiver na origin/main; sala reprovada na T3.8; qualquer push, PR, merge ou deploy; qualquer decisão nova que mude C1–C10.
```
