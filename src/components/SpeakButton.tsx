import { speak, unlockSpeech, type SpeakLang } from '../lib/tts'

type Props = {
  text: string
  lang: SpeakLang
  rate: number
  label: string
  disabled?: boolean
  onError?: (message: string) => void
}

export function SpeakButton({ text, lang, rate, label, disabled, onError }: Props) {
  const kind = lang === 'en-US' ? 'en' : 'zh'

  /** 按下瞬间解锁（比 click 更早，兼容 iOS） */
  const arm = () => {
    unlockSpeech()
  }

  const play = () => {
    // 同步再解锁一次，然后立刻启动 speak（内部用共享 Audio）
    unlockSpeech()
    void speak(text, { lang, rate }).catch((e: unknown) => {
      onError?.(e instanceof Error ? e.message : String(e))
    })
  }

  return (
    <button
      type="button"
      className={`btn btn-speak ${kind}`}
      disabled={disabled || !text}
      title={`${label}：${text}`}
      onTouchStart={arm}
      onPointerDown={arm}
      onMouseDown={arm}
      onClick={play}
    >
      {label}
    </button>
  )
}
