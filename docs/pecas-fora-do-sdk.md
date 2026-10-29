# Peças desenhadas fora do SDK dono

Análise de 2026-10-29: cada peça que um pacote ou exemplo desenha à mão (primitiva do three.js ou parte `box`/`cylinder` de um spec)
quando outro SDK do kit é o dono daquele tipo de peça. É a regra "Nada desenhado à mão quando o kit já tem" do `CLAUDE.md`, mais a do
dono de 2026-10-29: **carros e veículos sempre vêm do SDK de veículos, importados (nunca copiados), para a mudança no SDK aparecer em
todo lugar que usa a peça**. O mesmo vale para cada domínio: os SDKs compartilham as peças uns dos outros.

A lista sai de `node tools/kit-audit/audit.mjs` (ver `tools/kit-audit/README.md`), conferida à mão. O CI roda `--check`: uma peça nova
desenhada fora do dono quebra o build até virar peça do SDK certo ou entrar aqui com a correção. Ao corrigir uma, tire a linha da tabela e
a entrada `pending` de `tools/kit-audit/allowlist.json`.

Quem é dono de quê (`tools/kit-audit/rules.json`):

| Domínio | SDK dono | Como usar |
|---|---|---|
| Veículos | `game-vehicles`, `-fleet`, `-three`, `-driving` | `createVehicleKit` + `installFleet` + `createVehiclesThree(THREE, { kit }).build(key)` |
| Estrutura (parede, muro, casa, rua) | `game-floorplan-*`, `game-urban*` | toda parede como as casas: `wallPiece` do `game-floorplan-three` (estrutura e visual das casas) ou a casa inteira; as peças de rua do `game-urban` |
| Móveis | `game-interactables-household` / `-three`, `game-props3d` | `furnitureSpec` (ex.: `dining_table`, `bookcase`, `laundry_tub`) |
| Pessoas | `game-characters-*`, `game-crowd*`, `game-player` | pessoas do `game-characters-people` desenhadas pelo `game-characters-three` |
| Plantas | `game-vegetation-*` | espécies do `game-vegetation-species` |
| Itens | `game-items`, `game-items-goods`, `game-items-three` | catálogo de bens desenhado por `buildItem` |
| Armas e explosivos | `game-weapons`, `game-weapons-three` | arsenal e modelos (`projectileModel`) |

Para saber quem é dono de uma peça, ou de onde veio um trecho de código, use o MCP `game-kit` (`kit_owner`, `kit_origin`, `kit_audit`)
ou a skill `kit-origem`.

## O que está fora hoje

As origens são o PR que trouxe o arquivo. Todos foram escritos por sessões do Claude durante a migração da spec 001 e mergeados pelo dono.

| Peça | Onde está | Dono certo | Origem | Correção |
|---|---|---|---|---|
| Carro dos faróis (caixa preta com 2 lanternas), na frente da câmera da sala | `game-weather-three/src/bench/visual.ts` | veículos | PR #34 (clima desenhado, T6.2c) | **Feita no PR #71**: um sedã da frota, importado |
| Tanque de combustível do carro (caixa cinza solta) | `game-weapons-three/src/world-explosives.ts` | veículos | PR #22 | o tanque dentro de um carro da frota (zona `fuel_tank` do `game-vehicles`) |
| Tambor de combustível (cilindro azul) | `game-weapons-three/src/world-explosives.ts` | itens | PR #22 | o tambor como item do catálogo de bens (entra primeiro no `game-items-goods`) |
| Balcão da área de armas | `game-weapons-three/src/area.ts` | móveis | PR #17 | **Feita no PR da trava**: o aparador (`buffet`) do catálogo de móveis, desenhado pelo `game-floorplan-three` |
| Armas sem modelo da Galeria desenhadas com caixas (taco, machado, facão, faca, martelo, pé de cabra, besta, chave, extintor, maçarico...) | `game-weapons-three/src/props.ts` (`buildProp`) | armas e itens | PR #17 | **Feita no PR da trava**: o modelo do time do `game-items-three` (Itens do Vale Cinzento), no balcão e na mão. Ainda em caixa, sem modelo de time em lugar nenhum: `pistol_22`, `bow_compound`, `molotov`, `cutting_torch`, granadas e cargas, `pry_bar`, `utility_knife`, `claw_hammer`, lançadores `m79`, `m203`, `gp_25`, `ag36` |
| Mesa, estante, torneira e muro padrão da sala | `game-test-room/src/arena.ts`, `items.ts` (`brickWallSpec`) | móveis e estrutura | PR #6 | a sala genérica sem peças padrão; quem hospeda passa as do kit em `scenery` (o `examples/test-room` já passa desde o PR #68) |
| Granada, molotov, foguete e carga sem modelo (esfera, cilindro, caixa) | `game-test-room/src/explosives.ts` | armas | PR #22 | todo arremessável e carga desenhado pelo `game-weapons-three`, sem primitiva de reserva |
| Muro de batida da área de veículos (caixa cinza 0,6 × 2 × 6 m) | `game-vehicles-three/src/test-area/module.ts` | estrutura | PR #35 | parede do `game-floorplan-structure` (`buildWallSpecimen`) |
| Casa, muros, calçada e rua do Viveiro (caixas) | `game-vegetation-three/src/test-area/nursery.ts` | estrutura | PR #35 | casa e lote do `game-floorplan`, rua do `game-urban` |
| Pessoa do Viveiro (cápsula) | `game-vegetation-three/src/test-area/nursery.ts` (`ensure`) | pessoas | PR #35 | uma pessoa do `game-characters-people` (o audit não vê: o código não diz "pessoa") |
| Prateleiras e mesa da área de itens | `game-items-three/src/area.ts` | móveis | PR #27 | **Feita no PR da trava**: bancada (`workbench`) e mesa (`meeting_table`) do catálogo de móveis |
| Figura de 1,80 m da área de itens (cilindros e caixa) | `game-items-three/src/area.ts` | pessoas | PR #27 | **Feita no PR da trava**: a página do kit passa uma pessoa do `game-characters-three` (opção `person`), levada a 1,80 m |
| Caixa de som num poste (bancada de som) | `game-audio/src/bench/module.ts` | itens | PR #31 | **Feita no PR da trava**: a página do kit passa o rádio portátil (`portable_radio`) do catálogo de bens (opção `probe`) |
| Rádio e garrafa na mão dos personagens | `game-characters-three/src/rich/accessories/` | itens | PR #28 (porte literal do Bestiário v17 do time) | rádio (`portable_radio`) e garrafa do catálogo de bens, com as medidas do time |
| Árvores do quintal do showroom | `examples/interactables-showroom/src/showroom.js` | plantas | PR #5 | espécies do `game-vegetation-species` |

### Fora do alcance do audit, achados à mão

| Peça | Onde está | Dono certo | Origem | Correção |
|---|---|---|---|---|
| Carro da garagem quando a casa não recebe a frota (o carro desenhado à mão do time) | `game-floorplan-three/src/furniture/extra-types.ts` (`origCar`); o `examples/floorplan-test-area` não passa `fleet` | veículos | PR #33 | a área das casas passa a frota; sem frota, nenhum carro desenhado à mão |
| Moto e bicicleta do quintal | `game-floorplan-three/src/furniture/builders.ts` (`motorcycle`, `bicycle`) | veículos | PR #33 (porte do Casa3DSDK do time) | as motos e bicicletas da frota, quando ela tiver; senão entram primeiro no `game-vehicles-fleet` |
| Árvores, arbustos e vasos do lote sem o `game-vegetation` | `game-floorplan-three/src/furniture/plants.ts` (`treeModel`, `shrubModel`) | plantas | PR #33 | a casa já tem a ponte `vegetation`; sem ela, as plantas próprias ficam como reserva. Passar sempre a vegetação nas áreas do kit |
| Muro da sala desenhado como blocos lisos cor de tijolo, em 48 blocos soltos com argamassa (não é o padrão das casas) | `examples/test-room/src/main.js` com `buildSpecimenMeshes` do `game-floorplan-three` | estrutura (visual e sustentação) | PRs #33 e #68 | **Em correção** no branch `claude/muro-como-as-casas`: `wallPiece`, a parede das casas (mesma estrutura e mesmo renderizador) |
| Casas da área de casas desenhadas como caixas coloridas por material | `game-floorplan-three/src/test-area/specimens.ts` (`buildSpecimenMeshes`) | estrutura (o visual) | PR #33 | desenhar cada exemplar com o renderizador das casas, como o `wallPiece` faz |

## O que o audit acusa e não é peça de outro SDK

O teto de um carro, o cano de um blindado, o tambor do freio da moto, a casca de um recipiente de fluido, o gerador de formas do
`game-props3d`, o quadro estrutural da destruição, o cone de luz do farol e a estaca que marca uma carga posta. Cada um está em `allowed`
de `tools/kit-audit/allowlist.json` com o motivo.
