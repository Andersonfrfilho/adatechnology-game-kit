---
name: game-weather
description: Use quando precisar de clima num jogo, como chuva leve e forte, tempestade, neblina, vento, ciclone, tufão, calor intenso, relâmpago com trovão, solo molhado, ciclo de dia e noite, índice de calor, e do que o tempo muda para visão, audição e passos. Determinístico por semente, sem three.js nem áudio. Termos, clima, tempo, chuva, relâmpago, estado do tempo, createWeather.
---

# @adatechnology/game-weather

## Objetivo
Clima puro e determinístico por semente: estados (`clear`, `overcast`, `light_rain`, `heavy_rain`, `storm`, `fog`, `windy`, `cyclone`, `typhoon`,
`extreme_heat`) com os números das páginas dos times (cada estado lista `sources`), climas que passam de um estado a outro em tempo de jogo,
relâmpago, solo molhado, efeitos de jogo, índice de calor e a fórmula de dia e noite do jogo. Sem three.js, sem som e sem conteúdo de um jogo:
quem desenha (`game-weather-three`) e quem toca lê os valores daqui. Sem dependências; roda no navegador e no Node.

## Quando usar e quando não usar
- Use para decidir o tempo do mundo, dar a um renderizador a chuva, o vento, a névoa e o relâmpago, e a quem tem olhos, ouvidos e pés (IA, jogador)
  a visão, a audição e o ruído de passos do momento.
- Não use para desenhar nem tocar: renderização é de `game-weather-three`; o som de chuva, vento e trovão é do pacote de áudio.
- Mundo normal primeiro: todo clima começa `clear`; nada aqui depende do surto.

## Como usar
```ts
import { createWeather } from '@adatechnology/game-weather'

const weather = createWeather({ seed: 7, climate: 'tropical' }) // começa limpo, 8h, dia de 20 min (timeScale 72)
weather.on('strike', (strike) => clarao(strike.bearing))
weather.on('thunder', (strike) => trovao(strike.distance)) // distância / 343 s depois do clarão
weather.advance(dt) // segundos reais, todo quadro
const sample = weather.sample() // rain mm/h, windX/windZ m/s, fogFar, nightFactor, groundWetness, flash, front, effects...
sample.effects.sightScale // multiplica o alcance de visão (já com 1 - 0.4 × noite)
weather.force('storm', 10) // vira tempestade em 10 s reais
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createWeather({ seed, climate, start, timeScale, startHour, autoSchedule, wetness, states, climates, patch, remove, registry })` | O mundo: `advance`, `sample`, `state`, `force`, `setTimeScale`, `setAutoSchedule`, `timeline`, `on('transition' \| 'strike' \| 'thunder')` |
| `createTimeline({ seed, climate, hours, sampleMinutes? })` | O que um mundo novo faz em N horas de jogo (mudanças, relâmpagos com tempo, distância e rumo, amostras a cada 10 min): JSON para goldens |
| `WEATHER_STATES`, `CLIMATES` | Dados enviados; `temperate` (padrão, sem extremos) e `tropical` (extremos raros) |
| `createWeatherRegistry(options)` | Catálogo com `registerState`, `patchState`, `removeState` (e o mesmo para climas); `patch` mescla fundo por id; remover um estado o tira do sorteio |
| `heatIndexC(tempC, umidade%)`, `heatStress(índiceC)` | Rothfusz (NOAA) e faixas 27/32/41/54 °C em 0..1 |
| `daylight(fraçãoDoDia)`, `dayFractionAt(horaInicial, segundos)` | Fórmula do jogo (`s`, `nightF`); 0 é meia-noite |
| `flashIntensity(s)`, `thunderDelay(m)`, `createLightningStream(seed)` | Envelope do clarão duplo da Oficina e o atraso do trovão |
| `createWetness`, `blendValues`, `deriveEffects` | Peças usadas por dentro, expostas |

## Compõe com
`game-contracts` (o módulo de clima escreve `EnvironmentState` no `EnvironmentBus` da sala), `game-fluids` (chuva para a secagem e espalha 50%
mais), `game-interactables` (`water.setRain`, `setWind`), `game-vegetation` (`setWind`), `game-vfx` (vento) e o pacote de áudio (laços de chuva e vento,
trovão). As pontes ficam na T6.2b.

## Ambiente de teste
`pnpm --filter @adatechnology/game-weather test` (vitest: dados, escalonador, relâmpago, solo, efeitos, calor, dia e noite, registro e os goldens de 72 h
com sementes 1, 7 e 42 nos dois climas; os goldens rodam em Node 22 e 24). A bancada `createWeatherTestModule` vem na T6.2d.

## Cuidados
- O tempo do escalonador é **de jogo** (`timeScale` 72 = dia de 20 min); o solo (180 s para secar), o relâmpago (3,5 a 6 s) e `force(id, segundos)` são em segundos **reais**.
- `patch` mescla objetos por id mas não apaga chaves: para impedir uma mudança de estado, ponha o peso em 0 em vez de `{}`.
- Ciclone, tufão e calor intenso são predefinições físicas sem fonte de time; o calor intenso é +6 °C sobre o clima (38 °C ao meio-dia tropical).
- Mude a semente e o relâmpago e o escalonador mudam juntos, mas cada um tem o seu fluxo: sortear relâmpago nunca desloca o calendário.
