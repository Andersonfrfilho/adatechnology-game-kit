---
name: game-floorplan
description: Use quando precisar gerar planta de casa, lote, cômodos, paredes, portas, janelas, slots de móveis, paleta de cores ou zoneamento urbano com semente (planta procedural, "gerar casa", "lote", "zona ZR1"). É o motor genérico; o conteúdo (modelos, móveis) vem dos pacotes residential, commercial e post-apocalyptic.
---

# @adatechnology/game-floorplan

## Objetivo
Motor de plantas procedurais com semente: casca da casa, lote, cômodos, portas, janelas, slots de móveis registrados, preenchimento por semente, paleta com harmonia de cor, estados da casa (plugins) e zoneamento urbano. Zero dependências de runtime; mesma semente e mesmas opções dão sempre a mesma planta. O motor não conhece móvel nem jogo algum.

## Quando usar e quando não usar
- Use para: gerar a planta (`rooms`, `doors`, `windows`, `items`, `lot`, `colors`), validar, listar slots, limitar por zona.
- Não use para: desenhar em 3D (ainda não há `game-floorplan-three`, ver migração) nem para o móvel interativo em si (`game-interactables*`, `game-props3d`).
- Sozinho o motor não tem nenhum modelo: registre um pacote de conteúdo antes de `generate`.

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as postApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'

residential(engine, { region: 'br' })
postApocalyptic(engine) // opcional: estados fortified e abandoned

const plan = engine.generate('townhouse', { seed: 7, state: 'fortified', locale: 'pt-BR' })
plan.rooms; plan.doors; plan.windows; plan.items; plan.stateItems; plan.lot; plan.colors
engine.validate(plan) // string[] de problemas; vazio quando a planta está sã
engine.slots('townhouse', { seed: 7 }) // slots gravados, válidos ou não, com o motivo
engine.limitsOf('townhouse').limits // faixa de w/d permitida
```
Zoneamento:
```ts
import { defineZone, checkLot } from '@adatechnology/game-floorplan'
defineZone({ id: 'my_zone', allowedUses: ['residential_single'], maxFloors: 2, maxHeight: 9,
  setbacks: { front: 5, side: 1.5, back: 3 }, maxCoverage: 0.5, maxFar: 1, minLot: 250, minFrontage: 10, permeableMin: 0.25 })
const p = engine.generate('mansion', { seed: 1, zone: 'my_zone' })
p.zoning.adjustments; p.zoning.violations; checkLot('my_zone', p.lot, p)
```
Opções: `seed` (número ou string), `w`, `d`, `style` (`budget`, `mid`, `high`/`luxury`, `commercial`), `state`, `tier`, `floors`, `elevator`, `floor`, `locale` (`en`, `pt-BR`), `zone`.

## API principal
| Função/tipo | Para que serve |
|---|---|
| `engine` | Objeto único com tudo; os pacotes de conteúdo recebem ele em `register(engine)` (assim bundles ESM e IIFE preenchem o mesmo registro) |
| `generate(template, options)` | Gera a planta (retorno tipado como `Json`, solto) |
| `validate(plan, { locale })` | Lista problemas da planta |
| `slots(template, options)` | Slots gravados com `valid` e `reason` |
| `limitsOf`, `listTemplates(locale)`, `listStates()` | Consulta de modelos, limites e estados |
| `palette({ seed, style })` | Só a paleta de cores |
| `registerItem(s)`, `registerLibrary`, `registerLibraryAlias`, `registerTemplate`, `registerStyle`, `registerPaletteStyle`, `registerRoomColors`, `registerDecorProfile`, `registerPass`, `registerGroundOverlay`, `registerWallTop`, `registerSeedKeys` | Registro de conteúdo |
| `registerState(name, { apply(ctx), adjustPalette?, seedKey? })`, `setStateDistribution(weights)` | Estados como plugin e sorteio do estado padrão |
| `defineZone`, `getZone`, `listZones`, `checkLot`, `registerPermeableGround` | Zoneamento |
| `registerLocale`, `translate`, `listLocales` | Textos (`en`, `pt-BR`) |
| `createRng`, `mulberry32`, `hashString`, `overlaps`, `windowZone`, `openingZones`, `slotKit` | Utilitários |

Resultado: `template, name, use, seed, style, state, w, d, floors, rooms, walls, doors, windows, openPairs, facade, lot, items, stateItems, colors, building, missing, partyWalls` e, com zona, `zoning`. Cada item tem `id, type, category, x, z, ry, w, d, h, y, room, floor, outdoor, aabb` (frente em `frontU/frontV`).

## Compõe com
- Usado por `game-floorplan-residential`, `-commercial` e `-post-apocalyptic` (conteúdo e estados). O comercial exige o residencial registrado antes.
- Os `items` da planta (`type`, medidas, posição) são a entrada para montar a casa jogável com `game-props3d` / `game-interactables-household`; alguns tipos coincidem, outros ainda não têm builder. A ponte 3D é do futuro `game-floorplan-three`; hoje o jogo junta.
- Regra do projeto: o jogo só junta; não reimplemente cômodo, porta ou zona fora daqui.

## Ambiente de teste
- Visualizador 2D em `packages/game-floorplan/viewer/`: `pnpm build` e `pnpm --filter @adatechnology/game-floorplan viewer:build` geram `viewer/dist/floorplan-viewer.html`, offline, com modelo, semente, estado, estilo, zona, andar e idioma.
- Testes: `pnpm --filter @adatechnology/game-floorplan-post-apocalyptic test` roda a suíte de propriedades nos quatro pacotes (25 sementes; `FULL=1` roda 200; `TPL='mansion'` filtra).

## Cuidados
- Sem pacote de conteúdo registrado não há modelo; ordem de registro importa (residencial antes do comercial).
- `generate` sem `state` sorteia o estado pela semente conforme a distribuição; passe `state: 'normal'` para fixar.
- `stateItems` não fazem parte de `items`.
- Com `zone`, `generate` ajusta andares e recuos e troca piso pavimentado por gramado (permeabilidade); o que não dá para corrigir vai para `zoning.violations`.
- O motor só conhece `normal`; `fortified` e `abandoned` vêm do pacote post-apocalyptic.
- Opções e ids antigos em português (`semente`, `estado`, `sobrado`...) estão em `MIGRATION.md`; use os nomes em inglês.

## O que vem pela migração (spec 001)
- C1: a versão do Visor de casas 3D (VC3) entra aqui: estrutura, instalações, 5 modelos rurais e regras R01–R72, mantendo as 6 zonas, o visor 2D, os idiomas e o motor de cargas.
- C2: novos pacotes `game-floorplan-structure`, `game-floorplan-rural`, `game-floorplan-three` (desenho 3D e ponte para móveis) e `examples/floorplan-test-area`.
- C6: andares (AndaresSDK): toda casa gerada pode ter andares e escada.
- C3: ruas, postes e bairro ficam num `game-urban` separado, que usa estas casas.
