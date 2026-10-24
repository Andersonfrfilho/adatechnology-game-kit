import enJson from './data/locales/en.json'
import ptBrJson from './data/locales/pt-BR.json'

export type GoodsLocale = 'en' | 'pt-BR'

/** Texts by key: `item.<id>`, `category.<id>`, `place.<id>`, `rarity.<id>`, `container.<id>`, `recipe.<id>`. The pt-BR names are the team's. */
export type GoodsStrings = Readonly<Record<string, string>>

export const GOODS_STRINGS: Readonly<Record<GoodsLocale, GoodsStrings>> = { en: enJson, 'pt-BR': ptBrJson }

/** `pt`, `pt-BR` and `pt_br` give the Portuguese texts, anything else English. */
export const pickGoodsLocale = (locale?: string): GoodsLocale => (locale?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en')

/** The text of `key`, or the key itself when it has none. */
export const goodsText = (key: string, locale?: string): string => GOODS_STRINGS[pickGoodsLocale(locale)][key] ?? key
