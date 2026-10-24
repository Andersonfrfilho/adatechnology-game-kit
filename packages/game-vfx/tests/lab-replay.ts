import { createGroundField, createVfx, LOD_LAB } from '../src'
import type { Chunk, ExplosionDef, Fire, Glow, Puff, Spark, VfxWorld } from '../src'
import { EXPLOSIONS } from '../src'

export type LabKey = 'granada' | 'molotov' | 'flash' | 'caseira' | 'dinamite' | 'c4' | 'claymore' | 'p13' | 'm79' | 'm72' | 'at4' | 'rpg' | 'barril' | 'carro' | 'posto' | 'horda'

export const LAB_ORDER: readonly LabKey[] = ['granada', 'molotov', 'flash', 'caseira', 'dinamite', 'c4', 'claymore', 'p13', 'm79', 'm72', 'at4', 'rpg', 'barril', 'carro', 'posto', 'horda']

/** The explosive each Lab scene detonates (`profOf`, L1030) and where it goes off (the page's `run`, copied by the capture). */
export const LAB_SCENES: Readonly<Record<LabKey, { explosive: string; at: readonly [number, number, number]; direction?: readonly [number, number, number] }>> = {
  granada: { explosive: 'm67', at: [-4.2, 0.1, 3.4] },
  molotov: { explosive: 'molotov', at: [-3.7, 0.05, 2.6] },
  flash: { explosive: 'flashbang', at: [-4, 0.3, 3.3] },
  caseira: { explosive: 'pipe_bomb', at: [-4.3, 0.1, 3.4] },
  dinamite: { explosive: 'dynamite', at: [0, 0.05, 0] },
  c4: { explosive: 'c4', at: [0, 0.15, 0.3] },
  claymore: { explosive: 'claymore', at: [-2.9, 0.2, 0], direction: [1, 0, 0] },
  p13: { explosive: 'propane_p13', at: [0, 0.3, 0] },
  m79: { explosive: 'm79_40mm', at: [0, 0.1, 0] },
  m72: { explosive: 'm72_66mm', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  at4: { explosive: 'at4_84mm', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  rpg: { explosive: 'pg7v', at: [-8, 1.5, 2], direction: [0, 0, -1] },
  barril: { explosive: 'fuel_barrel', at: [0, 0.5, 0] },
  carro: { explosive: 'car_fuel_tank', at: [0, 0.6, 0] },
  posto: { explosive: 'fuel_station_tank', at: [-7, 0.4, -1] },
  horda: { explosive: 'm67', at: [0, 0.1, 0] },
}

export const FRAME_SECONDS = 1 / 60
export const TOTAL_FRAMES = 480
export const MAX_SPAWNS = 400
export const INSTANT_FRAMES: ReadonlyMap<number, number> = new Map([0.08, 0.25, 0.5, 1, 2, 4].map((seconds) => [Math.round(seconds * 60), seconds]))

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0
const num = (value: number | null | undefined): number => (value === null || value === undefined ? -1 : round4(Number(value)))
export const line = (values: readonly (number | null | undefined)[]): string => values.map(num).join(' ')

const tracedFields = {
  puff: (p: Readonly<Puff>) => [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.s0, p.s1, p.sg, p.gk, p.life, p.h0, p.hl, p.drag, p.buoy, p.grav, p.kind, p.seed, p.wind, ...p.color],
  spark: (s: Readonly<Spark>) => [s.x, s.y, s.z, s.vx, s.vy, s.vz, s.life, s.w, s.st, s.kind, s.drag, s.g, s.bounce],
  glow: (g: Readonly<Glow>) => [g.x, g.y, g.z, g.s, g.s1, g.i, g.life, ...g.color, g.curve, g.fx, g.fy, g.fz, g.follow ? 1 : 0, g.flick ? 1 : 0],
  chunk: (c: Readonly<Chunk>) => [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.rx, c.ry, c.rz, c.ax, c.ay, c.az, c.sx, c.sy, c.sz, ...c.color, c.plate ? 1 : 0, c.hot ? 1 : 0],
  fire: (f: Readonly<Fire>) => [f.x, f.y, f.z, f.r, f.r0, f.grow, f.life, f.rate, f.smoke, ...f.color],
}

export const stateFields = {
  puff: (p: Readonly<Puff>) => [...tracedFields.puff(p), p.t, p.ring ? p.ph : -1, p.ring ? p.th : -1, ...(p.ring ? [p.ring.t, p.ring.x, p.ring.z, p.ring.y0, p.ring.rise, p.ring.R0, p.ring.R1, p.ring.r] : [-1])],
  spark: (s: Readonly<Spark>) => [...tracedFields.spark(s), s.t],
  glow: (g: Readonly<Glow>) => [...tracedFields.glow(g), g.t],
  chunk: (c: Readonly<Chunk>) => [...tracedFields.chunk(c), c.rest ? 1 : 0, c.t, c.trail],
  fire: (f: Readonly<Fire>) => [...tracedFields.fire(f), f.t, f.acc, f.smokeAcc, f.fade],
}

export interface LabRun {
  readonly key: LabKey
  readonly world: VfxWorld
  readonly spawns: string[]
  readonly afterBlast: { lod: number; counts: string; shake: number; flash: number; flashDecay: number; events: number[]; seed: number }
  readonly frames: string[]
  readonly first: Record<string, number>
  readonly last: Record<string, number>
  readonly counts: () => string
}

export interface LabHooks {
  /** Called on the frames the golden samples, with the instant in seconds. */
  readonly onInstant?: (run: LabRun, seconds: number) => void
  readonly catalogue?: Readonly<Record<string, ExplosionDef>>
}

/** Replays one Lab scene the way `tools/golden/captures/explosion-lab.js` recorded it: the page seed, the scene camera, `blast` straight away, 480 frames of 1/60 s. */
export function replayLabScene(key: LabKey, camera: readonly [number, number, number], hooks: LabHooks = {}): LabRun {
  const index = LAB_ORDER.indexOf(key)
  const spawns: string[] = []
  let frame = 0
  const record = (kind: string, values: readonly (number | null | undefined)[]): void => {
    if (spawns.length < MAX_SPAWNS) spawns.push(`${frame} ${kind} ${line(values)}`)
  }
  const world = createVfx({
    seed: 1000 + index * 97,
    randomMode: 'shared',
    profile: 'high',
    lod: LOD_LAB,
    areaCap: false,
    ground: createGroundField(),
    explosions: hooks.catalogue ?? EXPLOSIONS,
    trace: {
      puff: (p) => record('puff', tracedFields.puff(p)),
      spark: (s) => record('spark', tracedFields.spark(s)),
      glow: (g) => record('glow', tracedFields.glow(g)),
      chunk: (c) => record('chunk', tracedFields.chunk(c)),
      fire: (f) => record('fire', tracedFields.fire(f)),
      shock: (s) => record('shock', [s.x, s.y, s.z, s.shellRadius, s.groundRadius, s.duration]),
      light: (l) => record('light', [l.x, l.y, l.z, l.peak, l.distance, l.life, l.color]),
      scorch: (x, z, r) => record('scorch', [x, z, r]),
      crater: (x, z, r, depth) => record('crater', [x, z, r, depth]),
      mushroom: (x, y, z, m) => record('mushroom', [x, y, z, m.height, m.radius, m.count, m.stem, m.life, m.riseRate, m.roll]),
    },
  })
  world.setCamera(camera)
  const scene = LAB_SCENES[key]
  world.explosion(scene.explosive, scene.at, scene.direction ? { direction: scene.direction } : {})
  const pools = world.pools()
  const lit = (): number => pools.lights.blast.filter((light) => light.intensity > 0.05).length
  const counts = (): string => [pools.puffs.count, pools.sparks.count, pools.glows.count, pools.chunks.count, world.stats().fires, pools.shocks.count, pools.rings.count, lit()].join('.')
  const stats = world.stats()
  const afterBlast = {
    lod: stats.lod,
    counts: counts().replaceAll('.', '/'),
    shake: world.screen().shake,
    flash: world.screen().flash,
    flashDecay: world.screen().flashDecay,
    events: [stats.lastBlast.puffs, stats.lastBlast.sparks, stats.lastBlast.chunks, stats.lastBlast.lights],
    seed: world.randomState(),
  }
  const alive: Record<string, () => boolean> = {
    flash: () => lit() > 0 || pools.glows.items.some((glow) => !glow.follow),
    fire: () => pools.puffs.items.some((puff) => puff.h0 > 0 && puff.t < puff.hl),
    shock: () => pools.shocks.count > 0,
    smoke: () => pools.puffs.count > 0,
    shrapnel: () => pools.sparks.count > 0 || pools.chunks.count > 0,
    mark: () => pools.marks.entries.length > 0,
  }
  const run: LabRun = { key, world, spawns, afterBlast, frames: [], first: {}, last: {}, counts }
  for (frame = 1; frame <= TOTAL_FRAMES; frame++) {
    world.update(FRAME_SECONDS)
    run.frames.push(counts())
    for (const [layer, isAlive] of Object.entries(alive)) {
      if (!isAlive()) continue
      run.first[layer] ??= frame
      run.last[layer] = frame
    }
    const instant = INSTANT_FRAMES.get(frame)
    if (instant !== undefined) hooks.onInstant?.(run, instant)
  }
  return run
}
