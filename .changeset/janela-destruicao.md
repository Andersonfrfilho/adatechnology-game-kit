---
'@adatechnology/game-floorplan': minor
'@adatechnology/game-floorplan-three': minor
'@adatechnology/game-destruction-three': patch
---

Janela e parede na explosão, como no mundo real:

- O vão da janela fica livre: os tijolos que a parede desenha onde foi cortada param no batente, no peitoril e na verga, e nenhum aparece atrás do vidro.
- O vidro de janela é lido como vidro comum de 4 mm (o desenho segue com 12 mm): uma granada na cozinha quebra as vidraças do cômodo e as próximas.
- `PlanWindow.frame` e `BuildOptions.windowFrame` (`'wood'`, `'aluminium'`, `'frameless'`): moldura de madeira (lasca), de alumínio (amassa) ou blindex (vidro temperado de 8 mm, sem moldura). O padrão é madeira na casa simples e alumínio nas outras. Na sala: `?windowFrame=`.
- O pilar de canto quebra nas duas paredes que se encontram nele, e a quina se desfaz.
- As lascas batem na primeira face no caminho (parede, teto, móvel) e caem (`FragmentSystemOptions.sweep`), em vez de atravessar a parede e ficar presas dentro dela à vista.
