---
name: kit-origem
description: Use quando aparecer numa sala de teste, área, bancada ou cena uma peça (carro, muro, mesa, pessoa, árvore, item, arma) e for preciso saber de qual SDK ela vem, quem a trouxe e se ela deveria vir de outro SDK; e antes de desenhar qualquer peça. Termos, de onde vem, origem, quem fez, SDK dono, peça desenhada à mão, caixa no lugar do modelo, kit-audit, kit_owner, kit_origin.
---

# De onde vem cada peça do kit

Regra do dono (2026-10-29, `CLAUDE.md`): **cada peça vem do SDK dono, importada, nunca copiada**. Carro e veículo do SDK de veículos,
parede e casa do `game-floorplan`, móvel do catálogo de móveis, pessoa do `game-characters`, planta do `game-vegetation`, item do
`game-items-goods`, arma e explosivo do `game-weapons`. Assim a mudança no SDK aparece em todo lugar que usa a peça. Parede e muro sempre como as casas, no visual e na sustentação: `wallPiece` do
`game-floorplan-three` (regra do dono, 2026-10-29).

## Antes de desenhar uma peça

1. Pergunte ao MCP `game-kit` (registrado no `.mcp.json` da raiz): `kit_owner { piece: "carro queimado" }` devolve o domínio, os pacotes
   donos e como montar a peça a partir deles. Sem o MCP: `tools/kit-audit/rules.json` tem a mesma tabela.
2. Monte a peça pelo pacote dono. Num pacote que não pode depender do dono, receba o construtor por opção (ex.: `createWeatherVisual({ vehicles })`
   recebe `createVehiclesThree(THREE, { kit })`; o exemplo passa o construtor). Sem o construtor, não desenhe a peça: nada de caixa no lugar.
3. A peça não existe no dono? Ela entra primeiro no pacote dono e só depois é usada. Não sabe se existe? Pergunte.

## Achar de onde veio uma peça que está na tela

1. **Qual objeto é.** Abra a página com Playwright (Chromium já instalado; `window.__testRoom` é a sala, `window.__THREE` o three.js), espere
   `window.__testRoom` e percorra `room.scene`: filtre pelos meshes pelo tamanho, pela cor ou com um `Raycaster` a partir da câmera, e suba
   pelos `parent` até um grupo com nome (ex.: `weather-lamp-rig`, `test-room-arena`, `crowd`). A cor do print ajuda: um `MeshBasicMaterial` escuro
   de cor sólida é quase sempre peça desenhada à mão.
2. **Qual código.** Procure o nome do grupo (`grep -rn "weather-lamp-rig" packages/*/src`).
3. **Quem trouxe.** `kit_origin { text: "weather-lamp-rig" }` devolve o commit, a data, o assunto, o PR e os arquivos. Sem o MCP:
   `git log --reverse -S "<texto>" --format='%h %ad %an %s' --date=short` e `gh api repos/<dono>/<repo>/commits/<sha>/pulls -q '.[0].number'`.
   Num clone raso, busque mais histórico antes (`git fetch --depth=2000 origin main`).
4. **Se deveria vir de outro SDK.** `kit_audit { package: "game-weather-three" }` ou `node tools/kit-audit/audit.mjs --package <pacote>`.

## Manter documentado

- `node tools/kit-audit/audit.mjs --check` roda no CI. Uma peça nova desenhada fora do dono quebra o build.
- `node tools/kit-audit/scene.mjs --check` também roda no CI: abre cada área da sala de teste e falha em qualquer coisa desenhada sem a marca
  de origem (`markKitOrigin` do `game-contracts`) de um construtor do kit. Peça nova do kit marca a raiz no construtor; quem hospeda não desenha,
  usa a peça do kit. Os conhecidos ficam em `drawn` do `tools/kit-audit/allowlist.json`.
- O que ainda está fora: `docs/pecas-fora-do-sdk.md` (peça, onde, dono certo, PR de origem, correção) e `pending` de
  `tools/kit-audit/allowlist.json`. Ao corrigir uma peça, tire das duas listas. Um falso positivo (o teto de um carro, o cano de um blindado)
  vai para `allowed` com o motivo.
- O audit é heurístico (procura as palavras do domínio perto da primitiva): uma peça cujo código não diz o que ela é passa. Ao revisar uma área,
  bancada ou cena, olhe também o que ela desenha.
