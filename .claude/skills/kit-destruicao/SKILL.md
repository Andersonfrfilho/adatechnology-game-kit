---
name: kit-destruicao
description: Use para materiais e como cada um amassa, fura, lasca, queima, derrete ou quebra (tiro, golpe, explosão, fogo), vergalhão e colapso, destroços e partículas, líquidos (recipiente, derramar, poça) e terreno deformável (cavar, cratera, camadas do solo).
---

# Materiais, destruição, líquidos e terreno

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-destruction`](references/game-destruction.md) | Engine-agnostic destruction model: materials decide how parts dent, burn, melt, crumble, shatter, splinter, break apart and come apart at their joints.… |
| [`game-destruction-three`](references/game-destruction-three.md) | three.js renderer for @adatechnology/game-destruction: dents, holes, char, heat glow, melting, fragments, loose pieces and pooled particles (fire, smoke… |
| [`game-fluids`](references/game-fluids.md) | Engine-agnostic liquids for games: containers with level, temperature and tilt (fill, pour, drink, spill, leak through holes), streams, and puddles and stains… |
| [`game-fluids-three`](references/game-fluids-three.md) | three.js renderer for @adatechnology/game-fluids: liquid surfaces inside containers, streams with a drop at the tip, puddles that grow from a flow front, wet… |
| [`game-terrain`](references/game-terrain.md) | Deformable ground: a height field in chunks with strata per column (turf over soil over rock, asphalt over gravel, tile over mortar over slab). Blows dig the… |
| [`game-terrain-three`](references/game-terrain-three.md) | three.js renderer for @adatechnology/game-terrain: chunked ground with a material pattern per surface, simplified far away, the marks as instanced decals… |
