import { readFileSync } from 'node:fs'

import { extractLiteral } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from './paths'

/** One item of the team's `DATA.itens`; the optional fields are the groups only some categories fill. */
export type IteItem = {
  readonly id: string
  readonly n: string
  readonly cat: string
  readonly kg: number
  readonly dur: string
  readonly rar: string
  readonly onde: readonly string[]
  readonly reg: readonly string[]
  readonly uso: string
  readonly f?: number
  readonly s?: number
  /** Days to spoil; `null` for what never spoils (salt, sugar, water, spirits). */
  readonly v?: number | null
  readonly p?: number
  readonly ck?: number | boolean
  readonly dano?: number
  readonly cr?: number
  readonly alc?: number
  readonly ru?: number
  readonly slot?: string
  readonly bm?: number
  readonly ar?: number
  readonly cal?: number
  readonly cap?: number
  readonly red?: number
  readonly rap?: number
}

export type IteRecipe = {
  readonly nome: string
  readonly entrada: string
  readonly ferramenta: string
  readonly habilidade: string
  readonly tempo: string
  readonly resultado: string
}

export type IteContainer = {
  readonly nome: string
  readonly onde: string
  readonly itens: string
  readonly categorias: string
  readonly regra: string
}

export type IteRegionSpecialty = { readonly regiao: string; readonly lugares: string; readonly itens: string; readonly regra: string }
export type IteProgressiveLoot = { readonly lugar: string; readonly queda: string; readonly minimo: string }
export type IteRarity = { readonly nome: string; readonly peso_tabela: number | null }

export type IteData = {
  readonly versao: string
  readonly categorias: Readonly<Record<string, string>>
  readonly locais: Readonly<Record<string, string>>
  readonly regioes: Readonly<Record<string, string>>
  readonly raridades: Readonly<Record<string, IteRarity>>
  readonly itens: readonly IteItem[]
  readonly receitas: readonly IteRecipe[]
  readonly conteineres: readonly IteContainer[]
  readonly especialidades_regiao: readonly IteRegionSpecialty[]
  readonly saque_progressivo: readonly IteProgressiveLoot[]
}

export const extractIte = (): IteData => extractLiteral<IteData>(readFileSync(SOURCE_PATHS.ite, 'utf8'), 'DATA')
