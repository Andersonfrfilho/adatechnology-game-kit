---
'@adatechnology/game-contracts': minor
---

`TestableModule` can bring its own area (`area`: where each item goes, surfaces things rest on, props that start asleep, the starting view) and
its own presentation (`attach`, with a `ModuleHost`: scene, camera, ground height, tool events `tool`/`shot`/`reload`/`empty` and a per-frame
callback). Both optional and generic: nothing in the contracts is specific to a kind of module.
