const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

const decodeEntities = (text: string): string => text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)

const cellText = (cellHtml: string): string =>
  decodeEntities(cellHtml.replace(/<span class="tag">.*?<\/span>/g, '').replace(/<br\s*\/?>/g, ' / ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()

/** Rows of the first table after the section heading `NN Title`; each row is its cell texts (a heading row has one cell). */
export const sectionRows = (html: string, code: string): string[][] => {
  const heading = new RegExp(`<h2><span class="code">${code}</span>[^<]*</h2>`).exec(html)
  if (!heading) throw new Error(`weapons-catalog: Arsenal section ${code} not found`)
  const tableStart = html.indexOf('<table', heading.index)
  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableStart < 0 || tableEnd < 0) throw new Error(`weapons-catalog: Arsenal section ${code} has no table`)
  const body = html.slice(tableStart, tableEnd)
  const rows = body.split('<tr').slice(1)
  return rows.map((row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => cellText(cell[1] ?? '')))
}

/** pt-BR number: `1.200` is twelve hundred, `0,7` is seven tenths; a leading `~` is ignored. */
export const parseNumber = (text: string): number => {
  const clean = text.replace(/[~\s]/g, '')
  const value = /^\d{1,3}(\.\d{3})+$/.test(clean) ? clean.replace(/\./g, '') : clean.replace(',', '.')
  const parsed = Number(value)
  if (Number.isNaN(parsed)) throw new Error(`weapons-catalog: not a number: "${text}"`)
  return parsed
}

const NUMBER_PATTERN = '~?\\d+(?:\\.\\d{3})*(?:,\\d+)?'

/** The first number written before `unit` (`mm`, `kg`, `m/s`, `m`, `s`), or undefined. */
export const numberBefore = (text: string, unit: string): number | undefined => {
  const match = new RegExp(`(${NUMBER_PATTERN})\\s*${unit}(?![a-zA-Z/])`).exec(text)
  return match?.[1] === undefined ? undefined : parseNumber(match[1])
}
