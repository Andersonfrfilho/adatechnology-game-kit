/** The words of the weapon showcase, by locale. */
export interface ShowcaseText {
  readonly pedestal: string
  readonly weapon: string
  readonly weaponHint: string
  readonly none: string
  readonly spin: string
  readonly look: string
  /** `{weapon}` */
  readonly alt: string
  /** `{weapon}` */
  readonly shown: string
}

const TEXT: Readonly<Record<string, ShowcaseText>> = {
  en: {
    pedestal: 'Weapon showcase',
    weapon: 'Showcase',
    weaponHint: 'Puts the weapon on the pedestal, turning slowly, and takes the camera to it',
    none: 'None',
    spin: 'Turn the weapon',
    look: 'Look at the showcase',
    alt: 'Photo of a real {weapon}',
    shown: '{weapon} on the showcase',
  },
  'pt-BR': {
    pedestal: 'Vitrine de armas',
    weapon: 'Vitrine',
    weaponHint: 'Põe a arma no pedestal, girando devagar, e leva a câmera até ela',
    none: 'Nenhuma',
    spin: 'Girar a arma',
    look: 'Olhar a vitrine',
    alt: 'Foto de um(a) {weapon} real',
    shown: '{weapon} na vitrine',
  },
}

export const showcaseTextOf = (locale: string): ShowcaseText => TEXT[locale] ?? (TEXT.en as ShowcaseText)
