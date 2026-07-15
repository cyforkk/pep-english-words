import type { PlayerSettings, Textbook } from '../types/textbook'
import { DEFAULT_SETTINGS } from '../types/textbook'

const TEXTBOOKS_KEY = 'le_imported_textbooks'
const SETTINGS_KEY = 'le_player_settings'

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
  localStorage.setItem(TEXTBOOKS_KEY, JSON.stringify(list))
}

export function upsertImportedTextbook(book: Textbook): Textbook[] {
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
      shuffle: data.shuffle ?? DEFAULT_SETTINGS.shuffle,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: PlayerSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
