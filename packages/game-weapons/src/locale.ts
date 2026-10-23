/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type WeaponsLocale = 'en' | 'pt-BR'

export interface WeaponsStrings {
  /** Display name of each weapon id. */
  weapons: Record<string, string>
  /** Display name of each fire mode. */
  modes: Record<string, string>
  /** Display name of each weapon category. */
  categories: Record<string, string>
}

const modesEn = { single: 'single action', semi: 'semi-automatic', burst: 'burst', auto: 'automatic', pump: 'pump action', bolt: 'bolt action', lever: 'lever action', break: 'break action' }
const categoriesEn = {
  pistol: 'pistol', revolver: 'revolver', smg: 'submachine gun', rifle: 'rifle', carbine: 'carbine', sniper: 'sniper rifle', shotgun: 'shotgun',
  bow: 'bow', crossbow: 'crossbow', melee_blunt: 'blunt melee', melee_blade: 'bladed melee', flame: 'flame', heat: 'heat', throwable: 'throwable',
  tool: 'tool', extinguisher: 'extinguisher', hand: 'hand',
}

export const locales: Record<WeaponsLocale, WeaponsStrings> = {
  en: {
    weapons: {
      hand: 'Hand', kick: 'Kick', shove: 'Shove', pistol_9mm: '9 mm service pistol', pistol_45: '.45 ACP pistol', pistol_22: '.22 LR pistol', revolver_357: '.357 Magnum revolver',
      revolver_38: '.38 Special revolver', smg_9mm: '9 mm submachine gun', carbine_22: '.22 LR carbine', rifle_5_56: '5.56 mm assault rifle',
      rifle_7_62x39: '7.62×39 mm assault rifle', rifle_bolt_308: '.308 bolt-action rifle', sniper_338: '.338 Lapua sniper rifle',
      anti_materiel_50: '.50 BMG anti-materiel rifle', shotgun_pump_12: '12 gauge pump-action shotgun', shotgun_double_12: '12 gauge double-barrel shotgun',
      shotgun_semi_12: '12 gauge semi-automatic shotgun', bow_compound: 'Compound bow', crossbow: 'Crossbow', hammer: 'Hammer', sledgehammer: 'Sledgehammer',
      baseball_bat: 'Baseball bat', crowbar: 'Crowbar', machete: 'Machete', axe: 'Axe', knife: 'Knife', fists: 'Fists', lighter: 'Lighter',
      flamethrower: 'Flamethrower', molotov: 'Molotov cocktail', cutting_torch: 'Oxy-fuel cutting torch', blowtorch: 'Blowtorch',
      frag_grenade: 'Fragmentation grenade', pipe_bomb: 'Pipe bomb', screwdriver: 'Screwdriver', wrench: 'Wrench', pry_bar: 'Pry bar', hacksaw: 'Hacksaw',
      utility_knife: 'Utility knife', claw_hammer: 'Claw hammer', extinguisher: 'Fire extinguisher',
    },
    modes: modesEn,
    categories: categoriesEn,
  },
  'pt-BR': {
    weapons: {
      hand: 'mão', kick: 'chute', shove: 'empurrão', pistol_9mm: 'pistola 9 mm', pistol_45: 'pistola .45', pistol_22: 'pistola .22', revolver_357: 'revólver .357', revolver_38: 'revólver .38',
      smg_9mm: 'submetralhadora 9 mm', carbine_22: 'carabina .22', rifle_5_56: 'fuzil 5,56', rifle_7_62x39: 'fuzil 7,62×39', rifle_bolt_308: 'fuzil de ferrolho .308',
      sniper_338: 'fuzil de precisão .338', anti_materiel_50: 'fuzil antimaterial .50', shotgun_pump_12: 'espingarda de repetição calibre 12',
      shotgun_double_12: 'espingarda de dois canos calibre 12', shotgun_semi_12: 'espingarda semiautomática calibre 12', bow_compound: 'arco composto',
      crossbow: 'besta', hammer: 'martelo', sledgehammer: 'marreta', baseball_bat: 'taco de beisebol', crowbar: 'pé de cabra', machete: 'facão', axe: 'machado',
      knife: 'faca', fists: 'punhos', lighter: 'isqueiro', flamethrower: 'lança-chamas', molotov: 'coquetel molotov', cutting_torch: 'maçarico de corte',
      blowtorch: 'maçarico', frag_grenade: 'granada de fragmentação', pipe_bomb: 'bomba caseira', screwdriver: 'chave de fenda', wrench: 'chave inglesa',
      pry_bar: 'alavanca', hacksaw: 'serra de arco', utility_knife: 'estilete', claw_hammer: 'martelo de unha', extinguisher: 'extintor',
    },
    modes: { single: 'tiro único', semi: 'semiautomático', burst: 'rajada', auto: 'automático', pump: 'repetição', bolt: 'ferrolho', lever: 'alavanca', break: 'basculante' },
    categories: {
      pistol: 'pistola', revolver: 'revólver', smg: 'submetralhadora', rifle: 'fuzil', carbine: 'carabina', sniper: 'fuzil de precisão', shotgun: 'espingarda',
      bow: 'arco', crossbow: 'besta', melee_blunt: 'corpo a corpo contundente', melee_blade: 'corpo a corpo cortante', flame: 'chama', heat: 'calor',
      throwable: 'arremessável', tool: 'ferramenta', extinguisher: 'extintor', hand: 'mão',
    },
  },
}

export const resolveStrings = (locale: string | undefined): WeaponsStrings => locales[(locale as WeaponsLocale) ?? 'en'] ?? locales.en
