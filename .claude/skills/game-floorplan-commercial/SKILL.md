---
name: game-floorplan-commercial
description: Use quando precisar de loja, prédio público ou de cidade gerado para o game-floorplan (mercadinho, supermercado, farmácia, loja de armas, delegacia, pronto-socorro, escola, posto, igreja, metalúrgica, fazenda; gôndola, freezer, caixa, balcão, zonas zc, zi e za). Traz os modelos e o catálogo de itens de loja.
---

# @adatechnology/game-floorplan-commercial

## Objetivo
Conteúdo comercial e de prédios de cidade para o `game-floorplan`: `market` e `pharmacy` (comércio de esquina) e os interiores completos da spec 001 (T2.5): `supermarket`, `drugstore`, `gun_shop`, `police_station`, `emergency_room`, `school`, `gas_station`, `church`, `metalworks` e `farm`, o catálogo de itens de loja, bibliotecas de slots, estilos e paletas `commercial` e `farm` e as zonas comercial (`zc`), industrial (`zi`) e agrícola (`za`) da região `br`.

## Quando usar e quando não usar
- Use para comércio de rua gerado por semente.
- Não use para casas (`game-floorplan-residential`). O que é só de apocalipse (tenda de triagem militar) fica em `game-floorplan-post-apocalyptic`.

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
| `commercialTemplateIds` | `market`, `pharmacy` e os dez interiores |
| `interiorTemplateIds`, `interiorFindsHints` | Ids dos interiores e o que cada lugar pode guardar (pinos de achado da galeria), por id de modelo |
| `commercialItems`, `commercialStyles`, `commercialRoomColors`, `commercialDecorProfile` | Dados exportados |
| `createCommercialLibraries(slotKit)` | Bibliotecas de slots (`shop_market`, `counter_market`; aliases `shop` e `counter`) |
| `regions`, `CommercialRegion` | Dados de região |
| `enLocale`, `ptBrLocale` | Nomes |

| Modelo | Uso | Notas |
|---|---|---|
| `market` | `commercial` | caixas, salão, depósito, banheiro, escritório; porta de aço e portão de carga, sem jardim, parede-meia nos dois lados |
| `pharmacy` | `commercial` | balcão, salão, consultório; mesma casca |
| `supermarket` | `commercial` | 18 x 13 m: caixas, salão com 4 gôndolas, padaria, açougue com câmara fria, estoque, escritório com cofre |
| `drugstore` | `commercial` | 11 x 9 m: salão, balcão de dispensação, sala de manipulação, depósito de controlados com geladeira de vacinas e cofre |
| `gun_shop` | `commercial` | 20 x 9 m: armas longas, vitrine, bancada de recarga, troféus, depósito blindado e estande de 4 raias |
| `police_station` | `institutional` | 16 x 11 m: recepção, sala do delegado, salão, duas celas, arsenal, vestiário, evidências; pátio de viaturas na frente |
| `emergency_room` | `institutional` | 18 x 11 m: pronto-socorro (macas, carrinho, oxigênio), alas A e B, UTI |
| `school` | `institutional` | 18 x 15 m: biblioteca, refeitório, cozinha, armários, sala de aula com 16 carteiras, quadra |
| `gas_station` | `commercial` | prédio 22 x 7 m (conveniência, banheiro externo, depósito, troca de óleo) e pista com 3 ilhas de bombas |
| `church` | `institutional` | 12 x 20 m, pé-direito 7 m: salão paroquial, nave com 14 bancos, altar, sacristia, torre do sino no lote |
| `metalworks` | `industrial` | 30 x 20 m, pé-direito 8 m: prensas, linha de produção, forno, porta-pallets, empilhadeira, refeitório, vestiário, mezanino |
| `farm` | `agricultural` | casa sede 12 x 9 m (estilo `farm`) e, no lote, varanda, poço, galinheiro, curral, celeiro, silo, galpão de máquinas, tratores e fardos |

Cada interior declara `place` e `construction` (`masonry`); os equipamentos de cada cena são obrigatórios (mesma contagem em toda semente), então as plantas variam só pelo tamanho, pelo estado e pela decoração. Medidas e contagens saem da cena da Galeria do Vale Cinzento; os desvios estão em `specs/001-migracao-entregas-dos-times/evidence.md`, seção T2.5.
Zonas `br`: `zc` (central, até 24 andares e 80 m, aceita institucional, misto e multifamiliar), `zi` (industrial, 4 andares, 20 m, lotes grandes) e `za` (agrícola, lotes grandes).

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
- C5 (feito na T2.5): interiores completos com estrutura e móveis; os achados entram pelo gancho `registerFindsProvider` do motor (fase 3) usando `place` e `interiorFindsHints`. A lista de lugares vai crescer.
- A9: itens de loja passam a vir do catálogo único com peso, volume, raridade e onde aparece.
