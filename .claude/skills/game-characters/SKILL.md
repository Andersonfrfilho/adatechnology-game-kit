---
name: game-characters
description: Use quando precisar de corpo de personagem num jogo, sem engine, como pessoa, zumbi, proporção do corpo, juntas, esqueleto, segmento, região, membro, cabeça, tronco, dano no corpo, tiro na cabeça, colete, capacete, penetração, desmembrar, cortar membro, osso quebrado, mancar, rastejar, sangramento, morte. Monta o corpo (rig, 17 segmentos, 6 regiões da multidão) e o modelo de dano como DestructibleImpl.
---

# @adatechnology/game-characters

## Objetivo
Corpo vivo independente de engine. **Proporções** (`GUIDE`, o guia do Elenco: 1,80 m, ombros 0,61 m a 1,475 m; `TEAM_GAME`, as juntas do corpo
instanciado do jogo), **rig** com 17 juntas escalado por altura e porte, **árvore de 17 segmentos** (os 11 tipos do Arsenal, braços e pernas dos dois
lados) e as **6 regiões** da multidão (`head`, `torso`, `armL`, `armR`, `legL`, `legR`, com o `missing` de `MISSING_BITS`). Presets por pacote de conteúdo.
E o **modelo de dano** (`DestructibleImpl`): resolve a parte, proteção em camadas, penetração (`physical`: P = √(E·m/A); `team-game`: os
pontos do jogo), pontos `3,5·E^0,37`, multiplicadores, gravidade por segmento (quebra, arranca, destrói, cascata do que fica abaixo, manca,
rasteja, partido ao meio, regra da cabeça e da mandíbula), regra de morte e sangramento em eventos `leak`.
Unidades: metros, joules, segundos. Não sabe nada de jogo nenhum: zumbi, profissão e força vêm de pacotes (`-undead`, `-people`, `-uniformed`).

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

// dano: um Hit do contrato (ou com pontos já resolvidos); devolve eventos de destruição (`damage`, `hole`, `body`, `detach`, `leak`...)
const eventos = guarda.hit(shotToHit(shot, ponto))  // Shot do game-weapons, com `mass`
guarda.lastHit                      // { points, killed, headshot, through, exitEnergy, absorbedBy? }
guarda.update(dt)                   // sangramento: um `leak` por segundo por ferida; o atordoamento passa
mundo.register(guarda)              // um DestructionWorld do game-destruction hospeda o corpo
kit.penetrateLine(shot, [{ character: a, part: 'torso', distance: 3 }, ...])  // uma bala atravessando vários corpos
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
| `character.hit / update / serialize / load` | dano, sangramento, salvar; `lastHit`, `bleeders()`, `limping`, `stunSeconds`, `intactProtection()`, `resistanceOf`, `protectionAgainst` |
| opções `damage`, `penetration`, `protection`, `calibers` | regras (`preset: 'kit' \| 'arsenal' \| 'elenco'`, `deathRule`, `severity`, `spread`), modelo de penetração, camadas e tabela de calibres |
| `PROTECTION_PRESETS` | `vest_police` (14; 0,3/0,8), `vest_military` (28; 0,5), `helmet_combat` (9, uma bala de pistola), `turnout_gear` (fogo 0,25, membros 0,8) |
| `penetrateLine`, `penetrationForce`, `segmentResistance`, `energyKept` | P7: 9 mm atravessa 2 corpos, 5,56 três, .308 quatro |
| `layeredProtection` | mordida e arranhão em camadas: `1 − Π(1 − b·c)`, teto 90 % |

## Compõe com
- `@adatechnology/game-contracts`: `BodySlot`, `SegmentKind`, `BodyRegion`, `MISSING_BITS`, `ObjectState.body`.
- `game-characters-three` desenha; `game-characters-undead`, `-people` e `-uniformed` trazem presets.

## Cuidados
- O motor está em joules. `Hit.points` só quando o jogo já tem a própria tabela (o `team-game` dos goldens); sem isso, `3,5·E^0,37`.
- Uma sequência de sorteios por personagem (`seed ^ contador de golpes`); `spec.random` substitui para reproduzir um jogo gravado.
- `detail: 'regions'` usa a regra do `zDamage` do jogo (cabeça 40, braço 60, perna 80, bits de `MISSING_BITS`); `segments` usa a regra do kit.
- Regra de zumbi (tipos, idade, explosão do inchado, imunidade ao fogo) fica no `game-characters-undead`: aqui só os ganchos genéricos.
- Lado esquerdo em +x (Elenco e Arsenal concordam); o `TEAM_GAME` guarda as juntas do jogo como estão.
- `setDetail('regions')` soma os segmentos (sem perda); voltar para `segments` espalha a fração da região (com perda).
- Sem `Math.random`: só a semente do spec.

## Andar, condição, corpos no chão e aparência (T4.1f)
- **Passada** (`gait/`): `walkCadence`/`walkGait` (a passada que casa com o chão; `strideFor` com `strideFromSpeed` padrão `true`), `animateProfile` (o `animate0` do Bestiário como números: devolve só as juntas que o andar escreve), `CASCADE` + `stepCascade` + `lerpPose`, `MOVES` + `blendMoves` + `humanPose` (a mistura contínua do Elenco), `crawlPose`/`deadPose`, e as 8 poses do corpo instanciado (`INSTANCE_POSES`, `encodePoseHeight`).
- **`createConditionTimeline`**: fases ordenadas com efeitos (infecção: saudável, febre, delírio, reanimado) em horas ou num relógio acelerado (`unitsPerSecond`).
- **`kit.createCorpses()`**: corpos no chão (400, 900 s; o mais velho sai quando enche; saída por troca com o último, como o jogo).
- **Aparência**: `drawBodyVariance` (as 8 sorteios do `zSpawn`), `variantCountFor`/`variantSeed`/`variantDecay` (regra ZVAR) e `drawAppearance` (o `VR` do Bestiário v17, na mesma ordem, devolvendo o fluxo para o construtor continuar).

## Clipes de pose (`pose-clips/`)
- **`PoseClip`** são poses-chave sobre as juntas do corpo rico (`lean`, `headY`, `armR`, `legL`...). `samplePoseClip(clip, t)` amostra (o `sample` do Bestiário); `clipEventsBetween(clip, t0, t1)` devolve os eventos em `(t0, t1]`, e `impact` marca o instante em que o golpe acerta (o jogo aplica o dano ao disparar). `filterPoseChannels` separa `full`, `upper` (as pernas seguem a passada) ou `lower`.
- **`POSE_CLIPS`** traz os dois clipes da cena de agarrar e morder, portados do Bestiário: `grabbed_bitten_human` e `grab_bite_zombie`. `createPoseClipRegistry(POSE_CLIPS).register(clip)` adiciona ou troca clipes; um clipe em JSON serve (golpes incluídos).
