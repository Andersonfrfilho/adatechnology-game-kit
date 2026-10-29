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
- **Hash de golden não pode depender da versão do Node.** `Math.pow` (e `**`) mudou o último bit entre Node 22 (V8 12) e Node 24 (V8 13); `sin`, `cos`, `exp`,
  `log`, `atan2` etc. não mudaram. O `CatmullRomCurve3` centrípeto do three usa `pow`, e um `TubeGeometry` fechado sobre caminho quase reto (o aro de 9 mm de
  `midsize_sedan`) amplifica esse bit até 8e-4 de torção do anel, o que vira outro hash. Por isso `tests/setup.ts` chama `installPortableMath()` (do
  `@adatechnology/golden-tool`), que troca `Math.pow` por uma versão feita só de `+ - * /`, `exp` e `log`. Nunca use `**` com expoente fracionário em
  código que entra num golden, e não troque `installPortableMath` por arredondar mais grosso: arredondar não absorve uma torção de 8e-4. Se um golden falhar só
  numa versão do Node, rode o canário (`pnpm --filter @adatechnology/golden-tool test`): ele diz qual função do `Math` mudou. CI roda o fleet no Node 22 e as
  suítes de golden também no Node 24 (job `goldens-node-24`); localmente use `.nvmrc` (22) ou confira nas duas versões antes de regenerar.
- **Goldens regenerados (hotfix, 2026-10-23)**: com `Math.pow` portátil, `tests/fixtures/golden.json` mudou em 22 hashes (`midsize_sedan` 8, `taxi` 8 e um
  em cada: `rideshare_hatch`, `light_4x4`, `fastback_sedan`, `family_hatch`, `entry_hatch`, `electric_hatch`, `classic_six_sedan`) e `team-golden/garage-seda.json`
  foi gravado de novo da página (só a linha do tubo fechado mudou). O golden não estava defasado: dependia do Node (ver `evidence.md`). Mudou a geometria de
  propósito? Regenere só o que falha, com as funções de `tests/helpers/` (`digest`, `legacyZoneId`), nas duas versões do Node, e anote em `evidence.md`.
- `src/legacy-seeds.ts`: **não renomeie** os valores; eles seguram o visual idêntico ao original.
- O README mostra `kit.build(...).group` num exemplo de navegador; o contexto real tem `c.root`.
- Ficou fora de propósito (vai no adaptador do jogo via `kit.configure`): textos de 14 chaves de efeito de zona (`panel`, `door`, `glass`...),
  frases de história de 16 veículos, a horda (cenário, flags `horde` e `frontBlood`), sangue, a placa `ZMB4D23` e o texto `who`.
- Sem os textos de efeito, o kit cai no texto genérico `panel`.
- O arquivo `water-air` deve ser instalado antes dos que usam seus helpers (a ordem em `pack.ts` importa).
- Grupo `water` é marcado como água no kit; `exclude` aceita só ids válidos (`FleetVehicleId`).

## O que vem pela migração (spec 001)
- V1: feito na T0.3 (goldens de `seda`, `popular`, `civico` regenerados).
- V2: entra o que o artefato da garagem tem e o SDK não tem (frotas de aviões, barcos, helicópteros, militares); a comparação a fundo vem primeiro.
- V5: módulos de teste de veículos (8 itens, 11 cenários) em `examples/vehicles-test-area`.
- Linha da horda e sangue vão para o repositório do jogo; `game-crowd` (P12) cuida da multidão.
