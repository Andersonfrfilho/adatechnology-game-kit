# 2. Motor genérico; conteúdo de cada jogo no repositório do jogo

Texto completo da seção 2 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

- O núcleo de cada pacote não conhece o ZombiAdA (nada de Vale Cinzento, facções ou nomes de cidade no código do motor).
- Conteúdo **reaproveitável por qualquer jogo** fica no SDK em pacote de conteúdo, como `-fleet`, `-species`, `-household`,
  `-residential`. Isso inclui coisas do mundo real com o nome real: armas com marca e modelo, calibres, veículos (decisão de 2026-10-23).
- **Teste do GTA** (dono, 2026-10-23): estamos fazendo um jogo de zumbi, mas o kit tem que servir igual a um GTA. Prédios, veículos,
  armas, pessoas e cidade são genéricos; o que é só de apocalipse zumbi (horda, triagem militar, barricada, infecção) entra como pacote
  à parte, estado (ex.: `game-floorplan-post-apocalyptic`) ou conteúdo do jogo, nunca no núcleo.
- **Mundo normal primeiro** (dono, 2026-10-23): o jogo começa antes do surto. O padrão de cada pacote é o mundo funcionando; o
  apocalipse é uma camada gradual (ver `game-infection`), nunca o estado único.
- **Tudo configurável** (dono, 2026-10-23): o kit já vem com muito conteúdo próprio pronto (armas, prédios, zumbis, itens, sons), e
  por isso cada jogo tem que poder usar o padrão, trocar valores, acrescentar e tirar itens **sem mexer no núcleo**: catálogos por
  registro, regras e números por opção, comportamento por plugin. Valor fixo no código só quando for constante física.
- Conteúdo **só de um jogo** (histórias, personagens nomeados, Vale Cinzento, sangue e marcas da horda) fica **no repositório do
  jogo**, que consome os SDKs do game-kit.
- three.js fica num adaptador `<lib>-three`, como `destruction-three`, `fluids-three`, `interactables-three` e `weapons-three`.
