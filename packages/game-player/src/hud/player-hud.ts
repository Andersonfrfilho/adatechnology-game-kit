import { ensurePlayerHudStyle, positionContainer } from './hud-style'
import { playerHudTextOf, stageTextOf, woundTextOf } from './hud-text'
import type { PlayerHudText } from './hud-text'
import type { PlayerHudView } from './hud-view'

/** The weapon in the hand: its name and, for a gun, the rounds as the game writes them (`12 / 48`). */
export type PlayerHudWeapon = { readonly name: string; readonly ammo?: string }

export type PlayerHudOptions = {
  /** The box the HUD is laid over (the game's canvas box). */
  readonly container: HTMLElement
  /** `pt-BR` (default) or `en`. */
  readonly locale?: string
  /** A name shown at the top left (the level, the scenario); absent, nothing there. */
  readonly title?: string
}

export type PlayerHud = {
  /** The body's numbers now (call it every frame; it writes the DOM only when a shown value changes). */
  update(view: PlayerHudView): void
  setTitle(title: string | null): void
  /** The weapon in the hand, or null when the hand is empty. */
  setWeapon(weapon: PlayerHudWeapon | null): void
  /** The crosshair is drawn in the first person only (the third person aims with the body). */
  setView(view: 'first' | 'third'): void
  /** A line at the top centre for `seconds` (the body's `message` events, in `playerTextOf` words). */
  message(text: string, seconds: number): void
  dispose(): void
}

const LOW_SHARE = 0.25
const WARN_SHARE = 0.5
const MS_PER_SECOND = 1000

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

type Gauge = { readonly row: HTMLElement; set(value: number, max: number): void }

function createGauge(label: string, tone: 'hp' | 'stamina'): Gauge {
  const row = element('div', 'gp-hud-row')
  const bar = element('div', tone === 'hp' ? 'gp-hud-bar hp' : 'gp-hud-bar')
  const fill = element('i')
  const value = element('output')
  bar.appendChild(fill)
  row.append(element('span', undefined, label), bar, value)
  let lastValue = Number.NaN
  let lastPercent = Number.NaN
  return {
    row,
    set(current, max) {
      const share = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
      const shownValue = Math.max(0, Math.round(current))
      const percent = Math.round(share * 100)
      if (shownValue === lastValue && percent === lastPercent) return
      lastValue = shownValue
      lastPercent = percent
      fill.style.width = `${percent}%`
      value.textContent = String(shownValue)
      if (tone === 'hp') bar.className = share <= LOW_SHARE ? 'gp-hud-bar bad' : share <= WARN_SHARE ? 'gp-hud-bar warn' : 'gp-hud-bar hp'
    },
  }
}

function statusTags(view: PlayerHudView, text: PlayerHudText): Array<{ readonly label: string; readonly tone: 'bad' | 'warn' | '' }> {
  const tags: Array<{ label: string; tone: 'bad' | 'warn' | '' }> = []
  if (view.bleeding) tags.push({ label: text.bleeding, tone: 'bad' })
  if (view.infection !== 'none') tags.push({ label: `${text.infected} · ${stageTextOf(text, view.infection)}`, tone: 'warn' })
  if (view.wounds.length > 0) {
    const counts = new Map<string, number>()
    for (const kind of view.wounds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
    const list = [...counts].map(([kind, count]) => (count > 1 ? `${count}× ${woundTextOf(text, kind)}` : woundTextOf(text, kind))).join(', ')
    tags.push({ label: `${text.wounds}: ${list}`, tone: '' })
  }
  return tags
}

/**
 * The player's HUD over the game's view (DOM, no three.js): the health and stamina bars with the bleeding, the infection and the wounds under them at the bottom left, the
 * weapon and its rounds at the bottom right, a name at the top left, the body's messages at the top centre and the crosshair in the first person. Small boxes at the edges:
 * the view stays clear, and nothing takes the mouse.
 */
export function createPlayerHud({ container, locale = 'pt-BR', title }: PlayerHudOptions): PlayerHud {
  const text = playerHudTextOf(locale)
  ensurePlayerHudStyle()
  const restorePosition = positionContainer(container)
  const root = element('div', 'gp-hud')
  root.dataset.hud = 'player'
  const titleBox = element('div', 'gp-hud-pill gp-hud-title')
  const messageBox = element('div', 'gp-hud-message')
  const vitals = element('div', 'gp-hud-vitals')
  const health = createGauge(text.health, 'hp')
  const stamina = createGauge(text.stamina, 'stamina')
  const status = element('div', 'gp-hud-status')
  vitals.append(health.row, stamina.row, status)
  const weaponBox = element('div', 'gp-hud-pill gp-hud-weapon')
  const cross = element('div', 'gp-hud-cross')
  cross.appendChild(element('i'))
  root.append(titleBox, messageBox, vitals, weaponBox, cross)
  container.appendChild(root)

  // the status line is rebuilt only when one of these scalars moves: the frame allocates nothing
  let lastBleeding: boolean | null = null
  let lastInfection = ''
  let lastWounds: readonly string[] | null = null
  let lastWoundCount = -1
  let lastAlive: boolean | null = null
  let lastView: 'first' | 'third' | null = null
  let messageTimer: ReturnType<typeof setTimeout> | null = null
  const setTitle = (next: string | null): void => {
    titleBox.textContent = next ?? ''
    titleBox.style.display = next ? 'block' : 'none'
  }
  setTitle(title ?? null)

  return {
    update(view) {
      if (view.alive !== lastAlive) {
        lastAlive = view.alive
        vitals.style.display = view.alive ? 'flex' : 'none'
      }
      health.set(view.health, view.maxHealth)
      stamina.set(view.stamina, view.maxStamina)
      if (view.bleeding === lastBleeding && view.infection === lastInfection && view.wounds === lastWounds && view.wounds.length === lastWoundCount) return
      lastBleeding = view.bleeding
      lastInfection = view.infection
      lastWounds = view.wounds
      lastWoundCount = view.wounds.length
      const tags = statusTags(view, text)
      status.replaceChildren(...tags.map((tag) => element('span', tag.tone ? `gp-hud-tag ${tag.tone}` : 'gp-hud-tag', tag.label)))
    },
    setTitle,
    setWeapon(weapon) {
      weaponBox.replaceChildren()
      weaponBox.style.display = weapon ? 'block' : 'none'
      if (!weapon) return
      weaponBox.append(document.createTextNode(weapon.name))
      if (weapon.ammo) weaponBox.append(element('small', undefined, weapon.ammo))
    },
    setView(view) {
      if (view === lastView) return
      lastView = view
      cross.style.display = view === 'first' ? 'block' : 'none'
    },
    message(line, seconds) {
      messageBox.textContent = line
      messageBox.style.display = 'block'
      if (messageTimer) clearTimeout(messageTimer)
      messageTimer = setTimeout(() => {
        messageTimer = null
        messageBox.style.display = 'none'
      }, seconds * MS_PER_SECOND)
    },
    dispose() {
      if (messageTimer) clearTimeout(messageTimer)
      root.remove()
      restorePosition()
    },
  }
}
