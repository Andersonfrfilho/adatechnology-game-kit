---
name: game-weapons-three
description: Use quando precisar da apresentação em three.js das armas do game-weapons, como modelo low-poly da arma, arma na mão com movimento de tiro e recarga, cápsulas ejetadas, pente caindo, sons sintetizados e a área de testes de armas. Termos, viewmodel, arma na mão, cápsula, som de tiro, balcão de armas.
---

# @adatechnology/game-weapons-three

## Objetivo
Lado three.js do `@adatechnology/game-weapons`: modelos low-poly de armas, a arma na mão com movimento de tiro e recarga, cápsulas ejetadas e pentes
que caem, sons sintetizados com WebAudio (sem arquivos de som) e a **área de testes de armas** (balcões com todas as armas e alvos) como `TestableModule`.

> Este pacote só existe na branch `feat/site-landing-catalogo` (worktree `adatechnology-game-kit-wt/feat-landing`); versão `0.0.0`, ainda não publicado.

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
`createWeaponFx({ THREE, scene, camera, arsenal, groundAt, audio })` é o que o módulo cria em `attach`; alimente com `fx.handle(event, tool)` (eventos da
ferramenta do host) e `fx.update(dt)` a cada quadro.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createWeaponsTestModule(options?)` | `TestableModule` com `id: 'weapons_area'`; expõe também `audio` e `fx`. Opções: `locale` (padrão `pt-BR`), `arsenal`, `sound` |
| `weaponsLayout(weaponItemIds)` | posições dos balcões, armas e alvos (aço, compensado, concreto) |
| `createWeaponFx(options)` | arma na mão, movimento de tiro e recarga, cápsulas e pentes; `handle`, `update`, `inHand`, `casings`, `magazines`, `dispose` |
| `createWeaponAudio(volume?)` | `shot(energyJ, category)`, `click`, `reloadStart/End`, `cycle`, `clink`, `thud`, `setVolume`, `dispose` |
| `buildWeaponModel(THREE, def)` / `buildProp` / `weaponProp` | modelo e spec (`DestructibleSpec` de caixas) de uma arma |
| `BODY_ACTIONS` | ids sem modelo próprio (`hand`, `kick`, `shove`, `fists`) |
| `WEAPON_ITEM_PREFIX`, `COUNTER_ITEM_ID` | prefixo `weapon_` dos itens e id do balcão |

## Compõe com
- `game-weapons` (dependência): arsenal e definições.
- `@adatechnology/game-contracts` (dependência): `TestableModule`, `HostEvent`, `HostTool`.
- `game-destruction` (devDependency): os alvos e armas soltas são specs de destruição.
- `game-test-room` (devDependency): carrega o módulo com `loadModule`. O pacote não faz parte do contrato genérico da sala (regra do projeto: nada de arma na sala).

## Ambiente de teste
`examples/weapons-test-area`: `node build.mjs` empacota o módulo em `dist/weapons-area.js` (global `WeaponsArea`) e gera `dist/sala-armas.html`
(sala de testes com a área carregada e aberta, um arquivo, sem rede). `node test.mjs` testa. No arquivo `src/entry.js`, `WeaponsArea.loadInto(room)`
carrega e abre a área. As áreas da página do kit abrem por `?area=`. Os testes do pacote ficam em `tests/weapons-area.test.ts`.

## Cuidados
- `three` é peer (`^0.160.0`): passe o seu `THREE`.
- O som só nasce no primeiro disparo vindo de clique ou tecla (política dos navegadores) e é no-op onde não há `AudioContext` (testes, workers).
- Cápsulas e pentes têm teto (120 cápsulas, 12 pentes, 25 s de vida); revólver não ejeta cápsula a cada tiro e arma de ferrolho ou pump toca o som do ciclo.
- As peças do prop deitado se tocam sem se sobrepor; sobrepor faz a física separar e a arma deslizar. Armas no balcão nascem `asleep`.
- Itens não podem ter id começando por `weapon_` se não forem arma: a sala distingue pelo prefixo (por isso o balcão é `counter_weapons`).
- O som foi feito em 2026-10-23 sem base nas entregas dos times.

## O que vem pela migração (spec 001)
- O modelo atual é low-poly procedural; a Galeria 3D do Arsenal (armas com medida real, tiro, recarga por tipo, pane) deve ser **portada, não reescrita** (regra do projeto).
- Animação padrão cumprindo o contrato de fases do `game-weapons` (A5): a da Galeria, substituível por qualquer renderizador.
- Sons: juntar a classe e o abafamento por distância do jogo com a energia do calibre (S2), sobre o `game-audio` genérico (S1); golden compara os parâmetros gerados, não o áudio.
- Efeitos de boca e explosivos passam a vir do `game-vfx-three` (E4).
