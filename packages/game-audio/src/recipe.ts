/**
 * Sound recipes are data. A recipe says which nodes a sound has and which numbers drive them; ranges are drawn when the sound is planned, in
 * the order the fields are written (see `planSound`), so a recipe ported from a team routine draws its random numbers in the routine's order.
 */

export const BUS_IDS = ['weapons', 'voices', 'world', 'ambience', 'weather', 'ui'] as const
export type BusId = (typeof BUS_IDS)[number]

/** A named number: from `PlayOptions.params` or the recipe's `vars`, times `scale`, plus `add`. */
export type ParamRef = { readonly param: string; readonly scale?: number; readonly add?: number }

/** A number, a `[min, max]` drawn uniformly (`min + random × (max − min)`), or a named number. */
export type Range = number | readonly [min: number, max: number] | ParamRef

/** Seconds from the layer start: a range, the layer `'duration'`, or `'0.6d'` (0.6 × the layer duration). */
export type Time = Range | 'duration' | `${number}d`

export type Curve = 'linear' | 'exp'

/**
 * How an AudioParam moves:
 * - `{ set }` assigns `.value`;
 * - `{ set, to, curve, over }` assigns `.value`, then ramps to `to` at `over`;
 * - `{ from }` calls `setValueAtTime(from)` at the start; with `to`, `curve` and `over` it then ramps to `to` (`'from'` is the value drawn for `from`: the art scene ramps a tone back to its own start when it gives no end).
 */
export type Automation =
  | { readonly set: Range; readonly to?: Range | 'from'; readonly curve?: Curve; readonly over?: Time }
  | { readonly from: Range; readonly to?: Range | 'from'; readonly curve?: Curve; readonly over?: Time }

/**
 * One gain point: time (seconds, or `'0.6d'`), value and how it is reached (`set` = `setValueAtTime`, or a ramp). The value is multiplied by the
 * layer level (volume, distance and layer gain) except when the fourth item is `'fixed'` (the floor a ramp falls to, such as 0.001).
 */
export type EnvelopePoint =
  | readonly [time: number | `${number}d`, value: number, curve: 'set' | Curve]
  | readonly [time: number | `${number}d`, value: number, curve: 'set' | Curve, fixed: 'fixed']
export type Envelope = readonly EnvelopePoint[]

export type FilterSpec = {
  readonly type: BiquadFilterType
  readonly frequency: Automation
  readonly q?: Range
  /** The BiquadFilter gain (shelf and peaking types). */
  readonly gain?: Range
  /** A gain node after the filter, for a parallel bank where each band has its own level (the game's scream formants). */
  readonly level?: Range
}

export type FilterBank = { readonly mode: 'serial' | 'parallel'; readonly bank: readonly FilterSpec[] }

/** An LFO. `depth` is absolute, or a factor of the source start frequency. With `base`, gain modulation goes through its own gain stage (the game rotor). */
export type Modulator = {
  readonly target: 'gain' | 'frequency'
  /** Left out, the oscillator keeps its default (sine) and no type is set. */
  readonly wave?: OscillatorType
  readonly rate: Range
  readonly depth: Range | { readonly scaleOf: 'frequency'; readonly factor: number }
  readonly base?: number
}

/**
 * Noise from the engine's seeded buffer. `offset` is where playback starts in it: `'random'` (random × `offsetScale`, default 1), `'fit'`
 * (random × (buffer length − duration)) or seconds. `loop` sets the source to loop (the art scene sets it on every noise source).
 */
export type NoiseSource = {
  readonly kind: 'noise'
  readonly offset?: 'random' | 'fit' | number
  readonly offsetScale?: number
  readonly loop?: boolean
}

export type OscSource = { readonly kind: 'osc'; readonly wave: OscillatorType; readonly frequency: Automation }

/** The art scene's `voice`: an oscillator with vibrato through formant bands, plus a band of breath noise, summed and boosted. */
export type FormantVoiceSource = {
  readonly kind: 'formant_voice'
  readonly wave: OscillatorType
  readonly frequency: Automation
  /** Vibrato rate, and depth as a factor of the start frequency. */
  readonly vibrato: { readonly rate: Range; readonly depth: number }
  readonly formants: readonly { readonly frequency: Range; readonly q: number }[]
  readonly breath: { readonly frequency: Range; readonly q: number; readonly gain: Range }
  readonly mix: number
}

export type LayerSource = NoiseSource | OscSource | FormantVoiceSource

export type Layer = {
  /** Start, seconds after the sound starts. */
  readonly at?: Range
  /** Overrides the recipe duration for this layer. */
  readonly duration?: Range
  /** Seconds the source keeps running after the duration (the `+ 0.05` of the team routines). Default: the recipe's, else 0.05. */
  readonly tail?: number
  /** The layer played `count` times, `spacing` seconds apart (the game's animal calls). */
  readonly repeat?: { readonly count: number; readonly spacing: number }
  /** Layer level before distance. Default 1. */
  readonly gain?: Range
  /** Send to the reverb, 0..1 or more (the art scene uses up to 1.2). */
  readonly wet?: number
  readonly source: LayerSource
  readonly filters?: FilterBank
  readonly modulators?: readonly Modulator[]
  readonly envelope: Envelope
}

/**
 * Distance falloff of a sound's level:
 * - `inverse_square`: `volume / (1 + d² × k)`; `cutoffK` also divides every lowpass cutoff by `1 + d × cutoffK` (the game's muffling);
 * - `linear`: `max(0, 1 − d / range)`, silent at or below `minGain`;
 * - `none`: no distance.
 * `scale` multiplies the level (the game's boom is 1.4 at the source), and below `minGain` the sound is not played.
 */
export type Falloff =
  | { readonly model: 'inverse_square'; readonly k: number; readonly minGain?: number; readonly cutoffK?: number; readonly scale?: number }
  | { readonly model: 'linear'; readonly range: number; readonly minGain?: number; readonly scale?: number }
  | { readonly model: 'none' }

/**
 * The order the realizer creates and wires the nodes in. Each one is the order of the team routine it reproduces, so the trace of the SDK
 * matches the trace of the team code node for node:
 * - `layered` (default): the art scene's `sNoise`, `sTone` and `voice`; every layer has its own output stage (distance gain, pan, reverb send);
 * - `burst`: the game's `sfx` (jogo L62089);
 * - `scream`: the game's `grito` (L62128);
 * - `groan`: the game's `voz` (L62143);
 * - `boom`: the game's `boom` (L68278);
 * - `static`: the game's `chiado` (L69998);
 * - `chord`: the game's `buzina` (L70272);
 * - `calls`: the game's `bichoSom` (L66625);
 * - `siren`: the art scene's `siren` (L1369);
 * - `weapon`: the weapon audio of the kit (`weapons-three`): per layer a filtered noise burst or an oscillator, then its own gain, chained to the bus.
 * Every order but `layered` puts the level into the envelope and connects straight to the bus.
 */
export const BUILD_ORDERS = ['layered', 'burst', 'scream', 'groan', 'boom', 'static', 'chord', 'calls', 'siren', 'weapon'] as const
export type BuildOrder = (typeof BUILD_ORDERS)[number]

export type SoundRecipe = {
  readonly id: string
  readonly bus: BusId
  readonly order?: BuildOrder
  /** Named numbers drawn first, in the order written; layers read them with `{ param }`. */
  readonly vars?: Readonly<Record<string, Range>>
  readonly duration?: Range
  readonly tail?: number
  readonly layers: readonly Layer[]
  readonly falloff?: Falloff
  /** Stereo pan from the listener (the art scene's `panFor`). Only the `layered` order has an output stage to pan. */
  readonly pan?: boolean
  /** Voice group for the limiter (`undead_voice`...). */
  readonly group?: string
  /** Limiter priority; default from the bus (weapons > voices > world > ambience). */
  readonly priority?: number
  /**
   * The team routine creates nodes before it checks the level (the game's `bichoSom` creates its gain and filter first): a silent sound is kept as
   * a plan with `silent: true` so the realizer repeats those nodes. Off by default.
   */
  readonly keepSilent?: boolean
  /** Where the numbers come from: `"jogo:L62128"`, `"cena:L1342"`, or `"sdk"` for values the kit chose. */
  readonly sources: readonly string[]
}

/**
 * The order the loop realizer creates the nodes in:
 * - `game_loop`: the game's `loopSet` (L62109): gain and filter first, nodes created the first time the volume passes `startAbove`, gain from 0;
 * - `chain_loop`: the art scene's loops in `initAudio` (L1314–1316): source, filters, gain at its starting volume, created when the loop opens.
 */
export type LoopOrder = 'game_loop' | 'chain_loop'

export type LoopRecipe = {
  readonly id: string
  readonly bus: BusId
  readonly order?: LoopOrder
  /** An oscillator loop may leave the frequency out: it starts at the default and `set({ frequency })` glides it (the game's motor). */
  readonly source: (NoiseSource & { readonly loop: true }) | { readonly kind: 'osc'; readonly wave: OscillatorType; readonly frequency?: Automation; readonly loop: true }
  readonly filters?: FilterBank
  readonly modulators?: readonly Modulator[]
  /** `setTargetAtTime` time constants (jogo L62125–62126: 0.15 for the volume, 0.08 for the frequency). */
  readonly smoothing?: { readonly volume: number; readonly frequency: number }
  /** Nodes are created the first time the volume reaches this (jogo L62112: 0.002). */
  readonly startAbove?: number
  /** Volume the gain starts at when the loop opens (`chain_loop`). */
  readonly volume?: number
  readonly sources: readonly string[]
}

export type SoundBank = {
  readonly id: string
  readonly sounds?: readonly SoundRecipe[]
  readonly loops?: readonly LoopRecipe[]
}
