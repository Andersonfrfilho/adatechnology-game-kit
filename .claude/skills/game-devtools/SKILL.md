---
name: game-devtools
description: Use quando precisar de ferramentas de teste dentro de um jogo three.js - voo livre, HUD de posição, marcas com nota, painel de chaves e ações, executor de cenários e etiquetas sobre entidades. Termos - devtools, modo livre, free-fly, marcas, painel de debug, cenário, playtest.
---

# @adatechnology/game-devtools

## Objetivo
Ferramental de teste dentro do jogo: voo livre que atravessa tudo, HUD de posição (área, coordenadas, bússola, hora), marcas com nota, painel
com chaves, ações, hora do dia e lugares de teste, cenários com checagem automática e etiquetas sobre entidades. Não conhece nenhum jogo: o
host liga tudo por opções e chamadas de registro.

## Quando usar e quando não usar
- Use para jogar e inspecionar o jogo de verdade (teleportar, voar, marcar problemas, aplicar cenário e checar).
- Não use para testar um módulo isolado numa arena: isso é `game-test-room`. Não é um framework de testes unitários.
- Não acrescente teclas: o jogo liga as próprias (`dev.flying = true`, `dev.open('form')`).

## Como usar
```ts
import * as THREE from 'three'
import { create } from '@adatechnology/game-devtools'

const dev = create(THREE, {
  locale: 'pt-BR',
  marksStorageKey: 'meu-jogo-marcas',
  teams: [['mapa', 'Mapa'], ['arte', 'Arte']],
  area: (x, z) => 'Praça',
  position: () => ({ x, y, z, yaw, pitch }),
  bounds: { x: [-500, 500], y: [0.4, 260], z: [-500, 500] },
  pause: (paused) => { /* soltar o mouse, pausar o jogo */ },
})

dev
  .toggle('fog', 'Neblina', () => fog, (on) => { fog = on })
  .action('spawn', 'Gerar zumbi', () => { spawn(); return true }) // true mantém o painel aberto
  .places(() => [['Cidade', [['Praça', () => teleport(0, 0)]]]])
  .scenarios(list, (s) => apply(s), (s) => ({ aceso: { ok: isLit(), note: '...' } }))

dev.goTo = (x, y, z, yaw, pitch) => teleport(x, y, z, yaw, pitch)

// todo quadro
if (dev.flying) {
  dev.fly(dt, yaw, pitch, { forward, strafe, up, fast })
  dev.flyCamera(camera, yaw, pitch)
}
dev.update(dt, camera, true)
dev.expose() // window.__scenario, __scenarioCheck, __scenarioList, __devtools para Playwright
```

## API principal
| Função / tipo | Para que serve |
|---|---|
| `create(THREE, options?)` | Cria o `Devtools` (`THREE` só precisa de `Vector3`) |
| `dev.toggle / action / timesOfDay / places` | Registram chaves, botões, hora do dia e lugares no painel (encadeáveis) |
| `dev.labelsFor(fn)` | Fonte das etiquetas flutuantes (`EntityLabel[]`) |
| `dev.scenarios(list, apply, check)` / `dev.scenario(id)` / `dev.check(id?)` | Cenários e checagem (`ScenarioResult`) |
| `dev.fly / flyCamera / update` | Voo livre e atualização por quadro |
| `dev.open('form' \| 'list')` / `close()` / `expose()` / `dispose()` | Painéis, exposição para teste automático, limpeza |
| `dev.flying`, `hud`, `showLabels`, `speed`, `goTo`, `extras`, `marks`, `db` | Estado |
| `compass`, `formatMarkLine`, `sortMarks`, `serializeMarks`, `escapeHtml` | Helpers puros, sem DOM |
| `createScenarioRunner()` | Executor de cenários independente |
| `locales`, `resolveStrings` | Textos `en` e `pt-BR` |

## Compõe com
`game-camera` (o jogo passa `yaw/pitch` aos dois e usa `dev.flyCamera` no voo), `game-test-room` (ferramenta de teste irmã, para módulos isolados), e
qualquer pacote cujo estado o jogo queira ligar por `toggle` e `action`. As marcas vão ao banco do artifact (`window.claude`) quando existe,
senão ao `localStorage`.

## Ambiente de teste
`pnpm --filter @adatechnology/game-devtools test` (vitest, pasta `tests/`). `dev.expose()` deixa `window.__scenario`, `__scenarioCheck` e
`__scenarioList` na página para o Playwright dirigir cenários.

## Cuidados
- `three` é peer só de tipos: passe o seu `THREE`.
- Yaw 0 olha para -z (norte); pitch positivo olha para baixo.
- `labelsDistance` é aceito mas não é lido.
- As teclas são do jogo; o pacote não escuta nenhuma.
- Em `toggle`, `set` devolvendo `true` fecha o painel; em `action`, devolver `true` o mantém aberto.
- Com `locale: 'pt-BR'` os textos ficam idênticos aos do SDK antigo; nomes antigos e novos em `MIGRATION.md`.
- Chame `dispose()` ao sair: remove DOM, estilos e listeners.

## O que vem pela migração (spec 001)
Vem do `ModoLivreSDK` (ver `packages/game-devtools/MIGRATION.md`). A spec 001 pede que cada área do kit abra seu ambiente de teste e que
cenários sejam golden com semente fixa (decisão G3); nada novo foi decidido especificamente para este pacote.
