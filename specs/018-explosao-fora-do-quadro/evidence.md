# Evidência — Spec 018

## T0.1 — Sonda dentro do `explode` (2026-11-20)

### O que foi medido e como

- **Código medido:** branch `spec/018-explosao-fora-do-quadro` sobre a `main` `694ab2810`, mais o commit da sonda (protótipo descartável, só nesta
  branch). A série fina rodou em `4afb3624d`; a série grossa em `dd4839359`, que é o mesmo commit emendado para mudar só a lista de rótulos do
  modo grosso (`COARSE_LABELS`, que o modo fino não lê). Os dois JSONs estão em `medicoes/` com o sha no nome.
- **Sonda** (`packages/game-destruction/src/explode-probe.ts` + `world.ts`): desligada por padrão; o mundo lê `globalThis.__destructionExplodeProbe`
  uma vez ao nascer e, sem ele, `wrap` devolve a própria função. Ligada, cada chamada externa de `world.explode` grava um registro com o tempo
  total e o tempo **exclusivo** de cada rótulo (o tempo de um rótulo chamado de dentro de outro sai do de fora; o que nenhum rótulo cobre é
  `explodeRest`), mais chamadas e contagens. A soma dos rótulos fecha com o total por construção (conferido: igual em todas as rodadas).
  O relógio vem do host (`performance.now` da página). Teste de rascunho (não commitado): mundo serializado igual com a sonda ligada e
  desligada; suíte do `game-destruction` 591/591 com a sonda desligada.
- **Rótulos:** (a) `partGeometry` = trecho do `blastPart` de `partXf` até o `share` (`distanceToShape`, `surfacePoint`, `projectedArea`,
  `waveWork`, `failureWork`); (b) `seesFireball` e `raycast` (`raycastInternal`); (c) `wearJoints`; (d) `knockOutUnits` (sem o solve);
  (e) `solveStructure` e `groups` (`recomputeGroups`); (f) `emit` (com os ouvintes). Fora da lista da task, para fechar a conta: `impls`
  (`implInRange` + `implHit`), `applyDamage`, `units` (`blastPanel`, `blastUnits`, `addBreach`), `marks` (`addDent`, `addCrack`, `debris`,
  `spallOuter`), `bend` (`bendByBlast`), `candidates` (`blastCandidates`), `detachEvents`, `flushCollapse`, `blastPart` (o resto próprio do
  laço por peça) e `explodeRest`.
- **Modo grosso:** só os rótulos com poucas chamadas (`knockOutUnits`, `solveStructure`, `groups`, `flushCollapse`, `impls`, `detachEvents`);
  todo o laço por peça cai em `explodeRest`. Serve para medir o custo da sonda e conferir os rótulos estruturais sem a inflação do modo fino.
- **Régua:** `tools/gpu/perf-gate.mjs room-explosion`, `ROOM_EXPLOSION_BUDGET=deadline`, `KINDS=blast,crater`, 1x, `ROUNDS=1`,
  `STAGE_ROUNDS=6`, `FRAME_PARTS=1`, e `ROOM_EXPLOSION_EXPLODE_PROBE=fine,off` (série 1) / `coarse,off` (série 2): as rodadas de estágio
  alternam sonda ligada e desligada na mesma sessão (1, 3, 5 ligadas; 2, 4, 6 desligadas). `pnpm build` antes; a régua refaz a página da sala.
  Tudo sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`. Base (`room-explosion-base.json`) não tocada.
- **Registro usado:** cada página grava **dois** registros: o primeiro é o aquecimento do JIT (`game-destruction-three/src/jit-warmup.ts`,
  um mundo próprio de 24 peças, ~2 ms, na carga da página); o segundo é a explosão do f0. As tabelas usam só o segundo.

### Condições da máquina

| Série | Início | Fim | Observação |
|---|---|---|---|
| fina/desligada (`4afb3624d`) | 15:37, carga 1,11, 57 °C | 15:46, carga 1,61, 64 °C | picos de 88 °C durante a série |
| grossa/desligada (`dd4839359`) | 15:54, carga 1,31, 57 °C | 16:03, carga 1,84, 63 °C | |

Antes da série 1 a máquina passou ~35 min acima do limite (carga 2–7, processador 80–100 °C: uma aba do Chrome a 100% de um núcleo e a outra
sessão medindo); a espera foi feita no shell até carga < 1,5 e mediana de 5 leituras do pacote < 75 °C, conferida de novo depois de pegar a
trava. Leitura isolada do sensor oscila até 105 °C sob turbo; por isso a mediana.

**Rodadas descartadas: nenhuma.** Nenhum quadro travado (o pior f0 foi 70,7 ms; travado seria ~10x). As rodadas 1 da série fina saíram ~6 ms
acima das outras nos dois tipos (blast 26,8, crater 27,7 no rótulo `explode` da régua) e ficaram: não são travadas, e a mediana absorve.

### Tabela por rótulo — modo fino (ms exclusivos no `explode` do f0; 3 rodadas; mediana; % do total mediano)

**Explosão (`blast`)** — total 27,2 / 21,2 / 25,7, mediana **25,7 ms**

| Grupo da task | Rótulo | r1 | r3 | r5 | mediana | % |
|---|---|---|---|---|---|---|
| (f) | `emit` (700 chamadas) | 4,0 | 4,6 | 5,0 | 4,6 | 17,9 |
| (e) | `solveStructure` (5) | 5,4 | 2,9 | 3,6 | 3,6 | 14,0 |
| (d) | `knockOutUnits` (2; 136 unidades) | 3,7 | 2,7 | 3,3 | 3,3 | 12,8 |
| — | `impls` (4) | 3,6 | 2,7 | 3,3 | 3,3 | 12,8 |
| (a) | `partGeometry` (509) | 2,3 | 1,9 | 1,8 | 1,9 | 7,4 |
| — | `applyDamage` (506) | 1,8 | 1,9 | 2,2 | 1,9 | 7,4 |
| — | `units` (117) | 1,8 | 1,4 | 2,0 | 1,8 | 7,0 |
| (c) | `wearJoints` (506; 1360 juntas visitadas) | 2,0 | 1,3 | 1,7 | 1,7 | 6,6 |
| — | `bend` (22) | 0,7 | 0,3 | 0,7 | 0,7 | 2,7 |
| — | `blastPart` próprio (521) | 0,7 | 0,4 | 0,6 | 0,6 | 2,3 |
| — | `explodeRest` | 0,5 | 0,3 | 0,5 | 0,5 | 1,9 |
| (e) | `groups` (3) | 0,3 | 0,1 | 0,4 | 0,3 | 1,2 |
| — | `marks` (97) | 0,1 | 0,5 | 0,3 | 0,3 | 1,2 |
| (b) | `raycast` (1) + `seesFireball` (1) | 0,2 | 0,1 | 0,1 | 0,1 | 0,4 |
| — | `flushCollapse`, `candidates`, `detachEvents` | 0,1 | 0,1 | 0,2 | 0,1 | 0,4 |

**Cratera (`crater`)** — total 28,1 / 22,7 / 21,5, mediana **22,7 ms**

| Grupo da task | Rótulo | r1 | r3 | r5 | mediana | % |
|---|---|---|---|---|---|---|
| (f) | `emit` (707) | 4,9 | 3,9 | 3,7 | 3,9 | 17,2 |
| (d) | `knockOutUnits` (3; 142 unidades) | 5,6 | 3,6 | 3,5 | 3,6 | 15,9 |
| — | `impls` (4) | 3,7 | 2,8 | 2,8 | 2,8 | 12,3 |
| (e) | `solveStructure` (6) | 3,3 | 2,7 | 2,6 | 2,7 | 11,9 |
| (c) | `wearJoints` (508; 1479 juntas) | 2,5 | 2,0 | 2,1 | 2,1 | 9,3 |
| — | `applyDamage` (508) | 2,1 | 1,9 | 1,5 | 1,9 | 8,4 |
| — | `units` (116) | 1,5 | 1,3 | 1,5 | 1,5 | 6,6 |
| (a) | `partGeometry` (511) | 1,3 | 1,1 | 1,9 | 1,3 | 5,7 |
| — | `blastPart` próprio (523) | 0,8 | 0,7 | 0,4 | 0,7 | 3,1 |
| — | `explodeRest` | 0,6 | 1,5 | 0,2 | 0,6 | 2,6 |
| — | `bend` (22) | 0,8 | 0,4 | 0,6 | 0,6 | 2,6 |
| — | `marks` (99) | 0,1 | 0,4 | 0,3 | 0,3 | 1,3 |
| (e) | `groups` (3) | 0,3 | 0,2 | 0,2 | 0,2 | 0,9 |
| (b) | `raycast` (1) + `seesFireball` (1) | 0,4 | 0,0 | 0,0 | 0,0 | 0,0 |
| — | `candidates`, `detachEvents`, `flushCollapse` | 0,2 | 0,2 | 0,2 | 0,2 | 0,9 |

Contagens iguais nas 3 rodadas (a simulação é determinística): explosão 521 peças visitadas, 506 dentro do raio, 700 eventos, 5 solves,
2 `knockOutUnits` com 136 unidades, 1360 juntas visitadas, **1 raio** (`seesFireball` só passa do teste de dose numa peça). Cratera: 523, 508,
707, 6, 3 com 142, 1479, 1 raio.

### Tabela por rótulo — modo grosso (conferência; 3 rodadas)

| Rótulo | explosão r1/r3/r5 | mediana | % | cratera r1/r3/r5 | mediana | % |
|---|---|---|---|---|---|---|
| `explodeRest` (todo o laço por peça + `emit` + resto) | 10,5 / 10,7 / 11,3 | 10,7 | 53,2 | 13,0 / 10,8 / 12,1 | 12,1 | 51,9 |
| `knockOutUnits` | 3,4 / 3,3 / 3,4 | 3,4 | 16,9 | 4,1 / 4,2 / 4,4 | 4,2 | 18,0 |
| `solveStructure` | 2,9 / 2,9 / 2,7 | 2,9 | 14,4 | 2,5 / 2,9 / 3,7 | 2,9 | 12,5 |
| `impls` | 2,9 / 2,7 / 2,8 | 2,8 | 13,9 | 3,3 / 2,9 / 3,0 | 3,0 | 12,9 |
| `groups` | 0,3 / 0,2 / 0,3 | 0,3 | 1,5 | 0,4 / 0,2 / 0,3 | 0,3 | 1,3 |
| `detachEvents` + `flushCollapse` | 0,1 / 0,1 / 0,1 | 0,1 | 0,5 | 0,0 / 0,1 / 0,2 | 0,1 | 0,4 |
| **total** | 20,1 / 19,9 / 20,6 | **20,1** | | 23,3 / 21,1 / 23,7 | **23,3** | |

### Custo da sonda (pares alternados na mesma sessão; rótulo `explode` da régua no f0 e f0 = `update + renderCpu`, medianas de 3)

| Série | Tipo | `explode` ligada | `explode` desligada | diferença | f0 ligada | f0 desligada |
|---|---|---|---|---|---|---|
| fina | explosão | 25,2 (26,8 / 20,6 / 25,2) | 20,9 (20,9 / 20,2 / 21,4) | **+4,3 ms (~+20%)** | 75,2 | 64,0 |
| fina | cratera | 22,2 (27,7 / 22,2 / 21,2) | 21,8 (21,8 / 21,8 / 21,1) | +0,4 ms | 65,6 | 64,9 |
| grossa | explosão | 19,8 (19,8 / 19,5 / 20,1) | 20,1 (21,9 / 19,2 / 20,1) | −0,3 ms (ruído) | 63,9 | 62,9 |
| grossa | cratera | 22,9 (22,9 / 20,7 / 23,5) | 20,4 (20,6 / 20,4 / 19,5) | +2,5 ms | 66,3 | 63,5 |

- **Fato:** o modo grosso não muda o `explode` além do ruído da sessão (±2 ms); os rótulos estruturais e `impls` saem iguais nos dois modos
  (`knockOutUnits` 3,3–3,6 fino contra 3,4–4,2 grosso; `solveStructure` 2,7–3,6 contra 2,9; `impls` 2,8–3,3 contra 2,8–3,0).
- **Fato:** o laço por peça custa ~10,7 ms (explosão) e ~12,1 ms (cratera) no modo grosso; no modo fino os rótulos por peça somam ~14 e
  ~13 ms. A diferença (~1–3 ms) é o custo dos ~3000 timers por explosão e cai sobre `emit`, `partGeometry`, `applyDamage`, `wearJoints` e
  `blastPart`, proporcional às chamadas.
- **Palpite (não medido direto):** descontando ~1 µs por chamada cronometrada, os rótulos por peça ficam perto de `emit` ~3,5, `wearJoints`
  ~1,0–1,4, `applyDamage` ~1,1, `partGeometry` ~0,6–1,1 ms.
- **Resolução do relógio:** a página da régua (`file://`) não é `crossOriginIsolated`; `performance.now` vem em passos de 0,1 ms com jitter. Os
  rótulos de poucas chamadas e longos (estrutura, `impls`) leem bem; os de centenas de chamadas curtas são somas de amostras quantizadas e
  valem como ordem de grandeza. A soma fecha exata com o total.
- O `explode` desligado nesta sessão foi 20–22 ms, abaixo dos 24–26 ms do `spec.md` §1 (outra sessão, outra temperatura).

### Leitura

**Fatos:**
- Nenhum rótulo sozinho passa de ~4 ms. O `explode` é ~20–23 ms espalhados: a parte por peça (~11–12 ms: `emit`, `partGeometry`,
  `applyDamage`, `units`, `wearJoints`, `bend`, `marks`) e três blocos de poucas chamadas (`knockOutUnits` ~3,4–4,2, `solveStructure`
  ~2,9, `impls` ~2,8–3,0), que juntos dão ~9–10 ms.
- (b) `seesFireball`/`raycastInternal` é **zero** na sala: 1 raio por explosão. Não há o que mover ali.
- (a) a onda e a geometria por peça, a única parte que já é pura (`waveWork`, `projectedArea`, `distanceToShape`, `failureWork`), custa
  ~1,3–1,9 ms com a sonda fina e menos que isso sem ela: **~5–8% do `explode`**.
- (f) `emit` é o maior rótulo do modo fino (~3,9–4,6 ms, 700 eventos): é o tempo dos ouvintes (renderizador, sala) chamados na hora; não é
  trabalho do mundo e não vai para um worker sem mudar quando os ouvintes rodam.
- (d) `knockOutUnits`: 2–3 chamadas, ~1,2–1,7 ms cada (136–142 unidades). (e) `solveStructure`: 5–6 chamadas, ~0,5–0,6 ms cada.

**Palpites (a confirmar na T0.2/T0.3):**
- Para o caminho A (kernel por peça), o pedaço puro **e** grande não existe: o puro (a) é ~1–2 ms; o grande por peça (`emit`, `applyDamage`,
  `wearJoints`, `units`) lê e escreve estado do mundo e dispara ouvintes. Mover só (a) para um worker não chega perto dos 15 ms que a T0.3
  exige, mesmo de graça na fronteira.
- Os candidatos mais "kernelizáveis" por custo são os blocos de poucas chamadas: dentro de `knockOutUnits` a conta de grade
  (`unsupportedCells`, `wedgedUnder`) e dentro de `solveStructure` o `solveSupports`/`distributeLoads` (puros, com o grafo por callback).
  Juntos ~6–7 ms, mas com estado (grade gasta, juntas) para montar na entrada e aplicar na volta.
- `impls` (~3 ms em 4 chamadas) é trabalho de um `DestructibleImpl` registrado (provavelmente o do terreno, `game-terrain/src/impl.ts`; não
  verificado qual), fora do mundo de destruição: não entra no caminho A.
- Somando o que é plausível mover (estrutura + unidades, ~6–7 ms), o `explode` cairia para ~14–16 ms, o que tira ~6–7 ms do f0 de ~64 ms:
  não leva o quadro a 33,3 ms sem mexer também nos ~14 ms dos eventos estruturais no tique.

### O que não foi medido

- O custo por peça sem o timer (só estimado pela diferença fino − grosso).
- Qual `DestructibleImpl` responde pelos ~3 ms de `impls`, e o que dentro dele.
- A divisão interna de `knockOutUnits` e `solveStructure` (grade × eventos; `solveSupports` × montagem do grafo).
- Rodadas a 4x ou com outras casas.
