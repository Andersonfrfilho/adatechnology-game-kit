/**
 * Legacy seeds. Every damage effect is deterministic: the random stream of a zone comes from a hash of the vehicle key, the
 * zone id and the band. The first version of the engine used Portuguese ids and salts, so ids and salts that were renamed
 * keep their original text here, and the seed is built from the legacy text. A vehicle that looked a given way before
 * renaming still looks exactly the same.
 */
import { slug } from './util'

/** Build states: new English name -> original seed text. */
export const LEGACY_STATES: Record<string, string> = { intact: 'intacto', damaged: 'danificado', modified: 'modificado' }

/** Salts mixed into the seed of each phase of `applyZones`. */
export const SEED_SALTS = { rust: '|ferrugem|', scenario: '|cenario', settle: '|assenta', rollover: '|capota' }

/** Auto-derived zone ids: new id -> original id. Ids that did not change are not listed. */
export const LEGACY_ZONE_IDS: Record<string, string> = {
  bumper_front: 'parachoque_d',
  bumper_rear: 'parachoque_t',
  fender_front_left: 'paralama_de',
  fender_front_right: 'paralama_dd',
  door_front_left: 'porta_de',
  door_front_right: 'porta_dd',
  door_rear_left: 'porta_te',
  door_rear_right: 'porta_td',
  side_rear_left: 'lateral_te',
  side_rear_right: 'lateral_td',
  hood: 'capo',
  roof: 'teto',
  lid: 'tampa',
  underbody: 'assoalho',
  cargo_bed: 'cacamba',
  engine: 'motor',
  radiator: 'radiador',
  fuel_tank: 'tanque',
  battery: 'bateria',
  fairing: 'carenagem',
  handlebar: 'guidao',
  seat: 'banco',
  frame: 'quadro',
  exhaust: 'escapamento',
  front: 'frente',
  rear: 'traseira',
  top: 'topo',
  tractor_hood: 'capo_trator',
  fender_rear_left: 'paralama_te',
  fender_rear_right: 'paralama_td',
  operator_station: 'posto',
  cab_front: 'cab_frente',
  cab_left: 'cab_e',
  cab_right: 'cab_d',
  body_left: 'corpo_e',
  body_right: 'corpo_d',
  body_rear: 'corpo_t',
  chassis: 'chassi',
  armor_front: 'blind_frente',
  armor_left: 'blind_e',
  armor_right: 'blind_d',
  armor_rear: 'blind_t',
  weapon: 'arma',
  turret: 'torre',
  track_left: 'lagarta_e',
  track_right: 'lagarta_d',
  wheels_left: 'rodas_e',
  wheels_right: 'rodas_d',
  bow: 'proa',
  side_left: 'costado_e',
  side_right: 'costado_d',
  stern: 'popa',
  deck: 'conves',
  nose: 'nariz',
  cab: 'cabine',
  wing_left: 'asa_e',
  wing_right: 'asa_d',
  fuselage: 'fuselagem',
  tail: 'cauda',
  landing_gear: 'trem',
  fuel_tanks: 'tanques',
  tail_cone: 'cone',
  rotor: 'rotor',
  tail_rotor: 'rotor_cauda',
  skids: 'esquis',
}

/**
 * Lets a content pack add its own legacy seeds: `zones` maps a new zone id to the original id and `glassLabels` maps the key of a
 * glass part to its original label. The tables are shared by every kit of the process; an id keeps one meaning, so a different
 * text for an id that is already known is an error.
 */
export function registerLegacySeeds(tables: { zones?: Record<string, string>; glassLabels?: Record<string, string> }): void {
  const add = (target: Record<string, string>, source: Record<string, string> | undefined, what: string) => {
    Object.keys(source || {}).forEach(function (k) {
      if (target[k] !== undefined && target[k] !== source![k]) throw new Error('registerLegacySeeds: ' + what + ' "' + k + '" already maps to "' + target[k] + '"')
      target[k] = source![k]
    })
  }
  add(LEGACY_ZONE_IDS, tables.zones, 'zone id')
  add(LEGACY_GLASS_LABELS, tables.glassLabels, 'glass label')
}

/** The text a zone contributes to its seed: an explicit `seedId`, the legacy id, or the id itself. */
export function legacyZoneId(z: { id: string; seedId?: string }): string {
  return z.seedId || LEGACY_ZONE_IDS[z.id] || z.id
}

/** Original glass labels by part key; the zone id of a pane was the slug of its (Portuguese) label. */
export const LEGACY_GLASS_LABELS: Record<string, string> = {
  windshield: 'Para-brisa',
  rear_window: 'Vidro traseiro',
  window_front: 'Janela dianteira',
  window_rear: 'Janela traseira',
  quarter_glass: 'Vidro lateral traseiro',
  cab_window: 'Janela da cabine',
  window: 'Janela',
  glass: 'Vidro',
}

/**
 * Original zone id of a glass pane. `key` is the part key (null for free-text labels), `label` the current label,
 * `side` -1/1 for panes made by `sideWindows`, `appended` 'left'/'right' when the zone added a side word itself and
 * `fallback` the new id, used when the label was free text (then the id never changed).
 */
export function legacyGlassId(key: string | null, label: string, side: number, appended: string | null, fallback: string): string {
  if (!key || !(key in LEGACY_GLASS_LABELS)) return fallback
  let text = LEGACY_GLASS_LABELS[key]
  if (side) text += side < 0 ? ' esquerda' : ' direita'
  else if (appended) text += appended === 'left' ? ' esquerdo' : ' direito'
  let id = slug(text)
  if (!/^vidro|^janela|^para_brisa/.test(id)) id = 'vidro_' + id
  void label
  return id
}

/** Original id of a light zone: `farol_e`, `lanterna_c`, `farol_d_2`... */
export function legacyLightId(kind: string, side: string, index: number): string {
  const k = kind === 'taillight' ? 'lanterna' : 'farol'
  const s = side === 'center' ? 'c' : side === 'left' ? 'e' : 'd'
  return k + '_' + s + (index ? '_' + (index + 1) : '')
}
