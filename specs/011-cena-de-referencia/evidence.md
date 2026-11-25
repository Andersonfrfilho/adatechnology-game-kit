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

  | Variante | Consulta | `stateHash` do último quadro (90) | Eventos | Rodadas |
  |---|---|---|---|---|
  | com marca-passo (padrão da página) | `&solver=jolt&blastDebris=1&groundWorker=1` | **3822996173** | 1702 | idênticas em todo tique |
  | sem marca-passo | `…&blastPacing=0` | **1819424859** | 1702 | idênticas em todo tique |

  Com marca-passo, os 90 quadros são 75 tiques (15 segurados): o hash é o do tique 75, e a comparação entre os dois caminhos é pelo tempo do
  mundo (`detcmp.cjs` da spec 018). O hash de partida (`pre`) é 3406260990 nas quatro rodadas. A espera pela máquina quieta (carga < 1,5) desistiu nas duas: carga 2,7 a
  5,4 durante as rodadas (outra sessão usava o navegador); o hash não depende de tempo. O sem marca-passo bate com o da spec 018 depois do #446.
- **Rodada diária de 2026-11-23** (`d94089d0d`; vermelha desde 2026-11-20): reprova `browser-checks` (abrir a sala, origem de toda peça
  desenhada, memória entre ciclos, Jolt entre ciclos; nas áreas, `floorplan`, `glass`, `shots`, `explosions`, `veg_hedge_cut_pieces`,
  `veg_shot_cannot_fell`) e o `perf-gate`; passam a instalação, o build e o `room-explosion` (C4). Toda falha nova depois daqui é
  comparada com a `origin/main` do dia.

## N8 — os três commits de 2026-11-18 (2026-11-24)

- `check:layers` com subpastas de `exports`: PR #458, sem conflito; `check:layers` 0 novas.
- Oclusão por raios no `game-audio` (T1.2): PR #459; conflito com o #414 resolvido sobre o código de hoje; `game-audio` 307 testes, sala 553;
  **hash igual ao passo 0** (3822996173 / 1819424859).
- Registro de objetos e porto de relato (T1.6a): PR #460; a página da sala não montava com a entrada `/world` (alias do esbuild), corrigido
  com `dist/world.js`; `game-kit-defaults` 16 testes, sala 553; **hash igual ao passo 0**.

## T1.3 — `createKitWorld` (PR #463)

- 24 arquivos em `packages/game-kit-defaults/src/world/` (≤ 200 linhas), padrão com Jolt, marca-passo, D4 e chão no worker, cada um
  desligável. 39 testes no pacote (ordem do passo num quadro de verdade, encaixes do quadro, `reset` igual a host novo, `dispose` sem sobra),
  teste na sala que compara fase e ordem com as do host. ESLint 0, `check:layers` e `kit-audit --check` 0 novos.
- Revisão independente: 10 correções, aprovada na segunda passagem. O build da página da sala quebrava com o Jolt importado pelo host
  (`node:module`): corrigido no `build.mjs` (`e804eaff3`).

## T1.5 — a sala monta o mundo pelo host (PR #464)

- `room.ts` 5.614 → 5.303 linhas; saem da sala `blast-pacing.ts`, `simulation-phases.ts`, `frame-queues.ts`, `sun-shadow.ts`, `graphics.ts`.
- **Hash igual ao passo 0** (página `7648db3b828b`): 3822996173 com marca-passo, 1819424859 sem, 1702 eventos.
- **`pnpm check:room`**: 175 passam, 3 reprovam, as mesmas três da `main` do passo 0. Brutos em `medicoes/2026-11-24-spec011-t1.5/`.
- Sala 540 testes (14 do código do host foram para o `game-kit-defaults`, que tem 61). Revisão independente: 6 ajustes feitos.

## Fase 1 — fechamento parcial (2026-11-24)

- **Fechou:** T1.1 (desenho), T1.2 (#459), T1.3 (#463), T1.5 (#464).
- **Fica para a página da cena (T2.2):** T1.4, a regra `scene-not-testing`, porque o `check:layers` só percorre `packages/*/src` e a cena
  ainda não tem código de página.
- **Bloqueado em nada.** Os merges estão com o dono: a máquina barra o `gh pr merge` no modo automático.

## T2.8d — desenho das redes (2026-11-24)

- `drawNetworks` no `game-urban-three`; a cena desenha os postes da rede (sai o `polePointsOf`) e a casa em `street: 'network'` não desenha
  o próprio ramal (revisão do #475, itens 1 e 3).
- **Custo do recorte** (teste sem GPU): 9 chamadas perto, 1 de longe; o caso do banco `urban/networks` grava 17 chamadas (com sombra),
  9.464 triângulos, 9 materiais.
- **Mudança dita:** os postes da cena mudaram de lugar (são os da rede, um lado da rua, na divisa dos lotes) e as lâmpadas acendem pelos nós
  `light`; os prints de `shots/` foram regravados pelo `pnpm check:district` (passou). A régua de desempenho do `pior` não foi refeita neste PR.
- Prints antes e depois: `fios-antes-*` e `rede-depois-*` (dia, `tipico`) e `rede-depois-*-noite` (`pior`), na pasta de rascunho da sessão.
- **Revisão do dono (teia de aranha):** MT em todo poste de rua; ramal do poste em frente ou reto através da rua, nunca sobre outro lote,
  até 4 por poste (validador com 4 códigos novos, recorte com 0 violações e 0 avisos); o padrão é poste fino com medidor no pé e eletroduto.
  Postes acrescentados no trecho dos lotes: o vão ali cai para 10 a 22 m. Hashes de dados das redes (`generate.test.ts` do `game-urban` e
  `networks.test.ts` do exemplo) regravados; custo `urban/networks` 9.464 → 12.272 triângulos (aceito por nome). Prints `rede-v2-*`.

## T2.8e — esgoto, drenagem e água na superfície (2026-11-24)

- **Validador** (`validate-surface.ts`, 4 códigos, cada um com caso que reprova em `surface-rules.test.ts`): `pv_missing` (PV onde três coletores se
  encontram ou dois viram), `inlet_spacing` (> 60 m entre bocas de lobo de um meio-fio), `inlet_at_corner` (esquina de cruzamento sem boca de lobo
  a ≤ 15 m), `branch_skewed` (ramal predial ou de boca de lobo fora de 90° ± 5° da rua). O recorte e o gerador passam nos quatro sem mudar nó nem aresta.
- **Peças** (dado em `game-urban/networks`: `surfacePiecesOf`, `pipePiecesOf`, `breachOf`; desenho em `game-urban-three`: `drawNetworkSurface`,
  `drawBuriedNetworks`): tampa de PV e da caixa da galeria, terminal de limpeza, tampa de registro, grelha da boca de lobo, hidrante, muro de ala,
  tampa da caixa de inspeção, caixa do hidrômetro e boca do buzinote; canos e poços enterrados nas profundidades das regras.
- **Camadas** (pedido do dono): o `road` do `game-terrain` (asfalto 5 cm, brita 25 cm, solo 1,5 m) já era a estrutura; a calçada era laje de 12 cm
  sem camada embaixo, então ganhou o perfil `sidewalk` (concreto 8 cm, brita 22 cm, solo 1,5 m, mesma coluna de 1,8 m). O plano de asfalto que o
  `game-urban` desenhava a 2 cm tapava a cratera: `streets.road` ganhou `plane: false` e a cena usa só o asfalto do terreno (tracejado sobre ele).
- **Cratera até os canos**: `world.ground.on('blow')` → `breachOf` → `sever` do cano e `remove` da tampa (ligado em `drawDistrictSewers`).
  Com 40 MJ na pista (raio 2,3 m, fundo 1,34 m) quebrou ramais de água e de esgoto e arrancou a tampa; o cano aparece na cratera (`esgoto-cratera.png`).
- **Limites ditos**: o perfil `road` tem 1,8 m, e o coletor de esgoto fica a ≥ 1,8 m de recobrimento: só a cratera no limite da coluna o alcança; a galeria
  e o ramal de boca de lobo (1,0 a 1,2 m, ou mais fundo onde há elevatória) pedem carga forte. Meio-fio com altura e sarjeta própria são da T3.9.
- **Dados**: o hash das redes (`generate.test.ts` do `game-urban`, `networks.test.ts` do exemplo) mudou só porque `rules` ganhou `sewer.turnTolerance`,
  `sewer.branchMaxSkew` e `storm`; nós e arestas iguais. Custo: `urban/network-surface` 2 chamadas, 5.772 triângulos; `urban/network-buried` 3 chamadas, 6.580.

## T2.8f — vazamento e queda de tampa (2026-11-25)

- **Dado** (`game-urban/networks`): `leaksOf` (cano rompido vira `NetworkLeak`: água sob pressão 6 l/s no tronco e 0,8 no ramal, esgoto 0,5 e 0,15, drenagem 2 e 0,6 só com
  chuva; cada um é finito, `rate` vezes `seconds`, e `drainLeak` solta até esvaziar), `waterOutageOf` (casas a jusante da ruptura, só o que é novo), `openingOf` (o poço da tampa como
  `GroundExcavation`), `coverBodyOf` (a tampa como placa de ferro fundido do `DestructibleSpec`), `coverThrowOf` (a velocidade do arremesso, pura) e `NetworkEvent`
  (`network_leak`, `network_outage`, `network_hole`).
- **Terreno**: `Terrain.open(excavation)` abre um poço no chão como está (sem perda de chão; o `reset` fecha junto com as crateras). **Fluidos**: o líquido `sewage` entrou em `game-fluids`.
- **Desenho** (`game-urban-three`): `drawCoverLid` (a tampa solta: placa e nervuras, ou a grelha inteira), `DrawnSurface.restore` e `DrawnBuried.mend` (o `reset` devolve tampa e cano).
- **Cena** (`assemble/leaks.ts`): cada cratera que quebra cano vira torneira do `game-fluids` na ruptura (água sobe e espirra, esgoto escorre pela linha do cano) e some quando o volume acaba;
  cada tampa arrancada abre o poço no terreno, vira peça solta do mundo de destruição (`makePiece`, ferro fundido) e pousa; `leaks.events`, `leaks.dryLots`, `leaks.lids`.
- **Limites ditos**: a borda do poço colide como o próprio terreno (campo de alturas, célula de 0,47 m neste recorte), não como aro à parte; o poço de 0,9 m fica grosseiro. As casas cortam a água: `Houses.setLotWater` esvazia o tanque da casa do lote seco (torneira aberta entrega 0; a de casa com água gastou 0,24 l em 2 s) e `reset` enche de novo; o SDK não tem peça de aro de colisão para o poço, que colide como terreno.
- **Pendências de golden** (nenhum regravado): `networks/lids` (novo) e `networks/surface`, `networks/buried` (já faltavam desde a T2.8e) em `game-urban-three/tests/fixtures/exact-urban.json`.
  O banco de custo (`--cost-check`) passou sem entrada nova. Prints: `vazamento-agua`, `vazamento-esgoto`, `vazamento-poco`, `vazamento-primeira-pessoa` na pasta de rascunho da sessão.
