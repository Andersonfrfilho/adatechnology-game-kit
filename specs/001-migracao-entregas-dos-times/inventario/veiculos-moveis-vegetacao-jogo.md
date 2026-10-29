# Inventário: Veículos, Móveis, Vegetação e Jogo (integração, hordas, contágio)

Levantado em 2026-10-23 sobre `specs/001-migracao-entregas-dos-times/sources/*.js` contra `packages/*` do SDK (`main`, release dos pacotes
de 17:14). Nada de código foi alterado. Números de linha são **do arquivo em `sources/`** (cada arquivo começa com 3 linhas de cabeçalho).

## 0. Como foi conferido (e resultado em uma tabela)

Não comparei só por leitura: **executei o código das páginas em Node** (three 0.128, `document` falso de canvas, o mesmo digest do golden:
tipo, posição, quaternion, escala, hash dos vértices e material de cada objeto) e comparei com o SDK compilado (`dist/`).

| Verificação | Resultado |
|---|---|
| Garagem (`veiculos__garagem.js`, scripts 1 e 3 a 13, com o sangue e a marca "horda" do plugin desligados) reproduz o `golden.json` do fleet? | **542 de 552 conferências batem** (69 veículos x intacto, danificado, modificado e 5 cenários). As **10 que diferem** são exatamente `seda` x 8 (todos os estados e cenários), `popular` capotado e `civico` capotado. Com o sangue ligado, as batidas frontais e os danificados de quase todos os carros também diferem, e é por isso que o golden não os tem |
| SDK (`game-vehicles` + `-fleet`) × código da garagem, `build` intacto de `seda` | **Idênticos** (hash `451b16b4` nos dois). O `golden.json` tem `15759434` |
| SDK × garagem, 5 cenários de `seda`, `popular` e `civico` | `seda` lateral/abandonado/queimado e `civico` capotado: hash do SDK **igual ao da página** (`7189ae8b`, `a3810be7`, `a53217e2`, `330b1a88`); o golden é que difere |
| SDK × garagem, comportamento dinâmico em 4 veículos (`hatch`, `onibus`, `moto`, `heli`): construir, `explode` + 6 s de `settle`, `roll` + 5 s, `zoneDamageAt` | **Idênticos** (mesmo hash de cena; dano por zona igual, só mudou o nome do id) |
| `game-infection` × `simulate()` de `jogo__antes-do-dia-1.js` (cenário padrão, 6 fases, 14 regiões) | **Igual** em ativos, contidos e incubando nos dias -5, -3, -1, 0, 1, 3, 7, 14 e 30 (ex.: dia 30, 33.840 ativos nos dois) |
| `FrotaLeve` × SDK, triângulos em `alta` | **193.908** (hatch) nos dois; o SDK só tem a versão `alta` |
| `FrotaLeve` em `jogo` | hatch **19.181 triângulos e 6 draw calls**, contra 193.908 e 356 em `alta` |
| SDK sob three r160 | monta, aplica cenário e explode sem erro (mesmos 368 objetos e 193.908 triângulos); cor das texturas de placa sem `colorSpace` não conferido |

Os scripts de apoio ficaram só no scratchpad da sessão (`.../scratchpad/gar/*.cjs`, `fl/perf.cjs`, `cmp-infection.mjs`); se virarem rotina,
o caminho certo é `specs/001-migracao-entregas-dos-times/tools/`.

---

## 1. Entregas por fonte

### 1.1 `veiculos__garagem.js` (14.693 linhas) — Garagem v4/v5, 69 veículos, dano por zona

Texto da página: visor 3D de cada veículo nos estados Intacto, Batido, Modificado e "Os três"; "Simular batida" (Frente, Traseira, Capotar,
Lado esquerdo, Lado direito), Consertar, Abrir capô, Limpador, Explodir com força 0 a 100 (km/h = força x 65), mapa de danos, cenários
prontos, "Frota completa" (folha de contato) e tabela de combustíveis. Cabeçalho da página: "modelos gerados em código como referência
de forma, proporção, peças e zonas de dano para o artista 3D".

| Script / linhas | O que é | Origem |
|---|---|---|
| 0 · 4-14 | three r128 (cópia embutida) | biblioteca |
| 1 · 16-3896 | **VehicleSDK 5.0** (núcleo genérico, `window.VehicleSDK`, +x frente, +z lado direito) | SDK (cópia em português) |
| 1 · seções | dados 26, utilitários 51, materiais 59, geometria 175, contexto de construção 397, carrocerias 499, vidros 583, faróis/lanternas/grades 655, interior 831, capô e motor 957, warp e loft 1097, carro genérico 1187, caminhões 1328, rodas especiais 1391, partículas 1442, fluidos 1616, trinca e estilhaço 1807, batida 1919, capotagem 2148, explosão 2273, laço por quadro 2416, modificado 2430, **zonas de dano 2529-3808**, extensão (configure, plugin, ganchos) 3809, montagem 3854 | SDK |
| 2 · 3897-3997 | widgets `SDK.ui`: `damageMap` 3915, `bandButtons` 3955, `legend` 3963, `healthBar` 3972, `scenarioButtons` 3979, `injectStyles` 3992 | SDK |
| 3 · 3998-4207 | **plugin do ZombiAdA**: `FUELS` 4011 (9 combustíveis), `GROUPS` 4023, `PART_FX` 4026, `ZONE_FX` 4051 (~42 chaves x 5 faixas), `FLUIDS` 4097 (sangue de zumbi), `SCENARIOS` 4100 (**seis**: frontal 4101, lateral 4112, capotado 4120, abandonado 4132, **horda 4138**, queimado 4147), `frontBloodFx` 4157, `hordeFx` 4163, `SDK.plugin` 4180 (`defaultGroup`, `texts: { who, plate: "ZMB4D23" }`) | código do jogo |
| 4 · 4208-5974 | Grupo A: motos (loft de superelipse `sloft`) e carros (construtor local `carro()` com para-choques integrados, `warp` de nariz e traseira): 15 `register` | frota |
| 5 · 5975-7048 | Grupo B: SUVs, picapes, bigfoot, vans: 10 | frota |
| 6 · 7049-7979 | Grupo C: caminhões, ônibus, carro-forte, trator: 6 | frota |
| 7 · 7980-9438 | Grupo D: militares: 6 | frota |
| 8 · 9439-10459 | Água e ar (cascos, asas, fuselagens, hélices, rotores, luzes de navegação; `ZG.EA`): 7 | frota |
| 9 · 10460-11253 | Motos novas v4 (Bis 125, Fazê 250, Ninjá 400, Fat Boi 114, Titã 160 Cargo): 5 | frota |
| 10 · 11254-12516 | Carros novos v4 (Unno, Gól, HB-21, Pólo, Cívico, Opalla, Mustangue): 7 | frota |
| 11-13 · 12517-14185 | Barcos novos (4), aviões novos (5, `ZG.GH`), helicópteros novos (4) | frota |
| 14 · 14186-14693 | **App da Garagem**: `makeStage` 14196 (cenário noturno facetado, água), `animateWater` 14227, `show` 14256, `advance` 14292, `loop` 14311, `clickHit` 14328, **`hitAt` 14340** (batida por clique, faíscas e plástico), `runScenario` 14366, `setHood` 14397, `explode` 14424, `mergeScenario` 14437, `renderInfo` 14472, `renderMap` 14503, folha de contato com cache de miniaturas em `localStorage` (`thumbLoad` 14582, `thumbSave` 14586, `renderThumbs` 14590), combustíveis 14624, API de teste para revisores (`info` 14634, `settleShot` 14641) | página |

Total: **69 `ZG.register`**.

### 1.2 `veiculos__frota.js` (1.848 linhas) — documento de design "Frota e veículos" v0.4

Índice: Pilares, A frota, Condução e física, Combustível, Peças e danos, Faixas de dano, Reparo e mods, Atropelar hordas, Barulho, Onde
encontrar, LAN e passageiros, Desempenho, Equipe de veículos, Roadmap, Perguntas abertas.

- Script 0, linhas 6-1806: array `fleet` com **69 fichas** `{ g, n, c, d, insp, s[6], r, seats, tank, eff, fuel, auto, vmax, tags }`. `s` = [velocidade,
  aceleração, manobra, resistência, carga, consumo] de 0 a 10 (comentário da linha 7); `r` = barulho em metros de raio audível; `vmax` em km/h.
  Grupos: Motos 12, Carros 15, SUVs 4, Picapes e bigfoot 4, Vans 2, Caminhões e ônibus 5, Agrícola 1, Militares 8, Aquáticos 7, Aéreos 11.
- Linhas 1807-1848: seletor de veículo, placa, barras dos 6 atributos, tabela resumida.
- Regras de jogo escritas só em texto: semi-simulação, corpo rígido único com centro de massa baixo, **suspensão por raycast por roda (mola +
  amortecedor)**, curva de atrito simplificada, câmbio automático, freio de mão trava as rodas traseiras, superfícies (asfalto seco 1,0,
  molhado 0,75 com aquaplanagem acima de 90 km/h, terra 0,65, grama 0,55, lama 0,4 e sem 4x4 atola, sangue e corpos 0,5), consumo e peso.
- Conferi `r` e `vmax` das fichas contra os `register` da garagem nos 58 veículos que consegui casar por nome: **consistentes**.

### 1.3 `veiculos__frota-leve.js` (14.514 linhas) — "Frota Leve", visor de veículos leves

Texto da página: Frota Leve, qualidade (Jogo / Alta), Semente, Sortear, Cor, "Mostrar peças danificáveis" (legenda metal, vidro, borracha,
combustível). Cabeçalho do código: "frota de 69 veículos 3D (SDK de veículos v5 + plugin + frota), pronta para three r160. Um único global:
`FrotaLeve`. Saída: +z frente, +y cima, -x lado direito, chão em y=0, centrado em x/z".

| Linhas | O que é | Origem |
|---|---|---|
| 21-64 `envolverTHREE` | cópia do namespace three r160 com `CanvasTexture` em sRGB e **geradores de geometria com menos segmentos no modo jogo** (cilindro, esfera, toro, lathe, tubo, extrusão, círculo, anel) | **só aqui** |
| 65 `LOD` | `{ on, fr: 0.5, nb: 1, sub: 2.2, caixaPlana: 0.22, segMin: 14, lofSeg: 0.45, estMin: 20, estFr: 0.55, grade: 2.6 }` | **só aqui** |
| 69-3956 | VehicleSDK 5.0, **idêntico ao da garagem exceto 11 linhas `[LOD]`** (caixa lisa, anéis de arredondamento, subdivisão, estruturas, loft) | SDK + LOD |
| 3957-4166 | plugin do ZombiAdA (mesmo da garagem) | jogo |
| 4167-14170 | as 10 famílias de frota; **diferem da garagem só em 4 a 23 linhas por família** (os ganchos `[LOD]`) | frota + LOD |
| 14155 `instalarLOD` | no modo jogo, `interior`, `engineBay`, `seat`, `dashboard`, `steeringWheel`, `yoke`, `busRows` marcam suas malhas `skipJogo`; `LOD.skipMats` (assento, carpete, forro, mostradores, motor, radiador...) | **só aqui** |
| 14171 `DIMS` | comprimento, largura e altura de cada um dos 69 | **só aqui** |
| 14172-14192 `PALETA`, `PALETA_MIL`, `corDaSemente` | 13 cores de mercado brasileiro com peso + 5 cores militares; cor determinística por semente | **só aqui** |
| 14193 `contar` | triângulos e draw calls | só aqui |
| 14208-14310 `criarFusor`, `construirJogo`, `classificar`, `corClasse`, `materiaisJogo` | **funde o veículo em 6 malhas** (`pintura`, `acabamento`, `metal`, `vidro`, `luz`, `placa`) com cor por vértice, poda peças menores que 3 cm, recolore a pintura primária | **só aqui** |
| 14311-14442 `criarApi` | `api.lista()` 14317, **`api.construir(k, { qualidade: 'jogo' \| 'alta', semente, cor })`** 14335 devolve `{ grupo, danificaveis, tris, drawCalls, L, W, H, liberar() }`; `recolorirAlta` 14396, `tipoDaZona` 14406, **`coletarDanificaveis`** 14418 (caixa de cada zona porta/capô/tampa/para-choque/vidro/luz/roda/tanque no espaço de saída, tipada em metal, vidro, borracha, combustível), `marcarAlta` 14427 | **só aqui** |
| script 2 · 14443-14514 | visor (órbita, qualidade, semente, cor, caixas de peças danificáveis) | página |

Medido (three 0.128, semente 7): `hatch` alta 193.908 tri e 356 draw calls, jogo 19.181 e 6; `seda` 204.504 e 363, jogo 19.286 e 6; `picape` 195.865 e
377, jogo 16.931 e 6; `onibus` 181.553 e 369, jogo 17.682 e 6; `leopardo` 426.578 e 392, jogo 26.628 e 4; `moto` 43.190 e 105, jogo 4.422 e 4;
`blackhawk` 108.036 e 155, jogo 21.517 e 4; `trator` 145.048 e 242, jogo 7.904 e 4.

### 1.4 `veiculos__sala-de-testes__sala-veiculos.js` (43.419 linhas) — Sala de testes: veículos

- Script 0 (4-3788): three. Script 1 (3789-15805): **bundle `GameVehicles` do SDK** (458 KB, já com `createVehicleDestructible` e
  `buildVehicleItem`). Script 2 (15806-43113): **bundle `GameVehiclesFleet`** (1.070 KB). Script 3 (43114-43407): código da página.
- **`MODULO_VEICULOS`** (43398): `TestableModule` com 8 itens (`FROTA` 43123: hatch, sedan, picape, moto esportiva, caminhão baú, ônibus
  urbano, tanque de guerra, helicóptero de ataque), `kitFor` 43135, `clipsOf` 43146 (animações de porta, capô e porta-malas), `items` 43158 e
  **11 cenários** (43182-43397): `veiculos_9mm_parabrisa`, `veiculos_espingarda_porta`, `veiculos_bater_frente`, `veiculos_fogo_motor`,
  `veiculos_tanque` (vaza, pega fogo, explode), `veiculos_soltar_roda` (chave inglesa), `veiculos_arrancar_parachoque`,
  `veiculos_quebrar_retrovisor`, `veiculos_matar_bateria`, `veiculos_capotar`, `veiculos_derreter`. Script 4 (43408): `room.loadModule`,
  `?scenario=` e `?scenario=all`.

### 1.5 `veiculos__sdk-demo-rali.js` (10.106 linhas) — "Vehicles example · Cosmic Rally"

Script 0: three; script 1 (15-9971): bundle `GameVehicles`; script 2 (9972-10106): o `example.html` do próprio `packages/game-vehicles/example`
(plugin Cosmic Rally, três cenários, mapa de danos). **Não é trabalho do time; é o exemplo do SDK**. Nada a migrar.

### 1.6 `jogo__bancada-moveis-interativos.js` (5.696 linhas) — Bancada de móveis interativos

Script 0 (4-3789): three + bundle esbuild do SDK (`GameInteractables`, `-Household`, `-Three`). Script 1 (3791-5696, 1.906 linhas): **idêntico a
`examples/interactables-showroom/src/showroom.js`** (diferença: 5 linhas do `?area=` no SDK, que é mais novo). Painel: Ambiente (noite, chuva,
vento, qualidade), Energia (rede elétrica), Gás (registro, botijão), Água (caixa d'água, encher, esvaziar, vazamento), Objetos. Teclas: WASD,
Shift, E interagir, F pegar item, Espaço levantar, B mochila. O bundle da página tem **51 tipos** (inclui `bunk_bed`, `wood_stove`, `campfire`,
`mergeColliders`, `setBurner`), ou seja, é o SDK atual. Não é código novo.

### 1.7 `sala-de-testes__area-moveis.js` (3.848 linhas)

Script 0 (4-3788): three e módulos. Script 1 (3789-3848): global `FurnitureArea` minificado (203 KB) = `examples/interactables-test-area`. O bundle é
**uma versão antes** da atual (sem `mergeColliders`, sem `setBurner`). Não é código novo.

### 1.8 `vegetacao__viveiro.js` (78.256 linhas) — Viveiro do Vale

| Linhas | O que é | Origem |
|---|---|---|
| 7-4637 | `GameVegetation` (dist/index.global.js) | SDK, **igual ao `dist` atual** (5 linhas de diferença, cabeçalho) |
| 4641-7870 | `GameVegetationSpecies` | SDK, igual ao atual (5 linhas) |
| 7874-22959 | `GameTestRoom` (sala + destruição + armas + fluidos), 558 KB | SDK |
| 22960-23597 | **`vegetation-module.js`** = `VegetationTestModule.create({ GameVegetation, GameVegetationSpecies })`, `TestableModule` com 18 itens (`DEFS` 22989: mangueira, mangueiras jovens de 15 e 30 cm, ipê, coqueiro, bananeira com cacho, araucária, árvore morta, hibisco, cerca-viva de buxo, rosa, girassol, mandacaru, palma, coroa-de-frade, samambaia e cacto em vaso, tufo de grama), `buildObject` (peças separáveis), `buildSpec` (monta o `DestructibleSpec`: juntas stem/tie/resting, massa, grão, fill), `swayClip` e **13 cenários** `veg_*`: machado derruba a copa (8 a 15 golpes), machado em tronco de 30 cm (25 a 40), machado passa pela junta tronco-galho, 9 mm não derruba, serra no galho, isqueiro pega fogo na folhagem, tiro arranca folhas, tiros quebram vaso, machete no braço do mandacaru, palma arrancada, árvore morta queima mais rápido, cerca-viva cortada em partes, pisar na grama não colide | **página** (não está no SDK) |
| 23598-77695 | three r160 embutido | biblioteca |
| 77696-78256 | **código da página**: catálogo (`buildCatalogUI` 77877, `renderCat` 77841, `selectSpecies` 77903), **canteiro** de 12 x 20 m (`LOT` 77910, `HOUSE`, `WAY`, `buildLotStatic` 77914, `AREAS` 77936, **`rulesFor` 77943**, `buildLotVeg` 77964, `stepLot` 78007: personagem que anda e curva as plantas), vitrine em escala real (`buildShow` 78046), sala de testes (`ensureRoom` 78097), modos, rótulos 3D, colisores em vermelho | página |

`rulesFor` pega o contexto da região (`GVS.pickForContext(GVS.regions.br, ctx, seed)`), descarta trepadeiras e (quintal da frente) árvores grandes,
separa as espécies sorteadas em **árvores, cercas-vivas, médias e forração** e devolve regras de `scatter` com densidade, distância mínima,
`prefer: 'edge'` para cerca-viva, escala e `maxCount`. Isso não existe no SDK.

### 1.9 `jogo__zombiada-jardim-aurora.js` (58.956 linhas) — o jogo (fatia jogável, versão anterior)

Script único: three r160 embutido (7-~53050) e **~5.900 linhas de código próprio (53054-58955)**. Não usa nenhum bundle do SDK. Texto da página: WASD,
Shift, C, Espaço (pular muro), mouse, 1-4 armas, R, E, F/G/T, Tab/L mochila, carro (W/S, A/D, Espaço, H), Q/P/F3.

| Linhas | Seção | Conteúdo |
|---|---|---|
| 53054-53134 | Dados | `CATS` 53061 (13 tipos), `IDADES`, `ROUPAS`, `SEG`, `CALIBRES` 53098 (4 calibres), `ARMAS` 53107 (4 armas), `FICHA`/`DERIV` 53115 (atributos, vida, fôlego, corrida, compostura), `INFEC` 53126, `FERIDA` 53127, `BANDS` 53130 |
| 53135 | Itens | `ITENS` (gerado de `catalogo-itens.json`) |
| 53137-53268 | Núcleo | `timeU`, entrada (`keys`, `mouse`, `wasPressed`), **áudio sintetizado** (`audioInit`, `noise`, `sfx` 53200, `LOOPS`/`loopSet` 53219, `grito` 53239, `voz` 53254) |
| 53269-54979 | Mundo | quarteirão, galeria do Vale, Mansão Valverde, trilhas, Fazenda Santa Clara, cenas, interiores |
| 54980-55187 | Corpo | corpo arredondado com animação na GPU (`buildBody` 55014, `bodyMaterial`, `BodyBatch` 55154, `BODY_LOD`) |
| 55188-55472 | Bestiário | `BEST` 55191 (corpo dos 13 tipos), `bakeBody` 55422 |
| 55473-55541 | **Carros da Garagem v3 "assados"** | `FROTA_DADOS` 55474 (15 modelos, base64: `l0` ~3.700 vértices, `l1` ~600 e `gl` vidro), `frotaGeo`, `frotaMaterial` (atributo `vrm` de cor, rugosidade, metal e luz por vértice), `FROTA_RUA` (10), `frotaRender` 55524 (InstancedMesh, LOD por 40 m, queimado) |
| 55542-55997 | **Horda** | `Z` (struct-of-arrays, `ZMAX` 6000), `zSpawn` 55574, `zRemove`, **flow field fatiado** (`flowStart` 55613, `flowStep` 55619, janela de 2 x 192 células), `losClear`, **`hordeUpdate` 55663** (faixas R0-R3 20/5/1/0,2 Hz com histerese, percepção por visão e ruído, 6 vagas de ataque, separação, pular obstáculo, bater em porta), `groan` 55797 (alerta em cadeia), `screamAt`, `zAttack`, **`zDamage` 55829** (região, capacete, colete, desmembramento), `zKill`, `inchadoBurst`, corpos (400, 15 min), `hordeRender` 55916, `populationUpdate` 55975 |
| 55998-56219 | Habilidades | estados extras (no ar, dormente, inchando, golpe em arco, comendo, degrau da pirâmide, atraído por som), pirâmide de corpos, piscina, rastro de sangue, `zAbility` 56082 para os 13 tipos |
| 56220-56506 | Efeitos | pools aquecidos: partículas, decalques de sangue (`decalMaterial`, `decalAdd`), poças, pegadas, nuvens, membros |
| 56507-56864 | Explosões | bola de fogo com faixas de calor, detritos, onda de choque, reação em cadeia, `carWreck`, muros que quebram |
| 56865-57198 | **Jogador** | `view`, `player` (vida, fôlego, agachar, agarrão, infecção, ferimentos, pânico, queda, cegueira), `PB` (corpos dos sobreviventes), `inv`, `playerUpdate` 56939, `shove`, `knife`, `fire`, **`shootRay` 57137** (penetração, queda por distância, sangue na parede), `rayZombies` 57165 (cápsulas por região) |
| 57199-57397 | **Itens, inventário** | `bag`, `needs` (fome, sede), `take`, `useItem`, `dropItem`, `findFocus`/`interactUpdate` 57311, saque (`openLoot`), barricada, lanterna (`lampUpdate`) |
| 57398-57589 | **HUD, câmera, dia, chuva** | mensagens, `perf` + **GPU timer** (`gpuBegin` 57410, `gpuEnd`, `fpsStats` 57419), `hudUpdate` 57427, `playerHand`, **`cameraUpdate` 57480**, luz de sódio nos postes (`sodiumUpdate` 57536), chuva, `skyUpdate` 57559 |
| 57590-58351 | Vale vivo | `VALE`: simulador de destino dos sobreviventes (cópia 1:1 da página Sobreviventes) |
| 58352-58613 | Sobreviventes | rádio das 20 h, boletim, diário, NPCs |
| 58614-58715 | **Carro dirigível** | `CAR` 58616, `carEnter`, `carExit`, **`carUpdate` 58661** (arcade: aceleração 5,5, freio 12, direção 0,55, `v` de -5 a 17; atropelamento: acima de 3 m/s derruba, acima de 8 m/s mata e arranca membros; devagar a horda segura o carro; batida dá dano e tranco; barulho 25 m + 2 x velocidade; buzina 120 m), `carSync` |
| 58716-58856 | Objetivo | sinalizador, horda dos 15 min, laje da Casa 8, helicóptero |
| 58857-58955 | Laço | `onPlayerDeath`, `showEnd`, `start`, `frame`, `resize` |

### 1.10 `jogo__zombiada-modo-livre.js` (75.272 linhas) — o jogo (versão atual, integra mais coisa)

Script 0 (4-6): importmap com three em `data:`. Script 1 (7-75272, 6.294 KB).

| Linhas | Conteúdo | Origem |
|---|---|---|
| 11 `GameVegetation`, 4143 `GameVegetationSpecies`, 7632 `GameContracts`, 7903 `GameDestructionThree`, 11525 `GameDestruction`, 14691 `GameFluidsThree`, 15808 `GameFluids`, 18015 `GameTestRoom`, 33100 `GameWeapons`, 35661 `GameInteractablesHousehold`, 41092 `GameInteractablesThree`, 42787 `GameInteractables` | **bundles do SDK** (cópias antigas) | SDK |
| 7372-7559 `AndaresSDK` | vários andares (genérico, "vira sdk/andares") | time de casas |
| 7560-7631 `CameraModosSDK` | câmera (ombro, terceira, primeira) | = `game-camera` |
| 34747-35660 `AdaptadorInterativos` | liga planta (`PlantasSDK`) a objetos `game-interactables-household`: `MAPA_TIPOS`, `planejar`, `criarMundo`, `adicionar`, `bloqueadoDe`, `pontoDe`, `especProprio`; cabeçalho: "Código do JOGO: nada disto vai para o kit" | jogo |
| 44400-44853 `Moveis3DSDK`, 44854-48672 `PlantasSDK`, 48850-51854 `Casa3DSDK` | casas e móveis de cena | time de casas |
| 48673-48849 `ModoLivreSDK` | voo livre, posição, marcas, painel, cenários, etiquetas | = `game-devtools` |
| 50755-50862 | **carros do FrotaLeve** na casa: `cfg.frota`, `FROTA.construir(k, { qualidade, semente })`; 51729: as `danificaveis` viram partes virtuais no espaço da casa | consome FrotaLeve |
| 51248-51535 | objetos do kit no lugar dos móveis estáticos | jogo |
| 51855-66286 | **FrotaLeve v1.0 completo embutido** (envolverTHREE 51855, núcleo 51915, plugin 55803, famílias 56013-65477, `criarApi` 66157-66284) | frota-leve |
| 66287-75272 | **código do jogo** (versão atual): mesmas seções do 1.9 e mais: bichos (`BICHOS` 70472, 70854), **andares no jogo** (71730), **Jardim das Palmeiras** (`PAL` 71917), horda 71040-71506 (`hordeUpdate` 71161) e habilidades 71507-71729 (`zAbility` 71592), jogador 72749 (`playerUpdate` 72825, `shootRay` 73025), itens 73087, HUD/câmera 73286 (`cameraUpdate` 73368), Vale vivo 73486, carro `CAR` 74513 (`carUpdate` 74558), **câmera do jogo + adaptador do SDK** 74854-74887, **adaptador do modo livre** 74888-75120, casas do Casa3DSDK ligadas ao inventário 75266 | jogo |

**Uso real dos bundles do SDK**: fora dos próprios bundles, o código do jogo referencia só `GameVegetation` (3 vezes) e `GameInteractables*` (6
vezes), todas dentro do `Casa3DSDK`/adaptador. `GameTestRoom` (571 KB), `GameWeapons`, `GameDestruction*` e `GameFluids*` entram no arquivo mas **têm 0
referências**: o jogo tem armas, explosões, fluidos e efeitos próprios (`ARMAS`, `Efeitos`, `Explosões`).

### 1.11 `jogo__bancada-de-hordas.js` (53.741 linhas) — desempenho com milhares de zumbis

three r160 embutido (6-53050). Código próprio **53053-53741**:

- `Horde` 53088-53298: struct-of-arrays com tipos (`cap` até 6000), `block` 53116 (obstáculo retangular), `spawn` 53127, `kill` 53145 (troca com o último),
  **flow field 8 vizinhos fatiado em quadros com orçamento de tempo** (`startFlow` 53153, `stepFlow` 53161, buffer de trás e troca), `buildHash` 53203
  (grade só para R0), `update` 53215 (**faixas `BANDS` 53066: R0 35 m 20 Hz, R1 120 m 5 Hz, R2 400 m 1 Hz, R3 0,2 Hz; histerese `HYST` 10 m**; separação raio
  0,62 m; **6 vagas de ataque** por jogador), `shoot` 53279 (penetração em pontos; Brutamonte custa 2 corpos).
- `CATS` 53075: 13 tipos [nome, peso de spawn, velocidade, cor dos olhos]. `rng` 53083 (mulberry32).
- Cena de medição: renderer 53307, mapa de 256 m 53328, **zumbi de corpo arredondado com animação na GPU** (`buildZombie` 53395, `LODS` 53412:
  2.500, 800 e 250 triângulos), `patch` 53446 (shader), mapa vivo 53483 (chuva 16.000, 40 pássaros, 20 sobreviventes, horda migrando a cada 45 s,
  ciclo de dia), jogador e câmera 53510, população 53539, **medição** 53570 (30 s: FPS, 1% low, ms de simulação, ms de GPU, draw calls, triângulos;
  "Copiar resultado"), UI 53726. Metas: 2.000 zumbis >= 30 FPS, 500 >= 60 FPS.

### 1.12 `jogo__antes-do-dia-1.js` (142 linhas) — surto gradual

Documento de design (D-6 a D0; 6 fases; 4 a 37 mil zumbis; "3 SDKs: Contágio, Multidão civil e Boletim") com protótipo: `PH` (6 fases), `REG` (14
regiões), `LK` (ligações), `simulate(opt)` 15-72 (incubação 48 h, eventos: lab, penitenciária, êxodo para a base, hospital, penitenciária), gráfico em
canvas, cartão por região (`stage`: calmo, casos, pânico, caído, tomado), escolhas (beta, aviso, ala B).

### 1.13 `jogo__cenarios-de-teste.js` (74 linhas) — Cenários de teste

Painel de revisão com veredito (pendente, aprovado, ajustar, reprovado), nota, filtros, exportar/importar JSON (`localStorage`
`zombiada-cenarios-vereditos`), fotos "prévia" e "jogo" embutidas (825 KB na linha 63). 12 cenários (todos `pendente`): S01 a S07 Casa 3 (sala dia/noite,
cozinha, quarto, gaveta do criado-mudo, janela dia/noite), S08 tiro na parede, S09 e S11 zumbi (braços baixados vagando, sobem ao perseguir,
não atravessam parede), S10 câmera encostada na parede, S12 tiro na janela. Critérios automáticos: câmera dentro do cômodo e abaixo do teto,
paredes com textura, janelas de verdade, luz dentro de casa, móveis com forma, **até 400 draw calls**, igual ou melhor que a prévia. Ferramenta de
revisão, não motor.

### 1.14 `jogo__sdks-e-revisoes.js` (76 linhas) e `jogo__revisao-final-fatia-jogavel.js` (3 linhas)

Índice de documentação (busca e ampliação de imagens) que cita: SDK Câmera, SDK Modo livre, PlantasSDK, "Como o jogo se pluga" e a revisão final
(orçamento de 16,6 ms por quadro, 30 Hz de rede, relevância única). A revisão final (texto, 22/10) afirma que a fatia **integra** Bestiário
(13 tipos), Arsenal (Glock, 870, AK-47, 700, faca, M67, molotov), Mapa, Fluidos, Explosões, **Veículos ("Física arcade, sem suspensão")**, Personagens
e Sobreviventes; 1.500 zumbis ativos gastam 1,2 a 1,5 ms por quadro de CPU; falta medir FPS em GPU real.

---

## 2. O que o SDK tem do mesmo assunto, e quem consome o quê

| Assunto | Pacote (versão) | Tamanho | Páginas e jogo |
|---|---|---|---|
| Motor de veículos | `game-vehicles` 0.1.1 | `src/` com 37 arquivos mais `destructible/` (6), README 268 e MIGRATION 397 linhas | **Sala-veiculos** consome (bundle com `createVehicleDestructible`, mais novo que 0.1.0). **Sdk-demo-rali** consome (é o exemplo do SDK). **Garagem, Frota Leve e o jogo têm cópia própria em português** |
| Frota | `game-vehicles-fleet` 1.0.0 | 10 arquivos em `src/vehicles` (~26.700 linhas), 14 arquivos de golden (868 testes) | Sala-veiculos consome; garagem e frota leve usam a cópia antiga |
| Móveis interativos | `game-interactables` 0.1.0, `-household` 0.1.0 (**51 tipos**), `-three` 0.1.0 | motor 1.684 linhas em `world.ts`; 14 builders | Bancada: bundle atual. Área de móveis: uma versão antes. **Jogo (modo livre): bundle com 39 tipos**, sem os 12 de campo e rurais, sem `mergeColliders`/`setBurner` |
| Vegetação | `game-vegetation` 0.1.0, `-species` 0.1.0 (~90 espécies) | 15 arquétipos, `buildLot`, `scatter`, adaptador three | Viveiro: **bundle igual ao atual**. Jogo: bundle 632 linhas mais antigo (sem peças separáveis) |
| Contágio | `game-infection` 0.1.0 | 386 linhas em `infection.ts`, MIGRATION 211 | **Nenhuma página nem o jogo usa** (0 ocorrências de `Contagio` em jardim-aurora, modo-livre, bancada-de-hordas) |
| Câmera | `game-camera` 0.1.0 | 169 linhas | O jogo usa `CameraModosSDK` (cópia em português, linhas 7560-7631 do modo livre) |
| Ferramentas de teste no jogo | `game-devtools` 0.1.0 | 463 linhas | O jogo usa `ModoLivreSDK` (cópia em português, 48673-48849) |
| Sala de testes | `game-test-room` 0.1.3 | 2.085 linhas em `room.ts` | Sala-veiculos e viveiro consomem; o jogo embute e não usa |

Não existe no SDK: motor de horda, jogador, inventário, áudio sintetizado, ciclo de dia e chuva, condução, versão leve de veículo, módulo de teste de
veículos e de vegetação, exemplo de garagem.

---

## 3. Comparação item a item

Legenda de "melhor": **SDK**, **ZombiAdA**, **igual**, **ausente** (só um lado tem).

### 3.1 Veículos

| Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Motor (zonas, dano, fluidos, partículas, capotar, explodir) | garagem 16-3896; frota-leve 71-3956 | `game-vehicles/src/*` | **igual** (SDK embala melhor) | Mesmo hash de cena em construir, `explode` + 6 s e `roll` + 5 s; mesmo dano por zona. SDK ganha fábrica sem singleton, tipos, textos em `locales`, contrato `DestructibleImpl` | manter SDK |
| Frota de 69 veículos em qualidade alta | garagem 4208-14185; frota-leve 4167-14170 | `game-vehicles-fleet/src/vehicles/*.ts` | **igual** | 66 veículos batem com o golden e com a página; os 3 que falham têm golden velho (seção 4) | manter SDK; regenerar 3 entradas do golden |
| **Modo "jogo": LOD + fusão em 6 malhas** | frota-leve 21-64, 14155, 14208-14310 e os `[LOD]` do núcleo e das famílias | nada | **ZombiAdA** | 19 mil tri e 6 draw calls contra 194 mil e 356 por carro. O SDK só entrega a versão alta; num jogo com carros de rua e casas isso não roda | **portar**: `kit.lod` no núcleo (11 linhas) e nos packs (as ~35 linhas `[LOD]` viram `if (kit.lod.on)`), mais um construtor "leve" (`buildLite(key, { seed, color })`) no `game-vehicles` ou num `game-vehicles-lite` |
| API de peças danificáveis (caixas tipadas) | frota-leve 14406-14440; consumida em modo-livre 51729 | `createVehicleDestructible` (partes com material, juntas, forma) | **SDK** (mais rica) | `danificaveis` é um subconjunto: caixa + tipo (metal, vidro, borracha, combustível). O SDK dá parte, material, junta e HP | mesclar: ponte `damageablesOf(vehicle)` para o formato simples que o `Casa3DSDK` espera, ou trocar o consumidor |
| Cor por semente (`PALETA`, `PALETA_MIL`, `corDaSemente`) | frota-leve 14172-14192 | nada (a cor vem de `col` fixo no builder) | **ZombiAdA** | determinismo por semente com pesos de mercado | portar para o pack da frota como `paintPalette` por grupo (militar usa a militar) |
| Dimensões (`DIMS`) | frota-leve 14171 | nada | **ZombiAdA** (como dado) | 69 triplas L x W x H medidas | portar como golden de medidas (R2 pede "medidas") |
| Saída +z frente, centrado, chão em 0 | frota-leve 14335-14395 | `buildVehicleItem` | **igual** | SDK já entrega "frente em +z" | manter SDK |
| Compatibilidade three r160 (`CanvasTexture` sRGB, `envolverTHREE`) | frota-leve 21-64 | `peerDependency three >= 0.128.0`, testado só em 0.128 | **ZombiAdA** | no SDK a build em r160 funciona (testei), mas ninguém aplica `colorSpace` nas texturas de placa e texto | mesclar: aplicar `SRGBColorSpace` quando existir e testar em r160 |
| App da Garagem (cenário, visor, folha de contato, combustíveis) | garagem 14186-14693 | `example/example.html` (Cosmic Rally, 8 KB) | **ZombiAdA** | o exemplo do SDK mostra o motor, não a frota de 69 | portar para `examples/vehicles-garage` e área do kit (R3) |
| Módulo de teste de veículos | sala-veiculos 43114-43407 (8 itens, 11 cenários) | nada (`site/catalog.mjs` cita só `car_door` da sala) | **ZombiAdA** | falta o `examples/vehicles-test-area` | portar (R3) |
| Plugin do ZombiAdA (sangue, horda, textos de zona, placa) | garagem 3998-4207 | "Left for the game" no MIGRATION do fleet: **nenhum destino** | **ZombiAdA** | ficou de fora de propósito, mas sem pacote para guardar | portar para pacote de conteúdo do jogo (dúvida 1) |
| Widgets do mapa de danos | garagem 3897-3997 | `kit.ui` (`ui.ts`) | **igual** | mesmas 9 funções | manter SDK |
| Fichas de design (6 atributos 0-10, tags, tanque) | frota 6-1806 | `mass`, `noise`, `maxSpeed` e textos no locale | **ZombiAdA** | faltam velocidade, aceleração, manobra, resistência, carga e consumo (0-10) e as tags | portar como dado de conteúdo `fleet.stats` |
| Condução (raycast por roda, atrito, superfícies) | só texto em frota 2 | nada | **ausente** | nem o jogo implementa; o jogo tem arcade | decidir (dúvida 5) |
| Carro dirigível arcade e atropelamento | jardim-aurora 58614-58715; modo-livre 74513 | nada | **ZombiAdA** | aceleração, direção, batida com dano, atropelo por velocidade, ruído de motor | portar como controlador arcade genérico (`game-vehicles` ou `game-vehicle-driving`) com ganchos de colisão e de alvo |
| Carros "assados" v3 em InstancedMesh | jardim-aurora 55473-55541 | nada | **ZombiAdA** (para a rua) | 15 modelos, 2 LODs + vidro, atributo `vrm` no shader, 1 instância por carro | substituir pelo modo leve do SDK; o gerador `veh/gen.py`, `ext.mjs`, `simp.mjs` não veio nos `sources/` (dúvida 4) |

### 3.2 Móveis

| Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Bancada de móveis interativos | bancada 3791-5696 | `examples/interactables-showroom` | **igual** | o código da página **é** o do SDK (5 linhas a menos) | manter SDK |
| Área de móveis | area-moveis 3789-3848 | `examples/interactables-test-area` | **igual** (SDK mais novo) | a página é um build antigo do exemplo | manter SDK, atualizar o build da página |
| Tipos de móvel | jogo: 39 tipos (bundle em modo-livre 35661) | household: 51 tipos | **SDK** | o jogo não tem cabana, campismo, beliche, poço, privada, fogão a lenha, lareira, cooler | atualizar o bundle do jogo |
| Planta para objeto do kit | `AdaptadorInterativos` modo-livre 34747-35660 (`MAPA_TIPOS`) | `game-floorplan` e household, sem ponte | **ZombiAdA** | só o jogo sabe que `geladeira_med` é `fridge` variante `steel` | **decidido: ponte genérica `game-floorplan-interactables`, portada em 2026-10-24** (`TYPE_MAP` e demais tabelas são registros; o jogo troca ou tira entradas) |

### 3.3 Vegetação

| Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Geração, LOD, lote, dispersão, vento, ator | viveiro 7-4637 | `game-vegetation` | **igual** | bundle da página = `dist` atual (5 linhas) | manter SDK |
| Espécies e tabela regional | viveiro 4641-7870 | `game-vegetation-species` | **igual** | idem | manter SDK |
| Regras de plantio por contexto (`rulesFor`) | viveiro 77943-77963 | `pickForContext` só sorteia o id | **ZombiAdA** | separa em árvores, cercas-vivas, médias e forração com densidade e distância mínima | portar para `game-vegetation-species` como `scatterRulesFor(region, context, seed, options)` |
| Canteiro (casa, muro, calçada, personagem que curva a planta) | viveiro 77910-78043 | nada | **ZombiAdA** | cena de demonstração do lote | portar como `examples/vegetation-nursery` |
| Módulo de teste de vegetação (18 itens, 13 cenários) | viveiro 22960-23597 | nada | **ZombiAdA** | falta o `vegetation-test-area` (R3) | portar |
| Plantas no jogo | modo-livre usa `GameVegetation` só dentro do `Casa3DSDK` | — | **SDK** | bundle do jogo está 632 linhas atrás | atualizar o bundle |

### 3.4 Jogo: câmera, ferramentas, contágio, horda, jogador, inventário, IA

| Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|
| Câmera ombro, terceira, primeira, viewmodel | modo-livre 7560-7631 | `game-camera` | **igual** | MIGRATION e leitura: mesma conta, `suavidade` nunca foi lida (nos dois) | manter SDK |
| **Câmera de ombro do jogo** | jardim-aurora `cameraUpdate` 57480-57530 | `shoulder` do `game-camera` | **ZombiAdA** | amortece distância, ombro e altura (`1 - exp(-12 dt)`: mirar, trocar de ombro e agachar sem salto), FOV por zoom da arma (`65 / zoom`), sensibilidade por zoom, órbita de morte, tremor de febre e de pânico. O SDK não amortece (o `smoothing` é parâmetro morto) | **mesclar** em `game-camera`: implementar `smoothing`, `fov` por zoom, `deathOrbit`, `sway` |
| Modo livre | modo-livre 48673-48849 | `game-devtools` | **igual** | porta fiel | manter SDK |
| **Medidor de desempenho** (FPS, 1% low, GPU timer, draw calls, triângulos, "Medir 30 s", "Copiar resultado") | jardim-aurora 57406-57426, 57450-57460; bancada 53570-53725 | nada | **ZombiAdA** | já existe duas vezes no jogo | portar: `createPerfMeter` em `game-devtools` |
| Contágio abstrato | antes-do-dia-1 15-72 | `game-infection` | **igual** | resultado idêntico em 9 datas | manter SDK |
| Tela do surto (gráfico, cartões por região, escolhas) | antes-do-dia-1 74-141 | nada | **ZombiAdA** | só a visualização | portar como `examples/infection-outbreak` |
| "Multidão civil" e "Boletim" (as outras 2 SDKs do documento) | só no texto | nada | **ausente** | prometidas, sem código | decidir (dúvida 6) |
| Infecção do jogador (febre, delírio, morte, reanimação, ferida por tipo) | jardim-aurora `INFEC` 53126, `FERIDA` 53127, `player.hurt` 56880 | nada (`game-infection` é por região) | **ZombiAdA** | `game-infection` não modela o indivíduo | portar para o pacote de personagens ou sobrevivência; ponte com `infect/remove/materialize` <br>✅ **T8.3**: `game-player` (`infection`, desligada por padrão; números de `INFEC`/`FERIDA` em `defaults.json`), golden `game-player.json` |
| **Horda** (SoA, relevância R0-R3, flow field fatiado, grade espacial, vagas de ataque) | bancada 53088-53298; jogo 55542-55997 | nada | **ZombiAdA** | é outro nível de abstração que `game-infection`; a bancada é o protótipo e o jogo a versão completa | **pacote novo `game-crowd`** (decisão T8.2, dúvida 2) <br>✅ **T8.1a**: `packages/game-crowd` (porte literal de G 66714-67430 e das portas G 63796-64050: SoA, faixas, flow fatiado, grade espacial, 6 vagas, alerta em cadeia, portas, pilha, corpos, rastro, população e migração), golden `game-crowd.json` (8 cenas, quadro a quadro) <br>✅ **T8.1c**: o desenho (`hordeRender` G 67098-67136: corte pela vista, LOD 18/55 m com histerese, pose de ataque, pose por estado, corpos no chão) em `packages/game-crowd-three`, golden `game-crowd-render.json` (11 cenas, instância por instância), área `crowd_area` em `examples/crowd-test-area` |
| IA dos 13 tipos (percepção, ruído, grito em cadeia, habilidades, pirâmide, piscina, rastro) | jardim-aurora 55663-56219 | nada | **ZombiAdA** | o motor é genérico, os tipos são conteúdo | motor em `game-crowd`; os 13 tipos em pacote de conteúdo (junto do Bestiário, Fase 4) <br>✅ **T8.1a**: habilidades como traços em `game-crowd` (`zAbility`, `zChaseSpeed`, `zFrame`, pirâmide, piscina, rastro); os 13 tipos com os números da horda em `undeadCrowdPack()` (`game-characters-undead/src/data/crowd.json`) |
| Dano por região, desmembramento, capacete, colete, penetração | jardim-aurora 55829-55864, 57137-57200 | `Hit` de `game-contracts`, `game-weapons` | **ZombiAdA** | planejado em `game-characters` (T4.1) | portar para `game-characters` |
| Jogador (ficha, fôlego, ferimentos, agarrão, pânico) | jardim-aurora 56865-57060 | nada | **ZombiAdA** | motor de "sobrevivente" genérico com conteúdo no jogo | portar (pacote novo ou `game-characters`), dúvida 7 <br>✅ **T8.3**: `packages/game-player` (porte literal de G 68427-68640: `player`, `playerUpdate`, `frontZombies`, `shove`, `knife`; 18 roteiros do golden batem quadro a quadro), `examples/player-test-area` |
| Inventário, necessidades, saque, barricada, lanterna | jardim-aurora 57199-57397 | nada | **ZombiAdA** | planejado em `game-items` (T3.1) | portar para `game-items` |
| Áudio sintetizado (`sfx`, `loopSet`, `grito`, `voz`) | jardim-aurora 53189-53268 | só `game-weapons-three/src/audio.ts` | **ZombiAdA** | usa `Math.random`; sem pacote | portar para `game-audio` (ou ampliar o de armas) |
| Ciclo de dia, chuva, luz de sódio, neblina de zona | jardim-aurora 57536-57589 | nada | **ZombiAdA** | motor genérico (sol por degraus de 10 min, luar, poças) | portar para `game-environment` |
| Efeitos e explosões | jardim-aurora 56220-56864 | nada | **ZombiAdA** | Fase 6 (`game-vfx`) | já planejado |
| Armas do jogo | jardim-aurora 53098-53125, `gunMeshes` 56926 (caixas) | `game-weapons` (+ `-three`) | **SDK** | o jogo usa 4 armas e caixas de placeholder; o SDK tem calibres, recarga, pane | jogo passa a consumir o SDK (CLAUDE.md proíbe placeholder) |
| Bundles do SDK no jogo | modo-livre 11-44399 | `dist/` | **SDK** | `GameTestRoom`, `GameWeapons`, `GameDestruction*`, `GameFluids*` entram sem uso (1,4 MB) | tirar do build do jogo ou passar a usar |
| Cenários de teste | cenarios-de-teste | `game-test-room` `scenarios`, `game-devtools` `scenarios` | **SDK** para o motor | a página é fluxo de revisão com fotos, não motor | não migra; os critérios S01-S12 viram checagens do `devtools` quando as casas migrarem |

---

## 4. Os goldens de `game-vehicles-fleet` que falham

**Hoje são 12 testes do vitest, que correspondem a 10 entradas do golden em 3 veículos** (as 10 de que fala o `tasks.md`; os 2 testes a mais são as versões em inglês de `seda`), nos arquivos `golden-cars-1`, `-2` e `-4`:

- `midsize_sedan` (`seda`, Corola): **10** (intacto, danificado, modificado, os 5 cenários e os 2 testes em inglês);
- `entry_hatch` (`popular`, Kwyd): **1** (cenário `rollover`);
- `fastback_sedan` (`civico`, Cívico): **1** (cenário `rollover`).

**Causa provável: o `golden.json` ficou velho; o SDK está igual à página atual.** Evidências:

1. Os outros 66 veículos batem nos três estados e nos cinco cenários com o digest do golden **e** com o código da garagem executado hoje (552 conferências, 10 diferenças, todas listadas acima).
2. `seda` intacto: a garagem hoje gera `451b16b4` e o SDK gera `451b16b4`; o golden diz `15759434`. Mesmos 374 objetos, **outro conteúdo geométrico**.
   Nos cenários de `seda` (lateral, abandonado, queimado) e no `rollover` de `civico` o SDK também produz o mesmo hash que a página.
3. O golden foi commitado às 03:37 de 2026-10-23 (`44ccd12`, gerado do código original `zombiada/frota/*.js` de então, antes dos commits do `destructible`); o SDK do núcleo não mudou
   desde então no que desenha (só `particles.ts`, `destructible/`, `index.ts` e locales). Logo, o que mudou foi o **original**: `seda`, `popular` e
   `civico` são carros do grupo A e G que o time revisou depois (o texto da frota é de 22/10).
4. Tem que ser dado do original e não regressão do SDK porque o SDK reproduz o original em construção, explosão e capotagem (seção 0).

Não consegui apontar o parâmetro exato que mudou em `seda` (testei tirar `chromeBelt`, `blackPillars`, os dois `crease` e `handles`; nenhum devolve
`15759434`, e todos mudam a contagem de objetos, que no golden é igual).

**Correção sugerida**: regenerar só essas dez entradas do golden rodando a garagem com `frontBlood` e `horde` desligados (é assim que reproduzi os outros 542 hashes,
então o método de geração está validado) e tratar a página como referência. Antes de regenerar, **o dono precisa confirmar** que a versão atual de `seda`, `popular` e `civico` é a aprovada
(dúvida 8). Se a versão do golden era a boa, o erro está no que o time mudou na página e o SDK é que está "novo demais".

---

## 5. Destino por módulo do que ficou de fora

| Módulo (novo ou existente) | O que entra | Origem (linhas) | Fase |
|---|---|---|---|
| `game-vehicles` (núcleo) | `kit.lod` e os 11 ganchos `[LOD]`; `colorSpace` em texturas de texto; construtor leve (fusão por classe de material, poda, `skipJogo`) | frota-leve 21-64, 14155, 14208-14310 | nova, antes da Fase 2 (casas usam) |
| `game-vehicles-fleet` | ganchos `[LOD]` das 10 famílias; `paintPalette`; `DIMS` como golden de medidas; `fleet.stats` (6 atributos 0-10 e tags); regenerar 3 goldens | frota-leve 4167-14192; frota 6-1806 | idem |
| `game-vehicles` ou `game-vehicle-driving` (novo) | controlador arcade, atropelamento por velocidade, ruído de motor, batida com dano | jardim-aurora 58614-58715 | nova |
| `examples/vehicles-test-area` e `examples/vehicles-garage` | módulo `MODULO_VEICULOS` (8 itens, 11 cenários); garagem (cenário, visor, folha de contato) | sala-veiculos 43114-43407; garagem 14186-14693 | R3 |
| pacote de conteúdo do jogo (veículos ZombiAdA) | sangue, `frontBlood`, `horde`, cenário "Atacado pela horda", 14 textos de zona, placa `ZMB4D23`, 16 descrições de história | garagem 3998-4207 | dúvida 1 |
| `game-vegetation-species` | `scatterRulesFor` | viveiro 77943-77963 | nova |
| `examples/vegetation-test-area` | `VegetationTestModule` (18 itens, 13 cenários) | viveiro 22960-23597 | R3 |
| `examples/vegetation-nursery` | canteiro e vitrine | viveiro 77910-78093 | R3 |
| `game-camera` | amortecimento, FOV por zoom, órbita de morte, tremor | jardim-aurora 57480-57530 | nova |
| `game-devtools` | `createPerfMeter` (FPS, 1% low, GPU timer, draw calls, triângulos, copiar) | jardim-aurora 57406-57426; bancada 53570-53725 | nova |
| **`game-crowd` (novo)** | `Horde`: SoA, faixas de relevância, flow field fatiado, grade espacial, vagas de ataque, percepção e ruído, penetração; `-three` com corpo animado na GPU e 3 LODs | bancada 53088-53298, 53375-53480; jogo 55542-55997 | T8.2 |
| pacote de conteúdo dos 13 tipos | `CATS`, habilidades, pirâmide, piscina, rastro | jardim-aurora 55998-56219 | com a Fase 4 |
| `game-characters` | dano por região, desmembramento, infecção do jogador, ferimentos, fôlego | 55829-55864, 56865-57060 | Fase 4 |
| `game-items` | inventário, necessidades, saque, barricada, lanterna | 57199-57397 | Fase 3 |
| `game-audio` (novo, ou dentro de `game-weapons-three`) | `sfx`, `loopSet`, `grito`, `voz` | 53189-53268 | nova |
| `game-environment` (novo) | ciclo de dia, chuva, luz de sódio, neblina | 57536-57589 | nova |
| `game-infection` | só exemplo `examples/infection-outbreak` (tela do surto) | antes-do-dia-1 74-141 | R3 |
| fora de escopo ou do jogo | `AdaptadorInterativos` (ou ponte), `ModoLivre` adaptador, objetivo da fatia, HUD, rádio e diário, cenários de teste (painel de revisão) | vários | dúvidas 3 e 9 |

---

## 6. Dúvidas para o dono

1. **Onde mora o conteúdo específico do ZombiAdA** (sangue de zumbi, marca "horda", textos de zona que citam a horda, placa `ZMB4D23`, descrições
   de história)? O fleet deixou de fora "para o jogo", mas não há repositório de conteúdo do jogo no SDK. Pacote `zombiada-*` à parte, ou dentro do
   jogo?
2. **Horda: pacote próprio (`game-crowd`) ou dentro de `game-infection`?** Recomendo pacote próprio: `game-infection` é epidemia por região
   (horas, compartimentos); a horda é por agente (metros, segundos). A ponte já existe no contágio: `materialize(region, n)` entrega os infectados
   como sementes e `giveBack` os devolve.
3. **Ponte planta para household** (`AdaptadorInterativos`): vira `game-floorplan-interactables` genérico ou continua código do jogo, como o cabeçalho diz? **Respondida (2026-10-24): virou `packages/game-floorplan-interactables`, genérico e configurável (evidence.md, seção "AdaptadorInterativos").**
4. **Os fontes do gerador dos carros "assados"** (`veh/gen.py`, `veh/ext.mjs`, `veh/simp.mjs`) existem? O jogo ainda usa os 15 modelos da Garagem v3, e eles
   estão defasados em relação à v5. Se não existirem, o modo leve do SDK os substitui.
5. **Condução**: o documento da frota pede semi-simulação com suspensão por raycast, e o jogo entrega arcade sem suspensão. O que entra no SDK, as duas
   ou só a arcade?
6. **"Multidão civil" e "Boletim"** (as outras duas SDKs do "Antes do Dia 1") entram nesta migração ou ficam para depois? Não há código.
7. **Jogador e sobrevivência**: pacote próprio (`game-player`/`game-survival`) ou dentro de `game-characters`? Define onde vão fôlego, ferida, infecção
   individual e agarrão.
8. **Qual versão de `seda`, `popular` e `civico` é a boa**: a da página de hoje (igual ao SDK) ou a que gerou o golden? Isso decide se regeneramos o
   golden ou se o time desfaz a mudança.
9. O jogo carrega `GameTestRoom`, `GameWeapons`, `GameDestruction*` e `GameFluids*` sem usar. Isso é intencional (preparação para trocar `ARMAS` e os efeitos)
   ou resto de build que pode sair?
10. **Qual das duas versões do jogo vale como referência** de integração: `zombiada-jardim-aurora` (53054-58955) ou `zombiada-modo-livre` (66287-75272)? O
    modo livre é mais novo e inclui andares, bichos, Jardim das Palmeiras e o adaptador de câmera; o jardim-aurora é a fatia v7 descrita na revisão final.


## Status ao fim da Fase 7 (T7.5)

Atualizado em 2026-10-24. O que deste inventário (veículos, vegetação e câmera do jogo) já entrou, e onde. A parte do jogo que sobra
(horda, contágio, jogador, ciclo de dia, áudio) é das Fases 5, 6 e 8.

| Item | Entrou? | Onde |
|---|---|---|
| Garagem v4/v5 (69 veículos, dano por zona) × SDK | **Já era igual** (207 comparações, 0 diferenças; as 10 que diferem no golden antigo são do próprio golden) | `comparacoes/veiculos/` (`tools/vehicles-catalog compare`), `game-vehicles-fleet` sem mudança de dado |
| Modo leve (`LOD`, 13 ganchos `[LOD]`, `skipJogo`) | Sim | `game-vehicles` (`kit.lod`, `build(..., { lod })`), cópias da frota em `game-vehicles-fleet` |
| Fusão em 6 malhas, poda de 3 cm, quadro de saída (+z), cor por semente | Sim | `game-vehicles-three` (`createVehiclesThree`, `quality: 'lite'`) |
| `DIMS` dos 69, `PALETA` e `PALETA_MIL`, `corDaSemente`, cartões de projeto da Frota | Sim (dado gerado por `tools/vehicles-catalog`, com `--check`) | `game-vehicles-fleet` (`fleetDims`, `paintPalettes`, `colorFromSeed`, `fleetStats`) |
| `coletarDanificaveis` | Sim | `game-vehicles` (`kit.damageables`) |
| Condução arcade do jogo (`CAR`, `carUpdate`), atropelamento, barulho | Sim | `game-vehicles-driving` (`createArcadeDriver`, `runOver`) |
| Semissimulação do documento da Frota | Sim, sem código do time: os números do documento são os testes | `game-vehicles-driving` (`createSemiSimDriver`, registro de superfícies) |
| Plugin do jogo (sangue de zumbi, marca horda, placa `ZMB4D23`, `SCENARIOS` de horda) | Fatia do jogo, não entra no SDK | `game-slice/vehicles/` |
| Módulo de teste de veículos (8 itens, 11 cenários da página + 2; mais os 2 carros queimados abaixo e 1 cenário) | Sim | `packages/game-vehicles-three/src/test-area/`, `examples/vehicles-test-area/` (`?area=vehicles`) |
| Carro queimado do fundo do Elenco (`site/pages/zumbis-personagens/elenco.html`, antes duas caixas feitas à mão) | Sim: vem do kit. Cenário `burnt` da frota + `kit.build(key, 'intact', { scenario: 'burnt' })` (uma chamada, sem montar um veículo de sondagem); `buildVehicleItem(kit, key, { scenario: 'burnt' })` para o item da sala. A área de veículos da sala de testes tem `sedan_burnt` (`midsize_sedan`) e `hatch_burnt` (`compact_hatch`), opção `wrecks`, e o cenário `vehicles_burnt_wreck` (marca de queimado e vidros em 0) | `packages/game-vehicles` (`build` com `scenario`), `packages/game-vehicles-fleet` (`burnt`), `packages/game-vehicles-three/src/test-area/` |
| Aplicativo da Garagem (palco, folha de contatos, `hitAt`) | **Não** como aplicativo: o visor é a `vehicles-test-area`; a folha de contatos com cache em `localStorage` ficou sem destino (dúvida 3 abaixo) | - |
| Viveiro (artefato, V8): geometria das peças de madeira | Sim | `game-vegetation` (`radius`, `length`, `axis`, `base` em `PlantPiece`, `LotPiece` e `userData.destructionPart`) |
| `rulesFor` e `AREAS` do Viveiro | Sim | `game-vegetation-species` (`scatterRulesFor`), `game-vegetation-three` (`AREAS`, `scatterLot`) |
| Módulo do Viveiro (18 plantas, 13 cenários `veg_*`), canteiro de 12 x 20 m com o caminhante | Sim | `packages/game-vegetation-three/src/test-area/`, `examples/vegetation-test-area/` (`?area=vegetation`) |
| Câmera de ombro do jogo (`cameraUpdate`): amortecimento, FOV por zoom, sensibilidade, órbita da morte, balanço da febre e do pânico | Sim | `game-camera` (`smoothing` lido, `aim`, `wallRecovery`, `deathOrbit`, `look`, `shake`, `rig.look`) |
| Os três módulos na `interactables-test-area` | Sim (22 de 22 no Chromium) | `examples/interactables-test-area/` |
| Coreografia do carro explodindo, fumaça do motor por condição, faísca de raspagem, para-brisa em 4 estágios | **Não**: os módulos pedem os efeitos por id a `host.effects`; as receitas são do `game-vfx` (Fase 5) | ver `evidence.md`, Fase 7, "Dependência do vfx" |
| Horda, contágio, jogador, ciclo de dia, áudio | Fases 5, 6 e 8 | - |
