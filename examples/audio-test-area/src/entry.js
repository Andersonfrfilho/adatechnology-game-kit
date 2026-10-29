// Bundle entry (IIFE global `AudioArea`): the audio bench module of @adatechnology/game-audio, ready for any room page:
// `AudioArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only; the sounds
// come from the engine (the room's, when it lends one in `host.audio`).
// Bench: sound, source (bench settings or the probe), distance, bearing, volume, mixing chain, seed, play, voice storm, loop with level and pitch.
// Layers: reverb, compressor, panning, muffling. Metrics: voices, peak, dropped, loops, context, the chosen sound's plan, the level of each bus.
import { GAME_SFX_BANK, LIBRARY_BANK, createAudioEngine, createAudioTestModule } from '@adatechnology/game-audio'

export { createAudioEngine, createAudioTestModule, GAME_SFX_BANK, LIBRARY_BANK }

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the sound area. Returns the room's module report. */
// The probe the sounds can come from is drawn by the host (`probe`, a portable radio of game-items-three in the kit's full room); this page alone has none.
export function loadInto(room, options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createAudioTestModule({ ...options, locale }))
  room.openArea('audio_area')
  return report
}
