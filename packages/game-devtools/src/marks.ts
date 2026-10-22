import type { DevtoolsStrings } from './locale'
import type { Mark, Team } from './types'

/** Escapes text for use inside HTML. */
export const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c as '&' | '<' | '>' | '"']!)

/** Compass heading and degrees for a yaw (yaw 0 looks toward -z, i.e. north). */
export function compass(yaw: number, headings: DevtoolsStrings['compass']): [string, number] {
  const g = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360
  return [headings[Math.round(g / 45) % 8], Math.round(g)]
}

type LineMark = Pick<Mark, 'team' | 'area' | 'x' | 'y' | 'z' | 'heading' | 'degrees' | 'time'> & { text?: string }

/** One-line text for a mark: `[Team] Area · x 1 y 2 z 3 · looking N 0° · 12:00 · note`. */
export function formatMarkLine(m: LineMark, teams: Team[], strings: Pick<DevtoolsStrings, 'lookingAt'>): string {
  const team = (teams.find((e) => e[0] === m.team) || [0, m.team])[1]
  return `[${team}] ${m.area} · x ${m.x} y ${m.y} z ${m.z} · ${strings.lookingAt} ${m.heading} ${m.degrees}° · ${m.time}${m.text ? ' · ' + m.text : ''}`
}

/** Newest first, without mutating the input. */
export const sortMarks = (marks: Mark[]): Mark[] => [...marks].sort((a, b) => b.at - a.at)

/**
 * Serialises marks for copy and download.
 * `text` is one line per mark (newest first); `file` is that text, a blank line, and the raw JSON array
 * (the content of the downloaded file, which Claude or a script can parse back).
 */
export function serializeMarks(marks: Mark[], teams: Team[], strings: Pick<DevtoolsStrings, 'lookingAt'>): { text: string; file: string } {
  const text = sortMarks(marks)
    .map((m) => formatMarkLine(m, teams, strings))
    .join('\n')
  return { text, file: text + '\n\n' + JSON.stringify(marks) }
}
