# Explosões lado a lado

Comparação pedida pelo dono (decisão E1 do consolidado): a mesma granada no Laboratório de Explosões, no jogo e no SDK (antes e depois da
Fase 5), com a mesma câmera, nos mesmos instantes depois da detonação. Resultado em `index.html` (quadros em `quadros/`).

Para refazer: gerar as cópias locais (fora do git, ver `.gitignore`) a partir de `../../artefatos/XHSLUfNEdzAqGrqVQCWifG.html`
(`laboratorio.html`, sem o runtime do artefato) e da página do jogo do site (`jogo-site.html`, com o gancho `window.__cmp`), subir
o site do kit em `localhost:4801`, servir esta pasta em `localhost:4810` e rodar `node capturar.mjs`.

Achados em 2026-10-23:
- O jogo publicado como "versão atual" (artefato `2UG1Mhe9LqJkQKKVsJkTWR`) quebra ao carregar: referencia `GameVegetation`, que não
  está em nenhum arquivo dele. A versão do site (8 MB) é a completa.
- SDK: a granada derruba o muro, mas fogo e fumaça não aparecem nos quadros. As partículas existem (654 vivas em
  `destruction-particles`; a camada aditiva, de fogo e clarão, fica em 0). Conferir no navegador real se é defeito do SDK.

Depois da Fase 5 (2026-10-24, T5.4):
- A coluna **SDK novo** (`quadros/sdk-novo-*.jpg`) vem de `capturar-sdk-novo.mjs`: a sala de testes do kit (`examples/test-room`, construída com
  `node examples/test-room/build.mjs`) num Chromium do Playwright com GL por software, sem rede. A simulação anda em passos de 1/60 s, então os
  instantes são exatos. A coluna **SDK antes** (`quadros/sdk-*.jpg`) é a captura de 2026-10-23 e não muda.
- O defeito do SDK de antes (camada aditiva vazia, fumaça sem desenhar) acabou: `game-destruction-three` não tem mais partículas próprias e a
  granada é a explosão `m67` do Laboratório (`game-vfx`, 16/16 cenas iguais ao original). O que ainda difere do Laboratório nos quadros é o
  cenário (a sala de testes tem chão liso, sem a rua, os corpos e a iluminação noturna da página) e o teto de explosões por área do jogo, que o SDK
  também tem (padrão 6 em 4 s a 40 m, o excedente a 0,3).
