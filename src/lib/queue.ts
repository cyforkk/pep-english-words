import type { PlayerSettings, PlayMode, Word } from '../types/textbook'
import { cancelSpeak, speak } from './tts'

export type QueueCallbacks = {
  onIndexChange: (index: number, word: Word | null) => void
  onStatusChange: (status: 'idle' | 'playing' | 'paused' | 'done') => void
  onError?: (message: string) => void
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildQueue(words: Word[], shuffle: boolean): Word[] {
  if (words.length === 0) return []
  return shuffle ? shuffleArray(words) : [...words]
}

/**
 * 听写/跟读播放状态机。
 * 听写：中文 × repeatZh → gap → 下一词
 * 跟读：英文 × repeatEn → gap → 下一词
 */
export class WordPlayer {
  private queue: Word[] = []
  private index = 0
  private mode: PlayMode = 'dictation'
  private settings: PlayerSettings
  private callbacks: QueueCallbacks
  private status: 'idle' | 'playing' | 'paused' | 'done' = 'idle'
  private aborted = false
  private forceNext = false
  private pauseResolve: (() => void) | null = null
  private gapTimer: ReturnType<typeof setTimeout> | null = null
  private gapResolve: (() => void) | null = null
  private runToken = 0

  constructor(settings: PlayerSettings, callbacks: QueueCallbacks) {
    this.settings = settings
    this.callbacks = callbacks
  }

  updateSettings(settings: PlayerSettings) {
    this.settings = settings
  }

  getIndex() {
    return this.index
  }

  getQueue() {
    return this.queue
  }

  getStatus() {
    return this.status
  }

  private setStatus(s: typeof this.status) {
    this.status = s
    this.callbacks.onStatusChange(s)
  }

  private emitIndex() {
    const word = this.queue[this.index] ?? null
    this.callbacks.onIndexChange(this.index, word)
  }

  private clearGap() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
    if (this.gapResolve) {
      const r = this.gapResolve
      this.gapResolve = null
      r()
    }
  }

  private waitGap(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.gapResolve = resolve
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null
        this.gapResolve = null
        resolve()
      }, ms)
    })
  }

  private waitIfPaused(): Promise<void> {
    if (this.status !== 'paused') return Promise.resolve()
    return new Promise((resolve) => {
      this.pauseResolve = resolve
    })
  }

  async start(words: Word[], mode: PlayMode) {
    if (mode === 'browse') return
    this.stopInternal(false)
    this.mode = mode
    this.queue = buildQueue(words, this.settings.shuffle)
    this.index = 0
    this.aborted = false
    this.forceNext = false
    this.runToken += 1
    const token = this.runToken
    if (this.queue.length === 0) {
      this.setStatus('idle')
      this.callbacks.onError?.('请先选择包含单词的单元')
      return
    }
    this.setStatus('playing')
    this.emitIndex()
    await this.loop(token)
  }

  private async loop(token: number) {
    while (!this.aborted && token === this.runToken && this.index < this.queue.length) {
      this.forceNext = false
      await this.waitIfPaused()
      if (this.aborted || token !== this.runToken) return

      const word = this.queue[this.index]
      this.emitIndex()

      try {
        if (this.mode === 'dictation') {
          const n = Math.max(1, this.settings.repeatZh)
          for (let i = 0; i < n; i++) {
            if (this.forceNext) break
            await this.waitIfPaused()
            if (this.aborted || token !== this.runToken) return
            if (this.forceNext) break
            await speak(word.zh, { lang: 'zh-CN', rate: this.settings.rate })
            if (this.aborted || token !== this.runToken) return
            if (this.forceNext) break
          }
        } else if (this.mode === 'shadow') {
          const n = Math.max(1, this.settings.repeatEn)
          for (let i = 0; i < n; i++) {
            if (this.forceNext) break
            await this.waitIfPaused()
            if (this.aborted || token !== this.runToken) return
            if (this.forceNext) break
            await speak(word.en, { lang: 'en-US', rate: this.settings.rate })
            if (this.aborted || token !== this.runToken) return
            if (this.forceNext) break
          }
        }
      } catch (e) {
        this.callbacks.onError?.(e instanceof Error ? e.message : String(e))
      }

      if (this.aborted || token !== this.runToken) return

      // 跳过当前词时不再等待间隔；最后一词也不等待
      if (!this.forceNext && this.index < this.queue.length - 1) {
        await this.waitGap(Math.max(0, this.settings.gapMs))
        if (this.aborted || token !== this.runToken) return
      }

      this.forceNext = false
      this.index += 1
    }

    if (!this.aborted && token === this.runToken) {
      this.setStatus('done')
      this.callbacks.onIndexChange(this.queue.length, null)
      try {
        await speak('本单元结束', { lang: 'zh-CN', rate: this.settings.rate })
      } catch {
        /* ignore */
      }
    }
  }

  pause() {
    if (this.status !== 'playing') return
    this.setStatus('paused')
    cancelSpeak()
    this.clearGap()
  }

  resume() {
    if (this.status !== 'paused') return
    this.setStatus('playing')
    if (this.pauseResolve) {
      const r = this.pauseResolve
      this.pauseResolve = null
      r()
    }
  }

  async skip() {
    if (this.status !== 'playing' && this.status !== 'paused') return
    // 只打断当前发音/间隔，由 loop 统一 index++，避免双跳
    this.forceNext = true
    cancelSpeak()
    this.clearGap()
    if (this.status === 'paused') {
      this.setStatus('playing')
      if (this.pauseResolve) {
        const r = this.pauseResolve
        this.pauseResolve = null
        r()
      }
    }
  }

  /** 重读当前词：取消当前发音后由 loop 在 pause 恢复逻辑较复杂，改为 stop+从当前 index 重开 */
  async replayCurrent() {
    if (this.queue.length === 0) return
    if (this.index >= this.queue.length) this.index = this.queue.length - 1
    const from = this.index
    const rest = this.queue.slice(from)
    const mode = this.mode
    await this.start(rest, mode)
  }

  stop() {
    this.stopInternal(true)
  }

  private stopInternal(emitIdle: boolean) {
    this.aborted = true
    this.runToken += 1
    cancelSpeak()
    this.clearGap()
    if (this.pauseResolve) {
      const r = this.pauseResolve
      this.pauseResolve = null
      r()
    }
    this.queue = []
    this.index = 0
    if (emitIdle) {
      this.setStatus('idle')
      this.callbacks.onIndexChange(0, null)
    }
  }
}
