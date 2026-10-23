# Explosões lado a lado

Comparação pedida pelo dono (decisão E1 do consolidado): a mesma granada no Laboratório de Explosões, no jogo e no SDK, com a mesma
câmera, nos mesmos instantes depois da detonação. Resultado em `index.html` (quadros em `quadros/`).

Para refazer: gerar as cópias locais (fora do git, ver `.gitignore`) a partir de `../../artefatos/XHSLUfNEdzAqGrqVQCWifG.html`
(`laboratorio.html`, sem o runtime do artefato) e da página do jogo do site (`jogo-site.html`, com o gancho `window.__cmp`), subir
o site do kit em `localhost:4801`, servir esta pasta em `localhost:4810` e rodar `node capturar.mjs`.

Achados em 2026-10-23:
- O jogo publicado como "versão atual" (artefato `2UG1Mhe9LqJkQKKVsJkTWR`) quebra ao carregar: referencia `GameVegetation`, que não
  está em nenhum arquivo dele. A versão do site (8 MB) é a completa.
- SDK: a granada derruba o muro, mas fogo e fumaça não aparecem nos quadros. As partículas existem (654 vivas em
  `destruction-particles`; a camada aditiva, de fogo e clarão, fica em 0). Conferir no navegador real se é defeito do SDK.
