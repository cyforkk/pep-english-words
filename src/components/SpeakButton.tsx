import { speak, unlockSpeech, type SpeakLang } from '../lib/tts'

type Props = {
  text: string
  lang: SpeakLang
  rate: number
  label: string
  disabled?: boolean
  onError?: (message: string) => void
  /**
   * 默写等场景：title 不拼接 text，避免悬停剧透拼写。
   * 未传时默认 `${label}：${text}`。
   */
  title?: string
  /** 为 true 时 title 仅用 label（等同 hideTextInTitle） */
  hideTextInTitle?: boolean
}

export function SpeakButton({
  text,
  lang,
  rate,
  label,
  disabled,
  onError,
  title,
  hideTextInTitle,
}: Props) {
  const kind = lang === 'en-US' ? 'en' : 'zh'

  const arm = () => {
    unlockSpeech()
  }

  const play = () => {
    unlockSpeech()
    void speak(text, { lang, rate }).catch((e: unknown) => {
      onError?.(e instanceof Error ? e.message : String(e))
    })
  }

  const tip =
    title ??
    (hideTextInTitle ? label : text ? `${label}：${text}` : label)

  return (
    <button
      type="button"
      className={`btn btn-speak ${kind}`}
      disabled={disabled || !text}
      title={tip}
      onTouchStart={arm}
      onPointerDown={arm}
      onMouseDown={arm}
      onClick={play}
    >
      {label}
    </button>
  )
}
