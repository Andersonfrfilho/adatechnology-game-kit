# Inventário — Mapa, casas e construção (Casa3DSDK, Galeria do Vale Cinzento, plantas, lotes e ruas)

Levantado em 2026-10-23 a partir de `specs/001-migracao-entregas-dos-times/sources/` (código das páginas, sem three.js) e dos pacotes de
`packages/*`. Nada foi alterado fora deste arquivo. Linhas citadas são do arquivo de `sources/` indicado (o arquivo começa com 3 a 6 linhas
de cabeçalho extraído da página). Onde não foi possível confirmar algo, está escrito "não verificado".

Abreviações dos arquivos de `sources/`:

| Sigla | Arquivo |
|---|---|
| VC3 | `jogo__visor-casas-3d.js` (43.239 linhas, 3,6 MB) |
| VP | `jogo__visor-plantas.js` (2.595 linhas) |
| AC | `sala-de-testes__area-casas.js` (3.882 linhas) |
| RC | `jogo__revisao-casa-a.js` |
| GAL | `mapa__galeria-vale-cinzento.js` (2.512 linhas) |
| MAPA | `mapa__mapa-vale-cinzento.js` (documento de design, sem código) |
| CHK | `jogo__checklist-mapa.js` |
| ML | `jogo__zombiada-modo-livre.js` (75.272 linhas) |
| JA | `jogo__zombiada-jardim-aurora.js` (58.956 linhas) |
| SR | `jogo__sdks-e-revisoes.js` (documentação offline; só texto extraído, truncado) |

---

## 0. Achado que muda o escopo: "Casa3DSDK" são três SDKs, e dois deles já têm irmão no kit

O spec 001 trata o Casa3DSDK como "um SDK de casas (pilares, vigas, lajes...) que não está no game-kit". Lendo o código, a divisão real é outra:

| SDK do time | Papel | Onde está em VC3 | Irmão no game-kit |
|---|---|---|---|
| **PlantasSDK** v3.0 | dados: plantas de casas e lotes com semente (cômodos, paredes, portas, janelas, móveis em slots, paleta, estados) **e, na versão estendida, a estrutura de sustentação (pilar, viga, laje, parede portante/vedação, telhado, escada, caixa d'água), a construção por material, a rede elétrica, hidráulica, gás, painéis solares, edificações do quintal e conteúdo dos móveis** | L7374–11190 | `game-floorplan` + `-residential` + `-commercial` + `-post-apocalyptic` (porte de uma versão **mais antiga** do PlantasSDK; ver 0.1) |
| **Casa3DSDK** v1.0.0 | renderizador three.js do resultado do PlantasSDK: paredes com vãos, portas e janelas, pisos, lajes, forros, escadas, elevador, telhados, lote (muro, portão, calçada), calhas, telhas com relevo, espelhos, luzes, interação, colisão, LOD, adaptador de destruição | L39443–42734 | **nenhum** (não existe `game-floorplan-three`) |
| **AdaptadorInterativos** v0.2.0 | ponte entre o PlantasSDK e o kit de interativos (`GameInteractables` + `GameInteractablesHousehold`): `MAPA_TIPOS` de tipo de planta para tipo household | L35057–36006 | **nenhum** (é "código do JOGO" segundo o próprio cabeçalho, L35051) |
| Moveis3DSDK | 57 builders de decoração/móvel/quintal/estado | L11196–~11646 (só ~450 linhas) | `game-props3d` (57 builders, **exatamente os mesmos 57 tipos**, renomeados para inglês) |
| AndaresSDK | vários andares para sobrados e mansões no jogo: grade fina de 10 cm por andar, escadas, retorno em U (só em ML) | ML L7372–7560 | **nenhum** |

O resto do arquivo de 3,6 MB é bundle de outros pacotes do SDK, que não são desta área: `GameVegetation` (L9), `GameVegetationSpecies` (L4141),
`FrotaLeve` (L11647–26075), `GameInteractables` (L26076), `GameInteractablesHousehold` (L27841), `GameInteractablesThree` (L33332),
`GameContracts` (L36007), `GameDestruction` (L36278–39441). O script do visor em si é L42735–43239.

### 0.1 O game-floorplan é um porte de uma versão anterior do PlantasSDK

- O `MIGRATION.md` do floorplan diz que veio de `sdk/plantas/plantas.js` ("about v3") e que 0 diferenças foram medidas contra o gerador antigo.
- VP (L10–2168) tem o PlantasSDK **sem** estrutura/instalações: 2.158 linhas. O PlantasSDK de VC3 (L7374–11190) tem 3.816 linhas. As funções que existem
  só em VC3 (sem contar as 86 regiões de diff nas funções compartilhadas): `montarEstrutura`, `montarEstruturaLona`, `estruturaExtras`, `criaEstrutura`,
  `construcaoPadrao`, `montarEdificacoes`, `caminhosEdificacoes`, `sorteiaConteudo`, `aplicaConteudo`, `montarGas`, `montarEletrica`, `montarSolar`,
  `montarHidraulica`, `montarCaixaDagua`, `candidatosCarro`, `corposParedes`, mais os 5 templates rurais (`AM_`, `CH_`, `CB_`, `BC_`, `CP_`).
- O SDK **já é o porte do que o time tinha antes**. O que o time fez depois (rodadas R01–R72 da "Revisão da Casa A") não está no SDK. Isso é o centro do porte.
- Os dois tratam `normal`/`protegida`/`abandonada` com a mesma distribuição (35/45/20) e o mesmo `ESP` de 0,15 m.

---

## 1. Entregas, por fonte

### 1.1 PlantasSDK — versão estendida (VC3 L7374–11190)

API pública (L10702–10816 e retorno em L11180): `gerar`, `slots`, `validar`, `paleta`, `registrarTemplate`, `registrarItem`, `registrarBiblioteca`,
`listarTemplates`, `limitesDe`, `templates`, `catalogo`, `biblioteca`, `estilos`, `mulberry32`, `criaRng`, `sobrepoe`, `zonaJanela`, `zonasAbertura`,
`cor{lstar,hex,hsl,...}`, `estados`, `constantes{ESP, ZONA_PORTA}`. Convenção: `u` ao longo da fachada, `v` da rua para os fundos; retângulos `[u0,v0,u1,v1]`.

**Templates registrados** (18 registros; `mansao` aparece duas vezes e a primeira, térrea, é inalcançável):

| Template | Linha | No SDK? |
|---|---|---|
| `casaA` (térrea, popular) | 7948 | sim (`single_storey_a`) |
| `sobrado` | 7975 | sim (`townhouse`) |
| `mercado`, `farmacia` | 8034, 8060 | sim (`market`, `pharmacy`) |
| `apartamento` (1 unidade por andar) | 8086 | sim (`apartment_basic`) |
| `popular_laje`, `popular_geminada` | 8154, 8181 | sim (`budget_slab_house`, `budget_semi_detached`); a laje ganhou 1 a 3 andares na T2.2g (`floors`, `randomFloors`; o time só tem o térreo, andares de cima são padrão reversível) |
| `media_terrea_moderna`, `sobrado_medio_moderno` | 8207, 8241 | sim |
| `alto_padrao_contemporanea` | 8309 | sim (`high_end_contemporary`) |
| `mansao` (1 a 3 andares, elevador opcional) | 8408 | sim (`mansion`) |
| `apartamento_novo` (médio/alto, prédio 3–20 andares) | 8503 | sim (`apartment_modern`) |
| **`casa_madeira_americana`** (wood frame, 1–2 andares; w 11–16,5, d 12,4–15,5; padrão 12,6×13; telhado asfáltico 28°) | 8794 | **sim** (`wood_frame_house`, `game-floorplan-rural`, T2.2f) |
| **`chale_madeira`** (A-frame 52°, pé-direito duplo com lareira e mezanino; w 7,5–9,5, d 10–12) | 8862 | **sim** (`a_frame_chalet`, T2.2f) |
| **`cabana_tronco`** (troncos, 1–2 cômodos, fogão a lenha, alpendre, caixa d'água em cavalete; w 5,2–7,6, d 5,6–8,8) | 8948 | **sim** (`log_cabin`, T2.2f) |
| **`barraco`** (sucata, zinco 12° preso com "pregos e pedras", gato de luz; w 3,6–5,2, d 4,4–6,6) | 9027 | **sim** (`shack`, T2.2f; `power: 'tap'` do gato na T2.2g) |
| **`barraca_camping`** (1 a 4 barracas iglu/túnel, fogueira, fogareiro, coolers, varal; sistema `lona`) | 9124 | **sim** (`campsite`, T2.2f) |

Estilos: `popular`, `medio`, `alto` (= `nobre`), `comercial` e **`rural`** (cerca baixa 1,1 m, fachada de tábua/tronco, telha asfáltica ou zinco; L7922–7940 e
paleta `rural`). O estilo `rural` entrou em `game-floorplan-rural` (T2.2f), com a paleta, o perfil de decoração e as 375 plantas conferidas.

Mudanças de regra de colocação e validação que o time fez **depois** do porte do SDK (comparando VP × VC3; todas marcadas "R##" nos comentários):

| Regra nova | Onde (VC3) | Efeito | No SDK |
|---|---|---|---|
| `RAIO_JOG = 0.24`: a grade de caminho exige que um disco de 24 cm passe entre portas e cômodos depois dos móveis (era 0,12 interno / 0,15 externo) | L7378, usado em L9640, 9667 e na pós-produção | móvel não fecha mais a passagem para um corpo de verdade | **não**: `fill.ts` usa 0,12 / 0,15 (`inflation`) |
| `PORTA_FOLGA = 0.12` + `folga` por template | L7379 | porta não nasce colada em canto/junção; o template pode pedir mais | parcial: 0,12 fixo em `plan.ts:61`, sem `folga` por template |
| `JAN_FOLGA = 0.3`, janelas reposicionadas (uma centralizada, várias com vãos iguais) | L7380 | janela nunca a menos de 30 cm de canto/junção/porta | parcial: 0,3 fixo em `plan.ts:96` |
| `bloqueiaJanela(it, jan, aereoOff)` com `hjan` do catálogo e `H_AEREO = 2.15` | L9480–9482 | armário aéreo e box de vidro (`hjan 1,95`) deixam de tapar janela | **não**: `queries.ts:39` só compara `h > 1.0` e `y0 - 0.05` |
| `FOLGA_CARRO = {motorista 0.8, lado 0.6, ponta 0.6}`, `candidatosCarro` | L9704–9722 | carro na garagem deixa abrir a porta do lado do motorista | **não** |
| `partesUteis` reescrita (recuo só onde há parede de verdade, lados abertos entre partes) | L8604–8631 | cômodos em L e abertos sem faixa morta | parcial (`usableParts` em `geometry.ts:123`; conferir se é a versão antiga) |
| `SEM_JANELA`, `SEM_TOMADA`, `TOMADA_APARELHOS` (tomadas por cômodo e aparelho) | L7376 e `montarEletrica` | planta já diz onde há tomada | **não** |
| `corposParedes`, grade com raio por chamada | L9629, 9640 | colisão de móvel contra o corpo real das paredes | **não** |

**Resultado de `gerar` que o SDK não tem** (L10713–10751): `construcao`, `estrutura {pecas, apoios, niveis, elevacao}`, `telhado` (águas), `caixaDagua`,
`edificacoes`, `gas`, `eletrica`, `paineisSolares`, `hidraulica`, `abertos`, e o conteúdo dos móveis (`aplicaConteudo`).

**Construção e estrutura** (L10307–10701):

- `MATERIAIS` (27 ids de material de destruição, L10311), `DENSIDADE` (kg/m³, L10312), `ROLES = pilar, viga, laje, parede_portante, parede_vedacao, telhado, escada, caixa_dagua`
  (L10313), `JUNTAS = mortar, rebar, bolt, resting, nail, rope` (L10314), `TELHA_MAT`/`TELHA_JUNTA` por cobertura (colonial, fibrocimento, laje, asfáltica, zinco, madeira, lona, palha).
- `construcaoPadrao(plano)` (L10339): sistema `alvenaria`, parede de tijolo com reboco, estrutura de concreto, fundação sapata corrida; cada template pode trazer `tpl.construcao`
  (wood_frame, tronco, improvisado, lona).
- `JUNTA_SIS` (L10352): junta por sistema (alvenaria usa mortar/rebar/bolt; wood_frame, tronco e improvisado usam nail/bolt).
- `montarEstrutura(plano, mov, cons, ext)` (L10360–10632): fundação (radier, vazio sanitário, pilotis, porão com paredes e colunas, pilares do prédio para apartamento), barrotes a cada 0,6 m,
  deck, paredes portantes × de vedação (parede portante = externa, ou empilhada com o andar de cima, ou toda no sistema tronco), pilares, vigas, lajes por andar, telhado, escadas, caixa d'água.
  `espLaje` 0,12 m (alvenaria), 0,28 (wood frame), 0,2 (tronco); `montarEstruturaLona` (L10633) para barracas; `estruturaExtras` (L10649).
- Cada peça: `{id, role, material, aabb[u0,v0,u1,v1], y0, y1, andar, massa}` e cada apoio `{de, sobre, tipo}`.

**Instalações** (L10817–11166):

| Função | Linha | Gera |
|---|---|---|
| `montarCaixaDagua` | 9279 | local (`laje_caixa`, `sotao`, cavalete), plataforma e capacidade (popular 500 L, médio 1000, alto 2000, mansão 3000) |
| `montarEdificacoes` + `caminhosEdificacoes` | 10777, 10752 | edícula entrável (paredes com vão, porta ≥ 0,8 m, janelas, móveis internos) e caminho pedestre até o portão |
| `CONTEUDO`, `sorteiaConteudo`, `aplicaConteudo` | 10824–10878 | conteúdo de cada móvel por estado (`protegida` +2 itens e comida/água/remédio/ferramenta ×2,5; `abandonada` 0–1) |
| `montarGas` | 10879 | botijão ou gás encanado, medidor |
| `montarEletrica` | 10973 | entrada de energia (poste, ramal, medidor, ou `gato` sem medidor), quadro, circuitos por cômodo, eletrodutos, tomadas |
| `montarSolar` | 11101 | painéis no telhado (norte) ou racks na laje, inversor; ~5% popular, 25% médio, 50% alto |
| `montarHidraulica` + `VAZAO` | 11127–11166 | pontos (torneira 6 L/min, chuveiro 9, descarga 6, tanque 8, máquina 12) e trechos (saída da caixa, sob a pia, na parede) |
| `validar` | 11167 | lista de erros em português (sobreposição, porta/portão bloqueado, item obrigatório ausente) |

### 1.2 Casa3DSDK (VC3 L39443–42734)

`Casa3DSDK.criar(THREE, cfg)` → `{ versao, construir, novoEstado, tipos, mv, aplicaParte, materiais, mascaraLuz, iluminacao, definirNoite, carros{modelo,grupo,info}, descartar }`
e estáticos `{ criar, versao, EXT_TIPOS, rectsDe, aberto, planejaLOD, specDe, cargasProjeto, ROLE_DES }` (L42730).

`cfg`: `Moveis3DSDK` (obrigatório), `frota` (FrotaLeve), `Reflector`, `qualidade` `'alta'|'jogo'`, `vegetacao{GameVegetation, GameVegetationSpecies}`, `interativos{GameInteractables,
GameInteractablesHousehold, GameInteractablesThree, AdaptadorInterativos, itens, camera, onAssento}`, `destruicao` (um `createDestruction`), `hp` (vidro 20, madeira 60, água 80, metal 200,
alvenaria 500, borracha 40, combustível 60, gás 40), `lod`, `orcamentoDrawCalls`, `texturas`, ganchos `onDano`, `onInteragir`, `onMudou`, `onColisor`, `onMensagem`, `onEstrago`.

`construir(res, opts)` (L42470) aceita `corte`, `noite`, `terreno:false`, `semPerimetro`, `qualidade`, `estado`, `predio{andares, andar, unidade, mostrar}`, `pecas:'malhas'`, `orcamentoDrawCalls`.
Devolve a casa: `grupo`, `casa`, `andares[]`, `forros[]`, `telhado`, `lote`, `chao`, `predio`, `caixaDagua`, `colisores`, `partes` (porta, janela, espelho, caixa d'água, botijão, carro, portão),
`carros`, `interagiveis`, `portas`, `escadas`, `rotulos`, `luzes`, `limites`, `interativos`, `estado`, `stats` (drawCalls, triângulos, LOD1, estouro), `vegetacao`, `solar`, `agua`, `eletrica`,
`calhas`, e os métodos `atualiza(dt, tempo, foco)`, `mostra({andar, corte, lote})`, `alvo`, `interage`, `mensagem`, `alternaPorta`, `luzLigada`, `alternaLuz`, `colide(x,z,andar)`,
`comodoEm`, `y0`, `escolheEspelho`, `definirLOD`, `centro`, `distancia`, `dano`, `danoColisor`, `estrutura`, `destruicao`, `parteDe`, `parteEm`, `descartar`.

Seções, capacidades e linhas:

| Seção | Linhas | O que faz |
|---|---|---|
| Geometria | 39466–39719 | acumuladores por grupo e material (uma malha por par), caixa/cilindro/tira, `faixas` de vértice por peça (base da destruição em malha fundida) |
| Móveis | 39720–39984 | `mkApi` (adaptador de primitivas), `MOV` com ~45 builders, `tabelaTipos` com 121 ids de tipo da planta ligados a builders (ver 1.4) |
| Fixtures | 39985–40398 | luminárias, hidráulica (chuveiro, torneiras, tanque de lavar), espelho, cortina, interruptor, caixa de correio, caixa d'água, plantas, varal com roupa que balança |
| Casa | 40399–40617 | `paredes()` (vãos, cor e material por lado, verga), `portas()` (folha na dobradiça, batente 5 cm, alturas 2,1 m / 2,3 m aço, garagem seccionada), `janelas()`, `pisosELajes()`, `escadas()`, `elevador()` |
| Água (R69) | 40618–40664 | nível da caixa em tempo de execução (`casa.agua`), `vazar`, canos visíveis |
| Elétrica (R50) | 40665–40726 | poste, ramal, medidor, quadro, eletrodutos aparentes (tomadas/interruptores são dos móveis) |
| Rodapé e calçada (R46) | 40727–40750 | rodapé externo e calçada de proteção fechando cantos convexos/côncavos |
| Solar (R57) | 40751–40797 | painéis na água do telhado ou em racks, inversor, eletroduto |
| Edificações (R43) | 40798–40874 | edícula entra como cômodo na planta que o resto desenha |
| Vegetação (R39) | 40875–40909 | `game-vegetation`: uma malha fundida por grupo, vento |
| Luzes extras | 40963–41000 | abajur, luminária de piso, arandelas, lâmpada externa |
| Lote | 41002–41164 | `terreno`, `perimetro` (muro/grade/arame, topos, R63 trechos livres), `caminhos`, `portoes` (pilares com capa, folha, basculante e de correr com motor, trilho, cremalheira), `telhados` (rects máximos, 4 águas, rincões) |
| Calhas | 41165–41253 | calhas e condutores por semente (~60% nobre/alto/médio, ~30% popular/comercial) |
| Telhas (R56) | 41254–41325 | relevo: colonial = fileiras curvas, fibrocimento = ondas |
| Espelhos | 41326–41390 | `Reflector` real só no mais próximo e só com a câmera no cômodo; demais em cubo de ambiente |
| Carros | 41391–41498 | modelo do FrotaLeve por estilo e semente, fundido por material |
| Prédio | 41499–41533 | `apartamento_novo`: andares empilhados, hall, escada, elevador, unidade em destaque |
| Interação | 41534–41883 | voo livre, colisão com pegadas orientadas (0,3 a 0,9 m), maçanetas, interruptores, cortinas, portões, armários; `alternaPorta` (41807), `alvoDe` (41843), `colideDe` (41871) |
| Interativos | 41884–42174 | `ivConstroi`: troca móveis estáticos por objetos do kit `game-interactables` |
| Animações | 42175–42220 | roupa no varal ao vento (uniform de tempo, sem alocação por quadro) |
| Iluminação | ~42216–42295 | `mascaraLuz`, `iluminacao` (orçamento de luzes reais) |
| Destruição | 42296–42466 | `montaEstrutura`, `marcaGrupos`, `criaDestruicao` (ver abaixo) |
| LOD | 42659–42680 | `planejaLOD(casas, foco, orcamento)`: distribui o orçamento de draw calls, nível 0 completo / 1 sem peças pequenas / 2 oculta |
| Estrutura → spec | 42681–42729 | `ROLE_DES`, `JUNTA_DES`, `cargasProjeto`, `specDe(estrutura, {fs, n1, fsOutros, projeto, vedacao, filtro})` |

**Destruição e dano estrutural** (L42296–42466 e 42681–42729):

- `ROLE_DES`: pilar→`column`, viga→`beam`, laje→`slab`, parede_portante→`wall`, parede_vedacao→`partition`, telhado→`roof`, escada→`stair`, caixa_dagua→`none`.
  `JUNTA_DES`: mortar, rebar, bolt, resting, nail, `rope`→`tie`, clip, hinge, glue.
- `specDe` gera um `DestructibleSpec` do `game-contracts`: cada peça vira caixa (ou cilindro, `forma:'cil'`), com `mass`, `structure.role` e **capacidade calculada da carga em repouso**:
  pilares e paredes portantes em projeto N-1 (tensão em repouso ≤ `fs` 0,65; perder qualquer outro pilar/parede portante deixa o elemento em ≤ `n1` 0,97), vigas/lajes/telhado/escadas com
  `carga / fsOutros` (0,45). Opção `vedacao:true` converte toda parede portante em vedação ("pórtico": só pilares, vigas, laje e telhado carregam). `chao` vira a fundação ancorada (caixa de concreto 0,5 m).
  Peças que não vêm da planta (janela, porta, caixa, cano, botijão, muro) entram marcadas por `userData.destructionPart/destructionMaterial/structuralRole` e juntas `glue`/`clip` com `carga:false`.
- `criaDestruicao`: registra a casa no mundo `cfg.destruicao`, ouve eventos: `damage` (sincroniza hp legado), `fracture` (esconde a peça pela faixa de vértices e solta até 10 fragmentos por evento, 90 no total, 14 s de vida),
  `collapse` (extrai a fatia de malha, cai com gravidade e rotação, e o impacto fratura a peça no núcleo: `energia = massa × 9,8 × altura`), `leak` (esvazia a caixa d'água). `dano` legado vira `ballistic`/`blunt`/`fire`/`explosive` no núcleo.
- Botões do visor: "Destruir 1 pilar", "Destruir 2 pilares", "Reconstruir", "Testar no jogo" (VC3 L43224–43238, `portico()` liga `vedacao:true`).

### 1.3 AdaptadorInterativos e builders de móvel

- `AdaptadorInterativos.criar({GameInteractables, GameInteractablesHousehold, locale, regiao})` com `planejar`, `criarMundo`, `adicionar` (L35057+). `MAPA_TIPOS` (L35078+): ~85 tipos de planta → tipo household
  (`geladeira`→`fridge`, `freezer`→`fridge_compact`, `guarda*`→`wardrobe`, `comoda`→`dresser`, `criado`→`nightstand`, `despensa`/`armario_lav`/`cristaleira`→`pantry`, `rack*`→`kitchen_cabinet_base`, `fogao*`→`stove`,
  `botijao*`→`gas_bottle`, `tv*`→`tv`, `microondas`, `maquina`→`washing_machine`, `box`→`shower`, `vaso`→`toilet`, `tanque`→`utility_sink`, `sofa*`→`sofa`, `poltrona*`→`armchair`, `cama_*`→`bed_*`, `banco*`→`bench`, `persiana`, `cortina`,
  `lixeira*`, `caixa_correio`→`mailbox`, `casinha_cachorro`→`dog_house`, `churrasqueira*`→`bbq`, `varal`→`clothesline`, lâmpadas como objeto do adaptador). `dim` diz quais medidas do móvel vão ao desenho (`wdh`, `wd`, `wh`, `padrao`).
- Builders estáticos (`MOV`, VC3 L39756+): `sofa`, `poltrona`, `armario` (portas, vidro), `gaveteiro`, `estante` (ferro, livros), `mesa` (redonda, cadeiras, toalha, cabeceira, umLado), `cama`, `guarda`, `geladeira`, `fogao`, `pia`,
  `balcao` (registro, vidro, itens), `gondola`, `banco`, `vaso`, `pia_b`, `box`, `maquina`, `cesto`, `lixeira`, `planta`, `luminaria`, `microondas`, `tapete`, `tanque`, `varal`, `churrasqueira`, `caixa_dagua`, `casinha`,
  `registradora`, `cestas`, `prat_parede`, `balanca`, `botijao`, `lixeira_ext`, `vaso_ext`, `canteiro`, `arvore`, `fonte`, `edicula`, `moto`, `cacamba`, `palete`, `caixas`, `bicicleta`, `carrinho`.
  `tabelaTipos` (L39938) liga 121 ids de tipo da planta a builders (`meu(...)` do jogo, `mv(...)`/`alias(...)` do Moveis3DSDK), e `extraTipos` (L40378) acrescenta o resto.

### 1.4 Área de testes (AC L3789–3882): `HouseArea`

Módulo que já segue `game-contracts` (`room.loadModule(HouseArea.module({locale}))`). Itens de `casa.estrutura.spec()` (dados gerados por `gerar-area.mjs`, embutidos em `DADOS`):

- itens: `casa_portico` (térreo em pórtico), `casa_inteira` (estrutura real, janelas, caixa, botijão), `casa_wood_frame`, `casa_tronco`, `barraca`. Malha de caixas e cilindros por material, nomeadas pelo id da peça.
- 6 cenários com expectativas: `house_one_pillar` (um pilar de canto: laje fica), `house_two_pillars` (dois pilares: laje e telhado caem), `house_partition` (parede de vedação cai sozinha, laje fica),
  `house_window_glass` (vidro: primeiro tiro fura, quebra em N tiros, paredes inteiras), `house_tank_leak` (caixa furada vaza: L antes e depois), `house_gas_explodes` (botijão explode e danifica as peças ao redor).
- Esses cenários são os testes goldens naturais do porte (R2 da spec).
- **Entrou (T2.6):** `packages/game-floorplan-three/src/test-area/{module,scenarios,specimens,text,types}.ts`; o golden gravado da página está em `packages/game-floorplan-three/tests/fixtures/team-golden/vc3-house-area.json`. Diferença conhecida: o pórtico do time derruba a laje com dois pilares; na sala o nosso solver pede mais pilares (pergunta 1 do evidence T2.6).

### 1.4b Destruição de parede: ARS, OFI e AC no SDK (T2.3a–b, 2026-10-24)

Estado do porte do **comportamento** (o motor segue em joules, A2; a tabela de pontos do ARS e os modelos estáticos de parede não vêm, ficam no ZombiAdA). Desenho: `design/T2.1-casas-estrutura-e-destruicao.md` §3.

| Peça do time | Fonte | Onde entrou | Teste |
|---|---|---|---|
| Vidro, madeira, tijolo, concreto armado (`WMAT`) | ARS L609 | `game-destruction/src/data/assemblies.json`: `glass_pane`, `wood_frame_wall`, `brick_wall_plastered`, `reinforced_concrete` (+ `concrete_block_wall`, `drywall`, `log_wall`, `sheet_metal_shack`) | `assemblies.test.ts` |
| Tijolo 0,23×0,075×0,11 m em amarração, painéis 0,6×0,42×0,2 m em grade 4×5 | ARS L618–619 | `units` das montagens; `breach.ts` (`unitGrid`); fratura do concreto armado dá 20 painéis | `walls.test.ts`, `reinforcement.test.ts` |
| Estágios `WST`: 0 intacta, 1 marcas e trincas, 2 rompida no meio (passa e atira), 3 desabada | ARS L615, 631–640 | `PartState.stage`, eventos `stage`/`fracture`/`collapse`; estágio 2 com `opening` e fragmentos, a peça fica | `walls.test.ts` |
| Vergalhão do estágio 2: Ø 7 mm, 0,18 m | ARS L640 | `rebar.ts` (`rebarBars`, 0,18 m, Ø 8 mm por padrão); evento `expose`; `game-destruction-three/src/rebar.ts` (cilindros instanciados) | `reinforcement.test.ts`, `wall-events.test.ts` |
| Concreto armado só rompe com C4, AT4, RPG-7 | ARS `WMAT` | não portado como tabela: 7,62 nunca abre (3300 J < 18 J/mm × 200 mm), C4 (345,6 kJ) e RPG (200 kJ) abrem, por energia | `walls.test.ts`, `reinforcement.test.ts` |
| Furos e lascas ficam nos blocos | OFI L894–913 | `Fragment.marks`; `FragmentSystem.addMarks` | `walls.test.ts` (holes stay), `wall-events.test.ts` |
| Laje caindo (entulho e poeira) | OFI L875–887 | evento `collapse` já existia; poeira que tapa a visão fica para a Fase 5 (E1) | `reinforcement.test.ts` (colapso progressivo com tempo) |
| 6 cenários estruturais | AC L3833–3868 | `tests/house-scenarios.test.ts` (spec equivalente em `tests/wall-helpers.ts`), mesmos assuntos | `house-scenarios.test.ts`, golden `house-scenarios.json` |
| N-1 em pilares e paredes portantes, `fsOutros` 0,45 | `specDe` L42685–42729 | `sizeStructure({ redundancyRoles, safetyByRole })` | `size-roles.test.ts` |
| Reboco só rótulo no VC3 | VC3 L10344 | passa a ser camada que lasca e soma penetração (`layers`) | `walls.test.ts` |

Entrou na T2.4c: a abertura na malha da parede e as fiadas de tijolo instanciadas (ver 1.2c). Falta: `wallDetail` panels/units e `buildWallSpecimen` (T2.2d).

### 1.2c Casa3DSDK e AndaresSDK no SDK (T2.4, 2026-10-24)

Pacote novo `game-floorplan-three` (`GameFloorplanThree`). Porte literal: mesma geometria, mesmos desenhos e mesmo sorteio por semente; só mudam os nomes (API em inglês, textos em `locales`) e o que a página lia de globais, que agora é opção. Golden `vc3-house-scene.json`: a cena de seis plantas (casa, lote, telhado e cada andar, nó a nó) e o plano de LOD (25 situações) igual à da página; nomes em `MIGRATION.md` do pacote. Ver a lista dos pares que não fecham exatamente e o motivo em `evidence.md`, seção T2.4.

| Seção do Casa3DSDK | Linhas | Onde entrou (`packages/game-floorplan-three/src/`) | Estado |
|---|---|---|---|
| Geometria | 39466–39719 | `kernel/geometry.ts`, `kernel/noise.ts`, `build/instance.ts` | portado |
| Móveis (`mkApi`, `MOV`, `tabelaTipos`, `extraTipos`) | 39720–39984, 40378 | `furniture/{api,builders,type-table,extra-types,place-items}.ts` (os builders de `Moveis3DSDK` vêm de `game-props3d`) | portado |
| Fixtures | 39985–40398 | `furniture/{fixtures,taps,plants,yard}.ts`, `lights/fixtures.ts` | portado |
| Casa (paredes, portas, janelas, pisos e lajes, escadas) | 40399–40617 | `house/{walls,doors,windows,floors,stairs}.ts` | portado |
| Água (R69), Elétrica (R50), Solar (R57) | 40618–40797 | `utilities/{water,electrical,solar}.ts` | portado |
| Rodapé e calçada (R46), Edificações (R43), Prédio | 40727–40874, 41499–41533 | `house/{baseboard,outbuildings,building}.ts` | portado |
| Vegetação (R39) | 40875–40909 | `vegetation/bridge.ts` (pacote injetado em `vegetation`) | portado |
| Luzes extras e iluminação | 40963–41000, ~42216–42295 | `lights/{decor,fixtures,room-light}.ts` | portado |
| Lote, calhas, telhas | 41002–41325 | `lot/{terrain,perimeter,gates}.ts`, `roof/{roofs,rect,gutters,tiles,slabs}.ts` | portado |
| Espelhos | 41326–41390 | `mirrors.ts` (`Reflector` injetado em `reflector`) | portado |
| Carros | 41391–41498 | `cars.ts` (frota injetada em `fleet`, tipos por estilo em `carKinds`) | portado |
| Interação | 41534–41883 | `interaction/{state,doors,items,fittings,target,collision}.ts` | portado |
| Interativos | 41884–42174 | `interactables/{kit,bridge}.ts` | ponte portada; o `AdaptadorInterativos` era código do jogo (cabeçalho dele) e entrava injetado em `interactives.adapter`; **dúvida 5 respondida (2026-10-24, decisão do dono): entrou no kit, em `packages/game-floorplan-interactables`, e é o padrão de `interactives`** (evidence.md, seção "AdaptadorInterativos") |
| Animações | 42175–42220 | `animation/clotheslines.ts` | portado |
| Destruição | 42296–42466 | `destruction/{pieces,world}.ts`; `breach.ts` é novo (abertura na malha e fiadas de tijolo no LOD 0) | portado; fragmentos, lascamento e armadura aparente são do `game-destruction-three` |
| LOD | 42659–42680 | `statics.ts` (`planLod`), `build/build.ts` (`setLod`, LOD por distância) | portado |
| Estrutura → spec | 42681–42729 | `game-floorplan-structure` (T2.2c) | já estava |
| `AndaresSDK` | ML 7372–7557 | `navigation/floor-navigator.ts` (+ `from-house.ts`, `bind.ts`, novos na T2.4d) | portado; grade de 10 cm por andar, escadas, oclusão; `openCells`/`closeCells` ligam à destruição |


### 1.1b Estrutura das casas no SDK (T2.2c–e, 2026-10-24)

Pacote novo `game-floorplan-structure` (`result.structure`, `result.roof`, `result.construction`, `result.waterTank`, `result.structureExtras`). Golden `coarse` igual à página do time em 900 plantas dos 12 modelos.

| Peça do time | Fonte | Onde entrou | Teste |
|---|---|---|---|
| `construcaoPadrao`, `JUNTA_SIS`, `MATERIAIS`/`DENSIDADE`, `TELHA_MAT`/`TELHA_JUNTA` | VC3 L10311–10358 | `game-floorplan-structure/src/{registry,presets,density,construction}.ts` | `team-golden-vc3-structure.test.ts` |
| `montarEstrutura` (fundação, paredes, pratos, pilares, alpendre, sacada, degraus, escada, telhado, forro) | VC3 L10360–10632 | `src/structure/*.ts` | idem + `structure.test.ts` (toda planta tem estrutura) |
| `montarEstruturaLona`, `estruturaExtras` (caixa d'água, chaminé, poço) | VC3 L10633–10701 | `src/structure/{canvas,tank-parts,extras}.ts` | `structure.test.ts` |
| `montarCaixaDagua` | VC3 L9279 | `src/water-tank.ts` | golden (`caixaDagua`) |
| `ROLE_DES`, `cargasProjeto`, `specDe` | VC3 L42681–42729 | `src/{loads,to-destructible-spec}.ts` | golden (`specDe` coarse e `vedacao`) |
| Cenários estruturais do AC (pilar de canto, dois pilares) e a ênfase do dono (varanda, madeira, tronco, pórtico) | AC L3833–3868, design §8 | `tests/load-path.test.ts` no mundo de `game-destruction` | `load-path.test.ts` |
| Detalhe de parede (`panels`, `units`, fiadas de tora) e corpo de prova de parede | design §3 (sem original do time) | `src/wall-detail/*.ts`, `src/wall-specimen.ts` | `wall-detail.test.ts` |
| `montarGas`, `montarEletrica` (incl. `gato`), `montarSolar`, `montarHidraulica` | VC3 L10879–11166 | `src/utilities/{gas,electrical*,solar,plumbing,wall-points}.ts` | golden (900 plantas), `utilities.test.ts` |
| `montarEdificacoes`, `caminhosEdificacoes` | VC3 L10752–10823 | `src/utilities/outbuildings.ts` | golden, `utilities.test.ts` |
| `CONTEUDO`, `sorteiaConteudo`, `aplicaConteudo` (conteúdo por estado) | VC3 L10824–10878 | `src/utilities/content*.ts` (`result.contents`, provedor `findsFor`) | `utilities.test.ts` |

Falta para os modelos rurais (T2.2f) registrarem a própria construção e extras com `registerConstruction` (e `TemplateDef.energy`, `tank`, `tankLocation`).

### 1.5 Revisão da Casa A (RC)

Página de checklist pessoal (localStorage, exportar/importar JSON) sobre 72 itens R01–R72: **57 corrigidos, 3 aguardando decisão, 11 prontos no SDK, 1 aberto** (L2 do cabeçalho; só 8 itens aparecem no texto extraído).
Notas legíveis: R01 voo livre; R02/R09 colisão com pegadas e auditoria de que nenhum móvel invade parede/muro (testes de propriedade); R03 espelho com `Reflector`; R04 box de vidro não bloqueia janela;
R42 box do banheiro e roupas do varal não travam (balançam, porta do box abre) — "pronto no SDK de móveis"; R64 abajur como item do SDK (`luz_mesa`, apoio, 0,36 m); R70 porta fechada para o jogador
(testes `implementacao/jogo-web/t/porta-fechada.mjs`, `t_interacao.mjs` — **não estão em `sources/`**). O script (L5–96) é só a mecânica do checklist, sem relação com o SDK.

### 1.6 Galeria do Vale Cinzento (GAL, 2.512 linhas, um IIFE; dados em `mapa/mundo-terreno.json`, que **não** está em `sources/`)

Infraestrutura da página (cena three.js direta; nada passa por api de primitivas):

- Utilitários e material: `rng`/`R`, `pick`, `lerp`, `sstep`, `hash` (L14–20); `M(cor,opts)` com cache, `E(cor)` básico (L34–35); `rbox(w,h,d,r)` caixa arredondada com grade 4×4 e normais suaves (L41–51);
  primitivas `bx`, `cyl`, `cone`, `prism`, `plane`, `line`, `grp`, `item` (instanciado) e `flush` (InstancedMesh de caixas + janelas acesas/apagadas) (L53–68); `texText`/`sign` (placa em canvas, `drip`), `pl` (luz com pisca), `pin`, `blood`, `fire`, `smoke` (L69–87); `env(kind, sh)` (10 climas: Dia, Noite, insideDia, insideNoite, night, dusk, inside, fogRiver, grey, dawn; hemisfério + sol + neblina) (L198–220); `room(w,d,h,...)` quarto em corte e `wl`, `backWin`, `leftWin` (L222–231).
- Personagens, andar e efeitos usados nas cenas (escopo de outro inventário, só listados): `figure`, `dog`, `zombie`, `human`, `horde`, `GAIT`/`gait` (L96–147), `smoke`, `fire`, `blood`, `glass`, `papers`, `casings` (L77–78, 232–234), animais `vaca3`, `cao3`, `ave3`, `urubus3`, `revoada3`, `queroquero3`, `chuva3`, `heli3` (L1301–1351), `tfCow`, `tfPig`, `tfDog`, `tfChicken`, `tfVulture`, `tfCrowFlock` (L1950–2012).

**Mobília de cena (L149–184)** — todas feitas de caixas, sem peça móvel nem física:

| Função | Linha | Medidas |
|---|---|---|
| `sofa` | 149 | 2,1×0,9, assento 0,45, encosto 0,5, 4 caixas |
| `bed(dbl)` | 150 | 1,0 ou 1,6 × 2,0; estrado 0,35, colchão 0,2, cabeceira 0,9 |
| `table(chairs)` | 151 | tampo 0,72, pernas, cadeiras com 25% de chance de estar caída |
| `shelf`, `shelfItems`, `rack` | 154, 157, 159 | prateleira com produtos instanciados (fill, cols), 0,42 m entre andares |
| `fridge` | 160 | 0,75×1,8×0,7, 2 caixas |
| `stove` | 161 | 0,7×0,9×0,62 |
| `counter` | 162 | 0,88 + tampo 0,05 |
| `wardrobe`, `tv`, `desk`, `locker`, `crate`, `barrel` | 163–168 | 1,4×2,1×0,6; TV 1,5×0,5; mesa 1,4×0,7 com PC; armário 0,4×1,8 em fileira; caixa; barril 0,38 r, 0,95 h |
| `car`, `bus` | 169, 176 | 1,9×4,3, polícia com giroflex e luz que alterna; ônibus 2,5×11 |
| `lampPost`, `sandbags`, `fence`, `tent`, `pine`, `tree` | 178–184 | poste 6 m com braço e luz; saco 0,55×0,22×0,32 por fileira; cerca com postes a cada 3 m e 3 fios; tenda em prisma; pinheiro 2 cones; árvore tronco+dodecaedro |
| `windowsOn`, `building`, `house` | 185–191 | janelas por andar a cada 3 m e coluna a cada 2,6 m com probabilidade de luz; prédio com cobertura, caixa d'água e letreiro (FARMÁCIA, MAGAZINE, LOTÉRICA, PADARIA, ÓTICA, CALÇADOS, BAR); casa caixa 3 m + telhado prisma 1,6 m + porta 1×2,1 + 2 janelas 1,1×1,1 (tábuas em 30%) |
| `ground`, `road`, `walk` | 192–194 | plano, rua com faixa tracejada a cada 5 m, calçada 0,15 m |

**Tipologias de casa e prédio e postes (L1126–1142, usadas em `buildPadraoRuas`)** — massas simples (caixas e prismas), sem planta interna:

| Função | Linha | Descrição e medidas |
|---|---|---|
| `sobrado` | 1136 | corpo 6 m (2 andares), telhado prisma 1,4 m, marquise 0,15 m, janelas 1,1×1,2 por andar |
| `laje` | 1137 | 1 a 3 andares de 2,9 m, laje de cobertura, caixa d'água azul r 0,55 h 0,9, sacada 0,8×1,2, ferros de espera (60%) |
| `colonial` | 1138 | largura variável, 4,2×10 m, platibanda, telhado atrás, portas/janelas a cada 2,2 m; coladas em fileira |
| `chalet` | 1139 | 7×9, base de pedra 0,8, parede 4,2, telhado 45° 4 m, chaminé |
| `companyHouse` | 1140 | 6×9×3, telhado, cerca baixa; "todas iguais" |
| `stilt` | 1141 | palafita: 6 estacas de 3,1 m, piso 1,5 m, casa 4,6×6,4×2,6, varanda |
| `farmhouse` | 1142 | casa sede 15×11×3,2, varanda com 6 pilares |
| `building` | 187 | 12×12 (ou variável) × 12–36 m, laje de cobertura, janelas por andar, loja térrea |
| `poleLED` | 1126 | duplo, 9 m, LED branco, luz real a cada 25 m |
| `poleConcrete` | 1127 | 8 m, braço, sódio laranja, transformador opcional |
| `poleIron` | 1128 | 4 m, luminária de ferro fundido com capa cônica |
| `poleWood` | 1129 | 7 m, travessa, luminária 0,16×0,22 |
| `floodTower` | 1130 | 12 m com 3 refletores |
| auxiliares | 1125, 1131–1135 | `LB` (orçamento de luzes reais), `atY`, `lightning`, `dust`, `wires`, `stripLabel` |

**`buildPadraoRuas` (L1143–1205)** — amostra de 9 bairros em grade 3×3 (célula 80×56 m), cada um com tipologia, largura de rua, poste, cor de luz e espaçamento:

1. **Centro**: avenida 2×7 m, prédios 12–36 m, LED branco a cada 25 m. 2. **Subúrbio**: casa térrea e sobrado 8×10, muro 1,8 m, poste de concreto com sódio, a cada 35 m.
3. **Bairro popular**: lajes de 5,6 m de frente, 1–3 andares, fios emaranhados, metade das luzes queimadas. 4. **Rua histórica**: casas coloniais coladas, pedra 5 m, ferro fundido a cada 20 m.
5. **Industrial e porto**: galpão em arco, torre de refletor a cada 60 m, contêiner. 6. **Vila ferroviária**: casas da companhia em fila, poste a cada 35 m. 7. **Serra / Rua das Pousadas**: chalés, pinheiros, ferro fundido a cada 20 m.
8. **Palafitas**: sem iluminação pública, lampião. 9. **Rural**: casa sede, poste de madeira só no cruzamento. (E um bairro **Militar** fora da grade, em x=160: torres de vigia com holofote e luz vermelha a cada 40 m.) 10 `pin` com descrições.
Os "números" de cada padrão (largura de rua 7/6/5 m, espaçamentos 25/35/20/60/40 m, cores `0xeef4ff`, `0xffa040`, `0xffd090`, `0xffe08a`...) estão só dentro desse código e nos textos das legendas.

**Cidades (L348–555)**: `streetGrid(B,n,rw)` (grade de ruas e calçadas), `fillBlock(cx,cz,size,hmin,hmax,pal,o)` (quarteirão preenchido com altura por `pow(R,1.6)`), `FAC` (8 cores de fachada),
`buildSantaAurora` (354, 8 pins), `buildPorto` (394, `container`, pórtico, balsa; 7 pins), `buildTresPontes` (425, `rails`, `wagon`, 3 pontes, vau; 11 pins), `buildCampoLargo` (483, `silo`, `tractor`, `plane3`, aeroclube; 10 pins),
`buildVilaCorvo` (524, teleférico, igreja, pousadas; 6 pins).

**Marcos (L556–690)**: `watchtower`, `buildBase` (559), `buildPrisao` (590), `pylon`, `buildRepresa` (617), `buildHospitalExt` (640), `buildShopping` (662, teto aberto).

**Interiores (L691–1117, todos "casa de bonecas" em corte com `room()`, `wl()` e `pin()`)** — 13 cenas: `buildCasa` (694; sala, cozinha, quarto do casal e da criança, banheiro, garagem com carro, lavanderia, quintal com cachorro; sala 14×10×2,8 m;
10 pins), `buildApto` (734), `buildMercado` (771; 18×13×3,4: 4 gôndolas com 1 caída, balcão frigorífico, 3 caixas, açougue, padaria, câmara fria, estoque, escritório do gerente), `buildFarmacia` (800; depósito de controlados com grade,
geladeira de vacinas, cofre, sala de manipulação, porta de aço arrombada por carro), `buildArmas` (827; `rifle`), `buildDelegacia` (863; `bars`), `buildHospital` (896; `stretcher`), `buildEscola` (924), `buildPosto` (959),
`buildIgreja` (1000), `buildGalpao` (1028), `buildFazenda` (1062), `buildTriagem` (1096; `cot`). Total de `pin(` no arquivo: 251; cada pin tem tipo (`loot`, `perigo`, `quebra`, `cena`), rótulo e texto de design
(ex.: "Guarda-roupa do casal: 1 em 12 casas: espingarda calibre 12 ou revólver .38"; "Janela da sala: tábuas pregadas aguentam 3 golpes extras").

**Terreno e mundo**: `RIOS`, `RIO_W`, `LAGOS`, `ESTRADAS`, `FERROVIAS`, `TUNEIS`, `LINHAS_TX`, `LUGARES`, `TRILHAS`, `CITIES` (5 cidades com retângulo, `c` = construções e `h` = altura), `VILLAGES` (14),
funções `dPoly`, `nearRiver`, `inBrejo`, `inQueimada`, `inRect`, `forestF`, `hW` (altura do terreno com serra, mata funda, leitos de rio e lagos), `W2` (px do mapa → m: ×0,4 − 160) (L240–275);
`buildWorld` (276: terreno 180×180 segmentos, 320 m, cores por vértice). Outras: `buildMina` (1206, 3 níveis), `buildRamal` (1245, `truss`), `buildLagoa` (1273), `buildVivo` (1352, mapa vivo com horda, urubus, helicóptero).

**Lugares assustadores**: `buildMansao` (1469, fachada com helpers `mv*`), `buildMansaoInterior` (1690: hall com escadaria dupla e lustre, jantar, porão com porta dos brasões, galeria dos retratos, biblioteca com estante deslizante,
sala de música, poço do elevador oculto, Laboratório Aurora níveis 1 e 2), `buildTrilhas` (2074; `tfCabin`, `tfTower`, `tfPlaneCrash`, `tfTent`, `tfTruck`, ponte pênsil de 70 m), `buildFazendaSantaClara` (2236; `tfScarecrow`, `tfHarvester`, celeiro, milharal).

**Registro `SCENES` (L2421–2456)**: 33 cenas (Mundo 2, Cidades 5, Padrões 1, Lugares assustadores 4, Marcos 5, Terreno 3, Interiores 13), com `id`, grupo, nome, tag, chip de classe (R, A, B, D), descrição e função `b`.
`nav` (2458), `orb` (órbita), `load` (2479), `dispose`, `frame` (2496) e `start` (2507) são a casca de visualização.

### 1.7 Mapa do Vale, checklist e visor de plantas

- **MAPA**: documento de design de nível v0.2 (só texto, sem código). Escala: 32×32 km (1.024 km², 256 setores de 2 km), 5 cidades + 14 vilas, ≈ 9.000 construções, 50% enteráveis, ~37.000 zumbis no mundo (até 2.000 materializados),
  travessia a pé ≈ 6 h reais, de carro ≈ 25 min; 35 lugares numerados. Dado de terreno correspondente está em GAL L240–275 (px do mapa).
- **CHK** (L1–106 + dados em `const D`): checklist de QA com **548 itens** sobre o Jardim Aurora (497), Vale vivo (14), Mansão Valverde (13), Trilha do Véu (13), Fazenda Santa Clara (11). Categorias: móvel 90, teto-paredes 76, móvel-com-loot 65, janela 63,
  porta 47, ponto-de-cena 41, cômodo 38, item 22, construção 18, luz 18, explosivo 16, veículo 15, cenário-de-teste 12, cerca-muro 10, rua 9, área 5, ponte/vegetação/poste 1. Cada item tem `x,y,z,yaw,pitch,pousa` para "Ir no jogo". É ferramenta de revisão (localStorage, Exportar/Importar), não dado de jogo.
- **VP**: (1) o PlantasSDK anterior, L10–2168; (2) o visor 2D, L2169–2595 (`listarTemplates`, estilo, estado, largura/profundidade, andar, semente, hash na URL, desenho de cômodos/portas/janelas/portões/móveis/decoração/itens de estado/muros/piso externo,
  slots gravados, lista de itens, legenda, cores da paleta, `resumo` com validação). O visor 2D do SDK (`packages/game-floorplan/viewer`) é o porte disso, com zoneamento e inglês/português a mais.

### 1.8 Versões integradas no jogo

**ML (modo livre, usa o SDK de casas)**

- Quarteirão do Jardim Aurora: `ROADS` (L66519: rua central ±5 m, travessa oeste, avenida leste, 2 transversais, 4 estradas de terra até as cenas, avenida até o Jardim das Palmeiras), `CALCADAS_AV` (1,5 m), `BUILDINGS`, `WALLS` (1,8 m), `PROPS` (carros, postes a cada 20 m, árvores, ônibus tombado),
  `LOTES` (L66545: 13 lotes: casas 1–8 e D, mercadinho, farmácia, 2 lojas), arredores de 14 m em grade com prédios fechados (classe C), grade de ocupação de 0,5 m (`fillRect`).
- `ZONAS` (L67798: **ZR1** 2 andares/7,5 m e **ZR-AP** 3 andares/12 m com exceção de 3 para `alto_padrao` e `mansao`, lista de usos), `zonaAndaresMax`, `zonaLimita`, `zonaAssert` (lança erro).
- `CENARIOS` (L67790): mansão (norte), vale vivo (sul), fazenda (oeste), trilha (leste), cada um com neblina própria e sólidos; `buildX` da galeria embutida em L66711–67789 (**gerado por `ferramentas/porta_galeria.py` a partir de `mapa/galeria-vale-cinzento.html`**, "não editar à mão").
- `C3D = Casa3DSDK.criar(...)` (L69136) com `Moveis3DSDK`, `FrotaLeve`, vegetação, `qualidade:'jogo'`, `lod:false` (o LOD é do jogo: `c3Lod`, `c3Orcamento` com orçamento de 150 draw calls para todas as casas), interativos do kit.
  Cola `c3*` (L69146–69640): `c3T` (lote→mundo, rotação em y), `c3Casa`, `c3LivraPorta` (a casa não tranca o jogador), `c3Comodos`, `c3Grade`, `c3Portas`, `c3Colisor`, `c3PortaSetDoor`, `c3Conts` (loot por móvel), `c3Luzes`, `c3Interagiveis`, `c3Assento`,
  `c3Andares`, `c3Raio`, `c3Paredes`, `c3Janelas`, `c3DanoParte`, `c3DanoTiro`, `c3Atualiza`, `c3ZumbisAbrem` (zumbis abrem portas dos andares de cima), `c3Proxies`, `c3Descarta`.
- `ANDARES = AndaresSDK.criar()` (L71731) e o adaptador do PlantasSDK (L71828).
- **Jardim das Palmeiras** (L71900+): `PALMEIRAS`, `PAL`, `PAL_LOTES` (8 lotes: térrea moderna, sobrado médio, 5 contemporâneas de alto padrão em 2–3 andares, mansão 21×15 em 3 andares), `palCasa` (planta → Casa3D, confere zoneamento com `zonaAssert`), `palLugares`, `PAL_GEN`
  (árvore grande, fonte, banco de jardim, mesa externa, genérico).
- `cTesteLer/cTesteOpcoes/cTesteMonta` (L75203+): cenários de teste de plantas por hash, mesmas opções do visor.

**JA (Jardim Aurora, jogo "fatia jogável", **não** usa PlantasSDK/Casa3DSDK)** — versão própria, mais simples e anterior: `BUILDINGS`/`LOTES`/`ROADS`/`WALLS` iguais aos do ML (L53269–53365), interiores em caixas com `addWall`, `addDoor` (porta com 300 de vida e tábuas de 150), `addCont` (móvel-contêiner: geladeira, armário de cozinha, guarda-roupa,
criado-mudo, armário do banheiro, estante, bancada de ferramentas, prateleiras de mercado/farmácia, balcão do caixa) (L54867–54979). Casas A (8), mercadinho A, farmácia A, 2 lojas C (porta de aço), casa D (chave na casa 3), `laje` na Casa 8. Galeria embutida em L53469–54541 e cenas em L54542+.
No fim da fatia ("Revisão final", `jogo__revisao-final-fatia-jogavel.js`): "Mapa: Rua das Acácias, 8 casas com chave, muros de quintal de 1,8 m que dá para pular, porta com tranca e tábua, laje da Casa 8 com escada, piscina da Casa D, ônibus tombado na avenida norte — uma rua em vez do bairro inteiro".

**SR** (`jogo__sdks-e-revisoes.js`): documentação offline gerada; só o início aparece no texto extraído (sumário com "PlantasSDK: Coordenadas, API, Estilo, Regras de colocação, Como adicionar Templates, Como o jogo se pluga, Arquivos", "SDK Câmera", "SDK Modo livre", "Revisão final" com orçamento de quadro 16,6 ms).
Não há README do PlantasSDK/Casa3DSDK em `sources/` (o cabeçalho de VC3 manda "Leia o README.md desta pasta"; `gerar-area.mjs`, `casa3d-destruicao.md`, `dados-area.json`, `teste.mjs` do PlantasSDK e `t/*.mjs` do jogo não foram extraídos).

---

## 2. O que o SDK já tem do mesmo assunto

| Pacote | O que cobre | Testes |
|---|---|---|
| `game-floorplan` (motor) | `generate`, `slots`, `validate`, `palette`, `limitsOf`, `listTemplates`; registro de itens, bibliotecas de slots, templates, estilos, paletas, perfis de decoração, passes (`registerPass`), sobreposição de piso (`registerGroundOverlay`), topo de muro, `registerState`, `setStateDistribution`; **zoneamento** (`defineZone`, `checkLot`, `listZones`); locales `en` e `pt-BR` (todo texto visível é chave); visor 2D (`viewer/`). Mesma semente → mesmo resultado. Zero dependência. | `engine.test.ts` (94 linhas) |
| `game-floorplan-residential` | 10 templates, catálogo de móveis, bibliotecas de slots, decoração (luzes de teto, ar-condicionado, quadros, plantas, cortinas), estilos, região `br` (tinta, fachada, zonas ZR1, ZR-AP, ZR2, ZR3/ZM) | `residential.test.ts` (134) |
| `game-floorplan-commercial` | `market`, `pharmacy`, itens de loja, estilo e paleta `commercial`, zonas `zc` e `zi` | `commercial.test.ts` (79) |
| `game-floorplan-post-apocalyptic` | estados `fortified` e `abandoned` por plugin (barricada, tábuas, sacos, arame, colchões, malas, sangue, portas abertas), distribuição 35/45/20 configurável | suíte de propriedades portada do SDK antigo: sobreposição, porta/janela bloqueada, caminho, patamar de escada, anel de piscina, regras de decoração, cobertura de solo, consistência de estado, contraste de paleta, determinismo; 25 sementes por padrão, `FULL=1` roda as 200 originais (`floorplan.test.ts` 202 + `support.ts` 403 linhas) |
| `game-props3d` | 57 builders de decoração, móvel, quintal e estado da casa que **só descrevem primitivas** via uma `api` do host (sem three); 10 atlas; `cover` (gramado, piso, deck); `createRecorder` | `builders.test.ts` (227) |
| `game-interactables` + `-household` + `-three` | motor de objetos interativos e 51 tipos domésticos/rurais/camping com profundidade real (portas na dobradiça, gavetas abertas por cima, contêineres com slots e loot, assentos, aparelhos, rede elétrica, hidráulica, espelhos, emissores) | `household.test.ts` (643), `rural.test.ts`, `review.test.ts`, `destruction.test.ts` |
| `game-destruction` | peças + juntas + materiais (26), **integridade estrutural**: `structure.role` (`foundation`, `column`, `beam`, `slab`, `wall`, `partition`, `roof`, `stair`, `none`), solução de cargas, sobrecarga com perda de pontos por segundo, colapso (`collapse` + `status: 'collapsed'`), `buildFrame`, `sizeStructure({safety, redundancy})`; 13 tipos de junta (`mortar`, `rebar`, `bolt`, `resting`, `nail`, `tie`, `glue`, `clip`, `hinge`...) | `structure.test.ts` (15 KB), `collapse-timing`, `size-structure`, `joint-reach`, `open-joints`, `destruction.test.ts` (26 KB) |
| `game-destruction-three` | renderizador três.js dos eventos; **`bind` por faixa de vértices de uma malha fundida** (`{mesh, range:[v0,v1]}`) já pensado para casas fundidas, peças soltas, fragmentos, decals, fogo, derretimento, vazamento | `renderer.test.ts` (484), `vertex-range.test.ts` (285) |
| `game-test-room` | contrato `TestableModule`, sala genérica; item de casa **provisório**: `frame()` com `buildFrame` (2×2 colunas, vigas, laje, `columnCapacity: 4400`) em `items.ts:166` | — |

Lacunas confirmadas (nada no SDK): renderizador three.js de casa (paredes com vão, porta, janela, piso, teto, telhado, lote); estrutura de uma planta real (grafo de peças e apoios) e construção por material; instalações (elétrica, hidráulica, gás, solar, caixa d'água, edícula);
ponte planta → interativos; builders estáticos de ~100 tipos do catálogo de planta (o catálogo do floorplan tem 164 tipos; `game-props3d` desenha 57 e `-household` 51); multi-andar andável (AndaresSDK); ruas, postes e padrões urbanos; dados de terreno.

---

## 3. Comparação item a item

Legenda de "melhor": **T** = time (ZombiAdA), **S** = SDK, **=** equivalentes, **T+S** = cada lado tem parte.

| # | Assunto | ZombiAdA (onde) | SDK (onde) | Melhor | Por quê | Ação |
|---|---|---|---|---|---|---|
| 1 | Gerador de planta e lote (motor) | PlantasSDK VC3 L7374–11190 | `game-floorplan` `src/*` | **T+S** | Mesmo algoritmo (porte com 0 diferença na versão antiga). SDK: registro por pacote, locale en/pt-BR, zoneamento, zero dependência, 2D viewer, suíte de propriedades. Time: regras de jogabilidade novas (R-itens, linha 1) | **Mesclar**: levar as regras R-itens ao motor do SDK (`fill.ts`, `plan.ts`, `queries.ts`) e rerodar a comparação numérica contra VC3 — **entrou na T2.2b** (`game-floorplan`; conferido com 900 plantas do VC3) |
| 2 | Passagem mínima entre móveis | `RAIO_JOG = 0.24` (L7378) | `inflation` 0,12/0,15 (`fill.ts:64`) | **T** | disco de 24 cm = jogador de verdade; 12 cm deixa vão que o personagem não atravessa | **Portar** (parâmetro `playerRadius` no motor; default 0,24) — **entrou na T2.2b** (`game-floorplan`; conferido com 900 plantas do VC3) |
| 3 | Folga de porta e janela | `PORTA_FOLGA` 0,12 + `folga` do template, `JAN_FOLGA` 0,3, reposicionamento (L1833, 1842–1863) | 0,12 e 0,3 fixos (`plan.ts:61, 96`) | **T** (pouco) | template pode pedir mais folga; janelas distribuídas por regra | **Portar** — **entrou na T2.2b** (`game-floorplan`; conferido com 900 plantas do VC3) |
| 4 | Móvel tapando janela | `bloqueiaJanela` com `hjan`, `aereo`, `H_AEREO` 2,15 (L9482) | `blocksWindow` (`queries.ts:39`) | **T** | cobre armário aéreo e box de vidro (R04); SDK só compara 1,0 e `y0 - 0,05` | **Portar** (campos `windowHeight`, `overhead` no `ItemDef`) — **entrou na T2.2b** (`game-floorplan`; conferido com 900 plantas do VC3) |
| 5 | Vaga de carro | `FOLGA_CARRO` e `candidatosCarro` (L9704) | sem equivalente | **T** | lado do motorista livre (0,8) e pontas (0,6) | **Portar** — **entrou na T2.2b** (`game-floorplan`; conferido com 900 plantas do VC3) |
| 6 | Templates residenciais e comerciais | 12 (+1 duplicado) | 12 | **=** | mesmos ids após o mapa de nomes | manter SDK |
| 7 | Templates rurais (madeira, chalé, cabana, barraco, camping) | L8794–9124 | `game-floorplan-rural` (5 modelos) | **T** | só o time tem; incluem wood_frame, tronco, improvisado, lona | **Portar** para pacote de conteúdo rural — **entrou na T2.2f** (375 plantas do VC3 conferem lista por lista; estrutura na T2.2c–e) |
| 8 | Zoneamento | `ZONAS` ZR1 e ZR-AP, `zonaAssert` (ML L67798) | `defineZone`, `checkLot`, 6 zonas `br`, ajuste automático e relatório | **S** | gabarito, recuo, taxa de ocupação, coeficiente, permeabilidade, uso por template; o do jogo é 2 zonas fixas com `throw` | manter SDK; trocar `zonaAssert` do jogo por `engine.validate` |
| 9 | Estados da casa (protegida/abandonada) | `aplicaEstado` L10163 | `game-floorplan-post-apocalyptic` | **=** (não verificado se `aplicaEstado` mudou depois do porte) | mesma distribuição e itens | conferir diff de `aplicaEstado` (VP × VC3) |
| 10 | Conteúdo dos móveis por estado | `CONTEUDO`, `sorteiaConteudo` (L10824–10878) | `-household` `loot.json` (por contêiner, no motor de interativos) | **T+S** | time sorteia o conteúdo na planta, por semente e estado; SDK tem as tabelas de loot por tipo, sem a regra de estado | **Mesclar**: regra de estado no pacote post-apocalyptic, tabelas no household |
| 11 | Estrutura de sustentação de uma casa real | `montarEstrutura` L10360–10632 (+ lona, extras) | `buildFrame` (colunas+vigas+laje de teste), `game-test-room` `frame()` | **T** | casa inteira: fundação (radier, pilotis, porão), paredes portantes × vedação, barrotes a 0,6 m, lajes por andar, telhado, escada, caixa d'água, sistemas alvenaria/wood_frame/tronco/improvisado/lona | **Portar** |
| 12 | Motor de cargas e colapso | usa `GameDestruction` do kit (L36278) | `game-destruction` | **S** | é o mesmo núcleo, com solver, sobrecarga, colapso e `status: collapsed`, testes de tempo | manter SDK |
| 13 | Dimensionamento de capacidade (N-1) | `cargasProjeto`, `specDe` (L42685–42729): N-1 em **pilar e parede portante**, `fsOutros` 0,45 para vigas/lajes/telhado, `vedacao` | `sizeStructure` (`size.ts`): uma `safety`, N-1 só em `column` | **T** (para casa) | casa com paredes portantes (tronco, alvenaria estrutural) precisa de N-1 nelas; viga/laje com folga maior evita cair sozinha | **Mesclar**: `sizeStructure` ganha `redundancyRoles` e `safetyByRole`; `specDe` vira função do pacote de planta usando-o |
| 14 | Papéis e juntas da planta → spec | `ROLE_DES`, `JUNTA_DES` (L42681) | `StructureRole`, `JOINT_DEFAULTS` | **=** | 1:1, `rope`→`tie` | portar a tabela como dado |
| 15 | Adaptador de destruição para malha fundida da casa | `criaDestruicao` + `faixas` (L42296–42466) | `game-destruction-three` (`bind` por faixa, peças soltas, fragmentos, queda com impacto, vazamento) | **S** | genérico, testado (vertex-range 285 linhas), orçamento 160/80 fragmentos; o do time faz o mesmo para uma casa só | manter SDK; o que sobra é gerar `userData.faixas` no renderizador da casa e ligar o vazamento à caixa d'água |
| 16 | Renderizador three.js da casa | Casa3DSDK L39443–42734 (≈3.300 linhas num arquivo) | **nenhum** | **T** | único existente; LOD por orçamento, 2 qualidades, malha fundida por grupo/material, colisão, portas, luzes, espelhos | **Portar** (novo pacote `-three`, quebrado em módulos < 200 linhas) |
| 17 | Visor 2D | VP L2169–2595 | `game-floorplan/viewer` | **S** | mesmas opções + zoneamento + EN/PT | manter SDK |
| 18 | Instalações (elétrica, hidráulica, gás, solar) | L10879–11166 e renderização em VC3 L40618–40797 | `game-interactables-household` tem objetos (`service_entrance`, `electrical_panel`, `power_meter`, `conduit_run`, `gas_bottle`, `shower`...) e rede elétrica/hidráulica em runtime; **a planta não gera os pontos** | **T+S** | time posiciona entrada de energia, circuitos, trechos de cano, painéis; SDK simula e desenha cada objeto com profundidade | **Mesclar**: a planta emite `utilities`; o household simula |
| 19 | Caixa d'água | `montarCaixaDagua` (L9279), nível em runtime `casa.agua` (L40618) | `water_tank` só como item de slot (`libraries.ts:130, 206`), `slab.waterTank` na fachada de `budget_slab_house` | **T** | local (laje/sótão/cavalete), plataforma, capacidade por classe, vazamento ligado à destruição | **Portar** |
| 20 | Edícula e edificações do quintal | `montarEdificacoes` L10777 + `edificacoes()` L40815 | sem equivalente | **T** | parede com vão, porta ≥ 0,8 m, janelas, interior mobiliado, caminho pedestre | **Portar** |
| 21 | Roteamento planta→builder de móvel | `tabelaTipos` (121 tipos, L39938) + `MAPA_TIPOS` (~85, L35078) | nada liga os 164 tipos do catálogo aos 57 builders do props3d e 51 do household | **T** | sem essa tabela uma planta do SDK não desenha | **Portar** como dado (mapa tipo → builder/household, com `dim`) |
| 22 | Moveis3DSDK × game-props3d | 57 tipos (L11200–11300) | 57 tipos (`catalog.ts`) | **S** | mesmos 57; SDK tem nomes em inglês, locale, tipos fortes, gravador de testes | manter SDK |
| 23 | Builders estáticos que **não** estão no props3d | `MOV` (~45) | — | **T** | cobrem mesa/jantar, estante, cadeira, tapete e todo o comércio (gôndola, registradora, cestas, prateleira de parede, balança, balcão vitrine), palete, caixas, moto, caçamba, bicicleta, carrinho, fonte | **Portar** só os que não têm equivalente em props3d/household, como builders de `api` (sem three) |
| 24 | Móveis interativos (geladeira, armário, cama, sofá, fogão, box...) | via `AdaptadorInterativos` → household | `game-interactables-household` | **S** | é o mesmo kit; os 51 tipos têm portas na dobradiça, gavetas reais, contêineres, assentos | manter SDK |
| 25 | Mobília da galeria (sofa, bed, table, shelf, fridge, stove, counter, wardrobe, tv, desk, locker, crate, barrel) | GAL L149–168 | props3d + household | **S** | galeria: 2 a 5 caixas por peça, sem parte móvel, sem colisão própria, fridge 0,75×1,8×0,7 sem portas; SDK: `fridge` 0,7×0,7×1,8 com `door_fridge` 97°, bandejas, compressor | **Manter SDK**; usar só como referência de cor/medida |
| 26 | `shelf`/`shelfItems`/`rack`/`counter` de mercado | GAL L154–162 | sem equivalente próximo (`display_rack`, `gondola_shelf` no catálogo de planta, sem builder) | **T** | prateleira com produtos instanciados por semente (fill, cores) | **Portar** como builder de `props3d` (usando `item`/instância) |
| 27 | Postes (`poleLED`, `poleConcrete`, `poleIron`, `poleWood`, `floodTower`) | GAL L1126–1130 | **nenhum** (props3d não tem poste; `lantern`/`lamp` são de interior) | **T** | 5 postes com altura, luz real com orçamento `LB`, pisca, transformador | **Portar** (props3d ou pacote urbano) |
| 28 | `fence` (alambrado de postes e fios), `chainlink`/`chainGate` (mansão, trilhas) | GAL L180, 1438, 1891, 1909 | `barbed_wire`, `razor_wire` (props3d); muro/grade/arame no lote da planta | **T+S** | galeria tem alambrado com portão e fio de arame; o SDK não | **Mesclar** (builder de alambrado no props3d) |
| 29 | `sandbags` | GAL L179 | props3d `sandbags` 1,6×0,5×0,6 | **S** (parcial) | SDK integra com barricada/estado; galeria usa fileiras instanciadas de 0,55×0,22×0,32 | manter SDK; conferir se o padrão de fileiras alternadas (offset 0,28 por fileira) deve virar variante |
| 30 | Tendas (`tent`, `tfTent`, triagem) | GAL L182, 2044 | `barraca_camping` só na planta do time; household tem mesa/cadeira/fogareiro/fogueira, **sem barraca** | **T** | iglu, túnel, prisma | **Portar** (builder + template camping) |
| 31 | Árvores e pinheiros | `pine`, `tree`, `tfPines` (GAL L183–184, 1928) | `game-vegetation` + `-species` | **S** | espécies e variações; galeria é cone e dodecaedro | manter SDK |
| 32 | Carros e ônibus de cena | GAL L169–176 | `game-vehicles` + `-fleet` | **S** | frota com goldens | manter SDK; ônibus tombado vira conteúdo de cena |
| 33 | Tipologias de casa/prédio (`sobrado`, `laje`, `colonial`, `chalet`, `companyHouse`, `stilt`, `farmhouse`, `building`) | GAL L187, 1136–1142 | planta completa existe só para `townhouse`, `budget_slab_house`, `apartment_modern`; `colonial` existe apenas como tipo de telhado; `companyHouse`, `stilt` (palafita), `farmhouse` e o chalé (`chale_madeira`) não têm equivalente no SDK | **S** onde existe planta; **T** onde não | galeria são massas sem interior: `laje` 5,6×10 bate com `budget_slab_house` (w 5–7,2 / d 9,2–10,4), mas a galeria faz 1–3 andares enquanto o SDK tem 1 | **Mesclar**: massa de galeria serve de **LOD distante** e de prédio fechado; sobrado/laje usam o template; colonial, vila operária, palafita, casa sede, chalé viram templates novos (ver 7) **✅ T2.5a (2026-10-24):** as 9 massas (`sobrado`, `laje`, `colonial`, `chalet`, `companyHouse`, `stilt`, `farmhouse`, `house`, `building`) são geradores de dados em `game-floorplan/src/silhouettes`, sem three; os 16 casos conferem com o golden da galeria (hash de cena). |
| 34 | `building` e `windowsOn` | GAL L185–187 | `apartment_modern` (3–20 andares) | **T** (visual) / **S** (planta) | galeria: janelas por andar com probabilidade de luz, letreiros, cobertura; SDK: unidade enterável | **Mesclar**: fachada de prédio como geometria do `-three` |
| 35 | Interiores dos 13 cenários (mercado, farmácia, delegacia...) | GAL L691–1117 | `market`, `pharmacy` (planta procedural) | **T** (programa de espaços) / **S** (reuso) | galeria mercado 18×13: açougue, padaria, câmara fria, gôndola caída, cofre, armadilha; SDK market 14×15 (12–20 × 13–18): caixas, loja, estoque, banheiro, escritório | **Mesclar**: levar os ambientes ausentes ao `market`/`pharmacy` e criar templates `police_station`, `school`, `church`, `gas_station`, `hospital_er`, `factory`, `farm`, `gun_shop` conforme pedido do dono; pins viram conteúdo **✅ T2.5b–e (2026-10-24):** 10 modelos em `game-floorplan-commercial` (`supermarket`, `drugstore`, `gun_shop`, `police_station`, `emergency_room`, `school`, `gas_station`, `church`, `metalworks`, `farm`) e `triage_tent` em `game-floorplan-post-apocalyptic`; `market` e `pharmacy` ficam como o comércio de esquina. Programa conferido por teste (cômodos, medidas, equipamentos, pinos de achado como `interiorFindsHints`). |
| 36 | Casa de subúrbio (`buildCasa`) | GAL L694 (14×10×2,8) | `single_storey_a`, `townhouse` | **S** | planta procedural, validada, com estados e lote | manter SDK; cenas de pin como conteúdo |
| 37 | Pins de design (loot, perigo, quebra, cena; 251) | GAL (`pin(...)`) | `game-devtools` `marks.ts` (marcas), loot tables no household | **T** (conteúdo) | texto de design com posição | **Portar** como dado de conteúdo (ZombiAdA) |
| 38 | Padrão de ruas (9 bairros + militar) | GAL L1143–1205 | **nenhum** | **T** | dados de largura de rua, poste, cor de luz e espaçamento por bairro | **Portar** (pacote urbano genérico + conteúdo) |
| 39 | `streetGrid`, `fillBlock`, `road`, `walk` | GAL L350–352, 192–194 | **nenhum** | **T** | grade de ruas/calçadas e quarteirão com alturas | **Portar** |
| 40 | Cidades/rios/lagos/rodovias/relevo | GAL L240–275 (`hW`, `forestF`...) | **nenhum** | **T** | funções de relevo e máscaras (mata, brejo, queimada) | **Portar** como conteúdo ZombiAdA + utilitário genérico de terreno por polilinhas |
| 41 | Multi-andar andável | `AndaresSDK` (ML L7372–7560): grade de 10 cm por andar, escada, retorno em U | **nenhum** | **T** | sem isso o jogador não sobe a escada de um sobrado | **Portar** (decidir pacote, ver 4.4) |
| 42 | Colisão e interação na casa | Casa3D `colideDe`, `alvoDe`, `alternaPorta` (L41807–41883) | `game-interactables` cuida dos objetos, não de paredes/portas da planta | **T** | porta fechada para o jogador (R70), pegadas orientadas, E abre | **Portar** |
| 43 | LOD por orçamento de draw calls | `planejaLOD` (L42670) | **nenhum** | **T** | distribui 3 níveis entre várias casas por distância | **Portar** |
| 44 | Área de teste de casas | `HouseArea` (AC L3789–3882), 5 itens, 6 cenários | `game-test-room` `frame()`; `examples/*-test-area` sem casa | **T** | já é um `TestableModule`; os cenários são os goldens de dano estrutural | **Portado (T2.6, 2026-10-24)**: `createFloorplanTestModule` em `packages/game-floorplan-three/src/test-area/` (módulo, 5 espécimes, 6 cenários com os ids e as checagens do time, mais `floorplan_typologies`), carregado por `examples/floorplan-test-area` e por `examples/interactables-test-area`; paridade com o golden do VC3 em `tests/team-golden-house-area.test.ts` |
| 45 | Zoneamento e casas do Jardim das Palmeiras | ML L71900+ | zonas `zr_ap` etc. | **S** (regras) / **T** (conteúdo de lote) | | manter SDK; lotes e posições como conteúdo ZombiAdA |
| 46 | Duplicação da galeria no jogo | JA L53469, ML L66711 (gerado por `porta_galeria.py`) | — | — | 3 cópias do mesmo código | resolvido quando a galeria sair do SDK (R4) |
| 47 | Checklist do Mapa e Revisão da Casa A | CHK, RC | `game-devtools` | **n/a** | ferramentas de QA pessoais do dono, dados 100% ZombiAdA | **Não migrar**; opcional: checklist genérico no devtools |
| 48 | Dado "Mapa do Vale" | MAPA (texto) | — | **n/a** | documento de design | referência; números (32 km, 5 cidades, 14 vilas, ≈ 9.000 construções) vão para o `README` do conteúdo |

---

## 4. Destino por módulo

### 4.1 Recomendação: **não criar um pacote "Casa3DSDK"; separar pelas costuras que o código já mostra**

O Casa3DSDK não tem modelo próprio: ele desenha o resultado do PlantasSDK (planta, paredes, portas, janelas, `estrutura`, `lote`). Um pacote novo de construção que "também" modela casas duplicaria o modelo de planta
do `game-floorplan` (duas fontes de verdade para o mesmo cômodo) e obrigaria a estrutura a conhecer paredes e cômodos de fora do pacote que as gera. Recomendo:

| Camada | Pacote | O que entra | Genérico? |
|---|---|---|---|
| Motor de planta | `game-floorplan` (existente) | regras R-itens (raio do jogador, folgas, janela, carro), **ponto de extensão do resultado** (`registerResultExtension(name, fn)` ou usar `registerPass` com saída), `playerRadius` configurável | sim |
| Estrutura e construção | **`game-floorplan-structure`** (novo, pacote de conteúdo no padrão `register(engine)`) | `construction` por sistema (`alvenaria`, `wood_frame`, `tronco`, `improvisado`, `lona`), `structure {parts, supports}` (`montarEstrutura`), `specDe` (planta → `DestructibleSpec`), tabelas `ROLE_DES`/`JUNTA_DES`/`TELHA_MAT`; depende só de tipos do `game-contracts` | sim |
| Instalações | `game-floorplan-utilities` (novo) **ou** dentro de `-structure` | caixa d'água, gás, elétrica, solar, hidráulica, edificações do quintal, conteúdo por estado | sim (parte BR: medidor, `gato` de luz, botijão P13 viram dado de região, como já faz o household) |
| Conteúdo rural | **`game-floorplan-rural`** (novo, pacote de conteúdo) | os 5 templates, estilo `rural`, bibliotecas de slot, itens (fogão a lenha, privada, cavalete, barraca, cooler) | sim (os nomes brasileiros ficam em locale/região) |
| Renderizador | **`game-floorplan-three`** (novo) | o Casa3DSDK portado: geometria acumulada, paredes/vãos/portas/janelas/pisos/lajes/forros/escadas/elevador, lote, telhado, calhas, telha, espelhos, luzes, colisão e interação, LOD, `faixas` de destruição, ponte `specDe` → `game-destruction-three`. Recebe os builders por `api`/tabela (não conhece o ZombiAdA) | sim |
| Ponte planta → móveis | dentro de `game-floorplan-three` (módulo `furniture-map`) ou `game-floorplan-interactables` | `MAPA_TIPOS` + `tabelaTipos` como **dados** | sim |
| Móveis e peças | `game-props3d` (builders de primitivas sem three) e `-household` | portar `MOV` do que falta (mesa, estante, tapete, comércio, palete, caixas, moto, caçamba, bicicleta, carrinho, fonte), alambrado, postes, tenda | sim |
| Teste | `examples/floorplan-test-area` | `HouseArea` como `TestableModule` carregado por `room.loadModule` | sim |
| Urbano (ruas, postes, padrão de bairro, grade, quarteirão, relevo) | **`game-urban`** (novo; decisão do dono, ver 5.3) + `game-urban-three` | `streetGrid`, `fillBlock`, esquema de "padrão de bairro" (largura da rua, poste, cor de luz, espaçamento, tipologia), construtores de poste | sim |
| Conteúdo ZombiAdA | **`game-zombiada-vale-cinzento`** (nome a confirmar) | cenas da galeria (mansão, trilhas, fazenda, marcos, cidades), pins, `CITIES`, `RIOS`, `LAGOS`, `ESTRADAS`, `LUGARES`, textos, `SCENES`, lotes do Jardim Aurora e das Palmeiras, zonas do jogo | **não** |

Motivos da separação em vez de um pacote único:

1. A estrutura é **dado** (grafo de peças), independe do three e é usada por testes sem renderer (`HouseArea` mesmo roda em `game-test-room`); por isso fica do lado do motor, não no `-three`.
2. O `game-floorplan` deve continuar sem dependência e sem conhecimento de física: o pacote de estrutura só **emite** peças e apoios e converte para `DestructibleSpec`; o solver continua em `game-destruction`.
3. O renderizador é o único com three.js, como `destruction-three` e `interactables-three` (CLAUDE.md §2).
4. Rural (cabana, barraco, camping) é gênero de sobrevivência e é pedido de jogo futuro; no pacote residencial misturaria a lista de templates (`README` lista 10).
5. A fronteira de dados já foi aceita pelo time: `Casa3DSDK.criar` só recebe planta + builders.

Alternativa considerada e **não** recomendada: "um pacote `game-buildings` com planta + estrutura + render". Menor número de pacotes, mas obriga a migrar de novo os 4 pacotes de planta existentes (com MIGRATION e testes) e quebra a regra de que three.js fica em `-three`.

Tamanho do porte (referência para as tasks, contado nas linhas de VC3): Casa3DSDK = 3.291 linhas num único arquivo (a regra `code-standart` pede < 200 linhas por arquivo, então da ordem de 25 a 30 módulos);
no PlantasSDK estendido, estrutura e construção L10307–10701 (≈ 395 linhas), instalações L10817–11166 (≈ 350), edículas e conteúdo L10752–10878 (≈ 125), templates rurais L8672–9174 (≈ 500), além das regras novas espalhadas em funções existentes (86 trechos de diff, 1.806 linhas alteradas ou novas no total).

### 4.2 O que é genérico e o que é só do ZombiAdA

| Genérico (vai para o SDK) | Só ZombiAdA (pacote de conteúdo ou fica no jogo) |
|---|---|
| Regras de planta (raio do jogador, folgas, janela, carro), estrutura, construção por sistema, instalações, caixa d'água, edícula | Os 13 lotes do Jardim Aurora (casas 1–8, D, mercadinho, farmácia, 2 lojas), classes A/C/D, "chave na casa 3", "Casa 8 com laje e escada" |
| Templates rurais e estilo `rural` | Jardim das Palmeiras (`PAL_LOTES`, origem 200,−300, zona ZR-AP) |
| Renderizador da casa, LOD, colisão e interação, espelhos, calhas, telha | Mansão Valverde (fachada e interior com laboratório Aurora, porta dos brasões, estante deslizante), Fazenda Santa Clara, Trilha do Véu, Mina São Jorge |
| Ponte planta → móvel e `MAPA_TIPOS` | Cidades (Santa Aurora, Porto Turvo, Três Pontes, Campo Largo, Vila do Corvo), Base 7º BIS, Penitenciária, Represa, Hospital Regional, Shopping |
| Zonas e zoneamento (já no SDK) | Texto de pins, bilhetes ("Fomos pra casa da vó. Não abre pra ninguém."), loot por pin, perigos (cachorro, "pai zumbi") |
| Poste, alambrado, tenda, prateleira de mercado, balcão, registradora, balança, palete, caixas | Dados do mundo (`RIOS`, `LAGOS`, `ESTRADAS`, `FERROVIAS`, `TUNEIS`, `TRILHAS`, `LUGARES`, `CITIES`, `VILLAGES`), mapa de 32 km |
| Padrão de bairro como esquema (largura, poste, cor, espaçamento, tipologia) | Os 9 valores concretos do Vale (centro LED a 25 m, subúrbio sódio a 35 m, histórico ferro a 20 m, industrial 60 m, militar 40 m...) |
| Multi-andar andável (AndaresSDK) | `CHK` e `RC` (ferramentas de QA) |
| Mesa de teste `HouseArea` | Os cenários `CENARIOS`, neblinas por cena, hordas e animais das cenas |

### 4.3 Ordem de porte que o inventário sugere (para o plano; não é decisão)

1. Regras R-itens no motor (motor, `blocksWindow`, `playerRadius`) com rodada numérica contra VC3: barato e já testável pela suíte de propriedades.
2. Pacote de estrutura + `HouseArea` com os 6 cenários como goldens (já são testes de dano estrutural prontos).
3. `game-floorplan-three` (maior item), com `userData.faixas` e a ponte `specDe` → `game-destruction-three`.
4. Templates rurais e instalações.
5. Builders estáticos que faltam e postes/alambrado/tenda no `props3d`.
6. Urbano e conteúdo ZombiAdA (galeria) por último.

### 4.4 AndaresSDK

É genérico (grade fina por andar, escadas), mas é navegação, não planta nem renderer. Opções: (a) dentro de `game-floorplan` (`walkGrid` derivado do `Plan`),
(b) dentro de `game-floorplan-three` junto com colisão, (c) pacote `game-navigation`. Recomendação provisória: **(a)** como função pura do plano (sem three), porque o dado de partida (paredes, portas, escadas, andares) é do plano. Fica para o dono decidir (ver 5.5).

---

## 5. Dúvidas para o dono

1. **Versão de referência do PlantasSDK.** O SDK foi portado de um `plantas.js` mais antigo (sem estrutura). A versão de VC3 é a "mais nova" que tenho, mas pode haver outra em `implementacao/sdk/plantas/`. Posso tratar VC3 L7374–11190 como a versão de verdade e **rerodar a comparação numérica** do `MIGRATION.md` contra ela?
2. **Fontes originais.** O cabeçalho de VC3 cita `README.md` do Casa3DSDK, `casa3d-destruicao.md`, `gerar-area.mjs`, `dados-area.json`, o `teste.mjs` do PlantasSDK e `implementacao/jogo-web/t/*.mjs` (`porta-fechada.mjs`, `t_interacao.mjs`). Eles existem em outro lugar (`Andersonfrfilho/zombiada`)? Sem eles os goldens do Casa3D (porta fechada, espelho, colisão com pegadas, pegada dentro das faces do cômodo) só podem ser reescritos a partir do comportamento descrito em RC.
3. **Pacote urbano.** Ruas, postes, padrão de bairro, quarteirão e relevo não têm casa no kit. Cria-se `game-urban` (+ `-three`), ou isso entra em `game-floorplan` (zoneamento já fala de lote e bairro) ou em `game-props3d` (postes)?
4. **Nome do pacote do conteúdo ZombiAdA.** `game-zombiada-vale-cinzento`? Um único pacote para mapa+galeria+mansão, ou um por área (mundo, cidades, lugares)? O CLAUDE.md pede só que o conteúdo esteja fora do motor.
5. **AndaresSDK** (multi-andar andável, ML L7372–7560): onde fica (4.4)? É outro time ("Mapa no jogo")? Está dentro do escopo desta fase?
6. **Estilo e nome do teste.** `tasks.md` T2.4 diz `buildings-test-area`; pela regra `examples/<lib>-test-area` com a lib `game-floorplan-three` seria `examples/floorplan-test-area`. Qual vale?
7. **Rural: o que "gato de luz" e "barraco" significam para o kit?** Hoje o household já tem `service_entrance` com `variant: 'gato'`. Mantenho o barraco como template do pacote rural (com dado de região `br`), ou o dono prefere que ele fique só no conteúdo ZombiAdA?
8. **Massas da galeria (sobrado, laje, colonial, chalet, vila operária, palafita, casa sede, prédio).** São "silhuetas" sem planta. Tratar como LOD distante de templates reais (recomendado) ou portar como estão (caixas e prismas) para o "padrão de ruas"? A regra do CLAUDE.md proíbe "substituto (caixas)" quando o time já entregou a versão real; aqui a versão real *é* a caixa. Preciso da decisão.
9. **`laje` com 1 a 3 andares.** A galeria faz casa de laje de 1 a 3 andares (crescimento vertical); `budget_slab_house` do SDK tem 1. O time quer a variante de andares no template?
10. **Interiores que a galeria tem e o SDK não tem como planta** (delegacia, escola, igreja, posto, hospital pronto-socorro, galpão, loja de armas, fazenda, tenda de triagem; mercado com açougue/padaria/câmara fria). Viram templates procedurais do SDK, ou ficam como cenas "esculpidas" no pacote de conteúdo ZombiAdA?
11. **Jardim Aurora (JA)** usa casas simples feitas à mão e não o Casa3DSDK; o modo livre (ML) usa. Qual dos dois é o destino do jogo? Isso decide se os `BUILDINGS`/`LOTES` caixa de JA entram no inventário como conteúdo ou são descartados.
12. **Item de casa provisório do `game-test-room`** (`frame()` com `buildFrame`, `items.ts:166`) é um substituto de caixas. Trocar pelo `HouseArea` quando o pacote de estrutura existir?
13. **`MAPA_TIPOS` e `tabelaTipos`**: o catálogo de planta do SDK tem 164 tipos com nomes em inglês; os do time estão em português (121 e ~85). O mapa tipo→builder deve usar os ids novos (`MIGRATION.md` tem a tabela antigo→novo) ou os dois?
14. **Dados dependentes do kit:** `HP` de vidro 20, madeira 60 etc. em `cfg.hp` e `danificavel.hp` ("dano legado") são do jogo e coexistem com o dano do núcleo. O novo renderizador mantém o `hp` legado ou passa a ler o hp do `game-destruction` direto?


## Status ao fim da Fase 7 (urbano, T7.5)

Atualizado em 2026-10-24. As linhas 27, 31, 38 e 40 da tabela e as peças urbanas da Galeria do Vale Cinzento (seção 1.6).

| Item | Entrou? | Onde |
|---|---|---|
| 27 Postes (`poleLED`, `poleConcrete`, `poleIron`, `poleWood`, `floodTower`) com altura, luz real com orçamento `LB`, pisca, transformador | Sim | `game-urban` (`kit.poles`, `createLightBudget`, 16 luzes por cena, o contador passa de zero como o `LB`) |
| `road` (faixa a cada 5 m), `walk`, `ground`, `streetGrid`, `fillBlock`, `building` | Sim, pelo mesmo sorteio da página | `game-urban` (`kit.streets`, `kit.block`); os prédios vêm do `game-floorplan` |
| Adereços da amostra: `fence`, `tent`, `pine`, `tree`, `container`, `watchtower`, `sandbags`, letreiro, fios | Sim | `game-urban` (`kit.props`) |
| 38 Padrão de ruas (9 bairros + militar), `buildPadraoRuas` | Sim, os 10 como dado + compositor | `game-urban` (`kit.neighbourhoods`, `composeSampleSheet`, textos pt-BR e en, marcadores) |
| 40 Relevo (`hW`, `forestF`, `nearRiver`, `inBrejo`, `inQueimada`, `W2`, `buildWorld`): terreno por camadas, rios, lagos, mata, cor por vértice | Sim, o motor genérico; os números do Vale (4 rios, 4 lagos, 5 cidades, a Serra, a Mata Funda) ficam no jogo | `game-urban` (`kit.terrain`, `drawTerrain`), `game-slice/urban/valley-terrain.json` (fixture de teste copiada) |
| 31 Árvores e pinheiros da galeria | Os dois (cone e bola) seguem como adereço padrão; o provedor de plantas (`createPlantProvider`) usa as espécies do `game-vegetation-species` | `game-urban`, `game-urban-three` (`createPlantResolver`) |
| Carro e ônibus de caixas da amostra | **Não** (decisão: substituto de caixas é proibido); o provedor de veículos (`createVehicleProvider`) estaciona veículos da frota | `game-urban`, `game-urban-three` (`createVehicleResolver`, modo leve) |
| Casas da amostra (sobrado, laje, colonial, chalé, vila operária, palafita, sede, prédio) | Sim, as silhuetas de longe do `game-floorplan` como provedor padrão | `game-urban` (`createSilhouetteHouses`) |
| Partes que o `buildWorld` espalha (árvores e vilas pelo mapa, estradas, trilhas e trilhos, túneis, pontes, linhas de transmissão, muros, decoração do vale, marcadores do mapa) | **Não**: ficam como pendência (ver `evidence.md`, Fase 7, "Perguntas para o dono") | - |
| Ambiente de teste da cidade (`?area=urban`) | Sim | `packages/game-urban-three/src/test-area/`, `examples/urban-test-area/` |
