---
name: game-kit
description: Use quando for criar ou mudar qualquer coisa de jogo no adatechnology-game-kit ou num jogo que o usa (ZombiAdA ou outro) — arma, casa, móvel, item, veículo, zumbi, personagem, animal, planta, efeito, som, mapa, ambiente de teste. Diz qual pacote do kit já faz aquilo, como eles se compõem e as regras para não refazer do zero.
---

# AdA Technology Game Kit — mapa dos SDKs

O kit é a base de **todo jogo**, não só do ZombiAdA. Cada pacote faz uma coisa; os pacotes **se compõem** (um usa os outros para
formar itens e elementos do mapa) e o jogo só junta o que já vem pronto. Regras completas: `CLAUDE.md` da raiz.

**Teste do GTA:** o kit serve a um jogo de zumbi e serviria igual a um GTA. O que é só de zumbi (horda, triagem, barricada, infecção) fica
em pacote à parte, estado ou conteúdo do jogo, nunca no núcleo.

**Tudo configurável:** o kit traz muito conteúdo pronto, e cada jogo usa o padrão, troca valores, acrescenta ou tira itens sem mexer
no núcleo (catálogo por registro, números por opção, comportamento por plugin).

## Antes de escrever código

1. Ache o pacote nesta lista e carregue a skill dele (mesmo nome do pacote).
2. Não existe? Veja se um time do ZombiAdA já fez (`specs/001-migracao-entregas-dos-times/fontes.md` e `inventario/`). Se fez, **porte**,
   não reescreva.
3. Só então crie, e no pacote certo: motor genérico no pacote base, three.js no `-three`, conteúdo reaproveitável num pacote de conteúdo,
   conteúdo só de um jogo no repositório do jogo.

## Pacotes que existem

| Pacote | Para que serve |
|---|---|
| `game-contracts` | Contratos entre módulos: destruição, armas, fluidos, animação e o `TestableModule` (itens, cenários, área e `attach` ao host) |
| `game-destruction` | Como cada material amassa, queima, derrete, racha e se solta; estrutura com carga e colapso |
| `game-destruction-three` | Desenho three.js da destruição: furos, marcas, fragmentos, partículas, explosão |
| `game-weapons` | Armas e munição reais como dados (calibre, pente, modos de tiro, recarga, coice), determinístico |
| `game-weapons-three` | Arma na mão, cápsulas, carregador, sons e a área de armas como módulo de teste |
| `game-fluids` / `game-fluids-three` | Recipientes com nível, temperatura e inclinação; derramar, vazar, manchas |
| `game-interactables` (+ `-household`, `-three`) | Objetos que funcionam: portas, gavetas, energia, gás, água; os móveis da casa |
| `game-props3d` | Objetos de cenário low poly (decoração, móveis modernos, quintal) |
| `game-floorplan` (+ `-residential`, `-commercial`, `-post-apocalyptic`, `-structure`) | Plantas de casa e lote geradas por semente: cômodos, paredes, portas, janelas, zonas; `-structure` dá a estrutura (pilares, vigas, telhado) e o caminho de carga da destruição |
| `game-vehicles` / `game-vehicles-fleet` | Motor de veículos procedurais e a frota de 69 modelos, com dano por zona |
| `game-vegetation` / `game-vegetation-species` | Árvores, palmeiras, cactos, flores e grama; cerca de 90 espécies |
| `game-infection` | Contágio por regiões (horas), determinístico |
| `game-audio` | Som como dados: receita com semente vira plano, curvas de distância dos times, pan, limite de vozes, laços e as mixagens do jogo e da Cena de Arte |
| `game-weather` | Clima por semente: chuva, tempestade, neblina, vento, ciclone, calor, relâmpago, solo molhado, dia e noite, efeitos para visão e audição |
| `game-player` | Corpo do jogador: ficha e derivados, fôlego, feridas e curativo, agarrão, derrubada, ruído de passos, pânico, empurrão e golpe; infecção individual opcional (desligada) |
| `game-crowd` | Multidão como estrutura de arrays: faixas de relevância, visão, audição e olfato, campo de fluxo, vagas de ataque, alerta em cadeia, portas, pilha no muro, habilidades por traço, corpos, população e migração |
| `game-crowd-three` | Desenho da multidão: agentes, corpos no chão e civis em lotes instanciados (corte pela vista, nível de detalhe com histerese, pose de ataque), bichos com os próprios rigs, banco de sons e a área de teste |
| `game-stories` | Histórias como dados: momentos com papéis, condições e mudanças, escalação, crônica, ficha do personagem (compra de pontos, derivados, memória e opinião) e a vida sorteada entre as histórias; mordida desligada por padrão |
| `game-camera` | Câmera de ombro, terceira e primeira pessoa |
| `game-test-room` | Sala de testes genérica: carrega módulos, abre uma área por grupo, registra o comportamento |
| `game-devtools` | Ferramentas de teste dentro do jogo |

## Pacotes que a migração vai criar (spec 001)

`game-characters` e `game-characters-undead` (corpo, andar, dano por região, os 13 tipos de zumbi),
civis, manada e revoada em `game-crowd`, `game-animals`, `game-items` (catálogo único), `game-vfx` (+ `-three`,
explosão do Laboratório), `game-weather` (chuva a eventos extremos), `game-audio`, `game-urban` (ruas, postes, bairro),
`game-floorplan-rural` (`game-player`, `game-crowd`, `game-stories`, `game-floorplan-structure` e `game-floorplan-three` já existem). Decisões em
`specs/001-migracao-entregas-dos-times/consolidado.md`.

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
