import type { PlayerSettings, PlayMode, Word } from '../types/textbook'
import { cancelSpeak, speak } from './tts'

export type QueueCallbacks = {
  onIndexChange: (index: number, word: Word | null) => void
  onStatusChange: (status: 'idle' | 'playing' | 'paused' | 'done') => void
  onError?: (message: string) => void
}

/** Fisher–Yates 打乱（不修改原数组） */
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 跟读播放状态机：严格按传入 words 顺序；英文 × repeatEn → gap → 下一词。
 * speak 失败则暂停并上报，不空跑后续词。
 */
export class WordPlayer {
  private queue: Word[] = []
  private index = 0
  private mode: PlayMode = 'shadow'
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

  /** 顺序严格等于传入列表（打乱只在 UI 层做一次） */
  async start(words: Word[], mode: PlayMode) {
    if (mode === 'browse') return
    this.stopInternal(false)
    this.mode = mode
    this.queue = [...words]
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
        if (this.mode === 'shadow') {
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
        const msg = e instanceof Error ? e.message : String(e)
        this.callbacks.onError?.(`发音失败，已暂停：${msg}`)
        // 停在当前词，不推进；用户可「下一词」跳过或「停止」
        this.pause()
        return
      }

      if (this.aborted || token !== this.runToken) return

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
      // 仅英文结束提示（产品不做中文语音）
      try {
        await speak('Finished.', { lang: 'en-US', rate: this.settings.rate })
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
    } else {
      // 从 speak 失败 pause 返回时没有 waitIfPaused 挂起，需从当前 index 重进 loop
      const token = this.runToken
      void this.loop(token)
    }
  }

  async skip() {
    if (this.status !== 'playing' && this.status !== 'paused') return
    this.forceNext = true
    cancelSpeak()
    this.clearGap()
    if (this.status === 'paused') {
      // 失败暂停时：跳过当前词并继续
      this.index += 1
      this.forceNext = false
      this.setStatus('playing')
      if (this.pauseResolve) {
        const r = this.pauseResolve
        this.pauseResolve = null
        r()
      } else {
        void this.loop(this.runToken)
      }
      return
    }
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
