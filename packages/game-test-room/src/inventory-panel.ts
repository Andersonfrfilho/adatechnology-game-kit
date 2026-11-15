import type { InventoryRow, InventorySnapshot, RoomText } from './inventory-types'

export interface InventoryPanelOptions {
  readonly t: RoomText
  readonly snapshot: () => InventorySnapshot
  readonly onEquip: (slotId: number) => void
  readonly onDrop: (slotId: number) => void
  readonly onStore: () => void
  readonly onOpen: (open: boolean) => void
}

export interface InventoryPanel {
  readonly element: HTMLElement
  toggle(open?: boolean): boolean
  /** Redraws the list when it is open. */
  refresh(): void
  readonly open: boolean
}

const CSS = `
.tr-inv{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:min(460px,92vw);max-height:78vh;display:none;flex-direction:column;z-index:30;pointer-events:auto;background:rgba(12,14,19,.82);border:1px solid #2c313b;border-radius:8px;padding:8px;color:#e8eaee;font:12px/1.4 system-ui,sans-serif;overflow:auto}
.tr-inv.open{display:flex}
.tr-inv header{display:flex;gap:6px;align-items:center}.tr-inv header h3{margin:0;flex:1;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9aa3b2}
.tr-inv-row{display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #232831}
.tr-inv-row .tr-inv-name{flex:1;min-width:0}.tr-inv-row small{display:block;color:#9aa3b2}
.tr-inv-row button{background:#232831;border:1px solid #3a404c;color:#e8eaee;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit}
.tr-inv-totals{margin-top:6px;color:#ffd23f}.tr-inv-keys{color:#9aa3b2;margin-top:4px}
`

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const round = (value: number, digits: number): string => String(Math.round(value * 10 ** digits) / 10 ** digits)

/** The bag list: the hand first, then a row per slot with equip and drop; a click or the keys 1-9 act on it. */
export function createInventoryPanel(o: InventoryPanelOptions): InventoryPanel {
  const element = el('div', 'tr-panel tr-inv')
  element.dataset.inventory = ''
  const style = el('style')
  style.textContent = CSS
  let open = false

  const button = (label: string, action: () => void, kind: string): HTMLButtonElement => {
    const b = el('button', 'tr-btn', label)
    b.type = 'button'
    b.dataset.action = kind
    b.onclick = action
    return b
  }
  const row = (r: InventoryRow, index: number | null, actions: HTMLElement[]): HTMLElement => {
    const line = el('div', 'tr-inv-row')
    line.dataset.slot = String(r.slotId ?? 'hand')
    const name = el('div', 'tr-inv-name')
    name.append(el('b', undefined, `${index === null ? '' : `${index + 1}. `}${r.name}${r.count > 1 ? ` ×${r.count}` : ''}`), el('small', 'tr-inv-condition', r.condition))
    line.append(name, el('span', 'tr-inv-kg', `${round(r.kg, 2)} kg`), el('span', 'tr-inv-litres', `${round(r.litres, 1)} L`), ...actions)
    return line
  }

  const render = (): void => {
    const s = o.snapshot()
    element.textContent = ''
    const close = button('×', () => toggle(false), 'close')
    close.title = o.t('inv.close')
    const header = el('header')
    header.append(el('h3', undefined, o.t('inv.title')), close)
    element.append(style, header)
    if (s.held) element.append(el('h3', undefined, o.t('inv.hand')), row(s.held, null, [button(o.t('inv.store'), o.onStore, 'store')]))
    if (s.rows.length === 0) element.append(el('div', 'tr-empty', o.t('inv.empty')))
    s.rows.forEach((r, index) => {
      const slotId = r.slotId as number
      const actions = [...(r.canEquip ? [button(o.t('inv.equip'), () => o.onEquip(slotId), 'equip')] : []), button(o.t('inv.drop'), () => o.onDrop(slotId), 'drop')]
      element.append(row(r, index, actions))
    })
    element.append(
      el('div', 'tr-inv-totals', o.t('inv.totals', { slots: s.totals.slots, maxSlots: s.limits.slots, kg: round(s.totals.kg, 1), maxKg: round(s.limits.kg, 0), litres: round(s.totals.litres, 1), maxLitres: round(s.limits.litres, 0) })),
      el('div', 'tr-inv-keys', o.t('inv.keys')),
    )
  }

  function toggle(next?: boolean): boolean {
    const want = next ?? !open
    if (want === open) return open
    open = want
    element.classList.toggle('open', open)
    if (open) render()
    o.onOpen(open)
    return open
  }

  return {
    element,
    toggle,
    refresh: () => {
      if (open) render()
    },
    get open() {
      return open
    },
  }
}
