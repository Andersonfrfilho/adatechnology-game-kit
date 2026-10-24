import type { Decisions } from './decisions'
import { valueOf } from './decisions'
import type { IteRecipe } from './extract-ite'

/** What the recipe consumes: one item or one of several (`any`), counted in units, litres or metres; `label` keeps the words of the source. */
export type RecipeInput = {
  item?: string
  any?: string[]
  qty?: number
  liters?: number
  meters?: number
  label: string
}

/** A tool requirement: one of `anyOf` (empty for bare hands). All the requirements of a recipe must hold. */
export type RecipeTool = { anyOf: string[]; label: string }

export type RecipeOutput =
  | { item: string; qty: [number, number]; label: string; note?: string }
  | { effect: string; params: Record<string, never>; text: string }

export type Recipe = {
  id: string
  inputs: RecipeInput[]
  tools: RecipeTool[]
  skill?: { id: string; level: number }
  seconds: number
  /** Words after the time ("parada", "secando"): the recipe waits, it is not worked on. */
  timeSuffix?: string
  output: RecipeOutput
  /** Item ids the recipe names that the catalog does not have yet. */
  unresolved: string[]
}

/** Turns a reference of a recipe term (a team id, a household id or a new id) into the final item id. */
export type ItemResolver = (reference: string) => { id: string; isKnown: boolean }

export type RecipeContext = { decisions: Decisions; resolveItem: ItemResolver }

const SECONDS_PER_UNIT: Readonly<Record<string, number>> = { s: 1, min: 60, dia: 86400, dias: 86400 }
const ALTERNATIVE_SEPARATOR = /, | ou /
const QUANTITY = /^(\d+(?:,\d+)?)(?: (L|m) de)? /

const toNumber = (text: string): number => Number(text.replace(',', '.'))
const toText = (value: number): string => String(value).replace('.', ',')

const lookup = (phrase: string, context: RecipeContext, unresolved: Set<string>): string[] => {
  const target = valueOf(context.decisions.recipeTerms, phrase, 'recipe phrase')
  if (target.none || !target.item) return []
  const { id, isKnown } = context.resolveItem(target.item)
  if (!isKnown) unresolved.add(id)
  return [id]
}

const parseInput = (term: string, context: RecipeContext, unresolved: Set<string>): RecipeInput => {
  const quantity = QUANTITY.exec(term)
  const label = quantity ? term.slice(quantity[0].length) : term
  const ids = label.split(ALTERNATIVE_SEPARATOR).flatMap((alternative) => lookup(alternative.replace(/^\d+ /, ''), context, unresolved))
  const input: RecipeInput = ids.length === 1 ? { item: ids[0] ?? '', label } : { any: ids, label }
  if (!quantity) return input
  const amount = toNumber(quantity[1] ?? '')
  if (quantity[2] === 'L') input.liters = amount
  else if (quantity[2] === 'm') input.meters = amount
  else input.qty = amount
  return input
}

const parseTool = (group: string, context: RecipeContext, unresolved: Set<string>): RecipeTool => ({
  anyOf: group.split(ALTERNATIVE_SEPARATOR).flatMap((alternative) => lookup(alternative, context, unresolved)),
  label: group,
})

const parseTime = (text: string): Pick<Recipe, 'seconds' | 'timeSuffix'> => {
  const match = /^(\d+) (s|min|dias?)(?: (.+))?$/.exec(text)
  if (!match) throw new Error(`items-catalog: cannot read the recipe time "${text}"`)
  const seconds = Number(match[1]) * (SECONDS_PER_UNIT[match[2] ?? ''] ?? 1)
  return match[3] === undefined ? { seconds } : { seconds, timeSuffix: match[3] }
}

const parseOutput = (text: string, recipeId: string, context: RecipeContext, unresolved: Set<string>): RecipeOutput => {
  const match = /^(\d+)(?: a (\d+))? ([^,.]+)(,[^.]*)?\.$/.exec(text)
  const label = match?.[3] ?? ''
  if (!match || !context.decisions.recipeTerms[label]) return { effect: recipeId, params: {}, text }
  const [item] = lookup(label, context, unresolved)
  if (!item) return { effect: recipeId, params: {}, text }
  const low = Number(match[1])
  const output: RecipeOutput = { item, qty: [low, match[2] === undefined ? low : Number(match[2])], label }
  return match[4] === undefined ? output : { ...output, note: match[4] }
}

export const parseRecipe = (source: IteRecipe, context: RecipeContext): Recipe => {
  const unresolved = new Set<string>()
  const id = valueOf(context.decisions.recipeIds, source.nome, 'recipe')
  const skillMatch = /^(.+) (\d+)$/.exec(source.habilidade)
  const recipe: Recipe = {
    id,
    inputs: source.entrada.split(' + ').map((term) => parseInput(term, context, unresolved)),
    tools: source.ferramenta === '—' ? [] : source.ferramenta.split(' e ').map((group) => parseTool(group, context, unresolved)),
    ...parseTime(source.tempo),
    output: parseOutput(source.resultado, id, context, unresolved),
    unresolved: [],
  }
  if (skillMatch) recipe.skill = { id: valueOf(context.decisions.skills, skillMatch[1] ?? '', 'skill'), level: Number(skillMatch[2]) }
  recipe.unresolved = [...unresolved].sort()
  return recipe
}

const formatInput = (input: RecipeInput): string => {
  if (input.liters !== undefined) return `${toText(input.liters)} L de ${input.label}`
  if (input.meters !== undefined) return `${toText(input.meters)} m de ${input.label}`
  return input.qty === undefined ? input.label : `${toText(input.qty)} ${input.label}`
}

const formatTime = ({ seconds, timeSuffix }: Pick<Recipe, 'seconds' | 'timeSuffix'>): string => {
  const [unit, size] = seconds % 86400 === 0 ? (['dia', 86400] as const) : seconds % 60 === 0 ? (['min', 60] as const) : (['s', 1] as const)
  const count = seconds / size
  const word = unit === 'dia' && count !== 1 ? 'dias' : unit
  return timeSuffix === undefined ? `${count} ${word}` : `${count} ${word} ${timeSuffix}`
}

const formatOutput = (output: RecipeOutput): string => {
  if ('effect' in output) return output.text
  const [low, high] = output.qty
  return `${low === high ? low : `${low} a ${high}`} ${output.label}${output.note ?? ''}.`
}

/** The inverse of `parseRecipe`, in the team's pt-BR wording: the round trip test compares it with the source row. */
export const formatRecipe = (recipe: Recipe, decisions: Decisions): Omit<IteRecipe, 'nome'> => {
  const skillName = recipe.skill ? Object.entries(decisions.skills).find(([, decision]) => decision.value === recipe.skill?.id)?.[0] : undefined
  return {
    entrada: recipe.inputs.map(formatInput).join(' + '),
    ferramenta: recipe.tools.length === 0 ? '—' : recipe.tools.map((tool) => tool.label).join(' e '),
    habilidade: recipe.skill ? `${skillName ?? ''} ${recipe.skill.level}` : '—',
    tempo: formatTime(recipe),
    resultado: formatOutput(recipe.output),
  }
}
