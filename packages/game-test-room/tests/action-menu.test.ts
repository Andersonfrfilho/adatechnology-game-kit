import { describe, expect, it, vi } from 'vitest'
import type { AnimationClipSpec, ItemSeat } from '@adatechnology/game-contracts'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'
import type { TestRoomItem } from '../src'

const press = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code }))
}
const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) room.update(1 / 60)
}
const menu = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>('[data-action-menu]')].at(-1)
const listed = (): string[] => [...(menu()?.querySelectorAll<HTMLElement>('button') ?? [])].map((button) => button.dataset.action ?? '')

const SEATS: ItemSeat[] = [{ id: 'seat', pose: 'sit', pos: [0, 0.45, 0], ry: 0, exit: [0, 0, 0.8] }]
const BED: ItemSeat[] = [...SEATS, { id: 'bunk', pose: 'lie', pos: [0, 0.45, 0], ry: 0, exit: [0, 0, 0.8] }]
/** The demo chair, bringing these seats. */
const chairWith = (seats: ItemSeat[]): TestRoomItem[] => demoItems('en').map((item) => (item.id === 'chair' ? { ...item, seats } : item))

const OPEN: AnimationClipSpec = { id: 'open_door', duration: 1, keys: [{ t: 0, parts: { door: { rotation: [0, 0, 0] } } }, { t: 1, parts: { door: { rotation: [0, -1.4, 0] } } }] }
const cabinetItem: TestRoomItem = {
  id: 'cabinet',
  name: 'cabinet',
  group: 'Furniture',
  build: (T) => {
    const root = new T.Group()
    root.add(new T.Mesh(new T.BoxGeometry(0.8, 1.6, 0.5), new T.MeshStandardMaterial()))
    root.children[0]?.position.set(0, 0.8, 0)
    const door = new T.Group()
    door.name = 'door'
    door.position.set(-0.4, 0.8, 0.26)
    const leaf = new T.Mesh(new T.BoxGeometry(0.8, 1.5, 0.02), new T.MeshStandardMaterial())
    leaf.position.set(0.4, 0, 0)
    door.add(leaf)
    root.add(door)
    return root
  },
  spec: {
    name: 'cabinet',
    parts: [
      { id: 'body', material: 'mdf', mass: 30, shape: { kind: 'box', size: [0.8, 1.6, 0.5] }, position: [0, 0.8, 0] },
      { id: 'door', material: 'mdf', mass: 6, shape: { kind: 'box', size: [0.8, 1.5, 0.02] }, position: [-0.4, 0.8, 0.26] },
    ],
    joints: [{ id: 'hinge', a: 'body', b: 'door', kind: 'hinge' }],
  },
  movable: false,
  animations: [OPEN],
}

const roomWith = (catalog: TestRoomItem[] = demoItems('en')) => makeRoom({ catalog, scenery: { table: null, shelf: null } })

describe('the action menu (U)', () => {
  it('lists sit and lie for a seat that has both, with the key of each', () => {
    const room = roomWith(chairWith(BED))
    room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.7, 0], [0, 0.45, -2])
    press('KeyU')
    expect(listed()).toEqual(expect.arrayContaining(['sit', 'lie']))
    const keys = [...(menu()?.querySelectorAll('kbd') ?? [])].map((key) => key.textContent)
    expect(keys.slice(0, 2)).toEqual(['L', 'hold L'])
  })

  it('a chair lists sit, pick up, push and put in the bag, and the number sits', () => {
    const room = roomWith(chairWith(SEATS))
    const so = room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.7, 0], [0, 0.42, -2])
    press('KeyU')
    expect(listed()).toEqual(['sit', 'grab', 'push', 'store'])
    press('Digit1')
    expect(menu()?.classList.contains('open')).toBe(false)
    expect(room.seat).toMatchObject({ objectId: so.objectId, pose: 'sit' })
  })

  it('a door lists open and close, and the number opens it', () => {
    const room = roomWith([...demoItems('en'), cabinetItem])
    const so = room.spawn('cabinet', [0, 0, -4], 0)
    room.look([0.2, 1.7, -2.6], [0.2, 1.1, -3.74])
    press('KeyU')
    expect(listed()).toContain('open')
    expect(listed()).not.toContain('sit')
    press('Digit1')
    run(room, 2)
    expect(room.leafOpening(so.objectId)).toBe(1)
  })

  it('a light piece lists pick up, push and put in the bag, and the number picks it up', () => {
    const room = roomWith()
    room.spawn('coffee_cup', [0, 0, -1.5], 0)
    room.look([0, 1.0, 0], [0, 0.06, -1.5])
    press('KeyU')
    expect(listed()).toEqual(['grab', 'push', 'store'])
    press('Digit1')
    run(room, 2)
    expect(room.log.entries({ type: 'grab' }).length).toBeGreaterThan(0)
  })

  it('a click does the action and Esc or U closes the menu', () => {
    const room = roomWith(chairWith(SEATS))
    room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.7, 0], [0, 0.42, -2])
    press('KeyU')
    expect(menu()?.classList.contains('open')).toBe(true)
    press('Escape')
    expect(menu()?.classList.contains('open')).toBe(false)
    press('KeyU')
    press('KeyU')
    expect(menu()?.classList.contains('open')).toBe(false)
    press('KeyU')
    menu()?.querySelector<HTMLButtonElement>('[data-action="sit"]')?.click()
    expect(room.seat).not.toBeNull()
  })

  it('says so and stays closed when nothing is aimed at', () => {
    const room = roomWith()
    room.look([0, 1.7, 0], [0, 30, 0])
    press('KeyU')
    expect(menu()?.classList.contains('open')).toBe(false)
  })

  it('the key is an option', () => {
    const room = makeRoom({ actionMenu: { keys: ['KeyJ'] }, catalog: chairWith(SEATS), scenery: { table: null, shelf: null } })
    room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.7, 0], [0, 0.42, -2])
    press('KeyU')
    expect(menu()?.classList.contains('open')).toBe(false)
    press('KeyJ')
    expect(menu()?.classList.contains('open')).toBe(true)
  })
})

describe('the seat key (L)', () => {
  const stool = (seats: ItemSeat[] = SEATS) => {
    const room = roomWith(chairWith(seats))
    const so = room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.7, 0], [0, 0.42, -2])
    return { room, so }
  }

  it('a tap sits on the aimed seat and the next tap gets up', () => {
    const { room, so } = stool()
    press('KeyL')
    expect(room.seat).toMatchObject({ objectId: so.objectId, pose: 'sit' })
    run(room, 0.3)
    press('KeyL')
    expect(room.seat).toBeNull()
  })

  it('holding L lies down where the thing has a lie seat, and sits where it has none', () => {
    const clock = vi.spyOn(performance, 'now')
    for (const [seats, pose] of [[BED, 'lie'], [SEATS, 'sit']] as const) {
      const { room } = stool(seats)
      clock.mockReturnValue(1000)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }))
      clock.mockReturnValue(1800)
      room.update(1 / 60)
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyL' }))
      expect(room.seat?.pose).toBe(pose)
      room.stand()
    }
    clock.mockRestore()
  })

  it('does nothing without a seat in the aim', () => {
    const room = roomWith()
    room.look([0, 1.7, 0], [0, 30, 0])
    press('KeyL')
    expect(room.seat).toBeNull()
  })
})
