# Consolidado da migração — decisões por parte

Junta os 5 relatórios de `inventario/` e a comparação de versões de `fontes.md`. São 71 dúvidas nos relatórios; muitas são a mesma
pergunta vista por frentes diferentes. Aqui ficam agrupadas: primeiro as **decisões gerais** (uma resposta resolve várias), depois as
**decisões de dados por parte**, na ordem da migração. Cada uma traz o que as fontes dizem e a recomendação.

Legenda: ✅ decidido (data e resposta), ⏳ aguardando o dono, 🔁 decidido pela regra do projeto (`CLAUDE.md`), sem precisar perguntar.

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
| G1 | **Qual versão do jogo é a referência** | Modo livre é o mais novo (andares, bichos, Jardim das Palmeiras, Casa3DSDK, câmera); Jardim Aurora é a fatia v7 da revisão final, com casas à mão | Modo livre | ⏳ |
| G2 | **Onde mora o conteúdo do ZombiAdA** (nomes, histórias, sangue, marca "horda", catálogo de itens, Vale Cinzento) | O CLAUDE.md pede só que fique fora do motor | Pacotes `*-zombiada` dentro do game-kit (`game-weapons-zombiada`, `game-characters-zombiada`…), publicados como os outros | ⏳ |
| G3 | **Como medir "igual ao original"** | As páginas usam `Math.random` e estado global; o SDK exige semente | Trocar o sorteio por semente e medir pela sequência de eventos e pelo hash da cena com semente fixa, não por pixel | ⏳ |
| G4 | **Nomes no código** | Times escreveram em português (`civico`, `brutamonte`); a regra de código pede inglês | Identificadores em inglês; textos em pt-BR pelo locale | 🔁 regra de código |
| G5 | **Marcas reais de armas** (Glock, Taurus, AK) | O próprio Arsenal (§09) avisa que marca registrada pode pedir licença | Motor e dados com arquétipos genéricos; marcas reais no pacote de conteúdo do ZombiAdA, trocáveis | ⏳ |
| G6 | **three.js r128 → 0.160** | Páginas usam r128 e addons; o SDK usa ^0.160 | Portar para 0.160 (o addon `RoundedBoxGeometry` vira dependência dos `-three`) | 🔁 pacote do SDK |

## 2. Armas e itens (Fase 1 e 3)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| A1 | Lista de armas | Arsenal: 67; Galeria: 71 de fogo + 4 que o documento não tem (PSG-1, SSG 69, MRAD, M200) + 6 lançadores | Entram todas as da Galeria; o documento é atualizado | ⏳ |
| A2 | Dano: pontos ou joules | Arsenal usa pontos (35 para 9×19); SDK usa joules | Joules no motor; os pontos ficam como calibração no conteúdo do ZombiAdA | ⏳ |
| A3 | Ruído | Arsenal 150/300/600 m; SDK na mesma ordem; jogo 60/110/130 m | Arsenal | ⏳ |
| A4 | Dano por região | Arsenal: 5 regiões, braço 45, perna 55; Galeria: braço 60, perna 80; jogo: 11 segmentos (`zDamage`) | 11 segmentos do jogo (é o mais completo: calibre, capacete, colete) com a vida do Arsenal | ⏳ |
| A5 | Tempo de recarga | Arsenal tem tempo tático e vazio; Galeria só animação | A regra é do Arsenal; a animação se ajusta ao tempo da regra | ⏳ |
| A6 | Calibre do .50 BMG | Galeria 13,0 mm; SDK 12,7 mm | 12,7 mm (medida real) | 🔁 |
| A7 | Calibres que faltam no SDK (9×18, 5,7×28, .44 Mag, .50 AE, 5,45×39, .30-30, 7,62×54R, .30-06, .300 WM, .408) | Só na Galeria | Entram todos | 🔁 |
| A8 | Carro e parede da Galeria | Duplicam `game-vehicles` e `game-destruction` | Não portar; usar o SDK | 🔁 |
| A9 | Catálogo de itens | Itens do Vale: 257 (o jogo embute 146); SDK já tem 92 itens domésticos | Porte parte dos 257; `game-items` estende o `ItemDef` do SDK, sem duplicar | ⏳ |
| A10 | Itens sem modelo 3D (233 de 257) | Só 24 têm forma | Ficam com a forma simples do SDK até o time entregar modelo | ⏳ |
| A11 | Explosivos e lançadores | Regra no Arsenal e no jogo; efeito no Laboratório | Regra em `game-weapons`, efeito em `game-vfx`, reação em cadeia em `game-destruction` | 🔁 |
| A12 | O jogo passa a atirar pelo SDK | Hoje embute `game-weapons` mas atira com tabelas próprias (4 armas) | Sim, depois do porte | 🔁 |

## 3. Personagens, sobreviventes e animais (Fase 4, 5 e 7)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| P1 | Base do corpo | 8 versões; proporção do guia (Elenco/Retratos: 1,80 m, ombros 0,60); execução do jogo (`buildBody`, GPU) com ombros 0,48 | Execução do jogo com a proporção do guia | ⏳ |
| P2 | Bestiário de referência | O jogo cita v17 e v12; a página é v0.1 | v17 (embutido no jogo) | ⏳ |
| P3 | Velocidade dos zumbis | Bestiário/jogo: Cego 0,8/3,0, Carbonizado 0,9/2,2, Afogado 0,6/2,5, Devorador 0,9/3,0; Bancada: 1,6 / 1,6 / 1,2 / 2,4; Corredor 5,5 ou 6,0 | Bestiário v17 | ⏳ |
| P4 | Cor dos olhos | Bestiário/jogo e Bancada divergem em 4 tipos | Bestiário v17 | ⏳ |
| P5 | Zumbi nomeado | Elenco: corredor; Bestiário: sempre Fresco; Retratos: categoria por pessoa; jogo: sempre Lento | Retratos (por pessoa) | ⏳ |
| P6 | Crianças viram zumbi? | Retratos: nunca; o jogo não impede | Nunca (regra dos Retratos) | ⏳ |
| P7 | Penetração | Bestiário: 9 mm atravessa 2 corpos; jogo: modelo de custo por membro | Modelo do jogo, calibrado para bater com o Bestiário | ⏳ |
| P8 | Desmembramento | Dividido em 3: regra do Elenco, dinâmica do Arsenal, versão barata do jogo | Juntar os três em `game-characters` | 🔁 |
| P9 | NPCs só do jogo (Cícero, Sandra) | Não estão em Os Vivos nem nos Retratos | Entram no conteúdo | ⏳ |
| P10 | Animais | 13 espécies na página; o jogo usa 9, sem regra de bicho zumbi | Portar as 13 com o visual de infectado; regra de jogo depois | ⏳ |
| P11 | Pacote dos 13 tipos de zumbi | — | `game-characters-undead` genérico (serve a outro jogo de zumbi); nomes e histórias no conteúdo | ⏳ |
| P12 | Horda | Bancada e jogo; não existe no SDK | Pacote próprio `game-crowd`, ligado ao `game-infection` por `materialize`/`giveBack` | ⏳ |

## 4. Casas e mapa (Fase 2 e 8)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| C1 | Versão do PlantasSDK | `game-floorplan` é porte de versão antiga; a do Visor de casas 3D (VC3) é a mais nova encontrada | VC3 | ⏳ |
| C2 | Pacotes | Casa3DSDK são 3 SDKs (PlantasSDK, Casa3DSDK renderizador, AdaptadorInterativos) | Estender `game-floorplan` + `game-floorplan-structure` + `game-floorplan-rural` + `game-floorplan-three` + `examples/floorplan-test-area` | ⏳ |
| C3 | Ruas, postes, bairro, relevo | Sem casa no SDK | `game-urban` (+ `-three`) | ⏳ |
| C4 | Massas da Galeria do Vale (sobrado, laje, colonial…) | Silhuetas sem planta | LOD distante dos modelos reais, não modelo principal | ⏳ |
| C5 | Interiores (delegacia, escola, igreja, posto, hospital…) | Só como cena na galeria | Viram modelos de planta do SDK | ⏳ |
| C6 | Andares (AndaresSDK, no modo livre) | Sem casa no SDK | Entra no `game-floorplan-three` | ⏳ |

## 5. Efeitos (Fase 6)

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| E1 | Qual explosão vale | Laboratório ("versão final"), jogo (reduzida, com teto por área e LOD), SDK (mais fraca) | Laboratório + teto e LOD do jogo | ⏳ |
| E2 | Dados de fluido | Sangue seca marrom `3B1D14` em 10 min (time) ou `4A0506` em 20 min (SDK); gasolina 60 s sem marca ou 120 s com marca | Time | ⏳ |
| E3 | Dois raios de explosão (letal e ferimento) | Em tudo do time; SDK tem um | Dados em `game-weapons`, dano em `game-characters` | 🔁 |
| E4 | Pacote | — | `game-vfx` + `game-vfx-three`; destruição, fluidos e armas passam a usá-lo | 🔁 |
| E5 | Contrato da bancada de efeitos | O `TestableModule` é centrado em item | Ampliar o contrato genérico com parâmetros, camadas e contadores | ⏳ |
| E6 | Clima (chuva, neblina, raio) | Na Oficina e no jogo | `game-weather` futuro; fora desta fase | ⏳ |

## 6. Veículos, móveis, vegetação e jogo

| # | Decisão | O que as fontes dizem | Recomendação | Situação |
|---|---|---|---|---|
| V1 | Goldens de `seda`, `popular`, `civico` | Página de hoje = SDK; golden antigo diverge | Regenerar o golden com a versão de hoje | ⏳ |
| V2 | Garagem do artefato (SDK separado e frotas novas: aviões, barcos, helicópteros, militares) × v4 do site | Estruturas diferentes; não comparadas a fundo | Comparar a fundo antes de decidir | ⏳ |
| V3 | Modo leve de veículos | Só na Frota Leve | Entra no `game-vehicles-three` | 🔁 |
| V4 | Condução | Documento pede semi-simulação; o jogo é arcade | Arcade agora, semi-simulação depois | ⏳ |
| V5 | Módulos de teste de veículos (8 itens, 11 cenários) e vegetação (18 itens, 13 cenários) | Só nas páginas | Viram `examples/vehicles-test-area` e `vegetation-test-area` | 🔁 |
| V6 | Jogador e sobrevivência (fôlego, ferida, infecção, agarrão) | Só no jogo | Pacote `game-player` | ⏳ |
| V7 | Câmera de ombro do jogo (amortecimento, FOV por zoom) | Melhor que `game-camera` (o `smoothing` do SDK nunca é lido) | Portar para `game-camera` | 🔁 |
| V8 | Viveiro e Sala de destruição com diferenças entre artefato e site | 106 e 175 linhas | Comparar a fundo; vale a mais nova | ⏳ |
