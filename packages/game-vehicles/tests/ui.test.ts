import { afterEach, describe, expect, it, vi } from 'vitest'
import { hybridDocument } from './helpers/fake-dom'
import { makeKit } from './helpers/kit'

const kit = makeKit({
  document: hybridDocument(document),
  plugins: [{ configure: { scenarios: [{ id: 'a', name: 'Hit A', zone: () => {} }] } }],
})

afterEach(() => {
  document.body.innerHTML = ''
})

function host(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('ui widgets (happy-dom)', () => {
  it('draws the damage map as an SVG with one selectable node per zone', () => {
    const c = kit.build('proto', 'intact', { health: { hood: 38, windshield: 0 }, flags: {} })
    const el = host()
    const onSelect = vi.fn()
    const svg = kit.ui.damageMap(el, c, { selected: 'hood', onSelect })
    expect(svg).toBeTruthy()
    const nodes = el.querySelectorAll('g.zn')
    expect(nodes.length).toBe(c.zones.length)
    const hood = el.querySelector('g[data-id="hood"]')!
    expect(hood.getAttribute('class')).toContain('sel')
    expect(hood.getAttribute('aria-pressed')).toBe('true')
    expect(hood.getAttribute('aria-label')).toBe('Hood · Dented 38%')
    expect(el.querySelector('g[data-id="windshield"]')!.getAttribute('class')).toContain('gone')
    expect(el.querySelector('text.dm-front')!.textContent).toBe('▲ FRONT')
    expect(svg!.getAttribute('aria-label')).toBe('Damage map seen from above, front up')
    expect(el.querySelector('text.dm-sub')!.textContent).toBe('Inside')
    hood.dispatchEvent(new Event('click'))
    expect(onSelect).toHaveBeenCalledWith('hood')
  })

  it('selects with the keyboard', () => {
    const c = kit.build('proto', 'intact')
    const el = host()
    const onSelect = vi.fn()
    kit.ui.damageMap(el, c, { onSelect })
    const node = el.querySelector('g[data-id="roof"]')!
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('roof')
  })

  it('says so when a vehicle has no zones', () => {
    const el = host()
    expect(kit.ui.damageMap(el, { zones: [] } as never)).toBeNull()
    expect(el.textContent).toBe('This vehicle has no zones.')
  })

  it('renders one button per band and reports the typical health', () => {
    const el = host()
    const onPick = vi.fn()
    const buttons = kit.ui.bandButtons(el, onPick)
    expect(buttons.map((b) => b.textContent)).toEqual(['Intact', 'Scratched', 'Dented', 'Destroyed', 'Torn off'])
    buttons[2].click()
    expect(onPick).toHaveBeenCalledWith(38, 2)
  })

  it('renders the legend with the health ranges', () => {
    const el = host()
    kit.ui.legend(el)
    expect([...el.querySelectorAll('span')].map((s) => s.textContent)).toEqual([
      'Intact 76–100',
      'Scratched 51–75',
      'Dented 26–50',
      'Destroyed 1–25',
      'Torn off',
    ])
    expect(el.querySelectorAll('span.gone')).toHaveLength(1)
  })

  it('fills the health bar', () => {
    const c = kit.build('proto', 'intact', { health: { engine: 0 }, flags: {} })
    const text = host()
    const bar = host()
    const o = kit.ui.healthBar({ text, bar }, c)
    expect(text.textContent).toBe(`Overall health ${o.health}% · ${o.name}`)
    expect(bar.style.width).toBe(o.health + '%')
  })

  it('renders scenario buttons', () => {
    const el = host()
    const onRun = vi.fn()
    const buttons = kit.ui.scenarioButtons(el, onRun)
    expect(buttons[0].textContent).toBe('Hit A')
    buttons[0].click()
    expect(onRun).toHaveBeenCalledWith('a')
  })

  it('injects its stylesheet once', () => {
    kit.ui.injectStyles()
    kit.ui.injectStyles()
    expect(document.querySelectorAll('#vehicles-ui-css')).toHaveLength(1)
    expect(kit.ui.css()).toContain('svg.dmap')
    document.getElementById('vehicles-ui-css')?.remove()
  })

  it('takes its texts from the locale and from overrides', () => {
    const pt = makeKit({ document: hybridDocument(document), locale: 'pt-BR', texts: { ui: { front: 'BICO' } } })
    const el = host()
    pt.ui.damageMap(el, pt.build('proto', 'intact'))
    expect(el.querySelector('text.dm-front')!.textContent).toBe('BICO')
    expect(el.querySelector('text.dm-sub')!.textContent).toBe('Por dentro')
  })

  it('formats the zone label and band ranges', () => {
    const c = kit.build('proto', 'intact', { health: { hood: 13 }, flags: {} })
    expect(kit.ui.zoneLabel(c.zones.find((z) => z.id === 'hood')!)).toBe('Hood · Destroyed 13%')
    expect(kit.ui.bandRange(0)).toBe('76–100')
    expect(kit.ui.bandRange(4)).toBe('')
  })
})
