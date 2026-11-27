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
  - **T5.4f** achar por que a pilha de R2 (cápsulas) não dorme em 14 s com `pileChainsMax` de 10 a 40 (`evidence.md`, "Nascer como cápsula"): sem isso o teto de correntes não fecha o T1.
  - **T5.4a** desenho de R0/R1 perto por esqueleto (`game-characters-three`, §5.3 do desenho): o `game-crowd-three` segue desenhando cadáver como instância de pose fixa e `y: 0` (`instances.ts`); troca nos mesmos 18 m. Exige §5 do CLAUDE.md (1ª e 3ª pessoa, print por câmera).
  - **T5.4b** canal novo de instância (y + quaternion) em `game-crowd-three` para R2, R2f e R3.
  - **T5.4c** ligar `createCorpseBodies` ao jogo/sala: `interest` do jogador, `follower` no registro de cadáveres, `onSettled` → `relocateCorpse`, `budget` do host (`beginFrame`); hoje só os testes usam.
  - **T5.4d** restaurar num mundo novo depois de trocas (C8): as chaves dos corpos levam o número de sequência, então `restoreState` só vale no mesmo mundo; recriar na ordem de criação exige o número de sequência no estado salvo.
  - **T5.4e** o orçamento somado do §2.3 (20 R0 + pilha + 1 000 agentes + destroços) na sala de teste.
- ✅ **T5.5 Ragdoll de quadrúpede** (2026-11-26: `ragdollOfAnimal`/`chainOfAnimal`/`corpseBodyKitOfAnimal` puros em `game-animals`; B3 em cão, gato, vaca e cavalo, dorme em 2,1 a 2,7 s e excesso máximo 0,024 rad; R0 de 0,5 a 0,8 ms; `evidence.md` `## T5.5`). Aceite: mesmo critério de T5.1.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-animals-three test` · `sonnet`.

## Fase 6 — Veículos
> 🤖 Modelo: `sonnet` (T6.1 é 🧠 → `opus`; T6.16, T6.19 e T6.20 → `haiku`). Plano da seção 21.1 de `design/veiculos.md`; ordem: T6.0 + T6.0b → T6.1 (dono) → T6.19 → T6.1b → T6.2/T6.2b/T6.3 → T6.4/T6.21 → T6.9 → T6.26 → T6.20 → T6.12 → T6.25 → T6.16.
> A camada de corpo morto da Fase 5 se chama `corpse` (PR #521); a `ragdoll` da seção 6.4 do desenho é a mesma coisa e não se cria outra.

- ✅ **T6.1 🧠 Mapa do arcade para o veículo de rodas** (feito em 2026-11-14, escopo ampliado pelo dono: batida que deforma, peças que soltam, toda a frota; `design/veiculos.md`, revisado por `architect` com 12 mudanças aplicadas; divisão 008/009 e D2, D3, D4, D9, D12, D13 decididas pelo dono em 2026-11-14; o plano de tasks da fase 6 está na seção 21 do desenho e entra aqui antes da T6.2): controles → `driveVehicle`; ajustes → curvas de atrito do pneu, curva de torque,
  marchas; carro criado já andando (rodas giradas e marcha); zonas de dano como filhos marcados. Em `design/veiculos.md`, revisado por
  `architect`. Mecânica? não · Aceite por comando? não · `opus`.
- ✅ **T6.0 Micro-benchmark do reticulado** (feito em 2026-11-26; números em `evidence.md` `## T6.0`; alimenta a decisão de seguir com a 009; só registra): XPBD com plasticidade em Node, 60–400 nós, 1 920/960/480/240 Hz, 1 e 2 iterações, massa realista (motor : painel ≈ 300:1), entrada por plano; relata ms, erro de deformação e deriva; 9 rodadas em máquina quieta.
  Mecânica? sim · Aceite por comando? sim (à mão, nunca em commit; números em `evidence.md`) · `sonnet`.
- ✅ **T6.0b Espião descartável** (feito em 2026-11-26; o teste imprime e confere; veredito: folga na parede reprovada, `evidence.md` `## T6.0b`; um arquivo de teste em `game-physics-jolt`, Jolt cru permitido): um carro, uma parede, cinco componentes (para-choque dianteiro, capô, farol esquerdo, roda dianteira esquerda, suspensão dianteira esquerda); ms por etapa por quadro; composto mutável com 96 e 192 filhos (contato e `LinearCast`); skinning na CPU; critérios escritos de seguir ou parar a E3 (4.2: folga ≤ 3 cm, nó ≤ 1,5×, energia ≤ entrada; 15.1: carro ≤ 1,2 ms a 480 Hz).
  Mecânica? não · Aceite por comando? sim (o teste imprime e confere os critérios) · `sonnet`.
- ✅ **T6.1b Contrato e adaptador** (6.4) — **concluída em 2026-11-26 (`evidence.md` `## T6.1b`, as duas partes)**; primeira parte (forma compartilhada e cópia no primeiro dano, filho por alça, `setMassProperties`, `setMotionQuality`, `watchContacts`, `vehicleWheels`, `rebuildVehicle`, camadas; `evidence.md` `## T6.1b`); segunda parte: controladores `motorcycle` e `tracked`, curvas de pneu e motor, câmbio, diferenciais, `applyBuoyancy` e a correção de 3.4 (carro criado andando). Forma compartilhada e cópia no primeiro dano, filho por alça, `setMassProperties`, `setMotionQuality`, `watchContacts`, `vehicleWheels`, `rebuildVehicle`, camadas (sem `vehicle`–`agent`, `corpse` separada de `prop`, testador das rodas), controladores moto e esteira, curvas; correções de 3.4.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt test` e `heap.test.ts` · `sonnet`.
- ✅ **T6.2 Mapa da condução** (seção 7; feito em 2026-11-26, `evidence.md` `## T6.2`; a arrancada do Jolt é 1,6× a da semi-simulação, registrada e entregue à T6.2b), inclusive a bicicleta a pedal: `vehicleDescFromSemi`, controles → entrada, carro criado andando, arrasto, `status()`; os testes de andar e bater recalibrados com motivo (nenhum precisou).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-driving test`, `vehicle.test.ts` · `sonnet`.
- **T6.2b Rodador do banco de provas no Jolt (sem ✅: o que resta é a T6.2d):** frota terrestre inteira dentro das faixas. **Rodador feito em 2026-11-26 (`evidence.md` `## T6.2b`); a frota NÃO está inteira dentro das faixas: 258 de 288 corridas passam, 21 dos 48 modelos terrestres têm algo fora (os 21 falham na arrancada, 17 só nela); sem ✅ até o dono decidir como a arrancada limitada pela tração entra (ficha ou assistência), e a faixa não foi tocada. Diagnóstico de 2026-11-26 (`evidence.md` `## T6.2b — Diagnóstico da arrancada`): não é tração nem defeito do pneu; a tabela da faixa é por nota, sem fonte, e a semi não tem inércia, troca nem rigidez de pneu; decisão do dono.** **Decisão do dono (2026-11-26): revisar as notas de aceleração pelos dados reais**: 17 carros e SUVs de modelo real receberam a nota do 0-100 real na faixa da classe (fonte por modelo em `game-vehicles-fleet/src/acceleration-sources.ts` e em `evidence.md` `## T6.2b — Notas de aceleração pelos dados reais`); a frota no Jolt foi de 24 para 21 modelos fora (33 para 30 corridas), a semi-simulação de 12 para 15 (22 para 25); continua sem ✅: restam as fichas por tipo (T6.2c) e a arrancada do Jolt 1,4× a 1,8× a da semi.
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-proving test` · `sonnet`.
- **T6.2c Ficha por tipo de veículo (sem ✅: o que resta é a T6.2d)** (pendência aberta em 2026-11-26 pela decisão do dono; fora da revisão das notas): a ficha (`semiSpecFromStats`) trata todo veículo como carro de 4 rodas com o mesmo torque por kg da nota, e a faixa de aceleração só tem banda sourced para `cars`, `suvs` e `motorcycles`. Ficam de fora e precisam de ficha própria: **motos** (`scooter`, `commuter_motorcycle`, `trail_bike`, `adventure_bike`, `highway_police_bike`, `naked_bike`, `sport_bike`, `cruiser`, `delivery_bike`, `quad_bike`: a ficha dá 4 rodas), **`step_through_scooter`** (a ficha o trata como carro de 4 rodas), **bicicleta** (pedal, não motor), **trator**, **pesados** (`cargo_van` e demais vans, caminhões e ônibus: sem par de fontes verificado) e **militares** (`troop_truck`, `apc_6x6`, `armored_car_6x6`, `battle_tank`, `monster_truck`); mais o **`city_bus`**, cujo giro no Jolt (27,2 m) está 4% acima do teto de 26 m. Os modelos sem fonte do 0-100 (`midsize_suv`, `large_suv`) mantêm a nota e a marca "sem fonte". Mecânica? não · Aceite por comando? sim (`proving-physics.test.ts` com a tabela `OUT_OF_RANGE` menor) · `sonnet` (a decisão de ficha por tipo é do dono).
- **T6.2c, andamento (2026-11-26, branch `spec/008-fase6-ficha`; `evidence.md` `## T6.2c — Ficha por tipo de veículo`): sem ✅.** A ficha agora vem do tipo (`type`, `axles`, `tracks` em `BodyDimensions`; eixos e esteiras lidos do modelo em `game-vehicles-fleet/src/data/wheel-layouts.json`; motos de duas rodas e controlador `motorcycle`, bicicleta a pedal, caminhões com os eixos do modelo, trator, esteira com controlador `tracked`; entre-eixos do modelo, que corrige o giro do `city_bus`). Jolt: 21 -> 17 modelos fora (30 -> 18 corridas); semi: 15 -> 15 (25 -> 25). **Restam 17 no Jolt**: carros e SUVs na arrancada (5, ficha do carro inalterada), pesados e militares RÁPIDOS DEMAIS na arrancada (6, a potência por kg do carro e a banda por nota não têm fonte: decisão do dono), bicicleta na arrancada (a banda pede 5 m/s² de um ciclista), tanque no giro (gira no lugar), trator e quatro motos na freada molhada. Também achado: a caixa automática do Jolt para de subir de marcha com seis marchas ou mais. T6.2b segue sem ✅.
- **T6.2d Restos da frota no Jolt: 17 modelos fora das faixas** (pendência nomeada em 2026-11-26 pelo dono; **não resolvida aqui**, motivos em `evidence.md` `## T6.2c`; a T6.2b e a T6.2c ficam sem ✅ até ela): (1) **carros e SUVs na arrancada** (`entry_hatch`, `beetle`, `hybrid_suv`, `rideshare_hatch`, `v8_coupe`): a diferença da T6.2b (pneu com limite de tração e câmbio no motor, 1,4× a 1,8× a semi) sobre banda com fonte; (2) **pesados e militares na arrancada, rápidos demais** (`monster_truck`, `tanker_truck`, `troop_truck`, `apc_6x6`, `armored_car_6x6`, `battle_tank`): sem fonte de potência por tonelada nem de 0-100; (3) **`bicycle` na arrancada**: a faixa pede 5 m/s² de um ciclista de 250 W; (4) **`battle_tank` no giro**: gira no lugar contra a faixa de 9 m; (5) **`tractor` e quatro motos na freada molhada** (`scooter`, `trail_bike`, `step_through_scooter`, `delivery_bike`): o Jolt combina o atrito do pneu e o do chão pela média geométrica (0,9 g numa pista de 0,75) e a semi pelo produto (0,8 g); a caixa do Jolt também não sobe de marcha com seis ou mais; (6) **o fator 1,3 da potência das motos** (`MOTORCYCLE_POWER_FACTOR`): ajustado por medida, sem fonte. Mecânica? não · Aceite por comando? sim (`proving-physics.test.ts` com a tabela `OUT_OF_RANGE` menor) · `sonnet` (as decisões de fonte são do dono).
- ✅ **T6.3 Regra de sono do carro** (feito em 2026-11-26, `evidence.md` `## T6.3`; 7.7; roda no ar girando mantém o carro acordado). Aceite: carro parado dorme em ≤ 3 s; batida a 60 km/h no meio-fio de 30 cm dorme em ≤ 7 s.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/vehicle.test.ts` · `sonnet`.
- ✅ **T6.4 Cascos convexos** (10.1, 10.3, 10.5): concavidade, extrusão para dentro, teto por classe medido e escrito aqui, H1–H6 nos 69 modelos; estacionado dinâmico com as guardas da 10.4. **Maquinário feito em 2026-11-26 (`evidence.md` `## T6.4`): casco convexo incremental, corte por concavidade e por vão, extrusão para dentro, peça sólida inteira, cache por célula, teto por classe medido (moto 200, carro 1 450, caminhão e ônibus 2 000…, escrito no desenho 10.3); sem ✅: H2 e H3 reprovam (`family_hatch` 66% de cobertura, 33% dos raios com casco à frente do desenhado), a contagem é 12× a estimativa (~1 270 cascos por carro) e a guarda de memória da 10.4 não fecha com ela (83 MB contra 64 MB). Decisão do dono pendente.** **Método B aprovado pelo dono em 2026-11-26 (`evidence.md` `## T6.4`, "Método B"; desenho 10.1 e 10.3 trocados por K1–K7): implementado; K1, K2, K5, K6 e ≤ 64 pontos passam nos 69; sem ✅: K3 reprova nos 69 (9% a 61% das esferas; precisa de decisão do dono), o teto K7 da van (280 contra 256) e do `heavy` (520 e 431 contra 384) e o tempo de 100 ms não fecham.** **Fechamento de 2026-11-26 (`evidence.md` `## T6.4`, "Fechamento"): tetos da van 300 e do `heavy` 550; cache por modelo (`createHullPlanCache`) e primeiro plano na categoria `vehicles.hull-plan` do worker (equivalência byte a byte feita); K7 de tempo passa nos 69 (2.º carro ≤ 1,23 ms contra 2; 1.º carro ≤ 3,9 ms de quadro, plano no worker); K1, K2, K3, K5, K6, ≤ 64 pontos e o teto do K7 passam nos 69; sem ✅: K4 reprova no `v8_coupe` (+3, a recusa do corte que piora o K4 foi feita e medida e derruba 71 a 77 testes de catraca dos outros modelos, ver evidência) e no `city_bus` (+1, novo com o teto de 550). Decisão do dono de 2026-11-26: subir 3 e 1 esferas (gravado em `hull-excess-ledger.json`); a lateral do `city_bus` mede 6 009 contra 5 954 (+55), o dono aprovou também esse +55 (2026-11-26): K1 a K7 passam nos 69, **✅** (`evidence.md` `## T6.4`, "Catraca do K4").**
  Mecânica? não · Aceite por comando? sim: `vehicle-hulls.test.ts` · `sonnet`.
- ✅ **T6.9 Peças soltam como corpos** (11, sem o interior), contabilidade de massa, no lugar do `fling` no modo Jolt; nível 2 de dano alimentado pelas linhas de contato do Jolt (`crashVehicle` pelo `tag`) e cascos refeitos ao assentar (feito em 2026-11-26, `evidence.md` `## T6.9`; medição em AMD na T8.6).
  Mecânica? não · Aceite por comando? sim: `crash-parts.test.ts` · `sonnet`.
- ✅ **T6.12 Aceitação da frota** (`CLAUDE.md` §7) com motor e cascos: tiro acerta o desenhado, marca vai com a peça; goldens da geometria intacta iguais (feito em 2026-11-26, `evidence.md` `## T6.12`; 1 478 testes, nenhum golden mudou).
  Mecânica? sim · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-fleet test` · `sonnet`.
- ✅ **T6.16 README, skills** (`kit-veiculos`), `docs/veiculos-verificacao.md` e `docs/veiculos-pecas-por-categoria.md` (feito em 2026-11-26, `evidence.md` `## T6.16`; `kit-audit --check` sai 0, com uma entrada nova na allowlist do rodador do Jolt).
  Mecânica? sim · Aceite por comando? sim: `node tools/kit-audit/audit.mjs --check` · `haiku`.
- ✅ **T6.19 Atualizar o §6 da `arquitetura.md`:** carro estacionado dinâmico (D3), sem par `vehicle`–`agent`, camada de corpo morto (`corpse`, da Fase 5), camada do testador das rodas.
  Mecânica? sim · Aceite por comando? sim: `grep` das camadas novas na `arquitetura.md` · `haiku`.
- ✅ **T6.20 Emenda do C8 no `spec.md`** (D2) com o texto aprovado pelo dono (feito em 2026-11-26, texto do dono sem mudar uma palavra, logo abaixo da tabela de condições; D2 confirmada no §20 do `design/veiculos.md`).
  Mecânica? sim · Aceite por comando? sim: `grep` da emenda · `haiku`.
- ✅ **T6.21 Heap dos 200 carros estacionados** e variante do B6 com 20 carros na ilha (10.4; feito em 2026-11-26, `evidence.md` `## T6.21`; passa com o teto de 96 cascos do desenho, e **não** com os ~1 270 que a T6.4 mediu: ver lá).
  Mecânica? sim · Aceite por comando? sim: `heap.test.ts`, `cascade.test.ts` · `sonnet`.
- **T6.25 Sonda da sala do veículo no `leak.mjs`** (§8). **Sonda escrita em 2026-11-26 (`evidence.md` `## T6.25`, fase `vehicle`, README em `examples/test-room/`); sem ✅: o aceite é à mão e o navegador não foi aberto; o dono roda na T8.5.**
  Mecânica? sim · Aceite por comando? sim (à mão) · `sonnet`.
- ✅ **T6.26 Atropelar pedestres e zumbis** (7.8; feito em 2026-11-26, `evidence.md` `## T6.26`; `createRunOver` em `game-vehicles-driving`, provado com o `Crowd` real em `game-crowd` e com um carro do Jolt em `vehicle.test.ts`).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-vehicles-driving test`, `vehicle.test.ts` · `sonnet`.

> Vai para a spec 009 (E3–E5: reticulado `game-deform`, propriedades mecânicas, gerador e classes de viga, skinning, acoplamento contato → reticulado → cascos, vagas, salvar, interior e fogo, calibração, linha composta do C7, ocupantes ragdoll, reboque/ônibus, barco, voo, z-fighting nas batidas, aceitação com reticulado): lista na seção 21.2 de `design/veiculos.md`. A spec 009 ainda não foi criada.

## Fase 7 — Multidão, consultas e balística, reação em cadeia
> 🤖 Modelo: `sonnet`

- ✅ **T7.1 Multidão** (2026-11-26, `evidence.md` `## T7.1`): agentes como cápsulas cinemáticas (`game-crowd` move, o motor só empurra), corpos no chão como correntes, porta que cede
  por junta. Aceite: 1 000 agentes ≤ 0,5 ms; `state-hash` e `team-golden` de `game-crowd` iguais **quando nada empurra corpos** (D-T5.3a, opção A, dono em 2026-11-26: a física manda a posição do cadáver empurrado por `corpses.relocate`; `design/pilha-e-lod.md` §4).
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-crowd test` e `... game-crowd-three test` · `sonnet`.
- ✅ **T7.2 Consultas** (2026-11-26, `evidence.md` `## T7.2`, com a ressalva do ganho do `raycast` do mundo): broadphase do motor sob `surfaceRay` (o acerto final continua a superfície desenhada), raio com vários acertos, esfera
  varrida, corpos criados no mesmo quadro. Aceite: 1 000 raios ≤ 2 ms; mesmo resultado que o caminho antigo nos testes do §7.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-destruction test` e `... game-physics-jolt exec vitest run tests/queries.test.ts` · `sonnet`.
- ✅ **T7.3 Blast e fragmentos** (2026-11-26, `evidence.md` `## T7.3`): ~300 raios de fragmento + sobreposição + linha de visada; sensores de fumaça (entra/sai). Aceite: um blast ≤ 1 ms.
  Mecânica? não · Aceite por comando? sim: testes de `game-weapons`, `game-vfx`, `jolt` · `sonnet`.
- ✅ **T7.4 Reação em cadeia** (2026-11-26, fechada pela decisão do dono: o 5b vale na build SIMD com os limites do §6.2 e a build `single` tem linha própria; o caso 5 é cena de referência sem limite; `evidence.md` `## T7.4`): eventos de contato com impulso viram `hit` do `game-destruction` sem alocação por quadro; despertar em massa
  dentro da condição 10. Aceite: caso 5 e 5b dentro do orçamento; heap de JS estável.
  Mecânica? não · Aceite por comando? sim: `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/cascade.test.ts` · `sonnet`.

## Fase S — Integração das costuras na sala
> 🤖 Modelo: `sonnet` (TS.9 é 🧠 — desenho com `opus` antes). Desenho: `design/integracao-sala.md`.

- [x] TS.1 ✅ Canal `ModuleHost.physics`/`workers`, `PhysicsServices` no `game-physics`, `servicesOf` no preset, `physicsHostOf` na sala (0 linhas líquidas no `room.ts`). Aceite: `physics-channel.test.ts` e `world-physics-services.test.ts` verdes.
- [x] TS.2 ✅ `hullPlanKind` em `KIT_WORKER_KINDS`. Aceite: `workers.test.ts` com `VEHICLE_HULL_PLAN`.
- [x] TS.3a ✅ `rayBroadPhase` ligado quando há laço. Aceite: testes do `game-kit-defaults` verdes, goldens iguais.
- [x] TS.4 ✅ Veículos na sala (cascos B, `createCrashParts`, `world: SeamWorld`; `evidence.md` `## TS.4`).
- [ ] TS.5 Armas: cápsulas e granada no motor.
- [ ] TS.6 Multidão e atropelamento (desligado com `hordeThread`).
- [ ] TS.7 Cadáveres na sala (T5.4b/c/d).
- [ ] TS.8 `contactHits` atrás de opção (custo medido) e `blastQuery`.
- [ ] TS.9 🧠 Jogador no motor (desenho antes).
- [ ] TS.10 (opcional) Juntas na vitrine.

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
  `node examples/test-room/leak.mjs` com a sonda do wasm nova (C9) e a sonda do veículo da T6.25: `cd examples/test-room && node build.mjs && LEAK_PHASE=vehicle node leak.mjs` (o dono roda; se ela passar, a T6.25 ganha ✅). Aceite: tudo verde.
  Mecânica? sim · Aceite por comando? sim (à mão, nunca em commit) · `sonnet`.
- **T8.6 AMD, Firefox e ARM** conforme a resposta do dono (`spec.md` §11). Aceite: orçamentos do C7 na faixa medida; C8 em Firefox.
  Mecânica? sim · Aceite por comando? sim (à mão) · `sonnet`.
- **T5.6 Otimizar o custo do R0** (depois da Fase 8; decisão do dono em 2026-11-26: `ragdollsMax` = 1 até aqui). Caminho mais promissor: R0 a 60 Hz em vez de 120 e sem os passes 20/8 (`KIT_RAGDOLL_SOLVER`). Aceite: 3 a 4 R0 dentro do C7 (3,0 / 4,0 ms, 20 corpos mortos) sem perder o B3 (ragdoll estável, `stabilize`).
  Mecânica? não (mede e decide por passo) · Aceite por comando? sim (`pnpm --filter @adatechnology/game-physics-jolt test:cost`) · `sonnet`.
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
Fase 4 → sonnet (T4.5 → haiku) · Fase 5 → sonnet (T5.3 🧠 → opus) · Fase 6 → sonnet (T6.1 🧠 → opus; T6.16, T6.19, T6.20 → haiku) ·
Fase 7 → sonnet · Fase 8 → haiku (T8.1–T8.3) e sonnet (T8.4–T8.6) · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes sem GPU dos pacotes tocados + lint dos arquivos + kit-audit --check + commit isolado, com
evidência (comando, números, data, máquina) em specs/008-motor-fisico-jolt/evidence.md. Nunca afrouxar tolerância, tirar teste ou
desligar regra para passar.
Pare e pergunte ao dono antes de: B6 reprovado na T1.3 (mediana dos p99 > 4 ms ou algum > 5 ms); T2.1 se release/casa-a-pa-2026-11-13
ainda não estiver na origin/main; sala reprovada na T3.8; qualquer push, PR, merge ou deploy; qualquer decisão nova que mude C1–C10.
```
