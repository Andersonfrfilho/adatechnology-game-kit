import { RELOAD_STAGES } from '@adatechnology/game-weapons'
import type { ReloadFamily } from '@adatechnology/game-weapons'
import type { ReloadRun, WeaponAudit } from './weapon-audit'

/** The reload family a model stands for when the catalog gives none (the generic archetypes). */
const FAMILY_OF_MODEL: Record<string, ReloadFamily> = { pistol: 'pistol', revolver: 'revolver', rifle: 'magazine', semiint: 'tube_semi', semi12: 'tube_semi', p90: 'top_magazine', belt: 'belt', pump: 'pump', lever: 'lever', bolt: 'bolt', boltmag: 'bolt_magazine', break: 'break', rocket: 'rocket', flame: 'flame' }

/** The steps of the rule's reload (`RELOAD_STAGES`) in words. */
const STAGE_TEXT: Record<string, string> = {
  magazine_out: 'solta e tira o carregador',
  magazine_in: 'encaixa o carregador (clique)',
  round_in: 'põe o cartucho',
  pump_cycle: 'bombeia',
  lever_cycle: 'aciona a alavanca',
  bolt_open: 'abre o ferrolho',
  bolt_close: 'fecha o ferrolho',
  cover_open: 'abre a tampa',
  belt_swap: 'troca a cinta',
  cover_close: 'fecha a tampa',
  cylinder_open: 'abre o tambor',
  cylinder_eject: 'ejeta as cápsulas',
  cylinder_load: 'carrega com o speedloader',
  cylinder_close: 'fecha o tambor',
  barrels_open: 'abre os canos',
  casings_eject: 'ejeta os estojos',
  rounds_in: 'põe os cartuchos',
  barrels_close: 'fecha os canos',
  breech_open: 'abre a culatra',
  breech_close: 'fecha a culatra',
  rocket_seat: 'encaixa o foguete',
  tube_drop: 'larga o tubo vazio',
  tube_seat: 'encaixa o tubo novo',
  tank_swap: 'troca o tanque',
}

const CHARGE_TEXT: Record<string, string> = {
  slide_rear: 'a mão de apoio puxa o ferrolho (a culatra) pela traseira e solta',
  thumb_release: 'o polegar da mão de tiro solta a trava do ferrolho',
  rear_top: 'a mão de apoio puxa a alavanca de armar, atrás e em cima',
  side_right: 'a mão de apoio puxa a alavanca de armar, no lado direito',
}

/** What each hand does to which part in the clip (`data/hand-work.json`), in words. */
const WORK_TEXT: Record<string, string> = {
  slide_rear: 'mão de apoio na traseira do ferrolho',
  thumb_release: 'polegar na trava do ferrolho',
  rear_top: 'mão de apoio na alavanca de armar (atrás, em cima)',
  side_right: 'mão de apoio na alavanca de armar (lado direito)',
  cover_top: 'mão de apoio na tampa',
  top_handle: 'mão de tiro na alavanca do ferrolho',
  loading_port: 'mão de tiro leva os cartuchos à janela de carga',
  cylinder_side: 'mão de apoio no tambor aberto',
}

export const secondsText = (seconds: number): string => `${seconds.toFixed(2).replace('.', ',')} s`

const fixed = (text: string): string => text.replace(/\|/g, '\\|')

const stepsOf = (audit: WeaponAudit, run: ReloadRun): string => {
  const clipName = run.clip?.name ?? 'reload'
  const charge = audit.works.find((work) => work.clips.includes(clipName) && CHARGE_TEXT[work.anchor] !== undefined)
  const kind = run.kind as 'tactical' | 'empty' | 'one_by_one'
  const byModel = audit.family === undefined ? RELOAD_STAGES[FAMILY_OF_MODEL[audit.modelFamily] ?? 'magazine']?.[kind] : undefined
  const stages = (run.stages.length > 0 ? run.stages : (run.clip?.markers.length ? run.clip.markers : (byModel ?? []))).map((entry) => entry.stage)
  const words = stages.map((stage) => (stage === 'charge' ? (charge ? (CHARGE_TEXT[charge.anchor] ?? 'arma') : 'arma a ação (puxa a alavanca de armar)') : (STAGE_TEXT[stage] ?? stage)))
  if (words.length > 0) return words.join(', ')
  return 'só o movimento do clipe do modelo'
}

const familyText = (audit: WeaponAudit): string => audit.family ?? `(sem família na regra; passos da família do modelo \`${audit.modelFamily}\`)`

const sourceText = (audit: WeaponAudit): string => {
  const action = audit.def.action
  const sources = (audit.def as { sources?: readonly string[] }).sources ?? []
  const timings = 'timings' in action ? action.timings : undefined
  const parts = [`regra: ${sources.length > 0 ? sources.join(', ') : 'catálogo'}`]
  if (timings?.reloadEmpty !== undefined) parts.push('vazia: dado da arma (`timings.reloadEmpty`)')
  else parts.push('vazia: padrão da família (= tempo da tática)')
  return parts.join('; ')
}

/** The table of reloads by weapon (pt-BR) that goes to `specs/001-migracao-entregas-dos-times/recargas-por-arma.md`. */
export const reloadDoc = (audits: readonly WeaponAudit[]): string => {
  const reloadable = audits.filter((audit) => audit.runs.length > 0)
  const rows = reloadable.map((audit) => {
    const tactical = audit.runs.find((run) => run.scenario === 'tactical')
    const empty = audit.runs.find((run) => run.scenario === 'empty')
    const extra = audit.runs.find((run) => run.scenario === 'full')
    const tacticalText = tactical ? `${secondsText(tactical.seconds)}${tactical.kind === 'one_by_one' ? ' (por cartucho, com a arma carregada)' : ''}` : '—'
    const emptyText = empty ? `${secondsText(empty.seconds)}${empty.kind === 'one_by_one' ? ' (por cartucho)' : ''}` : '—'
    const steps = [
      tactical ? `tática: ${stepsOf(audit, tactical)}` : '',
      empty ? `vazia: ${stepsOf(audit, empty)}` : '',
      extra ? `speedloader: ${stepsOf(audit, extra)} (${secondsText(extra.seconds)})` : '',
    ].filter(Boolean)
    return `| ${fixed(audit.name)} (\`${audit.id}\`) | ${familyText(audit)} | ${fixed(steps.join('; '))} | ${tacticalText} | ${emptyText} | ${fixed(sourceText(audit))} |`
  })
  const without = audits.filter((audit) => audit.runs.length === 0)
  const sameEmpty = reloadable.filter((audit) => audit.def.action.kind === 'firearm' && audit.def.action.timings?.reloadEmpty === undefined)
  const noFamily = reloadable.filter((audit) => audit.family === undefined)
  return `# Recarga por arma

Gerado por \`packages/game-weapons-three/tests/support/reload-doc.ts\` (rode \`WRITE_DOCS=1 pnpm --filter @adatechnology/game-weapons-three exec vitest run tests/docs.test.ts\`); o teste \`tests/docs.test.ts\` falha se este arquivo ficar diferente do que os dados geram.

Cada arma com modelo recebe o procedimento da sua família (\`RELOAD_STAGES\` de \`game-weapons\` + os clipes de \`game-weapons-three/src/animation/reload-clips.ts\`) com o **tempo da própria regra**: o clipe é esticado até a duração da fase de recarga da arma (\`timings.reload\`, \`timings.reloadEmpty\`, \`timings.perRound\`). O teste \`tests/reload-audit.test.ts\` confere, para cada arma e cada tipo de recarga que a regra planeja, que a duração do clipe que toca é igual à da regra (tolerância 0,05 s) e que existe clipe.

Tática = com bala na câmara (não puxa nada). Vazia = câmara vazia (trabalha a ação depois do carregador). O tempo de recarga vazia é o da tática, a menos que a arma traga \`timings.reloadEmpty\`.

A Galeria 3D do Arsenal (\`/home/user/zombiada/site/pages/armas-itens/\`) desenha os clipes, mas não traz segundos de recarga: os tempos vêm do catálogo da regra (fonte \`gallery\`, \`arsenal\`, \`sdk\` de cada arma). Qual mão faz cada passo está em \`packages/game-weapons-three/src/data/hand-work.json\` (autoria do kit; o dono confirma por arma).

| arma | família | passos | tempo tática | tempo vazia | fonte |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Armas sem dado próprio

- Tempo de recarga vazia igual ao da tática (sem \`timings.reloadEmpty\`; padrão da família): ${sameEmpty.length} armas, todas as linhas acima cuja fonte diz "padrão da família". Dados reais de recarga vazia dependem de confirmação do dono ou de medida em vídeo; a regra não muda o padrão porque os golden da equipe fixam o tempo.
- Sem família na regra (\`family\` ausente no catálogo; o clipe vem do modelo, sem marcas de passo para sincronizar): ${noFamily.map((audit) => `\`${audit.id}\``).join(', ') || 'nenhuma'}.
- Sem recarga (armas sem recarga na regra): ${without.map((audit) => `\`${audit.id}\``).join(', ') || 'nenhuma'}.
`
}

export const workText = (anchor: string): string => WORK_TEXT[anchor] ?? anchor
