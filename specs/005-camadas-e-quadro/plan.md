# Plano — Spec 005 (decisões de arquitetura)

Decisões tomadas em 2026-10-31, junto com a spec. Cada uma diz o que o kit adota e de qual engine vem o modelo.

## D1 — Camadas

| Camada | Pacotes | Pode depender de |
|---|---|---|
| L0 Contratos | `game-contracts` | nada |
| L1 Base | `game-shapes`, `game-runtime` (novo) | L0 |
| L2 Núcleos | destruction, vfx, fluids, weapons, items, characters, crowd, floorplan, floorplan-structure, vehicles, vehicles-driving, weather, player, audio, terrain, interactables, animals, vegetation, urban, infection, stories, camera, devtools | L0, L1, outro núcleo (composição) |
| L3 Conteúdo | `*-fleet`, `*-species`, `*-goods`, `*-household`, `*-residential`, `*-commercial`, `*-rural`, `*-post-apocalyptic`, `*-people`, `*-uniformed`, `*-undead` | o próprio núcleo, L0 |
| L4 Adaptadores | `*-three`, `game-render-three` (novo) | o próprio núcleo, L0, L1, `game-shapes-three`, `game-render-three` |
| L4b Pontes | `game-floorplan-interactables` e futuras | nada (tudo injetado) |
| L5 Composição | `game-kit-defaults` (novo), `game-test-room`, `examples/*`, o jogo | tudo |

- O `game-props3d` é um **construtor compartilhado**, não conteúdo: exporta o vocabulário `PropsApi`, o gravador de formas e a pele de nós, usados por conteúdo, núcleos e adaptadores. Ele não importa conteúdo nem adaptador (regra `shared-builder-not-content-or-adapter`). Reclassificado na Fase 3.
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
  vivem soltas (vozes do áudio com 2 ms, eventos da destruição com 8 ms, pintura do reboco com 4 ms, `crease` do veículo com 2,5 ms
  por veículo). O que tem que aparecer no quadro do evento roda em `present`, antes do render: eventos da destruição e pintura do
  reboco. O que pode esperar roda em `idle`, depois do render: vozes do áudio (com reserva de 1 ms por quadro, para não morrer de
  fome numa tempestade) e `crease` (uma fila só para todos os veículos). Dentro da fase, pela ordem de prioridade; quem passa do teto
  continua no quadro seguinte. As filas são só apresentação: simulação nunca espera numa fila (desenho em
  [`design-runtime.md`](design-runtime.md) §3.4 e §4).
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
  - o contato só resolve sobreposição e choque; a **pressão é um campo à parte**, que anda um salto por passo fixo (cada um soma a
    própria força de empurrar e a parte de quem está atrás, lida do passo anterior, sem depender da ordem dos agentes);
  - a pressão acima do crítico derruba alguns, e os caídos viram degrau: os de trás sobem por cima (monte em qualquer lugar, não só
    no muro);
  - a onda anda um salto por passo fixo, e tudo roda no `fixedSimulate`: o mesmo resultado a qualquer taxa de quadros.
- **Explosão na horda:** entra numa fila e é resolvida no passo fixo seguinte, numa passada linear sobre os agentes (todas as
  explosões do passo juntas), com a mesma regra de empurrão (`blastShove`) dos itens e móveis.
- **Corpos arremessados:** pool limitado (padrão 32), simulado no `game-crowd` (o pouso faz parte da cadeia e precisa ser
  determinístico); o adaptador three só desenha.
  - **Escolha visível ao dono: quem ganha as vagas.** Padrão `thrown.priority: 'fastest'` (do mais rápido ao mais lento): numa horda
    densa, as 32 vagas vão para os corpos mortos e desmembrados a menos de ~2 m da explosão, e os **vivos** a 5–5,8 m nunca voam (caem
    no lugar). Ganha-se a cadeia mais longa: só os voos rápidos pousam além do cambaleio direto (~9,9 m da m67) e derrubam quem está
    lá. Alternativa: `'living'` (vivos primeiro, depois mortos, cada grupo do mais rápido): vê-se zumbi vivo voando, mas a cadeia por
    pouso encurta (esses voos pousam antes de 8,2 m, dentro da queda direta). É opção, reversível sem mudar código
    (`design-chain-horde.md` §7.2 e §7.3); o dono decide se o padrão fica.
- **Explosões em cadeia:** cada elo (`chain`, `leak`) tem atraso físico contado em passos fixos, com teto determinístico de elos
  por passo no `game-destruction`. Só a apresentação (efeito, luz, decalque, som) passa pelo orçamento por quadro, que é medido em
  ms e por isso nunca decide nada da simulação.
- **Física rígida de verdade:** se um dia vier (Rapier/WASM), entra só no pool limitado de corpos arremessados perto do jogador.
- **Modelo:** as multidões densas de World War Z e Days Gone (agentes cinemáticos com física de posição e pool de ragdolls perto da
  câmera) e a propagação de fogo e explosões em cadeia da série Far Cry (elos com atraso).

O desenho detalhado (limiares, atrito, teto de quedas, tamanho do pool) é a T4b.1, em `design-chain-horde.md`.

## D11 — Economizar no custo, nunca na variedade

O diferencial do jogo é não ser repetitivo: zumbis aleatórios. As técnicas de horda (instanciar, simplificar de longe, gravar
animação em textura) costumam gerar clones andando no mesmo passo, e aqui isso é proibido.

- **Identidade por semente:** cada agente tem uma identidade gerada pela sua semente: tipo, variante, idade da infecção, roupa,
  paleta, proporções, ferimentos, membros faltando, acessórios, jeito de andar e personalidade. A identidade é a mesma em todos os
  níveis de detalhe: o zumbi sem o braço esquerdo continua sem o braço esquerdo de longe.
- **Variedade sem chamada de desenho a mais:** os atributos são por instância no lote assado.
  - tom de pele e paleta da roupa;
  - escala de altura e de largura;
  - máscara de ferimentos, sangue e membros faltando;
  - deslocamento de fase e velocidade da animação;
  - acessórios (cabelo, boné, capacete, mochila) como instâncias à parte, um lote por tipo de acessório, com o pivô da variante
    num atributo próprio (sem um lote por silhueta).
  - As variantes assadas por tipo continuam (o porte dos times); os atributos multiplicam a variedade em cima delas.
- **Animação sem passo sincronizado:**
  - cada agente tem fase, velocidade e mistura de dois clipes próprias;
  - o jeito de andar (mancar, arrastar a perna, cambalear) vem da identidade e dos ferimentos;
  - nas poses gravadas em textura (VAT) a fase e a velocidade também são por instância.
- **Longe também varia:** os impostores são assados por tipo de corpo e silhueta, com tinta por instância e quadro de animação
  defasado.
- **Comportamento também varia:** a personalidade por semente define:
  - multiplicador de velocidade e tempo de reação;
  - limiar de equilíbrio e chance de tropeço;
  - agressividade (intervalo e chance de ataque, disputa da vaga de ataque) e o que faz parado.
  - Por isso a reação em cadeia nunca é uniforme: uns caem, outros seguram, outros sobem no monte.
- **Som:** variante e tom de voz por identidade (o `game-audio` já sorteia por semente).
- **Modelo:** a variação por instância de Days Gone e de World War Z (atributos por instância, animação defasada e várias variantes
  de malha por tipo).

## D12 — Máquinas-alvo e escada de economia

| Máquina | Placa | Horda na tela | Orçamento |
|---|---|---|---|
| Mínima | integrada Intel (Arc/ARL deste notebook) | 1.000 zumbis | 0 quadros acima de 33,4 ms |
| Recomendada | RTX 5070 Laptop | 2.000 zumbis | 0 quadros acima de 33,4 ms e p99 ≤ 20 ms |

Se a medição não couber, sobe-se a escada, do mais barato ao mais caro:

1. sombra real só perto e mancha simples no resto;
2. LOD em três níveis mais impostor de longe;
3. poses gravadas em textura (VAT);
4. horda num Web Worker;
5. solver de contato em WASM;
6. three.js com WebGPU, com simulação em *compute shader* (spec à parte).

Os degraus 1 a 3 entram já na Fase 4b, porque enxertá-los depois é caro. Os degraus 4 a 6 só sobem quando o teste mandar. Todo
degrau respeita a D11.

## D13 — Decisões do dono (2026-10-31)

1. **A luz da explosão ilumina o interior do cômodo onde ela acontece.**
   - A máscara de luz por cômodo do `game-floorplan-three` deixa passar as vagas do `LightBudget` que vêm de efeitos (explosão, fogo, foguete) quando o ponto delas está dentro do cômodo, ou atravessa uma abertura.
   - A opção `effectLightsIndoors` fica ligada por padrão.
   - Os goldens que dependem do comportamento antigo rodam com a opção desligada.
   - O print de antes e depois vai na evidência.
2. **A pressão da horda pode derrubar e esmagar o jogador, configurável.**
   - A horda entrega a pressão no jogador ao `game-player` (`knock`, dano de esmagamento).
   - As opções são `crowd.physics.playerPressure: { enabled, knockThreshold, crushDamagePerSecond }`. A sala liga; o padrão do pacote é desligado (D2).
   - Os limiares vêm da ficha do jogador (força, vigor).
3. **O pool de corpos arremessados é misto, configurável.**
   - `thrown.priority: 'mixed'` é o padrão: metade das vagas para os mais rápidos (alimentam a reação em cadeia) e metade para os mais perto do jogador (o que ele vê).
   - Também valem `'fastest'` e `'nearest'`, e `thrown.mixedRatio` (padrão 0,5) muda a divisão.

## Ordem e dependências

- A **Fase 1** (cercas em modo aviso, versões, deps) começa já, a partir de `main`.
- As **Fases 4 e 6** mexem em `room.ts`, `game-vehicles` e `game-destruction-three`, os mesmos arquivos da branch
  `perf/explosion-frame-budget`. Elas só começam depois do merge dessa branch.
