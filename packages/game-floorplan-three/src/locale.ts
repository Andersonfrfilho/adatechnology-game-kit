/** Texts the house shows to the player (interaction prompts, messages, outbuilding labels), by locale. */
export type Messages = Record<string, string>

export const en: Messages = {
  'prompt.open': 'E: open {what}',
  'prompt.close': 'E: close {what}',
  'prompt.lockedDoor': 'E: locked door',
  'prompt.lightOn': 'E: turn on the light',
  'prompt.lightOff': 'E: turn off the light',
  'what.door': 'the door',
  'what.curtain': 'the curtain',
  'what.mailbox': 'the mailbox',
  'what.pedestrianGate': 'the small gate',
  'what.garageGate': 'the garage gate',
  'what.drawer': 'drawer',
  'what.wardrobe': 'wardrobe',
  'what.fridge': 'fridge',
  'what.pantry': 'pantry',
  'what.cabinet': 'cabinet',
  'warn.interactablesIncomplete': 'floorplan-three: cfg.interactives is incomplete (GameInteractables, GameInteractablesHousehold, GameInteractablesThree)',
  'message.locked': 'Locked.',
  'message.boarded': 'Locked: the door is boarded up.',
  'message.pickedUp': 'Picked up: {name}{qty}',
  'outbuilding.guest_room': 'Outbuilding (guest room)',
  'outbuilding.office': 'Outbuilding (office)',
  'outbuilding.storage': 'Outbuilding (storage)',
  'outbuilding.gourmet': 'Outbuilding (gourmet space)',
}

export const ptBR: Messages = {
  'prompt.open': 'E: abrir {what}',
  'prompt.close': 'E: fechar {what}',
  'prompt.lockedDoor': 'E: porta trancada',
  'prompt.lightOn': 'E: acender a luz',
  'prompt.lightOff': 'E: apagar a luz',
  'what.door': 'a porta',
  'what.curtain': 'a cortina',
  'what.mailbox': 'a caixa de correio',
  'what.pedestrianGate': 'o portãozinho',
  'what.garageGate': 'o portão da garagem',
  'what.drawer': 'gaveta',
  'what.wardrobe': 'guarda-roupa',
  'what.fridge': 'geladeira',
  'what.pantry': 'despensa',
  'what.cabinet': 'armário',
  'warn.interactablesIncomplete': 'floorplan-three: cfg.interactives incompleto (GameInteractables, GameInteractablesHousehold, GameInteractablesThree)',
  'message.locked': 'Trancada.',
  'message.boarded': 'Trancada: a porta está bloqueada com tábuas.',
  'message.pickedUp': 'Pegou: {name}{qty}',
  'outbuilding.guest_room': 'Edícula (quarto de visita)',
  'outbuilding.office': 'Edícula (escritório)',
  'outbuilding.storage': 'Edícula (depósito)',
  'outbuilding.gourmet': 'Edícula (espaço gourmet)',
}

export const locales: Record<string, Messages> = { en, 'pt-BR': ptBR }

export type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * Translator for a locale id ('en', 'pt-BR'), or for a partial table that overrides the English one.
 * A missing key falls back to English and then to the key itself.
 */
export function createTranslator(locale?: string | Partial<Messages>): Translate {
  const table: Messages = typeof locale === 'string' ? (locales[locale] ?? en) : { ...en, ...(locale ?? {}) }
  return (key, params) => {
    const text = table[key] ?? en[key] ?? key
    return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] != null ? String(params[name]) : '')) : text
  }
}
