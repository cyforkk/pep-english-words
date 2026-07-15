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
  source?: string
}

export type TextbookIndexItem = {
  id: string
  title: string
  words: number
  units: number
}

export type TextbookIndex = {
  description?: string
  books: TextbookIndexItem[]
}

export type PlayerSettings = {
  rate: number
  repeatEn: number
  gapMs: number
  shuffle: boolean
}

/** 点读：列表点英；跟读：自动念英文 */
export type PlayMode = 'browse' | 'shadow'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'done'

export const DEFAULT_SETTINGS: PlayerSettings = {
  rate: 0.9,
  repeatEn: 2,
  gapMs: 3000,
  shuffle: false,
}
