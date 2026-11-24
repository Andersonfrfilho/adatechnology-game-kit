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

## T0.1 — Passo 0 (2026-11-24)

- Documentos da spec trazidos da `docs/spec-011-revisao` (142 commits atrás) para cima da `origin/main` `923fa511f` e corrigidos: decisões N1
  a N11 do dono na §9; cenário `caos` nas §3.1, §4.2 e §5; quadro da M67 depois da spec 018 (f0 ~20 ms, volta ~18 ms, PRs #443 a #448) e o
  padrão que o host precisa ligar (L18); specs 012 a 016 na `main` (L7); portão de custo por peça (`--cost-check`, #451) nos gates; a régua da
  explosão da rodada diária só com C4 (L11); lacunas novas do `caos` (L15 a L17); linhas do `room.ts` (5.615) conferidas por diff contra a
  versão de 2026-11-18 (5.620) no `tasks.md` e no `design-host.md`; pré-requisitos da 010 para a T1.3 marcados como feitos.

### Estado da sala antes de mexer (2026-11-24, `origin/main` `923fa511f`)

Máquina: helios, RTX 5070 Laptop, driver 620.73.04. Brutos em `~/.cache/adatechnology-game-kit/medicoes/2026-11-24-spec011-passo0/`.
Página da sala `examples/test-room/dist/test-room.html` sha256 `69fe81e810fd…`.

- **`pnpm check:room`** (sob o `flock`, 2.609 s): **175 passam, 3 reprovam**: `explosives_push_p13`, `explosives_push_grenade` e "test
  table: every group laid a page at a time" (`stab` não alcança o item). São as mesmas três que a rodada diária de 2026-11-23 reprova na
  página da sala (`nightly/2026-11-23/browser-checks.log`). Log: `check-room.log`.
- **Hash do `tools/gpu/room-determinism.mjs`** (M67, `floorplan`, 2 rodadas, 90 quadros, `jolt-d4-worker`), a referência das Fases 1 e 1b:

  | Variante | Consulta | Tique 90 `stateHash` | Eventos | Rodadas |
  |---|---|---|---|---|
  | com marca-passo (padrão da página) | `&solver=jolt&blastDebris=1&groundWorker=1` | **3822996173** | 1702 | idênticas em todo tique |
  | sem marca-passo | `…&blastPacing=0` | **1819424859** | 1702 | idênticas em todo tique |

  O hash de partida (`pre`) é 3406260990 nas quatro rodadas. A espera pela máquina quieta (carga < 1,5) desistiu nas duas: carga 2,7 a
  5,4 durante as rodadas (outra sessão usava o navegador); o hash não depende de tempo. O sem marca-passo bate com o da spec 018 depois do #446.
- **Rodada diária de 2026-11-23** (`d94089d0d`; vermelha desde 2026-11-20): reprova `browser-checks` (abrir a sala, origem de toda peça
  desenhada, memória entre ciclos, Jolt entre ciclos; nas áreas, `floorplan`, `glass`, `shots`, `explosions`, `veg_hedge_cut_pieces`,
  `veg_shot_cannot_fell`) e o `perf-gate`; passam a instalação, o build e o `room-explosion` (C4). Toda falha nova depois daqui é
  comparada com a `origin/main` do dia.
