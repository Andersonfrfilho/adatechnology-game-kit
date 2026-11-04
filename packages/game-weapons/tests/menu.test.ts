import { describe, expect, it } from 'vitest'

import { createArsenal, genericWeapons, realLoadout, weaponMenu, WEAPON_MENU_GROUPS } from '../src'

describe('weaponMenu', () => {
  const arsenal = createArsenal({ locale: 'pt-BR' })
  const menu = weaponMenu(arsenal, { locale: 'pt-BR' })
  const ids = (groupId: string): string[] => menu.find((group) => group.id === groupId)?.sections.flatMap((section) => section.weapons.map((weapon) => weapon.id)) ?? []

  it('lists every weapon of the arsenal once, but the generic guns a real weapon stands for', () => {
    const listed = menu.flatMap((group) => group.sections.flatMap((section) => section.weapons.map((weapon) => weapon.id)))
    expect(new Set(listed).size).toBe(listed.length)
    const generics = genericWeapons(arsenal)
    expect([...listed].sort()).toEqual([...arsenal.weapons.keys()].filter((id) => !generics.has(id)).sort())
    expect(listed).not.toContain('pistol_9mm')
    const all = weaponMenu(arsenal, { generics: true }).flatMap((group) => group.sections.flatMap((section) => section.weapons.map((weapon) => weapon.id)))
    expect(all.length).toBe(arsenal.weapons.size)
  })

  it('knows the real weapon behind each generic gun, and swaps them in a loadout', () => {
    const generics = genericWeapons(arsenal)
    expect(generics.get('pistol_9mm')).toBe('beretta_92fs')
    expect(generics.get('rifle_7_62x39')).toBe('ak_47')
    expect(generics.get('flamethrower')).toBe('improvised_flamethrower')
    expect(generics.has('pistol_22') && generics.get('pistol_22')).toBe(undefined)
    expect(generics.has('frag_grenade')).toBe(false)
    expect(generics.has('crossbow')).toBe(false)
    expect(realLoadout(arsenal, ['hand', 'pistol_9mm', 'pistol_22', 'machete', 'rifle_7_62x39'])).toEqual(['hand', 'beretta_92fs', 'machete', 'ak_47'])
  })

  it('puts firearms, melee weapons, explosives and tools in their groups, in pt-BR', () => {
    expect(menu.map((group) => group.name)).toEqual(['Armas de fogo', 'Armas brancas', 'Explosivos', 'Ferramentas'])
    expect(ids('firearms')).toEqual(expect.arrayContaining(['glock_17', 'ak_47', 'remington_870', 'crossbow']))
    expect(menu[0]?.sections.flatMap((section) => section.weapons).find((weapon) => weapon.id === 'glock_17')?.maker).toBe('Glock')
    expect(ids('melee')).toEqual(expect.arrayContaining(['machete', 'knife', 'baseball_bat']))
    expect(ids('explosives')).toEqual(expect.arrayContaining(['frag_grenade', 'molotov', 'c4', 'rpg_7', 'm79']))
    expect(ids('tools')).toEqual(expect.arrayContaining(['screwdriver', 'utility_knife', 'extinguisher', 'lighter', 'm2_flamethrower', 'improvised_flamethrower']))
  })

  it('names each section by its category and sorts it by name', () => {
    const pistols = menu[0]?.sections.find((section) => section.id === 'pistol')
    expect(pistols?.name).toBe('Pistola')
    const pdw = menu[0]?.sections.find((section) => section.id === 'pdw')
    expect(pdw?.name).toBe('PDW (arma de defesa pessoal)')
    expect(pdw?.weapons.map((weapon) => weapon.id).sort()).toEqual(['fn_p90', 'hk_mp7a1'])
    const names = pistols?.weapons.map((weapon) => weapon.name) ?? []
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  })

  it('takes the groups of the game, and files what no group lists under Other', () => {
    const custom = weaponMenu(arsenal, { locale: 'en', groups: [{ id: 'guns', name: { en: 'Guns' }, categories: ['pistol'] }], exclude: (def) => def.id === 'glock_17' })
    expect(custom.map((group) => group.id)).toEqual(['guns', 'other'])
    expect(custom[0]?.sections[0]?.weapons.some((weapon) => weapon.id === 'glock_17')).toBe(false)
    expect(WEAPON_MENU_GROUPS.map((group) => group.id)).toEqual(['firearms', 'melee', 'explosives', 'tools'])
  })
})
