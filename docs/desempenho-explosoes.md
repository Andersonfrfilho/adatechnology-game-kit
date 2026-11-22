# Desempenho das explosões na sala de testes — análise, correções e teste

Trabalho de 2026-10-31 na branch `perf/explosion-frame-budget`. Objetivo do dono: **nenhum travamento**, mesmo com todas as ações ao mesmo tempo, e um teste que impeça a volta dos travamentos.

## Como se mede

`examples/test-room/perf.mjs` abre a sala completa (`dist/test-room.html?area=vfx`, com o conteúdo de todos os times) e deixa o laço da própria sala rodar em tempo real. Assim cada quadro é renderizado de verdade; com `step()` nada seria desenhado.

Ele dispara os nove explosivos do arsenal em três fases:

| Fase | O que faz |
|---|---|
| **frio** | um de cada vez, na primeira vez que aparecem: `cold_frag_grenade`, `cold_molotov`, `cold_pipe_bomb`, `cold_m79`, `cold_rpg_7`, `cold_at4`, `cold_dynamite`, `cold_c4`, `cold_claymore` |
| **quente** (`warm_all`) | todos de novo |
| **rajada de explosões** (`burst`, depois `after_burst`) | os nove três vezes seguidas e mais 20 granadas, 47 explosões em poucos segundos |

A C4 vai pelo detonador (tecla Y) e a claymore pelo fio, com o jogador passando por ele.

A rajada se chamava `storm` ("tempestade"), nome que se confundia com o clima da sala (`ROOM_EXPLOSION_WEATHER=storm` é chuva de verdade). `PERF_SHARD=storm` ainda roda a rajada, com um aviso; as fases saem como `burst` e `after_burst`. Medições antigas em `specs/` guardam o nome da época.

| Orçamento | Valor | Modo |
|---|---|---|
| Shaders compilados durante o jogo | 0 | sempre |
| Buffers de GPU criados por explosão quente | ≤ 40 | sempre |
| Draws por quadro depois da rajada | ≤ 110% do repouso | sempre |
| Quadro acima de 33,4 ms (perde dois refresh de 60 Hz) | 0 | `PERF_MODE=gpu` |
| p99 do quadro | ≤ 20 ms | `PERF_MODE=gpu` |
| Long task (bloqueio da thread principal) | ≤ 50 ms | `PERF_MODE=gpu` |

Os três primeiros orçamentos não dependem da máquina e rodam no CI, no job `perf-budget`, com GL por software. Os três últimos precisam de GPU de verdade e rodam na máquina de quem desenvolve:

```bash
pnpm build && node examples/test-room/build.mjs
# notebook com PRIME (Intel + NVIDIA): as variáveis mandam o Chrome para a NVIDIA
PERF_MODE=gpu PERF_CHROME=/usr/bin/google-chrome-stable \
__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia \
__EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/10_nvidia.json \
node examples/test-room/perf.mjs
```

- **Relatório:** cada fase imprime uma linha `PHASE` e o relatório completo vai para `examples/test-room/dist/perf.json`.
- **Culpado do quadro lento:** quadro acima do orçamento traz `slowFrames`, com o script que rodou nele (Long Animation Frames).
- **Perfil de uma fase:** `PERF_PROFILE=<fase>` grava `dist/perf-<fase>.cpuprofile`, que abre no DevTools. Ligar o profiler causa um quadro de ~1,2 s no início da fase perfilada, que não conta como problema.
- **Medir com a GPU livre:** duas medições na mesma GPU se atrapalham, e os números de uma rodada com outro processo usando a GPU não valem.

## Ponto de partida (main de 2026-10-31, RTX 5070, 1600×900)

O teste falhava em **43 orçamentos**.

| Fase | p99 | Pior quadro | Shaders no meio do jogo |
|---|---|---|---|
| repouso | 12 ms | 14 ms | 0 |
| primeira granada | 16 ms | 177 ms | 0 |
| primeiro molotov | 45 ms | 266 ms | 2 |
| rajada | 356 ms | **1.207 ms** | **595** |
| repouso depois da rajada | 50 ms | 53 ms | **135** (recompilando parado) |

- **Draws por quadro:** iam de 856 em repouso para 2.015 depois da rajada e não voltavam mais.
- **Buffers de GPU:** cada explosão quente criava 154 em média.

## Causas e correções

Foram três rodadas de especialistas em paralelo, cada um num worktree e numa branch próprios, todas juntadas em `perf/explosion-frame-budget`.

| Causa | Onde | Correção |
|---|---|---|
| Luz criada por foguete em voo. No three.js, mudar o número de luzes recompila **todos** os materiais com luz | `game-weapons-three/src/fx/heavy.ts` | Uma luz fixa, ligada só pela intensidade (`createRocketLight`) |
| As 6 luzes da Oficina de VFX só nasciam no primeiro efeito da Oficina | `game-vfx-three/src/renderer.ts` | `attachWorkshopLayers()` no pré-aquecimento |
| O material da fumaça do veículo era descartado a cada baforada; o three libera o programa e recompila no próximo surto | `game-vehicles/src/particles.ts` (causa), `game-test-room/src/room.ts` (contorno) | `pinPrograms()`: programa compilado nunca é liberado. A correção de verdade é o pool de materiais (pendente, ver abaixo) |
| A cor por instância era criada no primeiro uso, o que muda a chave do programa | `game-terrain-three/src/layers.ts` | `setColorAt` na criação |
| Uma variante de sprite (sem neblina) não entrava no `warmUp` | `game-test-room/src/room.ts` | sondas de sprite com e sem neblina |
| Malha, geometria e material novos por partícula de fumaça e clarão | `game-vfx-three/src/mesh-layer.ts` | Geometria unitária por forma e malhas estacionadas e reaproveitadas (até 256 por tipo) |
| `PlaneGeometry` nova por marca no chão; uma malha com sombra por pedra e por poça de sangue | `game-vfx-three/src/marks.ts` | Anel de até 64 marcas; pedras, placas e sangue instanciados (`markLimits`) |
| Geometria do pedaço de terreno refeita a cada cratera | `game-terrain-three/src/chunk-geometry.ts`, `rebar.ts` | Buffers reescritos no lugar |
| Destroço parado recalculando a matriz todo quadro | `game-destruction-three/src/fragments.ts` | `matrixAutoUpdate = false` ao dormir |
| O renderer da destruição lia `part()` por parte e por quadro, e o veículo remontava o estado inteiro a cada leitura | `game-vehicles/src/destructible/impl.ts` | Cache do `state()` invalidado só quando o dano muda (1.369 ms → 6 ms no perfil) |
| O painel de log criava um nó do DOM por evento; a rajada gera centenas | `game-test-room/src/ui.ts` | Um lote por quadro, no máximo 200 linhas, nada com o painel fechado |
| `history.replaceState` em todo quadro | `game-test-room/src/room.ts`, `examples/test-room/src/main.js` | Só quando o estado muda |
| Objeto novo por zumbi por quadro | `game-crowd/src/crowd.ts` | Objeto vazio compartilhado |
| ~74 sons de uma granada montados no mesmo quadro (~18 ms) | `game-audio` (`realize`) | `deferredStart`: as vozes são montadas em fatias de 2 ms entre quadros, com no máximo 250 ms de atraso, e o motor é pré-aquecido no `warmUp` |
| A explosão visitava cada parte de cada objeto no alcance (a casa inteira) | `game-destruction/src/world.ts` | Fase larga por esfera envolvente, sem alocação e com resultado idêntico |
| `splitGroup` clonava a spec duas vezes | `game-destruction/src/world.ts` | As metades compartilham a spec (ela nunca é escrita depois do `add`) |
| A fila de eventos da destruição aplicava tudo num quadro | `game-destruction-three/src/renderer.ts` | `eventBudgetMs` (padrão 8 ms) |
| `crease` (normais da peça arrancada do carro) varria os ~120 mil vértices do sedã num quadro | `game-vehicles/src/geometry.ts`, `destructible/visual.ts` | Saída idêntica bit a bit, 2,5× mais rápido e espalhado em fatias de 2,5 ms (`creaseTask`, `pump`) |
| O corte da peça arrancada e as marcas de dano no carro visitavam todos os triângulos do sedã | `game-vehicles/src/geometry.ts`, `zone-dent.ts`, `zone-decals.ts` | Índice de triângulos por bloco (`tri-index.ts`): só a região da peça é visitada (`tearOff` de ~41 ms para ~12 ms no perfil), com resultado idêntico bit a bit |
| O solver de estrutura pedia as mesmas caixas de contato a cada junta quebrada | `game-destruction/src/world.ts` | Caixa de contato lembrada por par de partes. Explosão de 4 MJ no sobrado: de 172 ms para 43 ms, com o mesmo hash de eventos |
| A pintura do reboco lascado repintava a parede inteira a cada evento, dentro da explosão | `game-floorplan-three/src/destruction/breach.ts` | Parede marcada como suja e repintada uma vez por quadro, com orçamento de 4 ms. O furo aparece no primeiro quadro |
| Destroços e grupos soltos eram criados todos no quadro da explosão | `game-destruction-three/src/renderer.ts` | Fila em fatias: 8 destroços por quadro, um grupo solto por fatia |

### Os goldens: o que quase passou errado

Na medição final, os testes que comparam a geometria dos times bit a bit falharam: 25 + 5 + 65 nos veículos e 3 nas casas. Os especialistas tinham chamado essas falhas de "pré-existentes", porque compararam com um `main` antigo, onde esses testes falhavam por outro motivo (Node 22/24). No `main` atual eles passavam, então a regressão era nossa. As três causas e as correções:

1. **Versão do atributo.** O `crease` mais rápido marcava as normais como alteradas (versão 0 → 1), e o golden conta a versão. Agora só marca no caminho espalhado em quadros.
2. **Cena com três nós a mais.** O pool de marcas do vfx punha três malhas vazias na cena antes da hora. Agora elas entram com a primeira marca do tipo, e o `prepare()` as liga no pré-aquecimento.
3. **Orçamentos como padrão para todos.** Os orçamentos por quadro (8 ms de eventos, 4 ms de pintura) eram o padrão, e o golden tinha sido editado para escondê-lo. Agora o padrão é síncrono, como antes, e quem liga os orçamentos é a sala (`eventBudgetMs: 8`) e a área das casas (`breachPaintBudgetMs: 4`). O teste golden voltou ao original.

Resultado: os arquivos de golden estão idênticos aos do `main`, e todos os pacotes tocados passam 100%. A regra que ficou: falha "pré-existente" só se compara com o `main` atual, nunca com a base da branch.

## Resultado final (RTX 5070, máquina parada, load 3,3)

| Fase | p99 antes | p99 agora | Pior quadro antes | Pior quadro agora | Shaders no meio do jogo |
|---|---|---|---|---|---|
| repouso | 12 ms | **6,5 ms** | 14 ms | **8 ms** | 0 |
| primeira granada | 16 ms | **6,8 ms** | 177 ms | **36 ms** | 0 |
| primeiro molotov | 45 ms | **7,7 ms** | 266 ms | **36 ms** | 2 → **0** |
| primeiro RPG-7 | 236 ms | **7,5 ms** | 565 ms | **18 ms** | 0 |
| todos de novo (quente) | 120 ms | **7,2 ms** | 234 ms | **23 ms** | 0 |
| rajada (47 explosões) | 356 ms | **7,8 ms** | **1.207 ms** | **14,6 ms** | 595 → **0** |
| depois da rajada | 50 ms | **6,3 ms** | 53 ms | **7,8 ms** | 135 → **0** |

- **Orçamentos:** de 43 estourados para **2**.
- **Long tasks:** nenhuma acima de 50 ms em fase nenhuma (antes chegavam a 619 ms).
- **Draws depois da rajada:** 630, abaixo do repouso (886); antes eram 2.015.
- **Buffers de GPU por explosão quente:** 21 em média (orçamento 40; antes 154).
- **O que sobra:** a primeira granada (2 quadros de 36,4 ms) e o primeiro molotov (1 quadro de 36 ms), 3 ms acima do limite e só na primeira vez. Nesses quadros não há long task nem quadro de animação longo: a thread principal nunca ficou presa por mais de 33 ms. O tempo vem do lado da GPU, no primeiro envio dos buffers do efeito (210 na primeira granada). A correção é pré-carregar esses buffers no carregamento, junto do pré-aquecimento dos shaders, e é a T4.6 da spec 005 (`ProgramWarmup` e pools no `game-render-three`).

## O que um jogo precisa ligar para ter o mesmo resultado

Nada muda no three.js. As correções valem sozinhas para quem atualizar os pacotes, exceto estas, que são opcionais para não mudar o comportamento de quem usa a API direto:

1. **Pré-aquecimento dos shaders no carregamento:** chamar os `warmUpProbes()` dos adaptadores depois de pôr as luzes, como faz o `warmUp()` da sala.
2. **Áudio:** `deferredStart: true` no motor do `game-audio` e `audio.warmUp()` no carregamento.
3. **Destruição:** `eventBudgetMs: 8` no `game-destruction-three` e `breachPaintBudgetMs: 4` no `game-floorplan-three`.
4. **Um só mundo de efeitos,** compartilhado entre destruição, fluidos e armas.
5. **Shaders presos:** o `pinPrograms` mora na sala. Até a T4.5 da spec 005 (pool de materiais), um jogo com fumaça de veículo recompila sem ele.

## Pendências conhecidas

- **`pinPrograms` é um contorno.** A correção de verdade é o pool de materiais das partículas do veículo e de `game-weapons-three/src/fx/heavy.ts`, que cria geometria e material a cada gota. Isso é o item 11 de [arquitetura-plug-sdks.md](arquitetura-plug-sdks.md).
- **Luz por lâmpada da casa** (`game-interactables-three/src/mesh.ts:155`). Quebrar uma lâmpada muda o número de luzes e recompila tudo. Precisa do orçamento único de luzes (item 10 da análise de arquitetura).
- **Nós estáticos do sedã de alta qualidade.** São ~800 nós que recalculam a matriz todo quadro. Congelá-los exige a lista dos nós que nunca se movem.
- ~~**A ordem do quadro não tem dono** (item 9 da análise). Os orçamentos de tempo (áudio 2 ms, eventos 8 ms, `crease` 2,5 ms) foram postos cada um no seu pacote. O `game-runtime` proposto deve juntá-los num orçamento único por quadro.~~ **Resolvida pela spec 010 (2026-11-19):** o `game-runtime` é o dono do prazo do quadro e do passo fixo; ver a seção "Spec 010 — quadro com prazo" no fim deste arquivo.

## Gate do pre-push: comparação com a main na mesma máquina (2026-11-03)

Os orçamentos absolutos (p99 20 ms, nenhum quadro acima de 33,4 ms, long task até 50 ms, draws) travavam até o push da própria `main` na RTX 5070 do
notebook (11 orçamentos estourados no `e7b02cae`). Um número fixo depende da máquina, da janela e do carregador. Por isso o
`tools/gpu/perf-gate.mjs` passou a fazer assim:

- **Bloqueia:** (1) falha dura do `perf.mjs` em qualquer máquina: programa ligado no meio do jogo, erro na página, luz no slot errado, horda que não
  faz o que a fase pede; (2) fase mais de 10% pior que a `origin/main` **medida na mesma máquina**, mesma GPU e mesma janela (p99, pior quadro,
  pior long task, quadros acima de 33 ms, draws por quadro, passo e draws da horda). Cada métrica tem um piso de ruído (`tools/gpu/compare.mjs`).
- **Tempo de quadro lido a partir de um refresh de 60 Hz:** com janela, o compositor segura o quadro na vsync. Duas rodadas da `main` deram
  `cold_dynamite` p99 9,5 e 17,6 ms; abaixo de 16,7 ms a diferença não diz nada do código.
- **Duas rodadas antes de bloquear:** se algo passou de 10%, mede os dois lados de novo e compara a melhor rodada da branch com a pior da `main`.
  Só bloqueia quando toda rodada da branch é pior que toda rodada da `main`.
- **Buffers criados no jogo não bloqueiam:** voltar a desenhar em lotes um carro atingido cria algumas centenas de buffers uma vez para economizar
  centenas de draws por quadro. Um envio que custa um quadro aparece no tempo de quadro, que é comparado.
- **Os orçamentos absolutos continuam no relatório como meta** (`TARGET`), com a contagem da `main` ao lado. `PERF_GATE_ABSOLUTE=1` volta a bloquear
  neles.
- A rodada da `main` fica em cache por commit, GPU, janela e versão do `perf.mjs` (`~/.cache/adatechnology-game-kit/perf`), e a `main` é
  montada num worktree próprio ali. A primeira vez depois de cada merge leva uns 8 min a mais.
- `perf.mjs` ganhou `PERF_TARGETS=report` (metas fora do código de saída), `PERF_VIEWPORT=LxA`, `firstUses` (programas desenhados pela primeira
  vez no jogo, com o objeto que pediu) e `PERF_DRAWLIST=1` (os draws de um quadro por objeto e material).

### O que a medição achou e o que foi corrigido

Medido na RTX 5070 do notebook, com a máquina quieta, a 1600×900. Em 320×180 os draws, buffers e `firstUses` dão praticamente o mesmo:
a diferença para o CI não vinha do tamanho da janela, e sim de o CI não ter GPU.

| Causa | Onde | Correção |
|---|---|---|
| Um carro atingido nunca voltava a ser desenhado em lotes: desenhava peça por peça para sempre (~900 draws por quadro na `chain_horde`) | `game-vehicles-three/src/vehicle-lod.ts` | Volta a lotes depois de 1,5 s sem mudança (`VEHICLE_REBATCH_AFTER_MS`), com as sombras das próprias peças (o formato amassado). Tentativa descartada: manter os lotes de antes do tiro deixava as peças amassadas soltas para sempre e subiu os draws (`cold_claymore` 194 → 342) |
| Seis programas de sombra ligados no carregamento e desenhados pela primeira vez no jogo: o three lê o link e os logs no primeiro uso (~43 ms no primeiro estouro da `chain_horde`) | `game-render-three/src/warmup.ts` | O `warmUp` termina todo programa ligado (`getUniforms`), e só então vê um link quebrado |
| A mira do HUD testava os triângulos dos lotes do carro além das peças, duas vezes por atualização | `game-vehicles/src/destructible/impl.ts`, `game-test-room/src/room.ts` | `surfaceRay` pula `userData.noSurfaceRay` e nós escondidos; um raio por atualização do HUD |
| A remedição periódica das caixas estáticas media todos os objetos num quadro (até 88 ms em GL por software) | `game-destruction-three/src/renderer.ts` | Fatias de 1 ms; os objetos tocados por um evento continuam medidos na hora |
| O log da sala lia `scrollHeight` logo depois de mexer no DOM (layout forçado no meio do quadro) | `game-test-room/src/ui.ts`, `room.ts` | Rola no começo do próximo flush, que roda antes do HUD |
| As caixas do amassado do carro eram recalculadas com `getX/getY/getZ` por vértice | `game-vehicles/src/impact.ts` | Lidas direto do array, com o mesmo resultado |

### O que ainda falta (medido na RTX em 2026-11-03)

O primeiro estouro perto do carro na `chain_horde` ainda tem um quadro de ~100 ms. O tempo é CPU do dano no veículo, não da GPU: `tearOff` e
`panelBand` montam a geometria da faixa arrancada copiando os arrays num quadro só (~72 ms), o amassado percorre os vértices, o `smoothLater`
chama `toNonIndexed`, e o lixo dessas cópias custa ~25 ms de coleta logo depois. É o trabalho da fase 4 da spec 006 (dano do carro em fatias).

## Desenhos do carro atingido e sombra da casa (2026-11-18)

Medido na sala (`?area=floorplan`, variante `jolt-d4-worker`, worker do chão ligado como na sala de verdade, cratera ao lado da casa), contando
as chamadas de desenho de cada `render` por dono (`kitOrigin`) e por passe (câmera ou sombra), em GL por software num contêiner de 4 núcleos:
os tempos dessa máquina não valem, as contagens sim (dependem da cena e do enquadramento, não da GPU).

| Causa | Onde | Correção |
|---|---|---|
| O carro longe (desenhado fundido) atingido pela explosão da casa passava a desenhar peça por peça, com a sombra de cada uma, até ficar 1,5 s quieto: 428 + 194 de sombra, ~620 chamadas por quadro, e depois juntava os lotes de uma vez (16 a 22 ms num quadro no sedã de 320 mil vértices) | `game-vehicles-three/src/vehicle-lod.ts` | Lotes já no golpe, em pedaços de até 16 mil vértices (`maxVertices`), e só a peça que muda sai; as que saíram voltam a um lote novo, amassadas, depois de 1,5 s quietas. Sedã a 60 qps com relógio simulado: 95 quadros acima de 300 chamadas antes, ~10 agora; nenhuma atualização acima de ~6 ms; 70 + 37 de sombra no fim (eram 67 + 34) |
| Cada uma das ~276 malhas da estrutura da casa tinha o próprio desenho no mapa de sombra do sol (231 chamadas por quadro) | `game-floorplan-three/src/house/shadow-batches.ts`, `game-render-three/src/static-batcher.ts` | Lotes só de sombra (`shadowOnly`): as malhas continuam desenhadas para a câmera e as paradas projetam a sombra de poucos lotes (só posições, mesmos triângulos). A peça que quebra, cai, abre ou é escondida volta a projetar a própria sombra no quadro em que muda. Sombra da estrutura: 231 → 16 chamadas. `?shadowBatches=0` volta ao antigo para comparar |

Fica para depois: os 40 móveis destrutíveis da casa (cada um com a própria sombra) são objetos do mundo de destruição, desenhados pelo
`game-destruction-three`, e a casa ainda tem ~276 chamadas no passe da câmera (um lote por material como o do carro, com o corte por andar e
a máscara de luz dos cômodos, é outra frente).

## Spec 010 — quadro com prazo (2026-11-19)

Regra em vigor: [`specs/regras/15-quadro-e-desempenho.md`](../specs/regras/15-quadro-e-desempenho.md). Spec, plano e evidência:
[`specs/010-quadro-com-prazo/`](../specs/010-quadro-com-prazo/). A análise de 2026-11-18 achou que os ~30 PRs `perf(...)` mais recentes atacavam
sintomas (pintura de parede, lotes, sombra) e que o pior quadro vinha de três causas de estrutura, nenhuma com número gravado.

### As três causas

| # | Causa | O que acontecia |
|---|---|---|
| P1 | Relógios próprios e orçamentos somados | O `FrameBudget` começava todo quadro com 8 ms cheios, sem descontar a simulação, e por fora dele corriam relógios próprios (lotes da sala 1 ms, sombra da casa 2 ms, lotes do veículo 2 ms, destroços assentados 2 ms, filme de fluido 1,2 ms, oclusão do áudio 1 ms, caixas estáticas 1 ms, `prefit` 1 ms, amassado 2,5 ms). Cada um somava no pior quadro sem ninguém ver |
| P2 | Dois relógios de simulação, desenho sem interpolação | O agendador e o `PhysicsLoop` tinham acumulador e `alpha` próprios; a sala simulava tudo em `lateSimulate` com o `dt` do quadro; ninguém lia nenhum `alpha` |
| P3 | Custo por peça viva, estrutura refeita por parte perdida | `prepare`, `measure`, `readBack` e `syncTransforms` percorriam todas as peças (dormindo também), `readPose`/`readVelocity` cruzavam o wasm ~17 vezes por corpo, e `partLost` chamava `solveStructure` + `recomputeGroups` no objeto inteiro a cada parte |

### Os números da régua (T0.2 e T0.4; helios, variante `jolt-d4-worker`, com a trava)

- **T0.2** (`specs/010-quadro-com-prazo/medicoes/regua-feb400220.json`): a 1x o p99 do update fica em 4,7 a 6,1 ms; o pior quadro sem o f0 em 14 a 19 ms.
  P1+P2+P3 explicam 84 a 86% dele (P3 37 a 57%, P1 27 a 44%, P2 2 a 3% a 1x e 12 a 20% a 4x). O quadro 0 (f0) dá 28 a 34 ms de update.
- **T0.4** (a régua passou a abrir o relógio do f0 antes de `blastAt`/`world.hit`): o update do f0 inteiro é **71 a 72 ms a 1x** (260 a 287 ms a 4x).
  Metade disso é a chamada síncrona: `world.explode` leva **36 a 38 ms** a 1x (140 a 148 ms a 4x), com 33 a 39 chamadas de `solveStructure` por explosão
  que a T0.2 não via. O `rest` sem dono do f0 era, na maior parte, a fila `floorplan.breach-cut` (10 a 12 ms) e `action` (6 ms), não o `flush()`.
- **Depois da T2.1 (indicativo, Node, mediana de 7, máquina com outras sessões):** `solveStructure` por `explode` de 4 MJ no sobrado **174 → 39**; CPU do
  `world.explode` **112,6 → ~33 ms**. Não é tempo de quadro na GPU; o número que fecha a meta é o da T4.1.

### O que cada fase mudou

- **Fase 1 (P1), orçamento único pelo prazo.** `game-runtime` ganhou o modo de prazo opcional por quadro (`targetMs` + `frameStartMs`): o trabalho adiado
  recebe o que sobra até `frameStartMs + targetMs`, menos a estimativa do render, com piso de 1 ms e sem dívida. Todo relógio próprio virou uma
  `DeferredQueue` registrada no `scheduler.budget` da sala (lotes por dono, sombra da casa, lotes do veículo, destroços assentados, filme, oclusão,
  `prefit`, amassado); `destruction.events` e `floorplan.breach-cut` são `mustDrain` (aparecem no quadro do golpe, fora do prazo, contadas à parte).
  Sem host a fila drena por `drainDetached` (`game-contracts`), a única exceção sancionada. O campo de fluxo da multidão passou a unidades
  (`cellsPerStep`). A regra `own-frame-clock` do `kit-audit` barra relógio novo (`--strict-clocks` é o portão da C3).
- **Fase 2 (P3), estrutura adiada e custo por peça acordada.** A estrutura é resolvida uma vez por objeto por `run()` (`loosened`, não uma vez por parte
  perdida) e todo `detach` sai no fim da operação com os grupos finais; `solveStructure` e `recomputeGroups` sem alocação por chamada; lista de peças
  acordadas (`prepare`/`readBack`/`measure` só nelas); `readPose`/`readVelocity` do Jolt lidas do heap; `syncTransforms` só do que mudou.
- **Fase 3 (P2), um passo fixo só e desenho interpolado.** O acumulador é o do agendador (tique de 1/60 = 2 passos de física de 1/120, no máximo 3 tiques
  por quadro); `PhysicsLoop.stepFixed(steps)`; a sala simula em `fixedSimulate`; peças e fragmentos guardam a pose do passo anterior e o desenho
  interpola pelo `alpha`; o banco de provas deixou de ter acumulador próprio. O valor é correção (60, 120 e 144 Hz dão o mesmo estado por passo), não ms.

### Régua final

régua final: ver T4.1 no `evidence.md` da spec 010 (ainda não medida; as medições por fase foram trocadas por uma só, por decisão do dono).

### O que a spec deixou aberto

- A física na fase `input` (empurrar, objeto na mão, portas, ferramentas) ainda integra com o `dt` do quadro: spec própria.
- Eventos da explosão que criam peças entram na fila do quadro, não no tique; o teste C5 depende de aquecimento por isso.
- A regra `own-frame-clock` não enxerga relógio injetado (recebido por parâmetro).


## Como medir o quadro da explosão (spec 017)

Regra: [`specs/regras/15-quadro-e-desempenho.md`](../specs/regras/15-quadro-e-desempenho.md). Evidência completa: [`specs/017-quadro-da-explosao/evidence.md`](../specs/017-quadro-da-explosao/evidence.md).

**Régua curta, no modo de prazo** (o modo do jogo; é o padrão da régua desde a 017), com a página da sala refeita (`pnpm build`) antes:

```bash
flock ~/.cache/adatechnology-game-kit/perf-measure.lock env \
  ROOM_EXPLOSION_KINDS=blast,crater ROOM_EXPLOSION_THROTTLES=1 ROOM_EXPLOSION_STAGE_THROTTLES=1 \
  ROOM_EXPLOSION_STAGE_ROUNDS=3 ROOM_EXPLOSION_ROUNDS=1 ROOM_EXPLOSION_FRAME_PARTS=1 \
  ROOM_EXPLOSION_OUT=/tmp/regua.json node tools/gpu/perf-gate.mjs room-explosion
```

- **Ler `f0Ms` e `afterMs`** (no relatório, em `frameMetrics`, por tipo): `f0Ms` é a média dos 3 piores quadros 0 de `update + renderCpu`; `afterMs` é a média, sobre
  essas 3 piores rodadas, do pior quadro dos 7 seguintes ao golpe de cada rodada. Menos de 3 rodadas, quadro 0 ou quadros 1 a 7 sem `renderCpu` não dão número: o
  log diz o motivo (`too-few-rounds`, `missing-hit-frame`, `missing-after-frames`) e nada bloqueia. O portão do `room-explosion` bloqueia quando um dos dois piora mais de 15% e mais de 3 ms contra a
  base, só a 1x, na variante padrão e com base no mesmo modo de orçamento. Quando nada é comparado (base em outro modo ou sem `frameMetrics`, rodada sem as partes
  do quadro, estágio sem nível que bloqueia) o log imprime `SEM COMPARAÇÃO NESTA RODADA: <motivo>` e o relatório grava `gate.compared: false` com o motivo. A rodada
  diária liga `FRAME_PARTS=1`.
- **Outro explosivo (`ROOM_EXPLOSION_EXPLOSIVE`):** por padrão a régua detona C4 (`c4`). A variável troca a carga dos tipos `blast`, `crater` e `water` por
  outro id do arsenal (`packages/game-weapons/src/data/explosives.json`, por exemplo `dynamite`; o `hammer` ignora a variável), para ler o caso típico na mesma casa; id desconhecido, ou carga que não explode a casa (sem energia, fumaça ou cone: `flashbang`, `smoke_grenade`, `claymore`), para a
  rodada antes de abrir o navegador. O relatório e o log trazem o explosivo usado. Uma rodada com outro explosivo serve só para
  leitura: nunca é comparada com a base nem bloqueia (o log imprime `SEM COMPARAÇÃO NESTA RODADA`), e nunca vira a base nem entra nela; uma base de outro explosivo
  (sem o campo vale `c4`) também não é comparada.
- **A base só melhora:** depois de uma noite que passou, a rodada diária grava `min(base, noite)` por métrica (`tools/gpu/room-explosion-base.mjs`); copiar a
  noite por cima deixava uma piora lenta (65, 68, 71...) passar para sempre.
- **Modo de cota não serve para o f0:** sem `frameStartMs` as filas ganham 8 ms em todo quadro e o f0 sai maior que no jogo. Números da 010 e da primeira
  metade da 017 (84 a 92 ms) são de cota; no modo de prazo a base antes da T3.1 era ~78 ms.
- **Rodadas alternadas:** antes, depois, antes, depois, cada uma com a página refeita no commit medido; a mesma versão varia ±2 ms entre sessões, então um
  ganho menor que ~3 ms não se lê no total, só no rótulo (`rebuildHost`, `breach-cut`...).
- **Carga de 1 minuto abaixo de 1,5** no início e no fim; rodada com outra sessão pesada junto se descarta (uma saiu com carga 16,8 e o quadro seguinte em 43 ms).

### Antes × depois com a régua: duas páginas guardadas

Guarde as duas páginas da sala (`examples/test-room/dist/test-room.html` de cada versão, depois de `pnpm build` no commit medido) e passe cada uma por
`ROOM_EXPLOSION_PAGE=`, com a outra em `ROOM_EXPLOSION_OTHER_PAGE=`:

```bash
ROOM_EXPLOSION_PAGE=/tmp/antes.html ROOM_EXPLOSION_OTHER_PAGE=/tmp/depois.html node tools/gpu/perf-gate.mjs room-explosion
ROOM_EXPLOSION_PAGE=/tmp/depois.html ROOM_EXPLOSION_OTHER_PAGE=/tmp/antes.html node tools/gpu/perf-gate.mjs room-explosion
```

- **A régua para se as duas páginas tiverem os mesmos bytes**, e o relatório JSON e o log trazem `pageSha256` da página medida: confira que o hash muda entre o antes e o depois.
- **Copiar uma página por cima de `dist/test-room.html` não funciona**: sem `ROOM_EXPLOSION_PAGE` a régua refaz essa página (`build.mjs`) antes de medir, e a cópia some. Foi assim que pares antes × depois mediram um build contra ele mesmo.
- **A página leva um carimbo** (`<meta name="kit-build">` no `<head>`, escrito pelo `build.mjs`): commit inteiro, `dirty` e hora do build. A régua grava `pageBuild: {commit, dirty, builtAt}` no JSON e imprime o carimbo. Página guardada sem carimbo vira `pageBuild: null` com um aviso, e segue.
- **`dirty` só conta o que muda a página ou a régua**: arquivo rastreado alterado em `packages/`, `tools/gpu/` ou `examples/`, menos as pastas `shots/` (o `browser-checks` regrava os prints antes da régua e sujaria toda noite). Arquivo não rastreado não conta. A regra é `isPageRelevantPath` em `tools/gpu/page-stamp.mjs`.
- **`pageSha256` não conta o carimbo** (o hash é da página sem a tag, que muda a cada build): mesmo hash continua querendo dizer mesmo código.
- **Build velho para a régua antes do navegador.** Quando ela refaz a própria página, confere só os pacotes que a página junta a partir do `dist` (lista única em `examples/test-room/page-packages.mjs`, a mesma que o `build.mjs` usa; `game-physics` e `game-physics-jolt` entram pelo `src` e ficam de fora). Para cada um compara o `src` (arquivos e pastas, para pegar arquivo apagado) com os arquivos de `dist` que a página resolve (`index.js`, subcaminhos como `fitted.js`, `kit-worker.global.js`), não com o mais novo da pasta. Entrada faltando ou mais velha que o `src`: ela para dizendo os pacotes e o comando (`pnpm --filter "<pacote>..." build` (o pacote e as dependências dele) ou `pnpm build`). O carimbo da página refeita tem de ser o `HEAD`. Não há variável para pular. Não confere os pacotes que só a página `interactables-test-area` junta.
- **A conferência vale também para as dependências do workspace:** o `dist` de um pacote é comparado com o `src` dele e com o de todas as dependências `@adatechnology/*` (`dependencies` e `peerDependencies`, transitivas), porque vários `tsup` embutem dependências (`noExternal`) e não lemos qual. Dependência que na verdade é externa só custa uma reconstrução a mais; a mensagem diz de qual `src` veio o atraso.
- **Limitação a vigiar:** arquivo rastreado fora de `shots/` em `packages/` ou `examples/` que o `browser-checks` regrave marcaria toda noite como `dirty` (nenhum conhecido hoje).
- **Limitação aceita:** um `dist` restaurado de cache com mtimes antigos aparece como velho até ser refeito (não há cache de turbo hoje).
- **A base só aceita relatório de build limpo do commit gravado**: sem `pageBuild`, com `dirty` ou de outro commit, `saveBase` recusa. Na rodada diária a recusa não derruba o script: o passo `room-explosion-base` entra como falho com o motivo no `summary.md`, a noite termina `FAILED` com a notificação normal e a base fica como estava. A base mesclada não guarda `pageBuild` (mistura noites de commits diferentes).
- **A rodada diária recusa essas variáveis**: `nightly-gpu.mjs` para antes de rodar qualquer passo se `ROOM_EXPLOSION_PAGE` ou `ROOM_EXPLOSION_OTHER_PAGE` estiver definida (vazia conta como não definida), porque a base da noite tem de vir do build do próprio commit.
- **Uma corrida com página guardada não grava a base**: se `ROOM_EXPLOSION_OUT` for o mesmo arquivo de `ROOM_EXPLOSION_BASE` junto com `ROOM_EXPLOSION_PAGE`, a régua para. A base só é gravada pela rodada diária (`saveBase`), e essa recusa a página guardada.

### O fecho da frente "sem mudar a simulação" (f0 de ~78 para ~64 ms; meta 33,3)

| Tentativa | Ganho medido no f0 (modo de prazo) | Estado |
|---|---|---|
| Pintura da casa fora do quadro do golpe (T3.1) | ~13 ms (78 → 65) | entrou |
| Malha da casa reescrita uma vez por lote | ~1,7 ms, no rótulo `rebuildHost` | entrou |
| Cortes A–D do `explode` (para na primeira peça, pose reaproveitada, menos alocação) | ~1 ms (dentro do ruído) | entrou, não muda nenhum bit |
| Cache do furo (`specOf`/`hostsOf`/`riders` por id) | 8 a 13 ms, mas em modo de cota | entrou |
| Eventos estruturais no tique (T2.2) | 0 (é correção de determinismo) | entrou |
| Eventos visuais adiados (3 revisões) | ~1 ms (ruído) | não entrou |
| Som montado pela fila | 0 na versão correta (o ganho vinha do teto de 4 sons) | não entrou |
| Corte da parede adiado (item F) | 0, e gravava o amassado na casca | não entrou |
| `reachAt` / grade de peças | 0: a sala usa `blastPlain`, o `reachAt` roda 0 vezes | sem o que cortar |

O que sobra é o laço por peça do `explode` (~17,6 ms, 521 peças) e a aplicação dos eventos estruturais (~17 ms, a maior parte malha, marcas, efeitos e som
espalhados em itens pequenos): trabalho que muda a simulação, a fronteira da decisão D5. Não repita as tentativas marcadas "não entrou" sem uma razão nova.

### Gravar a base à mão (modo de prazo, outra placa ou outro driver)

Este é o único lugar com os passos. Use quando: a base foi medida em outro modo (cota) e a primeira rodada não compara nada; **ou a rodada diária avisa que a base é de outra
placa/driver ou não registra a placa** (`SEM COMPARAÇÃO NESTA RODADA`, linha `room-explosion-base` no resumo e notificação). A base guardada pela rodada diária é
`~/.cache/adatechnology-game-kit/room-explosion-base.json` (ver `cacheDir` em `tools/gpu/nightly-gpu.mjs`). Nada a troca sozinho.

1. Máquina quieta: carga de 1 minuto abaixo de 1,5 (`uptime`).
2. Versões do driver iguais: módulo do kernel e biblioteca (a régua confere e para sozinha com `NVRM: API mismatch`; se atualizou o sistema, reinicie antes).
3. `pnpm build` e a rodada, uma vez:

```bash
pnpm build && flock ~/.cache/adatechnology-game-kit/perf-measure.lock env ROOM_EXPLOSION_FRAME_PARTS=1 \
  ROOM_EXPLOSION_OUT=/tmp/room-explosion-novo.json node tools/gpu/perf-gate.mjs room-explosion
```

4. Confira em `/tmp/room-explosion-novo.json`: `budgetMode: "deadline"`; `frameMetrics` sem problemas e nenhum erro de página; `machine.gpu` presente, com `driver.mismatch: false`;
   `pageBuild` limpo (`dirty: false`) e no commit do HEAD.
5. Só então grave a base:

```bash
cp /tmp/room-explosion-novo.json ~/.cache/adatechnology-game-kit/room-explosion-base.json
```

A linha do resumo e a notificação da rodada diária trazem este comando numa linha só.

### Qual placa desenhou (2026-11-21)

O relatório da régua da explosão grava `machine.gpu` = `{ renderer, vendor, tier, driver: { module, userspace, mismatch } }`, e a primeira linha do log mostra a placa ao lado
da página. `module` é a versão do módulo do kernel (`/proc/driver/nvidia/version`), `userspace` a da biblioteca que o carregador usa (o alvo do link `libnvidia-ml.so.1` no primeiro de
`/usr/lib`, `/usr/lib64`, `/usr/lib/x86_64-linux-gnu`; arquivo velho ao lado do link não conta) e `mismatch` é `true`, `false` ou `'unknown'` (com `reason`). **A comparação das duas
versões manda**: iguais e legíveis dão `false` mesmo que o `journalctl` tenha linhas `NVRM: API mismatch` (uma VM do Docker, um flatpak, ou um desencontro que já foi curado com
`modprobe`); elas só aparecem em `journalLines`, de informação. Sem a versão da biblioteca decide o `nvidia-smi` ("Driver/library version mismatch" é `true`, resposta normal é
`false`); só com tudo ilegível vale o journal (últimos 10 min, só linhas cujo cliente é o navegador). Cada comando filho tem 1 s. Um navegador isolado (flatpak, snap) pode usar um
runtime de GL que a checagem do host não enxerga.

- **Atualizou o sistema sem reiniciar? Reinicie antes de medir.** Em 2026-11-21 o driver foi atualizado sem reiniciar (biblioteca 620.73.04, módulo 615.78.08): seis horas de
  rodadas leram o quadro depois da explosão em ~105 ms em vez de ~26 ms. Com `mismatch: true` numa NVIDIA a régua falha antes de abrir a página medida; com `'unknown'` avisa e segue.
- **GL por software não mede tempo.** A régua da explosão recusa SwiftShader, llvmpipe e afins (antes ela passava direto pelo teste do `perf-gate`, que só pulava o gate normal).
- **A base só aceita relatório com `machine.gpu`, em placa de verdade e sem `mismatch: true`.** Uma noite em outra placa (nome sem os sufixos de versão) ou em outro módulo do
  driver não é comparada nem mesclada (`SEM COMPARAÇÃO NESTA RODADA`, um motivo por causa) e a base fica como está. **Base sem `machine.gpu` também não é comparada**: os números
  dela podem ser de outro driver (a base anterior a este campo cai aqui). A rodada diária, nesses casos, escreve uma linha no resumo toda noite e notifica uma vez por par
  (GPU/driver da base, GPU/driver atual), guardado em `nightly-state.json`, sem falhar a noite (a medição dela vale, só a base não anda). Para voltar a comparar, siga
  "Gravar a base à mão" acima.
