---
name: kit-base
description: Use para contratos entre módulos (TestableModule, destruição, tiro), formas 3D e liberar memória, quadro e orçamento de tempo, luzes e shaders, ajustes gráficos, preset padrão, câmera, ferramentas de teste no jogo e a sala de teste genérica.
---

# Base, render e sala de teste

Ache o pacote abaixo e leia a referência dele (`references/<pacote>.md`: quando usar, API principal, como usar, cuidados, composição e
ambiente de teste). O README do pacote (`packages/<pacote>/README.md`) tem a API completa. Regras do kit: `CLAUDE.md` da raiz.

| Pacote | O que faz |
|---|---|
| [`game-contracts`](references/game-contracts.md) | The contracts every game module depends on, and nothing else: destruction (parts, hits, events, DestructibleImpl), weapons (shots), fluids (containers, item… |
| [`game-shapes`](references/game-shapes.md) | Renderer-agnostic 3D shape generator: a JSON shape schema (primitives, extrusions, lathes, cheap booleans, transforms, groups, named parts, materials by id… |
| [`game-shapes-three`](references/game-shapes-three.md) | three.js drawing of @adatechnology/game-shapes buffers: BufferGeometry with three's own type and prototype, meshes per batch, part groups, InstancedMesh and… |
| [`game-runtime`](references/game-runtime.md) | The owner of the frame: a phased scheduler (input, fixed simulation, late simulation, present, render, idle) with a fixed step, and one time budget shared by… |
| [`game-render-three`](references/game-render-three.md) | Owner of the GPU-facing state of a three.js game: the one ThreeLib type, a LightBudget with a fixed number of lights (slots, priority, fades), a ProgramWarmup… |
| [`game-graphics`](references/game-graphics.md) | The player's graphics settings without any engine: presets (Automatic, Low, Medium, High, Ultra), resolution scale, horde detail, shadows, view distance, FPS… |
| [`game-graphics-three`](references/game-graphics-three.md) | three.js adapter of @adatechnology/game-graphics: puts the player's graphics settings on a WebGLRenderer, camera and sun (pixel ratio, shadow map and box, far… |
| [`game-kit-defaults`](references/game-kit-defaults.md) | The default preset of the game kit (L5 composition): imports the content packs and returns the ready options the cores and adapters take by option, like Bevy's… |
| [`game-camera`](references/game-camera.md) | Shoulder, third-person and first-person camera rig plus viewmodel for three.js games. Knows nothing about any game. |
| [`game-devtools`](references/game-devtools.md) | In-game test tooling for three.js games: free-fly mode, position HUD, notes and marks, control panel, scenario runner and entity labels. Knows nothing about… |
| [`game-test-room`](references/game-test-room.md) | Reusable test room for three.js: any module loads its objects, then the player grabs, carries and throws them, shoots them with the weapons of… |
