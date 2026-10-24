/**
 * The 47 day-by-day events of Os Vivos do Vale (`EV`, lines 372-497) as `game-stories` story data: each `run(S, A, F)` turned into variants with
 * conditions, text pieces and changes, word for word. The golden `game-stories-life.json` checks that the SDK running these beats gives the team's log.
 * The events are grouped in stories by the people and place they follow; the order inside a day is the team's.
 */
type Json = Record<string, unknown>

const living = (role: string) => ({ living: role })
const state = (role: string, is: string | string[]) => ({ state: role, is })
const base = (role: string, is: string) => ({ base: role, is })
const action = (id: string) => ({ action: id })
const flag = (id: string) => ({ flag: id })
const all = (...conditions: Json[]) => ({ all: conditions })
const any = (...conditions: Json[]) => ({ any: conditions })
const not = (condition: Json) => ({ not: condition })
const change = (role: string, st: string, note: string, b?: string | { baseOf: string }) => ({ role, state: st, note, ...(b ? { base: b } : {}) })
const when = (condition: Json, ...changes: Json[]) => ({ when: condition, changes })
const piece = (condition: Json, text: string, otherwise?: string) => ({ when: condition, text, ...(otherwise === undefined ? {} : { else: otherwise }) })
const flags = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]))

type Variant = { when?: Json; none?: true; text?: (string | Json)[]; join?: string; changes?: Json[]; flags?: Json; alt?: true; needsChanges?: true }
type Beat = { id: string; day: number; title: string; roles: string[]; values?: Json; variants: Variant[] }
const beat = (id: string, day: number, title: string, roles: string[], variants: Variant[], values?: Json): Beat => ({ id, day, title, roles, ...(values ? { values } : {}), variants })
const always = (text: string, extra: Omit<Variant, 'text'> = {}): Variant => ({ text: [text], ...extra })
const otherwiseNone: Variant = { none: true }

const LUCAS_TOLD = all(living('lucas'), base('lucas', 'oficina'), flag('lucasContou'))
const HEARS = any(living('jessica'), living('nelson'), living('kevin'))
const BUS_POOL = ['rosa', 'gil', 'lucas', 'nelson', 'chico', 'criancas', 'val', 'mariana', 'zilda', 'tadeu', 'diego', 'nicole', 'bianca', 'livia', 'kauan', 'taina', 'vitoria', 'lucia', 'josue', 'paula']
const ON_BUS = all(state('self', ['ok', 'hurt', 'moved']), any(not({ self: 'lucas' }), base('lucas', 'oficina')))

const STORY_BEATS: Record<string, Beat[]> = {
  aurora: [
    beat('d3_socorro', 3, 'Pedido de socorro no Jardim Aurora', ['helena', 'jessica', 'kauan'], [always('Helena chama no rádio do marido, presa num sobrado com o filho. Jéssica repete o pedido na transmissão das 20h; Kauã também ouve.')]),
    beat('d10_helena_sai', 10, 'Helena tenta sair sozinha', ['helena'], [
      { when: action('helena'), alt: true, text: ['O jogador chegou antes. Helena e Davi entram no grupo, com a planta da rua desenhada.'], changes: [change('helena', 'party', 'com Davi')] },
      { text: ['Sem comida, Helena sai com Davi no colo. É mordida no portão; Davi corre e chega à igreja.'], changes: [change('helena', 'bitten', 'mordida no portão')], flags: flags('davi') },
    ]),
    beat('d12_helena_reanima', 12, 'Helena reanima', ['helena'], [{ when: not(state('helena', 'bitten')), none: true }, always('Zumbi nomeado na rua das Acácias, com o sinalizador laranja no bolso.', { changes: [change('helena', 'undead', 'rua das Acácias, sinalizador no bolso')] })]),
  ],
  matriz: [
    beat('d6_taina', 6, 'Tainá chega à Matriz', ['taina', 'zilda'], [always('Tainá chega à igreja grávida de sete meses, com um saco de arroz nas costas. A Zilda conta nos dedos: o bebê nasce no fim do mês que vem.')]),
    beat('d14_insulina', 14, 'Mariana sem insulina', ['mariana', 'zilda', 'armando'], [
      { when: action('insulina'), alt: true, text: ['O jogador trouxe insulina. Mariana estabiliza e a Zilda passa a confiar no jogador (+30).'], changes: [] },
      { text: ['Mariana entra em crise. A Zilda passa a noite em claro e esquece de descer ao porão.'], changes: [change('mariana', 'hurt', 'crise de glicose')] },
    ]),
    beat('d16_mariana', 16, 'Mariana morre', ['mariana', 'zilda'], [
      { when: action('insulina'), none: true },
      always('Mariana morre na sacristia. Val abre a cova; Zilda não sai do lado do caixão improvisado.', { changes: [change('mariana', 'dead', 'enterrada atrás da igreja'), change('zilda', 'ok', 'de luto')], flags: flags('lutoZilda') }),
    ]),
    beat('d22_porao', 22, 'O porão da igreja', ['arnaldo', 'zilda', 'val', 'criancas'], [
      { when: all(action('arnaldo'), state('arnaldo', 'undead')), alt: true, text: ['Com a chave do Val e a permissão da Zilda, o jogador dá paz ao Arnaldo. Ela enterra o marido com o relógio.'], changes: [change('arnaldo', 'dead', 'enterrado com o relógio')] },
      {
        when: all(flag('lutoZilda'), living('zilda')),
        text: ['De luto, Zilda esquece o cadeado aberto. Arnaldo arranca a argola da parede e morde a esposa na escada. Val o mata com a pá, tarde demais, e se corta na briga.'],
        changes: [change('zilda', 'bitten', 'mordida no braço'), change('arnaldo', 'dead', 'morto pelo Val'), change('val', 'hurt', 'corte na mão')],
      },
    ]),
    beat('d24_igreja', 24, 'A igreja sem a Zilda', ['zilda', 'criancas', 'val', 'taina'], [
      { when: not(state('zilda', 'bitten')), none: true },
      always('Zilda reanima de manhã. Val tranca o portão e leva as crianças e a Tainá para a igreja da Vila, com a Pastora Neide.', {
        changes: [change('zilda', 'undead', 'volta à igreja às 6h, com o terço'), change('criancas', 'moved', 'na igreja da Vila', 'vila'), change('val', 'moved', 'na igreja da Vila', 'vila'), when(living('taina'), change('taina', 'moved', 'na igreja da Vila', 'vila'))],
        flags: flags('igrejaCaiu'),
      }),
    ]),
    beat('d38_parto', 38, 'O parto', ['taina', 'zilda', 'cida', 'biel', 'neide'], [
      { when: not(living('taina')), none: true },
      { when: all(base('taina', 'igreja'), state('zilda', ['ok', 'hurt'])), alt: true, text: ['Zilda faz o parto na sacristia, com água fervida e o terço no pulso. Nasce Vitória, quase 3 kg, chorando alto. As crianças escolhem o nome.'], changes: [change('vitoria', 'ok', 'nasceu na Matriz', 'igreja')] },
      {
        when: all(base('taina', 'vila'), living('cida')),
        text: ['Sem a Zilda, a Pastora Neide manda o Biel correr até a serra buscar a Dona Cida. A raizeira desce a trilha de noite e faz o parto no salão da Vila, na frente dos acorrentados. Nasce Vitória. Neide e Cida, que nunca tinham se falado, passam a madrugada rezando cada uma do seu jeito.'],
        changes: [change('vitoria', 'ok', 'nasceu na igreja da Vila', 'vila')],
        flags: flags('cidaVila'),
      },
      { text: ['Sem parteira, o parto dura a noite inteira. Tainá não resiste. A menina vive e ', piece(base('taina', 'vila'), 'a Pastora Neide', 'o Val'), ' fica com ela.'], changes: [change('taina', 'dead', 'no parto'), change('vitoria', 'ok', 'órfã, chamada de Vitória', { baseOf: 'taina' })] },
    ]),
  ],
  colegio: [
    beat('d18_otavio', 18, 'Otávio perde o controle', ['otavio', 'bianca'], [
      { when: action('otavio'), alt: true, text: ['Com enxofre e sem o álcool, Otávio retoma a produção de pólvora e para de falar sozinho.'], changes: [] },
      { text: ['Bêbado, Otávio derruba um frasco e o laboratório pega fogo. Bianca apaga com o extintor; ele fica com queimaduras nas mãos.'], changes: [change('otavio', 'hurt', 'queimaduras nas mãos')] },
    ]),
    beat('d30_laboratorio', 30, 'O laboratório', ['otavio', 'bianca'], [
      { when: action('otavio'), alt: true, text: ['Otávio pede para se juntar ao grupo do jogador e leva Bianca e o estoque de pólvora.'], changes: [change('otavio', 'party', ''), change('bianca', 'party', '')] },
      { text: ['Otávio bebe álcool metílico do estoque e não acorda. Bianca leva o diário dos alunos para o hospital.'], changes: [change('otavio', 'dead', 'no laboratório'), change('bianca', 'moved', 'no hospital, com o Sato', 'hospital')] },
    ]),
  ],
  bloqueio_norte: [
    beat('d1_quarentena', 1, 'Quarentena no norte', ['caio', 'ferraz', 'vinicius'], [always('O pelotão do Tenente Caio fecha a estrada norte com contêineres e arame. Ordem: ninguém sai do vale até a triagem. Quem chega perto ouve tiro de advertência.')]),
    beat('d8_recruta', 8, 'A canela do recruta', ['vinicius', 'caio', 'ferraz'], [
      {
        when: action('vinicius'),
        alt: true,
        text: ['Avisado, o Tenente Caio isola o recruta num contêiner. Vinícius dita uma carta para a mãe e pede para não virar um deles. Caio cumpre o pedido sozinho, ao amanhecer, e os homens passam a confiar nele.'],
        changes: [change('vinicius', 'dead', 'enterrado na barreira, com a foto')],
        flags: flags('caioFirme'),
      },
      { text: ['Vinícius é mordido na canela na patrulha do rio e esconde a ferida com fita e meia.'], changes: [change('vinicius', 'bitten', 'esconde a mordida')] },
    ]),
    beat('d10_conteiner', 10, 'A noite no contêiner', ['vinicius', 'caio', 'ferraz'], [
      { when: not(state('vinicius', 'bitten')), none: true },
      always('Vinícius reanima de madrugada no contêiner dos recrutas e morde o Tenente Caio no braço antes de o Ferraz atirar.', { changes: [change('vinicius', 'dead', 'abatido pelo Ferraz'), change('caio', 'bitten', 'mordida no braço')] }),
    ]),
    beat('d11_sargento', 11, 'O sargento assume', ['caio', 'ferraz'], [
      { when: not(state('caio', 'bitten')), none: true },
      always('Ferraz lê em voz alta a ordem que o tenente escondeu e dá paz a ele antes que reanime. A partir de hoje, quem tentar passar pelo norte leva tiro.', {
        changes: [change('caio', 'dead', 'enterrado ao lado da barreira'), change('ferraz', 'ok', 'comanda o Bloqueio')],
        flags: flags('ferrazManda'),
      }),
    ]),
    beat('d80_sinal', 80, 'Sinal da base', ['renata', 'nelson', 'jessica', 'kevin'], [
      { when: all(HEARS, flag('bloqueioAberto')), alt: true, text: ['Cabo Renata pede ajuda da torre do 7º BIS. O Bloqueio Norte ouve e manda uma viatura pela Estrada do Quartel: Renata desce da torre escoltada, com a chave do paiol.'], changes: [change('renata', 'moved', 'no Bloqueio Norte, com a chave do paiol', 'bloqueio')] },
      { when: HEARS, alt: true, text: ['Cabo Renata pede ajuda da torre do 7º BIS. A rádio retransmite: abre a missão da base e do paiol.'], changes: [change('renata', 'ok', 'espera resgate na torre')] },
      { text: ['Cabo Renata chama a noite toda. Ninguém responde.'], changes: [] },
    ]),
    beat('d88_torre', 88, 'A torre do 7º BIS', ['renata'], [
      { when: all(state('renata', 'ok'), not(living('jessica')), not(living('nelson')), not(living('kevin'))), text: ['Sem água, Cabo Renata desce da torre à noite e não volta.'], changes: [change('renata', 'dead', 'ao pé da torre')] },
    ]),
  ],
  falcao: [
    beat('d2_helicoptero', 2, 'O helicóptero cai na serra', ['lince', 'paula', 'kevin', 'profeta'], [always('O helicóptero da Equipe Falcão cai na Serra do Corvo. O piloto morre. Os Corvos chegam aos destroços antes da equipe voltar e levam um fuzil e duas caixas de munição.', { flags: flags('corvosArmados') })]),
    beat('d14_falcao', 14, 'A Falcão chega ao hospital', ['lince', 'paula', 'kevin', 'nelson'], [{ text: ['A Equipe Falcão se esconde no edifício-garagem ao lado do hospital. Kevin acha a frequência da Vale FM', piece(living('renata'), ' e, por ela, o rádio secreto da Cabo Renata.', '.')] }]),
    beat('d30_comando', 30, 'A mensagem do Comando', ['kevin', 'lince', 'paula'], [
      { when: not(living('kevin')), none: true },
      always('O rádio de satélite fala pela primeira vez. Só o Kevin ouve tudo: a extração foi cancelada e a ordem é queimar o laboratório do hospital com as amostras.', { flags: flags('ordemQueima') }),
    ]),
    beat('d46_fogo', 46, 'Fogo na ala isolada', ['lince', 'paula', 'kevin', 'sato', 'nicole', 'kauan'], [
      { when: not(all(flag('ordemQueima'), living('lince'))), none: true },
      { when: state('sato', 'hostile'), alt: true, text: ['A Falcão entra na ala isolada para cumprir a ordem. Sozinho, Sato avança com uma seringa contra o capitão e leva um tiro. Paula não deixa queimar a ala com os presos dentro.'], changes: [change('sato', 'dead', 'na ala isolada, com o gravador')] },
      {
        join: ' ',
        text: [
          'Lince invade a ala isolada com a ordem de queimar tudo.',
          piece(state('nicole', 'bitten'), 'Paula dá paz à Nicole antes que ela reanime.'),
          piece(living('kevin'), 'Uma maca se solta no corredor: Kevin é mordido no pescoço e pede para ficar de guarda na porta enquanto o fogo sobe.'),
          piece(living('sato'), 'Sato foge pelos túneis da lavanderia com o gravador.'),
          piece(state('kauan', 'missing'), 'Na ala B, a equipe acha o Kauã e o solta.'),
        ],
        changes: [
          when(state('nicole', 'bitten'), change('nicole', 'dead', 'Paula fechou os olhos dela')),
          when(living('kevin'), change('kevin', 'dead', 'de guarda na porta da ala')),
          when(living('sato'), change('sato', 'missing', 'fugiu pelos túneis da lavanderia')),
          when(state('kauan', 'missing'), change('kauan', 'ok', 'solto pela Falcão', 'nomade')),
          when(all(state('bianca', 'moved'), base('bianca', 'hospital')), change('bianca', 'moved', 'fugiu do fogo para a Vila', 'vila')),
        ],
        flags: flags('hospitalQueimado'),
      },
    ]),
    beat('d52_bloqueio', 52, 'Dois comandos no Bloqueio', ['lince', 'paula', 'ferraz', 'caio'], [
      { when: not(living('lince')), none: true },
      {
        when: all(flag('ferrazManda'), living('ferraz')),
        text: ['Sem missão, Lince e Paula sobem a Estrada do Quartel para se juntar ao Bloqueio. O capitão exige o comando. Ferraz atira primeiro: Lince morre na barreira e Paula foge ferida para o posto da PRF.'],
        changes: [change('lince', 'dead', 'na barreira do norte'), change('paula', 'hurt', 'no posto da PRF', 'prf')],
        flags: flags('bloqueioHostil'),
      },
      {
        when: living('caio'),
        alt: true,
        text: ['Lince e Paula chegam ao Bloqueio. Caio e o capitão juntam os homens e mudam a ordem: o norte vira ponto de triagem, não muro. Quem passar sem mordida segue escoltado.'],
        changes: [change('lince', 'moved', 'no Bloqueio Norte', 'bloqueio'), change('paula', 'moved', 'enfermaria do Bloqueio', 'bloqueio')],
        flags: flags('bloqueioAberto'),
      },
    ]),
  ],
  radio: [
    beat('d25_horda_torre', 25, 'Horda ao pé da torre', ['jessica', 'nelson'], [
      { when: action('radio'), alt: true, text: ["Avisada, Jéssica desliga o gerador a tempo e leva a rádio para a caixa d'água do Colégio. A transmissão continua."], changes: [change('jessica', 'ok', 'rádio no Colégio'), change('nelson', 'ok', 'rádio no Colégio')] },
      { text: ['A horda derruba o portão da torre durante a transmissão das 20h. Jéssica morre no ar. Nelson foge ferido para a oficina da Rosa.'], changes: [change('jessica', 'undead', 'ao pé da torre, de fones vermelhos'), change('nelson', 'hurt', 'escondido na oficina', 'oficina')], flags: flags('radioMuda') },
    ]),
    beat('d50_assembleia', 50, 'Assembleia dos grupos', ['jessica', 'brasa', 'rafa', 'italo', 'jacare'], [
      {
        when: all(living('jessica'), flag('provas'), living('brasa')),
        alt: true,
        text: ['Jéssica transmite a lista. Os grupos votam e a Rafa abre o portão por dentro: Brasa perde a delegacia e sobe a serra.'],
        changes: [change('brasa', 'hostile', 'expulso, foi para a serra', 'serra'), change('rafa', 'ok', 'lidera a delegacia'), when(all(living('lucas'), base('lucas', 'deleg')), change('lucas', 'hostile', 'subiu a serra com o Brasa', 'serra'))],
        flags: flags('brasaSerra'),
      },
      {
        when: living('brasa'),
        text: ['Sem voz ou sem provas, ninguém enfrenta o Brasa. A delegacia passa a cobrar comida de todos os grupos do Centro.', piece(all(flag('penitArmada'), living('jacare')), ' Pelo celular, o Jacaré fecha com ele: a penitenciária manda homens, a delegacia manda diesel.')],
        changes: [change('brasa', 'ok', 'domina o Centro')],
        flags: flags('brasaDomina'),
      },
    ]),
  ],
  penitenciaria: [
    beat('d26_bloco_c', 26, 'O acordo do bloco C', ['josue', 'jacare'], [
      { when: action('penit'), alt: true, text: ['Com a comida e os remédios do jogador, o acordo da penitenciária se mantém. Josué e Jacaré dividem o comando e abrem o portão para troca uma vez por semana.'], changes: [], flags: flags('penitFeira') },
      {
        text: ['A comida acaba no bloco C. Jacaré descobre que o chaveiro do Josué abre a sala de armas, toma as escopetas e solta os rapazes. Josué foge ferido pela estrada e chega ao posto da PRF.'],
        changes: [change('josue', 'hurt', 'no posto da PRF', 'prf'), change('jacare', 'hostile', 'comanda a penitenciária armada')],
        flags: flags('penitArmada'),
      },
    ]),
    beat('d68_bloco_c', 68, 'O bloco C', ['josue', 'jacare', 'brasa'], [
      { when: flag('penitFeira'), alt: true, text: ['A penitenciária vira feira: sabão de cadeia e verdura da horta em troca de remédio. Josué e Jacaré mandam três rapazes reforçar o muro da oficina.'], changes: [] },
      { when: all(flag('penitArmada'), living('jacare')), text: ['Jacaré desce para o Centro com os presos armados e cobra a parte dele dos saques.', piece(flag('brasaDomina'), ' Agora o Centro tem dois pedágios.')], changes: [] },
    ]),
  ],
  hospital: [
    beat('d28_kauan', 28, 'Kauã entra no hospital', ['kauan', 'livia', 'sato'], [
      { when: action('kauan'), alt: true, text: ['Com o jogador, Kauã acha a Lívia na ala isolada. Os dois saem pela lavanderia e entram no grupo.'], changes: [change('kauan', 'party', ''), change('livia', 'party', '')] },
      { text: ['Sozinho, Kauã é pego pelos rapazes do Sato e trancado na ala B. Lívia não fica sabendo.'], changes: [change('kauan', 'missing', 'preso na ala B do hospital')] },
    ]),
    beat('d45_experimento', 45, 'O experimento', ['sato', 'nicole', 'diego', 'kauan', 'bianca'], [
      {
        when: action('sato'),
        alt: true,
        text: ['O jogador mostra a lista ao grupo. Diego e Nicole fogem com antibióticos e soltam quem estava preso. Sato fica sozinho.'],
        changes: [
          change('diego', 'moved', 'na igreja da Vila', 'vila'),
          change('nicole', 'moved', 'na igreja da Vila', 'vila'),
          change('sato', 'hostile', 'sozinho com os presos'),
          when(state('kauan', 'missing'), change('kauan', 'ok', 'solto da ala B')),
          when(state('bianca', 'moved'), change('bianca', 'moved', 'na igreja da Vila', 'vila')),
        ],
      },
      { text: ['Sato pede um voluntário com as palavras certas. Nicole aceita. Ele a infecta e anota cada hora. Diego foge na mesma noite.'], changes: [change('nicole', 'bitten', 'inoculada pelo Sato'), change('diego', 'missing', 'fugiu sem rumo')] },
    ]),
    beat('d47_nicole', 47, 'Nicole reanima', ['nicole', 'sato'], [
      { when: not(state('nicole', 'bitten')), none: true },
      always("Reanima como Corredor em 3 minutos. Sato grava: 'é o primeiro dado limpo'.", { changes: [change('nicole', 'undead', 'Corredor de jaleco, solto no hospital')] }),
    ]),
    beat('d72_ala_b', 72, 'A ala B', ['sato', 'kauan'], [
      { when: state('sato', 'hostile'), text: ['Sozinho, Sato é mordido ao trocar a corrente de um preso.'], changes: [change('sato', 'bitten', 'mordido por um preso')] },
      { when: all(state('sato', 'ok'), state('kauan', 'missing')), text: ['Sato começa o segundo experimento com o preso da ala B.'], changes: [change('kauan', 'bitten', 'inoculado pelo Sato')] },
      {
        when: all(state('sato', 'missing'), flag('penitArmada'), living('jacare')),
        text: ['Sato aparece no portão da penitenciária e oferece ao Jacaré “uma arma que não precisa de bala”.'],
        changes: [change('sato', 'moved', 'no bloco C, com o Jacaré', 'penit')],
        flags: flags('satoPenit'),
      },
    ]),
    beat('d74_reanimacoes', 74, 'Reanimações no hospital', ['sato', 'kauan'], [
      { needsChanges: true, text: ['O hospital ganha mais um zumbi com nome.'], changes: [when(state('sato', 'bitten'), change('sato', 'undead', 'de jaleco, com o gravador no bolso')), when(state('kauan', 'bitten'), change('kauan', 'undead', 'Corredor de capacete, na ala B'))] },
    ]),
  ],
  oficina: [
    beat('d20_gaucho', 20, 'Um gaúcho na BR-Sul', ['lucas', 'lucia', 'gil'], [
      { when: not(living('lucia')), none: true },
      always('Lúcia para uma picape no posto da PRF: Lucas, caminhoneiro gaúcho, sem carga e sem nota. Ela anota a placa no livro e escolta a picape até a oficina. Gil abraça o homem como irmão de estrada.'),
    ]),
    beat('d36_divida', 36, 'A dívida do Lucas', ['lucas', 'bigode', 'brasa'], [
      { when: all(living('lucas'), living('bigode'), living('brasa'), base('lucas', 'oficina')), text: ['Bigode cobra a dívida antiga do Lucas: perdoa tudo em troca de saber onde a Rosa esconde o diesel. Lucas conta.'], flags: flags('lucasContou') },
    ]),
    beat(
      'd40_diesel',
      40,
      'O diesel da oficina',
      ['brasa', 'rosa', 'gil', 'bigode', 'nelson', 'lucas'],
      [
        { when: not(all(living('brasa'), living('rosa'))), none: true },
        { when: action('diesel'), text: ['O jogador contou ao Brasa onde está o diesel. Ele leva tudo sem disparar um tiro. Rosa descobre quem contou.'], changes: [change('rosa', 'hostile', 'odeia o jogador')], flags: flags('dieselPerdido') },
        {
          when: flag('provas'),
          alt: true,
          text: ['Rafa avisa a oficina pelo rádio do Ítalo. O ataque cai numa emboscada: Bigode morre no pátio, Brasa recua ferido.', piece({ value: 'luc' }, ' Lucas foge para a delegacia antes do primeiro tiro.')],
          changes: [change('bigode', 'dead', 'no pátio da oficina'), change('brasa', 'hurt', 'tiro no ombro'), when({ value: 'luc' }, change('lucas', 'moved', 'na delegacia, com o Brasa', 'deleg'))],
        },
        {
          text: [piece({ value: 'luc' }, 'Brasa entra pelo portão que o Lucas deixou destrancado. ', 'Brasa toma a oficina à noite. '), 'Gil morre defendendo o portão, Rosa leva um tiro na perna e o diesel vai para a delegacia.'],
          changes: [change('gil', 'dead', 'no portão da oficina'), change('rosa', 'hurt', 'tiro na perna'), when({ value: 'luc' }, change('lucas', 'moved', 'na delegacia, com o Brasa', 'deleg'))],
          flags: flags('dieselPerdido'),
        },
      ],
      { luc: [{ when: LUCAS_TOLD, value: '1' }] },
    ),
    beat('d48_velas', 48, 'Velas de ignição', ['tadeu', 'rosa'], [
      { when: all(living('tadeu'), state('rosa', ['ok', 'hurt'])), text: ['Tadeu aparece na oficina com uma caixa de velas de ignição embrulhada em jornal. Rosa ri pela primeira vez desde o ataque e aceita ver o pôr do sol do telhado com ele.'], flags: flags('casalRT') },
    ]),
    beat('d66_chico', 66, 'Chico vende o resto', ['chico', 'rosa'], [
      { when: state('rosa', ['ok', 'hurt']), text: ['Rosa compra o que sobrou do diesel do Chico com chapas do ônibus e leva ele para a oficina.'], changes: [change('chico', 'moved', 'na oficina', 'oficina')] },
    ]),
    beat(
      'd70_onibus',
      70,
      'O ônibus blindado',
      ['rosa', 'gil', 'lucas', 'nelson', 'chico', 'tadeu'],
      [
        { when: not(all(state('rosa', ['ok', 'hurt']), { value: 'driver' }, not(flag('dieselPerdido')))), text: ['O ônibus nunca sai. ', piece(flag('dieselPerdido'), 'Sem diesel', 'Sem motorista'), ', vira mais uma barricada no pátio.'], changes: [] },
        {
          alt: true,
          text: [
            'O ônibus sai pela ',
            piece(action('ponte'), 'Ponte Férrea', 'Ponte Velha'),
            ' com ',
            { count: 'changes' },
            ' pessoas a bordo e ',
            { value: 'driver' },
            ' no volante. Quem estava com o jogador fica.',
            piece(all(flag('casalRT'), { changed: 'ivone' }), ' Rosa guardou um lugar para a mãe do Tadeu.'),
            piece(flag('bloqueioAberto'), ' Uma viatura do Bloqueio Norte escolta até a serra.'),
          ],
          changes: [
            { each: { roles: BUS_POOL, where: ON_BUS }, change: { state: 'left', note: 'no ônibus da Rosa' } },
            when(flag('casalRT'), { each: { roles: ['ivone'], where: ON_BUS }, change: { state: 'left', note: 'no ônibus da Rosa' } }),
          ],
        },
      ],
      { driver: [{ when: living('gil'), value: 'Gil' }, { when: all(living('lucas'), base('lucas', 'oficina')), value: 'Lucas' }] },
    ),
  ],
  delegacia: [
    beat('d33_italo', 33, 'Ítalo quer desertar', ['italo', 'brasa', 'rafa'], [
      { when: action('italo'), alt: true, text: ['O jogador cobre a fuga. Ítalo sai de madrugada com as cópias da Rafa: a lista de quem ficou do lado de fora do portão.'], changes: [change('italo', 'party', 'com as cópias da lista')], flags: flags('provas') },
      { text: ['Brasa descobre o plano na reunião das 19h. Ítalo é posto para fora do muro sem arma. A Rafa assiste da janela.'], changes: [change('italo', 'dead', 'na avenida, em frente à delegacia')] },
    ]),
  ],
  oeste: [
    beat('d55_corvos', 55, 'Os Corvos descem da serra', ['profeta', 'ivone', 'tadeu', 'brasa'], [
      {
        text: [
          'Os Corvos atacam a fazenda dos Moreira pela estrada',
          piece(flag('corvosArmados'), ', com o fuzil tirado do helicóptero'),
          '. Tadeu morre na porteira; Ivone se fecha no celeiro com o Joel.',
          piece(flag('brasaSerra'), ' Brasa está com eles.'),
          piece(flag('casalRT'), ' Na oficina, Rosa sobe no ônibus inacabado e não desce por dois dias.'),
        ],
        changes: [change('tadeu', 'dead', 'na porteira dos Moreira'), change('ivone', 'hurt', 'fechada no celeiro'), when(flag('brasaSerra'), change('brasa', 'hostile', 'com os Corvos'))],
      },
    ]),
    beat('d57_viatura', 57, 'A viatura na fazenda', ['lucia', 'douglas', 'ivone'], [
      { when: all(living('lucia'), state('ivone', 'hurt')), text: ['Lúcia e Douglas chegam de viatura depois do ataque e levam Ivone e o Joel para o posto da PRF.'], changes: [change('ivone', 'moved', 'no posto da PRF, com o Joel', 'prf')] },
    ]),
    beat('d58_boa_vista', 58, 'Sítio Boa Vista', ['dito', 'profeta', 'ivone'], [
      { when: action('dito'), alt: true, text: ['Dito trata o jogador como neto e chama ajuda pelo rádio. Os Corvos recuam do sítio com dois mortos. Ivone e Joel se mudam para o Boa Vista.'], changes: [change('dito', 'ok', 'sítio será herança do jogador'), change('ivone', 'ok', 'mora no Boa Vista', 'oeste')] },
      { text: ['Os Corvos tomam o sítio. Dito atira até o último cartucho; Trovão foge para a mata e passa a vigiar o pomar.'], changes: [change('dito', 'dead', 'no alpendre do sítio')], flags: flags('corvosOeste') },
    ]),
    beat('d63_prf', 63, 'Ataque ao posto da PRF', ['lucia', 'douglas', 'profeta', 'jacare'], [
      { when: not(all(flag('corvosOeste'), living('lucia'), base('lucia', 'prf'))), none: true },
      {
        text: [
          'Os Corvos descem a BR atrás da viatura e das armas do posto',
          piece(all(flag('penitArmada'), living('jacare')), ', com presos do Jacaré na carroceria'),
          '. Douglas segura o pátio de moto até o último cartucho de escopeta. Lúcia sai pelos fundos com todo mundo que estava no posto e leva para a oficina.',
        ],
        changes: [change('douglas', 'dead', 'no pátio do posto'), { each: { cast: true, except: ['douglas'], where: all(living('self'), base('self', 'prf')) }, change: { state: 'moved', note: 'na oficina, depois do ataque ao posto', base: 'oficina' } }],
        flags: flags('prfCaiu'),
      },
    ]),
    beat('d85_corvos', 85, 'Os Corvos', ['profeta', 'dito'], [
      { when: all(action('dito'), living('dito')), alt: true, text: ['Os Corvos voltam ao sítio para vingança e caem nas armadilhas do Dito. Profeta morre no pomar.'], changes: [change('profeta', 'dead', 'no pomar do Boa Vista')] },
      { when: flag('corvosOeste'), text: ['Os Corvos controlam o oeste e cobram dízimo na BR.'], changes: [change('profeta', 'ok', 'domina o oeste')] },
    ]),
  ],
  ponte: [
    beat('d60_ponte', 60, 'Horda migratória na Ponte Velha', ['armando', 'neide', 'biel', 'zilda', 'criancas'], [
      { when: all(action('ponte'), living('otavio')), alt: true, text: ['Os explosivos do Otávio derrubam a Ponte Velha. Uns 1.800 zumbis se acumulam na outra margem. O ônibus da Rosa vai precisar da Ponte Férrea.'], changes: [] },
      {
        text: [
          piece(action('ponte'), 'Sem o Otávio, ninguém sabe montar a carga. '),
          'Cerca de 1.800 zumbis atravessam a ponte para o Centro. A loja do Armando cai. Na Vila, os acorrentados da Pastora se soltam no tumulto.',
          piece(all(state('vitoria', 'ok'), base('vitoria', 'vila')), ' Biel leva a bebê Vitória para a laje mais alta.'),
        ],
        changes: [change('armando', 'undead', 'na porta da loja, de colete de caça'), change('neide', 'bitten', 'mordida soltando o filho'), change('biel', 'ok', 'lidera a Vila Esperança')],
      },
    ]),
    beat('d62_depois', 62, 'Depois da horda', ['neide', 'cida', 'profeta'], [
      {
        needsChanges: true,
        join: ' ',
        text: [piece(state('neide', 'bitten'), 'Neide reanima entre os acorrentados.'), piece(flag('corvosOeste'), 'Os Corvos sobem a trilha atrás de ervas e matam Dona Cida.')],
        changes: [when(state('neide', 'bitten'), change('neide', 'undead', 'no salão, com a Bíblia')), when(flag('corvosOeste'), change('cida', 'dead', 'na cabana da cachoeira'))],
      },
    ]),
  ],
  fabril: [
    beat('d75_galpao', 75, 'O galpão desperta', ['chico'], [
      { when: all(living('chico'), not(state('chico', 'moved'))), text: ['A linha de produção acorda a horda dormente do galpão. Chico é mordido tentando desligar o gerador.'], changes: [change('chico', 'bitten', 'no galpão')] },
    ]),
    beat('d77_chico', 77, 'Chico reanima', ['chico'], [{ when: state('chico', 'bitten'), text: ['Zumbi nomeado de capacete amarelo no pátio do depósito.'], changes: [change('chico', 'undead', 'de capacete amarelo, no depósito')] }]),
  ],
}

const CROSSES: Record<string, string[]> = {
  aurora: ['radio'],
  matriz: ['ponte', 'oficina'],
  colegio: ['hospital', 'ponte'],
  bloqueio_norte: ['falcao', 'radio'],
  falcao: ['hospital', 'bloqueio_norte'],
  radio: ['delegacia', 'penitenciaria'],
  penitenciaria: ['hospital', 'oeste', 'radio'],
  hospital: ['falcao', 'colegio'],
  oficina: ['delegacia', 'oeste', 'matriz'],
  delegacia: ['radio', 'oficina'],
  oeste: ['falcao', 'oficina', 'penitenciaria'],
  ponte: ['matriz', 'colegio'],
  fabril: ['oficina'],
}

void otherwiseNone

/** The stories, in the order that keeps the team's order inside a day (Helena before the container on day 10, the church before the Falcão on day 14…). */
export const sliceStories = (): Json[] =>
  Object.entries(STORY_BEATS).map(([id, beats]) => {
    const roles = [...new Set(beats.flatMap((b) => b.roles))]
    return { id, roles: roles.map((role) => ({ id: role, person: role })), crosses: CROSSES[id] ?? [], beats }
  })

/** Seu Cícero and Sandra (jogo.js `NPC`, Phase 8 roles, decision P9): their names are drawn, their kin, age and trade are the game's. */
export const sliceRoles = (): Json => ({
  id: 'bloco_inicial',
  roles: [
    { id: 'rosa', person: 'rosa' },
    { id: 'jessica', person: 'jessica' },
    { id: 'cicero', create: true, tags: ['bloco_inicial'], needs: { sex: 'm', age: [58, 58], base: 'aurora', profession: ['builder'] }, bond: { role: 'rosa', relation: 'irmão', sameSurname: true } },
    { id: 'sandra', create: true, tags: ['bloco_inicial'], needs: { sex: 'f', age: [34, 34], base: 'aurora', profession: ['nurse'] }, bond: { role: 'jessica', relation: 'prima', sameSurname: true } },
  ],
  beats: [],
})
