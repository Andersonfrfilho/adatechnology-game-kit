import type { CameraMode } from './types'

/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type CameraLocale = 'en' | 'pt-BR'

export interface CameraStrings {
  /** Display name of each mode (used by the built-in selector). */
  modeLabels: Record<CameraMode, string>
  /** Default caption of the built-in selector. */
  selectorLabel: string
}

export const locales: Record<CameraLocale, CameraStrings> = {
  en: {
    modeLabels: { shoulder: 'shoulder', third: 'third person', first: 'first person' },
    selectorLabel: 'Camera',
  },
  'pt-BR': {
    modeLabels: { shoulder: 'ombro', third: 'terceira pessoa', first: 'primeira pessoa' },
    selectorLabel: 'Câmera',
  },
}

export const resolveStrings = (locale: string | undefined): CameraStrings =>
  locales[(locale as CameraLocale) ?? 'en'] ?? locales.en
