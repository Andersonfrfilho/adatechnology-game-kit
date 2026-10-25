/** Fills `{name}` holes of a template; a hole with no value stays empty. */
export const fillText = (template: string, values: Readonly<Record<string, string | number>>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The name a text calls a person by (Os Vivos do Vale `short`, line 618): the quoted nickname (“Brasa”) if there is one, else the first name after an
 * honorific (Dona, Seu, Dr.…).
 */
export function shortName(name: string, honorifics: readonly string[]): string {
  const quoted = name.match(/“(.*?)”/)
  if (quoted) return quoted[1]!
  const prefix = honorifics.length > 0 ? new RegExp(`^(${honorifics.map(escape).join('|')}) `) : null
  return (prefix ? name.replace(prefix, '') : name).split(' ')[0]!
}
