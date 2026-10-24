---
name: game-fluids
description: Use quando precisar de líquidos num jogo, sem engine, como copo, garrafa, galão, tanque, nível, beber, despejar, derramar, vazar por furo, torneira, poça, mancha, sangue seco, óleo, gasolina. Simula recipientes, jatos e manchas que escorrem, são absorvidas e secam.
---

# @adatechnology/game-fluids

## Objetivo
Líquidos sem renderizador, independentes de engine. **Recipientes** com nível calculado pelo formato e pela inclinação, temperatura (esfria, solta vapor)
e abertura; **jatos** balísticos que terminam na primeira superfície; **manchas** que crescem de uma frente de fluxo, escorrem, são absorvidas por
superfícies porosas e secam da borda para dentro. 21 líquidos embutidos (sangue, sangue antigo e bile com os valores do Padrão de Fluidos; `splash` aceita `tint`), usos de item prontos (`sip`, `drink`, `pour`...) e torneiras.
Determinístico por semente, serializável. Unidades: metros, litros, segundos, °C.

## Quando usar e quando não usar
- Use para: beber, despejar, derramar ao inclinar, vazar por tiro, torneira, mancha no chão, efeitos de bebida (`caffeine`, `alcohol`, `poison`, `disgust`).
- Não use para desenhar (é o `game-fluids-three`) nem para água de rio, mar ou fluido por partículas: aqui é recipiente, jato e mancha.

## Como usar
```ts
import { createFluids, createItemUse, ITEM_USES } from '@adatechnology/game-fluids'

const fluids = createFluids({ seed: 42, locale: 'pt-BR', onEvent: (event) => console.log(fluids.describe(event)) })
fluids.addSurface({ id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [10, 10], porosity: 0.05 })

const cup = fluids.addContainer(
  {
    capacity: 0.25,
    liquid: 'coffee',
    liters: 0.25,
    temperature: 90,
    shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, // origem no centro do fundo interno, +Y para cima
    opening: 0.04,
  },
  { id: 'cup', position: [0, 0.8, 0] },
)

// a cada quadro: sincronize com o objeto que o carrega, depois avance
fluids.setTransform(cup, position, [qx, qy, qz, qw], velocity)
for (const event of fluids.update(dt)) {
  if (event.type === 'drink' && event.effects.includes('caffeine')) player.energy += event.thirst * 0.1
}

const use = createItemUse(fluids, 'cup', ITEM_USES.find((u) => u.id === 'sip')!, () => ({ position: handPos, rotation: handQuat }))
for (const event of use.update(dt)) console.log(fluids.describe(event))
```
Vazar por tiro: mapeie o evento `leak` do `game-destruction` em `fluids.puncture(containerId, pontoLocal, normalLocal, diametro)`.

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createFluids(options?)` | `FluidWorld` (`liquids`, `locale`, `seed`, `ambientC`, `gravity`, `groundAt`, `mergeDistance`, `maxStains`, `onEvent`) |
| `addContainer / removeContainer / setTransform` | recipientes e sua pose (a inclinação decide derrame e superfície) |
| `fill / pour / drink / open / close / heat / puncture` | encher, despejar, beber, tampa, aquecer, furar |
| `addSurface / removeSurface` | planos com `halfSize` e `porosity` onde caem os jatos |
| `addTap / setTap / removeTap / taps` | torneiras: fontes fixas |
| `splash / clearStains` | derramar num ponto; limpar ou queimar manchas |
| `update(dt)` | avança tudo e devolve os eventos |
| `container / containers / streams / stains` | estado (cópias) para desenhar: **desenhe pelo estado, não pelos eventos** |
| `serialize / load / on / describe` | JSON, ouvintes, frase localizada |
| `LIQUIDS`, `ITEM_USES`, `createItemUse` | 21 líquidos, 7 usos (`sip`, `drink`, `chug`, `pour`, `pour_out`, `open`, `close`), jogador de keyframes |
| `ballistic`, `sampleStream`, `stainDirection`, `STAIN_SAMPLES` | caminho do jato e direções da frente da mancha (16 amostras) |
| `describeEvent`, `resolveStrings`, `locales` | textos `en` e `pt-BR` |

Eventos: `fill`, `pour`, `spill`, `leak`, `drink`, `empty`, `stream_end`, `splash`, `stain`, `dried`, `steam`, `mix`, `tap`.

## Compõe com
- `@adatechnology/game-contracts`: dono de `ContainerSpec`, `ItemUseDef` e `LiquidId` (reexportados aqui).
- `game-destruction`: `leak` vira `puncture`; `setLiters` na peça acompanha o recipiente. A mancha de líquido inflamável pode ser entregue pelo host ao sistema de fogo.
- `game-fluids-three`: desenha o estado. `game-weather` (futuro): chuva espalha sangue e impede secar.

## Ambiente de teste
Não há `examples/` próprio; a sala de testes `examples/test-room` já embute `game-fluids` e `game-fluids-three` (`node build.mjs`, HTML único). Os testes
do pacote estão em `packages/game-fluids/tests`.

## Cuidados
- `setTransform` recebe a posição do **fundo interno** do recipiente e a rotação como quaternion `[x, y, z, w]`; `puncture` usa ponto e normal em espaço local do recipiente.
- Recipiente fechado nunca derrama nem despeja; `opening: 0` exige `open()`. Beber acima de 65 °C marca `burn`.
- Eventos de chamadas diretas (`drink`, `fill`, `puncture`, `splash`) são entregues uma vez e `update` não os repete.
- O id de superfície `ground` é reservado (chão implícito por `groundAt`). Máximo de manchas 64 por padrão; as secas e mais antigas saem primeiro.
- Misturar líquidos mantém o maior e emite `mix`. Cores são inteiros `0xRRGGBB`; viscosidade é relativa à água; densidade em kg/m³.
- Uso de item restrito por `def.liquids`; `createItemUse` com `getHandTransform` faz o recipiente seguir a mão, sem ele o host anima a partir de `pose()`.
- Sem `Math.random`: só a semente.

## O que vem pela migração (spec 001)
- Dados de fluido **configuráveis por jogo** (E2); o SDK traz como padrão os valores do time (Padrão de Fluidos F1 a F12), por exemplo o sangue que seca marrom `3B1D14` em 10 min.
- Entram: filme que escorre, respingo por ângulo, bile e sangue antigo.
- Conteúdo só do ZombiAdA (marca da horda, sangue da história) fica no repositório do jogo, não aqui (G2).
- Simulação da Oficina de VFX roda na CPU e sobe a textura inteira por quadro: aqui, simular só perto do jogador ou passar para a GPU.
- `game-weather` liga chuva às manchas (E6).
