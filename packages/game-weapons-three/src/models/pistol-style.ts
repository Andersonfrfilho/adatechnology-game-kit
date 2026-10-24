import type * as THREE from 'three'

export interface PistolStyle {
  rf: number
  ga: number
  grip: 'finger' | 'panel' | 'wood' | 'rubber' | 'star' | 'chunky'
  guard: 'square' | 'round' | 'hook'
  rail?: number
  sight: 'u' | '3dot' | 'small'
  port: number
  slideM?: string
  frame: 'poly' | 'metal'
  frontSer?: number
  safety?: 'thumb' | 'slide'
  hammer?: 'spur' | 'ring' | 'big'
  open?: number
  decock?: 'slide' | 'frame'
  tall?: number
  inset?: number
  bushing?: number
  beaver?: number
  slideStop?: number
  flush?: number
  lanyard?: number
  slope?: number
  tri?: number
}

export const STYLES: Record<string, PistolStyle> = {
  glock: { rf: 0.07, ga: -0.36, grip: 'finger', guard: 'square', rail: 1, sight: 'u', port: 0.2, slideM: 'metal', frame: 'poly' },
  taurus: { rf: 0.16, ga: -0.3, grip: 'panel', guard: 'square', rail: 1, sight: '3dot', port: 0.18, frontSer: 1, frame: 'poly' },
  g2c: { rf: 0.2, ga: -0.3, grip: 'panel', guard: 'round', rail: 0, sight: '3dot', port: 0.17, frame: 'poly', safety: 'thumb' },
  beretta: { rf: 0.28, ga: -0.27, grip: 'wood', guard: 'round', hammer: 'spur', sight: '3dot', open: 1, decock: 'slide', port: 0, frame: 'metal' },
  pt100: { rf: 0.25, ga: -0.27, grip: 'rubber', guard: 'round', hammer: 'spur', sight: '3dot', port: 0.17, decock: 'frame', frame: 'metal' },
  sig: { rf: 0.14, ga: -0.3, grip: 'rubber', guard: 'hook', hammer: 'spur', sight: '3dot', port: 0.19, decock: 'frame', rail: 1, tall: 1.12, frame: 'metal' },
  cz: { rf: 0.32, ga: -0.3, grip: 'rubber', guard: 'round', hammer: 'spur', sight: '3dot', port: 0.15, inset: 1, safety: 'thumb', frame: 'metal' },
  m1911: { rf: 0.24, ga: -0.2, grip: 'wood', guard: 'round', hammer: 'ring', sight: 'small', port: 0.12, bushing: 1, beaver: 1, safety: 'thumb', slideStop: 1, frame: 'metal' },
  makarov: { rf: 0.48, ga: -0.24, grip: 'star', guard: 'round', hammer: 'ring', sight: 'small', port: 0.14, flush: 1, safety: 'slide', lanyard: 1, frame: 'metal' },
  fiveseven: { rf: 0.2, ga: -0.4, grip: 'chunky', guard: 'square', rail: 1, sight: '3dot', port: 0.18, slope: 1, frame: 'poly' },
  deagle: { rf: 0.08, ga: -0.28, grip: 'rubber', guard: 'round', hammer: 'big', sight: 'small', port: 0.16, tri: 1, safety: 'slide', frame: 'metal' },
}

export type Material = THREE.Material

export interface PistolSize {
  length: number
  height: number
  width: number
}
