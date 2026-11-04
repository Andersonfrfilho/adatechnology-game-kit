// Music for a car radio or tape: three short original loops synthesized from notes (a bass, a chord pad and a melody per bar), so a cabin can pick a
// track without any recording. Each bar is one recipe whose note layers start at their beat; the cabin plays the bars in turn, so switching the
// radio off stops the music at the end of the bar.
import type { SoundBank, SoundRecipe } from '../recipe'

type Note = readonly [beat: number, midi: number, beats: number]
type TrackSpec = { id: string; bpm: number; bars: number; wave: 'sine' | 'triangle' | 'square' | 'sawtooth'; bass: readonly Note[]; chords: readonly Note[]; melody: readonly Note[] }

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

const layer = (note: Note, beat: number, wave: string, level: number): object => {
  const [at, midi, beats] = note
  const length = beats * beat
  return {
    at: at * beat,
    duration: length,
    source: { kind: 'osc', wave, frequency: { set: hz(midi) } },
    envelope: [[0, 0.0001, 'set'], [0.01, level, 'linear'], [Math.max(0.02, length * 0.9), level * 0.35, 'linear'], [length, 0.0001, 'exp', 'fixed']],
  }
}

/** A song of the radio: the ids of its bars in order and the seconds of one bar. */
export type RadioSong = { readonly id: string; readonly barSeconds: number; readonly bars: readonly string[] }

/** One song cut in bars: every note a layer at its beat inside its bar. */
export function radioTrack(spec: TrackSpec): { song: RadioSong; recipes: SoundRecipe[] } {
  const beat = 60 / spec.bpm
  const recipes = Array.from({ length: spec.bars }, (_, bar): SoundRecipe => {
    const inBar = (notes: readonly Note[]): Note[] => notes.filter((n) => n[0] >= bar * 4 && n[0] < bar * 4 + 4).map((n): Note => [n[0] - bar * 4, n[1], n[2]])
    const layers = [
      ...inBar(spec.bass).map((n) => layer(n, beat, 'triangle', 0.16)),
      ...inBar(spec.chords).map((n) => layer(n, beat, 'sine', 0.05)),
      ...inBar(spec.melody).map((n) => layer(n, beat, spec.wave, 0.07)),
    ]
    return { id: `${spec.id}_${bar}`, bus: 'world', duration: 4 * beat, layers, falloff: { model: 'none' } } as unknown as SoundRecipe
  })
  return { song: { id: spec.id, barSeconds: 4 * beat, bars: recipes.map((r) => (r as unknown as { id: string }).id) }, recipes }
}

// a bar of a chord: root, third and fifth held the four beats
const chord = (bar: number, root: number, minor = false): Note[] => [[bar * 4, root, 4], [bar * 4, root + (minor ? 3 : 4), 4], [bar * 4, root + 7, 4]]
const bassLine = (roots: readonly number[], pattern: readonly number[]): Note[] => roots.flatMap((root, bar) => pattern.map((b): Note => [bar * 4 + b, root - 12, 0.9]))

const TRACKS = [
  // a bright pop loop: I–V–vi–IV in C
  radioTrack({
    id: 'radio_track_pop',
    bpm: 112,
    bars: 4,
    wave: 'square',
    bass: bassLine([48, 55, 57, 53], [0, 1.5, 2, 3]),
    chords: [...chord(0, 60), ...chord(1, 55), ...chord(2, 57, true), ...chord(3, 53)],
    melody: [[0, 76, 1], [1, 74, 0.5], [1.5, 72, 1.5], [4, 74, 1], [5, 76, 1], [6, 79, 2], [8, 76, 1], [9, 74, 1], [10, 72, 2], [12, 72, 1], [13, 74, 1], [14, 72, 2]],
  }),
  // a syncopated loop in A minor, the bass on the off-beats
  radioTrack({
    id: 'radio_track_groove',
    bpm: 100,
    bars: 4,
    wave: 'triangle',
    bass: bassLine([57, 62, 64, 57], [0, 0.75, 1.5, 2.5, 3.25]),
    chords: [...chord(0, 57, true), ...chord(1, 62, true), ...chord(2, 64), ...chord(3, 57, true)],
    melody: [[0.5, 72, 0.5], [1.25, 76, 0.75], [2.5, 74, 1], [4.5, 77, 0.5], [5.25, 74, 0.75], [6.5, 72, 1.5], [8.5, 71, 0.5], [9.25, 74, 0.75], [10.5, 76, 1.5], [12.5, 72, 0.5], [13.25, 69, 2]],
  }),
  // a slow blues-like loop in F with a swung melody
  radioTrack({
    id: 'radio_track_slow',
    bpm: 76,
    bars: 4,
    wave: 'sine',
    bass: bassLine([53, 58, 53, 60], [0, 2]),
    chords: [...chord(0, 65), ...chord(1, 58), ...chord(2, 65), ...chord(3, 60)],
    melody: [[0, 72, 1.5], [1.67, 75, 0.33], [2, 77, 2], [4, 74, 1], [5, 72, 1], [6, 70, 2], [8, 72, 1.5], [9.67, 69, 0.33], [10, 65, 2], [12, 67, 1], [13, 70, 1], [14, 72, 2]],
  }),
]

/** The songs a cabin steps through. */
export const RADIO_TRACKS: readonly RadioSong[] = TRACKS.map((t) => t.song)
export const RADIO_BANK: SoundBank = { id: 'vehicle_radio', sounds: TRACKS.flatMap((t) => t.recipes), loops: [] }
