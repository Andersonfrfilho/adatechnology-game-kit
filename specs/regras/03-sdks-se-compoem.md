# 3. Os SDKs se compõem; o jogo só junta

Texto completo da seção 3 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

A ideia do kit (dono, 2026-10-23) é **um SDK usar os outros para formar os itens e os elementos do mapa e do jogo**, e o jogo usar tudo
isso pronto. Exemplos: a casa (`game-floorplan-*`) usa os materiais e a estrutura da destruição (concreto armado, tijolo), os móveis
interativos, o catálogo de itens para os achados e a vegetação para o quintal; a cidade (`game-urban`) usa as casas, os veículos e a
multidão; a arma usa a destruição, os efeitos e o som. Antes de reimplementar algo dentro de um pacote, use o pacote que já faz aquilo.

**Regra estrutural num SDK de regras, nunca em mundos isolados** (dono, 2026-11-11: "não se deve separar em mundos isolados, afinal um SDK utiliza
outros SDKs com regras"). O que decide como uma construção se sustenta (o que apoia em quê, como a carga se divide entre os apoios, a ordem em que desce,
a laje sobre os apoios, o dimensionamento pela carga, o vão efetivo e a altura mínima de viga e pilar, as medidas dos blocos e do reboco) existe numa
implementação só, num SDK de regras: `game-load-path` (caminho de carga, divisão, casco de apoio, capacidade pela carga) e o validador e o catálogo de
blocos do `game-floorplan-structure`. Estrutura, destruição, renderizador, níveis de obra, urbano e torres importam e compõem essas regras; nenhum
mantém modelo paralelo nem decide apoio ou medida por conta própria (o renderizador lê da estrutura, não inventa pilar nem tamanho de tijolo). Achou
um "mundo isolado" com regra própria: mova a regra para o SDK de regras e faça os dois lados usarem a mesma, com teste da regra isolada e dos consumidores.
