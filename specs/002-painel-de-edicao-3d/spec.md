# Spec 002 — Painel de edição 3D dos objetos do kit

> **Estado: futura.** Começa depois da Spec 001 (migração das entregas dos times, Fases 0 a 8). Não mexe nos pacotes que a migração está
> portando enquanto a fase deles não terminar. Pedido do dono em 2026-10-24.

## Por quê

Tudo o que o kit desenha em 3D nasce de dados: a arma vem de um `WeaponDef`, o carro de um `VehicleSpec`, a árvore de uma espécie, o móvel
de um builder com medidas, a casa de uma planta. Hoje, para trocar a cor de um fuzil, o comprimento de uma mesa ou a copa de uma árvore, é
preciso abrir o código ou o JSON, adivinhar o campo, recarregar a página e conferir. O painel junta as três coisas num lugar só:

- **campos** para editar cores, formas e dimensões, com o nome de cada campo no idioma de quem usa;
- **prévia 3D ao vivo**, que se refaz a cada mudança e mostra as animações do objeto (atirar, recarregar, abrir porta, balançar ao vento);
- **o JSON por trás**, para ver, editar direto, copiar e exportar.

Segue o `CLAUDE.md`: é um SDK genérico (serve a um GTA igual a um jogo de zumbi), com API em inglês e textos em locale, e se compõe com os
pacotes que já existem em vez de redesenhar os objetos.

## O que é

Dois pacotes novos e um contrato:

| Peça | Onde | O que faz |
|---|---|---|
| Contrato `EditorAdapter` | `game-contracts/src/editor.ts` | O que cada lib entrega para ser editável: lista de entradas, campos (esquema), validação, mapa de peças e a função que monta o objeto 3D. Fica no contrato para que cada lib implemente sem depender do editor (mesmo padrão da bancada, `bench.ts`). |
| `@adatechnology/game-editor` | núcleo, sem three.js | Documento em edição, histórico (desfazer e refazer), diferença contra o original, validação, importar e exportar JSON, rascunhos. |
| `@adatechnology/game-editor-three` | adaptador three.js | Prévia: cena com luz neutra, órbita, grade, régua de medidas, silhueta de referência de 1,75 m, clique na peça para achar o campo, comparar com o original. |
| Painel (DOM) | dentro de `game-editor`, opcional | Lista de entradas, formulário gerado pelo esquema, aba JSON, botões copiar/baixar/importar. Um jogo pode trocar o painel pelo seu e usar só o núcleo. |

Cada lib expõe o seu adaptador no próprio pacote (`game-weapons-three` exporta `weaponsEditor`, `game-vehicles` exporta `vehiclesEditor`,
e assim por diante). O editor não conhece armas nem carros: só lê o esquema que o adaptador declara.

### Esboço da API (a fechar na T9.1)

```ts
// game-contracts/src/editor.ts
export type FieldKind = 'number' | 'boolean' | 'choice' | 'color' | 'text' | 'vector' | 'list' | 'ref' | 'group'
export interface EditorField {
  readonly path: string            // caminho no JSON, ex.: 'body.paint' ou 'parts.barrel.length'
  readonly kind: FieldKind
  readonly name: string            // já traduzido para o locale
  readonly hint?: string
  readonly unit?: string           // 'm', 'mm', 'kg', '°'
  readonly min?: number; readonly max?: number; readonly step?: number
  readonly options?: readonly { id: string; name: string }[]   // choice
  readonly ref?: string            // ref: id de outro catálogo (ex.: calibre)
  readonly locked?: 'physics' | 'derived'   // mostrado, não editável (constante física ou valor calculado)
  readonly realRange?: readonly [number, number]               // medida real: fora dela avisa, não bloqueia
  readonly rebuild?: 'none' | 'material' | 'full'              // custo da mudança na prévia (cor só troca material)
  readonly fields?: readonly EditorField[]                     // group e list
}
export interface EditorAdapter<Def = unknown> {
  readonly id: string
  readonly name: string
  entries(locale: string): readonly { id: string; name: string; group?: string }[]
  get(id: string): Def
  fields(def: Def, locale: string): readonly EditorField[]  // pode depender do próprio def (ex.: só mostra rajada se houver rpm)
  validate(def: Def): readonly string[]
  /** Peças do objeto 3D pelo nome, apontando para o campo que as controla. */
  parts?(def: Def): Readonly<Record<string, string>>
  /** Monta o objeto. `THREE` e o retorno são `unknown` porque o contrato não depende do three.js. */
  build(THREE: unknown, def: Def, locale: string): { object: unknown; dispose(): void; actions?: readonly { id: string; name: string; run(): void }[] }
}

// game-editor
export function createEditor(adapters: readonly EditorAdapter[], options?: EditorOptions): Editor
export interface Editor {
  open(adapterId: string, entryId: string): void
  set(path: string, value: unknown): void
  undo(): void; redo(): void
  json(): unknown                     // a entrada inteira, editada
  patch(): unknown                    // só o que mudou, no formato `patches` por id
  load(json: unknown): readonly string[]   // devolve os problemas da validação
  on(listener: (event: EditorEvent) => void): () => void
}
```

Os campos reaproveitam a forma dos controles da bancada (`NumberControl`, `ChoiceControl`) e acrescentam o que a bancada não tem: cor,
texto, vetor, lista, referência e grupo.

## Como o dono usa

1. Abre o editor na página do kit (`?area=editor`) ou aperta **Editar** na área de uma lib na sala de testes.
2. Escolhe a entrada (ex.: Armas › Fuzis › AK-47). A prévia mostra o objeto girando, com a régua e a silhueta de 1,75 m ao lado.
3. Muda a cor da coronha, o comprimento do cano, o calibre. A prévia se refaz na hora; cor só troca o material, forma refaz a peça.
4. Clica numa peça na prévia: o formulário pula para o campo dela. Liga **Comparar** e vê o original em fantasma por cima.
5. Aperta **Atirar** ou **Recarregar** (ações que o adaptador declara) para ver a animação com as medidas novas.
6. Abre a aba **JSON**: vê a entrada inteira e, ao lado, só a diferença. Pode editar o texto direto; o formulário e a prévia acompanham, e
   erro de validação aparece na linha.
7. **Copiar** ou **Baixar** o resultado em três formatos: a entrada inteira (para `extra`), a diferença por id (para `patches`, o mesmo
   formato do `deepMerge` de `game-weapons`) ou o pacote de conteúdo inteiro. **Importar** abre um JSON de volta.

O JSON exportado é o que o jogo passa nas opções da lib (`extra`, `patches`, `remove`), sem mexer no núcleo, como pede o `CLAUDE.md` §2.

## O que cada lib deixa editar

A ordem segue a migração: cada adaptador entra quando a fase da lib na Spec 001 termina.

| Lib | Pacote do adaptador | Cores | Formas e dimensões | Outros campos | Ações na prévia |
|---|---|---|---|---|---|
| Armas | `game-weapons-three` | acabamento por peça (ferrolho, armação, coronha, guarda-mão) | comprimento, cano, coronha, carregador | calibre (ref), cadência, modos, encaixes de acessório | atirar, rajada, recarregar, pane |
| Casas e prédios | `game-floorplan-three` | paredes, telhado, esquadrias, piso | pé-direito, espessura de parede, andares, janelas e portas | material da estrutura (concreto, tijolo), cômodos | abrir portas, cortar fachada, mostrar estrutura |
| Itens | `game-items-three` | cor e rótulo | medidas reais | peso, validade, categoria | usar (ex.: tomar café) |
| Personagens e zumbis | `game-characters-three` | pele, roupa, cabelo, olhos | altura, proporção do guia | tipo de zumbi, velocidade | andar, correr, morder |
| Animais | `game-animals-three` | pelagem | porte | espécie, visual (normal, doente, infectado) | andar, correr |
| Efeitos | `game-vfx-three` | cores do fogo, fumaça, sangue | raio, altura | partículas, duração | disparar o efeito |
| Veículos | `game-vehicles` | pintura (cor por semente ou fixa) | `DIMS`, rodas | grupo, blindagem | abrir portas, acender faróis, batida |
| Vegetação | `game-vegetation` | folhas por estação, tronco | altura, copa | espécie, densidade | vento |
| Móveis e objetos | `game-interactables-household`, `game-props3d` | por material | medidas do builder | peças desmontáveis | abrir, ligar, usar |

Medida real (arma, veículo, móvel) vem com `realRange`: o painel avisa quando sai do real, mas deixa (um jogo pode querer exagerar).
Constante física (energia do calibre, densidade do material) aparece trancada.

## Requisitos

- R1. O núcleo do editor e o contrato não conhecem nenhuma lib nem o ZombiAdA: tudo o que é editável vem do `EditorAdapter`.
- R2. Cada adaptador monta a prévia com o **mesmo builder** que o jogo usa. Proibido um modelo "de editor" parecido: o que se vê no painel
  é o que vai para o jogo.
- R3. A prévia se refaz em menos de 100 ms para cor (troca de material) e em menos de 500 ms para forma, numa arma ou carro do kit.
- R4. Formulário, prévia e JSON ficam sempre iguais: mudar um muda os outros dois, com desfazer e refazer.
- R5. Exporta a entrada inteira, a diferença por id e o pacote; importa qualquer um dos três, validando e listando os problemas.
- R6. Textos em `en` e `pt-BR`; nomes de campo vêm dos locales de cada lib.
- R7. Funciona sem internet (three.js e fontes embutidos na página de exemplo) e tem cópia offline no repositório do jogo, como as demais
  prévias (`docs/offline/`).
- R8. Rascunhos guardados no navegador (`localStorage`, com `try/catch`) e, se o jogo quiser, num armazenamento que ele passa nas opções.
- R9. Área própria na sala de testes (`examples/editor-test-area`, `?area=editor`) e botão **Editar** nas áreas das libs que têm adaptador.
- R10. Testes: contrato (`checkEditorAdapter`, como o `checkBench`), ida e volta do JSON (exportar e importar dá o mesmo hash de cena),
  e golden por adaptador (a entrada sem edição monta igual ao golden da lib).

## Fora do escopo

- Escultura livre (mexer em vértices), importar glTF ou Blender, pintar textura. O editor muda **parâmetros**; forma nova é builder novo.
- Desenhar planta de casa do zero (fica para uma spec própria de editor de plantas). Aqui se editam medidas e materiais de uma planta que já
  existe.
- Editor dentro do jogo para o jogador (modo criativo), edição a várias mãos ao mesmo tempo, edição durante partida em LAN.

## Pontos em aberto (recomendação entre parênteses)

- Onde o JSON editado vai parar: só copiar e baixar, ou o painel grava direto na pasta do projeto pelo navegador (File System Access) quando
  houver? (Começar com copiar, baixar e importar; gravar na pasta como opção depois.)
- "Formas": só parâmetros dos builders (comprimento, raio, número de peças) ou também trocar o tipo do builder (ex.: coronha fixa por
  dobrável)? (Parâmetros e escolhas que o builder já oferece; tipo novo é trabalho do time.)
- O painel entra antes do fim da Spec 001 para as libs já migradas (armas, veículos, vegetação, móveis)? (Não: espera a Fase 8, para não
  disputar os mesmos pacotes com a migração.)
