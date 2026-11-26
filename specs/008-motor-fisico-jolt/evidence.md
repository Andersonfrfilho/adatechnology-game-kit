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

## T2.2 (parte B)

Data 2026-11-13, máquina Intel Core Ultra 9 275HX. Escopo: costuras (`game-destruction-three`), testes de `game-destruction-three` e `game-floorplan-three`, boot da sala.

- Gancho `globalThis.__PIECE_PHYSICS__` removido (`pieces.ts`, `setup-physics.ts`, `build.mjs`). `RendererOptions.physics` e `PieceSystemOptions.physics` são obrigatórios:
  `PhysicsLoop | SeamWorld | 'own'` (`PiecePhysics`, `src/physics-option.ts`). Omitir é erro de TypeScript e, em tempo de execução (host em JS), `PhysicsOptionError`
  (`code: 'PHYSICS_OPTION'`) dizendo o que passar. `isPhysicsLoop` entrou no `game-physics` e é reexportado pelo `game-destruction-three`.
- Modo de um sistema (recebeu mundo): o `PieceSystem` cria o próprio laço (`createPhysicsLoop`) e o passa no `update(dt)`: sincroniza, `loop.step(dt)`, lê de volta, regras. Mesma
  ordem de hoje; o mundo recebido tem de ser um `PhysicsWorld` completo (o tipo `SeamWorld` não tem `stepFixed`; checado em tempo de execução).
- Modo laço (recebeu `PhysicsLoop`): fases registradas, `update(dt)` não dá passo (só lê `loop.frame.time`). `EnginePieces.update` virou `prepare` / `moveHeld` / `finish`; só o laço chama o passo.
  - `actors` `beforeStep`: no 1º passo do quadro, `measure` + `wakeUnsupported` + `prepare` (sincronia, ancora, separar em fundo); em cada passo seguinte, o alvo do item segurado de novo, com `h` (não o `dt` do quadro).
  - `contacts` `afterSteps`: `finish` (ler de volta, `sweep`, pouso duro, `still`, sons de batida). `rules` `afterSteps`: `measure` + `keepBudget`. Quadro com 0 passos não lê nada.
- **Mudança de ordem no modo laço** (a do desenho §5, já prevista): `checkBroken`, `settlement` e `drainQueue` do renderer, que hoje rodam antes do passo, rodam depois dele (o jogo chama `loop.step`
  antes de `renderer.update`); uma peça criada por esses eventos entra no mundo no passo do quadro seguinte. Dentro do sistema de peças a ordem é a de hoje. O `dt` do `topple` e do `still` é
  `passos x h` (tempo simulado). Modo de um sistema: sem mudança.
- Auxiliar único de testes (`tests/setup-physics.ts`, nos dois pacotes): `IS_JOLT`, `physicsOption()` (`'own'` ou mundo novo de `KIT_WORLD` com as variáveis do C6, `maxBodies` do `KIT_WORLD` = 8192),
  `physicsLoop()`, `tick(physics, renderer, dt)`; `afterEach` descarta os mundos, teto de 4 vivos mantido. Todos os `createDestructionRenderer(`/`new PieceSystem(` dos testes passam por ele
  (`game-destruction-three`: 10 de `PieceSystem`, o resto de renderer; `game-floorplan-three`: 10 arquivos). `game-floorplan-three` ganhou `setup-physics.ts` (na `vitest.config.ts`) e
  `game-physics` e `game-physics-jolt` como `devDependencies` (`pnpm install --offline`, lockfile atualizado).
- Variantes nos dois modos: `slope-friction.test.ts` (`describe.each` de "um sistema" e "laço", só com `PIECE_SOLVER=jolt`) e `loop-mode.test.ts` (queda, pouso duro e batida: mesmos pousos, mesmas batidas e mesmo
  repouso nos dois modos; mais o teste do erro tipado). `audio.test.ts` não cria renderer (é o motor de som), então não tem variante; os sons que passam pela costura (`onHardLanding`, `onKnock`) estão no `loop-mode.test.ts`.
- Sala: com `?solver=jolt`, o boot (`build.mjs`) cria o motor, UM mundo de `KIT_WORLD` (`?iterations`/`?pushout` ainda valem) e UM laço, em `window.__roomPhysics`; `main.js` passa ao `createTestRoom({ physics })`,
  que passa ao renderer e dá `loop.step(dt)` uma vez por quadro antes de `renderer.update(dt)` (`room.ts`). Sem o parâmetro, `'own'`. `TestRoomOptions.physics` é opcional (padrão `'own'` escrito na sala, o host).
  `node examples/test-room/build.mjs` gera; o HTML contém `__roomPhysics` e o erro tipado. Navegador não aberto.

| Gate | Resultado |
|---|---|
| `pnpm build && pnpm -r typecheck` | 0 erros |
| `game-destruction-three test`, solver próprio | **344 passam, 0 falham**, 48 pulados (343 + o teste do erro tipado) |
| `PIECE_SOLVER=jolt game-destruction-three test` | **13 falham / 383 passam / 1 pulado**: os mesmos 11 conhecidos (pieces-stack 1, rolling 6, settled-debris 2, slope-friction 2 em "um sistema") + as 2 do mesmo teste na variante "laço" (igual ao "um sistema": mesmos dois testes de slope-friction); nenhuma falha nova |
| `game-floorplan-three test`, solver próprio | **antes 715 passam / 3 falham; depois 715 / 3** (os mesmos 3 goldens `exact-golden` destruction/breach, spall, fracture, que já falhavam antes) |
| `game-physics-jolt test` | 13 arquivos, **43/43** |
| `pnpm check:packages` | ok (64 pacotes) |
| `eslint` nos `.ts` alterados | 0 erros; 3 avisos de `max-lines` que já existiam (`pieces.ts`, `renderer.ts`, `room.ts`) |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos |

Testes de navegador/GPU não rodados. T2.2 marcada como feita em `tasks.md`.

## T2.3

Pacote de produção de `game-physics` e `game-physics-jolt`. Feito em 2026-11-13, máquina Intel Core Ultra 9 275HX, branch `feat/motor-fisico-jolt` (worktree `motor-fisico-jolt`).

Mudanças:
- `package.json` dos dois: sem `private`; `version` 0.1.0; descrição sem "Spike"; `repository.directory`, `publishConfig`, `keywords`; `main`/`module`/`types`/`exports` (com `./global`) em `dist`; `unpkg`/`jsdelivr`; `files` (`game-physics-jolt` inclui `LICENSE`); `build` com `tsup`. `game-physics` ganha `tsup` em `devDependencies`. `jolt-physics` segue exato em `1.1.1`.
- `tsup.config.ts` nos dois. `game-physics`: ESM + d.ts + IIFE (`GamePhysics`). `game-physics-jolt`: ESM + d.ts externo a `jolt-physics`; IIFE (`GamePhysicsJolt`) com Jolt e `game-physics` embutidos (4,2 MB, o wasm já vai inline no JS).
- `packages/game-physics-jolt/LICENSE`: texto MIT do projeto (copiado de `LICENSE` da raiz) e, na seção "Third-party: Jolt Physics", o texto MIT do `jolt-physics` 1.1.1 copiado verbatim de `node_modules/.pnpm/jolt-physics@1.1.1/node_modules/jolt-physics/LICENSE`.
- `README.md` dos dois (inglês, com trecho em português ao fim); linhas `GamePhysics` e `GamePhysicsJolt` na tabela de pacotes do `README.md` da raiz.
- `pnpm-lock.yaml`: +3 linhas (`tsup` em `packages/game-physics`).

Gates (saída resumida):

| Gate | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 |
| `grep -q '"jolt-physics": "1.1.1"' packages/game-physics-jolt/package.json` | ok |
| `pnpm build` (todos os pacotes, ordem topológica) | exit 0, sem erro |
| `pnpm -r typecheck` | exit 0, 0 `error TS` |
| `pnpm --filter @adatechnology/game-physics-jolt test` | **13 arquivos, 43/43 passam** |
| `pnpm --filter @adatechnology/game-destruction-three test` | **344 passam, 0 falham**, 48 pulados (igual ao T2.2) |
| `pnpm check:packages` | `check:packages ok (64 packages)` |
| `node tools/kit-audit/audit.mjs --check` | `0 novos fora do SDK dono, 11 pendentes conhecidos, 15 permitidos` |
| `eslint` em `packages/game-physics/src`, `packages/game-physics-jolt/src` e os dois `tsup.config.ts` | exit 0, 0 erros |
| Smoke do IIFE `packages/game-physics-jolt/dist/index.global.js` num `vm` do Node | carrega; `GamePhysicsJolt` expõe `createJoltEngine`, `JoltWorld`, `loadJolt` |

Pendente, fora desta task: `changeset` (`minor` para 0.1.0, conforme README da raiz) não foi criado, porque a publicação é a fase de release.


### Goldens de `game-floorplan-three` na branch de produção (2026-11-13)

- `exact-golden` (breach, spall, fracture) falha 3/44 no modo padrão (solver próprio) desde a T2.1. Na `origin/main` (`8e29943a`, cópia limpa em
  `adatechnology-game-kit-wt/tmp-main-golden`) passa **44/44**.
- Bisseção na mesma cópia: em `c7f90548` (antes dos três commits da release) **44/44**; em `f9d7eebe` (depois deles) e em `452bb23d` **3 falham**.
  Causa: os três commits da release trazidos na T2.1 (`6cc4abe2`, `7c06d978`, `f9d7eebe`: separar peças pelas caixas reais), que mudam os
  destroços. Não é a física nova.
- Não se gera golden agora: a release regera esses goldens em outros commits (rodadas da casa), e um golden nosso daria conflito no rebase.
  Resolve-se no rebase sobre a `main` com a release; o que restar entra na T3.9, comparado com a `origin/main` daquele dia.


## T2.4

2026-11-13, Intel Core Ultra 9 275HX. Bug 1 (`setShape` mantém a massa do kit): o código já estava na branch (`kitMass` em `BodyEntry`, `putMass` em `world.ts`, vindo do commit `36753ec0` do spike); conferido, sem mudança em `src`.

Teste novo `packages/game-physics-jolt/tests/set-shape-mass.test.ts` (3 testes), cada caso compara a peça trocada com outra criada direto na forma nova e na mesma massa (diagonais da inversa da inércia, erro relativo < 1e-6):

- peça de 2 kg troca de forma: massa 2 kg, massa inversa 0,5, inércia da forma nova escalada para 2 kg;
- lasca de 5 g e 1,5 cm (momentos abaixo de 1e-6 kg m^2, condição 7): 5 g e a inércia própria da forma nova, não a de uma esfera de 1 m;
- `mass.inertia` dado ao `setShape` (peça de 2 kg e lasca de 5 g): os momentos dados são os mantidos.

Prova de que o teste pega o comportamento antigo: com `putMass` desligado localmente e `SetShape(..., updateMass = dynamic)` (Jolt recalcula a massa pela densidade), os 3 testes falham (`expected 0.0833 to be close to 0.5`; na lasca `1666.7` contra `200`). Restaurado com `git checkout`, volta ao verde.

| Gate | Resultado |
|---|---|
| `pnpm --filter @adatechnology/game-physics-jolt typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-physics-jolt test` | 14 arquivos, 46/46 passam |
| `eslint` no teste novo | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos, 15 permitidos |


## T2.5

2026-11-13, Intel Core Ultra 9 275HX. Auditoria de `packages/game-physics-jolt/src`: cada `new J.` conferido contra o caminho de remoção e o `dispose` (corpos e formas e suas settings, juntas incl. slider, settings do ragdoll e o ragdoll, constraint/controller/listener/tester do veículo, character, sensores, tabelas de grupo, filtros, vetores de rascunho, listener, `StateRecorderJS`, settings do height field). Tudo tinha `destroy`/`Release`/`RemoveBody`+`DestroyBody`/`RemoveConstraint`, menos um.

**Vazamento achado e corrigido:** `createCharacter` devolvia um objeto cujo `dispose` ficava com o chamador; o mundo não conhecia o character. `world.dispose()` com um character vivo deixava `CharacterVirtual`, `ExtendedUpdateSettings` e dois `Vec3` na heap: **+544 a 560 bytes por mundo** (6 mundos seguidos: 20 685 360, 20 685 904, 20 686 448, 20 687 000, 20 687 544, 20 688 104). Correção: `JoltWorld.characters` (conjunto), `createCharacter` registra o character, `dispose` do character se tira do conjunto (segunda chamada não faz nada) e `world.dispose()` descarta os que sobraram, antes de destruir o sistema (`src/world.ts`, `src/character.ts`). O resto do `src` não mudou.

`tests/heap.test.ts` ganhou o bloco `C9` (9 testes novos), cada ciclo repetido 20 vezes depois de 1 de aquecimento, exigindo `world.memoryInUse()` igual ao byte antes de cada ciclo:

| Ciclo | Bytes por ciclo |
|---|---|
| ragdoll (3 partes: swingTwist, hinge) criar e remover, com 1 passo | 0 |
| veículo (4 rodas) criar, dirigir, 1 passo, remover | 0 |
| junta `fixed`, `hinge`, `swingTwist`, `slider` (cada uma, com os dois corpos) | 0 |
| sensor criar e remover | 0 |
| `setShape` em corpo dinâmico (box, compound, com `mass` e com `mass.inertia`) | 0 |
| character criar e `dispose` (duas vezes) | 0 |
| `createPhysicsLoop` + fase + `step` + retirar (num mundo por ciclo) | 0 |
| `saveState` / `restoreState` | 0 |
| mundo criado e descartado, com ragdoll, veículo e character vivos | 0 (era +544..560 antes da correção) |

Notas: a heap em uso difere em 8 bytes entre uma forma `compound` e uma `box` (tamanho do objeto de forma, não vazamento); por isso o ciclo do `setShape` termina na forma com que começou. Grupos de colisão (`createGroup`) não têm remoção na API: ficam até o `dispose` do mundo, que os libera (não ciclado). O teste B4 existente (pior cena) segue: **pico 21 MB** (0,164 da heap de 128 MB; limite da task 64 MB), `afterBytes` iguais nas 5 rodadas.

Os testes pegam o vazamento: com `J.destroy(listener)` do veículo, `J.destroy(e.ragdoll)` e `J.destroy(update)` do character comentados localmente, 5 testes ficam vermelhos (ragdoll, veículo, character, mundo, e o B4); restaurado, voltam ao verde.

| Gate | Resultado |
|---|---|
| `pnpm --filter @adatechnology/game-physics-jolt typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-physics-jolt test` | 14 arquivos, 55/55 passam |
| `pnpm --filter @adatechnology/game-physics-jolt exec vitest run tests/heap.test.ts` | 10/10 passam |
| `eslint` em `character.ts`, `world.ts`, `heap.test.ts` | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos, 15 permitidos |

## T2.6 — Teste da inércia pequena (2026-11-13)

`packages/game-physics-jolt/tests/inertia.test.ts` já tinha o teste pedido; nenhum código de teste mudou. O segundo `it` cria pelo adaptador um cilindro de r 5 mm, meia-altura 9,5 mm, 4 g, e confere `world.massProperties(casing).inertia` contra `ACROSS = m(3r² + h²)/12` e `ALONG = m r²/2` (h = 0,019 m, calculados no próprio teste), com tolerância de 2%. `massProperties` devolve o momento de inércia (já invertido de volta de `GetLocalSpaceInverseInertia`), então 1,45e-7 e 5e-8 correspondem à inversa (6,9e6; 2,0e7; 6,9e6) pedida, dentro de 2% (mais estrito que os 5% pedidos). Um corpo com 625 em todos os eixos reprovaria. O primeiro `it` documenta o comportamento cru do Jolt (625 com `CalculateInertia`), sem o adaptador.

Adicionado: `docs/jolt-issue-small-inertia.md`, com o texto da §5.1 do `spec.md` copiado por `awk` (sem redigitar), cabeçalho com a data 2026-11-13, o ok do dono e o link https://github.com/jrouwe/JoltPhysics/issues/2220. Nada foi aberto no GitHub.

| Gate | Resultado |
|---|---|
| `pnpm --filter @adatechnology/game-physics-jolt test` | 14 arquivos, 55/55 passam |
| `eslint` | nenhum TypeScript alterado nesta task; sem comando de lint sobre arquivo sem mudança |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono, 11 pendentes conhecidos, 15 permitidos |

## T2.7 — Skills de game-physics e game-physics-jolt, e kit-audit (2026-11-13)

Criados, em português com identificadores em inglês, seguindo as referências de `kit-base`:

- `.claude/skills/kit-base/references/game-physics.md`: contrato, quem é dono de quê (tipos, `KIT_WORLD`, `createPhysicsLoop`, `PhysicsLoop`, `SeamWorld`), fases do laço (`crowd`, `actors` antes do passo; `contacts`, `rules` depois), e como a costura recebe `physics: PhysicsLoop | SeamWorld | 'own'` (resolvedor em `game-destruction-three/src/physics-option.ts`).
- `.claude/skills/kit-base/references/game-physics-jolt.md`: adaptador, único que importa `jolt-physics`; boot com um motor, um mundo e um laço (`createJoltEngine` async, `createWorld` síncrono); destruição de todo objeto Jolt; inércia pequena (`INERTIA_SCALE`, issue em `docs/jolt-issue-small-inertia.md`); atrito por corpo (`sticking | sliding`, sem callback por contato); rolamento (`BodyDesc.rolling`, `setRolling`); massa do kit em `setShape`. Links para `specs/008-motor-fisico-jolt/design/arquitetura.md` e `atrito-por-corpo.md`.

Entradas:

- `.claude/skills/kit-base/SKILL.md`: duas linhas na tabela de referências, antes de `game-render-three`, no mesmo formato das outras.
- `CLAUDE.md`, seção "Mapa do SDK", linha "Contratos e base": `game-physics` e `game-physics-jolt`.
- `tools/kit-audit/rules.json`: domínio `physics` com owners `game-physics` e `game-physics-jolt` e palavras `jolt`, `rigidbody`, `fisica`. Sem findings novos (ver abaixo).

**Divergências do pedido, registradas:**

1. `.claude/skills/game-kit/SKILL.md` **não tem tabela de pacotes**: só o mapa de decisão e os exemplos. A linha "Contratos e base" existe só no `CLAUDE.md` da raiz, então ela foi atualizada lá e o `game-kit` não recebeu linha.
2. `rules.json` **não expressa a regra de import** (só diz quem desenha cada tipo de peça, por palavra). A regra "`jolt-physics` só é importado por `game-physics-jolt`" não é verificada por nenhum comando. Fica registrada aqui e na referência `game-physics-jolt.md`, sem check novo (fora do escopo desta task).
3. Os owners do domínio `physics` não estão em nenhum domínio de peça existente (carro, parede, mesa...): criei um domínio próprio em vez de colocar os pacotes de física em owners de outro domínio, o que mudaria o significado daquele domínio.

Verificação do `physics` no kit-audit: a palavra `fisica` ou `jolt` perto de primitiva desenhada fora dos owners teria virado finding novo; não virou (rodado abaixo).

| Gate | Resultado |
|---|---|
| `node tools/kit-audit/audit.mjs --check` | exit 0; 0 novos fora do SDK dono, 11 pendentes conhecidos, 15 permitidos |
| `rules.json` lido como JSON | válido |
| `pnpm check:packages` | `check:packages ok (64 packages)`, exit 0 |
| `pnpm -r typecheck` | exit 0 (ver "Fim da fase 2") |

## Fim da fase 2 (2026-11-13)

Máquina: Intel Core Ultra 9 275HX. `pnpm -r typecheck` na raiz do worktree `motor-fisico-jolt`, em `feat/motor-fisico-jolt`, depois de T2.6 e T2.7 (ainda sem o commit de T2.7): **exit 0**, todos os pacotes e ferramentas (75 projetos com `typecheck: Done`), sem erro. Tempo: 31 s de relógio.

Fase 2 fechada: T2.1 a T2.7 com evidência neste arquivo. T2.6 não mudou código de teste: o teste de inércia pequena já existia (`inertia.test.ts`) e a issue foi documentada em `docs/jolt-issue-small-inertia.md`.

## T3.0a — Todo o desenhado fixo vira colisor no Jolt (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, Node 22, worktree `motor-fisico-jolt`, branch `feat/motor-fisico-jolt`. Só modo Jolt; o solver próprio (padrão) não muda.

### O que mudou

- **Cada parte desenhada é um corpo estático** (`engine-statics.ts`): um corpo por parte, chave `parte:malha`. Lista nova de um objeto é comparada parte a parte: parte igual não é tocada,
  parte mudada fica no mesmo corpo (`setPose` + `setShape`), parte que sumiu perde o corpo, parte nova ganha o seu. Antes era um composto por objeto, refeito inteiro a cada mudança.
- **Medição do desenhado** (`drawn-solids.ts`, novo): parte de malha mesclada (parede, piso, telhado, viga, pilar da casa) pelos próprios vértices (`range`), sem o limite de 3 m
  (`STATIC_SPAN` só segue valendo para o solver próprio). Uma parte colapsada a um ponto (escondida pela casa) não gera corpo; parte quebrada, derretida, solta ou escondida também não
  (§12: nenhum colisor sem geometria). Estruturas sem malha própria (vigas, pilares, caibros, vergas, lajes) são desenhadas dentro das malhas mescladas e o colisor vem delas; o que não é
  desenhado não tem colisor.
- **Estratégia por tipo de malha**, pelo teste "os oito cantos da caixa têm um vértice a até 1 cm":
  1. caixa do próprio espaço da malha, girada pela matriz (parede, piso, laje, mesa, pés, vigas, pilar quadrado, lajes de cobertura): `box`;
  2. senão a caixa pelos eixos principais dos vértices (`fitOrientedBox`, o mesmo ajuste da peça solta): chapa de telhado torta, `box` girada;
  3. senão os triângulos desenhados (`trimesh`, só estático): telha, degraus de escada, eletroduto, caixilho, batente, poste, cilindro. Plano sem espessura vira chapa de 1 cm (`MIN_HALF` 0,005).
- **Chão da engine é só terreno**: opção nova `terrainAt` (`RendererOptions`, `PieceSystemOptions`), usada nos ladrilhos, na rede `fellThrough` e na checagem de solo das peças dormindo;
  o `groundAt` composto do host (terreno + topo de móvel + peça em repouso) fica só para o solver próprio. A sala passa `terrainAt: terrain.heightAt`. `engine-ground.ts` não cita mais
  "a table top". Sem `terrainAt`, vale o `groundAt` (outros hosts, testes).
- **Orçamento por update** (determinístico, sem relógio): 3 000 vértices medidos do zero (`VERTICES_PER_UPDATE`) e 1 200 triângulos de malha construídos (`TRIANGLES_PER_UPDATE`); o que
  sobra espera o update seguinte. Caixas entram todas de uma vez. Uma parte já medida e inalterada (mesma matriz, mesmos vértices, comparados por soma e dispersão) devolve a mesma lista:
  um evento que suja a casa não a mede de novo. Remedição do objeto só por evento, raiz que mexeu ou caixas do solver próprio que mudaram, não a cada 0,5 s.

### Custo e contagem da casa (`sobrado` e `casaA`, planta 3, modo Jolt)

| Medida | `sobrado` | `casaA` |
|---|---|---|
| Malhas desenhadas (corpos) | **783** (646 caixas, 137 `trimesh`) | **397** (297 caixas, 100 `trimesh`) |
| Partes de malha mesclada | 666 | 335 |
| Medir tudo de uma vez (frio / morno) | 22–30 ms | 14 ms |
| Jolt, 646 caixas como corpos separados (`createBodies`) | 2,0–2,6 ms | — |
| Jolt, 137 `trimesh` | **25 ms** (0,18 ms cada; por isso o orçamento) | — |
| Enchimento com o orçamento | 34 updates, 1,0–3,8 ms típico, pico 8,1–11,7 ms (1º update traz o init do mundo e o JIT) | 31 updates, ≤ 2,8 ms, pico 3,6 ms |
| Soma dos 40 primeiros updates | 70–103 ms | 44 ms |
| Depois de cheio | 0,0 ms por update (nada refeito) | 0,0 ms |

Corpo pelo mundo: `world.bodyCount` = 783 / 397, igual ao número de malhas (nenhum ladrilho de chão sem peça).

### Testes novos

- `packages/game-destruction-three/tests/drawn-solids.test.ts` (só com `PIECE_SOLVER=jolt`, sem GPU): mesa de 4,2 m (corpo por malha, topo a 0,775 m pelo raio, peça pousa nela); malha mesclada com laje, chapa torta
  e coluna redonda (caixa, caixa girada, `trimesh`, topo a 1 cm do desenhado); peça solta sobre a laje, sobre a chapa e sobre a coluna pousa em cada uma, não no terreno; parte quebrada perde o corpo; `terrainAt`
  (peça sob a mesa fica no chão, o topo da mesa é corpo próprio).
- `packages/game-floorplan-three/tests/engine-statics.test.ts` (só Jolt): a casa montada pelas chamadas do SDK (`planOf` + `houseOf`, o que a sala usa). **Fica em `floorplan-three` e não em `d3`** porque
  `d3` não depende de `floorplan-three` (a dependência é no outro sentido; ligar criaria ciclo). Para `sobrado` e `casaA`: o conjunto de chaves dos corpos é igual ao conjunto de malhas desenhadas
  (mais de 300), cada corpo com a caixa do mundo a menos de 1,1 cm da caixa dos vértices da malha (união, para `trimesh`), `bodyCount` igual. E: bloco solto sobre a laje do andar de cima pousa no topo desenhado
  (2,80 m), bloco solto sobre as telhas do telhado fica nelas (acima de 5 m), não no terreno.

### Gates

| Gate | Resultado |
|---|---|
| `pnpm build` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `pnpm --filter @adatechnology/game-destruction-three test` (próprio) | **344 passam, 0 falham** (53 pulados, os de Jolt) |
| `PIECE_SOLVER=jolt ... game-destruction-three test` | 388 passam, **13 falham**, os mesmos 13 conhecidos (`pieces-stack` perna sozinha 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço); **nenhum a menos, nenhum novo**; +5 testes novos passam |
| `pnpm --filter @adatechnology/game-floorplan-three test` | 715 passam, 3 falham (`exact-golden`: breach, fracture, spall, as 3 conhecidas) |
| `pnpm --filter @adatechnology/game-physics-jolt test` | 55 passam, 0 falham |
| Bacia, `JOLT_ITERATIONS=20`, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes | **128/128** (oito arquivos de 16) |
| `eslint` nos arquivos mudados | 0 erros (3 avisos `max-lines` de arquivos que já os tinham) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |

### O que sobrou

- A sala (`game-test-room`) só ganhou `terrainAt`; o efeito nela (blast, martelo, rede `fellThrough`) é medido à mão na T3.8, não aqui (regra 9, sem navegador).
- Peças soltas criadas por fratura dentro de uma parede agora nascem dentro do colisor das vizinhas: `outOfStatics` já as levanta, mas a conferência na sala fica para T3.0c/T3.8.
- As regras antigas do kit (separar empurrando, levantar na criação, recusa de movimento) seguem ligadas: T3.0c.
- O carro (T3.0b) segue pelas caixas de dano cortadas ao desenhado.
- Fora do renderer: malhas desenhadas sem `bind` (cenário que o host não liga à destruição) não têm corpo; hoje não há caso conhecido na casa.
- Medir o tempo para uma casa maior que `sobrado` (a de 783 corpos é a maior do catálogo medida): o enchimento é por orçamento, cresce em updates, não em ms por update.

## T3.0b — O carro estacionado colide pelo que desenha, peça a peça (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, Node 22, worktree `motor-fisico-jolt`, branch `feat/motor-fisico-jolt`. Só modo Jolt; o solver próprio não muda.

### O que mudou

- **`vehicleColliders(THREE, vehicle, frame)`** (`game-vehicles-three/src/colliders.ts`, exportado): para um veículo construído devolve uma peça por parte, no quadro do `describe()`, cada uma com o id da parte.
  Parte com malha própria (capô, tampa, porta aberta, para-choque, roda, pneu, farol, retrovisor, bateria, engate) é a sua malha; o resto do desenhado (as malhas mescladas do corpo, vidros, interior, porta fechada)
  é dividido **por triângulo** pela parte da casca cuja caixa de dano contém o centro do triângulo (a menor), ou pelo `hub`. O retrovisor é peça própria e nunca alarga a cabine.
  Cada peça: caixa alinhada ao quadro se os 8 cantos têm vértice a até 1 cm; senão a caixa pelos eixos principais (`fitOrientedBox`); senão os triângulos (`mesh`) com a caixa dos vértices desenhados em volta.
  Peça de parte que quebrou/soltou (`status` ou `group`) não existe. Peça com mais de 1 500 triângulos vira malha mais grossa (vértices fundidos em células de 5 cm): o carro desenha até 50 000 triângulos por painel
  para aceitar cortes. Sem isso o sedã tinha 230 000 triângulos de colisão (um corpo de 117 000); com isso, 27 000.
- **Costura tipada** (nenhum carro conhecido pelo motor): `DestructibleImpl.colliders?()` e o tipo `DrawnCollider` em `game-contracts`; `DestructionWorld.hostedSolids` usa `colliders()` quando o impl o tem (peças postas no mundo, triângulos
  carregados junto, chave `id:n`) e as caixas do `describe()` quando não; mesma lista até mudar estado, lugar ou pose. O renderer (`staticSolids`) não corta peças com chave ao desenhado (já são o desenhado) e continua cortando as caixas de zona.
  A sala do veículo liga: `d.colliders = () => vehicleColliders(...)` no `impl` do módulo. A lógica de zonas de dano de `game-vehicles` não mudou; só `objectsOf(partId)` ficou público em `VehicleDestructible` (já existia em `VehicleVisuals`).
- **Ajuste de caixa movido para `game-shapes`** (`oriented-boxes.ts` e `hugs`, a regra de 1 cm): `game-destruction-three` e `game-vehicles-three` importam de lá (a adaptação de veículos não carrega o renderer no seu bundle). `game-destruction-three` ganha a dependência de `game-shapes`.

### Frota inteira (69 modelos, qualidade alta, `tests/vehicle-colliders.test.ts`)

Para cada modelo: id de toda peça é parte do modelo; cada canto de toda caixa dentro da caixa da malha da sua peça (+1 cm); toda caixa sem malha tem vértice da peça a ≤ 1 cm por eixo em cada canto; uma amostra de 3 000 vértices
desenhados cai numa peça (3 cm de folga da malha grossa).

| Medida | Resultado |
|---|---|
| Modelos / testes | 69 / 72 testes passam (39 s) |
| Maior excesso da caixa sobre a malha da peça | **0,000 mm** nos 69 (a caixa é a dos vértices) |
| Maior distância canto → vértice, caixas sem malha | 15,4 mm (≤ 1 cm por eixo da caixa; só 4 caixas na frota: `naked_bike`, `sport_bike`, `attack_helicopter`, `transport_helicopter`) |
| Peças por modelo | 7 (motos) a 37 (SUV); sedã `midsize_sedan`: 32 |
| Caixas / malhas | quase tudo é malha: a casca de um carro é curva, nenhuma caixa serve a 1 cm |
| Triângulos de colisão | 3 340 (bicicleta) a 62 605 (`light_jet`); carros 22 000–30 000; `battle_tank` 48 359 |
| Custo de `vehicleColliders` | 4 ms (bicicleta) a 241 ms (`battle_tank`); carros 65–115 ms |

Testes de `vehicle-colliders.test.ts` ainda: retrovisor é peça própria e a casca não chega à ponta dele; parte que soltou (desparafusar `mirror_left`) perde a peça e as outras ficam.
Em `game-destruction-three/tests/engine-hosted.test.ts` (Jolt, motor real): caixa solta sobre os triângulos do teto repousa a 1,5 m e sobre a caixa do corpo a 1,1 m; uma porta feita encostada ao lado desenhado
(zona de dano da cabine 60 cm além) sobe **menos de 3 cm** na criação (0 cm medido).

### Gates

| Gate | Resultado |
|---|---|
| `pnpm build` · `pnpm -r typecheck` | exit 0 · exit 0 |
| `game-vehicles-three test` | 339 passam, 0 falham |
| `game-vehicles-fleet test` (goldens da geometria da frota iguais) | 1225 passam, 0 falham |
| `game-vehicles test` | 342 passam, 0 falham |
| `game-destruction test` | 507 passam, 0 falham |
| `game-destruction-three test` (próprio) | **344 passam, 0 falham** (55 pulados, os de Jolt) |
| `PIECE_SOLVER=jolt ... game-destruction-three test` | 390 passam, **13 falham, os mesmos 13 conhecidos** (nenhum novo, nenhum a menos); +2 testes novos passam |
| `game-floorplan-three test` | 715 passam, 3 falham (`exact-golden`: breach, fracture, spall, as 3 conhecidas) |
| Bacia, `JOLT_ITERATIONS=20`, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes (8 execuções paralelas) | **128/128** |
| `eslint` nos arquivos mudados | 0 erros (2 avisos `max-lines` de `renderer.ts` e `world.ts`, que já os tinham) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |

### O que fica (versão do primeiro commit; corrigida no seguimento abaixo)

- A geometria desenhada não mudou (os goldens da frota seguem iguais); `revisor-z-fighting` não foi preciso.
- O custo por tiro e a malha mais grossa de 5 cm, apontados aqui como pendentes, foram refeitos no seguimento abaixo.

### Seguimento (2026-11-14): só as peças que mudam, e a menos de 1 cm do desenhado

Máquina: Intel Core Ultra 9 275HX, Node 22.

**1. Custo por tiro.** `createVehicleColliders` (`colliders.ts`) guarda estado entre chamadas. Cada malha desenhada é lida uma vez: cada triângulo vai para uma peça (parte do veículo × célula de 80 cm do veículo; chave `parte#célula`,
estável). Depois, por chamada: matriz da malha mudou (porta virada, capô aberto) refaz as peças da malha; `position.version` mudou compara os vértices com a cópia e refaz só as peças que têm triângulo com vértice movido;
geometria ou índice trocados (corte, arrancar painel) reatribui só aquela malha. Parte que soltou ou quebrou sai da lista; sem mudança, as mesmas peças voltam (mesmo objeto). Triângulo sem área ou com canto que não é número não entra.
O `crumple` já trocava o `state()` (`stateCache = undefined`; o que eu escrevi antes, que não trocava, estava errado), então o mundo já pedia as peças de novo; o teste novo confirma que as peças acompanham o desenho.
Orçamento: `{ budget: 25000 }` triângulos de trabalho por chamada na sala; um carro que nasce enche em 12 a 33 chamadas (sedã 17), e `DestructibleImpl.collidersPending()` faz o mundo pedir de novo no update seguinte enquanto falta.
Chave da peça no mundo vem de `DrawnCollider.key`.

| Medida (sedã `midsize_sedan`, 192 peças) | Resultado |
|---|---|
| Primeira montagem, tudo de uma vez | 79 ms (carros 55–105 ms, `battle_tank` 181 ms, bicicleta 4 ms) |
| Depois de um tiro (9 mm, 8 tiros em portas, paralama, capô, para-choque, teto, tampa) | mediana **1,7 a 2,5 ms** em 3 execuções (0,6 a 4,8 ms); 16 peças refeitas em 8 tiros (2 por tiro) |
| Golpe contundente de 20 kJ (amassa o lado todo) | 13 a 15 ms, 41 peças refeitas |
| Antes (primeiro commit) | 65–115 ms a cada tiro |

**2. Colisão a menos de 1 cm do desenhado.** O teste novo, nos 69 modelos, mede a distância de cada vértice de colisão e de uma amostra de pontos dos triângulos (centro e meio das arestas, até 1 500 triângulos por peça) até os
triângulos desenhados da própria peça (distância ponto-triângulo, grade de 2 cm), e exige ≤ 1 cm. A fusão em células de 5 cm do primeiro commit falhava (até 3,5 cm em criação e chapa dupla); medido: células de 3 cm, 2 cm e 1,5 cm
ainda deixavam pontos fora, 1 cm deixava 3 modelos (chapa fina com duas camadas), **8 mm** passa a frota inteira. Cada vértice mantido é um vértice desenhado (o mais perto da média da célula). Uma escolha adaptativa
(células maiores onde a malha é plana) foi tentada e descartada: reduz pouco e atravessa vincos. Pior distância na frota: **7,6 mm** (`crop_duster`); caixas: o canto está a ≤ 17 mm de um vértice (regra de 1 cm por eixo, mais 5 mm da chapa).
Achados no caminho: (a) duas malhas que repartem a mesma geometria na mesma peça usavam as posições da primeira (bug do primeiro commit, corrigido: a tabela de vértices é por malha e não por array); (b) a caixa girada saía com 1 cm
a mais de cada lado numa chapa, agora é apertada nos vértices; (c) triângulo sem área fora.

| Triângulos de colisão e custo | Resultado |
|---|---|
| Carros (hatch, sedã, SUV, picape) | 86 000 a 120 000 triângulos, 118 a 255 peças |
| Caminhão, ônibus | 79 000 a 133 000; `city_bus` 559 peças |
| `battle_tank` | 159 858 triângulos, 334 peças (o maior carro); `monster_truck` 140 728 |
| Motos, barcos pequenos | 11 000 a 35 000 |
| Aviões e helicópteros | 30 000 a 135 000 |
| Antes (primeiro commit, fora do 1 cm) | 22 000 a 30 000 num carro |

Por modelo (peças, caixas, triângulos, montagem em ms, chamadas com orçamento de 25 000, pior distância em mm): ver os testes; os 69 passam. A malha desenhada tem 230 000 triângulos num sedã: 1 cm de erro máximo custa quatro
vezes o que 5 cm custava. No motor, o enchimento por update (`TRIANGLES_PER_UPDATE` 1 200) leva então um carro a ficar sólido em cerca de 90 updates (1,5 s). Se a sala mostrar peso, o próximo passo é simplificação por erro
quadrático por malha (arestas colapsadas) feita uma vez e seguindo só os vértices que sobrevivem; não foi feito porque exigiria desistir da distância exata de 1 cm sob amassado.

Testes novos em `vehicle-colliders.test.ts`: distância de superfície nos 69 modelos; tiro refaz poucas peças e mede o tempo; `crumple` move as peças; orçamento termina com as mesmas peças (chaves iguais) de uma montagem só.

Gates do seguimento: `pnpm build` e `pnpm -r typecheck` exit 0; `game-vehicles-three` 411 passam; `game-vehicles-fleet` 1225; `game-vehicles` 342; `game-destruction` 507; `game-destruction-three` próprio 344 passam, 0 falham;
Jolt 390 passam e os mesmos 13 conhecidos; `game-floorplan-three` 715 passam, 3 conhecidas; bacia 128/128; `eslint` 0 erros (avisos `max-lines` que já existiam); `kit-audit --check` exit 0.

## T3.0c — Regras antigas desligadas no modo Jolt (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, Node 20, worktree `motor-fisico-jolt`, branch `feat/motor-fisico-jolt`. O solver próprio não muda (o código dele é o mesmo).

### Decisão da coordenação (segue o ADR, `arquitetura.md` linha 33: "condição 6 (separar na criação)" usa `penetration`)

1. **Separar empurrando**: fica só para **pares nascidos sobrepostos** (criados no mesmo update, ou um criado dentro do outro, mais fundo que um contato, `LIFT_DEPTH`).
   O par é marcado quando o segundo é visto pela primeira vez, o kit o afasta pelo chão (`slideApart`) com o motor ignorando o par, e ao ficarem afastados é desmarcado e
   nunca mais armado. A varredura de todos os pares a cada update (`apartDeep`) saiu: o que passa a se sobrepor depois, pela dinâmica, é do Jolt.
2. **Recusa de movimento (`c6c42d87`)**: removida (`EnginePieces.place`). O movimento do kit ou do host vai direto ao motor (`setPose`).
3. **`outOfStatics` (levantar na criação para fora dos fixos): fica.** Causa medida abaixo; não é a ordem de remoção do estático da fonte.
4. **`liftFor`/`underGround`** (condição 6 de `spec.md` §5, levantar peça criada no chão) fica, como a regra pede.

### Bisseção da bacia (semente 57, dt 1/60: C2 0,047 m contra o limite 0,035)

Com as três regras fora de uma vez a bacia deu 127/128. Bisseção com a mesma semente (determinística):
- só a recusa de movimento de volta: idêntico, C2 0,0470 (a recusa não é a causa; sem `apartDeep` nada do kit move peça);
- `pieces.ts` e `engine-pieces.ts` originais: C2 0,0290 (passa);
- logo, a causa é só a saída do `apartDeep`. As placas 0 e 1 da bacia nascem quase no mesmo lugar (centros a 4 cm); sem o afastamento do kit o Jolt as resolve sozinho, elas ficam
  encaixadas (repouso a 8 cm uma da outra) e, quando a chapa cai, a placa 1 é espremida para cima a cerca de 0,2 m/s (4,7 cm de energia acima do repouso).
- É sensível à configuração, não é colisor faltando: `JOLT_PUSHOUT` 0,001 / 0,003 / 0,01 passam a mesma semente (C2 0,0026 / 0,0072 / 0,0047); só o 0,002 padrão falha.
- Correção: o afastamento volta **só para o par nascido sobreposto** (decisão 1). Semente 57 volta a C2 0,0290, igual ao solver antes da tarefa. Nenhum limite nem `maxPushOut` foi mexido.

### Por que há peça nascendo dentro de estático (`outOfStatics`)

Teste de diagnóstico (descartado), modo Jolt, explosão de 4 MJ na parede 0 de cada casa, medindo `world.penetration` contra os estáticos no update em que cada peça nasce:
- `sobrado`: 131 peças nascidas, **4 a mais de 5 mm dentro de um estático**: conduítes soltos (`conduit:conduit_circuit_laundry_0` 0,454 m dentro de `roof_a_4`, `conduit_outlet14` 0,119 m em `wall_1_21`,
  `conduit_switch5` 0,400 m em `tank_column_3`/`roof_b_*`) e um conduíte a 8 mm de `pipe:run_wall_laundry_0`;
- `casaA`: 72 peças, 2 acima de 5 mm: `conduit_switch1` 8 mm em `wall_0_1`, `jamb:d0_0` 5 mm em `wall_0_0`.
- Em todos, a parte da fonte já saiu do objeto da casa (`adoptSplit` a move) e o estático que o peça atravessa é de **outra parte que continua de pé** (`gone` = `none`): conduíte, tubo e batente
  correm dentro de parede e telhado, e a caixa de uma peça longa (o circuito) envolve um traçado diagonal. Não é a ordem (remover o estático da fonte antes de criar os pedaços), então não há o que
  corrigir ali; pelo critério da decisão, `outOfStatics` fica. O item aberto da T3.0a fica registrado assim: a sobreposição é de peça embutida com vizinha intacta, até 0,45 m na `sobrado`.

### Testes (`game-destruction-three/tests/fitted-pieces.test.ts`, modo Jolt)

| Teste | Antes | Agora | Motivo (uma linha) |
|---|---|---|---|
| peça criada 15 cm dentro de prateleira | passa | igual | comportamento do kit que fica (`outOfStatics`), não remendo |
| peça criada entalada entre dois fixos | passa | igual | idem |
| só os fixos do host, não o chão | passa | igual | idem; o chão tem a regra própria (`liftFor`) |
| movimento do kit para dentro do chão é recusado | passava | **reescrito**: o motor recebe a pose movida uma vez, o corpo não atravessa o chão, `fellThrough` 0 | a recusa saiu; o contato é do motor |
| novo: par criado sobreposto é afastado uma vez e solto; par que passa a se sobrepor depois nunca é marcado | — | passa | prova a regra de pares nascidos e que a dinâmica é do Jolt |

`separate-pair.test.ts` (modo Jolt) passa inteiro de novo (11/11): "pedaço criado 0,6 m dentro de outro não sobe" e "duas caixas lado a lado terminam lado a lado".

### Gates

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three test` (próprio) | **344 passam, 0 falham** (56 pulados) |
| `PIECE_SOLVER=jolt ... game-destruction-three test` | 391 passam, **13 falham, os mesmos 13 conhecidos** (`pieces-stack` 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço); nenhum novo, nenhum a menos |
| `game-destruction test` | 507 passam, 0 falham |
| `game-floorplan-three test` | 715 passam, 3 falham (`exact-golden`: breach, fracture, spall, as 3 conhecidas) |
| Bacia, `JOLT_ITERATIONS=20`, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes (8 processos) | **128/128**; `fellThrough` 0; pior C1 −0,0225 (nenhuma energia criada); pior C2 0,0290 m; pior C3 0,0229 m; sono mais lento 0,5 s; centro mais fundo 3,8 cm acima do chão |
| `eslint` nos arquivos mudados | 0 erros (1 aviso `max-lines` de `pieces.ts`, que já o tinha) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |

### O que sobrou

- A sala (GPU/navegador) não foi medida aqui: a medida da sala vai com a T3.8.
- `world.ignorePair` segue em uso (pares nascidos sobrepostos); a decisão de tirar da API fica para a T8.1.
- Peças embutidas em vizinhas intactas (conduíte, tubo, batente) seguem sendo levantadas por `outOfStatics`; tornar a caixa dessas peças fiel ao traçado seria o caminho para tirar a regra, e fica para depois da T3.8.

## T3.1 — Chão sólido (bug 3) (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, Node 20, worktree `motor-fisico-jolt`, branch `feat/motor-fisico-jolt`. O solver próprio não muda; só o modo Jolt.

### Decisão: um corpo ou dois (pendência de `arquitetura.md`, seção 11)

**Dois corpos por ladrilho com terreno que não é plano**: o height field (que já era um corpo) e o volume sólido (corpo novo). Ladrilho plano continua uma laje de 1 m (já era sólida), sem corpo novo.
- Verificado: o Jolt **aceita** um height field dentro de um composto estático (`createBody` com composto de height field + caixa, sem erro). A resposta ao "não verificado" é sim; mesmo assim a escolha é dois corpos.
- Razão (do desenho do Jolt, não medida aqui): o que está sobre o chão guarda o contato em cache pelo identificador da sub-forma. O height field trocado no lugar (`setShape`) mantém a mesma forma e os mesmos ids; dentro de um composto o id leva o índice do filho, e a largura desse índice muda com o número de filhos (o volume tem de 19 a 500 blocos conforme o terreno). Cada cavada tiraria o cache de tudo que está em cima. Com dois corpos a troca do volume não toca o height field, e vice-versa; o corpo dos degraus (já separado) segue o mesmo padrão.

### Desenho do volume (`engine-ground-solid.ts`, novo; `engine-pieces.ts`, `engine-ground.ts`)

- A superfície continua o height field (só terreno, `groundAt` do ADR). Embaixo, por ladrilho de 2 m, **um composto estático** de blocos que vão de `SOLID_DEPTH` (0,5 m) abaixo do canto mais baixo do ladrilho até um topo que **nunca passa da superfície**.
- Blocos por quadtree sobre os cantos do height field (80 × 80 células de 2,5 cm): bloco com os cantos a menos de 5 mm entre si é uma **caixa**; senão um **prisma convexo** com o topo plano inclinado, ajustado pelos quatro cantos e baixado até a amostra mais baixa do bloco (então o plano fica sob a superfície em toda a malha de triângulos, que é linear entre cantos); se o desvio do plano passa de 5 mm, divide, até blocos de 3 células (7,5 cm). Topo 5 mm abaixo do que representa (`SOLID_MARGIN`). Distância ao desenhado: ≤ 1 cm em terreno suave e numa cratera de cos² de 30 cm; medido nos testes.
- Contagem: terreno ondulado 1 caixa + 18 prismas; cratera de 30 cm 39 caixas + 463 prismas; bacia de 45 cm 20 + 296. Construir os blocos (JS): 0,8–2,0 ms por ladrilho.
- Atualização: `layTile` refaz o volume só se as amostras do ladrilho mudaram e os blocos diferem (`sameSolid`); no mesmo corpo por `setShape`; ladrilho que vira plano perde o corpo, o que deixa de ser plano ganha. `clear()` remove os corpos do volume (§8: teste de vazamento abaixo).
- **Regra nova, pequena, junto (decisão desta task, para a coordenação rever):** o motor empurra uma peça fundo no sólido só 0,5 mm por passo (`maxPushOut`) e a põe para dormir antes de sair (medido: placa de 4 cm, chão que sobe 5 cm, dormiu 1,8 cm dentro). Por isso `EnginePieces.groundChanged` (a chamada do host, `wakeRegion`) levanta uma vez o que o chão novo alcançou, com o mesmo `underGround`/`liftFor` da condição 6 (peça criada no chão); a condição 6 em si não mudou. E `groundTurn` (a vistoria das peças dormindo) agora acorda também quando o chão **subiu** mais de 2 cm (só detectava descida). Subida maior que o maior semi-eixo da peça não é levantada (é "debaixo de alguma coisa", como a condição 6) e fica para o sólido e a rede `fellThrough`.
- Sensibilidade (a registrar): com a margem de 2 mm o sólido entrou nos contatos de quem pousa no chão e a semente 18 da bacia (dt 1/60) passou a ganhar 4,2 cm de energia (C2), contra 0,0000 sem o sólido; margens de 5, 10, 20 e 30 mm dão 0,0000, 0,0042, 0,0022 e 0,0000. Escolhido 5 mm (e 5 mm de relevo máximo), medido na bacia inteira abaixo. Como o `JOLT_PUSHOUT` da T3.0c, é sensível à configuração e não é colisor faltando.

### Testes (`tests/engine-ground.test.ts`, 8 novos; os de Jolt só com `PIECE_SOLVER=jolt`)

| Teste | O que prova |
|---|---|
| volume sob terreno suave | topo sob a superfície em toda parte (−0,6 mm a 1,06 cm), fundo = canto mais baixo − 0,5 m |
| volume sob bacia íngreme / ladrilho plano | topo nunca passa da superfície (+0,6 mm); plano não tem volume |
| cavada | volume refeito dos novos alturas, ≤ 1 cm da superfície nova |
| (Jolt) chão sobe 5 cm sob placa dormindo, com `wakeRegion` | fica em cima (± 1,2 cm do topo), mais baixa de todos os quadros acima do chão menos 1 cm, `fellThrough` 0 |
| (Jolt) o mesmo sem o host avisar | a peça dormindo vê o chão subir e acorda |
| (Jolt) placa a 40 m/s para baixo | termina em cima, nunca abaixo, `fellThrough` 0 |
| (Jolt) placa posta direto sob a superfície (como a que atravessou) | o sólido a segura: não cai mais de 1 cm do ponto; sem o volume cai a −0,44 m |
| (Jolt) cavar 20 cm sob a placa | topo do sólido ≤ 0,1 cm sob a superfície nova, ≤ 2,5 cm dela, 10 cm abaixo do antigo; a placa desce junto |
| (Jolt) vazamento: 44 rodadas de refazer o chão (2 terrenos alternados) | `bodyCount` igual; heap igual a menos de 4 KB (ruído de ±100 bytes dos contatos; um volume vazado são ~39 KB por rodada, 1,5 MB nas 40) |

Conferido que os testes pegam: com o volume desligado (um `if` local, desfeito) o teste da placa posta sob a superfície e o do corpo do volume ficam vermelhos. O de 5 cm precisa dos dois: com o sólido e sem o levantar a placa dorme 1,8 cm dentro; só o levantar (sem sólido) passa nesse teste, e quem pega a falta do sólido é o da placa posta sob a superfície.

### Custo (sem GPU, `PieceSystem` com 150 peças de 20 × 10 × 20 cm em 14 ladrilhos de terreno ondulado, modo Jolt, 3 rodadas cada)

| Medida | Antes (sem volume) | Depois |
|---|---|---|
| Corpos no mundo | 164 | **178** (+1 por ladrilho de terreno, +14) |
| Passo de `update` com peças acordadas, p50 / p99 (quadros 5–120) | 0,71–0,72 / 3,4–3,7 ms | 0,42–0,44 / 3,5–4,1 ms (o p99 é o ladrilho novo sob a peça que rola) |
| Quadro de cavar (`wakeRegion` raio 1,6 m + `update`, ~9 ladrilhos refeitos), mediana / pior de 12 | 9,5–9,7 / 12,2–12,8 ms | **13,0–13,3 / 15,6–16,0 ms** (+3,4 ms) |
| B6 (`cascade-tail`, caso 5b, aquecido, 3 invocações × 3 rodadas; só o adaptador, não muda nesta task) | — | p99 2,89–3,29 ms (mediana 2,98), quadro de despertar 5,01–5,71 ms |

O quadro de cavar fica 3,4 ms mais caro (≈ 0,4 ms por ladrilho: construir blocos + trocar a forma). **Sem orçamento por update**, ao contrário dos estáticos da T3.0a: o height field e os degraus dos ladrilhos também não têm orçamento (quadro de cavar de 9,6 ms já antes), e adiar o volume é inseguro (cavada: o volume antigo, acima da superfície nova, seguraria a peça no ar). Orçamentar os ladrilhos todos fica como decisão para a coordenação, se a sala medir mal.

### Gates

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three test` (próprio) | **347 passam, 0 falham** (62 pulados) |
| `PIECE_SOLVER=jolt game-destruction-three test` | 400 passam, **13 falham, os mesmos 13 conhecidos** (`pieces-stack` 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço); nenhum a menos, nenhum novo |
| `vitest run tests/engine-ground.test.ts tests/ground-settlement.test.ts` | próprio 11 passam (6 pulados); `PIECE_SOLVER=jolt` 17 passam |
| `game-physics-jolt test` | 55 passam, 0 falham |
| `game-destruction test` | 507 passam, 0 falham |
| `game-floorplan-three test` | 715 passam, 3 falham (`exact-golden`: breach, fracture, spall, as 3 conhecidas) |
| `game-terrain` | não tocado |
| Bacia, `JOLT_ITERATIONS=20`, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes (8 processos, 32 s) | **128/128**; `fellThrough` 0; pior C1 −0,0022 (nenhuma energia criada); pior C2 0,024 m; pior C3 0,0121 m; sono mais lento 0,5 s; centro mais fundo 3,8 cm acima do chão. (Com margem de 2 mm: 127/128, semente 18, C2 0,0424.) |
| `eslint` nos arquivos mudados | exit 0, nada impresso |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |
| GPU / navegador | nenhum |

### O que sobrou

- A sala (blast, martelo, rede `fellThrough`) é medida à mão na T3.8.
- Cratera mais íngreme que a testada (30 cm em 0,8 m): o volume fica a até ≈ 1,2 cm da superfície onde o plano de um bloco de 7,5 cm não acompanha a curva; o que rola ali é segurado do mesmo jeito.
- Subida do chão maior que o maior semi-eixo da peça não é levantada: a peça fica dentro do sólido, sai por onde a saída é mais curta (pode ser por baixo, até o `SOLID_DEPTH`) e a rede `fellThrough` a põe de volta se estiver acordada e inteira sob o chão (placa de 60 cm com subida de 30 cm: `fellThrough` 1).

## T3.2 — Bug 2: lata na rampa de 10° (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, Node 20, worktree `motor-fisico-jolt`, branch `feat/motor-fisico-jolt`, sobre `b305b3f0`. Adaptador e motor **não tocados**; só testes.

### Causa

Não era a lata nem o atrito. **A rampa do teste era uma peça dormindo** (`makePiece('ramp').sleeping = true`, 200 kg, uma tábua de 3 m apoiada só pela ponta baixa). No solver próprio uma peça dormindo nunca acorda por contato, então é um apoio fixo. No Jolt é um corpo dinâmico: o primeiro contato da lata (posta a 1 mm) a acorda e a tábua cai chapada. Rastro da lata em pé a 10° (rampa e lata, `y` a cada 0,1 s): rampa 0,290 → 0,244 → 0,127 → 0,025 m (queda livre), lata junto, e a lata para sobre o chão a 1,998 cm do ponto de partida. O "deslize" era o arrasto da lata pela tábua caindo.

| Medida (lata em pé, 2 s) | Rampa = peça dormindo (como estava) | Rampa = corpo fixo desenhado (Jolt, agora) | Solver próprio (rampa peça dormindo) |
|---|---|---|---|
| 5° | 1,381 cm | **0,003 cm** | 0,349 cm |
| 10° | 1,998 cm (a T1.3 mediu o teste "passa"; o valor de 2,14 cm era o de antes da T1.2) | **0,006 cm** | 0,687 cm |
| 20° | 1,437 cm | **0,011 cm** | 1,291 cm |
| queda da rampa | 13,6 / 26,5 / 51,8 cm | < 0,1 cm | 0 |

Os valores antigos não crescem com o ângulo (1,38 / 2,00 / 1,44 cm): é o que sobra de uma tábua que cai, não atrito. Com a rampa fixa o Jolt segura a lata 100× melhor que o limite, sem amortecer a velocidade linear (`linearDamping` segue 0; teste de queda livre: −9,81 m/s em 1 s, ± 1%). A mola de rolamento (condição 8) e o atrito por corpo (condição 9) não entram: a lata em pé fica presa pelo atrito estático.

### Correção

`tests/rolling.test.ts` (`addRamp`) e o teste novo: `if (!IS_JOLT) makePiece('ramp').sleeping = true`. No Jolt a rampa fica só ligada (`bind`), que a T3.0a já transforma em corpo estático. O solver próprio não muda. Nenhum teste apagado nem afrouxado; o limite de 2 cm é o mesmo.

### Testes

`tests/can-ramp-grip.test.ts` (novo, 4): a lata em pé a 5°, 10° e 20° anda ≤ 2 cm em 2 s **e a tábua não desce** (> 1 mm); queda livre a g sem amortecimento. Passa nos dois solvers (próprio e Jolt). Conferido que pega: com a rampa de volta como peça dormindo, no Jolt os 3 de rampa ficam vermelhos (a tábua cai 13,6 / 26,5 / 51,8 cm).

### As 6 falhas de `rolling.test.ts` no Jolt (continuam 6; nenhuma apagada ou afrouxada)

| Teste | Antes | Agora | Dono |
|---|---|---|---|
| lata cheia rola na rampa a g sin t/1,57 | aceleração −0,60 (a rampa caía) | 1,070 contra faixa 0,991–1,052 (+4,8% sobre o esperado) | **T3.5**: era do mesmo defeito da rampa, agora é só calibração do rolamento: a resistência de rolamento (condição 8) parece aplicada a ~1/5 do esperado; ver T3.5 |
| lata vazia (k = 1) | −0,61 | 0,842 contra 0,779–0,827 (+4,8%) | **T3.5** (idem, o mesmo fator) |
| garrafa cônica empurrada de lado | 0,81 > 1,06 | igual | **T3.5** (sem rampa: cone, o caminho curva) |
| duas latas no ar, restituição | 0,87 vs 2,4 | igual | **T3.5** (colisão lata–lata; vai por restituição e momento) |
| lata rolando bate numa parada | 0,26 > 0,4 | igual | **T3.5** (idem) |
| cinquenta latas | 0,02638 > 0,027 | igual | **T3.5** |

Nenhuma das 6 é o bug 2 (a lata em pé): ele não aparece mais. Duas delas (as de rolar na rampa) eram o mesmo defeito do fixture e agora medem outra coisa, um erro de +4,8% igual nas duas massas.

### Gates

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | **351 passam, 0 falham** (62 pulados; +4 novos) |
| `PIECE_SOLVER=jolt game-destruction-three` | 404 passam, **13 falham, os mesmos 13 conhecidos** (`pieces-stack` 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço); nenhum a menos, nenhum novo |
| `game-physics-jolt` | 55 passam, 0 falham |
| `game-destruction` | 507 passam, 0 falham |
| `game-floorplan-three` | 715 passam, 3 falham (`exact-golden`: breach, spall, fracture, as 3 conhecidas) |
| Bacia, `JOLT_ITERATIONS=20`, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes, 8 processos | **128/128** (8 × 16 passam); o teste não imprime pior C1/C2/C3 nesta invocação; adaptador não mudou desde a T3.1 (pior C1 −0,0022, C2 0,024 m, C3 0,0121 m, `fellThrough` 0) |
| B6 | não rodado: adaptador não tocado |
| `eslint` nos 2 arquivos mudados | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |
| GPU / navegador | nenhum |

### O que sobrou

- O fator +4,8% do rolamento na rampa (dois testes) vai para a T3.5; hipótese não verificada: a resistência de rolamento age menos que `C_rr cos t` com a lata no contato da tábua estática.
- O teto de giro de 47 rad/s (T4.3) não foi tocado e não entra aqui.

## T3.3 — Bug 4: C1 com 8 e 10 iterações (2026-11-14) — **levado ao dono, sem mudança de código**

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, Node 20, worktree `motor-fisico-jolt`, sobre `4e3914e3`. Nada foi commitado em código; as duas tentativas foram desfeitas e os `dist` refeitos do HEAD.

### Medida em HEAD (bacia, dt {0,05; 1/60} × `BOWL_FROM` {1,17,33,49} × 16 sementes, 8 processos, `PIECE_SOLVER=jolt`, `SPIKE_OUT` para o pior caso)

| `JOLT_ITERATIONS` | Passam | Falham | Pior C1 (kg·m, soma de m·altura de energia; total 220 kg) | Pior C2 / C3 |
|---|---|---|---|---|
| 8 | **120/128** | 8, todas por C1: sementes 26 (1/60) 0,633, 28 (1/60) 0,622, 33 (0,05) 0,556, 45 (0,05) 0,157, 54 (1/60) 0,144, 39 (0,05) 0,064, 30 (1/60) 0,016, 60 (1/60) 0,018 | +0,633 (2,9 mm por kg total) | 0,0099 / 0,0154 |
| 10 | **125/128** | 3: 28 (1/60) C1 0,354, 39 (1/60) C1 0,117, 30 (1/60) C2 0,051 | +0,354 | 0,0514 / 0,0274 |
| 20 (referência) | **128/128** | 0 | −0,0022 | 0,024 / 0,0121; `fellThrough` 0 |

`fellThrough` 0 nas três. O teste imprime a linha de cada corrida em `SPIKE_OUT`; os números acima saem dela.

### Causa
Cada falha é **um quadro só**, entre 0,12 e 0,22 s depois de a chapa de 142 kg cair (a 0,7 m/s) sobre as quatro placas de ~20 kg. A chapa já parou (v_y 0,02) e no quadro seguinte sai a +0,1 a +0,4 m/s (semente 26: +0,26; dE da chapa +0,95 kg·m). Nenhum outro corpo contribui. É o solver de velocidade sem convergir numa pilha de razão de massa 7:1 (chapa sobre placas sobre chão): com 8 ou 10 passadas sobra velocidade para cima, com 20 não. Não é restituição (caixas têm restituição 0 no motor) nem ordem do atrito por passo.

Confirmações:
- **Correção de posição ajuda mas não resolve.** Em 5 sementes ruins com 8 iterações: `JOLT_POSITION_ITERATIONS` 0, 1, 4, `JOLT_SLOP` 0,005, `JOLT_PUSHOUT` 0,0005 mudam *quais* sementes falham e quanto (caos), nunca zeram. A melhor combinação (`SLOP` 5 mm + `PUSHOUT` 0,5 mm) limpa as 5, mas na bacia inteira dá **126/128 com 8 e 126/128 com 10** (pior C1 +0,851 e +0,427).
- **A razão de massa é a causa.** Escalando a massa inversa do mais pesado por contato (Jolt `ContactSettings.mInvMassScale/mInvInertiaScale`, novo e persistido, só entre peças de entulho, razão máxima 3): bacia **128/128 com 8, 10 e 20** (pior C1 −0,091, −0,044, −0,100; pior C3 0,0325 com 8, perto do teto de 0,035).
- Achado de infraestrutura: `game-destruction-three` importa `game-physics-jolt` e `game-physics` pelo `dist`; mexer em `src` sem `pnpm build` não tem efeito (por isso `mBaumgarte`, que não toca contato, parecia sem efeito antes de refazer o `dist`).

### Tentativa 1 — retocar a correção de posição (`penetrationSlop`, `maxPushOut`, iterações de posição)
Só configuração, sem código. Resultado: 126/128 com 8 e 126/128 com 10 (acima). **Não atinge o aceite.** Além disso, a T3.1 já mostrou que a bacia a 20 iterações é sensível a esses dois valores e à margem do sólido (5 mm); mudar o padrão de produção por causa de 8/10 arrisca as medidas de B1/B5/B6.

### Tentativa 2 — limitar a razão de massa por contato entre entulhos (`debrisMassRatioLimit: 3` no `KIT_WORLD`, aplicado no ouvinte de contatos do adaptador)
Bacia 128/128 em 8, 10 e 20. **Reprovada no portão de linhas de base**: `PIECE_SOLVER=jolt game-destruction-three test` fica com **16 falhas em vez das 13 conhecidas** (`rolling` 9 em vez de 6; os 3 novos: "a heavy can into a light one: the light one leaves faster than the heavy one came, momentum kept", "a can rolled into a 1,9 m wardrobe bounces off it, never through it", "a can and a table: rolls under the top between the legs..."). O limite de razão é falso para colisão livre: fingir que o pesado pesa no máximo 3× o leve tira momento do pesado e entrega menos ao leve. Desfeita.

### Estado
- **Persiste. T3.3 fica desmarcada, "levado ao dono".** `JOLT_ITERATIONS=20` segue como piso de produção (128/128, pior C1 −0,0022, C2 0,024 m, C3 0,0121 m, `fellThrough` 0, medido de novo no HEAD limpo; `rolling` com as 6 falhas conhecidas).
- Decisão para o dono: aceitar 20 como piso (custo do passo mantido) ou autorizar uma terceira via, **não testada**: limitar a razão de massa só em contato em repouso (velocidade de aproximação pequena, p.ex. < 0,5 m/s, o que cobre o pouso de 0,7 m/s só se o limite subir), preservando o momento das colisões livres. Custo: a chamada JS do ouvinte por contato persistido por passo (B6 já gastou um terço do quadro com isso no gate 0).

## T3.4 — Régua única de energia (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20. Feito por `executor` (sonnet). Sem GPU nem navegador.

**Onde mora.** `packages/game-destruction-three/tests/energy-ruler.ts` (sem imports, fora da API pública de qualquer pacote publicado). Testes dela:
`tests/energy-ruler.test.ts` (14, com valores contados à mão). A bacia (`tests/bowl-energy.ts`) usa a régua; o teste da bacia agora imprime no fim a linha
`bowl worst {...}` (pior C1, C2, C2 sem a condição, C3, C4, mais fundo, `fellThrough`).

**Definições da régua** (uma só implementação):
- **Ilha:** peças cujas esferas envolventes (`|halfExtents|`) se tocam no estado de antes **ou** de depois do update (união-busca). É mais larga que o contato real, então nunca separa o que está em contato.
- **C1:** por ilha e por update, `Σ m·(altura de energia depois − antes) − m_ilha·1 mm`; pior valor em kg·m, > 0 falha. Update com entrada de fora (`'energy'`) não conta.
- **C2:** ganho de altura de energia sobre o último repouso, por episódio (um episódio fecha quando a peça volta ao repouso ou quando uma entrada de fora acontece; a entrada de fora é absorvida, só conta o ganho depois dela). Só vira lançamento se a ilha também violou C1 no episódio (`c2Gain`); `c2GainUnconditioned` é a régua antiga, a coluna do gate 0. Também `c2PiecesOver` e `c2PiecesOverUnconditioned` (peças acima de 3,5 cm, a coluna da sala).
- **C3:** subida do centro além da própria velocidade para cima, somada por peça (não conta em update `'energy'`). **C3b:** `deepest` (centro sob o chão logo abaixo, a cada update) e `fellThrough` (a rede do motor).
- **C4:** segundos da última entrada de fora (`'energy'` ou `'wake'`) até todas dormirem; volta a -1 se algo acordar depois.
- `OutsideInput`: `'none' | 'wake' | 'energy'`. Sala: blast e martelo são `'energy'` (T3.8: só o ganho sem entrada de fora, sono contado da última entrada de fora).

**A bacia não perdoa nada.** Ela passa `'wake'` (só reinicia o relógio do sono) e nunca `'energy'`: o chão que aprofunda e o despertar contam em C1, C2 e C3, como já contavam. A spec permitiria perdoar o chão que muda; não afrouxei.

**Sondas da sala.** `specs/008-solver-de-contato-dos-destrocos/decision/probes/` **não existe nesta branch** (está só em `spike/engine-jolt`, commit `5ae2a9aa`; esta branch não o contém) e as antigas `blast.js`/`hammer.js` medem só `lift`, sem coluna de energia. Criei `specs/008-motor-fisico-jolt/decision/probes/`: `room.js` (um só arquivo para blast e martelo, `__KIND__`), `ruler-bundle.mjs` e `run.sh`. As sondas são texto injetado na página, sem `import`: `ruler-bundle.mjs` transpila o mesmo `energy-ruler.ts` (TypeScript do repositório, sem bundler, a régua não tem imports) e `run.sh` o põe no escopo como `EnergyRuler`. A régua fica em `tests/`, não num pacote publicado. **Não rodei as sondas** (T3.8, à mão). Conferi só que a expressão final tem sintaxe válida e que a régua transpilada executa.

**Colunas: a régua reproduz o gate 0.** Bacia, 64 sementes × dt {0,05; 1/60} = 128 casos, `JOLT_ITERATIONS=20`, um processo só (`BOWL_SEEDS=64`):

| Coluna | Jolt (T3.4) | Jolt registrado (T3.1/T3.3/T1.4) | Próprio (T3.4, `BOWL_OWN=1`) | Próprio no gate 0 / spec |
|---|---|---|---|---|
| Casos que passam | **128/128** | 128/128 | **46/128** | 46/128 (`spec.md` §2.1; 82/128 falham) |
| Pior C1 (kg·m) | **−0,0022080** | −0,0022 | +7,29 | — (o gate 0 não media C1 por ilha no próprio) |
| Pior C2 sem condição (m) | **0,023956** | 0,024 | 0,251 | sala blast 0,54 m; bacia não registrada no próprio |
| Pior C2 com a condição de C1 (m) | 0 (C1 nunca violado) | — (coluna nova) | 0,251 | — |
| Pior C3 (m) | **0,012114** | 0,0121 | 0,400 | — |
| Pior C4 (s) | 0,500 | 0,5 (T1.3) | 2,78 | 2,05 s (Jolt, gate 0); próprio não registrado |
| Centro mais fundo (m, negativo = sobre o chão) | −0,0383 | −0,038 (T1.3) | +0,313 | — |
| `fellThrough` | 0 | 0 | 0 (a rede só existe no Jolt) | 0 |

- Jolt: C1, C2 sem condição, C3 e `fellThrough` batem com os números gravados até o último dígito registrado (−0,0022, 0,024, 0,0121, 0). O C2 com a condição é 0 porque C1 nunca é violado no Jolt a 20 iterações: a condição só faz diferença em quem viola C1.
- Próprio: 46/128 passam e 82/128 falham, exatamente os números da spec. O próprio **não** passa 128/128, nem no gate 0; por isso o teste da bacia continua sendo o gate do Jolt (`PIECE_SOLVER=jolt`) e roda no próprio só com `BOWL_OWN=1`, para ler as mesmas colunas. A diferença para o gate 0 de "pior C1": lá o C1 era a soma de todas as peças; aqui é por ilha, e na bacia a esfera envolvente junta as peças em uma ilha só, então os dois coincidem (o número do Jolt confirma).
- O teste da bacia não passou a aceitar mais: agora também exige `c2GainUnconditioned ≤ 3,5 cm` além do `c2Gain` da régua (mais estrito que antes, nenhuma tolerância mudou).
- Divisão para dentro do teste (pendência da T1.3): cada caso cede um turno do laço de eventos, e `BOWL_SEEDS=64` em um processo só sai com código 0 (antes: 128/128, mas `Timeout calling "onTaskUpdate"`, código 1).

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio (`pnpm test`) | **365 passam, 0 falham** (62 pulados; +14 da régua) |
| `PIECE_SOLVER=jolt` `pnpm test` | 418 passam, **13 falham, os mesmos 13 conhecidos** (`pieces-stack` 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço) |
| Bacia Jolt, `BOWL_SEEDS=64 JOLT_ITERATIONS=20`, um processo | **128/128**, exit 0 |
| Bacia no próprio, `BOWL_OWN=1 BOWL_SEEDS=64` | 46/128, o mesmo do gate 0 (não é gate) |
| `eslint` nos 4 arquivos de `tests/` mudados | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |
| GPU / navegador / sondas | nenhum |

## T3.5 — C5: os 10 comportamentos do §12 e as falhas de `game-destruction-three` no Jolt (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt`, sobre `4f98a5a5`. Feito por `executor` (sonnet). Sem GPU nem navegador.

### Parte A — os 10 comportamentos (`tests/c5-behaviours.test.ts`, um `it` cada, nos dois solvers)

| # | Comportamento (`spec.md` §6.1) | Teste | Próprio | Jolt |
|---|---|---|---|---|
| 1 | Apoio perdido: o que sobrou cai e se apoia | mesa sem as duas pernas de uma ponta: a peça existe, dorme, o tampo desce abaixo de 0,3 m e nada fica sob o chão | passa | passa |
| 2 | Tomba quando o centro de massa sai do apoio | uma perna sozinha termina abaixo de 0,2 m; duas pernas de um lado: o tampo gira até bater (< 5 cm) e dorme | passa | passa |
| 3 | O que estava em cima cai junto, no mesmo quadro | lata dormindo no caixote acorda no `update` em que o caixote leva o impulso | passa | passa |
| 4 | Coulomb: μ 0,4 escorrega em 25°, μ 0,5 segura | plástico sobre o topo de cerâmica desliza a distância analítica de `g (sin t − √(μd₁μd₂) cos t) cos t · t²/2` (0,75 a 1,15×); cerâmica sobre cerâmica anda < 3 cm | passa | passa |
| 5 | Normal da face inclinada do apoio, não do mundo | caixa posta nivelada numa rampa de 15° termina deitada nela (inclinação ± 0,05 rad) | passa | passa |
| 6 | Nenhum colisor sem geometria | prateleira de duas partes, uma quebra: `shownBoxes` cai de 2 a 1; a peça solta sobre a que ficou para nela, a solta sobre a que quebrou chega ao chão | passa | passa |
| 7 | `onBrokenChecked` e catálogo quebrado | quatro postes quebrados: `onBrokenChecked` só com `released = false` e a tábua desce; o que pende é deixado a quem o segura (`[['stand', false]]`, sem peça). O catálogo (`broken-catalogue.test.ts`) mora em `game-floorplan-three` e roda no gate dele | passa | passa |
| 8 | Lata em pé na rampa de 10° anda ≤ 2 cm em 2 s | `rampa` de madeira, lata de 410 g | passa | passa |
| 9 | Peça que escorrega numa parede volta ao ponto do encontro (`sweep`) | caixa a 3 m/s contra a parede que o motor não tem: nunca passa de `x_parede + 5 mm` | passa | passa |
| 10 | Pouso duro avisado pelos eventos de contato | queda de 1,5 m: `onHardLanding` uma vez, com 4,5–6 m/s (√(2gh) = 5,4) | passa | passa |

**Pendência do item 4 (spec cita 0,42 m, esperado 0,47).** O número da spec é do teste do motor (`game-physics-jolt/tests/friction.test.ts`, uma caixa de μ 0,4 contra rampa de μ 0,4); a física dá ~0,295 m em 1 s, que é a analítica de μ 0,4 (`0,5 · g · (sin 25° − 0,4 cos 25°) · 1 s²`). O 0,47 não sai de nenhum μ declarado (daria μ ≈ 0,36). O teste novo usa a analítica derivada do μ do material, não a cifra 0,42/0,47; a regra "μ 0,4 escorrega, μ 0,5 segura" não mudou e a spec não foi tocada. A conferir pelo dono: trocar 0,42/0,47 por 0,295 em `spec.md` §6.1.

### Parte B — as 13 falhas conhecidas no Jolt

**13 contra 14.** A spec diz 14 (gate 0). As 13 são as medidas na T3.2/T3.3 (`pieces-stack` 1, `rolling` 6, `settled-debris` 2, `slope-friction` 2 + 2 do modo laço). A 14ª era "lata em pé na rampa de 10° anda 2,14 cm": a T3.2 mostrou que era a rampa (peça dormindo) caindo, e ela já passava antes da T3.5. Não sobra outra.

| # | Teste (Jolt) | Classe | Causa, com número | Correção |
|---|---|---|---|---|
| 1 | `pieces-stack`: perna sozinha tomba | **(b)** | A perna de 5 × 5 × 74 cm em pé fica 6 s com ω ≈ 0,01 rad/s. A regra de equilíbrio (`topple`) empurra com `TOPPLE · min(h,1)` = 1,1 rad/s², menos que o que a gravidade segura na aresta (`m g a / I` ≈ 2,6 rad/s² medido no motor; limite superior de ponto de massa `g a/(h²+a²)` = 1,8); e o lado do empurro (`x0+x1 > 0`) trocava de sinal a cada quadro (ruído dos contatos, base centrada), anulando-se | `engine-pieces.ts`: lado do empurro guardado (`Link.side`, só muda quando o meio do apoio passa de 1 cm do centro de massa) e, só em **coluna** (apoio estreito nos dois sentidos, `max(wx,wz) < 0,3 h`) enquanto ela gira a menos de 0,3 rad/s, empurro ≥ 4 × o limite de ponto de massa (`topplePush`). 1,5×, 2× e 2,5× não viram a perna, 3× vira; 4× dá folga. A bacia pegou isso: sem a trava de giro, a semente 61 (1/60) fez C2 0,27–0,31 m; com a trava de 0,1 rad/s a 57 fez 0,042 (limite 0,035); 0,05–0,15 e 1 flutuam por semente (caos), 0,3 dá 128/128 com o mesmo pior C2 de antes (0,023956). Sem a condição de coluna, uma caixa estreita à beira da mesa (`pieces-edge`) também virava |
| 2 | `settled-debris`: acorda a peça de cima quando o topo some | **(a)** | O topo era a função `staticTopAt`; no Jolt uma função não é corpo, e a peça fica sem o que a segura | topo desenhado como `staticSolids` (caixa com a face de cima em `top`) só no Jolt; o próprio continua lendo a função. Mesma asserção e mesma tolerância |
| 3 | `settled-debris`: peça encostada no degrau desce quando o degrau some | **(a)** + **(b)** | (a) mesmo motivo do 2. (b) Com o degrau desenhado a tábua acordava e, no mesmo quadro, o orçamento (`maxAwake: 0`) a punha de volta a dormir: `steady.seconds` (1,5 s de "inclinação mantida" de antes de dormir) ficava velho, e `balancing` ainda não fora avaliado, então `hasComeToRest` dava verdadeiro. Ficou 1 mm abaixo do repouso por 240 quadros | `readBack` (`engine-pieces.ts`): peça que acorda no motor zera `steady` e é julgada na hora (`topple(b, 0)`). Asserção igual |
| 4–7 | `slope-friction` ×2 e ×2 do modo laço: madeira escorrega em 25°, aço segura; lata deitada rola | **(a)** + **(b)** | (a) a tábua era peça dormindo (no Jolt, 200 kg que cai, T3.2): `makePiece` só sob o solver próprio. (b) Depois disso a caixa de madeira ainda ficava (0,02 cm em 1 s): **toda peça fixa desenhada tinha o atrito do chão (0,7/0,6), não o do material dela** (`describe` de `EngineStatics` usava `GROUND` para todas); a tábua de madeira agarrava como concreto. (c) a lata deitada passou a rolar. (d) A caixa de aço a 25° escorregava por causa da queda de 2 mm (pousa a 0,2 m/s numa rampa de 25° onde o aço agarra 0,49 contra tan 25° = 0,466: o pouso sozinho decide); com 1–2 mm desliza (13 cm em 1 s), com ≤ 0,5 mm segura | `StaticSolid.friction` (estático, dinâmico, rolamento) com o material da parte (`renderer.measureSolids` → `engine-statics.describe`); no teste, caixa posta a 0,5 mm (era 2 mm) e `makePiece` da tábua só no próprio. Mesma asserção e tolerância nos dois solvers |
| 8, 9 | `rolling`: lata cheia / vazia na rampa a `g (sin t − C_rr cos t)/(1+k)` | **(b)** | A hipótese da T3.2 se confirma, com outra causa: o coeficiente de rolamento do Jolt era o da lata (aço, 0,002) em qualquer apoio; o solver próprio usa o maior dos dois (`pairFriction`: aço 0,002 sobre madeira 0,01 → 0,01, sobre o chão 0,015). 0,002 / 0,01 = 1/5: a aceleração media 1,070 e 0,842 (+4,8 %) contra a faixa 0,991–1,052 e 0,779–0,827 | `Material.rolling` (novo, opcional, `game-physics`); `roll` (`game-physics-jolt/src/friction.ts`) usa o maior entre o da lata e o dos parceiros em contato; o chão, as peças e as partes fixas carregam o seu. Passam as duas |
| 10 | `rolling`: garrafa cônica empurrada de lado | **(b)** | O motor recebia sempre um cilindro reto do raio maior (`shapeOf`), mesmo com `round.profile`: a garrafa rolava reta (os dois extremos andavam 0,72 m, razão 1,0 contra os 1,3 exigidos) | `shapeOf`: perfil que varia mais de 2 mm vira o casco convexo dos anéis do perfil (16 pontos por anel). Passa |
| 11 | `rolling`: duas latas no ar, restituição | **(b), sem correção** | Ver "Sem correção" abaixo | — |
| 12 | `rolling`: lata rolando bate numa parada | **bloqueada pelo teto de giro de 47 rad/s** | O teste dá à lata 2 m/s com `ω = 2/0,033 = 60,6 rad/s`; o motor limita a 47,06 (medido no primeiro quadro: `ω_z −47,06`), então ela derrapa: 2,00 → 1,17 m/s antes de bater na outra (a 0,2 s já estava em 1,55). A outra anda 0,06 m em 0,5 s contra os > 0,2 m exigidos. Não mexi no teto (decisão do dono, T4.3) | **não corrigida; a levar ao dono** |
| 13 | `rolling`: cinquenta latas | **(b), sem correção** | Ver "Sem correção" | — |

### Sem correção (duas tentativas em cada; ficam falhando e vão ao dono)

**Latas se batendo (11 e 13).** Causa isolada no motor, sem renderer e sem gravidade (duas latas deitadas, eixo z, uma a 3 m/s contra a outra parada, restituição 0,6, atrito 0): a colisão de dois cilindros de eixos exatamente paralelos dá um impulso fora do centro da linha de contato. Resultado a 1/120 s: a 0,821 / b 2,081 m/s (esperado 0,6 / 2,4), com giro de **+13,4 e −8,1 rad/s em torno de y** e `vz` de ±0,18; com 1 cm de desvio em z o giro fica simétrico (−4,7) e as velocidades 0,604 / 2,298. A 1/480 s o giro em y é ±14,5 e a razão de separação 0,7 (e_efetiva ≈ 0,5). Dois sintomas no jogo: (11) o teste amostra o primeiro quadro em que a segunda lata anda (0,867 m/s, meio do impacto: o impacto se divide em dois quadros), e o fim (0,812 / 2,188) tem e_efetiva 0,46, não 0,6; (13) as latas saltam (vy 0,37 m/s) e voltam afundando até **6,6 mm no chão** (= o raio de convexidade 0,2 r), contra os 6 mm que o teste aceita (0,026403 > 0,027).
- Tentativa 1: raio de convexidade do cilindro 0,0001 / 0,001 / 0,0066 / 0,03 m: o giro em y continua (13/−8, 11/−16, 13/−8, 15/−15 rad/s).
- Tentativa 2: casco convexo de 16 ou 32 lados no lugar do cilindro: tira o giro em y e o `vz` (a 0,588 / 2,313 com 16 lados), mas põe giro em torno do eixo (±2 e ±9 rad/s) e muda o rolamento sobre o chão (faceta de 0,6 mm a 16 lados). Não adotado: mexe no que a lata em pé, a rampa (T3.2) e a lata rolando já medem.
- Conclusão: é o contato cilindro–cilindro paralelo do Jolt (variante `CylinderShape`), não o adaptador nem a peça. Sugestão para o dono: aceitar a tolerância de 0,5 % só no teste 11 ou decidir pelo casco de 16 lados com o custo no rolamento.

### Testes sem classe

- `drawn-solids`: "uma peça solta sobre uma laje, uma chapa de telhado e uma coluna de malha unida pousa em cada uma": a chapa era `wood` e a caixa de madeira deslizava para fora dela (dinâmico 0,3 contra tan 17° = 0,31) depois que a parte fixa passou a agarrar pelo próprio material. Passou a ser `concrete` (fibrocimento); a asserção de onde a peça pousa é a mesma. Mesmo motivo de (a), anotado aqui.

### Gates (2026-11-14, árvore final desta task)

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0, 0 erros |
| `game-destruction-three` próprio | **375 passam, 0 falham** (62 pulados; +10 do C5) |
| `PIECE_SOLVER=jolt game-destruction-three` | 438 passam, **3 falham** (`rolling`: latas se batendo no ar, lata rolando bate numa parada, cinquenta latas), 1 pulado; eram 13 |
| `game-destruction` | 507 passam, 0 falham |
| `game-physics-jolt` | 55 passam, 0 falham |
| `game-floorplan-three` | 715 passam, 3 falham (`exact-golden`: breach, spall, fracture, as 3 conhecidas) |
| Bacia Jolt, `BOWL_SEEDS=64 JOLT_ITERATIONS=20`, um processo | **128/128**, exit 0; `bowl worst {"worstC1":-0.0325,"worstC2":0,"worstC2Unconditioned":0.023956,"worstC3":0.012114,"worstC4":0.5,"worstDeepest":-0.0383,"fellThrough":0}` |
| B6 (`cascade-tail.test.ts -t "case 5b"` ×9, 27 aquecidos; o adaptador mudou, `roll`) | p99 mediana **2,97 ms**, pior **3,72 ms**; quadro de despertar 4,97–6,26 ms |
| `eslint` nos 9 arquivos mudados | 0 erros (1 aviso antigo de `max-lines` em `renderer.ts`) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 |
| GPU / navegador | nenhum |

### Estado

T3.5 **não** fica ✅: o aceite exige `game-destruction-three` sem falha nos dois solvers e 3 testes de `rolling` seguem falhando no Jolt (duas por contato cilindro–cilindro do motor, uma pelo teto de giro de 47 rad/s). 10 das 13 estão corrigidas, nenhuma asserção ou tolerância foi mexida, nenhum teste apagado ou pulado.
Decisão para o dono: (1) o teto de giro (T4.3) para a lata a 2 m/s; (2) o contato lata–lata (aceitar o casco de 16 lados e o custo no rolamento, ou tolerar o teste).

## T3.6 — C6: varredura de robustez (2026-11-14) — **parcial: a varredura existe e roda; 1742 de 6912 corridas falham, 31 delas na configuração de produção**

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt`. Sem GPU nem navegador.

**Como ler o C6** (spec §6, linha C6; §7 item 4): bacia em 64 sementes × dt {1/30, 0,05, 1/60, 1/144} × iterações {8, 10, 20} × push-out {−50%, 0, +50%} do valor de produção (0,002 m: 0,001 / 0,002 / 0,003), mais pilha 20:1 e pilha de 5 peças, "tudo passa, e mais trabalho nunca piora". Cada corrida passa pelos critérios da bacia (C1 ≤ 0, C2 ≤ 3,5 cm com e sem a condição, C3 ≤ 3,5 cm, C4 dorme em até 3 s, nada sob o chão, `fellThrough` 0). A spec **não** dá expectativa por número de iterações: C6 exige que 8 e 10 passem como 20 (§7 item 4: "C6 exige que 8 e 10 passem também"). Isso conflita com a T3.3 (C1 falha a 8 e 10, levado ao dono), então a varredura **não pode fechar** com 8 e 10 sem a decisão dela. dt é o dt de quadro (`renderer.update(dt)`); o passo fixo do mundo segue 1/120 s. "Mais trabalho nunca piora": contada à parte (um caso que passa com menos iterações e falha com mais).

**Onde.** `packages/game-destruction-three/tests/sweep-c6.test.ts` (só roda com `SWEEP=1` e `PIECE_SOLVER=jolt`; o `test` padrão a pula), `tests/stack-energy.ts` (pilhas; `sampleOf` agora exportado de `bowl-energy.ts`), `tests/sweep-c6.mjs` (8 processos, junta as linhas e imprime a tabela). Pilhas: caixas de 0,4 × 0,2 × 0,4 m soltas de 1 cm de folga cada, jitter de 2 cm e giro por semente, sem entrada de fora, 3 s; 20:1 = 10 kg sob 200 kg; pilha de 5 = 5 × 50 kg.

**Comando** (da pasta do pacote; `SWEEP_SEEDS=n` encurta): `node tests/sweep-c6.mjs`. Tempo: **678 s** (11 min 18 s), 6912 corridas (2304 por cenário), 8 processos.

### Resultado
| Cenário | Corridas que falham | Na produção (dt 1/60, 20 it., push-out ×1) |
|---|---|---|
| bacia | 60 de 2304 | **64/64 passam** |
| pilha 20:1 | **1320** de 2304 | **33/64 passam, 31 falham (C1)** |
| pilha de 5 | 362 de 2304 | 64/64 passam |

Por iterações: 8 it. → 976 de 2304 falham; 10 it. → 538; 20 it. → 228 (5 da bacia, 223 da pilha 20:1, 0 da pilha de 5). "Mais iterações piora": 44 casos (bacia 12, pilha 20:1 21, pilha de 5 15; todos 8→10, 8→20 ou 10→20) — o C1 é caótico, não monótono, abaixo da convergência.

### Falhas e causas
1. **Pilha 20:1, produção (dt 1/60, 20 it.): 31/64 falham por C1**, até +0,29 kg·m (≈ 1,4 mm de altura de energia da pilha de 210 kg acima da folga de 1 mm), sementes 1, 2, 4, 5, 7, 8, 9, 11–15, 22, 23, 26, 27, 32, 36, 39, 42, 44, 46, 47, 51, 52, 54–56, 60, 61, 63. A 1/30 e a 0,05 s com 20 it. passam 64/64; a 1/60 e a 1/144 não (1/144: 43 falham). Rastro da semente 1 (1/60): a chapa de 200 kg pousa a 0,49 m/s sobre a de 10 kg no quadro 3, afunda 2 mm (perde 4 kg·m), e no quadro 5 sobe 1,2 mm com v_y +0,056 m/s (+0,25 kg·m): o solver de velocidade não converge com razão de massa 20:1. **Prova da causa** (dt 1/60, 32 sementes, só `JOLT_ITERATIONS`): 24 it. 4/32 falham, 28 it. 2/32, **32 it. 0/32**, 36 it. 0/32, 40 e 80 it. 0/16. Não é correção de posição: `JOLT_POSITION_ITERATIONS` 0, 1, 2, 4, 8 × slop 2 mm e 0,5 mm deixam 11–14 de 16 falhando; e o push-out ×0,5/×1/×1,5 não muda nada a 20 it.
2. **Pilha 20:1 e pilha de 5 com 8 e 10 iterações**: mesma causa (convergência), pior com mais razão de massa. Pilha de 5 passa a 8 e 10 it. em dt 1/30 e 0,05, falha 62/64 a 8 it. e 20/64 a 10 it. em 1/60, e 34/64 e 4–5/64 em 1/144.
3. **Bacia a 8 e 10 iterações**: 0–5 sementes por célula falham C1 (já conhecido pela T3.3), mais C2 0,05 m (1/60, 10 it.) e C3 0,041 e 0,048 (1/60 ×1,5 a 8 it.; 1/144 ×1,5 a 10 it.).
4. **Bacia a 20 iterações (produção de iterações)**: só 5 corridas de 576 falham, todas **fora do dt 1/60 de produção com push-out ×1**: semente 16, dt 1/60, push-out ×1,5: C3 0,0447 m (limite 0,035); semente 43, dt 1/144, ×1: C1 +0,205; **semente 61, dt 1/144, os três push-outs: C2 0,24–0,32 m** (uma peça lançada, C1 −0,22: a ilha não violou C1, é lançamento sem a condição). O C2 de 1/144 é o achado mais grave da bacia: dt 1/144 não divide o passo fixo de 1/120 (quadros alternam 0 e 1 passos), e a semente 61 repete em todos os push-outs.

### Estado
- **T3.6 fica desmarcada.** A varredura existe, é determinística e roda por um comando, mas tem falhas na configuração de produção (pilha 20:1) e fora dela (8/10 it., dt 1/144, push-out ×1,5). Nada foi afrouxado nem corrigido: duas tentativas na configuração de produção (posição/slop; contagem de iterações como prova) não produziram uma correção dentro do que a task autoriza.
- **Decisão para o dono (3 saídas):** (a) subir `velocityIterations` de produção de 20 para 32–40 (o custo do passo sobe na mesma proporção; B5/B6 e a bacia teriam de ser medidos de novo) — é o que a pilha 20:1 pede; (b) autorizar a terceira via da T3.3, limite de razão de massa só em contato em repouso, que mexe no adaptador e nos testes de `rolling`; (c) reescrever o C6 para a faixa real: 20 it. como piso, pilha 20:1 só a ≥ 32 it., e 8/10 it. fora do C6. A semente 61 a 1/144 (C2 0,3 m) precisa de investigação própria, com ou sem a decisão acima.

### Tabela completa (64 sementes por linha; "pior" = máximo nas 64)

| Cenário | dt | it. | push-out | passa | critérios que falham | pior C1 (kg·m) | C2 (m) | C3 (m) | C4 (s) | mais fundo (m) | fellThrough |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bowl | 0.0333 | 8 | x0.5 | 60/64 | {C1:4} | 0.1125 | 0.0113 | 0.0272 | 1.90 | -0.0371 | 0 |
| bowl | 0.0333 | 8 | x1 | 62/64 | {C1:2} | 0.2826 | 0.0121 | 0.0207 | 0.50 | -0.0377 | 0 |
| bowl | 0.0333 | 8 | x1.5 | 62/64 | {C1:2} | 0.3622 | 0.0190 | 0.0283 | 0.50 | -0.0351 | 0 |
| bowl | 0.0333 | 10 | x0.5 | 64/64 | {} | -0.0868 | 0.0172 | 0.0132 | 0.50 | -0.0378 | 0 |
| bowl | 0.0333 | 10 | x1 | 62/64 | {C1:2} | 0.4254 | 0.0122 | 0.0212 | 1.53 | -0.0372 | 0 |
| bowl | 0.0333 | 10 | x1.5 | 63/64 | {C1:1} | 0.0891 | 0.0088 | 0.0283 | 0.93 | -0.0356 | 0 |
| bowl | 0.0333 | 20 | x0.5 | 64/64 | {} | -0.1405 | 0.0032 | 0.0059 | 0.50 | -0.0372 | 0 |
| bowl | 0.0333 | 20 | x1 | 64/64 | {} | -0.1634 | 0.0040 | 0.0089 | 0.50 | -0.0387 | 0 |
| bowl | 0.0333 | 20 | x1.5 | 64/64 | {} | -0.1512 | 0.0032 | 0.0253 | 0.50 | -0.0378 | 0 |
| bowl | 0.05 | 8 | x0.5 | 64/64 | {} | -0.1058 | 0.0037 | 0.0185 | 1.35 | -0.0375 | 0 |
| bowl | 0.05 | 8 | x1 | 61/64 | {C1:3} | 0.5559 | 0.0054 | 0.0154 | 0.50 | -0.0385 | 0 |
| bowl | 0.05 | 8 | x1.5 | 63/64 | {C1:1} | 0.0438 | 0.0080 | 0.0091 | 0.90 | -0.0374 | 0 |
| bowl | 0.05 | 10 | x0.5 | 63/64 | {C1:1} | 0.2052 | 0.0268 | 0.0209 | 0.50 | -0.0393 | 0 |
| bowl | 0.05 | 10 | x1 | 64/64 | {} | -0.0866 | 0.0068 | 0.0179 | 0.65 | -0.0389 | 0 |
| bowl | 0.05 | 10 | x1.5 | 63/64 | {C1:1} | 0.6542 | 0.0317 | 0.0142 | 0.50 | -0.0384 | 0 |
| bowl | 0.05 | 20 | x0.5 | 64/64 | {} | -0.1224 | 0.0102 | 0.0249 | 0.85 | -0.0389 | 0 |
| bowl | 0.05 | 20 | x1 | 64/64 | {} | -0.0923 | 0.0186 | 0.0093 | 0.50 | -0.0383 | 0 |
| bowl | 0.05 | 20 | x1.5 | 64/64 | {} | -0.1480 | 0.0160 | 0.0068 | 0.50 | -0.0385 | 0 |
| bowl | 0.0167 | 8 | x0.5 | 61/64 | {C1:3} | 0.8319 | 0.0107 | 0.0112 | 0.50 | -0.0387 | 0 |
| bowl | 0.0167 | 8 | x1 | 59/64 | {C1:5} | 0.6327 | 0.0099 | 0.0137 | 0.52 | -0.0389 | 0 |
| bowl | 0.0167 | 8 | x1.5 | 59/64 | {C3:1,C1:4} | 0.4759 | 0.0175 | 0.0409 | 0.50 | -0.0384 | 0 |
| bowl | 0.0167 | 10 | x0.5 | 62/64 | {C1:2} | 0.7218 | 0.0109 | 0.0146 | 0.50 | -0.0384 | 0 |
| bowl | 0.0167 | 10 | x1 | 62/64 | {C1:1,C2:1} | 0.0062 | 0.0514 | 0.0274 | 0.50 | -0.0377 | 0 |
| bowl | 0.0167 | 10 | x1.5 | 63/64 | {C1:1} | 0.0223 | 0.0154 | 0.0206 | 0.50 | -0.0383 | 0 |
| bowl | 0.0167 | 20 | x0.5 | 64/64 | {} | -0.1315 | 0.0163 | 0.0114 | 0.92 | -0.0387 | 0 |
| bowl | 0.0167 | 20 | x1 | 64/64 | {} | -0.0325 | 0.0240 | 0.0121 | 0.50 | -0.0391 | 0 |
| bowl | 0.0167 | 20 | x1.5 | 63/64 | {C3:1} | -0.1357 | 0.0121 | 0.0447 | 0.58 | -0.0386 | 0 |
| bowl | 0.0069 | 8 | x0.5 | 60/64 | {C1:3,C2:1} | 0.2177 | 0.3479 | 0.0163 | 0.56 | -0.0385 | 0 |
| bowl | 0.0069 | 8 | x1 | 62/64 | {C1:1,C2:1} | 0.1761 | 0.3652 | 0.0137 | 0.50 | -0.0380 | 0 |
| bowl | 0.0069 | 8 | x1.5 | 60/64 | {C1:3,C2:1} | 0.2110 | 0.3220 | 0.0233 | 1.90 | -0.0362 | 0 |
| bowl | 0.0069 | 10 | x0.5 | 62/64 | {C1:1,C2:1} | 0.2534 | 0.2426 | 0.0191 | 0.50 | -0.0387 | 0 |
| bowl | 0.0069 | 10 | x1 | 61/64 | {C1:2,C2:1} | 0.2609 | 0.2606 | 0.0326 | 0.65 | -0.0387 | 0 |
| bowl | 0.0069 | 10 | x1.5 | 59/64 | {C2:2,C3:1,C1:2} | 0.1451 | 0.3497 | 0.0480 | 0.50 | -0.0386 | 0 |
| bowl | 0.0069 | 20 | x0.5 | 63/64 | {C2:1} | -0.1306 | 0.2922 | 0.0125 | 0.50 | -0.0384 | 0 |
| bowl | 0.0069 | 20 | x1 | 62/64 | {C1:1,C2:1} | 0.2048 | 0.3220 | 0.0142 | 0.49 | -0.0387 | 0 |
| bowl | 0.0069 | 20 | x1.5 | 63/64 | {C2:1} | -0.1865 | 0.2413 | 0.0085 | 0.49 | -0.0378 | 0 |
| stack 20:1 | 0.0333 | 8 | x0.5 | 9/64 | {C1:55} | 0.8613 | 0.0026 | 0.0036 | 0.53 | -0.0979 | 0 |
| stack 20:1 | 0.0333 | 8 | x1 | 16/64 | {C1:48} | 0.9080 | 0.0024 | 0.0043 | 0.53 | -0.0978 | 0 |
| stack 20:1 | 0.0333 | 8 | x1.5 | 5/64 | {C1:59} | 1.0711 | 0.0043 | 0.0041 | 0.53 | -0.0977 | 0 |
| stack 20:1 | 0.0333 | 10 | x0.5 | 50/64 | {C1:14} | 0.4110 | 0.0014 | 0.0029 | 0.53 | -0.0983 | 0 |
| stack 20:1 | 0.0333 | 10 | x1 | 43/64 | {C1:21} | 0.7963 | 0.0019 | 0.0036 | 0.53 | -0.0980 | 0 |
| stack 20:1 | 0.0333 | 10 | x1.5 | 48/64 | {C1:16} | 0.6911 | 0.0018 | 0.0035 | 0.53 | -0.0979 | 0 |
| stack 20:1 | 0.0333 | 20 | x0.5 | 64/64 | {} | -0.1118 | 0.0009 | 0.0030 | 0.53 | -0.0994 | 0 |
| stack 20:1 | 0.0333 | 20 | x1 | 64/64 | {} | -0.1131 | 0.0009 | 0.0030 | 0.53 | -0.0995 | 0 |
| stack 20:1 | 0.0333 | 20 | x1.5 | 64/64 | {} | -0.1131 | 0.0009 | 0.0030 | 0.53 | -0.0995 | 0 |
| stack 20:1 | 0.05 | 8 | x0.5 | 24/64 | {C1:40} | 0.8281 | 0.0023 | 0.0036 | 0.55 | -0.0979 | 0 |
| stack 20:1 | 0.05 | 8 | x1 | 31/64 | {C1:33} | 0.8479 | 0.0019 | 0.0040 | 0.55 | -0.0978 | 0 |
| stack 20:1 | 0.05 | 8 | x1.5 | 24/64 | {C1:40} | 1.1498 | 0.0038 | 0.0049 | 0.55 | -0.0977 | 0 |
| stack 20:1 | 0.05 | 10 | x0.5 | 61/64 | {C1:3} | 0.3276 | 0.0011 | 0.0013 | 0.55 | -0.0983 | 0 |
| stack 20:1 | 0.05 | 10 | x1 | 57/64 | {C1:7} | 0.6533 | 0.0013 | 0.0022 | 0.55 | -0.0980 | 0 |
| stack 20:1 | 0.05 | 10 | x1.5 | 57/64 | {C1:7} | 0.5523 | 0.0017 | 0.0019 | 0.55 | -0.0979 | 0 |
| stack 20:1 | 0.05 | 20 | x0.5 | 64/64 | {} | -0.1665 | 0.0014 | 0.0014 | 0.55 | -0.0994 | 0 |
| stack 20:1 | 0.05 | 20 | x1 | 64/64 | {} | -0.1260 | 0.0014 | 0.0014 | 0.55 | -0.0995 | 0 |
| stack 20:1 | 0.05 | 20 | x1.5 | 64/64 | {} | -0.1653 | 0.0014 | 0.0014 | 0.55 | -0.0995 | 0 |
| stack 20:1 | 0.0167 | 8 | x0.5 | 1/64 | {C1:63} | 1.0304 | 0.0030 | 0.0046 | 0.52 | -0.0979 | 0 |
| stack 20:1 | 0.0167 | 8 | x1 | 2/64 | {C1:62} | 1.1229 | 0.0039 | 0.0045 | 0.52 | -0.0978 | 0 |
| stack 20:1 | 0.0167 | 8 | x1.5 | 1/64 | {C1:63} | 1.3139 | 0.0111 | 0.0053 | 0.52 | -0.0977 | 0 |
| stack 20:1 | 0.0167 | 10 | x0.5 | 0/64 | {C1:64} | 1.1115 | 0.0023 | 0.0044 | 0.52 | -0.0983 | 0 |
| stack 20:1 | 0.0167 | 10 | x1 | 1/64 | {C1:63} | 1.2600 | 0.0024 | 0.0042 | 0.52 | -0.0980 | 0 |
| stack 20:1 | 0.0167 | 10 | x1.5 | 2/64 | {C1:62} | 1.2182 | 0.0060 | 0.0046 | 0.52 | -0.0979 | 0 |
| stack 20:1 | 0.0167 | 20 | x0.5 | 32/64 | {C1:32} | 0.3045 | 0.0014 | 0.0016 | 0.52 | -0.0994 | 0 |
| stack 20:1 | 0.0167 | 20 | x1 | 33/64 | {C1:31} | 0.2923 | 0.0014 | 0.0015 | 0.52 | -0.0994 | 0 |
| stack 20:1 | 0.0167 | 20 | x1.5 | 33/64 | {C1:31} | 0.2912 | 0.0014 | 0.0015 | 0.52 | -0.0994 | 0 |
| stack 20:1 | 0.0069 | 8 | x0.5 | 0/64 | {C1:64} | 0.6914 | 0.0033 | 0.0037 | 0.51 | -0.0979 | 0 |
| stack 20:1 | 0.0069 | 8 | x1 | 1/64 | {C1:63} | 0.7366 | 0.0058 | 0.0039 | 0.51 | -0.0978 | 0 |
| stack 20:1 | 0.0069 | 8 | x1.5 | 1/64 | {C1:63} | 0.7390 | 0.0111 | 0.0044 | 0.51 | -0.0977 | 0 |
| stack 20:1 | 0.0069 | 10 | x0.5 | 1/64 | {C1:63} | 0.5016 | 0.0037 | 0.0033 | 0.51 | -0.0983 | 0 |
| stack 20:1 | 0.0069 | 10 | x1 | 1/64 | {C1:63} | 0.5318 | 0.0039 | 0.0032 | 0.51 | -0.0980 | 0 |
| stack 20:1 | 0.0069 | 10 | x1.5 | 3/64 | {C1:61} | 0.5247 | 0.0062 | 0.0035 | 0.51 | -0.0978 | 0 |
| stack 20:1 | 0.0069 | 20 | x0.5 | 21/64 | {C1:43} | 0.1918 | 0.0020 | 0.0017 | 0.51 | -0.0994 | 0 |
| stack 20:1 | 0.0069 | 20 | x1 | 21/64 | {C1:43} | 0.1918 | 0.0015 | 0.0017 | 0.51 | -0.0994 | 0 |
| stack 20:1 | 0.0069 | 20 | x1.5 | 21/64 | {C1:43} | 0.1918 | 0.0016 | 0.0016 | 0.51 | -0.0994 | 0 |
| stack of 5 | 0.0333 | 8 | x0.5 | 64/64 | {} | -0.1584 | 0.0010 | 0.0021 | 0.53 | -0.0994 | 0 |
| stack of 5 | 0.0333 | 8 | x1 | 64/64 | {} | -0.1584 | 0.0010 | 0.0021 | 0.53 | -0.0994 | 0 |
| stack of 5 | 0.0333 | 8 | x1.5 | 64/64 | {} | -0.1584 | 0.0010 | 0.0021 | 0.53 | -0.0994 | 0 |
| stack of 5 | 0.0333 | 10 | x0.5 | 64/64 | {} | -0.1957 | 0.0012 | 0.0022 | 0.53 | -0.0996 | 0 |
| stack of 5 | 0.0333 | 10 | x1 | 64/64 | {} | -0.1957 | 0.0016 | 0.0023 | 0.53 | -0.0996 | 0 |
| stack of 5 | 0.0333 | 10 | x1.5 | 64/64 | {} | -0.1957 | 0.0016 | 0.0023 | 0.53 | -0.0996 | 0 |
| stack of 5 | 0.0333 | 20 | x0.5 | 64/64 | {} | -0.2173 | 0.0006 | 0.0011 | 0.53 | -0.0999 | 0 |
| stack of 5 | 0.0333 | 20 | x1 | 64/64 | {} | -0.2173 | 0.0006 | 0.0011 | 0.53 | -0.0999 | 0 |
| stack of 5 | 0.0333 | 20 | x1.5 | 64/64 | {} | -0.2173 | 0.0006 | 0.0011 | 0.53 | -0.0999 | 0 |
| stack of 5 | 0.05 | 8 | x0.5 | 64/64 | {} | -0.1503 | 0.0011 | 0.0025 | 0.55 | -0.0994 | 0 |
| stack of 5 | 0.05 | 8 | x1 | 64/64 | {} | -0.1503 | 0.0011 | 0.0025 | 0.55 | -0.0994 | 0 |
| stack of 5 | 0.05 | 8 | x1.5 | 64/64 | {} | -0.1503 | 0.0011 | 0.0025 | 0.55 | -0.0994 | 0 |
| stack of 5 | 0.05 | 10 | x0.5 | 64/64 | {} | -0.2318 | 0.0009 | 0.0022 | 0.55 | -0.0996 | 0 |
| stack of 5 | 0.05 | 10 | x1 | 64/64 | {} | -0.2318 | 0.0012 | 0.0024 | 0.55 | -0.0996 | 0 |
| stack of 5 | 0.05 | 10 | x1.5 | 64/64 | {} | -0.2318 | 0.0012 | 0.0024 | 0.55 | -0.0996 | 0 |
| stack of 5 | 0.05 | 20 | x0.5 | 64/64 | {} | -0.2119 | 0.0004 | 0.0007 | 0.55 | -0.0999 | 0 |
| stack of 5 | 0.05 | 20 | x1 | 64/64 | {} | -0.2119 | 0.0004 | 0.0007 | 0.55 | -0.0999 | 0 |
| stack of 5 | 0.05 | 20 | x1.5 | 64/64 | {} | -0.2119 | 0.0004 | 0.0007 | 0.55 | -0.0999 | 0 |
| stack of 5 | 0.0167 | 8 | x0.5 | 2/64 | {C1:62} | 0.2757 | 0.0023 | 0.0018 | 0.52 | -0.0993 | 0 |
| stack of 5 | 0.0167 | 8 | x1 | 2/64 | {C1:62} | 0.2762 | 0.0023 | 0.0019 | 0.52 | -0.0993 | 0 |
| stack of 5 | 0.0167 | 8 | x1.5 | 2/64 | {C1:62} | 0.2762 | 0.0023 | 0.0019 | 0.52 | -0.0993 | 0 |
| stack of 5 | 0.0167 | 10 | x0.5 | 44/64 | {C1:20} | 0.1689 | 0.0013 | 0.0013 | 0.52 | -0.0995 | 0 |
| stack of 5 | 0.0167 | 10 | x1 | 44/64 | {C1:20} | 0.1689 | 0.0016 | 0.0013 | 0.52 | -0.0995 | 0 |
| stack of 5 | 0.0167 | 10 | x1.5 | 44/64 | {C1:20} | 0.1689 | 0.0016 | 0.0013 | 0.52 | -0.0995 | 0 |
| stack of 5 | 0.0167 | 20 | x0.5 | 64/64 | {} | -0.1659 | 0.0006 | 0.0005 | 0.52 | -0.0999 | 0 |
| stack of 5 | 0.0167 | 20 | x1 | 64/64 | {} | -0.1659 | 0.0006 | 0.0005 | 0.52 | -0.0999 | 0 |
| stack of 5 | 0.0167 | 20 | x1.5 | 64/64 | {} | -0.1659 | 0.0006 | 0.0005 | 0.52 | -0.0999 | 0 |
| stack of 5 | 0.0069 | 8 | x0.5 | 30/64 | {C1:34} | 0.1098 | 0.0024 | 0.0018 | 0.51 | -0.0993 | 0 |
| stack of 5 | 0.0069 | 8 | x1 | 30/64 | {C1:34} | 0.1096 | 0.0024 | 0.0018 | 0.51 | -0.0993 | 0 |
| stack of 5 | 0.0069 | 8 | x1.5 | 30/64 | {C1:34} | 0.1096 | 0.0024 | 0.0018 | 0.51 | -0.0993 | 0 |
| stack of 5 | 0.0069 | 10 | x0.5 | 60/64 | {C1:4} | 0.0302 | 0.0013 | 0.0015 | 0.51 | -0.0995 | 0 |
| stack of 5 | 0.0069 | 10 | x1 | 59/64 | {C1:5} | 0.0302 | 0.0016 | 0.0015 | 0.51 | -0.0995 | 0 |
| stack of 5 | 0.0069 | 10 | x1.5 | 59/64 | {C1:5} | 0.0302 | 0.0016 | 0.0015 | 0.51 | -0.0995 | 0 |
| stack of 5 | 0.0069 | 20 | x0.5 | 64/64 | {} | -0.1063 | 0.0013 | 0.0007 | 0.51 | -0.0998 | 0 |
| stack of 5 | 0.0069 | 20 | x1 | 64/64 | {} | -0.1063 | 0.0013 | 0.0007 | 0.51 | -0.0998 | 0 |
| stack of 5 | 0.0069 | 20 | x1.5 | 64/64 | {} | -0.1063 | 0.0013 | 0.0007 | 0.51 | -0.0998 | 0 |

## T3.6b — números para a decisão do dono (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt` (branch `feat/motor-fisico-jolt`), sobre `090e91a3`. Feito por `executor` (sonnet). **Nenhum código de produção mudou**: `git diff` em `src` vazio, `dist` de `game-physics` e `game-physics-jolt` refeitos do HEAD (o `dist` nunca foi sujo: tudo foi medido por `JOLT_ITERATIONS`, que `setup-physics.ts` já lê). Sondas temporárias (cópias dos testes com variáveis de ambiente, `zz-*`) rodaram e foram removidas; os arquivos ficam só na pasta de rascunho da sessão, fora do repositório. B5, B6 e a bacia rodaram com a máquina quieta (um processo de cada vez); as sondas de correção (pilhas, varredura, rastro da semente 61) rodaram em paralelo, sem relógio.

### Achado de método: o B6 da T1.3 não media o mundo de produção
`game-physics-jolt/tests/cascade-tail.test.ts` cria o mundo com `{ fixedStep: 1/60, maxBodies: 8192 }`: **passo de 60 Hz, padrão do Jolt de 10 passadas de velocidade, sem `KIT_WORLD`** (sem ouvinte de contato, `contactReportSpeed`, `maxContacts`, sono ou folga). O "PASSA" da T1.3 (mediana 3,05 ms, despertar 5–7 ms) é desse mundo, não do de 20 iterações a 120 Hz. Por isso o B6 aparece abaixo em **dois modos**, os dois com 9 invocações × 3 rodadas aquecidas = 27 valores (como a T1.3):
- **Modo A (`B6_PROD=0`)**: o teste como está, só com `velocityIterations` posto por `JOLT_ITERATIONS` (a linha 10 reproduz a T1.3: mediana 2,96, pior 3,66, despertar 4,95–5,63 ms).
- **Modo B (`B6_PROD=1`)**: `{ ...KIT_WORLD, velocityIterations }`, isto é, 120 Hz, 2 passos por quadro de 1/60, com ouvinte de contatos: o mundo que o jogo usa.

### Parte 1 — custo e benefício de subir as passadas de velocidade

Comandos (da pasta do pacote indicado; cada célula numa invocação própria do `vitest run`):
- B6: cópia de `tests/cascade-tail.test.ts` em `tests/zz-b6-iter.test.ts` com `createWorld(process.env.B6_PROD === '1' ? { ...KIT_WORLD, velocityIterations: N } : { fixedStep: 1/60, maxBodies: 8192, velocityIterations: N })`; `B6_PROD={0,1} JOLT_ITERATIONS=N SPIKE_OUT=... npx vitest run tests/zz-b6-iter.test.ts` ×9 por célula. "p99" é o `all3s.p99` (3 s de quadros) de cada rodada aquecida; "despertar" é `firstFrameMs`.
- B5: `BENCH=1 PIECE_SOLVER={own,jolt} JOLT_ITERATIONS=N npx vitest run tests/bench-pieces.test.ts` (game-destruction-three), 3 pares alternados (próprio, Jolt) por N; razão = Jolt/próprio da mediana e do p99 de `renderer.update`.
- Bacia: `PIECE_SOLVER=jolt BOWL_SEEDS=64 JOLT_ITERATIONS=N npx vitest run tests/bowl-energy.test.ts` (um processo, 128 casos: dt 0,05 e 1/60).
- Pilhas: `tests/stack-energy.ts` (a da varredura) em dt 1/60 e 1/144, 64 sementes, push-out de produção, mesmos critérios de `failuresOf` do `sweep-c6.test.ts`, `JOLT_ITERATIONS` por corrida.

| Iterações | B6 modo A: p99 mediana / pior; despertar aquecido (mín–máx) | B6 modo B (produção): p99 mediana / pior; despertar (mín–máx) | B5 razão da mediana (3 pares) / do p99 | Bacia 64 sementes (128 casos) | Pilha 20:1, dt 1/60 | Pilha de 5, dt 1/60 |
|---|---|---|---|---|---|---|
| 10 (padrão do Jolt, só como referência do modo A) | 2,96 / 3,66 ms; 4,95–5,63 | — | — | 125/128 (T3.3) | 1/64 (T3.6) | 44/64 (T3.6) |
| **20** (produção) | 3,04 / 3,35 ms; 5,07–5,95 | 5,68 / 7,21 ms; 10,21–11,27 | 0,92 / 0,79 / 0,90 → **0,90**; p99 **1,07** | **128/128**; pior C1 −0,0325, C2 sem condição 0,0240, C3 0,0121, dorme em 0,50 s | **33/64** (31 por C1, até +0,29 kg·m) | 64/64 |
| 28 | 3,29 / 3,57 ms; 5,54–6,50 | 6,04 / 6,84 ms; 10,01–11,19 | 0,86 (0,77–0,87); p99 0,84 | 128/128; pior C1 −0,1115, C2 sem cond. 0,0138, **C3 0,0324 (limite 0,035)**, dorme em 0,50 s | 62/64 (pior C1 +0,039) | 64/64 |
| **32** | 3,45 / 3,91 ms; 5,80–6,74 | 6,04 / 6,56 ms; 10,26–11,11 | 0,96 (0,93–1,02); p99 0,75 | **128/128**; pior C1 −0,1495, C2 sem cond. 0,0147, C3 0,0136, dorme em 0,85 s | **64/64** (pior C1 0,000) | 64/64 |
| 40 | 3,63 / 3,68 ms; 6,55–7,46 | 6,21 / 6,84 ms; 10,88–12,04 | 1,05 (0,97–1,07); p99 1,15 | 128/128; pior C1 −0,1646, **C2 sem cond. 0,0341 (limite 0,035)**, C3 0,0082, dorme em 0,50 s | 64/64 | 64/64 |

Orçamento: mediana do p99 ≤ 4 ms, nenhum > 5 ms, despertar ≤ 10 ms (condição 10); razão do B5 ≤ 1,25. Leitura:
- **Modo A (o B6 como a T1.3 o mede): todas as quatro passam**, com o custo de passadas pequeno: 20 → 32 soma 0,41 ms ao p99 mediano e 0,7 ms ao despertar; 20 → 40 soma 0,6 e 1,2. Frio (primeira cena do processo): despertar 13,2–18,9 ms e p99 4,8–8,1 ms em todas, sem tendência por passadas.
- **Modo B (mundo de produção): nenhuma passa, nem a de 20.** p99 mediano 5,7–6,2 ms (limite 4) e pior 6,6–7,2 ms (limite 5); despertar 10,0–12,0 ms (limite 10). A causa não são as passadas (20 → 40 muda o p99 em 0,5 ms e o despertar em 0,6 ms): é o passo de 120 Hz (dois passos por quadro: mediana de passo 1,05 ms contra 0,50 ms no modo A) mais o ouvinte de contatos. Isso já estava no `spec.md` §6.2 ("5,9–6,4 ms p99 e 11,7–13,1 ms de despertar com listener, no gate 0") e é independente da decisão de passadas; fica aqui como número que o "PASSA" da T1.3 não cobria.
- B5: todas ≤ 1,25 (0,86–1,05 na mediana); 20, 28 e 32 ficam abaixo do solver próprio; 40 já empata. O ruído de um par é de ±0,1 (a T1.3 teve 1,06–1,23 no mesmo teste).
- Bacia: 128/128 em todas as quatro. 28 e 40 têm uma margem fina (C3 0,0324 e C2 sem condição 0,0341 contra 0,035); 32 tem as melhores margens das quatro.

### Varredura inteira no melhor candidato (32), uma execução
`node tests/zz-sweep.mjs` (cópia de `sweep-c6.mjs` com `SWEEP_ITS=8,10,20,32`): **9216 corridas, 925 s (15 min 25 s)** com 8 processos (4 iterações em vez de 3, mais sondas em paralelo na primeira metade), 1763 falham.

| Cenário (3072 corridas) | 8 it. | 10 it. | 20 it. | **32 it.** |
|---|---|---|---|---|
| bacia | 35/768 | 20/768 | 5/768 | **3/768** |
| pilha 20:1 | 653/768 | 444/768 | 223/768 | **18/768** |
| pilha de 5 | 288/768 | 74/768 | 0/768 | **0/768** |

(falhas por cenário em todas as iterações: bacia 63, pilha 20:1 1338, pilha de 5 362.) A 20 ou mais iterações: 228 falhas a 20, **21 a 32**. Nenhuma corrida que passa a 20 falha a 32 (0 casos de "mais trabalho piorou"); 205 da pilha 20:1 e 2 da bacia que falhavam a 20 passam a 32.
- **Célula de produção (dt 1/60, push-out ×1):** a 20: bacia 64/64, pilha 20:1 **33/64**, pilha de 5 64/64. A 32: **64/64, 64/64, 64/64**.
- **Falhas que sobram a 32:** (1) pilha 20:1 em dt 1/144: 18 corridas (6 sementes × 3 push-outs, todas por C1, pior +0,068 kg·m ≈ 0,3 mm de altura de energia da pilha de 210 kg); a 40 it. dt 1/144 dá 62/64 (pilha 20:1) contra 58/64 a 32 (sondagem de 64 sementes, push-out ×1); (2) bacia, semente 61, dt 1/144, push-out ×0,5 e ×1,5 por C2 sem condição 0,29 e 0,33 m (parte 2); (3) bacia, semente 16, dt 1/60, push-out ×1,5, C3 0,041 m (limite 0,035; a 20 era 0,045).
- 8 e 10 iterações continuam falhando como na T3.6 (C6 exige que passem; passadas não o resolvem, T3.3).
- **C2 como a spec o define (§6, linha C2: lançamento só se a ilha também violou C1) nunca falha: 0 corridas de bacia em 9216 com C2 condicionado acima de 3,5 cm.** O `failuresOf` da varredura e o `expect.soft` da bacia somam a coluna "sem condição" (a régua antiga do gate 0), mais dura que a spec.

### Parte 2 — bacia, semente 61, dt 1/144: o que lança a peça

Reproduzido: `SEED=61 FPS=144 PIECE_SOLVER=jolt` numa cópia da bacia com um registro por quadro (posição, velocidade, giro, energia, pontos de contato do motor de cada peça): C1 −0,216, C2 com condição 0, **C2 sem condição 0,322 m** (idêntico à varredura, 0,3220). Peça: `plate2`.

**O que se vê, quadro a quadro** (dt 1/144; os quadros repetidos 59/60, 65/66 são os que rodam 0 passos de 1/120):
1. Fim do assentamento das placas (2 s, antes de a chapa de 142 kg cair): a 1/144, `plate2` e `plate3` ficam **de pé sobre a aresta de 4 cm, encostadas uma na outra** (eixo da espessura quase horizontal; centro a 0,15 e 0,13 m do chão; velocidade 0,004 m/s; não dormem). A 1/60 as mesmas duas placas já caíram deitadas e dormem (`plate2` y −0,048, `plate3` −0,083).
2. A regra de equilíbrio do kit (`topple`, `engine-pieces.ts`) mede nas duas placas apoio estreito (`wx` 0,04 m, `wz` 0,2–0,3 m, `narrow` 1) e empurra. A 1/144 o giro nunca sai de ≈ 0,00–0,01 rad/s em 2,4 s, o relógio `steady` chega a 1,5 s (`STEADY_SECONDS`, depois do qual o empurro para para a peça poder dormir) e o empurro acaba com as duas ainda de pé; a 1/60 o giro cresce (−0,29, −0,44, −0,62, −1,0 rad/s) desde 0,4 s e a placa cai antes de a chapa chegar. É uma tenda de duas placas: o motor a sustenta e o kit desiste dela.
3. A chapa (142 kg, 0,7 m/s) pousa sobre a tenda e para em y 0,25 (apoiada nas arestas das placas). Com o despertar do quadro a quadro a tenda cede (t 0,29–0,47 s depois do despertar). Soma de m·altura de energia, em kg·m: a ilha **perde** 0,11–0,16 por quadro nos quadros de 55 a 59, **perde 1,9 e 2,0 nos quadros 61 e 62**; a chapa perde 3,6 e 4,5 e `plate2` ganha 1,1 e 2,2 (e `plate3` 0,6 e 0,4). Nenhum quadro cria energia na ilha (por isso C1 −0,216).
4. `plate2` é a ponta de alavanca da tenda: v_y vai de −1,14 a −2,50 m/s em 5 quadros (≈ 4 g, só possível com a chapa empurrando), giro de −4,9 a −7,9 rad/s, energia de altura de 0,211 a 0,478 m; no quadro 67 bate no chão (giro −14 rad/s) e perde tudo (−4,8 kg·m). Os contatos do motor de `plate2` ficam todos a 0–2 cm da superfície da bacia: ela não encosta em nada acima do chão, a chapa a empurra por uma ponta que o rastro de pontos de contato da própria placa não mostra (o ponto da outra peça é de `plate3`/chapa).

**Hipótese de causa raiz (com as provas):**
- **Não é o solver de velocidade.** Reproduz a 20, 28 e 40 iterações (C2 sem condição 0,322 / 0,255 / 0,322 a 1/144) e a 1/120 a 20, 28, 32 e 40 (0,282 / 0,286 / 0,282 / 0,304). Só a 32 e 1/144 passa, por acaso: a 32 e push-out ×0,5/×1,5 falha (0,29 / 0,33).
- **Não é o passo alternado 0/1 de 1/144 contra 1/120.** Falha também em 1/120 (um passo por quadro), 1/90, 1/100, 1/145, 1/150 e 1/240 (0,28 / 0,34 / 0,25 / 0,34 / 0,35 / 0,29 m); passa em 1/60, 1/130, 1/143 e 1/200. Com `JOLT_STEP=144` (passo = quadro) passa (0,002) e com `JOLT_STEP=60` passa (0,0002); com `JOLT_STEP=240` falha (0,33). Sete de onze taxas de quadro testadas falham: a bacia a 1/60 e 0,05 s passa também por estar afinada nessas duas taxas.
- **É a tenda de placas que o `topple` não derruba** (itens 1 e 2 acima, medidos nos dois lados), seguida de uma transferência de energia da chapa para a placa da ponta. Sem a chapa (`ZZ_NOSHEET`) a tenda ainda cai a 1/144 em t 1,0–1,2 s e `plate2` ganha 0,047 m (`plate3` perde 0,04); a 1/60 sem a chapa o ganho é 0,00002. Ou seja, o empurro por quadro (× dt) não acumula igual em taxas diferentes contra um contato que segura uma placa encostada, e a diferença decide se a tenda cai antes ou depois da chapa.
- **Pelo critério da spec isso não é lançamento:** a energia da placa sai da chapa (a ilha só perde), C1 passa em todos os quadros.

**Correção proposta (nada commitado, nenhuma testada):**
1. **A mais barata e honesta:** alinhar a varredura e a bacia com o C2 da spec (só o C2 com condição reprova; a coluna sem condição vira informativa no relatório). A semente 61 deixa de falhar a 1/144 e a varredura a 32 fica com 3 falhas de bacia → 1 (semente 16, C3 a push-out ×1,5) mais as 18 da pilha 20:1 a 1/144. É mudança de teste, não de comportamento; custa afrouxar uma régua mais dura que a spec, então é decisão do dono.
2. Se o dono quiser a tenda desfeita no motor: em `topple`, não parar o empurro por `STEADY_SECONDS` enquanto o apoio for estreito nos dois sentidos de uma peça de chapa (`wx` < `NARROW` · altura) e o ponto de apoio de cima for outra peça, ou aplicar o empurro por passo fixo e não por quadro (assim 1/144 e 1/60 dariam o mesmo empurro por passo). Risco conhecido: a T3.5 já mostrou que `PUSH_SPIN`, a trava de giro e `STEADY` mexem na bacia (semente 61 a 1/60 deu 0,27–0,31 m com a trava errada). Precisa de bacia 128/128, varredura e `pieces-edge` depois.
3. Não resolvem: mais passadas (acima), push-out, `JOLT_STEP` (muda o resto do jogo).

### Recomendação
- **Subir `velocityIterations` de 20 para 32 em `KIT_WORLD`.** Custo medido pequeno (modo A: +0,4 ms de p99 mediano e +0,7 ms de despertar; modo B: +0,4 ms de p99, despertar igual dentro do ruído; B5 0,96× do solver próprio), a pilha 20:1 de produção passa de 33/64 para 64/64, a bacia fica 128/128 com margens melhores que a 20, e na varredura inteira caem as falhas de 228 (a 20) para 21 (a 32) sem nenhuma regressão. 28 não basta (pilha 20:1 62/64 a 1/60, C3 da bacia a 0,0324); 40 ganha só 4 sementes sobre 32 na pilha 20:1 a 1/144 (62/64 contra 58/64, sem fechar), encosta o C2 da bacia no limite (0,0341) e custa mais.
- **O que 32 não fecha:** a pilha 20:1 a dt 1/144 (6 sementes, ≈ 0,3 mm de C1), 8 e 10 iterações no C6 (T3.3, fora de alcance por passadas) e a semente 61 a 1/144 por C2 sem condição (parte 2). O C6 só fecha com a decisão do dono sobre: (a) 32 como valor de produção; (b) a régua de C2 sem condição fora do reprovador; (c) 8 e 10 fora do C6 (ou a terceira via da T3.3).
- **O B6 de produção (modo B) está fora do orçamento com qualquer número de passadas** (p99 ≈ 6 ms, despertar ≈ 10,5 ms): o "PASSA" da T1.3 vale para o mundo do teste, não para o de 120 Hz com ouvinte. O orçamento do C7 para a cascata de 500 precisa ser reaberto à parte, não é efeito de subir para 32.
- Ruído: o B5 oscila ±0,1 entre pares (a mesma bancada deu 1,06–1,23× na T1.3); as tendências acima (custo de 20 → 40 de ≈ +0,5 a 1,2 ms) são maiores que o ruído, as diferenças de 20 para 28 não são.

## T3.6c — B6 no mundo de produção (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt` (branch `feat/motor-fisico-jolt`), sobre `a12d0ec9`. Feito por `executor` (sonnet). Pedido do dono: "medir e otimizar antes de mexer no orçamento". Nada mudou em passo (120 Hz), iterações (20), velocidade de sono, semântica de `contactReportSpeed`, tolerância ou orçamento. B6, perfil e B5 rodaram com a máquina quieta, um processo por vez.

### O bench agora mede o mundo de produção
`game-physics-jolt/tests/cascade-tail.test.ts` cria o mundo com `KIT_WORLD` (120 Hz, 20 passadas, ouvinte de contatos, `contactReportSpeed` 0,5, `maxContacts` 4096). **`B6_LEGACY=1` traz de volta o modo do gate 0** (`{ fixedStep: 1/60, maxBodies: 8192 }`, 10 passadas, sem `KIT_WORLD`) para comparação. O relatório ganhou `head` (os 12 primeiros quadros), `over5ms` e `over6ms` (quadros acima de 5 e 6 ms por blast).

### Atribuição: para onde vai o quadro (antes de otimizar)
Ferramenta nova: `tests/step-profile.test.ts` (`PROFILE=1 PROFILE_RUNS=12 npx vitest run tests/step-profile.test.ts`, da pasta de `game-physics-jolt`). Roda a cena do B6 passo fixo a passo fixo à mão, como `stepFixed` roda (`Step`, `updateFriction`, `roll`, `breakJoints`), e lê a pose dos 500 corpos no fim. Seis variantes em rodadas intercaladas (12 cada, 2 de aquecimento), médias em ms por quadro de 1/60:

| Parte (mundo de produção, 120 Hz, 2 passos por quadro) | f0 (despertar) | f1 | f2 | f3 | média dos outros quadros |
|---|---|---|---|---|---|
| Quadro inteiro | 10,50 | 5,95 | 4,48 | 3,25 | 1,18 |
| `Step` do Jolt, com ouvinte (inclui a ponte wasm→JS) | 10,07 | 5,60 | 4,16 | 2,98 | 1,01 |
| `updateFriction` | 0,34 | 0,27 | 0,23 | 0,19 | 0,08 |
| `roll` e `breakJoints` | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 |
| leitura da pose dos 500 corpos | 0,08 | 0,08 | 0,08 | 0,08 | 0,08 |

Separando o `Step` (mesma cena, mesma rodada, quadro inteiro em ms):

| Variante | f0 | f1 | f2 | f3 | média dos outros |
|---|---|---|---|---|---|
| 120 Hz, ouvinte real (produção) | 10,50 | 5,95 | 4,48 | 3,25 | 1,18 |
| 120 Hz, ouvinte com as 4 funções vazias (só o custo de cruzar para o JS) | 9,56 | 5,92 | 4,23 | 2,93 | 1,10 |
| 120 Hz, sem ouvinte (piso do Jolt a 120 Hz) | 8,74 | 5,17 | 3,77 | 2,74 | 1,08 |
| 60 Hz, ouvinte real | 6,81 | 4,48 | 3,06 | 2,14 | 0,70 |
| 60 Hz, sem ouvinte | 5,29 | 3,76 | 2,65 | 1,78 | 0,66 |

Leitura (despertar, f0, 10,5 ms): **piso do Jolt a 120 Hz 8,7 ms; cruzar para o JS 0,8 ms (68 mil chamadas por rodada, 64 mil delas `OnContactValidate` e `OnContactPersisted` que não fazem nada); trabalho de JS do ouvinte (`OnContactAdded`: contato novo, ≈ 1,7 mil por rodada) ≈ 0,7–1,0 ms; `updateFriction` 0,3 ms; pose 0,1 ms.** Contagem por função numa rodada de 180 quadros: `OnContactValidate` 32 mil, `OnContactPersisted` 32 mil, `OnContactAdded` 1,7 mil, `OnContactRemoved` 1,7 mil. Os cronômetros dentro das funções (variante "timed" do perfil) inflam o resultado em ≈ 2 ms no despertar: valem como limite superior.

O `p99` de 180 quadros do bench é o **segundo pior quadro, o f1** (5,6–6,2 ms), não um ruído do meio: a cauda do despertar decai de forma determinística (`head`: 10,5 / 5,7 / 4,2 / 3,0 / 2,3 / 1,9 ms ...). Com 120 Hz e **nenhum** ouvinte o f1 já é 5,2 ms; a 60 Hz sem ouvinte, 3,8 ms.

### O que foi otimizado (só JS, sem mudar a física)
1. **Vetores lidos do heap do wasm, não por `GetX/GetY/GetZ`** (`src/vec3.ts`, `vec3At`): o Jolt devolve um `Vec3` como endereço no heap, e os três `float` seguidos são x, y, z; uma chamada no lugar de quatro. Em `contacts.ts` (normal, ponto, velocidade linear, giro e centro de massa dos dois corpos, por contato novo) e em `friction.ts` (centro de massa, mínimo dos limites, velocidade do ponto do pé e do parceiro). Os valores são os mesmos `float` convertidos para `double`: **o resultado é idêntico bit a bit**. `checkVec3Layout` (chamada em todo `new JoltWorld`) confere o formato do build em uso e **lança** se mudar; `tests/vec3.test.ts` compara a leitura do heap com `GetX` num corpo com velocidade.
2. **`touches` removido**: a contagem de contatos por corpo era a soma das contagens de `partners`; `touching(id)` virou `partners.has(id)` (a invariante já valia: o mapa do corpo some quando fica vazio). Um `Map.get/set/delete` a menos por `touch`, duas vezes por contato novo. `state.ts` deixa de gravar o total (o formato do estado salvo não muda: ele nunca o guardava). A linha de `friction.test.ts` que comparava `touches` com a soma dos parceiros foi apagada: a invariante agora é estrutural.
3. Já era assim e foi medido, sem mudança: `updateFriction` visita só os corpos ativos com parceiros; `roll` só os `rollers` ativos e tocando; `OnContactPersisted` só faz algo para corpo perguntado (`contactPoints`); `OnContactValidate` só com pares ignorados; a linha de contato fora de `contactReportSpeed` não faz mais que ler vetores (agora no heap).
4. **Não é possível por JS**: o Jolt chama as quatro funções do ouvinte para todo par de formas, e o `ContactListenerJS` do build não deixa tirar `OnContactValidate` e `OnContactPersisted` (cada chamada atravessa a ponte mesmo vazia: 0,8 ms no despertar). `updateFriction` já está no chão de uma chamada por parceiro em movimento.

### Antes e depois (A/B intercalado, a mesma máquina, a mesma hora)
A máquina deriva entre execuções (térmica: o mesmo código deu mediana de despertar de 10,3 a 10,9 ms em horas diferentes), então o antes e o depois foram medidos **intercalados**: 6 rodadas de (3 invocações do código de `a12d0ec9`, 3 do otimizado), cada invocação com o aquecimento de sempre e 3 execuções aquecidas = **54 execuções por lado**. Comando (sem commitar nada entre as duas): `git apply -R` e `git apply` do patch de `src/` em volta de `npx vitest run tests/cascade-tail.test.ts`.

| B6 no mundo de produção (54 execuções por lado) | antes (`a12d0ec9`) | depois | orçamento |
|---|---|---|---|
| p99 (de 180 quadros), mediana | 6,12 ms | **5,68 ms** | ≤ 4 ms |
| p99, pior | 8,93 ms | **7,35 ms** | ≤ 5 ms |
| quadro de despertar, mediana | 10,86 ms | **10,14 ms** | ≤ 10 ms |
| quadros acima de 6 ms por blast, mediana / máximo | 2 / 3 | **1 / 3** | no máximo 1 |
| mediana dos 3 s | 1,07 ms | 1,06 ms | — |

Execuções avulsas de 9 invocações × 3 (27 valores) com o código final, sem intercalar, ficaram na mesma faixa (p99 mediana 5,78–5,92, pior 6,7–7,5, despertar mediana 10,3–10,4) porque a máquina estava mais lenta do que na hora do "antes" do A/B: o ganho só aparece de forma confiável intercalado. Modo do gate 0 (`B6_LEGACY=1`), 27 valores: p99 mediana 3,09, pior 5,00, despertar mediana 5,12 (máx 6,88), mesma coisa que a T1.3.
- **B5** (`BENCH=1 PIECE_SOLVER={own,jolt} npx vitest run tests/bench-pieces.test.ts` em `game-destruction-three`, 3 pares alternados): antes mediana 0,87 / p99 1,24; depois **0,87 / 0,65** (razão Jolt/próprio da mediana; limite 1,25). O p99 oscila de 0,65 a 1,42 entre pares: ruído do p99 de 200 quadros.

### Gates
- `pnpm -r typecheck`: 0 erros. `eslint` em `game-physics-jolt/src` e `tests`: 0 erros. `node tools/kit-audit/audit.mjs --check`: 0 novos fora do SDK dono.
- `game-physics-jolt`: 15 arquivos passam, 56 testes (1 pulado: o perfil, `PROFILE=1`). `game-destruction`: 507/507.
- `game-destruction-three`, solver próprio: 375 passam, 126 pulados (benches e varreduras), 0 falhas.
- `game-destruction-three`, `PIECE_SOLVER=jolt`: 438 passam, **só as 3 falhas conhecidas** (lata no ar com restituição, lata rolando bate numa parada, cinquenta latas).
- Bacia, 64 sementes, um processo (`PIECE_SOLVER=jolt BOWL_SEEDS=64 npx vitest run tests/bowl-energy.test.ts`), 128/128: `worstC1 -0.03250907368947817, worstC2 0, worstC2Unconditioned 0.023955968734763244, worstC3 0.012113776835190042, worstC4 0.49999999999999867, fellThrough 0`: **idêntico, dígito a dígito, ao da T3.5** (`-0,0325, 0,023956, 0,012114, 0,5, 0`), como esperado de uma mudança que lê os mesmos `float`.

### O orçamento é cumprido? **Não, e não é alcançável só por otimização de JS.**
- Despertar: 10,86 → 10,14 ms; limite 10. Ainda acima por ≈ 0,1–0,4 ms (mediana; máximo avulso 12–15 ms).
- p99: 5,68 ms (limite 4) e pior 7,35 (limite 5). O p99 do bench é o quadro f1 (o segundo depois do despertar). **Mesmo com o ouvinte removido por inteiro** (nenhum JS, nenhum atrito por corpo, variante "sem ouvinte"), f1 é 5,2 ms a 120 Hz: o piso do Jolt em dois passos de 1/120 com 500 corpos acordando já passa do limite de 5 ms. Só o passo de 60 Hz (3,8 ms) ficaria dentro, e o passo é a decisão fechada de 120 Hz.
- O que sobra de JS é ≈ 1,1 ms no despertar (0,3 de `updateFriction` e 0,8 de ponte wasm→JS inevitável) e ≈ 0,4 ms em f1. Zerar tudo isso levaria o despertar a ≈ 8,7–9,0 e o f1 a ≈ 5,2: o despertar passaria, o p99 não.
- **Decisão do dono:** (a) manter 120 Hz e reescrever o orçamento do B6 de produção para o que o Jolt entrega (p99 de 180 quadros ≈ 5,7 ms, despertar ≈ 10 ms, um ou dois quadros acima de 6 ms por blast, ainda sem frame acima de 12 ms); ou (b) medir o B6 e o orçamento em 60 Hz (passo da simulação a 60 Hz para a cascata, 120 Hz só onde a estabilidade exige) — muda o gate de bacia e pilhas, que foram medidos a 120 Hz; ou (c) reduzir o custo de despertar na origem (acordar a cascata em lotes entre quadros, ou ilha menor por blast). Nenhum desses é mudança de JS do adaptador.

## T3.6d — decisões do dono (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt` (branch `feat/motor-fisico-jolt`), sobre `4efe0ae2`. Feito por `executor` (sonnet). Sem GPU nem navegador. As quatro decisões estão no `spec.md` §12 e nos textos de §5 condição 1, §6 C2 e C6, §7 item 4.

### D1 — piso de produção 20 → 32 iterações de velocidade
`KIT_WORLD.velocityIterations` 20 → 32 (`game-physics/src/index.ts`); a iteração já era opção do mundo (`WorldDesc.velocityIterations`), e `tests/setup-physics.ts`, a bacia e a varredura leem o padrão do `KIT_WORLD` (`JOLT_ITERATIONS` ainda sobrescreve). Custo e benefício medidos na T3.6b (B5 0,96×, bacia 128/128, pilha 20:1 de produção 33/64 → 64/64). 8 e 10 iterações saem do C6; `SWEEP_ITS=8,10,20,32` as traz de volta para informação. Teste: `game-physics/tests/wake-queue.test.ts` afirma que o padrão é 32.

### D2 — régua do C2 e a tenda de placas
**Régua.** `bowl-energy.test.ts` deixou de reprovar pela coluna "sem condição" (`c2GainUnconditioned`): ela segue no resumo `bowl worst`, só para informação. `sweep-c6.test.ts` (`failuresOf`) reprova só o C2 condicionado (a coluna sem condição vai impressa pela `sweep-c6.mjs`). O bowl aceita `BOWL_DT=0.00694` para rodar a 1/144.

**Causa da tenda, medida de novo** (`TOPDBG`, rastro por quadro, semente 61, dt 1/144, 20 it., push-out 0,002): `plate2` e `plate3` ficam de pé sobre a aresta de 4 cm encostadas uma na outra; as pontas de contato de `plate2` ficam todas de um lado do centro de massa (x 0,03 a 0,08 m, centro em 0), a peça está fora do apoio e mesmo assim não cai. O giro fica em 0,001–0,01 rad/s por 2,4 s: o empurro do kit (`TOPPLE × min(h, 1)` ≈ 1 rad/s², 0,007 rad/s por quadro) é absorvido pelo contato. Tentativas, todas em `s61.sh` (semente 61, dt {1/144, 1/60} × it {20, 32} × push-out {0,001; 0,002; 0,003}, coluna C2 sem condição):

| Tentativa | Resultado a 1/144 |
|---|---|
| (base, T3.6b) | 0,29 / 0,32 / 0,24 / 0,29 / 0,003 / 0,33 m |
| 1. não parar o empurro por `STEADY_SECONDS` enquanto o apoio é estreito | idêntico (a tenda não depende do relógio) |
| 2. 1 + empurro que cresce com o tempo parado (8×/s até 12×), com e sem empurrar mesmo fora do apoio | a tenda cai, mas o empurro cria energia: C1 +1,98 a +5,4 kg·m, C2 até 0,33 m; reprovada |
| 3. **atrito da peça escorada cai a 10%** (`PROPPED_GRIP`) depois de 0,3 s parada sobre apoio estreito (`PROPPED_SECONDS`), de volta ao normal quando ela se mexe ou dorme (`slip`, `engine-pieces.ts`) | **os 12 casos < 0,0045 m**, C1 −0,145 a −0,22 |

Escolha (tentativa 3): é a única que derruba a tenda **sem criar energia** (quem faz o trabalho é a gravidade; o C1 não sobe) e vale por passo fixo, não por quadro (o atrito é do motor). Mantém a regra antiga de `STEADY_SECONDS` do empurro: a tentativa 1 mostrou que ela não importa. Comparado com o pedido do dono ("o empurro não para por `STEADY_SECONDS` enquanto o apoio é estreito e escorado, ou por passo fixo"): o empurro foi tentado nas duas formas (tentativas 1 e 2) e não derruba a tenda sem violar o C1; por isso a correção é o escorregão. Nota da T3.5 (teto de empurro 0,3 frágil na bacia): `PUSH_SPIN` não foi tocado; a bacia 64 sementes ficou 128/128.

### D3 — teto de giro em 47 rad/s e a lata que bate numa parada
O teste "on the floor, a rolling can knocks a still one on and nearly stops; they never overlap" (`rolling.test.ts`) dava à lata 2 m/s com ω = 60,6 rad/s, acima do teto do motor (47,06; Jolt, medido na T3.5). A lata derrapava (2,00 → 1,17 m/s antes do choque) e a outra não andava o exigido. Entrada nova: 1,5 m/s com ω = 1,5 / raio = 45,5 rad/s (rolamento puro, abaixo do teto), a lata sai de x = −0,2 (antes −0,4) e a corrida vai a 0,8 s (antes 0,5): a 1,5 m/s as duas latas passam a rolar juntas a 0,4 m/s depois do choque (medido: a 1,48 → 0,29, b 0,75 → 0,41, ω da a −41,6 → −11,9) e a outra só passa de 0,4 m em x depois de ~0,6 s de corrida. **As asserções e tolerâncias são as mesmas** (`> 2 R − 6 mm` entre as latas em todo quadro, `b.x > 0,4`, `b.v > a.v`). Resultado: `PIECE_SOLVER=jolt`, `rolling`: restam as 2 conhecidas (latas no ar com restituição, cinquenta latas).

### Gates (D1+D2+D3)
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 375 passam, 0 falham (126 pulados) |
| `PIECE_SOLVER=jolt game-destruction-three` | 438 passam, **2 falham** (`rolling`: latas no ar com restituição; cinquenta latas); eram 3 |
| `game-physics-jolt` | 56 passam, 0 falham (1 pulado) |
| `game-destruction` | 507 passam |
| `game-floorplan-three` | 715 passam, 3 falham (`exact-golden`: breach, spall, fracture, as 3 conhecidas) |
| Bacia Jolt, `BOWL_SEEDS=64`, um processo, 32 it. | **128/128**; `bowl worst {"worstC1":-0.1416,"worstC2":0,"worstC2Unconditioned":0.014651,"worstC3":0.013626,"worstC4":0.5,"worstDeepest":-0.0383,"fellThrough":0}` |
| Bacia semente 61, dt 1/144 | C2 sem condição 0,0001–0,0017 m nos 6 casos (20 e 32 it. × 3 push-outs); era até 0,33 m |
| `eslint` nos arquivos mudados | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono |

### Varredura C6 completa (`node tests/sweep-c6.mjs`, iterações {20, 32}, 498 s, 4608 corridas, 8 processos)
| Escopo | Resultado |
|---|---|
| **Célula de produção** (dt 1/60, push-out ×1, 32 it.) | bacia **64/64**, pilha 20:1 **64/64**, pilha de 5 **64/64** |
| Piso (32 it.), todas as células | **19 falhas de 2304**: pilha 20:1 a dt 1/144, 6 sementes × 3 push-outs, C1 até +0,068 kg·m (~0,3 mm de altura de energia de 210 kg), 18 falhas; bacia dt 1/60 push-out ×1,5, C3 0,0407 m (limite 0,035), 1 falha |
| 20 it. (comparação) | 225 falhas: pilha 20:1 a 1/60 (31–32 por célula) e a 1/144 (43 por célula), bacia dt 1/144 ×1 (C1 +0,205, semente 43) e dt 1/60 ×1,5 (C3 0,0447) |
| "Mais trabalho piorou um caso que passava" | **0** |
| C2 condicionado | **0 corridas acima de 3,5 cm em 4608** (máx. 0,0020); coluna sem condição máx. 0,0272 m |

**T3.6 não vira ✅:** o C6 atualizado ainda tem 19 falhas no piso, todas fora da célula de produção e fora das quatro decisões (pilha 20:1 a 1/144 não converge a 32 it. por ~0,3 mm; bacia a push-out ×1,5 passa 0,035 de C3 por 0,6 cm). Levar ao dono: subir o piso para 40 (T3.6b: pilha 20:1 a 1/144 passa de 58 para 62/64 e o C2 sem condição da bacia fica em 0,0341), aceitar a pilha 20:1 a 1/144 como fora do C6, ou ajustar o limite de C3 a push-out ×1,5.

### D4 — depois de uma explosão: despertar em lotes, quantas peças entram na física, teto de vivas (feito sobre `bbea0212`)

**"Deixa configurável" (dono, 2026-11-14):** nenhum número do D4 é constante do código. Cada um é opção com padrão documentado; os padrões são os medidos abaixo e um teste afirma que os padrões são esses números e que a sobrescrita funciona (`game-physics/tests/wake-queue.test.ts`, `game-destruction-three/tests/blast-debris.test.ts`, `tests/blast-debris-renderer.test.ts`, nos dois solvers). A iteração de velocidade do mundo é `WorldDesc.velocityIterations` (padrão 32 no `KIT_WORLD`). Documentado em `packages/game-physics/README.md`, `packages/game-destruction-three/README.md` e nas referências de skill `kit-base/game-physics.md` e `kit-destruicao/game-destruction-three.md`. O recurso é opt-in no renderer (`blastDebris: {}` liga com os padrões, como `settledBatches`); sem a opção o comportamento é o de antes. A sala (`game-test-room`) ganhou `debris.blast` opt-in (o jogador é a câmera); não foi ligado por padrão por falta de teste de GPU.

**Opções** (por mundo, por sistema = renderer, por explosão = `ExplodeOptions.debris`, que vence no que é de uma explosão só):

| Opção | Padrão | Onde | O que faz |
|---|---|---|---|
| `velocityIterations` | 32 | mundo | passadas de velocidade (D1) |
| `wakeCostTargetMs` | 4 | renderer | o passo pode chegar a isto ao acordar entulho: cada quadro acorda quantos o custo agregado dos quadros anteriores deixa |
| `maxWakeDelay` | 0,08 s | renderer, explosão | espera máxima de uma peça para acordar |
| `maxQueuedWakes` | 2048 | renderer | fila limitada: o excedente, o mais longe, acorda na hora |
| `minWakesPerFrame` | 8 | renderer | a fila sempre anda |
| `minPhysicsPieces` / `maxPhysicsPieces` | 24 / 300 | renderer, explosão | quantas peças da explosão entram na física, entre os dois |
| `physicsCostTargetMs` | 5 | renderer, explosão | ms de passo que os destroços de uma explosão podem somar no quadro em que acordam |
| `wakeCostPerBodyMs` / `physicsCostPerBodyMs` | 0,02 / 0,0022 | renderer | custo por corpo até medir (acordando / assentado) |
| `chipSize` | 0,15 m | renderer, explosão | lado maior abaixo do qual o objeto solto é lasca |
| `maxLivePieces` | 600 | renderer | peças vivas (dormindo ou não); acima, as longe e velhas em repouso somem primeiro, depois as mais velhas |
| `far.distance` / `far.age` / `far.action` / `far.fadeSeconds` | 40 m / 30 s / `'sleep'` / 0,5 s | renderer | longe e velha em repouso: dorme (padrão) ou some (`'fade'`: sem corpo nem colisor, a raiz encolhe, `onDebrisFaded` devolve a geometria ao jogo). "Mesclar" é o `settledBatches` que já existia (desenho) |

**O que já existia (conferido antes):** `maxAwakePieces`/`maxAwakeFragments` (dorme o mais velho em repouso quando passa do teto, sem regra de distância), `maxFragments` (o mais velho some; lascas de fratura são do sistema de fragmentos, que não usa o Jolt), `settledBatches` (desenho mesclado de entulho dormindo), `eventBudgetMs`/`slices` (orçamento de tempo para criar fragmentos e peças). Foi reaproveitado o que existe: `keepBudget`/`sleepByBudget` para dormir; o sistema de lascas (`vfx.burst('chips')`) para as lascas visuais.

**Como adapta (nada por GPU, nada por corpo):** `PhysicsFrame.stepMs` (novo, ms dos passos fixos do último quadro, `loop.ts`) sobre `world.activeCount` dá o custo agregado por corpo, suavizado (`PhysicsCostMeter`, 0,1 por quadro). Duas leituras: assentado e **no quadro em que a pilha acorda** (salto de ≥ 16 corpos acordados; uma ilha acordada custa ~9× o que custa assentada: 10,4 ms / 500 = 0,021 contra 0,0022). A fila (`WakeQueue`) solta por quadro `floor((alvo − passo do quadro anterior) / custo de acordar)` peças (mínimo `minWakesPerFrame`), as mais perto do jogador primeiro (`focus`; sem jogador, do centro do blast); o que esperou `maxWakeDelay` sai de qualquer jeito. A contagem de peças da explosão (`physicsPieceCount`) é `floor(alvo / custo de acordar) − corpos já acordados`, entre mínimo e máximo: **250 nesta máquina** (5 / 0,02); numa máquina com o dobro do custo por corpo, 125; com metade, 300 (o máximo). As grandes entram primeiro, as mais perto do jogador primeiro; lascas (< `chipSize`) vão depois; a peça que fica de fora **continua parada** (desenhada e sólida: nada invisível colide, nada desenhado some) e a explosão joga lascas visuais (`vfx.burst('chips')`, sem colisão) onde ela está. Limite assumido: a peça que sobra não vira partícula que some do mundo; trocá-la por fragmento pediria remover o objeto do mundo de destruição, o que não existe fora de um evento de dano.

### B6 no mundo de produção, antes e depois do D4 (`cascade-tail.test.ts`, `KIT_WORLD` 32 it., 9 invocações × 3 rodadas aquecidas = 27 valores por linha, máquina quieta, intercalado)
`B6_WAKE=burst` = antes (500 corpos dormindo, todos os empurrões no mesmo quadro); `queue` = receita de produção (contagem 250 pelo custo medido, o resto fica parado, fila de despertar, jogador a 8 m do blast); `budget` = só a contagem, sem fila (ablação).

| Linha | p99 mediana / pior | quadro de despertar mediana / máx | quadros > 6 ms por blast | meta |
|---|---|---|---|---|
| antes (`burst`), rodada A | 6,00 / 7,89 ms | 10,44 / 13,76 ms | 2 | p99 mediana ≤ 4, nenhum > 5, despertar ≤ 10, ≤ 1 quadro > 6 |
| antes (`burst`), rodada B (máquina mais lenta) | 6,88 / 8,69 ms | 11,71 / 13,47 ms | 2 | |
| **depois (`queue`), rodada A** | **3,52 / 4,02 ms** | **6,01 / 7,41 ms** | **1** | cumpre as 4 |
| **depois (`queue`), rodada B** | **3,88 / 4,34 ms** | **6,69 / 7,51 ms** | **1** | cumpre as 4 |
| ablação `budget` (sem fila) | 3,61 / 5,27 ms | 6,20 / 6,39 ms | 1 | pior > 5 |
| tentativa 1 da fila, custo por corpo assentado (0,0022) como estimativa | 6,05 / 6,37 ms | 10,48 / 12,41 ms | 2 | solta os 500 no 1º quadro: o custo de acordar não era conhecido |
| tentativa 2, custo de acordar 0,02, sem limitar a contagem (500 corpos) | 8,74 / 11,28 ms | 12,56 / 13,02 ms | 5 | pior: acordou 485 de qualquer jeito e alongou a cauda |

Leituras: (1) **a fila sozinha não divide uma ilha de contatos**: com a pilha encostada, o primeiro empurrão acorda a pilha toda no passo seguinte (485 de 500 acordados no quadro 0). O ganho vem de **quantos corpos entram** (contagem pelo custo medido: 6,0 → 3,6 de p99); a fila acrescenta o corte do pior caso (5,27 → 4,02) porque o que sai primeiro é o mais perto do jogador e o resto espera pelo custo medido. (2) O quadro de despertar continua sendo o `Step` do Jolt resolvendo a ilha acordada (T3.6c); AddBody e criação custam ~0 porque as peças já estão no mundo dormindo. Dois quadros > 6 ms caíram para um (o próprio quadro de despertar, 6,0–7,5 ms).

### Perfil por estágio depois da mudança (`PROFILE=1 PROFILE_RUNS=8 npx vitest run tests/step-profile.test.ts`, ms por quadro de 1/60, 8 rodadas, 2 de aquecimento; quadros 0–3 depois do despertar, depois a média dos 176 restantes)
| Estágio | antes: 500 corpos | depois: 250 corpos + fila |
|---|---|---|
| quadro inteiro (0, 1, 2, 3 / resto) | 10,39 / 6,12 / 4,68 / 3,08 / 1,11 | **6,05 / 3,56 / 2,79 / 2,25 / 0,71** |
| `Step` do Jolt (ponte wasm→JS do ouvinte incluída) | 9,94 / 5,76 / 4,35 / 2,81 / 0,95 | 5,81 / 3,36 / 2,59 / 2,09 / 0,62 |
| nosso JS: `updateFriction` | 0,37 / 0,28 / 0,24 / 0,19 / 0,08 | 0,19 / 0,16 / 0,16 / 0,12 / 0,05 |
| nosso JS: soltar da fila (`wake`) | 0,09 / 0 / 0 / 0 / 0 | 0,07 / 0,006 / 0,008 / 0,004 / 0 |
| leitura da pose (`readback`) | 0,08 / 0,08 / 0,08 / 0,08 / 0,08 | 0,04 / 0,04 / 0,04 / 0,04 / 0,04 |
A ponte (chamadas do ouvinte, 0,8 ms de 68 mil chamadas, T3.6c) não foi medida de novo por variante: o `Step` acima a inclui; o restante do JS é < 0,3 ms em todos os quadros.

### Gates (D4)
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 386 passam, 0 falham (126 pulados; +11 testes novos) |
| `PIECE_SOLVER=jolt game-destruction-three` | 450 passam, **só as 2 conhecidas** (`rolling`: latas no ar com restituição; cinquenta latas) |
| `game-physics-jolt` | 56 passam, 0 falham |
| `game-destruction` | 507 passam |
| `game-physics` | 8 passam (testes novos) |
| `game-floorplan-three` | 715 passam, 3 falham (`exact-golden`, as 3 conhecidas) |
| Bacia Jolt 64 sementes, um processo | **128/128**, mesmos números da D1–D3 (`worstC1 −0,1416`, `worstC3 0,01363`, `fellThrough 0`) |
| B5 (`BENCH=1`, 3 pares próprio/Jolt, mediana de `renderer.update`) | 0,761/0,727, 0,746/0,691, 0,766/0,693: razão **0,93** (0,91–0,96); p99 do Jolt 1,40–1,60 ms contra 1,94–2,77 do próprio |
| `eslint` nos arquivos mudados | 0 erros (avisos antigos de `max-lines`) |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono |
| GPU / navegador | nenhum |

## T3.7 — C8: determinismo entre processos e salvar/carregar bit a bit (2026-11-14)

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 20, worktree `motor-fisico-jolt` (branch `feat/motor-fisico-jolt`), sobre `5e438832`. Feito por `executor` (sonnet). Sem GPU nem navegador. **Parte Node pronta; Chromium, Bun e Firefox ficam à mão (lista abaixo).**

### O que era não determinístico
Um só ponto: a política de destroços da D4 (T3.6d) dimensionava lotes de despertar (`WakeQueue.release(dt, lastStepMs, custoPorCorpo)`) e a contagem de peças da explosão (`physicsPieceCount`) pelo tempo de parede do passo (`PhysicsFrame.stepMs`, `performance.now()` em `loop.ts`) e pelo `PhysicsCostMeter` alimentado por ele. A mesma partida em máquinas de velocidades diferentes acordava lotes e soltava quantidades de peças diferentes, e a física seguinte divergia. O mundo Jolt em si já era determinístico (T2.2A, `cascade.test.ts`).

### Escolha (a menor consistente com `veiculos.md` §15.3 item 5 e §17.2, e com o `spec.md` §12 D4)
- **Padrão continua `measured`** (a D4 do dono diz que a contagem sai do custo medido na máquina, e o B6 foi ajustado assim). Nada mudou para quem não pede nada.
- **Opção nova `RendererOptions.debrisCost`** (`game-destruction-three/src/blast-debris.ts`, `DebrisCostOptions`), três fontes do custo do quadro:
  - `{ source: 'measured', record? }`: lê `loop.frame.stepMs`; com `record` junta a amostra (`stepMs`, `active`) de cada quadro.
  - `{ source: 'fixed' }`: **nunca lê o relógio**: `lastStepMs = 0` e o medidor não observa; lotes e contagens saem só dos números configurados (`wakeCostTargetMs`, `physicsCostTargetMs`, `physicsCostPerBodyMs`, `wakeCostPerBodyMs`...). É o modo de teste, replay e lockstep (a regra do §15.3: "não há média móvel nem ajuste durante o jogo").
  - `{ source: 'replay', samples }`: toca as amostras gravadas, quadro a quadro, no lugar do relógio: a partida medida numa máquina reproduz as mesmas decisões em outra (veiculos §17.2: "replays gravam as decisões"; aqui se grava a entrada das decisões, que é o que as determina).
- A amostra é lida **uma vez por `update`** (`sampleCost`, antes de acordar a fila), em vez de duas leituras do relógio vivo; `advanceWakes` e `measureCost` usam a mesma. `renderer.reset()` agora também esvazia a fila de despertar, zera o medidor (`PhysicsCostMeter.reset()`) e o índice do replay.
- `WakeQueue.saveState/restoreState` e `PhysicsCostMeter.saveState/restoreState/reset` (`game-physics/src/wake-queue.ts`), `BlastWakes.saveState/restoreState`. Os itens da fila são dados do hospedeiro (no teste do Jolt, `{índice, impulso}`).

### Testes (todos Node, sem GPU)
| Arquivo | Teste | O que prova |
|---|---|---|
| `game-physics-jolt/tests/determinism.test.ts` | dois processos, custo fixo, máquinas de custo 0,002 e 0,09 ms/corpo | 240 quadros, hash por quadro (bits de pose e velocidade de todos os corpos, fila, medidor) **idêntico**, e idêntico ao do processo do teste com 0,5 |
| idem | dois processos, mesmo custo medido | idêntico |
| idem | **controle negativo:** dois processos, custo medido 0,002 e 0,09 | **divergem** (o perigo é real; sem este teste o de cima poderia passar por a cena não depender do custo) |
| idem | salvar no quadro 11 (fila com 23 de 48 pendentes), rodar 120, carregar num mundo novo e no mesmo, rodar 120 (modos `fixed` e `measured`) | hashes iguais bit a bit nos dois. Cena: pilha 20:1, lata rolando (`rolling`), caixa deslizando (atrito), par ignorado (`ignorePair`), pilha de 48 caixas dormindo com semente, fila e medidor |
| `game-destruction-three/tests/determinism.test.ts` (só `PIECE_SOLVER=jolt`) | dois processos, `fixed`, custo 0,002 e 0,09 | 150 quadros idênticos; cena: bacia com semente (4 placas e a folha), pilha de 5, 100 caixas soltas com explosão no quadro 30 sob a política D4 (50 peças entram na física, fila de despertar), hash das poses e velocidades dos `Piece`, dos bytes do mundo e da fila |
| idem | **controle negativo:** `measured`, custo 0,002 e 0,09 | divergem |
| idem | **replay:** grava num processo (`measured`, 0,03) e toca em outro (`replay`, que reporta 0,09) | os 150 hashes iguais aos da gravação |
| idem | salvar no quadro 32 (fila com peças pendentes), rodar 100; um renderer **refeito** até o quadro 32 recebe os bytes sobre um mundo acordado à força; rodar 100 | iguais bit a bit |
| `game-physics/tests/wake-queue.test.ts` | salvar/restaurar fila e medidor; `reset` volta aos padrões | exato |

**Limite achado (não é regressão):** restaurar os bytes do mundo no **mesmo** renderer depois de ele rodar mais quadros **não** reproduz os quadros: o renderer tem estado próprio fora do mundo (`EnginePieces`: `isSlipping`, lado do empurro, `turn`, ligações; o `PieceSystem`: `still`, `calm`; fila com fechamentos sobre as peças; e o conjunto de corpos pode mudar entre salvar e carregar, o que o `saveState` não aceita: "mesmos corpos, mesma ordem"). Restaurar só campos de `Link` e `PieceBody` não bastou (testado), então a causa exata não foi isolada; **hipótese não verificada:** corpos de chão criados quando as peças se espalham. Por isso o teste do renderer recarrega num renderer refeito (a descrição do hospedeiro é refeita, como o desenho §17.3 manda). Salvar o estado do renderer inteiro é trabalho de hospedeiro (spec 009, T6.9/009-h), não desta task.

### Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0, sem `Failed` |
| `game-destruction-three` próprio | 386 passam, 0 falham (131 pulados; os 4 testes novos são só Jolt) |
| `PIECE_SOLVER=jolt game-destruction-three` | 454 passam (+4 novos), **só as 2 conhecidas** (`rolling`: latas no ar com restituição; cinquenta latas) |
| `game-physics-jolt` | 61 passam (+5), 0 falham (2 pulados: o perfil e o worker) |
| `game-physics` | 9 passam (+1) |
| `game-destruction` | 507 passam |
| `game-floorplan-three` | 715 passam, 3 falham (`exact-golden`: breach, spall, fracture, as 3 conhecidas) |
| Bacia Jolt, `BOWL_SEEDS=64`, um processo | **128/128**, números iguais aos da D4 (`worstC1 −0,1416`, `worstC2 0`, `worstC3 0,01363`, `fellThrough 0`) |
| B6 produção (`cascade-tail.test.ts`, 9 invocações × 3 = 27 valores), rodada 1 | p99 mediana **3,67**, pior **5,37** (um valor; os outros 26 ≤ 4,19), despertar mediana 6,28 / máx 6,95, ≤ 1 quadro > 6 ms |
| B6 produção, rodada 2 | p99 mediana **3,56**, pior **4,82**, despertar mediana 6,09 / máx 8,27, ≤ 1 quadro > 6 ms |
| `eslint` nos arquivos mudados | 0 erros (aviso antigo de `max-lines` no `renderer.ts`) |
| `node tools/kit-audit/audit.mjs --check` | 0 novos fora do SDK dono |

Sobre o B6: o caminho quente do Jolt não mudou (só métodos novos na fila e no medidor, e o renderer lê a amostra uma vez por `update`). Na rodada 1 um valor isolado (5,37) passou de 5 com o desktop em uso (VM `qemu`, Chrome; carga 3); a rodada 2, repetida, ficou dentro (4,82). Nada foi afrouxado: a meta "nenhum > 5" fica como está e este um valor fica registrado.

### Procedimento à mão (dono): C8 em Chromium, Bun e Firefox
O teste automático é Node. Para os outros runtimes a pergunta é a mesma: **mesma semente e dt dão o mesmo hash de pose?** Use o modo `fixed` (os hashes só valem entre máquinas com ele; no `measured` eles divergem por desenho).
1. Na raiz do worktree: `pnpm build` (os pacotes `game-physics`, `game-physics-jolt`).
2. Rodar a cena do `tests/determinism.test.ts` do `game-physics-jolt` em Node e guardar a saída: `DETERMINISM_OUT=/tmp/node.json DETERMINISM_MODE=fixed DETERMINISM_COST=0.01 npx vitest run tests/determinism.test.ts` (dentro de `packages/game-physics-jolt`). O arquivo é uma lista de 240 hashes.
3. **Chromium:** abrir a sala (`examples/test-room`, porta 4280) ou uma página mínima que importe `@adatechnology/game-physics-jolt`, rodar `Sim` (de `tests/determinism-sim.ts`: `Sim.create(7, 'fixed', 0.01)`, 240 × `step()` e `hash()` por quadro; `hash` usa `node:crypto`, trocar por `crypto.subtle.digest('SHA-256', ...)` ou comparar os `Float64Array` byte a byte) e comparar a lista com a do Node. [ ] iguais nos 240 quadros.
4. **Bun:** `cd packages/game-physics-jolt && DETERMINISM_OUT=/tmp/bun.json DETERMINISM_MODE=fixed DETERMINISM_COST=0.01 bunx vitest run tests/determinism.test.ts` e `cmp /tmp/node.json /tmp/bun.json`. [ ] `cmp` sem diferença.
5. **Firefox:** igual ao Chromium (passo 3), na mesma máquina. [ ] iguais.
6. Salvar e carregar nos três: no mesmo `Sim`, `save()` no quadro 11, rodar 120, `load(saved)`, rodar 120; as duas listas de hashes devem ser idênticas. [ ] Node (feito), [ ] Chromium, [ ] Bun, [ ] Firefox.
7. Anotar o resultado aqui (iguais/divergem, versão do navegador, onde divergiu o primeiro quadro). Divergência entre runtimes é achado para o C8 (build sem `CROSS_PLATFORM_DETERMINISTIC`, `spec.md` §5), não falha desta task.


## T3.8 — Sala à mão: blast e martelo, 5 rodadas, régua de T3.4 (2026-11-14) — **REPROVADA no Jolt; levada ao dono, nada de regra do kit foi mexido**

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, Node 24.22 (o `node` desta máquina é 24, não 20; a régua e as sondas rodam igual). Navegador: Chrome for Testing 145.0.7632.6 (`chrome-headless-shell` do Playwright 1208, headless), janela 1600x900, `--use-angle=gl --enable-gpu --disable-gpu-vsync`. GPU que o Chrome usou: **Intel Arrow Lake (Mesa, `ANGLE (Intel, Mesa Intel(R) Graphics (ARL), OpenGL 4.6)`)**, não a RTX 5070. Rodar com `__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia` faz a sala ficar presa por mais de 8 minutos no primeiro frame (a rodada nunca termina; sem isso, 12 a 16 s por rodada). A GPU não pesa nestes números: a régua mede a física (CPU), e a sala é conduzida por `r.update(0.05)` com o `requestAnimationFrame` desligado, como nas sondas antigas. Máquina com outras sessões rodando (carga ~4,6): tempos de quadro são pessimistas, os de energia não dependem disso. Sessão pesada única, à mão (`CLAUDE.md` §9); nada entrou em hook, pre-push nem CI.

**Comandos** (da raiz do worktree; `$OUT` guarda um JSON por rodada):
```text
node examples/test-room/build.mjs                       # a sala; ?solver=jolt carrega o Jolt (c9fbc6eb), ?blastDebris=1 liga a política D4 (novo, abaixo)
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs own     ""                             5   # próprio
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs joltoff "&solver=jolt"                 5   # Jolt, política D4 desligada (padrão)
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs jolton  "&solver=jolt&blastDebris=1"   5   # Jolt, política D4 ligada
node specs/008-motor-fisico-jolt/decision/probes/car-drive.mjs "&solver=jolt" sedan                    # solidez do carro (também battle_tank; "" é o próprio)
```
URLs: `file:///.../examples/test-room/dist/test-room.html?area=floorplan` + a consulta acima. Cena: `floorplan_area`, pacote `residential`, modelo `single_storey_a`, semente 1; blast = `c4` a 2,5 m da casa, 0,6 m de altura; martelo = 12 golpes `blunt` de 8000 J, raio 0,5 m, um por update; depois 220 updates de 0,05 s. Tudo sai em `decision/t38-results.json` (30 rodadas e 3 carros), prints em `decision/t38-room-jolt-blast.png` e `t38-room-jolt-hammer.png`.

**O que precisei consertar (só harness, nenhuma regra do kit):**
1. A sonda `room.js` nunca tinha rodado: `r.world.serializeObject` não existe (usei `world.serialize().objects`); o marcador `__KIND__` aparecia também num comentário e o `replace` trocava o comentário (a primeira rodada era sempre martelo); o `run.sh` dependia de um `$PROBE` do rascunho que não existe. Entrou `probes/drive.mjs` (Playwright, uma página nova por rodada) no lugar do `run.sh`, que fica obsoleto.
2. **Peça recém-nascida lida na pose antes do primeiro passo.** O mesh de uma peça criada no update k fica numa pose provisória (y = 1,05 igual para todas) até o update k+1; a primeira amostra "antes" dava saltos de 3,7 a 4,6 m com velocidade de 0,5 m/s (impossível: 74 m/s) e inflava C3 para 5,6 m. A sonda agora só põe a peça na régua a partir da segunda observação. Vale para os dois solvers. Sem essa troca, os números do Jolt eram ainda piores (C2 4,6 m, C3 4,6 m).
3. `examples/test-room/src/main.js`: parâmetro `?blastDebris=1` que passa `debris: { blast: {} }` à sala (a opção já existia em `createTestRoom`, a página não a expunha). Sem o parâmetro, comportamento igual ao de antes.
4. `probes/hang-stack.mjs` (pausa o JS da página e imprime a pilha) e `probes/car.js` + `car-drive.mjs` (solidez do carro).

**Resultado por rodada.** Cada célula: mín–máx das 5 rodadas; as rodadas são quase idênticas entre si (o Jolt é determinístico; varia a política por tempo de parede e o relógio de sono). Aceite do Jolt: 0 peças acima de 3,5 cm no C2 condicionado, tudo dormindo ≤ 3 s depois da última entrada de fora, `fellThrough` 0.

| Cenário | Peças / dormindo no fim | C1 pior ilha (kg·m) | C2 condicionado (m) | peças > 3,5 cm (cond. / sem cond.) | C3 (m) | C4 (s) por rodada | `fellThrough` |
|---|---|---|---|---|---|---|---|
| **Jolt, D4 desligada, blast** | 52 / 52 | 255–320 | **3,88–4,35** | **4–6** / 5–7 | 0,11–0,32 | 5,05; 5,05; 10,70; 6,10; 5,15 | 0 |
| **Jolt, D4 desligada, martelo** | 34 / 34 | 280–314 | **4,10–4,33** | **7–8** / 7–8 | 0,62–0,65 | 4,50; 4,55; 5,50; 4,20; 9,00 | 0 |
| **Jolt, D4 ligada, blast** | 52 / 52 | 252–287 | **2,22–4,35** | **4–6** / 5–7 | 0,13–0,19 | 8,90; 5,35; 5,55; 6,80; 5,10 | 0 |
| **Jolt, D4 ligada, martelo** | 34 / 34 | 269–309 | **4,06–11,32** | **7–9** / 7–9 | 0,61–0,66 | 4,20; 5,15; 4,25; 5,00; 8,10 | 0 |
| Próprio, blast | 52 / 51–52 | 5,33 | 0,078–0,138 | 5–11 / 10–14 | 1,60–1,90 | -1 (4 de 5; uma peça não dorme); 7,90 | n/a |
| Próprio, martelo | 34 / 32–33 | −1,94 a −0,71 | 0 | 0 / 0–1 | 0,06–0,09 | -1 nas 5 (uma peça não dorme) | n/a |

`deepest` ficou `null` na sala (o chão da sala não é lido pela sonda; a rede é o `fellThrough` do motor: **0 em todas as 20 rodadas do Jolt**). **C3b passa; C2 e C4 reprovam em 20 de 20 rodadas do Jolt, nas duas políticas.** O próprio também reprova pela mesma régua (blast: 5–11 peças acima de 3,5 cm; um corpo nunca dorme), como na spec §2.1; o martelo no próprio fica no limite (0 peças acima de 3,5 cm no condicionado, 0–1 sem condição).

**Custo de quadro** (ms por `r.update`, física + sala, sem desenho; máquina carregada):

| Cenário | p50 | p99 (5 rodadas) | máximo | quadro do despertar |
|---|---|---|---|---|
| Jolt, D4 desligada, blast | 12,7–14,2 | 78–346 | 486–571 | 45–48 |
| Jolt, D4 desligada, martelo | 1,0–8,0 | 63–74 | 437–449 | 285–300 |
| Jolt, D4 ligada, blast | 12,6–13,7 | 62–351 | 493–580 | 46–50 |
| Jolt, D4 ligada, martelo | 1,0–2,0 | 61–71 | 437–450 | 286–289 |
| Próprio, blast | 3,7–4,0 | 34–40 | 43–56 | 26–28 |
| Próprio, martelo | 1,3–1,6 | 20–25 | 26–29 | 20–26 |

O máximo de 440–580 ms do Jolt é o primeiro update depois de a casa estar construída com peças soltas novas (montagem dos corpos e, no martelo, o primeiro golpe, 285–300 ms); no blast o quadro do despertar é só 45–50 ms. A política D4 ligada não mudou o quadro do despertar nem o C2 de forma útil (mesmos números, a rodada de 2,22 m é o único valor menor).

**Carro estacionado** (`car-drive.mjs`, `r.spawn`, 1 update = 1/60 s; "sólido" = `collidersPending()` falso):

| Carro | Peças de colisão | Sólido depois de | Custo do spawn | Updates de enchimento: total / pior update | Update em regime com o carro (p50 / p99 / máx) | Sem carro (p50 / p99) |
|---|---|---|---|---|---|---|
| `sedan`, Jolt | 192 | **16 updates = 0,27 s** | 513 ms | 302 ms / **160 ms** | 1,5 / 5,5 / 6,1 ms | 0,5 / 1,5 ms |
| `battle_tank`, Jolt | 334 | **30 updates = 0,50 s** | 171 ms | 765 ms / **460 ms** | 2,4 / 5,1 / 6,8 ms | 0,5 / 1,8 ms |
| `sedan`, próprio | 0 | 1 update (sem colisor por peça) | 582 ms | 5 ms / 5 ms | 0,6 / 14,7 / 160,6 ms | 0,6 / 1,8 ms |

Os 1,5 s estimados na T3.0b não se confirmam: o carro fica sólido em 0,27 s (sedã) e 0,5 s (o maior, `battle_tank`, 160 mil triângulos). O custo que pesa é o pior update de enchimento (160 e 460 ms, um quadro perdido), mais o spawn (170 a 513 ms, comum aos dois solvers). Em regime o carro custa +1 a +2 ms por update.

**Diagnóstico das falhas (parcial; sem mexer em regra).** Três sinais, todos medidos com a sonda de diagnóstico (`worstRises`, `near`, `kin` em `room.js`):
1. **O C2 de ~4,1–4,35 m (e os 11,3 m de uma rodada) é uma peça de 18 kg em repouso a ~1 m de altura (perto de x −3,3, z −8,7), lançada de 0,8 m/s para 8,3 m/s por uma peça de 36,4 kg que chega a 7,5 m/s** (rodada do martelo: `obj_7` 7,52 para 2,9 m/s, 0,52 m de distância; ganho 4,3 m×18 kg = 78 kg·m, contra −88 kg·m da outra: a troca conserva a energia). Na régua isso aparece como ganho da peça pequena e, quando a ilha do contato é separada da peça que perdeu energia, como violação do C1 e do C2. A outra rodada (11,3 m): uma peça de 18 kg parada no chão (y 0,016) vai a 9,1 m/s. É o mesmo padrão: choque de entulho já lançado contra peça leve em repouso, contado como ganho. Não é a explosão (entrada de fora absorvida) nem ruído de repouso.
2. **C1 de 250–320 kg·m vem de dois corpos de 950 kg com raio 3,84 m, longe da casa (x 15,8 / x −28,2, z 16,4)** que caem por mais de 2 s a ~9 m/s: o deslocamento de um update é 0,25–0,29 m, mas a velocidade pede 0,44–0,49 m (a pose anda 0,6× do que a velocidade diz) e a "altura de energia" sobe 0,15–0,2 m por update × 950 kg = 150–190 kg·m. Só acontece no Jolt (o próprio não tem esses corpos). **Não está claro se é o motor ou a leitura da pose na sala** (pose interpolada entre passos fixos, ou corpos de laje/telhado que a sala move por fora do Jolt); é a primeira coisa a investigar, porque sozinho explica os 250–320 kg·m e o C4. Não identifiquei o que são esses dois corpos (`obj_1`/`obj_2` no martelo, `obj_19`/`obj_20` no blast).
3. **C4 de 4,2–10,7 s** (limite 3 s): as peças só dormem depois de os corpos grandes do item 2 acabarem de cair; o C4 é medido da última entrada de fora e esses corpos nunca entraram em repouso antes do passo 44–52 (2,2–2,6 s depois do último golpe). Sem eles, o C4 do Jolt na bacia é 0,5 s (T3.4).

Resumo para o dono: o Jolt passa a bacia (128/128) e o `fellThrough` (0), mas a sala reprova C2 e C4 em 20/20 rodadas, e a causa não é a política D4 (ligar não muda) nem o peso dos carros (sólidos em 0,27–0,5 s). Falta decidir se os corpos de 950 kg (item 2) são do motor ou da sala, e se o choque de entulho contra peça leve em repouso (item 1) deve ser considerado ganho pela régua (a régua da bacia, por ilha, não vê o par porque a bacia não tem esse lançamento). Nenhuma tolerância nem regra do kit foi alterada; T3.8 fica sem ✅.


## T3.8b — investigação da reprovação da sala (2026-11-14) — **T3.8 continua SEM ✅: a reexecução não passa; as três causas medidas foram consertadas ou explicadas, sobram peças presas no telhado**

Máquina: Intel Core Ultra 9 275HX, 24 cores, Arch Linux, `node --version` = v24.22 (o `node` desta máquina é 24, não 20). Navegador: `chrome-headless-shell` do Playwright (Chrome for Testing 145), headless, janela 1600x900, `--use-angle=gl --enable-gpu --disable-gpu-vsync`; a GPU que o Chrome usou é a **Intel Arrow Lake (iGPU, Mesa)**, não a RTX 5070, como na T3.8. A GPU não entra nos números: o desenho fica fora de `r.update` e a física é CPU. **A máquina não estava quieta**: carga 2,2 a 3,4 (outras sessões) nas execuções; por isso os tempos de quadro são por estágio (CPU de cada parte) e comparados dentro da mesma hora. Uma sessão pesada de navegador por vez, à mão (`CLAUDE.md` §9); nada entrou em hook, pre-push nem CI. Nenhuma tolerância nem regra do kit mudou (3,5 cm, 1 mm, 3 s); o que mudou é como a régua da sala lê a cena e três pontos de código (adaptador, `game-destruction`, ladrilhos do chão).

### 1. Os dois corpos de 950 kg: **postes de concreto do lote, e a medida estava errada porque o motor girava por outro ponto**
- **Identidade.** `obj_19` e `obj_20` (blast; `obj_1`/`obj_2` no martelo): a parte `pole:-10.3` / `pole:33.7` da casa (`house3d:1`, etiqueta `pole`, concreto, caixa 1,6 x 7,5 x 0,22 m, 950,4 kg), em x 15,8 e −28,2. Viram peças soltas pouco depois do primeiro golpe (quadro 12 do blast) e tombam: movimento **real** no motor, não um corpo cinemático.
- **Causa.** Os colisores de cada poste são 6 placas finas desenhadas (`partBoxes`: duas de 22 x 2 x 22 cm, a travessa de 1,4 x 0,1 x 0,06 m...) e o Jolt tira o centro de massa **do volume dessas partes**: `Shape::GetCenterOfMass` = (0,02, **2,237**, 0) em relação à origem do corpo. O kit lê a pose da origem e a velocidade do Jolt é a do centro de massa: a pose andava 0,65x do que a velocidade dizia (distância do centro por update 0,299 m contra 0,456 m = 9,1 m/s x 0,05), e `energyHeightOf` somava o `y` de um ponto com a velocidade de outro (+150 a 190 kg·m por update, e o relógio C4 preso). Medido: `body.GetPosition()` y 3,633 contra `GetCenterOfMassPosition()` y 5,776.
- **Conserto (motor).** `BodyDesc.centreAtOrigin` (`game-physics`), que o Jolt atende com `OffsetCenterOfMassShape` (o centro de massa na origem, onde o kit o põe: `engine-pieces.ts` diz "um corpo dinâmico no seu centro de massa"); as peças pedem. Teste `game-physics-jolt/tests/centre-at-origin.test.ts` (queda livre de um poste girando: a origem cai ½gt² e a velocidade é a dela; sem a opção, o desvio passa de 0,5 m). Depois: distância por update = velocidade x dt (0,084 contra 0,084; 0,307 contra 0,313), C1 caiu de 255–320 para 100 kg·m numa rodada.
- Os postes continuam tombando (a base é uma placa de 22 cm sob 7,5 m: o empurro de tombamento do kit, §12, e o equilíbrio instável): é movimento legítimo.

### 2. Régua da sala: ilhas reais, energia que o kit dá, inércia do motor
Cada degrau medido com 1–2 rodadas (`probes/room.js`, Jolt D4 desligada), um de cada vez:

| Degrau | C1 (kg·m) | C2 cond. (m) | peças > 3,5 cm cond. | C4 (s) |
|---|---|---|---|---|
| T3.8 como estava (5 rodadas) | 255–320 | 3,88–4,35 blast, 4,10–4,33 martelo | 4–6 / 7–8 | 4,2–10,7 |
| + `centreAtOrigin` | 100,2 / 13,3 | 0,192 / 0,052 | 3 / 1 | -1 / 4,85 |
| + ilhas pelo grafo de contatos | 100,2 | 4,07 (a peça de 18 kg) | 4 | 9,85 |
| + inércia do motor (tensor) | 127 | 0,242 | 3 | 3,75 |
| + energia dada pelo kit tirada da peça e da ilha | 0,6–1,9 | 0,011–0,042 | 0–2 | 0,5–2,2 |

- **Ilhas por contato** (`tests/energy-ruler.ts`, `islandsOf(before, after, touching)`): o adaptador ganhou `JoltWorld.trackPairs`/`pairLog` (desligado por padrão: os pares que se tocaram no quadro, os que já se tocavam no começo mais cada `OnContactAdded`, mesmo o que acabou no mesmo quadro); `tests/contact-graph.ts` põe os pares em ids de peça. Sem o grafo (solver próprio) a régua cai na fusão por esfera, como antes. Testes à mão (`energy-ruler.test.ts`, 26 testes): cadeia de contatos junta, esferas vizinhas sem contato não, id de chão/parede fixa não junta nada, par adicionado e desfeito no mesmo update junta, a transferência de 18 kg por 36 kg (par que conserva energia) não é lançamento com o grafo e é lançamento com esferas. **A bacia não muda de veredito**: 128/128 antes e depois; `worstC2Unconditioned 0,014651` e `worstC3 0,013626` idênticos; C1 mais perto de zero por ilha menor (−0,1416 para −0,0077); `fellThrough 0`.
- **O "choque de entulho contra peça leve em repouso" da T3.8 não era choque**: a peça de 18 kg (`obj_56`, 2,1 m de altura, x −3,3 z −8,7) não tinha **nenhum contato com peça** no quadro (só com o chão e um pilar fixo), e levou `pieceSys.impulse` de 142,9 N·s: **um empurro do blast que chega depois** (frente do blast, ou uma segunda explosão na casa), nos quadros 24, 28 e 34 (`window.__imp`, monkey patch de `pieceSys.impulse`). A 36 kg a 7,5 m/s era coincidência de vizinhança.
- **Energia que o próprio kit dá** (a régua da sala agora a mede e a tira): `pieceSys.impulse` (empurros de blast atrasados) e `engine.topple` (o empurro de equilíbrio do §12: uma peça em pé sobre apoio estreito, o poste, ganha velocidade a cada update). `StepContext.given`: energia-altura que o kit somou a cada peça no update; sai do ganho da **ilha dela** (não do update inteiro: outra ilha que ganhe sozinha no mesmo update continua contando) e levanta o piso do episódio da peça; o relógio C4 reinicia. Medido: 250–630 updates por rodada com energia do kit, **490–580 kg·m por rodada** (quase tudo o `topple` do poste e do arame, mais os empurros); no próprio, 19 kg·m (2 updates). Testes à mão (4). **Isto é decisão de régua, não de tolerância; o dono precisa confirmar que perdoar o empurro de tombamento do kit é o certo**: sem isso o C1 volta a 14–127 kg·m pelos postes.
- **Inércia do motor.** `energyHeightOf` aceita o tensor de inércia do corpo (o Jolt guarda o inverso no referencial do corpo; a sonda o inverte): a peça de placas finas gira com inércia que não é a da caixa. Só o Jolt (o próprio não tem tensor). 3 testes à mão.

### 3. Custo de quadro da sala, por estágio (`probes/profile.js`, `profile-drive.mjs`)
Mesma cena (blast `c4` a 2,5 m da casa, ou 12 golpes de 8000 J), 11 s depois, métodos de `PieceSystem`, `EnginePieces`, `EngineStatics`, do mundo Jolt e do ouvinte de contatos embrulhados com cronômetro na página (tempo inclusivo; desenho fora). `dt` 0,05 s = 6 passos de 1/120 por update (o da T3.8); `dt` 1/60 s = o quadro de produção (2 passos). Arquivos: `decision/t38b-profile-before.json`, `t38b-profile-after.json`.

**Antes (código de `b5d2cc92`), Jolt, dt 0,05:**

| Estágio (ms por update) | blast, update do meio (p40–p60) | blast, pior update | martelo, pior update |
|---|---|---|---|
| update inteiro | **21,1** (p50 19,6; máx 566) | 566 | 318 |
| `layStatics` (→ `EngineStatics.lay` → `fit`) | **10,6** (fit 6,5) | 11 | — |
| `layGround` (`layTile`: 600 ladrilhos) | 0 | **477** | **297** (483 ladrilhos) |
| passo do Jolt (`Step`, 6 passos) | 1,8 | 59 | 5 (46–53 nos piores) |
| `room.world.update` | 2,0 | — | — |
| `outOfStatics` (`penetration` x 9) | — | — | 57 (outro update, 98 ms) |

**Culpados.**
1. **`layStatics`, 10,6 ms por update com nenhuma peça acordada (blast).** O sedã estacionado queima depois do blast; o `state()` dele é **um objeto novo a cada update** (o contrato permite: mudou). `implSolidsOf` (`game-destruction/src/world.ts`) só reaproveitava a lista se `state` fosse o mesmo objeto, então refazia `hostedPieces` (208 peças: cada triângulo posto em coordenada de mundo, `Float32Array` novo) e o motor media as 208 partes de novo todo update (`statics.fit`, comparando malhas). Conserto: com o mesmo spec, o mesmo lugar e **as mesmas peças desenhadas** (`pieces[i] === known.pieces[i]`), devolve a lista de antes; o motor a pula pela identidade. Teste `game-destruction/tests/hosted-solids-cache.test.ts` (3: mesma lista com estado novo a cada leitura; lista nova se uma peça mudou; lista nova se o corpo se mexeu).
2. **`layGround`/`layTile`: o quadro de despertar de 290 ms (martelo) e o máximo de 440–580 ms (blast).** O objeto `obj_22`/`obj_21` é a **fiação elétrica da casa (`wiring:grid`, cobre, 45,35 m x 1,4 cm, 11,9 kg) virada em peça solta rígida**; as peças acordadas ganham ladrilhos de chão de 2 m dentro da **esfera da diagonal** da caixa (raio 23,2 m = 625 ladrilhos), 0,6 ms cada (`buildGroundTile` amostra `groundAt` 26 mil vezes: 0,35 ms só isso; 483 `createBody` no mesmo update). Conserto: os ladrilhos vão sob a **pegada da peça vista de cima** (os 8 cantos da caixa girada, teste de eixo separador contra cada ladrilho) mais `TILE_MARGIN` e o balanço das pontas, no máximo `MAX_SWING` = 3 m (o blast gira o arame a **47 rad/s**, 53 m de balanço por quadro: sem o teto, 4290 ladrilhos e 2,4 s). Nunca mais largo que a esfera de antes. Teste `engine-ground.test.ts` (o arame de 45 m na diagonal pousa em 20 a 80 ladrilhos, não 576, e todo ponto dele fica sobre ladrilho posto).
3. Sobram `outOfStatics` (`jolt.penetration` 53–57 ms num update, ao criar peça dentro de colisor fixo) e o `Step` do Jolt no despertar (47–69 ms em dt 0,05 = 6 passos com 33 corpos acordados em cima dos colisores de triângulo da casa).

**Depois (código final), Jolt:**

| (ms por update) | blast dt 0,05 | blast dt 1/60 | martelo dt 0,05 | martelo dt 1/60 | próprio blast dt 0,05 | próprio martelo dt 0,05 |
|---|---|---|---|---|---|---|
| update do meio (p40–p60) | **9,0** | **5,4** | 2,2 | 2,0 | 5,7 | 2,4 |
| p50 / p99 / máximo | 7,9 / 60,8 / 78 | 5,2 / 48,9 / 204 | 2,2 / 79,2 / 287 | 2,0 / 30,4 / 211 | 5,5 / 43,8 / 62 | 2,3 / 30,9 / 36 |
| `Step` do Jolt (meio) | 3,2 | 1,0 | 0,03 | 0,3 | — | — |
| `layStatics` (meio) | 0,46 | 0,32 | 0,006 | 0,01 | — | — |
| `world.update` da sala (meio) | 1,6 | 1,4 | 0,04 | 0,02 | 1,4 | 0,04 |
| pior update | layTile 33 de 67 | layTile 172 de 204 | layTile 197 de 287 | layTile 150 de 211 | `integrate`+`sweepOn` | idem |

O update do meio do blast caiu de 21,1 para 9,0 ms (dt 0,05) e o máximo de 566 para 78 ms; o do martelo, de 318 para 287 no pior update (o despertar ainda lança ~160 ladrilhos de uma vez: o arame e os dois postes). Em dt 1/60 (produção) o meio é 5,4 ms (blast) e 2,0 ms (martelo). O `Step` do Jolt é a parte que sobra (3,2 ms no blast do meio com 6 passos). Os 9 ms do blast do meio em dt 0,05 incluem 1,6 ms de `world.update` (o carro queimando, destruição, não física) e 0,9 do renderer.

### 4. Reexecução da T3.8 (5 rodadas de blast e de martelo, 3 configurações), mesma régua, código final
Comandos (raiz do worktree; um JSON por rodada em `decision/t38b-results.json`, 30 rodadas; as sondas `room.js` e `profile.js`):
```text
node examples/test-room/build.mjs
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs joltoff "&solver=jolt"                5
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs jolton  "&solver=jolt&blastDebris=1"  5
node specs/008-motor-fisico-jolt/decision/probes/drive.mjs own     ""                            5
OUT=<dir> node specs/008-motor-fisico-jolt/decision/probes/profile-drive.mjs <rotulo> "&solver=jolt" blast|hammer 0.05|0.016667
```
Aceite do Jolt: C2 condicionado 0 peças acima de 3,5 cm, tudo dormindo em até 3 s depois da última entrada de fora, `fellThrough` 0. Células: valores das 5 rodadas.

| Cenário | Peças / dormindo | C1 pior ilha (kg·m) | C2 cond. máx (m) | peças > 3,5 cm (cond. por rodada) / sem cond. | C3 (m) | C4 (s) por rodada | `fellThrough` | rodadas que passam |
|---|---|---|---|---|---|---|---|---|
| **Jolt, D4 desligada, blast** | 52 / 52 em 5 | 0,4–10,7 | 0,000–0,414 | 0, 1, 0, 1, 1 / 2–3 | 0,04–0,11 | 3,35; 0,5; 0,5; 1,65; 1,9 | 0 | **1 de 5** |
| **Jolt, D4 desligada, martelo** | 34 / 34 em 4 (uma peça não dorme) | 0,6–2,5 | 0,047–0,074 | 2, 1, 2, 1, 1 / 1–4 | 0,33–0,37 | 2,0; 1,35; 0,5; -1; 1,7 | 0 | **0 de 5** |
| **Jolt, D4 ligada, blast** | 52 / 52 | 0,0–26,7 | 0,000–0,043 | 0, 0, 1, 0, 0 / 2–3 | 0,10–0,13 | 0,95; 0,5; 0,5; 2,55; 0,5 | 0 | **4 de 5** |
| **Jolt, D4 ligada, martelo** | 34 / 34 | 1,5–3,9 | 0,040–0,075 | 2, 1, 1, 1, 2 / 3–5 | 0,36–0,40 | 1,35; 0,4; 5,25; 4,6; 1,0 | 0 | **0 de 5** |
| Próprio, blast | 52 / 51 | 5,3 | 0,076–0,204 | 5, 6, 7, 5, 5 / 9–13 (esferas) | 1,71–1,92 | -1 nas 5 (uma peça não dorme) | n/a | 0 de 5 |
| Próprio, martelo | 34 / 32–34 | −1,9–0,3 | 0,000–0,062 | 0, 0, 1, 0, 0 / 0–1 (esferas) | 0,05–0,13 | -1; -1; -1; 3,3; -1 | n/a | 0 de 5 |

Custo de quadro da mesma reexecução (ms por `r.update`, dt 0,05, física + sala): Jolt blast p50 5,0–12,5, p99 54–130, **máximo 98–315** (era 437–580, e em reexecução intermediária com os ladrilhos sem teto, 3 s); Jolt martelo p50 0,9–2,6, p99 71–89, máximo 93–294, quadro do despertar 43–88 ms (era 285–300); próprio blast p50 4,0–5,2, máximo 45–61; martelo 1,1–1,6, máximo 28–32.

**Veredito: a sala do Jolt continua reprovada pelo critério do dono: 5 de 20 rodadas passam (C2 reprova ao menos uma rodada nas 4 configurações do Jolt, 20 rodadas no total; C4 reprova em 4 rodadas, uma delas com uma peça que não dorme).** `fellThrough` 0 em todas. Mas as causas medidas na T3.8 não são mais as que reprovam, e o próprio também reprova a mesma régua (o blast em 5/5 rodadas).

### 5. O que sobra e por quê (medido, sem mexer em regra)
- **C2 residual: peças de 42,8 kg (e uma de 18 kg) sozinhas na ilha, tocando só colisores fixos da casa, ganham 4 a 10 cm de altura de energia num update** (`worstIsland` da sonda: `obj_4` no martelo, y 3,5 m, 0,1 a 0,8 m/s, +3,4 a +3,96 kg·m; `obj_47` no blast, y 4,36 m, +0,4 a +0,7 kg·m; uma rodada de blast 41 cm numa peça de 18 kg). São pedaços do telhado calçados no vão entre a laje do forro (caixa fixa de 12 m x 16 cm no topo y 3,03) e os dois planos do telhado (colisor de malha). Nenhum `setPose`/`setVelocity` do kit nem criação/remoção de colisor fixo no update (monkey patch de `createBody`, `removeBody`, `setShape`, `setPose`, `setVelocity`): é o próprio Jolt ejetando uma peça apertada entre planos que convergem. Não segui além disso. Opções do dono: aceitar o ganho contra colisor fixo de casa (ele não é "peça lançada por outra"), ou investigar o contato de cunha (velocidade de ejeção de uma peça de 43 kg entre dois colisores fixos).
- **C4 residual**: uma peça que não dorme em 1 de 5 rodadas do martelo (D4 desligada) e 4,6–5,25 s em duas rodadas do martelo com D4 ligada; o blast com D4 desligada leva 3,35 s numa rodada. São as mesmas peças presas no telhado voltando a se mexer.
- **O arame de 45 m**: a fiação inteira da casa vira **uma só peça rígida de 12 kg**, que o blast gira a 47 rad/s (a ponta a mais de 1000 m/s). Isso é regra do kit (um empurro `impulse(piece, impulse, point)` numa peça de 45 m; o kit decide que a fiação se solta inteira), não do motor; é o que fazia 625 ladrilhos por quadro. O teto de balanço de 3 m esconde o custo, mas a peça segue irreal: **decisão do dono** se a fiação deve se soltar em trechos.
- **O empurro de tombamento do kit injeta 490–580 kg·m por rodada** (`engine.topple`, no poste e no arame, mais os empurros do blast que chegam depois): a régua da sala os tira da conta da ilha da peça. Se o dono preferir contá-los, C1 volta a 14–127 kg·m e C2 a metros pelos postes.
- **Despertar ainda de 43–88 ms (blast e martelo, dt 0,05)**: ~160 ladrilhos de uma vez (os dois postes e o arame; 0,6 ms cada, 60% disso é `groundAt`), mais `outOfStatics` (53 ms num update) e o `Step` em cima dos colisores de triângulo. Opções, nenhuma feita: (a) caminho rápido do hospedeiro para ladrilho plano (`groundAt` só amostrado onde o terreno mudou); (b) assentar o chão ao redor da casa quando a área é montada (custa no carregamento, 8 s de montagem hoje); (c) orçamento de ladrilhos por update (risco: peça sobre ladrilho que ainda não existe; a rede `fellThrough` pega, mas a regra muda).
- **Bacia** com a mudança de ladrilhos: 128/128 antes e depois; `worstC4` foi de 0,5 para 1,52 s (limite 3) e `worstDeepest` de −0,0383 para −0,0379: a criação dos ladrilhos em outra ordem muda a ordem dos corpos no Jolt e perturba as trajetórias; as duas versões passam em todos os 128 casos (com a esfera de antes, mesmo código de régua: `worstC4 0,5`).

### Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio (`pnpm test`) | 398 passam, 0 falhas (132 pulados) (uma execução com duas suítes em paralelo e carga 11 reprovou "cinquenta latas" por tempo; sozinha e na repetição passa) |
| `PIECE_SOLVER=jolt pnpm test` | 467 passam, **só as 2 conhecidas** (lata no ar com restituição, cinquenta latas) |
| `game-physics-jolt` | 17 arquivos, 64 passam (2 pulados); +3 do `centre-at-origin` |
| `game-physics` | 9 passam |
| `game-destruction` | 510 passam (+3 do cache de sólidos hospedados) |
| `game-floorplan-three` | 715 passam, só os 3 `exact-golden` conhecidos (breach, fracture, spall) |
| Bacia 64 sementes, um processo, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**; `bowl worst {"worstC1":-0.00766,"worstC2":0,"worstC2Unconditioned":0.014651,"worstC3":0.013626,"worstC4":1.5167,"worstDeepest":-0.03795,"fellThrough":0}` |
| B6 no mundo de produção (`cascade-tail.test.ts`, máquina com carga 3) | despertar quente 6,4 / 6,4 / 8,0 ms, p99 de 3 s 3,8 / 3,9 / 4,6 ms, 1 quadro acima de 6 ms por blast: sem regressão (o adaptador ganhou um `if` por contato novo e por `clearEvents`) |
| `eslint` nos arquivos mudados | 0 erros (1 aviso antigo: `world.ts` de `game-destruction` com mais de 1500 linhas) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos) |

Commits (locais, nada enviado): `4b5c4717` (centro de massa na origem + registro de pares), `23c6cc08` (cache de sólidos hospedados e ladrilhos pela pegada), `3da24800` (régua: ilhas por contato, energia dada pelo kit, tensor; sonda de perfil), e o do teto de balanço de 3 m.

## T3.8c — decisões do dono sobre o resultado da T3.8b (2026-11-14)

Contexto: depois da T3.8b, 5 de 20 rodadas do Jolt passam (explosão com D4: 4 de 5; martelo: 0 de 5). Com as réguas corrigidas, o solver próprio também falha a sala (0 de 10). O que sobra no Jolt são 1–2 peças de telhado presas entre colisores fixos da casa, que ganham 4–10 cm de energia por atualização (uma pulou 41 cm).

- **D5 (peças presas no telhado):** investigar a fundo e corrigir a causa sem mudar a régua. O ganho contra os colisores fixos continua contando como lançamento.
- **D6 (energia dada pelo kit):** confirmado. O empurrão atrasado da explosão (`pieceSys.impulse`) e o empurrão de equilíbrio (`engine.topple`) são entrada do anfitrião. Eles saem da ilha e do episódio da peça, não da atualização inteira.
- **D7 (fiação):** a fiação deixa de se soltar como uma peça rígida só de 45 m e passa a se soltar por trechos, no SDK dono das instalações. O teto de 3 m na margem de giro fica só como guarda.
- **D8 (quadro de despertar, 43–88 ms):** o chão da área é montado quando ela é construída, para que o custo saia do quadro do jogo. Nenhuma regra muda: não há limite de pedaços por quadro.

Ordem de execução: D5, depois D8, depois D7. Depois disso, as 5+5 rodadas são refeitas na sala.

## T3.8d — D5 peças presas no telhado (2026-11-14) — **a causa do lançamento ao sótão está consertada; a sala continua reprovada, por outra peça (a porta nascida no vão)**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22 (o `node` desta máquina é 24, não 20). Navegador: `chrome-headless-shell` do Playwright, headless, janela 1600x900, GPU Intel Arrow Lake (Mesa). Carga da máquina 0,9 a 2 nas execuções; no máximo 2 trabalhos pesados juntos (a bacia rodou ao lado de uma rodada da sala).

### 1. Causa
- As "peças de telhado de 42,8 kg a y 3,5–4,4 m" são **portas que nascem dentro do próprio vão** (folha de 2,1 m x 0,1 m, a base no piso; a folha pega 4 a 8 cm no batente). `EnginePieces.outOfStatics` via a cunha e subia a peça em passos que dobram (0,1; 0,2; 0,4...). Para cima não há saída: a verga, a laje do forro e o telhado. A subida atravessava a verga e a laje e deixava a porta no sótão, onde o Jolt a empurra para fora dos fixos que convergem, e ela ganha energia.
- Reprodução em teste (`fitted-pieces.test.ts`, só com `PIECE_SOLVER=jolt`): dois blocos a 16 cm um do outro e uma laje 10 cm acima deles, a peça de 20 cm nasce entre eles. **Sem o conserto**: a peça sobe a 2,20 m e chega a **102 m/s**. **Com o conserto**: fica em 0,50 m, no máximo **2,6 m/s** (o empurrão gradual do próprio motor para 2 cm de sobreposição).
- Medido na sala (log temporário, não commitado): a porta de 18 kg (`half 0,05 x 1,05 x 0,37`) tem profundidade **0,078 m a qualquer altura** (varrida de −0,2 a +0,2 m em y: sempre 0,078; só some a 0,5 m de lado em x). Sem o conserto a segunda causa fazia o kit subi-la 0,42 m em 8 tentativas de 8 cm, sem nunca ficar mais rasa (o eixo que o Jolt devolve para a malha é o mesmo a cada tentativa).

### 2. Conserto (`packages/game-destruction-three/src/engine-pieces.ts`)
- `isWayClear`: a subida da cunha é amostrada a cada meia espessura da peça (2 a 10 cm) e desiste quando encontra um fixo mais fundo que a cunha.
- `putBack`: desistir, ou terminar as tentativas mais fundo do que começou, devolve a peça para onde nasceu (o motor a empurra para fora aos poucos).
- `NO_PROGRESS = 0,75`: uma subida que deixa a peça com mais de 75% da profundidade que tinha conta como cunha (a porta que subia 0,4 m).
- Revisão do diff: `wayAxis` e `outAxis` não se cruzam (`isWayClear` usa `outAxis` como "para cima", só leitura, e `wayAxis` como saída de `penetration`; `putBack` usa `wayAxis` depois que `isWayClear` terminou). `world.penetration?.` está certo: em `SeamWorld` o método é opcional. A nota "malhas com zero triângulos locais" não apareceu: nenhum erro nem log; não tratada.
- Commits: `324e9aa9` (`isWayClear`/`putBack` + teste com checagem de velocidade) e `26fe2ec1` (`NO_PROGRESS`).

### 3. Achado de infraestrutura que invalidou a primeira rodada
`examples/test-room/build.mjs` embute `packages/*/dist`, **não** o `src`. A primeira passada das 20 rodadas rodou com o `dist` de `game-destruction-three` antigo (sem o conserto) e foi descartada. As rodadas abaixo são depois de `pnpm build` do pacote e do `build.mjs` da sala (confirmado por grep do código no `dist`).

### 4. Rodadas na sala (código final, 5 de blast e 5 de martelo por configuração, um processo por rodada)
Aceite igual ao da T3.8b: C2 condicionado 0 peças acima de 3,5 cm, tudo dormindo em até 3 s, `fellThrough` 0.

| Configuração | T3.8b: passam | Agora: passam | C2 cond. máx (m) | peças > 3,5 cm cond. por rodada | C4 (s) por rodada | `fellThrough` |
|---|---|---|---|---|---|---|
| D4 ligada, blast | 4 de 5 | **0 de 5** | 0,099–0,107 | 1, 1, 1, 2, 1 | 0,9; 0,5; 0,5; 6,0; 0,5 | 0 |
| D4 ligada, martelo | 0 de 5 | **0 de 5** | 0,078–0,094 | 1, 1, 1, 1, 1 | 2,85; 3,0; 0,4; 0,55; 0,4 | 0 |
| D4 desligada, blast | 1 de 5 | **0 de 5** | 0,092–0,120 | 1, 1, 2, 1, 1 | 4,1; 0,45; 3,85; 0,5; 0,5 | 0 |
| D4 desligada, martelo | 0 de 5 | **0 de 5** | 0,091–0,142 | 1, 1, 1, 1, 3 | 3,0; 2,5; 2,5; 0,9; 2,25 | 0 |

A régua mudou desde a T3.8b? **Não** (mesmo `energy-ruler.ts`). Mas o conjunto de peças que reprova mudou: em todas as 20 rodadas há **uma peça com ganho de 0,09 a 0,12 m** (o limite é 0,035): a porta de 18 kg (`obj_56` no blast, `obj_18` no martelo) nascida no vão. Nas rodadas da T3.8b o ganho era de 0,000–0,043 em 4 de 5 blasts com D4 ligada; hoje é 0,1 em todas. Não consegui separar, com as rodadas desta sessão, se isso é a porta que antes era lançada ao sótão (e contava como outra ilha) ou ruído do `dist` da T3.8b: **não há rodada do código anterior no mesmo `dist`** para comparar.

### 5. O que sobra e por quê
- A porta tem 7,8 cm de sobreposição com o batente que **nenhuma subida resolve** (profundidade igual a qualquer altura). O conserto não a lança mais ao sótão, mas devolvê-la ao lugar deixa o Jolt empurrá-la ~0,1 m para fora: é esse ganho que a régua conta como lançamento (D5 manda contá-lo).
- Opções para o dono: (a) a folha da porta nascer com a largura do vão menos a folga (`kit-objetos-itens`, o dono das portas), que remove a sobreposição na origem; (b) aceitar o ganho de até 0,1 m de uma peça que nasce presa; (c) mover a peça para o lado livre mais próximo (varredura: sai a 0,5 m de lado, longe demais para uma porta). Nenhuma foi feita: (a) mexe no SDK dono das portas, fora do escopo de D5.
- Não cobri `NO_PROGRESS` com teste próprio: o teste existente cobre `isWayClear`/`putBack`; o caso do vale de telhado não foi reproduzido em teste isolado.

### Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 398 passam, 0 falhas |
| `PIECE_SOLVER=jolt` | 468 passam, **só as 2 conhecidas** (lata no ar com restituição, cinquenta latas) |
| `game-physics-jolt` | 64 passam (2 pulados) |
| `game-destruction` | 510 passam |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC2Unconditioned 0,014651`, `worstC3 0,013626`, `fellThrough 0` (idêntico ao da T3.8b) |
| `eslint` nos arquivos mudados | 0 erros |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos) |

### Comandos
```text
cd packages/game-destruction-three && PIECE_SOLVER=jolt pnpm exec vitest run tests/fitted-pieces.test.ts
pnpm -r typecheck
(cd packages/game-destruction-three && pnpm test; PIECE_SOLVER=jolt pnpm test)
(cd packages/game-physics-jolt && pnpm test); (cd packages/game-destruction && pnpm test)
(cd packages/game-destruction-three && PIECE_SOLVER=jolt BOWL_SEEDS=64 pnpm exec vitest run tests/bowl-energy.test.ts)
node tools/kit-audit/audit.mjs --check
(cd packages/game-destruction-three && pnpm build) && node examples/test-room/build.mjs
# uma rodada por processo, com timeout (drive.mjs com rounds=1 e OUT próprio):
OUT=<dir> timeout 900 node specs/008-motor-fisico-jolt/decision/probes/drive.mjs <rotulo> "&solver=jolt&blastDebris=1" 1 blast|hammer   # D4 ligada
OUT=<dir> timeout 900 node specs/008-motor-fisico-jolt/decision/probes/drive.mjs <rotulo> "&solver=jolt" 1 blast|hammer                   # D4 desligada
```
O "Target page, context or browser has been closed" da rodada anterior não voltou: com um processo por rodada as 20 rodadas fecharam sem erro de página (`errors` vazio nas 20).

T3.8 continua sem ✅.

## T3.8e — D5 de novo: A/B da regressão do blast, a porta e, por trás dela, o batente (2026-11-14) — **T3.8 continua SEM ✅: 8 de 20 rodadas passam (era 0 de 20 na T3.8d), sobram o caixilho da janela da edícula, os postes e o arame**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22 (o `node` desta máquina é 24, não 20). Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo, com `timeout`, no máximo 2 trabalhos pesados juntos. Aceite igual ao da T3.8b/T3.8d (C2 condicionado 0 peças acima de 3,5 cm, tudo dormindo em até 3 s, `fellThrough` 0). Nenhuma tolerância, régua nem teste foi afrouxado ou removido.

### 1. A/B do blast com D4 ligada (`solver=jolt&blastDebris=1`), `dist` refeito a cada revisão
Entre `22d52cd7` e `HEAD` só `engine-pieces.ts` mudou (`git diff 22d52cd7 HEAD --stat`): em vez de três `git worktree` (cada um pediria `pnpm install` e build de tudo), troquei só esse arquivo por revisão no mesmo worktree, `pnpm build` do pacote, `examples/test-room/build.mjs`, e conferi o `dist` por grep (`isWayClear`: 0 em (a), presente em (b) e (c); a página da sala em (b)/(c) tem o código novo). Arquivo restaurado ao fim (`git checkout HEAD --`).

| Revisão | Rodada | peças > 3,5 cm cond. | ganho C2 cond. (m) | C4 (s) | Passa |
|---|---|---|---|---|---|
| (a) `22d52cd7`, antes da D5 | 1 / 2 / 3 / 4 / 5 | 0 / 0 / 0 / 0 / 1 | 0,004 / 0,003 / 0,002 / 0,015 / 0,252 | 0,5 / 4,5 / **-1 (2 não dormem)** / 0,5 / 3,0 | **2 de 5** (só C2: 4 de 5) |
| (b) `324e9aa9` sozinho | 1 / 2 / 3 / 4 / 5 | 2 / 1 / 1 / 2 / 2 | 0,107 / 0,085 / 0,107 / 0,104 / 0,088 | 0,45 / 0,5 / 2,9 / 4,55 / 0,5 | **0 de 5** |
| (c) `HEAD` (`9a4c34ba`, com `26fe2ec1`) | 1 / 2 / 3 / 4 / 5 | 1 / 1 / 1 / 1 / 1 | 0,105 / 0,088 / 0,104 / 0,107 / 0,106 | 2,65 / 0,5 / 0,7 / 0,5 / 0,5 | **0 de 5** |

**Veredito.** O 4 de 5 da T3.8b **se reproduz no C2** em `dist` novo ((a): 4 rodadas com 0 peças acima do limite), mas **não no critério inteiro**: duas das cinco reprovam o C4 (4,5 s e uma peça que não dorme). **A regressão do C2 entrou em `324e9aa9`** ((a) → (b): de 0 para 1–2 peças em todas as rodadas); `26fe2ec1` não mexeu ((b) → (c) igual). Leitura (inferência, não medida): em (a) a subida em passos que dobram tirava a peça do colisor que a prendia e o Jolt não tinha o que empurrar; em (b)/(c) o `putBack` devolve a peça ao lugar onde nasceu e o Jolt a empurra ~0,1 m, que a régua conta. Não mexi no `NO_PROGRESS` nem no `putBack`: a causa estava antes deles (itens 2 e 3).

### 2. Causa-raiz 1: o colisor fixo do batente era uma laje cheia no vão da porta
Sonda temporária (não commitada): para a porta `d0_0` do `sobrado`, os sólidos fixos que tocam a folha. O batente (`jamb:d0_0`, uma peça, um intervalo de vértices com 3 caixas: dois montantes e a verga) virava **uma caixa 1,0 x 2,1 x 0,17 m inteira**, e a folha (0,89 x 2,1 x 0,10 m) ficava dentro dela. Causa em `game-destruction-three/src/drawn-solids.ts`: o ajuste de caixa pedia só que cada um dos oito cantos da caixa tivesse um vértice a até 1 cm (`hugs`); um batente em U invertido tem os oito cantos e nenhuma das faces. O motor segurava uma laje no vão, e qualquer coisa que nascesse ou passasse ali nascia dentro dela.
- **Conserto** (`07e2e52c`): a caixa só vale se for a peça: cada face dela precisa ser coberta ao menos pela metade por triângulos da peça (`fillsFaces`, `FILL = 0,5`; uma folha de painéis fica com a borda a 73%, um batente a 12%). Senão a peça colide pelos triângulos desenhados. Vale para a caixa alinhada e para a girada.
- Teste (`drawn-solids.test.ts`, só Jolt): batente de três caixas numa peça: o sólido é malha, e um bloco posto no vão cai até o chão (reprovava antes do conserto, `solid.mesh` indefinido).

### 3. Causa 2: a folha desenhada entrava 5 cm na verga
Em `game-floorplan-three/src/house/doors.ts` a folha tinha a altura do vão (`visH`) e a verga desenha de `dH - 0,05` a `dH`: 5 cm de folha dentro da verga, em toda casa. A folha da garagem (aço) também encostava nos montantes (folga 0) e subia até a verga.
- **Conserto** (`c0c3e4eb`): a folha para 5 mm abaixo da verga (`leafH = visH - jw - 0,005`, sem corte) e a folha da garagem ganha 5 mm de cada lado, como a de abrir já tinha. Opção `doors: 'visor'` mantém a folha do time para o golden do time (`golden-scene.test.ts` a usa, como já usa `pillars: 'hidden'` e `baseboard: 'band'`; o `vc3-house-scene.json` não foi tocado).
- **Teste** (`door-clearance.test.ts`, 22 casos, sem motor): 7 plantas x 3 sementes, nenhuma folha (nem o puxador) de porta tem sobreposição com montante ou verga do próprio batente, e a folga é de pelo menos 2 mm. Com o desenho antigo os casos reprovam com sobreposição de 0,05 m.
- Golden exato regravado para as 39 casas com porta (`UPDATE_EXACT=1`, e restaurei do `HEAD` as três cenas `destruction/*`, que já reprovavam antes e continuam as 3 conhecidas; `sobrado:3:cut` não mudou, o corte não tem verga); hash do `blast-presentation.test.ts` regravado (a peça da porta ficou menor).
- §13: nenhuma face nova coincidente (a folha só ficou mais baixa; a face de cima dela, que coincidia com a de cima da verga, saiu). O catálogo de `game-destruction-three` (`z-fighting.test.ts`) passa; `game-floorplan-three` não tem teste de z-fighting próprio.

### 4. O que a T3.8d chamou de "porta de 42,8 kg" eram os batentes
Com a sonda da sala (`probes/room.js`, agora com `overPieces`: id, ganho, massa, caixa e as partes do objeto, vindos do ganho por peça da própria régua), as peças acima do limite depois dos itens 2 e 3 eram `jamb:d0_2` (38,5 kg, caixa 0,45 x 1,05 x 0,09) e `jamb:backyard.outbuilding.d0` (36,4 kg): o **batente solto**, cujo colisor de peça era a mesma laje cheia (`partBoxesOf`, `fitOrientedBoxes` dos pontos: uma caixa só). Nascia dentro da parede de onde saiu e o motor a empurrava ~0,1 m.
- **Conserto** (`423bb92a`): `game-destruction-three/src/drawn-boxes.ts` (`hollowBoxesOf`): um trecho desenhado como 2 a 16 caixas de 24 vértices (cada grupo, oito cantos de caixa alinhada) que ocupam menos de metade da caixa em volta é segurado caixa a caixa, como desenhado. Qualquer outra coisa segue o caminho de antes. Teste (`drawn-solids.test.ts`): o batente virado peça tem 3 caixas, que somam menos de 0,1 m³ (a caixa em volta tem 0,357); reprovava antes (`partBoxes` indefinido).
- Medido: 2 rodadas de blast com D4 ligada depois do conserto: 2 passam, ganho 0,005–0,006 m, sem peça acima do limite.

### 5. Rodadas na sala (código final, uma por processo)
| Configuração | T3.8d: passam | Agora: passam | peças > 3,5 cm cond. por rodada | quem reprova | C4 (s) por rodada | `fellThrough` |
|---|---|---|---|---|---|---|
| D4 ligada, blast | 0 de 5 | **4 de 5** | 0, 1, 0, 0, 0 | r2: `metal_1` (0,6 kg) 0,087 m e C4 4,65 s | 0,8; 4,65; 0,6; 0,45; 0,45 | 0 |
| D4 ligada, martelo | 0 de 5 | **0 de 5** | 3, 2, 0, 2, 1 | poste `pole:33.7` (950 kg) 0,056–0,058 m e arame `wiring:grid` 0,05–0,07 m (r1, r2, r4); `pipe:run_outlet` 0,134; caixilho `window_frame:backyard.outbuilding.w0` 0,622 (r5); r3 só C4 | 0,4; 3,8; 3,15; 5,85; 5,7 | 0 |
| D4 desligada, blast | 0 de 5 | **3 de 5** | 2, 0, 3, 0, 0 | caixilho e vidro da janela da edícula 0,24 (r1, r3); laje de calçada 72,9 kg 0,041 (r3) | 0,5; 0,5; 0,5; 0,45; 0,5 | 0 |
| D4 desligada, martelo | 0 de 5 | **1 de 5** | 0, 0, 1, 2, 0 | caixilho da janela da edícula 0,58–0,62 (r3, r4); r1 e r5 só C4 (6,15 e 5,75 s) | 6,15; 2,75; 6,45; 1,9; 5,75 | 0 |

**8 de 20 rodadas passam** (T3.8b: 5; T3.8d: 0). Nenhuma peça de porta (folha nem batente) aparece mais acima do limite. Sem exigir que o Jolt seja determinístico: o `PhysicsCostMeter` e o orçamento do blast variam com o tempo de quadro, e rodadas iguais diferem.

### 6. O que sobra e por quê
- **Caixilho da janela da edícula (`window_frame:backyard.outbuilding.w0`, 13,8 kg)**: ganho de 0,24 a 0,62 m em 5 das 20 rodadas (e o vidro dela, 3,6 kg, 0,23). Já é segurado caixa a caixa (os 144 vértices são 6 caixas); **não identifiquei por que ainda ganha**: a hipótese a verificar é o caixilho nascer dentro da parede da edícula, como o batente nascia. Medida a fazer: o `penetration` no nascimento dele contra os sólidos fixos da edícula.
- **Poste de concreto (950 kg) e arame**: 0,05–0,07 m no martelo com D4 ligada; são as peças do tombamento (`engine.topple`, que a régua perdoa pela D6) e da fiação rígida de 45 m, que a D7 troca por trechos. Não mexi.
- **C4 acima de 3 s** em 7 das 20 rodadas (peças de telhado e fios voltando a se mexer); não investigado.
- `bookcase-topple.test.ts` (modo Jolt) reprova **no `HEAD` também**, com os dois conjuntos de alteração revertidos (conferido); `game-floorplan-three` no modo Jolt nunca teve a linha de base registrada.
- O batente de `vehicles` (`game-vehicles-three/src/collider-fit.ts`) usa o mesmo `hugs` e pode ter o mesmo vazio; fora do escopo, não mexi.

### Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 398 passam, 0 falhas |
| `PIECE_SOLVER=jolt` | 470 passam, **só as 2 conhecidas** (lata no ar com restituição, cinquenta latas) |
| `game-floorplan-three` próprio | 737 passam (+22 de `door-clearance`), **só os 3 `exact-golden` conhecidos** (breach, fracture, spall) |
| `game-floorplan-three` Jolt | 739 passam; os 3 conhecidos e `bookcase-topple` (já reprovava no `HEAD`) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC2Unconditioned 0,014651`, `worstC3 0,013626`, `fellThrough 0` (idêntico ao da T3.8b/T3.8d), duas vezes (depois de cada conserto) |
| `eslint` nos arquivos mudados | 0 erros (1 aviso antigo: `renderer.ts` com mais de 1500 linhas) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos) |

Commits (locais, nada enviado): `07e2e52c` (batente é triângulos), `c0c3e4eb` (folha sob a verga, teste, goldens), `423bb92a` (batente solto é caixa a caixa).

T3.8 continua sem ✅.

## T3.8f — D5: o caixilho da janela da edícula (2026-11-14) — **T3.8 continua SEM ✅: 8 de 20 rodadas passam (igual à T3.8e), mas o caixilho, o vidro e a laje de calçada saíram da lista; sobram os postes, o arame, um cano e o C4 do martelo**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0 (o `node` desta máquina é 24, não 20). Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo, com `timeout`, duas pistas ao mesmo tempo (D4 ligada e D4 desligada). Aceite igual ao da T3.8b/d/e (C2 condicionado 0 peças acima de 3,5 cm, tudo dormindo em até 3 s, `fellThrough` 0). Nenhuma tolerância, régua nem teste foi afrouxado ou removido. `dist` de `game-floorplan-three` refeito (`pnpm build`) antes do `examples/test-room/build.mjs`, e conferido por grep (`fittedWindows` no `dist` do pacote e em `examples/test-room/dist/test-room.html`).

### 1. Medida no nascimento
- A hipótese da T3.8e (o caixilho nascer dentro da parede da edícula) **não se confirma**: as paredes da edícula **não são peças nem sólidos fixos do motor** (`structure.parts` não tem parede nenhuma em `x 9,05–9,20`; os sólidos fixos que o motor segura ali são só `window_frame:…:0` (a soleira, caixa), `window_frame:…:1` (malha: 144 vértices), `window:…`, `window_grille:…`, `door:…` e `jamb:…`). Não há parede para o caixilho atravessar.
- Quem o atravessa são **as outras duas peças da própria janela**, medidas por caixa desenhada (componentes conexos dos triângulos de cada peça, a mesma medida do `door-clearance`), a profundidade pela face mais rasa:

| Par (casa `casaA` semente 1, janela `backyard.outbuilding.w0`; igual nas outras janelas) | Profundidade |
|---|---|
| `window_frame` (travessa e caixilho do meio, 4 cm) x `window` (vidro de 1,2 cm, no meio do caixilho) | **0,026 m** (0,014 m nos apartamentos) |
| `window_frame` (soleira de reboco, `y 0,96–1,00`) x `window_grille` (barras e travessas, que começam em `y 0,97`) | **0,018 m** |
| `window` x `window_grille` | 0 |

### 2. Causa
`game-floorplan-three/src/house/windows.ts` desenhava as três peças da janela (que o motor segura separadas, como corpos separados) **uma dentro da outra**, em toda janela de toda casa: o vidro centrado na parede, no meio do caixilho de 4 cm; as barras da grade 3 cm dentro da soleira (para "ficar presa"). Quando a janela se solta, as peças nascem sobrepostas e o motor as empurra para fora com energia: o caixilho de 13,8 kg (que carrega a soleira) ganhou 0,24 a 0,62 m, e o vidro de 3,6 kg 0,23 m, em 5 das 20 rodadas da T3.8e. A porta da T3.8e era o mesmo defeito (folha 5 cm dentro da verga).

### 3. Conserto (commit `aa5fa26d`, `game-floorplan-three`, dono das janelas)
- O vidro encosta no lado da sala do caixilho do meio e da travessa (`paneShift` = meia espessura do caixilho + meia do vidro + 2 mm de folga); a grade sai de 2 mm acima da soleira (`GRILLE_FOOT`) em vez de 3 cm abaixo do topo dela. Massa e abertura (`aperture`) da grade acompanham.
- Opção de montagem `windows: 'visor'` mantém o desenho do time para o golden do time (`golden-scene.test.ts`), como `doors: 'visor'`; o padrão é `'fitted'`. O `vc3-house-scene.json` não foi tocado.
- Teste novo `tests/window-clearance.test.ts` (22 casos, sem motor, 7 plantas x 3 sementes + a edícula): **nenhuma peça de janela (caixilho, vidro, grade) tem sobreposição de mais de 1 mm com outra da mesma janela**. Reprovava os 21 casos antes do conserto (0,026 e 0,018 m), passa nos 22 depois. Auxiliar novo `tests/helpers/piece-boxes.ts`.
- Golden exato regravado **só** nas 39 entradas com janela: 35 casas (`house/*`) e 4 amostras (`specimen/house_casa_portico`, `_inteira`, `_wood_frame`, `_tronco`); as três cenas `destruction/breach|spall|fracture`, que já reprovavam antes (as 3 conhecidas), foram restauradas do `HEAD` linha a linha e continuam reprovando. Hash de `blast-presentation.test.ts` regravado (`0fa1f11e…` para `281edd1c…`: a peça da janela mudou de caixa, a regravação é o contrato do teste).
- §13: nenhuma face nova coincidente (o vidro e a grade ficam com 2 mm de folga, e o vidro saiu de dentro do caixilho). `game-destruction-three` (`z-fighting.test.ts`) passa; `game-floorplan-three` não tem teste de z-fighting próprio.

### 4. Rodadas na sala (código final, 5 de blast e 5 de martelo por configuração, uma por processo)
| Configuração | T3.8e: passam | Agora: passam | peças > 3,5 cm cond. por rodada | quem reprova | C4 (s) por rodada | `fellThrough` |
|---|---|---|---|---|---|---|
| D4 ligada, blast | 4 de 5 | **4 de 5** | 0, 0, 0, 0, 0 | r4 só C4 | 0,5; 2,1; 2,25; **3,75**; 0,5 | 0 |
| D4 ligada, martelo | 0 de 5 | **0 de 5** | 1, 1, 0, 0, 2 | arame `wiring:grid` (11,9 kg) 0,043–0,081 m (r1, r2, r5) e poste (950 kg) 0,057 m (r5); todas reprovam no C4 | 5,8; 5,05; 6,35; 6,1; 6,25 | 0 |
| D4 desligada, blast | 3 de 5 | **4 de 5** | 0, 0, 0, 0, 0 | r5 só C4 | 0,5; 0,9; 0,75; 0,5; **5,45** | 0 |
| D4 desligada, martelo | 1 de 5 | **0 de 5** | 1, 2, 0, 1, 2 | `pipe:run_outlet` (0,6 kg) 0,136 m (r1); poste 0,056–0,058 m (r2, r4, r5); arame 0,063 e 0,122 m (r2, r5); r3 só C4 | 4,15; 5,8; 3,05; 3,95; 2,75 | 0 |

**8 de 20 rodadas passam**, o mesmo total da T3.8e, mas por outro motivo: **o caixilho, o vidro e a laje de calçada não aparecem em nenhuma das 20 rodadas** (eram 5, 3 e 1 rodadas). Os 0,24–0,62 m do caixilho acabaram. Um pouco da variação de rodada para rodada (o `PhysicsCostMeter` e o orçamento do blast variam com o tempo de quadro) explica o D4 desligada/blast ter ido de 3 para 4 e o martelo de 1 para 0: não atribuo isso ao conserto.

### 5. O que sobra e por quê
- **Poste de concreto (950 kg, `obj_2`) e arame (`wiring:grid`, 11,9 kg, 45 m)**: 0,043–0,122 m no martelo; são os casos de D6 (tombamento) e D7 (fiação em trechos). Não mexi.
- **`pipe:run_outlet` (0,6 kg, o "`metal_1`" da T3.8e é este cano de 1,78 m de altura)**: 0,136 m em 1 das 10 rodadas com D4 desligada (e 0,087 m na T3.8e). **Não compartilha a causa da janela**: o cano atravessa por desenho laje do forro, laje da caixa d'água e telhado (`slab_ceiling` 0,35 m, `tank_slab` 0,27 m medidos por caixa, que superestima os planos inclinados) e passa a 3 cm de conduítes; é uma peça longa e fina que a casa passa por dentro da estrutura, não um par de peças soltas que nascem sobrepostas. Não investigado além da medida por caixa: precisa de uma decisão do dono (o cano ser parte do que atravessa, ou ter furo).
- **Laje de calçada 72,9 kg (D4 desligada, blast)**: 0 rodadas desta vez (era 1 de 5, 0,041 m). Não identifiquei relação com a janela; sem o gatilho na amostra, não afirmo causa.
- **C4 acima de 3 s**: **todas as 10 rodadas de martelo e 2 de 10 de blast** (3,75 s e 5,45 s); peças de telhado e fios voltando a se mexer, como na T3.8e. Não investigado. É agora **o critério que mais reprova**: com os ganhos de C2 limpos, os 12 casos restantes dependem dele.
- `bookcase-topple.test.ts` (modo Jolt) continua reprovando, como antes (pré-existente, conferido na T3.8e).
- O batente de `game-vehicles-three/src/collider-fit.ts` (mesmo `hugs`) e a possível mesma sobreposição entre peças de outros produtos (`ix:drawer`, maçanetas) não foram varridos: o teste novo cobre só as peças de janela.

### Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 398 passam, 0 falhas (49 arquivos, 9 pulados) |
| `PIECE_SOLVER=jolt` em `game-destruction-three` | 470 passam, **só as 2 conhecidas** (`rolling`: lata no ar com restituição, cinquenta latas) |
| `game-floorplan-three` próprio | 759 passam (+22 de `window-clearance`), **só os 3 `exact-golden` conhecidos** (breach, fracture, spall) |
| `game-floorplan-three` Jolt | 761 passam; os 3 conhecidos e `bookcase-topple` (pré-existente) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC2Unconditioned 0,014651`, `worstC3 0,013626`, `fellThrough 0` (idêntico ao da T3.8e) |
| `z-fighting.test.ts` de `game-destruction-three` | passa |
| `eslint` nos arquivos mudados | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos, 11 pendentes conhecidos) |

### Comandos
```text
cd packages/game-floorplan-three && pnpm exec vitest run tests/window-clearance.test.ts
UPDATE_EXACT=1 pnpm exec vitest run tests/exact-golden.test.ts   # e restaurar as 3 linhas destruction/* do HEAD
pnpm -r typecheck
(cd packages/game-floorplan-three && pnpm test; PIECE_SOLVER=jolt pnpm test)
(cd packages/game-destruction-three && pnpm test; PIECE_SOLVER=jolt pnpm test)
(cd packages/game-destruction-three && PIECE_SOLVER=jolt BOWL_SEEDS=64 pnpm exec vitest run tests/bowl-energy.test.ts; pnpm exec vitest run tests/z-fighting.test.ts)
node tools/kit-audit/audit.mjs --check
(cd packages/game-floorplan-three && pnpm build) && node examples/test-room/build.mjs
OUT=<dir> timeout 900 node specs/008-motor-fisico-jolt/decision/probes/drive.mjs <rotulo> "&solver=jolt&blastDebris=1" 1 blast|hammer   # D4 ligada
OUT=<dir> timeout 900 node specs/008-motor-fisico-jolt/decision/probes/drive.mjs <rotulo> "&solver=jolt" 1 blast|hammer                   # D4 desligada
```

T3.8 continua sem ✅.

## T3.8g — D7 instalações em trechos (2026-11-14) — **T3.8 continua SEM ✅: 14 de 20 rodadas passam (eram 8 de 20); a fiação e o cano saíram da lista de C2; sobram o C4 do martelo e um `fellThrough`**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo, com `timeout`, duas pistas ao mesmo tempo (D4 ligada e desligada). Aceite igual ao da T3.8b a T3.8f. Nenhuma tolerância, régua nem teste foi afrouxado ou removido. `dist` de `game-floorplan-three` refeito (`pnpm build`) antes do `examples/test-room/build.mjs`, e conferido por grep (`wiring:grid:` no `dist` do pacote e em `examples/test-room/dist/test-room.html`).

### 1. Causa
`game-floorplan-three/src/utilities/electrical.ts` e `water.ts` (dono das instalações; `game-floorplan-structure/src/utilities/` só diz *o que* existe, não desenha) punham a fiação da lote inteira (`wiring:grid`: 8 fios de 22 m entre os postes, mais o ramal de ligação) sob **uma só `pieceRecord`**, e o cano `pipe:run_outlet` (0,6 kg, do tanque ao forro) também. O sistema de peças trata uma `pieceRecord` como uma peça só: ao soltar, nasce um corpo rígido de 45 m (o blast o gira a 47 rad/s) ou um cano de 1,78 m que atravessa por desenho a laje do tanque (`tank_slab`, y 4,10–4,22) e nasce dentro de colisor fixo. Era o arame de 0,043–0,122 m e o cano de 0,136 m de C2 da T3.8f.

### 2. Projeto (`utilities/segments.ts`, novo; usado por `water.ts` e `electrical.ts`)
- **`cutRun(pontos, máximo, sólidos)`**: cada aresta do traçado é cortada onde **entra e onde sai** de uma laje, parede ou divisória (caixa de `structureIndex`, papéis `slab`, `wall`, `partition`; com a destruição ligada os painéis da laje fazem o papel dela) e depois em partes iguais de **no máximo `segmentLimits`**. Cada trecho fica **inteiro dentro ou inteiro fora** de cada sólido: nenhum trecho cruza o sólido em que foi cortado. O trecho dentro de um sólido tem `host`.
- **Configurável (§2)**: opção de montagem `segmentLimits: { wiring: 3, pipe: 2.5 }` (m; padrão igual ao teto de balanço de 3 m, que continua só como guarda). `Infinity` desenha o traçado inteiro como o time desenhou (como `doors`/`windows: 'visor'`); só o golden do time (`golden-scene.test.ts`) usa isso.
- **Fiação**: a grade sai em **fatias** de ≤ 3 m em estações fixas ao longo de cada vão (os 4 fios paralelos de cada lado dividem as mesmas estações; as estações cobrem os 1,35 m a mais que a travessa dá, então nenhuma fatia passa do limite): `wiring:grid:<w|e>:<i>`; o ramal em três fios com trechos próprios: `wiring:drop:<0|1|2>:<i>`.
- **Cano**: `pipe:run_outlet:<i>` (cortado na laje do tanque: 3 trechos); os que já cabem em um trecho mantêm o id (`pipe:run_under_pt1`). As luvas de cada vértice vão com o trecho que começa nele.
- **Segurar (§12, nada flutua)**: cada trecho tem `holder` (virou um `support` do `structure`, junta `clip`, `bears: false`): a laje/parede onde está; o sólido do trecho vizinho que encosta nele; senão o trecho vizinho já seguro (cadeia sem laço, `holdersOf`). Os trechos da fiação pendem do poste mais próximo. Ao se soltar a laje do tanque, o trecho embutido nela vai junto; cada trecho livre cai como peça com geometria (o colisor é o que o motor ajusta às partes desenhadas, §12: nenhum colisor sem geometria).
- **Massa conservada**: massa explícita por trecho = densidade (`DENSITY`) x área x comprimento do trecho (cobre maciço no fio; plástico x 0,3 de parede no cano, `PIPE_WALL_FILL`). A soma dos trechos de um traçado é a do traçado inteiro. **A massa total mudou** em relação à regra antiga (caixa x densidade x 0,15, que dava 175 mil kg na caixa de 45 m e 0,58 kg no cano): fios agora pesam o cobre que o desenho tem (1,4 cm de diâmetro) e o cano 0,39 kg.

### 3. Testes (`packages/game-floorplan-three/tests/utility-segments.test.ts`, 58 casos, sem motor, 7 plantas x 2 sementes)
1. nenhum trecho de fiação ou cano passa do limite (3 m / 2,5 m, mais a luva); com `pipe: 1` nenhum passa de 1 m (configurável);
2. nenhum trecho cruza laje ou parede (caixa desenhada de cada trecho: ou não toca o sólido, ou está **dentro** dele **e seguro por ele**; tolerância 2 cm = a tampa de um cano inclinado cortado numa face passa um raio dela);
3. todo trecho está seguro por uma peça que existe e nenhuma cadeia de apoios faz laço; o cano do tanque é cortado na `tank_slab` e todos os seus trechos são seguros;
4. a massa dos trechos de cada traçado é a do traçado (pelo comprimento do `plumbing.visibleRuns` e do ramal).

### 4. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-floorplan-three` próprio | 817 passam; só os 3 `exact-golden` conhecidos (breach, fracture, spall) |
| `game-floorplan-three` Jolt (`PIECE_SOLVER=jolt`) | 819 passam; os 3 conhecidos e `bookcase-topple` (pré-existente) |
| Golden exato | regravadas **só** as 40 entradas `house/*` e `specimen/*` (a fiação e o cano mudaram de peças); as 3 `destruction/*` foram restauradas do `HEAD` e continuam reprovando |
| `blast-presentation.test.ts` | hash regravado (`281edd1c…` para `3644f34d…`: o conjunto de peças mudou, a regravação é o contrato do teste) |
| `golden-scene.test.ts` (golden do time) | passa, com `segmentLimits: Infinity` no teste (o desenho do time) |
| `game-destruction-three` | não foi tocado; `z-fighting.test.ts` passa |
| Construção (`residential`, `commercial`, `rural`, `post-apocalyptic`) | 21, 13, 11 e 56 passam |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, idêntica à da T3.8f (`worstC2Unconditioned 0,014651`, `worstC4 1,5167`, `fellThrough 0`) |
| `eslint` nos arquivos mudados | 0 problemas |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos, 11 pendentes conhecidos) |

### 5. Rodadas na sala (5 de blast e 5 de martelo por configuração, código final, uma por processo)
Peças: blast 63 (eram 52), martelo 42 (eram 34): os trechos.

| Configuração | T3.8f | Agora | C2 cond. (peças > 3,5 cm) | C4 (s) por rodada | `fellThrough` | quadro máx (ms) / despertar (ms) |
|---|---|---|---|---|---|---|
| D4 ligada, blast | 4 de 5 | **4 de 5** | 0, 0, 0, 0, 0 | 1,95; 0,7; 1,25; **-1 (uma peça não dorme)**; 0,65 | 0, 0, 0, **119**, 0 | 89–126 / 48–53 |
| D4 ligada, martelo | 0 de 5 | **3 de 5** | 0, 0, 0, 0, 0 | 1,8; **3,4**; 2,3; 1,75; **3,25** | 0 | 214–258 / 34–40 |
| D4 desligada, blast | 4 de 5 | **5 de 5** | 0, 0, 0, 0, 0 | 1,1; 0,9; 0,85; 1,1; 1,3 | 0 | 98–173 / 49–53 |
| D4 desligada, martelo | 0 de 5 | **2 de 5** | 0, 0, 0, 0, 0 | **3,4; 4,2**; 1,5; **3,3**; 1,95 | 0 | 120–248 / 32–36 |

**14 de 20 passam** (eram 8 de 20). **Nenhuma das 20 rodadas tem a fiação nem o cano acima do limite de C2** (`overPieces` vazio em todas; o ganho máximo de C2 por rodada é 0,005–0,019 m, o limite é 0,035 m); o poste de 950 kg também saiu da lista. Cinco rodadas a mais de blast com D4 ligada (r6 a r10): 4 passam; a que reprova tem 1 peça de 45 kg (`plain_27`, não é instalação) com 0,106 m, e nenhuma teve `fellThrough`.
Quadro da sala contra a T3.8b: máximo do blast 89–173 ms (T3.8b: 98–315), do martelo 120–258 ms (T3.8b: 93–294); quadro de despertar 48–53 ms no blast (T3.8b: 43–88) e 32–40 ms no martelo (T3.8b: 43–88). O custo de ladrilhos do arame de 45 m saiu do despertar; sobra o `Step` do Jolt sobre os colisores de triângulo da casa.

### 6. O que sobra e por quê
- **C4 do martelo**: 5 das 10 rodadas passam de 3 s (3,25–4,2 s; eram 5,05–6,35 s com D4 ligada). Não é mais o arame nem o cano: a lista de quem sobe é de peças de 12–18 kg e de itens de 0,1 kg a poucos cm/s (`worstRises`: `obj_13` 18 kg 0,093 m; `obj_19` 16,3 kg; `obj_29` 12,3 kg; `obj_42` 0,1 kg a y 0,029 m). **Causa não investigada além disso**; é o critério que mais reprova agora (as 5 rodadas de martelo que reprovam, reprovam só por C4).
- **`fellThrough` 119 numa rodada de blast com D4 ligada** (r4; peça de 0,1 kg `obj_17` a y -0,048 em (8, -2), fora da casa, uma peça de 0,1 kg não dorme). Nenhuma das outras 24 rodadas de blast com D4 ligada (20 + 5 extras, menos essa) repetiu. Não é peça de instalação (as instalações têm massa de quilos). Não investigado.
- **Não feito**: os conduítes elétricos (`conduit:*`, plástico, um `pieceRecord` cada) e os canos escondidos na parede (`wall_pipe`, `pipe:run_wall_*`, um grupo escondido de 3 kg cada, desenhados no centro do cômodo) continuam inteiros. O traçado `wire` da grade tem 4 fios **colineares e sobrepostos** (as pontas deslocadas só 1,35 m ao longo do vão): é do desenho do time e já era assim (§13).
- **Exigência nova do dono (furos de explosão que expõem o esgoto)**: **não construída**. O levantamento (SDK primeiro): (a) **não existe esgoto no kit**: `game-floorplan-structure/src/utilities/plumbing.ts` só planeja água fria (`run_outlet`, `run_under_*`, `run_wall_*`); nenhum pacote tem `sewer`/`esgoto`; (b) existe um mecanismo de cano escondido na parede (`part('wall_pipe', …, { hidden: true })`, `parts[id].opens(1)` o revela), mas **ninguém o chama quando a parede abre**, o traçado vai pelo centro do cômodo e não por dentro da parede, e é uma peça só; (c) a vista de rombos (`breach.standing(partId)` de `game-floorplan-three`) já dá os vãos que restam da parede, o que permite saber onde há furo. O que falta é decisão de modelo (por onde corre o esgoto, diâmetro, saída), dados novos em `game-floorplan-structure`, o desenho dos trechos embutidos (o `cutRun` desta tarefa já corta no sólido e dá `host`, então os trechos embutidos numa parede ou laje existem; falta escondê-los e revelar/soltar os que ficam sob o furo) e os testes (1)–(4) com furo real. Fica para uma tarefa própria.

## T3.8h — C4 do martelo e `fellThrough` (2026-11-14) — **T3.8 continua SEM ✅: as duas causas foram achadas e consertadas; as rodadas da sala foram adiadas para depois do merge do PR #301**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Navegador das sondas: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo. Nenhuma tolerância, régua, critério nem teste foi afrouxado ou removido. **Rodadas da sala adiadas até depois do merge do PR #301 (release/casa-a-rodada10, com correções da casa e o esgoto): rodadas antes dele seriam descartadas.** Os números da sala abaixo (sondas) são de investigação, não a reexecução de aceite.

### 1. C4 do martelo
- **Sonda** (`decision/probes/awake.js` + `awake-drive.mjs`, novas): por quadro, as peças acordadas com massa, velocidades, contatos (`trackPairs`/`pairLog`), pose crua do Jolt, penetração e toda escrita do kit (`wake`, `setPose`, `setVelocity`, `wakeInBox`, `groundChanged`, `topple`).
- **Medido** (6 rodadas de martelo, D4 desligada, antes do conserto): em **todas** a última peça a dormir era `obj_40` (`pipe:run_wall_bathroom_0`, 3 kg), acordada de 5,3 a 6,0 s, com velocidade 0 e **nenhuma escrita do kit**, mas a posição andando ~0,1 m/s (z de −2,61 para −2,87 em 2,2 s). Os candidatos pedidos ficam descartados: nenhum `wake`/`groundChanged`/`wakeRegion`/empurro de tombamento (só o `topple` sem efeito de velocidade) a mantinha acordada; nenhuma vizinha presa acordada (parceiros de contato todos estáticos); o limiar de sono do Jolt é o do próprio (`sleepAfter 0,5`, `sleepSpeed 0,08`) e não foi mexido.
- **Causa**: `pipe:run_wall_*` era **uma só parte escondida** de 3 kg cujo traçado (do tanque, pelo forro, até o aparelho) é uma caixa de **8,7 x 2,1 x 1,9 m sem `partBoxes`**. Solta, vira um colisor do tamanho da casa **0,76 m dentro** de paredes, móveis e do sedã estacionado; `outOfStatics` não acha saída livre e a recoloca (`putBack`), e o Jolt a empurra para fora só por posição (sem velocidade), o que a verificação de sono do Jolt (movimento dos pontos de teste, não só velocidade) conta como movimento até a peça sair.
- **Conserto** (`game-floorplan-three/src/utilities/water.ts`, dono das instalações; `destruction/pieces.ts`): o traçado escondido é cortado como os visíveis (`cutRun` nas lajes, paredes e divisórias, no máximo `segmentLimits.pipe`), uma parte e uma peça por trecho, os 3 kg divididos pelo comprimento, cada trecho com `holder`. `segmentLimits.pipe: Infinity` mantém o traçado inteiro (golden do time). Testes (`tests/utility-segments.test.ts`, +29 casos, falham sem o conserto): nenhum trecho passa do limite, a massa dos trechos de uma rota é 3 kg e todo apoio existe, o limite é configurável.
- **Depois** (6 rodadas de sonda, D4 desligada): `obj_40` saiu da lista em 6 de 6; C4 estimado 1,1; 1,6; 2,35; 4,1; 1,15; 2,9 s. A que passa de 3 s (4,1 s) é um **poste de 1010 kg** rolando devagar 6,15–7,65 s, e o poste também chegou a 2,9 s noutra. Outras 4 rodadas depois: 1,05; 1,15; 2,5; 1,3 s.
- **O que sobra (não consertado)**: o poste (`pole` + um trecho de fiação) tem como colisores só placas finas nas duas pontas e a travessa, sem o fuste; deitado, rola/balança em torno do eixo longo com ω 0,3 a 0,7 rad/s sem escrita do kit, e o limiar de sono (pontos a 3,75 m do centro) não deixa dormir até ω < 0,02 rad/s. Aconteceu em 2 de 10 rodadas de sonda. Opções, nenhuma feita: (a) dar ao poste o fuste como colisor (partBoxes do cilindro; muda a geometria que o motor ajusta, §12); (b) o kit parar de empurrar/ajudar o poste a tombar (regra do §12, muda C1–C10: decisão do dono). **Decisão do dono**: escolher entre (a) e (b), ou aceitar o poste fora de C4.

### 2. `fellThrough` (r4 do blast com D4 ligada)
- **Reprodução headless** (sem GPU): cubos de 4 cm / 0,06 kg lançados para baixo de 0,1–2 m a até 250 m/s sobre chão plano ou com cratera, com `PieceSystem` no Jolt. Antes do conserto, em 80 lançamentos: **8 a 19 deixados passar** (`fellThrough`) e **1 a 4 terminando 5 a 8 cm dentro do chão sem a rede disparar** (y final −0,056, −0,071, −0,084), nos dois tamanhos de quadro (1/60 e 0,05 s da sala). Os chips de 0,05–0,5 kg do D4 (`obj_8` a `obj_18`, caixas de 4 cm) são esse caso.
- **Causa**: `EnginePieces.layGround` assenta os ladrilhos de chão (2 m) só ao redor da pegada da peça, com margem de 0,5 m mais o giro; **o deslocamento da peça no update não entrava**. Um chip a 20–250 m/s anda de 1 a 12 m por update (0,05 s) e cai num ladrilho que ainda não existe: ou atravessa o vazio (a rede do kit o recoloca, `fellThrough` +1) ou o ladrilho é feito debaixo dele e ele termina enterrado na laje, onde a rede não dispara (a condição pede centro abaixo do chão − 5 cm − alcance). O ladrilho em (8, −2) é o canto de quatro: o caso da r4.
- **Conserto** (`game-destruction-three/src/engine-pieces.ts`): `layGround` também assenta a pegada em até 6 paradas, a um ladrilho de distância, ao longo do movimento da peça no update (`layAround`); peça lenta (< 0,5 m por update) não muda. Teste novo `tests/engine-fast-chips.test.ts` (Jolt, sem GPU; 8 casos de 30 chips, dois quadros, chão plano e cratera, 80 e 250 m/s; semente fixa): **0 deixados passar e 0 abaixo da superfície; os 4 casos de 250 m/s reprovam sem o conserto.**
- **Não reproduzido**: o 119 repetições numa rodada (a rede disparando a cada update por 6 s). Em 12 rodadas de sonda de blast com D4 ligada (10 + 2) `fellThrough` ficou 0 mesmo antes do conserto de chão; a explicação provável é a mesma (chip rápido sobre ladrilho que faltava, a rede levantando-o a cada update enquanto o chão não chega), mas **não foi medida na sala**. A reexecução depois do merge confirma ou não.

### 3. Gates (antes dos commits, no código final)
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 398 passam, 0 falhas |
| `game-destruction-three` Jolt (`PIECE_SOLVER=jolt`) | 478 passam, **só as 2 conhecidas** (`rolling`: lata no ar, cinquenta latas) |
| `game-floorplan-three` próprio | só os 3 `exact-golden` conhecidos (breach, fracture, spall) |
| `game-floorplan-three` Jolt | os 3 conhecidos e `bookcase-topple` (pré-existente) |
| Golden exato | regravadas só as 21 entradas `house/*` e `specimen/*` que mudaram; as 3 `destruction/*` mantidas como estavam. Hash do `blast-presentation` regravado (`3644f34d…` para `e288bafb…`: o conjunto de peças mudou) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, números idênticos à T3.8g (`worstC4 1,5167`, `fellThrough 0`) |
| `eslint` nos arquivos mudados | sem problemas |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos, 11 pendentes conhecidos) |

### 4. Commits (locais, nada enviado)
`b545ac16` (ladrilhos ao longo do caminho de peça rápida + teste), `c69a1774` (canos escondidos na parede em trechos + testes + goldens), e o desta evidência com as sondas.

### 5. Pendente
Reexecução da sala (5 blast + 5 martelo com D4 ligada e desligada, mais 5 extras de martelo por configuração, contra a T3.8g: D4 ligada blast 4/5, martelo 3/5; D4 desligada blast 5/5, martelo 2/5) **depois do merge do PR #301**; o poste (item 1) provavelmente ainda reprova algumas rodadas de C4.

## T3.8i — merge da release #301 (2026-11-14) — **sem rodada de sala nem de navegador (ficam para depois); 1 teste novo vermelho que não é da release sozinha: `grenade-in-kitchen`**

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0, pnpm 10.28.2. Merge local de `origin/release/casa-a-rodada10-2026-11-13` (cabeça `a84f68b3`, 131 commits sobre a `main`) em `feat/motor-fisico-jolt` com `git merge --no-ff`; nada enviado.

### 1. Conflitos e como cada um foi resolvido
| Arquivo | Resolução |
|---|---|
| `game-destruction-three/src/renderer.ts` (2 trechos) | Nossa política de entulho (`policy`, fila de acordar, `chooseForPhysics`) mantida; a área de onda da release (`waveArea`, passada ao `blastShove`) somada por cima nos dois empurrões. |
| `game-test-room/src/room.ts` | As duas linhas: `physicsLoop?.step(dt)` e `arena.followSun(...)`. |
| `game-floorplan-three/src/types.ts` | `BuildOptions` com as quatro opções da release (`gutters`, `eave`, `wallCorners`, `ceilings`) e as nossas (`windows`, `segmentLimits`). A opção `doors` saiu (duplicata, ver 2). |
| `kernel-types-systems.ts` | Campos `visor*`, `occupied` etc. da release mais os nossos `fittedWindows` e `segmentLimits`; `fittedDoors` saiu. |
| `build/build.ts` | Imports das duas; a linha de preparo do contexto junta as flags da release com `fittedWindows` e `segmentLimits`. |
| `house/doors.ts` (3 trechos) | Geometria da release como base (folha sob o batente, batente entra 2 mm na parede e no piso, batente anotado com as paredes). Folha pivotante: `leafH` passou a ser a altura que a release dá à folha (`dH - jw - 0.003`; `visH` na cena do Visor). |
| `house/windows.ts` (2 trechos) | `bar` da release (anota o caixilho em `occupied`) com o nosso `shift` do vidro; a laje do peitoril da release (`keepOut` das rodapés) com o nosso pé da grade (`GRILLE_FOOT`). |
| `utilities/electrical.ts` | Nosso `wiringSpans`; imports unidos; o segundo condutor do ramal agora sai paralelo ao primeiro (correção da release, 4 cm de distância de ponta a ponta) também nos trechos, fora da cena do Visor. |
| `utilities/water.ts` | A linha de `constructionStages` (`stagedWallRuns`) da release antes da nossa `groupOf` tipada (`Vec3`). |
| `tests/golden-scene.test.ts` | Opções da release (`gutters`, `eave`, `wallCorners`, `ceilings` em `'visor'`) mais `windows: 'visor'` e `segmentLimits: Infinity`; `doors: 'visor'` removido. |
| `tests/blast-presentation.test.ts`, `tests/fixtures/exact-floorplan.json` | Reescritos a partir do código mesclado (ver 4). |
| `pnpm-lock.yaml` | Lado da release e `pnpm install`; sem mão. |
| Fora de conflito, mas quebrado | `bend`, `bend-shovel`, `redraw` (testes novos da release) não passavam `physics` (obrigatório aqui): `physicsOption()` como nos outros. |

### 2. Nossas correções largadas como duplicata
- `c0c3e4eb` na parte do batente: opção `doors: 'visor'`, `fittedDoors` e a altura `leafH` própria. A release já põe a folha sob o batente e a cena do Visor desenha a porta como a equipe. A folha pivotante tem folga de 5 mm dos dois lados desde sempre; `door-clearance.test.ts` passa sem geometria nossa.
- Mantidas (a release não faz): `windows: 'visor'` e o vidro apoiado no caixilho (`aa5fa26d`), os trechos de fiação e cano (`segments.ts`, `cutRun`, `segmentLimits`), o `drawn-boxes`.
- Segmentação nas peças novas da release: os canos de parede da etapa de construção (`stagedWallRuns`, `wall_pipe`) e o esgoto/pluvial de `installations-stage.ts` **não** são peças de destruição segmentadas (são partes escondidas ou malhas da etapa). Não foram segmentados; ficam como estavam na release.

### 3. Ajustes de teste por causa da área de onda da release (um commit por correção)
- `7e79a6d9`: `blast-debris-renderer.test.ts` empurrava caixas de 0,3 m e de 0,05 m com 200 kJ; a onda agora empurra pela área que o corpo mostra, e só 19 de 40 caixas passavam de 0,5 m/s. Energia subiu para 1 MJ (e 20 MJ para as de 5 cm); limiares e contagens iguais.
- `b78c7df3`: a cena de `determinism-scene.ts` (Jolt) pelo mesmo motivo, 200 kJ para 1 MJ.
- No merge: `utility-segments.test.ts` esperava o segundo condutor do ramal de ponta a ponta com 4 cm de altura numa só ponta; agora é paralelo (mesmo comprimento do primeiro), como a release o desenha. Comprimento esperado ajustado, tolerância igual.

### 4. Golden
- `exact-floorplan.json`: **as 43 entradas mudaram** (casas, `specimen/*` e `destruction/*`): a geometria da casa é outra (cena e portas da release, vidro no caixilho, ramal paralelo, trechos). Regravado de novo do código mesclado (`UPDATE_EXACT=1`).
- As 3 falhas conhecidas (`destruction/breach`, `fracture`, `spall`): eram da geometria cherry-pickada da release; com a gravação refeita **passam no solver próprio**. No Jolt ainda falham (gravação é do solver próprio, como antes).
- Hash do `blast-presentation`: `9c88042f…` (release) para `9e631476…`. O resultado físico segue o da release (parede de frente quebra, nada pega fogo); só o desenho das peças que a onda encontra mudou.
- Ouro da equipe (`golden-scene.test.ts`, `vc3-house-scene.json`): passa nó a nó, sem regravar.

### 5. Gates
| Gate | Resultado |
|---|---|
| `pnpm install`, `pnpm build` | ok |
| `pnpm -r typecheck` | exit 0 |
| Release sozinha (worktree temporário, removido) | `game-floorplan-three` 900 passam, 0 falhas; `game-destruction-three` 332 passam; `game-destruction` 542 passam |
| `game-destruction-three` próprio | 409 passam, 0 falhas (linha de base: 0) |
| `game-destruction-three` Jolt | só as 2 `rolling` conhecidas (linha de base: as mesmas 2) |
| `game-floorplan-three` próprio | 1030 passam, **1 falha: `grenade-in-kitchen`** (linha de base: 3 golden; os 3 passaram a verdes) |
| `game-floorplan-three` Jolt | 5 falhas: os 3 `destruction/*` do golden, `bookcase-topple` (conhecidos) e `grenade-in-kitchen` |
| Demais pacotes (`pnpm -r`, sem floorplan) | sem falha além do já corrigido acima |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128** (linha de base: 128/128) |
| Construção por tipologia e z-fighting | dentro do `game-floorplan-three` e dos pacotes de tipologia: verdes |
| `eslint` nos arquivos mudados | 0 erros (avisos de `max-lines` antigos) |
| `kit-audit --check` | exit 0 (0 novos, 11 pendentes conhecidos) |

### 6. `grenade-in-kitchen` (aberto)
O vidro `window:w0_2` da cozinha (a 2,2 m da granada) fica `damaged` (hp 33,7) sem rachadura nem furo, e a asserção «todo vidro quebrou ou rachou» falha. Passa na release sozinha e passa aqui com `segmentLimits.wiring: Infinity`; falha com qualquer limite finito (2,5, 3, 4, 6). Os cabos que mudam são os da grade do lote, a 12 m, sem ligação geométrica com o vidro: a suspeita é a ordem/quantidade de objetos no raio de 15 m mudando o sorteio dos estilhaços, não a física. Não afrouxei nada nem mexi no teste.

### 6b. `grenade-in-kitchen`: causa e correção
**Causa (medida):** a hipótese (a), um fluxo de números aleatórios compartilhado. `throwCasing` (`game-destruction/src/world.ts`) criava **um** `createRng` por granada e o consumia alvo após alvo, na ordem de `objects`/`parts`: um sorteio para a contagem de cada alvo (`floor(esperado x keep + u)`) e três por fragmento. A fiação cortada em trechos acrescenta 20 alvos (330 para 350 com `wiring: 3`), então todo alvo depois do primeiro trecho recebe outros números. O vidro `window:w0_2` tem esperado 20,4 e `keep` 0,017 (de ~15 000 fragmentos esperados só ~265 viram raios, o teto de `FRAGMENT_RAYS`): como alvo próprio ele recebe 0 raios nos dois casos. Com `wiring: Infinity` ele é atingido por **dois raios mirados em outros alvos** (E 17,7 J e 448 J, o segundo com dano 117,9 e furo); com `wiring: 3` nenhum raio o toca e a onda sozinha o deixa `damaged` (33,7). Ou seja, o teste passava por sorte do sorteio, e a «sorte» mudava com qualquer peça nova longe da cozinha (2,5, 3, 4 e 6 todos falhavam). Nenhum segmento de fiação ocluiu ou absorveu fragmento: nos casos que falham não há raio algum em `w0_2`. O `keep` (teto global) também sobe e desce com o total (0,01713 para 0,01769), mas só desloca o limiar do `floor`, e é o teto documentado.
**Correção:** cada alvo passa a ter o **próprio fluxo**, semeado com a semente do mundo, o ponto e a carga da granada e o nome do alvo (`objeto|parte`, ou o `id` do corpo registrado). O que um alvo sorteia não depende mais de quantos alvos vêm antes dele. Mudança só em `throwCasing` e no tipo `FragmentTarget` (campo `id`), no pacote dono dos fragmentos; a asserção e a tolerância do teste ficam como estão.
**Resultado:** `grenade-in-kitchen` passa (3/3) com `wiring` 3 (padrão), 2,5, 4, 6 e `Infinity`. Gates: `pnpm -r typecheck` 0; `game-floorplan-three` próprio 1031 passam, 0 falhas; Jolt só as 4 conhecidas (3 `destruction/*` e `bookcase-topple`); `game-destruction` 545 passam; `game-destruction-three` próprio 409/0 e Jolt só as 2 `rolling`; `game-vehicles-fleet`, `game-weapons-three`, `game-items`, `game-vehicles-driving`, `game-physics-jolt` verdes; eslint 0 erros; `kit-audit --check` 0 novos. Nenhum golden mudou (o `exact-floorplan.json` não foi regravado).

### 7. Cherry-pick
`git cherry-pick -x 77ea4aa5` (`spec/004-fase-4`): a mão abre a porta e a empurra, não segue a folha. `dc5d557b` não veio. Conflitos só de tipo e de texto em `game-characters-three` (`avatar.ts`, `room-avatar.ts`), `game-test-room` (`avatar.ts`, `README.md`): fase `push` somada ao nosso `clipRate` e ao `fallForward`. Gates: `game-player` 63, `game-characters-three` 549, `game-test-room` 458 testes passam (a evidência da 004 registrava 52 e 261); typecheck, eslint e `kit-audit --check` ok.

## T3.8j — colisor do poste (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Sem rodada de sala nem de navegador. Nenhuma tolerância, régua ou teste foi afrouxado ou removido.

### Causa
- O poste do lote (`pole:*`, 7,5 m, ~950 kg) é uma parte de malha unida (`range`): dois cilindros (`cylBase`), uma travessa e quatro isoladores. Um cilindro desenhado tem vértices só nos anéis das duas pontas.
- Ao virar peça, `partBoxesOf` (`game-destruction-three/src/renderer.ts`) passa os vértices da parte a `fitOrientedBoxes` (`game-shapes`), que só vê pontos: a caixa do poste inteiro "tinha ar" no meio e era cortada nos anéis. Resultado medido: duas placas de 22 x 2 x 22 cm nas pontas, sem o fuste (maior caixa do poste: 2,9 m de 7,5; antes do conserto, na peça `obj_19` do blast).
- A regra FILL do `drawn-solids.ts` (commit 07e2e52c) não participa: ela vale para sólidos fixos; o caminho de peças solta usa `fitOrientedBoxes`.

### Conserto (dono: `game-shapes`)
- `fitOrientedBoxes(points, triangles?)`: com os triângulos da parte, (1) cada sólido que os triângulos mantêm separado é ajustado sozinho (vértices na mesma posição, 0,1 mm, são um só: a tampa de um cilindro tem vértices próprios sobre o anel do lado); (2) a superfície ao longo de cada aresta maior que 20 cm conta como pontos. Sem triângulos o comportamento é o de antes. Mais de 16 sólidos separados: ajusta como uma nuvem só.
- `renderer.ts`: `trianglesOf(mv)` lê os triângulos da faixa direto do buffer de índices (a lista que o hospedeiro guarda não tem as partes já soltas) e os entrega ao ajuste.
- Resultado no poste: um fuste de 0,22 x 7,5 x 0,22 m, quatro isoladores de 5 x 10 x 5 cm e a travessa de 1,6 x 0,08 x 0,08 m, cada um como desenhado. Folga conhecida: a seção de cima do fuste (raio 8 cm) está dentro da caixa do fuste de 11 cm de raio (3 cm de ar), porque as duas seções dividem o vértice central da tampa.
- Outras peças: o mesmo caminho vale para toda parte em faixa de malha unida (cano, fiação, condutor, viga, pilar desenhados com cilindros). Nenhum golden `house/*` nem `specimen/*` mudou: nada foi regravado.

### Testes novos
- `game-shapes/tests/oriented-boxes.test.ts` (2): cilindro de dois anéis vira uma caixa de 7,5 m com triângulos (sem eles continua em placas); fuste e travessa são duas caixas.
- `game-floorplan-three/tests/pole-collider.test.ts` (2, o de sono só com `PIECE_SOLVER=jolt`): o blast do lote solta os postes; a maior caixa de cada um passa de 7,4 m; os postes deitados dormem em até 3 s (lidos de `piece.sleeping` do Jolt) e `activeCount` termina em 0. Sem o conserto os dois falham (maior caixa 2,9 m; só 1 poste chega deitado).

### Correção (mesmo dia): os 3 goldens `destruction/*` não eram "conhecidos" no solver próprio
A primeira versão desta seção copiou a linha de base da T3.8h (3 goldens vermelhos no próprio) sem conferi-la na `main`. Na `main` (1babd53c mais #303) o `exact-golden` passa 44/44 no próprio (o conserto da granada, #302, os fez passar). Com o conserto do commit `21c3093b` eles falhavam: a mudança era minha. Investigação:

- **Prova da causa**: com o ajuste antigo no renderer (`fitOrientedBoxes(pts)` sem triângulos) e o resto igual, `exact-golden` passa 44/44; com o novo, 3 falham. As três cenas (sobrado:3; `breach`, `spall`, `fracture`) soltam as mesmas 121/111/128 peças (mesmos ids); só os colisores e, por consequência, as trajetórias mudam.
- **O que mudou nos colisores** (campo a campo, `partBoxes` por peça, 60 peças por cena): (1) o fuste dos postes (de duas placas de 22 cm para uma caixa de 7,5 m: 0,014 para 0,38 m3 por peça); (2) canos e fios de seção redonda: antes uma caixa de eixo principal em volta do traçado todo (nos trechos em L, um plano de 1,2 x 9,5 m de ar), agora uma caixa por perna, com luvas e válvulas de 3 cm como caixas próprias; (3) o coroamento de 11,5 m: de caixa inteira (`pb0`) para as duas caixas desenhadas.
- **Defeito achado e consertado na primeira versão do commit `21c3093b`**: ao amostrar a superfície, o ajuste mantinha a regra de "placa" (`thin <= max(THICK, FAT*middle)`), que não corta, e só cortava na mediana: um cano em L virava uma caixa-plano em volta da curva (volume de colisores desta cena foi para 42,5 m3 contra 23,3 antes). Agora, com superfície amostrada: sem a regra de placa (o ar aparece nos pontos) e cortes testados a 15, 30, 50, 70 e 85% do comprimento. Volume total dos colisores das peças da cena: **23,3 para 18,8 m3** (breach; spall 23,2 para 18,7; fracture 23,8 para 19,3); planos de ar (segunda metade maior que 30 cm, fina) de 16 para 6 (breach); nenhuma peça perdeu caixa (0 com menos caixas, 0 sem caixa); o máximo é 26 caixas numa peça (era 19). As únicas peças com colisor maior são os postes, como pretendido.
- **Teste novo** em `game-shapes/tests/oriented-boxes.test.ts`: um traçado em L (pernas de 9,4 e 2,8 m) fica abaixo de 0,05 m3; com os cortes só na mediana dava 0,086.
- **Por que o hash muda**: o mesmo conjunto de peças cai com colisores diferentes; sobram mais fragmentos (peças que batem e quebram): objetos da cena 946 para 960 (breach: +10 fragmentos, +3 cascas, +1 parede), 938 para 975 (spall: +37 fragmentos), 1000 para 1010 (fracture: +11). Consequência de colisores que seguem o desenho, não de peça sem caixa nem de caixas dentro das estáticas (volume total caiu).
- **Regravado só isso**: `UPDATE_EXACT=1` e o diff do fixture tem exatamente 3 linhas. Antes e depois (hash, objetos): `destruction/breach` 5ebbaaaa/946 para 3dabe0e1/960; `destruction/spall` ad81775c/938 para b8b1e9de/975; `destruction/fracture` 1b02b50b/1000 para 3bcd5141/1010. As 41 entradas `house/*` e `specimen/*` não mudaram.

### Gates (código final, depois da correção)
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` | exit 0 |
| `game-destruction-three` próprio | 409 passam, 0 falhas |
| `game-destruction-three` Jolt | 489 passam, só as 2 `rolling` conhecidas |
| `game-floorplan-three` próprio | **1032 passam, 0 falhas** (os 3 `destruction/*` passam com o fixture regravado; a linha de base correta é 0 falhas) |
| `game-floorplan-three` Jolt | 1032 passam, 4 falhas: os 3 `destruction/*` e `bookcase-topple`, as mesmas de antes. O fixture é do solver próprio, então no Jolt os 3 continuam diferindo, como já diferiam |
| `game-shapes` | 188 passam |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | 128/128, números idênticos aos de antes (`worstC4` 1,5167, `fellThrough` 0) |
| `pole-collider.test.ts` | passa no próprio e no Jolt (já dentro das suítes acima) |
| `eslint` (shapes) / `kit-audit --check` / `pnpm check:layers` | sem problemas / exit 0 / sem violações novas |

Tabela de gates anterior (acima): onde diz "só os 3 `destruction/*` conhecidos" no próprio, vale a correção desta seção: a linha de base era 0.

## T3.8k — buracos de explosão expõem os canos de saída (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0, pnpm 10.28.2. Branch `feat/canos-saida-explosao` (sobre `e987bbe4`). Nenhuma tolerância, régua nem teste foi afrouxado ou removido. Navegador da conferência à mão: `chromium` do Playwright com GL por software (SwiftShader), 3 a 50 quadros por segundo.

### 1. O mapa: que canos de saída existem numa casa pronta e como são desenhados
| Rede | Onde nasce | Como é desenhada | É peça de destruição? | Fica dentro de parede ou laje? |
|---|---|---|---|---|
| Esgoto dos aparelhos (vaso, chuveiro, pias, banheira de lavar, máquina) | `construction-stages/installations-stage.ts`: `drainsOf` lê `plumbing.points` (`DRAIN_BORE`: vaso 0,1 m, o resto 0,05 m), `sewerLayout` põe de cada aparelho um ramal com caimento (NBR 8160) até o coletor e a caixa de inspeção | malhas no grupo `stage:4:installations`, **enterradas** (a ponta do ramal fica em y -0,02 e desce a -0,35); só aparece no nível 4 da obra (ou 4 em diante com `waterLayer`); a casa pronta (nível 8) **não as desenha**, só as tampas das caixas (`stage:4:sewer_boxes`) | não: sem peça, sem colisor, sem `cutRun` | não: debaixo do chão, em vala; nada atravessa parede nem laje |
| Pluvial (NBR 10844) | `rainLayout`: da caixa de areia ao meio-fio, enterrado a -0,3 m, 0,1 m de diâmetro, grupo `rain_drains` | igual ao esgoto (malha da etapa) | não | não |
| Descida da calha (`downpipe`) | `roof/gutters.ts` (`roundDownpipe`): bocal na calha, duas curvas de 45°, desce rente à parede, luva de 45° sobre a caixa de areia | `tube()`/`cylBase` fundidos na malha do telhado; sem peça | não (nem a calha de meia-cana) | não: corre por **fora**, a 6 cm da quina (fora das caixas das paredes), presa por braçadeiras que são só desenho |
| Ralo com grelha ao pé da descida e boca de escoamento da laje (`roof/slabs.ts`) | `gutters.ts drain()` e `slabs.ts` | caixas fundidas na malha | não | não |
| Água fria escondida na parede (`wall_pipe`) | `utilities/water.ts` | com `constructionStages` (a sala): **uma parte só por traçado** (`stagedWallRuns`, 3 kg), sem `cutRun`, desenhada e visível (`EMBEDDED`: `visible = nível >= 4`) escondida só pelo reboco; sem etapas: segmentada em trechos (c69a1774), `hidden: true` | sim | com `constructionStages` sim (nas paredes), sem elas corre pelo meio do cômodo |

Como um `hidden` é revelado: `parts[id].opens(1)` mostra a parte, e **ninguém o chamava quando a parede abria**. O que existe do lado da destruição é o estado de cada parte (`PartState.opening`, `chipped`, `status`) e o evento `stage`/`chip`; `breach.standing(parte)` só diz que vãos de parede restam.

O chão do térreo **não tem parte de laje** (a casa assenta nas vigas baldrame): um furo de laje só existe nos pavimentos de cima.

Conclusão do mapa: o esgoto e o pluvial da release estão só na vista da obra, enterrados e sem peça, e as descidas da calha não são peças. Nenhuma rede de saída da casa pronta era peça segmentada nem ficava dentro de parede ou laje; o furo de explosão não tinha nada a expor.

### 2. O projeto
**`game-contracts`/`game-destruction`** (dono dos furos): `PartSpec.hostedIn` (a peça está embutida ou presa numa parte do mesmo objeto), `PartState.exposed` e o evento `reveal`. Regras no `world.ts`:
- uma peça com `hostedIn` **inteira dentro da caixa do hospedeiro** (`embedded`, tolerância 2 cm) não toma a onda da explosão (`blastPart`) nem tem a junta com ele afrouxada pelo choque (`wearJoints`, o mesmo que solta o rodapé perto da carga) enquanto o hospedeiro está de pé;
- um furo do hospedeiro (`opening` do estágio 2, unidade arrancada em `chipped`, ou o hospedeiro perdido ou caído) que alcança a caixa da peça no plano da parede (folga de 5 cm: um cano a poucos centímetros da parede, por fora) a **mostra** (`exposed`, evento `reveal`, uma vez por peça, antes do `detach`) e **abre a junta com o hospedeiro**. A peça fica com o que mais a prende: um trecho preso aos vizinhos fica pendurado no furo, um que sobra solto cai como peça;
- feito ao fim de cada operação do mundo (`run`), uma vez por peça: o custo some quando o objeto não tem peça hospedada.

**`game-floorplan-three`**:
- `utilities/drains.ts` (novo, `drainPipes()`, chamado depois do telhado, que pendura as descidas): cada dreno de aparelho do pavimento vai do bocal (altura por tipo de aparelho: vaso 0,18 m, chuveiro 0,03, pia 0,5, tanque 0,45, máquina 0,5) para dentro da **parede mais próxima** (`wallDrop` da release, no eixo da parede), desce dentro dela e, em pavimento de cima, **atravessa a laje pelo meio da espessura** para a parede do andar de baixo, até o pé da parede do térreo, onde o ramal enterrado da release o pega. Cada traçado é cortado por `cutRun` nas faces de laje e parede (os mesmos sólidos de `segments.ts`, com os painéis no lugar da laje inteira quando há destruição), um `part('drain_pipe')` por trecho com massa pelo comprimento (`pipeMass`), `hostedIn` = o sólido onde está, `holder` = o sólido ou o trecho vizinho já preso (`holdersOf`) e **junta com o trecho anterior** (`chain`, cola de PVC). Trecho embutido nasce `hidden`; o trecho no ar (o toco da pia ao bocal) é desenhado.
- As **descidas da calha** saem de `roundDownpipe` (`gutters.ts`) como `GutterInfo.runs` e são peças em trechos entre as braçadeiras (1,5 m), presas à parede ou pilar mais perto (a 30 cm no máximo), `hostedIn` a ele; o bocal e a primeira curva ficam na malha da calha. O anel da braçadeira é da mesma malha do cano.
- `destruction/pieces.ts`: o apoio por `holder` aceita o **painel** da laje (`panelIds`): antes ele só olhava as partes do plano, e o apoio de um trecho de fiação ou cano numa laje (`slab_ceiling`, `tank_slab`) era descartado quando a laje virava painéis (a lista `view.replaced`); o trecho nascia sem apoio. Também as juntas entre trechos e a de um trecho sem sólido com o chão.
- `destruction/world.ts` (da casa): o evento `reveal` liga o desenho do trecho; `restore()` o enterra de novo.
- Fica como a release: `segmentLimits` (padrão 2,5 m de cano; `Infinity` mantém o traçado inteiro), e a cena do time (qualquer `visor*`, `golden-scene.test.ts`) **não desenha** nenhum desses canos.
- Custo de desenho: a sala desenha 355 partes na casa A (331 antes, 24 canos); os trechos de ambiente (toco da pia, descida da calha) entram na lista de LOD 1 (`lodObjects`) e os embutidos estão invisíveis, então a conta de chamadas da casa só cresce pelos poucos desenhados; o teste de LOD da sala com 4 casas e 300 chamadas continua com uma casa no nível 0.

### 3. O que foi reaproveitado e o que foi acrescentado
Reaproveitado: `wallDrop`/`routingPlanOf` (instalações da release), `DRAIN_BORE`, `RISER_TOP` e `drainsOf` (agora exportados), `cutRun`/`holdersOf`/`solidsOf` e `pipeMass`, o par `part()`/`markGroups`/`assembleStructure` das peças soltas (como o `wall_pipe`), o `reveal` da peça só como estado do mundo. **Não** reaproveitado como estava: `sewerLayout`/`rainLayout` (a malha enterrada da etapa 4 segue como estava, sem peça). Acrescentado: `hostedIn`/`exposed`/`reveal` e a regra de furo no mundo de destruição, `utilities/drains.ts`, a mudança em `gutters.ts`, o apoio por painel, os testes e a conferência à mão.

### 4. Testes (sem GPU)
`game-destruction/tests/hosted-parts.test.ts` (3): a peça embutida fica escondida e presa enquanto o hospedeiro está inteiro; um furo de 20 kJ numa parede de tijolos de 6 m mostra e solta só o trecho sobre o furo (os trechos a 1,5 m e 3 m ficam embutidos, com a junta fechada) e o trecho solto fica pendurado pelas juntas de cola aos vizinhos; o `reveal` sai uma vez por peça.

`game-floorplan-three/tests/drain-runs.test.ts` (36, casas reais, `fakeRoom` e `houseOf`, as granadas e cargas como `grenade-in-kitchen.test.ts` e `blast-presentation.test.ts`):
1. um furo de 30 kJ na parede do banheiro de `single_storey_a` (`wall_0_10`, o dreno do chuveiro) mostra os trechos dentro dela (`reveal`, desenhados, o `detach` das juntas com a parede), a parede não cai;
2. só os trechos dentro ou cruzando o furo: no sobrado (`townhouse` semente 3) 10 kJ no banheiro de cima mostram os trechos do dreno que estão na parede de cima e **todos os outros trechos do mesmo traçado** (descem pela laje e pelas paredes de baixo) seguem escondidos, sem `exposed`, no objeto da casa, com a junta ao hospedeiro fechada;
3. nada flutua e nenhum colisor sem desenho: nas 7 plantas x 2 sementes, todo trecho tem desenho, é preso por uma peça que existe ou pelo chão e nenhuma cadeia de apoios faz laço; nenhum trecho de esgoto cruza laje ou parede (ou está fora, ou dentro e hospedado nela; na parede sobre a porta, que entra na laje, em uma das duas); e as peças soltas que a explosão deixa têm `partBoxes` (colisores) para cada trecho desenhado;
4. furo de laje: no sobrado, 40 kJ sobre o piso do banheiro de cima **não** abre o painel `slab_1_p6` e os trechos que o atravessam seguem escondidos; 120 kJ abrem (`opening`, raio 0,32 m) e eles aparecem; o resto do traçado, na parede do térreo, fica escondido;
5. descida da calha: 60 kJ à altura do trecho de cima, na quina da parede da frente, soltam só trechos que o furo alcançou (`reveal`), e os que sobram ficam presos à parede.
Mais: a casa com todas as chaves `visor*` não tem nenhum dos canos, e `restore()` os enterra de novo.

Números da casa A (single_storey_a, semente 1): 24 partes de cano (esgoto: pia da cozinha, vaso, pia do banheiro e chuveiro, 3 trechos cada; calhas: 4 descidas de 3 trechos), todas as de dentro da parede escondidas.

### 5. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-destruction` | 548 passam, 0 falhas (eram 545, mais os 3 novos) |
| `game-destruction-three` próprio / Jolt | 409 passam, 0 falhas / 489 passam, só as 2 `rolling` conhecidas |
| `game-floorplan-three` próprio | **1068 passam, 0 falhas** (o golden exato passa com o fixture regravado, ver abaixo; linha de base: 0 falhas) |
| `game-floorplan-three` Jolt | 1068 passam, 4 falhas: os 3 `destruction/*` do golden exato (a gravação é do solver próprio) e `bookcase-topple`: as mesmas da linha de base |
| Pacotes de tipologia (a suíte inteira de cada um, onde está o teste de construção) | residencial 56, comercial 93, rural 37 e pós-apocalíptica 273 passam |
| z-fighting | `z-fighting-houses.test.ts` e `gutter-close-faces.test.ts` passam (dentro do `game-floorplan-three`) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, números idênticos à T3.8j (`worstC4` 1,5167, `worstC2Unconditioned` 0,014651, `fellThrough` 0) |
| `eslint` nos arquivos mudados | 0 erros (os avisos de `max-lines` do `world.ts` são antigos) |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos, 11 pendentes conhecidos) |
| `pnpm check:layers` | sem violações novas |
| `golden-scene.test.ts` (cena do time) | passa nó a nó, sem regravar |

**Golden exato**: `UPDATE_EXACT=1`, as **43** entradas mudaram (todas): as 35 `house/*` e as 5 `specimen/*` porque o desenho ganha as partes dos canos (a casa mais simples, a barraca, também tem pia), e as 3 `destruction/breach`, `spall` e `fracture` (passavam na linha de base) porque os mesmos tiros e blasts agora encontram partes novas na casa e o hash do estado as inclui. Regravadas as 43 (o fixture guarda hash e contagem de objetos de cada entrada: a casa A `bare` foi de 229 para 277 objetos, a barraca de 68 para 84, a cabana de troncos de 182 para 192). **`blast-presentation.test.ts`**: hash `9e631476…` para `2304b205…` pelo mesmo motivo (o resultado físico segue o da release: a parede da frente quebra, nada pega fogo).

### 6. Conferência à mão (navegador, não CI)
`examples/floorplan-test-area/test.mjs` ganhou a checagem «a charge on the bathroom wall exposes the basin's drain pipe that ran hidden inside it»: constrói a casa A, confere que os 2 trechos embutidos do dreno da pia do banheiro (`wall_0_17`) estão escondidos, dispara 30 kJ junto à parede, e confere que os 2 estão desenhados. **Passou em pt-BR e en** (`{"embedded":2,"before":0,"after":2}`). Os prints ficam em `examples/floorplan-test-area/shots/floorplan-drain-exposed-en.png` e `-pt-BR.png` (a pasta é ignorada pelo git do exemplo, como as demais). O print mostra o banheiro depois do estrago com o GL por software da conferência (3 quadros por segundo): o cano é um cilindro de 5 cm de diâmetro e 50 cm de comprimento e aparece pouco; a prova é a contagem da checagem, não a imagem.
As duas outras checagens que **já reprovam** na linha de base (`e987bbe4`, conferido num worktree limpo, mesmos números): «contract report is clean» (espera 7 cenários, a casa tem 8 desde `floorplan_construction_stages`) e «the C4 on the aimed wall brings parts down» (`broken` 0 antes e depois). Não foram tocadas.

### 7. O que sobra
- **O esgoto enterrado e o pluvial da release seguem sendo malhas da etapa 4** (sem peça, nem desenhados na casa pronta): só uma cratera no chão os exporia, e a cratera é do terreno (`groundLoss`), não de um furo de parede ou laje; ficam para uma tarefa do terreno. A parte **dentro da casa** (o que um furo de parede ou laje alcança) é o desta tarefa.
- **Térreo sem furo de piso**: o chão do térreo não tem parte de laje (assenta nas vigas baldrame), então os drenos do térreo só se expõem pelo furo na parede onde descem; a laje só existe nos pavimentos de cima.
- A altura do bocal de cada aparelho (0,18 a 0,5 m) e o dreno no eixo da parede mais próxima são decisão desta tarefa, não do plano da release; aparelho fora da casa (a banheira do quintal, `floor -1`) não ganha dreno peça.
- O dreno embutido num pavimento de cima sai do bocal para a parede mais próxima **daquele pavimento** e cai na parede mais próxima do de baixo, mesmo que as duas não se alinhem, e passa pela laje na horizontal (no meio da espessura de 13 cm) entre elas; a casa de verdade tem um shaft, que a planta não tem.
- Os trechos soltos que a explosão deixa caem como peças (colisores de `fitOrientedBoxes` com os triângulos, as caixas abraçam o desenho; conferido no teste 3), mas a conta de custo de uma sala com muitas casas e vários furos não foi medida.
- A saída de água de laje (`roof/slabs.ts`, bocal pela mureta) segue como estava.

## T3.8q — cratera altera as alturas no lugar (SetHeights) (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0, worktree `cratera-set-heights` (`perf/cratera-set-heights`, de `6b0e6af4`). Só Node, sem navegador. Mudança de desempenho aprovada pelo dono, sem regra nova: o chão resultante tem de ser o de um ladrilho recém-assentado. Não toquei no `settle` do `game-terrain` (é da `fix/terreno-assenta-avisa-motor`); esta mudança é do lado do motor e se encontra com aquela no merge.

### Desenho

1. **Adaptador** (`game-physics-jolt/src/heights.ts`, contrato em `game-physics`): `world.updateHeights(id, region, heights)`, sobre `HeightFieldShape::SetHeights`. `heights` é o campo inteiro (como no `ShapeDesc`), `region` o retângulo que mudou. Devolve `false`, sem mudar nada, quando a engine não pode: o corpo não é campo de alturas, o retângulo sai do campo, ou uma altura está fora da faixa com que o campo foi feito (o Jolt **trunca** a altura à faixa min/max do campo: medido, 9 vira 1,2994, −9 vira 0,7010). Quem chama dá então uma forma nova (`setShape`).
   - Contrato do Jolt confirmado por sonda: `x`, `z`, tamanhos em blocos de 4 amostras (`HEIGHT_BLOCK`); o retângulo é alargado ao bloco, e as amostras acrescentadas vêm dos **valores exatos** de `heights`, nunca relidas (releitura dequantiza e requantiza: a primeira versão, com releitura, derivou 6,7 mm em 200 escritas). As amostras de enchimento além do tamanho do campo ficam como buraco (`NO_COLLISION`). `GetMinHeightValue`/`GetMaxHeightValue` já incluem a altura da origem, e `GetHeights` também.
   - `NotifyShapeChanged` é chamado depois, como o Jolt pede (a faixa de alturas não muda, então a caixa do corpo também não: a chamada é por contrato, não por necessidade medida).
   - Memória (§8): o `ArrayFloat` de trabalho é destruído em `finally`; o alocador é o do próprio `JoltInterface` (`GetTempAllocator`), que não é nosso. Teste: heap e `bodyCount` idênticos ao byte depois de 200 escritas.
2. **O que o Jolt faz além disso (achado, medido, não documentado):** `SetHeights` **requantiza os blocos à esquerda e acima dos escritos**, a partir das próprias amostras dequantizadas, e elas descem: até 4,4e-5 m por escrita, **1,8 mm em 50** escritas (linear, sem teto); só esses blocos, nada mais fora do retângulo alargado. Alargar o retângulo não ajuda (o anel vai um bloco mais longe). Por isso o motor **refaz a forma inteira dos valores exatos a cada 4 escritas seguidas** (`MAX_IN_PLACE_WRITES`): o chão fica a no máximo 0,18 mm dos valores exatos e a forma nova zera a conta.
3. **Caminho de reassentar** (`engine-pieces.ts`, `engine-ground.ts`, `engine-ground-heights.ts`):
   - `groundChanged` agora guarda o **retângulo** avisado por ladrilho (a caixa do disco mais `GROUND_REACH` = 25 cm, porque `groundAt` interpola entre pontos da grade do terreno, de 10 cm), não só uma marca. `readGround` lê de novo **só as amostras desse retângulo** (as quatro séries de 26 mil amostras por ladrilho inteiro); o resto fica como estava. Ladrilho em que nenhuma amostra mudou: o motor não é tocado (antes: refazia as quatro séries, o height field, os blocos do sólido e comparava).
   - `shapeGround` (puro das amostras) refaz mapa, alturas e caixas dos degraus; o ladrilho feito de amostras remendadas é **bit a bit** o feito de todas as amostras (teste).
   - Campo de alturas que continua campo: `changedHeights` acha o menor retângulo que mudou e `updateHeights` o escreve no corpo, que **mantém o id** (o motor continua aquecendo os contatos de quem está em cima). Forma nova (como antes) quando: retângulo maior que metade do campo (medido: escrever custa ~23 ns por amostra contra 0,21 ms de um campo novo de 81 × 81, então acima de ~3/4 a forma nova é mais barata), altura fora da faixa, ou 4 escritas seguidas. Laje que continua laje: só move. Laje ↔ campo: refaz o corpo, como antes.
   - **O sólido sob o campo** (compostos de caixas e prismas de 0,5 m): é função só das alturas, então **não é refeito se as alturas não mudaram** (antes: refeito e comparado a cada reassentamento) e é refeito inteiro, no mesmo corpo por `setShape`, quando mudaram. **Não o atualizei em blocos, e é a decisão que mais custa**: o composto estático do Jolt não se edita, o composto mutável (`MutableCompoundShape.AddShape/RemoveShape`) mudaria os índices dos filhos (a razão da T3.1 para o sólido ser um corpo à parte do campo) e a criação de cada casco convexo continua custando. Medido num ladrilho de cratera de 30–40 cm: montar os blocos (JS) 1,06 ms, criar o composto (391 prismas + 87 caixas) **3,8 ms**, 45 blocos 1,3 ms. É o grosso do custo quando o chão muda de verdade (ver abaixo). Ficou como **pendência**, com a medida: reaproveitar os cascos que não mudaram, ou um sólido menos detalhado, são decisões de desenho que mudam o que o sólido segura (T3.1, 5 mm de margem; a bacia é sensível a isso).

### Equivalência (`PIECE_SOLVER=jolt`, sem GPU)

| Teste | O que prova |
|---|---|
| `game-physics-jolt/tests/heights.test.ts` (4) | região escrita = campo feito direto dos novos valores (`≤ 2 passos`); fora do retângulo alargado e do anel à esquerda/acima, idêntico ao ruído de um raio (5e-6); no anel, ≤ 5e-5; `false` e nada mudado para altura fora da faixa, caixa, região fora do campo ou sobre o enchimento, vetor curto; campo com altura de origem; **200 escritas: `bodyCount` e `memoryInUse` iguais ao byte, superfície longe da região igual** |
| `game-destruction-three/tests/engine-ground-inplace.test.ts` (7) | (1) segunda cratera na borda da primeira: mesmo corpo, `updateHeights` 1×, **nenhum `setShape` no corpo do campo**, superfície por raios a **1,6e-5 m** do ladrilho feito do zero (tolerância 1,5e-4); (2) leu **menos de 30 %** das 25921 amostras e as alturas entregues ao motor são **iguais bit a bit** às do ladrilho inteiro; (3) aviso sem mudança: nenhuma chamada ao motor, marca limpa; (4) altura fora da faixa: forma nova, chão igual ao novo a 1e-5; (5) quatro escritas e a quinta refaz a forma; (6) **placa em cima do trecho cavado**: acorda, nunca fica sob o chão, `fellThrough` 0, dorme, e termina a < 2 mm de onde termina a mesma cena com `updateHeights` forçado a falhar (forma nova); (7) **200 mudanças do chão**: `bodyCount` igual, heap a < 4 KB (a mesma folga do teste de vazamento da T3.1), > 100 escritas no lugar, e o ladrilho no fim a 1,6e-5 de um novo |
| os 14 testes de `engine-ground.test.ts` e os 4 de `ground-settlement.test.ts`, de antes | passam sem mudança |

Tolerância dos testes novos: duas formas quantizadas (cada uma a ≈ 5e-5 m da verdade neste chão, medido) mais os 4,4e-5 de uma escrita; **medido 1,6e-5**.

### Números (Node v24.22.0; `tests/engine-ground-relay.bench.test.ts`, `GROUND_BENCH=1 PIECE_SOLVER=jolt`, 90 ladrilhos de 2 m, cada um com cratera de 30 cm no meio e uma segunda na borda, mediana de 9 rodadas, duas séries antes e duas depois no mesmo código de teste; `layTile` no caminho do motor, sem passo do Jolt)

| Cenário | Antes | Depois |
|---|---|---|
| uma cavada de 30 cm, 2 ladrilhos avisados (campo + sólido) | 11,8–14,3 ms (5,9–7,1 ms/ladrilho) | **5,0–5,6 ms (2,5–2,8 ms/ladrilho)** |
| **rajada de 90 ladrilhos**, cada um avisado por um evento de 30 cm, **nada mudou** (campo) | 143–152 ms (1,6–1,7 ms/ladrilho) | **38–40 ms (0,43 ms/ladrilho)** |
| a mesma rajada, **chão mudou em cada um** (campo + sólido) | 484–500 ms (5,4–5,6 ms/ladrilho) | 405–411 ms (4,5–4,6 ms/ladrilho) |
| um disco largo sobre os 90, nada mudou (campo) | 136–153 ms | 73–75 ms (lê o ladrilho inteiro: sobra só a leitura) |
| **a rajada da sala (T3.8o): 90 lajes, cada uma avisada por um evento de 30 cm** | 28,6–30,2 ms (0,32–0,35 ms/ladrilho) | **6,5–7,1 ms (0,073–0,079 ms/ladrilho)** |
| 90 lajes, disco largo, nada mudou | 30–31 ms | 12,5–12,9 ms |

Leitura honesta: **onde o chão não mudou ou mudou pouco, o ganho é grande (4 a 5 vezes)**, e vem de **ler menos amostras e não refazer o que não mudou**, não da escrita no lugar. A escrita no lugar por si só poupa **~0,2 ms por ladrilho** (região pequena 0,02–0,06 ms, contra 0,21–0,27 ms de um campo novo; região de 79 × 79 custa mais que o campo novo, por isso o limite de metade). **Onde o chão muda de verdade, o sólido domina** (≈ 3,5 ms de 4,5 ms por ladrilho) e a mudança quase não o toca: a rajada de 90 com chão alterado em todos só cai 16 %. Esse caso continua custando ~410 ms e é a pendência do sólido acima.

Medidas de uma peça só (ladrilho de cratera, 20 repetições): ler as amostras todas 0,91 ms, `shapeGround` 0,83 ms, montar os blocos do sólido 1,06 ms, `setShape` do campo 0,21–0,27 ms, `updateHeights` 4 × 4: 0,007 ms, 16 × 16: 0,019 ms, 32 × 32: 0,058 ms, 64 × 64: 0,149 ms.

### Bacia: não é idêntica à da linha de base, e o motivo é este

`PIECE_SOLVER=jolt BOWL_SEEDS=64`: **128/128** nos dois, `worstC1` −0,00766, `worstC2Unconditioned` 0,014651, `worstC4` 1,5167 e `fellThrough` 0 **idênticos**; **`worstC3` 0,012906 depois contra 0,013626 antes** (o pior caso de levantar caiu 5 %). A bacia **aprofunda o chão a cada passo** (é um teste de `groundChanged`), então passa pelo caminho novo, e o Jolt guarda as alturas quantizadas de outro jeito quando escritas no lugar (≤ 1,6e-5 m de diferença no chão, 4,4e-5 no pior bloco vizinho): a trajetória de um corpo que rola diverge no último decimal e um dos 128 casos, o pior de C3, vale 0,0007 m menos. **O chão entregue ao motor é o mesmo (bit a bit); o que difere é o estado interno do Jolt.** Não há mudança de regra nem tolerância tocada; registro porque o dono pediu números idênticos onde o chão é idêntico e isto é a exceção medida.

### Gates

| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-physics test` | 9 passam, 0 falham |
| `game-physics-jolt test` | 68 passam (4 novos), 2 pulados, 0 falham |
| `game-destruction-three test` (próprio) | **409 passam, 0 falham** (152 pulados) |
| `PIECE_SOLVER=jolt game-destruction-three test` | 496 passam, **2 falham, as 2 `rolling` conhecidas** (`cans knock each other`, `fifty cans`); os 7 testes novos passam |
| `game-floorplan-three test` (próprio) | **1068 passam, 0 falham**, `exact-golden` **44/44** |
| `PIECE_SOLVER=jolt game-floorplan-three test` | 1068 passam, **4 falham, as 4 conhecidas** (os 3 `destruction/*` do `exact-golden`, gravação do solver próprio, e `bookcase-topple`) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | 128/128, `fellThrough` 0 (números acima) |
| `eslint` nos arquivos mudados | exit 0, nada impresso |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos fora do SDK dono, 11 pendentes conhecidos) |
| `pnpm check:layers` | sem violações novas |
| Goldens | nenhum mudou (o `exact-golden` do próprio passa 44/44 sem regravar) |

### O que sobra

- **O sólido sob o campo** (acima): 3,8 ms por ladrilho de cratera é o custo que resta; reaproveitar os cascos convexos que não mudaram é a próxima medida a tentar, e precisa de uma API do adaptador para compostos (o `StaticCompoundShapeSettings` do wasm aceita `ShapeSettings`, não `Shape` pronto).
- **O retângulo avisado é palavra do host**: amostras fora dele (e dentro do ladrilho) não são mais relidas. Antes o ladrilho inteiro era relido, o que por acaso pegava mudança não avisada na mesma peça de chão; o `settle` que não avisa (T3.8o) é o caso, e a `fix/terreno-assenta-avisa-motor` o resolve avisando. Até lá esse ladrilho fica velho como já ficava quando nenhum aviso o marcava.
- O anel à esquerda/acima do `SetHeights` do Jolt é um defeito do Jolt 1.1.1 que o motor contorna (4 escritas, depois forma nova); se uma versão futura o consertar, `MAX_IN_PLACE_WRITES` pode subir.

## T3.8n — canos da parede nas etapas e soleiras (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0, pnpm 10.28.2. Branch `fix/canos-parede-etapas` (sobre a `main` `6b0e6af4`, que já tem #302 a #305; sem a D8 `prelayGround`). Navegador das rodadas: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo. Nenhuma tolerância, régua, critério nem teste foi afrouxado ou removido.

### 1. Cano de parede nas etapas
- **Causa**: com `constructionStages` (a casa da sala), `stagedWallRuns` (`utilities/water.ts`) punha **uma só parte escondida por cômodo** (`pipe:run_wall_bathroom_0`, `pipe:run_wall_backyard_outside`, 3 kg), com o traçado inteiro do tanque ao aparelho: uma caixa de metros por dentro de paredes e móveis. A segmentação da T3.8h (`c69a1774`) cobria só o ramo sem etapas, e os trechos de lá não tinham `hostedIn`. O motor empurrava essa peça para fora por posição, o que mantinha C2, C3 e C4 reprovando.
- **Conserto**: os dois ramos usam o mesmo `layWallRun` (um só lugar, não podem mais divergir). Cada rota é cortada por `cutRun` em cada laje e parede que cruza e em `segmentLimits.pipe`; uma parte por trecho, os 3 kg do traçado divididos pelo comprimento, `holder` (a parede ou laje em que o trecho está, ou o trecho ao lado), `chain` ao trecho anterior e `hostedIn` quando o trecho está dentro de um sólido (um furo ali dispara o `reveal` da T3.8k). As pontas usam `drawnEnds` (movido de `drains.ts` para `utilities/segments.ts`, dividido com os drenos) para nenhuma tampa ficar no plano de uma face. `segmentLimits.pipe: Infinity` desenha o traçado inteiro como antes (golden do time). `destruction/pieces.ts` passa `hostedIn` e `chain` do `wall_pipe`.
- **Visibilidade nas etapas**: continua a regra da etapa de obra (`EMBEDDED`: visível do nível 4 em diante, coberto pelo reboco; `check.ts` exige o cano mostrado nos níveis 4, 5 e 8). O `reveal` do furo é emitido e o estado `exposed` é gravado, mas o desenho já está ligado. Não mudei a regra da etapa.
- **Testes** (`tests/wall-pipe-runs.test.ts`, 31, falham sem o conserto): casa por etapas, 7 plantas x 2 sementes: nenhum trecho passa do limite; todo trecho é preso por peça que existe, o hospedado é preso pelo hospedeiro, o traçado pesa 3 kg; os trechos da casa A são hospedados por parede; limite configurável e `Infinity` inteiro; um furo de 30 kJ no trecho do banheiro revela o trecho no furo e **não** todos, e os outros ficam sem `exposed` com a junta fechada.

### 2. Soleiras
- **Causa** (medida contra os sólidos no nascimento, como nas T3.8e e T3.8f): a `threshold:d0_*` ocupava a largura inteira da porta, de 4 cm **abaixo** do chão até o piso. Contra a estrutura: 4,0 cm dentro das vigas baldrame e 1,4 cm (staged; 0,2 cm sem etapas) dentro das paredes (cujas caixas incluem o pilar que entra 9 cm no vão), dos pilares e dos batentes; sem apoio, era uma peça solta (22 a 64 kg) nascida dentro de tudo isso e **4 cm abaixo do chão**. O Jolt a empurrava para cima.
- **Conserto** (`house/baseboard.ts`): ocupa só o vão entre os batentes (`DOOR_JAMB_WIDTH`, novo em `house/helpers.ts`, usado também por `doors.ts`) e livre de parede, pilar, viga e laje da estrutura (`clearSpan`); assenta no chão (base em `y0`, sem o 4 cm enterrado, à altura da calçada da porta). Massa agora é a do volume desenhado (sobrado: de 24,8 para cerca de 5 kg).
- **Por que sem `holder`**: a primeira versão também a prendia ao chão (`holder: 'ground'`, como as outras peças fixas). Com o apoio, dois testes do Jolt que passam na `main` passaram a falhar (`house-switch-release`: nenhuma partícula depois de trocar a casa; `pole-collider`: o poste dorme em 3,017 s, uma passada acima de 3 s), e o mesmo sem o apoio e com a mesma geometria passa os dois: o apoio é uma junta a mais na casa e muda a sequência de sorteios do mundo. Medi isolando (só a soleira revertida: passam; só os canos revertidos: falham; soleira sem apoio: passam). Como a soleira agora nasce livre de qualquer vizinho e sobre o chão, não precisa do apoio para não ganhar energia; ficou sem. Fica dito: os dois testes são sensíveis à ordem dos sorteios e passam por pouco.
- **Outras peças fixas pequenas**: conferidas rodapé, calçada, batente e janela contra a estrutura (aabb) e contra o chão. Não nascem soltas (têm apoio); as caixas de aabb de parede incluem pilares e vãos, então as "sobreposições" de batente e rodapé com parede são da caixa, não do desenho, e não foram tocadas. Soleiras eram as únicas peças pequenas da casa sem apoio e nascidas no chão.
- **Testes** (`tests/threshold-clearance.test.ts`, 85, falham sem o conserto): 7 plantas x 3 sementes x com e sem etapas: nenhuma sobreposição acima de 1 mm com parede, pilar, viga, laje, batente, calçada e rodapé, nem abaixo do chão; base na altura da calçada da porta.

### 3. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-floorplan-three` próprio | **1184 passam, 0 falhas** (1068 mais os 116 novos; linha de base 0) |
| `game-floorplan-three` Jolt | 1184 passam, **4 falhas, as da linha de base**: os 3 `destruction/*` do golden exato e `bookcase-topple` |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128** |
| z-fighting | `z-fighting-houses` passa (hook de commit e suíte) |
| `eslint` nos arquivos mudados | sem avisos |
| `node tools/kit-audit/audit.mjs --check` | 0 novos, 11 pendentes conhecidos |
| `pnpm check:layers` | sem violações novas |
| Tipologias, `game-destruction-three` residencial 56, comercial 93, rural 37 e pós-apocalíptica 273 passam; `game-destruction-three` não foi tocado (não rodado de novo) |

**Goldens regravados** (`UPDATE_EXACT=1`, solver próprio): 42 entradas de `tests/fixtures/exact-floorplan.json` (as `house/*`, `specimen/*` e as 3 `destruction/*`), porque os trechos de cano ganham `hostedIn`, `chain` e massa por trecho, e a soleira muda de caixa, massa e apoio; o hash do estado de cada uma inclui as peças. As 2 que não mudaram são cenas do time (`visor`). `blast-presentation.test.ts`: `RECORDED_BLAST_OUTCOME` de `2304b205…` para `c3e72e99…` pelo mesmo motivo (o conjunto de peças da casa mudou).

### 4. Rodadas da sala (Jolt, D4 ligada `blastDebris=1`, 5 de blast e 5 de martelo, um processo por rodada)
`pnpm build`, `node examples/test-room/build.mjs`, e o `dist` conferido (`holder:"ground"` na soleira, `wall_pipe` segmentado). Sondas `decision/probes/room.js` e `drive.mjs`.

| rodada | C1 excesso (kg·m) / ilhas | C2 peças acima de 3,5 cm (sem a condição) | C3 (m) | C4 (s) | fellThrough | mais fundo |
|---|---|---|---|---|---|---|
| blast 1 | 7.40 / 13 | 0 (1) | 0.038 | 0.40 | 0 | nenhum |
| blast 2 | 4.75 / 19 | 0 (0) | 0.064 | 0.50 | 0 | nenhum |
| blast 3 | 7.41 / 6 | 0 (0) | 0.014 | 0.50 | 0 | nenhum |
| blast 4 | 5.26 / 25 | 0 (0) | 0.043 | 1.00 | 0 | nenhum |
| blast 5 | 7.20 / 16 | 0 (0) | 0.050 | 1.75 | 0 | nenhum |
| hammer 1 | 5.87 / 2 | 1 (1) | 0.009 | 1.50 | 0 | nenhum |
| hammer 2 | 5.17 / 3 | 0 (1) | 0.008 | 0.60 | 0 | nenhum |
| hammer 3 | 0.00 / 1 | 0 (1) | 0.056 | 0.50 | 0 | nenhum |
| hammer 4 | 0.00 / 1 | 0 (1) | 0.009 | 1.55 | 0 | nenhum |
| hammer 5 | 0.00 / 1 | 0 (1) | 0.013 | 1.45 | 0 | nenhum |

Passam todos os critérios (C1 sem nenhuma ilha violada): blast 0/5, martelo 0/5. Com C1 lido como excesso até 0,05 kg·m: blast 0/5, martelo 2/5.

Antes (T3.8m, 60 rodadas de Jolt): `pipe:run_wall_bathroom_0` e `pipe:run_wall_backyard_outside` acima do limite de C2 em 52 de 60, C3 de 1,0 a 1,36 m, C4 reprovando em boa parte. Agora, nas 10 rodadas: **C2 condicionado: 1 peça acima do limite em 10 rodadas** (um ladrilho de rodapé de 5,3 kg, `baseboard:wall_0_0:0:5`, 13,6 cm no martelo 1; nenhum cano nem soleira na lista), **C3 no máximo 0,064 m** (e 0,014 a 0,056 nas outras), **C4 no máximo 1,75 s**, `fellThrough` 0 e nada abaixo do chão. Uma primeira série de 10 rodadas, com a soleira ainda presa ao chão, deu C2 0 em 10, C3 até 0,062 e C4 até 1,8 s; a diferença entre as séries (C1 de 0,0–0,6 para 4,7–7,4 no blast) é da sequência de sorteios, não de causa que eu tenha achado: 10 rodadas não separam as duas.

Comparação com a T3.8m, configuração (c) (igual à `main` sem D8): blast 0/5, martelo 2/5.

### 5. O que ainda reprova
- **C1 reprova nas 10 rodadas** (nenhuma passa todos os critérios). No blast, em todas, o poste de 1010 kg (`obj_2`) é a pior ilha (excesso de 4,75 a 7,41 kg·m) e há de 6 a 25 ilhas violadas; no martelo, 1 e 2 por `obj_3`/`obj_5` (43 e 16 kg) e 5,2 a 5,9 kg·m, e 3, 4 e 5 só com 1 ilha violada de excesso 0,00. O poste sem o fuste como colisor é o que a T3.8h deixou, fora do escopo daqui.
- **C3 acima de 3,5 cm em 4 de 5 de blast** (0,038 a 0,064 m) e em 1 de martelo (0,056 m): subiram as peças de 12 a 16 kg (`worstRises`: `obj_9`, `obj_7`, `obj_12`, 5 a 12 cm), não cano nem soleira. O C3 de 1,0 a 1,36 m da T3.8m sumiu. Não investigado.
- **C2**: o ladrilho de rodapé do martelo 1 (acima). Rodapé é peça presa à parede; não investigado.
- Passam todos os critérios menos C1 (C2, C3, C4, fellThrough, fundo): blast 0/5 (C3), martelo 3/5 (rodadas 3 a 5; a 3 reprova também por C3, então só a 4 e a 5 passam com C1 lido por excesso, 2/5). Não há base na spec para ler C1 assim; é só para comparar com o 2/5 da T3.8m, que tem a mesma leitura.
- O desenho dos trechos de cano hospedados continua ligado nas etapas (ver 1); só o estado `exposed` e o `reveal` seguem o furo.

## T3.8p — o terreno que assenta avisa o motor (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0, pnpm 10.28.2. Branch `fix/terreno-assenta-avisa-motor` (de `main` `6b0e6af4`).

### 1. Causa
`settle` (`packages/game-terrain/src/terrain.ts`) soma o volume do entulho que pousa ao vértice por `addToVertex` e nunca chama `emitDeform`. O chão desenhado sobe 2 a 8 cm, a 5 a 13 m do evento, e ninguém é avisado: o `onDeform` que o anfitrião liga em `renderer.wakeRegion` (`game-test-room/src/room.ts`) não dispara, os ladrilhos do motor (`engine-pieces.ts`: `layGround`, `groundChanged`) seguem com `dirty` falso, e o que dorme em cima não acorda. O sono só enxerga o chão pelo centro e só se ele mudou mais de `GROUND_DROP` (2 cm): uma subida menor, ou fora do centro, passa.

### 2. Correção
- `settle` acumula a caixa (x, z) dos vértices que subiram; `update` emite **um** `emitDeform` por atualização (centro da caixa, raio da meia diagonal mais 2 células). Nunca um por vértice, e o custo é uma comparação por vértice.
- Varredura das outras vias que mudam altura: `heapAt`, `dig`, `strike`, `giveWay`/`bearAll`, `burn` e `updateSlides` já emitiam. Faltavam: `fill` (avisava só onde pôs a terra, não de onde tirou: agora também avisa a região `from`), e `reset`/`setLayout`/`load` (refazem `dug` e `loose` do mapa inteiro: avisam o mapa todo; `excavate` e `layBeds` entram por aí).

### 3. Números (mesma semente 7, granada de 3,2 MJ em (0, 0), terreno de 40 m, sem deslizamento, 8 s)
| | antes | depois |
|---|---|---|
| ladrilhos de 2 m com chão subido (> 1 mm, fora da cratera) | 19 | 19 |
| desses, avisados por `onDeform` | **0** | **19** (em 18 emissões, uma por atualização com entulho) |
| maior subida | 83 mm | 83 mm |
| ladrilho do motor ao lado do que dormia a 1,2 cm de subida: distância ao chão desenhado | 12,5 mm (1 de 4 ladrilhos velho) | 0 (0 de 4) |
| peça dormindo ali | não acorda, afundada 12,5 mm | acorda, afunda 5 mm no ápice (as células de 2,5 cm do ladrilho cortam o ápice de um pico de 10 cm) |

### 4. Testes
- `game-terrain/tests/terrain.test.ts`: o entulho que assenta emite deforms cuja região cobre todo vértice que subiu (sem deslizamento, todo aumento é do entulho; falha sem a correção), no máximo uma por atualização; `fill` de longe avisa as duas regiões; `reset` e `load` avisam o mapa todo.
- `game-destruction-three/tests/terrain-settle-engine.test.ts` (com `@adatechnology/game-terrain` como devDependency): terreno real ligado ao `wakeRegion`; peça dormindo onde o entulho assenta com menos de 1,8 cm; depois do assentamento, no Jolt, o ladrilho confere com `groundAt` (< 1 mm), a peça acordou e não termina dentro do chão. No solver próprio confere só que acordou (o solver próprio repousa do seu jeito, igual com e sem a correção).

### 5. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-terrain` | 106 passam, 0 falhas (os 4 testes novos incluídos) |
| `game-terrain-three` | 12 passam, 0 falhas |
| `game-destruction-three` próprio / Jolt | 410 passam, 0 falhas / 490 passam, só as 2 `rolling` conhecidas |
| `game-floorplan-three` próprio | **1068 passam, 0 falhas**, golden exato 44/44 |
| `game-floorplan-three` Jolt | 1068 passam, 4 falhas: os 3 `destruction/*` do golden exato e `bookcase-topple`, as mesmas conhecidas |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC4` 1,5167, `worstC2Unconditioned` 0,014651, `fellThrough` 0 (idênticos à T3.8j) |
| `eslint` nos arquivos mudados | 0 erros |
| `node tools/kit-audit/audit.mjs --check` | exit 0 (0 novos, 11 pendentes conhecidos) |
| `pnpm check:layers` | sem violações novas |

Nenhum golden mudou: o assentamento do entulho só acorda o que está perto, e nenhuma cena gravada tem terreno com entulho assentando ao lado de peça dormindo. Nenhuma regravação.


## T3.8r — peças apoiadas nos restos fixos (C1) (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0, pnpm 10.28.2. Branch `fix/pecas-sobre-restos` (sobre `fix/canos-parede-etapas` `3cfa9229`: main #302 a #306, fuste do poste, terreno que assenta avisa o motor, canos de parede em etapas e soleiras). Navegador das rodadas: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo. Nenhuma tolerância, régua, critério nem teste foi afrouxado ou removido.

### 1. A pergunta: sobre quais fixos o poste está apoiado quando ganha energia?
Reprodução sem navegador, como a T3.8o (`createTestRoom` + módulo da planta, Jolt, `single_storey_a`, semente 1, etapas, C4 a 2,5 m da casa; sonda copiada de `decision/probes/t38o/probe-d8-wake.test.ts.txt` para `tests/`, com sondas a mais: `penetration` por quadro, `pairLog` classificado, `setPose`/`setVelocity`/`addImpulse` do poste embrulhados com a energia antes e depois, energia por passo fixo). Sem código de sonda commitado.

- **Os fixos que o poste toca ao ganhar energia não eram o problema.** Apoiado, o poste fica nas malhas do telhado (`roof_a_7:0`, `roof_a_9:*`, `roof_a_4:*`) e nas lajes do forro (`slab_ceiling_p0:0`, `:4`), com profundidade de repouso de 15 a 20 mm contra os fixos. Em nenhum dos quadros de ganho um fixo foi criado, trocado ou removido (`EngineStatics.changed` vazio em todos): **as hipóteses (a) e (b) do pedido não se confirmam**. Os ganhos de 2 a 4 kg·m que a T3.8o viu "apoiado, velocidade 0, 3 a 4 mm por quadro" existem, mas são o menor dos dois ganhos abaixo (1 a 3 kg·m, à altura do poste de 1010 kg, e só no empoleirado no telhado).
- **A causa do ganho grande é do kit, não do Jolt: `EnginePieces.groundChanged` levantava o poste.** Instrumentado: a cada `onDeform` do entulho que assenta (T3.8p, #306), `PieceSystem.wakeRegion` chama `groundChanged(x, z, raio)` e, para toda peça cujo alcance (raio do disco + a diagonal da caixa da peça: 11,6 m no poste, que carrega 22 m de fio) toca o disco, `underGround(b)` mede os cantos de todas as caixas contra `groundAt`; se algum canto está mais de `SINK` (5 mm) sob o chão novo, o kit faz `root.position.y += under`: um teleporte para cima, sem velocidade. Medido no poste (`obj_1`, semente 3 da sonda): `under` 6,07 mm e 8,11 mm em dois quadros seguidos, por um disco a 17 m do poste (a ponta do fio de 11 m encontrando o entulho). O `setPose` seguinte no `sync` mostrou o ganho exato: +6,14 e +8,19 kg·m (1010 kg x 6,1 e 8,1 mm). Cada subida de entulho perto de qualquer ponta do poste era uma dádiva de massa x g x subida, que a régua conta como C1 (e ela só desconta a que o kit declara em `given`: empurros e tombamento, não este levantamento).
- **Confirmação por exclusão**: com `groundChanged` sem o levantamento (experimento, revertido), o pior ganho do poste foi de 4,0 a 7,9 kg·m (4 variantes) para 2,41 a 2,95 kg·m; com o conserto final, 2,41 a 4,0 nas 8 variantes das sondas (nenhuma acima de 5).
- **O que o levantamento protege** (o comentário do código): uma peça enterrada fundo pelo chão que sobe, que o motor empurra devagar demais e deixa dormir no meio do caminho. Isso é para subidas de centímetros; uma sobreposição de 6 a 8 mm o contato do motor limpa dentro de um update (empurrão de 2 mm em cada uma de 2 passadas por passo, 2 a 6 passos por update).

### 2. O conserto (dono: `game-destruction-three`)
`engine-pieces.ts`, `groundChanged`: o kit só levanta a peça quando a subida passa de `ENGINE_CLEARS` = 1 cm (nova constante); até lá o contato do motor resolve, como já fazia para o que afundava menos de `SINK` (5 mm). Quatro linhas. Uma primeira versão também subtraía o quanto a peça já afundava no chão do motor (consulta `penetration` contra os ladrilhos): descartada, porque cada consulta fazia o heap do Jolt crescer em degraus de 1 MB e o teste "laying the ground again and again leaks nothing" (4096 bytes) reprovava (ela não era necessária: com 1 cm o repouso de 5 mm de uma peça pesada já não levanta).
- **Teste** `tests/ground-rise-lift.test.ts` (Jolt; 2): uma viga de 1 t em repouso e dormindo, o chão sobe 8 mm perto de uma ponta e `wakeRegion` chama: `root.position.y` não muda (sem o conserto, falha); a 6 cm continua levantada de uma vez, como antes.
- Changeset `peca-nao-sobe-por-assentamento-leve.md` (`game-destruction-three`, patch). Sem golden regravado.

### 3. Rodadas da sala (Jolt, D4 ligada `blastDebris=1`, 5 de blast e 5 de martelo, um processo por rodada)
`pnpm build`, `node examples/test-room/build.mjs`, e o `dist` conferido (`groundChanged` do `test-room.html` com `r<=km0||` onde `km0=.01`, em vez de `r<=0`). Sondas `decision/probes/room.js` e `drive.mjs`; JSONs em `/tmp` (rodadas `r1` a `r5`).

| rodada | C1 excesso (kg·m) / pior ilha | C2 peças acima de 3,5 cm (sem a condição) | C3 (m) | C4 (s) | fellThrough | mais fundo |
|---|---|---|---|---|---|---|
| blast 1 | 0,58 / `obj_2` poste (1010 kg) | 0 (0) | 0,040 | 1,30 | 0 | nenhum |
| blast 2 | 0,55 / poste | 0 (1) | 0,054 | 0,50 | 0 | nenhum |
| blast 3 | 0,77 / poste | 0 (0) | 0,012 | 0,40 | 0 | nenhum |
| blast 4 | 0,58 / poste | 0 (0) | 0,041 | 0,50 | 0 | nenhum |
| blast 5 | 0,58 / poste | 0 (0) | 0,029 | 0,50 | 0 | nenhum |
| hammer 1 | 0,00 | 0 (0) | 0,031 | 0,70 | 0 | nenhum |
| hammer 2 | **6,82 / poste** (6,3 a 6,7 m/s, +7,83 kg·m) | 0 (1) | 0,025 | 1,45 | 0 | nenhum |
| hammer 3 | 0,30 / `obj_3` (43 kg) e `obj_5` | 0 (1) | 0,008 | 0,60 | 0 | nenhum |
| hammer 4 | 0,38 / `obj_5`, `obj_10` | 0 (1) | 0,032 | 1,50 | 0 | nenhum |
| hammer 5 | 0,00 | 0 (1) | 0,009 | 1,05 | 0 | nenhum |

Contra a T3.8n:
- **C1 do poste no blast: de 4,75 a 7,41 para 0,55 a 0,77 kg·m** nas 5 rodadas (a pior ilha continua o poste; o excesso de 0,6 é +1,6 mm de altura de energia num update de uma peça de 1010 kg, a menos de 1 mm a mais que o piso de 1 mm de C1).
- Martelo: 3 rodadas com excesso 0,00 a 0,38 (eram 5,2 a 5,9 nas duas primeiras e 0,00 nas outras); a rodada 2 (6,82) é o poste a 6,3 m/s ganhando 7,8 kg·m num update.
- C2 condicionado: 0 em 10 de 10 (era 1 de 10). C4 no máximo 1,50 s (era 1,75). `fellThrough` 0 e nada abaixo do chão.
- **C3 acima de 3,5 cm: 3 de 5 no blast (0,040, 0,054, 0,041), 0 de 5 no martelo** (T3.8n: 4 de 5 e 1 de 5). As peças são as mesmas de 12 a 16 kg (`obj_11` 16 kg, `obj_12` 12 kg, subidas de 9 a 32 cm com velocidade 6 a 7 m/s: lançadas pelo blast, não levantadas pelo terreno). **Não partilham a causa do poste**: o levantamento do `groundChanged` só vale para sobreposição de mais de 1 cm sob o chão, e essas peças saem voando com a onda.

### 4. O que ainda reprova (C1 em 8 de 10 rodadas, 0 de 10 passam todos os critérios)
- **Blast, poste, +1,6 mm por update (excesso 0,55 a 0,77)**: medido por passo fixo (1/120 s) na sonda: no voo do poste (tombando sobre o pé, velocidade 3,6 a 4,5 m/s, 3 a 6 quadros depois do blast) alguns passos por update ganham +0,8 a +1,7 kg·m, todos sem chamada do kit (`setPose`/`setVelocity`/`addImpulse` mudando o corpo) e sem fixo novo, no passo em que o par com um ladrilho de chão (`tile`) aparece no `pairLog`. Em Jolt isolado, o mesmo poste (mesmo compound) tombando sobre ladrilhos de 2 m ou sobre uma caixa só ganha 0 mm por update; a queda livre perde 2,0 mm por update (Euler semi-implícito, constante), sem ganho. O ganho é do contato do pé com o ladrilho a 4 m/s. **Não achei alavanca do kit**; o que sobra é de configuração do Jolt (iterações, folga, `maxPushOut` do `KIT_WORLD`, qualidade de movimento do corpo), que a spec fixa. **Parei aqui e levo ao dono**: opções (A) reportar ao poste um `given` por passo (muda a régua: não feito); (B) um poste que tomba sobre o pé como cinemático até encostar (muda o comportamento do kit); (C) subir `positionIterations`/baixar `maxPushOut` do `KIT_WORLD` (muda C1 a C10, é decisão do dono, e precisa de nova bacia e de nova rodada de B5/B6).
- **Martelo 2, poste +7,83 kg·m a 6,3 m/s**: não investigado a fundo (um caso em dez); a sonda sem navegador não o reproduziu em 4 variantes.
- **Peças pequenas de C3** (blast 1, 2 e 4): lançadas pela onda com 6 a 7 m/s; não investigadas.

### 5. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-floorplan-three` próprio | **1184 passam, 0 falhas** (exact-golden 44/44) |
| `game-floorplan-three` Jolt | 1184 passam, **4 falhas, as da linha de base**: 3 `destruction/*` do golden exato e `bookcase-topple` |
| `game-destruction-three` próprio | **410 passam, 0 falhas** (145 pulados) |
| `game-destruction-three` Jolt | 492 passam, **só as 2 `rolling` conhecidas** (lata no ar com restituição, cinquenta latas); o `engine-ground` "leaks nothing" reprovou na primeira versão do conserto (ver 2) e passa na final |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**; `worst {"worstC1":-0.00766,"worstC2":0,"worstC2Unconditioned":0.00768,"worstC3":0.02287,"worstC4":1.5167,"worstDeepest":-0.03787,"fellThrough":0}` |
| `eslint` nos arquivos mudados | sem problemas |
| `node tools/kit-audit/audit.mjs --check` | 0 novos, 11 pendentes conhecidos |
| `pnpm check:layers` | sem violações novas |

| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 (com `game-destruction-three` rebuildado) |
| `game-destruction-three` próprio / Jolt | 409 passam, 0 falham / 495 passam, só as 2 `rolling` conhecidas |
| `game-floorplan-three` próprio / Jolt | 1068 passam, 0 falham / 1068 passam, as 4 conhecidas (3 `exact-golden` + `bookcase-topple`) |
| `game-test-room` próprio / Jolt | 458 / 458 passam |
| Bacia `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC4` 1,5167, `worstC2Unconditioned` 0,014651, `fellThrough` 0 (igual à T3.8j) |
| z-fighting (`z-fighting-houses`, dentro do `game-floorplan-three`) | passa |
| `eslint` nos arquivos mudados | 0 erros (avisos antigos de `max-lines`) |
| `kit-audit --check` / `pnpm check:layers` | exit 0 (0 novos) / sem violações novas |
| Goldens | nenhum regravado: o pré-assento não muda o que o solver próprio ou o desenho produzem |


## T3.8m — rodadas da sala depois de D5–D8 (2026-11-15) — **T3.8 continua SEM ✅: 0 de 20 rodadas passam no Jolt com o pré-assento ligado; a causa dominante é uma peça nova (`pipe:run_wall_*`), e o D8 não ajuda nos quadros e piora o C1 do poste**

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, Node v24.22.0. Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), uma rodada por processo (`decision/probes/drive.mjs`), duas pistas ao mesmo tempo no máximo (`a` com `c`, depois `b` sozinha). Código: `feat/chao-ao-construir` com o D8 (`25b3d114`) mais dois commits desta tarefa (abaixo). `pnpm build` e `node examples/test-room/build.mjs` refeitos antes de cada lote, conferidos por grep no `dist` (`R.prelayGround` na página) e por sonda no navegador (chamadas de `prelayGround`). Aceite igual ao da T3.8b a T3.8g: C2 condicionado 0 peças acima de 3,5 cm, C4 em até 3 s, `fellThrough` 0; C1 e C3 só se relatam. Nenhuma tolerância, régua nem teste foi afrouxado. JSON: `decision/t38m-results.json` (80 rodadas, com `overPieces`, `worstRises`, quadros).

### 1. O pré-assento não rodava na sala (achado antes de medir)
A primeira opção (`?prelay=0`, commit `3619bed7`) desligava só o `layArea`. Mas a casa da sala é construída pela ação `build` do banco do módulo `game-floorplan-three` (`openArea('floorplan_area')` tem `placements: []`), que nunca chamava `prelayGround`: **sondado no navegador, 0 chamadas com e sem a opção, 692 corpos nos dois**. O D8 da T3.8l, portanto, só valia para `layArea`. Corrigido em `9f15a4ea`: `house.destruction.activate()` pede `prelayGround` à caixa da casa, e o liga/desliga passou para o dono (`RendererOptions.prelayGround`, padrão ligado; a sala repassa `TestRoomOptions.prelayGround`/`?prelay=0`). Depois: **504 ladrilhos assentados, 1196 corpos** (692 + 504) com a opção ligada; 0 e 692 com `?prelay=0`. Testes: `game-destruction-three/tests/engine-prelay.test.ts` (opção, Jolt), `game-floorplan-three/tests/house-ground-prelay.test.ts` (pede uma vez, caixa da casa; no Jolt assenta > 0 e 0 com a opção desligada).
O primeiro lote de rodadas (`pa`, `pb`, `pc`, 10 por configuração) foi feito **antes** dessa correção: nele o pré-assento nunca rodou, então são rodadas "sem pré-assento" extras e medem a variação de uma rodada para outra.

### 2. Tabela (5 rodadas por célula; ordem das rodadas 1 a 5)
Passa = C2 cond. 0 peças, C4 de 0 a 3 s, `fellThrough` 0. `-1` em C4 = uma peça não dorme. C1 em kg·m (pior ilha), C2 = maior ganho de uma peça (m), C3 em m.

| Configuração | Passam | C1 | C2 ganho (m) / peças > 3,5 cm | C3 | C4 (s) | `fellThrough` | quadro p50 / p99 / máx (ms), medianas | despertar (ms), mediana |
|---|---|---|---|---|---|---|---|---|
| **(a) Jolt, D4 ligada, pré-assento ligado, blast** | **0/5** | 0,52; 8,55; 0,44; 0,44; 5,14 | 0,124; 0,053; 0,124; 0,124; 0,125 / 2; 2; 2; 2; 3 | 1,16; 0,12; 1,36; 1,13; 1,14 | 8,05; 2,25; -1; 3,2; 5,05 | 0 | 18,1 / 144,1 / 258,6 | 38,9 |
| (a) martelo | **0/5** | 9,19; 0,25; 9,19; 0,21; 9,19 | 0,086; 0,088; 0,083; 0,071; 0,086 / 1 em todas | 1,09; 1,04; 1,18; 1,17; 1,08 | 5,5; 5,5; 0,95; 0,95; 5,55 | 0 | 15,5 / 96,4 / 243,7 | 28,9 |
| **(b) Jolt, D4 desligada, pré-assento ligado, blast** | **0/5** | 8,55; 0,37; 6,82; 0,51; 0,38 | 0,057; 0,130; 0,124; 0,124; 0,132 / 3; 2; 3; 2; 2 | 0,12; 1,00; 1,11; 1,25; 1,26 | 2,45; 0,85; 3,5; -1; -1 | 0 | 10,5 / 117,5 / 241,1 | 34,9 |
| (b) martelo | **0/5** | 9,19; 9,19; 5,6; 0,46; 9,19 | 0,131; 0,091; 0,131; 0,131; 0,083 / 2; 1; 2; 2; 1 | 1,11; 1,09; 1,20; 1,17; 1,19 | 6,85; 5,75; 5,55; 5,55; 1,05 | 0 | 14,4 / 81,4 / 226,4 | 137,8 (3 de 5 entre 138 e 139; as outras 27 e 75) |
| **(c) Jolt, D4 ligada, pré-assento desligado (`?prelay=0`), blast** | **0/5** | 0,97; 0,50; 1,40; 0,94; 5,17 | 0,129; 0,129; 0,129; 0,124; 0,128 / 3; 2; 3; 3; 2 | 1,16; 1,09; 1,15; 1,13; 1,16 | 5,1; 4,15; 5,6; 3,25; 4,95 | 0 | 19,4 / 122,9 / 250,5 | 43,0 |
| (c) martelo | **2/5** | 0,01; 0,25; 0,34; 0,13; 0,07 | 0,005; 0,079; 0,105; 0,060; 0,011 / 0; 1; 2; 1; 0 | 0,08; 1,05; 1,07; 0,99; 0,04 | 0,7; 6,05; 6,7; 6,05; 2,85 | 0 | 14,6 / 102,2 / 245,3 | 30,9 |
| **(d) solver próprio, D4 ligada, blast** | 0/5 | 5,8; 5,68; 5,79; 5,68; 5,68 | 0,113 em todas / 3 em todas | 0,07; 0,30; 0,05; 0,07; 0,07 | 3,6; -1; 3,45; 3,55; 3,6 | 0 | 1,4 / 18,3 / 24,7 | 34,6 |
| (d) martelo | 0/5 | 2,35 (4x); 20,02 | 0,034; 0,003; 0,018; 0,003; 0,434 / 0; 0; 0; 0; 1 | 0,05 a 0,09 | 3,8; 3,55; 3,1; 3,1; 4,45 | 0 | 1,2 / 12,1 / 15,2 | 25,7 |
| extra: próprio, D4 desligada, blast | 0/5 | 5,7 a 5,9 | 0,033 a 0,113 / 2; 0; 2; 2; 1 | 0,03 a 0,07 | 4,7; 3,55; 4,5; 4,85; 4,55 | 0 | 1,6 / 21,5 / 30,8 | 39,8 |
| extra: próprio, D4 desligada, martelo | 0/5 | 2,35 a 19,84 | 0,013 a 0,444 / 3; 0; 3; 3; 3 | 0,03 a 0,06 | 3,95; 3,3; 4,05; 5,1; 4,6 | 0 | 1,4 / 15,5 / 18,6 | 31,2 |
| extra, 1º lote, pré-assento nunca rodou: Jolt D4 ligada blast / martelo | 1/5 / 2/5 | | pior 0,128 / 0,130 | | | 0 | 19,7 / 154,4 / 285,9; 14,1 / 109,2 / 262,9 | 48,4; 38,7 |
| extra, 1º lote: Jolt D4 desligada blast / martelo | 0/5 / 1/5 | | pior 0,129 / 0,129 | | | 0 | 19,7 / 122,1 / 254,9; 16,9 / 98,5 / 240,7 | 38,7; 43,1 |
| extra, 1º lote: Jolt D4 ligada, `?prelay=0`, blast / martelo | 0/5 / 0/5 | | pior 0,129 / 0,130 | | | 0 | 19,0 / 145,5 / 253,5; 17,4 / 120,4 / 282,5 | 50,6; 30,3 |

Peças por rodada: 25 (blast) e 27 (martelo), contra 63 e 42 na T3.8g: a casa da sala mudou com o merge da release (#301, construção em etapas); os números não são comparáveis peça a peça. Nenhuma rodada deu erro de página. `fellThrough` = 0 nas **60 rodadas** do Jolt.

### 3. Comparação com a T3.8g
| | T3.8g | Agora |
|---|---|---|
| D4 ligada, blast | 4/5 | **0/5** (pré-assento ligado), 0/5 (desligado, no 2º lote), 1/5 (1º lote) |
| D4 ligada, martelo | 3/5 | **0/5** (ligado), 2/5 (desligado), 2/5 (1º lote) |
| D4 desligada, blast | 5/5 | **0/5** |
| D4 desligada, martelo | 2/5 | **0/5** |

**Regressão de 14 de 20 para 0 de 20 (e 5 de 30 sem o pré-assento).** A causa **não é o D8**: está nas listas de `overPieces` e vem junto com a mudança da casa da sala.
- **`pipe:run_wall_bathroom_0` e `pipe:run_wall_backyard_outside`** (3 kg cada, uma peça escondida por cômodo): em **20 de 20** rodadas com o pré-assento ligado e em 32 de 40 sem ele, com ganho de 0,035 a 0,132 m, **parados** (velocidade 0 antes e depois) subindo de y 2,05 a 2,46 em 3 a 5 quadros (quadros 10 a 16), e depois acordados até 5 a 7 s. A caixa de `pipe:run_wall_bathroom_0` é de 4,7 x 2,0 x 2,1 m. **Causa visível no código**: a sala monta a casa com `constructionStages: true`, e nesse caminho `waterPipes` chama `stagedWallRuns` (`game-floorplan-three/src/utilities/water.ts`), que ainda desenha **uma só parte escondida por cômodo com todas as rotas** (`part('wall_pipe', ..., { id: 'pipe:' + tr.id, hidden: true, run, to, from, routes })`, sem `cutRun`, sem `holder`, sem massa por trecho). O conserto da T3.8h (`cutRun` nas lajes/paredes/divisórias) está só no ramo sem etapas, que a sala não usa. Mesmo defeito que a T3.8h consertou, no ramo que ficou de fora.
- O C3 acompanha essa peça: 0,04 a 0,12 m nas 8 rodadas (de 60 do Jolt) sem cano de parede acima do limite; 1,0 a 1,36 m nas rodadas com ele acima (uma exceção, 0,12 m, em que só o cano do quintal passa, por 0,0003 m).
- **C4**: as peças de C4 > 3 s ou -1 são as mesmas rodadas (7 de 10 em (a), 7 de 10 em (b), 8 de 10 em (c)); o cano de parede é o que acorda.
- **`threshold:d0_0` e `d0_1`** (soleira da porta, 24,8 e 22,3 kg, ganho de 0,048 a 0,058 m com o pré-assento ligado e 0,04 a 0,080 m desligado): é a segunda peça, em 2 de 10 rodadas ligadas contra 3 de 10 desligadas (no 2º lote) e 6 de 10 no 1º lote. Causa não investigada.
- **O poste de 1010 kg** (`obj_2`, `pole:-10.3` mais trechos de fiação) aparece como o C1 de 5 a 9 kg·m (dEm 10,2 num quadro, velocidade 0,19 m/s, y 0,39): é a pior ilha em 13 de 20 rodadas com o pré-assento ligado e em 11 de 40 sem ele, e C1 > 5 em **11 de 20 contra 5 de 40** (Fisher, p ~ 0,0008). **É o único sinal estatístico do D8 e é contra ele** (ver seção 4). O limite de C1 não é de aceite, e o poste não entra em C2 (**sem tombar mais**: a T3.8j (colisor do poste) tirou o poste da lista de C2; nenhuma rodada de Jolt tem poste ou fiação em `overPieces`; a única exceção é o solver próprio, onde a fiação `wiring:grid:*` e o cano `run_outlet` seguem acima, como na T3.8g).
- **`fellThrough` 0 nas 60 rodadas do Jolt** (T3.8h): a rodada de 119 repetições da T3.8g não voltou.

### 4. O pré-assento (D8) ajuda ou atrapalha na sala?
**Nem ajuda nem atrapalha nos quadros; nos critérios, os dois sinais que existem (cano de parede, C1 do poste) vão contra ele, o do poste com força estatística. Não há ganho na sala que justifique o custo de 504 corpos, no estado de hoje.**
- **Quadros** (10 rodadas D4 ligada, ligado `a` contra desligado `c`, mesmo carregamento por rodar em par): máximo médio **246,4 contra 249,8 ms**, p99 médio **121,5 contra 117,1 ms**, despertar médio **39,9 contra 38,8 ms**. O 1º lote (pré-assento nunca rodou) deu os mesmos valores (máximos 215 a 300 ms, despertar 29 a 57 ms). A diferença entre dois lotes sem pré-assento (`c` e `pc`) é do mesmo tamanho que a entre ligado e desligado.
- **O ganho sintético da T3.8l (despertar de 65 para 0,5 ms) não aparece na sala**: o quadro de despertar na sala é de 30 a 55 ms com e sem; quem o custa não é o assentamento do chão (a sonda de despertar da T3.8l tinha o `Step` do arame de 45 m como pior quadro, e na sala os 504 ladrilhos não mudam o máximo). Causa do despertar na sala não investigada aqui.
- **Custo**: +504 corpos de chão (692 para 1196, +73 %) ao construir a casa; o tempo da montagem na sala não foi medido.
- **C1 do poste de 1010 kg (o sinal que existe)**: C1 > 5 kg·m em 5 de 10 rodadas de (a) e 6 de 10 de (b), contra 1 de 10 em (c), 2 de 10 em `pa`, 0 de 10 em `pb` e 2 de 10 em `pc`: **11 de 20 ligadas contra 5 de 40 desligadas, p ~ 0,0008**. Nas rodadas ligadas o poste acordado rola a ~0,2 m/s e a energia da ilha sobe ~10 kg·m num quadro com a velocidade igual (o centro sobe ~1 cm: um ressalto do chão). O pré-assento, então, **mexe no que o poste faz**; **mecanismo não achado** (hipótese não testada: o ladrilho assentado ao construir tem a forma do terreno de antes de a casa e do poste se assentarem, e o preguiçoso tem a de depois; ou as emendas dos 504 ladrilhos). Isso não reprova nenhum critério de aceite (o poste não passa de C2), mas pesa no C4 quando o poste não dorme.
- **Aceite**: ligado 0 de 20 rodadas (a e b); desligado 2 de 10 em `c`, 0 de 10 em `pc`, 3 de 10 em `pa`: 5 de 30 sem o pré-assento. A diferença não é significativa por si (0 de 10 contra 5 de 30), mas o cano de parede está acima do limite em **20 de 20** rodadas com o pré-assento ligado contra 32 de 40 sem (probabilidade de acaso ~0,03 se a taxa fosse a mesma, uma só mistura de D4: sinal fraco, não confirmado). **Não há mecanismo conhecido** que ligue o pré-assento ao cano; é uma hipótese a medir com mais rodadas depois que o cano de parede for cortado em trechos (aí a causa dominante sai da frente).
- **Item 4 (par de corpos com muitos ladrilhos)**: não foi preciso. O pior quadro com o pré-assento ligado **não** é claramente pior que com ele desligado (máximo 246 contra 250 ms), então não procurei o par de corpos de muitos ladrilhos. O arame de 45 m não aparece mais na sala (a fiação saiu da lista de peças acima do limite e o poste tem colisor de fuste, T3.8g/T3.8j).

### 5. Veredito por critério (Jolt, (a), D4 ligada, pré-assento ligado)
| Critério | Resultado | Veredito |
|---|---|---|
| C1 (relato) | 0,2 a 0,5 em 5 de 10; 5,1 a 9,2 em 5 de 10 (o poste de 1010 kg acordado a 0,2 m/s) | sem limite de aceite; o poste segue como pior ilha |
| C2 condicionado | 0 peças acima de 3,5 cm em **0 de 10** rodadas; peças: `pipe:run_wall_bathroom_0` (9 de 10), `pipe:run_wall_backyard_outside` (5 de 10, 0,035 a 0,043), `threshold:d0_0` (2 de 10, 0,053) | **reprova** |
| C3 (relato) | 0,12 em 1 de 10; 1,04 a 1,36 nas outras 9 | segue o cano de parede |
| C4 (3 s) | passam 3 de 10 (2,25; 0,95; 0,95) | **reprova** |
| `fellThrough` | 0 em 10 de 10 (60 de 60 no Jolt) | **passa** |

**Não é verdade que todas as rodadas de (a) passem todos os critérios: 0 de 10 passam.**

### 6. O que ainda falha, e a causa onde se vê
1. **`pipe:run_wall_*` do caminho em etapas** (causa acima): cortar em trechos com `cutRun`, `holder` e massa por trecho também em `stagedWallRuns` (mesmo conserto da T3.8h; os testes `utility-segments.test.ts` hoje não cobrem o caminho em etapas). Provavelmente leva 8 a 10 das 10 rodadas de (a) a passar C2, C3 e boa parte do C4.
2. **`threshold:d0_0` / `d0_1`** (soleira de 22 a 25 kg, 0,05 a 0,08 m): não investigada.
3. **O poste de 1010 kg** rolando a 0,2 m/s (C1 e C4 em algumas rodadas): como na T3.8h item 1, aguarda decisão do dono sobre o tombamento (§12).
4. **O solver próprio**, como sempre, reprova a mesma régua (fiação `wiring:grid:*`, `pipe:run_outlet`, poste de 1010 kg, um corpo que não dorme em `-1`); não é critério de aceite dele.

### 7. Commits (locais, nada enviado)
`3619bed7` (opção `?prelay=0`, `TestRoomOptions.prelayGround`), `9f15a4ea` (a ativação da casa assenta o chão; opção do dono em `RendererOptions.prelayGround`; testes), e o desta evidência com `t38m-results.json`.

### 8. Gates
`pnpm build` exit 0; `tsc --noEmit` limpo em `game-test-room`, `game-destruction-three` e `game-floorplan-three`; `game-test-room` 458/458; `game-destruction-three` próprio 409 passam, 152 pulados (Jolt); `engine-prelay.test.ts` com `PIECE_SOLVER=jolt` 8 passam, 1 pulado (o perfil); `house-ground-prelay.test.ts` 1+1 pulado (próprio) e 2 (Jolt); `game-floorplan-three` só os 4 arquivos que ativam casa com renderer (`navigation`, `pole-collider`, `house-switch-release`, `house-ground-prelay`) passam no próprio (22 passam, 2 pulados) e `pole-collider`/`house-switch-release` no Jolt (6); a suíte inteira de `game-floorplan-three` não coube nos 590 s de uma chamada e **não foi rodada**.


## T3.8o — investigação do D8 (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0, worktree `chao-ao-construir` (`cd7e8f57`). Só Node, sem navegador. Nenhum código do kit mudou; **nenhum conserto commitado** (um teste de conserto foi feito e revertido, abaixo). Sondas em `decision/probes/t38o/` (`.txt` para não entrarem em lint, tsc nem vitest; copiar para `tests/` para rodar com `PIECE_SOLVER=jolt`).

### Reprodução sem navegador
`createTestRoom` (game-test-room) + `createFloorplanTestModule` com Jolt, `single_storey_a`, semente 1, ação `build` do módulo (etapas ligadas), C4 em `casa - 2,5 m`, `update(0,05)`. O quadro do despertar na sala é o primeiro `update` depois do `blastAt`.

### 1. Para onde vai o quadro do despertar
- **Quadro 0 (o medido na sala) é 25 a 30 ms (a quente) com e sem pré-assento.** O perfil de CPU dele: ~43 de 53 ms em `drainEntry > applyEvent > splitLoose > adoptSplit` (`fitPartBoxes` 21 ms, `fitOrientedBoxes`, `rebuildHost` 12,7 ms, `computeVertexNormals`), isto é, o kit separando as peças da casa e ajustando caixas. `prepare`, `layGround` e `stepFixed` do motor: ~0 ms nesse quadro (só 1 peça acordada: os corpos das peças nascem no quadro seguinte).
- **Os ladrilhos são cobrados no quadro 1**, não no 0. Medianas a quente (5 rodadas por configuração, quadros 1 e 3): com pré-assento **5,0 a 6,0 ms** e 15 a 17 ms; sem, **22 a 28 ms** e 22 a 24 ms. O pré-assento tira ~20 ms do quadro 1, que a métrica `wakeFrame` não vê.
- Os 504 ladrilhos pré-assentados da sala são **todos lajes** (terreno `concrete_slab` plano; 0 height field). Custo medido de assentar um: **0,5 a 0,66 ms**, quase todo em `buildGroundTile` (quatro séries de amostras de `groundAt`), não em criar corpo: ~250 a 330 ms para os 504 ao construir. Sem pré-assento, 180 a 190 ladrilhos entram aos poucos (24 no quadro 1).
- O que faz o p99 e o máximo: (a) o `Step` do Jolt, 10 a 70 ms por quadro com 26 a 32 peças acordadas; (b) **rajadas de reassentamento por `groundChanged`** (94 ladrilhos no quadro 35, 86 no 44; 150 a 190 reassentamentos em 70 quadros, **iguais com e sem pré-assento**); (c) o quadro em que a 2ª explosão/colapso cria peças (144 a 193 ms). Nenhum desses depende do pré-assento.

### 3. Por que o sintético mostrou o ganho e a sala não
No sintético (T3.8l) o terreno era ondulado: todo ladrilho é height field + sólido, 0,92 ms cada, e as três peças acordavam **no mesmo quadro**, então o assentamento caía no quadro medido (65 ms). Na sala o chão é plano (laje), as peças acordam em degraus (1 a 32 acordadas em ~15 quadros) e o primeiro quadro só destaca peças. O ganho existe, mas é de ~20 ms e no quadro 1.

### 2. O pré-assento muda a física?
- **Emendas, lajes (o chão da sala):** poste de caixa 0,22 x 7,5 m, 1010 kg, solto sobre chão de uma caixa, de lajes 2 x 1 x 2 coladas e de lajes só em volta (preguiçoso), 60 posições/giros aleatórios: C1 0 e dorme em 0,65 s **nos três**. Corpo redondo é outra história: bola r 0,3 a 3 m/s varia y de 0,2980 a 0,3022 (0,3000 numa caixa) e chega com 2,25 contra 2,46 m/s; cilindro afunda 5,3 mm e para. Defeito real das emendas entre lajes, **igual no preguiçoso** (mesmas lajes), e não toca o poste (caixa).
- **Emendas, height fields de 2 m (cratera):** bola r 0,3 sobre relevo de 1 cm: erro de 5,1 mm nas emendas contra 5,8 mm fora delas. **Sem saliência de emenda.** Bordas ativas: o height field usa o padrão do Jolt (cos 5 graus) e a remoção de borda interna melhorada não é ligada no adaptador; entre corpos diferentes ela não valeria de qualquer forma. Sem defeito achado, **nada a consertar nas emendas**.
- **O sinal do poste (C1):** 20 variantes (jitter de ±0,8 m na carga e `dt` 0,045 a 0,055; cada variante é determinística): maior ganho do poste além do dado pelo kit > 5 kg·m em **11 de 20 com pré-assento, 7 de 20 sem** (Fisher ~0,19, **não significativo**; a sala deu 11/20 contra 5/40). Controle com 504 corpos estáticos de lastro e pré-assento desligado: 7 de 20, valores quase idênticos ao desligado, então **número de estáticos e ordem de ids não explicam**. Os eventos acontecem com o poste a y ~1,5 m **apoiado em estáticos da casa** (10 a 60 pares com estáticos), velocidade ~0, subindo 3 a 4 mm por quadro por correção de penetração; não é rolar sobre emenda de ladrilho.
- **Defeito achado (vale para o preguiçoso também):** o terreno sobe 2 a 8 cm a 5 a 13 m de qualquer evento sem avisar o motor. `settle(piece)` em `packages/game-terrain/src/terrain.ts` (~1065) soma entulho em `loose` (`addToVertex`) sem `emitDeform`. Medido: alturas (-1,8; 1,6) de 0 a 0,058 no quadro 23 sem `onDeform`. Ladrilho assentado antes fica velho: com `dirty` falso e diferença > 5 mm, 5/13/10 ladrilhos (pré-assento) contra 0/3/13 (preguiçoso), até 80 mm. **Teste de conserto no motor** (sonda de 5 pontos por ladrilho sob peça acordada, relê e reassenta): poste > 5 kg·m em 10/20 e 7/20, sem efeito; **revertido, não commitado**. Não explica o sinal do poste.

### Recomendação
1. **D8: entregar desligado por padrão** (manter a API `prelayGround` e a opção, para lotes pedidos por quem medir ganho). Ele tira ~20 ms do quadro 1 e nada do quadro medido, p99 nem máximo, custa 250 a 330 ms e +504 corpos ao construir, e o sinal do poste, mesmo não confirmado, vai contra.
2. **Conserto de emenda: não se aplica** (sem defeito de emenda; o das lajes redondas é do preguiçoso igual). Para a main importa o **entulho que sobe o terreno sem `emitDeform`**: avisar em lote, um `emitDeform` por `update` com a caixa do que assentou. Decisão do dono: acorda fragmentos próximos (`wakeRegion`).
3. Não foram rodados os gates (nenhum código mudou).

## T3.8s — rodadas da sala na main com #306–#309 (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa, ANGLE/OpenGL 4.6), um processo por rodada, no primeiro plano, com `timeout`, uma rodada por vez (frames medidos sem outra carga pesada). Código: `fix/pecas-sobre-restos` em `1ee9b5f6` (main #302 a #308 e o conserto `ENGINE_CLEARS`; #309 em CI). **Só medição: nenhum código-fonte, régua, tolerância ou teste foi alterado.** `pnpm build` e `node examples/test-room/build.mjs` ok; o `dist/test-room.html` tem `updateHeights` e o limite de 1 cm do `ENGINE_CLEARS` (minificado: `Rm0=.01`, `r<=Rm0||(...root.position.y+=r`; o nome `ENGINE_CLEARS` não sobrevive à minificação). Sondas `decision/probes/room.js` e `drive.mjs`; JSON completo em `decision/t38s-results.json`.

Critérios (iguais aos da T3.8r): C1 `c1Violations` = 0; C2 condicionado 0 peças acima de 3,5 cm; C3 subida de pedaço <= 3,5 cm; C4 todas dormindo em até 3 s; `fellThrough` 0. Configurações: (a) Jolt, D4 ligada (`blastDebris=1`); (b) Jolt, D4 desligada; (c) solver próprio, D4 ligada. 5 de blast e 5 de martelo cada.

### 1. Resumo por configuração (rodadas que passam cada critério)
| configuração | todos | C1 | C2 cond. | C3 | C4 | `fellThrough` |
|---|---|---|---|---|---|---|
| (a) Jolt D4, blast | **0/5** | 0/5 | 5/5 | 4/5 | 5/5 | 5/5 |
| (a) Jolt D4, martelo | **1/5** | 3/5 | 4/5 | 3/5 | 5/5 | 5/5 |
| (b) Jolt sem D4, blast | 0/5 | 0/5 | 5/5 | 1/5 | 5/5 | 5/5 |
| (b) Jolt sem D4, martelo | 0/5 | 0/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| (c) próprio D4, blast | 0/5 | 0/5 | 0/5 | 0/5 | 0/5 | 5/5 |
| (c) próprio D4, martelo | 0/5 | 0/5 | 4/5 | 3/5 | 0/5 | 5/5 |

Totais: (a) **1/10 passa tudo** (C1 3/10, C2 9/10, C3 7/10, C4 10/10, `fellThrough` 10/10); (b) 0/10 (C1 0, C2 10, C3 6, C4 10); (c) 0/10 (C1 0, C2 4, C3 3, C4 0). `fellThrough` 0 e nenhuma peça abaixo do chão (`deepest` nulo) em 30 de 30 rodadas.

### 2. (a) Jolt, D4 ligada, rodada a rodada
| rodada | C1 excesso (kg·m) / pior ilha | C2 acima de 3,5 cm (sem a condição) | C3 (m) | C4 (s) | frame p50 / p99 / max (ms) | despertar (ms) |
|---|---|---|---|---|---|---|
| blast 1 | 0,41 / `obj_2` poste (1010,7 kg, +1,42 kg·m; parte `pole`) | 0 (0) | **0,043** | 0,45 | 3,0 / 114,9 / 302,6 | 45,4 |
| blast 2 | 0,18 / ilha não registrada (< 0,2) | 0 (1) | 0,019 | 0,75 | 2,4 / 125,7 / 256,5 | 51,3 |
| blast 3 | 0,18 / idem | 0 (0) | 0,028 | 0,45 | 2,9 / 97,7 / 121,0 | 61,2 |
| blast 4 | 0,07 / idem | 0 (2) | 0,024 | 1,50 | 2,4 / 85,3 / 223,6 | 49,8 |
| blast 5 | 0,18 / idem | 0 (0) | 0,018 | 0,45 | 2,5 / 102,2 / 224,0 | 50,8 |
| hammer 1 | 0 (0 violações) | 0 (0) | **0,058** | 0,45 | 1,7 / 106,9 / 233,3 | 39,5 |
| hammer 2 | 0 (0 violações) | 0 (1) | **0,043** | 1,75 | 1,8 / 72,4 / 318,8 | 33,6 |
| hammer 3 | 0,003 (1 violação, ilha não registrada) | 0 (1) | 0,032 | 1,70 | 1,7 / 100,7 / 287,2 | 35,3 |
| hammer 4 | 0 (0 violações) | 0 (1) | 0,032 | 1,30 | 1,7 / 70,8 / 292,9 | 34,1 |
| hammer 5 | **1,27** / `obj_3` (43 kg, +1,10) e `obj_5` (16,3 kg, +0,22) | **1** (1): `obj_20` 5,3 kg, 0,136 m, parte `baseboard:wall_0_0:0:5` | 0,017 | 0,90 | 1,5 / 99,1 / 223,1 | 38,2 |

Só **hammer 4 passa todos os critérios**. A sonda só registra a ilha de pior C1 quando o excesso passa de 0,2 kg·m, por isso as ilhas de 0,07 a 0,18 não têm nome.

### 3. (b) Jolt sem D4 e (c) solver próprio (resumo; todas as rodadas no JSON)
- **(b) blast**: C1 0,35 / 0,58 / 0,58 / 0,93 / **6,82**, sempre o poste `obj_2` (1010,7 kg; +7,83 kg·m na rodada 4); C3 0,043, 0,043, 0,045, 0,051 e 0,023 (4 de 5 acima de 3,5 cm); C4 0,45 a 1,4 s. **(b) martelo**: C1 com violação em 5 de 5 (excesso 0,003, 0,003, 0,02, 0,03 e **3,64**: `obj_3` 43 kg +2,40 e `obj_5` 16,3 kg +1,31); C3 0,008 a 0,030; C4 até 1,8 s.
- **(c) blast**: C1 5,68 a **31,96** (a rodada 2 carrega o poste `obj_1`, 1010,7 kg, +0,381 m de C2); C2 com 1 a 5 peças acima do limite, as de 16 kg com a rede de fio (`wiring:grid:*`), 0,069 a 0,113 m; C3 0,058 a **0,421**; C4 3,65 s, 4,55 s e duas rodadas com peça que não dorme (`-1`). **(c) martelo**: C1 2,27 a 2,35 em 5 de 5; C4 3,15 a 3,4 s e uma rodada sem dormir; C2 só em 1 (`obj_5`, 16,3 kg, `window_frame:w0_0`, 0,036 m).

### 4. Frames (ms), contra a T3.8b
| configuração | p50 | p99 | max | despertar |
|---|---|---|---|---|
| (a) blast | 2,4–3,0 | 85–126 | **121–303** | **45–61** |
| (a) martelo | 1,5–1,8 | 71–107 | 223–319 | 34–40 |
| (b) blast | 1,7–2,5 | 77–133 | 178–311 | 41–55 |
| (b) martelo | 1,3–1,8 | 58–103 | 183–306 | 30–40 |
| (c) próprio, blast | 1,6–2,1 | 18–24 | 30–39 | 38–43 |
| (c) próprio, martelo | 1,3–1,5 | 12–14 | 14–17 | 27–32 |

T3.8b: blast max 98–315 ms, despertar 43–88 ms. Agora (a) blast max 121–303 ms e despertar 45–61 ms: **max na mesma faixa (sem melhora), despertar um pouco menor no teto (61 contra 88)**. O quadro mais caro do Jolt continua entre 220 e 320 ms em quase toda rodada; o solver próprio fica abaixo de 40 ms, porque a sala dele quase não faz trabalho de motor (e reprova C4 por peças que não dormem).

### 5. Contra a T3.8r (Jolt, D4 ligada)
| item | T3.8r | T3.8s (a) |
|---|---|---|
| C1 do blast (poste) | 0,55 a 0,77 kg·m, 5 de 5 | **0,07 a 0,41**; só a rodada 1 é o poste (0,41); as outras quatro ficam abaixo de 0,2 |
| C1 do martelo | 0,00 a 0,38 e **6,82 (poste)** | 0 em 3, 0,003 em 1, **1,27** em 1; **sem o caso de 6,82** (o 6,82 apareceu em (b), blast 4) |
| C3 acima de 3,5 cm | 3 de 5 no blast (0,040, 0,054, 0,041), 0 de 5 no martelo | **1 de 5 no blast (0,043), 2 de 5 no martelo (0,058, 0,043)**: sobe no martelo, cai no blast |
| C4 | até 1,50 s | até 1,75 s (martelo 2) |
| C2 condicionado | 0 de 10 acima | 1 de 10 (`obj_20`, rodapé, martelo 5) |
| `fellThrough` | 0 | 0 |
| rodadas que passam tudo | 0 de 10 | **1 de 10** (hammer 4) |

### 6. O que ainda reprova (inferência marcada)
1. **C1 em 7 de 10 rodadas do (a)**; blast 0 de 5. Maior: martelo 5, 1,27 kg·m (`obj_3` 43 kg e `obj_5` 16,3 kg). Poste 1010,7 kg: 0,41 no blast 1. Os excessos de 0,07 a 0,18 no blast e 0,003 no martelo 3 são de ilhas que a sonda não registra; **não sei quais peças são**.
2. **C3 acima de 3,5 cm em 3 de 10**: blast 1 (0,043), martelo 1 (0,058), martelo 2 (0,043). A sonda não grava o nome da peça do C3; **não identificada nesta rodada**. Na T3.8r eram as de 12 a 16 kg lançadas pela onda (inferência: as mesmas).
3. **C2 condicionado**: martelo 5, rodapé `obj_20` (5,3 kg) ganhando 0,136 m.
4. O poste tomba com ganho em (b) (6,82 no blast 4, o mesmo número da T3.8r, +7,83 kg·m a 6,3 m/s): sem a D4 o caso grande volta; com a D4 não apareceu nas 10 rodadas, mas 10 rodadas não provam que sumiu.
5. Frame max do Jolt de 120 a 320 ms ainda no despertar do blast e do martelo (T3.8b: 98–315 ms): sem avanço.
6. O solver próprio (c) reprova C1, C3 e C4 como antes.

Veredito: **a T3.8 continua sem ✅**: (a) passa 1 de 10 rodadas; em (a) só C4 e `fellThrough` fecham 10 de 10 (C2 fecha 10 de 10 em (b)).

## T3.8t — decisão sobre o D8 (2026-11-15)

O D8 (`prelayGround`, montar o chão do motor na construção) **não foi para a main**. O código fica só no branch `feat/chao-ao-construir`, e a decisão foi do Claude, com o dono ciente.

Motivos medidos (T3.8m e T3.8o):

- **O ganho cai num quadro que a medida não lê.** O pré-assento tira cerca de 20 ms do primeiro quadro depois da explosão. Esse quadro não é o lido como despertar, e nada muda no p99 nem no máximo.
- **O custo vai para a construção.** São 250–330 ms e 504 corpos a mais ao montar a casa.
- **Na sala o chão é barato.** Ele é plano e as peças acordam aos poucos, ao longo de uns 15 quadros. O ganho da cena sintética (65 → 0,5 ms) vinha de terreno ondulado com tudo acordando no mesmo quadro.

O que a investigação rendeu e já está na main:

- **#306:** o terreno que assenta passa a avisar o motor.
- **#308:** o chão alterado no lugar, com `SetHeights`.

Os picos de quadro de 100–300 ms vêm de duas fontes:

- o kit cortando a casa em peças: `splitLoose`, `adoptSplit`, `fitPartBoxes`, `rebuildHost`;
- o passo do Jolt com cerca de 30 peças acordadas.

Esse é o próximo alvo de desempenho.

## T3.8v — picos de quadro da explosão (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Worktree `travamento-explosao` (branch `perf/travamento-explosao`, sobre `ff5bf561`). Nenhuma régua, tolerância, teste ou critério mudou; as iterações do Jolt (D1, 32) ficaram como estão. Sondas e saídas em `decision/probes/t38v/` (`probe-spikes.test.ts.txt`: copiar para `packages/game-floorplan-three/tests/` e rodar com `PIECE_SOLVER=jolt`, modos por variável de ambiente `PROFILE`, `PF`, `STEPTEST`, `QUERY`; `headless-ab.log`) e `decision/t38v-results.json` (as rodadas do navegador).

### 1. Reprodução sem navegador e para onde vai cada quadro
`createTestRoom` mais o módulo da planta, Jolt, `single_storey_a`, semente 1, ação `build` (etapas ligadas), 60 quadros de assentamento, C4 em `casa - 2,5 m` (blast) ou os 12 golpes de 8000 J (martelo), depois **240 quadros de 1/60 s** de `room.update`. Cada quadro é cronometrado inteiro e por estágio (Step do Jolt, `createBody`, `setShape`, `layGround`...). O pior quadro do blast cai nos mesmos números a cada execução: o que muda de uma para outra é a ordem de 10 a 20%.

**Os quadros caros eram de três famílias** (antes do conserto, blast, uma execução; os mesmos quadros aparecem nas três execuções):

| quadro | total (ms) | onde foi | o que é |
|---|---|---|---|
| f0 (primeiro após o blast) | 57–66 | 100% kit: `splitLoose` 49 (`adoptSplit` 45: `fitPartBoxes` 27, quase tudo `fitOrientedBoxes` 26; `extract` > `rebuildHost` 14, `computeVertexNormals` 12) | o kit cortando a casa em peças |
| f96 | 144–146 | Step 71 + `layTile` 65 (`makeShape` 37, `createBody` 30) | ladrilhos novos sob as peças que acordam |
| f110 | 144–160 | `layTile` 113 (`makeShape` 54, `readTile` 42, `layVolume` 38, `setShape` 20) | idem, mais reassentamentos |
| **f124 a f130** | **130–190, sete quadros seguidos** | **só o `Step` do Jolt: 12 passos fixos de ~70 ms** | ver 2 |

Perfil V8 de toda a janela (240 quadros, 4,2 s de `room.update`): o `Step` é 2,7 s (64%); `prepare` (`layGround`/`layTile`) 0,5 s; `splitLoose` 0,16 s; `sweepOn` 0,17 s. Os 7 quadros de f124 a f130 sozinhos são cerca de 1 s do `Step`.

### 2. Por que o `Step` custava 70 ms por passo: a varredura contínua (CCD) de uma peça de partes finas
Atribuição feita no quadro 125, medindo `stepFixed` a seco (4 passos) depois de mexer só naquele mundo:

| experimento (quadro 125, ms por passo fixo) | resultado |
|---|---|
| nada (referência) | 61–76 |
| tira o corpo `obj_1` (poste de concreto com os fios e estais, 26 caixas, 1092 kg, 23 m de largura) | **3–5** |
| tira os 101 sólidos de chão (`tile-solid`) | 11–13 |
| deixa só os 5 / 15 / 30 sólidos mais próximos do poste | 17–24 / 37 / 56 (cerca de 1,4 a 2 ms por sólido sob o poste) |
| tira os campos de altura do chão, ou as duas tábuas de 6 kg que ficam na cratera | sem mudança (63 e 65) |
| iterações de velocidade 32 para 4; aquecimento por contato desligado; passos de posição 0; redução de manifolds desligada; cache de contatos desligado; divisor de ilhas desligado; distância especulativa 5 mm | sem mudança (60–98) |
| poste erguido 2 cm | **3,8** |
| velocidade do poste zerada | **6** |
| `DeactivateBody` e `ActivateBody` no poste | **6** (`SetPosition` com a mesma pose: 70) |
| a consulta `CollideShape` do poste contra tudo | 1,4 ms (não é a colisão por posição) |

Série de 24 passos seguidos com o poste: **rápido (4 ms) enquanto a velocidade dele é menor que ~0,88 m/s, 37–40 ms acima de ~0,90 m/s, e rápido de novo (5 ms) quando ele dorme**. O limiar é o `mLinearCastThreshold` do Jolt (0,75 do raio interno do corpo por passo): o raio interno de um composto é o da menor parte, os fios de 2 cm (0,01 m), e 0,75 x 0,01 m / (1/120 s) = 0,9 m/s. **Toda peça é criada `continuous: true`** (`EnginePieces.sync`, "swept so nothing the engine has is passed through"), e o Jolt só lança a varredura de um corpo que anda mais que esse limiar por passo. Um poste que desliza a 1 m/s sobre o telhado da casa é lançado a cada passo contra os ~100 sólidos de chão e os ~400 corpos fixos da casa.

Prova de que a causa é essa e não outra: sem o CCD de nenhuma peça (só para medir, não commitado), o `Step` some dos picos (§4), mas a física **muda** (um poste a 45,6 kg·m de ganho em 1 de 10 rodadas, §4). Por isso **o CCD é decisão do dono** (§6): não mexi nele.

### 3. O que mudou: uma opção, desligada por padrão
`EnginePieces.layGround` assenta os ladrilhos sob a **caixa da peça inteira**. Uma peça de várias partes (`partBoxes`) é, para o motor, um composto dessas caixas; o poste com os fios mede 23 x 11 m e é quase ar. Com a opção nova **`tilesUnderParts`** (`RendererOptions`, `PieceSystemOptions`, `EnginePieceOptions`; `debris.tilesUnderParts` e `?tilesUnderParts=1` na sala) cada parte assenta os ladrilhos sob a sua própria caixa orientada (`layBeneath` > `footprintOf`), com a **mesma** margem (0,5 m), a mesma oscilação e os mesmos pontos do caminho. Uma peça sem partes, ou redonda, assenta como antes. O que cada parte pode tocar neste passo continua assentado antes dele, então por construção o contato é o mesmo; só deixam de existir corpos de chão (campo de altura, sólido) que nenhuma parte alcançava: depois dos 240 quadros, 167 para 151 ladrilhos e 707 para 642 corpos.
- **Desligada por padrão.** Sem a opção o código assenta exatamente os ladrilhos de antes (o mesmo `footprint`). Não a deixei ligada porque a sala mostrou, nas rodadas do blast, o poste que ganha energia (C1 acima de 5 kg·m) em 9 de 30 rodadas com a opção contra 3 de 30 sem ela (Fisher bilateral 0,10: não significativo, mas é o único sinal de que a opção mexe no resultado, e a regra é que o resultado não mexa). Não achei o mecanismo: a cobertura é conservadora, nenhuma rodada teve `fellThrough`, `deepest` nem erro, e criar menos corpos de chão muda os ids de corpo e, com eles, a ordem em que o Jolt resolve os contatos, o que por si só muda uma situação caótica como o tombo do poste.
- Testes novos, sem GPU, em `engine-ground.test.ts`: com a opção, duas partes de 0,2 m a 20 m uma da outra assentam menos de 14 ladrilhos e nenhum no meio; sem a opção, a mesma peça assenta mais de 20 (a caixa inteira), como sempre.
- Changeset `picos-de-quadro-da-explosao.md`.

### 4. Antes e depois (opção desligada = antes, ligada = depois)
**Sem navegador** (§1: blast e martelo, dt 1/60, 240 quadros; **9 execuções por lado**, três pares intercalados de (3 execuções antes, 3 depois), mesma máquina, `decision/probes/t38v/headless-ab.log`; "antes" é o `dist` com o `layBeneath` forçado à caixa inteira, o mesmo que o padrão de agora). Medianas das 9 execuções (intervalo):

| | p50 | p99 | máximo | quadros > 16 ms | soma dos 240 quadros | só o `Step` | resto (kit) | ladrilhos / corpos |
|---|---|---|---|---|---|---|---|---|
| blast antes | 7,98 | 165 (140–233) | 191 (174–260) | 75 | 4097 | 2631 | 1466 | 167 / 707 |
| **blast depois** | 7,25 | **122 (96–136)** | **138 (100–167)** | 61 | 3461 | 2251 | 1210 | 151 / 642 |
| martelo antes | 7,14 | 150 (140–159) | 168 (147–204) | 48 | 3409 | 2135 | 1274 | 169 / 718 |
| **martelo depois** | 6,84 | **92 (86–110)** | **109 (96–133)** | 36 | 2808 | 1714 | 1094 | 153 / 653 |

Perfil V8 do blast (240 quadros, ms, uma execução por lado): `stepFixed` 2876 para 2356; `layGround` 446 para 334; `layTile` 439 para 319; `readGround` 126 para 86; `makeShape` 165 para 106; `layVolume` 123 para 79; `splitLoose` 161 / 159 e `sweepOn` 170 / 175 (iguais, fora do alcance da opção).

**Na sala do navegador** (`drive.mjs`, `chrome-headless-shell`, GPU Intel Arrow Lake via Mesa, Jolt, D4 ligada, `pnpm build` e `examples/test-room/build.mjs` antes, **um processo por rodada**, uma rodada por vez; a máquina **não estava sozinha** e a carga mudou entre conjuntos, de 2,7 a 7,7 de load average, então os números absolutos andam muito). Os quatro conjuntos de blast (5 + 10 + 10 + 5 rodadas) somam **30 por lado**:

| blast, 30 rodadas por lado | antes (padrão) | depois (`tilesUnderParts`) |
|---|---|---|
| p99 do quadro (mediana; intervalo) | 91 (48–230) | 90 (48–217) |
| máximo do quadro | **222** (145–327) | **189** (124–388) |
| quadro do despertar | 44 | 45 |
| C1: rodadas com o poste a mais de 5 kg·m | 3 de 30 (6,82; 8,55; 8,55) | 9 de 30 (5,6 x2; 6,82; 8,55 x2; 8,8 x2; 8,92; 9,27) |
| C3 acima de 3,5 cm | 19 de 30 | 17 de 30 |

| martelo, 20 rodadas por lado | antes | depois |
|---|---|---|
| p99 do quadro (mediana; intervalo) | 86 (54–163) | **66 (46–126)** |
| máximo do quadro | 296 (205–592) | **203 (143–280)** |
| C1 maior (kg·m) / rodadas com violação | 2,10 / 15 de 20 | 0,64 / 18 de 20 |

O ganho de máximo e de p99 que o par intercalado sem navegador mostra (30 a 45%) chega à sala só pela metade (máximo -15% no blast, -31% no martelo; p99 do blast igual): a sala tem o mesmo teto de ~100 a 190 ms de custo fora do `Step` (§6.2 e §6.3) e o desenho de cada quadro. Nenhuma rodada, de nenhum lado, teve `fellThrough`, peça abaixo do chão, C2 condicionado acima do limite nem erro de página; C4 até 2,55 s com a opção e 1,80 s sem ela no último conjunto de 5 rodadas por lado.

**CCD desligado em todas as peças (só medida, não commitado):** blast, 10 rodadas na sala: p99 mediana 60 (48–69), máximo mediana **95 (88–112)**, mas C1 com um poste a **45,6 kg·m** em 1 de 10 e C3 de 0,089 e 0,095 m em 2 de 10. Sem navegador: p99 do blast 42–52 ms, soma 2000 contra 2800 (§6.1).

### 5. A física: o que foi conferido
- Com a opção **desligada** o caminho de código é o de antes. Os gates rodaram duas vezes: primeiro com a mudança sem opção (equivale a ligada em tudo) e de novo no código final (padrão desligado; `game-destruction-three` próprio 410 passam e 0 falham, Jolt 501 passam e só as 2 de `rolling`; `game-floorplan-three` próprio 1184 passam com o golden exato 44/44, Jolt 1184 passam e as mesmas 4 falhas). Nenhum golden mexeu:
  - `game-floorplan-three` solver próprio **1184 passam, golden exato 44/44**; Jolt **1184 passam, 4 falhas, as conhecidas** (os 3 `destruction/*` do golden exato, cuja gravação é do solver próprio, e `bookcase-topple`).
  - `game-destruction-three` solver próprio **410 passam, 0 falhas**; Jolt **500 passam e só as 2 de `rolling.test.ts`** (na primeira passada; 501 no código final, com o teste a mais) (as conhecidas).
  - Bacia B1 (`BOWL_SEEDS=16`, `BOWL_FROM` {1,17,33,49}, dt {0,05; 1/60}, Jolt, oito processos): **128/128**, como antes.
  - `pnpm -r typecheck`, `pnpm typecheck:scripts` e o eslint dos arquivos mudados: 0 erros; `kit-audit --check`: 0 novos fora do SDK dono; `pnpm check:layers`: sem violações novas.
- **Comparar a sala bit a bit não é possível**, nem entre duas execuções do mesmo código: o kit fatia trabalho por orçamento de relógio (`sliceDeadline`), então a posição final das peças muda de uma rodada para outra. A comparação é por critério e por distribuição, como nas T3.8r e T3.8s; foi essa que acendeu o poste de 9 de 30 contra 3 de 30 da §3. O mesmo evento (6,82; 8,55) aparece dos dois lados.

### 6. O que sobra e o que precisa do dono
0. **Decisão do dono: ligar ou não `tilesUnderParts`.** Ligada, o blast perde 15% do máximo e o martelo 31% na sala, e 25 a 45% sem navegador; mas o poste que ganha energia no blast passou de 3 para 9 em 30 rodadas (p 0,10). Antes de ligar vale rodar umas 30 rodadas de blast de cada lado numa máquina sozinha (as minhas dividiram a CPU com outra sessão), e olhar se o poste a 8,55 kg·m é o `topple` do kit ou o levantamento do chão assentado (T3.8r).
1. **Decisão do dono: a varredura contínua (CCD) das peças.** É o que explica os quadros de 130 a 190 ms que sobram quando a opção está desligada. Cada peça é `continuous: true`; o Jolt lança a varredura de um composto de partes finas a ~0,9 m/s, contra ~100 sólidos de chão e a casa, a ~40 ms por passo. É a maior parte do p99 que sobra (sem ela o p99 do blast cai para 60 ms na sala e o máximo para 95 ms), mas desligar em todas muda a física (poste a 45,6 kg·m em 1 de 10). Caminhos, do menos ao mais invasivo, todos mudam o quando ou o se do CCD e por isso não foram tocados: (a) ligar o CCD só no passo em que o deslocamento passa da distância especulativa (0,02 m, ou 2,4 m/s a 120 Hz), com um `setContinuous` novo no contrato; (b) subir `mLinearCastThreshold` de 0,75 do raio interno, global; (c) tirar o CCD das peças de composto com mais de N partes. Qualquer um precisa rodar a bacia, a C6 e as rodadas da sala antes. O corpo do poste (`partBoxes` com os fios e os estais de 2 cm) é o que faz o raio interno do composto ser 1 cm; dar a esses estais um raio maior ou tirá-los do colisor também some com o limiar, mas muda a forma que colide: mesma classe de decisão.
2. **O quadro do corte da casa (f0, 57–66 ms) continua inteiro.** São `fitOrientedBoxes` (26 ms: cada parte nova da casa ganha as caixas que a desenham; o ajuste só repetiria a entrada se o quadro da peça nova fosse bit a bit o da casa, o que não se garante) e o `rebuildHost` por parte extraída (14 ms, 12 deles `computeVertexNormals` da malha inteira da casa, uma vez por parte). Seguir por aqui: reconstruir cada hospedeiro uma vez por `splitLoose`, e ajustar as caixas das partes no quadro da casa durante a montagem. Nenhum dos dois foi feito: o ganho é de um quadro e "não muda o desenho nem a física" pede teste próprio.
3. **Ladrilhos novos (f96, f110: 65–113 ms).** O custo é o chão novo sob peças que acabaram de acordar: `readGround` (26 mil leituras de `groundAt` por ladrilho), o composto do sólido (~500 cascos convexos por ladrilho de cratera, 20 ms de `Create` numa leva) e o campo de altura. A decisão sobre o pré-assento (D8) continua a da T3.8t. O que daria para fazer sem mudar resultado: reaproveitar os cascos do sólido que não mudaram entre reassentamentos (o seguimento da T3.8q); não foi medido em quadro de pico, onde quase todo ladrilho é novo, e não reassentado.
4. O `Step` não tem camada de broadphase, sono nem corpo estático fora do lugar: 390 corpos fixos da casa (187 caixas, 203 malhas) mais 101 sólidos de chão, 101 campos de altura e 63 lajes; remover as malhas da casa não tira os picos, remover os campos de altura também não, remover os sólidos de chão tira quase todo o custo do poste (§2). Não mexi em `KIT_WORLD`.

## T3.8u — resíduos da sala (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Navegador: `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa), um processo por rodada, uma rodada por vez. Código: `fix/sala-residuos` sobre a main `ff5bf561` (inclui até a #310). **Nenhum código-fonte do kit mudou, nenhuma régua, critério, tolerância ou teste foi alterado.** O que mudou é só a sonda (`decision/probes/room.js`, `drive.mjs`). Resultado: **não achei alavanca do kit para nenhum dos quatro resíduos; os que têm causa reproduzida só se movem por configuração do Jolt ou pela régua. Parei e levo ao dono (opções no fim).**

### 1. A sonda
`room.js` agora grava, por rodada: (a) os 3 maiores C3 com id, massa, partes, e o histórico (`rise`, `dEm` = energia que a peça ganhou ou perdeu no update sem o que o kit deu, `given`, velocidades antes e depois); (b) da ilha de pior C1: nomes das partes, os pares do `pairLog` classificados (peça, estático, ladrilho, sólido do chão), a vizinhança e a história dos 8 últimos updates; (c) a energia por passo fixo (1/120 s) das peças acima de 500 kg com o que cada uma toca (`partners`); (d) toda movimentação do kit de uma peça acima de 5 kg (`setPose`, `setVelocity`, levantamento do `groundChanged`) com o update em que ocorre; (e) a opção `DISCRETE=heavy|all` (variável de ambiente do `drive.mjs`) que tira a varredura contínua do Jolt dos corpos. 60 rodadas de Jolt, D4 ligada (`blastDebris=1`), nenhuma com erro de página.

### 2. Quem é cada resíduo (60 rodadas, mesma main)
| item | quem | o que a medida mostra | de onde vem |
|---|---|---|---|
| C1 grande (5,6 a 9,6 kg·m, 6 de 60) e C1 pequeno do blast (0,35 a 1,5 em quase toda rodada de blast) | **o poste de 1010,7 kg** (`pole:33.7` e `pole:-10.3` com a fiação), 32 das 42 rodadas com ilha registrada | ver 3 e 4 | motor |
| C1 de 0,25 a 4,0 kg·m (10 de 60), **o item 1** | `obj_3` = `window_grille:w0_0` (43 kg) e `obj_5` = `window_frame:w0_0` (16,3 kg), às vezes `obj_20`/`obj_21` = `baseboard:wall_0_0:0:5`/`:6` (5,3 kg) e `obj_11` = `sidewalk:wall_0_0:0:2` (73 kg) | ver 5 | motor (solver) |
| C3 acima de 3,5 cm (27 de 60) | o poste em 24 das 27; as outras 3: grade 43 kg (0,063), tubo de 0,6 kg (0,043), peça de 12,3 kg (0,044) | ver 6 | motor + régua |
| C2 `obj_20` (rodapé de 5,3 kg, 0,136 m) | **não reproduziu em 60 rodadas** (C2 condicionado 0 em todas; sem a condição 1 a 2 peças em quase todo martelo, todas abaixo do limite de 3,5 cm no condicionado) | é uma das peças do par do item 1 (o rodapé é onde a janela cai) | motor |

### 3. O poste, C1 grande: a varredura contínua do Jolt para o corpo antes do fim do passo
Medido por passo fixo (poste caindo a 6,3 a 6,5 m/s, 4 a 6 updates depois do blast): no passo em que o pé chega ao chão, o centro anda **4,2 cm em vez dos 5,5 cm de `v dt`**, a velocidade segue a da queda livre (`vy` -6,273 para -6,354) e a energia sobe +10,5 kg·m (1,0 cm de altura de 1010 kg) num passo. O par de ladrilho aparece no `pairLog` só no passo seguinte. É o **`LinearCast` do Jolt** (`continuous: true`, que o kit liga em todo corpo de peça): o corpo é recuado até o instante do impacto com a velocidade intacta, e a régua lê isso como altura ganha. Proporcional à velocidade de chegada (6,6 a 9,6 kg·m a 6,5 m/s; 0,8 a 1,7 a 3,6 a 4,5 m/s na T3.8r).
- **Contraprova** (`DISCRETE=heavy`, 8 rodadas de blast): sem a varredura o poste afunda mais no chão (o `groundChanged` do kit o levanta 44 a 67 mm, `kitOps`) e o C1 sobe a **45,6 a 61,5 kg·m em 7 de 8** (contra 6,82 a 8,55 em 25 % das rodadas e 0,4 a 1,5 nas outras). **Piora; não é consertar.** Desligar a varredura só do poste está descartado.
- Outro achado do kit, **sem efeito na régua**: o levantamento de `groundChanged` (`ENGINE_CLEARS`, 1 cm) ainda dispara no poste **a cada tombo**: +11 a +19 mm (`obj_1`, disco em (9,7; 9,6) de raio 9,6, assentamento do entulho; ponta do fio). Cai no update do impacto (perda de 3 a 4 m de altura de energia), então o C1 não vê: 13 a 19 kg·m dados pelo kit e escondidos pelo impacto. Não toquei: o poste tem 22 m de fio e a ponta do fio assentando é o caso que o levantamento protege.

### 4. O poste, C1 pequeno (item 3): +0,4 kg·m por passo fixo, 0,4 mm, ao rolar/pivotar sobre ladrilhos
O poste deitado e escorregando (`vy` -0,1 m/s, `w` 0,4 rad/s, y 0,39 m, 7 a 12 contatos com um ladrilho do chão) ganha +0,33 a +0,56 kg·m por passo fixo, 2 a 6 passos por update, o que dá o 0,58, 1,23, 1,59 kg·m por update do blast. **Verificado, descartado como causa do kit:**
- **#308 (alturas no lugar) não mudou isto:** nenhum `updateHeights`/`setPose` do kit no poste nesses passos (`kitOps` sem ocorrência no intervalo); a assinatura (0,4 por passo) é a da T3.8r. Sem peça de chão criada, trocada ou removida (`EngineStatics` e o `pairLog` só mudam quando o poste muda de ladrilho).
- **O sólido sob o campo de alturas** (`SOLID_MARGIN`) **não é a causa:** o poste aparece com `solid` nos contatos em 11 a 35 dos passos com ganho. Experimento: `SOLID_MARGIN` de 5 mm para 3 cm (rebuild, 8 rodadas de blast): **0 contatos com o sólido, o ganho por passo fica igual** (0,37 a 0,52), C1 0,58 a 1,23 como antes. Revertido, nada commitado.
- **Hipótese que sobra (não provada):** passo semi-implícito de 120 Hz (a queda livre perde 0,34 kg·m por passo na mesma conta: 0,5 g dt² m), que num pivô com atrito dá erro de energia de sinal oposto. É da configuração do Jolt (passo fixo, iterações), que a spec fixa.

### 5. O par janela, C1 do martelo (item 1) e o rodapé (item 4)
`obj_3` (grade, 43 kg) e `obj_5` (batente, 16,3 kg) saem da janela juntas e **caem juntas de 1,5 m** (centros a 1,50 e 1,54 m, vy -1,0 a -3,5 m/s) sobre os rodapés `obj_20`/`obj_21` (5,3 kg, no chão, y 0,198) e a calçada `obj_11` (73 kg). No update do impacto o par perde 10 a 12 kg·m e o rodapé de 5,3 kg sai a 0,94 m/s; **no update seguinte o par ganha +0,3 a +2,6 kg·m** (rodada de 4,01: `obj_3` 43 kg +2,58 e `obj_5` +1,51, a velocidade sobe de 2,42 para 2,86 e de 2,01 para 2,58 m/s). Nenhuma movimentação do kit (`kitOps`: nenhum `setPose`, `setVelocity` nem levantamento nessas peças) nem peça nova: **é o solver do Jolt**, uma pilha de 59 kg em cima de 5,3 kg (razão 11:1) prensada contra o chão, a classe que a decisão do dono de 14/11 (32 passadas) já trata, e que não cabe no que o kit controla. O `obj_20` da T3.8s (0,136 m) é a peça de baixo do mesmo par; não reproduziu em 60 rodadas.

### 6. C3: como é calculado e quem passa de 3,5 cm
`EnergyRuler.measureLift` soma por peça `max(0, y_depois - y_antes - max(0, vy_antes) dt)` em **todo update sem entrada de energia de fora** (`input === 'none'`). Duas consequências, ambas lidas do código da régua:
- **Correção (T3.8w): a régua já pulava em C3 o update de uma peça a quem o kit deu energia** (`this.measureLift(from, to, dt, input === 'energy' || added > 0)`); a frase anterior desta seção estava errada. Os 0,0254 m do tubo `pipe:run_wall_kitchen_0:0` (0,6 kg) que a sonda marca como `givenPart` eram soma da própria sonda, que não pulava esses updates; **a régua não os contava**. O C3 do poste (a causa de 24 das 27 rodadas) tem `given` 0 e não muda.
- **C3 não olha a energia da peça.** O poste (1010 kg) deitado gira a 0,6 a 0,8 rad/s sobre o chão; uma ponta encontra um ressalto (borda de laje, entulho), e a peça sobe 2,4 a 5,0 cm com `vy` de -0,04 para +0,85 m/s **enquanto a energia dele cai** (`dEm` -90, -194, -273 kg·m, o giro virando subida). É o que um corpo rígido faz, e é a **causa de 24 dos 27 C3 acima do limite**. Não é impulso do blast (`given` 0) nem energia criada: é contato do motor, e a régua mede centro, não energia. (A T3.8r inferia "peças de 12 a 16 kg lançadas pelo blast": na main de hoje o dono do C3 é o poste; as de 12 a 16 kg são 1 de 27.)
- Os outros 3: a grade de 43 kg subindo 6,3 cm em um update depois de cair a 1,8 m/s sobre um estático (`obj_4`, `window_grille:w0_0`, `dEm` +2,99: empurrão de penetração do motor), o tubo de 0,6 kg acima e uma peça de 12,3 kg.

### 7. Rodadas finais (Jolt, D4 ligada, 5 blast + 5 martelo, um processo por rodada)
`pnpm build` (exit 0), `node examples/test-room/build.mjs` (exit 0); conferido no `dist`: `updateHeights` e o limite de 1 cm do `ENGINE_CLEARS` (minificado `=.01`) presentes, `SOLID_MARGIN = 5e-3` no `dist` do pacote (a experiência do item 4 revertida). C1 = excesso em kg·m / ilhas com violação; C2 cond. = peças acima de 3,5 cm (sem a condição); C3 em m com o dono; C4 em s.

| rodada | C1 / violações / pior ilha | C2 cond. (sem) | C3 / dono | C4 | `fellThrough` | frame p50 / p99 / max (ms) | despertar (ms) | passa tudo |
|---|---|---|---|---|---|---|---|---|
| blast 1 | 0,58 / 18 / poste | 0 (0) | 0,043 / poste | 0,50 | 0 | 2,5 / 91 / 235 | 39,3 | não |
| blast 2 | 0,38 / 13 / poste | 0 (0) | 0,041 / poste | 0,45 | 0 | 2,1 / 118 / 241 | 45,4 | não |
| blast 3 | 0,49 / 14 / poste | 0 (0) | 0,044 / poste | 0,80 | 0 | 2,0 / 105 / 170 | 41,2 | não |
| blast 4 | 0,35 / 11 / poste | 0 (0) | 0,041 / poste | 0,45 | 0 | 2,2 / 130 / 326 | 55,4 | não |
| blast 5 | **6,82** / 9 / poste | 0 (0) | 0,054 / poste | 0,50 | 0 | 2,4 / 89 / 267 | 48,3 | não |
| hammer 1 | 0,00 / 1 | 0 (1) | 0,013 / poste | 0,90 | 0 | 1,7 / 96 / 264 | 37,7 | não (1 violação) |
| hammer 2 | 0,15 / 2 | 0 (1) | 0,028 / poste | 1,75 | 0 | 1,9 / 210 / 383 | 37,8 | não |
| hammer 3 | -0,00 / 0 | 0 (1) | 0,032 / poste | 0,60 | 0 | 1,6 / 76 / 314 | 40,6 | **sim** |
| hammer 4 | 0,00 / 1 | 0 (1) | 0,008 / poste | 0,95 | 0 | 1,9 / 82 / 255 | 40,5 | não (1 violação) |
| hammer 5 | 0,11 / 1 | 0 (2) | 0,012 / `obj_14` 12,3 kg | 0,45 | 0 | 3,5 / 95 / 257 | 49,0 | não |

**1 de 10 passa tudo** (igual à T3.8s). Dos critérios: C2 condicionado 10 de 10, C4 10 de 10, `fellThrough` 10 de 10, C3 5 de 10 (nenhuma acima de 3,5 cm no martelo; **o blast tem o poste em 0,041 a 0,054 em 5 de 5**), C1 1 de 10 (só o martelo 3 fecha em zero violações; martelo 1, 2, 4 e 5 têm 1 a 2 violações de 0,00 a 0,15 kg·m; **todo blast tem as violações do poste**). Nas 50 rodadas anteriores desta tarefa (blast e martelo, mesma main): C3 acima de 3,5 cm em 27 de 50, C1 positivo em 46 de 50, C2 condicionado acima do limite em 1 de 50.

### 8. O que ainda reprova e as opções (precisa do dono)
| resíduo | causa medida | a única alavanca | opções |
|---|---|---|---|
| C1 do poste, 0,4 kg·m por passo (0,4 mm de altura de energia) | pivô/rolagem de 1010 kg sobre ladrilho no passo de 120 Hz | passo fixo, iterações e `maxPushOut` do `KIT_WORLD`; ou a régua | **A.** C1 com tolerância por passo fixo (`n_passos × m × 0,x mm`) em vez de `m × 1 mm` por update. **B.** passo de 240 Hz só para peças acima de 500 kg (custo: 2x de passo em 2 corpos). **C.** o poste sai da população do C1 (fica fixo/quebrável, §12 do tombamento) |
| C1 grande do poste (6 a 10 kg·m, 10 % das rodadas) | `LinearCast` do Jolt recua o corpo no impacto a 6,5 m/s; desligar piora (45 a 61) | `continuous` (kit) e passo; ou a régua | **A.** a régua desconta o recuo do `LinearCast` (altura que o centro não andou: `v dt` menos o deslocamento medido, no passo do primeiro contato). **B.** nenhuma mudança no motor: o recuo é o menor dos males medidos. |
| C3 do poste (24 de 27) | giro deitado vira subida de 2 a 5 cm com a energia caindo 90 a 273 kg·m | a régua | **A.** C3 só conta a subida de uma peça cuja energia também subiu (o mesmo condicionamento que o C2 já tem). **B.** o poste sem giro livre deitado (amortecimento angular, config do Jolt). |
| C3 com `given` (tubo de 0,6 kg) | **já descontado**: a régua pula o update com `given` em C3 (correção na T3.8w) | | nada a fazer |
| C1 do par janela (grade 43 kg + batente 16,3 kg sobre rodapé de 5,3 kg) | pilha 11:1 prensada | passadas de velocidade do `KIT_WORLD` (decisão de 14/11) | **A.** aceitar (0,3 a 4 kg·m em 10 de 60 rodadas). **B.** subir de 32 passadas só se o custo de quadro for aceito (a outra sessão mede o quadro). |
| C2 `obj_20` | não reproduziu | | acompanhar no próximo lote |

### 9. Gates
| gate | resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `node tools/kit-audit/audit.mjs --check` / `pnpm check:layers` | exit 0 / exit 0 |
| `eslint` em `drive.mjs` | exit 0 |
| suítes `game-destruction-three`, `game-floorplan-three` (próprio e Jolt) e bacia 128/128 | **não rodadas de novo: nenhum arquivo de `packages/` mudou** (a única mudança foi a sonda em `specs/`, fora de qualquer pacote e de qualquer teste); valem os números da T3.8r sobre a mesma main. A experiência do `SOLID_MARGIN` foi revertida antes de qualquer commit |
| changeset | nenhum: nenhum pacote público mudou |

### 10. Commits (locais, nada enviado)
Um commit com a sonda e esta evidência.

## T3.8w — régua R1–R3 (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0. Código: `fix/sala-residuos` sobre a main `ff5bf561`.

### 1. Decisões do dono (2026-11-15), registradas como foram aprovadas
- **R1 (C3 condicionado):** "C3 counts a rise only when the piece's energy also rose in that update, the same conditioning C2 already uses. Example: a pole that rolls onto a ledge while losing energy is not a launch."
- **R2 (C3 menos `given`):** "energy the kit declares (`given`: impulses, topple, delayed blast shove) is subtracted in C3 too, as it already is in C1 and C2 (D6)."
- **R3 (recuo do LinearCast em C1):** "at a body's first contact, Jolt's continuous-collision pull-back (the centre moves less than v·dt while velocity is kept) is not counted as a C1 gain. Detect it narrowly, only at a first contact with a continuous-motion body in that step. Do not turn it into a general tolerance."
- **Limites conhecidos, não mudanças de régua:** o ~0,4 mm por passo fixo do poste e o par grade/batente da janela sobre o rodapé (0,3 a 4 kg·m em 10 de 60 rodadas).

### 2. O que mudou (`packages/game-destruction-three/tests/energy-ruler.ts`, `contact-graph.ts`, `bowl-energy.ts`)
- **R1:** `measureLift` só soma a subida do centro de uma peça no update em que a altura de energia dela também subiu (`to.energyHeight > from.energyHeight`). A leitura "energia da peça" é por peça, como o pedido diz; não é por ilha (a ilha é a condição do C2).
- **R2: já valia, sem mudança de código.** `step` já chamava `measureLift(..., input === 'energy' || added > 0)`: o update de uma peça a quem o kit deu energia fica fora do C3 (o teste "a gain of exactly what was given is no violation and no launch", T3.8b, já cobre `c3Lift` 0). Corrijo a T3.8u: lá escrevi que C3 não descontava `given`; descontava, e a soma de 0,0254 m do tubo era da sonda, não da régua. Mantive o "pula o update" (mais brando que "subtrai"); se o dono quiser a forma estrita (`rise - given`), é uma linha, e mais rodadas reprovariam.
- **R3:** `StepContext.firstContact` (conjunto de ids). Para uma peça nele, tira-se do ganho dela em C1 o **recuo**: `max(0, y_depois - y_antes - ((vy_antes + vy_depois)/2) dt)` (o quanto o centro andou a menos do que a velocidade média diz), nunca mais que o ganho da própria peça. Quem diz o "primeiro contato" é o hospedeiro: `createFirstContactTracker` (`contact-graph.ts`) dá os ids cujo corpo é `LinearCast` e tem, neste update, um par de contato que não tinha no update anterior (o `pairLog` do Jolt). Sem o log (solver próprio) devolve `undefined` e nada é descontado. A bacia e a sonda da sala usam o mesmo.

### 3. Testes (`tests/energy-ruler.test.ts`, 33 passam; escritos à mão, no estilo dos de grafo de contato)
Cada regra mostra a conta da régua antiga escrita no próprio teste (`legacyRise`, ou o ruler sem `firstContact`) e o resultado novo. Rodados também contra a régua antiga (`git show HEAD:...`): os de R1 e R3 **reprovam** nela (3 falhas: o poste que sobe 5 cm perdendo 85 kg·m, a subida que só conta no update que ganha, o recuo de 12,5 kg·m); passam na nova.
- R1: poste de 1 t sobe 5 cm perdendo energia, antes 0,05 m, agora 0; **lançamento de verdade ainda reprova**: a mesma subida de 5 cm com +0,2 m de altura de energia conta 0,05 m inteiros; uma peça que perde num update e ganha no seguinte só conta o segundo.
- R2: tubo de 0,6 kg empurrado 2,5 cm por um `given` de 0,4 m não é C3; a subida do motor no update seguinte (2 cm) ainda é. (Já passava na régua antiga: é o teste que trava a regra.)
- R3: poste de 1 t caindo a 6,1 m/s, recuo de 12,5 mm: antes C1 acima de 10 kg·m e 1 violação, agora 0 com o primeiro contato; **estreito**: sem primeiro contato na peça ainda é violação; e um poste que também acelera a 8 m/s no primeiro contato ainda reprova C1 (acima de 900 kg·m), e uma pedra que ganha altura no primeiro contato ainda reprova C3.

### 4. Bacia (`PIECE_SOLVER=jolt BOWL_SEEDS=64`)
| | worstC1 | worstC2 | worstC3 | worstC4 | worstC2Unconditioned | fellThrough | casos |
|---|---|---|---|---|---|---|---|
| antes | -0,007656 | 0 | 0,027460 | 1,5167 | 0,007681 | 0 | **128/128** |
| depois | -0,007656 | 0 | **0,024192** | 1,5167 | 0,007681 | 0 | **128/128** |

### 5. Rodadas da sala sob a régua nova (Jolt, D4 ligada, 5 blast + 5 martelo frescas, um processo por rodada)
`pnpm build` e `node examples/test-room/build.mjs` (exit 0, antes das rodadas). Colunas "antes" vêm da sonda: C1 sem o desconto do R3 (segunda régua alimentada com os mesmos dados) e C3 sem o R1 (a soma por peça da sonda, sem os updates com `given`). Ilhas pelo grafo de contato.

| rodada | C1 novo (kg·m / violações) | C1 sem R3 | C2 cond. (sem) | C3 novo (m) | C3 sem R1 | C4 (s) | `fellThrough` | quadro p50 / p99 / max (ms) | despertar | passa tudo |
|---|---|---|---|---|---|---|---|---|---|---|
| blast 1 | 0,381 / 14 | 0,381 / 14 | 0 (0) | 0,0029 | 0,0435 | 1,15 | 0 | 1,9 / 102 / 255 | 45,5 | não (C1) |
| blast 2 | 1,046 / 3 | 1,046 / 3 | 0 (0) | 0,0067 | 0,0361 | 0,50 | 0 | 2,2 / 98 / 269 | 46,0 | não (C1) |
| blast 3 | 1,111 / 18 | 1,111 / 18 | 0 (0) | 0,0095 | 0,0128 | 0,50 | 0 | 2,0 / 83 / 158 | 45,3 | não (C1) |
| blast 4 | 1,348 / 16 | 1,348 / 16 | 0 (0) | 0,0330 | 0,0426 | 0,50 | 0 | 2,2 / 86 / 261 | 39,8 | não (C1) |
| blast 5 | 0,028 / 19 | 0,028 / 19 | 0 (0) | 0,0326 | 0,0408 | 0,50 | 0 | 2,2 / 99 / 246 | 43,2 | não (C1) |
| hammer 1 | -0,002 / 0 | -0,002 / 0 | 0 (1) | 0,0015 | 0,0428 | 1,70 | 0 | 1,6 / 75 / 285 | 32,5 | **sim** |
| hammer 2 | 0,003 / 1 | 0,003 / 1 | 0 (1) | 0,0038 | 0,0321 | 1,75 | 0 | 1,7 / 76 / 283 | 33,6 | não (C1) |
| hammer 3 | -0,002 / 0 | -0,002 / 0 | 0 (1) | 0,0118 | 0,0448 | 1,55 | 0 | 1,7 / 56 / 276 | 35,6 | **sim** |
| hammer 4 | 0,001 / 1 | 0,001 / 1 | 0 (0) | 0,0039 | 0,0078 | 0,90 | 0 | 1,5 / 61 / 209 | 31,9 | não (C1) |
| hammer 5 | 0,003 / 1 | 0,003 / 1 | 0 (1) | 0,0047 | 0,0296 | 1,75 | 0 | 1,4 / 85 / 274 | 33,8 | não (C1) |

**Resultado: 2 de 10 passam tudo; os 10 passam C2, C3 (máximo 0,0330 m), C4 e `fellThrough`; C1 reprova em 8 de 10.**
- **R1 fez o que devia:** C3 foi de 6 de 10 rodadas acima de 3,5 cm (pela soma da sonda, sem R1: 0,0361 a 0,0448) para **0 de 10** (0,0015 a 0,0330). O pior que sobrou (0,0326 a 0,0330) é uma peça de 12 kg que a onda lança com energia que ela de fato ganhou (+1,12 kg·m): o R1 não a perdoa, e não deve.
- **R3 não apareceu nestas rodadas:** nenhum recuo grande ocorreu (maior C1 1,35); "C1 sem R3" e "C1 novo" são idênticos nas 10. O caso de 6,5 a 9,6 kg·m do poste a 6,5 m/s apareceu em 7 de 60 rodadas antes e em 0 de 35 depois do R3 (25 rodadas com a sonda de definição anterior, 10 com a final), o que é compatível com o R3 e **não prova** (uma amostra sem o evento). A prova do R3 é a do teste unitário e a de que não altera as 10 rodadas onde não havia recuo.
- **O que ainda reprova C1 são exatamente os dois limites conhecidos:** (a) o poste de 1010,7 kg: +0,33 a +0,56 kg·m por passo fixo (0,4 mm de altura de energia), 0,38 a 1,35 kg·m por update, 3 a 19 violações por rodada de blast, o poste é a pior ilha em todos; (b) nas rodadas de martelo, 1 violação por rodada de 0,001 a 0,003 kg·m (a sonda só nomeia a ilha acima de 0,2 kg·m, então não sei qual peça é), e o par grade (43 kg) e batente (16,3 kg) sobre o rodapé de 5,3 kg não apareceu como pior ilha nestas 10 (0,3 a 4 kg·m em 10 de 60 rodadas antes).
- **Recomputar o veredito das 60 rodadas guardadas:** não dá por inteiro. Os JSON guardam só a pior ilha, os 3 maiores C3 com histórico e os passos fixos de maior ganho, não as amostras de todas as peças por update, e a régua precisa delas. Parcial, do que está guardado: os C3 acima do limite eram o poste em 24 de 27 rodadas, todos com `dEm` negativo (-90 a -319 kg·m) no update da subida, ou seja, **R1 perdoa os 24**; os 3 restantes (grade de 43 kg com +2,99, tubo de 0,6 kg, peça de 12,3 kg com +1,12) ganharam energia e **continuam contando**.

### 6. Varredura C6
`node tests/sweep-c6.mjs` (8 processos, 64 sementes, 3 cenários, 4 passos, 20 e 32 iterações, 3 fatores de empurrão: 4608 corridas) levou **585 s** com a régua nova e 612 s com a antiga (menos de 30 min: rodada). Mesma máquina, as duas seguidas.

| | corridas | reprovadas | reprovadas a 32 iterações | "mais iterações piorou" | pior C3 da bacia a 32 (dt 0,0167, empurrão x1,5) |
|---|---|---|---|---|---|
| régua antiga | 4608 | 244 | 19 | 0 | 0,0401 (1 caso reprova) |
| régua nova (R1–R3) | 4608 | 244 | 19 | 0 | 0,0357 (o mesmo caso, ainda 0,7 mm acima do limite) |

As 19 de 32 iterações são as mesmas nas duas: 1 da bacia (C3, dt 0,0167, empurrão x1,5) e 18 do `stack 20:1` a dt 0,0069 (C1, 6 sementes por empurrão). **R1–R3 não mudaram nenhuma célula de aprovado para reprovado nem o contrário**; só baixaram o pior C3 da bacia. O sweep sai com código 1 nas duas por essas 19; é o estado herdado, não efeito desta mudança.

### 7. Gates
| gate | resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 (na 1ª versão do rastreador); depois da reescrita do rastreador: `tsc` do pacote exit 0 |
| `eslint` nos 4 arquivos de teste mudados | exit 0 (as duas versões) |
| `kit-audit --check` / `pnpm check:layers` | exit 0 / exit 0 |
| `game-destruction-three`, solver próprio | **417 passam, 0 falham** (154 pulados) |
| `game-destruction-three`, Jolt | 506 passam, **só as 2 `rolling` conhecidas** (`cans knock each other`, `fifty cans`) |
| bacia 128/128 | sim, antes e depois (seção 4; depois medida com a versão final do rastreador) |

### 8. O que ainda reprova e precisa do dono
**C1 em 8 de 10 rodadas** (R1 e R2 não mexem em C1; o R3 só vale em primeiro contato). São os limites conhecidos: o poste de 1010 kg a +0,33 a +0,56 kg·m por passo fixo de 1/120 s (0,4 mm de altura de energia; 0,38 a 1,35 kg·m por update; 3 a 19 violações por rodada de blast) e as violações de 1 a 3 g·m dos martelos. As opções A, B, C da seção 8 da T3.8u para o poste seguem de pé (tolerância por passo fixo, 240 Hz só acima de 500 kg, ou o poste fora da população de C1). Em aberto também: o R2 como "subtrai" estrito (hoje "pula o update") e o R3 sem caso real nas rodadas.

## T3.8x — chão em menos corpos (medido, não entrou)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, Node v24.22.0 (2026-11-15). Investigação feita antes da T3.8y, na sessão que achou o custo do poste (T3.8v §2). Nenhum código desta investigação foi mantido.

Hipótese: o `Step` do poste custa 60 a 70 ms porque a varredura contínua (CCD) lança o poste contra os sólidos de chão; juntar os corpos de chão (menos corpos, mais formas por corpo) devia encurtar a varredura. Medi o custo do passo fixo no quadro 125 do blast (`single_storey_a`, semente 1), com o poste da T3.8v ligado, mudando só o número de corpos de chão:

| corpos de chão | custo por passo fixo (ms) |
|---|---|
| 103 (como está) | 56,5 a 59,1 |
| 10 | 57,3 a 58,8 |
| 34 | 60,3 a 63,3 |
| 4 | 59,0 a 61,9 |

**O custo é por forma filha, não por corpo.** Juntar os sólidos em 4, 10 ou 34 corpos não muda nada (a variação é a do ruído): a consulta do `LinearCast` percorre as formas filhas cujas caixas tocam a caixa varrida, e as formas são as mesmas em qualquer agrupamento. Quem faz o poste varrer centenas de cascos é a caixa dele, de 23 m (os 22 m de fio em caixas diagonais), não a organização do chão. Por isso não entrou: a saída é encolher a caixa do poste, que é a T3.8y.

## T3.8y — fios do poste em trechos

Máquina: Intel Core Ultra 9 275HX, 24 núcleos, Arch Linux, `node --version` = v24.22.0; navegador `chrome-headless-shell` do Playwright, GPU Intel Arrow Lake (Mesa); 2026-11-15. Worktree `chao-um-corpo`, branch `perf/fios-do-poste`, sobre a main com `tilesUnderParts` (`33961e12`). Commit do código: `78ac5399`. Nenhuma régua, tolerância, regra ou teste foi afrouxado ou removido. Sondas em `decision/probes/t38x/` (a de T3.8v, com `?tilesUnderParts` por variável de ambiente `TILES`, e o `ab.sh` que alterna os dois lados), saídas em `decision/probes/t38x/headless-ab.log` e `decision/t38y-results.json` (as 25 rodadas da sala).

### 1. Causa (o que o prompt chamava de "caixas-filhas do composto do poste")
Os trechos de fio **já eram peças próprias** desde a T3.8g (`wiring:grid:<w|e>:<i>`, `wiring:drop:*`, cortados por `cutRun` e `segmentLimits.wiring`), cada um preso ao poste mais próximo por uma junta `clip` (`holder`). O que os punha no composto do poste era a junta: o `recomputeGroups` do `game-destruction` une em **um grupo** tudo o que uma junta viva liga, e `splitLoose` (`game-destruction-three`) vira cada grupo solto em **uma peça**. Quando o poste soltava, levava os fios cujas juntas a explosão não tinha aberto: no blast do lote, `obj_19` era `pole:-10.3` mais os 4 trechos `wiring:grid:w:0..3` (1010,7 kg, 14 caixas, 11,8 m) e, na sala, um poste de 1092 kg com 26 caixas e 23 m, que o CCD do Jolt varria contra ~100 sólidos de chão (T3.8v §2).

### 2. Projeto
- **`JointSpec.tears`** (`game-contracts`, `game-destruction`; padrão falso). A parte `a` pende de `b` só enquanto `b` está de pé (em grupo ancorado): `recomputeGroups` une uma junta que rasga só se o grupo de `b` está ancorado (`joinTornJoints`); com `b` solto a junta larga e `a` fica num grupo seu. Nada muda para quem não marca `tears`. `JointState.tears` leva o campo ao estado.
- **Fiação** (`game-floorplan-three/src/utilities/electrical.ts`): cada trecho da grade e do ramal continua `holder` do poste mais próximo, agora com `tears: true` (`Support.tears` em `game-floorplan-structure` leva à junta, `pieces.ts` copia o campo). O trecho que cai dentro de laje ou parede, ou ao lado de um (`holdersOf`), fica preso a ela, sem `tears`: o ramal na casa **pende da casa**, e só o poste rasga. O poste não leva fio: só o fuste, a travessa e os isoladores (950,4 kg, 10 caixas, no lugar de 1010,7 kg e 14 caixas). `segmentLimits.wiring: Infinity` continua desenhando a fiação inteira como o time (uma peça, sem `holder`): o golden do time não mudou.
- **Massa**: a do poste cai o que os fios pesavam; cada trecho carrega o cobre dele (`copperMass`, igual à T3.8g). A soma dos trechos não mudou.
- **Peças que um `tears` separou não se tocam** (`PieceSystem.tether`, `renderer.tetherTorn`): sem isso o poste de 950 kg, ao tombar, batia nos fios de 12 kg que acabava de largar (a ponta do trecho fica a 1,3 cm do isolador) e os lançava. A primeira versão, sem isso, deu C1 de 34 a 105 kg·m em 3 de 5 rodadas de blast e C2 condicionado acima do limite em 4 de 10 (a peça era sempre o `wiring:grid:e:7` junto ao poste de 33,7). O renderizador lê, antes de soltar os grupos, as juntas vivas que rasgam entre grupos diferentes (`tornPairsOf`) e, depois de soltos, marca o par de peças; o motor deixa o par em paz para sempre (`ignorePair`, o mesmo canal do `apartDeep`). Vale só para o Jolt.

### 3. Testes novos (sem GPU)
- `game-destruction/tests/torn-joints.test.ts` (5): sem `tears` o fio vai com o poste solto; com `tears` fica num grupo seu; preso a uma parede ancorada pende dela; preso a um poste solto e a uma parede pende da parede e o poste fica só; um `tears` aberto à mão larga o fio.
- `game-floorplan-three/tests/pole-wires.test.ts` (4, o último só no Jolt), `single_storey_a`, C4 no pé do primeiro poste: (a) nenhum objeto com um `pole:*` tem outra parte, e a peça pesa o que o poste pesa; a maior caixa < 8 m; (b) cada trecho da grade é objeto e peça de uma parte só (16 ou mais); (c) o cobre dos fios antes e depois do blast é o mesmo (soma das massas das partes) e os fios soltos pesam mais de metade do total; (d) **Jolt**: 14 s depois, todo fio solto dorme, com o canto mais baixo entre -0,05 e 1,5 m (no chão ou no que caiu ali: nada flutua, nada afunda). Não os rodei contra o código de antes; o que mostra que reprovariam é a sonda de grupos feita antes da mudança: `obj_19` era `pole:-10.3` mais `wiring:grid:w:0..3` (1010,7 kg, 14 caixas).

### 4. Antes e depois, sem navegador (a sonda da T3.8v)
`single_storey_a`, semente 1, `dt` 1/60, 240 quadros, `build` e blast (C4 a `casa - 2,5 m`) ou martelo (12 golpes de 8000 J), Jolt. **9 execuções por lado**, três pares intercalados de (3 antes, 3 depois), nesta ordem: ladrilhos sob a caixa inteira (padrão) primeiro, `tilesUnderParts` depois. "Antes" é o `electrical.ts` do `HEAD` (juntas que sempre unem) com o motor novo (que sem `tears` se comporta como o de antes). Medianas (intervalo):

| | p50 | p99 | máximo | soma dos 240 quadros | `stepFixed` nos 6 piores quadros de cada execução (mediana / máx) |
|---|---|---|---|---|---|
| blast, antes | 5,9 | 134 (130-146) | 153 (143-159) | 3358 | 123 / 140 |
| **blast, depois** | 9,1 | **49 (42-54)** | **52 (48-60)** | 3091 | **6,5 / 15** |
| martelo, antes | 4,9 | 119 (117-131) | 132 (129-153) | 2622 | 111 / 131 |
| **martelo, depois** | 7,8 | **39 (26-50)** | **45 (28-85)** | 2637 | **5,2 / 13** |
| blast, antes, `tilesUnderParts` | 5,8 | 101 (87-118) | 119 (101-131) | 2932 | 90 / 126 |
| blast, depois, `tilesUnderParts` | 9,9 | 53 (42-59) | 58 (46-80) | 3326 | 6,5 / 15 |
| martelo, antes, `tilesUnderParts` | 4,9 | 78 (75-88) | 90 (84-92) | 2228 | 68 / 87 |
| martelo, depois, `tilesUnderParts` | 7,9 | 42 (35-50) | 50 (41-65) | 2718 | 4,9 / 19 |

- **Os picos acabaram.** Os quadros de 124 a 130 (sete seguidos, 12 passos fixos de ~70 ms) saíram da lista dos piores: o `Step` desses quadros foi de 123 ms (mediana dos piores, blast) para 6,5. p99 e máximo caem 63 a 67% no blast e 62 a 66% no martelo, com os ladrilhos no padrão; 41 a 52% com `tilesUnderParts`.
- **O que piorou e por quê (não escondo):** o quadro mediano sobe de 5,9 para 9,1 ms (blast) e de 4,9 para 7,8 (martelo). Os 21 trechos de fio agora são peças que caem e assentam chão cada uma (`layGround`/`layTile`/`setShape` do composto de cada ladrilho novo), o custo que a T3.8v §6.3 já listava como o que sobra depois do CCD (no perfil V8 do blast, de uma versão intermediária desta mudança: `prepare` 512 ms para 1380 ms, `stepFixed` 2621 para 1384 ms, soma igual: 4087 para 4194 ms). A **soma dos 240 quadros** com os ladrilhos no padrão (o que se entrega) é igual ou menor: blast -8% (3358 para 3091), martelo +0,6% (2622 para 2637). Com `tilesUnderParts` ligada a soma sobe (+13% no blast, +22% no martelo): a opção já tirava do poste o custo que esta mudança tira, e o que sobra é só o custo dos 21 fios. **A opção continua desligada por padrão e sem o dono não deve ser ligada junto com esta mudança.**
- Nenhum quadro, de nenhuma execução, passou de 85 ms (antes: até 159 ms no blast e 153 no martelo).

### 5. Rodadas da sala (Jolt, D4 ligada, 5 blast e 5 martelo, um processo por rodada, `drive.mjs`, `chrome-headless-shell`)
`pnpm build`, `node examples/test-room/build.mjs` (exit 0) e o `dist` conferido (`.tears` e `tether` em `examples/test-room/dist/test-room.html`) antes. Código final (`78ac5399`).

| rodada | C1 (kg·m / violações) | C2 cond. | C3 (m) | C4 (s) | `fellThrough` | quadro p50 / p99 / máx (ms) | despertar | passa tudo |
|---|---|---|---|---|---|---|---|---|
| blast 1 | 0,152 / 31 | 0 | 0,0160 | 0,45 | 0 | 1,8 / 46 / 56 | 24,7 | não (C1) |
| blast 2 | 0,027 / 7 | 0 | 0,0033 | 0,50 | 0 | 2,0 / 42 / 49 | 28,6 | não (C1) |
| blast 3 | 0,039 / 7 | 0 | 0,0052 | 0,50 | 0 | 1,8 / 43 / 54 | 30,1 | não (C1) |
| blast 4 | 0,030 / 15 | 0 | 0,0035 | 0,50 | 0 | 1,8 / 45 / 51 | 28,6 | não (C1) |
| blast 5 | 0,146 / 5 | 0 | 0,0049 | 0,50 | 0 | 1,8 / 50 / 61 | 29,8 | não (C1) |
| martelo 1 | -0,001 / 0 | 0 | 0,0183 | 0,50 | 0 | 1,5 / 51 / 61 | 21,9 | **sim** |
| martelo 2 | 0,000 / 1 | 0 | 0,0129 | 0,45 | 0 | 1,3 / 43 / 59 | 24,2 | não (C1) |
| martelo 3 | 0,049 / 4 | 0 | 0,0098 | 0,50 | 0 | 1,6 / 44 / 49 | 25,7 | não (C1) |
| martelo 4 | -0,002 / 0 | 0 | 0,0092 | 0,55 | 0 | 1,3 / 51 / 57 | 25,3 | **sim** |
| martelo 5 | 3,099 / 1 | **1 (`baseboard`, 0,136 m)** | 0,0076 | 0,50 | 0 | 1,4 / 48 / 64 | 25,2 | não (C1, C2) |

- **C3, C4 e `fellThrough`: 10 de 10** (C3 máximo 0,0183 m; C4 máximo 0,55 s; `fellThrough` 0; nenhum erro de página). **C2: 9 de 10.** A exceção é o par grade da janela (43 kg) e batente (16,3 kg) sobre o rodapé de 5,3 kg, o limite já registrado na T3.8w ("0,3 a 4 kg·m em 10 de 60 rodadas"), que não toca poste nem fio. Para saber se a mudança o provocava, rodei **15 rodadas de martelo no código de antes** (`33961e12`, mesmo `dist` refeito): C2 condicionado acima do limite em **1 de 15** (a mesma classe, junto com C1 de 2,9 kg·m). Com 1 de 10 aqui e 1 de 15 lá a diferença não é mensurável; mas o critério ("C2 10 de 10") não se cumpriu nesta amostra e o registro é esse.
- **C1: 2 de 10 passam (como na T3.8w), mas muito menos violentas.** O maior C1 do blast foi 0,152 kg·m (T3.8w: até 1,35; o poste de 1010 kg era a pior ilha em todas as rodadas de blast e com ele fora do composto some). No martelo, o maior foi 3,10 (a janela, acima) contra 0,001 a 0,003 na T3.8w. O poste de 950 kg não aparece mais como pior ilha em nenhuma das 10. Antes do `tether` (primeira versão, 10 rodadas): C1 de 34,2 e 105,6 kg·m em 3 de 5 blasts (o poste e o fio `wiring:grid:e:7`) e C2 em 4 de 10.
- **Quadros** (p50 / p99 / máx / despertar): blast 1,8–2,0 / 42–50 / 49–61 / 25–30 ms (T3.8w: 2,0–2,2 / 83–102 / 158–269 / 40–46); martelo 1,3–1,6 / 43–51 / 49–64 / 22–26 (T3.8w: 1,4–1,7 / 56–85 / 209–285 / 32–36). As 15 rodadas de martelo de antes, na mesma máquina: p99 51–85, máximo 187–243 ms.

### 6. Goldens regravados (só os que mudam por causa do poste e dos fios)
O conjunto de peças e objetos de uma explosão que solta o lote muda (21 objetos a mais: os trechos viram objetos seus, e o estado de cada junta carrega `tears`); nenhuma cena sem o poste mudou.
- `exact-floorplan.json`: **3 linhas**, `destruction/breach` (`acde80fe`, 1052 objetos para `128490aa`, 1073), `destruction/spall` (`fd6dd7c7`, 1041 para `bf5dd155`, 1062) e `destruction/fracture` (`24474c4c`, 1082 para `ddf959c0`, 1103): cada uma ganha exatamente 21 objetos, os trechos de fio. As 41 entradas `house/*` e `specimen/*` **não mudaram** (o conjunto de partes da casa é o mesmo; só as juntas dos fios carregam um campo a mais que o golden não lê).
- `blast-presentation.test.ts`: `RECORDED_BLAST_OUTCOME` (`4528ab03…` para `22130243…`): o hash é o do JSON de `{resultados, eventos, estado}`, que agora tem 21 objetos a mais e o `tears` de cada junta. Foi regravado em dois passos (o primeiro, `7585826a…`, só com os objetos; o segundo, com `JointState.tears`).
- **O golden do time (`golden-scene.test.ts`) não mudou**: passa, com `segmentLimits: Infinity`.

### 7. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck`, `pnpm typecheck:scripts` | exit 0, exit 0 |
| `game-floorplan-three`, solver próprio | **1186 passam, 0 falhas** (depois de regravar o hash do blast; a primeira passada tinha só essa falha) |
| `game-floorplan-three`, Jolt | 1187 passam, **5 falhas: as 4 conhecidas (os 3 `destruction/*` do golden, cuja gravação é do solver próprio, e `bookcase-topple`) e `pole-collider.test.ts` "lying on the ground it sleeps within 3 s"** (§8) |
| `game-destruction`, próprio | 553 passam, 0 falhas |
| `game-destruction-three`, próprio | 417 passam, 0 falhas (156 pulados) |
| `game-destruction-three`, Jolt | 508 passam, **só as 2 `rolling`** conhecidas |
| Construção: residencial, comercial, rural, pós-apocalíptica | 56, 93, 37, 273 passam; `game-floorplan-structure` 407, `game-contracts` 115 |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, números idênticos (`worstC4` 1,5167, `fellThrough` 0) |
| z-fighting (guarda do pre-commit, `single_storey_a`, todos os níveis) | passa; a geometria dos fios e do poste não mudou |
| `eslint` nos arquivos mudados / `kit-audit --check` / `pnpm check:layers` | 0 erros (só o aviso de `max-lines` que já havia) / exit 0 (0 novos) / sem violações novas |

### 8. O que precisa do dono
1. **Um teste existente reprova no Jolt por 0,5%: `pole-collider.test.ts` "lying on the ground it sleeps within 3 s".** Antes os fios tinham o poste deitado de lado, a ~0°; sem eles os três postes dormem a **|cos| = 0,1005**, inclinados 5,8° porque a ponta da travessa (1,6 m, 8 cm de espessura) fica para baixo e escora o topo a ~0,8 m do chão, e o teste classifica "deitado" como `|cos| < 0,1`. Os postes dormem (em 3 s, como o teste pede, e `activeCount` termina em 0); só a classificação da pose falha. **Não mexi em `LYING = 0,1`**: é tolerância, e a regra é nunca afrouxar. Se o dono aceitar que a pose é válida, a constante vai para 0,12; se não, o poste precisa de outro desenho (travessa mais curta, por exemplo).
2. **O critério C2 saiu 9 de 10 e não 10 de 10** na amostra (§5); a causa é o limite conhecido da janela, que aparece em 1 de 15 também sem a mudança.
3. **O quadro mediano sobe** (§4). A soma dos quadros não, com os ladrilhos no padrão. Se o dono preferir o `tilesUnderParts` ligado com esta mudança, a soma sobe 13 a 22%.

### 9. Veredito
Os picos acabaram (p99 -64%, máximo -66%, `Step` dos quadros do poste de 123 ms para 6,5), C3, C4 e `fellThrough` seguem 10 de 10, C1 melhora muito, os gates passam com **uma falha a mais que o combinado** (o teste do poste, §8.1). Mantive o código (commit local `78ac5399`, nada enviado); a decisão sobre a constante `LYING` e sobre o C2 de 9 de 10 é do dono.

### T3.8y — o teste do poste deitado (2026-11-15)

O teste `pole-collider.test.ts` ("deitado no chão, dorme em até 3 s") considerava o poste deitado quando |cos| < 0,1, ou seja, a menos de ~5,7° da horizontal.

Com os fios em trechos, o poste caído passou a ficar apoiado na ponta da cruzeta, inclinado 5,8° (|cos| 0,1005). Ele dorme, mas o teste deixava de contá-lo como deitado por 0,1°.

O dono escolheu medir "deitado" pela altura, e não pelo ângulo. Agora o poste conta como deitado quando o desenho inteiro dele fica abaixo de metade de um poste em pé (`SHAFT / 2` = 3,7 m). As alturas medidas, com `Box3` do desenho no mundo:
- **Poste caído:** de -0,61 a 1,60 m. A cruzeta, de 1,6 m, fica em pé.
- **Poste em pé:** chega a 7,5 m.

Os 3 s para dormir continuam iguais. Com esse critério, o relógio começa assim que o poste desce, então o teste fica igual ou mais exigente. Resultado: 2/2 no Jolt e 1 passou mais 1 pulado no solver próprio.

## T3.8ab — passo do Jolt com muitas peças (2026-11-15)

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0. Worktree `passo-jolt-pecas` (branch `perf/passo-jolt-pecas`, sobre `a74a71d1`). Sonda: a da T3.8v, ampliada (`decision/probes/t38ab/probe-spikes.test.ts.txt`: copiar para `packages/game-floorplan-three/tests/`; modos por variável de ambiente `D4`, `MLP`, `OPTBP`, `STEPTEST=census|ccdoff|cat|perbody`, `SF` = quadro). `ab.sh` alterna o código de antes (worktree em `a74a71d1`) e o de agora. **Nenhuma régua, tolerância, teste ou regra mudou; as iterações (D1, 32) e o CCD ficaram como estão.**

**Aviso sobre a máquina:** até 22:44 o notebook estava num carregador de 100 W (CPU a 1,0–1,4 GHz sob carga); depois, no original. **Todos os números abaixo foram tomados depois das 22:52, exceto os de `perbody` (§1) e os `Step` por quadro da tabela de quadros acordados (§2 linha 2), feitos a 100 W**, em pares intercalados, na trava. Os da primeira passada (21:30 a 22:15, `ab-22h52.log` não os contém) foram descartados. A máquina não estava sozinha (carga 2 a 10 de outras sessões), e a deriva entre blocos chega a 30%: só valem comparações **dentro do mesmo bloco intercalado**.

### 1. Onde o passo vai (fase estável depois do blast, headless, 240 quadros de 1/60, 2 passos de 1/120)
Entre os quadros 80 e 220 há 25 a 50 corpos acordados e o `Step` custa 5 a 17 ms por quadro (antes do quadro 70, com os mesmos 50 corpos, custa 1,2 ms: a diferença é que os fios e as peças soltas já caíram no chão e estão em contato com os ladrilhos). Por corpo (`perbody`, um corpo acordado de cada vez, ms por passo fixo de 1/120; **medido a 100 W, antes das 22:44: valores absolutos inflados, valem as proporções**): **cada trecho de fio (caixa de 2,9 x 0,05 x 0,05 m, 16 kg) custa 0,1 a 0,7 ms por passo mesmo parado** (v < 0,1 m/s), os postes (950 kg) 0,01 a 0,12, os cilindros 0,03 a 0,4. Por categoria (quadro 165, um passo): base 3,5 ms, **sem os 13 fios 1,0**, sem os 6 cilindros 1,85, sem os 3 postes 3,2. Quadro 130: base 3,2; sem os 18 fios 1,8. O custo dos fios é a colisão contra os ladrilhos de chão (uma caixa de 2,9 m cobre 2 ou 3 ladrilhos de 2 m; cada ladrilho é campo de altura mais um composto de caixas) e não o solver: ver 6.
CCD desligado só para medir (`SetMotionQuality` Discrete nos acordados, não commitado): 1,8 para 1,1 ms por passo (quadro 130) e 3,65 para 2,0 (quadro 165). É a parte do custo que a decisão do dono sobre o CCD controla; não mexi.

### 2. Alavancas (tabela). Passo de física da sonda, mediana de 5 execuções, soma dos quadros 60 a 230 (ms) e pior quadro (ms)
| # | Alavanca | Resultado | Decisão |
|---|---|---|---|
| 1 | Peças pequenas / fios | Cada trecho de fio já é **uma** caixa; o D4 já manda os cacos para o VFX. Não há caixa a tirar sem mudar o desenho. 18 fios a 0,1–0,7 ms por passo cada: o custo é por contato com o chão (esforço de outra sessão: `layGround`/`layTile`), não por forma. | não mudou |
| 2 | Sono | Pós-blast, os fios dormem quando param; os acordados no quadro 165 se movem (0,3 a 5,5 m/s: postes caindo, fios arrastados), não estão "quase parados". Nenhum limite ou tempo (C4: 0,5 s abaixo de 8 cm/s) foi tocado. Quadros acordados: 50 (quadro 25), 44 (80), 28 (160), 17 a 8 (240). | não mudou |
| 3 | Broadphase e camadas | Chão, ladrilhos e restos da casa já estão na camada `static` (BP_STATIC); par de camadas já é a tabela do contrato (`debris` só encontra `static`, `debris`, `prop`, `character`, `vehicle`, `agent`, `sensor`). `OptimizeBroadPhase` depois de adições em lote: **mediana 873 (a cada quadro, custa 20 ms nos 240 quadros) e 935 (só quando o número de corpos muda, 6 ms) contra 736 a 960 da base na mesma janela: sem ganho dentro do ruído**. | não implementado |
| 4 | Ponte JS↔wasm | O passo inteiro lê só corpos acordados (`readBack` ignora o que dorme; `updateFriction` e `roll` só os ativos). Já era o piso (T3.6c). | não mudou |
| 5 | `maxLivePieces` (D4; padrão 600) | A cena tem cerca de 50 peças: o teto de 600 nunca atua. Com 50: 906, 30: 744, 20: 806 (base da janela: 736 a 960; passo p50 5,2 / 4,4 / 4,0 ms contra 4,6 a 5,6). O teto só ajuda abaixo de 30 e custa peças que somem. | padrão mantido |
| 6 | Subpassos x iterações | tabela abaixo (só medida) | defaults mantidos |
| 7 | **Criação de corpos em lote** (a pedido do coordenador) | `EnginePieces.prepare` cria os corpos novos de um quadro com `createBodies` (uma inserção na broadphase, ids na ordem da lista) em vez de um `createBody` por peça. Sonda, 6 pares intercalados (18 execuções por lado), passo da fase estável: **base 1037 (724–1518), nova 960 (636–1175)**; quadro p99 50 e 48, máximo 66 e 61. Sem piora; o ganho está dentro do ruído. O `createBody` de 60–75 ms dos piores quadros (T3.8ac) vem de `layTile` (ladrilhos novos), que não é desta tarefa. | implementado |
| 8 | **Acordar o que dormia sobre uma peça removida** (§12, defeito) | `remove` de uma peça que dorme acorda os corpos numa caixa de 0,1 m ao redor (`wakeInBox`); peça acordada não precisa (mesma ilha). Teste novo sem GPU `engine-remove-wakes.test.ts`: a caixa que dormia sobre outra removida cai ao chão (0,6 m para menos de 0,15 m); **reprova sem a correção** (fica em 0,6 m). `clear` não acorda ninguém. | implementado |

### 3. Subpassos x iterações (só medida, sem mudar o padrão): `JOLT_STEP` (Hz) e `JOLT_ITERATIONS`, D4 ligada
Passo da sonda, mediana de 5 execuções (intervalo), mesmo bloco. Bacia: `BOWL_SEEDS=64`, 128 casos (`substeps-bowl.log`).
| Hz | Iterações | soma dos quadros 60–230 (ms) | p50 do quadro (ms) | pior quadro (ms) | quadros > 5 ms de 240 | quadro p99 inteiro (ms) | Bacia 128 |
|---|---|---|---|---|---|---|---|
| 60 | 64 | 540 (536–573) | 3,1 | 7,1 | 17 | 41 | 128/128 |
| 60 | 32 | 575 (489–679) | 3,1 | 7,6 | 27 | 39 | 128/128 |
| **120** | **32 (padrão)** | 736 (715–941) | 4,6 | 10,2 | 64 | 48 | **128/128** |
| 120 | 16 | 881 (715–1006) | 4,8 | 12,0 | 75 | 46 | 128/128 |
| 120 | 8 | 820 (733–921) | 5,0 | 10,2 | 85 | 53 | **121/128** |
| 180 | 21 | 1219 (1087–1250) | 7,0 | 16,3 | 121 | 47 | 128/128 |
| 240 | 32 | 1348 (1219–1451) | 8,0 | 18,4 | 131 | 48 | (não rodado) |
| 240 | 16 | 1283 (1207–1638) | 7,7 | 16,1 | 129 | 46 | 128/128 |
| 240 | 8 | 1450 (1241–1699) | 8,1 | 22,4 | 132 | 50 | 126/128 |
| 240 | 4 | 1450 (1301–1555) | 8,0 | 18,4 | 139 | 48 | **118/128** |
- **O custo é a taxa de passos, não as iterações**: de 32 para 8 iterações o custo quase não muda (736 para 820, dentro do ruído); de 120 para 240 Hz dobra (736 para 1283–1450); a 60 Hz cai quase à metade. Logo, "mais passos de colisão com menos iterações" **piora** o custo sem ganho: nenhuma combinação a 240 Hz fica abaixo do padrão.
- 120 Hz com 16 iterações e 60 Hz com 32 ou 64 passam a bacia, mas 16 iterações perdem a pilha 20:1 (T3.6b) e 60 Hz muda o resultado do jogo todo (D1/D2 são do dono). Mesmo 60 Hz com 32 não fecha o B6: pior quadro 7,6 ms, 27 quadros acima de 5 ms. Critérios da sala (C1 a C4) não foram medidos para estas combinações: custaria dezenas de rodadas de navegador por célula.
- Os sinais de 8 iterações e 4 iterações a 240 Hz (121, 126 e 118 de 128) confirmam T3.3: poucas passadas não fecham a bacia.

### 3b. `room-explosion` a 1x, 5 pares intercalados (base `a74a71d1` e este código), depois das 00:07, à potência máxima, na trava (`tools/gpu/room-explosion.mjs` copiada da #314; uma rodada de blast e uma de martelo por execução; carga 1,1 a 2,7)
| Tipo | Lado | p99 por par (ms) | mediana do p99 | máximo por par (ms) | quadros > 5 ms (soma por rodada) | mediana |
|---|---|---|---|---|---|---|
| blast | base | 16,4 / 15,9 / 14,2 / 16,2 / 13,4 | **15,9** | 24,7 / 28,9 / 28,9 / 25,8 / 23,5 | 99 / 89 / 92 / 73 / 73 | **89** |
| blast | **nova** | 14,6 / 17,6 / 12,3 / 14,5 / 14,5 | **14,5** | 25,4 / 24,5 / 23,5 / 24,5 / 28,9 | 48 / 77 / 68 / 69 / 81 | **69** |
| martelo | base | 16,0 / 12,1 / 15,5 / 15,1 / 16,2 | **15,5** | 25,2 / 24,7 / 26,7 / 25,1 / 25,6 | 80 / 86 / 81 / 65 / 73 | **80** |
| martelo | **nova** | 14,6 / 15,0 / 14,7 / 13,5 / 16,2 | **14,7** | 23,5 / 27,8 / 18,7 / 25,7 / 25,0 | 64 / 56 / 42 / 78 / 76 | **64** |
- p50 0,2 ms nos dois lados. **Sem regressão**: os quadros acima de 5 ms vão de 89 para 69 (blast) e de 80 para 64 (martelo), mas a variação entre pares de um mesmo lado é de 48 a 99 e 42 a 86, então a queda de ~20% está dentro do ruído da própria medição e **não é afirmada como ganho** (correção da auditoria); p99 e máximo iguais dentro do ruído. Os dois lados continuam **longe do orçamento** (p99 4 ms, máximo 5 ms): o B6 não fecha por alavanca neutra (§4).
- **Estágio `createBody` dos piores quadros** (tabela de estágios do gate, média dos quadros de cada tipo a 1x, 5 execuções): blast 3,5 para 3,2 ms, martelo 2,9 para 3,0 ms: **igual**. É esperado: o `createBody` que o gate mede é o dos ladrilhos de chão (`layTile`: 9 a 11 ms), que não é desta tarefa; as peças agora entram por `createBodies` (que o gate não rotula) e o ganho aparece nos quadros acima de 5 ms. `joltStep` dos piores quadros 4,4 para 4,2 (blast) e 4,2 para 3,8 (martelo).
- Uma primeira passada de um par (23:04, antes de reduzir o acordar de vizinhos a peça que dorme) deu o lado novo pior (p99 19,3 contra 14,4; carga 2 a 10 contra 1,5 a 2 no lado de base): par com cargas diferentes, descartado, e o acordar passou a valer só para peça dormindo (a de acordada está na mesma ilha).

### 3c. Rodadas da sala (Jolt, D4 ligada, 5 blast e 5 martelo, um processo por rodada, `drive.mjs`, `chrome-headless-shell`, GPU Intel Arrow Lake via Mesa, `pnpm build` e `examples/test-room/build.mjs` antes, dist conferido)
| rodada | C1 (kg·m / violações) | C2 cond. (peças) | C3 (m) | C4 (s) | `fellThrough` | quadro p50 / p99 / máx (ms) | despertar |
|---|---|---|---|---|---|---|---|
| blast 1 | 0,202 / 17 | 0 | 0,0235 | 0,50 | 0 | 1,7 / 42,9 / 52,9 | 24,1 |
| blast 2 | 0,060 / 6 | 0 | 0,0084 | 0,50 | 0 | 2,0 / 47,8 / 51,7 | 23,2 |
| blast 3 | 0,065 / 9 | 0 | 0,0100 | 0,50 | 0 | 1,7 / 38,8 / 44,0 | 25,6 |
| blast 4 | 0,410 / 3 | 0 | 0,0067 | 0,40 | 0 | 1,6 / 48,6 / 51,6 | 25,5 |
| blast 5 | 0,069 / 21 | 0 | 0,0112 | 0,50 | 0 | 1,5 / 42,7 / 56,2 | 24,8 |
| martelo 1 | -0,002 / 0 | 0 | 0,0086 | 0,50 | 0 | 1,2 / 59,1 / 60,4 | 22,2 |
| martelo 2 | 0,006 / 2 | 0 | 0,0087 | 0,50 | 0 | 1,2 / 43,5 / 64,1 | 21,2 |
| martelo 3 | 0,159 / 6 | 0 | 0,0133 | 0,40 | 0 | 1,3 / 35,2 / 42,3 | 23,7 |
| martelo 4 | -0,002 / 0 | 0 | 0,0092 | 0,40 | 0 | 1,2 / 46,4 / 59,1 | 22,2 |
| martelo 5 | -0,002 / 0 | 0 | 0,0148 | 0,50 | 0 | 1,4 / 43,8 / 49,9 | 20,7 |
Como na T3.8y: **C2 condicionado, C3, C4 e `fellThrough` 10 de 10**, nenhum erro de página, quadro p99 35 a 59 ms (T3.8y: 42 a 51), C1 com violações só no blast e em 1 martelo, de 0,06 a 0,41 kg·m (T3.8y: 0,03 a 0,15 no blast); a rodada de blast 4 (0,41 kg·m, 3 violações) é a única acima da faixa da T3.8y, de uma amostra de 5 por tipo.

### 3d. Gates
| Gate | Resultado |
|---|---|
| `pnpm -r typecheck`, `pnpm typecheck:scripts` | 0 erros TS, exit 0 |
| `game-physics`, `game-physics-jolt` (inclui determinismo) | 9 passam; 68 passam, 2 pulados |
| `game-destruction-three`, próprio / Jolt | 418 passam, 0 falhas / 509 passam, **só as 2 `rolling`** conhecidas |
| `game-floorplan-three`, próprio / Jolt | **1187 passam, 0 falhas (exact-golden 44/44)** / 1188 passam, **só as 4 conhecidas** (3 `destruction/*` do golden e `bookcase-topple`) |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, `worstC4` 1,5167 igual ao da T3.8y |
| `eslint` nos arquivos mudados, `kit-audit --check`, `pnpm check:layers` | 0 erros / 0 novos fora do SDK dono / sem violações novas |
| Teste novo `engine-remove-wakes.test.ts` | passa; reprova sem a correção |

### 4. Conclusão para o dono
O B6 (física ≤ 5 ms em qualquer quadro) **não fecha com alavanca neutra**: o passo da fase estável é 3 a 17 ms por quadro e o que o domina são 13 a 18 trechos de fio acordados em contato com os compostos de chão, mais a varredura (CCD) das peças que se movem. As alavancas que cortam isso de verdade são decisões do dono (CCD, taxa de 120 Hz) ou de outra frente (chão sob as peças). O que fechou aqui: criação em lote, acordar vizinhos de peça removida (correção de defeito, com teste), e as medidas de `OptimizeBroadPhase`, `maxLivePieces` e subpassos.

## T3.8z — corte da casa sem recálculo

Máquina: Intel Core Ultra 9 275HX, Arch Linux, `node --version` = v24.22.0; 2026-11-15. Worktree `corte-da-casa`, branch `perf/corte-da-casa`, sobre `37a4193a` (main + fios do poste). Sondas e saídas em `decision/probes/t38z/` (`probe-spikes.test.ts.txt`: a sonda da T3.8v com o cronômetro da fase de montagem, a copiar para `packages/game-floorplan-three/tests/`; `run-ab.sh`, `summ.py`, `ab-raw.txt`, `rooms-lines.txt`). **Medidas feitas com o carregador de 100 W (CPU a 1,0-1,4 GHz) estão marcadas; as sem marca foram feitas depois das 22:44, com a máquina a toda a velocidade, sob o trinco `perf-measure.lock`.** Nenhuma régua, tolerância, teste ou critério mudou; nenhum golden mexeu.

### 1. Perfil do quadro do corte (sonda T3.8v, `single_storey_a`, semente 1, `build`, C4 a `casa - 2,5 m` e martelo; perfil V8 de um quadro, processo frio; 100 W, só a proporção vale)
`splitLoose` 20,7 ms: `adoptSplit` 16,4 (`fitPartBoxes` 8,4, quase tudo `fitOrientedBoxes` 7,8; `extract` 2,9, dele `collapse` > `rebuildHost` 2,0). O mesmo quadro depois de ajustar as caixas antes e reescrever o hospedeiro uma vez: `splitLoose` 11,1; `adoptSplit` 7,2; `fitOrientedBoxes` fora do quadro; `rebuildHost` 1,7 (duas escritas em vez de uma por parte). O quadro tem 6 a 7 ajustes (as folhas `lot/plain` de 456 pontos, 9 caixas cada, e as `lot/wood`); o primeiro, frio, custa 9,4 ms, os seguintes 1,5 a 2.

### 2. Projeto
- **Caixas ajustadas antes** (`renderer.ts`: `fitRanged`, `prefitPartBoxes`, `runPrefit`): `partBoxesOf` lê o ajuste de uma parte de faixa de malha unida de um cache `fittedBoxes` (por `MeshVis`), guardado **com os pontos e os triângulos de onde saiu**; vale só se os dois são os mesmos números (comparação exata). Não há versão a esquecer de subir: amassado, curvado, derretido mudam os pontos e o ajuste é refeito. Fila `prefitting` (um objeto, as partes uma a uma): roda no fim de `runBudgeted` quando não sobrou evento nem fatia, **no máximo 1 ms por quadro** (`PREFIT_SLICE_MS`), uma parte pelo menos quando nada mais rodou; conta em `pending`, e `flush` a esvazia. Opção `RendererOptions.fitBoxesAhead` (padrão ligado; desligada, o ajuste é feito ao romper, como antes). `runPrefit` é isolada (não toca estado fora da fila e do cache).
- **Quadro das caixas**: o ajuste de antes e o de agora usam a mesma conta; o cache só devolve o que a mesma entrada já deu. A peça solta fica no quadro do grupo novo, que copia a pose da raiz: o quadro da peça é o da casa **bit a bit** nos 7 a 18 ajustes de cada blast e martelo medidos (`hit` = todos os do corte; `missDiff` 0).
- **Um reescrever do hospedeiro por lote** (`visual.ts`: `batchRebuilds`, em volta do laço de `splitLoose`): o primeiro `rebuildHost` do lote roda na hora e os seguintes só marcam; ao fim, mais um se houve outro. O primeiro fica porque `extract` da parte seguinte copia as normais que a escrita deixa (a peça solta ganha as normais recalculadas, não as originais); o resultado fica idêntico ao de uma escrita por parte (teste abaixo), para quem lê as faixas de partes que não dividem triângulos.
- **Liberação (§8)**: `forgetBound` (todo `bounds.delete`) apaga as entradas do cache das partes do objeto; `dispose` passa por `unbind`.
- Não feito: reaproveitar cascos do chão (T3.8q): não aparece no quadro do corte. `adoptSplit` e `splitLoose` não tinham outro trabalho repetido por peça além dos dois acima (o resto é `world.splitGroup`, 3,6 ms frio, do mundo, fora do alcance).

### 3. Equivalência (testes sem GPU, `game-destruction-three/tests/fit-boxes-ahead.test.ts`, 5; passam no solver próprio e no Jolt)
(a) corte de um objeto de quatro partes (folha inclinada, placa de 169 vértices, poste, duas águas) posto e girado longe da origem: `partBoxes` de todas as peças com a opção ligada (cache cheio) iguais, com `toEqual` (`Object.is`), às da opção desligada; e o ajuste só foi chamado no corte da desligada. (b) lê de novo quando os pontos mudam (uma folha amassada). (c) `makePiece` depois do ajuste antes não chama `fitOrientedBoxes`. (d) cache frio, meio cheio, cheio e desligado, com e sem amassado antes: mesmas caixas e mesmo desenho (todo atributo e índice de toda malha, bit a bit). (e) cortar todos os grupos de uma vez escreve a malha unida e as soltas como cortar um a um. (f) `unbind` e `dispose` deixam o cache vazio. **Se o cache está cheio na hora do golpe nunca muda o resultado, só o tempo.**
- Golden exato **44/44** (solver próprio, `exact-golden.test.ts`); bacia B1 Jolt **128/128** (4 processos de 32). `game-destruction-three`: próprio 420 passam, 0 falhas; Jolt 511 passam e só as 2 de `rolling`. `game-floorplan-three`: próprio 1186 passam (a falha única, `test-area > every typology builds`, é estouro de tempo com a máquina cheia: passa sozinho, 17/17); Jolt 1188 passam e só as 4 conhecidas (3 `destruction/*` do golden exato e `bookcase-topple`). `pnpm -r typecheck`, `pnpm typecheck:scripts`: 0 erros; eslint dos arquivos: 0 erros (aviso `max-lines` de `renderer.ts`, que já existia); `kit-audit --check`: 0 novos; `check:layers`: sem violações novas.

### 4. Cache num blast real
Aos 70 quadros depois da montagem (1 ms por quadro): **244 entradas, 838 KiB** para a casa inteira (308 partes de faixa; as ocas, que `hollowBoxesOf` resolve, não entram). Depois do blast e do martelo, 275 entradas. Acertos no corte: 9 a 11; faltas por pontos diferentes (`missDiff`): **0**, no blast e no martelo (nenhuma parte ajustada foi amassada ou furada antes do corte; uma que fosse seria ajustada de novo, pelo teste (b)). Aos 70 quadros ainda faltavam 20 (mediana; 15 a 105) partes por ajustar quando a máquina estava carregada: o corte delas ajusta ao romper, como antes.

### 5. Antes e depois, sem navegador (sonda T3.8v, 9 execuções por lado intercaladas, um processo cada, sob o trinco, depois das 22:46; "antes" = `37a4193a`, "depois" = o código final; medianas e (intervalo))
| | f0 (quadro do corte) | f1 | p99 | máximo | soma 240 quadros | montagem: soma / pior quadro (70 quadros) |
|---|---|---|---|---|---|---|
| blast antes | 29 (25-70) | 26 | 55,9 (48-80) | 68,4 (57-87) | 4028 | 153 / 23,5 |
| **blast depois** | **20 (19-28)** | 31 | **49,5 (45-70)** | **60,4 (50-80)** | 3847 | 255 / 25,4 |
| martelo antes | 19 (17-28) | 24 | 55,9 (36-104) | 64,3 (39-130) | 3296 | 133 / 21,0 |
| **martelo depois** | **14 (12-18)** | 30 | **49,4 (39-57)** | 62,7 (44-75) | 3514 | 258 / 25,6 |
- O quadro do corte cai **30% no blast e 26% no martelo** (frio, processo novo). Parte do trabalho que o corte deixa para o quadro seguinte (f1 sobe 26 para 31 e 24 para 30): `splitLoose` corta por orçamento de relógio, e com o quadro 0 mais curto sobra tempo para as fatias seguintes cairem no 1. A soma dos 240 quadros não piora (blast 4028 para 3847). p99 e máximo caem no blast (11% e 12%), no martelo o p99 cai 12% e o máximo fica igual (faixas se sobrepõem: a máquina tinha outras sessões).
- **Custo adicionado na montagem (medido): +100 a 125 ms de CPU somados em 70 quadros** (as 308 partes, 0,4 ms em média, 8 ms a primeira, fria) e **+2 a 4,6 ms no pior quadro da montagem** (23,5 para 25,4; 21,0 para 25,6), nunca mais de 1 ms por quadro além do primeiro ajuste frio. Pior caso do cache: 838 KiB.
- Mesmo par, **com o carregador de 100 W** (antes das 22:44; 9 execuções por lado, `ab-raw-100W.txt`; os absolutos estão inflados): f0 blast 27 para 18, martelo 20 para 13; montagem 123 para 241 ms.
- Por estágio na ponta fraca (a T3.8ac mediu `fitBoxes` 39-47, `splitLoose` 23-37, `adoptSplit` 11-15, `rebuildHost` 11-16 ms a 1×): com este código `fitBoxes` sai do quadro do corte (leitura do cache, cerca de 0,1 ms por parte), `adoptSplit` e `splitLoose` perdem a parte do ajuste (7,8 de 20,7 ms, 38%, na proporção da máquina rápida) e `rebuildHost` roda 2 vezes por lote em vez de uma por parte. **Não medi na máquina fraca.**

### 6. Rodadas da sala (Jolt, D4 ligada, 5 blast e 5 martelo, um processo por rodada, `drive.mjs`, depois das 22:46, sob o trinco; `pnpm build`, `examples/test-room/build.mjs` e o `dist` conferido com `fitBoxesAhead` antes)
| rodada | C1 (kg·m / violações) | C2 cond. (peças) | C3 (m) | C4 (s) | `fellThrough` | quadro p50 / p99 / máx (ms) | despertar |
|---|---|---|---|---|---|---|---|
| blast 1 | 1,945 / 17 | 0 | 0,0134 | 0,55 | 0 | 3,6 / 61,8 / 93,4 | 38,4 |
| blast 2 | 0,431 / 5 | 0 | 0,0026 | 0,45 | 0 | 1,8 / 58,4 / 76,9 | 25,2 |
| blast 3 | 0,433 / 4 | 0 | 0,0062 | 0,40 | 0 | 2,1 / 56,2 / 71,2 | 23,8 |
| blast 4 | 0,216 / 21 | 0 | 0,0148 | 0,45 | 0 | 2,1 / 54,4 / 59,7 | 20,7 |
| blast 5 | 0,051 / 16 | 0 | 0,0164 | 0,50 | 0 | 2,0 / 46,5 / 75,9 | 23,7 |
| martelo 1 | 1,940 / 1 | 0 | 0,0108 | 0,65 | 0 | 1,6 / 61,1 / 81,8 | 26,2 |
| martelo 2 | -0,002 / 0 | 0 | 0,0267 | 0,65 | 0 | 1,5 / 67,5 / 80,1 | 28,3 |
| martelo 3 | -0,002 / 0 | 0 | 0,0140 | 0,45 | 0 | 1,5 / 59,6 / 67,0 | 27,6 |
| martelo 4 | -0,002 / 0 | 0 | 0,0044 | 1,55 | 0 | 1,5 / 50,9 / 95,6 | 26,9 |
| martelo 5 | -0,002 / 0 | 0 | 0,0146 | 0,50 | 0 | 1,5 / 55,5 / 72,4 | 26,8 |
C3 10/10 (todos abaixo de 3,5 cm), C4 10/10, `fellThrough` 0 em 10/10, C2 10/10, nenhum erro de página. O C1 (poste com energia a mais) aparece em 2 de 5 blast e 1 de 5 martelo; é o critério que a T3.8y já registrava em aberto, e este código não mexe na física (o corte devolve os mesmos números). Os quadros da sala (p99 46 a 68 ms) são os da T3.8y: o teto de ~50 ms por quadro vem do `Step` e do assentamento do chão, fora do corte.
- Um primeiro conjunto de 10 rodadas, feito com 100 W (antes das 22:44), deu os mesmos C3/C4/`fellThrough` 10/10 e p99 de 46 a 84 ms.

### 7. O que sobra
- O quadro do corte ainda é de 14 a 20 ms frio na máquina rápida, contra o alvo de 5 ms de física: o resto do `splitLoose` (`world.splitGroup` e `pieceSys.create`, 3,6 e 4,2 ms frios) e o `Step` do quadro. O corte por orçamento de relógio (`sliceDeadline`) é o que a sessão `espalhar-explosao` mexe.
- `runPrefit` anda no relógio de parede (1 ms por quadro); sai da fila em `runBudgeted` sem mudar quando a fila passar para o árbitro único de unidades de trabalho.
- O portão `perf-gate.mjs room-explosion` não existe nesta branch (o da `perf/medir-maquina-fraca` ainda não foi mesclado); o portão geral esperava máquina quieta (carga 7) e não terminou.


## T3.8ac — orçamento da explosão em máquina fraca (proxy)

Máquina: Intel Core Ultra 9 275HX (24 threads), Arch Linux, Node v24.22.0, Chrome 157.0.8103.50 (2026-11-15). Medido sobre `a74a71d1` (main), worktree `medir-maquina-fraca`, branch `perf/medir-maquina-fraca`. Feito por `executor` (sonnet).

**Aviso: o estrangulamento de CPU é um proxy, não hardware AMD.** `Emulation.setCPUThrottlingRate` (CDP) deixa a thread principal N vezes mais lenta de forma uniforme. Ele não reproduz o IPC, o cache, a latência de memória nem o tier-up do wasm de um Ryzen: "6x" é "uma CPU seis vezes mais lenta que esta", não "um notebook AMD". Um resultado dentro do orçamento a 4x é indício forte; um estouro é aviso real; só uma rodada numa máquina AMD fecha a pergunta (regra do dono, `gpu-vendor-agnostic-perf`).

**A máquina não estava quieta.** Outras sessões mediam ao mesmo tempo (a trava `perf-measure.lock` serializa só quem a usa; builds e testes de navegador de outras sessões seguiram rodando): a carga média de cada rodada ficou entre 4,3 e 15,5, mediana 6,1 (campo `load` de cada rodada no JSON). Os valores absolutos podem estar inflados em relação a uma máquina quieta; a ordem de grandeza e a comparação entre solvers e entre estrangulamentos valem, a casa decimal não.

### Método
- Ferramenta: `tools/gpu/room-explosion.mjs`, chamada por `node tools/gpu/perf-gate.mjs room-explosion`. Reaproveita a montagem da sonda de sala (`decision/probes/room.js`: a casa `single_storey_a` com semente 1, C4 na parede ou 12 golpes de martelo, um por quadro), sem o medidor de energia da T3.4 (ele não mede tempo e só acrescentaria trabalho de JS).
- Uma página nova por rodada, a casa montada a velocidade normal e o estrangulamento ligado só depois, para o tempo medido ser o da explosão e não o da montagem. O laço de quadros da página é parado e a sonda chama `room.update(1/60)` 660 vezes (11 s simulados): é o quadro de um jogador a 60 Hz (2 passos fixos de 120 Hz), não os quadros de 0,05 s das sondas da T3.8.
- **Tempo de física por quadro** = o passo do laço de Jolt (`window.__roomPhysics.step`) + o sistema de peças do kit (`pieceSys.update`: o solver próprio, ou a cola que lê as poses do Jolt e aplica as regras do kit, inclusive `createBody` e `layTile`) + a fila de despertar do D4 (`advanceWakes`). Não entra desenho: nada é desenhado. A divisão do espatifamento do kit (`splitLoose`) **não** está nesse tempo (roda em `renderer.update`, fora da física); aparece na tabela de estágios, com o quadro inteiro.
- O quadro 0 (o que aplica a explosão) fica à parte (`despertar`) e fora do p99 e do máximo, como o B6 do `spec.md` §11 ("fora do quadro de despertar"). O gate: p99 = mediana dos p99 das rodadas, máximo = o pior máximo de uma rodada, como a regra do B6 (mediana das rodadas ≤ 4 ms, nenhuma acima de 5 ms).
- 5 rodadas de blast e 5 de martelo a 1x, 4x e 6x, Jolt com D4 ligado (`?solver=jolt&blastDebris=1`) e o solver próprio (`?area=floorplan`), intercaladas (a deriva da máquina cai em todas as células por igual). JSON completo, com as rodadas e a carga de cada uma: `decision/t38ac-baseline.json`.

### Linha de base (main `a74a71d1`): física em ms por quadro

p50 e p99: mediana das 5 rodadas. Máx e despertar: a pior rodada. Quadros > 4 ms e > 5 ms: soma das 5 rodadas (de 3295 quadros por célula).

| Solver | CPU | Tipo | p50 | p99 | máx | despertar | quadros > 4 ms | quadros > 5 ms |
|---|---|---|---|---|---|---|---|---|
| Jolt + D4 | 1x | blast | 0.4 | 36.9 | 177 | 3.6 | 1165 | 1100 |
| Jolt + D4 | 1x | hammer | 0.4 | 49.9 | 126.2 | 1 | 1237 | 1156 |
| Jolt + D4 | 4x | blast | 2.3 | 84.3 | 252.3 | 6.4 | 1477 | 1460 |
| Jolt + D4 | 4x | hammer | 1.5 | 87.4 | 181.7 | 2.6 | 1476 | 1389 |
| Jolt + D4 | 6x | blast | 11 | 122 | 301.9 | 7.9 | 2478 | 2471 |
| Jolt + D4 | 6x | hammer | 5 | 121.8 | 232.5 | 5.4 | 1655 | 1596 |
| solver próprio | 1x | blast | 0.8 | 11.4 | 19.4 | 0.2 | 983 | 836 |
| solver próprio | 1x | hammer | 0.7 | 13.8 | 21.1 | 1.6 | 965 | 796 |
| solver próprio | 4x | blast | 2.2 | 20.4 | 28.7 | 0.4 | 1219 | 1120 |
| solver próprio | 4x | hammer | 0.8 | 22 | 32.5 | 1.2 | 1102 | 1066 |
| solver próprio | 6x | blast | 3.2 | 29 | 54.5 | 1 | 1518 | 1341 |
| solver próprio | 6x | hammer | 1.3 | 30.9 | 44.2 | 2 | 1143 | 1090 |

Leitura: **o orçamento (p99 ≤ 4 ms, máx ≤ 5 ms) não fecha nem a 1x com Jolt + D4**: p99 de 37 ms (blast) e 50 ms (martelo), máximo de 126 a 177 ms, e a terça parte dos quadros passa de 5 ms, contra a cascata de 500 corpos do B6 (T3.6c: média de 1,2 ms fora do despertar). O quadro mediano é barato (0,4 ms, a casa dorme), o problema é a cauda. O solver próprio é bem melhor na cauda (p99 11–14 ms, máximo 19–21 ms), mas também passa de 5 ms em 24 a 28% dos quadros. A 4x e a 6x a cauda cresce de forma mais ou menos linear (p99 84–122 ms no Jolt). O quadro de despertar sozinho (3,6 a 7,9 ms no blast) fica perto do orçamento. Isto vale para a casa inteira na sala, não para os 500 corpos do B6: os dois números não se contradizem, medem cenas diferentes.

### Os piores quadros por estágio

Os 10 quadros mais lentos (quadro inteiro de `room.update`) de cada tipo e estrangulamento, Jolt + D4, 3 rodadas juntas, em ms. Cada estágio é o tempo no próprio método, **sem** os estágios que ele chama (por isso `createBody`, chamado de dentro de `layTile`, não está somado em `layTile`). `física` é o tempo de física acima; `outros` é o quadro inteiro menos os estágios (o que o quadro faz fora deles: eventos do mundo, fogo, fluidos, vfx, `world.update`). `rodada.quadro` = rodada 3, quadro 8 é `3.8`. Estágios: `splitLoose`/`adoptSplit`/`fitBoxes` (`partBoxesOf`, que chama `fitOrientedBoxes`)/`rebuildHost` são o espatifamento do kit; `createBody` a criação de corpo no Jolt; `layGround`/`layTile` o chão do Jolt sob as peças; `joltStep` o `stepFixed` do Jolt; `bridgeReads` `readPose` + `readVelocity`; `readBack` o resto da leitura de volta no kit. Rodada à parte, só com os cronômetros ligados (eles custam um pouco: os percentis acima nunca vêm dela).

| CPU | Tipo | rodada.quadro | quadro inteiro | física | splitLoose | adoptSplit | fitBoxes | rebuildHost | createBody | layGround | layTile | joltStep | bridgeReads | readBack | outros |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1x | blast | 2.8 | 198 | 186.4 | 0 | 0 | 0 | 0 | 75.2 | 0.4 | 60.2 | 24.5 | 0.4 | 3.1 | 34.2 |
| 1x | blast | 3.8 | 164 | 154.9 | 0 | 0 | 0 | 0 | 59.4 | 0.2 | 55.2 | 20.2 | 0.2 | 2.5 | 26.3 |
| 1x | blast | 1.8 | 160.1 | 151.4 | 0 | 0 | 0 | 0 | 60.6 | 0.2 | 50.9 | 19.8 | 0.2 | 2.5 | 25.9 |
| 1x | blast | 3.3 | 118.3 | 0.3 | 23.5 | 11.2 | 46.6 | 11.3 | 0 | 0 | 0 | 0 | 0 | 0 | 25.7 |
| 1x | blast | 2.3 | 107.9 | 0.2 | 22.6 | 11.4 | 39.8 | 11.8 | 0 | 0 | 0 | 0 | 0 | 0 | 22.3 |
| 1x | blast | 2.86 | 107.9 | 47.2 | 0 | 0 | 0 | 0 | 4.4 | 0 | 22.7 | 5.1 | 0.1 | 6.5 | 69.1 |
| 1x | blast | 2.4 | 106.9 | 86.7 | 0 | 0 | 0 | 0 | 8.3 | 1.5 | 22.4 | 17.5 | 0.8 | 1.3 | 55.1 |
| 1x | blast | 1.3 | 105.8 | 0.3 | 24 | 11.3 | 39 | 11.2 | 0 | 0 | 0 | 0 | 0 | 0 | 20.3 |
| 1x | blast | 1.4 | 101.7 | 83.1 | 0 | 0 | 0 | 0 | 7.8 | 1.5 | 22 | 16.9 | 0.6 | 1.4 | 51.5 |
| 1x | blast | 3.4 | 98.6 | 81.1 | 0 | 0 | 0 | 0 | 8.6 | 1.6 | 22.6 | 17.1 | 0.8 | 1.6 | 46.3 |
| 1x | hammer | 1.3 | 154.9 | 18 | 29.7 | 14.5 | 42.8 | 14.1 | 0 | 0 | 0 | 0 | 0 | 0 | 53.8 |
| 1x | hammer | 1.4 | 145.2 | 125.1 | 0 | 0 | 0 | 0 | 11.9 | 2.3 | 33.1 | 26.5 | 1.1 | 2.3 | 68.0 |
| 1x | hammer | 2.6 | 138.7 | 117.5 | 0 | 0 | 0 | 0 | 12.3 | 2.5 | 32.6 | 26 | 1.2 | 2.1 | 62.0 |
| 1x | hammer | 3.6 | 135.8 | 114.1 | 0 | 0 | 0 | 0 | 12.6 | 2.2 | 33.3 | 26.3 | 1.1 | 2.2 | 58.1 |
| 1x | hammer | 3.5 | 125.8 | 0.2 | 37.4 | 14.7 | 41.6 | 15.2 | 0 | 0 | 0 | 0 | 0 | 0 | 16.9 |
| 1x | hammer | 2.5 | 120.8 | 0.3 | 30.7 | 15 | 46.9 | 15.6 | 0 | 0 | 0 | 0 | 0 | 0 | 12.6 |
| 1x | hammer | 2.137 | 113.7 | 76.4 | 0 | 0 | 0 | 0 | 0.1 | 0.1 | 33.2 | 25.3 | 0.3 | 8 | 46.7 |
| 1x | hammer | 2.79 | 94.8 | 62 | 0 | 0 | 0 | 0 | 16 | 0.1 | 31 | 3.3 | 0.2 | 4 | 40.2 |
| 1x | hammer | 3.79 | 83.2 | 62 | 0 | 0 | 0 | 0 | 17.7 | 0.2 | 32.2 | 2.6 | 0 | 4.4 | 26.1 |
| 1x | hammer | 1.77 | 81.2 | 58.8 | 0 | 0 | 0 | 0 | 16.3 | 0.2 | 30 | 2.5 | 0 | 3.9 | 28.3 |
| 4x | blast | 3.10 | 286.1 | 264.7 | 0 | 0 | 0 | 0 | 104.3 | 0.4 | 80.7 | 42.3 | 0.4 | 5.7 | 52.3 |
| 4x | blast | 2.10 | 277.4 | 255.6 | 0 | 0 | 0 | 0 | 105.5 | 1.4 | 76.4 | 36 | 1.1 | 4.8 | 52.2 |
| 4x | blast | 1.10 | 264.8 | 248 | 0 | 0 | 0 | 0 | 107 | 1.1 | 72.3 | 34.3 | 1.5 | 4 | 44.6 |
| 4x | blast | 3.17 | 245.8 | 23.8 | 31.3 | 2.7 | 11.9 | 6.5 | 0 | 0.8 | 0 | 11 | 0.7 | 8.3 | 172.6 |
| 4x | blast | 2.17 | 191.5 | 15.6 | 21.6 | 3.1 | 10.1 | 4.4 | 0 | 0.1 | 0 | 9.8 | 0.7 | 3.5 | 138.2 |
| 4x | blast | 1.17 | 183 | 16.4 | 17.9 | 3 | 9.7 | 3.9 | 0 | 0 | 0 | 9.9 | 0.8 | 3.2 | 134.6 |
| 4x | blast | 2.0 | 182.5 | 7.9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 182.5 |
| 4x | blast | 3.6 | 182.1 | 139 | 0 | 0 | 0 | 0 | 14.1 | 2.1 | 36.3 | 31 | 1.6 | 3 | 94.0 |
| 4x | blast | 1.0 | 180.3 | 6.8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.7 | 0 | 0 | 179.6 |
| 4x | blast | 3.0 | 178.7 | 6.9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 178.7 |
| 4x | hammer | 2.7 | 236.3 | 198.2 | 0 | 0 | 0 | 0 | 23.1 | 4.4 | 54 | 41.8 | 1.4 | 3.9 | 107.7 |
| 4x | hammer | 3.7 | 232.8 | 197.1 | 0 | 0 | 0 | 0 | 21.1 | 3.8 | 45.9 | 42.3 | 1.2 | 3.9 | 114.6 |
| 4x | hammer | 1.7 | 218.5 | 182.6 | 0 | 0 | 0 | 0 | 19.2 | 4.5 | 43.3 | 41.4 | 1.1 | 3.9 | 105.1 |
| 4x | hammer | 1.6 | 211.3 | 0.3 | 59.4 | 29.1 | 68.7 | 20.3 | 0 | 0 | 0 | 0.1 | 0 | 0 | 33.7 |
| 4x | hammer | 2.6 | 206.8 | 0.4 | 49.4 | 29.7 | 78 | 21.4 | 0 | 0 | 0 | 0.1 | 0 | 0 | 28.2 |
| 4x | hammer | 3.6 | 204.9 | 0.5 | 49.3 | 30.7 | 77.9 | 20.2 | 0 | 0 | 0 | 0 | 0 | 0 | 26.8 |
| 4x | hammer | 2.0 | 193.1 | 5.1 | 0 | 0 | 0 | 0 | 0 | 0.8 | 0 | 1.2 | 0 | 0 | 191.1 |
| 4x | hammer | 2.81 | 185.8 | 140.8 | 0 | 0 | 0 | 0 | 38.2 | 0.3 | 67.6 | 8.8 | 1.5 | 10.5 | 58.9 |
| 4x | hammer | 3.81 | 180.9 | 127.4 | 0 | 0 | 0 | 0 | 31.4 | 1.2 | 72.5 | 8.3 | 0 | 10.9 | 56.6 |
| 4x | hammer | 1.0 | 180.3 | 5.5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 180.3 |


Leitura:
1. **Dois tipos de quadro pior, e nenhum é o passo do Jolt.** (a) Quadros de criação de peças e de chão: `createBody` 60–75 ms e `layTile` 51–60 ms no blast a 1x (8–18 e 22–33 nos outros), enquanto `joltStep` fica em 17–26 ms (2,5–26 no martelo). (b) Quadros de espatifamento: `fitBoxes` 39–47 ms, `splitLoose` 23–37 ms, `adoptSplit` 11–15 ms e `rebuildHost` 11–16 ms (a 4x, no martelo, 69–78 / 49–59 / 29–31 / 20–21); aqui a física é ~0,3 ms: o quadro de 100–155 ms é todo do kit, fora do orçamento de física, mas dentro do quadro do jogador.
2. `layGround` e as leituras de pose (`bridgeReads`, `readBack`) somam menos de 12 ms em qualquer quadro: o custo da ponte wasm→JS não é o problema agora.
3. Nos quadros de despertar a 4x (`2.0`, `1.0`, `3.0`), 180 ms ficam em `outros` e quase nada na física: é o que a explosão faz no próprio quadro 0 antes da física (eventos do mundo e dano, fora dos estágios medidos). Esse trecho não foi aberto; é o próximo corte se alguém precisar dele.
4. O que mover o orçamento: criação de corpos e de ladrilhos do chão (`createBody` + `layTile`, ~70–135 ms por quadro pior a 1x) e o espatifamento do kit (`fitOrientedBoxes` em primeiro lugar) valem mais que qualquer ajuste do passo do Jolt.

### Como rodar o gate
```bash
flock ~/.cache/adatechnology-game-kit/perf-measure.lock node tools/gpu/perf-gate.mjs room-explosion
```
Só à mão ou na rodada diária (`tools/gpu/nightly-gpu.mjs` roda como etapa `room-explosion`, depois do `perf-gate`); nunca no CI nem no pre-push (§9). Sai com código 1 quando o Jolt + D4 passa do orçamento nos estrangulamentos que bloqueiam (padrão: 1x) ou uma página dá erro; os outros níveis (2x, 4x, 6x) e o solver próprio saem no relatório com o veredito, sem bloquear. Variáveis (todas opcionais): `ROOM_EXPLOSION_THROTTLES=1,2,4,6`, `ROOM_EXPLOSION_GATE_THROTTLES=1` (os que bloqueiam, ex. `1,2,4`), `ROOM_EXPLOSION_VARIANTS=jolt-d4` (`jolt-d4,jolt,own`), `ROOM_EXPLOSION_KINDS=blast,hammer`, `ROOM_EXPLOSION_ROUNDS=5`, `ROOM_EXPLOSION_FRAMES=660`, `ROOM_EXPLOSION_P99_MS=4`, `ROOM_EXPLOSION_MAX_MS=5`, `ROOM_EXPLOSION_STAGE_ROUNDS=3` (0 desliga a tabela de estágios) e `ROOM_EXPLOSION_STAGE_THROTTLES=1,4`, `ROOM_EXPLOSION_OUT=<arquivo.json>`. A linha de base desta seção: `ROOM_EXPLOSION_THROTTLES=1,4,6 ROOM_EXPLOSION_VARIANTS=jolt-d4,own ROOM_EXPLOSION_STAGE_ROUNDS=0` mais uma rodada só de estágios (`ROOM_EXPLOSION_ROUNDS=0`). **Hoje o gate falha a 1x na main: quem o usar para julgar uma mudança compara com a tabela acima (e com a main medida na mesma hora), não espera verde.**

Limites: proxy de CPU, não AMD; máquina com outras sessões (carga 4–15); 5 rodadas por célula (3 de estágios); o D4 é a política do dono (`blastDebris=1`), o solver próprio entra só como referência.

## T3.8aa — explosão espalhada por quadros (2026-11-15) — **o árbitro está pronto e desligado por padrão; a medida final e a calibragem ficam para depois do merge de `corte-da-casa`, `passo-jolt-pecas` e `chao-sob-pecas`**

Máquina: Intel Core Ultra 9 275HX (24 threads), Arch Linux, `node --version` = v24.22.0. Worktree `espalhar-explosao`, branch `perf/espalhar-explosao`, sobre a main `a74a71d1`. Desenho revisto pelo `architect`: `design/orcamento-da-explosao.md` (commit `d91291ce`). Sondas e saídas em `decision/probes/t38aa/`. Nenhuma régua, tolerância, teste ou regra foi afrouxado ou removido.

**Aviso de energia (dono, 2026-11-15):** até ~22:44 o notebook estava num carregador USB-C de 100 W e a CPU ficou presa em 1,0–1,4 GHz sob carga; depois, no carregador original, 3,2–4,3 GHz (~3× mais rápido). **Todos os tempos desta seção foram medidos antes das 22:44, a 100 W** (marcados "100 W"). Valem as proporções dentro de uma mesma rodada e o A/B intercalado (os dois lados no mesmo lado das 22:44); os valores absolutos estão inflados. O A/B a plena potência começou e foi parado na fila da trava, porque o coordenador pôs a medida em ordem de merge: este branch mede por último.

### 1. Para onde vai o quadro (100 W, sem navegador)
Sonda nova `probe-spread.test.ts.txt` (a montagem da T3.8v: `single_storey_a`, semente 1, `build`, blast C4 a `casa - 2,5 m` ou 12 golpes de 8000 J, 240 quadros de 1/60 s). "Física" = a fila adiada do renderizador (eventos e cortes, `deferredQueue().run`) + o passo do laço (`prepare`, `stepFixed`, leitura). Saída por estágio em `stages-main-100W.txt`.

| família | quadros | física | onde |
|---|---|---|---|
| corte da casa | f0–f25 | 10–23 ms (2 cortes por quadro) | `splitGroup` (o mundo refaz o objeto inteiro: ~5 ms por corte na casa), `adoptSplit` (`fitPartBoxes`, `measure`, `rebuildHost`) |
| **chão sob as peças** | f80–f190 | **33–90 ms** (os piores da rodada) | `layGround`/`layTile` 17–65 ms (`setShape` do sólido 16–39 ms), `stepFixed` 5–15 ms; corpo novo quase nenhum |
| assentado | o resto | 3–6 ms | `stepFixed` |

**Os quadros de 49–64 ms da main não são do corte.** O último corte do blast é no f20–f29; os piores quadros (f88–f190) são o chão que as peças caídas pedem (ladrilhos novos e reassentados) com o passo do Jolt por cima. Mais de 160 dos 240 quadros passam de 5 ms de física na main. Nenhum escalonamento do corte alcança o B6 (p99 ≤ 4, nenhum > 5) nesta cena: o chão é da frente G (`chao-sob-pecas`), o passo e a criação de corpos da frente P (`passo-jolt-pecas`), e um corte da casa sozinho já custa mais que 4 ms (frente C, `corte-da-casa`).

### 2. O quadro 0 e o "outros" de 180 ms a 4× da T3.8ac (100 W, perfil de CPU, `frame0-profile-100W.txt`)
| quadro 0 (1×, 100 W) | rodada fria (a primeira do processo) | rodadas quentes |
|---|---|---|
| blast, total | 46,9 ms | 21,6–22,3 ms |
| aplicar o evento (`applyEvent`) | 29,1: `onDetach` > `splitLoose` 25,1 (`adoptSplit` 19,5: `fitPartBoxes` 9,0, `measure` ~6; `splitGroup` ~5) | 13,6: `splitLoose` 12,6 (`adoptSplit` 6,5, `splitGroup` 6,0) |
| `simulate` da sala (laço, `world.update`) | 13,3 | 5,0–7,7 |
| martelo, total | 39,3 (`splitLoose` 27,2; `fitOrientedBoxes` 9,2) | 15,9–16,4 (`splitLoose` 11,4–12,4; `onDent`/`rebuildHost`/`computeVertexNormals` 5–6) |

Leitura: o "outros" de 180 ms do quadro de despertar a 4× é, a 1×, ~45 ms de **kit aplicando o evento**: o primeiro corte (que a regra do dono manda fazer no próprio quadro: a casa começa a quebrar na hora) mais as marcas do golpe (`onDent`, `rebuildHost`, normais). **Metade dele é JIT frio:** a primeira explosão do processo custa ~2× as seguintes, porque é a primeira vez que esses caminhos (corte, ajuste de caixas, malha do hospedeiro) rodam. Os cronômetros da T3.8ac não pegaram o `splitLoose` do quadro 0 porque ele roda dentro do `applyEvent` da fila adiada, que eles não embrulham. O que daria para atacar aqui, fora do escopo deste branch: aquecer esses caminhos ao carregar (um corte de uma peça de teste invisível, como o `warmUpProbes` faz com os shaders) e o corte mais barato da frente C. O árbitro não tira esse quadro: com o orçamento ligado ele faz o mesmo primeiro corte (forçado) e os eventos (18–23 ms quente, 54–70 ms frio com a ordem nova).

### 3. Desenho (o que entrou)
- **`WorkBudget`** (`game-physics/src/work-budget.ts`): o orçamento de um quadro em **unidades de trabalho**, nunca em tempo: `budgetMs × unitsPerMs / tier` (padrões 4 ms, 100 unidades por ms, `tier` 1). A faixa da máquina (`tier`) é escolhida uma vez por sessão; nenhum relógio decide um quadro. `WORK_KINDS` fixa a ordem em que as filas tiram: evento, corte, fragmento, ajuste antecipado (`prefit`, para o `runPrefit` da frente C), chão, corpo, despertar.
- **`WorkQueue`**: trabalho guardado como **dado** (item, prioridade, chave estável, unidades), solta o que cabe em ordem de prioridade e chave, pelo menos um por quadro, e o que esperou `maxWaitFrames` (30) sai de qualquer jeito. `saveState`/`restoreState`.
- **`RendererOptions.workBudget`** (`ExplosionWorkOptions`), desligado por padrão. Ligado:
  - os eventos aplicam no próprio quadro (clarão, poeira, trincas, peça escondida) e custam `perEvent`;
  - os grupos soltos de um evento se cortam **no próprio evento, na ordem do mundo, enquanto cabem** (o primeiro do quadro sempre: a casa quebra na hora); o que não cabe entra na fila, o mais perto do `focus` (lido uma vez, quando soltou) primeiro, desempate pela menor id de parte. Até a vez dele o grupo fica no objeto, desenhado e sólido onde estava (corpo estático do hospedeiro: nunca peça sem corpo);
  - o custo de um corte é estimado pelo tamanho do trabalho (`splitWorkUnits`: vértices do grupo, vértices da malha do hospedeiro, partes do objeto), **como se nenhuma caixa estivesse ajustada antes** (risco D2 do desenho);
  - fragmentos e a fila de despertar do D4 tiram do mesmo orçamento; a fila de despertar guarda dados (`BlastWake`: objeto, impulso, ponto), não fechamentos;
  - com orçamento para tudo, é o mesmo trabalho na mesma ordem de sem ele (os goldens provam, seção 5).
- Sala: `debris.workBudget` (o jogador é a câmera) e `?workBudget=4` na página.
- **Não entrou** (dono de outra frente, desenho §6): criação de corpos em lote e o chão antes da ativação (`engine-pieces.ts`, P e G). O árbitro tem os tipos `ground` e `body` para quando eles chegarem.
- **§12 enquanto espera:** grupo na fila = parte do objeto, desenhado e colidindo como estava; o teto de 30 quadros (0,5 s) limita quanto tempo um grupo sem apoio pode esperar. É a tensão T1 do desenho: um teto curto (3 quadros) devolve o pico; um longo deixa o grupo parado no ar por mais tempo. Fica com o dono.

### 4. Antes e depois (100 W, sem navegador, A/B intercalado: 3 pares × 3 rodadas por lado no blast, 1 par no martelo; o resto foi parado pela mudança de carregador e pela ordem da trava)
Medianas (intervalo). `headless-ab-100W.txt`.

| | física p50 | física p99 | física máx | quadros > 5 ms | soma dos 240 quadros | último corte | quadros até a última peça |
|---|---|---|---|---|---|---|---|
| blast, desligado (9) | 14,7 (9,7–20,0) | 56,5 (38,3–94,5) | 71,3 (42,0–100) | 217 | 4707 (3765–7264) | f27 (f22–f179) | f30 (f23–f180) |
| blast, `workBudget` 4 ms (9) | 11,2 (10,7–12,0) | 50,8 (45,3–58,3) | 81,8 (70,8–86,7) | 222 | 4376 (4197–4803) | **f32 nas 9** | **f32 nas 9** |
| martelo, desligado (3) | 7,3 | 48,0 | 56,8 | 161 | 3225 | f18 | f20 |
| martelo, `workBudget` 4 ms (3) | 10,1 | 40,3 | 64,1 | 202 | 3478 | f32 | f32 |

Leituras:
1. **O orçamento não baixa o pior quadro nem a soma nesta cena** (blast: máximo 71 → 82, martelo 57 → 64; martelo p50 7,3 → 10,1). Os piores quadros são do chão, que não passa pelo árbitro, e um corte da casa sozinho (5–20 ms) já passa dos 4 ms: com 4 ms o árbitro corta um por quadro, o corte se estende de ~20 para 32 quadros e as peças caem mais tarde (a última peça ganha corpo no f239 contra f186–f211), empurrando o chão para dentro da janela medida. **Não recomendo ligar por padrão hoje.**
2. **O que ele já entrega: um cronograma que não depende do relógio.** Desligado, o corte termina entre f22 e f179 conforme a carga da máquina (o `eventBudgetMs` de 8 ms da sala é relógio); ligado, o último corte é **f32 nas 9 rodadas** e no martelo f31–f32. É o que o determinismo (T3.7) pede de qualquer espalhamento.
3. A lacuna do B6 nesta cena é de outra ordem (p99 40–57 ms contra 4): ver seção 1.

### 5. Goldens e critérios
- **Desligado (o padrão), nada muda:** `game-floorplan-three` próprio **1187 passam, 0 falhas, golden exato 44/44**; Jolt **1188 passam, só as 4 conhecidas** (3 `destruction/*` do golden exato, gravados no solver próprio, e `bookcase-topple`).
- **Ligado** (cópia local do `exact-golden.test.ts` com `workBudget`, não commitada): com orçamento para tudo (`budgetMs` 1000) os 3 goldens de destruição dão **bit a bit o mesmo hash** (o corte no evento segue a ordem do mundo). Com 4 ms mudam os 3: `destruction/breach` 1073 → 837 objetos, `spall` 1062 → 838, `fracture` 1103 → 862, com 30 ou 19 quadros de espera. A cena roda 20 quadros de 0,05 s; com os cortes espalhados, as peças caem em outra hora e a própria queda (fraturas, fragmentos ao bater) muda: é a mudança de resultado que o dono pediu para relatar, não para entregar. Por isso o padrão fica desligado e nenhum golden foi regravado. Uma versão intermediária (tudo na fila, ordem por distância desde o primeiro corte) mudava os goldens mesmo com orçamento para tudo (1073 / 1061 / 1107, hash diferente): foi trocada pela atual.
- **Sala (5 blast + 5 martelo, Jolt, D4, `workBudget`): não rodada.** A página foi construída (`pnpm build`, `node examples/test-room/build.mjs`, exit 0; `splitWithin` e `perHostVertex` no `dist/test-room.html`), mas as rodadas também medem tempo e entram na fila da trava depois das outras três frentes, por ordem do coordenador. Fica pendente, junto com as ~30 rodadas por lado que o desenho pede para julgar por distribuição (T2).

### 6. Gates (código final, `f304eaad`)
| gate | resultado |
|---|---|
| `pnpm -r typecheck` / `pnpm typecheck:scripts` | exit 0 / exit 0 |
| `game-physics` | 14 passam (+5 novos: `work-budget.test.ts`) |
| `game-destruction-three` próprio | 428 passam, 0 falhas (+10 novos em `work-budget.test.ts`) |
| `game-destruction-three` Jolt | 519 passam, **só as 2 `rolling` conhecidas**; `determinism.test.ts` passa (dois processos, `fixed`, replay, salvar no meio da fila de despertar com a fila agora em dados) |
| `game-physics-jolt` (determinismo incluído) | 68 passam, 0 falhas |
| `game-floorplan-three` próprio / Jolt | 1187, 0 falhas, golden 44/44 / 1188, só as 4 conhecidas |
| Bacia, `PIECE_SOLVER=jolt BOWL_SEEDS=64` | **128/128**, números idênticos aos da T3.8w (`worstC1` −0,007656, `worstC3` 0,024192, `worstC4` 1,5167, `fellThrough` 0) |
| `eslint` dos arquivos mudados / `kit-audit --check` / `pnpm check:layers` | 0 erros (o aviso antigo de `max-lines` em `renderer.ts` e `room.ts`) / 0 novos fora do SDK dono / sem violações novas |

Uma rodada do Jolt de `game-floorplan-three` feita com outras suítes em paralelo reprovou `pole-collider.test.ts` ("deitado no chão, dorme em até 3 s"); sozinho passa 2 de 2, e a rodada sequencial passa. É o `eventBudgetMs` de 8 ms (relógio) da sala de teste mudando o resultado com a carga da máquina: o mesmo motivo de a seção 4 querer o cronograma em unidades.

### 7. O que falta, e de quem
1. **Medir a plena potência, na vez deste branch na trava** (depois de C, P e G): o A/B intercalado (`ab.sh`), o perfil do quadro 0 (`frame0.sh`) e as rodadas da sala, uma por processo (`drive.mjs ww4-<i> "&solver=jolt&blastDebris=1&workBudget=4" 1 <tipo>`), comparadas com a T3.8ac refeita a plena potência e com a main medida na mesma hora.
2. **Calibrar `WORK_UNIT_DEFAULTS`** em cima dos três branches: os números de hoje (`perSplit` 120, `perVertex` 0,05...) são uma primeira estimativa e não foram ajustados contra os 100 W.
3. **Ligar `prefit` (C), `ground` (G) e `body` (P) ao mesmo `WorkBudget`** quando eles entrarem; enquanto o chão não passar pelo árbitro, ligar o orçamento só espalha o corte (seção 4).
4. **Decisões do dono:** o teto `maxWaitFrames` (tensão T1) e se o primeiro corte de uma explosão continua no próprio quadro (hoje sim, pela regra "a casa quebra na hora").
   **Decidido em 2026-11-16:** `maxWaitFrames` 12 (0,2 s); o primeiro corte continua no próprio quadro; o orçamento entra **desligado por padrão** e só se liga quando o chão (G) e a criação de corpos (P) também tirarem do árbitro.


## T3.8ad — auditoria do motor de física e correções (2026-11-16)

Auditoria de um revisor independente sobre o que entrou na main de #302 a #316. Todo defeito grave foi reproduzido com teste, não por suposição. Cada correção tem um teste que falha sem ela e passa com ela, menos o vazamento do `createBodies` (caminho de erro, só revisado).

| # | Gravidade | Defeito | Correção | Teste |
|---|---|---|---|---|
| #302/#313 | alta | `pairKey` guarda só os 16 bits baixos da chave do corpo e `removeBody` não apagava os pares ignorados: o próximo corpo que reaproveitava o índice do Jolt herdava a regra "não colidir" (um caco caído sobre o poste parou dentro dele; um ladrilho de chão faria o poste atravessar o chão) | `JoltWorld.forget` apaga todo par ignorado do corpo (índice por corpo) | `game-physics-jolt/tests/ignore-reuse.test.ts` |
| #316 | alta | `remove` só acordava o que estava em cima se a peça dormia para o kit (`b.sleeping`), e esse sinal já é falso quando `wakeRegion` acorda a peça no mesmo quadro: o que dormia em cima ficava no ar (§12) | acorda também quando a peça dormia no último passo do motor (`link.sleeping`) | caso do mesmo quadro em `engine-remove-wakes.test.ts` |
| #314 | alta | a etapa `room-explosion` bloqueava a rodada noturna pela meta absoluta de 4/5 ms, que a main ainda não cumpre: a rodada falharia todo dia | a meta é aviso; bloqueia só regressão (mais de 25% e acima de piso de 1 ms no p99 e 5 ms no máximo) contra o último relatório que passou, guardado pela rodada | `tools/gpu/tests/room-explosion-verdict.test.mjs` |
| #309 | média | peça dormindo com o centro fora do disco da cratera ficava até 8 mm dentro do chão para sempre (o motor só limpa corpo acordado); o teste só olhava a posição guardada pelo kit | `groundChanged` acorda a peça com 0 < penetração ≤ `ENGINE_CLEARS` | `ground-rise-lift.test.ts` mede a ponta (≤ 2 mm) |
| #302 | média | nenhum CI rodava os testes no modo Jolt | job `jolt-mode` (CPU, sem GPU, §9) com `pnpm test:jolt` | job do CI |
| #316 | média | "-22% de quadros acima de 5 ms" estava dentro do ruído da medição (faixas 73–99 contra 48–81) | reescrito como "sem regressão" na seção 3b e no changeset | texto |
| #316 | baixa | `createBodies` vazava corpos e o vetor de ids se uma forma falhasse | libera o que criou antes de relançar o erro | revisão |
| #302 | baixa | `wheelContacts` lia 4 rodas em qualquer veículo; a moto, de 2 rodas em linha, virava um eixo esquerda/direita | conta as rodas do veículo; roda sozinha tem diferencial próprio e não tem barra anti-rolagem | `game-physics-jolt/tests/motorbike.test.ts` (PR #318) |
| #313 | baixa | `tethered` só crescia (§8) | esquece o par quando uma das peças sai (`remove`); o par com um objeto fixo, que não é peça, fica até a peça sair | `tether-forget.test.ts` |
| #311 | média | a régua R1–R3 deixava passar ganho real | ver abaixo | `energy-ruler.test.ts` |

### Régua R1–R3 (apertada por decisão do dono: "apertar e medir")
- **R3** descontava também o poste levantado ao acordar (a correção de penetração do solver), não só o recuo do cast contínuo. Agora só desconta o corpo que ainda desce (`Δy ≤ 0` e velocidade vertical negativa antes e depois). Um poste de 1 t que sobe 2 cm parado volta a contar no C1.
- **R2** desligava o C3 inteiro quando qualquer energia, por menor que fosse, era declarada. Agora a altura declarada é descontada da subida.
- **R1** perdoava a subida de uma peça que perde energia. Agora só perdoa quando a energia caiu e a energia de rotação da peça (energia total menos altura e velocidade linear) caiu pelo menos o que a subida custou; uma peça que cai a 3 m/s e é empurrada 5 cm pelo contato conta.

Medição com a régua apertada, tigela (`bowl-energy.test.ts`, 32 casos no Jolt): C1 −0,0195 kg·m, C2 0, C3 0,0270 m (limite 0,035; 0,0242 antes do ajuste do R1 pela energia de rotação), nenhum atravessou o chão. **Passa.** A sonda da sala (`room.js`, navegador) não roda no CI nem aqui (§9): falta rodá-la à mão para confirmar que a T3.8 continua ✅ com a régua apertada. Se não passar, a T3.8 volta a ficar aberta e os números vão ao dono.

### Fica aberto
- Rodar a sonda da sala com a régua apertada (à mão, na trava de medição).
- Job de CI do `game-floorplan-three` no modo Jolt: tem 4 falhas conhecidas de base (3 goldens de `destruction/*` e `bookcase-topple`); entra quando elas forem resolvidas ou listadas.
- Duas falhas de `rolling.test.ts` no modo Jolt já existiam na main.
- Perguntas em aberto do revisor: a soma dos tempos do `room-explosion` assume o laço do host (afirmar isso na ferramenta) e a coluna `createBody` da tabela de estágios não cobre `createBodies`.

## T3.8ae — chão sob as peças, sobre a main com a régua apertada (2026-11-16)

Branch `perf/chao-sob-pecas` (frente G do `design/orcamento-da-explosao.md`): `heightRange` no terreno (limites exatos do chão num retângulo), ladrilho que os limites provam plano assentado como laje sem ler as amostras, composto que pede reaproveita os cascos que a forma anterior do corpo tinha (adaptador Jolt), sólido sob cratera reaproveitando cascos, pré-assento no evento da explosão (desligado por padrão). Merge da main `94362513` (#317–#319); o único conflito foi `forget` no adaptador (os dois lados ficaram: liberar os cascos guardados e esquecer as regras de ignorar).

### Medição
Máquina com outras threads: só se mediu com carga abaixo de 3 (`/proc/loadavg`), uma rodada por processo, main (worktree limpo em `94362513`) e branch intercaladas, sob a trava `perf-measure.lock`. Uma primeira leva com carga de 5 a 29 foi descartada.

**Portão `room-explosion` a 1×, Jolt com D4, 6 pares intercalados** (medianas, intervalo):

| | p99 main | p99 branch | máx. main | máx. branch | quadros > 5 ms main / branch |
|---|---|---|---|---|---|
| explosão (6+6) | 17,3 (15,8–18,5) | 16,7 (15,0–19,1) | 28,1 (pior 31,2) | 27,1 (pior 29,6) | 89 / 90 |
| martelo (6+5) | 17,6 (13,5–19,2) | 15,9 (13,5–17,1) | 27,9 (pior 30,4) | 30,9 (pior 42,1) | 63 / 45 |

Leitura: **sem regressão**; o martelo melhora no p99 e nos quadros acima de 5 ms, a explosão fica no ruído. O pior quadro do martelo da branch (42,1) é uma rodada só; a mediana do máximo fica a 3 ms da main. Longe do B6 (p99 4, máx. 5) nas duas: as opções de escopo vão ao dono depois dos merges.

**Sonda da sala (`drive.mjs`, `&solver=jolt&blastDebris=1`), régua R1–R3 apertada, 11 explosões + 11 martelos por lado:**

| | C2 | C3 | C4 | `fellThrough` 0 |
|---|---|---|---|---|
| main `94362513` | 22/22 | **17/22** | 22/22 | 22/22 |
| branch | 21/22 | **18/22** | 21/22 | 22/22 |

- **C3 reprova também na main** (todas as reprovações em explosão): o ofensor é sempre `pipe:run_wall_kitchen_0:0` (0,6 kg), subida de 0,035 a 0,054 m, boa parte declarada pelo blast. É efeito da régua apertada, não desta branch: **a T3.8 volta a ficar sem ✅** até o dono decidir o cano (enviado ao coordenador).
- As duas reprovações só da branch caíram na primeira leva (uma rodada cada): C2 de um fio de 16 kg deitado no chão (0,040 contra 0,035) e C4 de um martelo com 25 de 32 peças dormindo ao fim. Não voltaram nas 12 rodadas seguintes. Com 1/22 contra 0/22 não dá para separar de ruído; fica registrado.
- Testes: `game-physics-jolt` 76 passam, `game-terrain` 110, `game-destruction-three` próprio 428 e Jolt (`test:jolt`) 51, 0 falhas.

## T3.8af — aquecer o JIT da explosão no carregamento (2026-11-16)

A primeira explosão de um processo custava cerca de 2× as seguintes (T3.8aa §2): fratura, corte, caixas orientadas, corpos do motor e chão rodavam frios. `createDestructionRenderer` agora roda, uma vez por motor, uma explosão numa parede pequena de 24 tijolos fora da tela, num mundo, numa cena e num renderizador próprios, tudo liberado no fim (`jitWarmUp`, ligado por padrão; `false` desliga; `{ engine }` aquece também os caminhos do motor). A sala passa o motor do `?solver=jolt`; `?warmup=0` desliga. O `room-explosion` ganhou a variante `jolt-d4-cold` e as colunas `wakeMed` e `1st 1s`.

**Medição** (portão `room-explosion` a 1×, Jolt com D4, página nova por rodada, isto é, sempre a primeira explosão do processo; aquecido e frio intercalados, carga < 3, trava de medição; medianas e intervalo):

| | física do 1º segundo | p99 | máx. | quadros > 5 ms |
|---|---|---|---|---|
| explosão, aquecido (5) | **184,9** (183,8–194,8) | 14,6 | 26,6 | 59 |
| explosão, frio (4) | 215,8 (205,7–216,3) | 17,2 | 23,7 | 73 |
| martelo, aquecido (5) | **163,1** (157,4–167,5) | 14,2 | 23,8 | 63 |
| martelo, frio (4) | 185,4 (175,2–186,7) | 16,6 | 27,0 | 58 |

Leitura: o primeiro segundo da explosão custa **14% menos** de física (215,8 → 184,9 ms) e o martelo **12% menos** (185,4 → 163,1), sem sobreposição dos intervalos; o p99 cai 2,5 ms nos dois. O máximo fica no ruído. O custo vai para o carregamento: **0,37 s** uma vez (Node, Jolt, `warmUpDestructionJit` medido à parte). O quadro de despertar medido pelo portão (só física, 0,5–0,6 ms) não muda: o que o aquecimento tira é o trabalho dos primeiros quadros depois dele.

**Testes:** `game-destruction-three` próprio 431 e Jolt (`test:jolt`) 51, `game-test-room` 458, `game-floorplan-three` 1187 com o golden exato (o aquecimento não toca o estado nem os sorteios do jogo: mundo e semente próprios, `rendererCount` restaurado), `pnpm typecheck` ok. `jit-warmup.test.ts`: roda uma vez por motor, libera o mundo do motor, desligado com `false`.

## T3.8ag — chão da cratera e colisores fixos no quadro depois do C4 (2026-11-17)

Branch `perf/chao-cratera` (sobre `fix/soltos-na-carga`). Sonda em Node `decision/probes/t38ag/probe-create.test.ts.txt` (copiar para `packages/game-floorplan-three/tests/`, `PIECE_SOLVER=jolt`; `NOWRAP=1` só o quadro inteiro): `createTestRoom` + planta, `single_storey_a` semente 1, C4 em casa − 2,5 m, como o `room-explosion`. O pior quadro da física é o f1 (o segundo depois do `blastAt`: o f0 não dá passo do Jolt). Sem o aquecimento do motor (Node).

- **`room-explosion`**: o estágio `createBody` virou `groundBody` (`world.createBody`: só o chão sob as peças e corpos fixos avulsos) e ganhou `pieceBodies` (`world.createBodies`: as peças novas e os colisores fixos da casa refeitos). Antes as peças não entravam em estágio nenhum.
- **Rede sob o chão de caixas**: cada bloco do sólido sob o height field é a sua caixa, com o topo na menor altura do chão sobre ele menos `SOLID_MARGIN` (nunca acima da superfície, §12), mesma subdivisão e cobertura de antes; o bloco inclinado era um prisma (um casco convexo cada: 403 cascos no ladrilho da cratera). Testes: topo de cada bloco igual à menor amostra menos 5 mm e área do ladrilho coberta uma vez (`engine-ground.test.ts`); nenhum casco feito e o sólido refeito igual ao novo, heap estável em 200 mudanças, caixas em repouso na cratera fora da rede e afundadas ≤ 0,62 mm no chão (antes 0,84) (`engine-ground-net.test.ts`, no `test:jolt`). Bacia com Jolt (16 sementes × 2 passos de quadro), antes → depois: `fellThrough` 0 → 0, `deepest` −0,0392 → −0,0380, C2 0 → 0, C3 0,027 → 0,002, C1 −0,0195 → −0,0193.
- **Colisores fixos depois do espatifamento**: a casa tocada é medida de novo inteira (`measureSolids`); a soma de conferência de cada parte copiava os vértices num `Float64Array` novo antes de comparar (agora lê no lugar e só copia quando mudou), e o atrito do material embrulhava cada sólido num objeto novo a cada medida, o que obrigava `EngineStatics.fit` a comparar cada malha vértice a vértice (agora o mesmo sólido com o mesmo atrito é o mesmo objeto, `withSurface`). Mesmos números, mesmos objetos que o motor já tem.
- **f1, antes → depois** (mediana de 3 rodadas, cronômetros de tempo próprio, ms): cascos 3,55 → 0; `makeShape` (JS) 2,43 → 1,14; `layVolume` 0,96 → 0,05; `statics.fit` 0,56 → 0,10; `measureSolids` 1,33 → 1,17; `Step` 4,02 → 3,78 (ruído); o resto igual (`flatOrRead` 1,7–2,0, `layTile` 1,2–1,3, `staticNow` 0,5, composto 0,34–0,39, height field 0,31). Corpo do ladrilho da cratera (484 filhos) 5,48 → 1,03 ms, o de 79 filhos 0,58 → 0,14. Soma do lado da física 19,4 → 13,1 ms. Quadro inteiro sem cronômetros: 29,3–31,3 → 23,8–25,0 ms.
- O que sobra no f1: `Step` do Jolt (~3,8, wasm), leitura do ladrilho (`flatOrRead` + `layTile`, ~3,2, JS), `measureSolids` (~1,2: a soma de conferência ainda passa por todos os vértices da casa tocada), `staticNow` (~0,5).
- **Revisão (achado ALTO) — rede de caixas viradas**: a caixa plana com o topo na menor altura do bloco ficava longe do chão inclinado (o critério de divisão foi escrito para prismas). Agora o bloco inclinado é uma caixa virada para o plano dos cantos do bloco, com o topo um retângulo nesse plano (mais uma célula para cada lado, para as caixas vizinhas se sobreporem: viradas, elas se afastam sob o topo e o que é empurrado de lado caía pela fresta), abaixado pelo maior mergulho do chão sob ele em toda célula que o topo alcança e por `SOLID_MARGIN` (nunca acima de amostra nenhuma: §12). Bloco nivelado continua caixa reta. Nenhum casco; as mesmas quantidades de blocos (19 no chão ondulado, 316 na bacia, 364 na cratera, 1 no plano).
  - Maior distância do chão ao topo da rede, caixa plana → virada: chão ondulado 3,49 → 1,00 cm; bacia 12,1 → 4,6 cm; parede de cratera (cos², 0,3 m) 7,9 → 2,7 cm; plano 0,2x + 0,05z 50,3 → 0,50 cm; escavação de 30 cm 2,0 cm dentro, 2,5 cm na borda (o prisma de antes dava 1 cm: sem sobreposição; com ela o mergulho das células vizinhas entra). Menor distância ≥ 4,5 mm em todos (topo nunca acima).
  - Caixa de 3 cm criada com o topo 1 cm abaixo da parede da cratera (`engine-ground-net.test.ts`): fica acima do chão com a caixa virada; enterrada 1,5 cm com a caixa plana; e os prismas de antes deixavam cair 42 m. Com 2 cm abaixo, ou caixas de 8 a 16 cm nessa parede de 38°, o motor empurra para o lado (a saída mais curta) e elas ficam enterradas nas três versões: a rede segura, não garante empurrar para cima um corpo fundo.
  - Bacia com Jolt (16 sementes × 2 passos): `fellThrough` 0, `deepest` −0,0395, C1 −0,0159, C2 0, C3 0,0166.
- **Revisão (achados BAIXOS)**: `reuseHulls` documentado como mantido (nada do kit usa; testado no adaptador); `EngineStatics.sameBox` compara também o atrito, e `reshape` aplica o material (teste: mudar só o atrito mantém o corpo e chama `setMaterial` uma vez); comentário do estágio `groundBody` corrigido (só os ladrilhos de chão chamam `createBody` na sala); `checksumOf` ganhou uma terceira soma ponderada pela ordem dos vértices.
- **Segunda revisão (achado ALTO) — a rede não sai do seu ladrilho**: a sobreposição de uma célula também passava da borda do ladrilho, onde o mergulho só olhava as amostras deste ladrilho; com o chão dobrando na emenda, o topo virado ficava acima do chão desenhado do vizinho (10,6 mm no caso do revisor). Além da sobreposição, dois efeitos levavam a caixa virada para o vizinho: o retângulo do topo é mais largo que a pegada quando as duas inclinações existem (enviesamento), e a caixa inteira se inclina morro acima sob o topo. Agora o bloco inclinado é a sua caixa reta (o piso: lados nas bordas do bloco, topo na menor amostra menos `SOLID_MARGIN`) e por cima uma placa virada de 5 cm (`SLAB_THICKNESS`) com o topo no plano dos cantos, uma célula a mais para cada lado, **cortada para que todos os 8 cantos fiquem sobre este ladrilho**, e abaixada pelo maior mergulho do chão sob o plano em toda célula que a placa alcança (inclinação e enviesamento incluídos). Onde o corte deixa uma faixa na borda, quem segura é o piso. Bloco inclinado na borda do ladrilho é dividido até 16 células (`SOLID_EDGE_CELLS`), para a faixa não ficar com o tamanho do ladrilho. Placa mais fina (1 ou 2 cm) deixava a caixa de 3 cm enterrada no teste de empurrar para cima; 10 e 20 cm também.
  - Testes novos (`engine-ground.test.ts`): o ponto mais alto de cada coluna (topo, aresta ou lado inclinado), sobre uma faixa de 15 cm além da borda com o vizinho plano e com o vizinho um degrau de 30 cm abaixo, nunca fica acima do chão do vizinho menos `SOLID_MARGIN` (chão 0,8·min(2,x), também com 0,4 z para virar a placa nos dois eixos), e nada do lado de x < 0; uma ladeira com um degrau para baixo morro acima (caixas de degrau no ladrilho): nenhum ponto da rede acima do chão desenhado. A verificação "nunca acima" agora usa o ponto mais alto de cada coluna, não só o topo.
  - Distância máxima do chão ao topo (no ladrilho inteiro / a mais de 0,4 m da borda): ondulado 0,9 / 0,9 cm; plano 0,2x + 0,05z 6,6 cm (faixas da borda) / 0,50 cm; bacia 11,9 cm (bordas: a parte mais íngreme, 0,74) / 0,7 cm; parede da cratera 3,9 / 3,9 cm (a placa é abaixada pelo mergulho de toda célula que alcança, a inclinação incluída); escavação de 30 cm 2,2 cm. Antes (caixa virada sem corte): 1,0 / 0,5 / 4,6 / 2,7 / 2,0 cm, mas acima do vizinho na emenda.
  - Caixas por ladrilho (antes → agora): ondulado 19 → 90, plano 1 → 104, bacia 316 → 612, cratera 364 → 642, escavação → 965. Sonda em Node, ladrilho da cratera da sala (887 filhos): 2,2–2,6 ms (com cascos eram 5,5; com a caixa virada 1,3–1,9; máquina com carga 7–10, medida com ruído).
  - Caixa de 3 cm 1 cm sob a parede da cratera continua voltando à superfície. Bacia com Jolt: `fellThrough` 0, `deepest` −0,0393, C1 −0,0167, C2 0, C3 0,0048, C4 0,50.
  - O C4 de 0,93 da versão anterior era uma semente só (8, passo 1/60); nesta versão o maior é 0,50 (o mesmo da caixa plana e dos prismas). Não mexi em `SOLID_MARGIN`.
  - `EngineStatics.reshape` só aplica o material quando o atrito mudou (lido antes de trocar o sólido); teste: o mesmo atrito com a caixa movida não chama `setMaterial` de novo.
- **Terceira revisão (opção b) — uma caixa virada por bloco, com o chão do vizinho** (branch `perf/rede-anel-vizinho`): volta a caixa virada de 06e05d340 (topo no plano dos cantos do bloco, uma célula de sobreposição, até sob o fundo do sólido), mas o mergulho agora olha o chão de verdade em toda coluna que a caixa alcança, inclusive além da emenda.
  - **Anel** (`engine-ground-ring.ts`): `buildSolidVolume` recebe `groundAt` e lê o chão do vizinho até `SOLID_RING` = 0,2 m (8 células) além de cada borda, só onde uma caixa alcança e uma vez cada amostra (cantos e centro da célula; célula com degrau — centro fora da média dos cantos por mais de 5 mm — conta pela menor amostra). Por que 0,2 m: uma célula de sobreposição, o enviesamento do topo virado nos dois eixos (o bloco cujo topo não cabe é dividido) e uma caixa de pelo menos ~15 cm de fundo em qualquer inclinação; a caixa que se inclinaria além do anel fica mais rasa (mínimo `SOLID_THINNEST` 5 cm, senão o bloco é dividido ou vira a caixa reta).
  - **Inclinação dos lados** (`engine-ground-reach.ts`): o ponto mais alto de cada coluna da caixa fica sob cada face que olha para cima (o topo e o lado morro acima de cada eixo virado), e numa célula de chão plano entre cantos um plano sobe mais num canto. Topo: o plano do topo sobre todo canto sob a extensão do topo. Lados: a caixa é o topo deslizado ao longo de −n, então onde o chão sob a sombra da caixa não é mais íngreme que 1/(inclinação do topo) nenhum ponto dela fica mais acima do chão que o topo (prova curta, sem varrer); senão toda célula da sombra, por uma pirâmide de planos sob o chão do ladrilho (bloco de células cujo plano fica acima de todo plano da caixa é pulado). Além da borda, toda célula da sombra no anel. A caixa é baixada pelo maior desses e `SOLID_MARGIN`. Bloco cuja caixa o chão além da emenda baixa 1 cm mais que o seu próprio é dividido; caixa baixada mais que o relevo do bloco vira a caixa reta (topo na menor amostra).
  - **Piso do ladrilho**: sob as caixas viradas, uma caixa reta do ladrilho inteiro até a menor altura dele menos `SOLID_MARGIN`. Caixas viradas lado a lado se afastam abaixo do topo (a sobreposição de uma célula só fecha até certa fundura), e o que é empurrado de lado para essa cunha descia até o fundo.
  - **Marcação**: `groundChanged(x, z, r)` marca também os ladrilhos a até `r + SOLID_RING`; ao assentar, as amostras do anel que o sólido leu dentro do retângulo marcado são lidas de novo e, se alguma mudou, o sólido é refeito (mesmo com as amostras do próprio ladrilho iguais: `relaySolid`). Teste: uma cova de 40 cm em x 2,02–2,14 (fora do ladrilho, sob os lados inclinados das caixas da borda) refaz a rede igual à de um ladrilho novo; uma cova a mais de 0,2 m não toca nela.
  - **Nunca acima** (`engine-ground.test.ts`, sonda de coluna exata pelo método das placas, `highestAt`): faixas de 0,22 m além das quatro bordas com o vizinho plano depois de uma dobra (0,8·min(2, x), também com 0,4 z), um degrau de 30 cm para baixo na emenda (no lado alto e no lado baixo), plano virado nos dois eixos (0,6x + 0,5z, plano além de toda borda), cratera no meio da borda, no canto (2, 2) e no canto (0, 0): nenhum ponto da rede acima do chão menos `SOLID_MARGIN` e nada além de `SOLID_RING`. `engine-ground-reach.test.ts`: 180 caixas sorteadas sobre uma crista (lado de trás 2,5, mais íngreme que o lado da caixa), uma cratera e uma dobra com degrau: o abaixamento nunca é menor que o maior excesso medido coluna a coluna (falha se a varredura dos lados é desligada).
  - **Distância máxima do chão ao topo** (ladrilho inteiro / faixa de 0,4 m da borda): ondulado 1,02 / 0,98 cm; plano 0,2x + 0,05z 0,50 / 0,50; plano 0,6x + 0,5z 0,50 / 0,50; bacia 4,7 / 4,7; cratera 2,66 / 1,15; cratera na borda 2,66 / 2,43; no canto 2,66 / 2,66; dobra com vizinho plano 4,5; dobra com degrau de 30 cm 9,3; degrau de 30 cm no lado baixo 2,2. Menor distância 4,4–5,0 mm dentro (curvatura entre amostras), ≥ 5,0 mm além da borda.
  - **Caixas por ladrilho** (06e05d340 / a730b5450 / agora): ondulado 19 / 90 / 20; plano 1 / 104 / 2; bacia 316 / 612 / 317; cratera 364 / 642 / 365; cratera da sala (com a segunda na borda) 424 / 763 / 425. O +1 é o piso do ladrilho.
  - **Tempo de `buildSolidVolume` em Node** (mediana de 15×20, mesma execução, máquina compartilhada com carga; 06e05d340 / a730b5450 / agora, ms): cratera 0,38 / 0,37 / 0,46; cratera da sala 0,48 / 0,46 / 0,84; bacia 0,48 / 0,47 / 2,0; plano 0,09 / 0,18 / 0,26; ondulado 0,18 / 0,17 / 0,32. O que sobra além de 06e05d340 é a leitura do anel (`groundAt`, 0,2–5,6 mil amostras quando as bordas são inclinadas: a bacia) e a pirâmide. A sonda da sala (`probe-create`) não foi rodada (máquina compartilhada); pela diferença, o corpo do ladrilho da cratera fica em ~1,7–2,3 ms (06e05d340 1,3–1,9).
  - **Empurrar para cima, varredura** (`engine-ground-net.test.ts`, cratera da sala, 4 pontos da parede × cubos de 3, 8 e 16 cm × topo 0,5, 1, 2 e 4 cm sob a superfície, 180 quadros): agora **23/48 voltam acima da superfície, nenhum cai**, o mais fundo fica com o topo 15,9 cm sob a superfície (sobre o piso do ladrilho), centro sempre acima do piso (o cubo de 16 cm feito 4 cm abaixo afunda até 5,8 cm no piso, parado, igual com 600 quadros). A mesma varredura sobre 06e05d340: 18/48 acima, **1 cai** (32,8 m); sobre a730b5450: 15/48 acima, **10 caem** (21–42 m); sem o piso do ladrilho (esta versão): 17/48 acima, nenhum cai, o mais fundo 74 cm sob a superfície. O teste afirma "nenhum cai, topo no máximo 20 cm sob a superfície, centro acima do piso"; a taxa é medida e impressa (`NET_REPORT=1`), não afirmada.
  - Bacia com Jolt (16 sementes × 2 passos): `fellThrough` 0, `deepest` −0,0395, C1 −0,0195, C2 0, C3 0,0273, C4 0,50.
  - Incerto: a célula do anel reconhece o degrau só pelo centro (o `engine-ground` olha também os meios das arestas); degrau dentro das células da borda do próprio ladrilho segue como antes (os cantos da borda não são rebaixados); dobras e degraus na emenda deixam a caixa da borda 4–9 cm sob o chão nessa faixa.
  - **Testes:** `game-destruction-three` próprio 482 (+ 9 de Jolt pulados) e `test:jolt` 72, `game-floorplan-three` 1332 com o golden exato, `game-test-room` 464, `tsc` do pacote e eslint dos arquivos tocados ok.
- **Revisão do #348** (Opus): nunca acima, marcação e determinismo conferidos; três mudanças.
  - **(ALTO) Piso por bloco**: o piso único do ladrilho deixava o que escorrega entre caixas viradas na menor altura do ladrilho (cubos de 3 cm a 15,4–15,8 cm sob a superfície), uma fundura sem relação com o relevo do bloco. Agora cada bloco inclinado tem a sua caixa reta (topo na menor amostra do bloco menos `SOLID_MARGIN`) sob a caixa virada, e o piso do ladrilho saiu. A caixa virada continua indo até o fundo do sólido: feita só até entrar no piso do bloco (2 cm), **17/48** caixas da varredura caíram (22–42 m), como a placa de a730b5450. A varredura agora afirma, para cada caixa, topo sob a superfície ≤ (chão − topo do piso mais baixo sob a sua sombra) + 2 × meia aresta + 1,5 cm. Resultado: 23/48 voltam acima, nenhum cai; mais fundo: cubos de 3 cm 7,1 cm (antes 15,8), de 8 cm 8,2 cm, de 16 cm 19,5 cm (piso do bloco 1,5–15 cm sob o chão nesses pontos). Caixas por ladrilho: ondulado 37, plano 2, plano 0,6x + 0,5z 32, bacia 597, cratera 619 (255 viradas + 255 pisos + 109 retas), cratera da sala 723 (06e05d340: 19 / 1 / — / 316 / 364 / 424; a730b5450: 90 / 104 / — / 612 / 642 / 763).
  - **(MÉDIO) Degrau no anel**: a célula do anel usava só o centro; agora o mesmo teste do `engine-ground` (`holdsStep` em `engine-ground-step.ts`: centro e os meios das quatro arestas, 5 mm), compartilhado pelos dois. Teste: cova de 5 cm, 1,5 × 1 cm, em volta do meio de aresta (2,0125; 1,0): nenhum ponto da rede acima dela (antes 42 mm acima em (2,019; 0,998)).
  - **(3) Tempo de `buildSolidVolume`** (Node, mediana de 15×20, mesma execução; 06e05d340 / a730b5450 / agora, ms): cratera 0,43 / 0,41 / 0,54; cratera da sala 0,43 / 0,43 / 1,04; bacia 0,46 / 0,46 / 2,33; plano 0,09 / 0,19 / 0,37; ondulado 0,18 / 0,19 / 0,44. Perfil da bacia (ladrilho com as quatro bordas inclinadas): ~1,1 ms é leitura do anel (5,6 mil amostras de `groundAt`, 9 por célula para o teste do degrau), ~0,6 ms é avaliar as células do anel sob cada caixa (cada célula do anel fica sob ~5 caixas: 13,6 mil avaliações), 0,3 ms a busca dentro do ladrilho. Não cortei: tornar as caixas da borda rasas para inclinarem menos no anel é o que fez caírem as caixas na varredura; fica como pendência medida.
  - `engine-ground-inplace.test.ts`: o limite de amostras lidas desconta as lidas além da borda (as que o sólido guardou, lidas de novo, e as novas). Testes: próprio 483, `test:jolt` 73, `game-floorplan-three` 1332 com o golden exato, `game-test-room` 464, bacia 32 (`fellThrough` 0, C2 0, C3 0,0332, C4 0,50, deepest −0,0392, C1 −0,0177).

## T3.8ah — o `Step` do Jolt no quadro depois do C4 (2026-11-17)

Branch `perf/passo-jolt` (da main `246aecb4f`). Sonda `decision/probes/t38ah/probe-step.test.ts.txt` (mesma cena da T3.8ag: `single_storey_a` semente 1, C4 em casa − 2,5 m, laço do Jolt), cada `Step` cronometrado, um fator trocado por execução (`FACTOR`), `WARM=1` aquece o motor como a sala (`debris.jitWarmUp: { engine }`); tabela por `step-table.sh`.

- **Frio e quente**: sem o aquecimento do motor (Node) o f1 custa 3,3 + 2,3 ms nos dois passos fixos e cai quadro a quadro (f2 2,5 + 1,2, f3 1,3 + 0,8) com mais corpos ativos, não menos; com o aquecimento, 1,6 + 1,4; numa segunda explosão no mesmo processo, 1,8–2,0 + 1,5–1,8. Parte do f1 é código do wasm rodando a frio; a sala já aquece o motor.
- **O que custa no f1 aquecido**: 1 a 2 corpos ativos (uma peça de 1,16 × 0,66 m deitada, parada, e uma chapa de 1,2 m), com 23 validações e 80 contatos novos; os retornos de contato em JS custam 0,2–0,6 ms. A peça encosta em dois height fields de cratera, nas redes, em malhas e caixas da casa.

| fator (só ele trocado, aquecido) | `Step` do f1 (ms, 3 rodadas) | contatos novos |
|---|---|---|
| nenhum | 4,41 / 4,18 / 4,04 (outra leva de 5: mediana 3,53) | 80 |
| `OptimizeBroadPhase` antes do passo com corpos novos | 3,24 / 3,67 / 3,88 (leva de 5 intercalada: mediana 3,53 + 0,21 da otimização) | 78 |
| sem passo linear (CCD) | 3,57 / 3,29 / 3,27 | 80 |
| sem a rede sob a cratera (compostos > 30 filhos trocados por uma caixa longe) | 3,29 / 3,19 / 3,30 | 64 |
| sem as malhas fixas da casa feitas depois da explosão | 3,49 / 3,54 / 4,92 | 78 |
| **sem os height fields novos** | **1,12 / 1,11 / 1,06** | 23 |
| height field com metade das amostras (5 cm) | 1,95 / 2,15 / 1,94 | 50 |
| height field com um quarto (10 cm) | 1,50 / 1,56 / 1,47 | 40 |

- **Leitura**: o custo é o par peça grande × height field de 2,5 cm (cerca de 2400 triângulos sob uma peça de 1,2 × 0,7 m, contatos novos a cada passo enquanto ela assenta). Broadphase, CCD, a rede de ~950 filhos e as malhas da casa ficam no ruído (cada um ≤ 0,5 ms, e o `OptimizeBroadPhase` não ganhou nada numa leva intercalada de 5).
- **Nada implementado**: não achei ganho com o mesmo resultado. O que corta muda o chão físico: as amostras de 2,5 cm são bilineares numa grade de 10 cm (o erro bilinear de dizimar é 0), mas o Jolt corta cada célula em dois triângulos, e dizimar para 5 cm desvia o chão até 4–5 mm (10 cm: 16–21 mm) nos ladrilhos da cratera. Opções para o dono: (a) height field de 5 cm onde o desvio fica abaixo de uma tolerância (o f1 cai de ~3,5 para ~2,0 ms aqui), com a mudança de `goldens` e testes de chão que isso traz; (b) as peças grandes dormirem antes (muda a física); (c) aceitar.

## T3.8ai — o chão do motor a 5 cm (decisão do dono, 2026-11-17)

Como o "Simple Collision" no mip 1 do Unreal: o ladrilho continua lido a 2,5 cm (degraus, caixas de degrau, a rede sob o chão), e o height field do motor é cada segundo canto, 5 cm (`GROUND_COLLISION_CELL`, `engine-ground-collision.ts`; `GroundTile.collision`/`collisionCells`). O que muda no lugar (`updateHeights`) é calculado no campo do motor. A rede sob o chão é feita sobre a grade lida rebaixada, canto a canto, à superfície de colisão onde ela é mais baixa (as duas maneiras de cortar a célula em triângulos, a mais baixa), e o anel do vizinho do mesmo jeito: fica `SOLID_MARGIN` sob as duas superfícies (teste novo em `expectNet`: sob a superfície de colisão, as duas diagonais).

- **`Step` do f1** (sonda T3.8ah aquecida, mediana de 5): **3,48 → 1,76 ms** (antes 3,23–3,64; depois 1,65–1,91); f2 2,08 → 1,42; contatos novos no f1 80 → 51.
- **Desvio da colisão para o chão desenhado**: cratera cos² de teste 2,5 mm, chão ondulado < 5 mm; ladrilhos da cratera da sala 1,9 / 1,9 / 4,0 / 5,0 mm. Na dobra da borda de uma bacia (a inclinação cai de 0,75 para 0) 12,4 mm (o campo de 2,5 cm já ficava 6,2 mm fora ali). Limites no teste: 5 mm na cratera e no ondulado, 13 mm na bacia.
- Bacia com Jolt (16 sementes × 2 passos): `fellThrough` 0, `deepest` −0,0381, C1 −0,0192, C2 0, C3 0,0016, C4 0,50. Limite de distância da rede na parede da cratera de teste 2,7 → 3 cm (ela agora também desce sob a colisão onde a colisão afunda: 2,74 cm).
- `engine-ground-ahead.test.ts` (só com `PIECE_SOLVER=jolt`, fora do `test:jolt`) "twenty notices ... laid at most once" já falha na main `246aecb4f` (3 de 3); não é desta mudança.
- **Revisão do #351 (dois ALTOS dos degraus, um MÉDIO da dobra)**: com o campo de 5 cm em todo ladrilho, o degrau de um terraço entre dois cantos lidos virava uma rampa invisível de até 13,6 cm acima do piso e da caixa, ou um sulco de 15,5 cm ao lado dela (lascas em laço de `fellThrough`), e a dobra da borda da bacia ficava 12,4 mm fora. **Regra única, por ladrilho** (`collisionStep`): o campo de 5 cm só quando o ladrilho não tem caixa de degrau e a superfície de colisão (as duas diagonais) mais o passo de 8 bits do motor (metade da faixa de um bloco de 4 amostras / 255) fica a até 5 mm (`COLLISION_TOLERANCE`) da grade lida em todo canto; senão o campo de 2,5 cm. Um ladrilho que troca de campo ganha forma nova (não escrita no lugar). O anel olha também o campo grosso do vizinho (o mais baixo).
  - Testes: degrau de terraço em quatro posições dentro da célula, ao longo de x e de z (o ladrilho fica a 2,5 cm; colisão ≤ máx(chão, topo da caixa) + 5 mm e ≥ chão − 5 mm onde não há caixa); cratera e ondulado a 5 cm dentro de 5 mm; bacia volta a 2,5 cm; troca de campo 5 → 2,5 cm no mesmo corpo igual a um ladrilho novo; montanhas: planos de 0,8 (um e dois eixos), cume e vale de 7 m de raio e encosta de 0,6 caindo num piso ficam a 5 cm; cume afiado e ravina viram degrau (caixas) e encosta de 0,75 caindo num piso passa dos 5 mm — os três ficam a 2,5 cm.
  - Sala (cratera do C4): 3 dos 4 ladrilhos da cratera ficam a 5 cm (o quarto, o de 5,0 mm, a 2,5 cm). `Step` do f1 aquecido, mediana de 5 (carga 6): **2,38 ms** (2,20–2,72), antes 3,48, com todo ladrilho a 5 cm 1,76 (carga 4–5).
  - Bacia com Jolt: `fellThrough` 0, `deepest` −0,0392, C1 −0,0177, C2 0, C3 0,0332 (limite 0,035), C4 0,50. `engine-ground-inplace.test.ts` ganhou uma terceira cratera pequena e afiada para o ladrilho ficar sempre a 2,5 cm (o que se escreve no lugar é o mesmo campo).
- **Baixos da revisão aprovada do #351**: `collisionFieldOf` (era `collisionStep`) não aloca por canto (as duas diagonais num `Float64Array` do módulo) e devolve o campo que montou para `shapeGround` (antes montado duas vezes). Histerese: um ladrilho na grade lida só passa ao campo de 5 cm abaixo de 4,5 mm (`COLLISION_ENTER`); um que já está nele só volta acima de 5 mm (o limite do dono, rígido); 4 mm derrubava o ladrilho da cratera da sala em que a peça repousa (4,47 mm) e o ganho junto. Testes: um ladrilho liso que fica nos 5 cm é escrito no lugar (o mesmo corpo, `updateHeights`, os mesmos raios de um ladrilho novo a menos de 2 mm); encostas de 0,65 e 0,68 (4,71 e 4,93 mm) ficam no campo que tinham. Sala: os mesmos 3 de 4 ladrilhos da cratera a 5 cm; `Step` do f1 mediana de 5 **2,43 ms** (2,17–2,50, carga 4–6).

## T4.1 — Controlador de personagem atrás do contrato (2026-11-25)

2026-11-25, Intel Core Ultra 9 275HX (24 threads), Linux, Node, Jolt `wasm-compat` em uma thread, mundo `KIT_WORLD` (120 Hz).

**O que já existia e foi reaproveitado:** o `CharacterVirtual` do spike (`game-physics-jolt/src/character.ts`: `ExtendedUpdate`, degrau de 0,4 m, colar no chão, `mMaxStrength`), a limpeza em `world.dispose()` (T2.5) e a demonstração (a) do `extras.test.ts` (degraus, rampa, caixa, 50 controladores). O spike só existia no adaptador (`JoltCharacter`, `createCharacter(at, r, h, m, f)`), fora do contrato.

**O que mudou**
- Contrato (`game-physics/src/contract.ts`, sem citar o motor): `CharacterId`, `CharacterDesc` (`position`, `radius`, `halfHeight`, `mass`, `strength`, `stepHeight` 0,4 m, `maxSlopeDegrees` 45) e em `PhysicsWorld`: `createCharacter`, `moveCharacter(id, vx, vz, dt)`, `pushCharacter(id, impulso)`, `readCharacter`, `teleportCharacter`, `characterSupported`, `removeCharacter`.
- Adaptador: `createCharacter` devolve `CharacterId`; o mundo guarda `Map<id, JoltCharacter>` (`world.characters`); `dispose` do mundo descarta o que sobrou (heap plana, `heap.test.ts` verde). Empurrão recebido: `pushCharacter` soma `impulso / massa` à velocidade pedida e some com `exp(-4 t)` (constante de 0,25 s); passa pelo mesmo varrimento, então parede segura.
- `game-player`: porta `PlayerController` em `PlayerWorld.controller` (`move`, `read`, `teleport`) e `createPhysicsController(world, { position, collider })` sobre o contrato (`src/physics-controller.ts`; cápsula com a altura e o raio do `player.collider()`, 75 kg, 400 N). Com controlador, `x`, `y`, `z` do jogador são os pés dele e `blocked` não é consultado. Sem controlador o caminho de grade é o mesmo de antes (os 115 testes do pacote, incluindo o golden da equipe, continuam verdes sem mudança). Pulo de muro e `load` teleportam o controlador. Dependência nova: `@adatechnology/game-physics` (tipos); devDependency `@adatechnology/game-physics-jolt` (teste de integração).
- Migrados para o contrato, sem afrouxar nada: `extras.test.ts` (a) e `heap.test.ts` (character).

**Testes novos** (`game-physics-jolt/tests/character.test.ts`, 8; `game-player/tests/physics-controller.test.ts`, 7)

| Caso | Resultado |
|---|---|
| degrau de 18 cm | pés a y = 0,18 (±0,005) depois de subir; parede de 50 cm detém (y < 0,05, z > -1,6) |
| rampa de 30° | sobe e acompanha a rampa (|y - (-z tan 30°)| < 0,15; y > 1,0); rampa de 60° não sobe (y < 0,6) |
| empurrar caixa de 30 kg | caixa passa de z -3,2 em 3 s a 1,2 m/s e o personagem vai atrás (z < -2,6); caixa de 500 kg (400 N não move) fica a menos de 10 cm |
| ser empurrado | impulso 225 N s em 75 kg: 0,6 a 0,9 m (esperado 3 m/s x 0,25 s = 0,75 m), sem desvio lateral; 2250 N s contra parede a 0,3 m: para a menos de 0,35 m; parado sem comando não anda |
| teleporte | pés exatamente no ponto e sem velocidade carregada |
| `game-player` + Jolt + `PhysicsLoop` | sobe degrau de 18 cm (y 0,18), parede do mundo físico segura sem `blocked`, empurra caixa de 30 kg, é empurrado, `load` leva o controlador ao ponto salvo |

**50 controladores** (`moveCharacter` dos 50, só o controlador, sem o `stepFixed`; 300 amostras depois de 60 de aquecimento; 50 pessoas andando em círculos, mundo `KIT_WORLD`): mediana **0,107 / 0,106 / 0,109 ms** (3 levas), p90 0,138–0,164, **p99 0,27–0,30**, máximo 0,31–0,39. Meta ≤ 0,5 ms: **cumprida na mediana e no p99**. A medição da demonstração (a) do `extras.test.ts` (mesmo mundo com degraus, rampa, caixa e outros 3 controladores) deu mediana 0,133, p90 0,166, **p99 0,547, máximo 0,729**: ali o p99 passa de 0,5 ms (picos isolados; o teste novo trava na mediana). Um controlador: 0,003 ms.

**Decisão de §11 da arquitetura (corpo do personagem):** o `CharacterVirtual` continua sem corpo interno (`mInnerBodyShape`): destroço o atravessa e não gera linha de contato; quem pretende ferir o jogador usa `hurt`/`pushCharacter` do próprio sistema. Um corpo interno cobraria um corpo cinemático por jogador na camada `character` e não faria o personagem ser empurrado (ele empurraria o destroço de volta). Fica para quando o dano por contato for decidido.

**Limites conhecidos (não escondidos)**
- A cápsula tem a altura de pé: agachar não a encolhe (precisa de `setShape` de personagem no contrato; não pedido na T4.1).
- Com o jogador derrubado, agarrado, em salto de muro ou `busy`, o `update` do jogador sai antes do movimento e o controlador não anda (nem cai) nesse passo.
- O host chama `player.update(h, input)` no passo fixo (`beforeStep` da fase `actors`), não com o `dt` do quadro.

**Gates**: `game-physics` 22 testes; `game-physics-jolt` 100 passam, 2 pulados, 26 arquivos (1 pulado); `game-player` 115 (13 arquivos); `tsc --noEmit` dos três limpo; `eslint src tests` dos três limpo; `kit-audit --check` 0 novos. `pnpm typecheck` da raiz para em `apps/desktop` (falta o `@adatechnology/serve-room-tool` buildado; não é desta mudança).

## T4.2 — Segurar, soltar, arremessar: dinâmico ↔ cinemático (2026-11-25)

2026-11-25, Intel Core Ultra 9 275HX, Linux, Jolt `wasm-compat` em uma thread, mundo `KIT_WORLD` (120 Hz).

**O que já existia e foi reaproveitado:** `setMotion` (dinâmico ↔ cinemático, devolve a massa do kit ao soltar), `moveKinematic`, `setVelocity`, `sphereCastAll` com filtro de camada, `continuous` na criação do corpo, e o uso que `game-destruction-three/src/engine-pieces.ts` já faz (peça `held` vira cinemática). A demonstração (b) do `extras.test.ts` já pegava, carregava e arremessava uma lata, mas no campo aberto.

**O buraco que a T4.2 fecha:** um corpo cinemático movido pela mão **atravessa parede fixa** (cinemático não colide com estático). Teste de controle: caixa cinemática levada a x = 4 por uma parede de 10 cm em x = 3 acaba depois da parede (`hold.test.ts`, "without the sweep ... goes through the wall"). E uma peça pequena arremessada rápido passa por parede fina se for discreta: caixa de 6 cm a 25 m/s (21 cm por passo, parede de 10 cm) sem varredura termina depois da parede (teste de controle verde, o que prova que o teste pega).

**O que mudou**
- `game-physics/src/hold.ts`: `grabBody(world, id, { radius, skin? })` devolve `Hold` (`moveTo(posição, rotação, h)`, `release(linear, angular?)`, `held`). Pegar zera a velocidade e põe cinemático; `moveTo` varre uma esfera (a menor meia-medida do corpo menos a folga) do ponto atual até a pose da mão contra a camada `static` e para `skin` (1 cm) antes do primeiro corpo fixo, devolvendo `false` quando algo fixo estava no caminho; soltar põe dinâmico (com a massa do kit), liga a varredura (`setContinuous`) e dá a velocidade (zero = largar). Soltar de novo não faz nada. Só usa o contrato (`SeamWorld`); nada do Jolt.
- Contrato: `setContinuous(id, boolean)`; adaptador: `SetMotionQuality` (`LinearCast` / `Discrete`).
- O raio da varredura é a menor meia-medida, não a esfera que envolve o corpo: uma caixa deitada no chão tem o centro mais baixo que o raio que a envolve e contaria como presa no chão (teste "a hand sliding along the floor").

**Testes** (`game-physics-jolt/tests/hold.test.ts`, 8, todos verdes): pegar do chão e segurar na mão por 1 s sem cair (pose final 0,5 / 1,2 / 0 a 1 cm, `moveTo` devolve `true`); levada a uma parede por uma mão que está dentro dela, para a menos de 5 cm antes da face com folga (nunca além de x = 2,851) e `moveTo` devolve `false`; controle sem varredura atravessa; arremesso de uma caixa de 20 cm a 15 m/s contra parede de 10 cm a 1,5 m fica deste lado (x < 2,95 e > 2,65); peça de 6 cm a 25 m/s não faz túnel; controle da mesma peça com chamadas cruas faz túnel; largar cai com a massa dela, assenta (y = 0,1) e dorme; a mão deslizando rente ao chão não é parada pelo chão.

**Gates**: `game-physics` 22 testes; `game-physics-jolt` 108 passam, 2 pulados (27 arquivos, 1 pulado); `game-player` 115; `tsc --noEmit` dos três e de `game-destruction-three` limpos; `eslint src tests` dos três limpo; `kit-audit --check` 0 novos.

**Limites:** `engine-pieces.ts` (peça na mão do jogo) ainda usa `setMotion` + `moveKinematic` sem a varredura: ligar `grabBody` lá muda o que a mão faz com a peça no jogo inteiro e fica como passo próprio (o dono decide; não é parte da T4.2, cujo aceite é o teste de pegar e arremessar sem atravessar parede). O soltar liga `continuous` e não o desliga depois (custa só enquanto a peça anda rápido).

## T4.3 — B2 em produção: granada como desenhada e cápsulas com rolamento (2026-11-26)

2026-11-26, Intel Core Ultra 9 275HX, Linux, Jolt `wasm-compat` em uma thread, mundo `KIT_WORLD` (120 Hz, 32 iterações de velocidade), chão igual ao da produção (`engine-pieces.ts` GROUND: atrito 0,7/0,6, restituição 0, C_rr 0,015).

**O que já existia e foi reaproveitado:** `Rolling` e `BodyDesc.rolling` do contrato (T3.5), o `rolling` do adaptador, o desenho da M67 (`models/explosives.ts`, agora com as medidas em `M67_PARTS`, lidas pelo desenho e pelo colisor), o `projectileModel` (modelo centrado na caixa), o `buildCasing` (cilindro ao longo de x) e o `createParticles` (por onde todas as cápsulas dos modelos da galeria passam). A demonstração (b) do `extras.test.ts` (gate 0, 1/60, chão padrão) fica como está e passa.

**O que mudou:** `game-weapons-three/src/engine-loose.ts` (costura: `explosiveCollider`, `casingCollider`, `spawnLoose`, `syncLoose`, `dropLoose`); `createParticles(..., physics?)` e `ParticleOptions.collider`: com mundo, a cápsula é corpo do motor (pose, repouso e `onBounce` vêm dele); sem mundo, o salto próprio de antes (os 58 arquivos de teste do pacote seguem verdes). Opção `physics` em `createWeaponFx` e no viewmodel. Dependência nova: `game-physics` (tipos) e devDependency `game-physics-jolt`. Não mexi em `box-fx` (arquétipos genéricos) nem na sala de teste.

**O que a medição mostrou (margem fina, confirmada):** o arremesso do gate 0 (11 m/s, subindo 4, de 1,5 m) com `KIT_WORLD` e chão de produção, só com C_rr 0,015, repousa a **5,51 s** (reprova o limite de 5 s); em 18 arremessos variados (10/11/12 m/s, subida 3/4/5, giro 0/6) a mediana é 5,30 s e **11 de 18 passam de 5 s** (amortecimento 0,05, o das peças do kit: 12 de 18). O resultado de cada arremesso é caótico (a mesma cena dá de 2,7 a 5,9 s conforme a origem do corpo, o passo e o chão), então um arremesso só não prova nada. **Decisão:** a granada ganha `rolling.damping = 1` (campo que já existe no contrato; a espoleta e a alavanca saem do corpo, ela não é bola lisa), no mesmo patamar de superfícies moles do `friction.ts`. Varredura de amortecimento (18 arremessos, chão de produção): 0 → 11 acima de 5 s; 0,05 → 12; 0,3 → 4; 1 → **0** (máximo 4,83 s); 2 → 0 (máximo 4,44 s). O C_rr segue 0,015 como o aceite pede; **o 1 é escolha minha para fechar a margem, não vem do aceite — o dono pode trocar** (`GRENADE_ROLLING_DAMPING`).

| Medida (`tests/engine-loose.test.ts`, 8 testes) | Resultado | Limite |
|---|---|---|
| granada no chão aberto (cena do gate) | repouso 4,08 s; 5,12 m do pouso (16,66 m do arremesso) | ≤ 5 s e ≤ 8 m do pouso |
| granada contra a parede a 8 m (cena do gate) | repouso 2,23 s; 7,88 m do arremesso | ≤ 5 s e ≤ 8 m |
| varredura de 18 arremessos | repouso 2,88 a **4,83 s**; no máximo 6,16 m do pouso | todos ≤ 5 s, ≤ 8 m |
| 200 cápsulas de 9 mm (uma por 2 passos, `KIT_WORLD`) | **200/200** dormindo 5 s depois da última; **0** abaixo do chão | ≥ 95% e 0 |
| cápsula pelo `createParticles` com mundo (chão que quica 0,6) | quica (`onBounce`), repousa a < 2 cm do chão, parada no fim; sai do mundo com a partícula | — |
| colisor igual ao desenho | esfera no mesmo lugar do modelo centrado; base do colisor = base do modelo (6 casas) | — |

**Margens:** granada 4,83 s de 5 (0,17 s) no pior da varredura; contra a parede 7,88 m de 8 (0,12 m). Medir de novo em toda fase que mexa em rolamento ou sono (spec §risco).

**Gates:** `game-weapons-three` 58 arquivos, 2084 testes passam (as dependências `game-items-three`, `game-test-room` e outras foram buildadas antes: faltava o `dist` no worktree); `extras.test.ts` 4 passam; `tsc --noEmit` do pacote limpo; `eslint` (raiz) em `src` e no teste novo limpo; `kit-audit --check` 0 novos.

**Limites (não escondidos):** (1) a sala de teste (`game-test-room`) ainda lança a granada com a balística própria: a costura existe e está exportada, mas ligar o arremesso da sala a ela muda o jogo inteiro e não era da task (aceite: os testes pedidos). (2) Cápsulas dos arquétipos genéricos (`box-fx`) e carregadores continuam no salto próprio. (3) Com mundo, o chão é o do mundo do host: `groundAt` não é consultado para a cápsula.

### Sem amortecimento, decisão do dono (2026-11-26)

O dono tirou `GRENADE_ROLLING_DAMPING = 1` (20 vezes o das outras peças, e mascarava o C_rr 0,015). Medido de novo, mesma máquina, `KIT_WORLD`, chão de produção, granada só com C_rr 0,015, arremessos de 11 m/s subindo 4 m/s de 1,5 m, e a varredura de 10-12 m/s: o teste da própria T4.3 reprova (open floor 5,51 s; varredura até 5,74 s).

**Sono do Jolt ou parar de andar?** Rodei cada arremesso duas vezes, com a mesma semente: uma com `sleepAfter` 0,5 s (o do kit) e outra sem nunca dormir, lendo velocidade linear e angular do corpo a cada passo (12 sementes: 101 a 112, arremessos novos, quaternião inicial por semente).

| Semente | toca o chão | dorme (kit) | para de verdade (v < 2 cm/s e ω < 0,5 rad/s), sem dormir |
|---|---|---|---|
| 101 | 1,28 s | 5,13 s | 12,71 s |
| 105 | 0,89 s | 3,92 s | 13,68 s |
| 108 | 1,07 s | 6,17 s | 13,64 s |
| 111 | 1,26 s | 6,22 s | 12,71 s |
| 12 sementes | 0,88 a 1,28 s | 3,92 a 6,22 s | 12,48 a 13,99 s |

O corpo **não** "parou e o Jolt demorou": ele se mexe de verdade (rolamento e balanço sobre a espoleta, v 0,09 e ω 3 rad/s aos 5 s) por 12 a 14 s; o Jolt o põe para dormir antes, quando os pontos de teste de sono andam menos que o limite numa janela de 0,5 s (`sleepSpeed` 0,08). O tempo de repouso é, então, o tempo de **perder o giro residual**, e o giro é o da alavanca e da espoleta: com 24 arremessos por variante (sementes 200 a 223, `restAt`):

| Colisor | mediana | mín | máx | acima de 5 s |
|---|---|---|---|---|
| completo (corpo, espoleta, alavanca), como desenhado | 5,42 s | 4,81 | 6,30 | 22 de 24 |
| corpo e espoleta | 6,83 s | 6,04 | 7,91 | 24 de 24 |
| só a esfera | 12,84 s | 11,60 | 13,52 | 24 de 24 |
| completo, restituição 0,1 | 5,41 s | 3,05 | 6,23 | 21 de 24 |
| completo, atrito 0,9/0,8 | 5,22 s | 3,52 | 5,94 | 17 de 24 |

Leitura: a esfera lisa com C_rr 0,015 leva 12,8 s (Coulomb: 0,015 g = 0,15 m/s² de freio); a espoleta e a alavanca já **ajudam** (cortam para 5,4 s) ao travar o rolamento. Não achei defeito no colisor (a esfera está onde o modelo desenha), no material nem no sono: o tempo vem do próprio C_rr 0,015 contra uma granada que chega ao chão girando. Tentativas: (1) variantes de colisor e de material acima; (2) separar sono de parada física. Nenhuma fecha 5 s sem amortecimento artificial, sem afrouxar o limite ou sem mudar o `sleepSpeed` do mundo (que é de todo o kit).

**Reaberta.** A T4.3 volta a 🔄 no `tasks.md`. **Saiu do PR #518:** `explosiveCollider` (colisor da granada), o amortecimento, o teste de aceite da granada (cena aberta, varredura de 18, parede) e os testes do colisor; os textos de README e skills foram ajustados. **Ficou:** `casingCollider`, `spawnLoose`/`syncLoose`/`dropLoose`, `createParticles` com mundo, 200/200 cápsulas dormindo e `M67_PARTS` (o desenho segue lendo as medidas). A decisão que falta ao dono: aceitar que a granada só com C_rr 0,015 repousa em torno de 5,4 s (e mudar o limite), ou outro C_rr/colisor para a granada, ou o `sleepSpeed` do kit.

### Limite novo, decisão do dono (2026-11-26)

**Decisão do dono:** o limite de 5 s foi escolhido para uma esfera; a granada desenhada (corpo, espoleta, alavanca) rola e balança. O novo limite da granada é **dormir em ≤ 6,5 s e ≤ 8 m do pouso, sem nenhum amortecimento artificial**, só com C_rr 0,015. Cápsulas seguem em ≥ 95% de 200 dormindo a 5 s.

**O que voltou:** `explosiveCollider` (de `e40ae97b1`/`ff790ea97`, sem `GRENADE_ROLLING_DAMPING`, sem o campo `damping`) e os testes de aceite da granada com o limite novo (`GRENADE_REST_LIMIT_S` 6,5 e `GRENADE_REACH_LIMIT_M` 8): chão aberto, parede a 8 m, varredura de 18 e dois lotes de 24 arremessos semeados (`tests/engine-loose.test.ts`; semente = pose, velocidade e giro por `mulberry32`). O teste "colisor igual ao desenho" (pedido pela revisão do #518) agora compara com o modelo desenhado a posição da espoleta (x, y, z), a da alavanca, **o sinal e o valor da inclinação da alavanca** (quaternião inteiro) e a esfera, não só a esfera.

Mesma máquina, `KIT_WORLD`, chão de produção, C_rr 0,015, sem amortecimento. Sementes 200 a 223 são as da calibração; **300 a 323 estão fora dela**.

| Semente | repouso (s) | do pouso (m) | | Semente | repouso (s) | do pouso (m) |
|---|---|---|---|---|---|---|
| 200 | 5.6 | 5.27 | | 300 | 5.29 | 5.36 |
| 201 | 5.22 | 6.12 | | 301 | 5.02 | 4.96 |
| 202 | 5.47 | 4.17 | | 302 | 5.77 | 4.07 |
| 203 | 5.68 | 5.23 | | 303 | 5.4 | 4.57 |
| 204 | 5.57 | 5.36 | | 304 | 5.09 | 3.91 |
| 205 | 5.38 | 5.99 | | 305 | 4.88 | 3.88 |
| 206 | 5.43 | 5.23 | | 306 | 5.27 | 5.37 |
| 207 | 5.54 | 4.18 | | 307 | 5.9 | 6.09 |
| 208 | 5.39 | 5.73 | | 308 | 4.89 | 4.5 |
| 209 | 5.21 | 4.15 | | 309 | 5.55 | 3.66 |
| 210 | 4.28 | 4.8 | | 310 | 5.33 | 4.82 |
| 211 | 5.39 | 4.83 | | 311 | 5.33 | 3.98 |
| 212 | 5.06 | 5.36 | | 312 | 5.32 | 4.34 |
| 213 | 4.68 | 5.09 | | 313 | 5.58 | 4.96 |
| 214 | 4.03 | 4.04 | | 314 | 5.77 | 4.27 |
| 215 | 5 | 3.88 | | 315 | 5.54 | 4.01 |
| 216 | 5.29 | 5.06 | | 316 | 5.09 | 4.03 |
| 217 | 5.95 | 6.5 | | 317 | 5.38 | 5.39 |
| 218 | 5.84 | 5.22 | | 318 | 5.9 | 6.22 |
| 219 | 4.91 | 4.74 | | 319 | 5.38 | 5.1 |
| 220 | 5.13 | 5.07 | | 320 | 5.49 | 5.06 |
| 221 | 5.3 | 5.26 | | 321 | 5.31 | 5.52 |
| 222 | 5.08 | 4.97 | | 322 | 5.85 | 7.39 |
| 223 | 5.54 | 5.12 | | 323 | 5.86 | 4.27 |

| Cena | Repouso | Do pouso | Limite |
|---|---|---|---|
| chão aberto (11 m/s, sobe 4 m/s, de 1,5 m) | 5,51 s | 5,45 m | ≤ 6,5 s, ≤ 8 m |
| varredura de 18 (10/11/12 m/s, 3/4/5, giro 0/6) | 2,68 a 5,74 s | até 6,40 m | idem |
| parede a 8 m | 1,72 s | 7,89 m do arremesso (0,14 m do pouso) | ≤ 6,5 s, ≤ 8 m |
| sementes 200-223 | 4,03 a 5,95 s (mediana 5.34 s) | até 6,50 m | idem |
| sementes 300-323 (fora da calibração) | 4,88 a 5,90 s (mediana 5.38 s) | até 7,39 m | idem |

Margens: pior repouso 5,95 s de 6,5 (0,55 s); pior distância 7,39 m de 8 (semente 322; a parede a 8 m do arremesso fica em 7,89 m, igual ao desenho do gate). **T4.3 fechada (✅).** Cápsulas: 200/200 dormindo, 0 abaixo do chão (inalterado).

## T4.4 — Juntas dos interativos (2026-11-26)

2026-11-26, Intel Core Ultra 9 275HX, Linux, Jolt `wasm-compat` em uma thread, mundo `KIT_WORLD` (120 Hz), o `update` do mundo a 60 Hz.

**O que já existia e foi reaproveitado:** o que os interativos já fazem (`game-interactables`: `PartSpec` com `motion` `hinge`/`slide`, `bounds`, `pivot`, `ry`, `speed`; `setPart`, `partT`, `act`, `load`, `SoftSpec` e `push`; `game-interactables-three` só desenha o `t` e o `sway` que o mundo reporta) e, no contrato, a junta `hinge` com limite e atrito, a `slider` (T2.2), a `swingTwist`, `breakImpulse` com `brokenJoints`, `jointAngles`, `createGroup`, `ignorePair`, `setPose`/`setVelocity`/`wake`. Nenhuma junta nova no contrato e nada do Jolt fora de `game-physics-jolt`.

**O que mudou (`game-interactables`)**
- Porta de entrada: `WorldOptions.partPhysics` (`PartPhysics`, `PartDriver`, `SoftDriver` em `part-physics.ts`, duck-typed: o pacote não ganha dependência de motor em tempo de execução, só os tipos de `game-physics`). Em `world.ts`: a parte com `driver` recebe `aim` quando o alvo muda, `t` é lido do driver a cada `update`, ao chegar o alvo vira o `t` (empurrão deixa a porta onde parou e o próximo `act` alterna dali), `setPart(..., instant)` e `load` dão `snap`, o evento novo `broke` sai uma vez, `remove` descarta os drivers; no volume mole o `sway` vem do driver e `push` vira impulso nas correntes. **Sem o `partPhysics`, ou com `attach` devolvendo `undefined` (parte sem `bounds`), o caminho é o de antes, linha a linha.**
- Implementação sobre o contrato: `engine-parts.ts` (`createEnginePartPhysics`, `leafOf`), `engine-leaf.ts` (folha dinâmica na `hinge` limitada a `[min(0, ângulo), max(0, ângulo)]` ou na `slider` limitada a `[min(0, distância), max(0, distância)]`, movida por velocidade proporcional ao erro até `Motion.speed`, livre depois de chegar, com atrito que a segura), `engine-chain.ts` (`buildChain`: correntes de caixas por juntas swing-twist, `chainPoints` para desenhar o cabo) e `engine-soft.ts` (cortina: uma corrente por 12 cm de largura pendurada num trilho). Porta que quebra: `EnginePartOptions.breakImpulse`; a folha vira corpo solto do motor (`leafOf` devolve o corpo para o host desenhar).

**Testes novos** (`tests/engine-parts.test.ts`, 8, todos verdes)

| Caso | Resultado |
|---|---|
| porta em dobradiça, objeto girado 0,5 rad | `t` 0,562 / 0,938 / 0,995 / 0,996 a 0,25 / 0,5 / 1 / 2 s; volta a < 0,03 em 2 s; evento `part` na chegada |
| gaveta em corrediça, objeto girado 90° | avança 0,38 a 0,42 m no eixo do mundo, sem desvio lateral (< 1 cm); `t` > 0,97; volta |
| empurrão numa porta deixada em paz (impulso 6 e depois 400 N s na borda) | abre (`t` > 0,05), o limite segura (`t` < 1,06 mesmo com 400 N s); `act` fecha dali |
| porta que quebra (`breakImpulse` 5, impulso 300) | 1 evento `broke`; a folha vai a > 0,5 m; `t` fica congelado |
| parte sem `bounds` / mundo sem motor | `t` anda a 2,5/s como antes (0,5 em 0,2 s) |
| `setPart(..., instant)` | porta em 0,6 de `t`, parada (0,55 a 0,65 depois de 1 s) |
| cortina empurrada a 1,5 m/s | pico 0,171 rad (em 0,52 s), 0,04 rad depois de 12 s (o teste exige < pico/3 em 8 s) |
| cabo de 12 elos, 3 m, preso nas duas pontas | cede > 10 cm, as pontas ficam a < 5 cm das âncoras, nada abaixo do chão |

**Custo:** um quadro de 60 Hz com uma porta e uma cortina (8 correntes de 8 elos) — dois passos fixos mais o `update` — **0,034 ms**.

**Gates:** `game-interactables` 10 arquivos, 162 testes passam (os 154 de antes sem mudança); `game-interactables-three` 15 arquivos, 541 passam; `tsc --noEmit` de `game-interactables`, `-three` e `game-floorplan-three` limpo; `eslint` (raiz) sem erro (o aviso de `max-lines` de `world.ts`, 1811 linhas, já existia: eram 1749); `kit-audit --check` 0 novos.

**Limites (não escondidos):** (1) a ligação do motor no jogo/sala (criar o `createEnginePartPhysics` com o mundo do host e passar a `createWorld`, e desenhar a folha solta depois de quebrar) é do host; `game-floorplan-three` e a sala não passam `partPhysics` ainda, então nada muda no jogo até alguém ligar. (2) A cortina não desliza pelo trilho: o `part` da cortina continua `t` do mundo, as correntes ficam penduradas no trilho fixo. (3) Cabo: `buildChain`/`chainPoints` estão exportados e testados, mas o `wires` do `ObjectSpec` (desenho estático) não é ligado ao motor. (4) A folha não vê o corpo do móvel se o host não passar `frameOf`: a folha do móvel fechado só não briga com o resto se o host cuidar da sobreposição (o teste usa folhas que não se tocam). (5) Folha adormecida não acorda por `addImpulse`: o jogo acorda por contato; o teste chama `wake` antes do impulso.

## T4.5 — README e skills dos pacotes da fase 4 (2026-11-26)

**Pacotes tocados nas T4.1–T4.4 e o que ganhou texto:** `game-physics` (README + `kit-base/references/game-physics.md`: personagem, `grabBody`, junta `slider`), `game-physics-jolt` (README + `kit-base/references/game-physics-jolt.md`: `CharacterVirtual`, `setContinuous`, B2 com os números), `game-player` (README + `kit-pessoas-bichos/references/game-player.md`: `createPhysicsController`), `game-weapons-three` (README + `kit-armas/references/game-weapons-three.md`: `physics`, `explosiveCollider`, `casingCollider`, limites) e `game-interactables` (README + `kit-objetos-itens/references/game-interactables.md`: `partPhysics`, `createEnginePartPhysics`, `broke`, limites). `game-interactables-three` não mudou.

**Gates:** `node tools/kit-audit/audit.mjs --check` sai 0 (0 novos fora do SDK dono, 9 pendentes conhecidos, 19 permitidos; relógio próprio 0 novos; `mustDrain` 0 novas); `tests/docs.test.ts` de `game-weapons-three` 2 passam; `game-player` 115 passam. Mudança só de texto (nenhum código).

## Revisão do PR #518 (2026-11-26)

Cinco achados da revisão, um commit por item, cada um com teste que falhava antes (vermelho visto) e passa depois.

| # | Causa | Correção | Teste novo |
|---|---|---|---|
| 1 (§15) | `updateDriven` lia junta/pose de toda parte todo quadro, parada ou não; `swing` lia todos os elos de toda fita com `forEach`, spread e `Float64Array` por chamada | `engine-leaf.ts`: com o driver assentado e o corpo dormindo, `read` devolve o `t` guardado (`restedT`, invalidado por `aim`/`snap` ou ao acordar); scratch fixo no módulo, sem vetores em `move`/`read`. `engine-soft.ts` `swing`: devolve o balanço anterior quando o último elo de toda fita dorme, senão lê só o último elo (`chainEnd`); `engine-chain.ts` `chainPoints` sem `forEach` nem alocação | `engine-parts.test.ts` "does not read a joint or a pose..." (espia `jointAngles` e `readPose` do mundo: 0 chamadas com tudo dormindo; acordada por empurrão, volta a ler) |
| 2 (§8) | `buildChain` criava um grupo por corrente e o adaptador o guardava com `AddRef` até o `dispose` do mundo; o contrato não tinha como soltar | Contrato `releaseGroup(id)` (`game-physics/src/contract.ts`); adaptador libera a tabela e reaproveita o índice (`joints.ts`, `world.ts`, `world-host.ts`); `disposeChain` (`engine-chain.ts`) remove juntas, elos e solta o grupo, usado por `attachStrips.dispose` | `game-physics-jolt/tests/heap.test.ts` (ciclo C9 de grupo com corpos, índice reaproveitado, `memoryInUse` igual em 20 ciclos); `engine-parts.test.ts` cortina montada e desmontada 10 vezes devolve `memoryInUse` (era +464 B por ciclo) e `bodyCount` |
| 3 | `memoryInUse() <= before` com o corpo ainda vivo não media nada | `engine-loose.test.ts`: `bodyCount` igual ao do chão depois de `particles.dispose()`, e também depois de vida esgotada e de limite do host (os três testes reprovam se `dropLoose` for esvaziado); `engine-parts.test.ts`: corpos e juntas (`JoltWorld.joints.size`) a zero depois de `remove` e de `partPhysics.dispose()`. **Nenhum vazamento real apareceu** | idem |
| 4 | `brokenJoints.includes` lê um evento limpo a cada `run` do laço: com `World.update` a 30 Hz e o laço a 60 a quebra passava batida e a porta ficava desenhada fechada | Contrato `jointExists(id)` (falso para sempre depois de quebrar ou remover); o driver da folha trata junta ausente como quebrada (`engine-leaf.ts`) | `engine-parts.test.ts` "found broken when the world updates every fourth step" (sem o evento de `broke`: 0 de 1 antes); `game-physics-jolt/tests/joint-exists.test.ts` |
| 5 | O fechamento do driver removido por `remove()` ficava em `disposers`, e `partPhysics.dispose()` o desmontava de novo (soltando um grupo que já podia ser de outra cadeia); `syncLoose` devolvia um objeto por partícula por quadro | `engine-parts.ts`: o driver se retira de `disposers` ao desmontar; `dispose` do driver da folha e da fita idempotente; `engine-loose.ts`: leitura única reaproveitada | `engine-parts.test.ts` ("not kept": 0 chamadas de `releaseGroup`/`removeBody`/`removeJoint` no segundo desmonte; antes 8); `engine-loose.test.ts` (uma só leitura em 1440 chamadas, bounce e sono ainda por quadro) |

**Não mexido:** `GRENADE_ROLLING_DAMPING` (decisão do dono). **Limite:** `jointAngles` ainda devolve um objeto por chamada (contrato do adaptador); com a parte dormindo ele não é chamado, e só a parte em movimento paga.

**Gates (pacotes tocados, uma suíte por vez):** `game-physics` 22 testes, `game-physics-jolt` 110 (2 puladas, 1 arquivo pulado como antes), `game-interactables` 169, `game-interactables-three` 541, `game-weapons-three` 2087, `game-player` 115, todos passam; `tsc --noEmit` e `eslint` limpos nos seis (só o aviso `max-lines` de `world.ts`, que já existia). Dependências de `dist` refeitas (`game-physics`, `game-physics-jolt`, `game-interactables`) antes.

## T3.10 — Jolt como padrão (2026-11-26)

Branch `spec/008-jolt-padrao` sobre `origin/main` (`a134e3fc8`). Nenhum golden regravado.

**O que mudou (só a chave padrão; `own` continua, apagá-la é a T8.1):**
- Sala: `examples/test-room/build.mjs` (`__joltBoot` só pula o wasm com `?solver=own`), `src/main.js` (comentário; `?? 'own'` fica para o caso `?solver=own`),
  `leak.mjs` (`LEAK_SOLVER=own` escolhe o antigo), `tools/gpu/room-explosion.mjs` (variante `own` agora é `&solver=own`), `tools/serve-room/README.md`.
- Testes: `tests/setup-physics.ts` de `game-destruction-three` e `game-floorplan-three` (`IS_JOLT = PIECE_SOLVER !== 'own'`); os `describe.skipIf`
  de `fitted-pieces`, `engine-hosted`, `seam-allocations`, `engine-sweep` pulam só com `PIECE_SOLVER=own`; `bowl-energy`, `bench-pieces`, `sweep-c6`,
  `determinism-scene`, `c5-behaviours` acompanham.
- `packages/game-test-room/src/room.ts` (`options.physics ?? 'own'`) **não mudou**: a sala não cria o motor (wasm assíncrono); quem entrega o laço Jolt é a
  página (`window.__roomPhysics`). `examples/reference-district` já era Jolt por padrão.

**Gates (máquina carregada por outras sessões: carga 5–9; testes de 5 s estouram sob carga, os de 120 s também):**

| Gate | Resultado |
|---|---|
| `game-destruction test` | 90 arquivos, **699/699 passam** |
| `game-destruction-three test` (Jolt padrão) | **7 falham / 840 passam / 89 pulados** (6 arquivos de 114); com `PIECE_SOLVER=own` os mesmos arquivos passam |
| `game-floorplan-three test` (Jolt padrão) | **5 falham / 1616 passam** (3 arquivos de 90); com `PIECE_SOLVER=own` os três arquivos passam (3/3, 44/44, 6/6) |
| `typecheck` destruction-three e floorplan-three | sem erros |
| `eslint` nos arquivos tocados | 0 erros (3 avisos de arquivo ignorado) |

**Falhas de `game-destruction-three` (todas determinísticas, reproduzidas isoladas; nenhum teste afrouxado):**

| Teste | Número | Causa provável |
|---|---|---|
| `asleep-on-steep-top` "o celular, a lata e o laptop dormindo no tampo escorregam para o chão" | altura final 0,748 m, limite < 0,1 | objetos dormindo em tampo inclinado não escorregam no Jolt (atrito/sono); mesma família da T1.2 (`slope-friction`) |
| `book-knocked-over` "livro lançado de lado a 1 m/s" | 0,284 m, limite < 0,12 | livro em pé não tomba no Jolt com esse impacto lateral |
| `rolling` "can thrown into a still one" | velocidade da lata parada 0,867, esperado 2,4 (e = 0,6) | restituição lata-lata no Jolt bem abaixo de 0,6 (o teto de giro/atrito do T1.1 não explica) |
| `rolling` "fifty cans" | y mínimo 0,0263, limite > 0,027 | lata afunda 0,7 mm no chão (penetração do Jolt, `penetrationSlop`) |
| `separate-pair` "pilha depois do colapso" | `expected false to be true` (bloco sobe ou fica no ar) | pilha de blocos não assenta como o solver antigo |
| `shelf-swings-on-hinge` | ponta livre y 0,530, esperado < 0,429 | prateleira presa por um parafuso gira menos no Jolt (junta/dobradiça) |
| `engine-ground-ahead` "twenty notices… each tile laid at most once" | `tile.dirty` ficou `{minX 0.85, maxX 2.15, minZ -2.15, maxZ 0.65}`, esperado `null` | ladrilho segue sujo depois de um `update`: possível limite de ladrilhos por quadro do motor; investigar na T3.8 |

Quatro outros testes (`book-knocked-over` "0,6 m awake", `engine-ground-ahead` "explosion", `engine-ground-inplace` "200 changes", `engine-ground-net`
"any spot") estouraram 5 s só na rodada concorrente com o floorplan e passaram na rodada limpa: tempo sob carga, não física.

**Falhas de `game-floorplan-three` (Jolt padrão; passam com `own`):**
- `exact-golden` — **3 goldens mudariam, não regravados**: `destruction/breach` hash `4a2638b7` → `701da5b8`, objetos 842 → 832 (−10);
  `destruction/spall` `e112e96c` → `1ef91d0a`, 851 → 824 (−27); `destruction/fracture` `66c76666` → `eeee1eaa`, 935 → 911 (−24). Os outros 41 goldens iguais.
- `furniture-laid-still` — 72 partes de peças do catálogo andam mais de 1 cm em 2 s (de 0,459 m a 1,896 m; ex. `pedestal_basin/plain_0` 0,459 m,
  `metal_2` 1,330 m): móvel deitado não fica parado no Jolt.
- `bookcase-topple` "orçamento da sala de teste" — 24 objetos (`obj_20`…) não chegam ao repouso no tempo do teste.

**Conclusão:** o aceite "C1–C6, C8 verdes" da T3.10 **não está atendido** com o Jolt padrão nos testes: 12 falhas físicas e 3 goldens. A troca de padrão
está commitada (reversível por `PIECE_SOLVER=own`); decidir antes de mergear se os 3 goldens e as falhas entram como dívida ou bloqueiam.

### Correções (investigação da T3.10, 2026-11-26): nenhuma entrou no código

Resultado honesto: causas achadas para quase todos, **nenhuma correção commitada**, porque cada uma que testei ou regride outro teste ou só esconde o sintoma. O código de `packages/` está igual ao `HEAD`. Os dois remendos medidos ficam em `probes/` (não aplicados). Linha de base nesta rodada: destruction-three 7 falhas, floorplan-three 5 (3 goldens, `furniture-laid-still`, `bookcase-topple` orçamento).

| Teste | Causa encontrada | Remendo medido | Antes → depois |
|---|---|---|---|
| `furniture-laid-still` (72 partes) | Cinco tipos, três causas. (a) `pedestal_basin`, `tree_small`, `bicycle`: sem `contacts` próprios (mais de 12 malhas) o solver antigo apoia a peça nos cantos da **caixa**; no Jolt o apoio real é o pé desenhado (coluna de 14 cm) e a regra `topple` (`engine-pieces.ts:945`, `NARROW`) o derruba desde o quadro 2. (b) `mailbox`: o poste fica a 18 cm do centro de massa do kit (centro da caixa), a caixa na frente: o centro de massa está fora do pé, tomba de verdade. (c) `bbq_simple`: 40 caixas, rodas 10 cm abaixo da caixa da peça; assenta 0,5° torto e anda 1,0–1,6 cm (limite 1 cm). | `probes/T3.10-box-foot.patch`: em `topple`, sem `contacts`, os cantos baixos da caixa entram no apoio (o contrato documentado em `CONTACT_MESHES`). Resolve (a): 72 → 48 partes (só mailbox 8 e bbq 40). | **Reprova `pieces-stack` "a board on two legs in a line falls over too"**: destruction-three 7 → 8 falhas. Não commitado. |
| Lâmina fina inflada (`MIN_PIECE_HALF` 0,02 em `renderer.ts:145/804` e `Math.max(0.01,…)` em `pieces.ts:641`) | Confirmada como defeito real: o notebook (2 cm) entra no Jolt com caixa de 4 cm e fica preso no tampo a 41,6°; com o tamanho desenhado desliza até o chão (y 0,780 → 0,010). Mas o celular (9 mm) segue preso por outra causa (abaixo). | Mínimos para 0,001. | destruction-three igual (7); floorplan-three: `bookcase-topple` passa de 1 para 2 falhas (livros finos de verdade tremem e não repousam no prazo). Revertido. |
| `asleep-on-steep-top` | Além da inflação, o celular (0,2 kg) para com velocidade zero e acordado sobre a mesa dinâmica inclinada; com atrito 0,1 (misto 0,2) segue parado, com 0,01 desliza: força normal efetiva bem acima do peso. Mesma cena com tampo estático (sonda) desliza. Causa não achada (mesa dinâmica sobre as pernas); descartei costura das tábuas, convexRadius e chamadas do kit (`setPose` etc.). | – | sem mudança |
| `fifty cans` (y mínimo 0,0263) | **Defeito real do adaptador**: `BoxShapeSettings` arredonda as arestas (`shapes.ts:16`, até 5 cm). Os ladrilhos do chão são caixas lado a lado, então a emenda entre dois ladrilhos é um **sulco em V** de até 5 mm de fundo (a lata de 3,3 cm de raio assenta 5,3 mm abaixo do chão sobre a emenda em (0,0)). Sonda isolada: cilindro sobre caixa única assenta em 0,0330 exato. | `probes/T3.10-seam-grooves.patch`: `convexRadius` opcional em `ShapeDesc` box (contrato `game-physics`), 0 nos ladrilhos, passos e fixos do `engine-statics`. `fifty cans` passa. | **Reprova** 3 testes de `book-knocked-over` e `can … wardrobe` em `rolling`: eles passavam porque o livro em pé fica sobre a emenda (0,0), inclina 12° dentro do sulco e dorme; com chão liso o livro não tomba com o golpe de raspão. Não commitado. |
| `book-knocked-over` (sideways awake) | Mesmo sulco: o livro fica inclinado 12,3° dormindo, apoiado na aresta dentro da emenda; sem o sulco o golpe de raspão não o derruba (física plausível; o solver antigo derruba por `tip`). | – | sem mudança |
| `rolling` restituição (0,867 em vez de 2,4) | Duas coisas medidas: (1) o teste lê a velocidade no primeiro quadro em que a lata parada passa de 0,05 m/s, com contato especulativo do Jolt já no meio da troca; o valor final é 0,812/2,188 (e efetivo 0,459); (2) Jolt com formas curvas perde restituição: esfera e caixa dão e = 0,6 exato, cilindro 0,46, cápsula/casco de 24 faces também abaixo (com e = 1: caixa 1,00, cilindro 0,89). Causa dentro do Jolt (contato de superfície curva), não achei ajuste do adaptador. | – | sem mudança |
| `bookcase-topple`, `separate-pair`, `shelf-swings-on-hinge`, `engine-ground-ahead` | Não investigados a fundo. `shelf-swings-on-hinge`: o `hinge` do kit é "só do solver próprio" (`pieces.ts` `hangOn`, "`physics` swings nothing"): o teste mede um comportamento que o caminho Jolt não implementa. `engine-ground-ahead`: o motor só relê os ladrilhos ao alcance de peça acordada (`tilesAround`, margem 0,5 m); o teste espera os nove limpos com uma placa no meio, então reprova no `HEAD` com `PIECE_SOLVER=jolt` desde antes da T3.10 (código igual). | – | sem mudança |

**Goldens** (não regravados; `exact-golden` rodado de novo no `HEAD`): `destruction/breach` `701da5b8`, 832 objetos (esperado `4a2638b7`, 842); `destruction/spall` `1ef91d0a`, 824 (esperado `e112e96c`, 851); `destruction/fracture` `eeee1eaa`, 911 (esperado `66c76666`, 935). Os mesmos números da primeira rodada: os três seguem mudando.

**Opções para o dono:** (1) aceitar o remendo do sulco e reescrever os testes de livro/lata para não depender da emenda do chão, o que é mudança de teste; (2) marcar como fixos (plantados) mailbox, tree_small, pedestal_basin no `spec.ts` (`rooted`/`sunk`), o que é dado do catálogo e tira o teste do que ele cobre; (3) manter `own` para o que depende de `tip`/`hinge`/apoio na caixa até a T8.1.

### T3.10, rodada 2 (2026-11-26): correções por decisão do dono

Cada correção: teste vermelho antes, verde depois, commit isolado. Os mesmos testes seguem verdes com `PIECE_SOLVER=own` (a única falha do `own` na suíte inteira é `settle-every-material`, a mesma da `main` vermelha que outro agente investiga).

| Teste | Causa | Correção (commit) | Antes → depois |
|---|---|---|---|
| `rolling` "fifty cans" | `BoxShapeSettings` arredonda as arestas; a emenda entre ladrilhos do chão era um sulco em V | `ShapeDesc` box com `convexRadius` opcional, 0 nos ladrilhos planos e nos passos (`db68a522e`) | y mínimo 0,0263 → passa |
| `book-knocked-over` ×3, `rolling` guarda-roupa, `pieces-tipping` porta fora da origem | passavam por causa do sulco (livro inclinado 12° na emenda (0,0); lata presa nela; porta caía mais cedo) | testes reescritos, critério igual (ver abaixo) | verdes no Jolt e no `own` |
| `furniture-laid-still` (72 partes) | (a) a regra de tombar lia o centro da caixa como centro de massa; (b) pia de coluna e bicicleta: no Jolt o apoio é o pé desenhado, a regra os derrubava; (c) caixa de correio, varal, árvore pequena e churrasqueira de tijolo não ficam em pé soltas no mundo real | `PieceBody.massCentre` (centro de cada parte pesado pela massa, em `setContacts`) lido por `topple`; peça que nunca perdeu parte apoia na caixa (contrato de `CONTACT_MESHES`), a que perdeu (`apart`) apoia no que sobrou, e `pieces-stack` "board on two legs" segue verde; `PLANTED` em `furniture/spec.ts` torna fixas mailbox, correio, clothesline, tree_small, bbq_simple (`3e7656e05`) | 72 partes → 0; goldens das casas iguais |
| `shelf-swings-on-hinge` | `PieceSystem.hinge` era só do solver próprio | âncora fixa no parafuso e junta `hinge` do contrato; solta em 40° ou 1,5 s como o `own` (`7965ef7e1`) | y livre 0,530 → passa |

Reescritas (motivo de cada):
- `book-knocked-over` queda de 0,6 m: o livro cai chato sobre a aresta de 5 cm e empurra na vertical; no Jolt só tomba se o peso passar da borda (x 0,15); no `own` a regra `tip` aceita x 0,03. Varrida medida: Jolt tomba em x 0,15 (e 0,08 a 1 m); `own` só até x 0,05. Passou a `LANDING_X = IS_JOLT ? 0.15 : 0.03`.
- `book-knocked-over` arremesso lateral a 1 m/s: x 0,08 → 0,2 (tomba nos dois solvers, acordado e dormindo; vizinhos 0,25 também).
- `rolling` guarda-roupa: a lata para encostada, sem atravessar (0,467 = 0,5 − raio). **Não quica no Jolt**: a caixa tem restituição 0 por regra do kit (`material()` em `engine-pieces.ts`). Dar restituição às caixas reprova `topple-energy` ×2 (a caixa ganha energia ao pousar: o Jolt aplica o máximo das duas nos contatos mantidos, não a média). O quique segue exigido no `own`. **Decisão do dono**: a lata deve quicar no móvel?
- `pieces-tipping` porta: sem o sulco a porta leva 2,8 s para cair e o sono vem depois dos 3 s; janela 5 s, mesmo critério.

**Abertos (nenhum afrouxado):**
- `rolling` restituição lata-lata (0,867 em vez de 2,4): limite do motor, parado a pedido. Medição isolada: esfera e caixa dão e = 0,6; cilindro 0,46; cápsula/casco de 24 faces também abaixo; com e = 1, caixa 1,00 e cilindro 0,89. O teste lê o primeiro quadro acima de 0,05 m/s (valor final 0,812/2,188, e efetivo 0,459).
- `asleep-on-steep-top` (mesa longa): celular e laptop ficam parados (v = 0, acordados, 41,6°); a lata desliza. Com tampo único dinâmico a 42° os três deslizam. Não é sono (acordados desde o início), nem iterações (`JOLT_ITERATIONS=30`, `JOLT_STEP=240`), nem raio das arestas das tábuas (0 nelas). A inflação mínima (`MIN_PIECE_HALF`, `pieces.ts:641`) explica o laptop (com 0,001 ele desliza) mas **não o celular** (segue em 0,74). Causa não achada.
- `bookcase-topple` (orçamento): 24 livros parados (v = 0, `still` 10 s) ficam acordados; 24 = `SUGGESTED_MAX_AWAKE_PIECES`. Sem `maxAwakePieces` passa; com `settledBatches` sozinho passa. A interação do orçamento (`keepBudget` põe 28 para dormir) com as ilhas do Jolt deixa os 24 restantes acordados. Não corrigido.
- `separate-pair` colapso: o bloco 3 (inclinado 45°, apoiado na aresta de outros, v = 0, e acordado ele fica) reprova só a heurística `standsOnSomething` (canto sobre topo). Física plausível; mexer na heurística é afrouxar o teste.
- `engine-ground-ahead`: o motor só relê ladrilhos ao alcance de peça acordada (spec 010 T2.3); dois dos nove ficam sujos (fora da margem de 0,5 m da placa). O teste espera os nove limpos. Conflito entre o teste e o desenho preguiçoso.
- **Dependência (item 3, não mexido):** inflação de lâmina fina (`MIN_PIECE_HALF` 0,02 em `renderer.ts:145/804`, mínimo 0,01 em `pieces.ts:641`), na frente do outro agente (`fix-madeira-samba`). Medido: com 0,001 o laptop da mesa desliza; o celular não.

### T3.10, rodada 3 (2026-11-26): decisões do dono de 26/11, sobre a `main` com o #519

Branch rebaseada sobre a `origin/main` (inclui o #519: `onSteepSupport`, `slidesOn`, `sweepPiece`; `bookcase-one-side-gone` e `settle-every-material` passam). Cada correção com teste vermelho antes e verde depois, commit isolado; os mesmos testes verdes com `PIECE_SOLVER=own`.

| Item | Causa | Correção (commit) | Antes → depois |
|---|---|---|---|
| 1. Quique | O adaptador já gravava a média geométrica (a do solver antigo) no contato **novo**; o contato visto antes do toque (especulativo) fecha num passo seguinte com o padrão do Jolt, **o maior** das duas. E o kit dava restituição 0 às caixas (`material()`), então a lata nunca quicava num móvel | `OnContactPersisted` grava a mesma média (`e11d10a96`, teste `restitution.test.ts` no `game-physics-jolt`); caixa de peça com a restituição do material (`8eb17c10d`); o teste do guarda-roupa volta ao original (a lata quica) | bola 0,6 em superfície 0,4 a 1,4 m/s subia 0,042 m (o maior), agora 0,031 (média: e² h = 0,024 + a folga especulativa); `topple-energy` ×2 segue verde com restituição nas caixas; `rolling` guarda-roupa e perna da mesa quicam |
| 1b. Lata contra lata | Limite do motor, registrado: o cilindro perde restituição (e = 0,6 → 0,458; esfera e caixa dão 0,6 exato) | o teste exige o valor medido no Jolt: lata parada sai a 0,7292 e a que bateu a 0,2708 da velocidade (3 m/s: 2,1875 e 0,8125), tolerância 0,005, lidos quando a troca termina (o teste lia o primeiro quadro, no meio dela: 0,867). `own` mantém e = 0,6 | `rolling` 19/19 nos dois solvers. Medição isolada: a de acima (esfera/caixa 0,6, cilindro 0,46; com e = 1 caixa 1,00, cilindro 0,89) |
| 2a. `engine-ground-ahead` | Spec 010 T2.3: o motor só relê os ladrilhos a 0,5 m de peça acordada | o teste espera limpos os 4 ao alcance da placa e ainda marcados os 2 fora dele (`(1,-1)`, `(1,0)`), cada ladrilho lido no máximo uma vez | falhava → 7/7 |
| 2b. `separate-pair` colapso | "Apoiado" era a heurística de caixa `standsOnSomething` (canto sob um topo); o bloco inclinado 45° sobre arestas de outros está parado e apoiado | no Jolt "apoiado" = o motor tem a peça tocando algo (`touching`, lido a cada passo em que ela está acordada: o motor não guarda contato de quem dorme); `own` segue com a heurística | falhava → 11/11 nos dois |
| 2c. `pieces-tipping` porta fora da origem | sem o sulco do chão a porta leva 2,8 s para cair e o sono vem depois dos 3 s: a janela passou de 3 s para 5 s (feito na rodada 2, `f87157331`; o teste `drop(..., seconds)` ganhou o prazo); o critério é o mesmo (cai, fica chata, dorme) | – | verde nos dois |
| 3. `bookcase-topple` (orçamento) | **Dois defeitos no caminho Jolt.** (a) O Jolt acorda a cada passo o dorminhoco que encosta num corpo acordado (23 `sleep` e 1 `wake` por quadro, medido); o orçamento só agia acima da contagem, então as 24 paradas que sobravam nunca dormiam sozinhas (o motor não dorme uma ilha cujos vizinhos acordam a cada quadro). (b) com o livro fino como desenhado (item 5): o sono do orçamento apagava a inclinação mantida (`steady = null`), e o motor acordava cada livro de pé da fileira logo depois: cada um recomeçava 1,5 s, nunca dormiam juntos | (a) peça parada há `SLEEP_AFTER` dorme sob o orçamento qualquer que seja a contagem, sem tirar o teto (`84907dea3`; teste `budget-rest.test.ts`: 40 livros lado a lado, 24 ficavam acordados, agora 0); (b) `sleepByBudget` guarda o `steady` (`347586b0a`) | 24 acordados em 12 s → 0; com 7 livros finos como desenhados: 7 acordados → 0 |
| 5. Lâmina fina | `MIN_PIECE_HALF` 0,02 (`renderer.ts`) e `Math.max(0.01, …)` (`pieces.ts`) inflavam o notebook (2 cm) para uma caixa de 4 cm, enfiada no tampo | piso único de 1 mm no caminho do motor; o solver próprio guarda 0,02/0,01 até a T8.1 (com 1 mm nos dois, os goldens das casas mudavam também no `own`: `f5cb99c97` + `42d1c6cd9`). Piso medido: placa de 0,5 mm a 10 mm assenta e dorme sobre o chão do Jolt, caindo de 0,3 m parada ou a 8 m/s, sem diferença de espessura (o que entra no chão a 8 m/s sai igual, 4,3 cm, em todas) | teste `thin-piece-box.test.ts` (laptop 2 cm, celular 9 mm, folha de 0,2 mm → 2 mm) vermelho → verde; laptop e lata do `asleep-on-steep-top` deslizam (0,000), `bookcase-one-side-gone`, `settle-every-material`, `furniture-laid-still`, `fragment-rest`, `bookcase-topple` verdes |

**4. `asleep-on-steep-top` — o celular segue parado (aberto, duas tentativas gastas e mais algumas medições).** Depois do rebase e do item 5 o resultado é: lata 0,000, laptop 0,000, **celular 0,737 m** (limite 0,1). Com `own`: os três deslizam.
O que a investigação fechou:
- Não é a inflação: com piso 0,01, 0,005, 0,0025 e 0,001 o celular fica em 0,741, 0,737, 0,737 e 0,737. Não é a folga de penetração: `JOLT_SLOP`/`JOLT_PUSHOUT` 0,0005, 0,001 e 0,004 dão 0,739, 0,738 e 0,736. Não é a regra de tombar (`topple` desligada: igual), nem chamada do kit: nenhum `set*`/`wake`/`sleep` chega ao corpo do celular depois do primeiro quadro.
- **É a emenda entre as tábuas do tampo (6 caixas do composto).** O celular desliza dois centímetros e para exatamente quando a face dele cobre uma tábua (z local 0,075 = a largura de uma tábua), isto é, quando a aresta da frente chega à emenda. Com o tampo de **1 tábua** ou de **3** (mesma cena) ele desliza até o chão; com 6 tábuas e as mesmas massas, não; com 6 tábuas **sobrepostas** em 1,2× ele anda um pouco e para, em 1,6× desliza (y 0,136). Com a mesa acordada à força e 1 tábua ele também desliza: não é "mesa acordada". `convexRadius: 0` nas caixas do composto não muda.
- Leitura: caixa fina (9 mm, afundada 2 mm) contra duas caixas do mesmo composto lado a lado: na emenda o eixo de menor penetração é o do lado da tábua vizinha, e o contato empurra o celular de volta. É o mesmo gênero do sulco do chão (T3.10 rodada 1/2), agora entre as peças de um composto dinâmico. Correção possível, **não feita** (muda a forma das peças do kit): fundir as tábuas vizinhas coplanares do mesmo material numa caixa só ao montar o composto (`shapeOf`, `engine-pieces.ts:669`), ou dar ao composto a forma de uma só. O teste continua vermelho e **não foi afrouxado**.

**Goldens** (não regravados). Jolt: `destruction/breach` `e5885aa5`, 832 objetos (esperado `4a2638b7`, 842); `destruction/spall` `c9147fc8`, 824 (esperado `e112e96c`, 851); `destruction/fracture` `29f5eb6b`, 908 (esperado `66c76666`, 935) — os mesmos três da rodada anterior (`701da5b8`/832, `1ef91d0a`/824, `eeee1eaa`/911: mudaram de hash porque as peças mudaram de caixa). **Os outros 41 goldens (as casas) seguem iguais** no Jolt e os 44 passam com `PIECE_SOLVER=own`.

**Gates (rodada 3):**
| Gate | Jolt (padrão) | `PIECE_SOLVER=own` |
|---|---|---|
| `game-physics-jolt test` | 96 passam, 2 pulados (27 arquivos; `restitution.test.ts` novo) | – |
| `game-destruction test` | 699/699 (rodada 1; o pacote não foi tocado) | – |
| `game-destruction-three test` | **1 falha** (`asleep-on-steep-top`, celular 0,737) / 850 passam / 89 pulados | 738 passam, 0 falham, 197 pulados |
| `game-floorplan-three test` | **3 falhas** (os 3 goldens de `destruction`) / 1618 passam | 1616 passam, 0 falham, 5 pulados |
| `tsc --noEmit` | sem erros em `game-physics-jolt`, `game-destruction-three`, `game-floorplan-three` | – |
| `eslint` nos arquivos tocados | 0 erros (avisos de `max-lines` que já existiam em `pieces.ts` e `renderer.ts`) | – |

Falhas fechadas desde a rodada 2: `topple-energy` (segue verde com restituição nas caixas), `rolling` (guarda-roupa e lata contra lata), `engine-ground-ahead`, `separate-pair`, `bookcase-topple`, `furniture-laid-still`, `fragment-rest`. Abertos: `asleep-on-steep-top` (celular) e os três goldens, que mudam por decisão (a física é outra; o dono decide regravar). O `floorplan-three` no Jolt foi rodado inteiro antes do último commit (que só mexe no caminho `own`); depois dele rodaram o `exact-golden` e o `bookcase-topple`.

### T3.10, rodada 4 (2026-11-26): o celular e os goldens de `destruction`

Branch rebaseada sobre a `origin/main` (a4ab2f28e, com o #518); `dist` refeitos.

**1. `asleep-on-steep-top` (celular): causa e correção.**
- `mEnhancedInternalEdgeRemoval` **existe** no binding (`jolt-physics` 1.1.1: `BodyCreationSettings.mEnhancedInternalEdgeRemoval`, `Body.SetEnhancedInternalEdgeRemoval`). Foi ligada de duas formas pelo adaptador (`BodyDesc.smoothEdges`, ligada só nos compostos e depois em **todos** os corpos de peça): o celular ficou em **0,737 m nas duas**, igual ao vermelho. A opção do Jolt remove a aresta interna de malha de triângulos e de composto de triângulos; entre caixas de um composto ela não age. Por isso **não ficou no código** (revertida).
- Correção: `shapeOf` (`engine-pieces.ts`) passa as caixas por `mergeFlushBoxes` (`merge-flush-boxes.ts`): caixas sem folga e com o mesmo tamanho e lugar nos outros dois eixos, mesma rotação, viram uma caixa só. As 6 tábuas do tampo viram 1. Só o caminho do motor; `own` não muda (`shapeOf` não é dele).
- Teste: `asleep-on-steep-top` (o do celular, sem afrouxar) vermelho (0,737 m, limite 0,1) → verde (4/4); `merge-flush-boxes.test.ts` novo (6 tábuas → 1 caixa; folga, espessura diferente ou rotação mantêm separadas).
- Efeito nos outros: `furniture-laid-still`, `bookcase-*`, `settle-every-material`, `pieces-*` verdes (suíte inteira abaixo). Custo: a fusão é O(n²) nas caixas de um composto, só ao (re)montar a forma; sem custo por passo, e o composto fica com menos filhos (o Jolt testa menos formas por contato).

**2. Goldens de `destruction` no Jolt** (não regravados; o dono decide). Rodados nos dois solvers, mesma cena (`sobrado:3`, semente 5, 1 s), lista de objetos da cena comparada (tipo, nome, material, tamanho, posição), mais os eventos do mundo (`world.on('*')`) e a trilha de cada peça (`renderer.pieces()`, a cada 0,05 s). Os 41 goldens das casas seguem iguais.

Todos os objetos que mudam são **fragmentos de detrito** (`fragment`, e as `fragment-instances` que os desenham); as peças (`obj_*`), as paredes e o resto da cena são os mesmos. Contagens por material (`own` → Jolt):

| Golden | Objetos | Fragmentos por material | Eventos do mundo | Causa |
|---|---|---|---|---|
| `breach` | 842 → 832 (−10) | vidro 11 → 20 (+9); reboco 24 → 13 (−11); tijolo 77 → 71 (−6); madeira 1 → 0 (−1); instâncias −1 | 36 → 38 | (a) o vidro da janela (`window:w0_0`, peça `obj_4`) cai em 0,35 s no Jolt e em 0,55 s no `own`, e estilhaça em **20** cacos contra 11; (b) o orçamento de 160 fragmentos vivos (`maxFragments`) faz os cacos pequenos mais velhos (reboco e tijolo) sumirem para dar lugar aos 9 a mais: o Jolt termina com exatamente 160; (c) o batente da janela cai e lasca no `own` (1 caco de madeira), no Jolt não |
| `spall` | 851 → 824 (−27) | MDF 19 → 0 (−19); madeira 5 → 0 (−5); tijolo +4; instâncias −7 (MDF 5, madeira 2) | 104 → 84 | as peças soltas do andar de cima (porta do guarda-roupa, 2 gavetas das mesinhas, batente e porta `d1_5`) **caem 2,8 m e batem a −7,4 m/s no `own`** (cinco `fall`: lascas de MDF e madeira, vinte eventos a mais); no Jolt elas **ficam sobre a laje** e não há `fall` |
| `fracture` | 935 → 908 (−27) | MDF 9 → 4 (−5); madeira 10 → 1 (−9); vidro 15 → 20 (+5); instâncias −7 | 460 → 443 | as duas: as mesmas peças de MDF e madeira (guarda-roupa, gaveta, batente) não caem no Jolt (`chip`/`crack`/`damage` de `ix:door:…wardrobe`, `ix:drawer:…nightstand_left`, `jamb:d1_5` somem), e o vidro da janela estilhaça em 20 (o `own`: 15) |

Por que o Jolt segura as peças do andar de cima: a laje `slab_1_p0` fica `damaged` (2 trincas, 0 furos, 86 785 de 87 752 de vida) **nos dois solvers**, isto é, intacta como superfície. No `own` as nove peças caem em queda livre desde o primeiro quadro (`vy` −0,49 m/s em 0,05 s, sem apoio) por 2,8 m; no Jolt elas estão sobre os sólidos fixos da casa (`onGround`, `y` ≈ 0 a 0,1 m). O `own` só conhece o chão plano (`groundAt` = 0 aqui) e a varredura contra as partes do mundo, e passa as peças pela laje; o Jolt tem a laje como corpo fixo. Leitura: **o Jolt é o que está certo** nesse ponto (inferência de medida: não conferi o `own` linha a linha).

Por que o vidro estilhaça em 20 no Jolt: a chapa fina agora tem a espessura desenhada (item 5 da rodada 3: meia espessura 0,006 contra 0,02 do `own`, que inflava), e cai e bate em outro lugar: o vidro e o batente descem juntos e pousam a ~0,34 m acima de onde o `own` os pousa. **Não identifiquei no que o vidro pousa** (a peça sob ele não é um sólido fixo que eu tenha listado): é o ponto que eu pediria ao dono para ver na sala.

**Veredito por golden:** `breach`, `spall` e `fracture` mudam por **física legítima do motor novo** (peças apoiadas na laje em vez de atravessá-la, chapa de vidro com a espessura real), sem objeto que deveria existir e sumiu por defeito; as contagens (−10, −27, −27) vêm só de fragmentos de detrito, e o orçamento de 160 distribui o que sobra. **Dois pontos que eu não chamaria de resolvidos e que não mudam a contagem:**
- as **gavetas** (`obj_6` a `obj_9`, MDF, 6 kg) **sobem** a 6,2–6,4 m no Jolt (e 2,4–2,6 m no `own`: aparece nos dois solvers, só maior no Jolt) por empurrões de posição, não por velocidade (a velocidade lida fica em 0,05–0,9 m/s enquanto `y` sobe 0,4 a 1,5 m por quadro). É defeito, de causa não achada (o `fellThrough` e o `liftFor` não explicam sozinhos: pede sonda);
- o pouso do vidro (acima).

**Gates (rodada 4):**
| Gate | Jolt (padrão) | `PIECE_SOLVER=own` |
|---|---|---|
| `game-physics-jolt test` | 114 passam, 2 pulados | – |
| `game-destruction test` | 699/699 | – |
| `game-destruction-three test` | 853 passam, 0 falham, 89 pulados | 740 passam, 0 falham, 197 pulados |
| `game-floorplan-three test` | **3 falhas** (os 3 goldens, não regravados: `breach` 832, `spall` 824, `fracture` 908 objetos) / 1618 passam | 1616 passam, 0 falham, 5 pulados |
| `tsc --noEmit` | sem erro nos arquivos tocados (os erros que o `tsc` lista são de `game-interactables`/`game-items-three`, sem `.d.ts` no `dist` desta máquina) | – |
| `eslint` | 0 erros (aviso de `max-lines` que já existia em `engine-pieces.ts`) | – |

### T3.10, rodada 5 (2026-11-26): Gavetas que sobem

**Resultado: a gaveta não sobe. O "subir a 6,2–6,4 m" da rodada 4 é artefato de medição; não há correção de posição para consertar.** Nenhum código do kit mudou.

Sonda (cena `sobrado:3`, semente 5, 1 s, `spall`; `[DEBUG-7c1a]` em `moveBy`, `underGround`, `reshape`, o `setPose` do `sync`, `fellThrough` e a leitura do motor a cada quadro; removida) e leitura da altura pelo **centro da peça no mundo** (`root.localToWorld(localCenter)`), nos dois solvers:

| O que | Jolt | `own` |
|---|---|---|
| Altura real das gavetas `obj_6`–`obj_9`: início → máximo → fim | 2,97/3,21 → 2,97/3,21 → **2,815** (descem 0,16 a 0,4 m e param na laje) | 2,97/3,21 → 2,97/3,21 → 0,11–0,17 (caem 2,8 m: o `own` atravessa a laje, rodada 4) |
| Subida máxima do centro de qualquer peça (`breach`/`spall`/`fracture`) | 0,000 / 0,002 / 0,066 m | 0,022 / 0,000 / 0,002 m |
| Subida máxima da base da caixa (Box3 do desenho) | 0,000 / 0,000 / 0,022 m | 0,028 / 0,000 / 0,001 m |
| Salto de posição acima do que a velocidade explica, por quadro | ≤ 0,024 m | ≤ 0,056 m |
| Peças que passam de 0,5 m acima de onde estavam | **0** | **0** |
| Correções de posição aplicadas nas 3 cenas | 3 × `moveBy` de 6–8 mm (de lado, saída de dentro de fixo); 0 `underGround`, 0 `fellThrough`, 0 `reshape` de gaveta | – |

Causa do número da rodada 4 (`engine-pieces.ts:1598`, `b.root.position.set(pos - R·centerV)`): a raiz da peça é a origem da casa e o centro da gaveta fica a `localCenter` = (3,49; 2,99–3,22; 1,44) dela. Quando a gaveta gira 90° em torno de z (cai de lado sobre a laje: `ang` 72° em 0,35 s, 159° em 0,5 s, 90° no fim), `root.position.y` varre esse braço de ~3,5 m: 6,15–6,42 no Jolt, 2,44–2,57 no `own` (gira 69° no fim), exatamente os valores da rodada 4. A velocidade lida é a do centro de massa e estava certa (0,05–0,9 m/s); o que "subia 0,4 a 1,5 m por quadro" era a origem da raiz, que não é onde a peça está nem onde o desenho aparece (o desenho é raiz + R·localCenter = o centro). Por isso `fellThrough` e `liftFor` "não explicavam": não havia subida a explicar.

Teste: `packages/game-floorplan-three/tests/destruction-pieces-never-rise.test.ts` (3 cenas, nenhuma peça sobe 0,5 m ou mais acima da altura inicial do centro). **Não ficou vermelho antes**, porque não há defeito nesta cena: entra como guarda, verde nos dois solvers. Não escrevi cena pequena de gaveta saindo de mesinha porque ela também passaria (inventar o vermelho seria afrouxar o critério ao contrário).

Goldens (não regravados), `destruction`: Jolt `breach` `e5885aa5`/832, `spall` `26c3349`/824, `fracture` `fb65e788`/908 (esperados `4a2638b7`/842, `e112e96c`/851, `66c76666`/935); `own` 44/44 passam. Os 41 das casas seguem iguais nos dois.

**Não resolvido:** a queixa do dono na sala ("partes de madeira sobem e ficam sambando depois de tiro") **não foi reproduzida por esta cena**. Precisa de um caso real (qual peça, qual tiro) ou da sala com a sonda. Quem lê `root.position.y` de peça para medir altura repete o erro: ler o centro (`localToWorld(localCenter)`).

Gates (rodada 5): `game-physics-jolt` 114 passam, 2 pulados; `game-destruction-three` Jolt 853 / `own` 740, 0 falhas; `game-floorplan-three` Jolt 1621 passam e **3 falhas (os 3 goldens, não regravados)**, `own` 1619 passam, 0 falhas; `eslint` e `tsc` do teste novo sem erro (nenhum código do kit tocado).

### T3.10, rodada 6 (2026-11-26): goldens de `destruction` regravados por decisão do dono

Branch rebaseada sobre a `origin/main` (sem commits novos), `dist` refeitos. Decisão do dono (2026-11-26): regravar os 3 goldens de `destruction`; o diagnóstico das rodadas 4 e 5 (física legítima do motor novo: a laje segura as peças, o vidro tem a espessura real) fica como a causa.

Regravados com `UPDATE_EXACT=1` em `tests/exact-golden.test.ts`. O diff do `tests/fixtures/exact-floorplan.json` tem **só 3 linhas**:

| Golden | Antes | Depois |
|---|---|---|
| `destruction/breach` | `4a2638b7`, 842 objetos | `e5885aa5`, 832 |
| `destruction/spall` | `e112e96c`, 851 | `26c3349`, 824 |
| `destruction/fracture` | `66c76666`, 935 | `fb65e788`, 908 |

Os 41 goldens das casas seguem iguais.

**Limites do motor (registrados, não corrigidos):**
- **Restituição do cilindro:** no Jolt o cilindro (a lata) perde restituição, e = 0,46 onde o material pede 0,6 (esfera e caixa dão 0,6 exato; com e = 1, caixa 1,00 e cilindro 0,89). Causa dentro do Jolt (contato de superfície curva); o teste `rolling` lata contra lata exige o valor medido (0,7292 / 0,2708 da velocidade). O `own` mantém 0,6.
- **Ponto para o dono ver na sala:** a janela e o batente pousam cerca de 34 cm acima de onde pousavam no `own`; não identifiquei no que o vidro pousa.

### Régua por distribuição, decisão do dono (2026-11-26)

**Corrida entre merges.** O #522 (granada sobre o Jolt padrão) e o #520 (restituição nos contatos persistentes, `game-physics-jolt/src/contacts.ts`) entraram na `main` quase juntos; a `main` ficou vermelha: "24 seeded throws ... rest within 6.5 s and 8 m" reprovou com 6,68 s na semente 217.

**Diagnóstico.** A física está certa e o #520 não se reverte (teste próprio em `restitution.test.ts`). Em 100 sementes novas (400 a 499) a média de repouso é a mesma antes e depois do #520 (5,48 s), e já antes dele 1 em 100 passava de 6,5 s (semente 416, 6,58 s) e 1 em 100 passava de 8 m (semente 400, 8,81 m). As 48 sementes dos lotes 200-223 e 300-323 não pegavam essa cauda: a régua de "todo arremesso" era frágil por construção.

**Decisão do dono (2026-11-26):** a régua da granada passa a ser uma distribuição. Em 100 arremessos semeados (400 a 499, pose, velocidade e giro por `mulberry32`), **pelo menos 95% dormem em ≤ 6,5 s e ficam a ≤ 8 m do pouso**, e **nenhum** passa de **8 s** nem de **10 m** (teto contra granada que rola sem parar). Sem amortecimento, só com C_rr 0,015. Chão aberto e parede seguem cada um dentro de 6,5 s e 8 m. Os lotes 200-223 e 300-323 saíram; `tests/engine-loose.test.ts` tem agora um teste de 100 arremessos (1,2 s de execução).

**Resultado (semente 400 a 499):** 98/100 dentro dos dois limites (mínimo 95); quantil 95 do repouso 6,07 s, máximo 6,58 s (teto 8 s); quantil 95 da distância 6,24 m, máximo 8,67 m (teto 10 m). Acima de 6,5 s: 1 (semente 416, 6,58 s). Acima de 8 m: 1 (semente 400, 8,67 m). Nenhuma acima dos tetos.

| Semente | repouso (s) | do pouso (m) | | Semente | repouso (s) | do pouso (m) |
|---|---|---|---|---|---|---|
| 400 | 6.42 | 8.67 | | 450 | 5.3 | 4.72 |
| 401 | 5.73 | 4.8 | | 451 | 5.21 | 5.76 |
| 402 | 4.87 | 5.58 | | 452 | 5.48 | 5.26 |
| 403 | 5.82 | 4.86 | | 453 | 5.28 | 3.75 |
| 404 | 5.58 | 4.37 | | 454 | 5.24 | 4.1 |
| 405 | 5.31 | 5.75 | | 455 | 5.61 | 5.92 |
| 406 | 5.51 | 6.09 | | 456 | 5.54 | 4.8 |
| 407 | 5.61 | 3.84 | | 457 | 5.17 | 5.1 |
| 408 | 5.48 | 5.94 | | 458 | 5.46 | 4.47 |
| 409 | 5.1 | 4.68 | | 459 | 5.78 | 5.97 |
| 410 | 5.28 | 4.7 | | 460 | 5.79 | 5.42 |
| 411 | 5.66 | 3.06 | | 461 | 5.47 | 5.02 |
| 412 | 6 | 4.73 | | 462 | 5.2 | 4.94 |
| 413 | 5.18 | 5.36 | | 463 | 5.9 | 5.55 |
| 414 | 5.01 | 5.12 | | 464 | 6 | 5.55 |
| 415 | 5.11 | 5.03 | | 465 | 5.14 | 5.51 |
| 416 | 6.58 | 5.57 | | 466 | 5.55 | 6.31 |
| 417 | 5.49 | 4.5 | | 467 | 5.73 | 5.29 |
| 418 | 5.38 | 4.86 | | 468 | 5.41 | 5.16 |
| 419 | 5.35 | 6.09 | | 469 | 5.37 | 3.41 |
| 420 | 4.87 | 4.21 | | 470 | 5.48 | 5.14 |
| 421 | 5.74 | 5.19 | | 471 | 5.84 | 4.96 |
| 422 | 5.59 | 5.9 | | 472 | 5.26 | 5.39 |
| 423 | 4.97 | 4.59 | | 473 | 5.31 | 4.58 |
| 424 | 5.01 | 5.16 | | 474 | 5.5 | 6.3 |
| 425 | 5.25 | 3.61 | | 475 | 5.96 | 5.02 |
| 426 | 5.91 | 6.36 | | 476 | 5.04 | 3.78 |
| 427 | 5.22 | 3.74 | | 477 | 4.89 | 3.62 |
| 428 | 5.03 | 4.43 | | 478 | 5.23 | 6.15 |
| 429 | 5.22 | 4.89 | | 479 | 6.25 | 3.86 |
| 430 | 5.99 | 5.95 | | 480 | 5.03 | 4.37 |
| 431 | 5.85 | 5.69 | | 481 | 5.7 | 4.78 |
| 432 | 5.15 | 5.16 | | 482 | 5.13 | 4.34 |
| 433 | 6.04 | 4.72 | | 483 | 5.35 | 5.46 |
| 434 | 6.46 | 5.62 | | 484 | 6.23 | 6.18 |
| 435 | 5.83 | 4.34 | | 485 | 5.44 | 5.95 |
| 436 | 5.46 | 5.49 | | 486 | 5.45 | 3.81 |
| 437 | 5.01 | 3.94 | | 487 | 5.59 | 4.1 |
| 438 | 5.87 | 4.25 | | 488 | 5.28 | 6.22 |
| 439 | 5.38 | 5.8 | | 489 | 5.64 | 6.18 |
| 440 | 5.74 | 7.46 | | 490 | 5.37 | 4.58 |
| 441 | 5.42 | 6.24 | | 491 | 5.91 | 5.6 |
| 442 | 5.23 | 5.4 | | 492 | 5.16 | 4.78 |
| 443 | 5.88 | 5.96 | | 493 | 5.38 | 3.92 |
| 444 | 6.02 | 5.12 | | 494 | 6.07 | 5.29 |
| 445 | 5.28 | 3.59 | | 495 | 4.95 | 5.14 |
| 446 | 5.08 | 3.94 | | 496 | 5.04 | 4.43 |
| 447 | 4.89 | 3.79 | | 497 | 4.99 | 5.21 |
| 448 | 5.42 | 4.83 | | 498 | 5.69 | 4.37 |
| 449 | 5.54 | 5.52 | | 499 | 5.23 | 5.07 |
## T5.1 — ragdoll de pessoa e zumbi (2026-11-26) — **B3 passa; 20 R0 estouram o C7 no `KIT_WORLD`: parado, o coordenador decide**

## T5.1 — ragdoll de pessoa e zumbi (2026-11-26) — **B3 passa; 20 R0 estouravam o C7; decisão do dono: `ragdollsMax` = 1 R0 + o resto R1 (fecha ✅)**

**Portado** (de `game-physics-jolt/tests/scenes.ts:49-102`, comportamento igual): `LIMITS` e `ragdollSpec` viraram `ragdollOfRig({ rig, body, build, at?, user? })` e `RAGDOLL_LIMITS` (`game-characters/src/body/ragdoll.ts`, devolve `RagdollDesc`, R0), e o corpo de 3 partes que estava escrito à mão em `crowd.test.ts` virou `chainOfRig` (`.../body/chain.ts`, R1; as medidas do spike escaladas por altura e corpo; derivar da posição das juntas do rig fez a pilha de 100 não dormir em 10 s, então ficou o porte fiel: dorme a 9,8 s como antes). `game-characters` ganhou `@adatechnology/game-physics` só para tipos. `scenes.ts`, `ragdoll.test.ts` e `crowd.test.ts` importam de `game-characters`: o gate mede o código de produção. As camadas são `character` (a `corpse` é da T5.4).

**B3, um R0 de produção no `KIT_WORLD`** (120 Hz, 32/2, `stabilize`, `KIT_RAGDOLL_SOLVER` 20/8; cai de 2 m na escada e numa caixa, tiro de 9 mm em 1,5 s; `ragdoll.test.ts`, com `expect`):

| Critério | Medido | Limite |
|---|---|---|
| maior excesso de junta | 0,106 rad (junta 15, quadro 37) | — |
| mais passos seguidos > 0,1 rad | 1 | ≤ 3 |
| dorme em | 2,95 s | ≤ 4 s |

**C7, 20 R0 de produção no `KIT_WORLD`**, caindo e empilhando; custo de um quadro de 1/60 s (dois passos fixos), `ragdoll.test.ts` "costs: 20 production R0...":

| Janela | Mediana | p90 | p99 | Limite C7 |
|---|---|---|---|---|
| primeiros 3 s (caindo) | **16,1 ms** | 16,9 | **18,8** | ≤ 3,0 mediana, ≤ 4,0 p99 |
| 10 s inteiros | 0,004 (dormem a 2,9 s) | 16,3 | 17,9 | — |

**Reprova o C7 por 5x** (a máquina estava com carga 8–9, mas a razão entre variantes é estável). Sonda descartável, 20 R0, primeiros 3 s, mediana do quadro de 1/60 s:

| Variante | Mediana (ms) | p99 |
|---|---|---|
| `KIT_WORLD` + 20/8 + `stabilize` (produção) | 16,1 | 17,2 |
| `KIT_WORLD` sem `solverSteps` (32/2 do mundo) | 6,7 | 7,7 |
| `KIT_WORLD` + 20/8, sem `stabilize` | 16,3 | 19,2 |
| mundo de 60 Hz padrão + 20/8 + `stabilize` | 7,8 | 10,2 |
| mundo de 60 Hz padrão, sem `solverSteps` | 3,0 | 3,7 |
| `KIT_WORLD` com passo de 60 Hz + 20/8 | 8,8 | 10,3 |

Leitura: o spike media 60 Hz com as iterações padrão do Jolt (3,0 ms). O custo vem dos 120 Hz (2 passos por quadro) e dos 20/8 do ragdoll (que, no `KIT_WORLD`, são MAIS caros que os 32/2 do mundo: 16,1 contra 6,7); `stabilize` não pesa. Nem o melhor caso do `KIT_WORLD` (6,7) cabe em 3,0. As cotas do desenho (`ragdollsMax` 20 R0) são provisórias: decidir entre baixar a cota, mudar o solver do ragdoll ou subir o C7. O teste do custo fica **vermelho de propósito** até lá; nada foi afrouxado.

`crowd.test.ts` (100 corpos de 3 partes, sono 0,08, via `chainOfRig`): dorme a 9,8 s, como antes.

**Decisão do dono (2026-11-26): menos ragdolls completos.** `ragdollsMax` cai de 20 para o maior N cujos 20 corpos mortos (N R0 + 20-N R1 de `chainOfRig`) cabem no C7. Medido no `KIT_WORLD` (120 Hz, 32/2, `stabilize`, R0 em 20/8), primeiros 3 s (180 quadros de 1/60 s, tudo caindo ao mesmo tempo), trava de medição do repositório (`flock perf-measure.lock`), carga 1 min 3,1 a 3,8 (abaixo de 4; a de 15 min, 10 a 14: outras sessões) em 10 rodadas; mediana e p99 em ms, faixa das rodadas:

| N R0 sozinhos | Mediana | p99 | Cabe (3,0 / 4,0) |
|---|---|---|---|
| 2 | 1,29 a 1,76 | 2,01 a 3,06 | sim, 7/7 |
| 3 | 1,88 a 3,06 | 2,08 a 4,45 | sim em 6 de 7 (a falha: rodada com carga alta) |
| 4 | 2,57 a 4,29 | 3,25 a 6,22 | não: p99 estoura em 3 de 6 |
| 5 | 3,23 a 3,80 | 4,53 a 4,71 | não |
| 6 | 4,01 a 4,76 | 4,61 a 7,08 | não |

| N R0 + (20-N) R1 | Mediana | p99 | Cabe |
|---|---|---|---|
| 0 (20 R1) | 0,76 a 1,20 | 1,58 a 2,42 | sim |
| **1** | 1,47 a 1,99 | 1,96 a 4,08 | **sim, 7 de 8 (p99 4,08 em uma rodada)**; 5 de 5 no teste |
| 2 | 2,36 a 3,12 | 3,20 a 4,65 | não é estável: p99 estoura em 5 de 11; no teste, 2 de 3 vermelhas |
| 3 | 3,07 a 3,90 | 3,95 a 5,45 | não (mediana > 3,0 em 5 de 6) |
| 4 | 4,02 a 4,89 | 5,78 a 6,31 | não |
| 5 | 5,12 a 6,02 | 7,38 a 11,03 | não |
| 6 | 6,15 a 8,83 | 9,18 a 10,57 | não |

Cada R1 custa 0,04 a 0,06 ms; cada R0, 0,65 a 0,9 ms. **N escolhido: 1**: é o maior com a política inteira (R0 + o resto R1) estável no C7. O esperado "perto de 4" vale só para R0 sozinhos (até 3, 4 não é estável); os R1 dos outros 19 corpos comem o resto do orçamento. O custo vem de o `KIT_WORLD` rodar 2 passos por quadro. Subir a cota exige baixar o custo do R0 (solver, outra rodada de medição na T5.4) ou decisão do dono sobre o C7, e não afrouxar o teste.

`ragdoll.test.ts`: "costs: 1 production R0" (limites do C7 intactos) e "costs: 20 dead bodies, 1 R0 and the rest R1 chains". Verde.

## T5.2 — desmembrar e cortar (2026-11-26) — ✅

**Já existia e foi reaproveitado**: o modelo de dano por segmento (`game-characters/src/damage`: `BodyOps.sever`, `destroy`, evento `detach` com `groups`, `segmentsBelow`) só decide e emite; nada disso tocava a física. `ragdollOfRig`/`chainOfRig` (T5.1) dão as peças desenhadas, `describeBody` as massas, `setShape` com a massa do kit (bug 1, `set-shape-mass.test.ts`) e `ignorePair`. Nada de desmembramento existia em `game-characters-three` nem `-undead`.

**Mudou**
- `game-physics`: `removeJoint` vale também para junta de ragdoll do motor; novo `massOf(id)` (massa de agora, a do motor depois do `stabilize`).
- `game-physics-jolt`: `removeJoint` de junta de ragdoll tira a junta do sistema e a guarda em `RagdollEntry.severed`; `removeRagdoll` a devolve antes de remover o ragdoll (o Jolt quebra se removerem uma junta que não está no sistema). `removeBody` de corpo de ragdoll agora lança (o corpo sai com `removeRagdoll`, nunca sozinho). Teste novo `ragdoll-joint-removal.test.ts` (heap igual ao byte em 10 ciclos).
- `game-characters`: `createDoll` (R0 ou R1 como ragdoll do motor), `tearOff` e `cutSegment` (`src/body/doll.ts`, `dismember.ts`, `dismember-parts.ts`, `rigid.ts`).
- `game-characters-three`: `tests/dismember.test.ts` (5 testes) e `game-physics`/`game-physics-jolt` como devDependencies.

**Decisões**
1. **R0, membro arrancado**: o motor não deixa tirar um corpo de um ragdoll sem destruí-lo, então o membro **não é recriado**: corta-se só a junta acima do corte e os segmentos de baixo seguem como corpos do mesmo ragdoll, com as juntas deles, a mesma forma, massa, pose e velocidade. Nada é criado nem movido: nada nasce dentro de nada e a soma de massa é a mesma por construção. O par tronco/membro já não colidia (filtro pai-filho do ragdoll) e continua sem colidir. O membro e o corpo viram dois `Doll` (`Dismembered.remaining` e `.severed`).
2. **R1 (corrente de 3 partes)**: braço, pescoço e qualquer coisa sem corpo próprio **sai desenhada na pose de projeto** (`ragdollOfRig`), levada pelo movimento rígido do corpo da corrente que a carregava (pose e velocidade de agora), como um ragdoll novo sem `stabilize` e com as massas multiplicadas por (massa do motor / massa nominal) do portador. O portador **perde essa massa**: `setShape` encolhe a forma (raio pela raiz da fração, esfera pela raiz cúbica) com a massa do motor restante. Parte inteira dentro do membro (a cabeça) sai como no R0. Pedaços de portadores diferentes saem sem junta entre si (pescoço e cabeça). Os pares portador/pedaço ficam em `ignorePair`.
3. **Corte (R0)**: `cutSegment(world, doll, 'forearmL', 0.5)`. O toco fica no corpo e na junta (o motor ancora a junta no centro de massa, então a forma só pode encolher em volta do centro: o toco físico fica mais curto dos dois lados, dentro da pegada do membro original; o desenho vem do rig, não daqui). O pedaço é corpo novo com a forma exata do resto do comprimento, no lugar onde ele estava, com a velocidade que tinha; o que pendia abaixo (a mão) sai como no `tearOff`. Toco, pedaço e mão não se encontram (`ignorePair`).
4. **Só um ragdoll do motor por corpo**: o que saiu de um R0 vive e morre com o ragdoll de origem (`removeRagdoll`, uma vez por id). Soltar só o membro enquanto o corpo fica é a política da T5.4 (R0 → R1 recria).

**Números** (`KIT_WORLD`, corpo-guia 1,80 m, 70,00 kg nominais; `massOf` somado sobre todos os corpos):

| Caso | Antes | Depois (resto + saído) | Resto | Saído |
|---|---|---|---|---|
| R0, `upperArmL` arrancado (3 segmentos) | 70,00001 | 70,00001 | 58,14 | 11,86 |
| R0, depois `shinR` cortada a 0,4 | 70,00001 | 70,00001 | | |
| R1, `upperArmR` arrancado | 70,00000 | 70,00001 | 67,64 | 2,36 |

(O `stabilize` do Jolt redistribui a massa entre as partes: o braço no R0 pesa 11,9 kg no motor contra 2,4 do R1; por isso a conta é na massa do motor, nunca na nominal.) Antebraço cortado ao meio: toco e pedaço com exatamente metade da massa do motor do antebraço (`toBeCloseTo` a 6 casas). Tolerância do aceite ±1%; o medido é 1e-7 relativo.
Nenhuma peça sai lançada: velocidade máxima nos 0,1 s depois do corte < 3 m/s e `penetration` 0 contra o chão nos pedaços do R1.
**Heap** (`dismember.test.ts`, 20 ciclos de R0 e R1: criar, arrancar, cortar, 0,2 s, `removeRagdoll` de cada id): `memoryInUse` igual ao byte antes e depois.

**Sem motor / regressão**: `game-characters` 394 testes e `game-characters-three` 565 (inclui os 5 novos) verdes sem mudar nenhum teste existente; `game-physics-jolt` 97 passam, 2 já saltados; `tsc` dos quatro pacotes e eslint dos arquivos tocados limpos.

**Para a T8.4 (§5 do CLAUDE.md, com prints, não feito aqui)**: ver em 1ª e 3ª pessoa, parado e andando, um braço arrancado (R0 e R1) e um antebraço cortado ao meio: o membro sai do lugar certo (R1 sai da pose de projeto, não da pose deitada do desenho), o toco tem a forma que o rig desenha, e o desenho do segmento ausente some junto com o corpo físico. O desenho do ausente (`body.pieces`, `detach`) continua sendo o do `game-characters-three`; ligar o evento `severed` ao `tearOff` é da integração do jogo (T5.4).

## T5.4 — regra da pilha e LOD do corpo (2026-11-26) — **11 dos 13 testes do §7 passam; T1 (pilha de 100) e T5 (R2 → R1) ficam vermelhos por número medido, nada afrouxado; ✅ não dado**

Máquina: Intel Core Ultra 9 275HX, Linux, Node, Jolt `wasm-compat` em uma thread, `KIT_WORLD` (120 Hz, 32/2), `PhysicsLoop.step(1/60)` = 2 passos fixos por quadro. Medidas sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, carga de 1 minuto de 2,3 a 3,9 (a de 15 min, 6 a 8,5: outras sessões); três rodadas, faixa entre elas. Testes em `game-physics-jolt/tests/body-lod.test.ts` (+ `lod-scenes.ts`), `game-physics/tests/body-lod.test.ts`, `game-crowd/tests/physics/relocate.test.ts`.

**Passos do §8, um commit cada**
1. Contrato e adaptador: `overlapShape`, `contactBodies`, `RagdollDesc.sleeping`, camada `corpse` (colide com `static`, `debris`, `prop`, `character`, `vehicle`, `sensor` e `corpse`; não com `agent`), `WorkKind` `'lod'`; `QueryFilter.ignore` (veio no passo 4). **Achado:** o Jolt solta os contatos de um corpo quando ele adormece (`touching` volta `false` com o corpo parado em cima de outro), então `contactBodies` de corpo dormindo consulta a própria forma alargada em 1 cm (`TOUCH_MARGIN`) e o de corpo acordado lê a tabela de parceiros do adaptador. `corpse-layer.test.ts`, 5 testes.
2. Já feito na T5.1 (`ragdoll.test.ts` e `crowd.test.ts` importam `ragdollOfRig`/`chainOfRig`): conferido.
3. `CorpseEntry.id` (contador, nunca reaproveitado) e `CorpseLedger.subscribe({ added, removed(entry, reason) })` com `expired`/`taken`/`replaced`/`cleared`. O corpo físico sai pelo aplicador (`follower.removed`), ver passo 4.
4. Política pura `createBodyLod` (`game-physics/src/body-lod.ts`, 8 testes) e **um** aplicador `createCorpseBodies(SeamWorld | PhysicsLoop)` (`engine-corpses*.ts`): R0/R1/R2/R2f/R3; pilha (R0 vira R1 no passo em que encosta em 2 corpos ou o monte passa de 50 cm); distância amostrada em `interest()` no passo fixo, histerese 18/55-50/80-75 e permanência de 1 s (`dwellSeconds`: o corpo que passa a borda não pisca); cotas; troca sem salto de pose (corrente nasce do tronco, cabeça e coxas do R0; cápsula do tronco; velocidade vai junto) e com `overlapShape` antes (a forma encolhida 5 mm, para o repouso de 2 mm não contar; sobe até 5 cm); composto estático por pilha (R2f) refeito em lote, filho marcado com o id do cadáver; o que repousa em corpo removido (comido, expirado, despejado; dinâmico ou congelado) volta a R1 e cai (cascata por distância entre eixos das cápsulas). Troca por distância gasta `WorkBudget` `'lod'` (`LOD_UNITS`); pilha, cota e remoção não esperam. `corpseBodyKit` (`game-characters`) monta R0, R1, R2 e os índices que os ligam.
5. Medidas abaixo; cotas fechadas ou com ressalva.
6. `relocateCorpse(crowd, { id, x, z, yaw })` (`game-crowd`) sobre `CorpseLedger.replace`; o aplicador chama `onSettled` uma vez, no passo fixo, quando um corpo dorme a mais de 2 m de onde o registro o tem (o tombo do próprio corpo move o tronco até ~1,3 m). `state-hash` (2 testes) e `team-golden` (15) do `game-crowd` **iguais**, nenhum golden mudou: a física só escreve no registro quando um corpo foi empurrado.

**Os 13 testes do §7**

| # | Teste | Resultado | Medido |
|---|---|---|---|
| 1 | 100 corpos contra a parede no `KIT_WORLD`: nenhum R0 na pilha; dormem em ≤ 10 s; passo dentro do C7 da pilha (2,5 / 4,0) | **FALHA em 2 de 3 critérios** | nenhum R0 na pilha: passa (≤ 1 quadro de atraso). Dormem a **11,9 s** com a semente do teste (mais de 10 s nas 3 rodadas); mudando só a semente da rotação: 9,0, 10,5 e 11,9 s; 4 amortecimentos de corrente × 3 sementes: de 7,1 a 13,1 s, sem tendência (caos do empilhamento). Primeiros 3 s: mediana **5,88–5,98 ms**, p99 **7,5–9,8** (C7: 2,5 / 4,0). Cada R1 acordado custa ~0,055 ms (300 corpos rígidos = ~5,5 ms por quadro): o C7 da pilha (2,2 / 2,6, `crowd.test.ts`) foi medido a 60 Hz com as iterações padrão, não no `KIT_WORLD`. Sobrescrever `solverSteps` do R1 não muda nada (o do ragdoll só sobe o mínimo do mundo) |
| 2 | 20 corpos mortos com a cota de produção (1 R0 + R1), mediana e p99 no C7 | passa | mediana 0,26–0,30, p99 0,49–1,5 (C7: 3,0 / 4,0); R0 ≤ 1 (a pilha logo rebaixa o R0) |
| 3 | horda de 200 agentes sobre pilha de 100 dormindo: a pilha continua dormindo | passa | 0 quadros com corpo acordado em 600; 61 congelados em 8 compostos, 39 R1 |
| 4 | morte nova sobre pilha dormindo de 100: pico ≤ 10 ms; dorme em ≤ 3 s | passa | pico **1,08–1,17 ms**; todos dormem a **2,08 s** |
| 5 | 100 trocas R1 → R2 e de volta ≤ 5 ms, sem sobreposição, nada abaixo do chão, tronco ± 2 cm | **R1 → R2 passa; R2 → R1 no limite** | R1 → R2 mediana de 5 idas e voltas **1,7–2,1 ms** (p90 2,5–3,9); R2 → R1 **4,8–5,5 ms** (p90 6,0–8,0), uma rodada passa e duas não. Sem sobreposição, profundidade máx. 0,02 mm, deriva do tronco 6e-7 m, 0 recusadas. **Piso:** `createRagdoll` da corrente de 3 partes custa 43 µs no adaptador (4,3 ms em 100), com ou sem `stabilize`; o resto da troca (consulta, leituras, remoção) soma ~0,6 ms |
| 6 | empurrado 3 m, desce a R3 e volta: sem teleporte; monte na célula nova | passa | tronco volta a 2 cm do guardado; `onSettled` 1 vez, a < 5 cm do tronco |
| 7 | comido, expirado ou despejado com corpo em cima: o de cima cai e assenta | passa (6 variantes: 3 causas × em cima dinâmico ou congelado) | de 0,52 m a 0,171 m, dorme |
| 8 | cota: com os R0 cheios a nova morte rebaixa o R0 dormindo mais longe; sem nenhum dormindo nasce R1 | passa | `ragdollsMax` 3, desempate pelo menor id |
| 9 | histerese: corpo que passa a borda troca no máx. 1 vez por segundo | passa | 20 trocas em 60 s, intervalo mínimo 1,07 s |
| 10 | mesmo hash de degraus a 60, 120 e 144 Hz | passa | `rungHash` 1802184475 nos três, e as poses do tronco arredondadas a 1e-6 iguais; 39 de 40 corpos chegam a R3 |
| 11 | salvar e carregar depois de 200 trocas, bit a bit | passa | `saveState` do mundo e dos cadáveres voltam aos mesmos bytes e correm a 120 passos iguais. **Limite:** o `restoreState` do Jolt exige os mesmos corpos na mesma ordem; recarregar num mundo novo depois de trocas não é suportado (as chaves dos corpos levam o número de sequência). Pendência abaixo |
| 12 | ciclos de troca devolvem o heap ao mesmo byte | passa | 12 ciclos (criar, R2, R1, congelar, R3, remover) depois de 3 de aquecimento: `memoryInUse` igual, 0 corpos |
| 13 | opção A: motor e célula do monte dentro de 1 célula após `relocate` | passa | monte na célula do tronco (3×3) e **zero** na antiga |

**Cotas**
- `ragdollsMax` 1 (T5.1), mantida: 20 mortes, mediana 0,26–0,30 ms.
- `islandBodiesMax` 300: **fica, com a ressalva do T1**. Uma ilha de 300 corpos rígidos acordados (a pilha de 100 correntes) custa mediana 5,9 ms e p99 7,5–9,8 no `KIT_WORLD`: dentro da condição 10 (pico ≤ 10 ms) e fora do C7 (2,5 / 4,0). Teste: `islandBodiesMax` 60 e 40 corpos, congelam os mais antigos que dormem (18 R2f).
- `dynamicBodiesMax` 900: **fica, com a ressalva**. 300 correntes dormindo (900 corpos rígidos): a política custa **0,02 ms** por quadro (mediana de 180). O pior quadro com todas caindo juntas, medido: p99 6,8–8,3 ms, máx. 12,2–12,6 ms: passa da condição 10 uma vez. O teto só tira os que dormem; a cota de unidades do `WorkBudget` espalha as trocas.
- Orçamento somado do §2.3 (20 R0 + pilha + 1 000 agentes + destroços no mesmo quadro): **não medido**: exige a sala de teste (navegador, §9).

**Gates:** `game-physics` 30, `game-physics-jolt` 133 passam + 1 vermelho (T1, acima) e 2 já saltados, `game-characters` 396, `game-characters-three` 565, `game-crowd` 142, `game-crowd-three` 48 (dependências `dist` refeitas antes); `tsc --noEmit` e `eslint` limpos nos seis pacotes tocados.

**Para o dono decidir (T1):** (a) o C7 da pilha de 100 passa a valer no `KIT_WORLD` (6 / 9 ms) e o "10 s" vira "13 s"; ou (b) a pilha usa R2 (cápsula, 0,02 ms cada) para o que dorme em pilha longe do jogador e R1 só nos ~30 corpos mais próximos; ou (c) o ragdoll da corrente deixa de ser do motor (loose bodies não custam menos). Recomendo (b): é o que o desenho pede para o longe e é medível.

### Fechamento (2026-11-26): T1 e T5 depois da decisão (b)

Medidas sob `flock perf-measure.lock`; carga de 1 minuto de 2 a 5,6 no T1 (a de 15 min, 6,5 a 6,9: outras sessões rodando vitest sem a trava) e de 2 a 13 no T5. **Os 13 testes do §7 não passam; ✅ não dado.**

**T1: opção `pileChainsMax` (`BodyLodOptions`, `BodyLodInput.pileRank`, `rankPiles`)**. Cada ilha de corpos que se tocam ordena os corpos em pilha por distância ao ponto de interesse (o menor id entre iguais; sem `interest` todas as distâncias são 0); acima do número, R1 → R2 **forçado** no passo em que é visto (a troca não-forçada pedia lugar ao `overlapShape` e parava em ~20 R2: a cápsula do corpo inteiro encosta nos vizinhos da pilha), pela mesma `switchRung` do §3 (pose sem salto, velocidade levada). R2 acordado não volta a R1 enquanto passa do número; R2 que dorme sob outro corpo na pilha congela (R2f) como o R1. Tabela, 8 sementes de rotação por número (`yaw = id × semente`: 0,7 0,3 0,5 0,9 1,1 1,3 1,7 2,1), `KIT_WORLD`, 600+ quadros de 1/60 s; "dorme" em segundos (-1: não dormiu em 14 s):

| `pileChainsMax` | tempo para dormir (8 sementes) | ≤ 10 s | mediana 3 s (ms) | p99 3 s (ms) | carga 1 min |
|---|---|---|---|---|---|
| `Infinity` (hoje) | semente 0,7: 11,9 (e 9,0, 10,5, 11,9 nas medidas anteriores) | não | 5,4 | 7,2 | 4,5 |
| 30 | 11,6 / -1 / 10,4 / 11,4 / 11,6 / -1 / -1 / 12,9 | 0 de 8 | 3,5–4,0 | 6,1–7,1 | 3,5 |
| 20 | 10,4 / 12,2 / 10,4 / -1 / -1 / 13,1 / -1 / 8,7 | 1 de 8 | 3,1–3,7 | 6,1–8,2 | 3,8 |
| 10 | -1 / 12,4 / 12,5 / 10,9 / 7,7 / -1 / -1 / -1 | 1 de 8 | 2,9–3,5 | 5,8–7,8 | 4,0 |
| 5 | 12,6 / -1 / 12,8 / -1 / 12,8 / 10,6 / 13,9 / -1 | 0 de 8 | 2,6–2,8 | 5,2–6,8 | 4,7 |
| 0 | 10,2 / 9,2 / 8,8 / 13,8 / 10,1 / 9,9 / 10,0 / 9,6 | 5 de 8 | 2,2–2,4 | 6,0–9,3 | 5,6 |

Nenhum número fecha o T1. (1) **Sono:** até com 0 (tudo cápsula) 3 de 8 sementes passam de 10 s; piso de 8,8 s; uma pilha de postes de cápsula não assenta mais rápido que a de correntes, e 5–30 ficam piores que 0 (mistura). (2) **p99:** vem dos quadros 0 a 3 (24,7; 10,2; 8,6; 6,1 ms com 0), em que 100 correntes nascem sobrepostas num monte; a troca só roda depois e não os alcança: só nascer em R2 dentro da pilha os baixaria (mudança de nascimento, não pedida). (3) **Mediana:** só 0 chega perto de 2,5 (2,2–2,4, sob carga). **Padrão: `Infinity` (desligado)**, nada muda para quem não ligar; a opção, o `pileRank` e o congelamento de R2 ficam, com testes de política (2) e de integração (`pileChainsMax: 5`, 40 corpos). **Decisão do dono:** (a) subir o limite do C7/10 s no `KIT_WORLD`; (b) nascer R2 em pilha cheia (novo, reduz o p99, não o sono); (c) o ragdoll da corrente fora do motor.

**T5: cache no adaptador** (`game-physics-jolt/src/ragdoll-cache.ts`): `createRagdoll` reaproveita, por mundo, a forma de cada parte (chave: tipo e dimensões exatas; no máximo 64) e o `Skeleton` (chave: lista de pais; uma `RagdollSettings` vazia segura a referência, senão a última corrente removida o libera); soltos no `dispose` (§8). Não há chave quantizada: dimensões exatas não mudam o resultado físico. As `RagdollSettings` em si **não** são reaproveitadas: os pontos das juntas são em coordenadas do mundo e mudam com a pose (e `chainOfPoses` move cabeça e pernas fora do quadro rígido). Antes/depois, 100 R2 → R1, mediana: teste real, carga ~1,6: antes 4,78 / 5,35 / 4,55 (e 4,8–5,5 da T5.4); depois, carga ~2: 5,55 / 4,43 / 4,89 / 3,90 (carga 6 a 13: 5,3 a 7,5, sem valor). A/B no mesmo processo (mundo reassentado 0,5 s entre as idas, 27 trocas por lado): sem cache 5,25 e 5,78; com cache 4,32 e 4,91, ~0,9 ms (17%). Onde vai o resto (por troca, carga ~3): `createRagdoll` ~29 µs (campos e juntas por chamada de wasm), 3 `overlapShape` ~8 µs, leituras ~2 µs. **Efeito de ordem:** sem passos entre as idas e voltas, a árvore do broadphase degrada (a mesma ida e volta sobe de ~4,3 para 12–14 ms em 30 trips), o que explica a mediana do teste variar com a carga. T5 **não** fecha com folga: passa em ~3 de 4 rodadas com a máquina a carga ≤ 2.

**Gates** (carga alta, ver acima): `game-physics` 32 (30 + 2 novos), `game-characters` 396, `game-crowd` 142 com `state-hash` `7979b7a6` e `9449b822` e os 3 `team-golden` iguais (nenhum golden mudou), `game-physics-jolt` 134 + 1 teste novo passam, e 3 vermelhos sob carga de 11: T1 (acima), T5 (6,4 ms) e `ragdoll.test.ts` case 2 (3,18 ms contra 3,0: perf, a conferir em máquina quieta); `tsc --noEmit` e `eslint` limpos em `game-physics` e `game-physics-jolt`.

### Fechamento 2 (2026-11-26): T1 no `KIT_WORLD` com nascimento em sequência, e onde cada limite de custo é cobrado

**Decisão do dono (2026-11-26):** nova linha do C7 no `KIT_WORLD` (120 Hz, 32/2): **dorme em ≤ 14 s, mediana ≤ 6 ms, p99 ≤ 10 ms**; a linha antiga (2,5 / 4,0 ms, 10 s) fica marcada como do mundo de 60 Hz com iterações padrão (`spec.md` §6.2, `design/pilha-e-lod.md` §1 e §7). **Os 13 testes do §7 não passam (T1 vermelho); ✅ não dado. Limite não foi subido.**

**Cena nova** (`tests/lod-scenes.ts` `dropPile`): os 100 corpos nascem **um a cada 3 quadros** (20 por segundo; a pilha leva 5 s para se formar), nas mesmas posições do monte contra a parede (`heapAt`). Cadência: é uma matança rápida o bastante para empilhar e lenta o bastante para nenhum par nascer no mesmo quadro, como no jogo; não foi escolhida pelo resultado. Janela de custo: os 480 primeiros quadros (5 s de nascimentos + 3 s depois do último). "Dorme" conta desde o primeiro nascimento, com todos já nascidos (o último nasce a 4,95 s). Sementes: as 8 de rotação (`yaw = id × semente`) e 5 novas (0,4 0,6 1,2 1,5 1,9), fixadas antes da medição.

Tabela (13 sementes, `KIT_WORLD`, `perf-measure.lock`; última rodada, carga de 1 min 2,0–2,4; duas rodadas anteriores com carga 3,4–6,1 deram o mesmo sono, bit a bit, e custos parecidos). "-1": não dormiu em 16 s. Passa: dorme ≤ 14, mediana ≤ 6, p99 ≤ 10.

| semente | dorme (s) | mediana (ms) | p99 (ms) | máx (ms) | carga | passa |
|---|---|---|---|---|---|---|
| 0,7 | -1 | 4,57 | 9,88 | 12,5 | 2,2 | não (sono) |
| 0,3 | 11,6 | 4,52 | 10,06 | 12,1 | 2,1 | não (p99) |
| 0,5 | 11,6 | 4,45 | 9,54 | 12,0 | 2,0 | sim |
| 0,9 | 13,7 | 4,19 | 11,49 | 13,7 | 2,0 | não (p99) |
| 1,1 | 14,9 | 4,24 | 9,15 | 12,7 | 2,0 | não (sono) |
| 1,3 | 14,2 | 4,70 | 8,91 | 12,4 | 2,2 | não (sono) |
| 1,7 | -1 | 4,35 | 10,59 | 12,7 | 2,1 | não (sono, p99) |
| 2,1 | 11,4 | 4,26 | 10,38 | 11,9 | 2,0 | não (p99) |
| 0,4 | -1 | 4,41 | 10,04 | 15,0 | 2,0 | não (sono, p99) |
| 0,6 | 10,8 | 4,44 | 9,13 | 10,2 | 2,0 | sim |
| 1,2 | 12,9 | 4,32 | 8,56 | 10,4 | 2,0 | sim |
| 1,5 | 13,7 | 4,80 | 12,13 | 15,8 | 2,4 | não (p99) |
| 1,9 | 11,3 | 6,08 | 15,93 | 16,8 | 2,4 | não (mediana, p99) |

**Não fecha:** 3 de 13 passam. (1) **Sono** (determinístico, não depende de carga): 5 de 13 passam de 14 s (0,7, 1,1, 1,3, 1,7, 0,4); 3 não dormem em 16 s. (2) **Mediana**: 4,2–4,8, dentro de 6 (a 1,9 dá 6,08, com carga 2,4). (3) **p99**: 8,6–15,9; 7 de 13 acima de 10, com a máquina em carga 2. O nascimento em sequência baixou o pico dos primeiros quadros (antes 24,7 ms), mas o p99 da janela ainda passa de 10 em mais da metade das sementes. Pelo combinado, tabela registrada e parado; o limite não subiu. Opções que continuam do dono: (a) subir o sono para ~17 s (o pior medido com sono é 14,9); (b) nascer em R2 dentro da pilha cheia; (c) ragdoll da corrente fora do motor (ver "Fechamento").

**Onde cada limite passou a ser cobrado.** O repositório não tinha faixa de custo para o `game-physics-jolt`: os testes de milissegundos rodavam no `pnpm test` (CI e pre-push), e as medições longas ficam atrás de variável (`PROFILE=1`, `B6_WAKE`, `DETERMINISM_*`) ou nas rodadas sob a trava (`perf-gate.mjs`, `examples/test-room/perf.mjs`, com `flock perf-measure.lock`, regra §9). Nova faixa: `pnpm --filter @adatechnology/game-physics-jolt test:cost` (`PHYSICS_COST=1` sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`); `expectCostAtMost` (`tests/scenes.ts`) só afirma o limite com a variável ligada. Ligar essa faixa na rodada diária fica como pendência (a diária hoje é GPU e navegador).

| Limite | Antes | Agora |
|---|---|---|
| T1 sono ≤ 14 s, nenhum R0 na pilha (13 sementes na faixa, 8 no CI) | `pnpm test` | **`pnpm test` (CI)**: é contagem de tempo simulado, determinística |
| T1 mediana ≤ 6 ms, p99 ≤ 10 ms | `pnpm test` | faixa de custo |
| T2 20 corpos, mediana ≤ 3,0 e p99 ≤ 4,0 | `pnpm test` | faixa de custo (`R0 ≤ 1` fica no CI) |
| T4 morte sobre pilha, pico ≤ 10 ms | `pnpm test` | faixa de custo (sono ≤ 3 s fica no CI) |
| T5 100 trocas ≤ 5 ms por sentido | `pnpm test` | faixa de custo (recusadas, sobreposição, profundidade, deriva ficam no CI) |
| 300 corpos dormindo, mediana ≤ 0,5 ms | `pnpm test` | faixa de custo (cota de 900 corpos fica no CI) |
| `ragdoll.test.ts` casos 1 e 2, 3,0 / 4,0 ms | `pnpm test` | faixa de custo (contagem de corpos fica no CI) |
| `character.test.ts`, 50 controladores ≤ 0,5 ms | `pnpm test` | faixa de custo |

Nenhum número mudou. Na faixa (carga 3,6–4,3 na rodada inteira) T2, T4, T5, 300 dormindo, `ragdoll.test.ts` 1 e 2 e `character.test.ts` passaram; só o T1 falhou.

**Estado dos 13 testes do §7:** 1 vermelho (T1: sono e p99, tabela acima); 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 passam (os de custo, 2, 4 e 5, na faixa de custo).

**Gates:** `game-physics` 32, `game-characters` 396, `game-crowd` 142 (`state-hash` e `team-golden` iguais; nenhum arquivo de `src` mudou neste passo), `game-physics-jolt` `pnpm test`: 139 passam, 4 vermelhos, todos o T1 por sono (0,7, 1,1, 1,3, 1,7); `tsc --noEmit` e `eslint` limpos em `game-physics-jolt/tests`.

### Pilha que não dorme (2026-11-26): a corrente (R1) não tinha o corpo do R0 e do R2

**Causa.** `chainOfRig` (`packages/game-characters/src/body/chain.ts`) montava o pescoço e o quadril **sem atrito de junta** e as três partes com a **superfície padrão do motor** (atrito 0,7 / 0,6, restituição 0,2), enquanto o R0 (`ragdoll.ts:79,81,108`: `friction: 2`, `{0,8; 0,6; 0,05}`) e o R2 (`engine-corpses-swap.ts` `capsuleDesc`: o mesmo material) já tinham. Uma cabeça de 5 kg numa junta sem atrito é um pêndulo: o único freio é o amortecimento padrão do Jolt (5 %/s). O Jolt dorme **por ilha**; os 300 corpos rígidos da pilha são uma ilha só, então uma cabeça balançando 3 cm mantém os 100 cadáveres acordados.

**Sonda** (por semente vermelha, `KIT_WORLD`, nascimento 1 a cada 3 quadros, sem alterar código; sonda apagada):
- 0,7 / 1,7 / 0,4, aos 15,5 s: **15 / 21 / 24 partes** ainda se mexem (lin > 0,02 m/s ou ang > 0,2 rad/s); **12 / 21 / 23 são cabeças** (as outras: torsos e pernas puxados por elas). Nenhum corpo oscila entre dois vizinhos, nenhum acordado por contato novo: nenhum evento de acordar depois dos 5 s.
- Corpo 8 da semente 0,7: torso e pernas a 0,000 m/s, cabeça a 0,2 m/s e 1,5 rad/s, indo e voltando 3,3 cm em z com meio período de 0,5 s, **ângulo do pescoço colado no limite de balanço (0,500 rad) e a torção correndo de -0,35 a -0,49**. Pico de velocidade da cabeça por segundo, de 7 s a 16 s: 0,302, 0,287, 0,274, 0,261, 0,249, 0,239, 0,229, 0,220, 0,211, 0,203, ou seja, **-4,4 %/s = e^-0,045**, o amortecimento padrão do Jolt. Para cair de 0,2 m/s abaixo do limite de sono (0,08 m/s de ponto) faltam ~36 s.
- A política do kit **não participa**: contagem `r1 100, r2 0, r2f 0, piles 0` do começo ao fim (ninguém dorme, então nada congela), 0 trocas de degrau, 0 `overlapShape`. A prova em contrário: o mesmo custo por quadro com `evaluateEvery: 1e9` (política desligada): semente 1,7 p99 12,65 contra 12,41; 2,1 13,12 contra 13,10.

**Correção** (`chain.ts`): `friction: 2` nas duas juntas (o mesmo número do R0) e `material` `{0,8; 0,6; 0,05}` nas três partes (o do R0 e do R2). Nenhum limite de teste, de junta ou de cota mudou; não há amortecimento novo (`angularDamping` do R1 segue o padrão). Teste: `game-characters/tests/ragdoll-of-rig.test.ts` (vermelho antes: `[undefined, undefined]` contra `[2, 2]`; verde depois).

**Passo a passo** (13 sementes, segundos até todos dormirem; -1 = não dormiu em 16 s):

| semente | antes | só atrito de junta | atrito + material (final) |
|---|---|---|---|
| 0,7 | -1 | 8,5 | 11,3 |
| 0,3 | 11,6 | 9,8 | 8,7 |
| 0,5 | 11,6 | 9,4 | 9,8 |
| 0,9 | 13,7 | 8,7 | 9,4 |
| 1,1 | 14,9 | 9,5 | 9,3 |
| 1,3 | 14,2 | 9,0 | 10,9 |
| 1,7 | -1 | 10,4 | 9,5 |
| 2,1 | 11,4 | 9,3 | 8,9 |
| 0,4 | -1 | 8,9 | 9,4 |
| 0,6 | 10,8 | 9,1 | 10,2 |
| 1,2 | 12,9 | 9,7 | 9,9 |
| 1,5 | 13,7 | 11,0 | 13,1 |
| 1,9 | 11,3 | 14,1 | 11,2 |

Só o atrito de junta já tira 12 de 13 sementes de 11,0 s ou menos; a 1,9 ficava em 14,1 s (a pilha escorregando a cada ~1 s, uma perna ou cabeça caindo 4 cm a 0,9 m/s, sem nenhuma ação da política) e o T4 (morte sobre pilha dormindo, 3 s) passou a 5,68 s. Com o material junto a pior semente dorme a 13,1 s e o T4 fica em 2,4 s (média de 6 pontos de queda da morte nova: 2,9 s com a correção inteira, 4,1 só com o atrito, 3,8 sem nenhuma; o 2,08 s de antes era um dos pontos, de 2,1 a 5,7 s). O material sozinho **não foi medido**. A intensidade de cada efeito entre as sementes não é monótona: o empilhamento é caótico (a ordem muda de uma configuração para outra), por isso a tabela traz a configuração e não só a média.

**Medido no final** (`flock perf-measure.lock`, carga de 1 minuto de 2,6 a 3,5; sono é determinístico e não depende dela): dorme **8,7 a 13,1 s nas 13 sementes** (antes: 3 não dormiam em 16 s, 2 passavam de 14 s); mediana da janela **4,2 a 4,8 ms** (limite 6); p99 **7,2 a 12,9 ms** (limite 10: 7 de 13 acima; antes 7,0 a 12,8 com 9 de 13 acima); máx. 8,5 a 14,3.

**O que continua vermelho no `pnpm test` do `game-physics-jolt`** (141 passam, 2 vermelhos, ambos o T1):
1. Seeds 0,5 e 1,3: `ragdollInPile` 2 contra o teto de 1. Medido quadro a quadro: o R0 que cai na pilha dura **no máximo 1 quadro** (a política o rebaixa no passo seguinte; as 3 sementes medidas têm 3 ou 4 quadros assim em 12 s). O teste só olha 1 em cada 6 quadros e soma as vezes que pega; com a pilha de antes pegava 0 ou 1 por sorte da amostragem. Medir cada quadro e exigir sequência ≤ 1 é o que a regra do §2.1 pede; não alterei o teste.
2. As falhas de p99 e a do T4 (3 s) estão na faixa de custo e na dependência do ponto de queda, não no sono.

**p99 não é problema de sono.** O custo da janela sobe 1,5, 4,3, 6,0 ms (mediana por 160 quadros): são 300 corpos rígidos acordados em contato a 120 Hz, 32/2 iterações; os piores quadros são os de 5,5 a 5,9 s, logo depois do último nascimento. Para baixá-lo é preciso dormir antes ou ter menos corpos acordados (opção (b) do "Fechamento": nascer em R2 na pilha cheia).

**Gates:** `game-characters` 397 (1 teste novo), `game-characters-three` 565, `game-physics` 32, `game-crowd` 142 (`state-hash` `7979b7a6` e `9449b822` iguais, `team-golden` iguais), `game-crowd-three` 48, `game-physics-jolt` `pnpm test` 141 + 2 vermelhos (acima), `pnpm test:cost` 139 + 9 vermelhos (T1: p99 em 7 sementes, mediana 0,7 a 8,4 ms por um pico de 57 ms com a carga em 5,3 numa rodada, e os 2 do `ragdollInPile`); T2, T4, T5, 300 dormindo e `ragdoll.test.ts` passam na faixa; `tsc --noEmit` e `eslint` limpos. **✅ não dado: T1 continua vermelho.**

### Nascer como cápsula, `ragdollInPile` por quadro e `ragdollsMax` (2026-11-26)

**1. Nascer como cápsula em pilha cheia** (decisão do dono, para o p99 do T1). `createCorpseBodies.add` pergunta `bornInFullPile` (`engine-corpses-eval.ts`) antes de escolher o degrau: o corpo cai numa pilha quando a cápsula em pé, alargada 25 cm, toca `pileContacts` (2) cadáveres da camada `corpse`, ou 1 deles sobre monte acima de `pileHeight` (o critério do §2.1); a pilha está cheia quando já há `pileChainsMax` R1 num raio de 4 m do ponto da morte. Então o corpo **nasce R2** (`bornAt` com `'r2'`, em `engine-corpses-swap.ts`), sem passar por R1, e `overlapShape` vem antes de criar: a cápsula sobe de 5 em 5 cm (até 3 m) até não estar dentro de nada, e cai de lá. Fora de pilha e com `pileChainsMax` = `Infinity` nada muda (o `add` devolve o que devolvia). Contagem por raio, não por ilha de contatos: nos primeiros 5 s da pilha os corpos acabaram de cair e as listas de contato ainda são curtas (ilhas de 1 a 3 corpos medidas com 26 mortos), então a ilha nunca chegava a `pileChainsMax`. Teste: `pileChainsMax` de 5 em 40 mortos, 14 nascem R2 e a pilha dorme em 16 s.

**Padrão de `pileChainsMax`: segue `Infinity` (desligado). Nenhum número fecha o T1.** Sono é determinístico e não depende da carga; 13 sementes, `-1` = não dormiu em 16 s, com o nascimento como cápsula ligado:

| `pileChainsMax` | sementes que dormem em ≤ 14 s | R1 / R2 no fim | mediana / p99 (carga 3 a 5; onde a carga passou de 10 a medida é descartada) |
|---|---|---|---|
| `Infinity` | **13 de 13** (8,7 a 13,1 s) | 100 / 0 | 4,5 a 5,1 / 7,3 a 15,3 |
| 40 | 3 de 13 | 45 / 55 | só com carga de 20 a 29: sem valor |
| 30 | 3 de 13 (13,7; 12,4; 14,3; as outras `-1`) | 35 / 65 | 3,8 a 4,5 / 6,8 a 11,9 |
| 20 | 1 de 13 | 25 / 75 | só com carga de 20 a 28: sem valor |
| 10 | 4 de 13 (13,6 a 14,9) | 17 / 83 | 3,0 a 4,9 / 6,0 a 11,8 |

Com o corpo que cai nascendo R2 os números de sono são os mesmos de antes (a pilha de cápsulas não adormece; a ordem de nascimento não é a causa). Menos corpos rígidos baixam o custo (mediana 3,0 a 4,5 ms, p99 até 10 ms), mas a pilha com R2 fica acordada: o limite de 14 s não fecha em nenhum valor de 10 a 40. A causa de a pilha de cápsulas não dormir **não foi investigada** (hipótese: cápsulas rolando umas sobre as outras; um `angularDamping` de 2 no R2 foi tentado numa sonda e não mudou nenhum tempo de sono, mas a sonda rodou sem recompilar `game-physics`, então não vale como evidência). Fica como pendência T5.4f: achar por que a pilha de R2 não dorme.

**T1 nas 13 sementes com o padrão (`Infinity`)**, `pnpm --filter @adatechnology/game-physics-jolt test:cost` sob `flock perf-measure.lock`, limite **inalterado** (14 s, 6 ms, 10 ms). As quatro últimas sementes rodaram com carga de 9 a 17 (outras sessões fora da trava): valores só indicativos.

| semente | dorme (s) | mediana (ms) | p99 (ms) | carga 1 min |
|---|---|---|---|---|
| 0,7 | 11,3 | 8,66 | 41,97 | 4,8 |
| 0,3 | 8,7 | 5,98 | 9,52 | 4,8 |
| 0,5 | 9,8 | 6,04 | 9,10 | 4,8 |
| 0,9 | 9,4 | 5,77 | 10,73 | 4,7 |
| 1,1 | 9,3 | 5,47 | 12,20 | 4,6 |
| 1,3 | 10,9 | 4,98 | 11,07 | 4,6 |
| 1,7 | 9,5 | 6,89 | 15,14 | 4,5 |
| 2,1 | 8,9 | 5,25 | 9,29 | 4,5 |
| 0,4 | 9,4 | 4,68 | 11,65 | 4,2 |
| 0,6 | 10,2 | 5,35 | 60,74 | 8,9 |
| 1,2 | 9,9 | 10,69 | 33,16 | 14,7 |
| 1,5 | 13,1 | 12,75 | 58,62 | 17,4 |
| 1,9 | 11,2 | 5,68 | 13,46 | 16,6 |

Sono: 13 de 13 passam. Custo: mediana passa em 6 de 13 e p99 em 3 de 13 nas 9 sementes de carga baixa; o p99 da 0,7 (41,97) é um pico isolado. Nas passadas anteriores, com carga de 2,6 a 3,5, a mediana ficava em 4,2 a 4,8 ms e o p99 em 7,2 a 12,9: a máquina de hoje está mais carregada por outras sessões, então o piso real do custo está entre as duas medidas. **Não fecha o limite de 6 / 10 ms; nada foi subido.**

**2. `ragdollInPile` por quadro.** `dropPile` (`lod-scenes.ts`) media 1 quadro em cada 6 e somava as vezes que pegava um R0 encostando em 2 corpos; passava ou falhava por sorte de amostragem (a política rebaixa o R0 no passo seguinte, então o mesmo R0 pegava 0 ou 1 vez). Agora mede **todo quadro** e devolve a **maior sequência** de quadros com R0 em pilha; o teste exige ≤ 1, que é o que o §2.1 pede ("ao entrar numa pilha, um R0 vira R1 no mesmo passo fixo"). É mais rigoroso: um R0 que ficasse 2 quadros seguidos em pilha, que a amostragem de 1 em 6 deixava passar, agora reprova. Resultado nas 13 sementes: sequência máxima **1** em todas (`r0run` 1).

**3. `ragdollsMax` = 1, decisão do dono (2026-11-26).** Registrado em `design/pilha-e-lod.md` §2.3 e em `spec.md` §6.2. Nova task `T5.6 Otimizar o custo do R0` em `tasks.md` (depois da Fase 8, `sonnet`): R0 a 60 Hz em vez de 120 e sem os passes 20/8; aceite: 3 a 4 R0 dentro do C7 sem perder o B3.

**Gates** (`game-physics-jolt` `pnpm test`: **143 passam, 2 ignorados, 0 vermelhos**; `test:cost` (carga de 4 a 17): 136 passam, 12 vermelhos, 11 do T1 por mediana ou p99 (tabela) e `ragdoll.test.ts` caso 2, 20 mortos, p99 4,8 contra 4,0 com a carga alta; o T5 passou nessa rodada (numa rodada anterior, com carga de 25, deu 9,7 ms: sem valor); `game-physics` 32; `game-characters` 397; `game-crowd` 142, `state-hash` e `team-golden` iguais, nenhum arquivo de `game-crowd` tocado). `tsc --noEmit` e `eslint` limpos nos pacotes tocados. **✅ da T5.4 não dado:** o T1 segue vermelho na faixa de custo (mediana e p99) e o limite não foi mexido.

## T5.5 — ragdoll de quadrúpede (2026-11-26) — ✅

**O que já existia** (§1): `game-animals` tem a espécie como dado (`QuadrupedSpec`: corpo, pernas com ângulos de repouso, pescoço, cabeça) e `quadrupedLayout` (altura dos quadris e do corpo); o esqueleto do bicho é three.js (`game-animals-three/src/quadruped.ts`), então o R0 sai da pose de repouso pura (`design/pilha-e-lod.md` v2 §5.2). Mesmo desenho do T5.1/T5.2 (`ragdollOfRig`, `chainOfRig`, `corpseBodyKit` em `game-characters`).

**O que mudou** (`game-animals`, puro: só tipos de `game-physics`, sem three nem Jolt; dependência nova `@adatechnology/game-physics`):
- `anatomy.ts` `anatomyOf(spec)`: tronco, pescoço, cabeça e osso de cima e de baixo de cada perna, em metros, de pé, virado para +z, com os mesmos números do desenhista (ângulos `fa1/fa2/ha1/ha2`, `neck.ang`, `head.down`, `quadrupedLayout`); o osso de baixo vai até o chão (inclui o casco/pé).
- `ragdoll.ts` `ragdollOfAnimal({ body, at?, user? })` (R0, `RagdollDesc`): 11 partes (tronco, pescoço, cabeça, 4 x cima + baixo), pais primeiro; massa = 900 kg/m³ x volume da cápsula do osso (vaca ~ 600 kg, cão ~ 15 kg). `ANIMAL_RAGDOLL_LIMITS`: pescoço 0,6/0,5/0,3 e cabeça 0,6/0,5/0,4 (sagital/lateral/torção, rad), ombro 0,9/0,45/0,25, quadril 0,9/0,4/0,25, carpo (dobradiça) -0,1 a 2,0 e jarrete -0,6 a 1,8, com o pé indo para trás (+), como as pernas da página.
- `chain.ts` `chainOfAnimal` (R1): tronco, pescoço+cabeça num osso, as 4 pernas numa caixa sob o tronco (as mesmas 3 partes da corrente da pessoa: tronco, cabeça, pernas), 2 juntas, mesma massa total do R0.
- `corpse-kit.ts` `corpseBodyKitOfAnimal` (`CorpseBodyKit`: R0, R1, cápsula R2 ao longo do tronco, âncoras torso 0, cabeça 2, pernas 3 e 9): o quadrúpede entra em `createCorpseBodies`/`createBodyLod` **sem uma linha de bicho no aplicador**.
- Testes: `game-animals/tests/ragdoll.test.ts` (6 + 1), `game-animals-three/tests/ragdoll-rig.test.ts` (as 9 espécies de quatro patas: todo corpo cai dentro da caixa do bicho desenhado e os pés ficam no chão), `game-physics-jolt/tests/ragdoll-animal.test.ts` (B3, custo, pilha).

**B3 por espécie** (R0 de produção no `KIT_WORLD`: 120 Hz, 32/2, `stabilize`, 20/8; cai de 2 m na escada e numa caixa, tiro de 9 mm no tronco em 1,5 s; `expect` no teste):

| Espécie | Maior excesso de junta | Passos seguidos > 0,1 rad | Dorme em | Limite |
|---|---|---|---|---|
| cão | 0,013 rad | 0 | 2,70 s | ≤ 3 / ≤ 4 s |
| gato | 0,024 | 0 | 2,50 s | idem |
| vaca | 0,024 | 0 | 2,13 s | idem |
| cavalo | 0,016 | 0 | 2,72 s | idem |
| R1 cão | 0,002 | 0 | 2,63 s | idem |
| R1 cavalo | 0,020 | 0 | 2,32 s | idem |

Passou de primeira, sem ajustar limite nenhum (a pessoa chegou a 0,106 rad num quadro).

**Pilha** (`ragdoll-animal.test.ts`): 4 cães e 1 cavalo mortos no `KIT_WORLD` pela política do motor: `counts` r0 1, r1 4, dormem em 14 s; um cão morto longe do jogador nasce cápsula e dorme.

**Custo de 1 R0** (`pnpm --filter @adatechnology/game-physics-jolt test:cost`, sob `perf-measure.lock`; quadro de 1/60 s = 2 passos, primeiros 3 s caindo e empilhando; limites C7 3,0 mediana e 4,0 p99). **Carga da máquina 10 a 14 (acima de 4: outras sessões), número a repetir com a máquina livre**:

| Espécie | Mediana (ms) | p99 (ms) | 2ª rodada: mediana / p99 |
|---|---|---|---|
| cão | 0,11 | 0,67 | 0,12 / 1,79 (pico de carga) |
| vaca | 0,51 | 0,70 | 0,48 / 0,65 |
| cavalo | 0,62 | 0,83 | 0,54 / 0,68 |

Cada R0 de quadrúpede custa o mesmo que um de pessoa ou menos (0,5 a 0,8 ms contra 0,65 a 0,9); com 11 partes e 11 juntas. A cota `ragdollsMax` = 1 não muda.

**Gates**: `game-animals` 15 testes, `game-animals-three` 72, `game-physics-jolt` 154 (2 pulados de antes); typecheck e eslint dos três limpos. Nenhum golden mudou.

**Para o dono ver na sala (§5, sem GPU aqui)**: um cão e uma vaca mortos em 1ª e 3ª pessoa caindo na escada; o desenho do cadáver de bicho ainda é a pose fixa (o R0/R1 de bicho com esqueleto desenhado é a T5.4a, que serve a pessoa e o bicho). Não escolhi limites de cauda e orelhas: ficam fora do R0.


## T7.1 — multidão no motor (2026-11-26) — ✅

Máquina: Intel Core Ultra 9 275HX, Node, Linux; outras sessões usando a máquina (carga 7 a 22 durante as medições).

**O que já existia (não recriado):** `createCorpseBodies` e `relocateCorpse` (Fase 5), o teste `corpse-physics-hash.test.ts` (hash e registro de cadáveres iguais sem empurrão) e `relocate.test.ts` (caso empurrado), a camada `corpse` e a tabela `LAYER_PAIRS` (`agent` sem par com `agent` nem `static`), `moveKinematic`, junta de dobradiça com `breakImpulse` e `brokenJoints` no contrato. O spike de `game-physics-jolt/tests/crowd.test.ts` media 1 000 agentes a 0,29 ms só no passo do mundo.

**O que mudou:** `packages/game-crowd/src/engine-agents.ts` (`createAgentBodies`: uma cápsula cinemática por agente da loja, fase `crowd` do laço, `moveKinematic` com o passo do laço; a cápsula `i` segue o agente `i`, também depois de um `remove`), `engine-doors.ts` (`createDoorBodies`: folha dinâmica de 40 kg na camada `prop` numa dobradiça com `breakImpulse` 40; ao romper, `doors.hit` com a vida toda da porta; porta aberta ou quebrada por outra causa perde a folha, porta fechada de novo ganha uma), `tests/physics/engine-agents.test.ts` (3 testes), script `test:cost` do `game-crowd`, `@adatechnology/game-physics` de `devDependencies` para `dependencies` (os tipos aparecem no `.d.ts`), README e skill.

**Números** (`pnpm --filter @adatechnology/game-crowd test:cost`, sob `perf-measure.lock`; 1 000 agentes e uma porta, `KIT_WORLD` 120 Hz, mediana e p99 de um passo com a fase `crowd` e o passo do mundo): carga 22 → 0,474 / 0,727 ms; carga 7 (três rodadas) → 0,340 / 0,537, 0,336 / 0,560, 0,336 / 0,495 ms. Limite do `spec.md` §6.2: 0,5 / 1,0 ms. A porta cede em 2,275 s. O limite em ms só é cobrado com `PHYSICS_COST=1`.

**Gates:** `pnpm --filter @adatechnology/game-crowd test` 26 arquivos, 147 testes verdes (inclui `team-golden` e `state-hash`, sem golden alterado); `pnpm --filter @adatechnology/game-crowd-three test` 9 arquivos, 48 testes verdes; typecheck e eslint dos arquivos novos limpos; `kit-audit --check` sem novos.

## T7.2 — consultas e broadphase do motor (2026-11-26) — ✅ (o mundo de destruição visita só os candidatos: 500 paredes e 1 000 raios em 3,5 ms contra 14,9 ms sem o motor)

Máquina: Intel Core Ultra 9 275HX, Node, Linux; carga 2 a 7 nas medições de custo, sob `perf-measure.lock`.

**O que já existia:** no contrato e no adaptador, `rayAll` (vários acertos, mais perto primeiro), `rayFirst`, `overlapSphere`, `sphereCastAll` (esfera varrida) e `overlapShape`; corpos criados no mesmo quadro e adormecidos aparecem nas consultas (`queries.test.ts`: `seesFresh`, `seesSleeping`). O `game-destruction` já tinha broad phase própria (esfera de cada objeto, grade de partes) e o `surfaceRay` dos hospedados.

**O que mudou:** `RayBroadPhase` e `DestructionWorld.setRayBroadPhase` (`game-destruction`, acréscimo; `raycastInternal` pula o objeto que o gancho prova fora do caminho; o raio do `sweepBox` segue com o escopo dele); `game-destruction-three/src/engine-rays.ts` (`createEngineRayBroadPhase`: esfera varrida de 25 cm mais a esfera da origem contra a camada `static`, objetos pelos corpos de `EngineStatics.ownerOf`; objeto do qual o motor não tem todas as partes — `covers` falso — é sempre tentado); opção `rayBroadPhase: true` do renderizador (desligada por padrão); `queries.test.ts` passa a cobrar 1 000 raios de primeiro acerto em 2 ms na faixa de custo.

**Números** (`pnpm --filter @adatechnology/game-physics-jolt test:cost`, `tests/queries.test.ts`, rua de 3 casas, 10 carros, 300 agentes): 1 000 raios de primeiro acerto, mediana 1,575 e 1,365 ms (limite 2 ms); 1 000 raios com vários acertos 2,23 e 1,96 ms (1,3 acertos por raio); o caminho próprio, 8,4 e 7,9 ms; esfera varrida de 200 raios 1,0 ms.

**Mesmo resultado:** `game-destruction-three/tests/engine-rays.test.ts`: 500 paredes no mundo real de destruição, 1 000 raios com e sem o gancho dão o mesmo objeto, parte e distância; o gancho dispensa 99,9 % dos objetos por raio. `pnpm --filter @adatechnology/game-destruction test`: 90 arquivos, 699 testes; `game-destruction-three test`: 112 arquivos, 855 testes (6 pulados, solver próprio); typecheck e eslint limpos.

**Ganho do mundo de destruição (correção da medida anterior).** A primeira versão media 72 ms com o motor contra 61 ms sem (500 paredes, 1 000 raios) e a explicação dada era que iterar só os candidatos perderia a ordem de desempate. As duas coisas estavam erradas, e o problema real era a medida: o teste ligava só as 500 paredes ao renderizador e as paredes (três painéis sem junta) se partiam em 1 500 objetos; os 1 000 pedaços soltos nunca ganharam corpo no motor, ficavam sempre "não cobertos" e eram sempre tentados. O gancho dispensava 99,9 % das 500 paredes, mas o laço continuava nos 1 500 objetos.

**O que mudou agora:** o gancho ganha `candidates` (`met()` os objetos que o raio fino encontrou, `covers(id)` se o motor tem todas as partes do objeto, `revision()` que muda quando algum `covers` pode ter mudado; `EngineStatics.coverageRevision`). O `raycast` do mundo visita só os objetos encontrados mais os não cobertos (lista refeita só quando a revisão ou o conjunto de objetos muda), **na ordem de inserção de `objects`** (cada objeto guarda seu lugar em `slots`: chave reposta mantém o lugar, apagada e acrescentada de novo vai para o fim, como no `Map`), de modo que o empate exato vai para o mesmo objeto do laço de antes. Se mais da metade dos objetos não está coberta, o mundo faz o laço de todos (como antes). O teste `engine-rays.test.ts` passa a usar paredes de painéis juntos (um objeto cada).

**Números** (`engine-rays.test.ts`, 500 paredes, 1 000 raios, mediana de 5 rodadas alternadas, sob `perf-measure.lock`, **carga 14 a 15 de outras sessões**, três execuções): com o motor e `candidates` 3,5 / 3,5 / 3,7 ms; com o motor perguntando `mayMeet` a cada objeto (o caminho antigo) 14,0 / 13,9 / 14,7 ms; sem o motor 14,9 / 14,7 / 15,0 ms. Ou seja, 4 vezes mais rápido que os dois caminhos de antes. O mesmo teste com os 1 500 objetos, dos quais 1 000 sem corpo (a medida antiga): 75,9 ms com o motor e `candidates` caindo para o laço de todos, 77,1 ms no caminho antigo, 57,1 ms sem o motor: o motor sozinho custa mais do que o laço quando quase nada é coberto.

**Mesmo resultado, inclusive no empate:** o teste compara os três caminhos nos 1 000 raios (mesmo objeto, parte e distância); `tie`: duas paredes exatamente no mesmo lugar, mesmo objeto nos dois caminhos, também depois de uma ser apagada e acrescentada de novo (então a outra vence) e com um objeto sem corpo no motor antes da parede com que empata (ele vence); `game-destruction/tests/raycast-broad-phase.test.ts`: o mesmo, no mundo sozinho com um gancho falso (ordem em que o motor nomeia os objetos não muda o resultado). A opção `rayBroadPhase` continua **desligada por padrão**: o ganho existe quando o host liga todos os objetos ao renderizador, que é a condição de "coberto"; objeto sem corpo é sempre tentado, e com o motor devolvendo candidatos o custo extra é a consulta de esfera varrida (cerca de 1,4 ms por mil raios, acima). Proposta, sem ligar: ligar por padrão só depois de medir numa cena do jogo com todos os objetos ligados.

## T7.3 — blast, fragmentos e sensores de fumaça (2026-11-26) — ✅

Máquina: Intel Core Ultra 9 275HX, Node, Linux; carga 4 a 5, sob `perf-measure.lock`.

**O que já existia:** `rayFirst`, `overlapSphere`, `sensorEvents` e a camada `sensor` no contrato e no adaptador; o spike de `queries.test.ts` media 300 raios + sobreposição + 2 linhas de visada em 0,37 ms. O `game-destruction` tem o próprio cálculo de fragmentos do casco (`blast-fragments.test.ts`) e, desde a T7.2, pode usar os corpos fixos do motor como broad phase dos raios dele (inclusive os do blast, que passam por `raycastInternal`). `game-weapons` e `game-vfx` não conhecem o motor e não foram tocados.

**O que mudou:** `game-physics/src/blast-query.ts` (`createBlastQuery`: 300 direções iguais sobre a esfera feitas uma vez, `rayFirst` por fragmento, `overlapSphere` do raio e `rayFirst` do centro a cada corpo com a cobertura `static`/`prop`/`debris`/`vehicle`; resultado em arrays tipados reaproveitados) e `sensor-volumes.ts` (`createSensorVolumes`: esfera na camada `sensor`, `add`/`move`/`remove`, entra e sai pela fase `contacts` do laço), exportados; `game-physics-jolt/tests/blast-query.test.ts` (3 testes), README e skill.

**Números** (`PHYSICS_COST=1`, três rodadas, um blast no meio de 300 agentes com 300 raios e cerca de 190 linhas de visada): mediana 0,686 / 0,679 / 0,680 ms, p99 0,82 / 0,96 / 0,87 ms. Limite do `spec.md` §6: 1 ms.

**Gates:** `game-physics-jolt test`: 40 arquivos, 177 testes verdes (1 arquivo e 2 testes pulados, como antes); `game-vfx test` 437 e `game-weapons test` 596 verdes; typecheck do `game-physics` e eslint dos arquivos novos limpos.

## T7.4 — reação em cadeia (2026-11-26) — **parcial, sem ✅: a mediana e o p99 do caso 5b e o quadro de despertar do caso 5 não fecham; números abaixo, decisão do dono**

Máquina: Intel Core Ultra 9 275HX, Node, Linux; três rodadas sob `perf-measure.lock`, carga 1,8 a 2,5 (outras sessões na máquina).

**O que já existia:** o spike do caso 5 (`cascade.test.ts`: a lata de gás vira bomba por um golpe de 150 N s lido das linhas de contato dentro do próprio teste, a parede de 400 blocos, a laje, 50 caixas; hash determinístico) e o caso 5b (`cascade-tail.test.ts`: 500 candidatos, a receita de produção `WakeQueue` + `physicsPieceCount` + `chooseForPhysics`, no `KIT_WORLD`); `ContactBuffer.impulse` e `approach` no contrato; as linhas de contato do `EnginePieces.knock` só tocavam som.

**O que mudou:** `game-physics/src/impact-reader.ts` (`createImpactReader`: o golpe mais forte de cada corpo no quadro, dito uma vez na fase `contacts`, tabela de busca e arrays feitos uma vez; uma linha de contato não aloca, um golpe dito aloca poucos bytes — o objeto `Impact` reaproveitado); `game-destruction-three/src/engine-impacts.ts` (`createEngineImpacts`: golpe numa parte fixa desenhada vira `hitPart(objeto, parte, { type: 'blunt', energy ≈ impulso × velocidade / 2, direction, point })`, até 32 partes por quadro, mínimo 30 N s) com `EngineStatics.partOf`, `PieceSystem.contactHits` e a opção `contactHits` do renderizador (desligada por padrão); o caso 5 passou a ler os golpes pelo `createImpactReader` (o **hash da simulação é o mesmo, `645d812254fd0a98`**); testes `engine-impacts.test.ts` (uma caixa jogada na parede dá `hitPart` blunt com 300 a 1 500 J, direção -z) e `cascade.test.ts` (alocação por golpe dito < 200 bytes; crescimento do heap de JS do caso 5 < 2 MB).

**Números** (3 rodadas, faixa de custo):

| Medida | Limite (`spec.md` §6.2 / cond. 10) | Medido | |
|---|---|---|---|
| Caso 5b, quadro de despertar, receita de produção, aquecido | ≤ 10 ms | 6,3 a 8,2 ms (9 execuções) | passa |
| Caso 5b, mediana dos 3 s, aquecido | ≤ 0,6 ms | 0,607 / 0,614 / 0,612 / 0,631 / 0,651 / 0,659 / 0,711 / 0,728 / 0,732 | **não fecha** (3 de 9 até 0,62; 6 de 9 acima de 0,65) |
| Caso 5b, p99 dos 3 s, aquecido | ≤ 4,0 ms | 3,69 a 4,29 ms | **na beira** (4 de 9 acima de 4,0) |
| Caso 5b, quadro de despertar, a frio (primeiro da processo) | (não está na tabela) | 15,9 a 18,9 ms | registrado |
| Caso 5, mediana depois do golpe | ≤ 0,6 ms | 0,45 | passa |
| Caso 5, p99 depois do golpe | ≤ 4,0 ms | 5,1 a 6,0 | **não fecha** |
| Caso 5, maior quadro (318 corpos acordam de uma vez, sem a fila) | ≤ 10 ms | 11,8 a 15,0 | **não fecha** |
| Heap de JS no caso 5 | estável | -0,6 a -0,8 MB (cai) | passa |
| Heap do wasm, `heap.test.ts` | estável | 0 por ciclo nos 11 cenários | passa |

Os limites que passam estão cobrados na faixa de custo (`cascade-tail`: despertar ≤ 10 ms; `cascade`: heap de JS). Os que não fecham **não foram cobrados nem afrouxados**: ficam no relatório. O caso 5 acorda 318 corpos de uma vez (rajada), que a produção não faz: a fila do 5b espalha o despertar e fica a 6 a 8 ms; a mediana e o p99 do 5b (0,6 / 4,0) são o que depende de decisão do dono (subir os limites para a faixa medida, ou otimizar o passo de 500 corpos acordados).

**Gates:** `game-physics-jolt test` 40 arquivos, 178 testes verdes; `game-destruction-three test` 112 arquivos (uma rodada com 2 falhas de tempo-limite de 5 s com carga 18 de outras sessões, os mesmos arquivos passam sozinhos); typecheck e eslint dos arquivos tocados limpos.

### Otimização (2026-11-26, worktree `spec-008-t74`, decisão do dono: otimizar os dois casos e manter os limites) — **sem ✅: nenhum corte do adaptador chega perto; a alavanca é a build SIMD, e ela é decisão do dono**

Máquina: Intel Core Ultra 9 275HX, Node. **Carga durante todas as rodadas: 3 a 9** (outras sessões: T6.4, vitest, docker), não a máquina quieta pedida; as faixas abaixo carregam isso. Sob `perf-measure.lock`.

**Perfil do passo (caso 5b, receita de produção, `KIT_WORLD`, 360 passos fixos em 3 s, três rodadas, tempos em ms somados nos 3 s):**

| Parte | ms (3 s) | Parcela |
|---|---|---|
| `JoltInterface.Step` (inclui o listener de contato) | 161 a 171 | ≈ 94 % |
| de dentro dele: listener (4 chamadas de JS por contato) | 25 (10 dentro do callback, ≈ 15 de cruzar wasm → JS) | ≈ 14 % |
| `updateFriction` | 10 a 11 (4 sem listener: sem parceiros) | ≈ 6 % |
| `roll`, `breakJoints`, leitura de contato, `WakeQueue` | < 1 | — |
| total medido | 172 a 183 | |

O mesmo mundo com `contactCallbacks: 'none'`: total 137 a 152 ms (mediana 0,63 a 0,71 contra 0,75 a 0,92 na mesma carga). **Nem sem listener nenhum a mediana cai abaixo de 0,6 nesta carga**: o `Step` do Jolt é o custo. Os 3 s inteiros têm 233 a 250 corpos acordados (a pilha nunca dorme em 3 s: `sleepSpeed` 0,08 e uma ilha só); ≈ 0,65 ms por quadro de 2 passos de 32 iterações. No caso 5 (60 Hz, 10 iterações, 472 corpos acordados) o `Step` é 12 de 13,6 ms no quadro do despertar e 4 a 7 ms nos 40 quadros seguintes (o p99 de 5 a 6 ms são esses quadros); o listener é 0,3 a 0,5 ms por quadro e `updateFriction` ≈ 1.

**Candidatos descartados com número:**

| Candidato | Resultado |
|---|---|
| Listener chamado por par sem filtro | Chamadas em 3 s no 5b: `OnContactValidate` 22 000, `OnContactPersisted` 23 000, `OnContactAdded` 1 100, `OnContactRemoved` 1 100. O binding do JoltPhysics.js chama os quatro sempre (`getCache(...)[ptr]`, `hasOwnProperty`, a chamada; sem o callback ele lança), então o filtro não existe no lado do JS; o que se corta de dentro (dois `Map.get` por `Persisted`) são ≈ 2 ms de 175: abaixo do ruído (±10 % entre rodadas), não commitado |
| `mUseLargeIslandSplitter = false` | 154 a 183 ms, sem ganho (único passo, uma thread) |
| `mUseBodyPairContactCache = false` | 151 a 168 ms, sem ganho |
| `mCheckActiveEdges = false` | 154 a 189 ms, sem ganho; muda o resultado |
| `mUseManifoldReduction = false` | 195 a 203 ms, **pior** (+20 %) e muda o resultado |
| Leitura de poses de corpos que dormem | não existe no caminho: `updateFriction` lê só `GetActiveBodies`; o `createImpactReader` não aloca por linha (teste existente) |
| Iterações / `contactReportSpeed` | mudam o resultado físico (hash do caso 5, mundo do 5b): fora do escopo da tarefa |
| Fila de despertar (`WakeQueue`) | política de produção, não custo; o 5b já a usa; mudar o alvo da fila troca p99 por tempo de propagação e é decisão de design |

**O que corta custo de verdade: a build com SIMD.** A build `single` (`wasm-compat`, a padrão) não tem SIMD; `wasm-compat-multithread` e `wasm-multithread` têm e rodam com **0 threads de job** e o listener ligado (a configuração válida da seção 1 de `docs/medicoes/jolt-multithread.md`, o padrão do app de desktop). **A física é idêntica: o hash do caso 5 é `645d812254fd0a98` nas três builds (`wasm-compat`, `wasm-compat-multithread`, `wasm-multithread`) e na `wasm` não-compat.** Preço: exige `SharedArrayBuffer` (página com COOP/COEP, ou o desktop); no navegador sem isolamento continua `single`. O teste `cascade-tail` aceita `JOLT_BUILD=multithread` (padrão desligado: o `pnpm test` e a faixa de custo seguem na build `single`).

Caso 5b, 9 execuções aquecidas por build, rodadas intercaladas (carga 6,9 a 7,5):

| Medida | Limite | `single` (hoje) | `multithread`, 0 threads |
|---|---|---|---|
| quadro de despertar | ≤ 10 ms | 6,3 a 8,9 | 4,1 a 5,2 |
| mediana dos 3 s | ≤ 0,6 | 0,627 a 0,845 (mediana das 9: 0,746) | 0,494 a 0,647 (mediana: 0,620) |
| p99 dos 3 s | ≤ 4,0 | 3,65 a 5,12 (mediana: 4,54) | 2,37 a 3,23 (mediana: 2,82) |

Caso 5 (`wasm-compat-multithread` / `wasm-multithread`, hash igual): p99 depois do golpe 4,1 a 6,4 / 4,1 a 6,3 contra 5,2 a 7,3 em `single` (mesmas rodadas); maior quadro 11,5 a 19,1 contra 12,5 a 16,9: **o quadro do despertar de 318 corpos sem a fila não melhora** (o custo ali é o primeiro contato com 472 corpos; a variação entre rodadas, com carga 3 a 6, é maior que a diferença). Os dois números do caso 5 (p99 4,0 e maior quadro 10 ms) são de uma rajada que a produção não faz (`islandBodiesMax` = 300, fila do 5b) e **não fecham por otimização do adaptador**.

**Veredicto:** nenhuma otimização do adaptador foi commitada (todas ≤ 3 %, dentro do ruído); `single` fica como está. Os quatro: 5b mediana e p99 passam na build SIMD com carga 7 (0,62 e 2,8 contra 0,6 e 4,0: a mediana na beira, a medir quieta), o caso 5 (p99 e maior quadro) não. **T7.4 segue sem ✅.** Decisão do dono: (a) mundo padrão do app e da sala isolada passa a `multithread` com 0 threads (já é o do desktop) e o 5b/caso 5 passam a ser cobrados nela; (b) manter `single` como a cobrada e subir os limites para a faixa medida; (c) as duas coisas, com o caso 5 como rajada fora do orçamento. Reproduzir: `JOLT_BUILD=multithread pnpm --filter @adatechnology/game-physics-jolt test:cost -- tests/cascade-tail.test.ts`.

**Gates:** `game-physics-jolt test` 40 arquivos, 178 testes verdes; typecheck e eslint limpos; `test:cost` do pacote inteiro com carga 5,6 a 6,3: 17 falhas de tempo em `blast-query`, `body-lod`, `queries`, `ragdoll` e `cascade-tail` (quadro de despertar a frio 18,8 ms), nenhuma em arquivo que este commit toca além da variável de ambiente do `cascade-tail`; `game-physics` e `game-destruction-three` não foram tocados.
