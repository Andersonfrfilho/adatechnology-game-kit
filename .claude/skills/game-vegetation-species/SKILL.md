---
name: game-vegetation-species
description: Use quando precisar do catálogo pronto de plantas (71 espécies como JSON: árvore, palmeira, arbusto, flor, cacto, suculenta, grama, trepadeira, planta de vaso), nomes pt-BR e en, ou do mix regional de plantio por contexto (quintal, calçada, praça, terreno baldio). Content pack de game-vegetation.
---

# @adatechnology/game-vegetation-species

## Objetivo
Pacote de conteúdo em JSON para o `game-vegetation`: 71 espécies, nomes e descrições em en e pt-BR, e tabelas de plantio por região (`br` e `default`).
Transforma o id de uma espécie num spec para `generate()` e sorteia espécies por contexto, de forma determinística.

## Quando usar e quando não usar
- Use quando precisar de "um mandacaru", "uma calçada arborizada do Brasil" ou uma lista por tag/clima, sem escrever parâmetros à mão.
- Espécie de uso real (planta com nome real) mora aqui; só plantas inventadas de uma história vão para o repositório do jogo.
- Não use para mudar o desenho de um arquétipo: isso é do motor `game-vegetation`.

## Como usar
```ts
import { generate, scatter, buildLot } from '@adatechnology/game-vegetation'
import { toSpec, getSpecies, byTag, name, regions, pickForContext } from '@adatechnology/game-vegetation-species'

const mesh = generate(toSpec('mandacaru'), { seed: 3, lod: 1 })
name('mandacaru', 'pt-BR')                          // 'Mandacaru'
const id = pickForContext(regions.br, 'front_yard', 42) // sorteio ponderado e determinístico
const cacti = byTag('cactus')                       // Species[]

// quintal inteiro: o resolvedor do lote é toSpec
const placements = scatter({ rect: { x: 0, z: 0, w: 10, d: 8 } }, [{ species: [id], density: 0.1, minDistance: 1.5 }], { seed: 'yard' })
const lot = buildLot(placements, (speciesId) => toSpec(speciesId), { seed: 'yard', quality: 'game' })
```
Conferido no código: `pickForContext(regions.br, 'front_yard', 42)` devolve um id válido (ex.: `rose_bush_pink`).

## API principal
| Função/tipo | Para que serve |
|---|---|
| `species`, `getSpecies(id)`, `listIds()` | Todas as espécies e consulta por id |
| `byTag(tag)` | Filtra por tag (`tree`, `cactus`, `fruit`, `flowering`, `indoor`, `hedge`, `palm`, `street`, `ground`...) |
| `toSpec(idOuSpecies)` | Vira `PlantSpec` para `generate`; cores `#rrggbb` viram inteiro; id desconhecido lança erro |
| `loadLocale(locale)`, `name(id, locale?)`, `description(id, locale?)` | Textos; locale desconhecido cai no `en` |
| `regions` (`br`, `default`) | Tabelas `contexts` com `{ species, weight }` |
| `pickForContext(region, context, seedOuRng)` | Sorteio ponderado; aceita função, `{ next() }`, número ou string |
| `scatterRulesFor(region, contexto, semente, opções?)` | Sorteia espécies da tabela do contexto (60 sorteios, sem trepadeiras, sem árvore grande com `noLarge`) e devolve `{ rules, picks }` para o `scatter`: árvores, cercas-vivas, plantas médias e forração, cada grupo com densidade, distância e escala; tudo configurável (`n`, `draws`, `skipArchetypes`, `maxCount`, `treeDensity`, `groupRules`, `classify`) |
| `Species`, `Region`, `Climate`, `SpeciesSize`, `Locale`, `ScatterRulesOptions` | Tipos |

Contextos: `front_yard`, `backyard`, `sidewalk_tree`, `square`, `vacant_lot`, `indoor`, `semiarid`. `Species` tem `archetype`, `params`, `tags`, `climate`
(`tropical`, `subtropical`, `arid`, `temperate`), `size` (`s`, `m`, `l`) e `solid` (tem colisor: tronco, cacto, vaso).

## Compõe com
- `@adatechnology/game-vegetation` (dependência): o motor e o adaptador three; `toSpec` é a ponte.
- Casas e quintais (`game-floorplan-*`) e a cidade (`game-urban`) pedem espécies daqui por contexto; o jogo só junta.
- Textos seguem o padrão de locale do kit (en + pt-BR).

## Ambiente de teste
Sem `examples/` próprio; a verificação é `packages/game-vegetation-species/tests/` (`pnpm --filter @adatechnology/game-vegetation-species test`).
`tests/team-golden-rules.test.ts` corta o `rulesFor` da página do Viveiro e confere `scatterRulesFor` nas quatro áreas do quintal. O módulo de teste de vegetação (`game-vegetation-three`, T7.2c) mostra as espécies.

## Cuidados
- A descrição do `package.json` diz "~90 espécies", mas o README e o JSON têm **71**; confie em `species.length`.
- `pickForContext` lança erro se a região não tem o contexto pedido; contexto vazio também.
- Os dados são JSON em `data/species/*.json` (trees, palms, shrubs, flowers, cacti, succulents, grasses, vines, potted); ao acrescentar espécie, acrescente
  também o nome em `data/locales/en.json` e `pt-BR.json`, senão `name()` devolve o próprio id.
- Cor nos dados é string hex; passar `params` direto ao `generate` sem `toSpec` quebra as cores.
- `toSpec` não valida o spec; use `validateSpec` do motor se alterar parâmetros.

## O que vem pela migração (spec 001)
- V5 e V8: o Viveiro e o módulo de teste (18 itens, 13 cenários) podem pedir espécies que o SDK ainda não tem; entram aqui, com medidas e nomes preservados.
- Mixes regionais novos continuam como dado (JSON), sem mexer no motor.
- Frutas e achados por local (catálogo único de itens, A9) podem se ligar a espécies pelo id.
