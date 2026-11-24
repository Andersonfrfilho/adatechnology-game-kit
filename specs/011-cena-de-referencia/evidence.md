# Evidência da spec 011

## T1.3 — createKitWorld

- `pnpm --filter @adatechnology/game-kit-defaults typecheck`: 0 erros.
- `pnpm --filter @adatechnology/game-kit-defaults test`: 10 arquivos, 31 testes passando (15 novos: ordem do passo, padrões do host, mundo sem GPU).
- `eslint packages/game-kit-defaults/src packages/game-kit-defaults/tests`: 0 problemas (`eslint.config.mjs`: `world/light.ts` fica fora da regra de luzes, como a sala).
- `pnpm check:layers`: sem violações novas (294 conhecidas, as mesmas).
- `node tools/kit-audit/audit.mjs --check`: 0 novos, `own-frame-clock` 0 novos, `must-drain` 0 novas filas.
- `node tools/check-packages.mjs`: ok (66 pacotes). `pnpm --filter @adatechnology/game-kit-defaults build`: `dist/world.js` e `dist/world.d.ts` gerados.
- Código copiado da sala (a T1.5 remove a cópia da sala): `blast-pacing.ts`, `simulation-phases.ts`, `frame-queues.ts`, `sun-shadow.ts`, `graphics.ts` (`createRoomGraphics`), `occlusion.ts` (`world-occlusion.ts`; sai quando a PR da T1.2, `createRaycastOcclusion` do `game-audio`, entrar), a lógica do sol (`arena.ts`), do chão (`showGroundBlow`, fogo no chão) e do aquecimento (`room.ts`).
