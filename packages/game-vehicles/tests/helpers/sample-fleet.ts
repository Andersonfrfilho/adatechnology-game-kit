import type { VehicleKit } from '../../src'

/** The demo car of `example/example.html`. */
export const DEMO_CAR = {
  W: 1.74,
  col: '#c23b22',
  bottomY: 0.3,
  noseY: 0.62,
  tailY: 0.8,
  lower: [
    [-2.0, 0.32, 0.05],
    [-2.05, 0.95, 0.12],
    [1.3, 0.98, 0.2],
    [2.05, 0.75, 0.2],
    [2.08, 0.35, 0.08],
  ],
  arches: [
    [1.3, 0.31, 0.37],
    [-1.25, 0.31, 0.37],
  ],
  gh: { rb: -1.75, rt: -1.2, ft: 0.35, fb: 1.2, belt: 0.98, roof: 1.48, Wg: 1.62, k: 0.18, pillars: [-0.45, -1.2] },
  hl: { style: 'wedge', w: 0.36, h: 0.1 },
  tl: { style: 'bar' },
  grille: { style: 'seven' },
  interior: { rows: 2, col: '#2c2d30' },
  hood: { motor: 'v8' },
  wheels: [
    [1.3, 0.31, 0.2],
    [-1.25, 0.31, 0.2, { spokes: 6 }],
  ],
}

/** Keys of the vehicles registered by {@link registerSampleFleet}. */
export const SAMPLE_KEYS = ['proto', 'truck', 'bike', 'tank', 'boat', 'plane', 'heli', 'bus'] as const

/** One vehicle of each family, built from primitives only (no content pack). The same definitions produced the golden fixtures. */
export function registerSampleFleet(kit: VehicleKit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const MT = kit.materials

  kit.register({ key: 'proto', group: 'P', name: 'Meteor', fuel: 'flex', hood: true }, (c) =>
    kit.car(c, JSON.parse(JSON.stringify(DEMO_CAR))),
  )

  kit.register({ key: 'truck', group: 'T', name: 'Hauler', fuel: 'diesel' }, (c) => {
    kit.truckCab(c, { f: 3.2, W: 2.4, col: '#2f6fa0', hl: {}, grille: {} })
    kit.truckChassis(c, { f: 3.2, L: 8.5, W: 2.4, axles: [-1.2, -2.4], dual: true, tank: 'right' })
  })

  kit.register({ key: 'bike', group: 'T', name: 'Zip', fuel: 'gasoline' }, (c) => {
    const paint = c.paint('#b33')
    kit.spokedWheel(c, 0.7, 0.33, 0.33, {})
    kit.spokedWheel(c, -0.7, 0.33, 0.33, {})
    c.roundBox(1.2, 0.2, 0.18, 0.05, paint, 0, 0.7, 0)
    c.roundBox(0.5, 0.18, 0.3, 0.05, MT.seat, -0.3, 0.9, 0)
    c.rod(new V3(0.7, 0.33, 0), new V3(0.45, 0.95, 0), 0.03, MT.steel)
    c.rod(new V3(-0.7, 0.33, 0), new V3(-0.3, 0.7, 0), 0.03, MT.steel)
    kit.headlight(c, { style: 'round', x: 0.62, y: 0.95, z: 0, w: 0.2, h: 0.2, side: 1 })
    kit.taillight(c, { style: 'bar', x: -0.8, y: 0.9, z: 0, w: 0.2, h: 0.08, side: 1 })
    c.part('engine', 'Engine', null, new V3(0.1, 0.5, 0), 0.8)
    Object.assign(c.meta, {
      kind: 'bike',
      clearance: 0.25,
      bodyHeight: 0.6,
      belt: 0.88,
      length: 1.9,
      width: 0.6,
      front: 1.0,
      rear: -0.9,
      top: 1.1,
    })
  })

  kit.register({ key: 'tank', group: 'T', name: 'Crusher', fuel: 'diesel' }, (c) => {
    const paint = c.paint('#4a5a3a', { matte: true })
    c.roundBox(5, 0.8, 2.4, 0.1, paint, 0, 0.9, 0, { def: true })
    c.roundBox(2.2, 0.6, 1.8, 0.1, paint, -0.3, 1.5, 0, { def: true })
    c.cylinder(0.08, 0.1, 3, MT.steel, 2.2, 1.55, 0, 'x')
    kit.tracks(c, { x0: -2.2, x1: 2.2, z: 1.2, w: 0.55, r: 0.33, n: 6, top: 1.0 })
    kit.tracks(c, { x0: -2.2, x1: 2.2, z: -1.2, w: 0.55, r: 0.33, n: 6, top: 1.0 })
    Object.assign(c.meta, {
      kind: 'car',
      length: 5.5,
      width: 2.8,
      front: 2.6,
      rear: -2.5,
      clearance: 0.3,
      belt: 1.3,
      top: 1.9,
      bodyHeight: 1.0,
      armored: true,
      bullet: true,
    })
  })

  kit.register({ key: 'boat', group: 'T', name: 'Skiff', fuel: 'gasoline' }, (c) => {
    const paint = c.paint('#e8e8e0')
    c.roundBox(4.5, 0.5, 1.6, 0.2, paint, 0, 0.1, 0, { def: true })
    c.roundBox(1.2, 0.5, 1.0, 0.1, MT.alu, -0.4, 0.55, 0, { def: true })
    c.part('hull', 'Hull', null, new V3(1, 0.1, 0), 1.2)
    const engine = c.roundBox(0.3, 0.6, 0.3, 0.05, MT.trim, -2.4, 0.4, 0)
    c.part('stern', 'Outboard', engine, new V3(-2.4, 0.4, 0), 0.8)
    Object.assign(c.meta, {
      kind: 'boat',
      length: 4.7,
      width: 1.9,
      front: 2.25,
      rear: -2.4,
      clearance: -0.2,
      belt: 0.45,
      bodyHeight: 0.6,
      top: 1.0,
    })
  })

  kit.register({ key: 'plane', group: 'T', name: 'Skylark', fuel: 'avgas' }, (c) => {
    const paint = c.paint('#dcdad0')
    c.roundBox(7, 1.0, 1.1, 0.4, paint, 0, 1.2, 0, { def: true })
    c.roundBox(1.4, 0.08, 10, 0.03, paint, 0.4, 1.5, 0, { def: true })
    c.roundBox(0.9, 1.0, 0.06, 0.02, paint, -3.2, 1.9, 0, { def: true })
    c.roundBox(0.8, 0.06, 3, 0.02, paint, -3.2, 1.5, 0, { def: true })
    const prop = new THREE.Group()
    prop.position.set(3.6, 1.2, 0)
    c.vehicle.add(prop)
    prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 2, 0.15), MT.trim))
    c.spin.push({ o: prop, axis: 'x', v: 40, decay: 0 })
    c.part('propeller', 'Propeller', prop, new V3(3.6, 1.2, 0), 1)
    c.wheel(1.5, 0.8, 0.3, 0.15, {})
    c.wheel(1.5, -0.8, 0.3, 0.15, {})
    c.wheel(-3.0, 0, 0.2, 0.1, {})
    kit.addGlass(c, new THREE.BoxGeometry(1.2, 0.5, 0.9), 'Canopy', 'laminated', { pos: new V3(1, 1.8, 0) })
    Object.assign(c.meta, {
      kind: 'plane',
      length: 7.2,
      width: 10,
      fuselageWidth: 1.1,
      front: 3.6,
      rear: -3.6,
      clearance: 0.62,
      belt: 1.4,
      bodyHeight: 1.0,
      top: 2.4,
    })
  })

  kit.register({ key: 'heli', group: 'T', name: 'Whirl', fuel: 'jet_fuel' }, (c) => {
    const paint = c.paint('#9ab')
    c.roundBox(3, 1.3, 1.4, 0.5, paint, 0.5, 1.2, 0, { def: true })
    c.roundBox(3.5, 0.3, 0.3, 0.1, paint, -2.5, 1.5, 0, { def: true })
    const rotor = new THREE.Group()
    rotor.position.set(0.3, 2.3, 0)
    c.vehicle.add(rotor)
    rotor.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.2), MT.trim))
    c.spin.push({ o: rotor, axis: 'y', v: 30, decay: 0 })
    c.part('rotor', 'Rotor', rotor, new V3(0.3, 2.3, 0), 1.5)
    const tail = new THREE.Group()
    tail.position.set(-4.2, 1.7, 0.2)
    c.vehicle.add(tail)
    tail.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.1), MT.trim))
    c.spin.push({ o: tail, axis: 'z', v: 40, decay: 0 })
    c.part('tail_rotor', 'Tail rotor', tail, new V3(-4.2, 1.7, 0.2), 1)
    kit.addGlass(c, new THREE.BoxGeometry(1, 0.8, 1.2), 'Bubble', 'laminated', { pos: new V3(1.6, 1.4, 0) })
    Object.assign(c.meta, {
      kind: 'heli',
      length: 6.5,
      width: 2,
      fuselageWidth: 1.4,
      front: 2.0,
      rear: -4.5,
      clearance: 0.6,
      belt: 1.15,
      bodyHeight: 1.4,
      top: 2.5,
      fuselageTop: 1.9,
    })
  })

  kit.register({ key: 'bus', group: 'T', name: 'Shuttle', fuel: 'diesel' }, (c) => {
    const paint = c.paint('#e0a020')
    c.roundBox(9, 2.0, 2.4, 0.15, paint, 0, 1.5, 0, { def: true })
    kit.busRows(c, { x0: 3.5, x1: -3.5, floor: 0.7, zIn: 1.1, pitch: 0.9 })
    ;[3, -3].forEach((x) => {
      c.wheel(x, 1.2, 0.5, 0.3, {})
      c.wheel(x, -1.2, 0.5, 0.3, {})
    })
    kit.addGlass(c, new THREE.BoxGeometry(2, 0.9, 2.2), 'Pane', 'laminated', { pos: new V3(4.4, 1.8, 0) })
    Object.assign(c.meta, {
      kind: 'bus',
      length: 9.2,
      width: 2.5,
      front: 4.5,
      rear: -4.5,
      clearance: 0.5,
      belt: 1.2,
      bodyHeight: 1.6,
      top: 2.6,
    })
  })
}
