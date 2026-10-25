import { teamModelIds } from './build-models'
import { finalIdOf } from './item-ids'
import type { IteItem } from './extract-ite'
import type { Sources } from './sources'

const decimals = (value: number, places: number): string => {
  const fixed = value.toFixed(places)
  const text = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
  return text.replace('.', ',')
}

/** Weight as the page writes it (`1,0 kg`, `0,45 kg`): at least one decimal, at most two. */
const weightText = (kg: number): string => {
  const text = decimals(kg, 2)
  return `${text.includes(',') ? text : `${text},0`} kg`
}

/** Size in metres as `largura x altura x profundidade`, in millimetres below a metre ("66 x 183 x 66 mm") and in metres from there. */
const sizeText = (size: readonly [number, number, number] | undefined): string => {
  if (!size) return 'do jogo'
  const longest = Math.max(...size)
  if (longest >= 1) return `${size.map((side) => decimals(side, 2)).join(' x ')} m`
  return `${size.map((side) => decimals(side * 1000, 0)).join(' x ')} mm`
}

const byName = (a: IteItem, b: IteItem): number => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0)

/**
 * `itens-modelos-3d.md`: the checklist of which items of the team have a 3D model (the 24 of `MODELS`), with the real size the SDK uses for each ("tamanho real")
 * so that the team can deliver the missing models at the right scale. Generated; edit `decisions.json`, not the file.
 */
export const buildChecklist = (sources: Sources): string => {
  const { ite } = sources
  const modeled = new Set([...teamModelIds(), ...Object.values(sources.decisions.kitModels).map(({ value }) => value.teamId)])
  const total = ite.itens.length
  const done = ite.itens.filter((item) => modeled.has(item.id)).length
  const categories = Object.entries(ite.categorias)
  const rows = (items: readonly IteItem[]): string[] =>
    [...items.filter((item) => modeled.has(item.id)).sort(byName), ...items.filter((item) => !modeled.has(item.id)).sort(byName)].map((item) => {
      const id = finalIdOf(item, sources).id
      const size = sources.decisions.dimensions[id]?.value
      return `| [${modeled.has(item.id) ? 'x' : ' '}] | ${item.n} | \`${item.id}\` | \`${id}\` | ${weightText(item.kg)} | ${ite.raridades[item.rar]?.nome ?? item.rar} | ${sizeText(size)} |`
    })

  const lines: string[] = [
    '# Checklist de modelos 3D dos itens',
    '',
    `Fonte: Itens do Vale Cinzento (\`sources/armas-itens__itens-vale-cinzento.js\`, catálogo \`versao\` ${ite.versao}, lista \`MODELS\`; artefato https://claude.ai/artifact/NKmkGZ2Lvcd96mp6Nyksds).`,
    `Gerado por \`tools/items-catalog\` (\`pnpm --filter @adatechnology/items-catalog-tool catalog\`). **${done} de ${total} itens têm modelo 3D; faltam ${total - done}.**`,
    '',
    'Pedido ao time de itens: entregar o modelo de cada item marcado `[ ]`, no estilo low poly dos que já existem e **no tamanho real**. A vitrine atual normaliza todos para 1,55 de altura;',
    'o SDK não: desenha cada item na medida da coluna **tamanho real** (largura x altura x profundidade, no quadro do item). Para os 24 modelados a medida é a caixa do modelo do time vezes uma escala tirada',
    'de uma medida real do objeto; para os demais é uma referência (REF) de um objeto comum, que o time pode corrigir ao entregar o modelo. Até o modelo chegar, o SDK usa a forma simples nessa medida.',
    '',
    '| Categoria | Têm | Faltam |',
    '|---|---|---|',
  ]
  for (const [code, name] of categories) {
    const items = ite.itens.filter((item) => item.cat === code)
    const have = items.filter((item) => modeled.has(item.id)).length
    lines.push(`| ${name} | ${have} | ${items.length - have} |`)
  }
  lines.push(`| **Total** | **${done}** | **${total - done}** |`)
  for (const [code, name] of categories) {
    const items = ite.itens.filter((item) => item.cat === code)
    const have = items.filter((item) => modeled.has(item.id)).length
    lines.push('', `## ${name} (${have} de ${items.length})`, '', '| | Item | id do time | id no SDK | Peso | Raridade | Tamanho real |', '|---|---|---|---|---|---|---|', ...rows(items))
  }
  return `${lines.join('\n')}\n`
}
