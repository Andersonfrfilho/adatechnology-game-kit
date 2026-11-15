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
