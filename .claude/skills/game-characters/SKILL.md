---
name: game-characters
description: Use quando precisar de corpo de personagem num jogo, sem engine, como pessoa, zumbi, proporção do corpo, juntas, esqueleto, segmento, região, membro, cabeça, tronco, preset de personagem. Monta o corpo (rig, 17 segmentos, 6 regiões da multidão) a partir de presets por pacote.
---

# @adatechnology/game-characters

## Objetivo
Corpo vivo independente de engine. **Proporções** (`GUIDE`, o guia do Elenco: 1,80 m, ombros 0,61 m a 1,475 m; `TEAM_GAME`, as juntas do corpo
instanciado do jogo), **rig** com 17 juntas escalado por altura e porte, **árvore de 17 segmentos** (os 11 tipos do Arsenal, braços e pernas dos dois
lados) e as **6 regiões** da multidão (`head`, `torso`, `armL`, `armR`, `legL`, `legR`, com o `missing` de `MISSING_BITS`). Presets por pacote de conteúdo.
Unidades: metros. Não sabe nada de jogo nenhum: zumbi, profissão e força vêm de pacotes (`-undead`, `-people`, `-uniformed`).

## Quando usar e quando não usar
- Use para: criar personagens, ler juntas e segmentos, trocar o nível de detalhe (perto: segmentos; longe: regiões), descrever o corpo como peças de destruição.
- Não use para desenhar (é o `game-characters-three`) nem para regra de zumbi (é o `game-characters-undead`).

## Como usar
```ts
import { createCharacters, segmentsBelow } from '@adatechnology/game-characters'

const kit = createCharacters({ packs: [{ id: 'meu-jogo', presets: [{ id: 'guarda', kind: 'guarda', vitality: 120 }] }] })
const guarda = kit.create({ seed: 7, kind: 'guarda', height: 1.85 })
guarda.rig.joints.shoulderL        // [x, y, z] em metros, esquerda em +x, de frente para +z
guarda.segments                    // 17 segmentos: hp, max, status, attached
segmentsBelow('upperArmL')         // ['forearmL', 'handL']: o que cai junto
guarda.setDetail('regions')        // longe: regiões do jogo (cabeça 40, braço 60, perna 80)
guarda.state().body                // { alive, vitality, missing, limp, crawl }
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `createCharacters(options?)` | kit: `packs`, `patch`, `remove`, `body` (proporções), `corpses` (400 corpos, 900 s) |
| `kit.create(spec)` | personagem a partir do preset (`spec.preset` ou o de id `spec.kind`); o spec vence o preset |
| `GUIDE`, `TEAM_GAME`, `createBodySpec` | proporções; `joints` e `segmentRadius` mesclam chave a chave |
| `createRig`, `GAME_BONES`, `JOINT_PARENTS` | juntas escaladas; ossos 0 a 11 do corpo instanciado |
| `SEGMENT_TREE`, `SEGMENT_NUMBERS`, `segmentsBelow` | os 17 segmentos, os números do Arsenal (vida, `MULT`, `BLEED`), a cascata |
| `REGION_SEGMENTS`, `REGION_HIT_POINTS` | as 6 regiões e a vida da região no jogo |
| `character.describe() / state() / setDetail / reset` | peças e estado no contrato de destruição |

## Compõe com
- `@adatechnology/game-contracts`: `BodySlot`, `SegmentKind`, `BodyRegion`, `MISSING_BITS`, `ObjectState.body`.
- `game-characters-three` desenha; `game-characters-undead`, `-people` e `-uniformed` trazem presets.

## Cuidados
- Lado esquerdo em +x (Elenco e Arsenal concordam); o `TEAM_GAME` guarda as juntas do jogo como estão.
- `setDetail('regions')` soma os segmentos (sem perda); voltar para `segments` espalha a fração da região (com perda).
- Sem `Math.random`: só a semente do spec.
