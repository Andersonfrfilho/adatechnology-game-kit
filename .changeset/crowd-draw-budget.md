---
'@adatechnology/game-crowd-three': minor
'@adatechnology/game-characters-three': minor
'@adatechnology/game-render-three': minor
---

The horde draw cost (spec 005, D12). `createCrowdRenderer({ variety })` gets a level `budget` (bodies per mesh level, bodies on the ground included; a crowd packed near the camera pulls the level edges in, the nearest bodies draw first), an `adapt` loop that sizes it from the crowd's GPU time (`EXT_disjoint_timer_query_webgl2`, the frame time where there is none), `nearDepthPrepass` (the near level draws its depth first so the room's lights shade a pixel once) and `detailScale`/`gpuMs` read-outs. `createBodyBatch` and `createVariantBatches` take `depthPrepass` and return `batch.prepass`; add it to the scene next to `batch.mesh`. `game-render-three` gets `createFramePacer`, which holds the draw back while the GPU is a frame behind.
