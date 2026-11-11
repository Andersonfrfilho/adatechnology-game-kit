---
name: kit-pessoas-bichos
description: Use para corpo de personagem, profissões e fardados, zumbis e infecção, multidão e horda, jogador (fôlego, feridas, empurrão), animais e histórias geradas.
---

# Pessoas, zumbis, multidão, jogador, animais e histórias

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-characters`](references/game-characters.md) | Engine-agnostic living bodies for games: body proportions, rig, an 11-kind segment tree with 6 crowd regions, and a damage model (protection, penetration… |
| [`game-characters-people`](references/game-characters-people.md) | Content pack for @adatechnology/game-characters: 12 generic professions as character presets (nurse, police officer, firefighter, mechanic, builder, cook… |
| [`game-characters-uniformed`](references/game-characters-uniformed.md) | Content pack for @adatechnology/game-characters: 7 generic uniformed forces with real Brazilian names (army, military police, civil police, highway police… |
| [`game-characters-undead`](references/game-characters-undead.md) | Zombie-only layer over @adatechnology/game-characters, as data: the 13 undead types (health, speeds, multipliers, perception, eyes, posture, gait, abilities)… |
| [`game-characters-three`](references/game-characters-three.md) | three.js presentation for @adatechnology/game-characters: the instanced crowd body (GPU animation, LOD, baking, variants, flying limbs) and the rich bodies… |
| [`game-crowd`](references/game-crowd.md) | Any crowd as a struct of arrays, pure and seeded: relevance bands, perception by sight, hearing and smell, a sliced flow field, separation, attack slots, chain… |
| [`game-crowd-three`](references/game-crowd-three.md) | three.js drawing for @adatechnology/game-crowd: every agent, body on the ground and civilian as instances (a literal port of the team game's hordeRender and… |
| [`game-player`](references/game-player.md) | Pure, seeded player body for games: vitals from an attribute sheet, stamina, wounds and bleeding, an optional individual infection, being grabbed and breaking… |
| [`game-animals`](references/game-animals.md) | Engine-agnostic animals for games: the body spec of quadrupeds, birds and snakes (proportions, legs, neck, head, ears, tail, colours), the three gait phase… |
| [`game-animals-species`](references/game-animals-species.md) | Content pack for @adatechnology/game-animals: 13 species (cow, horse, pig, wild boar, capybara, jaguar, dog, cat, chicken, southern lapwing, vulture… |
| [`game-animals-three`](references/game-animals-three.md) | three.js drawing of the animals of @adatechnology/game-animals: a literal port of the Bichos do Vale builders (quadruped, bird, snake) and their animation… |
| [`game-infection`](references/game-infection.md) | Deterministic abstract epidemic model by regions (anything that spreads by contact with a delay: zombies, plague, rumours). Knows nothing about any game. |
| [`game-stories`](references/game-stories.md) | Pure, seeded story generator for games: roles cast from people or name pools at world creation, stories as data that cross each other through flags and the… |
