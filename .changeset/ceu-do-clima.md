---
'@adatechnology/game-weather-three': minor
---

O céu de verdade: `createSky` (com `camera`) e `createWeatherRenderer` passam a desenhar uma cúpula que segue a câmera, com gradiente do zênite ao horizonte, sol com brilho na direção do sol do host (`sun`), calor de nascer e pôr do sol, uma camada de nuvens procedural que acompanha o clima (esparsas no claro, cobertas na chuva, escuras na tempestade) e anda com o vento, e à noite lua e estrelas (escondidas pela cobertura). O horizonte tem a cor da névoa, sem emenda. A cor continua indo para a névoa como antes; `Sky.update(sample, zone, dt)` ganha `dt` e `Sky.dispose()` solta a cúpula. A sala de testes e a sala-casas passam a ter céu pela camada `sky` do clima.
