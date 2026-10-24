---
'@adatechnology/game-destruction-three': minor
---

`createDestructionSound(engine)` registers the material sounds of the art scene (`glass`, `wood`, `thunk`, `ping`, `clang`, `chip`, `crumble`, `thud`, `hiss`, `boom`, `burst`, `crack`) and the game's `explosion_boom` in `@adatechnology/game-audio`, and maps the renderer's `onSound` keys through a replaceable table (`art_scene` or `game` style). The renderer sends `burn_end` when a part goes out or finishes burning, and `burn_loop` is the fire loop that rises with the parts in flames. `game-audio` is a dependency.
