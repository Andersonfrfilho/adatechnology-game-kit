# Tasks — Spec 005

Leia `spec.md` e `plan.md` antes de começar. Cada task é aditiva e segue a regra de compatibilidade D2: nada quebra para o jogo. Toda
task fecha com os gates do fim deste arquivo e com um commit isolado.

## Fase 0 — Decisões
> 🤖 Modelo: `opus`

- T0.1 🧠 Plano de arquitetura (`plan.md`, D1 a D9). Feito em 2026-10-31.

## Fase 1 — Cercas em modo aviso (pode começar já, a partir de `main`)
> 🤖 Modelo: `sonnet` (T1.2, T1.3 e T1.4 → `haiku`)

- T1.1 `.dependency-cruiser.cjs` com as camadas D1. As regras são `core-no-three`, `core-not-content`, `content-not-adapter`,
  `adapter-not-content`, `no-domain-adapter-to-adapter`, `nothing-imports-test-room`, `no-deep-import`, `no-circular` e
  `testing-only-from-testing`.
  - Script `pnpm check:layers`; a baseline das violações de hoje fica em `.dependency-cruiser-known-violations.json`.
  - O CI roda no modo "nenhuma violação **nova**".
  - Aceite: o comando sai com 0 e um import proibido de teste o faz falhar.
- T1.2 Política de versões D9:
  - three como peer `^0.160.0` em todo pacote;
  - deps internas em `workspace:^`;
  - flag `onlyUpdatePeerDependentsWhenOutOfRange` no `.changeset/config.json`;
  - script `pnpm check:packages` (`tools/check-packages.mjs`) que cobra as três coisas.
  - Aceite: `grep -rn '">=0.160' packages/*/package.json` vazio, `pnpm check:packages` sai com 0, `pnpm build && pnpm test` passam.
- T1.3 Deps declaradas e não usadas (item 19 da análise): remover, ou mover para dev.
  - Aceite: o `check:packages` ganha a verificação "declarada = importada" e passa.
- T1.4 ESLint: `no-restricted-syntax` contra `new *.PointLight`/`SpotLight` fora de `game-render-three` e `game-vfx-three`, em modo
  `warn` até a Fase 4; `max-lines` 1500 como `warn` em `packages/*/src`.
  - Aceite: `pnpm lint` sai com 0 e mostra os avisos esperados.
- T1.5 CI: um job `architecture` que roda `check:layers` e `check:packages`.

## Fase 2 — `./testing` (depois da Fase 1)
> 🤖 Modelo: `haiku`, um pacote por commit (T2.2 → `sonnet`)

- T2.1 Para cada pacote com `test-area/`, `bench/` ou `scenarios` no `.`: subpath `./testing` no `exports` e no tsup, e o `.` deixa
  de reexportar. O símbolo antigo no `.` fica `@deprecated`, reexportado do `./testing`, até a próxima major. Os exemplos passam a
  importar de `./testing`.
  - Aceite: `grep -E "test-area|bench" packages/<pkg>/src/index.ts` só acha os reexports deprecados; exemplos compilam.
- T2.2 Com a área de teste fora do `.`, cortar as dependências `-three` → `-three` que só ela usava:
  - `furnitureSpec` vira dependência do `./testing`;
  - `createCord` vai para `game-shapes-three`;
  - item ↔ arma (`buildItem`) passa a ser injetado.
  - Aceite: `no-domain-adapter-to-adapter` sem violação nova e baseline menor.

## Fase 3 — Conteúdo por opção e preset padrão
> 🤖 Modelo: `sonnet`

- T3.1 Criar `game-kit-defaults` (L5), com o README e a tabela de presets.
- T3.2 `game-urban`: providers recebem frota e espécies por opção; `defaultUrbanProviders()` vai para o preset. Os imports antigos
  ficam `@deprecated`.
- T3.3 `game-vehicles-three` (paletas e medidas), `game-floorplan-three` (móveis) e `game-characters-three` (clipes) recebem o
  conteúdo por opção, com o padrão no preset.
- Aceite da fase: `core-not-content` e `adapter-not-content` sem violação; goldens iguais.

## Fase 4 — Dono do quadro e da GPU (depois do merge de `perf/explosion-frame-budget`)
> 🤖 Modelo: `sonnet` (T4.1 e T4.3 são 🧠 → `opus` desenha a API, `architect` valida antes de implementar)

- T4.1 🧠 `game-runtime`: agendador com as fases D3, passo fixo, `scheduler.budget` e `ModuleHost.onFrame(fn, { phase, order })`.
  - Testes: ordem das fases, subpassos com teto, orçamento repartido e com sobra carregada.
- T4.2 Migrar as filas adiadas para o `scheduler.budget`: vozes do `game-audio`, `eventBudgetMs` do `game-destruction-three` e
  `creaseTask` do `game-vehicles`.
- T4.3 🧠 `game-render-three`: `LightBudget`, `ProgramWarmup`, pools de geometria e de material e o tipo `ThreeLib`.
- T4.4 Migrar as luzes para o `LightBudget`, um pacote por commit:
  - pool do `game-vfx-three`;
  - luzes de cômodo do `game-floorplan-three`;
  - foguete de `game-weapons-three/src/fx/heavy.ts`;
  - lâmpadas de `game-interactables-three/src/mesh.ts`;
  - sinalizador de `game-characters-three/.../hand-items.ts`;
  - faróis de `game-weather-three`;
  - orçamento do `game-urban-three`.
  - Fim da task: o lint de luz vira `error`.
- T4.5 Partículas de `game-vehicles` e de `game-weapons-three/src/fx` passam pelo `host.effects` e pelo pool de material. Sai o
  `pinPrograms` da sala.
- T4.6 Os pré-aquecimentos (`warmUpProbes`) dos adaptadores se registram no `ProgramWarmup`.
- Aceite da fase: `perf.mjs` (GPU e CI) com 0 programas em todas as fases e nenhum orçamento a mais estourado do que antes.

## Fase 5 — Contratos
> 🤖 Modelo: `sonnet` (um pacote por commit)

- T5.1 Contrato de custo D8 no `checkDestructible`, mais a medição em todos os `DestructibleImpl` do kit.
- T5.2 Catálogo por instância (D5): `game-floorplan`, `game-destruction` (assemblies), `game-items-three`, `game-shapes` e
  `game-weapons-three`. O global fica `@deprecated`.
  - Aceite: em cada um, um teste com dois mundos e packs diferentes na mesma página, sem vazamento.
- T5.3 Fallbacks silenciosos (item 12 da análise): quem cria um mundo de efeitos ou um motor de áudio próprio passa a avisar. Na
  sala, os fallbacks ficam desligados.

## Fase 6 — A sala vira host (depois da Fase 4)
> 🤖 Modelo: `sonnet` (T6.1 🧠 → revisão de `architect` em `opus` antes)

- T6.1 🧠 Desenho do corte do `room.ts`: `host-services`, `scheduler` (o `game-runtime`), `player-rig`, `areas` e `scenarios`.
- T6.2 Arsenal e explosivos saem da sala para o módulo `game-weapons-three/testing`, carregado com `room.loadModule`.
- T6.3 Fluidos e terreno viram módulos.
- T6.4 Partir o `room.ts` conforme a T6.1.
- Aceite da fase: `wc -l room.ts` < 1.200; deps da sala só `game-contracts`, `game-runtime`, `game-render-three` e `game-audio`;
  `examples/test-room/test.mjs` e `perf.mjs` passam.

## Fase 7 — `game-vehicles` só regra
> 🤖 Modelo: `sonnet`, um subsistema por PR

- T7.1 a T7.n: a geometria sai para `game-vehicles-three`, um subsistema por vez: partículas → luzes → carroceria → vidro → peças
  soltas. O `api.ts` perde os `any`.
- Aceite: `grep -l "THREE\." packages/game-vehicles/src` cai a cada PR até chegar a 0; goldens da frota iguais.

## Fase 8 — Publicação e fechamento
> 🤖 Modelo: `sonnet` (T8.3 → `haiku`; T8.4 🧠 → `opus`)

- T8.1 IIFE com externos via `globalThis` (D9).
- T8.2 `publint` e `@arethetypeswrong/cli` no `check:packages`.
- T8.3 As regras do depcruise passam a `error`, sem baseline.
- T8.4 🧠 Rodar de novo a análise de arquitetura e atualizar a nota em `docs/arquitetura-plug-sdks.md`. A meta é A1–A14 todos ✅.

## Gates de cada task

- `pnpm -r typecheck` e os testes dos pacotes tocados.
- `pnpm check:layers` sem violação nova (a partir da T1.1).
- Goldens dos pacotes tocados iguais.
- Nas Fases 4 e 6: `examples/test-room/perf.mjs`.
- Toda mudança de corpo, animação ou arma na mão é validada em todas as câmeras (`CLAUDE.md` §5).
- Commit isolado por task, com o registro em `evidence.md`.

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/005-camadas-e-quadro/ (leia spec.md, plan.md e tasks.md antes de começar).
Uma task por vez, na ordem do tasks.md, num worktree próprio (a pasta principal é compartilhada por outras sessões; nunca troque
de branch nela). Fase 1 pode começar já; Fases 4 e 6 só depois do merge de perf/explosion-frame-budget.
Modelos: Fase 1 → executor model=sonnet (T1.2–T1.4 haiku) · Fase 2 → executor model=haiku (T2.2 sonnet) ·
Fase 3 → executor model=sonnet · Fase 4 → executor model=sonnet, T4.1 e T4.3 🧠 → opus desenha e architect valida antes ·
Fase 5 → executor model=sonnet · Fase 6 → sonnet, T6.1 🧠 → architect (opus) antes · Fase 7 → sonnet, um subsistema por PR ·
Fase 8 → sonnet (T8.3 haiku, T8.4 🧠 opus) · revisão final de cada fase → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com pnpm -r typecheck + testes dos pacotes tocados + pnpm check:layers sem violação nova + goldens iguais +
commit isolado, evidência em evidence.md. Regra D2: nenhuma API pública some; a antiga fica @deprecated.
Pare e pergunte antes de: publicar pacote no npm, remover API (major), deploy, qualquer [NEEDS CLARIFICATION].
```
