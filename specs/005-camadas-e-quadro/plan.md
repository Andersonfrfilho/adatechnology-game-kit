# Plano — Spec 005 (decisões de arquitetura)

Decisões tomadas em 2026-10-31, junto com a spec. Cada uma diz o que o kit adota e de qual engine vem o modelo.

## D1 — Camadas

| Camada | Pacotes | Pode depender de |
|---|---|---|
| L0 Contratos | `game-contracts` | nada |
| L1 Base | `game-shapes`, `game-runtime` (novo) | L0 |
| L2 Núcleos | destruction, vfx, fluids, weapons, items, characters, crowd, floorplan, floorplan-structure, vehicles, vehicles-driving, weather, player, audio, terrain, interactables, animals, vegetation, urban, infection, stories, camera, devtools | L0, L1, outro núcleo (composição) |
| L3 Conteúdo | `*-fleet`, `*-species`, `*-goods`, `*-household`, `*-residential`, `*-commercial`, `*-rural`, `*-post-apocalyptic`, `*-people`, `*-uniformed`, `*-undead`, `game-props3d` | o próprio núcleo, L0 |
| L4 Adaptadores | `*-three`, `game-render-three` (novo) | o próprio núcleo, L0, L1, `game-shapes-three`, `game-render-three` |
| L4b Pontes | `game-floorplan-interactables` e futuras | nada (tudo injetado) |
| L5 Composição | `game-kit-defaults` (novo), `game-test-room`, `examples/*`, o jogo | tudo |

- O `game-props3d` é conteúdo (descreve props), por isso entra em L3.
- A regra mora em `.dependency-cruiser.cjs`. As classes saem do nome do pacote, e as exceções (composição entre adaptadores, como
  `crowd-three` → `characters-three`) ficam numa allowlist com o motivo.
- **Modelo:** as assembly definitions do Unity, os módulos `Runtime`/`Editor` do Unreal e as camadas do Bevy.

## D2 — Compatibilidade: depreciar, nunca quebrar no meio

Toda API pública trocada continua exportada com `/** @deprecated use X */` e delega para a nova. A remoção só acontece numa major
com changeset que explica a migração. O ZombiAdA migra no seu próprio ritmo.

## D3 — `game-runtime`: um dono do quadro (L1, sem three)

- **Fases fixas, nesta ordem:** `input` → `fixedSimulate` (passo fixo de 1/60 s, com acumulador e no máximo 4 subpassos por quadro)
  → `lateSimulate` → `present` (os adaptadores sincronizam a cena) → `render` → `idle`.
- **Contrato de quem participa:** `scheduler.add(system, { phase, order })` e `ModuleHost.onFrame(fn, { phase?, order? })`. Sem fase,
  vale `lateSimulate`, que é o comportamento de hoje.
- **Orçamento de tempo por quadro:** `scheduler.budget` reparte um teto por quadro (padrão 4 ms) entre as filas adiadas que hoje
  vivem soltas (vozes do áudio com 2 ms, eventos da destruição com 8 ms, `crease` do veículo com 2,5 ms). Elas rodam em `idle`,
  pela ordem de prioridade, e quem passa do teto continua no quadro seguinte.
- **Modelo:** as agendas do Bevy (`PreUpdate`/`FixedUpdate`/`Update`/`PostUpdate`), o `useFrame` com prioridade do R3F e os tick
  groups do Unreal.

## D4 — `game-render-three`: dono das luzes, dos programas e dos pools (L4)

- **`createLightBudget(THREE, scene, { point: N, spot: M })`** cria todas as luzes no boot, sempre na cena, com intensidade 0.
  - Quem quer luz chama `acquire({ priority, color, distance })`, recebe um handle ou `null`, e devolve com `release()`.
  - Prioridade maior toma a vaga da menor: a explosão vence a lâmpada distante.
  - Lint: `new THREE.PointLight`/`SpotLight` fora deste pacote é erro.
- **`createProgramWarmup()`:** cada adaptador registra as sondas dos materiais que cria sob demanda (`register(probe)`), e o host
  chama `warmUp(renderer, scene, camera)` uma vez no carregamento. Isto substitui o `warmUpProbes` espalhado e o `pinPrograms`.
- **`createGeometryPool`/`createMaterialPool`:** chave por parâmetros, reaproveitamento e contagem de uso.
  - Partículas, marcas e destroços pedem daqui.
  - O pool de materiais nunca descarta uma variante ainda registrada, e com isso a recompilação por descarte acaba.
- **`ThreeLib`:** o único tipo do namespace three (`typeof import('three')`). Os pacotes usam `Pick<ThreeLib, ...>`, e `type Three = any` sai.
- **Modelo:** o light budget dos engines de deferred/forward+ e o pré-aquecimento de PSO do Unreal.

## D5 — Catálogo por instância

- Todo catálogo é `createX({ packs, patch, remove })`, com o `mergeById`, `applyPatches` e `removeIds` do `game-contracts`.
- O registro global de hoje vira um `defaultX()` preguiçoso e fica `@deprecated` (D2).
- Pacotes afetados: `game-floorplan` (CATALOG, TEMPLATES, singleton `engine`), `game-destruction` (ASSEMBLIES), `game-items-three`
  (modelos), `game-shapes` e `game-weapons-three` (props).

## D6 — `./testing`

Áreas de teste, bancadas e cenários saem do `.` e entram no subpath `./testing` de cada pacote. As dependências que só eles usam
viram `devDependencies` ou `peerDependencies` opcionais.

## D7 — O conteúdo entra por opção; o padrão é ligado por um preset

- Núcleos e adaptadores recebem conteúdo por opção (frota, espécies, móveis, clipes, paletas).
- O padrão "kit completo" mora no novo **`game-kit-defaults`** (L5), equivalente aos `DefaultPlugins` do Bevy: ele importa os
  pacotes de conteúdo e devolve as opções prontas (`defaultUrbanProviders()`, `defaultVehiclePalettes()`…).
- O jogo que quer o padrão usa o preset. O jogo que quer outra frota não leva a frota padrão.

## D8 — Contrato de custo

`DestructibleImpl.part(id)` e `state()` são O(1), sem alocação, e cacheados entre mudanças. O `checkDestructible` mede 10.000
leituras e falha acima do teto, que é configurável.

## D9 — Versões e publicação

- **three:** peer `^0.160.0` em todos os pacotes, nunca em `dependencies`.
- **Deps internas:** `workspace:^`.
- **changesets:** `onlyUpdatePeerDependentsWhenOutOfRange: true`.
- **IIFE:** os pacotes `@adatechnology/*` ficam externos e são lidos de `globalThis.<Global>`, o que acaba com a cópia do estado.
- **Cobrança:** `publint` e `@arethetypeswrong/cli` no CI.

## D10 — Reação em cadeia sem motor de física na horda

A regra de base é que a cadeia nasce de regras locais e nunca de um cálculo global:

- **Corpos:**
  - cápsulas 2D com impulso, contato pela grade espacial e estados de equilíbrio (em pé, cambaleando, caído, levantando);
  - a pressão acumulada derruba alguns, e os caídos viram degrau: os de trás sobem por cima (monte em qualquer lugar, não só no muro);
  - a onda anda um salto por passo fixo.
- **Explosões:** cada elo da cadeia (`chain`, `leak`) tem atraso físico e passa pelo orçamento por quadro.
- **Física rígida de verdade:** se um dia vier (Rapier/WASM), entra só no pool limitado de corpos arremessados perto do jogador.
- **Modelo:** as multidões densas de World War Z e Days Gone (agentes cinemáticos com física de posição e pool de ragdolls perto da
  câmera) e a propagação de fogo e explosões em cadeia da série Far Cry (elos com atraso).

O desenho detalhado (limiares, atrito, teto de quedas, tamanho do pool) é a T4b.1.

## Ordem e dependências

- A **Fase 1** (cercas em modo aviso, versões, deps) começa já, a partir de `main`.
- As **Fases 4 e 6** mexem em `room.ts`, `game-vehicles` e `game-destruction-three`, os mesmos arquivos da branch
  `perf/explosion-frame-budget`. Elas só começam depois do merge dessa branch.
