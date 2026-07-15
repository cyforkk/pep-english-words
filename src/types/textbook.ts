export type Word = {
  en: string
  zh: string
  phonetic?: string
}

export type Unit = {
  id: string
  title: string
  words: Word[]
}

export type Textbook = {
  id: string
  title: string
  units: Unit[]
}

export type PlayerSettings = {
  rate: number
  repeatZh: number
  repeatEn: number
  gapMs: number
  shuffle: boolean
  hideEnInDictation: boolean
}

export type PlayMode = 'browse' | 'dictation' | 'shadow'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'done'

export const DEFAULT_SETTINGS: PlayerSettings = {
  rate: 0.9,
  repeatZh: 2,
  repeatEn: 2,
  gapMs: 3000,
  shuffle: false,
  hideEnInDictation: true,
}
