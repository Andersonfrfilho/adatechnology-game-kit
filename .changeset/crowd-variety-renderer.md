---
'@adatechnology/game-crowd-three': minor
---

Variety on the instanced renderer (option `variety`, default off, the game's renderer is unchanged without it): every body gets an identity from its crowd identity and state (`lookOfAgent`: trousers, wound splashes that grow with the infection age, accessories, gait style, the stagger pose, the lean of a shove), the kit's accessories (cap, helmet, backpack, hood) are drawn in eight fixed batches placed per variant, real shadows are cast only by the nearest level and a blob shadow batch covers the rest. `createCrowdTestModule` takes `variety` and `crowdPhysics`; `appearanceSignature` is the look of an instance as one number.
