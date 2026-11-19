# Evidence — Spec 011

## T1.1 — Desenho do host do mundo (proposta)

- `design-host.md`: a sala mistura três camadas (mundo ~600 linhas, ação do jogador ~1.500, sala ~3.500); o motor Jolt e o coordenador de
  workers são montados pela página (`examples/test-room/build.mjs`, `src/main.js`), fora do SDK.
- Achado que muda o plano: a ação do jogador (tiro, golpe, explosivos, item na mão) mora no `room.ts`. Entrou a Fase 1b (T1.6–T1.9).
- Validação pelo `architect` (2026-11-18): **aprovado com mudanças**. Nove obrigatórias aplicadas no `design-host.md` ([A1]–[A9]): sol e gráficos no host, regras de mundo e lista de peças no host, eventos do renderizador e chão preguiçoso, pontos de registro ordenados, opções do laço e do desenho, `reset`, entrada `/world` nas checagens, ação do jogador reestimada em 3.000–4.000 linhas com registro de objetos (T1.6a) e desenho em L5, e a T1.3 depois da T1.1 e da T2.1 da spec 010.

## T1.2 — Oclusão de áudio do mundo vai para o `game-audio`

- `packages/game-test-room/src/world-occlusion.ts` → `packages/game-audio/src/raycast-occlusion.ts` (`git mv`), exportado como
  `createRaycastOcclusion`, com `RaycastOcclusionWorld`, `RaycastOcclusionOptions`, `OcclusionRayFilter` e `OCCLUDER_MIN_RADIUS`.
- O filtro do raio é tipo estrutural local: o `game-audio` continua dependendo só do `game-contracts`.
- O arquivo não era exportado pelo `index` da sala: sem reexportação deprecada. A sala importa do `game-audio` (`room.ts` 5.620 → 5.619).
- Testes: os de mundo falso foram para `packages/game-audio/tests/raycast-occlusion.test.ts`; o de mundo de destruição de verdade ficou em
  `packages/game-test-room/tests/world-occlusion.test.ts`, importando do pacote.
- `pnpm --filter @adatechnology/game-audio typecheck` e `... game-test-room typecheck`: passam.
- `pnpm --filter @adatechnology/game-audio test`: 24 arquivos, 273 testes, todos passam.
- `pnpm --filter @adatechnology/game-test-room test`: 60 arquivos, 463 testes, todos passam.
- `pnpm check:layers`: 0 violações novas, 297 conhecidas (igual à `origin/main`).
- `node tools/kit-audit/audit.mjs --check`: 0 novos, 11 pendentes conhecidos, 15 permitidos.
- ESLint nos arquivos tocados: 0 erros; 1 aviso `max-lines` no `room.ts`, que já existia.

## [A7] Subpastas de `exports` checadas pelo código-fonte

- `.dependency-cruiser.cjs`: o tsconfig gerado mapeia cada subpasta de `exports` (`./world`, `./fitted`, `./testing`...) para
  `src/<subpasta>.ts` ou `src/<subpasta>/index.ts`. Antes só o nome raiz ia para `src`, e as subpastas caíam no `dist` (`doNotFollow`).
- 27 subpastas passam a ser checadas; `pnpm check:layers`: 0 violações novas, 297 conhecidas.

## T1.6a — Registro de objetos do mundo e porto de relato

- `@adatechnology/game-kit-defaults/world` (entrada nova; `exports`, `tsup` com `.d.ts` próprio): `createObjectRegistry` (interface de `Map`
  mais `hold`, `release`, `held`, `heldId` e eventos `added`/`removed`/`held`/`released`) e `createReportPort` (`WorldReport` tipado).
- Sala: `entries` é o registro; o `heldEntry` solto virou `entries.held` (`hold` no pegar, `release` no soltar); `action()` emite pelo porto e a
  sala assina e grava no log com os mesmos campos na mesma ordem. `room.ts` continua com 5.619 linhas.
- A sala passa a depender do `game-kit-defaults` e importa só a entrada `/world`, que não puxa conteúdo.
- `pnpm --filter @adatechnology/game-kit-defaults typecheck` e `... game-test-room typecheck`: passam.
- `pnpm --filter @adatechnology/game-kit-defaults test`: 7 arquivos, 16 testes (5 novos em `tests/world-objects.test.ts`).
- `pnpm --filter @adatechnology/game-test-room test`: 60 arquivos, 463 testes, todos passam.
- `pnpm check:layers`: 0 novas, 297 conhecidas. `pnpm check:packages`: ok (66). `kit-audit --check`: 0 novos.
- Rodado depois da régua da spec 010 terminar (nada pesado durante a medição dela).
