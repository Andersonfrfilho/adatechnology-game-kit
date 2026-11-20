// PROTÓTIPO DESCARTÁVEL (spec 018 T0.4): sonda de tempo de `applyStructuralEvents`. Não vai para a main.
// Ligada só quando o host põe `globalThis.__destructionApplyProbe = { mode: 'fine', now, records }` antes de a página carregar; desligada, nada muda.
import { createExplodeProbe } from '@adatechnology/game-destruction'

export const applyProbe = createExplodeProbe('__destructionApplyProbe')
