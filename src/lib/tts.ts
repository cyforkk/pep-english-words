export type SpeakLang = 'zh-CN' | 'en-US'

export type SpeakOptions = {
  lang: SpeakLang
  rate?: number
}

function pickVoice(lang: SpeakLang): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  const prefix = lang === 'zh-CN' ? 'zh' : 'en'
  return (
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix)) ??
    voices.find((v) => v.lang.toLowerCase().includes(prefix)) ??
    null
  )
}

/** 部分浏览器需异步加载 voice 列表 */
export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve([])
      return
    }
    const list = speechSynthesis.getVoices()
    if (list.length > 0) {
      resolve(list)
      return
    }
    const onChange = () => {
      speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve(speechSynthesis.getVoices())
    }
    speechSynthesis.addEventListener('voiceschanged', onChange)
    // 兜底：部分环境不触发 voiceschanged
    setTimeout(() => {
      speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve(speechSynthesis.getVoices())
    }, 500)
  })
}

export function hasVoiceFor(lang: SpeakLang): boolean {
  return pickVoice(lang) !== null
}

export function cancelSpeak(): void {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
}

/**
 * 朗读文本，在结束或取消时 resolve。
 * 调用 cancelSpeak 会让当前 Promise resolve（不抛错），便于播放队列切换。
 */
export function speak(text: string, options: SpeakOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof speechSynthesis === 'undefined') {
      reject(new Error('当前浏览器不支持语音合成（Web Speech API）'))
      return
    }
    const trimmed = text.trim()
    if (!trimmed) {
      resolve()
      return
    }

    cancelSpeak()

    const utter = new SpeechSynthesisUtterance(trimmed)
    utter.lang = options.lang
    utter.rate = Math.min(2, Math.max(0.5, options.rate ?? 1))
    const voice = pickVoice(options.lang)
    if (voice) utter.voice = voice

    utter.onend = () => resolve()
    utter.onerror = (e) => {
      // interrupted 视为正常取消
      if (e.error === 'interrupted' || e.error === 'canceled') {
        resolve()
        return
      }
      reject(new Error(`语音播放失败: ${e.error}`))
    }

    speechSynthesis.speak(utter)
  })
}
