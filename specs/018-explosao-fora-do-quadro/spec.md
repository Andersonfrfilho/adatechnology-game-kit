# Spec 018 — a explosão fora do quadro principal

> Estado: **Fase 0 concluída; D1 e D3 decididas em 2026-11-21, D2 aberta** (números da Fase 0 e recomendação em `relatorio-fase-0.md`; a medição que mudou o caso de referência está na seção "Depois da Fase 0" do mesmo arquivo). Nasce do fecho da spec 017: o quadro do impacto de uma explosão grande ficou em ~65 ms
> contra a meta de 33,3 ms, e as duas formas de dividir o trabalho no tempo foram medidas e não bastam (`specs/017-quadro-da-explosao/
> design-onda.md` §1 e §9). Esta spec **não promete 33,3 ms**: a Fase 0 é um experimento que mede se o caminho existe.

## 1. Problema

> **Correção de 2026-11-21:** a tabela abaixo é a do C4 contra a casa inteira, que esta spec tratou como o pior caso. A medição de 2026-11-21 mostrou
> que não é: a M67 e a bomba de cano custam mais que o C4 no quadro da explosão (cerca de 2 vezes e cerca de 3 vezes) (ver §4.1). O texto original fica como foi escrito.

Modo de prazo, 1x, casa da sala (552 peças no mundo; 521 visitadas pelo `blastPart`), explosão e cratera (régua `tools/gpu/room-explosion.mjs`).
Números corrigidos pela Fase 0 (`relatorio-fase-0.md` §2.1 e §6); a primeira versão desta tabela dizia 24–26 ms para o `explode`, ~14 para os
eventos e 521 peças:

| Parte do quadro do impacto | ms |
|---|---|
| `world.explode` (laço `blastPart` por peça, `wearJoints`, `knockOutUnits`, `solveStructure`) | 20–22 (T0.1, T0.3) |
| eventos estruturais aplicados no tique (`applyStructuralEvents`: `rebuildHost`, `splitLoose`, `adoptSplit`) | 17–18 medido com a sonda (T0.4); ~16–17 descontando o custo estimado dela, que é conta e não medição |
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

## 4. Decisões

| # | Decisão | Estado |
|---|---|---|
| D1 | A, B ou C, ou desistir da meta de 33,3 ms | **Decidida em 2026-11-21:** não abrir caminho de worker (A, B ou C) agora. Primeiro se ataca, na thread principal, o custo dos explosivos de fragmentação. O dono pediu antes uma **proposta de cortes na simulação de fragmentos** (quanto cada corte rende e quais goldens mudam), antes de qualquer mudança de código de simulação. A proposta está pendente (T1.1 em `tasks.md`). Ver §4.1 |
| D2 | [NEEDS CLARIFICATION] Quantos quadros de latência entre o clarão e o dano são aceitáveis (a 017 fixou clarão, som e empurrão no primeiro tique; o dano no mundo 1–2 quadros depois muda a sensação). **Pesa mais agora:** espalhar os impactos dos fragmentos por 2 ou 3 tiques é um dos cortes candidatos da T1.1 e é exatamente latência entre clarão e dano | o dono, vendo na sala; exigida só para cortes que atrasam o dano (§4.1) |
| D3 | A meta vale para o pior caso ou para um caso típico | **Decidida em 2026-11-21:** o caso de referência da meta passa a ser a **granada M67** (o explosivo de fragmentação comum), não o C4 contra a casa inteira. Ver §4.1 |

### 4.1 O que a medição de 2026-11-21 mudou

Esta spec partiu da premissa de que o C4 contra a casa inteira era o pior caso (63–65 ms na Fase 0). A premissa era errada. Medido em 2026-11-21 na
régua `room-explosion` (modo de prazo, 1x, casa da sala, NVIDIA), na `main` depois do #417, quadro da explosão (`f0Ms`):

| Explosivo | `f0Ms` (ms) |
|---|---|
| molotov | 22–26 |
| C4 | 63–67 |
| M67 | 117–138 entre sessões (120,5 e 120,6 na última) |
| bomba de cano | 177–227 entre sessões (186,2 e 186,3 na última) |

Os explosivos de fragmentação custam cerca de 2 vezes (M67) e cerca de 3 vezes (bomba de cano) o C4. Os maiores módulos do pior quadro são `explode` (simulação dos fragmentos) e `destrEvents`.
A tabela completa e as condições estão em `relatorio-fase-0.md`, seção "Depois da Fase 0", e nas descrições dos PRs #417 e #419.

- **D3:** a meta passa a ser medida na M67. Fato da ferramenta: o explosivo padrão da régua da rodada diária é o C4 e a base gravada em 2026-11-21 é a do C4. Isso não é decisão; o caso que define a meta é a M67.
- **D1:** o próximo passo é cortar o custo da simulação de fragmentos na thread principal. O dono decidiu apenas que nenhum caminho de worker é aberto agora; se um worker volta à mesa depois é pergunta aberta para ele.
  Nenhum corte entra sem a proposta aprovada pelo dono (T1.1).
- **Regra da D2:** a D2 é exigida só para corte que atrasa o dano em relação ao clarão (por exemplo, espalhar impactos de fragmentos por tiques). Corte que mantém o dano no tique da explosão não espera a D2.

## 5. Critérios de aceite (provisórios, fecham com a D2, para os cortes que atrasam o dano)

- C1. Quadro do impacto da **granada M67** ≤ 33,3 ms na régua `room-explosion` (modo de prazo, 1x, casa da sala), conforme a D3 de 2026-11-21.
  **Este número ainda não é alcançável com a evidência que existe:** o valor medido hoje é ~120 ms (120,5 e 120,6 na última sessão), contra 33,3 ms.
  Está longe, e nenhum corte medido até agora aproxima a M67 da meta. O critério fica escrito como alvo, não como previsão.
- C2. Mesmos bytes a 30/60/120/144 Hz (`step-equivalence-window`); com 0, 1 e 8 workers (`checkTaskKind`) só se algum caminho de worker for aberto (D1 de 2026-11-21 não abre nenhum agora).
- C3. Nenhum quadro da janela acima de 33,3 ms (mesmo caso de referência do C1, a M67); soma da janela ≤ 110% da de hoje.
- C4. Portão completo contra a `main` sem regressão, com a máquina quieta.
- C5. Nenhum golden ou fixture existente regravado sem decisão do dono.
