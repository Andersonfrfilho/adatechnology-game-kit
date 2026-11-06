/** The words of the weapon showcase, by locale. */
export interface ShowcaseText {
  readonly pedestal: string
  readonly weapon: string
  readonly weaponHint: string
  readonly none: string
  readonly spin: string
  readonly look: string
  readonly kicker: string
  /** `{weapon}` */
  readonly alt: string
  /** `{weapon}` */
  readonly shown: string
  readonly noPhoto: string
}

const TEXT: Readonly<Record<string, ShowcaseText>> = {
  en: {
    pedestal: 'Weapon showcase',
    weapon: 'Showcase',
    weaponHint: 'Puts the weapon on the pedestal, turning slowly, takes the camera to it and shows a photo of the real one to compare with',
    none: 'None',
    spin: 'Turn the weapon',
    look: 'Look at the showcase',
    kicker: 'The real weapon',
    alt: 'Photo of a real {weapon}',
    shown: '{weapon} on the showcase',
    noPhoto: 'No free photo of this exact model was found: it is listed in missing of assets/weapon-references.json.',
  },
  'pt-BR': {
    pedestal: 'Vitrine de armas',
    weapon: 'Vitrine',
    weaponHint: 'Põe a arma no pedestal, girando devagar, leva a câmera até ela e mostra uma foto da arma real para comparar',
    none: 'Nenhuma',
    spin: 'Girar a arma',
    look: 'Olhar a vitrine',
    kicker: 'A arma real',
    alt: 'Foto de um(a) {weapon} real',
    shown: '{weapon} na vitrine',
    noPhoto: 'Não há foto livre deste modelo exato: ele está em missing de assets/weapon-references.json.',
  },
}

export const showcaseTextOf = (locale: string): ShowcaseText => TEXT[locale] ?? (TEXT.en as ShowcaseText)
