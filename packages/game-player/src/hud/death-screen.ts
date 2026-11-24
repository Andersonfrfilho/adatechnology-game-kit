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
const RESTART_KEYS = new Set(['Enter', 'NumpadEnter', 'KeyR'])

/**
 * The death screen (DOM, no three.js): a centred panel with "you died", the cause, the time survived and two buttons, restart the scene (also Enter or R) and back to the start.
 * It opens once the death camera has settled, frees the mouse from the pointer lock so the buttons can be clicked, and calls each hook once until the body lives again.
 */
export function createDeathScreen({ container, locale = 'pt-BR', delaySeconds = DEATH_SCREEN_DELAY_SECONDS, onRestart, onBackToStart }: DeathScreenOptions): DeathScreen {
  const text = playerHudTextOf(locale)
  ensurePlayerHudStyle()
  positionContainer(container)
  const root = document.createElement('div')
  root.className = 'gp-death'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  const panel = document.createElement('div')
  panel.className = 'gp-death-panel'
  const heading = document.createElement('h2')
  heading.textContent = text.died
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
  const choose = (hook: () => void): void => {
    if (!isOpen || isSpent) return
    isSpent = true
    restartButton.disabled = true
    backButton.disabled = true
    hook()
  }
  restartButton.onclick = () => choose(onRestart)
  backButton.onclick = () => choose(onBackToStart)
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen || !RESTART_KEYS.has(event.code)) return
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
    restartButton.focus()
  }
  const close = (): void => {
    isOpen = false
    root.classList.remove('open')
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
    },
  }
}
