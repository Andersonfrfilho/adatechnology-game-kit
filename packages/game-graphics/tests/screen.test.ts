// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createGraphicsController } from '../src'
import { createFpsOverlay, createGraphicsScreen } from '../src/screen'

const make = () => {
  const data = new Map<string, string>()
  const controller = createGraphicsController({ store: { storage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) } }, benchmark: false, apply: () => {} })
  const container = document.createElement('div')
  document.body.appendChild(container)
  return { controller, container }
}

describe('graphics screen', () => {
  it('shows the presets in Portuguese and switches preset on a click', () => {
    const { controller, container } = make()
    const screen = createGraphicsScreen({ container, controller, locale: 'pt-BR' })
    screen.open()
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('[data-preset]')]
    expect(buttons.map((b) => b.textContent)).toEqual(['Automático', 'Baixa', 'Média', 'Alta', 'Ultra'])
    expect(buttons[0]!.classList.contains('on')).toBe(true)
    buttons[3]!.click()
    expect(controller.settings.preset).toBe('high')
    expect(container.querySelector<HTMLSelectElement>('[data-option="shadows"]')!.value).toBe('all')
    screen.dispose()
  })

  it('fixing an option by hand keeps the others automatic and says what auto draws now', () => {
    const { controller, container } = make()
    const screen = createGraphicsScreen({ container, controller, locale: 'pt-BR' })
    screen.open()
    const shadows = container.querySelector<HTMLSelectElement>('[data-option="shadows"]')!
    shadows.value = 'off'
    shadows.dispatchEvent(new Event('change'))
    expect(controller.settings).toMatchObject({ preset: 'custom', shadows: 'off', resolutionScale: 'auto' })
    expect(container.textContent).toContain('Personalizada')
    expect(container.textContent).toContain('agora 100%')
    screen.close()
    expect(screen.isOpen).toBe(false)
    screen.dispose()
  })

  it('the counter shows only when Mostrar FPS is on', () => {
    const { controller, container } = make()
    const overlay = createFpsOverlay({ container, controller, locale: 'pt-BR' })
    expect(overlay.element.classList.contains('on')).toBe(false)
    controller.set({ ...controller.settings, showFps: true })
    expect(overlay.element.classList.contains('on')).toBe(true)
    expect(overlay.element.textContent).toMatch(/FPS/)
    overlay.dispose()
  })
})
