export type AvatarAreaText = {
  group: string
  name: string
  actions: Record<'camera_first' | 'camera_third' | 'crouch' | 'stand' | 'fall' | 'get_up' | 'armed_on' | 'armed_off' | 'stop_clip', string>
  /** Prefix of the button that plays a clip: `Play: grabbed_bitten_human`. */
  play: string
  metrics: Record<'camera' | 'clip' | 'last_event' | 'state' | 'joints', string>
  none: string
}

export const AVATAR_TEXT: Record<string, AvatarAreaText> = {
  en: {
    group: 'Avatar',
    name: 'Player body',
    actions: {
      camera_first: 'Camera: 1st person',
      camera_third: 'Camera: 3rd person',
      crouch: 'Crouch',
      stand: 'Stand up',
      fall: 'Fall down',
      get_up: 'Get up',
      armed_on: 'Armed: on',
      armed_off: 'Armed: off',
      stop_clip: 'Stop clip',
    },
    play: 'Play',
    metrics: { camera: 'Camera', clip: 'Clip playing', last_event: 'Last clip event', state: 'State', joints: 'Joints' },
    none: 'none',
  },
  'pt-BR': {
    group: 'Avatar',
    name: 'Corpo do jogador',
    actions: {
      camera_first: 'Câmera: 1ª pessoa',
      camera_third: 'Câmera: 3ª pessoa',
      crouch: 'Agachar',
      stand: 'Levantar',
      fall: 'Cair',
      get_up: 'Levantar do chão',
      armed_on: 'Armado: ligado',
      armed_off: 'Armado: desligado',
      stop_clip: 'Parar clipe',
    },
    play: 'Tocar',
    metrics: { camera: 'Câmera', clip: 'Clipe tocando', last_event: 'Último evento do clipe', state: 'Estado', joints: 'Juntas' },
    none: 'nenhum',
  },
}
