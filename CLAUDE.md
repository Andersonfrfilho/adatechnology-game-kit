# AdA Technology Game Kit — regras do projeto

## 1. O SDK guarda tudo o que os times já fizeram — **OBRIGATÓRIO**

Este repositório é a base de **todo jogo futuro**, não só do ZombiAdA. Um jogo novo tem que começar com armas, casas, itens,
zumbis, personagens, veículos, vegetação, efeitos e animais **já prontos, com os comportamentos funcionando**.
Por isso o trabalho que os times entregaram vem para cá **uma vez**, e daí em diante tudo se monta a partir daqui.

Antes de construir qualquer coisa (modelo 3D, animação, comportamento, efeito, tela ou ambiente de teste), nesta ordem:

1. **Procure no SDK** (`packages/*`, os README de cada pacote).
2. **Procure nas entregas dos times**: o site das equipes (`Andersonfrfilho/zombiada`, pastas `site/pages/<seção>/` e o portal
   `site/portal/portal-equipes.html`, que lista cada time com suas prévias e arquivos). Exemplos: Galeria 3D do Arsenal
   (armas com medida real, munição por calibre, tiro, recarga por tipo, pane, explosivos), Itens do Vale Cinzento, Bestiário e Elenco
   (zumbis, corpos, cortes, andar), Retratos e Os Vivos do Vale (sobreviventes), Bichos do Vale, Oficina de VFX e Laboratório de
   Explosões, Galeria do Vale Cinzento (tipologias de casa, prédios, mobília, postes, interiores), Bancada de Hordas.
3. **Só então crie**, e só o que de fato não existe.

- Achou na entrega de um time e não está no SDK: **porte a entrega** para o pacote certo, preservando medidas, animações,
  comportamentos e nomes de peças. **Proibido reescrever "parecido"** ou pôr substituto (caixas, placeholder) quando o time já
  entregou a versão real.
- Não achou nem no SDK nem nas entregas, ou a entrega está incompleta: **pergunte** antes de inventar.
- Ao terminar uma migração, atualize o inventário da spec de migração (`specs/`) marcando o que entrou e onde.

## 2. Motor genérico; conteúdo de cada jogo no repositório do jogo

- O núcleo de cada pacote não conhece o ZombiAdA (nada de Vale Cinzento, facções ou nomes de cidade no código do motor).
- Conteúdo **reaproveitável por qualquer jogo** fica no SDK em pacote de conteúdo, como `-fleet`, `-species`, `-household`,
  `-residential`. Isso inclui coisas do mundo real com o nome real: armas com marca e modelo, calibres, veículos (decisão de 2026-10-23).
- Conteúdo **só de um jogo** (histórias, personagens nomeados, Vale Cinzento, sangue e marcas da horda) fica **no repositório do
  jogo**, que consome os SDKs do game-kit.
- three.js fica num adaptador `<lib>-three`, como `destruction-three`, `fluids-three`, `interactables-three` e `weapons-three`.

## 3. Os SDKs se compõem; o jogo só junta

A ideia do kit (dono, 2026-10-23) é **um SDK usar os outros para formar os itens e os elementos do mapa e do jogo**, e o jogo usar tudo
isso pronto. Exemplos: a casa (`game-floorplan-*`) usa os materiais e a estrutura da destruição (concreto armado, tijolo), os móveis
interativos, o catálogo de itens para os achados e a vegetação para o quintal; a cidade (`game-urban`) usa as casas, os veículos e a
multidão; a arma usa a destruição, os efeitos e o som. Antes de reimplementar algo dentro de um pacote, use o pacote que já faz aquilo.

## 4. Testes: contrato genérico, módulo específico por lib

- `game-test-room` e `game-contracts` têm **só contratos genéricos** (`TestableModule`, `ModuleArea`, `ModuleHost`, eventos de
  ferramenta). Nada de arma, carro ou móvel neles.
- O que é específico de um domínio (balcão de armas, arma na mão, cápsulas, sons) fica no pacote da lib e num
  `examples/<lib>-test-area` que carrega o módulo na sala com `room.loadModule`.
- Cada área da página do kit abre o seu ambiente de teste já montado (`?area=`).
