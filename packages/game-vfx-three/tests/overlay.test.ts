// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createScreenState } from '@adatechnology/game-vfx'
import { createScreenOverlay } from '../src'

describe('screen overlay', () => {
  it('draws the flash with the Lab blend and the Workshop edges inside the container', () => {
    const container = document.createElement('div')
    const overlay = createScreenOverlay(container)
    const state = createScreenState()
    state.flash = 0.5
    state.red = 1
    state.gas = 1
    overlay.update(state)
    const flash = container.querySelector<HTMLElement>('[data-vfx-overlay="flash"]')!
    expect(flash.style.opacity).toBe('0.500')
    expect(flash.style.mixBlendMode).toBe('screen')
    expect(container.querySelector('[data-vfx-overlay="red"]')).not.toBeNull()
    expect(container.querySelector<HTMLElement>('[data-vfx-overlay="gas"]')!.style.background).toMatch(/90,\s*130,\s*40,\s*0\.55/)
    expect(container.querySelector<HTMLElement>('[data-vfx-overlay="white"]')!.style.background).toMatch(/235,\s*240,\s*255,\s*0/)
    overlay.dispose()
    expect(container.children.length).toBe(0)
  })
})
