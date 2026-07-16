import { memo } from 'react'
import type { Word } from '../types/textbook'
import { SpeakButton } from './SpeakButton'

export type SpellResult = 'idle' | 'correct' | 'wrong'
export type SpellEntry = { value: string; result: SpellResult }

type Props = {
  word: Word
  index: number
  listIndex: number
  dictationMode: boolean
  isCurrent: boolean
  spellKey: string
  spell: SpellEntry | undefined
  rate: number
  onSpellChange: (key: string, value: string) => void
  onSpellCheck: (key: string, answerEn: string) => void
  onSpellRetry: (key: string) => void
  onSpeakError: (message: string) => void
}

function WordListItemInner({
  word,
  index,
  listIndex,
  dictationMode,
  isCurrent,
  spellKey,
  spell,
  rate,
  onSpellChange,
  onSpellCheck,
  onSpellRetry,
  onSpeakError,
}: Props) {
  const value = spell?.value ?? ''
  const result = spell?.result ?? 'idle'
  const feedbackId = `spell-fb-${listIndex}`
  const canCheck = value.trim().length > 0

  return (
    <div
      className={`word-card${isCurrent ? ' current' : ''}${dictationMode ? ' with-spell' : ''}`}
    >
      <div className="meta">
        <div className="idx">#{index + 1}</div>
        {!dictationMode && <div className="en">{word.en}</div>}
        {!dictationMode && word.phonetic && <div className="phonetic">{word.phonetic}</div>}
        <div className={`zh${dictationMode ? ' zh-dictation' : ''}`}>{word.zh}</div>
        {dictationMode && (
          <div className="spell-row">
            <input
              type="text"
              className={`spell-input${result === 'correct' ? ' correct' : ''}${result === 'wrong' ? ' wrong' : ''}`}
              value={value}
              placeholder="输入英文"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="done"
              aria-label={`默写：${word.zh}`}
              aria-invalid={result === 'wrong' ? true : undefined}
              aria-describedby={result !== 'idle' ? feedbackId : undefined}
              onChange={(e) => onSpellChange(spellKey, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canCheck) onSpellCheck(spellKey, word.en)
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary spell-btn"
              disabled={!canCheck}
              aria-label={`检查：${word.zh}`}
              onClick={() => onSpellCheck(spellKey, word.en)}
            >
              检查
            </button>
            {result !== 'idle' && (
              <button
                type="button"
                className="btn spell-btn"
                aria-label={`重试：${word.zh}`}
                onClick={() => onSpellRetry(spellKey)}
              >
                重试
              </button>
            )}
          </div>
        )}
        {dictationMode && result === 'correct' && (
          <div id={feedbackId} className="spell-feedback ok" role="status">
            ✓ 正确
          </div>
        )}
        {dictationMode && result === 'wrong' && (
          <div id={feedbackId} className="spell-feedback bad" role="status">
            ✗ 正确答案：<strong className="spell-answer">{word.en}</strong>
          </div>
        )}
      </div>
      <div className="speak-pair">
        <SpeakButton
          text={word.en}
          lang="en-US"
          rate={rate}
          label="英"
          hideTextInTitle={dictationMode && result !== 'wrong'}
          title={dictationMode && result !== 'wrong' ? '听发音（不显示拼写）' : undefined}
          onError={onSpeakError}
        />
      </div>
    </div>
  )
}

export const WordListItem = memo(WordListItemInner)
