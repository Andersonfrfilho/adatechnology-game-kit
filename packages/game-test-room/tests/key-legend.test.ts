// Copyright (c) 2026 Ada Technology. PolyForm Noncommercial 1.0.0.
import { afterEach, describe, expect, it } from 'vitest'

import { createKeyLegend, keyLegendEntries } from '../src/key-legend'
import { resolveStrings } from '../src/locale'

const legends: Array<ReturnType<typeof createKeyLegend>> = []
afterEach(() => {
  for (const legend of legends.splice(0)) legend.dispose()
})

const press = (init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

describe('key legend', () => {
  it('splits the room help into one row per key, in both languages, with U for the aimed piece', () => {
    for (const locale of ['en', 'pt-BR']) {
      const entries = keyLegendEntries(resolveStrings(locale).text['ui.help'] ?? '')
      expect(entries.length).toBeGreaterThan(15)
      expect(entries.every((entry) => entry.keys.length > 0 && entry.action.length > 0)).toBe(true)
      expect(entries.find((entry) => entry.keys === 'U')?.action).toBeTruthy()
      expect(entries.find((entry) => entry.keys === 'E')?.action).toBeTruthy()
    }
  })

  it('opens at the start, toggles on F1 and ?, ignores typing in a field, and closes once the mouse is locked', () => {
    const legend = createKeyLegend({ t: (key) => key })
    legends.push(legend)
    document.body.append(legend.badge, legend.element)
    legend.setText('U: actions · E: grab')
    expect(legend.element.querySelectorAll('li')).toHaveLength(2)
    expect(legend.element.querySelector('kbd')?.textContent).toBe('U')
    expect(legend.isOpen()).toBe(true)
    expect(press({ code: 'F1', key: 'F1' }).defaultPrevented).toBe(true)
    expect(legend.isOpen()).toBe(false)
    press({ code: 'Slash', key: '?' })
    expect(legend.isOpen()).toBe(true)
    const field = document.createElement('input')
    document.body.append(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'F1', key: 'F1', bubbles: true }))
    expect(legend.isOpen()).toBe(true)
    legend.badge.click()
    expect(legend.isOpen()).toBe(false)
    legend.badge.click()
    expect(legend.isOpen()).toBe(true)
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => document.body })
    document.dispatchEvent(new Event('pointerlockchange'))
    expect(legend.isOpen()).toBe(false)
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => null })
    field.remove()
  })
})
