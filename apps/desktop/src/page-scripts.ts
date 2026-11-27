/** Scripts the main process runs in the room's page (main world): source text, since `executeJavaScript` takes a string. */

/** `room.modules()` once the room exists, else null. */
export const MODULES_SCRIPT = `(() => {
  const room = window.__testRoom
  if (!room || typeof room.modules !== 'function') return null
  return room.modules().map((m) => ({ id: m.id, name: m.name, group: m.group, hasArea: m.hasArea }))
})()`

/**
 * A small badge in the corner: crossOriginIsolated and the Jolt the page booted (build, job threads, contact callbacks), refreshed until the engine reports.
 * It is the app's, not the room's: the site shows nothing new.
 */
export const BADGE_SCRIPT = `(() => {
  if (document.getElementById('kit-desktop-badge')) return
  const badge = document.createElement('div')
  badge.id = 'kit-desktop-badge'
  badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px 10px;border-radius:6px;background:rgba(10,14,20,.82);color:#e8edf3;font:12px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre'
  const text = () => {
    const info = window.__joltInfo
    const jolt = info
      ? 'Jolt: ' + info.build + ', ' + info.workerThreads + ' worker thread(s), contatos ' + info.contactCallbacks + (info.fallback ? ' (fallback: ' + info.fallback + ')' : '')
      : 'Jolt: carregando…'
    return 'App desktop · crossOriginIsolated: ' + String(self.crossOriginIsolated === true) + ' · núcleos: ' + navigator.hardwareConcurrency + '\\n' + jolt
  }
  badge.textContent = text()
  document.body.appendChild(badge)
  let tries = 0
  const timer = setInterval(() => {
    badge.textContent = text()
    if (window.__joltInfo || ++tries > 600) clearInterval(timer)
  }, 1000)
})()`
