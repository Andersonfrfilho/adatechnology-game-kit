# 3. Os SDKs se compõem; o jogo só junta

Texto completo da seção 3 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

A ideia do kit (dono, 2026-10-23) é **um SDK usar os outros para formar os itens e os elementos do mapa e do jogo**, e o jogo usar tudo
isso pronto. Exemplos: a casa (`game-floorplan-*`) usa os materiais e a estrutura da destruição (concreto armado, tijolo), os móveis
interativos, o catálogo de itens para os achados e a vegetação para o quintal; a cidade (`game-urban`) usa as casas, os veículos e a
multidão; a arma usa a destruição, os efeitos e o som. Antes de reimplementar algo dentro de um pacote, use o pacote que já faz aquilo.
