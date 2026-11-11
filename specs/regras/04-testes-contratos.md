# 4. Testes: contrato genérico, módulo específico por lib

Texto completo da seção 4 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

- `game-test-room` e `game-contracts` têm **só contratos genéricos** (`TestableModule`, `ModuleArea`, `ModuleHost`, eventos de
  ferramenta). Nada de arma, carro ou móvel neles.
- O que é específico de um domínio (balcão de armas, arma na mão, cápsulas, sons) fica no pacote da lib e num
  `examples/<lib>-test-area` que carrega o módulo na sala com `room.loadModule`.
- Cada área da página do kit abre o seu ambiente de teste já montado (`?area=`).
