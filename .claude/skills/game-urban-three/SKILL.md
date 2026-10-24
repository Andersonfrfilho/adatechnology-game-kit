---
name: game-urban-three
description: Use quando precisar desenhar em three.js uma cena do game-urban (postes, ruas, quarteirões, adereços), com instâncias de faixas e janelas acesas e apagadas, placas em canvas, luzes reais e as animações de lâmpada falhando e holofote girando.
---

# @adatechnology/game-urban-three

## Objetivo
Desenha as `UrbanScene` do `game-urban` como a Galeria do Vale Cinzento: uma malha por parte na ordem em que foram postas, depois uma malha instanciada para as caixas pequenas e uma para cada tipo de janela.

## Quando usar e quando não usar
- Use para: pôr ruas, postes e quarteirões numa cena three.js (r128 ou mais nova).
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
| `createRoundedBox`, `createPrism`, `createTextTexture` | as geometrias e a textura do time, soltas |

## Compõe com
`game-urban` (as cenas), `game-floorplan` (as silhuetas de casas e prédios entram como partes), `game-vehicles-three` (veículos estacionados), `game-vegetation` e `game-vegetation-species` (plantas).

## Cuidados
- `document` só é exigido para placas e letreiros.
- A sombra vem da parte: caixas, cilindros, cones e prismas projetam e recebem; planos só recebem; copas só projetam; placas e linhas nenhuma.
