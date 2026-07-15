import type { PlayerSettings, Textbook } from '../types/textbook'
import { DEFAULT_SETTINGS } from '../types/textbook'

const TEXTBOOKS_KEY = 'le_imported_textbooks'
const SETTINGS_KEY = 'le_player_settings'

/** 导入词表粗略上限，避免撑爆 localStorage */
export const MAX_IMPORT_WORDS = 5000

export function countWords(book: Textbook): number {
  return book.units.reduce((s, u) => s + u.words.length, 0)
}

export function loadImportedTextbooks(): Textbook[] {
  try {
    const raw = localStorage.getItem(TEXTBOOKS_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as Textbook[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveImportedTextbooks(list: Textbook[]): void {
  try {
    localStorage.setItem(TEXTBOOKS_KEY, JSON.stringify(list))
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      throw new Error('本地存储空间不足，无法保存导入词表。请删除部分导入教材后重试。')
    }
    throw new Error(e instanceof Error ? e.message : '保存导入词表失败')
  }
}

export function upsertImportedTextbook(book: Textbook): Textbook[] {
  const n = countWords(book)
  if (n > MAX_IMPORT_WORDS) {
    throw new Error(`导入词数过多（${n}），上限 ${MAX_IMPORT_WORDS} 词`)
  }
  const list = loadImportedTextbooks()
  const idx = list.findIndex((b) => b.id === book.id)
  if (idx >= 0) list[idx] = book
  else list.push(book)
  saveImportedTextbooks(list)
  return list
}

export function removeImportedTextbook(id: string): Textbook[] {
  const list = loadImportedTextbooks().filter((b) => b.id !== id)
  saveImportedTextbooks(list)
  return list
}

export function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const data = JSON.parse(raw) as Partial<PlayerSettings>
    return {
      rate: data.rate ?? DEFAULT_SETTINGS.rate,
      repeatEn: data.repeatEn ?? DEFAULT_SETTINGS.repeatEn,
      gapMs: data.gapMs ?? DEFAULT_SETTINGS.gapMs,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* 设置丢失可接受，不阻断主流程 */
  }
}
