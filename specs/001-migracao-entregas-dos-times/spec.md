# Spec 001 — Migrar para o SDK tudo o que os times do ZombiAdA entregaram

## Por quê

Os times entregaram armas, itens, casas, zumbis, personagens, sobreviventes, animais, efeitos e mapa como páginas soltas, cada uma com
seu próprio código. Quem precisa de uma arma, uma casa ou um zumbi acaba refazendo do zero e diferente (foi o que aconteceu com as armas
do ambiente de teste em 2026-10-23). O SDK `adatechnology-game-kit` passa a ser a casa única desse trabalho, com o motor genérico e o
conteúdo do ZombiAdA em pacotes de conteúdo, para que **o próximo jogo comece com tudo pronto e com os comportamentos funcionando**.

Regra permanente: `CLAUDE.md` da raiz.

## Inventário (levantado em 2026-10-23 no site `Andersonfrfilho/zombiada`, `site/pages/`)

"Código próprio" é o tamanho do script da página fora das bibliotecas (three.js e afins).

| Time | Entrega (página) | Código próprio | Já no SDK? | Destino |
|---|---|---|---|---|
| Armas e itens | Galeria 3D do Arsenal (`armas-itens/galeria-3d-arsenal.html`) | 116 KB | Só os dados (`game-weapons`) | `game-weapons` (dados reconciliados) + `game-weapons-three` (modelos, munição, tiro, recarga por tipo, pane, explosivos) |
| Armas e itens | Arsenal (documento de design) | — | Parcial (`game-weapons`) | Números de dano, penetração, ruído e modificações em `game-weapons` |
| Armas e itens | Itens do Vale Cinzento (`itens-vale-cinzento.html`) | 85 KB | Não | Novo `game-items` + `game-items-three`, catálogo do ZombiAdA como pacote de conteúdo |
| Mapa / casas | Casa3DSDK (embutido em `visor-casas-3d`, `area-casas`, `revisao-casa-a`) | dentro de 3,6 MB | **Não** | 🧠 Novo pacote de construção (pilares, vigas, lajes, paredes, telhado, janelas) ou dentro de `game-floorplan`: decidir na Fase 0 |
| Mapa | Galeria do Vale Cinzento (`mapa/galeria-vale-cinzento.html`) | 286 KB | Não | Tipologias de casa e prédio, mobília de cena, postes, padrão de ruas e interiores: pacote de construção + `game-props3d` + conteúdo |
| Mapa | Mapa do Vale Cinzento, Checklist do Mapa, Visor de plantas | 0–209 KB | Parcial (`game-floorplan`) | Dados de terreno e padrão urbano como conteúdo; visor de plantas confere com `game-floorplan` |
| Zumbis e personagens | Bestiário, Elenco, Personagens | 109 + 64 + 19 KB | Não | Novo `game-characters` (corpo, juntas, andar, cortes, desmembramento) + `-three` + pacote de conteúdo dos zumbis |
| Armas (dano no corpo) | Desmembramento, sangramento e ferimentos (na Galeria 3D do Arsenal) | dentro dos 116 KB | Não | `game-characters` (dano por região) usando o `Hit` de `game-contracts` |
| Sobreviventes | Retratos do Vale, Os Vivos do Vale | 83 + 112 KB | Não | Pacote de conteúdo sobre `game-characters` (sobreviventes e fardados) + rotinas de NPC |
| Animais | Bichos do Vale | 47 KB | Não | Novo `game-animals` + `-three` |
| Efeitos | Oficina de VFX, Laboratório de Explosões | 142 + 93 KB | Não | Novo `game-vfx` + `-three` (fogo, fumaça, sangue, faíscas, explosão em camadas, cratera) |
| Efeitos | Padrão de Fluidos | 32 KB | Provável (`game-fluids`) | Conferir e portar o que faltar |
| Veículos | Garagem, Frota, Frota leve | 1,8–2,9 MB | Sim (`game-vehicles`, `-fleet`, goldens) | Conferir a frota leve |
| Móveis | Bancada de móveis, área de móveis | — | Sim (`game-interactables*`) | — |
| Vegetação | Viveiro do Vale | — | Sim (`game-vegetation*`) | — |
| Jogo | Bancada de Hordas, Antes do Dia 1 | — | Parcial (`game-infection`) | Simulação de horda: decidir na Fase 0 |
| Arte | Cena de Arte | 189 KB | — | Referência visual, não migra |

## Requisitos

- R1. Cada entrega migrada fica num pacote do SDK, com o motor sem nada do ZombiAdA e o conteúdo num pacote de conteúdo.
- R2. **Igual ao original:** medidas, peças, animações e comportamentos da entrega se preservam. Cada pacote tem testes golden
  ("monta, anima e quebra igual à página do time"), como `game-vehicles-fleet` já faz.
- R3. Cada lib migrada ganha um `examples/<lib>-test-area` (módulo carregado na sala de testes) e uma área na página do kit.
- R4. A página do time no site passa a montar a partir do SDK (sem código duplicado), quando a fase da lib terminar.
- R5. O inventário acima é atualizado a cada fase: entrou o quê, em qual pacote.

## Fora do escopo

- Arte definitiva (os modelos dos times são referência low poly; a arte final é outro trabalho).
- O jogo Jardim Aurora em si: ele consome o SDK, não é migrado.

## Pontos em aberto

- Resolvido em 2026-10-23: **fontes** são os 27 artefatos publicados (agora públicos), baixados para `artefatos/`, mais o site
  e o histórico em `~/Downloads/zombiada-offline`. Links, cópias locais e a comparação entre versões estão em `fontes.md`. Os
  arquivos citados no portal (`itens/fonte/`, `personagens/arte/`, `implementacao/sdk/`, `mapa/*.json`) não existem localmente; o que
  eles produziam está dentro das páginas.
- Resolvido em 2026-10-23: qual versão vale onde há mais de uma (V2, V8 e as demais) está decidido em `consolidado.md`.
- Resolvido em 2026-10-23: o Casa3DSDK são três SDKs; destino em C1–C2 do `consolidado.md` (estender `game-floorplan` + `-structure`, `-rural`, `-three`).
- **Todas as decisões estão em `consolidado.md`**; desde 2026-10-23 o dono delegou o restante à recomendação, perguntando só escolha de negócio.
