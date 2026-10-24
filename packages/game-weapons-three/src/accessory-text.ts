/** The words of the accessory bench, by locale (`en` and `pt-BR`). */
export interface AccessoryText {
  none: string
  mounts: Record<string, string>
  actions: Record<'light' | 'laser' | 'stock' | 'underbarrel', { name: string; hint: string }>
  layers: Record<'attachments' | 'beams', string>
  metrics: Record<'mass' | 'aim' | 'fitted' | 'suppressed', string>
  yes: string
  no: string
  attachments: Record<string, string>
  fitRefused: string
  fitting: string
  removing: string
  broke: string
  noLight: string
  noLaser: string
  noStock: string
  noLauncher: string
}

export const ACCESSORY_TEXT: Record<string, AccessoryText> = {
  en: {
    none: 'None',
    mounts: { muzzle: 'Muzzle', rail_top: 'Top rail', rail_left: 'Left rail', rail_right: 'Right rail', rail_bottom: 'Bottom rail', underbarrel: 'Under the barrel', magazine: 'Magazine', feed: 'Feed (backpack)', sling: 'Sling', barrel: 'Barrel' },
    actions: {
      light: { name: 'Light on/off (L)', hint: 'Turns the weapon light on or off' },
      laser: { name: 'Laser on/off (K)', hint: 'Turns the laser sight on or off' },
      stock: { name: 'Fold or open the stock (V)', hint: 'Folds or slides the stock in, or opens it' },
      underbarrel: { name: 'Launcher under the barrel (U)', hint: 'Switches the trigger and the reload between the weapon and the launcher under its barrel' },
    },
    layers: { attachments: 'Accessory models', beams: 'Light cone and laser beam' },
    metrics: { mass: 'Weapon mass', aim: 'Time to the sights', fitted: 'Accessories on the weapon', suppressed: 'Suppressed' },
    yes: 'yes',
    no: 'no',
    attachments: {},
    fitRefused: 'Could not change {mount} of {weapon}: {reason}',
    fitting: 'Fitting {attachment} on {weapon} ({seconds} s)',
    removing: 'Taking {attachment} off {weapon} ({seconds} s)',
    broke: '{attachment} broke on {weapon}',
    noLight: 'No light on this weapon',
    noLaser: 'No laser on this weapon',
    noStock: 'This weapon has no stock that folds or slides',
    noLauncher: 'No launcher under the barrel of this weapon',
  },
  'pt-BR': {
    none: 'Nenhum',
    mounts: { muzzle: 'Boca do cano', rail_top: 'Trilho superior', rail_left: 'Trilho esquerdo', rail_right: 'Trilho direito', rail_bottom: 'Trilho inferior', underbarrel: 'Sob o cano', magazine: 'Carregador', feed: 'Alimentação (mochila)', sling: 'Bandoleira', barrel: 'Cano' },
    actions: {
      light: { name: 'Ligar/desligar a lanterna (L)', hint: 'Liga ou desliga a lanterna da arma' },
      laser: { name: 'Ligar/desligar o laser (K)', hint: 'Liga ou desliga o laser da arma' },
      stock: { name: 'Dobrar ou abrir a coronha (V)', hint: 'Dobra ou recolhe a coronha, ou a abre' },
      underbarrel: { name: 'Lança-granada sob o cano (U)', hint: 'Passa o gatilho e a recarga entre a arma e o lança-granada sob o cano' },
    },
    layers: { attachments: 'Modelos dos acessórios', beams: 'Cone da lanterna e feixe do laser' },
    metrics: { mass: 'Massa da arma', aim: 'Tempo até a mira', fitted: 'Acessórios na arma', suppressed: 'Silenciada' },
    yes: 'sim',
    no: 'não',
    attachments: {
      suppressor: 'Supressor',
      oil_filter_suppressor: 'Supressor de filtro de óleo',
      integral_suppressor: 'Supressor integrado',
      muzzle_brake: 'Freio de boca',
      muzzle_brake_heavy: 'Freio de boca pesado',
      compensator: 'Compensador',
      red_dot: 'Mira red dot',
      holographic_sight: 'Mira holográfica',
      acog_4x: 'ACOG 4×',
      scope_3_9x: 'Luneta 3–9×',
      scope_6_24x: 'Luneta 6–24×',
      night_vision_scope: 'Mira noturna',
      thermal_scope: 'Mira térmica',
      integral_optic_1_5x: 'Mira integrada 1,5×',
      integral_optic_3x: 'Mira integrada 3×',
      pso_1: 'Mira PSO-1',
      fixed_scope_10x: 'Luneta fixa 10×',
      vertical_grip: 'Empunhadura vertical',
      bipod: 'Bipé',
      m203: 'Lança-granada M203',
      gp_25: 'Lança-granada GP-25',
      ag36: 'Lança-granada AG36',
      weapon_light: 'Lanterna',
      laser_sight: 'Laser',
      extended_magazine: 'Carregador estendido',
      drum_magazine: 'Carregador tambor',
      dual_coupler: 'Acoplador de carregadores',
      sawn_off_barrel: 'Cano serrado',
      long_barrel: 'Cano longo',
      sling: 'Bandoleira',
      ammo_backpack: 'Mochila de munição',
      tripod: 'Tripé',
    },
    fitRefused: 'Não deu para mudar {mount} de {weapon}: {reason}',
    fitting: 'Encaixando {attachment} em {weapon} ({seconds} s)',
    removing: 'Tirando {attachment} de {weapon} ({seconds} s)',
    broke: '{attachment} quebrou em {weapon}',
    noLight: 'Esta arma não tem lanterna',
    noLaser: 'Esta arma não tem laser',
    noStock: 'Esta arma não tem coronha que dobre ou recolha',
    noLauncher: 'Esta arma não tem lança-granada sob o cano',
  },
}

export const accessoryTextOf = (locale: string): AccessoryText => ACCESSORY_TEXT[locale] ?? (ACCESSORY_TEXT.en as AccessoryText)
