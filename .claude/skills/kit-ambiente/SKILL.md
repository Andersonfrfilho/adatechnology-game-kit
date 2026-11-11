---
name: kit-ambiente
description: Use para explosão, fogo, fumaça e marcas (VFX), chuva, neblina, vento, relâmpago e dia e noite, árvores e plantas, e som (receitas, distância, mixagem, sons por material).
---

# Efeitos, clima, plantas e som

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-vfx`](references/game-vfx.md) | Renderer-free visual effects, deterministic and testable in Node: the Explosion Lab's layer compositor (flash, fireball that cools into smoke, shock wave… |
| [`game-vfx-three`](references/game-vfx-three.md) | three.js renderer for @adatechnology/game-vfx: the Explosion Lab's shaders (heat-ramp puffs that dissolve, streaked shrapnel, halos, shock shell and ground… |
| [`game-weather`](references/game-weather.md) | Pure, seeded weather for games: states (clear to typhoon), climates with a Markov scheduler in game time, fronts from the west, lightning with thunder delay… |
| [`game-weather-three`](references/game-weather-three.md) | three.js renderer for @adatechnology/game-weather: the game's rain curtain (14 000 GPU points), the near rain and mist and ash on the game-vfx pools, linear… |
| [`game-vegetation`](references/game-vegetation.md) | Engine-agnostic procedural vegetation: stylized low-poly trees, palms, cacti, flowers, grass and more, deterministic by seed, with LODs, lot merging, scatter… |
| [`game-vegetation-species`](references/game-vegetation-species.md) | Content pack for @adatechnology/game-vegetation: ~90 plant species as JSON (trees, palms, shrubs, flowers, cacti, succulents, grasses, vines, potted), pt-BR… |
| [`game-vegetation-three`](references/game-vegetation-three.md) | The vegetation test module for the shared test room: the 18 plants of the Viveiro as destructible items (separable pieces, joints, real wood thickness, sway… |
| [`game-audio`](references/game-audio.md) | Sound as data for games: recipes planned into resolved, seeded sound plans, a WebAudio layer that builds them, distance curves, pan, a voice limiter, loops and… |
