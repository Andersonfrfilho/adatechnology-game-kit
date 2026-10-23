# Consolidado da migração — decisões por parte

Junta os 5 relatórios de `inventario/` e a comparação de versões de `fontes.md`. São 71 dúvidas nos relatórios; muitas são a mesma
pergunta vista por frentes diferentes. Aqui ficam agrupadas: primeiro as **decisões gerais** (uma resposta resolve várias), depois as
**decisões de dados por parte**, na ordem da migração. Cada uma traz o que as fontes dizem e a recomendação.

Legenda: ✅ decidido (data e resposta), ⏳ aguardando o dono, 🔁 decidido pela regra do projeto (`CLAUDE.md`), sem precisar perguntar.

Desde 2026-10-23 o dono delegou: **decido o resto pela recomendação e aponto as melhorias**; só pergunto escolha de negócio.

## 0. O que já está claro

- 🔁 O site e os artefatos têm o mesmo código em 18 das 27 entregas. As divergências reais estão em `fontes.md`.
- 🔁 A Sala de testes de destruição do site é um build do próprio SDK: nada a portar.
- 🔁 Veículos: o SDK tem o mesmo motor e frota das páginas (mesmo hash de cena e mesmo dano por zona). Falta o **modo leve** da Frota
  Leve (194 mil para 19 mil triângulos), a API `danificaveis`, a cor por semente e a tabela `DIMS`.
- 🔁 Os 57 tipos de móvel do time são os 57 do `game-props3d`; a área de casas da sala já é `TestableModule` com 6 cenários.
- 🔁 O `game-infection` reproduz exatamente a simulação do "Antes do Dia 1" (9 datas), mas o jogo não o usa.
- 🔁 Os goldens de `game-vehicles-fleet` que falham estão **desatualizados**, não é regressão: 542 de 552 conferências batem; as 10 que
  diferem (`seda`, `popular` capotado, `civico` capotado) dão no SDK o mesmo hash da página de hoje.

## 1. Decisões gerais

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| G1 | **Qual versão do jogo é a referência** | Modo livre é o mais novo; Jardim Aurora é a fatia v7 | — | ✅ 2026-10-23: **nenhuma**. O jogo ainda está sendo montado; as duas versões são só mais uma fonte para comparar, e o SDK fica com o melhor de cada entrega |
| G2 | **Onde mora o conteúdo do ZombiAdA** (nomes, histórias, sangue, marca "horda", Vale Cinzento) | O CLAUDE.md pedia só que ficasse fora do motor | — | ✅ 2026-10-23: **no repositório do jogo**, que usa os SDKs do game-kit. O SDK guarda motor e conteúdo reaproveitável por qualquer jogo |
| G3 | **Como medir "igual ao original"** | As páginas usam `Math.random` e estado global; o SDK exige semente | — | ✅ 2026-10-23: sorteio com semente; o golden compara a sequência de eventos e o hash da cena com semente fixa |
| G4 | **Nomes no código** | Times escreveram em português (`civico`, `brutamonte`); a regra de código pede inglês | Identificadores em inglês; textos em pt-BR pelo locale | 🔁 regra de código |
| G5 | **Marcas reais de armas** (Glock, Taurus, AK) | O próprio Arsenal (§09) avisa que marca registrada pode pedir licença | — | ✅ 2026-10-23: **marcas reais no SDK** (arma real serve a qualquer jogo) |
| G6 | **three.js r128 → 0.160** | Páginas usam r128 e addons; o SDK usa ^0.160 | Portar para 0.160 (o addon `RoundedBoxGeometry` vira dependência dos `-three`) | 🔁 pacote do SDK |
| G7 | **O jogo começa antes do surto** | "Antes do Dia 1" (fases D−6 ao Dia 1) e `game-infection` | — | ✅ 2026-10-23 (dono): no início a infecção ainda não se instaurou. **O padrão de todo pacote é o mundo normal** (cidade funcionando, gente e carros circulando, casas habitadas, lojas abastecidas) e o surto é uma **camada que avança com o tempo**, conduzida pelo `game-infection`: multidão de pedestres a pânico e horda, casas de habitadas a fortificadas ou abandonadas, lojas saqueadas, carros largados, zumbis de raros a espalhados. Cada pacote aceita a transição gradual e configurável, não só antes e depois |

## 2. Armas e itens (Fase 1 e 3)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| A1 | Lista de armas | Arsenal: 67; Galeria: 71 de fogo + 4 que o documento não tem (PSG-1, SSG 69, MRAD, M200) + 6 lançadores | — | ✅ 2026-10-23: **união de todas as fontes**: as 77 da Galeria (71 de fogo + 6 lançadores) e tudo o que as outras atualizações trazem: granadas e explosivos do Laboratório (luz, bomba caseira, claymore), molotov, lança-chamas, arco, besta e ferramentas do `game-weapons`, e os explosivos do jogo (`EXP`). O documento Arsenal é atualizado |
| A2 | Dano: pontos ou joules | Arsenal usa pontos (35 para 9×19); SDK usa joules | — | ✅ 2026-10-23: joules no motor; os pontos do Arsenal são a calibragem que o repositório do jogo aplica |
| A3 | Ruído | Arsenal 150/300/600 m; SDK na mesma ordem; jogo 60/110/130 m | — | ✅ 2026-10-23: Arsenal (150 / 300 / 600 m) |
| A4 | Dano por região | Arsenal: 5 regiões, braço 45, perna 55; Galeria: braço 60, perna 80; jogo: 11 segmentos (`zDamage`) | — | ✅ 2026-10-23: 11 segmentos do jogo com a vida do Arsenal |
| A5 | Tempo de recarga | Arsenal tem tempo tático e vazio; Galeria só animação | — | ✅ 2026-10-23: **o SDK define contratos de animação** que quem plugar usa. A regra (`game-weapons`) dá as fases da arma com o tempo de cada uma (sacar, atirar, ciclar, recarga tática e com pente vazio: tirar pente, pôr pente, alimentar, pane, destravar) e emite eventos; o `-three` traz a animação padrão (a da Galeria) cumprindo o contrato, e qualquer outro renderizador pluga a sua no lugar. O tempo da regra é o do Arsenal |
| A6 | Calibre do .50 BMG | Galeria 13,0 mm; SDK 12,7 mm | 12,7 mm (medida real) | 🔁 |
| A7 | Calibres que faltam no SDK (9×18, 5,7×28, .44 Mag, .50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 WM, .408) | Só na Galeria | Entram todos | 🔁 |
| A8 | Carro e parede da Galeria | Duplicam `game-vehicles` e `game-destruction` | Não portar; usar o SDK | 🔁 |
| A9 | Catálogo de itens | Itens do Vale: 257 (o jogo embute 146); SDK já tem 92 itens domésticos | — | ✅ 2026-10-23: **catálogo único**, organizado por categorias (as 14 do time) e atributos: peso, volume e espaço na mochila, empilhável, durabilidade, validade pela idade, usos, raridade e onde aparece (achados por lugar), receitas que ligam itens. Estende o `ItemDef` do SDK; item repetido vira um só. Item do mundo real no SDK; item só da história no repositório do jogo |
| A10 | Itens sem modelo 3D (233 de 257) | Só 24 têm forma | — | ✅ 2026-10-23: checklist em `itens-modelos-3d.md` (24 de 257 têm modelo) para cobrar o time de itens; até o modelo chegar, forma simples no tamanho real |
| A11 | Explosivos e lançadores | Regra no Arsenal e no jogo; efeito no Laboratório | Regra em `game-weapons`, efeito em `game-vfx`, reação em cadeia em `game-destruction` | 🔁 |
| A12 | O jogo passa a atirar pelo SDK | Hoje embute `game-weapons` mas atira com tabelas próprias (4 armas) | Sim, depois do porte | 🔁 |

## 3. Personagens, sobreviventes e animais (Fase 4, 5 e 7)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| P1 | Base do corpo | 8 versões; proporção do guia (Elenco/Retratos: 1,80 m, ombros 0,60); execução do jogo (`buildBody`, GPU) com ombros 0,48 | — | ✅ 2026-10-23: execução do jogo (`buildBody`, `bodyAnim`, GPU, passada casada com o chão) com a proporção do guia (1,80 m, ombros 0,60 m, cabeça 1/6) |
| P2 | Bestiário de referência | O jogo cita v17 e v12; a página é v0.1 | — | ✅ 2026-10-23: **v17**, extraído de dentro do jogo e levado para o SDK como fonte própria (o jogo passa a consumir do SDK); a página v0.1 fica como histórico |
| P3 | Velocidade dos zumbis | Bestiário/jogo: Cego 0,8/3,0, Carbonizado 0,9/2,2, Afogado 0,6/2,5, Devorador 0,9/3,0; Bancada: 1,6 / 1,6 / 1,2 / 2,4; Corredor 5,5 ou 6,0 | — | ✅ 2026-10-23 (o dono pediu para decidir o que faz sentido, ajustável): **base do Bestiário** (zumbi lento 0,6–1,0 m/s, abaixo da pessoa a 1,4 m/s) com **multiplicadores por momento** que o jogo pode trocar: vagando, alerta, perseguindo, frenesi (sangue, multidão), ferido (perna perdida vira rastejo), noite e água. Os valores da Bancada viram o estado "perseguindo" dos tipos lentos. Corredor: 5,5 m/s sustentado e 6,0 na arrancada |
| P4 | Cor dos olhos | Bestiário/jogo e Bancada divergem em 4 tipos | — | ✅ 2026-10-23: Bestiário v17 |
| P5 | Zumbi nomeado | Elenco: corredor; Bestiário: sempre Fresco; Retratos: categoria por pessoa; jogo: sempre Lento | — | ✅ 2026-10-23: por pessoa, como nos Retratos, e o tipo de zumbi é **propriedade atribuída na criação do personagem** |
| P6 | Crianças viram zumbi? | Retratos: nunca; o jogo não impede | — | ✅ 2026-10-23: **podem virar** (decisão do dono no lugar da regra dos Retratos); o SDK não restringe |
| P7 | Penetração | Bestiário: 9 mm atravessa 2 corpos; jogo: modelo de custo por membro | — | ✅ 2026-10-23: **força da arma contra a resistência de cada ponto do corpo**: o calibre tem força de penetração (energia), cada um dos 11 segmentos tem resistência (osso, carne, roupa e proteção); o tiro atravessa enquanto sobra força e perde o que cada parte resistiu. Calibrado para reproduzir a tabela do Bestiário (9 mm 2 corpos, 5,56 3, .308 4) |
| P8 | Desmembramento | Dividido em 3: regra do Elenco, dinâmica do Arsenal, versão barata do jogo | Juntar os três em `game-characters` | 🔁 |
| P9 | NPCs só do jogo (Cícero, Sandra) | Não estão em Os Vivos nem nos Retratos | — | ✅ 2026-10-23: **gerador de histórias**: várias histórias escritas com papéis; nomes e quem faz cada papel sorteados na criação do mundo, com histórias que se cruzam e partidas sempre diferentes. Cícero e Sandra viram papéis. Motor genérico no SDK (novo pacote, nome a definir, ex. `game-stories`); histórias e listas de nomes do ZombiAdA no repositório do jogo |
| P10 | Animais | 13 espécies na página; o jogo usa 9, sem regra de bicho zumbi | — | ✅ 2026-10-23: as 13 espécies com os três visuais (vivo, infectado, morto) e a **regra de infecção de animal no SDK** (quem pega e como age), que o jogo liga ou desliga |
| P11 | Pacote dos 13 tipos de zumbi | — | — | ✅ 2026-10-23: `game-characters-undead` genérico no SDK, com os 13 tipos e o comportamento; nomes e histórias no repositório do jogo |
| P12 | Horda | Bancada e jogo; não existe no SDK | — | ✅ 2026-10-23: **`game-crowd` genérico** no SDK: qualquer multidão (horda, civis fugindo, manada, revoada, enxame), não só zumbi; ligado ao `game-infection` por `materialize`/`giveBack` |
| P13 | Ficha de personagem (atributos, habilidades, traços, derivados) | Documento Personagens; o jogo usa ficha fixa 5-5-5-5-5-5 | — | ✅ 2026-10-23: no SDK, junto com o gerador de histórias (sorteia na criação), e a ficha **acumula as decisões e as histórias** vividas pelo personagem, que o gerador usa para cruzar as próximas |

## 4. Casas e mapa (Fase 2 e 8)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| C1 | Versão do PlantasSDK | `game-floorplan` é porte de versão antiga; a do Visor de casas 3D (VC3) é a mais nova encontrada | — | ✅ 2026-10-23: a do Visor de casas 3D (VC3): estrutura, instalações, 5 modelos rurais e regras R01–R72 entram no `game-floorplan`, mantendo o que o SDK faz melhor (6 zonas, visor 2D, idiomas, motor de cargas) |
| C2 | Pacotes | Casa3DSDK são 3 SDKs (PlantasSDK, Casa3DSDK renderizador, AdaptadorInterativos) | — | ✅ 2026-10-23: estender `game-floorplan` + `game-floorplan-structure` + `game-floorplan-rural` + `game-floorplan-three` (desenho 3D e ponte para móveis) + `examples/floorplan-test-area` |
| C3 | Ruas, postes, bairro, relevo | Sem casa no SDK | — | ✅ 2026-10-23: no SDK, como `game-urban` (+ `-three`): ruas, calçadas, os 5 postes, padrão de bairro, quarteirão e relevo; o Vale Cinzento em si fica no repositório do jogo |
| C4 | Massas da Galeria do Vale (sobrado, laje, colonial…) | Silhuetas sem planta | — | ✅ 2026-10-23: cada tipologia vira modelo de planta real no SDK e a silhueta da Galeria é a versão de longe (LOD) |
| C5 | Interiores (delegacia, escola, igreja, posto, hospital…) | Só como cena na galeria | — | ✅ 2026-10-23: viram modelos de planta do SDK **com o interior completo**: estrutura, móveis e os itens (achados) de cada lugar, ligados ao catálogo único de itens. A lista de lugares vai crescer depois. ✅ 2026-10-23 (dono): **todos no `game-floorplan-commercial`**, comerciais e públicos. São prédios de cidade genéricos (servem a um GTA); o que é só de jogo de zumbi, como a tenda de triagem militar, entra como estado (`game-floorplan-post-apocalyptic`) ou conteúdo do jogo |
| C6 | Andares (AndaresSDK, no modo livre) | Sem casa no SDK | — | ✅ 2026-10-23: entra no `game-floorplan-three`; toda casa gerada pode ter andares e escada |
| C7 | Casa de laje com 1 a 3 andares | Galeria tem 1–3 (puxadinho vertical); `budget_slab_house` tem 1 | — | ✅ 2026-10-23: o modelo sorteia de 1 a 3 andares |
| C8 | Barraco e "gato" de luz | `service_entrance` já tem `variant: 'gato'` | — | ✅ 2026-10-23: no SDK, marcados como Brasil (região `br`), junto dos modelos rurais e populares |

## 5. Efeitos (Fase 6)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| E1 | Qual explosão vale | Laboratório ("versão final"), jogo (reduzida, com teto por área e LOD), SDK (mais fraca); prévia em `comparacoes/explosoes/` | — | ✅ 2026-10-23 (dono): **Laboratório com o teto do jogo** (6 explosões a cada 4 s por área e menos detalhe de longe). O Laboratório, bem desenhado, é o modelo da bancada de efeitos (E5) |
| E2 | Dados de fluido | Sangue seca marrom `3B1D14` em 10 min (time) ou `4A0506` em 20 min (SDK); gasolina 60 s sem marca ou 120 s com marca | — | ✅ 2026-10-23: **configurável por jogo**; o SDK traz os valores do time (Padrão de Fluidos F1–F12) como padrão, e entram no `game-fluids` o filme que escorre, o respingo por ângulo, a bile e o sangue antigo |
| E3 | Dois raios de explosão (letal e ferimento) | Em tudo do time; SDK tem um | Dados em `game-weapons`, dano em `game-characters` | 🔁 |
| E4 | Pacote | — | `game-vfx` + `game-vfx-three`; destruição, fluidos e armas passam a usá-lo | 🔁 |
| E5 | Contrato da bancada de efeitos | O `TestableModule` é centrado em item | — | ✅ 2026-10-23: ampliar o contrato genérico do módulo de teste com parâmetros, camadas e contadores; a Oficina vira módulo do `game-vfx` carregado na sala |
| E6 | Clima (chuva, neblina, raio) | Na Oficina e no jogo | — | ✅ 2026-10-23: **`game-weather` entra nesta migração**: chuva leve e forte, neblina, relâmpago, vento e **eventos extremos** (ciclone, tufão, calor intenso), ligados a fluidos (chuva espalha o sangue e impede secar), sons e efeitos |

## 6. Veículos, móveis, vegetação e jogo

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| V1 | Goldens de `seda`, `popular`, `civico` | Página de hoje = SDK; golden antigo diverge | — | ✅ 2026-10-23 (decidido por mim, a pedido do dono): regenerar o golden com a versão de hoje |
| V2 | Garagem do artefato (SDK separado e frotas novas) × v4 do site | Estruturas diferentes | — | ✅ 2026-10-23 (decidido por mim): entra tudo o que o artefato tem e o SDK não tem (frotas de aviões, barcos, helicópteros, militares); motor = SDK (igual). A comparação a fundo é a 1ª tarefa da fase de veículos |
| V3 | Modo leve de veículos | Só na Frota Leve | Entra no `game-vehicles-three` | 🔁 |
| V4 | Condução | Documento pede semi-simulação; o jogo é arcade | — | ✅ 2026-10-23 (decidido por mim): os dois como modos do SDK, arcade primeiro |
| V5 | Módulos de teste de veículos (8 itens, 11 cenários) e vegetação (18 itens, 13 cenários) | Só nas páginas | Viram `examples/vehicles-test-area` e `vegetation-test-area` | 🔁 |
| V6 | Jogador e sobrevivência (fôlego, ferida, infecção, agarrão) | Só no jogo | — | ✅ 2026-10-23 (decidido por mim): pacote genérico `game-player` |
| V7 | Câmera de ombro do jogo (amortecimento, FOV por zoom) | Melhor que `game-camera` (o `smoothing` do SDK nunca é lido) | Portar para `game-camera` | 🔁 |
| V8 | Viveiro e Sala de destruição com diferenças entre artefato e site | 106 e 175 linhas | — | ✅ 2026-10-23 (decidido por mim): juntar as duas versões mantendo o que cada uma tem a mais, depois de comparar a fundo |

## 7. Sons

Pedido do dono em 2026-10-23: os sons dos times entram no SDK. **Nenhuma entrega usa arquivo de áudio** (nenhum `.mp3`, `.ogg`, `.wav` ou
`data:audio`); tudo é sintetizado com WebAudio. O `AudioContext` que aparece em todos os artefatos é do runtime do Claude, e o das salas de
teste e da bancada de móveis é do three.js embutido, sem uso.

| Onde | Sons | Como funciona |
|---|---|---|
| Jogo, `sfx` (`artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js` L62089; igual no modo livre L66433 e no Jardim Aurora L53200) | `pistola`, `escopeta`, `fuzil`, `rifle` (escolhido pelo calibre na L68697), `impacto`, `carne`, `passo`, `vidro`, `madeira`, `recarga`, `vazio`, `explosao` | Ruído filtrado com `[frequência, volume, duração]` por som; a frequência e o volume caem com a distância |
| Jogo, `loopSet` | `motor` (dente de serra), `chuva` (ruído passa-alta), `rotor` (ruído com LFO de 11 Hz nas pás) | Sons contínuos com volume e frequência ajustáveis |
| Jogo, `voz`, `grito`, `groanBudget` | gemido do zumbi, corredor, grito rouco (três formantes; antes "soava como sirene") | Limite de vozes simultâneas |
| Jogo, `bichoSom`, `ambientAudio` | bichos e ambiente | — |
| Cena de Arte, `initAudio` (`sources/arte__cena-de-arte.js`) | gemidos e chuva | Compressor e reverb na saída |
| SDK, `game-weapons-three/src/audio.ts` | tiro pela energia do calibre, clique vazio, carregador, bomba e ferrolho, cápsula, carregador no chão | Feito em 2026-10-23, sem base nas entregas |
| SDK, `game-interactables` (`onSound`) | porta, gaveta, tampa, aba, botão, disjuntor | Só o gancho; o som fica com quem hospeda |

| # | Decisão | Recomendação | Situação |
|---|---|---|---|
| S1 | Pacote | `game-audio` genérico: síntese (ruído filtrado, osciladores, formantes), mixagem com compressor e reverb, atenuação por distância, limite de vozes e sons contínuos. Os sons de cada assunto ficam no pacote do assunto: armas no `game-weapons-three`, vozes no `game-characters-three`, bichos no `game-animals-three`, motor e rotor no `game-vehicles-three`, chuva no futuro clima | ✅ 2026-10-23 (decidido por mim): `game-audio` genérico; sons de cada assunto no pacote do assunto |
| S2 | Som de tiro | — | ✅ 2026-10-23: juntar a classe e o abafamento por distância do jogo com a energia do calibre do SDK |
| S3 | Igual ao original | O golden do som compara os parâmetros gerados (frequência, volume, duração, filtros) para cada evento com semente fixa, já que não dá para comparar áudio por hash | 🔁 G3 |

## 8. Itens a verificar

- **Concreto armado e tijolo na destruição** (apontado pelo dono em 2026-10-23): um dos artefatos destrói estrutura de concreto armado e
  alvenaria de tijolo com o comportamento certo, mas isso não aparece aplicado nas casas, **nem nos cenários de teste**, onde deveria.
  Verificar qual artefato (provável Sala de testes de destruição ou área de casas), portar para `game-destruction` como material e
  regra, e usar nas casas (`game-floorplan-structure`) e nos cenários.
- **Partículas de explosão do SDK** sem aparecer na comparação (ver `comparacoes/explosoes/README.md`).
- **Jogo publicado como "versão atual"** quebra ao carregar (`GameVegetation` ausente); a versão do site é a completa.

## 9. Melhorias apontadas

Além de portar, o que encontrei para melhorar (em ordem de impacto):

1. **Partículas de explosão do SDK não aparecem** (`game-destruction-three`): a camada de fogo e clarão fica vazia e a fumaça não desenha na
   comparação. Corrigir junto com a troca para a explosão do Laboratório.
2. **Lixo de memória por quadro nas partículas do SDK** (`particles.ts` L294-295, dois arrays por partícula por quadro em `hexToRgb`):
   trocar por cor pré-calculada.
3. **`game-camera` ignora o `smoothing`**: a câmera de ombro do jogo tem amortecimento e FOV por zoom. Portar e ligar o parâmetro.
4. **Goldens de `game-vehicles-fleet` velhos**: regenerar (V1) para o CI voltar a ficar verde.
5. **Jogo publicado quebrado** (artefato "versão atual" sem `GameVegetation`): avisar o time de jogo; a versão do site é a completa.
6. **O jogo embute SDKs sem usar** (`GameTestRoom`, `GameWeapons`, `GameDestruction*`, `GameFluids*`) e atira com tabelas próprias: quando
   o porte de armas terminar, o jogo passa a usar o `game-weapons`.
7. **Itens sem tamanho real** (a vitrine normaliza tudo para 1,55 de altura): o catálogo ganha dimensões em metros.
8. **Fluido da Oficina na CPU** (sobe a textura inteira a cada quadro): no SDK, simular só perto do jogador ou passar para a GPU.
9. **Sorteio sem semente nas entregas** (`Math.random` e estado global): todo porte troca por semente (G3), o que também deixa os
   resultados repetíveis para teste.
10. **Corpo com 8 versões**: depois do `game-characters`, as páginas dos times passam a montar a partir dele, para não divergirem de novo.
11. **README de `game-fluids` com import errado**: o exemplo importa `DamageEvent`, que não existe; o certo é `DestructionEvent` (evento `leak`).
12. **README de `game-weapons` diz "sem marcas"**: atualizar quando as marcas reais entrarem (G5).
13. **README de `game-vehicles-fleet`** mostra `kit.build(...).group`; o objeto real tem `root`.
14. **`game-vegetation-species`** diz "~90 espécies" no `package.json`; o catálogo tem 71.
15. **Veículos e vegetação sem ambiente de teste** em `examples/` (previstos em V5).
