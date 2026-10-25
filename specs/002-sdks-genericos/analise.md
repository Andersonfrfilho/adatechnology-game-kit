# O que pode virar SDK genérico e customizável

Análise do `adatechnology-game-kit` e do jogo ZombiAdA (fonte em `implementacao/jogo-web/`, páginas no repositório `zombiada`).
Primeira versão em 24/10/2026; **revista em 25/10/2026** depois que a migração das fases 5 a 8 e o `game-shapes` entraram no
`main` (o kit passou de 36 para 54 pacotes). É um documento de planejamento: nada aqui foi implementado por ele.

## Resumo

- **A migração resolveu boa parte da lista de 24/10.** Já estão no `main`: `game-crowd` (a horda do jogo), `game-player`,
  `game-stories` (vida dos NPCs e histórias), `game-weather`, `game-audio`, `game-vfx`, `game-urban`, `game-vehicles-driving`
  (o carro do jogo), `game-floorplan-three` (o renderer de casas que faltava), `game-shapes` e os adaptadores `-three`.
- **O jogo ainda não usa a maior parte do kit.** A fonte do jogo (cerca de 8.700 linhas em `src/NN-*.js`) continua com sua
  própria horda, jogador, NPCs, efeitos e carro, e embute cópias de casas, plantas, móveis e câmera em `sdk/`. Trocar essas
  partes pelos pacotes é agora **o maior ganho e o próximo passo**.
- **Ainda faltam pacotes**: inventário do jogador, objetivos e missões, rádio e falas agendadas, entrada (teclas e controle),
  HUD, relógio e calendário do mundo, terreno, salvar e carregar e rede LAN.
- **Falta um contrato único de customização.** Os pacotes novos seguem bem o padrão (registro, opções, semente, "knows nothing
  about any game"), mas cada um do seu jeito. Salvar o estado aparece com nomes diferentes (`save`/`load`, `setState`, `serialize`,
  `snapshot`) e falta em pacotes como `game-crowd` e `game-weather`. Sem um formato comum, save e rede viram reescrita.

## 1. O que já é SDK (main em 25/10)

| Família | Pacotes | Observação |
|---|---|---|
| Contratos e forma | `game-contracts`, `game-shapes`, `game-shapes-three` | `registry.ts` (deepMerge, mergeById, patches, remove); forma em JSON, sem three, para Worker |
| Armas | `game-weapons`, `-three` | calibres como dado, acessórios, falhas, recarga por fases |
| Itens | `game-items`, `-goods`, `-three` | registro, regras sobrescrevíveis, receitas, peso de carga |
| Personagens | `game-characters`, `-people`, `-uniformed`, `-undead`, `-three` | zumbi como camada à parte (`-undead`) |
| Animais | `game-animals`, `-species`, `-three` | espécies por registro |
| Multidão | `game-crowd`, `-three` | horda, civis, manada e revoada; campo de fluxo, percepção, ponte com `game-infection` |
| Jogador | `game-player` | vitais, fôlego, ferida, infecção opcional, agarrão, ruído de passo, pânico |
| Histórias | `game-stories` | papéis, histórias como dado, crônica, ficha, simulação de vida |
| Surto | `game-infection` | port 1:1 do `sdk/contagio` do jogo (bit a bit igual) |
| Casas | `game-floorplan` e `-residential`, `-commercial`, `-rural`, `-structure`, `-post-apocalyptic`, `-interactables`, `-three` | estados como plugin; estrutura real; renderer e navegador de andares |
| Interativos | `game-interactables`, `-household`, `-three`, `game-props3d` | partes, recipientes, energia, gás, água |
| Veículos | `game-vehicles`, `-fleet`, `-three`, `-driving` | direção arcade e semi-simulada sem three |
| Cidade | `game-urban`, `-three` | ruas, calçadas, 5 postes com orçamento de luz, quarteirões |
| Vegetação | `game-vegetation`, `-species`, `-three` | Viveiro como módulo de teste |
| Efeitos | `game-vfx`, `-three`, `game-destruction`, `-three`, `game-fluids`, `-three` | 16 perfis de explosão, pools, LOD por distância |
| Clima e som | `game-weather`, `-three`, `game-audio` | Markov de clima, fórmula dia e noite; som como dado, limite de vozes |
| Ferramentas | `game-camera`, `game-devtools`, `game-test-room` | sala de testes com `loadModule` |

## 2. O jogo passa a usar o kit

A fonte do jogo e o pacote correspondente. Cada troca é comparar com golden, trocar e apagar a cópia.

| No jogo (`src/` ou `sdk/`) | Linhas | Pacote do kit |
|---|---|---|
| `40-horde.js`, `45-abilities.js` | 466 + 222 | `game-crowd`, `-three`, `game-characters-undead` |
| `60-player.js` | 337 | `game-player` |
| `75-vale.js`, `80-npc.js` | 761 + 262 | `game-stories` |
| `50-fx.js`, `55-explosions.js` | 312 + 365 | `game-vfx`, `-three` |
| `82-car.js`, `34/35-frota*.js` | 101 + 69 | `game-vehicles-driving`, `-three`, `-fleet` |
| `36/37-bichos*.js` | 567 | `game-animals`, `-three` |
| `30-body.js`, `31-retrato.js`, `32-bestiario.js`, `33-bake.js` | 737 | `game-characters`, `-three` |
| `25-interiors.js`, `26-casa.js`, `27-casa3d-jogo.js`, `46-andares-jogo.js`; `sdk/casa3d`, `sdk/plantas`, `sdk/moveis3d`, `sdk/andares` | 1.700 + 8.900 | `game-floorplan*`, `game-floorplan-three`, `game-props3d` |
| `47-palmeiras.js`, `22-galeria.js`, `23-cenarios.js` | 1.600 | `game-urban`, `-three` (o que for genérico) |
| `91-camera.js`, `sdk/camera` | 103 | `game-camera` |
| `sdk/contagio` | 141 | `game-infection` (em andamento na frente do surto gradual) |
| chuva e dia e noite em `70-hud.js` | parte | `game-weather`, `-three` |
| sons sintetizados | parte | `game-audio` |

## 3. Sistemas que ainda não têm pacote

| Sistema no jogo | Pacote sugerido | Genérico (vai ao kit) | Fica no jogo |
|---|---|---|---|
| Inventário, mochila, tecla E (`65-inventory.js`, 198) | `game-inventory` | slots, peso (usa `game-items`), empilhar, recipientes, troca | tabelas `FIXOS`/`CASA_REQ` |
| Objetivos (`85-objectives.js`, 140) | `game-quests` | objetivos, condições, prazos, recompensas, encadeamento | missões da campanha |
| Rádio das 20h, diário, chamadas | `game-dialogue` (ou dentro do `game-stories`) | falas agendadas, diário, gatilhos por hora e por flag | falas da Helena, Nelson, Jéssica |
| Fome, sede, sono | plugin `needs` do `game-player` | necessidades como dado (taxa, limites, efeitos) | valores do jogo |
| Relógio e calendário | `game-time` (ou no `game-contracts`) | hora do mundo única para clima, validade de itens, agenda de NPC, rádio | horário de início |
| Entrada: pointer lock, teclas, modos | `game-input` | ações nomeadas, remapeamento, teclado, mouse, controle | mapa de teclas padrão |
| HUD, mensagens, marcadores (`70-hud.js`, 199) | `game-ui` | HUD por widgets, mensagens, marcador de acerto, mapa | visual do jogo |
| Orçamento de desempenho (timer de GPU, draw calls, anel de quadros) | `game-devtools` | painel de desempenho único (hoje cada `-three` conta draw calls sozinho) | nada |
| Terreno e relevo do Vale | `game-terrain` | relevo com semente, cores por vértice, junção com `game-urban` | o Vale Cinzento |
| Salvar e carregar (quase inexistente) | `game-save` | snapshot de todos os pacotes, versão, migração | nada |
| Rede LAN (só projeto, sem código) | `game-net` | host autoritativo, snapshots quantizados a 30 Hz, 4 a 8 clientes | nada |

Conteúdo **só do ZombiAdA**, que fica no jogo: Vale Cinzento, Jardim Aurora, Mansão Valverde, rua das Palmeiras, Casa 8, os
sobreviventes nomeados e suas falas, o Bestiário como arte do jogo, objetivos da campanha, dados em `dados/` e no mapa
(`mundo-terreno.json`, `padrao-urbano.json`, `itens-destrutiveis.json`) e o guia de estilo.

## 4. O contrato único de customização

Fixar no `game-contracts` (só tipos e ajudantes, nada de domínio) um formato que todo pacote segue:

1. **Fábrica com padrão completo**: `createX(options)`, com `options` em `DeepPartial` mesclado por `deepMerge`. Valor fixo só
   para constante física.
2. **Catálogo por registro**: `include`, `patch`, `remove` por id em todo catálogo (já existe em `registry.ts`; virar regra).
3. **Conteúdo em JSON com esquema**: cada pacote publica o JSON Schema do seu dado, para validar o que outro jogo escreve.
4. **Plugins com ganchos nomeados**: `use(plugin)` com `before`/`after` em pontos fixos (ex.: `crowd.decide`, `player.damage`,
   `stories.dailyTick`). Gênero entra como plugin, nunca como `if` no núcleo.
5. **Eventos tipados**: `on(nome, fn)`, para os pacotes conversarem (o `game-audio` ouve o tiro, a `game-crowd` ouve o som).
6. **Locale e região como dado**: `registerLocale(lang, json)` e `regions/<id>.json`, com uma região `default` neutra (hoje só
   há `br`).
7. **Determinismo**: toda aleatoriedade por `createRng(seed)`.
8. **Serializar e restaurar**: `serialize()` e `restore(state)` em todo pacote com estado. Hoje aparece com nomes diferentes
   (`save`/`load` em `game-player`, `game-infection`; `setState` em `game-stories`; `serialize` em outros) e falta em
   `game-crowd` e `game-weather`. É a
   base do `game-save` e do `game-net`.
9. **Relógio injetado**: os pacotes recebem a hora do mundo de fora (um `clock` comum), em vez de cada um contar a sua.
10. **Orçamento e qualidade**: `quality` e limites numéricos (vozes, partículas, agentes, luzes, draw calls) por opção, lidos
   pelo painel de desempenho.
11. **Núcleo sem three; forma pelo `game-shapes`**: o núcleo descreve, o `game-shapes` gera, o `-three` desenha.
12. **Área de teste por pacote**: `?area=` na sala de testes, como manda o CLAUDE.md.

## 5. Limpezas pequenas no kit

- Comentários de origem com "Vale Cinzento", "Bestiário", "Bichos do Vale" em cerca de 45 arquivos de `src` (sobretudo
  `items-three/src/models`): mover a procedência para um `PROVENANCE.md` por pacote.
- Textos em português fora do locale em alguns `-three` (`weapons-three`, `characters-three`, `items-three`, `animals-three`)
  e no `vehicles-fleet`.
- Páginas com três versões de three.js (r128, r160 e a do modo livre); fixar uma versão mínima.
- O `tasks.md` da spec 001 deve marcar o que já entrou.

## 6. Ordem sugerida

1. **O jogo usa o kit** (seção 2), um sistema por vez, começando pelos de menor risco: câmera, infecção, clima e som; depois
   efeitos, carro e animais; depois jogador, horda e NPCs; por último casas e cidade. Cada troca com golden.
2. **Contrato único** no `game-contracts` (seção 4), começando por `serialize`/`restore` e o relógio comum, e as limpezas.
3. **`game-time`**, **`game-inventory`** e o plugin de necessidades do `game-player`.
4. **`game-quests`** e **`game-dialogue`** a partir dos objetivos e do rádio.
5. **`game-input`** e **`game-ui`**, mais o painel de desempenho único no `game-devtools`.
6. **`game-terrain`**.
7. **`game-save`**, depois **`game-net`** (LAN, host autoritativo, como no projeto de rede da revisão final).

## 7. Pontos em aberto

- A fonte do jogo está em `implementacao/jogo-web/` na pasta compartilhada do projeto; os SDKs que ele embute, em `sdk/`,
  puxados do npm por `sdk/versoes.json`. A versão "modo livre" (`local/zombiada-modo-livre.html`) não tem script de montagem
  conhecido.
- Nomes dos pacotes novos (`game-inventory`, `game-quests`, `game-time` etc.) são sugestão; confirmar antes de criar.
