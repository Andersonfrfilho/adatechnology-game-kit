import { describe, expect, it } from 'vitest'
import { createTestRoom, demoItems } from '../src'
import * as THREE from 'three'
import { makeRoom, stubRenderer } from './helpers'

const text = (room: ReturnType<typeof makeRoom>) => room.log.toText()

describe('room basics', () => {
  it('spawns, lists, inspects and clears', () => {
    const room = makeRoom()
    const chair = room.spawn('chair', [0, 0, -4], 0)
    expect(chair.itemId).toBe('chair')
    expect(chair.movable).toBe(true)
    expect(room.spawned().map((s) => s.itemId)).toEqual(['chair'])
    room.look([0, 0.6, -2], [0, 0.45, -4])
    expect(room.inspect()).toMatchObject({ objectId: chair.objectId, partId: 'seat', itemId: 'chair' })
    expect(room.inspectInfo()).toMatchObject({ object: 'Wooden chair', part: 'seat', material: 'softwood', status: 'intact' })
    room.clear()
    expect(room.spawned()).toEqual([])
    expect(room.world.has(chair.objectId)).toBe(false)
    expect(room.world.has('target_wall')).toBe(true)
  })

  it('big things are not movable, the host can force it either way', () => {
    const room = makeRoom()
    expect(room.spawn('concrete_block', [0, 0, -4]).movable).toBe(false)
    expect(room.spawn('building_frame', [0, 0, -8]).movable).toBe(false)
    expect(room.spawn('steel_drum', [2, 0, -4]).movable).toBe(true)
  })

  it('refuses an unknown item', () => {
    expect(() => makeRoom().spawn('nope')).toThrow(/unknown item/)
  })

  it('the arena has a destructible target wall, a table and a shelf', () => {
    const room = makeRoom()
    expect(room.world.ids()).toEqual(expect.arrayContaining(['target_wall', 'table', 'shelf']))
    expect(room.world.state('target_wall')!.parts.length).toBeGreaterThan(30)
    expect(room.fluids.container('none')).toBeNull()
  })

  it('weapons: hotbar tools come from the arsenal and any arsenal id can be equipped', () => {
    const room = makeRoom()
    room.setTool('pistol_9mm')
    expect(room.tool.def.id).toBe('pistol_9mm')
    room.equip('baseball_bat')
    expect(room.tool.def.id).toBe('baseball_bat')
    expect(() => room.setTool('nope')).toThrow()
    expect(text(room)).toContain('Equipped 9 mm service pistol')
  })

  it('a catalogue item with a weapon id is equipped by the host or the panel', () => {
    const catalog = [...demoItems('en'), { id: 'crowbar_prop', name: 'Crowbar', group: 'Items', build: (T: typeof THREE) => new T.Group(), spec: { parts: [{ id: 'bar', material: 'steel', shape: { kind: 'box' as const, size: [0.6, 0.03, 0.03] as [number, number, number] }, position: [0, 0.02, 0] as [number, number, number] }] }, weapon: 'crowbar' }]
    const room = makeRoom({ catalog })
    const prop = room.spawn('crowbar_prop', [0, 0, -3])
    expect(prop.movable).toBe(true)
    room.equip('crowbar')
    expect(room.tool.def.id).toBe('crowbar')
  })
})

describe('shooting and the log', () => {
  it('a shot is a log line in plain words with the numbers that matter', () => {
    const room = makeRoom()
    room.spawn('steel_sheet', [0, 0, -4], 0)
    room.setTool('pistol_9mm')
    room.look([0, 1.1, -1.5], [0, 1.1, -4])
    room.use()
    const t = text(room)
    expect(t).toMatch(/9 mm service pistol: shot, 500 J, hit Steel sheet on a stand › sheet \(steel\) at 2\.5 m/)
    expect(t).toMatch(/Steel sheet on a stand › sheet \(steel\): 9 mm hole went through, hp \d+\/\d+/)
    const hole = room.log.entries({ type: 'hole' })[0]
    expect(hole).toMatchObject({ channel: 'event', part: 'sheet', material: 'steel', itemId: 'steel_sheet' })
    expect(hole.state).toMatchObject({ status: 'damaged' })
  })

  it('the same shot reads in pt-BR', () => {
    const room = makeRoom({ locale: 'pt-BR' })
    room.spawn('steel_sheet', [0, 0, -4], 0)
    room.setTool('pistol_9mm')
    room.look([0, 1.1, -1.5], [0, 1.1, -4])
    room.use()
    expect(text(room)).toMatch(/Chapa de aço com suporte › sheet \(aço\): furo de 9 mm atravessou/)
  })

  it('a shotgun blast is summarised, not one line per pellet', () => {
    const room = makeRoom()
    room.spawn('wooden_crate', [0, 0, -4], 0)
    room.setTool('shotgun_pump_12')
    room.look([0, 0.6, -1.8], [0, 0.25, -3.77])
    room.use()
    const shots = room.log.entries({ type: 'shoot' })
    expect(shots).toHaveLength(1)
    expect(shots[0].text).toMatch(/9 projectiles/)
    expect(room.log.entries({ type: 'hole' }).length).toBeLessThanOrEqual(2)
    expect(room.log.entries({ type: 'hole' })[0].text).toMatch(/\d+ holes of \d+ mm/)
  })

  it('a bullet hole in a container merges the leak into the hole line and punctures the fluid container', () => {
    const room = makeRoom()
    const can = room.spawn('jerrycan', [0, 0, -3.5], 0)
    room.setTool('pistol_9mm')
    room.look([0, 0.4, -1.5], [0, 0.12, -3.43])
    room.use()
    const hole = room.log.entries({ type: 'hole' })[0]
    expect(hole.text).toMatch(/hole went through.*, leaking gasoline at [\d.]+ l\/s/)
    expect(room.fluids.container(`${can.objectId}_fluid`)!.holes).toHaveLength(1)
    expect(room.log.entries({ type: 'leak' })).toEqual([])
  })

  it('melt and drip lines are updated in place', () => {
    const room = makeRoom()
    const id = room.spawn('plastic_bucket', [0, 0, -4], 0).objectId
    for (let i = 0; i < 20; i++) {
      room.world.hit(id, { type: 'fire', point: [0, 0.15, -4], temperature: 900, radius: 0.5, duration: 1 })
      room.update(1 / 30)
      room.update(1 / 30)
    }
    for (let i = 0; i < 90; i++) room.update(1 / 30)
    const melts = room.log.entries({ type: 'melt' })
    expect(melts.length).toBeGreaterThan(0)
    expect(melts.length).toBeLessThan(5)
    expect(melts[0].data?.updates).toBeGreaterThan(1)
  })
})

describe('carrying and drinking', () => {
  it('grabs, carries (follows the camera), drops and throws', () => {
    const room = makeRoom()
    const cup = room.spawn('coffee_cup', [0, 0, -3], 0)
    room.look([0, 1.0, -1.8], [0, 0.05, -3])
    expect(room.grab()).toBe(true)
    room.look([0, 1.2, -1.8], [0, 1.2, -4])
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    const p = cup.root.position
    expect(Math.hypot(p.x - room.camera.position.x, p.z - room.camera.position.z)).toBeLessThan(1.6)
    expect(p.y).toBeGreaterThan(0.3)
    expect(room.grab()).toBe(true) // drop (a ceramic cup may well break from that height)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(cup.root.position.y).toBeLessThan(0.2)
    // a plastic bucket survives being dropped and thrown
    const bucket = room.spawn('plastic_bucket', [1, 0, -3], 0)
    room.look([1, 1.0, -1.8], [1, 0.05, -3])
    expect(room.grab()).toBe(true)
    expect(room.throwHeld(8)).toBe(true)
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(bucket.root.position.y).toBeLessThan(1)
    expect(text(room)).toMatch(/Grabbed Cup of coffee[\s\S]*Dropped Cup of coffee[\s\S]*Grabbed Plastic bucket[\s\S]*Threw Plastic bucket at 8\.0 m\/s/)
    expect(room.throwHeld()).toBe(false)
  })

  it('does not grab what is too heavy or not a body', () => {
    const room = makeRoom()
    room.spawn('concrete_block', [0, 0, -2.5], 0)
    room.look([0, 1.0, -0.5], [0, 0.2, -2.5])
    expect(room.grab()).toBe(false)
  })

  it('drinking logs the sip once with thirst and effects; too hot burns', () => {
    const room = makeRoom({ locale: 'pt-BR' })
    const cup = room.spawn('coffee_cup', [0, 0, -3], 0)
    room.look([0, 1.0, -1.8], [0, 0.05, -3])
    room.grab()
    expect(room.useItem('sip')).toBe(true)
    for (let i = 0; i < 100; i++) room.update(1 / 60)
    const drinks = room.log.entries({ type: 'fluid.drink' })
    expect(drinks).toHaveLength(1)
    expect(drinks[0].text).toMatch(/Copo de café: bebeu 0,0\d l, sede \+\d, cafeína, quente demais: queimou a boca/)
    expect(room.fluids.container(`${cup.objectId}_fluid`)!.liters).toBeLessThan(0.25)
    expect(room.useItem('nope')).toBe(false)
  })

  it('nothing to use without a held item', () => {
    expect(makeRoom().useItem('drink')).toBe(false)
  })
})

describe('structure', () => {
  it('logs stress and collapse with the numbers, and the inspector reads load and stress', () => {
    const room = makeRoom({ locale: 'pt-BR' })
    const id = room.spawn('building_frame', [0, 0, -6], 0).objectId
    room.world.hitPart(id, 'column_0_0_0', { type: 'blunt', point: [-2, 1.4, -8], energy: 3e6, radius: 0.05 })
    room.world.hitPart(id, 'column_0_1_0', { type: 'blunt', point: [2, 1.4, -8], energy: 3e6, radius: 0.05 })
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    const text = room.log.toText()
    expect(text).toMatch(/Estrutura de prédio: desabou, \d+ peças caíram \(\d+ kg\)/)
    expect(text).toMatch(/column_0_\d_\d \(concreto\): sobrecarregado a \d+% da capacidade, sustentando \d+ kg/)
    room.look([-2, 1.5, -1.5], [-2, 1.4, -4])
    const info = room.inspectInfo()
    expect(info?.part.startsWith('column')).toBe(true)
    expect(info?.load).toBeGreaterThan(1000)
    expect(info?.stress).toBeGreaterThan(1)
  })
})

describe('ui', () => {
  it('builds the panels: catalogue tabs, log buttons, tests, and spawns from a button', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: demoItems('en'), renderer: stubRenderer(), ui: true })
    const buttons = [...container.querySelectorAll('button')].map((b) => b.textContent)
    for (const label of ['Furniture', 'Containers', 'Copy JSON', 'Download NDJSON', 'Download TXT', 'Clear', 'Reset all', 'Run all', 'actions', 'events', 'checks']) expect(buttons, label).toContain(label)
    const chairButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Wooden chair')!
    chairButton.click()
    expect(room.spawned().map((s) => s.itemId)).toEqual(['chair'])
    expect(container.querySelector('.tr-logbody')!.textContent).toContain('Spawned Wooden chair')
    room.update(0.2)
    expect(container.querySelector('.tr-tool')!.textContent).toContain('Hand')
    room.dispose()
  })

  it('the log panel keeps about 200 lines and updates coalesced lines in place', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, catalog: demoItems('en'), renderer: stubRenderer(), ui: true })
    for (let i = 0; i < 260; i++) room.log.add({ channel: 'action', type: 'x', text: `line ${i}` })
    const body = container.querySelector('.tr-logbody')!
    expect(body.childElementCount).toBe(200)
    room.log.coalesce('k', { channel: 'event', type: 'melt', text: 'melting 10%' })
    room.log.coalesce('k', { channel: 'event', type: 'melt', text: 'melting 20%' })
    expect(body.textContent).toContain('melting 20%')
    expect(body.textContent).not.toContain('melting 10%')
    room.dispose()
  })
})
