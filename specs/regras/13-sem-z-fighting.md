# 13. Geometria: nenhuma face coincidente (z-fighting) — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-12, depois de a mesma falha voltar em quase toda peça nova: a caixa do medidor do poste trocava de preto para
cinza com a câmera, e piso, portas, janelas e teto da laje "piscavam" nas etapas da obra. O primeiro levantamento, com a guarda ligada nos
catálogos, achou faces coincidentes em 580 dos 813 casos de itens, 138 dos 148 da frota, 199 dos 426 de armas e 137 dos 221 móveis.

## O que é

Duas faces no **mesmo plano** (a menos de 1 mm), **viradas para o mesmo lado** e **sobrepostas**: a placa de vídeo guarda uma profundidade por
pixel e não consegue decidir qual está na frente, então alterna entre as duas conforme a câmera anda. Não é sombra nem material; é modelagem.

## Como desenhar para não acontecer

- **Coisa oca é casca**, nunca um bloco maciço com um forro rente por dentro (a caixa do medidor, armários, geladeira, lixeira).
- **Detalhe sai ou entra pelo menos 2 mm** da face onde está (rótulo da lata, friso, placa, tampa, puxador, corrediça); rente, nunca.
- **Peças que se encostam dividem a face de dentro** (normais opostas). Duas peças que se sobrepõem não podem ter faces na mesma direção
  no mesmo plano: recorte uma ou recue.
- **Decalque de propósito** (furo, mancha, película de líquido) usa `polygonOffset` no material: a guarda o ignora, porque a GPU o ordena.
- **LOD**: só o nível mais próximo é conferido (os outros nunca são desenhados junto com ele).

## A guarda

- `coincidentFaces(batches)` do `game-shapes` acha os pares de triângulos; `coincidentFacesOf(root)` do `game-shapes-three` roda sobre
  qualquer objeto three.js (posições no mundo, instâncias, só o que é desenhado) e diz quais duas malhas brigam e onde.
- **Cada pacote que desenha peças** tem `tests/catalog-cases.ts` (os casos montados a partir das listas do próprio pacote: frota, espécies,
  modelos, tipos) e `tests/z-fighting.test.ts`, que passa **todo** caso pela guarda. Peça nova entra sozinha no teste, porque entra na lista.
- **Peça nova: zero faces coincidentes.** As peças que já tinham quando a guarda entrou estão em `tests/fixtures/z-fighting-ledger.json`, uma
  dívida que **só diminui** (como a tipagem do §10): piorar falha, melhorar falha até baixar a conta com `UPDATE_ZFIGHT=1`, e esse comando
  nunca acrescenta peça nem sobe número.
- `node tools/z-fighting/coverage.mjs` roda no CI e falha num pacote `*-three` (ou com golden de peças) sem a guarda. Pacote que não desenha
  peças (sombra, efeito transparente, terreno) fica em `tools/z-fighting/exempt.json` com o motivo; ao ligar a guarda, sai de lá.
- Revisor: o agente `revisor-z-fighting` (`.claude/agents/`) olha peça nova ou alterada antes do PR.
