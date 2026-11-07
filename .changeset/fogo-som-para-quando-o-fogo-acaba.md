---
'@adatechnology/game-destruction-three': patch
---

O som do fogo para quando o fogo acaba. O renderizador passa a parear cada `burn_loop` com um único `burn_end` por peça (`startBurnSound` e `endBurnSound`): a parte que quebra, derrete ou perde o fogo sem evento de `burnout` ou `extinguish`, o objeto restaurado, o `clear` e a parte que acende de novo deixavam o ronco do fogo tocando para sempre. O ronco agora some em `FIRE_FADE_SECONDS` (fade curto, andado pelo `update`) em vez de cortar no seco, e `reset` e `dispose` param todo o laço.
