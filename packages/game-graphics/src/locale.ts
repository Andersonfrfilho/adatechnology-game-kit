export type GraphicsStrings = Readonly<Record<string, string>>

const EN: GraphicsStrings = {
  title: 'Graphics',
  preset: 'Preset',
  'preset.auto': 'Automatic',
  'preset.low': 'Low',
  'preset.medium': 'Medium',
  'preset.high': 'High',
  'preset.ultra': 'Ultra',
  'preset.custom': 'Custom',
  auto: 'Automatic',
  now: 'now {value}',
  resolutionScale: 'Resolution scale',
  hordeDetail: 'Horde detail',
  shadows: 'Shadows',
  'shadows.off': 'Off',
  'shadows.near': 'Near',
  'shadows.all': 'All',
  viewDistance: 'View distance',
  'viewDistance.short': 'Short',
  'viewDistance.medium': 'Medium',
  'viewDistance.long': 'Long',
  fpsCap: 'FPS cap',
  'fpsCap.0': 'Unlimited',
  showFps: 'Show FPS',
  on: 'On',
  off: 'Off',
  calibrating: 'Calibrating… {percent}%',
  calibrated: 'This machine came out as {tier} ({ms} ms a frame).',
  uncalibrated: 'Not calibrated on this machine yet.',
  recalibrate: 'Calibrate again',
  autoHint: 'Automatic adjusts only what is set to Automatic; what you fix by hand stays.',
  close: 'Close',
  fps: '{fps} FPS',
}

const PT: GraphicsStrings = {
  title: 'Gráficos',
  preset: 'Predefinição',
  'preset.auto': 'Automático',
  'preset.low': 'Baixa',
  'preset.medium': 'Média',
  'preset.high': 'Alta',
  'preset.ultra': 'Ultra',
  'preset.custom': 'Personalizada',
  auto: 'Automático',
  now: 'agora {value}',
  resolutionScale: 'Escala de resolução',
  hordeDetail: 'Detalhe da horda',
  shadows: 'Sombras',
  'shadows.off': 'Desligadas',
  'shadows.near': 'Próximas',
  'shadows.all': 'Todas',
  viewDistance: 'Distância de visão',
  'viewDistance.short': 'Curta',
  'viewDistance.medium': 'Média',
  'viewDistance.long': 'Longa',
  fpsCap: 'Limite de FPS',
  'fpsCap.0': 'Ilimitado',
  showFps: 'Mostrar FPS',
  on: 'Ligado',
  off: 'Desligado',
  calibrating: 'Calibrando… {percent}%',
  calibrated: 'Esta máquina ficou em {tier} ({ms} ms por quadro).',
  uncalibrated: 'Ainda não calibrado nesta máquina.',
  recalibrate: 'Calibrar de novo',
  autoHint: 'O Automático ajusta só o que está em Automático; o que você fixar à mão fica como está.',
  close: 'Fechar',
  fps: '{fps} FPS',
}

/** The screen's text: Brazilian Portuguese for a `pt` locale, English otherwise; `overrides` replace any key. */
export function graphicsStrings(locale = 'pt-BR', overrides: Partial<Record<string, string>> = {}): (key: string, vars?: Record<string, string | number>) => string {
  const base = locale.toLowerCase().startsWith('pt') ? PT : EN
  return (key, vars) => {
    let s = overrides[key] ?? base[key] ?? key
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
    return s
  }
}
