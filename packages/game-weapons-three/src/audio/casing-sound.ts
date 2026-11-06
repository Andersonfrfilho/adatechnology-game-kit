// A spent case hitting the floor: brass rings on concrete and on steel, knocks short on wood and is only a soft tap on dirt or grass; a shotgun hull
// is plastic with a brass head, so it "toks" instead of ringing. Pure: the adapter plays the voices; the sample of each pair is
// `casing_drop_<surface>_<case>` (checklist-sons.md 5.2).
import type { CaseType } from '@adatechnology/game-weapons'

export type CasingSurface = 'hard' | 'wood' | 'metal' | 'soft'
export type CasingKind = 'pistol' | 'rifle' | 'shell'

/** Floor material (a game-destruction id or a plain word) → how a case sounds on it. Unknown floors are hard (concrete). */
const SURFACES: Readonly<Record<string, CasingSurface>> = {
  concrete: 'hard',
  stone: 'hard',
  brick: 'hard',
  mortar: 'hard',
  asphalt: 'hard',
  tile: 'hard',
  ceramic: 'hard',
  marble: 'hard',
  glass: 'hard',
  tempered_glass: 'hard',
  wood: 'wood',
  wood_soft: 'wood',
  wood_hard: 'wood',
  green_wood: 'wood',
  plywood: 'wood',
  mdf: 'wood',
  steel: 'metal',
  cast_iron: 'metal',
  iron: 'metal',
  aluminium: 'metal',
  aluminum: 'metal',
  copper: 'metal',
  metal: 'metal',
  soil: 'soft',
  dirt: 'soft',
  sand: 'soft',
  gravel: 'soft',
  turf: 'soft',
  grass: 'soft',
  foliage: 'soft',
  fabric: 'soft',
  carpet: 'soft',
  foam: 'soft',
  rubber: 'soft',
  leather: 'soft',
}

export const casingSurfaceOf = (material: string | undefined): CasingSurface => SURFACES[material ?? ''] ?? 'hard'
export const casingKindOf = (caseType: CaseType | string | undefined): CasingKind => (caseType === 'shell' ? 'shell' : caseType === 'rifle' || caseType === 'big' ? 'rifle' : 'pistol')

export interface CasingInput {
  readonly caseType?: CaseType | string
  /** Floor material id (`concrete`, `wood_hard`, `soil`...). */
  readonly surface?: string
  /** Vertical speed at the hit, m/s (the louder the faster). Default 1.5. */
  readonly speed?: number
  /** 0 for the first hit, then 1, 2...: each bounce is softer and a little higher. */
  readonly bounce?: number
  /** Pitch factor around 1 (the adapter draws ±6 %: no two cases ring the same). */
  readonly pitch?: number
}

export interface CasingVoice {
  readonly kind: 'tone' | 'noise'
  readonly filter?: 'lowpass' | 'highpass' | 'bandpass'
  readonly frequency: number
  readonly to?: number
  readonly q?: number
  readonly gain: number
  readonly seconds: number
}

export interface CasingSound {
  readonly surface: CasingSurface
  readonly kind: CasingKind
  readonly sample: string
  readonly voices: readonly CasingVoice[]
}

/** Lowest ring of a free brass tube (Hz) and the inharmonic partial of a tube, ×2.76. */
const RING: Readonly<Record<'pistol' | 'rifle', number>> = { pistol: 5200, rifle: 3600 }
const PARTIAL = 2.76
/** How long the brass rings on each floor (s): a steel plate lets it sing, wood damps it, dirt stops it. */
const RING_SECONDS: Readonly<Record<CasingSurface, number>> = { hard: 0.08, metal: 0.22, wood: 0.025, soft: 0 }
const KNOCK: Readonly<Record<CasingSurface, { frequency: number; gain: number; seconds: number }>> = {
  hard: { frequency: 6000, gain: 0.05, seconds: 0.006 },
  metal: { frequency: 5000, gain: 0.06, seconds: 0.008 },
  wood: { frequency: 1400, gain: 0.08, seconds: 0.02 },
  soft: { frequency: 500, gain: 0.05, seconds: 0.03 },
}

export function computeCasingSound(input: CasingInput): CasingSound {
  const surface = casingSurfaceOf(input.surface)
  const kind = casingKindOf(input.caseType)
  const pitch = (input.pitch ?? 1) * (1 + 0.03 * (input.bounce ?? 0))
  const level = Math.min(1, Math.max(0.05, (input.speed ?? 1.5) / 2.5)) * Math.pow(0.6, input.bounce ?? 0)
  const voices: CasingVoice[] = []
  const knock = KNOCK[surface]
  if (kind === 'shell') {
    // plastic hull: a hollow "tok", the brass head a short tick on a hard floor
    voices.push({ kind: 'noise', filter: 'bandpass', frequency: (surface === 'soft' ? 700 : 1500) * pitch, q: 2.5, gain: 0.09 * level, seconds: surface === 'soft' ? 0.03 : 0.045 })
    if (surface !== 'soft') voices.push({ kind: 'tone', frequency: 2900 * pitch, to: 2800 * pitch, gain: 0.025 * level, seconds: surface === 'metal' ? 0.06 : 0.025 })
  } else {
    voices.push({ kind: 'noise', filter: surface === 'soft' || surface === 'wood' ? 'lowpass' : 'highpass', frequency: knock.frequency * pitch, q: 0.7, gain: knock.gain * level, seconds: knock.seconds })
    const ringSeconds = RING_SECONDS[surface] * (kind === 'rifle' ? 1.3 : 1)
    if (ringSeconds > 0) {
      const f = RING[kind] * pitch
      voices.push({ kind: 'tone', frequency: f, to: f * 0.985, gain: 0.07 * level, seconds: ringSeconds })
      voices.push({ kind: 'tone', frequency: f * PARTIAL, to: f * PARTIAL * 0.99, gain: 0.03 * level, seconds: ringSeconds * 0.6 })
    }
  }
  // the sample ids of the sound infra (game-audio samples): concreto, madeira, terra, metal
  const surfaceName = surface === 'hard' ? 'concreto' : surface === 'soft' ? 'terra' : surface === 'wood' ? 'madeira' : 'metal'
  return { surface, kind, sample: `casing_drop_${surfaceName}_${kind}`, voices }
}

/** A dropped magazine hitting the floor. */
export interface MagazineDropInput {
  /** Floor material id (`concrete`, `wood_hard`, `soil`...). */
  readonly surface?: string
  /** Vertical speed at the hit, m/s. Default 1.5. */
  readonly speed?: number
  /** 0 for the first hit, then 1, 2... */
  readonly bounce?: number
}

/** The sample of a magazine landing on a floor, named like the cases': `mag_drop_<concreto|madeira|terra|metal>`. */
export function magazineDropId(material: string | undefined): string {
  const surface = casingSurfaceOf(material)
  return `mag_drop_${surface === 'hard' ? 'concreto' : surface === 'soft' ? 'terra' : surface === 'wood' ? 'madeira' : 'metal'}`
}
