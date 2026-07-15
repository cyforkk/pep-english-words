import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SpeakButton } from './components/SpeakButton'
import { parseTextbookFile } from './lib/import'
import { shuffleArray, WordPlayer } from './lib/queue'
import {
  loadImportedTextbooks,
  loadSettings,
  removeImportedTextbook,
  saveSettings,
  upsertImportedTextbook,
} from './lib/storage'
import { ensureVoicesLoaded, isMobileClient, unlockSpeech } from './lib/tts'
import type { PlayMode, PlayerSettings, PlayerStatus, Textbook, Word } from './types/textbook'
import { DEFAULT_SETTINGS } from './types/textbook'

export default function App() {
  const [builtin, setBuiltin] = useState<Textbook | null>(null)
  const [imported, setImported] = useState<Textbook[]>(() => loadImportedTextbooks())
  const [textbookId, setTextbookId] = useState<string>('')
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [settings, setSettings] = useState<PlayerSettings>(() => loadSettings())
  const [mode, setMode] = useState<PlayMode>('browse')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [playIndex, setPlayIndex] = useState(0)
  const [currentWord, setCurrentWord] = useState<Word | null>(null)
  const [queueLen, setQueueLen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [voiceWarn, setVoiceWarn] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const playerRef = useRef<WordPlayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const allBooks = useMemo(() => {
    const list: Textbook[] = []
    if (builtin) list.push(builtin)
    list.push(...imported)
    return list
  }, [builtin, imported])

  const textbook = allBooks.find((b) => b.id === textbookId) ?? null

  /** 教材单元合并后的原始顺序（未打乱） */
  const selectedWords = useMemo(() => {
    if (!textbook) return [] as Word[]
    return textbook.units.filter((u) => selectedUnits.includes(u.id)).flatMap((u) => u.words)
  }, [textbook, selectedUnits])

  /** 界面展示 / 听写跟读实际使用的顺序 */
  const [displayWords, setDisplayWords] = useState<Word[]>([])
  const [listShuffled, setListShuffled] = useState(false)

  // 单元或教材变化时，同步列表并恢复原始顺序
  useEffect(() => {
    setDisplayWords(selectedWords)
    setListShuffled(false)
  }, [selectedWords])

  const shuffleWordList = () => {
    if (selectedWords.length < 2) return
    playerRef.current?.stop()
    setDisplayWords(shuffleArray(selectedWords))
    setListShuffled(true)
  }

  const restoreWordListOrder = () => {
    playerRef.current?.stop()
    setDisplayWords(selectedWords)
    setListShuffled(false)
  }

  useEffect(() => {
    fetch('/data/textbooks/demo-pep-sample.json')
      .then((r) => {
        if (!r.ok) throw new Error(`加载示例教材失败: ${r.status}`)
        return r.json() as Promise<Textbook>
      })
      .then((book) => {
        setBuiltin(book)
        setTextbookId((id) => id || book.id)
        setSelectedUnits((prev) => (prev.length ? prev : book.units.map((u) => u.id)))
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  useEffect(() => {
    if (!textbook) return
    setSelectedUnits(textbook.units.map((u) => u.id))
  }, [textbookId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 任意触摸/点击都尝试解锁共享 Audio（听写连续播放依赖此解锁）
  useEffect(() => {
    const unlock = () => unlockSpeech()
    // capture 阶段尽早执行
    document.addEventListener('touchstart', unlock, { passive: true, capture: true })
    document.addEventListener('pointerdown', unlock, { passive: true, capture: true })
    document.addEventListener('click', unlock, true)
    return () => {
      document.removeEventListener('touchstart', unlock, true)
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('click', unlock, true)
    }
  }, [])

  useEffect(() => {
    void ensureVoicesLoaded()
    if (isMobileClient()) {
      setVoiceWarn(
        '手机发音走在线语音（需联网）。请关静音、调高媒体音量；建议用 Safari/Chrome 打开。若失败请再点一次「英/中」。',
      )
    }
  }, [])

  useEffect(() => {
    const player = new WordPlayer(settings, {
      onIndexChange: (index, word) => {
        setPlayIndex(index)
        setCurrentWord(word)
        setQueueLen(player.getQueue().length)
      },
      onStatusChange: (s) => setStatus(s),
      onError: (msg) => setError(msg),
    })
    playerRef.current = player
    return () => {
      player.stop()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    playerRef.current?.updateSettings(settings)
    saveSettings(settings)
  }, [settings])

  const patchSettings = useCallback((partial: Partial<PlayerSettings>) => {
    setSettings((s) => ({ ...s, ...partial }))
  }, [])

  const toggleUnit = (id: string) => {
    setSelectedUnits((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllUnits = () => {
    if (!textbook) return
    setSelectedUnits(textbook.units.map((u) => u.id))
  }

  const clearUnits = () => setSelectedUnits([])

  const startPlay = (playMode: PlayMode) => {
    setError(null)
    // 必须在点击同步路径解锁，听写循环才能继续 play
    unlockSpeech()
    setMode(playMode)
    if (playMode === 'browse') {
      playerRef.current?.stop()
      return
    }
    if (displayWords.length === 0) {
      setError('请先勾选至少一个单元')
      return
    }
    // 按当前列表顺序播放（若已点「打乱」则用打乱后的顺序）
    void playerRef.current?.start(displayWords, playMode)
  }

  const onImport = async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const book = await parseTextbookFile(file)
      const list = upsertImportedTextbook(book)
      setImported(list)
      setTextbookId(book.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onRemoveImported = () => {
    if (!textbook || textbook.id === builtin?.id) return
    if (!confirm(`删除导入教材「${textbook.title}」？`)) return
    const list = removeImportedTextbook(textbook.id)
    setImported(list)
    setTextbookId(builtin?.id ?? list[0]?.id ?? '')
  }

  const isPlaying = status === 'playing' || status === 'paused'
  const showBottomBar = isPlaying || status === 'done'
  const hideEn =
    mode === 'dictation' && settings.hideEnInDictation && (status === 'playing' || status === 'paused')

  const statusLabel =
    status === 'playing' ? '播放中' : status === 'paused' ? '已暂停' : status === 'done' ? '已结束' : '空闲'

  const progressText =
    status === 'done'
      ? `完成 ${queueLen} 词`
      : queueLen > 0
        ? `${Math.min(playIndex + 1, queueLen)} / ${queueLen}`
        : '—'

  return (
    <div className={`app${showBottomBar ? ' has-bottom-bar' : ''}`}>
      <header className="header">
        <h1>单词听写 · 跟读</h1>
        <p className="sub">手机点选教材单元 · 中英点读 · 听写默写 · 英文跟读</p>
      </header>

      {loadError && <div className="alert alert-error">{loadError}</div>}
      {voiceWarn && (
        <div className="alert alert-info" role="status">
          <span>{voiceWarn}</span>
          <button type="button" className="btn btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setVoiceWarn(null)}>
            知道了
          </button>
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          {error}
          <button type="button" className="btn btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      {/* 播放区置顶：手机首屏先用 */}
      <section className="card">
        <h2>开始练习</h2>
        <div className="mode-tabs">
          <button
            type="button"
            className={`btn ${mode === 'browse' && !isPlaying ? 'active' : ''}`}
            onPointerDown={() => unlockSpeech()}
            onClick={() => startPlay('browse')}
          >
            点读
          </button>
          <button
            type="button"
            className={`btn ${mode === 'dictation' ? 'active' : ''}`}
            onPointerDown={() => unlockSpeech()}
            onClick={() => startPlay('dictation')}
            disabled={displayWords.length === 0}
          >
            听写
          </button>
          <button
            type="button"
            className={`btn ${mode === 'shadow' ? 'active' : ''}`}
            onPointerDown={() => unlockSpeech()}
            onClick={() => startPlay('shadow')}
            disabled={displayWords.length === 0}
          >
            跟读
          </button>
        </div>

        {(mode === 'dictation' || mode === 'shadow') && (isPlaying || status === 'done') && (
          <div className="current-word-panel">
            <div className="idx">
              {status === 'done' ? `完成 ${queueLen} 词` : `第 ${progressText} 词`}
            </div>
            {mode === 'dictation' ? (
              <>
                <div className="zh-big">{currentWord?.zh ?? (status === 'done' ? '✓' : '…')}</div>
                <div className={hideEn ? 'en-hidden' : 'en-big'}>
                  {hideEn ? '英文已隐藏 · 请纸笔默写' : (currentWord?.en ?? '')}
                </div>
              </>
            ) : (
              <>
                <div className="en-big">{currentWord?.en ?? (status === 'done' ? '✓' : '…')}</div>
                <div className="zh-big" style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                  {currentWord?.zh ?? ''}
                </div>
              </>
            )}
          </div>
        )}

        {!showBottomBar && (
          <div className="play-actions">
            <button
              type="button"
              className="btn btn-primary span-2"
              onPointerDown={() => unlockSpeech()}
              onClick={() => startPlay('dictation')}
              disabled={displayWords.length === 0}
            >
              开始中文听写（{displayWords.length} 词）
            </button>
            <button
              type="button"
              className="btn"
              onPointerDown={() => unlockSpeech()}
              onClick={() => startPlay('shadow')}
              disabled={displayWords.length === 0}
            >
              英文跟读
            </button>
            <button
              type="button"
              className="btn"
              onPointerDown={() => unlockSpeech()}
              onClick={() => startPlay('browse')}
            >
              仅点读
            </button>
          </div>
        )}

        {showBottomBar && (
          <div className="play-actions">
            {status === 'playing' && (
              <button type="button" className="btn" onClick={() => playerRef.current?.pause()}>
                暂停
              </button>
            )}
            {status === 'paused' && (
              <button type="button" className="btn btn-primary" onClick={() => playerRef.current?.resume()}>
                继续
              </button>
            )}
            {isPlaying && (
              <button type="button" className="btn" onClick={() => void playerRef.current?.skip()}>
                下一词
              </button>
            )}
            <button
              type="button"
              className={`btn btn-danger${status === 'done' ? ' span-2' : ''}`}
              onClick={() => playerRef.current?.stop()}
            >
              停止
            </button>
            {status === 'done' && (
              <button
                type="button"
                className="btn btn-primary span-2"
                onClick={() => void startPlay(mode === 'shadow' ? 'shadow' : 'dictation')}
              >
                再来一遍
              </button>
            )}
          </div>
        )}

        <div className="status-bar">
          <span className={`status-pill ${status}`}>{statusLabel}</span>
          <span className="hint">
            {mode === 'dictation' && '听写：念中文 → 留白默写 → 下一词'}
            {mode === 'shadow' && '跟读：念英文，显示中文提示'}
            {mode === 'browse' && '点读：在下方单词卡片点「英」「中」'}
          </span>
        </div>
      </section>

      <section className="card">
        <h2>教材与单元</h2>
        <label className="field full">
          教材
          <select
            value={textbookId}
            onChange={(e) => {
              playerRef.current?.stop()
              setTextbookId(e.target.value)
            }}
          >
            {allBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {builtin && b.id !== builtin.id ? '（导入）' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="import-actions" style={{ marginTop: '0.55rem' }}>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            导入词表
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,.txt,application/json,text/csv"
            className="hidden-file"
            onChange={(e) => {
              void onImport(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          {textbook && builtin && textbook.id !== builtin.id && (
            <button type="button" className="btn btn-danger" onClick={onRemoveImported}>
              删除导入
            </button>
          )}
        </div>
        <p className="hint">支持 JSON / CSV（unit,en,zh）。CSV 请用 UTF-8。</p>

        {textbook && (
          <>
            <div className="toolbar-inline">
              <button type="button" className="btn btn-sm" onClick={selectAllUnits}>
                全选
              </button>
              <button type="button" className="btn btn-sm" onClick={clearUnits}>
                清空
              </button>
              <span className="hint">
                已选 {selectedUnits.length} 单元 · {selectedWords.length} 词
              </span>
            </div>
            <div className="unit-list">
              {textbook.units.map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={selectedUnits.includes(u.id)}
                    onChange={() => toggleUnit(u.id)}
                  />
                  <span className="title">{u.title}</span>
                  <span className="count">{u.words.length} 词</span>
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <details className="settings-details">
        <summary>语速 / 遍数 / 间隔</summary>
        <div className="settings-body">
          <div className="settings-grid">
            <label className="field span-2">
              语速 <span className="range-value">{settings.rate.toFixed(2)}</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={settings.rate}
                onChange={(e) => patchSettings({ rate: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              中文遍数
              <input
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                value={settings.repeatZh}
                onChange={(e) => patchSettings({ repeatZh: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="field">
              英文遍数
              <input
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                value={settings.repeatEn}
                onChange={(e) => patchSettings({ repeatEn: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="field span-2">
              词间隔（毫秒）
              <input
                type="number"
                min={0}
                max={30000}
                step={500}
                inputMode="numeric"
                value={settings.gapMs}
                onChange={(e) => patchSettings({ gapMs: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="field inline">
              <input
                type="checkbox"
                checked={settings.shuffle}
                onChange={(e) => patchSettings({ shuffle: e.target.checked })}
              />
              开始听写/跟读时再随机
            </label>
            <label className="field inline">
              <input
                type="checkbox"
                checked={settings.hideEnInDictation}
                onChange={(e) => patchSettings({ hideEnInDictation: e.target.checked })}
              />
              听写隐藏英文
            </label>
          </div>
          <p className="hint">设置自动保存。默认语速 0.9 · 中文 2 遍 · 间隔 3 秒。</p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: '0.55rem' }}
            onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
          >
            恢复默认
          </button>
        </div>
      </details>

      <section className="card">
        <h2>
          单词列表
          <span className="badge">{displayWords.length}</span>
          {listShuffled && <span className="badge badge-shuffle">已打乱</span>}
        </h2>
        {displayWords.length === 0 ? (
          <p className="hint">请勾选单元以显示单词。</p>
        ) : (
          <>
            <div className="toolbar-inline list-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={shuffleWordList}
                disabled={displayWords.length < 2 || isPlaying}
              >
                打乱单词
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={restoreWordListOrder}
                disabled={!listShuffled || isPlaying}
              >
                恢复顺序
              </button>
              <span className="hint">
                {listShuffled ? '当前为随机顺序，听写/跟读按此列表播放' : '当前为教材原顺序'}
              </span>
            </div>
            <div className="word-cards">
              {displayWords.map((w, i) => {
                const isCurrent =
                  isPlaying && currentWord && currentWord.en === w.en && currentWord.zh === w.zh
                return (
                  <div key={`${w.en}-${w.zh}-${i}`} className={`word-card${isCurrent ? ' current' : ''}`}>
                    <div className="meta">
                      <div className="idx">#{i + 1}</div>
                      <div className={`en${hideEn && isCurrent ? ' hidden-en' : ''}`}>
                        {hideEn && isCurrent ? '••••' : w.en}
                      </div>
                      {w.phonetic && <div className="phonetic">{w.phonetic}</div>}
                      <div className="zh">{w.zh}</div>
                    </div>
                    <div className="speak-pair">
                      <SpeakButton
                        text={w.en}
                        lang="en-US"
                        rate={settings.rate}
                        label="英"
                        onError={setError}
                      />
                      <SpeakButton
                        text={w.zh}
                        lang="zh-CN"
                        rate={settings.rate}
                        label="中"
                        onError={setError}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* 底部拇指操作条：播放中固定在屏幕下方 */}
      {showBottomBar && (
        <div className="bottom-bar" role="toolbar" aria-label="播放控制">
          <div className="bottom-bar-inner">
            <div className="mini-status">
              <span>
                {mode === 'dictation' ? '听写' : mode === 'shadow' ? '跟读' : '点读'} ·{' '}
                <strong>
                  {mode === 'dictation'
                    ? (currentWord?.zh ?? (status === 'done' ? '完成' : '…'))
                    : (currentWord?.en ?? (status === 'done' ? '完成' : '…'))}
                </strong>
              </span>
              <span>{progressText}</span>
            </div>
            <div className="controls">
              {status === 'playing' && (
                <button type="button" className="btn" onClick={() => playerRef.current?.pause()}>
                  暂停
                </button>
              )}
              {status === 'paused' && (
                <button type="button" className="btn btn-primary" onClick={() => playerRef.current?.resume()}>
                  继续
                </button>
              )}
              {isPlaying && (
                <button type="button" className="btn" onClick={() => void playerRef.current?.skip()}>
                  下一词
                </button>
              )}
              {status === 'done' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ gridColumn: '1 / 3' }}
                    onClick={() => void startPlay(mode === 'shadow' ? 'shadow' : 'dictation')}
                  >
                    再来一遍
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => playerRef.current?.stop()}>
                    关闭
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-danger" onClick={() => playerRef.current?.stop()}>
                  停止
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
