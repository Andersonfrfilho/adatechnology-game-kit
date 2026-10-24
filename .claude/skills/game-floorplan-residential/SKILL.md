---
name: game-floorplan-residential
description: Use quando precisar de casas e apartamentos prontos para o game-floorplan (sobrado, casa popular, mansão, apartamento, quintal, piscina, móveis e decoração da casa, região br com zonas ZR1/ZR-AP/ZR2/ZR3). Traz dez modelos de planta residencial.
---

# @adatechnology/game-floorplan-residential

## Objetivo
Conteúdo residencial para o `game-floorplan`: dez modelos de casa e apartamento, catálogo de móveis, bibliotecas de slots, passe de decoração (luz de teto, ar-condicionado, quadros, plantas, cortinas), tabelas de fachada e cor por estilo e dados de região (`br`, com tabela de zoneamento brasileira). Tudo orientado a dados: o modelo é objeto simples.

## Quando usar e quando não usar
- Use para qualquer jogo que precise de casas e apartamentos gerados por semente.
- Não use para loja ou prédio comercial (`game-floorplan-commercial`), nem para casa de madeira, cabana, barraco ou acampamento (`game-floorplan-rural`, que estende as bibliotecas e a paleta daqui), nem para o estado da casa (barricada, abandono: `game-floorplan-post-apocalyptic`).
- Casa de gênero ou do enredo de um jogo específico fica no repositório do jogo.

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register, residentialTemplateIds } from '@adatechnology/game-floorplan-residential'

register(engine, { region: 'br' }) // region padrão 'br'; { decor: false } pula o passe de decoração
const plan = engine.generate('mid_modern_townhouse', { seed: 12, floors: 3, zone: 'zr_ap', locale: 'pt-BR' })
engine.validate(plan) // []
```
`region` aceita `'br'` ou um objeto `ResidentialRegion` (swatches de tinta, nomes de cor de fachada, zonas).

## API principal
| Função/tipo | Para que serve |
|---|---|
| `register(engine, { region?, decor? })` | Registra itens, bibliotecas, modelos, estilos, paleta, decoração, zonas e locales |
| `residentialTemplateIds` | Os 10 ids: `single_storey_a`, `townhouse`, `apartment_basic`, `budget_slab_house`, `budget_semi_detached`, `mid_modern_single_storey`, `mid_modern_townhouse`, `high_end_contemporary`, `mansion`, `apartment_modern` |
| `residentialItems`, `residentialStyles`, `residentialRoomColors`, `residentialDecorProfiles` | Dados exportados |
| `createResidentialLibraries(slotKit)` | Bibliotecas de slots |
| `decorPass` | Passe `residential_decor` |
| `regions`, `ResidentialRegion` | Dados de região |
| `enLocale`, `ptBrLocale` | Tabelas de nome (modelo, cômodo, estilo, fachada, zona) |

Zonas de `br`: `zr1` (casas, 2 andares, 9 m), `zr_ap` (alto padrão, até 3 andares, 12 m), `zr2` (casas e prédios até 4 andares), `zr3_zm` (misto, até 12 andares). Opções por modelo: `tier` (`mid`/`high`, `apartment_modern`), `floors` e `elevator` (`mansion`, `mid_modern_townhouse`, `high_end_contemporary`), `floors` e `randomFloors` (`budget_slab_house`), `floor` (andar da unidade).

## Compõe com
- Depende de `game-floorplan` (só tipos do motor em tempo de compilação).
- O comercial reaproveita as bibliotecas de garagem, quintal e banheiro daqui: registre este antes.
- Os itens da planta são a entrada para desenhar com `game-props3d` e `game-interactables-household`; nem todo tipo tem builder ainda (o `service_entrance` com `variant: 'gato'` existe no household).

## Ambiente de teste
Sem exemplo próprio. Veja o visualizador 2D do `game-floorplan` (`viewer:build`) e a suíte de propriedades em `game-floorplan-post-apocalyptic/tests`.

## Cuidados
- `register` recebe o `engine` como argumento; não importe o motor por outro caminho (bundles IIFE precisam compartilhar o registro).
- Itens compartilhados só são adicionados se outro pacote ainda não os registrou.
- Cada modelo declara `use`, `floorRange` e `partyWalls`; casa fora do uso da zona vira violação em `zoning.violations`.
- `budget_slab_house` tem parede-meia à direita e `budget_semi_detached` à esquerda.
- Nomes em português antigos (`sobrado`, `popular_laje`...) estão no `MIGRATION.md`; use os ids em inglês.

## O que vem pela migração (spec 001)
- C4: cada tipologia da Galeria do Vale (sobrado, laje, colonial...) vira modelo de planta real aqui; a silhueta da Galeria vira a versão de longe (LOD).
- C7: `budget_slab_house` tem de 1 a 3 andares (T2.2g): `floors` (padrão 1, igual à página) ou `randomFloors: true` (sorteio uniforme da semente); cada andar de cima repete a planta com 2 quartos e banheiro, a escada reta fica na margem esquerda (`result.config.sideStair`) e as esperas de vergalhão saem da laje do topo em 60% das casas.
- C8: barraco e "gato" de luz marcados como Brasil (região `br`): o barraco e os outros quatro modelos rurais já estão em `game-floorplan-rural` (T2.2f); o marcador `power: 'tap'` do gato está em `result.config` do barraco (T2.2g).
- C5 (interiores com itens de achado) liga ao catálogo único de itens (A9).
