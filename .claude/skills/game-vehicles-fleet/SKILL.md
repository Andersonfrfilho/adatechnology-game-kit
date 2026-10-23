---
name: game-vehicles-fleet
description: Use quando precisar da frota pronta de veículos (carro, moto, SUV, picape, van, caminhão, ônibus, trator, militar, barco, avião, helicóptero), combustíveis e cenários de colisão, capotagem, abandono e queimado. É o content pack de game-vehicles.
---

# @adatechnology/game-vehicles-fleet

## Objetivo
Content pack do `game-vehicles`: 69 veículos procedurais em dez grupos, combustíveis, nomes de grupos, textos de dano genéricos (en e pt-BR) e cinco
cenários de dano (`front_crash`, `left_side_crash`, `rollover`, `abandoned`, `burnt`). Instalado no kit, todo veículo vira `kit.build(id, state)`.

## Quando usar e quando não usar
- Use para ter veículos reais já prontos num jogo novo (regra 1 do `CLAUDE.md`: procurar no SDK antes de criar).
- Veículo do mundo real com nome real vive aqui (decisão de 2026-10-23); veículo só de uma história vai para o repositório do jogo.
- Não use para zumbi/horda/sangue/placa do jogo: isso ficou de fora de propósito (ver "Cuidados").
- Para criar um veículo novo avulso, use `kit.register` do `game-vehicles`.

## Como usar
```ts
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'

const kit = createVehicleKit({ THREE, locale: 'pt-BR' })
installFleet(kit)                               // tudo
// installFleet(kit, { groups: ['cars', 'air'], exclude: ['battle_tank'], scenarios: false })
// ou kit.plugin(fleetPack)

const c = kit.build('compact_hatch', 'damaged') // 'intact' | 'damaged' | 'modified'
scene.add(c.root)
```

## API principal
| Função/tipo | Para que serve |
|---|---|
| `installFleet(kit, options?)` | Instala a frota no kit |
| `fleetPack`, `createFleetPack(options)` | Mesmo conteúdo como plugin (`kit.plugin`) |
| `FleetOptions` | `groups`, `vehicles`, `exclude`, `scenarios` (padrão `true`: registra os 5 cenários e faz `front_crash` o dano padrão) |
| `motorcycles`, `cars`, `suvs`, `pickups`, `vans`, `heavy`, `agricultural`, `military`, `water`, `air` | Listas de ids por grupo (12, 15, 4, 4, 2, 5, 1, 8, 7, 11) |
| `fleetGroups`, `fleetGroupIds`, `fleetVehicleIds` | Índices dos grupos e de todos os ids |
| `createScenarios`, `scenarioIds` | Os cenários de dano genéricos |
| `enLocale`, `ptBrLocale` | Tabelas de texto |
| `legacyVehicleSeeds`, `legacyZoneIds`, `legacyGlassLabels`, `legacyScenarioSeeds` | Ids antigos que semeiam visual e dano |

## Compõe com
- Depende de `@adatechnology/game-vehicles` (peer/workspace); só registra veículos e dados nele.
- Destrutível pelo contrato (`createVehicleDestructible`) e testável na sala de teste (`game-test-room`).
- Usado pela cidade (`game-urban`, futuro) e pela multidão; o jogo só junta.

## Ambiente de teste
Sem `examples/` próprio: a verificação é a suíte `packages/game-vehicles-fleet/tests/` (goldens por grupo, `locale.test.ts`, `destructible.test.ts`).
Rodar: `pnpm --filter @adatechnology/game-vehicles-fleet test` (demora, uns 2 minutos). `examples/vehicles-test-area` está previsto (V5).

## Cuidados
- **Goldens desatualizados**: em 2026-10-23 a suíte tinha 12 testes falhando em 3 arquivos (856 passam). Um exemplo confirmado é `fastback_sedan` (antigo
  `civico`) no cenário `rollover` (hash esperado `40a1b663`, recebido `330b1a88`). Os ids antigos citados na decisão V1 são `seda` = `midsize_sedan`,
  `popular` = `entry_hatch` e `civico` = `fastback_sedan`. Não conserte o código para "voltar" ao golden: a decisão V1 manda regenerar o golden.
- `src/legacy-seeds.ts`: **não renomeie** os valores; eles seguram o visual idêntico ao original.
- O README mostra `kit.build(...).group` num exemplo de navegador; o contexto real tem `c.root`.
- Ficou fora de propósito (vai no adaptador do jogo via `kit.configure`): textos de 14 chaves de efeito de zona (`panel`, `door`, `glass`...),
  frases de história de 16 veículos, a horda (cenário, flags `horde` e `frontBlood`), sangue, a placa `ZMB4D23` e o texto `who`.
- Sem os textos de efeito, o kit cai no texto genérico `panel`.
- O arquivo `water-air` deve ser instalado antes dos que usam seus helpers (a ordem em `pack.ts` importa).
- Grupo `water` é marcado como água no kit; `exclude` aceita só ids válidos (`FleetVehicleId`).

## O que vem pela migração (spec 001)
- V1: regenerar os goldens de `seda`, `popular`, `civico` com a versão de hoje (faz o CI voltar a ficar verde).
- V2: entra o que o artefato da garagem tem e o SDK não tem (frotas de aviões, barcos, helicópteros, militares); a comparação a fundo vem primeiro.
- V5: módulos de teste de veículos (8 itens, 11 cenários) em `examples/vehicles-test-area`.
- Linha da horda e sangue vão para o repositório do jogo; `game-crowd` (P12) cuida da multidão.
