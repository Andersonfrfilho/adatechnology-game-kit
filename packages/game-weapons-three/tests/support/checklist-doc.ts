import type { Check, WeaponChecks } from './weapon-checks'

const mark = (check: Check): string => (check.ok === null ? '—' : check.ok ? '✓' : '✗')
const cell = (check: Check, detail?: string): string => `${mark(check)}${detail ? ` ${detail}` : ''}`
const seconds = (value: number | null): string => (value === null ? '—' : `${value.toFixed(2).replace('.', ',')} s`)

export interface WithoutModel {
  id: string
  name: string
  category: string
  kind: string
}

/** The checklist of the animations of every weapon (pt-BR), `specs/001-migracao-entregas-dos-times/checklist-animacoes.md`. */
export const checklistDoc = (rows: readonly WeaponChecks[], withoutModel: readonly WithoutModel[]): string => {
  const lines = rows.map((row) => {
    const reload = row.tactical.ok === null && row.empty.ok === null ? '—' : ''
    return `| ${row.name} (\`${row.id}\`) | ${cell(row.support)} | ${cell(row.trigger)} | ${reload || cell(row.tactical)} | ${reload || cell(row.empty)} | ${row.time.ok === null ? '—' : cell(row.time, `${seconds(row.seconds.tactical)} / ${seconds(row.seconds.empty)}`)} | ${cell(row.contact)} | n/a | ${cell(row.sound)} |`
  })
  const failed = rows.flatMap((row) => (['support', 'trigger', 'tactical', 'empty', 'time', 'contact', 'sound'] as const).filter((key) => row[key].ok === false).map((key) => `\`${row.id}\` (${key}): ${row[key].note}`))
  const noTrigger = rows.filter((row) => row.trigger.ok === null).map((row) => `\`${row.id}\``)
  return `# Checklist das animações por arma

Gerado por \`packages/game-weapons-three/tests/support/checklist-doc.ts\` a partir de \`tests/checklist.test.ts\` (rode \`WRITE_DOCS=1 pnpm --filter @adatechnology/game-weapons-three exec vitest run tests/docs.test.ts\`); \`tests/docs.test.ts\` falha se este arquivo ficar diferente do que o teste mede. Cada ✓ ou ✗ vem de um teste automático que passa por **todas** as armas com modelo (${rows.length}):

- **mão de apoio**: as duas mãos existem, ficam na frente do olho, dentro da vista e a até 12 cm do modelo na mão.
- **dedo no gatilho**: com peça de gatilho no modelo, o indicador direito repousa estendido, vai ao gatilho e puxa a cada tiro (metralhadora e lança-chamas seguram o gatilho), e volta; sem peça de gatilho a empunhadura é a normal (—).
- **recarga tática** e **recarga vazia/passos**: existe clipe para o tipo de recarga que a regra planeja, ele dura o tempo da regra (0,05 s) e marca os passos da regra nos mesmos segundos; na recarga vazia a mão que trabalha a ação está nos dados para o clipe que toca (\`recargas-por-arma.md\` tem os passos e as fontes).
- **tempo**: tática / vazia em segundos, a duração do clipe igual à da regra.
- **contato (não atravessa)**: com uma parede a 0,5 m do olho a arma recua e nenhuma parte dela passa da parede; a mão que atira sobe se ficaria fora da vista embaixo.
- **chute**: n/a (o chute é do corpo, não da arma; a arma segue como está).
- **som**: os cues de som dos clipes de recarga estão em ordem dentro da duração, cada um tem receita (\`reload-sounds.json\`); armas de tubo recarregam por cartucho e soam a cada \`feed\` da regra.

| arma | mão de apoio | dedo no gatilho | recarga tática | recarga vazia/passos | tempo (tática / vazia) | contato (não atravessa) | chute | som |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${lines.join('\n')}

## Sem gatilho no modelo

Mantêm a empunhadura normal (sem o indicador estendido): ${noTrigger.join(', ') || 'nenhuma'}.

## Continuam ✗

${failed.length > 0 ? failed.map((item) => `- ${item}`).join('\n') : 'Nenhuma arma com modelo fica ✗.'}

## Sem modelo (caixas e props genéricos)

O kit mostra estas armas com o prop genérico da categoria (\`props.ts\`), não com modelo da galeria: não têm peças para animar nem gatilho para o dedo. Se o time entregar o modelo, entram na tabela de cima automaticamente.

${withoutModel.length > 0 ? withoutModel.map((item) => `- ${item.name} (\`${item.id}\`): ${item.category}, ${item.kind}`).join('\n') : 'Nenhuma.'}

## Prévias

As imagens \`examples/test-room/shots/fp-all-weapons-*.png\` mostram cada arma empunhada em primeira pessoa (folhas de contato).
`
}
