import { describe, expect, it } from 'vitest'
import { createTestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
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

  it('the tap is a core `tap` stream: it fills a container under it and stops when closed', () => {
    const room = makeRoom()
    const spout = room.fluids.taps()[0].position
    room.fluids.addContainer({ capacity: 2, shape: { kind: 'cylinder', radius: 0.08, height: 0.2 }, opening: 0.08 }, { id: 'under_tap', position: [spout[0], spout[1] - 0.5, spout[2]] })
    expect(room.fluids.streams()).toHaveLength(0)
    expect(room.toggleTap()).toBe(true)
    expect(room.fluids.streams().map((x) => x.cause)).toEqual(['tap'])
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(room.fluids.container('under_tap')!.liters).toBeGreaterThan(0.2)
    expect(room.toggleTap()).toBe(false)
    expect(room.fluids.streams()).toHaveLength(0)
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
    room.update(0.4)
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
    room.update(0.4)
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
    room.update(0.4)
    room.look([0, 1.1, -1.5], [0, 1.1, -4])
    room.use()
    expect(text(room)).toMatch(/Chapa de aço com suporte › sheet \(aço\): furo de 9 mm atravessou/)
  })

  it('a shotgun blast is summarised, not one line per pellet', () => {
    const room = makeRoom()
    room.spawn('wooden_crate', [0, 0, -4], 0)
    room.setTool('shotgun_pump_12')
    room.update(0.4)
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
    room.update(0.4)
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

  it('C crouches and leaves the held item alone; Shift+F is its second use, F the first', () => {
    const room = makeRoom()
    room.spawn('coffee_cup', [0, 0, -3], 0)
    room.look([0, 1.0, -1.8], [0, 0.05, -3])
    room.grab()
    const uses = (): string[] => room.log.entries({ type: 'use_item' }).map((entry) => String(entry.data?.use))
    const press = (code: string, shiftKey = false): void => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey }))
      for (let i = 0; i < 100; i++) room.update(1 / 60)
      window.dispatchEvent(new KeyboardEvent('keyup', { code, shiftKey }))
      for (let i = 0; i < 10; i++) room.update(1 / 60)
    }
    press('KeyC')
    expect(uses()).toHaveLength(0)
    press('KeyC')
    press('KeyF', true)
    press('KeyF')
    expect(uses()).toHaveLength(2)
    expect(uses()[0]).not.toBe(uses()[1])
  })

  it('nothing to use without a held item', () => {
    expect(makeRoom().useItem('drink')).toBe(false)
  })
})

describe('log quality', () => {
  const breakPane = (locale: string) => {
    const room = makeRoom({ locale })
    const pane = room.spawn('glass_pane', [0, 0, -4], 0)
    for (let i = 0; i < 12 && room.world.part(pane.objectId, 'pane')?.status !== 'broken'; i++) {
      room.world.hitPart(pane.objectId, 'pane', { type: 'ballistic', point: [0, 1.05, -4.0], direction: [0, 0, -1], energy: 500, caliber: 9 })
    }
    return room.log.entries({ objectId: pane.objectId })
  }

  it('a part that breaks is ONE line, with the joints it left and the pieces that remain', () => {
    const en = breakPane('en').filter((e) => e.type === 'fracture' || e.type === 'detach')
    expect(en.map((e) => e.text)).toEqual([expect.stringMatching(/^Glass pane › pane \(glass\): shattered into \d+ shards and came loose from 4 joints; the object now has 1 piece$/)])
    const pt = breakPane('pt-BR').filter((e) => e.type === 'fracture' || e.type === 'detach')
    expect(pt.map((e) => e.text)).toEqual([expect.stringMatching(/^Vidro de janela › pane \(vidro\): estilhaçou em \d+ cacos e se soltou de 4 encaixes; o objeto agora tem 1 peça$/)])
  })

  it('a blow that opens several joints of an object is one line too, with the right plural', () => {
    const room = makeRoom()
    const crate = room.spawn('wooden_crate', [0, 0, -4], 0)
    room.world.hit(crate.objectId, { type: 'explosive', point: [0, 0.25, -4], energy: 30000, radius: 3 })
    const detach = room.log.entries({ type: 'detach', objectId: crate.objectId })
    expect(detach.length).toBeLessThanOrEqual(1)
    const lines = room.log.entries({ objectId: crate.objectId }).map((e) => e.text)
    expect(lines.filter((x) => /\b1 pieces\b/.test(x))).toEqual([])
    expect(lines.some((x) => /came loose from \d+ joints; the object now has \d+ pieces?$/.test(x) || /\d+ joints broke loose/.test(x))).toBe(true)
  })

  it('spawned things rest on the floor or the table and never log a landing', () => {
    const room = makeRoom()
    for (const item of demoItems('en')) room.spawn(item.id)
    room.spawn('coffee_cup', [3.5, 0, 0])
    for (let i = 0; i < 240; i++) room.update(1 / 60)
    expect(room.log.entries({ type: 'landing' })).toEqual([])
    const cup = room.spawned().filter((s) => s.itemId === 'coffee_cup')[1]
    const box = new THREE.Box3().setFromObject(cup.root)
    expect(box.min.y).toBeGreaterThan(0.77)
    expect(box.min.y).toBeLessThan(0.8)
  })

  it('a landing under 3 m/s is not logged, a real drop is, with its speed and energy', () => {
    const room = makeRoom()
    const crate = room.spawn('wooden_crate', [-1, 0.2, -3], 0)
    const high = room.spawn('wooden_crate', [1, 1.5, -3], 0)
    for (let i = 0; i < 240; i++) room.update(1 / 60)
    const lines = room.log.entries({ type: 'landing' })
    expect(lines.map((e) => e.objectId)).toEqual([high.objectId])
    expect(crate.objectId).not.toBe(high.objectId)
    expect(lines[0].text).toMatch(/Wooden crate landed at \d\.\d m\/s: \d+(\.\d)? J/)
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
    expect(text).toMatch(/Estrutura de prédio: desabou, caíram (1 peça|\d+ peças) \(\d+ kg\): /)
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
    room.update(0.2)
    expect(container.querySelector('.tr-logbody')!.textContent).toContain('Spawned Wooden chair')
    expect(container.querySelector('.tr-tool')!.textContent).toContain('Hand')
    room.dispose()
  })

  it('the log panel keeps about 200 lines and updates coalesced lines in place', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, catalog: demoItems('en'), renderer: stubRenderer(), ui: true })
    for (let i = 0; i < 260; i++) room.log.add({ channel: 'action', type: 'x', text: `line ${i}` })
    const body = container.querySelector('.tr-logbody')!
    room.update(0.016)
    expect(body.childElementCount).toBe(200)
    expect(body.textContent).toContain('line 259')
    expect(body.textContent).not.toContain('line 59')
    room.log.coalesce('k', { channel: 'event', type: 'melt', text: 'melting 10%' })
    room.log.coalesce('k', { channel: 'event', type: 'melt', text: 'melting 20%' })
    room.update(0.016)
    expect(body.textContent).toContain('melting 20%')
    expect(body.textContent).not.toContain('melting 10%')
    room.dispose()
  })
})

describe('kick shortcut', () => {
  it('V kicks with the kick tool whatever tool is selected, and the selected tool does not change', () => {
    const room = makeRoom()
    room.spawn('chair', [0, 0, -4], 0)
    room.setTool('hammer')
    room.update(0.4)
    room.look([-1, 0.2, -4.18], [-0.18, 0.2, -4.18])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' }))
    const hits = room.log.entries({ type: 'melee' })
    expect(hits).toHaveLength(1)
    expect(hits[0].data).toMatchObject({ weapon: 'kick', damage: 'blunt', energyJ: 250 })
    expect(room.tool.def.id).toBe('hammer')
  })
})

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) room.update(1 / 60)
}

describe('pause and walk', () => {
  it('pause stops the simulation but not the log, resume continues', () => {
    const room = makeRoom()
    const so = room.spawn('chair', [0, 3, -4], 0)
    room.pause()
    expect(room.paused).toBe(true)
    const y = so.root.position.y
    run(room, 1)
    run(room, 0.5)
    expect(so.root.position.y).toBe(y)
    room.log.add({ channel: 'action', type: 'note', text: 'still logging' })
    expect(room.log.entries({ type: 'note' })).toHaveLength(1)
    room.resume()
    expect(room.paused).toBe(false)
    run(room, 0.5)
    expect(so.root.position.y).toBeLessThan(y)
  })

  it('walk moves the player along a straight line during frames, and not while paused', () => {
    const room = makeRoom()
    room.look([0, 1.6, 4], [0, 1.6, 0])
    room.walk([2, 0, 0], 2)
    run(room, 1)
    expect(room.camera.position.x).toBeCloseTo(1, 1)
    expect(room.camera.position.z).toBeCloseTo(2, 1)
    room.pause()
    run(room, 1)
    expect(room.camera.position.x).toBeCloseTo(1, 1)
    room.resume()
    run(room, 1.2)
    expect(room.camera.position.x).toBeCloseTo(2, 1)
    expect(room.camera.position.z).toBeCloseTo(0, 1)
    run(room, 1)
    expect(room.camera.position.x).toBeCloseTo(2, 1)
  })
})

describe('grenade blast', () => {
  it('draws fire, flash and smoke: live puffs, sparks and glows of the effects layer, and a blast light, are in the scene', () => {
    const room = makeRoom()
    room.setTool('frag_grenade')
    room.update(0.4)
    room.look([0, 1.7, 5], [0, 0.6, -3])
    room.use()
    for (let i = 0; i < 600 && room.log.entries({ type: 'explode' }).length === 0; i++) room.update(1 / 60)
    expect(room.log.entries({ type: 'explode' })).toHaveLength(1)
    room.update(1 / 60)
    // the effects world's instanced layers replaced the two `destruction-particles` point clouds
    const liveInstances = (name: string): number => {
      const mesh = room.scene.getObjectByName(name) as THREE.Mesh
      expect(mesh).toBeDefined()
      return (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount
    }
    expect(liveInstances('vfx-sparks')).toBeGreaterThan(30)
    expect(liveInstances('vfx-puffs')).toBeGreaterThan(30)
    expect(liveInstances('vfx-glows')).toBeGreaterThan(0)
    let lit = false
    room.scene.traverse((object) => {
      if (object instanceof THREE.PointLight && object.intensity > 0) lit = true
    })
    expect(lit).toBe(true)
  })
})

describe('walking over what lies on the floor', () => {
  it('steps onto a low heavy block, is stopped by a tall heavy one and kicks a light cup away', () => {
    const room = makeRoom()
    const block = room.spawn('concrete_block', [0, 0, 2], 0)
    run(room, 1)
    expect(block.root.position.y).toBeLessThan(0.05)
    room.look([0, 1.7, 4], [0, 1.7, 0])
    room.walk([0, 0, 0.5], 1.5)
    run(room, 1.6)
    // on top of the 40 cm block
    expect(room.camera.position.z).toBeCloseTo(0.5, 1)
    let top = 0
    room.walk([0, 0, 2], 0.2)
    for (let t = 0; t < 0.3; t += 1 / 60) {
      room.update(1 / 60)
      top = Math.max(top, room.camera.position.y)
    }
    expect(top).toBeGreaterThan(1.7 + 0.3)

    const sofa = room.spawn('sofa', [3, 0, 2], 0)
    run(room, 1)
    room.look([3, 1.7, 4.2], [3, 1.7, 0])
    room.walk([3, 0, 0], 2)
    run(room, 2.2)
    expect(room.camera.position.z).toBeGreaterThan(2.3)
    expect(sofa.root.position.z).toBeCloseTo(2, 1)

    const cup = room.spawn('coffee_cup', [-1.5, 0, 2.5], 0)
    run(room, 1)
    room.look([-1.5, 1.7, 4], [-1.5, 1.7, 0])
    room.walk([-1.5, 0, 1], 2)
    run(room, 2.2)
    expect(room.camera.position.z).toBeCloseTo(1, 1)
    expect(Math.hypot(cup.root.position.x + 1.5, cup.root.position.z - 2.5)).toBeGreaterThan(0.3)
  })
})

describe('the player against the objects', () => {
  it('does not walk through a spawned object, and pushes a light one along', () => {
    const room = makeRoom()
    const chair = room.spawn('chair', [0, 0, -2], 0)
    const z0 = chair.root.position.z
    room.look([0, 1.6, 1], [0, 1, -2])
    room.walk([0, 0, -2], 2)
    run(room, 2.5)
    expect(room.log.entries({ type: 'bump' }).length).toBeGreaterThan(0)
    // the chair went ahead of the player instead of being walked through
    expect(chair.root.position.z).toBeLessThan(z0 - 0.2)
    expect(room.camera.position.z).toBeGreaterThan(chair.root.position.z)
  })

  it('a heavy fixed piece only blocks: the player stops at it and it does not move', () => {
    const room = makeRoom()
    const shelf = room.spawn('shelf', [0, 0, -2], 0)
    const z0 = shelf.root.position.z
    room.look([0, 1.6, 1], [0, 1, -2])
    room.walk([0, 0, -4], 3)
    run(room, 3.5)
    expect(room.camera.position.z).toBeGreaterThan(-1.7)
    expect(shelf.root.position.z).toBeCloseTo(z0, 5)
    expect(room.log.entries({ type: 'bump' })).toHaveLength(0)
  })

  it('a kick leaves the hip: standing up and looking ahead, it lands on a chair in front of the feet', () => {
    const room = makeRoom()
    const chair = room.spawn('chair', [0, 0, -0.75], 0)
    room.setTool('kick')
    room.update(0.6)
    room.look([0, 1.6, 0], [0, 1.6, -3])
    room.use()
    run(room, 1)
    const hits = room.log.entries({ type: 'melee' })
    expect(hits.some((h) => h.objectId === chair.objectId)).toBe(true)
  })
})


describe('how long what breaks off stays on screen (debris)', () => {
  it('passes the fragment life rule and the fragment budget to the renderer', () => {
    const seen: string[] = []
    const room = makeRoom({ debris: { maxFragments: 4, fragmentLife: (_f, objectId) => (seen.push(objectId), 0) } })
    const pane = room.spawn('glass_pane', [0, 0, -4], 0)
    for (let i = 0; i < 12 && room.world.part(pane.objectId, 'pane')?.status !== 'broken'; i++) {
      room.world.hitPart(pane.objectId, 'pane', { type: 'ballistic', point: [0, 1.05, -4.0], direction: [0, 0, -1], energy: 500, caliber: 9 })
    }
    room.update(1 / 60)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((id) => id === pane.objectId)).toBe(true)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    expect(room.renderer.stats().fragments).toBeLessThanOrEqual(4)
  })

  it('tunes the dust and the other sprites by kind', () => {
    expect(() => makeRoom({ debris: { particles: { dust: { life: [10, 30] } } } })).not.toThrow()
  })

  it('a burst of log lines waits for the frame and shows only the last ones', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, catalog: demoItems('en'), renderer: stubRenderer(), ui: true })
    const body = container.querySelector('.tr-logbody')!
    for (let i = 0; i < 1000; i++) room.log.add({ channel: 'event', type: 'boom', text: `boom ${i}` })
    expect(body.childElementCount).toBe(0)
    room.update(0.016)
    expect(body.childElementCount).toBe(200)
    expect(body.lastElementChild!.textContent).toContain('boom 999')
    room.dispose()
  })
})
