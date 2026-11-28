// Copyright (c) 2026 Ada Technology. PolyForm Noncommercial 1.0.0.
/** The keys that open and close the legend: F1, and `?`. */
const TOGGLE_CODES = new Set(['F1'])
const TOGGLE_CHARACTERS = new Set(['?'])
const ENTRY_SEPARATOR = ' · '
const KEY_SEPARATOR = ': '

export type KeyLegendEntry = { readonly keys: string; readonly action: string }

export type KeyLegend = {
  /** The panel with every key and what it does. */
  readonly element: HTMLElement
  /** The small badge in the corner that says how to open it. */
  readonly badge: HTMLElement
  readonly isOpen: () => boolean
  /** The help line of the room ("Key: action · Key: action"), drawn as one row per key. */
  setText(text: string): void
  toggle(open?: boolean): void
  dispose(): void
}

export const KEY_LEGEND_CSS = `
.tr-keys{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(860px,92vw);max-height:80vh;overflow:auto;background:rgba(14,16,22,.94);border:1px solid #3a404c;border-radius:10px;padding:12px 16px;z-index:30;pointer-events:auto;display:none}
.tr-keys.open{display:block}
.tr-keys h3{margin:0 0 8px;font-size:13px}
.tr-keys ul{list-style:none;margin:0;padding:0;columns:2 300px;column-gap:24px}
.tr-keys li{break-inside:avoid;display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:12px;line-height:1.35}
.tr-keys li kbd{flex:0 0 auto;min-width:64px;text-align:center;background:#2a2e36;border:1px solid #4a505c;border-radius:4px;padding:1px 6px;font:inherit;font-weight:700}
.tr-keys-badge{position:absolute;left:8px;bottom:8px;z-index:5;pointer-events:auto;cursor:pointer;font:inherit;font-size:11px;background:rgba(10,12,16,.7);border:1px solid #3a404c;border-radius:6px;padding:3px 8px;color:inherit}
@media (max-width:980px){.tr-keys-badge{display:none}}
`

/** Splits the room's help line into one entry per key: "WASD: walk · Shift: run" -> [{ keys: 'WASD', action: 'walk' }, ...]. */
export function keyLegendEntries(text: string): KeyLegendEntry[] {
  return text
    .split(ENTRY_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const at = part.indexOf(KEY_SEPARATOR)
      return at < 0 ? { keys: '', action: part } : { keys: part.slice(0, at), action: part.slice(at + KEY_SEPARATOR.length) }
    })
}

const isTyping = (target: EventTarget | null): boolean => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement

function rowOf(entry: KeyLegendEntry): HTMLElement {
  const row = document.createElement('li')
  const keys = document.createElement('kbd')
  keys.textContent = entry.keys
  row.append(keys, document.createTextNode(entry.action))
  return row
}

export function createKeyLegend({ t }: { readonly t: (key: string) => string }): KeyLegend {
  const element = document.createElement('div')
  element.className = 'tr-keys open'
  element.setAttribute('role', 'dialog')
  element.setAttribute('aria-label', t('ui.keys.title'))
  const title = document.createElement('h3')
  title.textContent = t('ui.keys.title')
  const list = document.createElement('ul')
  element.append(title, list)
  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'tr-keys-badge'
  badge.textContent = t('ui.keys.badge')
  let shownText = ''

  const toggle = (open?: boolean): void => {
    element.classList.toggle('open', open ?? !element.classList.contains('open'))
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || isTyping(event.target)) return
    if (!TOGGLE_CODES.has(event.code) && !TOGGLE_CHARACTERS.has(event.key)) return
    event.preventDefault()
    toggle()
  }
  // looking around (the pointer locked) is playing: the legend gets out of the way
  const onPointerLock = (): void => {
    if (document.pointerLockElement) toggle(false)
  }
  badge.onclick = () => toggle()
  element.onclick = () => toggle(false)
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerlockchange', onPointerLock)

  return {
    element,
    badge,
    isOpen: () => element.classList.contains('open'),
    setText(text) {
      if (text === shownText) return
      shownText = text
      list.replaceChildren(...keyLegendEntries(text).map(rowOf))
    },
    toggle,
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerlockchange', onPointerLock)
      element.remove()
      badge.remove()
    },
  }
}
