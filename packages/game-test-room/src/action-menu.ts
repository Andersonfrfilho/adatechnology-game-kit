/**
 * The action menu (U by default): everything that can be done with the piece aimed at, each with its own key; a number or a click does it, Esc or U closes.
 */
import type { ItemSeat } from '@adatechnology/game-contracts'
import type { RoomText } from './inventory-types'

/** What the room found out about the aimed piece. */
export type ActionTarget = {
  readonly seats: readonly ItemSeat[]
  readonly canGrab: boolean
  readonly canPush: boolean
  readonly canOpen: boolean
  readonly canStore: boolean
  /** The weapon the piece equips, when it is one. */
  readonly weaponId?: string
}

export type ActionRunners = {
  sit(pose: ItemSeat['pose']): void
  grab(): void
  push(): void
  open(): void
  store(): void
  equip(weaponId: string): void
}

export type ActionKeys = { readonly sit: string; readonly grab: string; readonly store: string; readonly equip: string }

export type ActionEntry = { readonly id: string; readonly label: string; readonly keyLabel: string; run(): void }

const keyName = (code: string): string => code.replace(/^Key/, '')

/** The actions the piece allows, in the order the menu lists them. */
export function listActions(target: ActionTarget, run: ActionRunners, keys: ActionKeys, t: RoomText): ActionEntry[] {
  const entries: ActionEntry[] = []
  const add = (id: string, keyLabel: string, action: () => void): void => {
    entries.push({ id, label: t(`act.menu.${id}`), keyLabel, run: action })
  }
  const hold = (key: string): string => t('act.menu.hold', { key })
  if (target.seats.some((seat) => seat.pose === 'sit')) add('sit', keyName(keys.sit), () => run.sit('sit'))
  if (target.seats.some((seat) => seat.pose === 'lie')) add('lie', hold(keyName(keys.sit)), () => run.sit('lie'))
  if (target.canOpen) add('open', 'E', run.open)
  if (target.canGrab) add('grab', 'E', run.grab)
  if (target.canPush) add('push', hold('E'), run.push)
  if (target.canStore) add('store', keyName(keys.store), run.store)
  if (target.weaponId) {
    const weaponId = target.weaponId
    add('equip', keyName(keys.equip), () => run.equip(weaponId))
  }
  return entries
}

export type ActionMenuOptions = {
  readonly container: HTMLElement
  readonly t: RoomText
  readonly keys: readonly string[]
  /** The aimed piece's name and actions, read each time the menu opens; null when nothing is aimed at. */
  readonly entries: () => { readonly title: string; readonly entries: readonly ActionEntry[] } | null
  readonly onOpen?: (open: boolean) => void
  /** Called when there is nothing to list. */
  readonly onNothing?: () => void
}

export type ActionMenu = {
  readonly element: HTMLElement
  readonly open: boolean
  toggle(open?: boolean): boolean
  /** A key down while the menu may be open; true when the menu took it. */
  handleKey(code: string, modifiers: { readonly repeat: boolean; readonly ctrl: boolean }): boolean
}

const CSS = `
.tr-actions{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:240px;display:none;flex-direction:column;gap:4px;z-index:30;pointer-events:auto;background:rgba(12,14,19,.88);border:1px solid #2c313b;border-radius:8px;padding:8px;color:#e8eaee;font:13px/1.4 system-ui,sans-serif}
.tr-actions.open{display:flex}
.tr-actions h3{margin:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9aa3b2}
.tr-actions button{display:flex;gap:8px;align-items:center;text-align:left;background:#232831;border:1px solid #3a404c;color:inherit;border-radius:5px;padding:4px 8px;cursor:pointer;font:inherit}
.tr-actions button span{flex:1}.tr-actions kbd{color:#ffd23f;font:inherit;font-weight:700}
`

export function createActionMenu(o: ActionMenuOptions): ActionMenu {
  const element = document.createElement('div')
  element.className = 'tr-panel tr-actions'
  element.dataset.actionMenu = ''
  const style = document.createElement('style')
  style.textContent = CSS
  element.appendChild(style)
  o.container.appendChild(element)
  let isOpen = false
  let current: readonly ActionEntry[] = []

  const toggle = (open: boolean = !isOpen): boolean => {
    if (open === isOpen) return isOpen
    if (open) {
      const found = o.entries()
      if (!found || found.entries.length === 0) {
        o.onNothing?.()
        return false
      }
      current = found.entries
      const title = document.createElement('h3')
      title.textContent = found.title
      const buttons = current.map((entry, index) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.action = entry.id
        const label = document.createElement('span')
        label.textContent = `${index + 1}. ${entry.label}`
        const key = document.createElement('kbd')
        key.textContent = entry.keyLabel
        button.append(label, key)
        button.onclick = () => choose(index)
        return button
      })
      element.replaceChildren(style, title, ...buttons)
    }
    isOpen = open
    element.classList.toggle('open', open)
    o.onOpen?.(open)
    return isOpen
  }
  const choose = (index: number): void => {
    const entry = current[index]
    if (!entry) return
    toggle(false)
    entry.run()
  }

  return {
    element,
    get open() {
      return isOpen
    },
    toggle,
    handleKey(code, { repeat, ctrl }) {
      if (ctrl) return false
      if (o.keys.includes(code)) {
        if (!repeat) toggle()
        return true
      }
      if (!isOpen) return false
      if (code === 'Escape') toggle(false)
      const digit = /^Digit([1-9])$/.exec(code)
      if (digit) choose(Number(digit[1]) - 1)
      return true
    },
  }
}
