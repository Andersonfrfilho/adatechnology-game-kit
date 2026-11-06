/**
 * The sounds a game needs, by category, as the sound checklist lists them (generic, real-world names: a 9 mm pistol, a wooden door): the id a file
 * takes, its priority and the synthesized sound it replaces today (`current`, the A of an A/B). A sound is "file" once a bank registers a sample under
 * its id; "synth" while only `current` exists; "missing" when neither does. Data only: a game adds, renames or drops entries without touching the engine.
 */

export const SFX_CATEGORIES = ['armas', 'impactos', 'explosoes-fogo', 'personagem', 'veiculos', 'itens-portas', 'ambiente'] as const
export type SfxCategory = (typeof SFX_CATEGORIES)[number]

export type SfxPriority = 1 | 2 | 3

export type SfxEntry = {
  readonly id: string
  readonly category: SfxCategory
  readonly priority: SfxPriority
  /** The synthesized sound playing in its place today (a recipe id of some bank), if any. */
  readonly current?: string
}

const entries = (category: SfxCategory, list: readonly (readonly [id: string, priority: SfxPriority, current?: string])[]): SfxEntry[] =>
  list.map(([id, priority, current]) => ({ id, category, priority, ...(current ? { current } : {}) }))

export const SFX_CATALOG: readonly SfxEntry[] = [
  ...entries('armas', [
    ['pistol_22lr', 2, 'sfx_pistol'],
    ['pistol_9mm', 1, 'sfx_pistol'],
    ['pistol_45', 1, 'sfx_pistol'],
    ['revolver_38_357', 2, 'sfx_pistol'],
    ['revolver_44_50ae', 3, 'sfx_pistol'],
    ['smg_9mm_auto', 1, 'sfx_pistol'],
    ['launcher_40mm', 2],
    ['rocket_launch', 2],
    ['shotgun_12', 1, 'sfx_shotgun'],
    ['rifle_5_56', 1, 'sfx_rifle'],
    ['rifle_7_62x39', 1, 'sfx_rifle'],
    ['rifle_auto_burst', 1, 'sfx_rifle'],
    ['rifle_308_3006', 2, 'sfx_rifle'],
    ['sniper_338_300wm', 2, 'sfx_rifle'],
    ['antimateriel_50bmg', 3, 'sfx_rifle'],
    ['suppressed_pistol', 2],
    ['suppressed_rifle', 2],
    ['gunshot_far_pistol', 1],
    ['gunshot_far_rifle', 1],
    ['gunshot_far_shotgun', 1],
    ['gunshot_far_heavy', 2],
    ['gunshot_tail_indoor', 1],
    ['gunshot_tail_outdoor', 1],
    ['bullet_crack_by', 2],
    ['bullet_whiz', 2],
    ['ricochet_metal', 2, 'ping'],
    ['dry_fire', 1],
    ['mag_out', 1],
    ['mag_in', 1],
    ['slide_pull_release', 1],
    ['pump_cycle', 1],
    ['casing_drop_concreto_pistol', 1],
    ['casing_drop_concreto_rifle', 1],
    ['casing_drop_concreto_shell', 1],
    ['casing_drop_madeira_pistol', 1],
    ['casing_drop_madeira_rifle', 1],
    ['casing_drop_madeira_shell', 1],
    ['casing_drop_metal_pistol', 1],
    ['casing_drop_metal_rifle', 1],
    ['casing_drop_metal_shell', 1],
    ['casing_drop_terra_pistol', 1],
    ['casing_drop_terra_rifle', 1],
    ['casing_drop_terra_shell', 1],
    ['rocket_fire', 2],
    ['smg_45_auto', 2, 'sfx_pistol'],
    ['weapon_draw', 2],
    ['suppressor_attach', 3],
    ['suppressor_detach', 3],
    ['minigun_loop', 3],
    ['smg_5_7x28', 3],
    ['mg_belt_adjust', 3],
    ['mg_belt_box_attach', 3],
    ['mg_cover_open', 3],
    ['mg_cover_close', 3],
    ['weapon_holster', 3],
    ['scope_zoom', 3],
  ]),
  ...entries('impactos', [
    ['knife_hit_wall', 3],
    ['helmet_hit', 3],
    ['vest_hit', 3],
    ['headshot', 3],
    ['blood_squirt', 3],
  ]),
  ...entries('explosoes-fogo', [
    ['explosion_grenade', 1, 'boom'],
    ['explosion_big', 1, 'boom_big'],
    ['explosion_car', 2, 'boom_big'],
    ['explosion_far', 1],
    ['debris_rain_stone', 1],
    ['molotov_break_ignite', 1, 'glass_shatter'],
    ['fire_ignite', 1, 'hiss'],
    ['fire_loop_small', 1],
    ['fire_loop_large', 1],
    ['fire_extinguish', 2, 'hiss'],
    ['gas_leak_hiss', 2],
    ['structure_collapse', 2, 'crumble'],
    ['grenade_bounce', 1],
    ['c4_plant', 2],
    ['c4_beep', 2],
    ['c4_disarm', 2],
    ['c4_disarming_loop', 3],
    ['c4_remote_detonate', 3],
    ['smoke_grenade_hiss', 3],
    ['grenade_pin_pull', 3],
    ['electric_shock', 3],
    ['electric_spark', 3],
  ]),
  ...entries('personagem', [
    ['footstep_concrete_walk', 1, 'sfx_step'],
    ['footstep_wood_walk', 1, 'sfx_step'],
    ['footstep_dirt_walk', 1, 'sfx_step'],
    ['footstep_grass_walk', 1, 'sfx_step'],
    ['footstep_gravel_walk', 1, 'sfx_step'],
    ['land_concrete', 1, 'sfx_step'],
    ['punch_swing', 1],
    ['punch_hit_body', 1, 'sfx_flesh'],
    ['kick_hit', 1, 'sfx_flesh'],
    ['knife_stab', 1],
    ['blunt_hit', 1],
    ['bite', 1, 'sfx_flesh'],
    ['body_fall', 1],
    ['player_hurt', 2],
    ['footstep_tile_walk', 1, 'sfx_step'],
    ['footstep_water_walk', 1, 'sfx_step'],
    ['footstep_grate_walk', 2, 'sfx_step'],
    ['footstep_duct_walk', 3, 'sfx_step'],
    ['ladder_climb', 2],
    ['swim', 2],
    ['zombie_groan', 1],
    ['zombie_alert', 1],
    ['zombie_attack', 1],
    ['zombie_pain', 1],
    ['zombie_claw_hit', 1, 'sfx_flesh'],
    ['zombie_claw_miss', 2],
    ['swing_whoosh', 3],
    ['heartbeat_critical', 3],
    ['fall_water', 3],
    ['fall_damage', 3],
    ['fall_scream', 3],
    ['footstep_glass_walk', 3],
  ]),
  ...entries('veiculos', [
    ['engine_loop_car', 1],
    ['engine_start', 1],
    ['crash_light', 1, 'crash'],
    ['crash_heavy', 1, 'crash'],
    ['car_door_open', 1, 'latch'],
    ['car_door_close', 1, 'shut_metal'],
    ['horn_car', 2, 'horn'],
    ['tire_skid_asphalt', 2],
    ['jet_flyby', 3],
    ['helicopter_turbine', 3],
    ['tire_burnout', 3],
    ['handbrake_turn', 3],
    ['siren_police', 3],
  ]),
  ...entries('itens-portas', [
    ['item_pickup_metal', 1],
    ['can_open', 1],
    ['can_crush', 1],
    ['door_wood_open', 1, 'latch'],
    ['door_wood_close', 1, 'shut_wood'],
    ['door_creak', 1, 'creak_wood'],
    ['door_locked_rattle', 1, 'rattle'],
    ['drawer_open', 2, 'slide'],
    ['fridge_close', 2, 'shut_metal'],
    ['inventory_open', 3],
    ['inventory_close', 3],
    ['inventory_select', 3],
    ['inventory_place', 3],
    ['pickup_chime', 3],
    ['item_pickup_coins', 3],
    ['bandage_use', 3],
    ['bandage_refuse', 3],
    ['flashlight_toggle', 3],
    ['gear_draw', 3],
    ['gear_holster', 3],
    ['button_press', 3],
    ['lock_desk_open', 3],
    ['elevator_move_loop', 3],
    ['elevator_stop', 3],
    ['door_sliding', 3],
    ['door_kick', 3],
    ['door_wood_break', 3],
    ['gate_iron_open', 3],
    ['gate_iron_close', 3],
  ]),
  ...entries('ambiente', [
    ['rain_loop', 2],
    ['wind_loop', 2],
    ['thunder_near', 2],
    ['thunder_far', 2],
    ['water_splash', 2],
    ['helicopter_loop', 3],
    ['bird_flush', 3],
    ['dog_growl', 3],
    ['dog_whimper', 3],
    ['dog_howl', 3],
    ['zombie_dog_bark', 3],
    ['zombie_dog_howl_far', 3],
    ['insect_squash', 3],
    ['insect_crawl', 3],
    ['fan_loop', 3],
  ]),
]

/** The materials of the impact matrix, with the group whose synthesized sound plays for them today. */
export const SFX_MATERIALS = [
  ['steel', 'metal'],
  ['aluminium', 'metal'],
  ['wood', 'wood'],
  ['plywood', 'wood'],
  ['mdf', 'wood'],
  ['glass', 'glass'],
  ['tempered_glass', 'glass'],
  ['ceramic', 'glass'],
  ['concrete', 'masonry'],
  ['brick', 'masonry'],
  ['plaster', 'masonry'],
  ['plastic', 'soft'],
  ['fabric', 'soft'],
  ['paper', 'soft'],
  ['foliage', 'soft'],
  ['soil', 'soft'],
  ['flesh', 'soft'],
] as const satisfies readonly (readonly [string, string])[]
export type SfxMaterial = (typeof SFX_MATERIALS)[number][0]

export const SFX_BLOWS = ['bullet', 'blunt', 'blade', 'break', 'drag'] as const
export type SfxBlow = (typeof SFX_BLOWS)[number]

// the destruction renderer's synthesized sounds by material group (art scene keys), the A side of the matrix
const CURRENT_BY_GROUP: Readonly<Record<string, Readonly<Partial<Record<SfxBlow, string>>>>> = {
  metal: { bullet: 'clang', blunt: 'clang', blade: 'clang', break: 'clang', drag: 'drag_metal' },
  wood: { bullet: 'wood_hit', blunt: 'wood_hit', blade: 'wood_hit', break: 'crack', drag: 'drag_wood' },
  glass: { bullet: 'ping', blunt: 'ping', break: 'glass_shatter', drag: 'drag_glass' },
  masonry: { bullet: 'chip', blunt: 'chip', blade: 'chip', break: 'crumble', drag: 'drag_masonry' },
  soft: { bullet: 'thud', blunt: 'thud', blade: 'thud', break: 'thud', drag: 'drag_soft' },
}

/** The id a file of the matrix takes: `impact_<material>_<blow>` (`impact_concrete_bullet`). */
export const impactSoundId = (material: SfxMaterial, blow: SfxBlow): string => `impact_${material}_${blow}`

/** The impact matrix as entries (the `impactos` category of the catalogue). */
export const SFX_IMPACTS: readonly SfxEntry[] = SFX_MATERIALS.flatMap(([material, group]) =>
  SFX_BLOWS.map((blow) => {
    const current = CURRENT_BY_GROUP[group]?.[blow]
    return { id: impactSoundId(material, blow), category: 'impactos' as const, priority: (['steel', 'wood', 'glass', 'concrete', 'brick', 'soil', 'flesh'].includes(material) && blow === 'bullet' ? 1 : 2) as SfxPriority, ...(current ? { current } : {}) }
  }),
)

/** Where an entry stands in an engine: a file registered (`file`), only the synthesized sound (`synth`), or nothing (`missing`). */
export type SfxState = 'file' | 'synth' | 'missing'

export function sfxState(entry: SfxEntry, has: { sample(id: string): unknown; sound(id: string): unknown }): SfxState {
  if (has.sample(entry.id)) return 'file'
  if ((entry.current && has.sound(entry.current)) || has.sound(entry.id)) return 'synth'
  return 'missing'
}
