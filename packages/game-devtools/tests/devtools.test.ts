import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { create, type Devtools, type DevtoolsOptions } from '../src'

let dev: Devtools | undefined
const messages: string[] = []
const paused: boolean[] = []
let pos = { x: 1.234, y: 2.5, z: -3.3, yaw: 0.5, pitch: -0.2 }

const make = (extra: DevtoolsOptions = {}) =>
  (dev = create(THREE, {
    area: () => 'Plaza',
    time: () => '12:00',
    position: () => pos,
    notify: (t) => messages.push(t),
    pause: (p) => paused.push(p),
    teams: [
      ['map', 'Map'],
      ['art', 'Art'],
    ],
    ...extra,
  }))

const flush = () => new Promise((r) => setTimeout(r, 40))
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T

beforeEach(() => {
  localStorage.clear()
  messages.length = 0
  paused.length = 0
  pos = { x: 1.234, y: 2.5, z: -3.3, yaw: 0.5, pitch: -0.2 }
})
afterEach(() => {
  dev?.dispose()
  dev = undefined
  delete window.claude
})

describe('position HUD', () => {
  it('renders the English HUD', () => {
    const d = make()
    d.update(0.2, new THREE.PerspectiveCamera())
    expect($('#gd-pos').textContent).toBe('Plaza · x 1.2 · y 2.5 · z -3.3 · NW 331° · look 11° · 12:00 · 0 marks')
  })
  it('renders the pt-BR HUD with flight and extras, exactly like the original', () => {
    const d = make({ locale: 'pt-BR' })
    d.flying = true
    d.extras = () => ' · extra'
    d.update(0.2, new THREE.PerspectiveCamera())
    expect($('#gd-pos').textContent).toBe('Plaza · x 1.2 · y 2.5 · z -3.3 · NO 331° · olhar 11° · 12:00 · voo 14 m/s · extra · 0 marcas')
    expect($('#gd-pos').classList.contains('flying')).toBe(true)
  })
  it('can be hidden and refreshes at most ten times per second', () => {
    const d = make()
    const cam = new THREE.PerspectiveCamera()
    d.update(0.2, cam)
    pos = { ...pos, x: 50 }
    d.update(0.01, cam)
    expect($('#gd-pos').textContent).toContain('x 1.2')
    d.update(0.2, cam)
    expect($('#gd-pos').textContent).toContain('x 50')
    d.hud = false
    d.update(0.2, cam)
    expect($('#gd-pos').hidden).toBe(true)
  })
  it('lets individual strings be overridden', () => {
    const d = make({ strings: { hudMarks: (n) => `${n} notes` } })
    d.update(0.2, new THREE.PerspectiveCamera())
    expect($('#gd-pos').textContent).toMatch(/· 0 notes$/)
  })
})

describe('free-fly', () => {
  it('moves along the look direction and clamps to the bounds', () => {
    const d = make({ bounds: { x: [-5, 5], y: [1, 10], z: [-5, 5] }, speed: 10 })
    d.x = d.y = d.z = 0
    d.y = 2
    d.fly(0.1, 0, 0, { forward: 1, strafe: 0, up: 0 }) // yaw 0 faces -z
    expect(d.z).toBeCloseTo(-1, 9)
    expect(d.x).toBeCloseTo(0, 9)
    d.fly(0.1, 0, 0, { forward: 1, strafe: 0, up: 0, fast: true })
    expect(d.z).toBeCloseTo(-5, 9) // 4x speed, then clamped at -5
    d.fly(10, 0, 0, { forward: 0, strafe: 0, up: 1 })
    expect(d.y).toBe(10)
  })
  it('the wheel changes the speed only while flying', () => {
    const d = make({ speed: 10 })
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }))
    expect(d.speed).toBe(10)
    d.flying = true
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }))
    expect(d.speed).toBeCloseTo(12.5, 9)
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }))
    expect(d.speed).toBeCloseTo(10, 9)
  })
  it('places the camera at the fly position', () => {
    const d = make()
    d.x = 3
    d.y = 4
    d.z = 5
    const cam = new THREE.PerspectiveCamera()
    d.flyCamera(cam, 0, 0)
    expect(cam.position.toArray()).toEqual([3, 4, 5])
  })
})

describe('marks (browser storage)', () => {
  it('saves a note from the form, shows it in the panel and persists it as JSON', async () => {
    const d = make()
    d.open('form')
    expect(paused).toEqual([true])
    expect($('#gd-form').hidden).toBe(false)
    expect($('#gd-form').textContent).toContain('Mark this place')
    $<HTMLSelectElement>('#gd-team').value = 'art'
    $<HTMLTextAreaElement>('#gd-note').value = '  fix the <fence>  '
    $<HTMLButtonElement>('[data-f="save"]').click()
    await flush()
    expect(messages).toEqual(['Mark saved in this browser. Open the panel to copy'])
    expect(paused).toEqual([true, false])
    expect(d.marks).toHaveLength(1)
    const saved = JSON.parse(localStorage.getItem('game-devtools-marks')!)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ team: 'art', text: 'fix the <fence>', area: 'Plaza', heading: 'NW', degrees: 331, time: '12:00', x: 1.2, y: 2.5, z: -3.3 })
    expect(saved[0].id).toBe('m' + saved[0].at)

    d.open('list')
    const copy = $<HTMLTextAreaElement>('#gd-copy').value
    expect(copy).toBe('[Art] Plaza · x 1.2 y 2.5 z -3.3 · looking NW 331° · 12:00 · fix the <fence>')
    expect($('#gd-list').innerHTML).not.toContain('<fence>') // escaped
    expect($('#gd-list').textContent).toContain('Marks (1)')
  })

  it('loads existing marks on creation, deletes them and navigates with goTo', () => {
    const existing = [
      { id: 'm1', at: 1, team: 'map', text: 'one', area: 'A', x: 1, y: 2, z: 3, yaw: 0.1, pitch: 0.2, heading: 'N', degrees: 0, look: 0, time: '', flying: false },
      { id: 'm2', at: 2, team: 'map', text: 'two', area: 'A', x: 4, y: 5, z: 6, yaw: 0.3, pitch: 0.4, heading: 'N', degrees: 0, look: 0, time: '', flying: false },
    ]
    localStorage.setItem('game-devtools-marks', JSON.stringify(existing))
    const d = make()
    expect(d.marks).toHaveLength(2)
    const went: number[][] = []
    d.goTo = (...a) => went.push(a)
    d.open('list')
    const goButtons = document.querySelectorAll<HTMLButtonElement>('[data-goto]')
    expect(goButtons[0].dataset.goto).toBe('m2') // newest first
    goButtons[0].click()
    expect(went).toEqual([[4, 5, 6, 0.3, 0.4]])
    expect(d.openPanel).toBeNull()

    d.open('list')
    document.querySelector<HTMLButtonElement>('[data-delete="m2"]')!.click()
    expect(JSON.parse(localStorage.getItem('game-devtools-marks')!).map((m: { id: string }) => m.id)).toEqual(['m1'])
    expect(d.marks.map((m) => m.id)).toEqual(['m1'])
  })

  it('uses a custom storage key', async () => {
    const d = make({ marksStorageKey: 'custom-key' })
    d.open('form')
    $<HTMLButtonElement>('[data-f="save"]').click()
    await flush()
    expect(JSON.parse(localStorage.getItem('custom-key')!)).toHaveLength(1)
    expect(localStorage.getItem('game-devtools-marks')).toBeNull()
  })

  it('survives corrupt stored JSON', () => {
    localStorage.setItem('game-devtools-marks', '{not json')
    expect(make().marks).toEqual([])
  })

  it('saves to the server database when window.claude offers one', async () => {
    const added: Array<Record<string, unknown>> = []
    window.claude = {
      async use(name: string) {
        if (name === 'user') return { id: async () => 'user-7' }
        return {
          collection: (c: string) => ({
            onSnapshot: (ok: (s: unknown) => void) => ok({ docs: [{ id: 'srv1', data: () => ({ team: 'map', text: 'remote', at: 5, area: 'B', x: 0, y: 0, z: 0, heading: 'S', degrees: 180, time: '' }) }] }),
            add: async (m: Record<string, unknown>) => added.push({ c, ...m }),
          }),
        }
      },
    }
    const d = make()
    await flush()
    expect(d.marks.map((m) => m.id)).toEqual(['srv1'])
    d.open('form')
    $<HTMLButtonElement>('[data-f="save"]').click()
    await flush()
    expect(messages).toEqual(['Mark saved. Claude can already read it'])
    expect(added[0]).toMatchObject({ c: 'marks', by: 'user-7', team: 'map' })
    expect(localStorage.getItem('game-devtools-marks')).toBeNull()
  })
})

describe('panel registrations', () => {
  it('toggles, actions, times of day and places', () => {
    let fog = false
    const calls: string[] = []
    const d = make()
    d.toggle('fog', 'Fog', () => fog, (on) => void (fog = on))
      .action('spawn', () => 'Spawn', () => (calls.push('spawn'), true))
      .timesOfDay([['Morning', 0.3], ['Night', 0.9]], (v) => calls.push('time:' + v))
      .places(() => [['City', [['Plaza', () => calls.push('go:plaza')], ['Port', () => calls.push('go:port')]]]])
    d.open('list')
    expect($('#gd-list').textContent).toContain('Fog: no')
    document.querySelector<HTMLButtonElement>('[data-toggle="fog"]')!.click()
    expect(fog).toBe(true)
    expect($('#gd-list').textContent).toContain('Fog: yes') // re-rendered
    document.querySelector<HTMLButtonElement>('[data-action="spawn"]')!.click()
    expect(calls).toEqual(['spawn'])
    expect(d.openPanel).toBe('list') // the action asked to keep the panel open
    document.querySelector<HTMLButtonElement>('[data-time="1"]')!.click()
    expect(calls).toContain('time:0.9')
    document.querySelector<HTMLButtonElement>('[data-place="0:1"]')!.click()
    expect(calls.at(-1)).toBe('go:port')
    expect(d.openPanel).toBeNull()
  })

  it('wires scenarios through the API and exposes browser-test globals', () => {
    const d = make()
    let rain = 0
    d.scenarios(
      [{ id: 'drizzle', mm: 1 }, { id: 'storm', mm: 40 }],
      (s) => (rain = s.mm as number),
      (s) => ({ heavy: { ok: (s.mm as number) > 10, note: String(rain) } }),
    )
    expect(d.scenario('storm')).toBe(true)
    expect(rain).toBe(40)
    expect(d.scenario('nope')).toBe(false)
    expect(d.check('storm').heavy.ok).toBe(true)
    expect(d.check().heavy.note).toBe('40')
    expect(d.activeScenario?.id).toBe('storm')
    d.expose()
    expect(window.__scenarioCheck!('drizzle').heavy.ok).toBe(false)
    expect((window.__scenarioList as unknown[]).length).toBe(2)
    expect(window.__devtools).toBe(d)
  })

  it('Escape closes the list panel and unpauses', () => {
    const d = make()
    d.open('list')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(d.openPanel).toBeNull()
    expect(paused).toEqual([true, false])
  })

  it('opening a panel while another is open is ignored', () => {
    const d = make()
    d.open('list')
    d.open('form')
    expect(d.openPanel).toBe('list')
    expect(paused).toEqual([true])
  })
})

describe('entity labels', () => {
  it('projects points to the screen, skipping those outside the view', () => {
    const d = make({ labelsMax: 3 })
    d.showLabels = true
    d.labelsFor(() => [
      { x: 0, y: 0, z: -5, text: 'ahead', color: '#ff0000' },
      { x: 0, y: 0, z: 5, text: 'behind' },
      { x: 1000, y: 0, z: -5, text: 'far right' },
    ])
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    cam.updateMatrixWorld()
    cam.updateProjectionMatrix()
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert()
    d.update(0.016, cam)
    const nodes = [...document.querySelectorAll<HTMLDivElement>('#gd-labels div')]
    expect(nodes).toHaveLength(3)
    expect(nodes[0].textContent).toBe('ahead')
    expect(nodes[0].style.display).toBe('')
    expect(nodes[0].style.color).toMatch(/#ff0000|rgb\(255, 0, 0\)/) // happy-dom keeps the raw value
    expect(nodes[1].style.display).toBe('none')
    expect(nodes[2].style.display).toBe('none')
  })
})
