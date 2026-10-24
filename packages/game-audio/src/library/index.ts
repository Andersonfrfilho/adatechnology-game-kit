// Sounds whose subject has no package yet (Q12): they move to vehicles, crowd and props in Phases 7 and 8 and stay here as re-exports.
import type { LoopRecipe, SoundBank, SoundRecipe } from '../recipe'
import crowdRumble from './crowd_rumble.json'
import engineSaw from './engine_saw.json'
import horn from './horn.json'
import radioStatic from './radio_static.json'
import rotorBlades from './rotor_blades.json'
import siren from './siren.json'

export const LIBRARY_SOUNDS: readonly SoundRecipe[] = [horn, radioStatic, siren] as unknown as readonly SoundRecipe[]
export const LIBRARY_LOOPS: readonly LoopRecipe[] = [engineSaw, rotorBlades, crowdRumble] as unknown as readonly LoopRecipe[]
export const LIBRARY_BANK: SoundBank = { id: 'library', sounds: LIBRARY_SOUNDS, loops: LIBRARY_LOOPS }
