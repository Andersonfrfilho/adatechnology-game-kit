---
name: game-destruction
description: Use quando precisar de dano e destruição de objetos num jogo, sem engine, como amassar, furar, trincar, estilhaçar, queimar, derreter, desmontar com ferramenta, desabar estrutura ou receber tiro e explosão. Termos, destruição, dano, material, vidro, concreto, incêndio, fratura, parede, desmontar, colapso.
---

# @adatechnology/game-destruction

## Objetivo
Modelo de destruição independente de engine. Um objeto é um conjunto de **peças** (caixa, cilindro ou esfera com um material) ligadas por **juntas**.
O material decide o efeito do golpe; o mundo devolve tudo como **eventos** em espaço de mundo, que um renderizador desenha. Determinístico (semente) e
serializável. Não conhece nenhum jogo. Unidades: metros, quilogramas, segundos, joules, °C.

## Quando usar e quando não usar
- Use para: tiro, golpe, explosão, fogo, calor, vazamento, desmontar com chave de fenda, estrutura que desaba (colunas, lajes, paredes).
- Não use para desenhar nada (é o `game-destruction-three`), nem para decidir dano em pessoas ou zumbis (fica em `game-characters`).
- Regra do projeto: antes de reimplementar dano, material ou estrutura em outro pacote, use este.

## Como usar
```ts
import { createDestruction } from '@adatechnology/game-destruction'

const world = createDestruction({ seed: 42 })
world.on('*', (event) => console.log(event.type)) // dent, hole, crack, fracture, detach, ignite, melt, leak, explode...

const chair = world.add({
  name: 'chair',
  parts: [
    { id: 'seat', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.04, 0.4] }, position: [0, 0.42, 0] },
    { id: 'leg_fl', material: 'wood_soft', shape: { kind: 'box', size: [0.04, 0.4, 0.04] }, position: [0.18, 0.2, 0.18] },
  ], // juntas inferidas das peças que se tocam, salvo se passar `joints`
})

world.shoot([0, 1, 5], [0, 0, -1], 500, 9) // origem, direção, energia (J), calibre (mm)
world.hit(chair, { type: 'fire', point: [0, 0.4, 0], temperature: 1000, radius: 0.5, duration: 0.2 })
world.disassemble(chair, 'seat~leg_fl', 'screwdriver', 0.016) // progresso 0..1, -1 se a ferramenta não serve
for (const event of world.update(0.016)) console.log(event) // fogo, derretimento, calor, vazamento, explosão atrasada
```
Quem possui as transformações (renderizador ou física) chama `setTransform`; depois de um `detach`, `splitGroup` transforma o pedaço solto em objeto.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createDestruction(options)` | cria o `DestructionWorld` (`seed`, `materials`, `onEvent`) |
| `world.add / remove / register` | adiciona objeto por spec, ou hospeda um `DestructibleImpl` de um módulo |
| `world.hit / hitPart / explode / shoot / raycast` | aplica dano (`ballistic`, `blunt`, `slash`, `explosive`, `fire`, `heat`) |
| `world.update(dt)` | avança fogo, calor, derretimento, vazamento, sobrecarga estrutural e a espera das peças explosivas armadas (reação em cadeia); devolve eventos |
| `explosivePart(explosive, parte, { atC? })` | peça `explodes` com a energia, o alcance (raio de ferimento) e a `chain` de um `ExplosiveDef` do `game-weapons` (barril, tanque do carro, botijão, bomba, tanque do posto) |
| `world.disassemble / workableJoints / nearestJoint` | desmontar juntas com a ferramenta certa |
| `world.setLiters / extinguish / reset / splitGroup / setTransform / setPartPose` | recipientes, apagar fogo, reparar, separar pedaço, sincronizar pose |
| `world.state / part / snapshot / serialize / load` | estado vivo (só leitura), cópia, JSON de ida e volta |
| `MATERIALS`, `guessMaterial(name)` | 26 materiais embutidos; adivinha o material pelo nome da malha |
| `buildFrame`, `sizeStructure` | estrutura de teste (colunas, lajes, paredes) e dimensionamento de capacidade (`redundancyRoles`, `safetyByRole` para casas) |
| `assemblyPart(id, { id, width, height, position })`, `ASSEMBLIES`, `registerAssembly`, `getAssembly` | parede pronta a partir de uma das 8 montagens (`brick_wall_plastered`, `concrete_block_wall`, `reinforced_concrete`, `drywall`, `wood_frame_wall`, `log_wall`, `sheet_metal_shack`, `glass_pane`) |
| `inferJoints`, `JOINT_DEFAULTS`, `JOINT_BY_MATERIALS` | juntas (screw, bolt, weld, mortar, rebar...) |
| `checkDestructible`, `checkHit`, `IMPACT_CONTRACT` | validar um `DestructibleImpl` ou um golpe contra o contrato |
| `resolveStrings(locale)`, `locales` | nomes em `en` e `pt-BR` |

Eventos: `damage`, `dent`, `hole`, `crack`, `ricochet`, `debris`, `fracture`, `detach`, `disassemble_progress`, `ignite`, `extinguish`, `burnout`, `melt`,
`drip`, `leak`, `explode`, `primed`, `stress`, `collapse`, `spall`, `stage`, `expose`, `destroyed`.

## Compõe com
- `@adatechnology/game-contracts`: dono dos tipos de golpe, evento e `DestructibleImpl` (este pacote os reexporta).
- `game-weapons`: cada `Shot` vira `world.shoot(shot.origin, shot.direction, shot.energy, shot.caliber)`.
- `game-fluids`: o evento `leak` vira `fluids.puncture(...)`; `setLiters` mantém o recipiente da peça em sincronia.
- `game-destruction-three`: desenha os eventos. Casas (`game-floorplan-*`) devem usar os materiais e a estrutura daqui (concreto, tijolo).

## Ambiente de teste
Não há `examples/` próprio. A "Sala de testes de destruição" do kit é uma build deste SDK dentro de `examples/test-room` (`node build.mjs` gera
`dist/test-room.html`, um arquivo só). A área abre com `?area=` na sala.

## Paredes em camadas, estágios e armadura (T2.3)
- Peça com `layers` (reboco), `units` (tijolo, bloco, painel), `reinforcement` (vergalhão) ou `breach` entra em **estágios** (`PartState.stage`, evento `stage`): 0 intacta, 1 no primeiro furo, trinca ou lasca, 2 quando o dano passante num raio de 0,55 m soma `breach.area` (0,25 m²), 3 ao fraturar ou desabar. No 2 saem fragmentos do tamanho da peça (`stage.fragments`), a peça **fica** com `opening` (tiro e raio passam) e o evento não manda esconder a peça.
- Penetração soma `penetration x espessura` de cada camada que o tiro cruza mais a do núcleo; a camada de fora lasca no impacto (`spall`) antes do núcleo, e o remendo lascado não segura mais nada. Rajada de 9 mm em tijolo rebocado: lasca, fura, no máximo estágio 1; 7,62: fura, estágio 1, nunca rompe concreto armado; marreta abre tijolo depois de ~47 golpes; C4 ou RPG abre concreto armado e expõe o vergalhão (`expose`).
- Concreto armado a 0 hp esfarela mas a peça vira **gaiola** (`stripped`, `expose` com os vergalhões, capacidade x `residualCapacity` 0,15): sobrecarregada, cede em segundos e o colapso é progressivo (pilar, depois laje e telhado, com tempo). Tiro atravessa a gaiola; as juntas `rebar` de peça armada só cedem a maçarico ou serra. Abertura da largura da peça corta a peça (pilar, verga): vira fratura.
- Furos ficam nos pedaços: todo fragmento de `fracture` ou de brecha leva `marks` (furos que caíram nele, até 12).
- Casa: `sizeStructure(spec, { redundancy: 0.97, redundancyRoles: ['column', 'wall'], safetyByRole: { beam: 0.45, slab: 0.45, roof: 0.45, stair: 0.45 } })`.

## Explosões: abrigo, estilhaços e confinamento

Opções `blast` (no mundo, em `world.explode(..., opções)` ou no `Hit` explosivo), todas desligadas por padrão: `shelter` (partes entre o centro e o
alvo deixam passar `exp(-hp por m² / k)` da energia; a que quebra na mesma explosão deixa passar mais), `fragmentHits` (fragmentos viram golpes
`blunt` de `0,5·m·v²/2` no que está atrás, no máximo 24, semeados) e `confinement` (26 raios, multiplicador de 1 a 3, ou o número do host).
O retorno traz `HitResult.blast` e o evento `blast`; o renderizador empurra as peças com `renderer.explode(..., { report })`. Para balas:
`Hit.piercing` / `piercingOf(calibre, tipo)` (chumbo mole não fura aço só pela energia) ; a explosão só abre brecha perto (0,12 m por raiz cúbica de kJ, sempre ligado, sem opção).
Detalhes e números no README do pacote; exemplos de pilares e vigas em `tests/beams-and-columns.test.ts`. Não existe entrega de time para isso:
é modelo novo do kit, aprovado pelo dono em 2026-10-24.

## Cuidados
- Reação em cadeia (A11): peça com `explodes.chain` é **armada** por tiro (`shot`, depois de `shotDamageFraction` do hp), fogo (`fire`, a `atC` ou 300 °C) ou explosão no alcance (`explosion`) e explode depois do atraso daquele gatilho (número ou `[mín, máx]` sorteado da semente). Evento `primed` ao armar, `explode` no fim. Cada peça explode uma vez; tiro e explosão armam em vez de despedaçar na hora; a ordem é por tempo, depois por objeto e peça. O atraso conta do instante da explosão que armou, então a linha do tempo não depende do `dt` de `update`. Sem `update`, nada explode.
- Um golpe tira `energy * 0.02 * damageScale` de vida. Passa por `energy > penetração (J/mm) * espessura (mm)`; ângulo raso conta caminho maior e pode ricochetear.
- Vidro e cerâmica (`shatter`) levam dano multiplicado por `fragility`: 9 mm quebra um vidro de 3 mm em um tiro.
- Fogo só leva a peça até a temperatura da fonte: fogueira (800 °C) nunca derrete aço (1450 °C).
- `state()` e `part()` são vistas **vivas**: não guarde entre quadros para comparar; use `snapshot`.
- Eventos e pontos estão em espaço de mundo; `register` de um impl só usa a transformação para raycast e alcance da explosão; `splitGroup` num impl lança erro.
- Aleatoriedade vem só da semente (nada de `Math.random`); `load` exige os mesmos materiais.
- Estrutura: a laje/viga é sustentada pela **soma** dos apoios que restam (4 pilares dividem a carga; perdendo pilares ela passa aos outros; cai quando a capacidade que sobra é menor que a carga). Configuração: `structure.capacity`, `MaterialDef.compressive`, `sizeStructure({ safety, redundancy })` e a opção do mundo `structure: { safetyFactor }` (padrão 1). Sem `structure` o objeto se comporta como antes; capacidades brutas de material costumam ser absurdas, use `sizeStructure`.
- Explosão: fragmentos têm teto de 40 m/s.

## O que vem pela migração (spec 001)
- Concreto armado e tijolo como material e estrutura (apontado pelo dono em 2026-10-23), a verificar no artefato da Sala de destruição (V8: juntar as duas versões).
- Explosão do Laboratório com teto por área (E1). A reação em cadeia (A11) já está aqui (T1.5, ver Cuidados).
- Dois raios de explosão, letal e de ferimento (E3): dados em `game-weapons`, dano em `game-characters`.
- Carro e parede da Galeria não são portados: usam este pacote (A8).
- Destruição passa a usar o futuro `game-vfx` para os efeitos (E4).
