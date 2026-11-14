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
