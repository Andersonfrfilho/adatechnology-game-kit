---
name: game-weapons-three
description: Use quando precisar da apresentação em three.js das armas do game-weapons, como o modelo real da arma (portado da Galeria 3D do Arsenal), arma na mão com tiro, ciclo, pane, destravar, trava e as sete recargas, cápsulas e cartuchos por calibre, pente caindo, desgaste do metal, sons sintetizados e a área de testes de armas. Termos, viewmodel, arma na mão, cápsula, cartucho, som de tiro, balcão de armas, clipe de animação.
---

# @adatechnology/game-weapons-three

## Objetivo
Lado three.js do `@adatechnology/game-weapons`: os **modelos reais das 78 armas da Galeria 3D do Arsenal** (porte fiel dos construtores: pistola, revólver,
fuzil, bullpup, P90, basculante, M2, lançadores e lança-chamas), cartucho e estojo por calibre, a arma na mão tocando os **clipes** que o contrato de
`game-contracts` pede (tiro, rajada, ciclo, pane, destravar, trava e as sete recargas, no tempo que a regra dá), cápsulas, pentes e fumaça, o desgaste do
metal (nova, usada, gasta, enferrujada), sons sintetizados com WebAudio e a **área de testes de armas** (balcões com todas as armas e alvos) como `TestableModule`.
Cada arquétipo genérico veste o modelo da primeira marca (menor id) que o aponta e atira do mesmo jeito (`ARCHETYPE_MODELS`); corpo a corpo, arco, besta e arremessáveis continuam com o prop low-poly.
A área tem **bancada** (clarão, cápsulas e pentes; estado da arma, munição e distância do som; cápsulas, pentes e calor; **acessórios por encaixe**) e, no canto leste, barril de combustível, botijão e tanque do carro para a reação em cadeia.
**Acessórios (T1.7.6 e T1.7.7):** o modelo da arma recebe o que a regra do `game-weapons` encaixa (supressor, mira, empunhadura, bipé, lanterna com `SpotLight`, laser com feixe e ponto, carregadores, bandoleira, mochila de munição, tripé e o lança-granada sob o cano), a coronha dobra ou recolhe e a bancada pôs tudo isso nas mãos do jogador.

## Quando usar e quando não usar
- Use para mostrar e ouvir uma arma, ou para carregar a área de armas numa sala de testes.
- Não use para a regra (munição, tiro, recarga): é o `game-weapons`. Não traz mira, HUD nem dano.
- Outro renderizador pode ocupar o lugar: a animação padrão cumpre um contrato, não é obrigatória.

## Como usar
```ts
import { createWeaponsTestModule } from '@adatechnology/game-weapons-three'

// room é um host de @adatechnology/game-contracts (a sala de testes, por exemplo)
const report = room.loadModule(createWeaponsTestModule({ locale: 'pt-BR' }))
room.openArea('weapons_area')
```
Só o modelo e o som, sem sala:
```ts
import * as THREE from 'three'
import { buildWeaponModel, createWeaponAudio } from '@adatechnology/game-weapons-three'
import { createArsenal } from '@adatechnology/game-weapons'

const arsenal = createArsenal({ locale: 'pt-BR' })
const def = arsenal.weapons.get('pistol_9mm')!
scene.add(buildWeaponModel(THREE, def)) // Group com as peças da arma
createWeaponAudio(0.6).shot(arsenal.muzzleEnergy(def.action.kind === 'firearm' ? def.action.caliber : '9x19'), def.category)
```
O modelo real de uma arma da Galeria e o que o contrato de animação precisa dele:
```ts
import { buildWeaponModelById, hasWeaponModel, applyCondition, modelKit } from '@adatechnology/game-weapons-three'

if (hasWeaponModel('ak_47')) {
  const model = buildWeaponModelById(THREE, 'ak_47')! // { id, root, inner, parts }: eixo longo em +x, coronha na origem, no comprimento real
  scene.add(model.root)
  applyCondition(modelKit(THREE), model, 'rusty') // new, used, worn ou rusty (os ids da regra)
}
```
`createWeaponFx({ THREE, scene, camera, arsenal, groundAt, audio, tool })` é o que o módulo cria em `attach`; alimente com `fx.handle(event, tool)` (eventos da
ferramenta do host) e `fx.update(dt)` a cada quadro. `tool: () => HostTool` dá o calor do cano e o combustível queimando (nenhum evento os anuncia).

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createWeaponsTestModule(options?)` | `TestableModule` com `id: 'weapons_area'`; expõe também `audio` e `fx`. Opções: `locale` (padrão `pt-BR`), `arsenal`, `sound`, `condition`, `seed` |
| `weaponsLayout(weaponItemIds, pitchOf?)` | posições dos balcões (até 6, em duas fileiras), armas lado a lado (cada uma com a sua faixa) e alvos (aço, compensado, concreto); lança erro se as armas não couberem nos balcões |
| `createWeaponFx(options)` | arma na mão: as com modelo tocam os clipes, as outras têm o prop de caixas; `handle`, `update`, `setCondition`, `layers` (`casings`, `magazines`, `muzzleFlash`), `inHand`, `casings`, `magazines`, `dispose`. Opção `soundDistance: () => metros` abafa o tiro |
| `MODEL_ENTRIES`, `ARCHETYPE_MODELS`, `hasWeaponModel(id)`, `buildWeaponModelById(THREE, id)` | os 78 modelos da Galeria (`data/models.json`) e o modelo que cada arquétipo veste (`pistol_9mm` → `beretta_92fs`, `shotgun_pump_12` → `cbc_pump_military_3_0`...) |
| `worldExplosiveItem(def, nome)`, `WORLD_EXPLOSIVE_IDS`, `WORLD_EXPLOSIVE_PREFIX` | barril, botijão P13 e tanque do carro como item com `explodes.chain` do `ExplosiveDef` (a cadeia é do `game-destruction`) |
| `buildCartridge`, `buildCasing`, `cartridgeShape` | cartucho (em mm, como a Galeria mostra), estojo vazio (m) e a forma por calibre, das medidas do `CaliberDef.cartridge` |
| `modelKit(THREE)` | materiais e primitivas da Galeria (uma por namespace do three); `applyCondition(kit, model, id)` veste o desgaste |
| `createWeaponAudio(volume?, options?)` | `shot(energyJ, category, extras?)` (extras: `distance`, `volume`, `suppressed`, `indoors`, `caliber`), `shotSound(input)`, `mechanical(id)`, `event(weaponEvent)`, `play(soundClass, volume?, distance?)`, `click`, `reloadStart/End`, `cycle`, `clink`, `thud`, `setVolume`, `dispose`. Opções: `seed`, `classes`, `distance`, `energy`, `referenceEnergy`, `classOf`, `bands`, `suppressor`, `indoors`, `mechanical`, `createContext` |
| `computeShotSound(input, options?)` | parâmetros do tiro sem WebAudio (puro): `soundClass`, `audible`, `cutoff`, `gain`, `duration`, `crack`, `body`; entrada `{ caliber? \| energyJ?, category?, distance?, volume?, suppressed?, indoors? }` |
| `MECHANICAL_SOUNDS`, `mechanicalSoundOf(event)` | sons por id (`magazine_out`, `bolt_open`, `dry_fire`, `jam`, `safety_on`... os ids de `RELOAD_STAGES` e dos eventos da regra) e o id que um `WeaponEvent` pede |
| `GAME_SOUND_CLASSES`, `GAME_DISTANCE_CURVE`, `DEFAULT_ENERGY_CURVE`, `CLASS_REFERENCE_ENERGY` | a tabela `[corte Hz, volume, segundos]` e o abafamento do jogo, e a curva de energia do calibre; todos substituíveis por opção |
| `buildWeaponModel(THREE, def)` / `buildProp` / `weaponProp` | modelo e spec (`DestructibleSpec` de caixas) de uma arma |
| `BODY_ACTIONS` | ids sem modelo próprio (`hand`, `kick`, `shove`, `fists`) |
| `WEAPON_THUMBNAILS`, `weaponThumbnailUrl(id, base?)`, `DEFAULT_THUMBNAIL_BASE` | miniatura SVG por arma (e por explosivo de mundo: `fuel_barrel`, `propane_p13`, `car_fuel_tank`), do `assets/weapon-svg/manifest.json`: o arquivo do Commons quando há, senão o gerado do modelo 3D. `createWeaponsTestModule({ thumbnailBase })` (padrão `weapon-svg/`, `false` desliga) preenche `TestableItem.thumbnail` de toda arma; a página serve a pasta (o site copia `assets/weapon-svg` para `site/dist/weapon-svg`) |
| `WEAPON_ITEM_PREFIX`, `COUNTER_ITEM_ID` | prefixo `weapon_` dos itens e id do balcão |
| `fitAttachmentModels(model, fitted, kit, { catalogue, overrides?, raycast?, isDrawn?, areBeamsOn? })` | desenha os acessórios de `fitted` no modelo e devolve o `AttachmentRig` (`sync(fitted)`, `update()`, `drawn`, `dispose()`): o que a arma já traz (`parts.fittings`) aparece e some com a lista, o resto vem do registro no quadro do encaixe, filho do invólucro (`root`, não do `inner`, que estica) |
| `ATTACHMENT_MODELS`, `AttachmentModelBuilder`, `AttachmentModelRegistry` | o construtor de cada acessório pelo `model` da definição; um jogo troca ou acrescenta com `createWeaponsTestModule({ attachmentModels })` ou `createWeaponFx({ attachmentModels })`. Sem construtor (não desenhados): `sawn_off_barrel`, `long_barrel` e as miras integradas que a arma já desenha |
| `mountFrame(model, mount)`, `deriveFrames` | onde cada encaixe fica, no espaço do invólucro: `parts.frames` (os construtores `rifle` e `m134` gravam; os outros saem medidos do modelo) |
| `rigStock(THREE, model, def)`, `rigUnderbarrel(THREE, model, def)` | **depois** da construção: o pivô `stock` (gira meio giro pelo `foldAxis` ou recolhe `length - lengthCollapsed`) e o pivô `ugl` do lança-granada; a cena que o golden hasheia não os tem |

## Bancada da área (`weapons_area`)
| Id | Tipo | O que faz |
|---|---|---|
| `condition` | escolha | nova, usada, gasta, enferrujada: `setCondition` na regra (`host.configureTool({ condition })`; a munição vai em `ammo_quality`) e nos materiais do modelo |
| `ammo_quality` | escolha | de fábrica ou recarregada (`setAmmoQuality` na regra) |
| `sound_distance` | número 0 a 200 m | distância do ouvinte: prévia do abafamento do tiro |
| `fuse_length` | número 0,01 a 1 m | pavio da dinamite (131 s/m): `host.configureTool({ fuse_length })`; um longo põe a dinamite no chão acesa |
| `muzzle_flash`, `casings`, `magazines` | camadas | ligam e desligam o clarão, as cápsulas e os pentes |
| `attachments`, `beams` | camadas | desenham ou escondem os modelos dos acessórios, e acendem ou apagam o cone da lanterna e o feixe do laser |
| `fit_muzzle`, `fit_rail_top`, `fit_rail_left`, `fit_rail_right`, `fit_rail_bottom`, `fit_underbarrel`, `fit_magazine`, `fit_feed`, `fit_sling`, `fit_barrel` | escolhas | um por encaixe da arma na mão, só com o que a regra aceita ali (`arsenal.canFit`); o encaixe sem lugar na arma some; trocar tira o que está e põe o novo, no tempo da regra (2, 15 ou 30 s) pelo `host.command` |
| `toggle_light`, `toggle_laser`, `toggle_stock`, `switch_underbarrel` | botões | os mesmos comandos das teclas L, K, V e U |
| `casings_live`, `magazines_live`, `heat` | métricas | o que está na cena e o calor do cano (máximo 100) |
| `weapon_mass`, `aim_time`, `accessories_fitted`, `suppressed` | métricas | massa da arma com o que leva, segundos até a mira, quantos acessórios e se está silenciada |
Atirar, rajada e destravar ficam nas teclas (entrada do jogador). O som da explosão sai do evento `explosion` do host, pela distância da câmera.

## Compõe com
- `game-weapons` (dependência): arsenal e definições.
- `@adatechnology/game-contracts` (dependência): `TestableModule`, `HostEvent`, `HostTool`.
- `game-destruction` (devDependency): os alvos e armas soltas são specs de destruição.
- `game-test-room` (devDependency): carrega o módulo com `loadModule`. O pacote não faz parte do contrato genérico da sala (regra do projeto: nada de arma na sala).

## Ambiente de teste
`examples/weapons-test-area`: `node build.mjs` empacota o módulo em `dist/weapons-area.js` (global `WeaponsArea`) e gera `dist/sala-armas.html`
(sala de testes com a área carregada e aberta, um arquivo, sem rede). `node test.mjs` testa. No arquivo `src/entry.js`, `WeaponsArea.loadInto(room)`
carrega e abre a área. As áreas da página do kit abrem por `?area=`. Os testes do pacote ficam em `tests/weapons-area.test.ts` e `tests/integration.test.ts` (som, bancada, modelos dos arquétipos e a cadeia dos barris).
Teclas: H equipa a arma mirada, clique atira ou arremessa, R recarrega, Q muda o modo, X destrava (a outra frente de trabalho vai torná-la sensível ao contexto com o sentar; aqui segue destravando), B trava, Y detona as cargas postas de detonador remoto (C4); a Claymore dispara sozinha quando um corpo cruza o fio; segurar o clique com granada cozinha, soltar arremessa, E pega, G arremessa o que está na mão. **Acessórios:** L liga a lanterna, K o laser, V dobra ou abre a coronha (na arma sem coronha que mexe, V segue sendo o chute da sala), U troca entre a arma e o lança-granada sob o cano, e o botão direito do mouse mira (zoom pela óptica encaixada, em `aimSeconds`) onde a arma atira; onde não atira segue agarrando. As teclas e o mouse entram pela fase de captura da `window` (`src/accessory-bench.ts`), antes da sala, e só consomem o evento quando a arma na mão tem o que fazer com ele.

## Cuidados
- `three` é peer (`^0.160.0`): passe o seu `THREE`.
- O som só nasce no primeiro disparo vindo de clique ou tecla (política dos navegadores) e é no-op onde não há `AudioContext` (testes, workers).
- Cápsulas e partículas têm teto (900 partículas, 25 s de vida); o revólver só larga as cápsulas ao abrir o tambor e o basculante ao abrir os canos.
- O relógio é da regra: `reload`, `cycle` e `clear` trazem `duration`, e o clipe é escalado a ela; as etapas (`stage`) levam o clipe até o marcador, e o fim da fase o fecha.
- As armas da Galeria ficam no balcão como **um corpo rígido** (`body`, caixa do tamanho do modelo e a massa real); o modelo desenhado vai por cima, preso a ele, **unido num mesh por material** e sem sombra projetada (a área caiu de 11.929 para 902 chamadas de desenho; a arma na mão mantém o modelo com os pivôs). Arquétipo que só empresta o modelo de uma marca (`ARCHETYPE_MODELS`) não vai para o balcão ao lado da marca: continua no catálogo e na mão. Armas no balcão nascem `asleep`.
- A cor vem do `ColorManagement` do three r160 (a Galeria convertia à mão no r128): o golden lê os valores lineares como a página.
- Itens não podem ter id começando por `weapon_` se não forem arma: a sala distingue pelo prefixo (por isso o balcão é `counter_weapons`).
- Som do tiro (T1.4, S2): classe e abafamento por distância portados do jogo (`jogo.js` L62089-L62110, calibre → classe na L68697) e a energia do calibre
  escala volume, duração e brilho em torno da classe; nos calibres do jogo (9x19, 12ga, 7,62×39, 7,62×51) o resultado é exatamente o do jogo.
  Tudo sai de `computeShotSound` (puro, sem `Math.random`; o ruído usa o `createRng` do kit com `seed`). Os sons mecânicos (etapas de recarga, ferrolho,
  pane, desobstruir, tiro em vazio, trava) vêm por id; a Galeria não tem som, então os metálicos são do SDK e só `recarga`/`vazio` são do jogo.
  Na mão, `weaponEventOf(hostEvent)` (interno) converte o evento do host no da regra e `audio.event` toca `mechanicalSoundOf`; o tiro leva `{ caliber, distance }`.

## Miniaturas das armas (`assets/weapon-svg`)
- `generated/<id>.svg`: silhueta lateral do modelo 3D (vista de cima para o que é só prop de caixas deitado), viewBox 800x200, `currentColor`, aço mais claro (`fill-opacity`) sob o polímero e a madeira; feita por `tools/weapon-thumbnails` (`pnpm --filter @adatechnology/weapon-thumbnails-tool build && node tools/weapon-thumbnails/dist/cli.js generate`), mesmos bytes a cada execução; o teste da ferramenta compara com o disco, então mexer em modelo exige regerar.
- `commons/<id>.svg`: contorno traçado de um desenho do Wikimedia Commons (Domínio público, CC0, CC BY ou CC BY-SA), com autor e licença em `CREDITS.md`/`manifest.json`; a licença é a do original e **não é MIT** (`LICENSE-NOTE.md`). O resolvedor prefere `commons/`.
- Arma nova: rodar `generate` (um SVG novo e o manifesto). Trocar por um desenho do Commons: `tools/weapon-thumbnails/scripts/commons-*.mjs` (busca, folha de contato, importação); nunca publicar o SVG baixado, só o contorno traçado.

## Clipes e golden
- `src/animation/`: os tweens da Galeria (`tw`) viram `AnimationClipSpec` (`clip-builder.ts`: amostra a curva `ease` em 10 passos), por mecanismo: `shot-clips`, `cycle-clips` (ciclo e destravar), `reload-clips` (as sete recargas) e `magazine-clips`.
- Eventos de clipe (`muzzle_flash`, `eject_casing`, `drop_magazine`, `move_in`, `stuck_case`, `fly_jam`, `drop_tube`...) são tratados em `src/fx/viewmodel-events.ts`; o tocador é o `createToolClipPlayer` do `game-contracts`.
- `tests/gallery-models.test.ts` compara cada arma e cada cartucho, nó a nó, com o que a página produz (`tools/golden/captures/arsenal-models.js`, three r128): as 77 da Galeria batem, só o projétil do .50 BMG (13,0 na página, 12,7 no SDK) difere.

## Armas da T1.7.5 (criações do kit, sem página de time)
- 21 entradas novas em `models.json` (geradas): variantes e criações montadas com o construtor `rifle`/`pistol` e as opções da Galeria. Dois construtores novos: `m134` (`src/models/m134.ts`: caixa, seis canos e braçadeiras num pivô `parts.barrels`, caixa de fita, tampa e cobertura; família `belt`) e o carregador helicoidal do Bizon (`mag: 'helical'`, `helical-magazine.ts`, sob o cano).
- Em tiro o clipe `shot` gira `barrels` um sexto de volta (`spinBarrels` em `shot-clips.ts`); só quem tem `parts.barrels` na família `belt` gira (a M2 e as outras não).
- Golden próprio (não há página): `tests/new-weapon-models.test.ts` e `tests/fixtures/own-golden/new-weapon-models.json` (hash nó a nó dos 21; `UPDATE_GOLDEN=1` regrava e se lê o diff). Os 77 hashes da Galeria seguem intactos.
- Área: 4 colunas de balcão (8 balcões no máximo) e o M134 montado no tripé como item `m134_tripod` (`MOUNTED_M134_ITEM_ID`, parado, `H` pega a arma), com o tripé de três pernas de `buildTripodMountedProp`; as pernas do tripé (`buildTripodLegs`) são as mesmas do acessório `tripod` nas mãos.

## Acessórios no modelo (T1.7.6)
- **Cena padrão intacta:** `buildWeaponModelById` só grava números (`parts.frames`), referências (`parts.fittings`, `parts.stockMeshes`) e nada mais; o pivô da coronha e o do lançador vêm de `rigStock` e `rigUnderbarrel`, que o viewmodel chama depois. Os 77 hashes da Galeria e os 21 do golden próprio ficam iguais.
- **Portes da Galeria** (mesmo desenho que a página, nas funções compartilhadas com os construtores): `scope(kind)` (`red_dot`, `holographic_sight`, `acog_4x`, `scope_3_9x`, `scope_6_24x`, `night_vision_scope`, `thermal_scope`, `pso_1`, `fixed_scope_10x`), `rail()` (adaptador sob a óptica onde o topo não tem trilho), `buildBipod`, `buildBrake` (`muzzle_brake`, `muzzle_brake_heavy`), `buildDrum`, `buildBeltBox`. O golden do time é o dos 77 hashes (a arma que traz a peça usa a mesma função) mais um teste que compara a óptica do acessório com `scope(kind)` nó a nó.
- **Criações** (golden próprio: `tests/attachment-models.test.ts`): supressor e supressor de filtro de óleo (o integral termina na boca; o encaixado vai além e leva a boca para a ponta), compensador, empunhadura, lanterna (`SpotLight` com o cone e o alcance dos dados), laser (feixe e ponto; o ponto cai onde o `raycast` do host diz), lança-granadas M203/GP-25/AG36 (carcaça na arma e tubo no pivô `ugl`, que o clipe `reload_ugl` desliza pelas etapas `breech_open`/`round_in`/`breech_close`), mochila de munição (mochila nas costas, caixa de fita na arma e correia em catenária do `game-interactables-three`), tripé, bandoleira (cordão do `game-interactables-three`), carregador estendido, tambor e acoplador (filhos do pivô do carregador, que se move com a recarga).
- **Coronha:** `rigStock` junta as malhas que o construtor desenhou (`parts.stockMeshes`) num pivô; `stock_fold`/`stock_unfold` giram meio giro pelo lado do `foldAxis` (direita e esquerda no eixo vertical, embaixo e em cima no transversal) e `stock_collapse`/`stock_extend` deslizam `length - lengthCollapsed`. O clipe segura a pose final e a mão reaplica o estado da regra ao equipar.
- **Viewmodel:** acompanha `tool().attachments` a cada quadro (`signature`), liga luz e laser pelos `on`, atira o lançador com `shot_ugl` (clarão na ponta do tubo, som de lançamento) e usa `computeShotSound({ suppressed })` no tiro silenciado. Sons mecânicos novos: `stock_fold`, `light_click`, `attach`.
- Dependência nova: `@adatechnology/game-interactables-three` (o cordão); entra no IIFE do pacote.

## O que ainda vem pela migração (spec 001)
- Sons: o tiro (classe e abafamento do jogo + energia do calibre, S2) e os sons mecânicos estão feitos (T1.4); falta mover a síntese para o `game-audio` genérico (S1) e o golden de parâmetros (S3).
- Efeitos de boca e explosivos passam a vir do `game-vfx-three` (E4).
- Decisões do dono de 2026-10-24: o modelo do revólver desenha as câmaras da capacidade (686: 7; `options.chambers`, gerado pela ferramenta; arquétipo emprestado fica com 6) e a bancada ganhou `fuse_length`.
- Fase 1 fechada (T1.6): o som do tiro e os mecânicos tocam na mão e na área, a bancada e os explosivos do mundo estão na área, e cada arma do catálogo tem golden da regra (`game-weapons/tests/weapon-goldens.test.ts`).
