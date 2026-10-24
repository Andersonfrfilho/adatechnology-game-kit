// The calls of the animals, as recipes of @adatechnology/game-audio: the game's `bichoSom` (jogo L66625), which synthesizes four calls with the same
// routine (the dog's two filtered clicks, the lapwing's shriek, the hen's cluck, the cow's moo). Linear fall to silence at 70 m, as the page has it; the
// numbers are drawn and the nodes created in the page's order, so a recipe leaves the trace of the team code (tests/audio.test.ts against
// tools/golden/fixtures/audio/game-audio.json).
import { DISTANCE_CURVES } from '@adatechnology/game-audio'
import type { SoundBank, SoundRecipe } from '@adatechnology/game-audio'

type Call = {
  readonly id: string
  /** The name in the team code. */
  readonly team: string
  readonly count: number
  readonly spacing: number
  readonly seconds: number
  readonly wave: OscillatorType
  readonly frequency: number
  /** The pitch falls to this fraction of itself over each pass. */
  readonly drop: number
}

const call = (o: Call): SoundRecipe => ({
  id: o.id,
  bus: 'world',
  order: 'calls',
  duration: o.seconds,
  tail: 0.02,
  // the page makes its gain and filter before it looks at the level
  keepSilent: true,
  layers: [
    {
      repeat: { count: o.count, spacing: o.spacing },
      source: { kind: 'osc', wave: o.wave, frequency: { from: o.frequency, to: o.frequency * o.drop, curve: 'exp', over: 'duration' } },
      filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: o.frequency * 1.2 }, q: 3 }] },
      envelope: [
        [0, 0.0001, 'set', 'fixed'],
        [0.015, 1, 'exp'],
        ['1d', 0.0001, 'exp', 'fixed'],
      ],
    },
  ],
  falloff: DISTANCE_CURVES.animals,
  sources: [`jogo:L66625-66639 bichoSom('${o.team}')`],
})

/** `latido`: two square clicks 0.22 s apart, 520 Hz falling to 0.6, 0.12 s each. */
export const DOG_BARK = call({ id: 'dog_bark', team: 'latido', count: 2, spacing: 0.22, seconds: 0.12, wave: 'square', frequency: 520, drop: 0.6 })
/** `queroquero`: three squares 0.14 s apart, 2400 Hz falling to 0.6, 0.09 s each. */
export const LAPWING_CALL = call({ id: 'lapwing_call', team: 'queroquero', count: 3, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 2400, drop: 0.6 })
/** `cacarejo`: four squares 0.14 s apart, 900 Hz falling to 0.6, 0.09 s each. */
export const HEN_CLUCK = call({ id: 'hen_cluck', team: 'cacarejo', count: 4, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 900, drop: 0.6 })
/** `mugido`: one sawtooth, 140 Hz falling to 0.8, 1.2 s. */
export const COW_MOO = call({ id: 'cow_moo', team: 'mugido', count: 1, spacing: 0.14, seconds: 1.2, wave: 'sawtooth', frequency: 140, drop: 0.8 })

export const ANIMAL_SOUNDS: readonly SoundRecipe[] = [DOG_BARK, LAPWING_CALL, HEN_CLUCK, COW_MOO]

export const ANIMAL_SOUND_BANK: SoundBank = { id: 'animals_three', sounds: ANIMAL_SOUNDS }
