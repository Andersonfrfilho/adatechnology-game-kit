# @adatechnology/game-load-path

The load path of a structure as one rule every SDK composes: what rests on what, which of its supports carry a part's load, the order the load goes down
and how it is shared. The structure (`game-floorplan-structure`: sizing, validator, slab panels) and the destruction world (`game-destruction`) use it, so a
building is carried the same way where it is designed, checked, drawn and broken.

```ts
import { distributeLoads, solveSupports } from '@adatechnology/game-load-path'

const solution = solveSupports({ size, sharing: 'all', anchored, active, partition, supportsOf })
const loads = distributeLoads(solution, (part) => massOf(part))
```

- `sharing: 'all'` (houses): every support a part is laid on carries its share, at any distance from the ground: a beam on the beam it frames into
  (NBR 6118 18.3.7), a slab on its four edges (a two-way slab), a slab on its bearing walls.
- `sharing: 'nearest'`: only the supports closest to the ground (the Visor de casas 3D's rule, kept for its golden and for what was built on it).
- A partition carries nothing; a joint that closes a cycle does not carry.
- The share is equal among a part's carriers: an approximation good for the game and for pre-sizing. It does not weigh where the load stands on a beam,
  nor that the long sides of a rectangular two-way slab take more (Marcus' tables). The structure makes a beam that receives another at least as deep as it
  (NBR 6118 18.3.7); the suspension bars of that indirect support are not modelled (the members carry the generic cage, `MEMBER_CAGE`).
