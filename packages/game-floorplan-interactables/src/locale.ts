// Texts of the adapter (warnings of a plan and errors). `pt-BR` are the team's own sentences; `en` is the default of the kit.
const en = {
  'error.missingKit': 'game-floorplan-interactables: create needs GameInteractables and GameInteractablesHousehold',
  'error.unknownOwnType': 'game-floorplan-interactables: unknown own type: {type}',
  'warn.cylinderNoCabinet': 'cylinder {id} under the counter has no kitchen cabinet to hide it',
  'warn.cabinetNoDoor': 'cabinet {cabinet} has no door for the cylinder {id}',
  'warn.switchUnknownLamp': 'switch {id} controls {lamp}, which does not exist',
  'warn.pointNoObject': 'point {id} ({kind}) has no object for {item}',
  'warn.buildEmpty': 'build returned nothing for {id}',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>

const ptBR: Messages = {
  'error.missingKit': 'game-floorplan-interactables: create precisa de GameInteractables e GameInteractablesHousehold',
  'error.unknownOwnType': 'game-floorplan-interactables: tipo próprio desconhecido: {type}',
  'warn.cylinderNoCabinet': 'botijão {id} sob a bancada sem armário de cozinha para escondê-lo',
  'warn.cabinetNoDoor': 'armário {cabinet} sem porta para o botijão {id}',
  'warn.switchUnknownLamp': 'interruptor {id} controla {lamp}, que não existe',
  'warn.pointNoObject': 'ponto {id} ({kind}) sem objeto para {item}',
  'warn.buildEmpty': 'construir devolveu vazio para {id}',
}

export const locales: Record<string, Messages> = { en, 'pt-BR': ptBR }

/** Translator for a locale (`pt-BR`, `pt`, `en`, another falls back to `en`); `table` adds or replaces keys. */
export function createTranslator(locale?: string, table?: Partial<Messages>): (key: MessageKey, params?: Record<string, string | number>) => string {
  const base = locale && /^pt/i.test(locale) ? ptBR : en
  const messages: Messages = { ...base, ...(table ?? {}) }
  return (key, params) => (messages[key] ?? key).replace(/\{(\w+)\}/g, (_m, name: string) => (params && params[name] !== undefined ? String(params[name]) : `{${name}}`))
}
