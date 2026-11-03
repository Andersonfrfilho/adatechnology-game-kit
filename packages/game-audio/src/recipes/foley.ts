// Foley of the hand: items picked up, opened, drunk and eaten, and the doors, lids and drawers of furniture and vehicles. Synthesised stand-ins under the
// ids of the sound list (`sons/checklist-sons.md` 5.7 and the car doors of 5.6), so a recorded take filed under the same id replaces the recipe without
// touching the code that plays it. Every recipe draws its numbers from ranges (pitch about ±4 %, timing and level), so no two plays are the same, and
// falls off faster than a gunshot and loses its highs with distance: a latch is a near sound.
import type { Falloff, Layer, SoundBank, SoundRecipe } from '../recipe'
import { sceneMany as many, sceneNoise as noise, sceneTone as tone } from './scene'

/** Small sounds of the hand: `vol / (1 + d² × 0.02)`, lowpass cutoffs `/ (1 + d × 0.04)`, silent below 0.004 (a latch at 10 m is a third, at 50 m gone). */
export const FOLEY_FALLOFF: Falloff = {
  model: 'inverse_square',
  k: 0.02,
  cutoffK: 0.04,
  minGain: 0.004,
}

/** ±`pct` around `f`: the range a recipe draws a frequency from. */
const vary = (f: number, pct = 0.04): readonly [number, number] => [Math.round(f * (1 - pct)), Math.round(f * (1 + pct))]

const foley = (id: string, layers: readonly Layer[], note: string): SoundRecipe => ({
  id,
  bus: 'world',
  pan: true,
  layers,
  falloff: FOLEY_FALLOFF,
  sources: [`sdk: ${note}`],
})

/** The click of a latch or a catch: a short band of noise and a tick of metal. */
const click = (f: number, vol: number, delay: readonly [number, number] | number = 0): Layer[] => [
  noise({
    type: 'bandpass',
    f: vary(f, 0.08),
    q: 4,
    d: [0.018, 0.03],
    vol: [vol * 0.85, vol * 1.1],
    delay,
  }),
  tone({
    f: vary(f * 0.8, 0.06),
    f2: Math.round(f * 0.62),
    d: [0.015, 0.025],
    vol: vol * 0.18,
    delay,
  }),
]

/** A leaf meeting its frame: the body (a falling tone), the board or panel (a band of noise) and the latch catching right after. */
const meet = (body: number, panel: number, vol: number, latch: number): Layer[] => [
  tone({
    f: vary(body),
    f2: Math.round(body * 0.5),
    d: [0.12, 0.16],
    vol: [vol * 0.9, vol * 1.1],
  }),
  noise({
    type: 'bandpass',
    f: vary(panel, 0.06),
    q: 1.2,
    d: [0.08, 0.12],
    vol: [vol * 0.9, vol * 1.1],
    wet: 0.25,
  }),
  ...click(latch, vol * 0.45, [0.012, 0.028]),
]

/** The doors and lids of furniture and vehicles, by what the leaf is (the room picks one from the item, else from the leaf's material). */
export const LEAF_FOLEY: readonly SoundRecipe[] = [
  // a wooden house door or wardrobe door: latch, a short creak, the leaf on the frame (the hard slam adds the frame rattling)
  foley('door_wood_open', click(2400, 0.4), 'the latch of a wooden door giving'),
  foley(
    'door_creak',
    [
      tone({ f: [190, 240], f2: 310, d: [0.4, 0.55], vol: [0.04, 0.06] }),
      noise({
        type: 'bandpass',
        f: [480, 560],
        q: 6,
        a: 0.05,
        d: [0.35, 0.5],
        vol: [0.1, 0.14],
      }),
    ],
    'a wooden hinge turning',
  ),
  foley('door_wood_close', meet(120, 600, 0.55, 2400), 'a wooden leaf meeting its frame'),
  foley(
    'door_wood_slam',
    [
      ...meet(110, 560, 0.85, 2300),
      ...many(3, () =>
        noise({
          type: 'bandpass',
          f: [900, 1500],
          q: 3,
          d: 0.03,
          vol: [0.08, 0.14],
          delay: [0.05, 0.18],
        }),
      ),
    ],
    'a wooden door slammed: the frame and the hinges rattle after the hit',
  ),
  // a metal door or gate: a hollow panel that rings a little
  foley('door_metal_open_close', [...meet(160, 900, 0.55, 2000), tone({ f: vary(1250), f2: 1150, d: [0.1, 0.16], vol: 0.06, wet: 0.3 })], 'a metal door or gate meeting its frame'),
  foley(
    'door_creak_metal',
    [
      tone({ f: [620, 760], f2: 900, d: [0.3, 0.4], vol: [0.03, 0.045] }),
      noise({
        type: 'bandpass',
        f: [1300, 1500],
        q: 8,
        a: 0.04,
        d: [0.25, 0.35],
        vol: [0.07, 0.09],
      }),
    ],
    'a metal hinge turning',
  ),
  // the handle of a locked door shaken: the latch knocking in its keeper, five to seven times in half a second
  foley(
    'door_locked_rattle',
    [
      ...many(6, () =>
        noise({
          type: 'bandpass',
          f: [1600, 2600],
          q: 3,
          d: [0.025, 0.04],
          vol: [0.22, 0.34],
          delay: [0, 0.45],
        }),
      ),
      ...many(3, () =>
        tone({
          f: [170, 210],
          f2: 120,
          d: 0.05,
          vol: [0.12, 0.18],
          delay: [0.02, 0.4],
        }),
      ),
    ],
    'the handle of a locked door shaken: latch knocks and the leaf thumping in its frame',
  ),
  // a fridge: the rubber seal lets go with a soft suck, the bottles in the door clink; closing it is a soft thump and the seal pulling shut
  foley(
    'fridge_open',
    [
      noise({
        type: 'lowpass',
        f: [320, 380],
        a: 0.03,
        d: [0.14, 0.2],
        vol: [0.32, 0.4],
      }),
      noise({
        type: 'bandpass',
        f: [800, 950],
        f2: 1400,
        q: 2,
        a: 0.02,
        d: 0.12,
        vol: [0.08, 0.12],
      }),
      ...many(2, () =>
        tone({
          f: [2600, 4200],
          d: [0.04, 0.08],
          vol: [0.015, 0.03],
          delay: [0.08, 0.22],
        }),
      ),
    ],
    'a fridge door: the seal letting go and the bottles in the door',
  ),
  foley(
    'fridge_close',
    [
      tone({ f: vary(85), f2: 45, d: [0.1, 0.13], vol: [0.38, 0.46] }),
      noise({
        type: 'lowpass',
        f: [520, 620],
        d: [0.08, 0.12],
        vol: [0.3, 0.36],
      }),
      noise({
        type: 'lowpass',
        f: [260, 320],
        a: 0.02,
        d: 0.1,
        vol: [0.12, 0.18],
        delay: [0.04, 0.07],
      }),
      ...many(2, () =>
        tone({
          f: [2600, 4200],
          d: [0.04, 0.07],
          vol: [0.015, 0.03],
          delay: [0.03, 0.12],
        }),
      ),
    ],
    'a fridge door shut: a soft thump, the seal pulling and the bottles',
  ),
  // a microwave: the spring catch of the door, plastic on plastic
  foley(
    'microwave_open',
    [
      ...click(1800, 0.34),
      tone({
        f: [3000, 3400],
        f2: 2800,
        d: 0.05,
        vol: 0.025,
        delay: [0.01, 0.02],
      }),
    ],
    'the spring catch of a microwave door',
  ),
  foley(
    'microwave_close',
    [
      noise({
        type: 'bandpass',
        f: [1200, 1450],
        q: 2.5,
        d: [0.04, 0.06],
        vol: [0.36, 0.44],
      }),
      tone({ f: vary(180), f2: 120, d: 0.05, vol: [0.16, 0.22] }),
      ...click(2200, 0.2, [0.008, 0.016]),
    ],
    'a microwave door clacking shut',
  ),
  foley('microwave_beep', [tone({ wave: 'square', f: 2000, d: 0.12, vol: 0.05 })], 'the beep of a microwave'),
  // drawers and sliding leaves: the runners, then the stop
  foley(
    'drawer_open',
    [
      noise({
        type: 'bandpass',
        f: [620, 780],
        q: 2,
        a: 0.04,
        d: [0.28, 0.36],
        vol: [0.18, 0.24],
      }),
      noise({ type: 'bandpass', f: [2000, 2400], q: 5, d: 0.28, vol: 0.04 }),
      ...click(1400, 0.16, [0.28, 0.34]),
    ],
    'a drawer on its runners and its stop',
  ),
  foley(
    'drawer_close',
    [
      noise({
        type: 'bandpass',
        f: [620, 780],
        q: 2,
        a: 0.03,
        d: [0.2, 0.28],
        vol: [0.18, 0.24],
      }),
      tone({
        f: vary(150),
        f2: 90,
        d: 0.08,
        vol: [0.22, 0.3],
        delay: [0.2, 0.26],
      }),
    ],
    'a drawer pushed home',
  ),
]

/** What the hand does with an item: picking it up by what it is made of, throwing it, and the uses (opening, drinking, eating, first aid). */
export const ITEM_FOLEY: readonly SoundRecipe[] = [
  // the hand closing on the item: a touch of skin and cloth, then the item's own small sound
  foley(
    'item_pickup_metal',
    [
      noise({ type: 'bandpass', f: [700, 900], q: 1, d: 0.06, vol: 0.18 }),
      tone({
        f: [1900, 2600],
        f2: 1700,
        d: [0.05, 0.08],
        vol: [0.06, 0.09],
        delay: [0.01, 0.03],
      }),
    ],
    'picking up a metal thing',
  ),
  foley(
    'item_pickup_plastic',
    [
      noise({ type: 'bandpass', f: [700, 900], q: 1, d: 0.06, vol: 0.18 }),
      noise({
        type: 'bandpass',
        f: [1500, 1900],
        q: 3,
        d: 0.03,
        vol: [0.15, 0.21],
        delay: [0.01, 0.03],
      }),
    ],
    'picking up a plastic thing',
  ),
  foley(
    'item_pickup_glass',
    [
      noise({ type: 'bandpass', f: [700, 900], q: 1, d: 0.06, vol: 0.15 }),
      tone({
        f: [3200, 4200],
        d: [0.05, 0.08],
        vol: [0.038, 0.06],
        delay: [0.01, 0.03],
      }),
    ],
    'picking up a glass thing',
  ),
  foley(
    'item_pickup_paper',
    [
      noise({
        type: 'highpass',
        f: [2600, 3400],
        a: 0.01,
        d: [0.1, 0.14],
        vol: [0.12, 0.18],
      }),
      noise({ type: 'bandpass', f: [800, 1000], q: 1, d: 0.05, vol: 0.12 }),
    ],
    'picking up paper or cardboard',
  ),
  foley(
    'item_pickup_fabric',
    [
      noise({
        type: 'bandpass',
        f: [900, 1300],
        q: 0.8,
        a: 0.02,
        d: [0.12, 0.16],
        vol: [0.15, 0.21],
      }),
    ],
    'picking up cloth',
  ),
  foley(
    'item_pickup_wood',
    [
      noise({ type: 'bandpass', f: [700, 900], q: 1, d: 0.06, vol: 0.18 }),
      noise({
        type: 'bandpass',
        f: [900, 1100],
        q: 2,
        d: 0.04,
        vol: [0.15, 0.21],
        delay: [0.01, 0.03],
      }),
    ],
    'picking up a wooden thing',
  ),
  foley(
    'item_pickup_food',
    [
      noise({ type: 'bandpass', f: [700, 900], q: 1, d: 0.06, vol: 0.18 }),
      noise({
        type: 'lowpass',
        f: [500, 650],
        d: 0.05,
        vol: 0.12,
        delay: [0.01, 0.03],
      }),
    ],
    'picking up food',
  ),
  foley(
    'item_throw',
    [
      noise({
        type: 'bandpass',
        f: [450, 650],
        f2: 1400,
        q: 1.5,
        a: 0.05,
        d: 0.18,
        vol: [0.1, 0.14],
      }),
    ],
    'the arm throwing something: air',
  ),
  // a can: the tab cracks, the gas hisses out; drinking is gulps; crushing it crumples the sheet
  foley(
    'can_open',
    [
      ...click(3200, 0.36),
      noise({
        type: 'highpass',
        f: [3600, 4400],
        a: 0.005,
        d: [0.22, 0.3],
        vol: [0.16, 0.22],
        delay: [0.012, 0.02],
      }),
      ...many(5, () => tone({ f: [4000, 7000], d: 0.02, vol: 0.01, delay: [0.05, 0.4] })),
    ],
    'the tab of a can and the gas hissing out',
  ),
  foley(
    'can_crush',
    [
      noise({
        type: 'bandpass',
        f: [1600, 2200],
        q: 1.2,
        d: [0.18, 0.25],
        vol: [0.3, 0.38],
      }),
      ...many(6, () =>
        tone({
          f: [1200, 3400],
          f2: 900,
          d: 0.03,
          vol: [0.03, 0.06],
          delay: [0, 0.2],
        }),
      ),
    ],
    'a can crushed in the hand',
  ),
  foley(
    'can_puncture_spray',
    [
      noise({
        type: 'highpass',
        f: [2400, 3000],
        a: 0.005,
        d: [0.5, 0.7],
        vol: [0.2, 0.26],
      }),
      noise({ type: 'bandpass', f: [600, 800], q: 2, d: 0.4, vol: 0.06 }),
    ],
    'a can holed: the jet hissing out',
  ),
  foley(
    'bottle_open',
    [
      ...many(5, () =>
        noise({
          type: 'bandpass',
          f: [2200, 3000],
          q: 4,
          d: 0.008,
          vol: [0.1, 0.16],
          delay: [0, 0.18],
        }),
      ),
      noise({
        type: 'highpass',
        f: 3800,
        a: 0.005,
        d: 0.12,
        vol: [0.06, 0.1],
        delay: [0.18, 0.22],
      }),
    ],
    'the screw cap of a bottle turning off',
  ),
  foley(
    'drink_gulp',
    [
      noise({
        type: 'lowpass',
        f: [280, 360],
        a: 0.02,
        d: [0.1, 0.14],
        vol: [0.24, 0.3],
      }),
      tone({ f: [140, 170], f2: 85, d: [0.08, 0.11], vol: [0.12, 0.16] }),
    ],
    'a gulp',
  ),
  foley(
    'eat_crunch',
    [
      ...many(4, () =>
        noise({
          type: 'bandpass',
          f: [1800, 3200],
          q: 1.5,
          d: [0.02, 0.04],
          vol: [0.12, 0.2],
          delay: [0, 0.12],
        }),
      ),
    ],
    'a bite of something crunchy',
  ),
  foley(
    'eat_chew',
    [
      noise({
        type: 'lowpass',
        f: [450, 600],
        a: 0.03,
        d: [0.1, 0.14],
        vol: [0.12, 0.16],
      }),
      noise({
        type: 'bandpass',
        f: [1100, 1400],
        q: 2,
        d: 0.04,
        vol: 0.04,
        delay: [0.03, 0.06],
      }),
    ],
    'chewing',
  ),
  foley(
    'bandage_wrap',
    [
      noise({
        type: 'bandpass',
        f: [1400, 1800],
        f2: 2400,
        q: 1,
        a: 0.04,
        d: [0.3, 0.4],
        vol: [0.12, 0.16],
      }),
    ],
    'a bandage unrolled round a limb',
  ),
  foley(
    'pills_shake',
    [
      ...many(8, () =>
        tone({
          f: [2400, 3600],
          d: 0.015,
          vol: [0.03, 0.05],
          delay: [0, 0.25],
        }),
      ),
      noise({ type: 'bandpass', f: [1500, 1900], q: 2, d: 0.25, vol: 0.05 }),
    ],
    'pills shaken in their bottle',
  ),
  foley(
    'medkit_use',
    [
      ...click(1700, 0.24),
      noise({
        type: 'bandpass',
        f: [1000, 1400],
        q: 1,
        a: 0.03,
        d: [0.25, 0.32],
        vol: [0.08, 0.12],
        delay: [0.05, 0.08],
      }),
    ],
    'a first aid kit opened and rummaged',
  ),
  foley('flashlight_click', click(2600, 0.3), 'the switch of a flashlight'),
]

/** The foley bank: register it in the engine (`engine.register(FOLEY_BANK)`). */
export const FOLEY_BANK: SoundBank = {
  id: 'foley',
  sounds: [...LEAF_FOLEY, ...ITEM_FOLEY],
}

/** What a picked-up item sounds like, by its heaviest material class. */
export const PICKUP_CLASSES = ['metal', 'plastic', 'glass', 'paper', 'fabric', 'wood', 'food'] as const
export type PickupClass = (typeof PICKUP_CLASSES)[number]

/** The sound set of a leaf worked by hand: the ids it plays at the latch, while it turns, and as it meets the frame (gently, and slammed). */
export type LeafFoley = {
  readonly open: string
  readonly turn?: string
  readonly close: string
  readonly slam?: string
  readonly locked: string
}

/** The leaf sound sets the kit ships, by name; an item names one (`TestableItem.sounds.leaves`), else the room picks `wood_door` or `metal_door` by the leaf's material. */
export const LEAF_FOLEY_SETS: Readonly<Record<string, LeafFoley>> = {
  wood_door: {
    open: 'door_wood_open',
    turn: 'door_creak',
    close: 'door_wood_close',
    slam: 'door_wood_slam',
    locked: 'door_locked_rattle',
  },
  metal_door: {
    open: 'door_wood_open',
    turn: 'door_creak_metal',
    close: 'door_metal_open_close',
    locked: 'door_locked_rattle',
  },
  fridge: {
    open: 'fridge_open',
    close: 'fridge_close',
    locked: 'door_locked_rattle',
  },
  microwave: {
    open: 'microwave_open',
    close: 'microwave_close',
    locked: 'door_locked_rattle',
  },
  drawer: {
    open: 'drawer_open',
    close: 'drawer_close',
    locked: 'door_locked_rattle',
  },
}
