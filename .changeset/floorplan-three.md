---
'@adatechnology/game-floorplan-three': minor
---

New package: the three.js renderer of `@adatechnology/game-floorplan` (spec 001, T2.4), a literal port of the team's `Casa3DSDK` and `AndaresSDK`. `create(THREE, options).build(plan)`
draws walls, doors, windows, floors, slabs, stairs, roofs, gutters, lot, furniture (`game-props3d`), lights, mirrors, cars, solar panels, water and electrical. Each piece knows its vertex
range in the merged mesh, so the house binds to the destruction of its structure (`game-destruction`, `game-destruction-three`): fracture and collapse hide the range, a masonry wall that reaches
stage 2 is drawn again as instanced brick courses at LOD 0, and the renderer adds the spall decal and the rebar cage. `createFloorNavigator` is the AndaresSDK (10 cm grid per floor, stairs, occlusion),
with `navigationDefOf` and `bindNavigator` to register a built house and follow its destruction. The scene equals the page's, node by node, for six plans (golden `vc3-house-scene.json`), and `planLod`
gives the same levels. Fleet, interactables, vegetation and the mirror's `Reflector` are injected; texts come from `locales` (`en`, `pt-BR`); global `GameFloorplanThree`.
