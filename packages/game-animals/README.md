# @adatechnology/game-animals

Animals without an engine: the body spec of quadrupeds, birds and snakes, the three gait phase tables (walk, trot, gallop), the alive / infected / dead
visual states, the rest-pose layout math and a species registry (`packs`, `patch`, `remove`). Species come from `@adatechnology/game-animals-species`;
the drawing is `@adatechnology/game-animals-three`.

```ts
import { createAnimals, quadrupedLayout } from '@adatechnology/game-animals'
import { createSpeciesPack } from '@adatechnology/game-animals-species'

const dog = createAnimals({ packs: [createSpeciesPack()] }).get('dog')
if (dog?.body.kind === 'quadruped') quadrupedLayout(dog.body).bodyHeight
```

Plain script: `dist/index.global.js` exposes the `GameAnimals` global.
