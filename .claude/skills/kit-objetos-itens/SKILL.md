---
name: kit-objetos-itens
description: Use para móvel e objeto que funciona (porta, gaveta, geladeira, fogão, botijão, tomada, sofá), rede de energia, gás e água dos objetos, itens do catálogo (327 itens reais, peso, inventário, achados) e props de cenário.
---

# Móveis, objetos interativos e itens

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-interactables`](references/game-interactables.md) | Renderer-agnostic runtime for interactive world objects: movable parts, containers with pickable items, power grid, fuel, logical plumbing, seats, soft… |
| [`game-interactables-household`](references/game-interactables-household.md) | Household content pack for @adatechnology/game-interactables: fridges, wardrobes, drawers, stove, gas bottle, sockets, sofas, bins, mailbox, barbecue… |
| [`game-interactables-three`](references/game-interactables-three.md) | three.js adapter for @adatechnology/game-interactables: merged-by-material mesh api with animated parts, pose sync, cloth sway with matching shadows, pooled… |
| [`game-items`](references/game-items.md) | Engine-agnostic item catalog engine: item definitions (category, size, weight, rarity, durability, shelf life, protection, carry), an extensible registry with… |
| [`game-items-goods`](references/game-items-goods.md) | Catalog of real-world items for @adatechnology/game-items: 327 items with real size and weight, categories, places, rarities, storage, recipes, containers… |
| [`game-items-three`](references/game-items-three.md) | three.js presentation for @adatechnology/game-items: the 24 models of the Itens do Vale Cinzento showcase at real size, simple shapes at real size for every… |
| [`game-props3d`](references/game-props3d.md) | Procedural low-poly 3D props (decor, modern furniture, yard, house-state). Builders only describe primitives through an api passed by the host, so any renderer… |
