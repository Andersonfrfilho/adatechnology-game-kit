---
name: game-floorplan-rural
description: Use quando precisar de casa de madeira (wood frame), chalé, cabana de tronco, barraco ou acampamento para o game-floorplan (estilo rural, fogão a lenha, poço, privada, lampião, barracas). Traz cinco modelos de planta rural da página do time.
---

# @adatechnology/game-floorplan-rural

## Objetivo
Conteúdo rural para o `game-floorplan`: casa de madeira americana, chalé de montanha, cabana de troncos, barraco e camping com barracas, mais o estilo e a paleta `rural`, as bibliotecas de slots, os itens (lareira, fogão a lenha, beliche, poço, privada, lampião, saco de dormir, fogueira...) e os nomes em en / pt-BR. As plantas são as da página do time (Visor de casas 3D): 375 plantas gravadas conferem lista por lista.

## Quando usar e quando não usar
- Use para qualquer jogo com casas de campo, cabanas, favela (barraco) ou acampamento gerados por semente.
- Não use para casa urbana (`game-floorplan-residential`), nem para a estrutura que segura a casa (`game-floorplan-structure`: o modelo só declara o sistema construtivo em `construction`).
- Casa do enredo de um jogo específico fica no repositório do jogo.

## Como usar
```ts
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'

registerResidential(engine) // antes: o rural estende a sala, a lavanderia e a paleta mid do residencial
registerRural(engine, { region: 'br' })
const plan = engine.generate('log_cabin', { seed: 4, rooms: 2, power: 'offgrid', locale: 'pt-BR' })
plan.config // { power: 'offgrid', solar: false, bathroom: 'outhouse', water: 'tank' }
```

## API principal
| Função/tipo | Para que serve |
|---|---|
| `register(engine, { region? })` | Registra itens, bibliotecas, estilo, paleta, perfil de decoração, modelos e locales; lança erro claro se o residencial não foi registrado |
| `ruralTemplateIds` | `wood_frame_house`, `a_frame_chalet`, `log_cabin`, `shack`, `campsite` |
| `ruralItems`, `ruralStyle`, `ruralDecorProfile`, `ruralFacadeColors`, `ruralSwatches` | Dados exportados |
| `enLocale`, `ptBrLocale` | Nomes de modelo, cômodo, andar, barraca e cor de fachada |

Opções por modelo: `wood_frame_house` (`floors`, `garage`, `fireplace`, `basement`, `attic`, `bedrooms`), `a_frame_chalet` (`foundation`), `log_cabin` (`rooms`, `power`, `solar`, `bathroom`, `water`), `shack` (`rooms`, `material`, `floorSurface`, `bathroom`), `campsite` (`tents`, `tentType`). O que não é dado sai da semente.

`result.config` leva `power` (`grid`, `offgrid` ou `tap`, a ligação clandestina do barraco), `solar` e o resto que a estrutura lê. Plano `offgrid` ganha lampiões (`ceiling_oil_lamp`, `oil_lamp`) no lugar da luz de teto.

## Compõe com
- Depende de `game-floorplan` e de `game-floorplan-residential` (peer): registre o residencial primeiro.
- `construction` (`wood_frame`, `log`, `improvised`, `canvas`) é o id que `game-floorplan-structure` registra; `place` (`house`, `cabin`, `shack`, `camp`) é a etiqueta de lugar para os achados.
- O estado (`fortified`, `abandoned`) vem do `game-floorplan-post-apocalyptic` e já entende o estilo `rural` e a zona `camp`.

## Ambiente de teste
Sem exemplo próprio. Veja o visualizador 2D do `game-floorplan` (`viewer:build`) e a suíte de propriedades em `game-floorplan-post-apocalyptic/tests` (variantes rurais e o golden contra a página do time).

## Cuidados
- `register` recebe o `engine` como argumento; não importe o motor por outro caminho (bundles IIFE compartilham o registro).
- A cor de parede e de piso de `porch`, `tent` e `camp` ainda não herda a da sacada (o motor não tem alias de tipo de cômodo na paleta).
- Nomes em português antigos (`casa_madeira_americana`, `barraco`, `barraca_camping`...) estão no `MIGRATION.md`; use os ids em inglês.
