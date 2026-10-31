# Desempenho das explosões na sala de testes — análise, correções e teste

Trabalho de 2026-10-31 na branch `perf/explosion-frame-budget`. Objetivo do dono: **nenhum travamento**, mesmo com todas as ações ao mesmo tempo, e um teste que impeça a volta dos travamentos.

## Como se mede

`examples/test-room/perf.mjs` abre a sala completa (`dist/test-room.html?area=vfx`, com o conteúdo de todos os times) e deixa o laço da própria sala rodar em tempo real. Assim cada quadro é renderizado de verdade; com `step()` nada seria desenhado.

Ele dispara os nove explosivos do arsenal em três fases:

| Fase | O que faz |
|---|---|
| **frio** | um de cada vez, na primeira vez que aparecem: `cold_frag_grenade`, `cold_molotov`, `cold_pipe_bomb`, `cold_m79`, `cold_rpg_7`, `cold_at4`, `cold_dynamite`, `cold_c4`, `cold_claymore` |
| **quente** (`warm_all`) | todos de novo |
| **tempestade** (`storm`) | os nove três vezes seguidas e mais 20 granadas, 47 explosões em poucos segundos |

A C4 vai pelo detonador (tecla Y) e a claymore pelo fio, com o jogador passando por ele.

| Orçamento | Valor | Modo |
|---|---|---|
| Shaders compilados durante o jogo | 0 | sempre |
| Buffers de GPU criados por explosão quente | ≤ 40 | sempre |
| Draws por quadro depois da tempestade | ≤ 110% do repouso | sempre |
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
| tempestade | 356 ms | **1.207 ms** | **595** |
| repouso depois da tempestade | 50 ms | 53 ms | **135** (recompilando parado) |

- **Draws por quadro:** iam de 856 em repouso para 2.015 depois da tempestade e não voltavam mais.
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
| O painel de log criava um nó do DOM por evento; a tempestade gera centenas | `game-test-room/src/ui.ts` | Um lote por quadro, no máximo 200 linhas, nada com o painel fechado |
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
| tempestade (47 explosões) | 356 ms | **7,8 ms** | **1.207 ms** | **14,6 ms** | 595 → **0** |
| depois da tempestade | 50 ms | **6,3 ms** | 53 ms | **7,8 ms** | 135 → **0** |

- **Orçamentos:** de 43 estourados para **2**.
- **Long tasks:** nenhuma acima de 50 ms em fase nenhuma (antes chegavam a 619 ms).
- **Draws depois da tempestade:** 630, abaixo do repouso (886); antes eram 2.015.
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
- **A ordem do quadro não tem dono** (item 9 da análise). Os orçamentos de tempo (áudio 2 ms, eventos 8 ms, `crease` 2,5 ms) foram postos cada um no seu pacote. O `game-runtime` proposto deve juntá-los num orçamento único por quadro.
