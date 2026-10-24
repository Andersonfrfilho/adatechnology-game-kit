/** The words of the effects bench, per locale (the effects' own texts live in `@adatechnology/game-vfx`). */
export interface BenchText {
  readonly module: string
  readonly controls: Readonly<Record<'effect' | 'variant' | 'replay' | 'auto_repeat' | 'distance' | 'lod_band' | 'quality', string>>
  readonly lod: Readonly<Record<'auto' | 'near' | 'middle' | 'far', string>>
  readonly quality: Readonly<Record<'high' | 'medium' | 'low', string>>
  readonly layers: Readonly<Record<'puffs' | 'sparks' | 'glows' | 'debris' | 'shock' | 'sprites', string>>
  readonly metrics: Readonly<Record<'puffs' | 'sparks' | 'debris' | 'lights' | 'budget_particles' | 'lod' | 'phase' | 'blast_time', string>>
  readonly sheet: Readonly<Record<'explosion' | 'lethal' | 'injury' | 'radius' | 'fireballs' | 'particles' | 'scale', string>>
  readonly none: string
}

export const benchTexts: Readonly<Record<string, BenchText>> = {
  en: {
    module: 'Effects',
    controls: { effect: 'Effect', variant: 'Variant', replay: 'Replay', auto_repeat: 'Auto replay', distance: 'Distance', lod_band: 'LOD band', quality: 'Quality' },
    lod: { auto: 'Auto', near: 'Near', middle: 'Middle', far: 'Far' },
    quality: { high: 'High', medium: 'Medium', low: 'Low' },
    layers: { puffs: 'Smoke and fire', sparks: 'Sparks', glows: 'Glows', debris: 'Debris', shock: 'Shock wave', sprites: 'Droplets and recipes' },
    metrics: { puffs: 'Puffs', sparks: 'Sparks', debris: 'Debris', lights: 'Lights', budget_particles: 'Particles of the effect', lod: 'LOD scale', phase: 'Time since replay', blast_time: 'Time since the blast' },
    sheet: { explosion: 'Explosion', lethal: 'Lethal radius', injury: 'Injury radius', radius: 'Fireball', fireballs: 'Fireballs', particles: 'Particles', scale: 'Scale' },
    none: 'None',
  },
  'pt-BR': {
    module: 'Efeitos',
    controls: { effect: 'Efeito', variant: 'Variante', replay: 'Repetir', auto_repeat: 'Repetição automática', distance: 'Distância', lod_band: 'Faixa de LOD', quality: 'Qualidade' },
    lod: { auto: 'Automático', near: 'Perto', middle: 'Meio', far: 'Longe' },
    quality: { high: 'Alta', medium: 'Média', low: 'Baixa' },
    layers: { puffs: 'Fumaça e fogo', sparks: 'Faíscas', glows: 'Brilhos', debris: 'Destroços', shock: 'Onda de choque', sprites: 'Gotas e receitas' },
    metrics: { puffs: 'Nuvens', sparks: 'Faíscas', debris: 'Destroços', lights: 'Luzes', budget_particles: 'Partículas do efeito', lod: 'Escala de LOD', phase: 'Tempo desde a repetição', blast_time: 'Tempo desde a explosão' },
    sheet: { explosion: 'Explosão', lethal: 'Raio letal', injury: 'Raio de ferimento', radius: 'Bola de fogo', fireballs: 'Bolas de fogo', particles: 'Partículas', scale: 'Escala' },
    none: 'Nenhuma',
  },
}

export const benchText = (locale: string): BenchText => benchTexts[locale] ?? benchTexts.en!
