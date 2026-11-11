---
name: kit-casas
description: Use para criar ou mudar casa, prédio, planta, lote, parede, muro, pilar, laje, telhado, calha, instalação elétrica/hidráulica/gás, tipologia (residencial, comercial, rural, pós-apocalíptica), estrutura e validador estrutural, ou rua, poste e quarteirão da cidade.
---

# Casas, prédios, estrutura e cidade

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-floorplan`](references/game-floorplan.md) | Procedural floor plans and lots engine: rooms, walls, doors, windows, recorded slots, seeded item fill, placement rules, perimeter, gates, paths, ground cover… |
| [`game-floorplan-structure`](references/game-floorplan-structure.md) | Structure pack for @adatechnology/game-floorplan: construction systems (masonry, wood frame, log, improvised, canvas), the load path of every plan (roof… |
| [`game-floorplan-three`](references/game-floorplan-three.md) | three.js renderer for @adatechnology/game-floorplan: walls, doors, windows, floors, stairs, roofs, lot, furniture, lights, mirrors and cars of a plan, bound to… |
| [`game-floorplan-residential`](references/game-floorplan-residential.md) | Residential content pack for @adatechnology/game-floorplan: house and apartment templates, furniture catalogue, room slot libraries, decor rules, façade colour… |
| [`game-floorplan-commercial`](references/game-floorplan-commercial.md) | Commercial content pack for @adatechnology/game-floorplan: market and pharmacy templates, shop catalogue, slot libraries, commercial style and en / pt-BR… |
| [`game-floorplan-rural`](references/game-floorplan-rural.md) | Rural content pack for @adatechnology/game-floorplan: wood frame house, A-frame chalet, log cabin, shack and campsite, with the rural style, slot libraries… |
| [`game-floorplan-post-apocalyptic`](references/game-floorplan-post-apocalyptic.md) | Post-apocalyptic genre pack for @adatechnology/game-floorplan: the fortified and abandoned house states as a state plugin, with their item types, flags and a… |
| [`game-floorplan-interactables`](references/game-floorplan-interactables.md) | Bridge between a game-floorplan plan and the interactables kit: turns the furniture, sockets, switches, lamps, gas, plumbing and fixtures of a plan into… |
| [`game-urban`](references/game-urban.md) | The urban pattern as data, with no three.js: the five street poles with a light budget, roads, sidewalks and street grids, filled blocks of city buildings and… |
| [`game-urban-three`](references/game-urban-three.md) | Draws the urban pattern of game-urban with three.js: parts as meshes with the team's rounded boxes, instanced road dashes and windows (lit and dark), canvas… |
