# AdA Technology Game Kit — regras do projeto

O kit é a base de **todo jogo** (ZombiAdA e qualquer outro). Este arquivo é o resumo que todo modelo lê; o texto completo de cada regra,
com o histórico e os detalhes, está em [`specs/regras/`](specs/regras/). **Antes de mexer numa área, leia a regra dela** (a tabela abaixo diz
qual). As regras valem inteiras: o resumo não tira nada do texto completo.

## Regras (resumo; completas em `specs/regras/`)

| § | Regra | Em uma frase | Texto completo |
|---|---|---|---|
| 1 | **SDK primeiro** | Procure no SDK (`packages/*`, README e skill da área), depois nas entregas dos times; porte a entrega igual, nunca "parecido"; só crie o que não existe, e crie no pacote dono antes de usar no jogo. Cada peça vem do SDK dono, importada; parede sempre `wallPiece` (como as casas). | [01](specs/regras/01-sdk-primeiro.md) |
| 2 | **Motor genérico** | Núcleo não conhece o ZombiAdA; conteúdo reaproveitável em pacote de conteúdo (`-fleet`, `-residential`...), conteúdo de um jogo no repositório do jogo; teste do GTA; mundo normal primeiro; tudo configurável; three.js só em `*-three`. | [02](specs/regras/02-motor-generico.md) |
| 3 | **SDKs se compõem** | Um SDK usa os outros (a casa usa destruição, móveis, itens, vegetação); o jogo só junta; regra estrutural num SDK de regras, nunca em mundos isolados. | [03](specs/regras/03-sdks-se-compoem.md) |
| 4 | **Testes: contrato genérico** | `game-test-room` e `game-contracts` só têm contratos; o específico vai no pacote da lib e num `examples/<lib>-test-area` (`?area=`). | [04](specs/regras/04-testes-contratos.md) |
| 5 | **Animação: todas as câmeras** | Animação, pose, IK, arma na mão ou bug visual: validar em primeira e terceira pessoa, parado/andando, mira alta/reta/baixa, uma arma por família, com print por câmera. | [05](specs/regras/05-animacao-todas-as-cameras.md) |
| 6 | **Física: 21 critérios** | Nenhum objeto pronto sem os 21 critérios testados na sala com print. | [docs/criterios-fisica-objetos.md](docs/criterios-fisica-objetos.md) |
| 7 | **Veículos** | O tiro acerta o desenhado; marca é filha da peça; todo vidro é peça de vidro; teste de aceitação na frota inteira. | [07](specs/regras/07-veiculos.md) |
| 8 | **Memória** | O que sai da cena para sempre passa por `discardObject3D`/`releaseObject3D` (`game-shapes-three`); listas esquecem o que saiu; `leak.mjs` barra a volta. | [08](specs/regras/08-memoria.md) |
| 9 | **Testes de GPU e navegador** | Nunca no CI nem no pre-push; rodam na rodada diária da main (`tools/gpu/nightly-gpu.mjs`) ou à mão (`browser-checks.mjs`, `pnpm check:<área>`). | [09](specs/regras/09-gpu-e-ci.md) |
| 10 | **Tudo tipado** | TypeScript `strict`, sem `any`, sem `@ts-nocheck`/`@ts-ignore`; o legado contado só diminui. | [10](specs/regras/10-tudo-tipado.md) |
| 11 | **Construção** | Estrutura real (alvenaria confinada, NBR 6118, caminho de carga até o chão); agente `engenheiro-estrutural` e testes de construção do SDK antes do PR. | [11](specs/regras/11-construcao.md) e [T10](specs/001-migracao-entregas-dos-times/design/T10-estrutura-real.md) |
| 12 | **Objetos quebrados** | Nada quebrado fica no ar; nada invisível colide; teste de catálogo no CI. | [12](specs/regras/12-objetos-quebrados.md) |
| 13 | **Sem z-fighting** | Nenhuma face no mesmo plano, virada para o mesmo lado e sobreposta: oco é casca, detalhe sai ou entra 2 mm; todo pacote que desenha peças passa o catálogo inteiro por `coincidentFacesOf` (`tests/z-fighting.test.ts`); peça nova tem zero, a dívida antiga só diminui. | [13](specs/regras/13-sem-z-fighting.md) |

Seções citadas no código como `CLAUDE.md §N` ou pelo título ("Memória", "Testes de GPU e navegador") são as desta tabela.

## Mapa do SDK (quem faz o quê)

Cada pacote tem `README.md` e uma referência na skill da sua área (`.claude/skills/kit-<área>/references/<pacote>.md`); a composição está na skill `game-kit`. Dono de cada tipo
de peça: `tools/kit-audit/rules.json` (MCP `game-kit`: `kit_owner`, `kit_origin`, `kit_audit`; skill `game-kit`, seção "De onde vem cada peça").

| Domínio | Pacotes |
|---|---|
| Contratos e base | `game-contracts` (destruição, tiro, `TestableModule`), `game-runtime` (quadro), `game-render-three` (luzes, shaders), `game-shapes`/`-three` (formas, liberar memória), `game-kit-defaults` (preset) |
| Casas e construção | `game-floorplan` (planta, lote), `-structure` (sistemas construtivos, caminho de carga, validador, instalações), `-three` (desenho, paredes, telhado), `-residential`, `-commercial`, `-rural`, `-post-apocalyptic`, `-interactables` (planta → objetos e redes) |
| Materiais e destruição | `game-destruction` (materiais, fratura, vergalhão, solo), `game-destruction-three` (furos, lascas, partículas), `game-vfx`/`-three` (explosão, fogo) |
| Terreno, clima, plantas | `game-terrain`/`-three`, `game-weather`/`-three`, `game-vegetation`/`-species`/`-three` |
| Objetos e itens | `game-interactables`/`-household`/`-three` (móveis com partes, rede elétrica, gás), `game-items`/`-goods`/`-three` (327 itens reais), `game-props3d`, `game-fluids`/`-three` |
| Armas | `game-weapons` (calibres, tiro, golpes), `game-weapons-three` (modelos, arma na mão) |
| Pessoas e bichos | `game-characters`/`-people`/`-uniformed`/`-undead`/`-three`, `game-crowd`/`-three`, `game-animals`/`-species`/`-three`, `game-player`, `game-infection`, `game-stories` |
| Veículos | `game-vehicles` (motor), `-fleet` (69 modelos), `-three`, `-driving`, `-proving` |
| Cidade | `game-urban`/`-three` |
| Jogo e ferramentas | `game-camera`, `game-audio`, `game-graphics`/`-three`, `game-devtools`, `game-test-room` (sala de teste) |

## Onde mora cada coisa

- **Paredes e muros**: `wallPiece` em `packages/game-floorplan-three/src/wall.ts`; paredes da casa em `.../src/house/walls.ts`; a estrutura (pilares,
  cinta, baldrame, vãos, tijolos) em `packages/game-floorplan-structure/src/structure/` (`walls.ts`, `wall-pillars.ts`, `ground-beams.ts`, `openings.ts`) e `src/wall-detail/`.
- **Validador estrutural**: `packages/game-floorplan-structure/src/validate/` (`STRUCTURAL_VIOLATION` em `codes.ts`); testes `tests/construction.test.ts` de cada pacote de tipologia.
- **Materiais**: `packages/game-destruction/src/materials.ts` com os dados em `src/data/materials.json` (e `assemblies.json`, `soils.json`); visual
  dos materiais da casa em `packages/game-floorplan-three/src/materials/`.
- **Terreno**: `packages/game-terrain/src/` (camadas, marcas, escavação); lote da casa em `packages/game-floorplan-three/src/lot/`.
- **Instalações** (elétrica, hidráulica, gás, solar, edículas): `packages/game-floorplan-structure/src/utilities/`; ligação com os objetos em
  `packages/game-floorplan-interactables/`; tomadas e quadros em `packages/game-interactables-household/src/builders/electrical.ts`.
- **Telhado e calhas**: `packages/game-floorplan-three/src/roof/` (`roofs.ts`, `gutters.ts`, `slabs.ts`).
- **Móveis da casa**: `packages/game-floorplan-three/src/furniture/`; catálogo interativo em `game-interactables-household`.
- **Sala de teste**: `packages/game-test-room/src/room.ts`; página em `examples/test-room` (servida na 4280); cada área em `examples/<lib>-test-area`.
- **Specs e decisões**: `specs/NNN-*/` (spec, plan, tasks, evidence); levantamentos em `docs/`.

## Comandos

- Antes do push: `pnpm build && pnpm test && pnpm typecheck && pnpm lint` (o pre-push roda a metade de CPU só do que mudou; ver `CONTRIBUTING.md`).
- **Uma sala de teste de ponta a ponta**: `pnpm check:<área>` builda o que a página carrega, roda os testes unitários desses pacotes e abre a
  página no navegador, que grava os prints em `examples/<pasta>/shots/` (lista os novos no fim). Áreas: `pnpm check:area --list`
  (`floorplan`, `interactables`, `room`, `vehicles`, `weapons`, ...). `--no-browser` pula o navegador, `--no-unit` os testes, `--room` refaz a página da sala.
- Suítes de navegador da branch: `node tools/gpu/browser-checks.mjs`; desempenho: `node tools/gpu/perf-gate.mjs` (§9).

## Buscas

`.ignore` tira das buscas (ripgrep, Grep e Glob) as entregas brutas dos times, o relatório visual, prints, goldens e imagens: continuam no git.
Para buscar nelas, passe a pasta: `rg <termo> specs/001-migracao-entregas-dos-times/sources` (ou `rg --no-ignore`).
