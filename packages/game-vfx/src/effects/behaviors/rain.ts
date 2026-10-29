import type { Behavior, BehaviorHost } from '../behavior'

interface InitArgs { readonly count: number; readonly wind: number }
interface UpdateArgs { readonly dt: number; readonly splash: boolean }

/**
 * The page's rain (`initRain` and `updateRain`, W321-331) as a prop an effect starts and ticks: `init` fills the box with streaks, `update` moves them and
 * leaves the splashes. The field itself lives in the engine (`engine.rain`), where the renderer reads it; the weather package drives the same field.
 */
export function createRainBehavior(): Behavior {
  return {
    reset() {},
    act(host: BehaviorHost, action: string, args: unknown) {
      const { engine, camera } = host
      if (action === 'init') {
        const { count, wind } = args as InitArgs
        engine.rain.init(count, wind)
      } else if (action === 'update') {
        const { dt, splash } = args as UpdateArgs
        engine.rain.update(dt, splash, camera.position)
      }
    },
    query(host, name) {
      if (name === 'count') return host.engine.rain.count
      if (name === 'on') return host.engine.rain.on
      throw new Error(`rain: unknown query ${name}`)
    },
    update() {},
  }
}
