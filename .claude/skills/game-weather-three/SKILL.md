---
name: game-weather-three
description: Use quando precisar desenhar o clima com three.js a partir do game-weather - cortina de chuva de 14 000 pontos, chuva perto com respingos e anéis, névoa e cinza, neblina linear ou exponencial com neblina de zona, céu que escurece na chuva, relâmpago, faróis na chuva e névoa de calor. Termos, chuva, neblina, relâmpago, faróis, céu, createWeatherRenderer.
---

# @adatechnology/game-weather-three

## Objetivo
O visual do `game-weather`: lê `weather.sample()` a cada quadro e desenha a cortina de chuva do jogo (14 000 pontos numa caixa de 70 m que segue a câmera, 13 m/s,
shaders do `jogo.js` letra por letra), a chuva perto da Oficina (riscos, respingos e anéis nos pools do `game-vfx`, desenhados pelo `game-vfx-three`), névoa e cinza, neblina
(linear ou exponencial, mais a neblina de zona), o céu (noite a dia pelo sol, escurecido na chuva), o relâmpago duplo, os faróis na chuva e a névoa de calor (feita pelo kit).

## Quando usar e quando não usar
- Use para mostrar o tempo do mundo numa cena three.js, ou para ligar `createWeatherVisual` à bancada do `game-weather` na sala de testes.
- Não use para decidir o tempo (é o `game-weather`), nem para o som (também do `game-weather`/`game-audio`), nem para partículas próprias: tudo que é partícula vai pelo `game-vfx`.

## Como usar
```ts
import * as THREE from 'three'
import { createWeather } from '@adatechnology/game-weather'
import { createWeatherRenderer } from '@adatechnology/game-weather-three'

const weather = createWeather({ seed: 1, start: 'storm' })
const picture = createWeatherRenderer(THREE, { scene, camera, weather, vfx, profile: 'medium', zone: { weight: 0 } })
picture.headlights.attach(carGroup, lensMaterial)   // duas luzes e dois cones no carro
weather.advance(dt); picture.update(dt)             // todo quadro
picture.setLayer('sky', false)                      // far_rain, near_rain, mist, fog, sky, lightning, headlights, haze
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createWeatherRenderer(THREE, options)` | tudo junto: `update`, `setLayer`, `setZoneFog`, `setProfile`, `headlights`, `stats`, `dispose` |
| `createRainCurtain`, `rainCurtainPositions`, `RAIN_CURTAIN*` | a cortina do jogo (posições em Float32, shaders literais, perfis) |
| `createNearRain` | liga o `engine.rain` do `game-vfx` ao clima (`drops`, `windX`, respingo a partir de 5 mm/h) |
| `createFog`, `fogOf`, `emitAirborne` | neblina linear/exp2 com zona; névoa e cinza no pool `normal` |
| `createSky`, `createLightning`, `createHeadlights`, `createHeatHaze` | céu, relâmpago, faróis, névoa de calor |
| `createWeatherVisual({ vfx, layers, rig })` | a fábrica `visual` da bancada do clima |

## Compõe com
`game-weather` (a amostra), `game-vfx` e `game-vfx-three` (pools e desenho das partículas, da tela branca e das luzes), `game-test-room` (`room.vfx`).

## Ambiente de teste
`examples/weather-test-area` (cortina, chuva perto, névoa, relâmpago, faróis num suporte de lanternas, névoa de calor; camadas na bancada) e `examples/interactables-test-area` (o clima desenhado sobre os móveis, com o céu e a neblina da sala).

## Cuidados
- Não reescreva os shaders da cortina: o golden compara o texto com o do jogo. Não crie partículas fora do `game-vfx`.
- A névoa de calor é do kit (nenhum time entregou) e não distorce a imagem: isso pede um alvo de render que só o anfitrião tem.
- A neblina devolve a do anfitrião quando a camada `fog` é desligada; o céu só reescreve o fundo com a camada `sky` ligada.
- Um mundo de efeitos compartilhado é avançado só por quem chama o `update` do renderizador do `game-vfx-three`.
