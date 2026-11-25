import type * as THREE_NS from 'three'

import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import { coverBodyOf, coverThrowOf, drainLeak, leaksOf, openingOf, powerOutageOf, startLeak, waterOutageOf } from '@adatechnology/game-urban/networks'
import type { Breach, Crater, FluidContent, GeneratedNetworks, LeakState, NetworkEvent, NetworkLeak, NetworkOutage, SurfacePiece } from '@adatechnology/game-urban/networks'

import type { DistrictSewers } from './networks'

/** The liquid of `game-fluids` each content of a pipe leaks: the drainage runs clear when it rains. */
const LIQUID_OF: Readonly<Record<FluidContent, string>> = { water: 'water', sewage: 'sewage', stormwater: 'water' }
/** Spray sprites a pressurised leak throws per litre it lets out. */
const SPRAY_PER_LITER = 80
const MAX_SPRAY_PER_STEP = 24
const SPRAY_SPEED = 6

export type LeaksParams = {
  readonly world: KitWorld
  readonly scene: THREE_NS.Object3D
  readonly generated: GeneratedNetworks
  readonly sewers: DistrictSewers
  /** Whether it rains now (`game-weather`): the drainage only runs then. */
  readonly isRaining: () => boolean
  /** The houses: a lot an outage marks dry has its water cut, a lot it leaves dark its grid, both given back on reset. */
  readonly houses: { setLotWater(lot: string, on: boolean): boolean; setLotGrid(lot: string, on: boolean): boolean }
  /** The drawn street lights (`DrawnNetworks`): the lamps a cut duct leaves dark go out, and light again on reset. */
  readonly lamps?: { setLampsPowered(ids: readonly string[], on: boolean): void }
}

export type DistrictLeaks = {
  /** Every event so far, in order: a pipe leaks, a house loses its water, a cover opens its hole. */
  readonly events: readonly NetworkEvent[]
  /** What still runs: leaks with something left to let out. */
  readonly running: readonly LeakState[]
  /** The houses without water now (`NetworkOutage.lots`, all outages together). */
  readonly dryLots: ReadonlySet<string>
  /** The houses without power now, and the street lights out, after a duct of underground power was cut. */
  readonly darkLots: ReadonlySet<string>
  readonly darkLamps: ReadonlySet<string>
  /** Ids of the loose lids of the thrown covers (bodies of the destruction world). */
  readonly lids: readonly string[]
  on(listener: (event: NetworkEvent) => void): () => void
  /** One fixed step: lets out what each running leak lets out, to the fluid world and the spray. */
  step(dt: number): void
  /** Takes out what the blasts made (taps, lids, holes' state); the world's own `reset` closes the pits and the pools. */
  reset(): void
  dispose(): void
}

/** A turn about y as the quaternion `game-destruction` takes. */
const turnOf = (ry: number): [number, number, number, number] => [0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]

/**
 * What a blast does to the buried networks beyond breaking them: a severed pipe leaks into the crater (`game-fluids` taps, water sprayed up under pressure, sewage a slow dark run, the
 * drainage only when it rains), finite; a main that breaks cuts the water to the houses downstream (an outage event); a cover that was thrown leaves its shaft open in the ground
 * (`Terrain.open`) and flies off as a plate of cast iron, a loose piece of the destruction world that lands and stays.
 */
export function createDistrictLeaks({ world, scene, generated, sewers, isRaining, houses, lamps }: LeaksParams): DistrictLeaks {
  const { networks } = generated
  const fluids = world.liquids.fluids
  const events: NetworkEvent[] = []
  const listeners = new Set<(event: NetworkEvent) => void>()
  const running: LeakState[] = []
  const severed = new Set<string>()
  const dryLots = new Set<string>()
  const darkLots = new Set<string>()
  const darkLamps = new Set<string>()
  const lids = new Map<string, { readonly draw: ReturnType<DistrictSewers['drawLid']> }>()
  const emit = (event: NetworkEvent): void => {
    events.push(event)
    for (const listener of listeners) listener(event)
  }

  function startLeakAt(leak: NetworkLeak, pipe: { readonly from: readonly number[]; readonly to: readonly number[] }): void {
    const [dx, dz] = [(pipe.to[0] ?? 0) - (pipe.from[0] ?? 0), (pipe.to[2] ?? 0) - (pipe.from[2] ?? 0)]
    const length = Math.hypot(dx, dz) || 1
    const [ux, uz] = [dx / length, dz / length]
    const origin: [number, number, number] = [leak.at[0], leak.at[1] + leak.diameter / 2, leak.at[2]]
    // a main under pressure comes up out of the ground, leaning a little across its line; the rest runs down the line of the pipe
    const direction: [number, number, number] = leak.isPressurised ? [-uz * 0.3, 1, ux * 0.3] : [ux, -0.2, uz]
    fluids.addTap({ id: `leak:${leak.id}`, position: origin, direction, liquid: LIQUID_OF[leak.content], rate: leak.rate })
    running.push(startLeak(leak))
    emit({ type: 'network_leak', leak })
  }

  function openHole(piece: SurfacePiece, crater: Crater): void {
    const opening = openingOf(piece)
    const body = coverBodyOf(piece)
    if (opening === undefined || body === undefined) return
    world.ground.terrain.open(opening)
    const draw = sewers.drawLid(piece)
    draw.root.position.set(...body.position)
    draw.root.rotation.y = body.ry
    scene.add(draw.root)
    world.destruction.world.add(body.spec, { id: body.id, position: [...body.position], rotation: turnOf(body.ry) })
    world.destruction.renderer.bind(body.id, draw.root)
    world.destruction.renderer.makePiece(body.id, { mass: body.mass, velocity: [...coverThrowOf(piece, crater)] })
    lids.set(body.id, { draw })
    emit({ type: 'network_hole', id: piece.id, kind: piece.kind })
  }

  function handle(breach: Breach, crater: Crater): void {
    const pipes = new Map(sewers.buried.pipes.map((pipe) => [pipe.id, pipe]))
    const fresh = breach.pipes.filter((reached) => reached.severed && !severed.has(reached.id)).map((reached) => reached.id)
    for (const leak of leaksOf(networks, { ...breach, pipes: breach.pipes.filter((reached) => fresh.includes(reached.id)) }, { isRaining: isRaining() })) startLeakAt(leak, pipes.get(leak.id)!)
    const before = [...severed]
    for (const id of fresh) severed.add(id)
    const outage: NetworkOutage | undefined = waterOutageOf(networks, { before, after: [...severed] })
    if (outage !== undefined) {
      for (const lot of outage.lots) {
        dryLots.add(lot)
        houses.setLotWater(lot, false)
      }
      emit({ type: 'network_outage', outage })
    }
    // a duct of underground power cut: the houses past it lose their grid, the lamps past it go out
    const dark = powerOutageOf(networks, { before, after: [...severed] })
    if (dark !== undefined) {
      for (const lot of dark.lots.filter((id) => !darkLots.has(id))) {
        darkLots.add(lot)
        houses.setLotGrid(lot, false)
      }
      const lights = (dark.lights ?? []).filter((id) => !darkLamps.has(id))
      for (const id of lights) darkLamps.add(id)
      lamps?.setLampsPowered(lights, false)
      emit({ type: 'network_outage', outage: dark })
    }
    for (const id of breach.surface) {
      const piece = sewers.surface.pieces.find((entry) => entry.id === id)
      if (piece !== undefined) openHole(piece, crater)
    }
  }

  function step(dt: number): void {
    for (let index = running.length - 1; index >= 0; index--) {
      const state = running[index]!
      const out = drainLeak(state, dt)
      const id = `leak:${state.leak.id}`
      if (state.remaining <= 0) {
        fluids.removeTap(id)
        running.splice(index, 1)
        continue
      }
      fluids.setTap(id, true, dt > 0 ? out / dt : 0)
      if (state.leak.isPressurised) world.effects.world.burst('drips', [state.leak.at[0], state.leak.at[1] + state.leak.diameter / 2, state.leak.at[2]], [0, 1, 0], Math.min(MAX_SPRAY_PER_STEP, Math.ceil(out * SPRAY_PER_LITER)), SPRAY_SPEED)
    }
  }

  function clear(): void {
    for (const state of running) fluids.removeTap(`leak:${state.leak.id}`)
    running.length = 0
    for (const [id, { draw }] of lids) {
      world.destruction.renderer.unbind(id)
      world.destruction.world.remove(id)
      draw.root.parent?.remove(draw.root)
      draw.dispose()
    }
    lids.clear()
    severed.clear()
    for (const lot of dryLots) houses.setLotWater(lot, true)
    dryLots.clear()
    for (const lot of darkLots) houses.setLotGrid(lot, true)
    darkLots.clear()
    lamps?.setLampsPowered([...darkLamps], true)
    darkLamps.clear()
    events.length = 0
  }

  const stop = sewers.onBreach(handle)
  return {
    events,
    running,
    dryLots,
    darkLots,
    darkLamps,
    get lids() {
      return [...lids.keys()]
    },
    on(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    step,
    reset: clear,
    dispose() {
      stop()
      clear()
      listeners.clear()
    },
  }
}
