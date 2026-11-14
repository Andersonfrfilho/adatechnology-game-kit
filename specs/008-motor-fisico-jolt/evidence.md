# Evidência — Spec 008, Jolt como motor físico do kit

Máquina de todas as medidas abaixo, salvo nota: Intel Core Ultra 9 275HX (24 núcleos), Arch Linux, Node 20, worktree
`adatechnology-game-kit-wt/engine-jolt` (branch `spike/engine-jolt`) nas fases 0 e 1.

## T1.1 — Desenho do atrito por corpo (2026-11-13)

- Documento: `design/atrito-por-corpo.md`.
- Revisão: `architect` (opus), veredito **APPROVE WITH CHANGES**. Mudanças obrigatórias aplicadas no documento e na T1.2:
  1. teste do coeficiente efetivo que distingue as regras (3 m/s, 3 cm de diferença);
  2. texto corrigido: a lata rolando só lê `sticking` em chão plano (o pé fica no eixo Y do mundo);
  3. correção do sensor robusta a corpo removido (`touch(−1)` só desconta par contado);
  4. ordem no laço: `Step` → `updateFriction` → `roll` → `breakJoints`;
  5. `brokenJoints` limpo uma vez por chamada de `step`;
  6. `accumulator` salvo no estado;
  7. teste de parceiro removido.
  Sugestão O1 adotada: dinâmico escorregando sobre fixos de um só material segura `μd₁·μd₂/μs₂` (mistura exata com o fixo).
- Achados levados ao dono:
  - o número 0,42 m (esperado 0,47) do `tasks.md`/C5 comportamento 4 não bate com a física de μ 0,4 a 25° (0,295 m); o teste do adaptador usa o
    valor analítico;
  - teto de giro do Jolt (47 rad/s) faz lata e cápsula escorregarem acima de 1,65 m/s e 0,24 m/s; liberar o teto leva a granada do B2 a
    7,65 s (limite 5). Desfeito; decisão para a T4.3 (desenho §8.1).

## T1.2 — Atrito por corpo no adaptador (2026-11-13)

Feito na sessão principal (opus) e não por `executor` sonnet: as correções saíram da revisão da T1.1 e mexem nos mesmos arquivos.

- Código: `game-physics-jolt/src/friction.ts` (`touch` só desconta par contado; `coefficientOf` com a regra O1; `BodyEntry.friction`),
  `contacts.ts` (sensor fora de `touches`/`partners`), `world.ts` (`updateFriction` por passo fixo, ordem do laço, `brokenJoints` por chamada,
  `accumulator` público), `joints.ts`, `state.ts` (coeficiente e `accumulator` no estado salvo).
- `pnpm --filter @adatechnology/game-physics-jolt typecheck`: sem erros.
- `pnpm --filter @adatechnology/game-physics-jolt test`: **29/29** (11 arquivos; antes 22/22). Novos em `friction.test.ts`: freio a 3 m/s igual a
  μ 0,4 (± 3 mm) e 3 cm longe de 0,447; volta a `sticking`; cilindro rola 0,349 m em 0,5 s (esperado 0,346); prancha em dois apoios `sliding`;
  sensor não é tocado (giro igual com e sem sensor); sensor e parceiro removidos; `step(1/60)` = 2 × `step(1/120)` bit a bit.
  Os três novos de sensor, passo fixo e coeficiente falharam antes da correção (vermelho conferido).
- `pnpm --filter @adatechnology/game-destruction-three test`: **11 falham / 386 passam / 1 pulado**, o mesmo conjunto de 11 do fim da rodada Q4
  (`q4/dt3-final.log`), nenhum novo.
- `vitest run tests/slope-friction.test.ts` (aceite da T1.2): **3/5 no Jolt** (falham "a 25° madeira escorrega e aço segura" e "lata deitada
  rola numa rampa suave": a caixa de madeira anda 1,8 cm, limite > 10 cm; a lata 3,2 cm, limite > 20 cm), **5/5 com `PIECE_SOLVER=own`**. As duas
  falham igual antes desta task. As duas usam uma tábua que é peça dormindo como rampa; a causa não foi isolada aqui: fica para a T3.5 (C5,
  testes com apoio desenhado).
- `pnpm exec eslint packages/game-physics-jolt/src packages/game-physics-jolt/tests/friction.test.ts`: sem problemas.
- `node tools/kit-audit/audit.mjs --check`: 0 novos fora do SDK dono, 11 pendentes conhecidos.

## T1.3 — B6, B5, B1 e bug 2 de novo, depois da T1.2 (2026-11-13)

Medido por `executor` (sonnet) sobre `2b346bcc`, com a bacia refeita na sessão principal. Carga de 1 minuto entre 1,29 e 2,54 em todas as
rodadas (sempre < 3). Saídas brutas em `scratchpad/t13/` da sessão.

| Item | Comando | Resultado | Aceite |
|---|---|---|---|
| **B6** cascata de 500, aquecido | `vitest run tests/cascade-tail.test.ts -t "case 5b"` ×9 (3 rodadas aquecidas por invocação, 27 valores) | p99 aquecido por invocação: 3,22 / 3,00 / 3,01 / 3,62 / 2,94 / 3,22 / 2,98 / 3,05 / 3,11 ms; **mediana 3,05 ms**, **pior 3,87 ms**; quadro de despertar **5,02–7,39 ms**. Frio: despertar 13,9–18,8 ms, p99 5,2–6,6 (um 8,9) | **PASSA** (mediana ≤ 4, nenhum > 5, despertar ≤ 10) |
| B6 antes (Q4) | — | despertar 5,07–7,38 ms, p99 2,93–4,64 (mediana 3,38) | — |
| **B5** bench 160+40, `ms/renderer.update` | `BENCH=1 ... bench-pieces.test.ts`, alternando `PIECE_SOLVER=own`, ×3 | próprio: 0,716/1,017/1,908; 0,619/0,857/1,529; 0,616/0,840/1,529 (mediana/p90/p99). Jolt: 0,758/1,121/3,014; 0,759/1,084/1,578; 0,720/1,015/1,978. **Razão da mediana 1,06× / 1,23× / 1,17× (mediana 1,17×)**; razão do p99 1,58× / 1,03× / 1,29× (mediana 1,29×) | transitório do C7 (≤ 1,25× na mediana): **passa**, com margem pequena no par 2 |
| B5 antes (Q4) | — | mediana 0,91×, p99 1,50× | — |
| **B1** bacia | `BOWL_SEEDS=16 BOWL_FROM={1,17,33,49} BOWL_DT={0,05;1/60} JOLT_ITERATIONS=20 ... bowl-energy.test.ts`, 8 processos | **128/128**; `fellThrough` 0; pior C1 −0,023 (nenhuma energia criada); pior C2 0,029 m; pior C3 0,015 m; sono mais lento 0,5 s; centro mais fundo 3,8 cm acima do chão | **PASSA** |
| **Bug 2** lata em pé na rampa de 10° | `vitest run tests/rolling.test.ts` | "upright on a ramp gentler than its grip … it stays" **passa** (antes 2,14 cm contra limite de 2 cm; o teste não imprime o valor). 6 falhas do arquivo seguem as mesmas do conjunto de 11 (rolar na rampa, garrafa cônica, latas se batendo, cinquenta latas) | — (vai à T3.2 só se voltar a falhar) |

Notas:
- **B5 piorou em relação à Q4** (0,91× → 1,17× na mediana). Causa provável, não isolada: o `updateFriction` agora roda por passo fixo, duas
  vezes por `renderer.update` (1/60 sobre passo de 1/120). O transitório ainda passa; se a fase 3 o empurrar acima de 1,25×, a primeira coisa a
  medir é esse custo.
- A bacia num processo só (`BOWL_SEEDS=64`) passa 128/128, mas o vitest sai com código 1 por `Timeout calling "onTaskUpdate"` (o teste prende
  o laço de eventos por ~80 s). Em 8 processos de 16 sementes, como no gate 0 e na Q4, sai limpo. A T3.4 (régua única) deve trazer a divisão
  para dentro do teste.
- B6 com frente de 150 m/s: p99 6,02–6,96 ms nas 9 (dominado pelo passo do despertar). Fora do aceite do dono, que fala da cascata sem frente;
  registrado para a decisão em AMD.

## T1.4 — Registro de decisão de arquitetura (2026-11-13)

- Documento: `design/arquitetura.md`.
- Revisão: `architect` (opus), **APPROVE WITH CHANGES**, 11 mudanças obrigatórias, todas aplicadas:
  1. dois modos (um sistema e laço do jogo) testados; C5 e áudio nos dois; C8 e sala em modo laço;
  2. `createPhysicsLoop` recusa segundo laço por mundo; costuras recebem `SeamWorld` sem `step`/`dispose`/`saveState`/`restoreState`;
  3. `dt` limitado no laço (`maxDt` 0,1 s);
  4. o laço é dono do acumulador: `beforeStep(h)` por passo fixo (cinemáticos e personagem), `world.clearEvents()` por quadro;
  5. fases recebem `PhysicsFrame` (`time`, `steps`, `alpha`);
  6. `tag` −1 de verdade (hoje 0 e `uint32` cru), na T2.2;
  7. escopo de `saveState`: mesmos corpos na mesma ordem; mais `ignored`, `rollers`, `stepCount`, mapas em ordem de chave;
  8. `physics` explícito (`PhysicsLoop | SeamWorld | 'own'`), sem cair calado no solver próprio; helper de teste único; `setup-physics.ts` em
     `game-floorplan-three`;
  9. linhas de contato podem citar corpo removido (`has(id)`);
  10. contrato ganha agora `jointAngles`, `wheelContacts`, junta `slider`, `KIT_WORLD` completo, `KIT_RAGDOLL_SOLVER`;
  11. `dropped` contado depois do filtro de velocidade.
  Sugestões registradas como decisões das tasks donas (§11 do documento): corpo do personagem (T4.1), saída do sensor de corpo removido (T7.3),
  `QueryFilter.exclude`, chão sólido em um ou dois corpos (T3.1).

## Fim da fase 1 (2026-11-13)

- `pnpm -r typecheck`: saída 0, sem erros.
- `node tools/kit-audit/audit.mjs --check`: 0 novos fora do SDK dono, 11 pendentes conhecidos.

## T2.1 — Branch de produção (2026-11-13)

Máquina: Intel Core Ultra 9 275HX. Worktree `adatechnology-game-kit-wt/motor-fisico-jolt`, branch `feat/motor-fisico-jolt` do `origin/main`
(`8e29943a`). **Decisão do dono (2026-11-13):** não esperar `release/casa-a-pa-2026-11-13`; base na `origin/main` agora, rebase depois.

- Trazido do spike (`74774f11..spike/engine-jolt`): `game-physics`, `game-physics-jolt` (com testes), `game-destruction/src/{hosted-solids,index,types,world}.ts`,
  `game-destruction-three` (`engine-*.ts`, `oriented-boxes.ts`, `pieces.ts`, `piece-contacts.ts`, `renderer.ts`, `internal.ts`, `visual.ts`,
  `package.json`, `vitest.config.ts`, `tests/**`), `examples/test-room/build.mjs`, `pnpm-lock.yaml` e esta pasta da spec.
- Deixado de fora: nada de físico; o diff do spike fora dessa lista não existe (o `git diff --stat` de `packages examples` só mostra esses arquivos).
- **Pré-requisito achado:** o código do spike em `pieces.ts`/`piece-contacts.ts` parte de três commits da release que não estão na `origin/main`
  (`84f5ed55`, `a32fa25e`, `74774f11`: separar peças-caixa pelas caixas reais e peça levantada gira pelo contato). O `git apply -3` conflitou sem
  eles; foram cherry-picked antes do commit do seam (mesmo patch: o rebase sobre a release os descarta). Os outros 68 commits da release (inclusive
  testes deles) ficaram de fora, por isso a contagem de testes do d3 é menor que a do spike.
- **D3 (única mudança de comportamento):** `tests/setup-physics.ts` só instala o gancho Jolt com `PIECE_SOLVER=jolt`; a sala só sobe o Jolt com
  `?solver=jolt`. Consequência: suítes que só fazem sentido com o motor (`bowl-energy`, `engine-hosted`, `engine-sweep`, `fitted-pieces`) e
  `seam-allocations` ganharam `skipIf(PIECE_SOLVER !== 'jolt')`; os padrões de `bench-pieces`/`bowl-energy` (rótulo) passaram a `own`.

| Gate | Resultado |
|---|---|
| `pnpm build` | passa (inclui `node examples/test-room/build.mjs`: 1 ocorrência de `solver=jolt` no HTML) |
| `pnpm -r typecheck` | 0 erros |
| `game-physics test` | sem testes (contrato só de tipos) |
| `game-physics-jolt test` | 11 arquivos, **29/29** |
| `game-destruction test` | 57 arquivos, **507/507** (igual à `origin/main`) |
| `game-destruction-three test` na `origin/main` + commits 1–3 (linha de base) | 37 arquivos, 321/321 |
| `game-destruction-three test`, solver próprio (padrão) | 43 passam, 6 pulados; **343 passam, 0 falham**, 47 pulados |
| `PIECE_SOLVER=jolt game-destruction-three test` | **11 falham / 378 passam / 1 pulado** (spike: 11/386/1; 8 testes a menos = testes da release fora). Mesmos nomes: pieces-stack perna solta, rolling ×6, settled-debris ×2, slope-friction ×2 |
| `eslint` nos arquivos alterados | 0 erros (3 avisos `max-lines` em `pieces.ts`/`renderer.ts`, `world.ts`; `build.mjs` ignorado pela config) |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos |

Testes de navegador/GPU não rodados.

## T2.2 (parte A)

Data 2026-11-13, máquina Intel Core Ultra 9 275HX. Escopo: `game-physics` (contrato) e `game-physics-jolt` (adaptador) e os testes dos dois. As costuras
(`game-destruction-three`, sala de teste) são a parte B; nenhum call site precisou mudar para compilar.

- Contrato: `penetration` obrigatório; `saveState`/`restoreState`, `has`, `jointAngles`, `wheelContacts`, `fixedStep`, `clearEvents`, `stepFixed`;
  `ContactBuffer.dropped`; junta `slider`; `KIT_WORLD`, `KIT_RAGDOLL_SOLVER`; `PhysicsLoop`/`PhysicsPhase`/`PhysicsFrame`/`PhaseOrder`/`SeamWorld` e
  `createPhysicsLoop` (`game-physics/src/loop.ts`, sem Jolt). "(spike)" removido dos cabeçalhos dos dois pacotes.
- Eventos (item 9): `step(dt)` continua limpando no começo (quem tem um sistema só não muda). O laço usa `stepFixed(h)` (um passo, sem acumulador, sem
  limpar) e `clearEvents()` uma vez por quadro. Ambos são do `PhysicsWorld`, e o `SeamWorld` omite `step`, `stepFixed`, `clearEvents`, `dispose`,
  `saveState` e `restoreState` (o desenho T1.4 omitia só quatro: as duas novas também são só do laço). O laço precisa do passo: `PhysicsWorld.fixedStep`.
- Estado salvo: acrescenta `ignored`, `rollers`, `stepCount`; todos os mapas e conjuntos em ordem de chave.
- `tag`: achado, além do desenhado em T1.4: no Jolt 1.1.1 um composto devolve o `mUserData` da forma interna, não o do `AddShape`; o `tag` do spike nunca
  voltava (sempre 0). Agora a forma interna de cada filho leva o `tag` (ou -1) e toda forma simples leva `0xffffffff`; leitura com `| 0` em consultas e contatos.
- `dropped` conta depois do filtro de velocidade; o teto de linhas passou a ser checado só aí.
- Slider: o limite estoura 1,5 cm a 5 m/s antes de assentar no limite (solver com slop); o teste aceita 3 cm de transiente e confere o repouso em 0,4 m.

| Gate | Resultado |
|---|---|
| `pnpm --filter @adatechnology/game-physics typecheck` | 0 erros |
| `pnpm --filter @adatechnology/game-physics-jolt typecheck` | 0 erros |
| `pnpm --filter @adatechnology/game-physics-jolt test` | 13 arquivos, **43/43** (eram 29; +3 de estado salvo, +4 de contrato, +1 slider, +6 de laço) |
| `pnpm -r typecheck` | 0 erros |
| `game-destruction-three test`, solver próprio | **343 passam, 0 falham**, 47 pulados (igual) |
| `PIECE_SOLVER=jolt game-destruction-three test` | **11 falham / 378 passam / 1 pulado** (igual: os mesmos 11 conhecidos) |
| `pnpm check:packages` | ok (64 pacotes) |
| `eslint` nos arquivos alterados | 0 erros, 0 avisos |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos |

Testes de navegador/GPU não rodados. T2.2 não está marcada como feita: falta a parte B.
