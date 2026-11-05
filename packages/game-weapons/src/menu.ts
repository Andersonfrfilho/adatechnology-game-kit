import { genericWeapons } from './generics'
import type { Arsenal, WeaponCategory, WeaponDef, WeaponId } from './types'

/** One group of the weapon menu as a game declares it: the categories it lists, in order, each a section of its own. */
export interface WeaponMenuGroupDef {
  readonly id: string
  /** Name by locale (`en`, `pt-BR`...); the id when the locale has none. */
  readonly name: Readonly<Record<string, string>>
  readonly categories: readonly string[]
}

export interface WeaponMenuEntry {
  readonly id: WeaponId
  readonly name: string
  /** The maker of a brand weapon (Glock, Taurus, Heckler & Koch...), so a search by maker finds it. */
  readonly maker?: string
  /** The tags of the weapon (`pdw`, `explosive`...), so a search by them finds it. */
  readonly tags?: readonly string[]
  /** The section it is listed in (its category, or `flame` for a flamethrower filed as a launcher). */
  readonly category: string
}

export interface WeaponMenuSection {
  /** The category. */
  readonly id: string
  readonly name: string
  readonly weapons: readonly WeaponMenuEntry[]
}

export interface WeaponMenuGroup {
  readonly id: string
  readonly name: string
  readonly sections: readonly WeaponMenuSection[]
}

export interface WeaponMenuOptions {
  /** Locale of the group names (default `en`); the weapon and category names are the arsenal's own. */
  readonly locale?: string
  /** The groups and their categories (default `WEAPON_MENU_GROUPS`). A category no group lists goes to a last `other` group. */
  readonly groups?: readonly WeaponMenuGroupDef[]
  /** Weapons left out of the menu (default none). */
  readonly exclude?: (def: WeaponDef) => boolean
  /** List the generic guns too (`genericWeapons`: the `9 mm service pistol` that wears the Beretta's model); default false, the real weapons stand for them. */
  readonly generics?: boolean
}

/** The groups of the menu: firearms, bladed and blunt weapons, explosives (throwables and launchers), tools (and the flames). */
export const WEAPON_MENU_GROUPS: readonly WeaponMenuGroupDef[] = [
  {
    id: 'firearms',
    name: { en: 'Firearms', 'pt-BR': 'Armas de fogo' },
    categories: ['pistol', 'revolver', 'smg', 'pdw', 'carbine', 'rifle', 'dmr', 'hunting', 'sniper', 'shotgun', 'machine_gun', 'bow', 'crossbow'],
  },
  { id: 'melee', name: { en: 'Melee weapons', 'pt-BR': 'Armas brancas' }, categories: ['melee_blade', 'melee_blunt', 'hand'] },
  { id: 'explosives', name: { en: 'Explosives', 'pt-BR': 'Explosivos' }, categories: ['throwable', 'launcher'] },
  { id: 'tools', name: { en: 'Tools', 'pt-BR': 'Ferramentas' }, categories: ['tool', 'heat', 'flame', 'extinguisher'] },
]

const OTHER_GROUP: WeaponMenuGroupDef = { id: 'other', name: { en: 'Other', 'pt-BR': 'Outros' }, categories: [] }

// a flamethrower is filed as a launcher (it is carried like one) but fires a flame: it is listed with the flames; a personal defence weapon (tag `pdw`: the P90, the MP7) has a section of its own
const sectionOf = (def: WeaponDef): string => {
  if (def.category === 'launcher' && def.action.kind === 'flame') return 'flame'
  return def.tags?.includes('pdw') ? 'pdw' : def.category
}

const nameIn = (def: WeaponMenuGroupDef, locale: string): string => def.name[locale] ?? def.name.en ?? def.id

const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** The whole arsenal by group and section, each section sorted by name: what a weapon picker lists. */
export function weaponMenu(arsenal: Arsenal, options: WeaponMenuOptions = {}): WeaponMenuGroup[] {
  const locale = options.locale ?? 'en'
  const groups = options.groups ?? WEAPON_MENU_GROUPS
  const bySection = new Map<string, WeaponMenuEntry[]>()
  const generics = options.generics ? new Map<WeaponId, WeaponId | undefined>() : genericWeapons(arsenal)
  for (const def of arsenal.weapons.values()) {
    if (options.exclude?.(def) || generics.has(def.id)) continue
    const category = sectionOf(def)
    const list = bySection.get(category) ?? []
    list.push({ id: def.id, name: capitalize(arsenal.name(def.id)), category, ...(def.maker ? { maker: def.maker } : {}), ...(def.tags?.length ? { tags: def.tags } : {}) })
    bySection.set(category, list)
  }
  const listed = new Set(groups.flatMap((group) => group.categories))
  const other: WeaponMenuGroupDef = { ...OTHER_GROUP, categories: [...bySection.keys()].filter((category) => !listed.has(category)) }
  const sectionsOf = (group: WeaponMenuGroupDef): WeaponMenuSection[] =>
    group.categories.flatMap((category) => {
      const weapons = bySection.get(category)
      if (!weapons?.length) return []
      const sorted = [...weapons].sort((a, b) => a.name.localeCompare(b.name, locale))
      return [{ id: category, name: capitalize(arsenal.name(category as WeaponCategory)), weapons: sorted }]
    })
  return [...groups, other].flatMap((group) => {
    const sections = sectionsOf(group)
    return sections.length ? [{ id: group.id, name: nameIn(group, locale), sections }] : []
  })
}
