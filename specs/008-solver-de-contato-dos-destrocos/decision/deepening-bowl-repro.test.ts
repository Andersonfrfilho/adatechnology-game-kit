let SIGN = -1
let TRACE = false
import * as THREE from 'three'
import { it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

type Body = { objectId: string; root: THREE.Object3D; velocity: number[]; angularVelocity: number[]; sleeping: boolean }
type Sys = { pushes: Map<Body, number[]>; applyPushes: (dt: number) => void; separatePair: (...a: unknown[]) => void; wakeRegion: (x: number, z: number, r: number) => void }

const run = (kind: 'bridge' | 'bowl', seed: number, dt: number, moving = true) => {
  let state = seed * 9301 + 49297
  const next = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  let t = 0
  const groundAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    if (kind === 'bridge') return d < 1.5 ? -0.15 * Math.min(1, t / 2) : 0
    const bowl = d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0
    return bowl * (1 + SIGN * 0.8 * Math.min(1, t / 2))
  }
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt })
  const box = (id: string, size: [number, number, number], at: [number, number, number], turn: [number, number, number]): Piece => {
    world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 + 1 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group(); root.add(mesh); root.position.set(...at); root.rotation.set(...turn)
    scene.add(root); root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    return renderer.makePiece(id)
  }
  const sys = (renderer as unknown as { pieceSys: Sys }).pieceSys
  const lifted = new Map<string, number>(); let fastestUp = 0
  const ap = sys.applyPushes.bind(sys)
  sys.applyPushes = (d) => { const before = [...sys.pushes.keys()].map((b): [Body, number] => [b, b.root.position.y]); ap(d); for (const [b, y] of before) if (b.root.position.y > y) lifted.set(b.objectId, (lifted.get(b.objectId) ?? 0) + b.root.position.y - y) }
  const log: string[] = []
  let frame = 0
  const f = (v: number[]) => v.map((x) => x.toFixed(3)).join(',')
  const tc = (sys as unknown as { turnAboutCentre: (...a: unknown[]) => void })
  const otc = tc.turnAboutCentre.bind(sys)
  tc.turnAboutCentre = (...a: unknown[]) => { (sys as unknown as { br: string }).br = 'lift'; otc(...a) }
  const ts = (sys as unknown as { slideApart: (...a: unknown[]) => void })
  const ots = ts.slideApart.bind(sys)
  ts.slideApart = (...a: unknown[]) => { (sys as unknown as { br: string }).br = 'slide'; ots(...a) }
  const sp = sys.separatePair.bind(sys)
  sys.separatePair = (...a: unknown[]) => { const [x, y] = a as [Body, Body]; const v0 = [x.velocity[1], y.velocity[1]]; (sys as unknown as { br: string }).br = ''; const y0 = [x.root.position.y, y.root.position.y]; sp(...a); const h = (sys as unknown as { dbgHit: { depth: number; normal: number[] } | null }).dbgHit; const br = (sys as unknown as { br: string }).br; if (TRACE && (x.objectId === 'sheet' || y.objectId === 'sheet') && h) log.push(`${frame}   pair v0 ${v0.map((q) => q.toFixed(3)).join("/")} ${x.objectId}/${y.objectId} sl ${x.sleeping}/${y.sleeping} vy ${x.velocity[1].toFixed(3)}/${y.velocity[1].toFixed(3)} d ${h.depth.toFixed(4)} n ${f(h.normal)} ${br} rest ${String(a[5])}`); [x, y].forEach((b, i) => { if (b.velocity[1] > v0[i]) fastestUp = Math.max(fastestUp, b.velocity[1]) }) }
  if (kind === 'bridge') {
    box('slabA', [0.5, 0.08, 0.6], [-0.45, 0.04, 0], [0, 0, 0])
    box('slabB', [0.5, 0.06, 0.6], [0.5, 0.03, 0.05], [0, 0.3, 0])
  } else {
    for (let i = 0; i < 4; i++) box(`plate${i}`, [0.634, 0.304, 0.04], [(next() - 0.5) * 1.2, 0.0, (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5])
  }
  for (let i = 0; i < 2 / dt; i++) renderer.update(dt)
  const sheet = kind === 'bridge' ? box('sheet', [1.2, 0.04, 1.2], [0, 0.1, 0], [0, 0.2, 0]) : box('sheet', [1.2, 0.04, 1.224], [(next() - 0.5) * 0.4, 0.5, (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 0.5 / dt; i++) renderer.update(dt)
  lifted.clear(); fastestUp = 0
  if (kind === 'bowl') { lifted.clear() }
  const ys: number[] = []
  for (let i = 0; i < 4 / dt; i++) { if (moving) t += dt; sys.wakeRegion(0, 0, 2); frame++; const g = (sheet as unknown as { velocity: number[]; angularVelocity: number[] }); const yb = sheet.root.position.y; renderer.update(dt); ys.push(sheet.root.position.y); if (TRACE) log.push(`${frame} y ${sheet.root.position.y.toFixed(4)} dy ${(sheet.root.position.y - yb).toFixed(4)} v ${f(g.velocity)} w ${f(g.angularVelocity)} sl ${sheet.sleeping} lift ${(lifted.get('sheet') ?? 0).toFixed(4)}`) }
  if (TRACE) console.log(log.join('\n'))
  return `${kind} seed ${seed} dt ${dt.toFixed(3)} sheetLift ${(lifted.get('sheet') ?? 0).toFixed(4)} maxLift ${Math.max(0, ...lifted.values()).toFixed(4)} fastestUp ${fastestUp.toFixed(3)} sleeping ${sheet.sleeping} y ${sheet.root.position.y.toFixed(3)}`
}
it.skip('zz8', () => { SIGN = 1; TRACE = true; console.log(run('bowl', 7, 1 / 60, true)); TRACE = false })
it('zz7', () => {
  for (const sign of [1]) for (const moving of [true]) for (const dt of [1 / 60, 0.05]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) { SIGN = sign; console.log(sign > 0 ? 'deepen' : 'fill', run('bowl', seed, dt, moving)) }
}, 120000)
