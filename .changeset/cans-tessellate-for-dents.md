---
"@adatechnology/game-items-three": patch
---

The can families (`drink_can`, `food_tin`) now carry a `tessellate` rule in `data/destruction.json` (`cylinder: { heightSegments, radialSegments }` and `box: { widthSegments, heightSegments, depthSegments }`): `buildItem({ destructible: true })` rebuilds every `CylinderGeometry` and `BoxGeometry` of those models with those segment counts, so a bullet dent finds vertices to push in (the drawn cans had 16 sides and one height segment, and a shot dented nothing). Plain (non destructible) items keep the cheap geometry; the budgets scenario allows the triangles the rule added.
