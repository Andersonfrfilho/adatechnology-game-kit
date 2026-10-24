import type { ScreenState } from '@adatechnology/game-vfx'

export interface ScreenOverlay {
  update(state: Readonly<ScreenState>): void
  dispose(): void
}

const clamp = (value: number, min: number, max: number): number => (value < min ? min : value > max ? max : value)

function layer(container: HTMLElement, name: string, blend?: string): HTMLDivElement {
  const element = container.ownerDocument.createElement('div')
  element.dataset.vfxOverlay = name
  Object.assign(element.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0' })
  if (blend) element.style.mixBlendMode = blend
  container.appendChild(element)
  return element
}

/**
 * The screen effects as overlays inside the host's container: the Lab's white flash (L1087, `mix-blend-mode: screen`) and the Workshop's white,
 * red edge, the two sides and the gas tint (W356-366), with the same colours. Nothing is drawn while the state is at rest.
 */
export function createScreenOverlay(container: HTMLElement): ScreenOverlay {
  const flash = layer(container, 'flash', 'screen')
  flash.style.background = '#fff'
  const white = layer(container, 'white')
  const red = layer(container, 'red')
  const sides = layer(container, 'sides')
  const gas = layer(container, 'gas')
  const elements = [flash, white, red, sides, gas]
  return {
    update(state) {
      flash.style.opacity = clamp(state.flash, 0, 1).toFixed(3)
      white.style.opacity = '1'
      white.style.background = `rgba(235,240,255,${clamp(state.white, 0, 1).toFixed(2)})`
      red.style.opacity = '1'
      red.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(170,16,12,${(clamp(state.red, 0, 1) * 0.85).toFixed(2)}) 100%)`
      sides.style.opacity = '1'
      sides.style.background = `linear-gradient(90deg, rgba(190,20,14,${(state.directionLeft * 0.8).toFixed(2)}) 0%, transparent 35%, transparent 65%, rgba(190,20,14,${(state.directionRight * 0.8).toFixed(2)}) 100%)`
      gas.style.opacity = '1'
      gas.style.background = state.gas > 0.01 ? `rgba(90,130,40,${(state.gas * 0.55).toFixed(2)})` : 'transparent'
    },
    dispose() {
      for (const element of elements) element.remove()
    },
  }
}
