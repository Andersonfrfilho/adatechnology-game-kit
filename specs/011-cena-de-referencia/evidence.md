# Evidence — Spec 011

## T1.1 — Desenho do host do mundo (proposta)

- `design-host.md`: a sala mistura três camadas (mundo ~600 linhas, ação do jogador ~1.500, sala ~3.500); o motor Jolt e o coordenador de
  workers são montados pela página (`examples/test-room/build.mjs`, `src/main.js`), fora do SDK.
- Achado que muda o plano: a ação do jogador (tiro, golpe, explosivos, item na mão) mora no `room.ts`. Entrou a Fase 1b (T1.6–T1.9).
- Validação pelo `architect`: pendente no momento deste registro.

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
