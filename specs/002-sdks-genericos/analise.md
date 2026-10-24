# O que pode virar SDK genérico e customizável

Análise de 24/10/2026 sobre o `adatechnology-game-kit` (36 pacotes) e o jogo ZombiAdA (repositório `zombiada` e a pasta
`zombiada` do computador). É um documento de planejamento: nada foi implementado. Na fila de execução, este trabalho vem
**depois** da migração (fases 5 a 8 e o `game-shapes`).

## Resumo

- **O kit já cobre bem o conteúdo**: armas, itens, personagens, zumbis, animais, casas, móveis, veículos, vegetação, destruição
  e fluidos já seguem o padrão motor + pacote de conteúdo + adaptador `-three`, com registro (incluir, alterar, remover) e locale.
- **O jogo quase não usa o kit.** O `zombiada-modo-livre.html` embute cópias próprias (Casa3DSDK, PlantasSDK, Moveis3DSDK,
  AndaresSDK, CameraModosSDK, ModoLivreSDK e uma VehicleSDK r128 antiga) e chama poucas funções dos pacotes `Game*` que leva junto.
  Personagens, animais, itens, infecção, veículos, câmera e floorplan do kit **não são usados** pelo jogo.
- **Os sistemas mais valiosos ainda estão presos no código do jogo**: a horda (6.000 zumbis, campo de fluxo, hash espacial,
  ruído), o jogador (fôlego, ferida, fome, sede, sono), o inventário, a vida dos NPCs ("Vale vivo"), dia e noite, chuva, rádio,
  objetivos, carro dirigível, áudio sintetizado e a ferramenta de orçamento de desempenho. Todos passam no teste do GTA.
- **Faltam pacotes que nem estão no plano**: rede LAN, salvar e carregar, entrada (teclas e controle), tempo do mundo (relógio e
  calendário), navegação, interface (HUD), missões e diálogo.
- **Falta um contrato único de customização.** Cada pacote resolve opções, registro e plugin do seu jeito. Padronizar isso no
  `game-contracts` antes de criar pacotes novos evita retrabalho, e é o que prepara rede e save (tudo serializável e com semente).

## 1. O que já é SDK

| Família | Pacotes | Customização que já existe | O que falta |
|---|---|---|---|
| Contratos | `game-contracts` | `TestableModule`, `deepMerge`, `mergeById`, `applyPatches`, `removeIds` | Virar o contrato único de customização (seção 4) |
| Armas | `game-weapons`, `-three` | registro, `rules.ts`, calibres como dado, acessórios por encaixe, locale | Sons saem para `game-audio`; textos em pt fora do locale (2 arquivos) |
| Itens | `game-items`, `-goods`, `-three` | registro com patch/remove/include, regras sobrescrevíveis, receitas | Inventário do jogador (mochila, peso, slots) e interface |
| Personagens | `game-characters`, `-people`, `-uniformed`, `-undead`, `-three` | presets, packs, regras de dano, hooks no `-undead` | O jogo não usa; corpo do jogo é uma cópia |
| Animais | `game-animals`, `-species`, `-three` | registro de espécies, `outbreak` opcional | Comportamento (manada, companheiro, urubu) vai para `game-crowd`/IA |
| Casas | `game-floorplan`, `-residential`, `-commercial`, `-rural`, `-structure`, `-post-apocalyptic` | estados como plugin, `register(engine, options)`, regiões | `game-floorplan-three` (o Casa3DSDK é o renderer que falta) |
| Interativos | `game-interactables`, `-household`, `-three`, `game-props3d` | partes, recipientes, rede elétrica, gás, água | Ligar ao inventário e ao save |
| Veículos | `game-vehicles`, `-fleet` | packs, plugins, `registerLocale` | Controle de direção (o carro arcade do jogo) |
| Vegetação | `game-vegetation`, `-species` | espécies em JSON, mixes regionais | Área de teste (Viveiro) |
| Destruição e fluidos | `game-destruction`, `-three`, `game-fluids`, `-three` | materiais em JSON, serializável | Efeitos do jogo (explosão, fogo) ainda não usam |
| Surto | `game-infection` | parâmetros por opção, eventos de estágio | O "Antes do Dia 1" faz o mesmo de outro jeito |
| Ferramentas | `game-camera`, `game-devtools`, `game-test-room` | opções, locale, cenários | Câmera de ombro do jogo, ModoLivreSDK, orçamento de desempenho |

## 2. Cópias dentro do jogo que já são genéricas

Estes blocos dizem no próprio comentário que "não conhecem nenhum jogo". Eles devem ir para o kit **ou** ser trocados pelo
pacote que já existe. Comparar com golden antes de trocar.

| No jogo | Destino no kit | Ação |
|---|---|---|
| Casa3DSDK (paredes com vãos, telhado, escada, elevador, fiação, água, coleta de colisão) | novo `game-floorplan-three` | **Portar** (é o renderer que falta) |
| PlantasSDK (planta com semente) | `game-floorplan*` | Comparar e trocar pelo kit |
| Moveis3DSDK (móveis e estado da casa) | `game-props3d`, `game-interactables-household` | Comparar e trocar |
| AndaresSDK (andares, escadas, colisores) | `game-floorplan` (andares) + `-three` | Portar o que faltar |
| CameraModosSDK | `game-camera` | Igualar e trocar (é a T7.4) |
| ModoLivreSDK (voo livre, marcas, `__cenario`) | `game-devtools` | Portar o que faltar |
| VehicleSDK r128 + frota | `game-vehicles`, `-fleet` | Trocar (o kit já é a versão nova) |
| Corpo arredondado com animação na GPU | `game-characters-three` | Trocar |

## 3. Sistemas presos no jogo que devem virar SDK

Ordem por valor para outros jogos. "Genérico" é o que vai ao pacote; "fica no jogo" é o conteúdo que o ZombiAdA registra.

| Sistema no jogo | Pacote | Genérico (vai ao kit) | Fica no jogo | No plano? |
|---|---|---|---|---|
| Horda: SoA de 6.000, faixas de relevância, decisão por tick | `game-crowd` | multidão de qualquer coisa (horda, pedestres, trânsito, manada, revoada), orçamento por faixa | tipos de zumbi e habilidades (pirâmide, piscina) via `-undead` | T8.1 |
| Campo de fluxo 0,5 m, hash espacial, ruído | `game-navigation` | campo de fluxo, grade, hash espacial, estímulos (som, luz, cheiro) | nada | **não** |
| Jogador: ficha, fôlego, ferida, infecção, agarrão | `game-player` | atributos, fôlego, ferimentos, efeitos contínuos | a infecção que vira zumbi (plugin do `-undead`) | T8.3 |
| Fome, sede, sono | `game-player` (plugin `needs`) | necessidades como dado (taxa, limites, efeitos) | valores do jogo | **não** |
| Inventário, mochila, achados, tecla E | `game-inventory` | slots, peso, empilhar, recipientes, troca | tabelas `FIXOS`/`CASA_REQ` | **não** |
| Vale vivo: tick diário, relações, destino | `game-life` | simulação de NPCs (agenda, necessidade, relação, destino) por regras | pessoas nomeadas, histórias | parcial (T8.2) |
| Rádio das 20h, diário, chamadas | `game-dialogue` | falas agendadas, diário, gatilhos | falas da Helena, Nelson, Jéssica | **não** |
| Objetivos (sinalizador, 15 min, laje da Casa 8, resgate) | `game-quests` | objetivos, condições, relógio, recompensas | missões do jogo | **não** |
| Dia e noite, luzes de rua por perto | `game-time` + `game-weather` | relógio, calendário, sol e lua, orçamento de luzes | horário de início | T6.2 (só clima) |
| Chuva | `game-weather` | chuva, neblina, vento, ligados a fluidos e som | nada | T6.2 |
| Explosão, molotov, M67, fogo residual, barril | `game-vfx` + `game-destruction` | pools sem alocação, explosões por dado | nada | T5.1 |
| Som sintetizado e ambiente | `game-audio` | síntese, mixagem, distância, limite de vozes | trilha | T6.1 |
| Pointer lock, teclas, modos | `game-input` | ações nomeadas, remapeamento, teclado, mouse, controle | mapa de teclas padrão | **não** |
| HUD, mensagens, marcadores | `game-ui` | HUD por widgets, mensagens, marcador de acerto | visual do jogo | **não** |
| Orçamento (draw calls, timer de GPU, anel de quadros) | `game-devtools` | painel de desempenho | nada | **não** |
| Carro arcade (atropelar, bater) | `game-vehicles` (controle) | direção arcade e simulada por opção | nada | **não** |
| Gerador do mapa, terreno, bairro | `game-urban` + `game-terrain` | ruas, quarteirões, relevo com semente | Vale Cinzento, Jardim Aurora | T7.3 |
| Rede LAN (só projeto, sem código) | `game-net` | host autoritativo, snapshots quantizados, 30 Hz, 4 a 8 clientes | nada | **não** |
| Salvar e carregar (quase inexistente) | `game-save` | snapshot de todos os pacotes, versão, migração | nada | **não** |

Conteúdo **só do ZombiAdA**, que fica no jogo: Vale Cinzento, Jardim Aurora, Mansão Valverde, rua das Palmeiras, Casa 8, os
sobreviventes nomeados e suas falas, o Bestiário como arte do jogo, objetivos da campanha, dados do mapa
(`mundo-terreno.json`, `padrao-urbano.json`, `itens-destrutiveis.json`) e o guia de estilo.

## 4. O contrato único de customização

Hoje cada pacote resolve isso do seu jeito. A proposta é fixar no `game-contracts` (só tipos e ajudantes, nada de domínio) um
formato que todo pacote novo segue e que os antigos adotam aos poucos.

1. **Fábrica com padrão completo**: `createX(options)`. Tudo tem valor padrão, e `options` é um `DeepPartial` mesclado com
   `deepMerge`. Valor fixo no código só para constante física.
2. **Catálogo por registro**: `include`, `patch`, `remove` por id em todo catálogo (já existe em `registry.ts`; virar regra).
3. **Pacotes de conteúdo em JSON com esquema**: cada pacote publica o JSON Schema do seu dado, para validar o que outro jogo
   escreve e para ferramentas de edição.
4. **Plugins com ganchos nomeados**: `use(plugin)` com `before`/`after` em pontos fixos (ex.: `crowd.decide`, `player.damage`,
   `life.dailyTick`). Gênero (apocalipse, GTA, fantasia) entra como plugin, nunca como `if` no núcleo.
5. **Eventos**: `on(nome, fn)` com payload tipado, para o jogo e os outros SDKs reagirem (som ouve tiro, horda ouve som).
6. **Locale e região como dado**: `registerLocale(lang, json)` e `regions/<id>.json`. Hoje só existe `br`; criar um `default`
   neutro para que a região seja opcional.
7. **Determinismo**: toda aleatoriedade passa por `createRng(seed)`. Já é assim em vários pacotes; virar regra.
8. **Serializar e restaurar**: `serialize()` e `restore(state)` em todo pacote com estado. É a base do `game-save` e do
   `game-net`. Sem isso, rede e save viram reescrita depois.
9. **Orçamento e qualidade**: `quality: 'low' | 'medium' | 'high'` e limites numéricos (vozes, partículas, agentes, luzes) por
   opção, para o mesmo pacote servir LAN fraca e PC forte.
10. **Núcleo sem three.js; forma pelo `game-shapes`**: o núcleo descreve, o `game-shapes` (da outra frente) gera geometria, e o
   `-three` só desenha. Pacotes que passam a descrever forma em JSON: `props3d`, `items-three`, `weapons-three`, `vegetation`,
   `vehicles`, `interactables-three`, `characters-three` e o novo `floorplan-three`.
11. **Área de teste por pacote**: `examples/<lib>-test-area` com `?area=`, como já manda o CLAUDE.md.

## 5. Limpezas pequenas no kit

- Comentários de origem com "Vale Cinzento", "Bestiário", "Bichos do Vale" em ~45 arquivos de `src` (sobretudo
  `items-three/src/models`). Não é código, mas o núcleo não deve falar do jogo: mover a procedência para um `PROVENANCE.md` por
  pacote.
- Textos em português fora do locale em `weapons-three` (2 arquivos), `characters-three` (2), `items-three`, `animals-three`,
  `vehicles-fleet` (1 cada).
- `game-items/src/rules.ts` usa números da tabela do time como padrão. Está certo como padrão, mas deve ficar claro que é
  sobrescrevível.
- `game-vehicles` e `-fleet` (cerca de 40 mil linhas) dependem de three.js já no núcleo; separar um núcleo sem three e um
  `game-vehicles-three`, como nos outros pacotes.
- Três versões de three.js nas páginas (r128, r160 e a do modo livre). Fixar uma versão mínima no kit.
- O `tasks.md` da spec 001 não marca o que já foi feito; atualizar junto com o fim da migração.

## 6. Ordem sugerida (depois da migração)

1. **Contrato único** no `game-contracts` (seção 4) e as limpezas da seção 5. É pequeno e vale para tudo o que vem depois.
2. **`game-shapes`** e adoção pelos pacotes (já com a outra frente).
3. **O jogo passa a usar o kit**: trocar as cópias da seção 2 pelos pacotes e portar o Casa3DSDK como `game-floorplan-three`.
   É o maior ganho, porque prova que o kit serve a um jogo de verdade.
4. **`game-time`**, depois `game-weather` e `game-audio` (fase 6). Muitos dependem do relógio: validade de itens, agenda de NPC,
   rádio, luzes.
5. **`game-navigation` e `game-crowd`** a partir da horda do jogo (fase 8), com pedestres e trânsito como segundo uso.
6. **`game-player`** com o plugin de necessidades, e **`game-inventory`**.
7. **`game-life`, `game-dialogue` e `game-quests`** a partir do Vale vivo, do rádio e dos objetivos.
8. **`game-input` e `game-ui`**.
9. **`game-save`**, depois **`game-net`** (LAN, host autoritativo, como no projeto de rede da revisão final).
10. **`game-urban` e `game-terrain`** (fase 7), usando casas, veículos, vegetação e multidão.

## 7. Pontos em aberto

- **Onde está o código-fonte do jogo?** O portal aponta `implementacao/jogo-web/src/NN-*.js` e `build.py`, mas isso não está em
  nenhum dos dois repositórios nem na pasta `zombiada` do computador. Só existem as páginas já montadas. Dá para extrair dos
  arquivos montados, mas com a fonte é mais seguro.
- Nomes dos pacotes novos (`game-life`, `game-navigation`, `game-time` etc.) são sugestão; confirmar antes de criar.
