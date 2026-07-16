import type { PlayerSettings, PlayMode } from '../types/textbook'
import { DEFAULT_SETTINGS } from '../types/textbook'

const SETTINGS_KEY = 'le_player_settings'
const SELECTION_KEY = 'le_selection_v1'

/** 教材/单元/学段折叠等选择缓存 */
export type UserSelection = {
  /** 上次选择的教材 id */
  textbookId: string
  /** 上次勾选的单元 id */
  selectedUnits: string[]
  /** 学段折叠展开状态（primary / junior / senior） */
  openStages?: Record<string, boolean>
  /** 上次模式：点读 browse / 跟读 shadow */
  mode?: PlayMode
  /** 默写：列表隐藏英文与音标，仅显示中文 */
  dictationMode?: boolean
}

const RATE_MIN = 0.5
const RATE_MAX = 1.5
const REPEAT_MIN = 1
const REPEAT_MAX = 10
const GAP_MIN = 0
const GAP_MAX = 30_000

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** 规范化播放设置（含默认语速 1.0） */
export function normalizeSettings(partial?: Partial<PlayerSettings> | null): PlayerSettings {
  const src = partial ?? {}
  const rateRaw = typeof src.rate === 'number' ? src.rate : DEFAULT_SETTINGS.rate
  const repeatRaw = typeof src.repeatEn === 'number' ? src.repeatEn : DEFAULT_SETTINGS.repeatEn
  const gapRaw = typeof src.gapMs === 'number' ? src.gapMs : DEFAULT_SETTINGS.gapMs
  // 语速保留两位小数，与滑块 step=0.05 对齐
  const rate = Math.round(clamp(rateRaw, RATE_MIN, RATE_MAX) * 100) / 100
  return {
    rate,
    repeatEn: Math.round(clamp(repeatRaw, REPEAT_MIN, REPEAT_MAX)),
    gapMs: Math.round(clamp(gapRaw, GAP_MIN, GAP_MAX)),
  }
}

export function loadSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const data = JSON.parse(raw) as Partial<PlayerSettings>
    return normalizeSettings(data)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: PlayerSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)))
  } catch {
    /* 设置丢失可接受 */
  }
}

function normalizeOpenStages(input: unknown): Record<string, boolean> | undefined {
  if (!input || typeof input !== 'object') return undefined
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k === 'string' && k.trim() && typeof v === 'boolean') {
      out[k] = v
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normalizeMode(input: unknown): PlayMode | undefined {
  return input === 'browse' || input === 'shadow' ? input : undefined
}

export function loadSelection(): UserSelection | null {
  try {
    const raw = localStorage.getItem(SELECTION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<UserSelection>
    if (typeof data.textbookId !== 'string' || !data.textbookId.trim()) return null
    return {
      textbookId: data.textbookId.trim(),
      selectedUnits: Array.isArray(data.selectedUnits)
        ? data.selectedUnits.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : [],
      openStages: normalizeOpenStages(data.openStages),
      mode: normalizeMode(data.mode),
      dictationMode: data.dictationMode === true,
    }
  } catch {
    return null
  }
}

export function saveSelection(sel: UserSelection): void {
  try {
    localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({
        textbookId: sel.textbookId,
        selectedUnits: sel.selectedUnits,
        openStages: sel.openStages ?? {},
        mode: sel.mode === 'shadow' || sel.mode === 'browse' ? sel.mode : 'browse',
        dictationMode: sel.dictationMode === true,
      }),
    )
  } catch {
    /* 缓存失败不阻断 */
  }
}
