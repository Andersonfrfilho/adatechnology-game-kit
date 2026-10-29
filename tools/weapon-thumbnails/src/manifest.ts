import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MANIFEST_VERSION = 1

/** What the Commons search recorded about a file it kept, from the file's own metadata. */
export interface CommonsSource {
  readonly title: string
  readonly author: string
  readonly license: string
  readonly licenseUrl: string
  readonly page: string
  readonly originalUrl: string
  /** The `Credit` line of the file page, as plain text with its links (e.g. the collection the drawing came from). */
  readonly credit?: string
}

export interface ManifestEntry {
  readonly source: 'generated' | 'commons'
  /** Path of the SVG relative to the manifest. */
  readonly file: string
  readonly author?: string
  readonly license?: string
  readonly licenseUrl?: string
  readonly page?: string
}

export interface Manifest {
  readonly version: typeof MANIFEST_VERSION
  readonly assets: Readonly<Record<string, ManifestEntry>>
}

const ids = (directory: string): string[] =>
  existsSync(directory) ? readdirSync(directory).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort() : []

/** The manifest of a `weapon-svg` folder: every generated id, with the Commons file instead when one was kept (its licence is recorded in `commons-sources.json`). */
export function buildManifest(folder: string): Manifest {
  const sourcesPath = join(folder, 'commons-sources.json')
  const sources: Record<string, CommonsSource> = existsSync(sourcesPath) ? (JSON.parse(readFileSync(sourcesPath, 'utf8')) as Record<string, CommonsSource>) : {}
  const commons = new Set(ids(join(folder, 'commons')).filter((id) => id in sources))
  const assets: Record<string, ManifestEntry> = {}
  for (const id of ids(join(folder, 'generated'))) {
    const source = sources[id]
    assets[id] = commons.has(id) && source
      ? { source: 'commons', file: `commons/${id}.svg`, author: source.author, license: source.license, licenseUrl: source.licenseUrl, page: source.page }
      : { source: 'generated', file: `generated/${id}.svg` }
  }
  return { version: MANIFEST_VERSION, assets }
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

export const MODIFICATION = 'Contorno redesenhado no estilo do kit: só o contorno do desenho foi traçado, sem o markup original.'

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const authorOf = (entry: ManifestEntry, source: CommonsSource | undefined): string => (source?.credit ? `${entry.author ?? ''} (${source.credit})` : (entry.author ?? ''))

export function creditsOf(manifest: Manifest, sources: Readonly<Record<string, CommonsSource>>): string {
  const all = Object.entries(manifest.assets)
  const fromCommons = all.filter(([, entry]) => entry.source === 'commons')
  const lines = [
    '# Créditos das miniaturas das armas',
    '',
    `${all.length - fromCommons.length} miniaturas são geradas a partir do modelo 3D do próprio kit (licença MIT do repositório).`,
    `${fromCommons.length} vêm do Wikimedia Commons e mantêm a licença do autor (veja \`LICENSE-NOTE.md\`).`,
    '',
  ]
  if (fromCommons.length === 0) return `${lines.join('\n')}\nNenhuma miniatura do Commons foi adotada até agora.\n`
  lines.push('| Arma | Autor | Licença | Página do arquivo | Arquivo original | Modificações |', '| --- | --- | --- | --- | --- | --- |')
  for (const [id, entry] of fromCommons) {
    const source = sources[id]
    lines.push(`| \`${id}\` | ${cell(authorOf(entry, source))} | [${cell(entry.license ?? '')}](${entry.licenseUrl ?? ''}) | [${cell(source?.title ?? id)}](${entry.page ?? ''}) | ${source?.originalUrl ?? ''} | ${MODIFICATION} |`)
  }
  return `${lines.join('\n')}\n`
}

/** The same credits as a small standalone page, linked from the site and the test room (the Markdown file is not served as a page). */
export function creditsHtmlOf(manifest: Manifest, sources: Readonly<Record<string, CommonsSource>>): string {
  const all = Object.entries(manifest.assets)
  const fromCommons = all.filter(([, entry]) => entry.source === 'commons')
  const rows = fromCommons.map(([id, entry]) => {
    const source = sources[id]
    const link = (url: string | undefined, label: string): string => (url ? `<a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(label)}</a>` : escapeHtml(label))
    return `<tr><td><code>${escapeHtml(id)}</code></td><td>${escapeHtml(authorOf(entry, source))}</td><td>${link(entry.licenseUrl, entry.license ?? '')}</td><td>${link(entry.page, source?.title ?? id)}</td><td>${escapeHtml(MODIFICATION)}</td></tr>`
  })
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Créditos das miniaturas das armas</title>
<style>:root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px 16px}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}th,td{border:1px solid #8886;padding:6px 8px;text-align:left;vertical-align:top}</style>
</head>
<body>
<h1>Créditos das miniaturas das armas</h1>
<p>${all.length - fromCommons.length} miniaturas são geradas a partir do modelo 3D do próprio kit (licença MIT). ${fromCommons.length} vêm do Wikimedia Commons e mantêm a licença do autor: veja <a href="LICENSE-NOTE.md">LICENSE-NOTE.md</a>.</p>
<table>
<thead><tr><th>Arma</th><th>Autor</th><th>Licença</th><th>Página do arquivo</th><th>Modificações</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>
</body>
</html>
`
}

export function writeManifest(folder: string): Manifest {
  const manifest = buildManifest(folder)
  writeFileSync(join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`)
  const sourcesPath = join(folder, 'commons-sources.json')
  const sources = existsSync(sourcesPath) ? (JSON.parse(readFileSync(sourcesPath, 'utf8')) as Record<string, CommonsSource>) : {}
  writeFileSync(join(folder, 'CREDITS.md'), creditsOf(manifest, sources))
  writeFileSync(join(folder, 'credits.html'), creditsHtmlOf(manifest, sources))
  return manifest
}
