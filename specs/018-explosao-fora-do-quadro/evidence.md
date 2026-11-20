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

## T0.2 — Custo da fronteira (2026-11-20)

### O que foi medido e como

- **Código medido:** `ebfe8c577` (protótipo descartável, só nesta branch), sobre `4ac00cb6a`. JSON: `medicoes/fronteira-ebfe8c577.json` (campo `explodeProbe[].boundary`).
- **Onde:** dentro da página da sala, no mesmo ponto da régua: `world.explode` chama a sonda (`packages/game-destruction/src/boundary-probe.ts` +
  `measureBoundary` em `world.ts`) **antes** de aplicar a explosão do f0, com a casa montada e inteira. Não foi Node. Régua: `ROOM_EXPLOSION_BOUNDARY=1`,
  `BUDGET=deadline`, `KINDS=blast,crater`, 1x, `ROUNDS=1`, `STAGE_ROUNDS=3`, `FRAME_PARTS=1`; `pnpm build` antes. Tudo sob a trava, num único comando.
- **Resolução:** `performance.now` em passos de 0,1 ms (página `file://`). Cada operação roda em lote de K repetições (K dobrado de 4 em 4 até o lote
  passar de ~3 ms), 15 amostras por operação; a primeira chamada é cronometrada à parte. Tabela: mediana das 3 rodadas de cada medida por chamada
  (mediana das 15 amostras da rodada), mín e máx de todas as amostras. N = 3 rodadas x 15 amostras.
- **O mundo:** 15 objetos, **552 peças**, 794 juntas, 2 `impls` (não a conta de 521: os 521 do T0.1 eram as peças que o `blastPart` visitou). Na explosão: 506
  peças dentro do raio, 12 embutidas (saem da entrada: `blastPart` as devolve sem tocar), **1360 juntas** nas peças da entrada (cratera: 508 peças, 1479 juntas).
  Cada página grava dois registros: o 1º é o aquecimento do JIT (mundo de 24 peças), o 2º é a casa. As tabelas usam só o 2º.
- **Primeiro anel:** peças a até **1 m** do centro (a bola de fogo da 017): **12** na explosão, **15** na cratera. As outras: **494** e **493**. (A 1,5 m:
  16 e 18; a 2 m: 20 e 20; a 3 m: 44 e 41.)
- **Quem é "serialize":** `world.serialize()` (o mesmo que o mundo faz: `clone` do spec, do estado e do `rt` de cada peça). Repliquei a expressão na sonda para
  chamá-la por dentro do mundo.

### Entrada plana (a mínima que o kernel puro de `blastPart` precisa ler)

Três `Float64Array`: peças (27 números por peça), juntas (9 por junta) e tabela de materiais (7 por material, 13 materiais). Pose já em espaço do mundo.

| Bloco | Campos |
|---|---|
| peça | objeto, índice da peça, forma (0 caixa, 1 cilindro, 2 esfera), tamanho (3), centro no mundo (3), quaternion no mundo (4), índice do material, bits (ancorada, tem espessura, tem unidades, tem armadura, papel estrutural, flexiona, queimando, tem camadas), massa, hp, hp máx, combustível, temperatura, espessura, dims (3), distância ao centro, 1ª junta, nº de juntas |
| junta | peça a, peça b, tipo (código), hp, hp máx, bits (vergalhão de peça armada, `holdsEmbedded`, `fixesTrim`, `onFoundation`), alcance até o centro (`jointReach`), limite (`jointReachLimit`), comprimento (`jointLength`); junta aberta leva só os 5 primeiros |
| material | densidade, `failureMPa`, ductilidade, `hpPerKg`, `ignitionC`, escala de dano explosivo, é vidro |

Fora da entrada (fica no mundo, na volta): `rt` (rachaduras, esfarelamento), camadas e grade de unidades, escrita de `st`, eventos. Não está na entrada e **não foi
medido**: o abrigo (`reachAt`, raios contra outras peças) e o raio de `seesFireball` (1 por explosão, ~0,1–0,4 ms no T0.1).

### Tabela (casa da sala, 2º registro)

| Operação | Explosão: ms mediana (mín–máx) | Cratera: ms mediana (mín–máx) | 1ª chamada, 3 rodadas (ms) | K |
|---|---|---|---|---|
| `world.serialize()` | **4,0** (3,7–6,7) | **4,0** (3,7–6,0) | 4,4 / 6,8 / 5,5 | 1 |
| `structuredClone(snapshot)` | **3,3** (3,1–5,5) | **3,2** (3,1–4,9) | 6,2 / 5,8 / 4,9 | 1 |
| `JSON.stringify(snapshot)` (extra) | 2,28 (2,0–2,7) | 2,28 (2,0–2,7) | ~2,8–3,2 | 4 |
| escolher peças da explosão (`blastCandidates` + distância) | 0,064 | 0,067 | 0,2–0,5 | 64 |
| tabela de materiais | 0,0024 | 0,0025 | ~0 | 256–1024 |
| montar entrada: primeiro anel (12 / 15 peças) | **0,018** (0,015–0,031) | **0,078** (0,066–0,105) | 0,1 / 0,1 / 0,1 (e 0,2–0,3) | 64–256 |
| montar entrada: as de fora (494 / 493 peças) | **0,80** (0,70–1,40) | **0,75** (0,68–1,30) | 0,9–1,1 | 4 |
| montar entrada: todas (506 / 508) | **0,78** (0,75–1,23) | **0,83** (0,73–1,30) | 0,8 | 4–16 |
| `structuredClone` da entrada: anel | 0,006 | 0,019 | 0,0–0,1 | 256–1024 |
| `structuredClone` da entrada: de fora | 0,175 (0,16–0,24) | 0,173 (0,16–0,25) | 0,1–0,3 | 64 |
| `structuredClone` da entrada: todas | 0,177 (0,16–0,49) | 0,189 (0,16–0,43) | 0,1–0,2 | 16–64 |
| `structuredClone` com `transfer` dos buffers: anel / de fora / todas | 0,003 / 0,004 / 0,012 | 0,003 / 0,004 / 0,006 | 0,0–0,1 (veja abaixo) | 256 |

| Tamanho (bytes) | Explosão | Cratera |
|---|---|---|
| snapshot em JSON (UTF-8; o JSON é ASCII, chars = bytes) | 893.423–897.285 | 897.285 |
| entrada plana: anel (peças + juntas + materiais) | 5.408 (12 peças, 29 juntas) | 14.696 (15 peças, 149 juntas) |
| entrada plana: de fora | 203.264 (1331 juntas) | 202.976 (1330 juntas) |
| entrada plana: todas | 207.944 (1360 juntas) | 216.944 (1479 juntas) |
| tabela de materiais | 728 | 728 |

### Condições e descartes

- **Máquina:** a espera foi dentro da trava (a outra sessão parou enquanto a trava estava comigo). Porta de entrada: 17:09:34, carga 1,13, mediana de 5 leituras
  do pacote 55 °C. Início da régua 17:10:10: carga 3,28 (a cauda do meu próprio `pnpm build`, 63 °C). Fim 17:15:45: carga 2,33, 72 °C. **A carga no começo da régua
  ficou acima de 1,5**: o build roda dentro da trava, e a régua o segue. A carga não é da outra sessão (parada pela trava), mas não pude separar o quanto
  é do build. Os números de operações de 3–5 ms por chamada (`serialize`, `structuredClone`) tiveram mín–máx estreito (3,7–6,7), então não vejo travada.
- **Antes disso, duas tentativas minhas de esperar fora da trava** (16:14–17:05) não mediram nada. Defeito meu: o leitor de temperatura pegava o valor
  `crit` do sensor (105 °C) em vez do real; só a carga era confiável e ficou em ~2,3 até o coordenador mandar pegar a trava primeiro.
- **Rodadas descartadas: nenhuma.** O f0 de cada rodada marca `explode` ~2.000–2.200 ms: é a **própria sonda** (centenas de lotes de cronômetro antes de aplicar
  a explosão). Não é página travada; os `f0`, `explode` e quadros deste JSON **não valem** como medida de quadro. Só vale o bloco `boundary`.
- `transferRing` da cratera, rodada 1: a 1ª chamada levou 10,1 ms (e na rodada 3, 11,6 ms), o lote de calibração saiu com K = 1 e a mediana dessa rodada
  saiu 0,0000: **inválida**; a tabela usa as outras duas rodadas e as da explosão (0,003 ms). Essas duas chamadas frias de 10–12 ms são um fato sem causa
  conhecida (palpite: coleta de lixo ou primeira transferência de buffer).
- Os dois `ERROR: Can't get value of subfeature temp1_*_alarm` do `sensors` são do próprio comando, sem efeito.

### Leitura

**Fatos:**
- Mandar a **casa inteira** pelo caminho do snapshot custa, só para sair da thread principal: `serialize` ~4,0 ms + `structuredClone` ~3,3 ms = **~7,3 ms**
  (sem contar a volta, nem o `loadObject` do outro lado), com ~0,9 MB. Isso é mais do que cada rótulo medido na T0.1 (o maior, `emit`, ~3,9–4,6 ms; a parte
  pura (a) ~1,3–1,9 ms) e ~30% dos ~20–23 ms do `explode`.
- A **entrada plana** das ~500 peças de fora custa **~0,8 ms** para montar e ~0,18 ms para copiar (ou ~0,004–0,012 ms com `transfer`, medido dentro da mesma
  thread); o primeiro anel, 0,02–0,08 ms. A fronteira "entrada plana" é uma ordem de grandeza menor que a do snapshot (0,2 MB contra 0,9 MB; ~1 ms contra ~7 ms).
- A montagem plana (~0,8 ms) já é **maior que o kernel que ela alimentaria**: o rótulo (a) `partGeometry` do T0.1 custou ~1,3–1,9 ms nas 509 peças
  (com a sonda fina; menos sem ela). Ou seja, o custo de montar a entrada é da mesma ordem do trabalho puro que se quer mover.

**Palpites (não medidos):**
- O que sobra de ganho no caminho A é o kernel puro (a), ~1–2 ms, menos ~0,8 ms de montagem, menos a aplicação na volta: ganho líquido perto de zero ou
  negativo, longe dos 15 ms da T0.3. Quem mudaria isso é mover blocos maiores (`knockOutUnits`, `solveStructure`, ~6–7 ms), cuja entrada (grade de
  unidades, grafo de apoios) **não está nesta entrada plana** e não foi medida.
- O snapshot inteiro por quadro é inviável como entrada de um worker por explosão (~7 ms só de ida) a menos que ele fique no worker e a ida seja só um delta.

### O que NÃO foi medido

- A ida e volta real por `postMessage` a um `Worker` (a latência entre threads, o `loadObject` do snapshot do outro lado, o tempo do kernel no worker, a aplicação
  do resultado na volta); só o custo do lado da thread principal e `structuredClone`/`transfer` dentro dela.
- A entrada de `knockOutUnits`/`solveStructure` (grade de unidades, juntas e apoios do grafo) e a de `emit` (ouvintes).
- Abrigo (`reachAt`) e raio de `seesFireball`.
- Outras casas, 4x, a região de gatilho com o processador quente (a série foi a ~63–72 °C).
- O custo do `structuredClone` com `transfer` **incluindo** a cópia de preparo dos buffers (ficou fora do relógio, por construção).

## T0.3 — Teto do caminho A (2026-11-20)

**Veredito: não passou. O kernel não foi construído.** O critério da T0.3 (tirar pelo menos 15 ms do quadro do impacto) não é atingível nem com kernel de custo
zero: a conta do teto (passo 2 da task) deu 5 ms de teto puro e ~10,5 ms com tudo que se queira chamar de movível, contra ~21 ms de `explode` e 15 ms exigidos
mais a fronteira.

### O que foi medido e como

- **Código medido:** `39bfcd4f0` (protótipo descartável, só nesta branch), sobre `b6392e75f`. JSON: `medicoes/divisao-interna-39bfcd4f0.json` (campo `explodeProbe`).
- **Sonda estendida** (`explode-probe.ts` + `world.ts`; desligada por padrão, mesma regra da T0.1; suíte do `game-destruction` 591/591 com ela desligada). Rótulos
  exclusivos novos, todos de poucas chamadas (modo grosso, sem inflar): dentro de `knockOutUnits`: `koGrid` (`gridOf`, `castCells`, `unsupportedCells`, `wedgedUnder`),
  `koFragments` (`clumpUnits`, `cellFragments`, `plasterFlakes`, filtro de furos), `koCollapse` (`collapseCheck`), e o resto próprio (escrita de estado, `setStage`,
  `exposeRebar`, massa); dentro de `solveStructure`: `ssGraph` (listas de apoio), `ssSolve` (`solveSupports`), `ssSpan` (laço de vão e `standsOver`),
  `ssLoads` (`distributeLoads`), `ssApply` (laço final: carga, tensão, flexão, vento); `impls` aberto em `implInRange`, `implDescribe`, `implHit` e `impl:<id>`
  (a chamada `impl.hit`). `emit` não é rótulo no modo grosso: cai em `explodeRest`.
- **Régua:** `ROOM_EXPLOSION_BUDGET=deadline`, `KINDS=blast,crater`, 1x, `ROUNDS=1`, `STAGE_ROUNDS=6`, `FRAME_PARTS=1`, `ROOM_EXPLOSION_EXPLODE_PROBE=coarse,off` (rodadas 1, 3, 5
  ligadas; 2, 4, 6 desligadas), a mesma da T0.1 grossa. Tudo sob `flock ~/.cache/adatechnology-game-kit/perf-measure.lock`, num único comando: `pnpm build`, página da sala
  refeita (`node examples/test-room/build.mjs`; sha mudou de `8b1872d6…` e a página contém `ssGraph`), espera até carga < 1,5 e mediana de 5 leituras do `Package id 0` < 75 °C,
  só então a régua. A régua ainda refaz a página sozinha (passos de `perf-gate`), sem efeito na carga medida.
- **Condições:** entrada na trava 17:23:09, carga 2,43, 68 °C. Fim do build 17:23:51, carga 4,46. Espera (5 leituras, ~1,7 min) até 17:25:37. **Início da régua: carga 0,97, 51 °C.**
  **Fim: 17:34:30, carga 1,60, 59 °C.** Nenhuma passagem de 88 °C. A régua levou ~9 min.
- **Rodadas descartadas: nenhuma** (nenhum quadro ~10x; f0 do `explode` 19,5–26,5 ms). Quadros seguintes não foram analisados: não há protótipo para compará-los.
- Soma dos rótulos fecha com o total por construção. Medianas de 3 rodadas, ms exclusivos no `explode` do f0. Resolução do relógio de 0,1 ms (página `file://`): rótulos
  de 1 a 2 chamadas leem bem.

### Tabela da divisão interna (ms; 3 rodadas; mediana)

| Bloco | Rótulo | Explosão r1 / r3 / r5 | mediana | Cratera r1 / r3 / r5 | mediana | Chamadas (expl. / crat.) |
|---|---|---|---|---|---|---|
| `knockOutUnits` | `koGrid` (conta de grade) | 2,3 / 2,1 / 2,1 | **2,1** | 2,4 / 2,3 / 2,2 | **2,3** | 2 / 3 |
| | `koFragments` | 0,5 / 0,5 / 0,5 | 0,5 | 0,5 / 0,6 / 0,6 | 0,6 | 2 / 3 |
| | `koCollapse` | 0 | 0 | 0 | 0 | 2 / 3 |
| | próprio (escrita de estado) | 0,8 / 0,9 / 0,7 | 0,8 | 2,0 / 1,9 / 1,4 | 1,9 | 2 / 3 |
| `solveStructure` | `ssGraph` | 0,2 / 0,4 / 0,4 | 0,4 | 0,5 / 2,2 / 0,5 | 0,5 | 5 / 6 |
| | `ssSolve` (`solveSupports`) | 0,4 / 0,3 / 0,3 | 0,3 | 0,5 / 0,6 / 0,2 | 0,5 | 5 / 6 |
| | `ssSpan` | 0,2 / 0 / 0,1 | 0,1 | 0,2 / 0,2 / 0,2 | 0,2 | 5 / 6 |
| | `ssLoads` (`distributeLoads`) | 0,3 / 0,5 / 0,3 | 0,3 | 0,4 / 0,4 / 0,5 | 0,4 | 5 / 6 |
| | `ssApply` | 3,3 / 1,6 / 2,1 | **2,1** | 1,4 / 1,5 / 0,8 | 1,4 | 5 / 6 |
| `impls` | `impl:sedan_scenery_1` (`impl.hit`) | 2,3 / 2,3 / 2,3 | **2,3** | 2,7 / 2,7 / 2,2 | **2,7** | 1 / 1 |
| | `impl:room_ground` (`impl.hit`) | 0,5 / 0,5 / 0,6 | 0,5 | 0,7 / 0,6 / 0,6 | 0,6 | 1 / 1 |
| | `implInRange`, `implDescribe`, `implHit` próprios | ~0,1 | 0,1 | ~0,1 | 0,1 | 2 / 2 |
| — | `groups` | 0,3 / 0,3 / 0,4 | 0,3 | 0,5 / 0,4 / 0,4 | 0,4 | 3 / 3 |
| — | `detachEvents`, `flushCollapse` | 0,1 | 0,1 | 0,2 | 0,2 | 20 / 21, 1 |
| — | `explodeRest` (laço por peça, `emit`, o resto) | 10,3 / 11,9 / 11,1 | **11,1** | 12,7 / 13,3 / 10,7 | **12,7** | |
| | **total do `explode`** | 21,8 / 21,4 / 21,1 | **21,4** | 24,8 / 27,0 / 20,7 | **24,8** | |

Somas dos blocos (medianas): `knockOutUnits` 3,4 (cratera 4,8); `solveStructure` 3,2 (3,0); `impls` 2,9 (3,3). Batem com a T0.1 grossa (3,4–4,2; 2,9; 2,8–3,0).
Contagens iguais nas 3 rodadas: 506 peças dentro do raio, 1360 juntas, 136 unidades (cratera 508, 1479, 142). Custo da sonda grossa: `explode` desligada 19,5–20,4 ms na
explosão (ligada 21,4: ~+1) e 20,2–20,6 na cratera (ligada 20,1–26,5, uma rodada em 26,5: ruído de sessão; o total mediano da cratera, 24,8, vem de duas rodadas altas).

### Conta do teto (mediana, ms; explosão / cratera)

| Linha | Explosão | Cratera | Fonte |
|---|---|---|---|
| (a) `partGeometry` (onda e geometria por peça) | 1,9 | 1,3 | T0.1 fino, **inflado** pelos ~3000 timers; sem sonda ~0,6–1,1 (palpite da T0.1) |
| (b) `koGrid`: conta de grade pura | 2,1 | 2,3 | medido agora |
| (c) `ssSolve` + `ssLoads` + `ssSpan` + `ssGraph` | 1,1 | 1,6 | medido agora (o grafo é leitura pura; entra na entrada) |
| **Teto puro bruto** (a+b+c) | **5,1** | **5,2** | |
| + `ssApply` (laço final: estresse, flexão; escreve `p.st`) | 2,1 | 1,4 | medido; **não é puro** (escreve), entra só no teto folgado |
| + `koFragments` (usa `rnd`, cria fragmentos) | 0,5 | 0,6 | medido; **não é puro** |
| + `impls` (`sedan_scenery_1` e `room_ground`) | 2,9 | 3,3 | medido; trabalho de `DestructibleImpl` fora do `game-destruction`, **não verificado se é puro** |
| **Teto folgado** (tudo acima) | **10,6** | **10,5** | |
| Fronteira (T0.2): montar entrada plana de ~506 peças | −0,8 | −0,8 | medido (T0.2) |
| Fronteira: `structuredClone` da entrada (ou ~0,01 com `transfer`) | −0,18 | −0,19 | medido (T0.2) |
| Fronteira: aplicar o plano na volta | −1,0 | −1,0 | **estimativa declarada** (palpite): ~metade de `applyDamage` (1,1–1,9 ms em 506 chamadas); a entrada de `koGrid`/`ss*` (grade e grafo) também não está na entrada plana da T0.2 e **não foi medida**, então a fronteira real é maior |
| **Teto líquido, puro** | **~3,1** | **~3,2** | 5,1 − 2,0; 5,2 − 2,0 |
| **Teto líquido, folgado** | **~8,6** | **~8,5** | 10,6 − 2,0; 10,5 − 2,0 |
| Critério da T0.3 | ≥ 15 | ≥ 15 | |

### Leitura

**Fatos:**
- O teto líquido é **~3 ms** (só o puro) e **~8,5 ms** (contando como movível tudo o que se mediu, inclusive o que escreve estado e o que é de impl). Os dois ficam
  **abaixo de 15 ms**. A conclusão não depende da estimativa de 1,0 ms para aplicar o plano: com fronteira zero o teto folgado seria 10,6 ms, ainda abaixo.
- Mesmo movendo **tudo que tem rótulo** do `explode` (`koGrid`, `ss*`, `impls`, `groups`, `detachEvents`, `flushCollapse`: ~10,3 ms na explosão e ~12,1 na cratera), sobra
  `explodeRest` ~11–13 ms, que é o laço por peça (`emit` e ouvintes ~3,5–4,6 ms, `applyDamage`, `wearJoints`, `units`, `bend`, `marks`): lê e escreve estado e chama ouvintes.
- A maior peça pura é `koGrid` (~2,1–2,3 ms em 2–3 chamadas), seguida de `partGeometry` (≤ 1,9 ms) e `solveSupports` + `distributeLoads` (~0,6–0,9 ms). Cada uma é menor que a
  fronteira da T0.2 (snapshot 7,3 ms) e a mesma ordem de grandeza da montagem plana (0,8 ms).
- `ssApply` (~1,4–2,1 ms, a maior parte do `solveStructure`) **escreve** estado (`p.st.load`, `stress`, `flexure`, `unsup`): não é kernel puro. O `solveSupports` em si é ~0,3–0,5 ms.
- `impls` (~2,9–3,3 ms) é quase todo `impl:sedan_scenery_1` (2,3–2,7 ms, 1 chamada de `impl.hit`) mais `impl:room_ground` (0,5–0,6 ms); o código do mundo ao redor (`implInRange`,
  `implDescribe`, `implHit`) custa ~0,1 ms. É o veículo da cena (e o chão) respondendo à explosão: trabalho de um `DestructibleImpl` registrado fora do pacote.

**Palpites (não medidos):**
- O que bastaria para chegar perto de 15 ms seria tirar o `emit`/ouvintes do quadro (a parte "(f)") e o laço por peça, o que muda *quando* os ouvintes rodam e o que o quadro seguinte
  recebe. Isso é outro caminho (B ou C da spec), não um kernel puro; a decisão é da D1.
- Se o `impl.hit` do sedã for puro e movível, o teto folgado já o inclui (2,3–2,7 ms); seguiria abaixo de 15 ms.

### Descartes e o que NÃO foi medido

- Descartes: nenhuma rodada. Não houve protótipo de kernel, então não há régua em pares sem/com nem quadros seguintes a olhar (nada a descartar nem a comparar).
- Não medido: `partGeometry` sem timer (usa-se o valor inflado do modo fino da T0.1, que só enfraquece o argumento a favor do caminho A); a entrada de `koGrid` e do grafo
  (`unitGrid`, `wedgedUnder`, `edgeLists`) montada e copiada; o custo real de aplicar o plano na volta (1,0 ms é estimativa); o abrigo (`reachAt`); outras casas; 4x; uma
  segunda série (a cratera do total teve duas rodadas altas, 24,2 e 26,5 ms; as medianas dela têm ±2 ms de ruído). Não foi analisado `afterMs` (quadros 1–7): sem protótipo, sem
  comparação.
- **Não foi construído** o protótipo do passo 3 (entrada plana, kernel, aplicação em N + 1), pela regra de parar do passo 2.
