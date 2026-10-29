---
name: game-urban-three
description: Use quando precisar desenhar em three.js uma cena do game-urban (postes, ruas, quarteirões, adereços), com instâncias de faixas e janelas acesas e apagadas, placas em canvas, luzes reais e as animações de lâmpada falhando e holofote girando.
---

# @adatechnology/game-urban-three

## Objetivo
Desenha as `UrbanScene` do `game-urban` como a Galeria do Vale Cinzento: uma malha por parte na ordem em que foram postas, depois uma malha instanciada para as caixas pequenas e uma para cada tipo de janela.

## Quando usar e quando não usar
- Use para: pôr ruas, postes e quarteirões numa cena three.js (r160 ou mais nova).
- Não use para: gerar a cidade (isso é o `game-urban`).

## Como usar
```ts
const three = createUrbanThree(THREE, { document })
const drawn = three.draw(builder.scene())
scene.add(drawn.root)
drawn.animate(t)   // a cada quadro
drawn.dispose()
```

## API principal
| Export | Para que serve |
|---|---|
| `createUrbanThree(THREE, { document? })` | o desenhista; `draw(scene, { root? })` devolve `{ root, lights, animate, dispose }` |
| `createVehicleResolver(vehiclesThree, { quality? })`, `createPlantResolver(THREE, { lod?, condition?, season?, materials? })` | resolvedores das partes `placement`: veículo `lite` do `game-vehicles-three` e planta do `game-vegetation`; passam em `createUrbanThree(THREE, { resolvers: { vehicle, plant } })` |
| `createUrbanTestModule`, `loadUrbanTestModule`, `URBAN_AREA_ID` | o módulo de teste da sala (itens, bancada, camadas, métricas e cenários) |
| `createRoundedBox`, `createPrism`, `createTextTexture` | as geometrias e a textura do time, soltas |

## Área de teste
`createUrbanTestModule(options)` / `loadUrbanTestModule(room, options)` (`?area=urban` em `examples/urban-test-area`; também carregado na `interactables-test-area`). 17 itens: os cinco postes, a grade de ruas com quarteirão, um trecho de terreno (`terrain` troca) e os dez bairros nas células da Galeria; `urban: { packs, patch, remove }` mostra os catálogos do jogo. Bancada: bairro, semente, lampiões (do padrão, todos, metade, nenhum), orçamento de luzes reais, veículos e plantas (`vehicles: (THREE) => createVehiclesThree(...)` para os carros); ações desenhar e tirar o bairro. Camadas: alcance das luzes e caixa das amostras. Oito cenários `urban_*` sem objeto da sala. O módulo estende a câmera da sala para 600 m enquanto está carregado.

## Compõe com
`game-urban` (as cenas), `game-floorplan` (as silhuetas de casas e prédios entram como partes), `game-vehicles-three` (veículos estacionados), `game-vegetation` e `game-vegetation-species` (plantas).

## Cuidados
- `document` só é exigido para placas e letreiros.
- A sombra vem da parte: caixas, cilindros, cones e prismas projetam e recebem; planos só recebem; copas só projetam; placas e linhas nenhuma.
