/**
 * 手机发音策略：
 * 1. 在用户手势中解锁「同一个」HTMLAudioElement（静音片）
 * 2. 之后所有朗读只改 src + play 该实例（听写连续播才不会丢手势）
 * 3. 无 speechSynthesis 的浏览器只走在线 TTS
 */

export type SpeakLang = 'zh-CN' | 'en-US'

export type SpeakOptions = {
  lang: SpeakLang
  rate?: number
}

/** 最短合法静音 wav，用于手势内解锁 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgAAAAAAA=='

let sharedAudio: HTMLAudioElement | null = null
let unlocked = false
let playChain: Promise<void> = Promise.resolve()
let voicesReady = false
/** 当前在线播放的 settle；cancelSpeak 时 resolve，避免 Promise 挂起 */
let activeOnlineSettle: (() => void) | null = null
/** cancel 递增；旧 playChain 任务发现世代过期则直接结束，避免交错播 */
let playGeneration = 0

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  return window.speechSynthesis ?? null
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger|HarmonyOS|MQQBrowser/i.test(
    navigator.userAgent,
  )
}

function clampRate(rate: number | undefined): number {
  return Math.min(1.5, Math.max(0.5, rate ?? 1))
}

/** 全局唯一 Audio：解锁后连续改 src 播放，避免「只能由用户手势发起 play」 */
function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    const a = new Audio()
    a.preload = 'auto'
    // iOS 内联播放，避免强制全屏
    a.setAttribute('playsinline', 'true')
    a.setAttribute('webkit-playsinline', 'true')
    sharedAudio = a
  }
  return sharedAudio
}

function pickVoice(lang: SpeakLang): SpeechSynthesisVoice | null {
  const synth = getSynth()
  if (!synth) return null
  const voices = synth.getVoices()
  const normalized = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
  const prefix = lang === 'zh-CN' ? 'zh' : 'en'
  return (
    voices.find((v) => normalized(v).startsWith(prefix + '-')) ??
    voices.find((v) => normalized(v).startsWith(prefix)) ??
    voices.find((v) => normalized(v).includes(prefix)) ??
    null
  )
}

export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = getSynth()
    if (!synth) {
      resolve([])
      return
    }
    const list = synth.getVoices()
    if (list.length > 0) {
      voicesReady = true
      resolve(list)
      return
    }
    const onChange = () => {
      synth.removeEventListener('voiceschanged', onChange)
      voicesReady = true
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', onChange)
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onChange)
      voicesReady = true
      resolve(synth.getVoices())
    }, 800)
  })
}

export function hasVoiceFor(_lang: SpeakLang): boolean {
  return true
}

export function isMobileClient(): boolean {
  return isMobile()
}

export function hasNativeSpeech(): boolean {
  return getSynth() !== null
}

/**
 * 必须在 touchstart / pointerdown / click 同步路径调用。
 * 用静音片解锁共享 Audio，后续听写循环才能 play。
 */
export function unlockSpeech(): void {
  const a = getSharedAudio()

  // 每次手势都 resume，防止 iOS 中途挂起
  try {
    const synth = getSynth()
    if (synth) {
      void synth.getVoices()
      try {
        synth.resume()
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  if (unlocked) {
    // 已解锁仍轻触一次 play 静音，刷新自动播放权限（部分 WebView 需要）
    try {
      if (a.paused && !a.src) {
        a.src = SILENT_WAV
      }
    } catch {
      /* ignore */
    }
    return
  }

  unlocked = true
  try {
    a.volume = 0
    a.src = SILENT_WAV
    const p = a.play()
    if (p && typeof p.then === 'function') {
      void p
        .then(() => {
          a.pause()
          try {
            a.currentTime = 0
          } catch {
            /* ignore */
          }
          a.volume = 1
        })
        .catch(() => {
          a.volume = 1
          // 解锁失败时允许后续真正发音再试
          unlocked = false
        })
    } else {
      a.volume = 1
    }
  } catch {
    unlocked = false
    a.volume = 1
  }
}

/**
 * 打断当前与排队中的发音。
 * 在线 Audio：resolve 当前 play（非 reject），避免 WordPlayer 当成失败暂停。
 * 系统语音：cancel → interrupted，speakNative 会 resolve。
 * playGeneration 使旧排队任务在 await 后直接放弃，减轻连点/点读与跟读交错。
 */
export function cancelSpeak(): void {
  playGeneration += 1
  playChain = Promise.resolve()
  const settle = activeOnlineSettle
  activeOnlineSettle = null
  if (settle) settle()

  const a = sharedAudio
  if (a) {
    try {
      a.onended = null
      a.onerror = null
      a.onplaying = null
      a.onloadeddata = null
      a.pause()
      try {
        a.currentTime = 0
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }
  const synth = getSynth()
  if (synth) {
    try {
      synth.cancel()
    } catch {
      /* ignore */
    }
  }
}

/** 产品仅英文发音；中文 lang 时仍走英文有道（避免误用中文源） */
function onlineUrls(text: string, _lang: SpeakLang, _rate: number): string[] {
  const raw = text.slice(0, 180)
  const q = encodeURIComponent(raw)
  return [
    `https://dict.youdao.com/dictvoice?audio=${q}&type=2`,
    `https://dict.youdao.com/dictvoice?audio=${q}&type=1`,
  ]
}

/**
 * 在已解锁的共享 Audio 上播放单个 URL。
 * 未开始播放 2.5s 内换源；开始后等到 ended 或最长 20s。
 */
function playOneUrl(audio: HTMLAudioElement, url: string, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let started = false
    let startTimer: ReturnType<typeof setTimeout> | null = null
    let maxTimer: ReturnType<typeof setTimeout> | null = null

    const clear = () => {
      if (startTimer) clearTimeout(startTimer)
      if (maxTimer) clearTimeout(maxTimer)
      audio.onended = null
      audio.onerror = null
      audio.onplaying = null
      audio.onloadeddata = null
      if (activeOnlineSettle === markDone) activeOnlineSettle = null
    }

    const markDone = () => {
      if (settled) return
      settled = true
      clear()
      resolve()
    }

    const succeed = () => markDone()

    const fail = (reason: string) => {
      if (settled) return
      settled = true
      clear()
      try {
        audio.pause()
      } catch {
        /* ignore */
      }
      reject(new Error(reason))
    }

    // 供 cancelSpeak 正常结束本 Promise（resolve，非 reject）
    activeOnlineSettle = markDone

    audio.onplaying = () => {
      started = true
      if (startTimer) {
        clearTimeout(startTimer)
        startTimer = null
      }
    }
    audio.onended = () => succeed()
    audio.onerror = () => fail('音频加载失败')

    try {
      audio.pause()
    } catch {
      /* ignore */
    }

    // 去掉旧 src 再赋新值，避免缓存脏状态
    try {
      audio.removeAttribute('src')
      audio.load()
    } catch {
      /* ignore */
    }

    audio.volume = 1
    audio.src = url
    try {
      audio.load()
    } catch {
      /* ignore */
    }

    const doPlay = () => {
      try {
        audio.playbackRate = rate
      } catch {
        /* ignore */
      }
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.then(() => {
          try {
            audio.playbackRate = rate
          } catch {
            /* ignore */
          }
        }).catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e)
          if (/NotAllowed|user gesture|user didn't interact/i.test(msg)) {
            // 标记需重新解锁
            unlocked = false
            fail('需要用户点击才能播放，请再点一次「英/中」或「听写」')
          } else {
            fail(msg || 'play 失败')
          }
        })
      }
    }

    doPlay()

    // 迟迟不进入 playing → 换源（共享 Audio 上换源一般仍可 play）
    startTimer = setTimeout(() => {
      if (!settled && !started) {
        fail('开始播放超时')
      }
    }, 3500)

    maxTimer = setTimeout(() => {
      if (!settled) {
        // 若已开始播，当作正常结束，避免卡死队列
        if (started) succeed()
        else fail('播放超时')
      }
    }, 20000)
  })
}

function speakOnline(text: string, lang: SpeakLang, rate: number): Promise<void> {
  const audio = getSharedAudio()
  const urls = onlineUrls(text, lang, rate)
  const r = clampRate(rate)
  const errors: string[] = []
  const gen = playGeneration

  const run = async () => {
    if (gen !== playGeneration) return
    // 确保 volume 恢复（解锁时可能为 0）
    audio.volume = 1
    for (let i = 0; i < urls.length; i++) {
      if (gen !== playGeneration) return
      try {
        await playOneUrl(audio, urls[i], r)
        return
      } catch (e) {
        if (gen !== playGeneration) return
        errors.push(`源${i + 1}:${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (gen !== playGeneration) return
    throw new Error(`在线发音失败（${errors.slice(0, 3).join('；')}）`)
  }

  // 串行排队，避免连点/听写叠音互相 cancel
  const job = playChain.then(run, run)
  playChain = job.then(
    () => undefined,
    () => undefined,
  )
  return job
}

function speakNative(text: string, lang: SpeakLang, rate: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = getSynth()
    if (!synth) {
      reject(new Error('当前浏览器无系统语音接口'))
      return
    }

    try {
      synth.resume()
    } catch {
      /* ignore */
    }

    const needCancel = synth.speaking || synth.pending
    if (needCancel) {
      try {
        synth.cancel()
      } catch {
        /* ignore */
      }
    }

    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = clampRate(rate)
    utter.pitch = 1
    utter.volume = 1
    utter.lang = lang

    if (!voicesReady) void synth.getVoices()
    const voice = pickVoice(lang)
    if (voice) {
      utter.voice = voice
      if (voice.lang) utter.lang = voice.lang
    }

    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      reject(new Error(msg))
    }

    utter.onend = () => done()
    utter.onerror = (e) => {
      const err = e.error || 'unknown'
      if (err === 'interrupted' || err === 'canceled') done()
      else fail(`系统语音失败: ${err}`)
    }

    const kick = () => {
      try {
        synth.resume()
      } catch {
        /* ignore */
      }
      try {
        synth.speak(utter)
      } catch (e) {
        fail(e instanceof Error ? e.message : 'speak 调用失败')
      }
    }

    if (needCancel) setTimeout(kick, 40)
    else kick()

    setTimeout(() => {
      if (!settled) {
        try {
          synth.cancel()
        } catch {
          /* ignore */
        }
        fail('系统语音超时')
      }
    }, 12000)
  })
}

/**
 * 朗读文本。手机以共享 Audio + 在线 TTS 为主。
 */
export async function speak(text: string, options: SpeakOptions): Promise<void> {
  // 注意：若已不在手势栈内，unlock 可能无效；按钮侧会再调一次
  unlockSpeech()

  const trimmed = text.trim()
  if (!trimmed) return

  const rate = clampRate(options.rate)
  const lang = options.lang
  const mobile = isMobile()
  const nativeOk = hasNativeSpeech()
  const errors: string[] = []

  if (mobile || !nativeOk) {
    try {
      await speakOnline(trimmed, lang, rate)
      return
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
    if (nativeOk) {
      try {
        await speakNative(trimmed, lang, rate)
        return
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    throw new Error(
      [
        '无法播放语音。',
        errors.join(' | '),
        '请：①确认联网 ②关静音、调高媒体音量 ③用系统 Safari/Chrome（不要用微信内打开）',
        '④先点一次页面任意处，再点「英」',
      ].join(''),
    )
  }

  // 桌面有系统语音
  try {
    await speakNative(trimmed, lang, rate)
    return
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }
  try {
    await speakOnline(trimmed, lang, rate)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
    throw new Error(`无法播放语音。${errors.join(' | ')}`)
  }
}
