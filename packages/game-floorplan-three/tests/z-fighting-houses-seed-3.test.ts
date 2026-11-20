import { it } from 'vitest'

import { describeHouseSweep } from './helpers/z-fighting-sweep'

// Seed 3 of the sweep in `z-fighting-houses.test.ts`; when `ZFIGHT_SEEDS` picks the seeds, that file alone runs them.
if (process.env.ZFIGHT_SEEDS) it.skip('seeds are picked by ZFIGHT_SEEDS in z-fighting-houses.test.ts', () => undefined)
else describeHouseSweep([3], { hasFramelessCheck: false })
