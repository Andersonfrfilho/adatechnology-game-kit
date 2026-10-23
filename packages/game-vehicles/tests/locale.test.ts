import { describe, expect, it } from 'vitest'
import { createTranslate, format, listLocales, registerLocale, resolveStrings } from '../src'
import { makeKit } from './helpers/kit'

describe('locale', () => {
  it('defaults to English', () => {
    const kit = makeKit({}, false)
    expect(kit.t('bands.intact')).toBe('Intact')
    expect(kit.bands[4].name).toBe('Torn off')
    expect(kit.config.defaultGroup).toBe('Vehicles')
  })

  it('reads pt-BR exactly as the original strings', () => {
    const kit = makeKit({ locale: 'pt-BR' })
    expect(kit.bands.map((b) => b.name)).toEqual(['Intacto', 'Arranhado', 'Amassado', 'Destruído', 'Arrancado'])
    const names = Object.fromEntries(kit.build('proto', 'intact').zones.map((z) => [z.id, z.name]))
    expect(names.bumper_front).toBe('Para-choque dianteiro')
    expect(names.hood).toBe('Capô')
    expect(names.fender_front_left).toBe('Paralama dianteiro esquerdo')
    expect(names.headlight_right).toBe('Farol direito')
    expect(names.underbody).toBe('Assoalho e suspensão')
    expect(kit.strings.ui.front).toBe('▲ FRENTE')
    expect(kit.strings.ui.health).toBe('Saúde geral')
  })

  it('accepts close codes: pt finds pt-BR, en-US finds en', () => {
    expect(resolveStrings('pt').bands.intact).toBe('Intacto')
    expect(resolveStrings('PT-br').bands.intact).toBe('Intacto')
    expect(resolveStrings('en-US').bands.intact).toBe('Intact')
  })

  it('falls back to English for an unknown locale', () => {
    expect(resolveStrings('xx').bands.intact).toBe('Intact')
    expect(makeKit({ locale: 'xx' }, false).bands[0].name).toBe('Intact')
  })

  it('falls back to English for keys a partial table leaves out', () => {
    const strings = resolveStrings({ bands: { intact: 'Neuf' } })
    expect(strings.bands.intact).toBe('Neuf')
    expect(strings.bands.scratched).toBe('Scratched')
    const kit = makeKit({ locale: { bands: { intact: 'Neuf' } } }, false)
    expect(kit.bands.map((b) => b.name).slice(0, 2)).toEqual(['Neuf', 'Scratched'])
  })

  it('registers a locale by code, extending an existing one', () => {
    registerLocale('fr', { bands: { intact: 'Intact', torn_off: 'Arraché' } })
    expect(listLocales()).toContain('fr')
    expect(resolveStrings('fr').bands.torn_off).toBe('Arraché')
    expect(resolveStrings('fr').bands.dented).toBe('Dented')
    registerLocale('fr', { bands: { dented: 'Cabossé' } })
    expect(resolveStrings('fr').bands).toMatchObject({ torn_off: 'Arraché', dented: 'Cabossé' })
  })

  it('translates keys, fills variables and expands the side words', () => {
    const t = createTranslate(resolveStrings('en'))
    expect(t('zones.hood')).toBe('Hood')
    expect(t('does.not.exist')).toBe('does.not.exist')
    expect(t('zones.door_front', { s: -1 })).toContain('left')
    expect(format('{a} and {A}', { a: 'tom' })).toBe('tom and Tom')
    expect(format('{missing}', { a: 1 })).toBe('{missing}')
    const pt = createTranslate(resolveStrings('pt-BR'))
    expect(pt('zones.door_front', { s: 1 })).toContain('direit')
  })

  it('lets matchers recognise unkeyed Portuguese labels', () => {
    const kit = makeKit({ locale: 'pt-BR' }, false)
    expect(kit.strings.matchers.windshield).toMatch(/brisa/)
  })
})
