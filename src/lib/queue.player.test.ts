import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WordPlayer } from './queue'
import type { PlayerSettings, Word } from '../types/textbook'

const speak = vi.fn()
const cancelSpeak = vi.fn()

vi.mock('./tts', () => ({
  speak: (...args: unknown[]) => speak(...args),
  cancelSpeak: (...args: unknown[]) => cancelSpeak(...args),
}))

const settings: PlayerSettings = { rate: 1, repeatEn: 1, gapMs: 0 }
const words: Word[] = [
  { en: 'one', zh: '一' },
  { en: 'two', zh: '二' },
  { en: 'three', zh: '三' },
]

describe('WordPlayer', () => {
  beforeEach(() => {
    speak.mockReset()
    cancelSpeak.mockReset()
    speak.mockResolvedValue(undefined)
  })

  it('按顺序朗读并结束', async () => {
    const statuses: string[] = []
    const player = new WordPlayer(settings, {
      onIndexChange: () => {},
      onStatusChange: (s) => statuses.push(s),
    })
    await player.start(words, 'shadow')
    expect(speak).toHaveBeenCalledWith('one', expect.objectContaining({ lang: 'en-US' }))
    expect(speak).toHaveBeenCalledWith('two', expect.objectContaining({ lang: 'en-US' }))
    expect(speak).toHaveBeenCalledWith('three', expect.objectContaining({ lang: 'en-US' }))
    expect(speak).toHaveBeenCalledWith('Finished.', expect.any(Object))
    expect(statuses).toContain('playing')
    expect(statuses.at(-1)).toBe('done')
  })

  it('发音失败则暂停且不推进到下一词', async () => {
    const errors: string[] = []
    let status = 'idle'
    speak.mockRejectedValueOnce(new Error('network'))
    const player = new WordPlayer(settings, {
      onIndexChange: () => {},
      onStatusChange: (s) => {
        status = s
      },
      onError: (m) => errors.push(m),
    })
    await player.start(words, 'shadow')
    expect(errors.some((e) => e.includes('发音失败'))).toBe(true)
    expect(status).toBe('paused')
    expect(player.getIndex()).toBe(0)
  })

  it('发音失败后 skip 跳过当前词并继续', async () => {
    const spoken: string[] = []
    let call = 0
    speak.mockImplementation(async (text: string) => {
      call += 1
      if (call === 1) throw new Error('fail')
      spoken.push(text)
    })

    const player = new WordPlayer(settings, {
      onIndexChange: () => {},
      onStatusChange: () => {},
      onError: () => {},
    })
    await player.start(words, 'shadow')
    expect(player.getStatus()).toBe('paused')
    expect(player.getIndex()).toBe(0)
    await player.skip()
    await vi.waitFor(() => {
      expect(player.getStatus()).toBe('done')
    })
    expect(spoken).toContain('two')
    expect(spoken).toContain('three')
    expect(spoken).not.toContain('one')
  })

  it('用户 pause 后 skip 只跳一词（不双次推进）', async () => {
    const spoken: string[] = []
    const gate: { release?: () => void } = {}
    speak.mockImplementation(async (text: string) => {
      if (text === 'one') {
        await new Promise<void>((resolve) => {
          gate.release = resolve
        })
        return
      }
      spoken.push(text)
    })

    const player = new WordPlayer(settings, {
      onIndexChange: () => {},
      onStatusChange: () => {},
    })
    const started = player.start(words, 'shadow')
    await vi.waitFor(() => {
      expect(speak).toHaveBeenCalledWith('one', expect.any(Object))
    })
    player.pause()
    expect(player.getStatus()).toBe('paused')
    expect(player.getIndex()).toBe(0)
    await player.skip()
    // cancelSpeak 语义：speak resolve
    gate.release?.()
    await started
    await vi.waitFor(() => {
      expect(player.getStatus()).toBe('done')
    })
    // 只应跳过 one，依次 two、three；不能因双次 index++ 丢掉 two
    expect(spoken.filter((t) => t !== 'Finished.')).toEqual(['two', 'three'])
  })

  it('播放中 skip 跳过当前词', async () => {
    const spoken: string[] = []
    const gate: { release?: () => void } = {}
    speak.mockImplementation(async (text: string) => {
      if (text === 'one') {
        await new Promise<void>((resolve) => {
          gate.release = resolve
        })
        return
      }
      spoken.push(text)
    })

    const player = new WordPlayer(settings, {
      onIndexChange: () => {},
      onStatusChange: () => {},
    })
    const started = player.start(words, 'shadow')
    await vi.waitFor(() => {
      expect(speak).toHaveBeenCalledWith('one', expect.any(Object))
    })
    await player.skip()
    gate.release?.()
    await started
    await vi.waitFor(() => {
      expect(player.getStatus()).toBe('done')
    })
    expect(spoken).toContain('two')
    expect(spoken).toContain('three')
  })

  it('词间隔中 pause 不提前跳到下一词', async () => {
    const settingsGap: PlayerSettings = { rate: 1, repeatEn: 1, gapMs: 5000 }
    speak.mockImplementation(async () => undefined)

    const player = new WordPlayer(settingsGap, {
      onIndexChange: () => {},
      onStatusChange: () => {},
    })
    void player.start(words, 'shadow')
    await vi.waitFor(() => {
      expect(speak).toHaveBeenCalledWith('one', expect.any(Object))
    })
    // speak one 完成后进入长 gap
    await new Promise((r) => setTimeout(r, 20))
    player.pause()
    expect(player.getStatus()).toBe('paused')
    // 暂停期间不应推进到词 two 的朗读
    await new Promise((r) => setTimeout(r, 80))
    expect(player.getIndex()).toBe(0)
    expect(speak.mock.calls.map((c) => c[0])).toEqual(['one'])
    player.stop()
    expect(player.getStatus()).toBe('idle')
  })
})
