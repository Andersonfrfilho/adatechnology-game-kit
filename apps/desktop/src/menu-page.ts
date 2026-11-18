/** The app's start screen: every area of the test room and every built example page, from the same lists the window menu uses. */
import { ROOM_PAGE, pathOf, physicsQuery } from './areas'
import type { DesktopManifest, LaunchOptions, RoomArea } from './areas'

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)

export type MenuPageInput = {
  readonly manifest: DesktopManifest
  /** The room's areas, or undefined while the app still reads them from the room (first start). */
  readonly roomAreas: readonly RoomArea[] | undefined
  readonly options: LaunchOptions
  readonly isIsolated: boolean
}

const card = (href: string, title: string, detail: string): string =>
  `<a class="card" href="${escapeHtml(href)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></a>`

export const renderMenuPage = ({ manifest, roomAreas, options, isIsolated }: MenuPageInput): string => {
  const query = physicsQuery(options)
  const roomCards = roomAreas === undefined
    ? '<p class="note">Lendo as áreas da sala… (a primeira abertura monta a sala uma vez; esta tela se atualiza sozinha)</p>'
    : roomAreas.map((area) => card(pathOf({ kind: 'room', area: area.id }, options), area.name, area.group ? `${area.group} · ?area=${area.id}` : `?area=${area.id}`)).join('')
  const built = manifest.examples.filter((entry) => entry.page !== null)
  const missing = manifest.examples.filter((entry) => entry.page === null)
  const exampleCards = built.map((entry) => card(pathOf({ kind: 'example', entry }, options), entry.id, entry.description)).join('')
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>AdA Game Kit — salas de teste</title>
<style>
  :root { color-scheme: dark; --bg: #11151b; --card: #1b222c; --line: #2c3644; --text: #e8edf3; --muted: #94a3b8; --accent: #f5b041 }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.45 system-ui, sans-serif }
  main { max-width: 1180px; margin: 0 auto; padding: 28px 24px 48px }
  h1 { margin: 0 0 4px; font-size: 26px } h2 { margin: 28px 0 10px; font-size: 18px; color: var(--accent) }
  .status { color: var(--muted); margin: 0 0 8px } .status b { color: var(--text) }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px }
  .card { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; color: var(--text); text-decoration: none }
  .card:hover, .card:focus { border-color: var(--accent); outline: none }
  .card span { color: var(--muted); font-size: 13px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical }
  .note { color: var(--muted) }
</style></head>
<body><main>
<h1>Salas de teste do AdA Game Kit</h1>
<p class="status">crossOriginIsolated: <b id="coi">…</b> · física da sala: <b>${escapeHtml(query || 'padrão da sala')}</b> · isolamento do servidor: <b>${isIsolated ? 'COOP same-origin + COEP require-corp' : 'desligado'}</b></p>
<p class="status">Abrir direto numa sala: <code>--area=&lt;id&gt;</code> (ou <code>KIT_DESKTOP_AREA</code>). O menu <b>Salas</b> da janela troca de sala a qualquer momento.</p>
<h2>Sala de teste</h2>
<div class="grid">${card(`/${ROOM_PAGE}${query ? `?${query}` : ''}`, 'Sala de teste (inteira)', 'Todos os módulos carregados; escolha a área pelo menu da sala.')}</div>
<h2>Áreas da sala (?area=)</h2>
<div class="grid">${roomCards}</div>
<h2>Páginas de área (examples)</h2>
<div class="grid">${exampleCards || '<p class="note">Nenhuma página de área foi construída (node examples/&lt;pasta&gt;/build.mjs).</p>'}</div>
${missing.length ? `<p class="note">Ainda não construídas: ${missing.map((entry) => escapeHtml(entry.id)).join(', ')}.</p>` : ''}
</main>
<script>document.getElementById('coi').textContent = String(self.crossOriginIsolated === true)</script>
</body></html>`
}
