/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type DevtoolsLocale = 'en' | 'pt-BR'

/** Every user-facing default string. Override any of them with the `strings` option. */
export interface DevtoolsStrings {
  /** Eight compass headings starting at north, clockwise (N, NE, E, SE, S, SW, W, NW). */
  compass: [string, string, string, string, string, string, string, string]
  /** Label of the default team. */
  defaultTeam: string
  /** Default file name of the downloaded marks file. */
  fileName: string
  /** aria-label of the "mark this place" form. */
  markFormLabel: string
  /** aria-label and title of the main panel. */
  panelTitle: string
  markHereTitle: string
  /** Word before the heading in position lines ("looking N 12"). */
  lookingAt: string
  teamLabel: string
  notePlaceholder: string
  saveButton: string
  cancelButton: string
  yes: string
  no: string
  placesTitle: string
  marksTitle: (count: number) => string
  savedOnServer: string
  savedInBrowser: string
  noNote: string
  goButton: string
  deleteButton: string
  noMarks: string
  copyAll: string
  downloadFile: string
  closeButton: string
  copied: string
  copySelected: string
  savedServerMsg: string
  serverFailMsg: string
  savedBrowserMsg: string
  hudLook: string
  hudFlight: (speed: string) => string
  hudMarks: (count: number) => string
}

export const locales: Record<DevtoolsLocale, DevtoolsStrings> = {
  en: {
    compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    defaultTeam: 'General',
    fileName: 'marks.txt',
    markFormLabel: 'Mark adjustment',
    panelTitle: 'Free mode',
    markHereTitle: 'Mark this place',
    lookingAt: 'looking',
    teamLabel: 'Team',
    notePlaceholder: 'What should be adjusted here?',
    saveButton: 'Save (Enter)',
    cancelButton: 'Cancel (Esc)',
    yes: 'yes',
    no: 'no',
    placesTitle: 'Test places',
    marksTitle: (n) => `Marks (${n})`,
    savedOnServer: "Saved on this page's server: Claude reads them directly, no need to copy.",
    savedInBrowser: 'Saved in this browser. To send them: Copy all and paste in the chat, or Download file.',
    noNote: '(no note)',
    goButton: 'Go',
    deleteButton: 'Delete',
    noMarks: 'No marks yet.',
    copyAll: 'Copy all',
    downloadFile: 'Download file',
    closeButton: 'Close (Esc)',
    copied: 'Copied',
    copySelected: 'Selected: Ctrl+C',
    savedServerMsg: 'Mark saved. Claude can already read it',
    serverFailMsg: "Could not save to the server, it stayed in this browser",
    savedBrowserMsg: 'Mark saved in this browser. Open the panel to copy',
    hudLook: 'look',
    hudFlight: (speed) => `fly ${speed} m/s`,
    hudMarks: (n) => `${n} ${n === 1 ? 'mark' : 'marks'}`,
  },
  'pt-BR': {
    compass: ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'],
    defaultTeam: 'Geral',
    fileName: 'marcas.txt',
    markFormLabel: 'Marcar ajuste',
    panelTitle: 'Modo livre',
    markHereTitle: 'Marcar este lugar',
    lookingAt: 'olhando',
    teamLabel: 'Equipe',
    notePlaceholder: 'O que ajustar aqui?',
    saveButton: 'Salvar (Enter)',
    cancelButton: 'Cancelar (Esc)',
    yes: 'sim',
    no: 'não',
    placesTitle: 'Lugares de teste',
    marksTitle: (n) => `Marcas (${n})`,
    savedOnServer: 'Salvas no servidor desta página: Claude lê direto, não precisa copiar.',
    savedInBrowser: 'Salvas neste navegador. Para mandar: Copiar tudo e colar no chat, ou Baixar arquivo.',
    noNote: '(sem nota)',
    goButton: 'Ir',
    deleteButton: 'Apagar',
    noMarks: 'Nenhuma marca ainda.',
    copyAll: 'Copiar tudo',
    downloadFile: 'Baixar arquivo',
    closeButton: 'Fechar (Esc)',
    copied: 'Copiado',
    copySelected: 'Selecionado: Ctrl+C',
    savedServerMsg: 'Marca salva. Claude já consegue ler',
    serverFailMsg: 'Não deu para salvar no servidor, ficou neste navegador',
    savedBrowserMsg: 'Marca salva neste navegador. Abra o painel para copiar',
    hudLook: 'olhar',
    hudFlight: (speed) => `voo ${speed} m/s`,
    hudMarks: (n) => `${n} marcas`,
  },
}

export const resolveStrings = (locale?: string, overrides?: Partial<DevtoolsStrings>): DevtoolsStrings => ({
  ...(locales[locale as DevtoolsLocale] ?? locales.en),
  ...overrides,
})
