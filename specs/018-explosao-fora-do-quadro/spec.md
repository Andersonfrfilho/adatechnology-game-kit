# Spec 018 — a explosão fora do quadro principal

> Estado: **Fase 0 concluída, D1 a D3 abertas** (2026-11-20; números e recomendação em `relatorio-fase-0.md`). Nasce do fecho da spec 017: o quadro do impacto de uma explosão grande ficou em ~65 ms
> contra a meta de 33,3 ms, e as duas formas de dividir o trabalho no tempo foram medidas e não bastam (`specs/017-quadro-da-explosao/
> design-onda.md` §1 e §9). Esta spec **não promete 33,3 ms**: a Fase 0 é um experimento que mede se o caminho existe.

## 1. Problema

Modo de prazo, 1x, casa da sala (552 peças no mundo; 521 visitadas pelo `blastPart`), explosão e cratera (régua `tools/gpu/room-explosion.mjs`).
Números corrigidos pela Fase 0 (`relatorio-fase-0.md` §2.1 e §6); a primeira versão desta tabela dizia 24–26 ms para o `explode`, ~14 para os
eventos e 521 peças:

| Parte do quadro do impacto | ms |
|---|---|
| `world.explode` (laço `blastPart` por peça, `wearJoints`, `knockOutUnits`, `solveStructure`) | 20–22 (T0.1, T0.3) |
| eventos estruturais aplicados no tique (`applyStructuralEvents`: `rebuildHost`, `splitLoose`, `adoptSplit`) | ~16–17 (17–18 com a sonda, T0.4) |
| `action` (efeito, `renderer.explode`) | ~7 (017; não remedido na 018) |
| desenho (`renderCpu`) | ~8,4 (017; não remedido na 018) |
| resto (matrizes, módulos, saída das etapas) | ~10–11 (por diferença) |
| **total** | **63–65** (T0.1) |

O que já se sabe que não resolve: baratear o `explode` sem mudar o resultado (feito, 017 etapa B); adiar apresentação (feito, 017 etapa A);
dividir a explosão em tiques (017 D5: ~15 ms só com regra não física, 3–6 ms com a regra física; piso de ~40 ms porque a parede encostada
na carga custa 8–13 ms sozinha e não se divide).

## 2. O que o código permite hoje (levantamento de 2026-11-20)

- **Regra 14** (`specs/regras/14-workers.md`): trabalho pesado só pelo coordenador (`game-workers`), como categoria com kernel puro (lê só
  a entrada; a semente vai na entrada), faixa, prioridade e prazo. Na faixa `sim` o resultado entra num quadro fixo (`collect` em N +
  latência); se o worker não respondeu, o quadro principal calcula e descarta a resposta atrasada; mesmos bytes com 0, 1 ou 8 workers
  (`checkTaskKind` no CI).
- **O mundo de destruição é um fecho só, com estado mutável** (`packages/game-destruction/src/world.ts`). `blastPart` (`4599-4687`) lê e
  escreve `objects`, `p.st`, `p.rt`, juntas, `cur`/`emit` (que chama ouvintes na hora), `frontQueue`, `pendingStructure`, o gerador
  `rng` (um fluxo só, `650`) e os buffers do solver. `ObjRT` tem `Map`/`Set`; `PartRT.castIn` aponta para outras peças; `SupportGraph`
  recebe callbacks.
- **Só a matemática por peça já é pura**: `waveWork`, `projectedArea`, `failureWork`, `unitGrid`/`cellsWithin`/`unsupportedCells`
  (`breach.ts`), `planFragments`, `buildPartGrid`, `flexure.ts`, `solveSupports`/`distributeLoads` (puro, mas com o grafo por callback). A
  orquestração (`blastPart`, `wearJoints`, `knockOutUnits`, `applyDamage`, a montagem do grafo no `solveStructure`, os `emit`) não.
- **Forma serializável do mundo:** `serialize()`/`DestructionSnapshot` (`world.ts:6092`, `types.ts:816`), que deixa de fora `blasts`,
  `frontQueue`, `primed`, `orderCounter`, pendências de estrutura, ouvintes e caches.
- **Do lado do desenho:** em `rebuildHost` a conta de colapso sobre `Float32Array` é pura; `adoptSplit` é quase todo three.js;
  `splitLoose` chama `world.splitGroups`, que muda o mundo e tira ids de um contador.
- **Categorias `sim` que existem:** só `destruction.ground-tiles` usa o caminho inteiro (kernel `computeGroundTile`, quadro fixo próprio,
  teste de equivalência). `PIECE_BOXES` tem id e não tem implementação (spec 009 T8 aberta); o `fitBoxes` saiu do quadro do impacto por
  cache e pré-cálculo no quadro principal.
- Não medido em lugar nenhum: quanto dos 24–26 ms do `explode` é `raycastInternal`/`seesFireball`, quanto é junta e estrutura.

## 3. Caminhos possíveis

| | Caminho | O que move | Risco principal |
|---|---|---|---|
| A | **Kernels por peça**: o quadro principal monta a entrada plana de cada peça (ou lote), o worker devolve o "plano de dano" (trincas, unidades arrancadas, fragmentos), o quadro principal aplica em N + latência | a matemática; a aplicação e os eventos ficam | o custo de montar a entrada e aplicar o plano pode ser quase o do laço inteiro; a explosão passa a "acontecer" 1–2 quadros depois do clarão |
| B | **Mundo residente no worker** (`ResidentKind`): o mundo de destruição mora num worker; o quadro principal manda comandos e recebe eventos | tudo do `explode` | todo leitor síncrono do mundo (raio, colisão, `standing`, módulos da sala) passa a ler um espelho; é reescrever a fronteira do pacote |
| C | **Só o desenho** (`rebuildHost`, extração de geometria do `adoptSplit`) para kernel na faixa `build` | parte dos ~14 ms de eventos | ganho limitado a poucos ms; não toca o `explode` |

Qualquer um dos três muda quando o resultado entra, então herda da 017: resultado em quadro fixo, mesmos bytes a 30/60/120/144 Hz, e as
exigências do `design-onda.md` §2.2 a §2.6 e §3 para trabalho que atravessa tiques (quem pertence à explosão, salvar no meio, empurrão dos
pedaços que nascem depois, invariantes estruturais por tique).

## 4. Decisões abertas

| # | Decisão | Depende de |
|---|---|---|
| D1 | [NEEDS CLARIFICATION] A, B ou C, ou desistir da meta de 33,3 ms para explosão grande em casa inteira | Fase 0 |
| D2 | [NEEDS CLARIFICATION] Quantos quadros de latência entre o clarão e o dano são aceitáveis para o jogo (a 017 fixou clarão, som e empurrão no primeiro tique; o dano no mundo 1–2 quadros depois muda a sensação) | o dono, vendo na sala |
| D3 | [NEEDS CLARIFICATION] A meta vale para o pior caso (casa inteira, 521 peças) ou para um caso típico a definir | o dono |

## 5. Critérios de aceite (provisórios, fecham com D1–D3)

- C1. Quadro do impacto ≤ 33,3 ms na régua da 017 (modo de prazo, 1x, explosão e cratera), ou o número que a D3 fixar.
- C2. Mesmos bytes com 0, 1 e 8 workers e a 30/60/120/144 Hz (`checkTaskKind`, `step-equivalence-window`).
- C3. Nenhum quadro da janela acima de 33,3 ms; soma da janela ≤ 110% da de hoje.
- C4. Portão completo contra a `main` sem regressão, com a máquina quieta.
- C5. Nenhum golden ou fixture existente regravado sem decisão do dono.
