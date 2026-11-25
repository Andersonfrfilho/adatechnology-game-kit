# Animações e modelos 3D: levantamento e melhorias (personagens, itens e veículos)

Levantado em 2026-11-19, por leitura do código na `main` (commit `ca2dac732` + 1). Cobre **personagens**, **itens** (com arma na mão) e
**veículos** (seção 7). Animais, móveis e vegetação ficam para as próximas partes.

**Como ler:** cada achado diz se é **fato** (lido no código, com arquivo e linha), **medido** (script sobre o `dist`) ou **inferência**
(conta ou dedução, ainda não vista na tela). Nada aqui foi validado no navegador: a conferência por câmera da regra §5 é a Fase 0 do plano.

Abreviações: `GC` = `packages/game-characters`, `GC3` = `packages/game-characters-three`, `GW3` = `packages/game-weapons-three`,
`GI3` = `packages/game-items-three`, `sala` = `packages/game-test-room/src/room.ts`.

## 1. Resumo

O kit tem uma base de animação inteira feita de **peças rígidas e senos**: sem skinning, sem máquina de estados, sem IK de pés, sem
ragdoll ligado ao corpo. O andar está bem resolvido (a passada casa com o chão e tem teste). O resto das transições é uma suavização
exponencial por junta. As armas da Galeria são a parte mais completa (clipes de tiro, recarga, mão por IK). Os itens comuns quase não
têm animação: aparecem na mão pelo centro da caixa e somem ao guardar.

Os cinco problemas que mais aparecem na tela, em ordem:

1. **Escala**: o personagem rico mede 1,98 m (2,06 m com cabelo), não o 1,80 m declarado; a porta tem 2,10 m.
2. **Corpo a corpo sem golpe**: cerca de 25 armas brancas tocam som sem nenhum movimento.
3. **Morte e queda como "tábua girando"**: o ragdoll existe no motor Jolt e ninguém o usa.
4. **Juntas**: ombro em bola saliente, quadril sem esfera, sem tornozelo, mão sem dedos no zumbi.
5. **Primeira e terceira pessoa por caminhos diferentes**: dois rigs de braço, constantes separadas, quase nenhum print de terceira pessoa com arma.

## 2. Como funciona hoje

### 2.1 Personagens

| Tema | Hoje | Onde |
|---|---|---|
| Rig | Árvore de `Group` com malha rígida por osso (cilindro afinado + esfera na junta). 17 juntas no núcleo, 12 ossos no corpo instanciado. Sem `SkinnedMesh`. | `GC3/src/rich/best-builder.ts:164-283`, `GC/src/body/rig.ts:7-40` |
| Canais | 17 escalares (tronco, cabeça, braços, cotovelos, pernas, joelhos). Perna e cotovelo giram só em X. | `GC3/src/rich/animator.ts:35-37` |
| Locomoção | Senos (`animateProfile`): andar, arrastar, rastejar, saltar, comer, escutar, parado. Cadência e passada saem da velocidade. | `GC/src/gait/animate.ts:35-83`, `GC/src/gait/stride.ts:6-10` |
| Poses do jogador | Constantes (`CROUCH`, `AIMED`, `SIT`, `LIE`, `DOWN`) escolhidas por cadeia de `if/else`. | `GC3/src/player/avatar.ts:45-49, 626-651` |
| Clipes | Pose-chave com smoothstep: 2 no núcleo, 11 de ataque (socos, empurrão, chute, pá), 6 de primeira pessoa. 3 a 6 chaves cada. | `GC/src/pose-clips/pose-clip.ts:30-41`, `game-characters-people/src/data/attack-clips.json` |
| Mistura | Suavização exponencial por junta ("cascata"); um clipe por vez com peso de 0,12 s; máscara fixa `full/upper/lower/body`. Sem aditivo. | `GC/src/gait/cascade.ts:5-6`, `avatar.ts:28, 586-599` |
| IK | Só braços (dois ossos + giro do peito + escápula). Sem IK de pés. | `GC3/src/player/arm-reach.ts:11-49` |
| Mira | Só o ombro segue o pitch. | `avatar.ts:347-358` |
| Multidão | Animação no vertex shader, 9 poses por índice inteiro; LOD aos 18 m e 55 m; impostor de 8 ângulos × 8 quadros. | `GC3/src/instanced/body-chunk.ts:16-74`, `lod.ts:2-10`, `impostor-atlas.ts:6-7` |
| Reações | A multidão tem equilíbrio (de pé, cambaleando, caído, levantando). O corpo rico derrubado é uma rotação rígida do quadril. | `game-crowd/src/physics/balance.ts:57-174`, `GC3/src/test-area/module.ts:273` |

Custo medido (pose neutra, LOD 1): zumbi "Lento" 8.570 triângulos em 44 malhas; sobrevivente 19.982 triângulos em 111 malhas;
corpo instanciado simples 2.016 triângulos em 1 malha.

### 2.2 Itens e armas

| Tema | Hoje | Onde |
|---|---|---|
| Catálogo | 330 itens: 248 com modelo do time, 82 na forma simples de reserva (`standIn`). | `GI3/src/build-item.ts:76-94`, `shapes.ts:6-9` |
| Custo (medido) | Com modelo: mediana 180 triângulos e 4 chamadas; forma simples: 36 triângulos e 2 chamadas. | — |
| Materiais | Só cor chapada (`MeshStandardMaterial`); nenhuma textura nem rótulo. | `GI3/src`, `GW3/src` |
| Item na mão | Segue a mão direita pelo centro da caixa, com deslocamento fixo `(-0.02, 0.015, -0.04)`. `ItemDef` não tem ponto de pega. | `sala:3344-3352, 3428` |
| Uso | Só recipiente de fluido (9 usos: gole, beber, virar, comer, despejar, abrir, fechar, desrosquear). | `sala:3521-3522`, `game-fluids/src/data/item-uses.json` |
| Armas | 189 no arsenal; 137 com modelo da Galeria e clipes (recuo, ciclo, pane, recarga, carregador sai e entra); mão no ferrolho e no carregador por IK. | `GW3/src/animation/magazine-clips.ts:11-24`, `fx/hand-work.ts:97`, `fx/hand-hold.ts:134-196` |
| Câmeras | Terceira pessoa: arma no bolso do ombro (`BODY_HOLD`). Primeira: quadro e lente próprios (`VIEW_HOLD`). | `GW3/src/fx/body-hold.ts:65-98`, `fx/view-hold.ts:28-35` |

## 3. Melhorias, por prioridade

Esforço: **P** até 1 dia, **M** alguns dias, **G** semana ou mais. "Dono" é o pacote onde a correção mora (regra §1).

### 3.1 Prioridade alta (aparece em toda cena)

| # | Problema | Evidência | Tipo | Esforço | Dono |
|---|---|---|---|---|---|
| A1 | **Altura errada.** A cabeça fica em y = 1,80 com raio 0,165 × 1,1: topo em 1,98 m. O Brutamonte mede 2,93 × 1,53 m e não passa na porta de 2,10 m. | `best-builder.ts:225`, `GC/src/data/body.json:3`, `game-floorplan-structure/src/structure/openings.ts:8` | fato + medido | M | `GC` + `GC3` |
| A2 | **Corpo a corpo sem golpe.** Só soco, empurrão, chute e pá têm clipe. Machado, taco, facão, faca, katana e as demais tocam som sem movimento. | `game-test-room/src/avatar.ts:108`, `GW3/src/fx/tool-motion.ts:60-62`, `sala:2742-2757` | fato | G | `game-characters-people` (clipes) + `GW3` |
| A3 | **Sem ragdoll.** O contrato e o adaptador Jolt têm ragdoll; nenhum pacote de personagem, multidão ou sala o usa. Fase 5 da spec 008 aberta. | `game-physics/src/contract.ts:142-164`, `specs/008-motor-fisico-jolt/tasks.md:156-169` | fato | G | `GC3` + `game-physics-jolt` |
| A4 | **Corrida patina.** Amplitude fixa `0.65 × gait` e cadência × 1,3; a 5 m/s a passada desenhada dá cerca de 2,8 m contra 1,9 m percorridos. Ao ligar e desligar a corrida, a fase das pernas salta. | `avatar.ts:452-459, 616-620` | inferência (conta) | P | `GC` (`stride.ts`) + `GC3` |
| A5 | **Item sem pega.** Sem ponto de pega no dado, o item vai pelo centro da caixa; a mão só recebe alvo de IK ao desrosquear. Itens grandes devem atravessar a mão. | `sala:3428, 2075-2077` | fato (travessia é inferência) | M/G | `game-items` (dado) + `GI3` (âncora) |
| A6 | **Pegar, largar e guardar instantâneos.** Pegar arma apaga o objeto do mundo e constrói o modelo na mão; largar faz respawn a 0,7 m; arremesso é impulso sem braço. Há clipe de sacar (0,35 s), nenhum de guardar. | `sala:3211-3229, 3341-3380`, `GW3/src/animation/shot-clips.ts:101` | fato | M | `GC3` + `GW3` + sala |

### 3.2 Prioridade média (aparece em situações comuns)

| # | Problema | Evidência | Tipo | Esforço | Dono |
|---|---|---|---|---|---|
| M1 | **Mistura já portada e parada.** `humanPose`/`blendMoves` (mistura contínua de parado, andar, correr, agachar, mirar, virar) e `crawlPose`/`deadPose` só são chamados em teste. Usar antes de criar outra (regra §1). | `GC/src/gait/moves.ts:14, 59`, `lying.ts:15, 41` | fato | M | `GC3` |
| M2 | **Estados por `if/else`.** Sem grafo nem camadas: não combina recuo + recarga + andar; transição mole ou com estalo. | `avatar.ts:626-651, 586` | fato | M | `GC` (grafo puro) + `GC3` |
| M3 | **Juntas.** Ombro em esfera saliente (0,088 em x = 0,305); quadril do Bestiário sem esfera (cilindro de topo plano); cotovelo instanciado sem esfera. | `best-builder.ts:171-172, 270-272`, `instanced/body-geometry.ts:147-160` | fato (print `third-person.png`) | M (cápsulas) ou G (2 pesos na junta) | `GC3` |
| M4 | **Sem tornozelo nem IK de pés.** O sapato é esfera filha do joelho: pé flutua ou atravessa em rampa e degrau. | `best-builder.ts:177` | fato | M | `GC3` |
| M5 | **Mãos.** Dedos só no sobrevivente e no jogador (2 falanges, um ângulo); zumbi e multidão têm esfera achatada; sem pose de mão por item. | `accessories/hands.ts:10`, `avatar.ts:241-271`, `best-builder.ts:275` | fato | M | `GC3` |
| M6 | **Duas câmeras, dois caminhos.** Dois rigs de braço na primeira pessoa; a spec 004 T5.1 mandava remover `first-person/arms.ts` e não tem evidência. `VIEW_HOLD` e `BODY_HOLD` separados; mira só na primeira; só 1 print de terceira pessoa (de mãos vazias). | `specs/004-corpo-unico/tasks.md:62-63`, `examples/test-room/src/main.js:131-132`, `GW3/src/fx/viewmodel.ts:506` | fato | M | `GC3` + `GW3` + sala |
| M7 | **48 armas fora da Galeria.** Recuo e recarga são um empurrão exponencial, sem clipe nem mão. 8 ainda são caixa pura (`pistol_22`, `bow_compound`, `cutting_torch`, `pry_bar`, `utility_knife`, `m203`, `gp_25`, `ag36`). Arco e besta sem corda. | `GW3/src/box-fx.ts:372-397` | fato + medido | G | `GW3` |
| M8 | **Mira só no ombro.** Coluna e cabeça não acompanham; `AIMED` com cotovelo quase reto. | `avatar.ts:46, 347-358` | fato | M | `GC3` |
| M9 | **Sem direção.** O corpo recebe velocidade escalar: sem andar de ré, lateral, pulo ou transposição (`vault` existe como ação do jogador). | `avatar.ts:93-94`, `game-player/src/types.ts:78` | fato | M | `GC` + `GC3` |
| M10 | **Sem reação a tiro, morte ou levantar** no corpo rico. | `specs/001-migracao-entregas-dos-times/evidence.md:3154` | fato | M | `game-characters-people` + `GC3` |
| M11 | **Rosto em caixas** no Bestiário e no jogador; sem piscar nem expressão. O sobrevivente tem rosto melhor que o jogador não usa. | `best-builder.ts:229, 254-261`, `person-builder.ts:93-100` | fato | M | `GC3` |

### 3.3 Prioridade baixa (acabamento e desempenho)

| # | Problema | Evidência | Esforço | Dono |
|---|---|---|---|---|
| B1 | Multidão troca de pose por índice inteiro, sem mistura; impostor só anda; textura de 14 clipes desligada por padrão. | `body-chunk.ts:28-42`, `game-crowd-three/src/renderer.ts:26` | M | `GC3/src/instanced` |
| B2 | Troca de LOD sem transição (pop aos 18 m e 55 m, inferência); impostor com uma silhueta por tipo. | `renderer.ts:182` | M | `game-crowd-three` |
| B3 | Desmembramento na multidão sem coto (o membro colapsa no pivô); o corpo rico tem. | `body-chunk.ts:55-60`, `wounds/cut.ts:67` | M | `GC3/src/instanced` |
| B4 | Corpo rico caro: 44 a 111 chamadas por pessoa; o "LOD" do sobrevivente só tira dedos. Assado acima do orçamento declarado (9.018 contra 2.500). | `person-builder.ts:87-99`, `body.json:69` | M | `GC3` |
| B5 | Materiais sem leitura: armas quase pretas em primeira pessoa, itens sem rótulo, personagem sem dobra nem sombra de contato. | `examples/test-room/shots/fp-all-weapons-4.png` | M | `GI3` + `GW3` + `GC3` |
| B6 | 25 itens de mão dos personagens em caixas; o kit-audit só lista rádio e garrafa. | `GC3/src/rich/accessories/hand-items.ts:23-47` | M | `GC3` (injeção do `GI3`) |
| B7 | Pega heurística nas 31 armas que vêm de item (mão a um terço do comprimento). | `GW3/src/item-weapon-draw.ts:31` | P/M | `GW3` |
| B8 | Uso de item fora de fluidos (curativo, lanterna, isqueiro, rádio) sem animação. | `sala:3522` | M | `GC3` + sala |
| B9 | Cápsulas e carregadores com física própria, só contra o chão. | `GW3/src/box-fx.ts:298-322` | M | `GW3` + `game-physics` |
| B10 | Poucas chaves por clipe e só smoothstep: golpes sem antecipação nem acompanhamento. | `pose-clip.ts:38-40` | P/M | `game-characters-people` |
| B11 | Cobertura de z-fighting: o catálogo de personagens não inclui farda, cortes, humano nem o avatar com mãos; `game-props3d` sem teste. | `GC3/tests/catalog-cases.ts:33-34` | P | `GC3`, `game-props3d` |
| B12 | Documentação defasada: skill e README de itens dizem "24 modelos, 233 faltando"; a skill de armas diz que `place()` usa sempre `placeOnBody`. | `.claude/skills/kit-objetos-itens/references/game-items-three.md:3`, `kit-armas/references/game-weapons-three.md:155` | P | docs |

### 3.4 Altura customizável (decisão do dono, 2026-11-19)

A altura do personagem passa a ser um dado real, em metros, escolhido por pessoa, e vale como na vida real: define se o corpo passa
na porta e se cabe no veículo.

**O que já existe (fato):**

- O núcleo já escala o esqueleto por altura e largura: `createRig({ body, height, build })` (`GC/src/body/rig.ts:51-62`).
- A passada já recebe a altura: `walkGait(speed, height)` (`GC/src/gait/stride.ts:9-10`).
- O sobrevivente já é desenhado com fator de altura e de largura: `fig.scale.set(B, H, ...)` (`GC3/src/rich/person-builder.ts:56`),
  com faixas por idade (`game-characters-people/src/types.ts:32-37`).
- A multidão já varia de 0,9 a 1,1 por agente (`game-crowd/src/crowd.ts:293`).

**O que falta:**

| # | Falta | Evidência | Esforço | Dono |
|---|---|---|---|---|
| H1 | A base não mede o que declara: fator 1,0 dá 1,98 m, não 1,80 m. Sem corrigir, "1,75 m" no dado não é 1,75 m na tela. | `best-builder.ts:225`, `body.json:3` | M | `GC3` |
| H2 | A altura é fator relativo, não metros. Falta a entrada em metros (`heightMetres` por pessoa) convertida num lugar só. | `game-characters-people/src/types.ts:36` | P | `GC` + `-people` |
| H3 | O corpo do jogador e o Bestiário têm medidas fixas: quadril em 0,95, ombro e alcance de porta constantes, cabeça em 1,80. | `GC3/src/player/avatar.ts:38, 390`, `best-builder.ts:225` | M | `GC3` |
| H4 | Câmera de primeira pessoa, IK de braço, pega de arma e acessórios instanciados usam referências fixas de 1,80 m. | `GC3/src/instanced/accessory.ts:32-33` | M | `GC3` + `game-camera` + `GW3` |
| H5 | Colisor e cápsula do jogador não seguem a altura (a conferir no `game-player`). | não lido | M | `game-player` |
| H6 | Regra "cabe ou não cabe": comparar o corpo (altura sentado, largura de ombro, comprimento de perna) com o vão da porta e o espaço do assento. Dados e medidas na seção 7.3. | `GV3/src/build.ts:132` | M | SDK de regras (§3) + `game-vehicles` |
| H7 | Pose que se adapta: abaixar a cabeça na porta, joelho mais dobrado em banco baixo, banco recuado. | — | M | `GC3` |

Proporção não é só escala: uma pessoa de 1,60 m não é uma de 1,90 m encolhida. A primeira entrega pode ser escala uniforme em Y com
largura separada (o que o sobrevivente já faz); proporção de perna e tronco por pessoa fica como passo seguinte.

## 4. Plano sugerido

**Fase 0 — Ver antes de mexer (1 a 2 dias).** Rodar a sala e gravar a matriz da regra §5 para o estado atual: primeira e terceira
pessoa × parado, andando e correndo × mira alta, reta e baixa × uma arma por família, mais agachar, cair e segurar item. Isso
transforma as inferências (A4, A5, M3, B2) em fato ou as derruba, e vira a referência de antes e depois.

**Fase 1 — Base barata e de alto retorno.** A1 (altura), A4 (corrida e pop de fase), M1 (ligar `humanPose`/`blendMoves`), B11 e B12.
São correções pequenas que mudam toda cena e não dependem de decisão de arquitetura, exceto a A1 (ver seção 5).

**Fase 2 — Arquitetura de animação.** M2 (grafo de estados e camadas no núcleo), M9 (direção), M6 (um caminho só para as duas
câmeras, fechando a spec 004 T5), M8 (mira com coluna). É a fase que destrava as seguintes: sem camadas, não dá para golpear andando.

**Fase 3 — Conteúdo.** A2 (clipes de golpe por família de arma branca), M10 (reação a tiro, morte, levantar), A6 (pegar, largar,
guardar), A5 (ponto de pega no dado dos itens), M5 (poses de mão), B8.

**Fase 4 — Corpo.** A3 (ragdoll pelo Jolt), M3 e M4 (juntas, tornozelo, IK de pés), M11 (rosto), M7 (armas fora da Galeria).

**Fase 5 — Multidão e acabamento.** B1 a B5, B6, B7, B9, B10.

**Veículos** correm em paralelo, na ordem da seção 7.4; o ponto de encontro com personagens é o motorista dentro do carro (V1),
que depende da altura em metros (H1, H2) e da cabine corrigida (V2).

## 5. Decisões que precisam do dono antes de começar

1. **Altura (A1): decidido em 2026-11-19 — a altura é customizável por personagem, em metros reais, e tem consequência no jogo**
   (quem não cabe no veículo não entra; ver seção 3.4). Falta decidir só o detalhe: a malha base passa a medir exatamente a
   `heightMetres` declarada (muda os goldens literais do Bestiário v17, com a razão registrada), e toda altura vira fator sobre ela.
2. **Juntas (M3): decidido em 2026-11-24 — malha low-poly contínua (skinning com 2 pesos por junta) + leitura por textura/sujeira**
   (roupas variadas, sangue, mochila, rosto simples pintado), mantendo baixo custo de GPU para hordas grandes sem esferas salientes nem cilindros separados.
3. **Bestiário é porte literal: decidido em 2026-11-24 — desvio formal registrado** para adotar a malha low-poly contínua e texturizada da decisão 2 na spec 014 (mantendo a normalização de altura em metros na spec 012).
4. **Clipes de golpe (A2): decidido em 2026-11-24 — priorizar clipes de golpe corpo a corpo no kit** (1 mão, 2 mãos, empurrão), junto com ragdoll no Jolt (A3) e variação de poses na horda (B1).
5. **Câmeras (M6 / Spec 004 T5.1): decidido em 2026-11-24 — manter primeira pessoa e terceira pessoa no molde OTS (sobre o ombro direito)**, com jogador + mochila no quadrante inferior esquerdo e combate/horda ao centro-direita; ambas as câmeras são obrigatórias na validação §5. Falta confirmar apenas o descarte do rig legado `first-person/arms.ts` na spec 013.

## 6. O que este levantamento não cobre

- Nada foi rodado no navegador; vãos, travessias, patinação e pop são leitura de geometria e conta.
- As contagens de triângulos vêm do `dist` já construído, que pode estar defasado do `src`.
- Não foram lidos por inteiro: `first-person/arms.ts`, `ik.ts`, `game-camera/src/camera.ts`, `game-player/src/player.ts`, a física do item solto.
- Animais, móveis, vegetação e efeitos ficam para as próximas partes.

## 7. Veículos

Abreviações: `GV` = `packages/game-vehicles`, `GVF` = `-fleet`, `GV3` = `-three`, `GVD` = `-driving`. Medições por script sobre o
`dist`, na frota inteira (69 modelos).

### 7.1 Como funciona hoje

| Tema | Hoje | Onde |
|---|---|---|
| Modelo | Procedural por construtores (`kit.car`, `shell`, `interior`, `seat`, `steeringWheel`); peças rígidas num `Group`. | `GV/src/interior.ts:45-128` |
| Custo `high` (medido) | Carro: mediana 198.892 triângulos e 362 chamadas; caminhão 220 mil e 525; moto 50 mil e 106; pior caso `battle_tank`, 426.578. | — |
| Custo `lite` (medido) | Carro com cerca de 18.600 triângulos em 6 malhas, sem interior. | `GV3/src/lite.ts:12-16` |
| LOD | Dois níveis, troca seca aos 14 m; veículo tocado ou de porta aberta fica no `high`. | `GV3/src/vehicle-lod.ts:12, 36` |
| Materiais | `MeshStandardMaterial`; pintura sem verniz; reflexo por mapa de estúdio só com metalness ≥ 0,6. | `GV/src/context.ts:112-113`, `materials.ts:84-86` |
| Aberturas | Clipes de 2 chaves, 1,2 s, ângulo fixo de 1,15 rad, rampa linear. Vidro desce em 3,5 s; limpador em seno. | `GV/src/destructible/clips.ts:8-32`, `GV3/src/body.ts:117, 155-173` |
| Rodas | Giro = distância / raio; esterço nas dianteiras. Só o banco de provas usa. | `GV3/src/wheel-roll.ts:44-47` |
| Rotores e hélices | Velocidade constante. | `GVF/src/vehicles/helicopters-extra.ts:118, 146` |
| Luzes | Posição, baixo, alto, neblina, freio, ré, setas, cabine, giroflex. | `GV3/src/lamps.ts:16-37` |
| Painel | Velocímetro e conta-giros em textura de canvas. | `GV3/src/dashboard.ts:101-139` |
| Ocupantes | Nenhum corpo: o motorista é só uma câmera num olho fixo sobre o banco. | `GV3/src/build.ts:131-143` |

### 7.2 Melhorias

| # | Prio. | Problema | Evidência | Tipo | Esforço | Dono |
|---|---|---|---|---|---|---|
| V1 | alta | **Carro vazio.** Nenhum pacote de veículos depende de `game-characters`: não há entrar, sair, mãos no volante nem pose sentada. A ejeção põe um objeto solto a 1,2 m à frente. | `GV3/src/build.ts:136-143`, `test-area/proving/crash.ts:44-45` | fato | G | `GV3` + `GC3` |
| V2 | alta | **Cabine baixa demais para um corpo** (seção 7.3). | script | medido | M | `GV` (`interior`) |
| V3 | alta | **Sem suspensão visual.** A semi-simulação calcula altura, `pitch` e `roll`, mas a pose gira o grupo inteiro e fixa y = 0: as rodas inclinam com a carroceria. | `GV3/src/test-area/proving/module.ts:356-357`, `GVD/src/semi/types.ts:102-108` | fato | M | `GV3` |
| V4 | alta | **Na pista de batida a roda não gira e a carroceria não inclina.** O arcade não tem `pitch` nem `roll` no estado. | `GV3/src/test-area/module.ts:377-380`, `GVD/src/types.ts:15-25` | fato | P | `GV3` + `GVD` |
| V5 | alta | **Custo do `high`:** cerca de 360 chamadas por carro, sem nível entre 199 mil e 18 mil triângulos (o estalo aos 14 m é inferência). | `vehicle-lod.ts:12` | medido | G | `GV3` |
| V6 | alta | **38 de 69 modelos sem clipe de abertura:** todas as motos, 4 caminhões, 2 ônibus, 7 barcos, 7 aviões, 6 de 7 helicópteros. Só 14 carros têm limpador. | script | medido | G | `GV` + `GVF` |
| V7 | média | Volante e manche não giram; não há pedais. | `GV/src/interior.ts:106-128` | fato | P/M | `GV3` |
| V8 | média | Aberturas sem easing e com o mesmo ângulo em toda porta e tampa; `open_doors` abre todas juntas. | `clips.ts:20-21, 30-32` | fato | P | `GV` + `GV3` |
| V9 | média | Esteira parada (entra no giro com `v: 0`). | `GV/src/wheels.ts:105` | fato | M | `GV3` |
| V10 | média | Rotor e hélice não aceleram nem param; sem disco borrado. | `helicopters-extra.ts:118, 146`, `water-air.ts:691` | fato | M | `GV3` + `GVF` |
| V11 | média | Moto: só a roda da frente esterça; sem inclinação em curva nem descanso. | `wheel-roll.ts:46-47` | fato | M | `GV3` + `GVF` |
| V12 | média | Faltam por categoria: trem de pouso, basculante, portas de ônibus, guincho, retrovisor. | busca sem resultado | fato | G | `GVF` |
| V13 | média | Dano entra de uma vez: amassado, pneu murcho e trinca sem transição no tempo. | `GV/src/destructible/visual.ts:1305-1308` | fato | M | `GV` |
| V14 | média | Sem marca de pneu, poeira ou respingo; escapamento sai de um ponto genérico. | `GV3/src/test-area/module.ts:456-458` | fato | M | `GV3` + `game-vfx` |
| V15 | média | Luzes sem peça de dano continuam acesas. | `docs/veiculos-verificacao.md` | fato | M | `GV` |
| V16 | média | Pintura sem verniz, sujeira ou reflexo; carro quase preto na perseguição e cabine escura. | prints `10-dirigindo-freio-pisca.png`, `13-cabine-hatch.png` | fato + print | M | `GV` |
| V17 | baixa | Dívida de z-fighting: 4.190 pares no `GVF` e 2.558 no `GV3`. | `tests/fixtures/z-fighting-ledger.json` | fato | G | `GVF` |
| V18 | baixa | Tipagem: 10 `[key: string]: any` e 50 `any` no `GV` (§10). | `GV/src/api.ts:61-485` | fato | M | `GV` |
| V19 | baixa | Sem print de porta, vidro ou limpador em movimento; pasta de prints da área vazia; README e skill dizem que a área "está prevista". | `GV3/tests/`, `docs/veiculos-verificacao.md` | fato | P | `GV3`, docs |

### 7.3 Quem cabe no veículo

Regra pedida pelo dono: a altura vale como na vida real; quem não cabe não entra.

**Hoje (fato):**

- O único dado por assento é o topo da almofada, `seatTops: { x, y, z, w, l }` (`GV/src/context.ts:58`, `interior.ts:54-56`).
  Não há altura livre, espaço de pernas, ponto do quadril nem vão de porta. `dims.json` só tem medidas externas.
- Não existe checagem de quem cabe. O ocupante é um olho fixo `SEATED_EYE = { up: 0.55, back: 0.28 }`, igual para todo corpo
  (`GV3/src/build.ts:132`).
- 12 modelos (motos e quadriciclo) têm `seatTops` vazio.

**Altura livre medida** (um raio vertical do centro da almofada até a primeira malha; pode ter pego peça que não é o forro):

| Modelo | Almofada (m) | Altura livre (m) |
|---|---|---|
| `compact_hatch` | 0,69 | 0,61 |
| `midsize_sedan` | 0,69 | 0,64 |
| `beetle` | 0,67 | 0,80 |
| `midsize_pickup` | 0,89 | 0,84 |
| `large_suv` | 0,87 | 0,82 |
| `box_truck` | 1,57 | 0,80 |
| `cargo_van` | 1,07 | 1,20 |

Uma pessoa de 1,80 m precisa de cerca de 0,90 m do assento ao topo da cabeça (referência antropométrica, não medida no kit).
Com a mediana dos carros em 0,69 m, **a regra ligada hoje reprovaria todo mundo em hatch e sedã**: a almofada está alta e o forro
baixo. Um carro real desses tem de 0,95 a 1,00 m. A cabine precisa ser corrigida antes da regra.

**O que precisa existir, em ordem:**

1. Corrigir a cabine (V2): almofada e forro na medida real, com teste na frota inteira.
2. Dado por assento no `GV`, gravado pelo `kit.seat`: ponto do quadril, altura livre, espaço de pernas, largura; e o vão de cada porta.
3. Assento nas motos e no quadriciclo.
4. Medidas do corpo derivadas da altura (H2): altura sentado, largura de ombro, comprimento de coxa e canela.
5. Função pura `fits(corpo, assento, porta)` com o motivo da recusa (cabeça, perna, ombro, porta), testada na frota inteira.
   Pela §3, mora num pacote de regras que usa `GV` e `GC`, não no jogo.
6. Pose sentada paramétrica no `GC3` (H7): joelho pelo espaço de pernas, tronco e cabeça pela altura livre, mãos no volante por IK.

Decisão a tomar: a recusa é binária (não entra) ou tem meio-termo (entra curvado, com penalidade de visão ou de tempo para entrar)?
A vida real tem o meio-termo; o binário é mais simples de ler no jogo.

### 7.4 Ordem sugerida para veículos

1. V4 e V8 (baratas: roda girando e easing nas portas).
2. V2 e o dado por assento (destrava a regra de caber).
3. V3 (suspensão visual) e V7 (volante).
4. V1 (motorista dentro, entrar e sair) junto com H6 e H7.
5. V6 e V12 (clipes por categoria), V9 a V11.
6. V5 (custo e LOD intermediário), V13 a V16, depois as de prioridade baixa.

Não lidos por inteiro: `destructible/impl.ts`, `visual.ts`, `explosion.ts`, `rollover.ts`, `particles.ts`, `semi/driver.ts`. Fogo, fumaça,
capotamento e peça solta existem, mas a qualidade deles não foi avaliada.

## 8. Specs que executam este levantamento

| Spec | Cobre | Depende de |
|---|---|---|
| `specs/012-altura-real-e-quem-cabe/` | A1, H1 a H7, V2: altura em metros, medidas do corpo, espaço por assento, cabine, `fits` | — |
| `specs/013-animacao-de-personagens/` | A3, A4, M1, M2, M4 (IK), M6, M8, M9, M10, B1, B10 | 014 só na fase 5 |
| `specs/014-corpo-do-personagem/` | M3, M4 (peça), M5, M11, B1 a B6, B11 | 012 fase 1 |
| `specs/015-itens-e-armas-na-mao/` | A2, A5, A6, M6 (armas), M7, B5, B7 a B10, B12 | 013 fases 1 e 3, 014 fase 3 |
| `specs/016-veiculos-animacao-e-ocupantes/` | V1, V3 a V16, V19 | 012; 013 e 014 nas fases 4 e 5 |

Ordem: 012 primeiro. Depois 013 e 016 (fases 0 a 3) em paralelo; 014 depois da fase 1 da 012; 015 depois das camadas da 013.
Fora das specs, com decisão pendente do dono: modelar as 8 armas em caixa e os 82 itens em forma simples (§1), e a tipagem dos
`any` do `game-vehicles` (§10, PR próprio).
