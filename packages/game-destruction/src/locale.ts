import type { DamageType, DestructionEventType, FractureStyle, JointKind, PartStatus, StructureRole, ToolKind } from './types'

/** Locales shipped with the package. Unknown locales fall back to `en`. */
export type DestructionLocale = 'en' | 'pt-BR'

export interface DestructionStrings {
  /** Display name per material id (see `MATERIALS`). Unknown ids are not listed. */
  materialNames: Record<string, string>
  partStatus: Record<PartStatus, string>
  jointKinds: Record<JointKind, string>
  toolKinds: Record<ToolKind, string>
  damageTypes: Record<DamageType, string>
  /** Short label per event type, for logs and kill-feed style text. */
  eventLabels: Record<DestructionEventType, string>
  fractureStyles: Record<FractureStyle, string>
  structureRoles: Record<StructureRole, string>
}

export const locales: Record<DestructionLocale, DestructionStrings> = {
  en: {
    materialNames: {
      steel: 'steel', cast_iron: 'cast iron', aluminium: 'aluminium', copper: 'copper', wood_soft: 'softwood', wood_hard: 'hardwood', plywood: 'plywood',
      mdf: 'MDF', glass: 'glass', tempered_glass: 'tempered glass', ceramic: 'ceramic', concrete: 'concrete', brick: 'brick', plaster: 'plaster',
      stone: 'stone', plastic: 'plastic', rubber: 'rubber', fabric: 'fabric', foam: 'foam', leather: 'leather', paper: 'paper', foliage: 'foliage',
      green_wood: 'green wood', cactus: 'cactus', flesh_fruit: 'fruit', wax: 'wax', soil: 'soil',
    },
    partStatus: { intact: 'intact', damaged: 'damaged', collapsed: 'collapsed', broken: 'broken', melted: 'melted', ashes: 'ashes' },
    jointKinds: {
      screw: 'screw', bolt: 'nut and bolt', nail: 'nail', weld: 'weld', glue: 'glue', hinge: 'hinge', clip: 'clip', tie: 'tie', mortar: 'mortar',
      fused: 'fused', stem: 'stem', rebar: 'rebar', resting: 'resting',
    },
    toolKinds: {
      hand: 'hand', screwdriver: 'screwdriver', wrench: 'wrench', pry_bar: 'pry bar', saw: 'saw', cutting_torch: 'cutting torch', knife: 'knife', hammer: 'hammer',
    },
    damageTypes: { ballistic: 'ballistic', blunt: 'blunt', slash: 'slash', explosive: 'explosive', fire: 'fire', heat: 'heat' },
    eventLabels: {
      damage: 'damage', dent: 'dent', hole: 'hole', crack: 'crack', ricochet: 'ricochet', debris: 'debris', fracture: 'broke', detach: 'came loose',
      disassemble_progress: 'taking apart', ignite: 'caught fire', extinguish: 'put out', burnout: 'burned to ash', melt: 'melting', drip: 'dripping',
      leak: 'leak', explode: 'exploded', primed: 'about to explode', stress: 'overload', collapse: 'collapsed', spall: 'plaster came off', stage: 'damage stage', expose: 'rebar bare', destroyed: 'destroyed',
    },
    fractureStyles: { shatter: 'shatter', crumble: 'crumble', splinter: 'splinter', tear: 'tear', snap: 'snap', none: 'none' },
    structureRoles: { foundation: 'foundation', column: 'column', beam: 'beam', slab: 'slab', wall: 'wall', partition: 'partition', roof: 'roof', stair: 'stairs', none: 'none' },
  },
  'pt-BR': {
    materialNames: {
      steel: 'aço', cast_iron: 'ferro fundido', aluminium: 'alumínio', copper: 'cobre', wood_soft: 'madeira macia', wood_hard: 'madeira de lei',
      plywood: 'compensado', mdf: 'MDF', glass: 'vidro', tempered_glass: 'vidro temperado', ceramic: 'cerâmica', concrete: 'concreto', brick: 'tijolo',
      plaster: 'gesso', stone: 'pedra', plastic: 'plástico', rubber: 'borracha', fabric: 'tecido', foam: 'espuma', leather: 'couro', paper: 'papel',
      foliage: 'folhagem', green_wood: 'madeira verde', cactus: 'cacto', flesh_fruit: 'fruta', wax: 'cera', soil: 'terra',
    },
    partStatus: { intact: 'intacto', damaged: 'danificado', collapsed: 'desabado', broken: 'quebrado', melted: 'derretido', ashes: 'cinzas' },
    jointKinds: {
      screw: 'parafuso', bolt: 'porca e parafuso', nail: 'prego', weld: 'solda', glue: 'cola', hinge: 'dobradiça', clip: 'encaixe', tie: 'amarração',
      mortar: 'argamassa', fused: 'fundido', stem: 'caule', rebar: 'vergalhão', resting: 'apoiado',
    },
    toolKinds: {
      hand: 'mão', screwdriver: 'chave de fenda', wrench: 'chave inglesa', pry_bar: 'pé de cabra', saw: 'serra', cutting_torch: 'maçarico', knife: 'faca', hammer: 'martelo',
    },
    damageTypes: { ballistic: 'tiro', blunt: 'impacto', slash: 'corte', explosive: 'explosão', fire: 'fogo', heat: 'calor' },
    eventLabels: {
      damage: 'dano', dent: 'amassado', hole: 'furo', crack: 'trinca', ricochet: 'ricochete', debris: 'estilhaços', fracture: 'quebrou', detach: 'soltou',
      disassemble_progress: 'desmontando', ignite: 'pegou fogo', extinguish: 'apagou', burnout: 'virou cinza', melt: 'derretendo', drip: 'pingando',
      leak: 'vazamento', explode: 'explodiu', primed: 'prestes a explodir', stress: 'sobrecarga', collapse: 'desabou', spall: 'reboco soltou', stage: 'estágio de dano', expose: 'vergalhão à mostra', destroyed: 'destruído',
    },
    fractureStyles: { shatter: 'estilhaçar', crumble: 'esfarelar', splinter: 'lascar', tear: 'rasgar', snap: 'partir', none: 'nenhuma' },
    structureRoles: { foundation: 'fundação', column: 'pilar', beam: 'viga', slab: 'laje', wall: 'parede', partition: 'divisória', roof: 'telhado', stair: 'escada', none: 'nenhum' },
  },
}

export const resolveStrings = (locale: string | undefined): DestructionStrings => locales[(locale as DestructionLocale) ?? 'en'] ?? locales.en
