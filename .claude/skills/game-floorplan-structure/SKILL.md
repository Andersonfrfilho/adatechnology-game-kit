---
name: game-floorplan-structure
description: Use quando precisar da estrutura de uma casa ou prédio gerado (pilares, vigas, lajes, paredes portantes, telhado, varanda, fundação, caixa d'água), do caminho de carga que a destruição respeita (tirar o apoio derruba o que ele segura), de sistemas construtivos (alvenaria, wood frame, tronco, improvisado, lona) ou do DestructibleSpec da estrutura da planta. Entra no resultado de `generate` como `result.structure`.
---

# @adatechnology/game-floorplan-structure

## Objetivo
Dar estrutura a toda planta do `game-floorplan`: cada peça que segura carga tem papel, material, caixa, massa e apoio declarado, e a destruição respeita o caminho
**telhado → tesouras/caibros e cumeeira → cinta ou prato → pilar ou parede portante → fundação**. Tirar o apoio derruba o que ele segura. Varanda e alpendre têm os
pilares próprios (concreto na alvenaria, madeira nas casas de madeira e cabanas): derrubar os pilares da varanda derruba só a cobertura da varanda. Pilares, vigas e lajes
de concreto declaram a armadura (aço) que `game-destruction` usa (gaiola de vergalhão, colapso progressivo).

## Quando usar e quando não usar
- Use para: ler `result.structure`/`result.roof`/`result.construction`/`result.waterTank` de uma planta, montar o `DestructibleSpec` da estrutura para o mundo de `game-destruction`,
  trocar o sistema construtivo de uma planta, desenhar pilares e vigas no visor 2D.
- Não use para: gerar cômodos e móveis (`game-floorplan*`), desenhar em 3D (`game-floorplan-three`, T2.4), nem para o dano em si (`game-destruction`).

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as residential } from '@adatechnology/game-floorplan-residential'
import { register as structure, toDestructibleSpec } from '@adatechnology/game-floorplan-structure'
import { createDestruction } from '@adatechnology/game-destruction'

residential(engine, { region: 'br' })
structure(engine) // depois dos pacotes de conteúdo; liga a estrutura em todo generate()

const plan = engine.generate('townhouse', { seed: 7, state: 'normal' }) // wallDetail padrão: 'panels'
plan.structure.parts // { id, role, material, aabb, y0, y1, floor, mass, ... }
plan.structure.supports // { part, on, joint } : cada peça repousa em outra ou em 'ground'
plan.roof; plan.construction; plan.waterTank
plan.utilities // { gas, electrical, solar, plumbing }; plan.outbuildings; plan.contents[itemId]

const world = createDestruction({ seed: 1 })
const id = world.add(toDestructibleSpec(plan.structure)) // capacidades dimensionadas: aguenta 1 pilar a menos, cai com 2
```
Trocar o sistema: `engine.generate('townhouse', { seed: 7, construction: 'wood_frame' })` (`masonry`, `wood_frame`, `log`, `improvised` ou um nome de `registerConstruction`).
`wallDetail: 'coarse'` reproduz o Visor de casas 3D peça a peça (golden); em `panels` (padrão) o telhado vira caibros por água e cumeeira, a cobertura da varanda
só se apoia nos pilares dela, e `toDestructibleSpec` corta cada parede nas janelas (pilaretes, peitoril, verga de concreto armado com 0,2 m de apoio, parede acima), com a montagem
de `game-destruction` (reboco que lasca, vergalhão, estágios, brecha) e a massa da parede preservada; o vão da porta ganha verga (`lintel_<porta>`) que carrega a cinta. `units` (área de teste) assenta tijolo,
bloco e painel de concreto um a um; parede de tronco vira fiadas de toras (a tora de baixo tirada derruba as de cima):
```ts
const spec = toDestructibleSpec(plan.structure, { wallDetail: 'units' })
const specimen = buildWallSpecimen({ assembly: 'reinforced_concrete', w: 2.4, h: 2.1, opening: 'window' })
```

## API principal
| Função/tipo | Para que serve |
|---|---|
| `register(engine, { tankCapacities? })` | Registra as extensões `construction`, `structureExtras`, `waterTank`, `structure`, `roof` e a camada "Estrutura" do visor 2D |
| `buildStructure(result, options?)` | `Structure { parts, supports, levels, elevation, roof, framed }` de uma planta (não a modifica) |
| `toDestructibleSpec(structure, options?)` | `DestructibleSpec` de `game-contracts`: uma caixa por peça, terreno ancorado, juntas `a_on_b`, capacidade pela carga em repouso. Opções: `safety` 0,65, `redundancy` 0,97, `safetyOthers` 0,45, `portico`, `wallDetail`, `filter`, `sized`, `name` |
| `buildWallSpecimen({ assembly, w, h, opening?, detail? })` | Corpo de prova de parede (2,4 x 2,1 m na área de teste) como a montagem a constrói: pilaretes, verga com 0,2 m de apoio, peitoril, reboco e vergalhão; `opening` `door` ou `window`, `detail` `panels` (padrão) ou `units` |
| `registerConstructionSystem(id, def)` | Sistema construtivo: montagem de parede (`game-destruction`), juntas, espessura de piso e prato, se é de madeira |
| `registerConstruction(id, builder)` | Como um modelo é construído (materiais, fundação, telhado) e seus extras; `TemplateDef.construction` ou `options.construction` o nomeiam |
| `registerRoofCovering(id, { material, joint })` | Cobertura do telhado (`colonial`, `fiber_cement`, `slab`, `asphalt`, `zinc`, `wood`, `canvas`, `thatch`) |
| `masonryConstruction`, `woodFrameConstruction`, `chaletConstruction`, `logCabinConstruction`, `shackConstruction`, `campConstruction` | Construções prontas (dados do Visor de casas 3D) para os modelos registrarem |
| `planWaterTank(result, rng, options?)` | Caixa d'água: na laje, no sótão ou em plataforma sobre o telhado; `custom` e `location` por modelo |
| `result.utilities` | `gas` (cilindro ao lado, em nicho externo, sob a bancada, ou encanado com medidor), `electrical` (poste, ramal, medidor, quadro, tomadas, interruptores, circuitos, eletrodutos; modos `grid`, `tap` (gato, sem medidor), `offgrid`), `solar`, `plumbing` (pontos e trechos). Os botijões entram em `result.items` (`cooking_gas_cylinder`); `TemplateDef.energy(options, w, d)` decide o modo do modelo |
| `result.outbuildings`, `result.contents` | Edícula (paredes com vão, porta de 0,85 m, 2 janelas, móveis do uso sorteado, caminho em `lot.paths`) e o conteúdo de cada recipiente por estado (`engine.findsAnswer`/`findsFor` com `day`, `region`, `place`, `footprint` e `key`; o padrão de `utilities/content` só responde quando nenhum provedor respondeu; `registerContentState`) |
| `structureLayer` | Camada do visor 2D (pilares cheios no concreto e vazados na madeira, vigas tracejadas, tesouras, legenda) |

## Compõe com
- `game-floorplan` (motor: `registerResultExtension`, `registerViewerLayer`), pacotes de conteúdo (`-residential`, `-commercial`, `-rural`) e `game-destruction` (montagens, armadura, mundo).
- Os modelos rurais (T2.2f) registram a construção de cada um (`registerConstruction`) e as extras (chaminé, poço, tendas); o desenho 3D (`game-floorplan-three`) lê `structure`.

## Ambiente de teste
- `pnpm --filter @adatechnology/game-floorplan-structure test`: golden contra a página do time (900 plantas), propriedades (toda planta tem estrutura), caminho de carga no mundo de `game-destruction`, detalhe de parede e corpos de prova.
- Visor 2D: `pnpm build && pnpm --filter @adatechnology/game-floorplan viewer:build`, caixa "Estrutura".

## Cuidados
- Registre depois dos pacotes de conteúdo. A estrutura é calculada em todo `generate`; o `DestructibleSpec` só quando você pede.
- O dimensionamento vem da carga em repouso: a casa inteira não cai sozinha, aguenta perder um pilar ou parede portante e cai com dois. Prédios em pórtico (apartamento, comercial, 3+ andares)
  carregam pelos pilares e vigas (`structure.framed`, `portico` padrão fora do `coarse`).
- Ids de peça em inglês (`wall_0_3`, `plate_0_1`, `column_0_0`, `truss_4`, `porch_post_porch_0`); o `MIGRATION.md` do pacote tem a tabela com os nomes do time.
- `generate` grava `door.steps` nas portas que ganham degraus (como o time grava `degraus`).

## O que vem pela migração
- Sistemas construtivos, `montarEstrutura`, `estruturaExtras`, `specDe`, `cargasProjeto` e a caixa d'água do Visor de casas 3D (L10311–10660, L42681–42729, L9279): portados; golden `coarse` igual
  em 900 plantas dos 12 modelos (peças, apoios, `specDe` e `vedacao`, telhado, construção, caixa d'água).
- Detalhe de parede (`panels`, `units`) e `buildWallSpecimen` (T2.2d): comportamento novo, sem original do time (a parede do VC3 é uma caixa por segmento, o reboco só um rótulo).
- Instalações (T2.2e): `montarGas`, `montarEletrica`, `montarSolar`, `montarHidraulica`, `montarEdificacoes`, `caminhosEdificacoes` e `CONTEUDO` do Visor de casas 3D (L10752–11166, L9279): portados; as sete listas conferem em 900 plantas (`tests/team-golden-vc3-structure.test.ts`).
