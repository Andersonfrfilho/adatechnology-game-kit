---
name: game-kit
description: Use quando for criar ou mudar qualquer coisa de jogo no adatechnology-game-kit ou num jogo que o usa (ZombiAdA ou outro) — arma, casa, móvel, item, veículo, zumbi, personagem, animal, planta, efeito, som, mapa, ambiente de teste. Diz qual pacote do kit já faz aquilo, como eles se compõem e as regras para não refazer do zero. Também: de onde vem uma peça que está na tela, SDK dono, peça desenhada à mão, kit-audit, kit_owner, kit_origin.
---

# AdA Technology Game Kit — mapa dos SDKs

O kit é a base de **todo jogo**, não só do ZombiAdA. Cada pacote faz uma coisa; os pacotes **se compõem** (um usa os outros para
formar itens e elementos do mapa) e o jogo só junta o que já vem pronto. Regras: resumo no `CLAUDE.md` da raiz, texto completo em `specs/regras/`.

**Teste do GTA:** o kit serve a um jogo de zumbi e serviria igual a um GTA. O que é só de zumbi (horda, triagem, barricada, infecção) fica
em pacote à parte, estado ou conteúdo do jogo, nunca no núcleo.

**Tudo configurável:** o kit traz muito conteúdo pronto, e cada jogo usa o padrão, troca valores, acrescenta ou tira itens sem mexer
no núcleo (catálogo por registro, números por opção, comportamento por plugin).

## Antes de escrever código

Vale para todo jogo do nosso lado, não só para o kit (dono, 2026-10-29): **o SDK primeiro**. Existe no kit, usa importado; não existe, cria
primeiro no pacote certo do kit e só depois usa no jogo. Nunca copie código ou modelo do kit para o jogo.

1. Ache o pacote no mapa do `CLAUDE.md` e carregue a skill da área dele (`kit-casas`, `kit-destruicao`, `kit-armas`, `kit-veiculos`,
   `kit-pessoas-bichos`, `kit-objetos-itens`, `kit-ambiente`, `kit-base`), que tem uma referência por pacote. O MCP `game-kit` (`kit_owner`) diz qual pacote é dono de uma
   peça; a seção "De onde vem cada peça" abaixo, de onde veio uma peça que já está na tela.
2. Não existe? Veja se um time do ZombiAdA já fez (`specs/001-migracao-entregas-dos-times/fontes.md` e `inventario/`). Se fez, **porte**,
   não reescreva.
3. Só então crie, e no pacote certo: motor genérico no pacote base, three.js no `-three`, conteúdo reaproveitável num pacote de conteúdo,
   conteúdo só de um jogo no repositório do jogo.

## Como se compõem (exemplos)

- **Casa** = `game-floorplan` + estrutura e materiais de `game-destruction` (concreto armado, tijolo) + móveis de `game-interactables`
  + achados de `game-items` + quintal de `game-vegetation`.
- **Cidade** = `game-urban` + casas + `game-vehicles` + `game-crowd`.
- **Arma** = `game-weapons` + dano de `game-destruction` + efeitos de `game-vfx` + som de `game-audio`.
- **Zumbi** = `game-characters` + `game-characters-undead` + `game-crowd` + `game-infection`.

## Testar

Toda lib tem um ambiente em `examples/<lib>-test-area`: um `TestableModule` carregado na sala com `room.loadModule` e aberto com
`room.openArea`. A sala é genérica; o que é específico fica no pacote da lib. Local: `pnpm site:dev` (Docker com watch) e
`http://localhost:4801/`.

## De onde vem cada peça (antiga skill `kit-origem`)

Regra §1 do `CLAUDE.md`: cada peça vem do SDK dono, importada, nunca copiada.

### Antes de desenhar uma peça

1. Pergunte ao MCP `game-kit` (registrado no `.mcp.json` da raiz): `kit_owner { piece: "carro queimado" }` devolve o domínio, os pacotes
   donos e como montar a peça a partir deles. Sem o MCP: `tools/kit-audit/rules.json` tem a mesma tabela.
2. Monte a peça pelo pacote dono. Num pacote que não pode depender do dono, receba o construtor por opção (ex.: `createWeatherVisual({ vehicles })`
   recebe `createVehiclesThree(THREE, { kit })`; o exemplo passa o construtor). Sem o construtor, não desenhe a peça: nada de caixa no lugar.
3. A peça não existe no dono? Ela entra primeiro no pacote dono e só depois é usada. Não sabe se existe? Pergunte.

### Achar de onde veio uma peça que está na tela

1. **Qual objeto é.** Abra a página com Playwright (Chromium já instalado; `window.__testRoom` é a sala, `window.__THREE` o three.js), espere
   `window.__testRoom` e percorra `room.scene`: filtre pelos meshes pelo tamanho, pela cor ou com um `Raycaster` a partir da câmera, e suba
   pelos `parent` até um grupo com nome (ex.: `weather-lamp-rig`, `test-room-arena`, `crowd`). A cor do print ajuda: um `MeshBasicMaterial` escuro
   de cor sólida é quase sempre peça desenhada à mão.
2. **Qual código.** Procure o nome do grupo (`grep -rn "weather-lamp-rig" packages/*/src`).
3. **Quem trouxe.** `kit_origin { text: "weather-lamp-rig" }` devolve o commit, a data, o assunto, o PR e os arquivos. Sem o MCP:
   `git log --reverse -S "<texto>" --format='%h %ad %an %s' --date=short` e `gh api repos/<dono>/<repo>/commits/<sha>/pulls -q '.[0].number'`.
   Num clone raso, busque mais histórico antes (`git fetch --depth=2000 origin main`).
4. **Se deveria vir de outro SDK.** `kit_audit { package: "game-weather-three" }` ou `node tools/kit-audit/audit.mjs --package <pacote>`.

### Manter documentado

- `node tools/kit-audit/audit.mjs --check` roda no CI. Uma peça nova desenhada fora do dono quebra o build.
- `node tools/kit-audit/scene.mjs --check` também roda no CI: abre cada área da sala de teste e falha em qualquer coisa desenhada sem a marca
  de origem (`markKitOrigin` do `game-contracts`) de um construtor do kit. Peça nova do kit marca a raiz no construtor; quem hospeda não desenha,
  usa a peça do kit. Os conhecidos ficam em `drawn` do `tools/kit-audit/allowlist.json`.
- O que ainda está fora: `docs/pecas-fora-do-sdk.md` (peça, onde, dono certo, PR de origem, correção) e `pending` de
  `tools/kit-audit/allowlist.json`. Ao corrigir uma peça, tire das duas listas. Um falso positivo (o teto de um carro, o cano de um blindado)
  vai para `allowed` com o motivo.
- O audit é heurístico (procura as palavras do domínio perto da primitiva): uma peça cujo código não diz o que ela é passa. Ao revisar uma área,
  bancada ou cena, olhe também o que ela desenha.
