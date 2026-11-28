// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBodyVitals, createPlayer } from '../src'
import { createDeathScreen, createPlayerHud, createPlayerHudView, createVitalsPanel, formatSurvived, playerHudViewOf, writePlayerHudView } from '../src/hud'
import type { DeathScreen, PlayerHud } from '../src/hud'

let hud: PlayerHud | undefined
let screen: DeathScreen | undefined

afterEach(() => {
  hud?.dispose()
  screen?.dispose()
  hud = undefined
  screen = undefined
  document.body.replaceChildren()
})

const box = (): HTMLElement => document.body.appendChild(document.createElement('div'))
const textOf = (selector: string): string => document.querySelector(selector)?.textContent ?? ''
const press = (code: string): void => void window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('player HUD', () => {
  it('shows the health and stamina of a body as bars and numbers', () => {
    const player = createPlayer({ seed: 3 })
    hud = createPlayerHud({ container: box(), title: 'Típico' })
    player.state.health = player.derived.maxHealth / 2
    hud.update(playerHudViewOf(player))
    const rows = [...document.querySelectorAll('.gp-hud-row')]
    expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual(['Vida', 'Fôlego', 'Fome', 'Sede'])
    expect(rows[0]?.querySelector('output')?.textContent).toBe(String(Math.round(player.derived.maxHealth / 2)))
    expect((rows[0]?.querySelector('i') as HTMLElement).style.width).toBe('50%')
    expect(rows[0]?.querySelector('.gp-hud-bar')?.className).toContain('warn')
    expect(rows[1]?.querySelector('output')?.textContent).toBe(String(Math.round(player.derived.maxStamina)))
    expect(textOf('.gp-hud-title')).toBe('Típico')
  })

  it('shows hunger and thirst as bars that turn amber past half and red once they cost health, and drops them for a body without needs', () => {
    const player = createPlayer({ seed: 3 })
    hud = createPlayerHud({ container: box(), locale: 'en' })
    player.state.hunger = 60
    player.state.thirst = 95
    hud.update(playerHudViewOf(player))
    const rows = [...document.querySelectorAll('.gp-hud-row')]
    expect(rows.map((row) => row.querySelector('span')?.textContent)).toEqual(['Health', 'Stamina', 'Hunger', 'Thirst'])
    expect(rows[2]?.querySelector('output')?.textContent).toBe('60')
    expect(rows[2]?.querySelector('.gp-hud-bar')?.className).toContain('warn')
    expect(rows[3]?.querySelector('.gp-hud-bar')?.className).toContain('bad')
    player.state.hunger = 10
    hud.update(playerHudViewOf(player))
    expect(rows[2]?.querySelector('.gp-hud-bar')?.className).toBe('gp-hud-bar need')
    hud.update(playerHudViewOf(createPlayer({ needs: false })))
    expect(document.querySelectorAll('.gp-hud-row')).toHaveLength(2)
  })

  it('lays the vitals box out alone for a host with its own screen', () => {
    const panel = createVitalsPanel('pt-BR')
    const vitals = createBodyVitals()
    panel.update({ alive: true, health: vitals.state.health, maxHealth: vitals.maxHealth, stamina: 0, maxStamina: 0, bleeding: false, wounds: [], infection: 'none', hunger: vitals.state.hunger, thirst: vitals.state.thirst, needMax: 100, needStarving: 90 })
    expect([...panel.element.querySelectorAll('.gp-hud-row span')].map((span) => span.textContent)).toEqual(['Vida', 'Fôlego', 'Fome', 'Sede'])
    expect(panel.element.querySelectorAll('output')[2]?.textContent).toBe('20')
  })

  it('lists the bleeding, the infection stage and the wounds the state has', () => {
    const player = createPlayer({ seed: 3, infection: true })
    hud = createPlayerHud({ container: box() })
    hud.update(playerHudViewOf(player))
    expect(textOf('.gp-hud-status')).toBe('')
    player.bite(1)
    player.state.wounds.push('scratch', 'scratch')
    hud.update(playerHudViewOf(player))
    const status = textOf('.gp-hud-status')
    expect(status).toContain('Sangrando')
    expect(status).toContain('Infectado · mal-estar')
    expect(status).toContain('mordida')
    expect(status).toContain('2× arranhão')
  })

  it('draws the crosshair only in the first person, and the weapon only when the hand holds one', () => {
    hud = createPlayerHud({ container: box(), locale: 'en' })
    const cross = document.querySelector('.gp-hud-cross') as HTMLElement
    const weapon = document.querySelector('.gp-hud-weapon') as HTMLElement
    hud.setView('third')
    expect(cross.style.display).toBe('none')
    hud.setView('first')
    expect(cross.style.display).toBe('block')
    hud.setWeapon(null)
    expect(weapon.style.display).toBe('none')
    hud.setWeapon({ name: 'Pistol', ammo: '12 / 48' })
    expect(weapon.style.display).toBe('block')
    expect(weapon.textContent).toBe('Pistol12 / 48')
  })

  it('refills one view and writes nothing when nothing moved', () => {
    const player = createPlayer({ seed: 3 })
    hud = createPlayerHud({ container: box() })
    const view = createPlayerHudView()
    expect(writePlayerHudView(player, view)).toBe(view)
    hud.update(view)
    const status = document.querySelector('.gp-hud-status') as HTMLElement
    const before = status.firstChild
    player.state.wounds.push('scratch')
    hud.update(writePlayerHudView(player, view))
    expect(status.textContent).toContain('arranhão')
    const tag = status.firstChild
    expect(tag).not.toBe(before)
    hud.update(writePlayerHudView(player, view))
    expect(status.firstChild).toBe(tag)
  })

  it('takes no pointer events, so the view keeps the mouse', () => {
    hud = createPlayerHud({ container: box() })
    expect(document.getElementById('gp-hud-style')?.textContent).toContain('.gp-hud{position:absolute;inset:0;pointer-events:none')
  })
})

describe('death screen', () => {
  const make = (): { onRestart: ReturnType<typeof vi.fn>; onBackToStart: ReturnType<typeof vi.fn> } => {
    const hooks = { onRestart: vi.fn(), onBackToStart: vi.fn() }
    screen = createDeathScreen({ container: box(), ...hooks })
    return hooks
  }
  const panel = (): Element | null => document.querySelector('.gp-death.open')

  it('stays shut while the body lives and until the death camera settles', () => {
    make()
    screen?.update({ alive: true, deathTime: 0, survivedSeconds: 30 })
    expect(panel()).toBeNull()
    screen?.update({ alive: false, deathTime: 0.5, survivedSeconds: 30 })
    expect(panel()).toBeNull()
    expect(screen?.isOpen).toBe(false)
  })

  it('opens with the cause and the time survived once the body is dead long enough', () => {
    make()
    screen?.update({ alive: false, deathTime: 2, cause: 'killed', survivedSeconds: 95.4 })
    expect(panel()).not.toBeNull()
    expect(textOf('.gp-death h2')).toBe('Você morreu')
    expect(textOf('.gp-death-panel')).toContain('Morto pela horda')
    expect(textOf('.gp-death-panel')).toContain('Sobreviveu 1:35')
  })

  it('calls the restart hook from its button, once, and the back hook from the other', () => {
    const hooks = make()
    screen?.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    const [restart, back] = [...document.querySelectorAll<HTMLButtonElement>('.gp-death-actions button')]
    expect(restart?.textContent).toContain('Reiniciar cena')
    expect(back?.textContent).toBe('Voltar ao início')
    restart?.click()
    restart?.click()
    back?.click()
    expect(hooks.onRestart).toHaveBeenCalledTimes(1)
    expect(hooks.onBackToStart).not.toHaveBeenCalled()
    screen?.update({ alive: true, deathTime: 0, survivedSeconds: 0 })
    expect(panel()).toBeNull()
    screen?.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    back?.click()
    expect(hooks.onBackToStart).toHaveBeenCalledTimes(1)
  })

  it('restarts with R only while it is open, a focused button included; Enter is left to the focused button', () => {
    const hooks = make()
    press('KeyR')
    expect(hooks.onRestart).not.toHaveBeenCalled()
    screen?.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    const [restart, back] = [...document.querySelectorAll<HTMLButtonElement>('.gp-death-actions button')]
    expect(document.activeElement).toBe(restart)
    back?.focus()
    back?.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    expect(hooks.onRestart).not.toHaveBeenCalled()
    back?.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
    expect(hooks.onRestart).toHaveBeenCalledTimes(1)
    screen?.update({ alive: true, deathTime: 0, survivedSeconds: 0 })
    screen?.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    press('KeyR')
    expect(hooks.onRestart).toHaveBeenCalledTimes(2)
  })

  it('is a labelled dialog, and gives the focus back when it shuts', () => {
    const canvas = box()
    canvas.tabIndex = -1
    screen = createDeathScreen({ container: box(), onRestart: vi.fn(), onBackToStart: vi.fn(), returnFocus: canvas })
    const dialog = document.querySelector('.gp-death') as HTMLElement
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Você morreu')
    screen.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    const back = document.querySelectorAll<HTMLButtonElement>('.gp-death-actions button')[1]
    back?.focus()
    back?.click()
    screen.update({ alive: true, deathTime: 0, survivedSeconds: 0 })
    expect(document.activeElement).toBe(canvas)
  })

  it('lets the hook be pressed again when it throws', () => {
    let calls = 0
    screen = createDeathScreen({ container: box(), onBackToStart: vi.fn(), onRestart: () => {
      calls++
      if (calls === 1) throw new Error('no')
    } })
    screen.update({ alive: false, deathTime: 2, survivedSeconds: 1 })
    expect(() => press('KeyR')).toThrow('no')
    press('KeyR')
    expect(calls).toBe(2)
  })

  it('puts back the position it gave the container', () => {
    const container = box()
    screen = createDeathScreen({ container, onRestart: vi.fn(), onBackToStart: vi.fn() })
    hud = createPlayerHud({ container })
    expect(container.style.position).toBe('relative')
    hud.dispose()
    screen.dispose()
    hud = undefined
    screen = undefined
    expect(container.style.position).toBe('')
  })

  it('writes the time survived as m:ss or h:mm:ss', () => {
    expect(formatSurvived(0)).toBe('0:00')
    expect(formatSurvived(61.9)).toBe('1:01')
    expect(formatSurvived(3725)).toBe('1:02:05')
  })
})
