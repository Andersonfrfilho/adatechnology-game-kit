---
name: game-floorplan-commercial
description: Use quando precisar de loja, mercadinho ou farmácia gerados para o game-floorplan (gôndola, freezer, caixa, balcão, depósito, zona comercial zc e industrial zi). Traz os modelos market e pharmacy e o catálogo de itens de loja.
---

# @adatechnology/game-floorplan-commercial

## Objetivo
Conteúdo comercial para o `game-floorplan`: os modelos `market` (mercadinho) e `pharmacy` (farmácia), o catálogo de itens de loja (gôndolas, freezers, caixas, vitrines), bibliotecas de slots, estilo e paleta `commercial` e as zonas comercial (`zc`) e industrial (`zi`) da região `br`.

## Quando usar e quando não usar
- Use para comércio de rua gerado por semente.
- Não use para casas (`game-floorplan-residential`) nem para interiores especiais como delegacia, escola ou posto (planejados como modelos novos, ver migração).

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as commercial, commercialTemplateIds } from '@adatechnology/game-floorplan-commercial'

residential(engine) // obrigatório antes: o comercial reusa bibliotecas de garagem, quintal e banheiro
commercial(engine, { region: 'br' })
const shop = engine.generate('market', { seed: 4, zone: 'zc', locale: 'pt-BR' }) // "Mercadinho"
engine.validate(shop)
```
`region` aceita `'br'` ou um objeto `CommercialRegion`.

## API principal
| Função/tipo | Para que serve |
|---|---|
| `register(engine, { region? })` | Registra itens, bibliotecas, modelos, estilo, paleta, zonas e locales |
| `commercialTemplateIds` | `['market', 'pharmacy']` |
| `commercialItems`, `commercialStyles`, `commercialRoomColors`, `commercialDecorProfile` | Dados exportados |
| `createCommercialLibraries(slotKit)` | Bibliotecas de slots (`shop_market`, `counter_market`; aliases `shop` e `counter`) |
| `regions`, `CommercialRegion` | Dados de região |
| `enLocale`, `ptBrLocale` | Nomes |

| Modelo | Uso | Notas |
|---|---|---|
| `market` | `commercial` | caixas, salão, depósito, banheiro, escritório; porta de aço e portão de carga, sem jardim, parede-meia nos dois lados |
| `pharmacy` | `commercial` | balcão, salão, consultório; mesma casca |

Zonas `br`: `zc` (central, até 24 andares e 80 m, aceita misto e multifamiliar) e `zi` (industrial, 4 andares, 20 m, lotes grandes).

## Compõe com
- Depende de `game-floorplan` e, na prática, de `game-floorplan-residential` registrado antes (ambos são `peerDependencies`; além disso a ordem de registro importa).
- `game-floorplan-post-apocalyptic` aplica estados também nas lojas.

## Ambiente de teste
Sem exemplo próprio; use o visualizador 2D do `game-floorplan` e a suíte em `game-floorplan-post-apocalyptic/tests`.

## Cuidados
- Esquecer de registrar o residencial primeiro faz faltar biblioteca de slots.
- Loja em zona só de casas (`zr1`) aparece como violação de `use`, não como erro.
- Ids antigos: `mercado` é `market`, `farmacia` é `pharmacy` (tabelas em `MIGRATION.md`).

## O que vem pela migração (spec 001)
- C5: interiores (delegacia, escola, igreja, posto, hospital...) viram modelos de planta com interior completo (estrutura, móveis e itens de achado por lugar), ligados ao catálogo único de itens (A9); a lista de lugares vai crescer. Onde cada um mora (aqui ou pacote novo) ainda não está fechado.
- A9: itens de loja passam a vir do catálogo único com peso, volume, raridade e onde aparece.
