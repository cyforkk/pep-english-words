import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSelection,
  loadSettings,
  normalizeSettings,
  saveSelection,
  saveSettings,
} from './storage'
import { DEFAULT_SETTINGS } from '../types/textbook'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeSettings / loadSettings', () => {
  it('默认语速为 1.0', () => {
    expect(DEFAULT_SETTINGS.rate).toBe(1)
    expect(loadSettings().rate).toBe(1)
    expect(loadSettings().repeatEn).toBe(2)
    expect(loadSettings().gapMs).toBe(3000)
  })

  it('读写语速/遍数/间隔并做范围限制', () => {
    saveSettings({ rate: 1.25, repeatEn: 3, gapMs: 1500 })
    expect(loadSettings()).toEqual({ rate: 1.25, repeatEn: 3, gapMs: 1500 })

    expect(normalizeSettings({ rate: 9, repeatEn: 99, gapMs: -1 })).toEqual({
      rate: 1.5,
      repeatEn: 10,
      gapMs: 0,
    })
    expect(normalizeSettings({ rate: 0.1, repeatEn: 0, gapMs: 999999 })).toEqual({
      rate: 0.5,
      repeatEn: 1,
      gapMs: 30000,
    })
  })

  it('脏数据回退默认', () => {
    store.set('le_player_settings', '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('loadSelection / saveSelection', () => {
  it('缓存教材、单元、学段折叠、模式', () => {
    saveSelection({
      textbookId: 'pep-primary-g3-s1',
      selectedUnits: ['u1', 'u2'],
      openStages: { primary: true, junior: false, senior: true },
      mode: 'shadow',
    })
    expect(loadSelection()).toEqual({
      textbookId: 'pep-primary-g3-s1',
      selectedUnits: ['u1', 'u2'],
      openStages: { primary: true, junior: false, senior: true },
      mode: 'shadow',
    })
  })

  it('无缓存或非法 textbookId 返回 null', () => {
    expect(loadSelection()).toBeNull()
    store.set('le_selection_v1', JSON.stringify({ selectedUnits: [] }))
    expect(loadSelection()).toBeNull()
  })
})
