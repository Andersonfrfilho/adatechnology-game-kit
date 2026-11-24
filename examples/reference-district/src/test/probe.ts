import type { District } from '../game/options'
import { createScriptWorld } from './actions'
import type { PageChoice } from './scenario'
import { scriptOf } from './scenario'
import { runScript } from './runner'
import type { RunResult } from './runner'
import type { Script, ScriptId, Scripts } from './scripts'

/** What a probe of the page can do (`window.__district`): look at the world, move the body, run steps of the simulation and draw one. Nothing here is in `src/game`. */
export type DistrictProbe = {
  readonly district: District
  readonly choice: PageChoice
  /** Runs `seconds` of simulation at the fixed step, with no drawing. */
  advance(seconds: number): void
  /** Draws one frame now. */
  draw(): void
  /** Puts the body at a point looking along `yaw`, with the camera in `mode`; the camera eases to its place over the next frames. */
  place(spot: { readonly x: number; readonly z: number; readonly yaw: number; readonly pitch?: number; readonly mode?: 'shoulder' | 'first' }): void
  /** Runs a script (the page scenario's by default) at the fixed step, never wall-clock, and answers the hash of the world at the end of each phase. Run it on a page opened with `?roteiro=1`, with no display loop. */
  run(script?: Script | ScriptId): RunResult
  /** The phase the last `run` is in (the gauge reads it). */
  readonly phase: string | undefined
  /** One frame from above as a PNG data URL: the plan sheet that checks the coordinates of the data files by eye. A debug print only, never a camera of the game. */
  planSheet(): string
  /** Counts of what stands in the scene, for a check. */
  info(): { readonly houses: number; readonly zombies: number; readonly missing: number; readonly physics: string; readonly drawCalls: number; readonly triangles: number }
}

const PLAN_CENTRE = [0, 0] as const
const PLAN_HEIGHT = 330
const PLAN_FOV = 60

export function createProbe(district: District, choice: PageChoice, scripts: Scripts): DistrictProbe {
  const { world, player } = district
  let phase: string | undefined
  return {
    get phase() {
      return phase
    },
    run(chosen) {
      const script = typeof chosen === 'object' ? chosen : chosen ? scripts.scripts.find((candidate) => candidate.id === chosen) : scriptOf(scripts, choice.scenario)
      if (!script) throw new Error(`the page has no script "${String(chosen)}"`)
      return runScript(createScriptWorld(district, { seed: script.seed }), script, scripts.scenarios[choice.scenario], { onPhase: (edge) => void (phase = edge.edge === 'start' ? edge.id : undefined) })
    },
    district,
    choice,
    advance: (seconds) => world.frame.scheduler.advance(seconds),
    draw: () => world.render(),
    place(spot) {
      player.player.state.x = spot.x
      player.player.state.z = spot.z
      player.view.yaw = spot.yaw
      player.view.pitch = spot.pitch ?? 0.1
      if (spot.mode) player.setMode(spot.mode)
    },
    planSheet() {
      const { camera, scene, gl } = world.view
      const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, far: camera.far, up: camera.up.clone(), fog: scene.fog }
      scene.fog = null
      camera.fov = PLAN_FOV
      camera.far = PLAN_HEIGHT * 4
      camera.up.set(0, 0, -1)
      camera.position.set(PLAN_CENTRE[0], PLAN_HEIGHT, PLAN_CENTRE[1])
      camera.lookAt(PLAN_CENTRE[0], 0, PLAN_CENTRE[1])
      camera.updateProjectionMatrix()
      world.render()
      const url = gl.domElement.toDataURL('image/png')
      camera.position.copy(saved.position)
      camera.quaternion.copy(saved.quaternion)
      camera.up.copy(saved.up)
      camera.fov = saved.fov
      camera.far = saved.far
      camera.updateProjectionMatrix()
      scene.fog = saved.fog
      return url
    },
    info: () => ({
      houses: district.houses.list.length,
      zombies: district.horde.crowd.store.n,
      missing: district.site.missing.length,
      physics: world.info.physics.kind,
      drawCalls: world.view.gl.info.render.calls,
      triangles: world.view.gl.info.render.triangles,
    }),
  }
}
