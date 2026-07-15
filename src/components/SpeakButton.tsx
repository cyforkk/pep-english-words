import { speak, type SpeakLang } from '../lib/tts'

type Props = {
  text: string
  lang: SpeakLang
  rate: number
  label: string
  disabled?: boolean
}

export function SpeakButton({ text, lang, rate, label, disabled }: Props) {
  const kind = lang === 'en-US' ? 'en' : 'zh'
  return (
    <button
      type="button"
      className={`btn btn-speak ${kind}`}
      disabled={disabled || !text}
      title={`${label}：${text}`}
      onClick={() => {
        void speak(text, { lang, rate })
      }}
    >
      {label}
    </button>
  )
}
