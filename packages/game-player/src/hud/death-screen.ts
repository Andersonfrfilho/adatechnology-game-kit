import { playerTextOf } from '../locales'
import { ensurePlayerHudStyle, positionContainer } from './hud-style'
import { formatSurvived, playerHudTextOf } from './hud-text'

export type DeathScreenOptions = {
  readonly container: HTMLElement
  /** `pt-BR` (default) or `en`. */
  readonly locale?: string
  /** Seconds after the death before the panel opens: the death camera settles on the body first. Default 1.5. */
  readonly delaySeconds?: number
  /** Rebuilds the scene from its seed. Enter and R press it too. */
  readonly onRestart: () => void
  /** Puts the body back at the start with the world as it is. */
  readonly onBackToStart: () => void
  /** What takes the focus back when the panel shuts (the game's canvas); absent, what had it before the panel opened. */
  readonly returnFocus?: HTMLElement
}

/** The body as the death screen reads it: `game-player`'s `state.alive`, `state.deathTime` and `state.cause`, and the seconds the game ran before the death. */
export type DeathScreenState = {
  readonly alive: boolean
  /** Seconds since the death. */
  readonly deathTime: number
  /** The cause id (`killed`, `bled_out`...), shown in `playerTextOf` words. */
  readonly cause?: string
  readonly survivedSeconds: number
}

export type DeathScreen = {
  /** Call it every frame: it opens once the body has been dead `delaySeconds`, and closes when the body is alive again. */
  update(state: DeathScreenState): void
  readonly isOpen: boolean
  dispose(): void
}

export const DEATH_SCREEN_DELAY_SECONDS = 1.5
const RESTART_KEY = 'KeyR'
let nextHeadingId = 0

/**
 * The death screen (DOM, no three.js): a panel in the lower third (the death camera keeps the body at the centre) with "you died", the cause, the time survived and two buttons,
 * restart the scene and back to the start. It opens once the death camera has settled, frees the mouse from the pointer lock and focuses the restart button (Enter presses the focused
 * button, R restarts from anywhere), calls each hook once until the body lives again, and gives the focus back when it shuts.
 */
export function createDeathScreen({ container, locale = 'pt-BR', delaySeconds = DEATH_SCREEN_DELAY_SECONDS, onRestart, onBackToStart, returnFocus }: DeathScreenOptions): DeathScreen {
  const text = playerHudTextOf(locale)
  ensurePlayerHudStyle()
  const restorePosition = positionContainer(container)
  const root = document.createElement('div')
  root.className = 'gp-death'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  const panel = document.createElement('div')
  panel.className = 'gp-death-panel'
  const heading = document.createElement('h2')
  heading.id = `gp-death-title-${nextHeadingId++}`
  heading.textContent = text.died
  root.setAttribute('aria-labelledby', heading.id)
  const cause = document.createElement('p')
  const survived = document.createElement('p')
  const actions = document.createElement('div')
  actions.className = 'gp-death-actions'
  const button = (label: string, key: string | null): HTMLButtonElement => {
    const node = document.createElement('button')
    node.type = 'button'
    node.append(document.createTextNode(label))
    if (key) {
      const hint = document.createElement('kbd')
      hint.textContent = key
      node.appendChild(hint)
    }
    actions.appendChild(node)
    return node
  }
  const restartButton = button(text.restart, 'R')
  const backButton = button(text.backToStart, null)
  panel.append(heading, cause, survived, actions)
  root.appendChild(panel)
  container.appendChild(root)

  let isOpen = false
  let isSpent = false
  let focusBefore: Element | null = null
  const setEnabled = (enabled: boolean): void => {
    restartButton.disabled = !enabled
    backButton.disabled = !enabled
  }
  const choose = (hook: () => void): void => {
    if (!isOpen || isSpent) return
    isSpent = true
    setEnabled(false)
    try {
      hook()
    } catch (error) {
      isSpent = false
      setEnabled(true)
      throw error
    }
  }
  restartButton.onclick = () => choose(onRestart)
  backButton.onclick = () => choose(onBackToStart)
  // Enter is left to the focused button (the browser presses it): only R is caught here, and it restarts from anywhere, a focused button included
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen || event.code !== RESTART_KEY) return
    event.preventDefault()
    choose(onRestart)
  }
  window.addEventListener('keydown', onKeyDown)

  const open = (state: DeathScreenState): void => {
    isOpen = true
    isSpent = false
    restartButton.disabled = false
    backButton.disabled = false
    cause.textContent = state.cause ? playerTextOf(state.cause, locale) : ''
    cause.style.display = state.cause ? 'block' : 'none'
    survived.textContent = text.survived.replace('{time}', formatSurvived(state.survivedSeconds))
    root.classList.add('open')
    if (document.pointerLockElement) document.exitPointerLock()
    focusBefore = document.activeElement
    restartButton.focus()
  }
  const close = (): void => {
    isOpen = false
    if (root.contains(document.activeElement) && document.activeElement instanceof HTMLElement) document.activeElement.blur()
    root.classList.remove('open')
    const target = returnFocus ?? (focusBefore instanceof HTMLElement && focusBefore.isConnected && focusBefore !== document.body ? focusBefore : null)
    focusBefore = null
    target?.focus({ preventScroll: true })
  }

  return {
    update(state) {
      if (state.alive) {
        if (isOpen) close()
        return
      }
      if (!isOpen && state.deathTime >= delaySeconds) open(state)
    },
    get isOpen() {
      return isOpen
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      root.remove()
      restorePosition()
    },
  }
}
