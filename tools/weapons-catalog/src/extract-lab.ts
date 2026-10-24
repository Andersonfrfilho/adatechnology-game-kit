import { readFileSync } from 'node:fs'

import { extractLiteral } from './cut-literal'
import { SOURCE_PATHS } from './paths'

export type LabProfile = {
  readonly lethal: number
  readonly injury: number
  readonly cone?: { readonly half: number; readonly len: number }
  readonly ignite?: number
  readonly residual?: readonly { readonly r: number; readonly life: number }[]
} & Readonly<Record<string, unknown>>

export const extractLab = (): Readonly<Record<string, LabProfile>> => {
  const source = readFileSync(SOURCE_PATHS.lab, 'utf8')
  const scope = { prof: (profile: unknown) => profile, PI: Math.PI, SMOKE: {} }
  return extractLiteral(source, 'PROF', scope)
}
