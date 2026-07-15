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
import type {
  PlayMode,
  PlayerSettings,
  PlayerStatus,
  Textbook,
  TextbookIndex,
  Word,
} from './types/textbook'
import { DEFAULT_SETTINGS } from './types/textbook'

export default function App() {
  const [catalog, setCatalog] = useState<Textbook[]>([])
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
  const [loadingBooks, setLoadingBooks] = useState(true)

  const playerRef = useRef<WordPlayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const allBooks = useMemo(() => {
    const map = new Map<string, Textbook>()
    for (const b of catalog) map.set(b.id, b)
    for (const b of imported) map.set(b.id, b)
    return [...map.values()]
  }, [catalog, imported])

  const textbook = allBooks.find((b) => b.id === textbookId) ?? null

  const selectedWords = useMemo(() => {
    if (!textbook) return [] as Word[]
    return textbook.units.filter((u) => selectedUnits.includes(u.id)).flatMap((u) => u.words)
  }, [textbook, selectedUnits])

  const [displayWords, setDisplayWords] = useState<Word[]>([])
  const [listShuffled, setListShuffled] = useState(false)

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

  // 加载人教高中内置词库 index + 各册
  useEffect(() => {
    let cancelled = false
    setLoadingBooks(true)
    fetch('/data/textbooks/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`加载词库索引失败: ${r.status}`)
        return r.json() as Promise<TextbookIndex>
      })
      .then(async (idx) => {
        const books: Textbook[] = []
        for (const item of idx.books) {
          const res = await fetch(`/data/textbooks/${item.id}.json`)
          if (!res.ok) continue
          const book = (await res.json()) as Textbook
          books.push(book)
        }
        if (cancelled) return
        if (books.length === 0) throw new Error('词库为空，请检查 public/data/textbooks')
        setCatalog(books)
        setTextbookId((id) => id || books[0].id)
        setLoadingBooks(false)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
          setLoadingBooks(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 切换教材时默认不勾选任何单元（需用户自选或点「全选」）
  useEffect(() => {
    if (!textbook) return
    setSelectedUnits([])
  }, [textbookId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unlock = () => unlockSpeech()
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
      setVoiceWarn('英文发音需联网（有道）。请关静音、调高媒体音量；建议 Safari/Chrome。')
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
    if (!textbook || catalog.some((b) => b.id === textbook.id)) return
    if (!confirm(`删除导入教材「${textbook.title}」？`)) return
    const list = removeImportedTextbook(textbook.id)
    setImported(list)
    setTextbookId(catalog[0]?.id ?? list[0]?.id ?? '')
  }

  const isPlaying = status === 'playing' || status === 'paused'
  const showBottomBar = isPlaying || status === 'done'
  const isImported = textbook != null && !catalog.some((b) => b.id === textbook.id)

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
        <h1>高中英语单词 · 点读跟读</h1>
        <p className="sub">人教版高中词库 · 选单元 · 英文点读 · 跟读练习 · 可打乱</p>
      </header>

      {loadingBooks && <div className="alert alert-info">正在加载词库…</div>}
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

      <section className="card">
        <h2>
          开始练习
          {displayWords.length > 0 && <span className="badge">{displayWords.length} 词</span>}
        </h2>
        <div className="mode-tabs mode-tabs-2">
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
            className={`btn ${mode === 'shadow' ? 'active' : ''}`}
            onPointerDown={() => unlockSpeech()}
            onClick={() => startPlay('shadow')}
            disabled={displayWords.length === 0 || isPlaying}
          >
            跟读
          </button>
        </div>

        {mode === 'shadow' && (isPlaying || status === 'done') && (
          <div className="current-word-panel">
            <div className="idx">
              {status === 'done' ? `完成 ${queueLen} 词` : `第 ${progressText} 词`}
            </div>
            <div className="en-big">{currentWord?.en ?? (status === 'done' ? '✓' : '…')}</div>
            <div className="zh-big" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {currentWord?.zh ?? ''}
            </div>
          </div>
        )}

        <div className="status-bar">
          <span className={`status-pill ${status}`}>{statusLabel}</span>
          <span className="hint">
            {isPlaying || status === 'done'
              ? '暂停 / 下一词 / 停止 → 屏幕底部'
              : mode === 'shadow'
                ? '跟读：自动念英文，可看中文释义'
                : '点读：在单词卡片点「英」发音'}
          </span>
        </div>
      </section>

      <section className="card">
        <h2>教材与单元</h2>
        <label className="field full">
          教材
          <select
            value={textbookId}
            disabled={loadingBooks || allBooks.length === 0}
            onChange={(e) => {
              playerRef.current?.stop()
              setTextbookId(e.target.value)
            }}
          >
            {allBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {isImportedBook(b.id, catalog) ? '（导入）' : ''}
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
          {isImported && (
            <button type="button" className="btn btn-danger" onClick={onRemoveImported}>
              删除导入
            </button>
          )}
        </div>
        <p className="hint">内置人教版（2019）必修 + 选择性必修。也可导入 JSON/CSV（unit,en,zh）。</p>

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
        <summary>语速 / 跟读遍数 / 间隔</summary>
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
            <label className="field">
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
            <label className="field inline span-2">
              <input
                type="checkbox"
                checked={settings.shuffle}
                onChange={(e) => patchSettings({ shuffle: e.target.checked })}
              />
              开始跟读时再随机
            </label>
          </div>
          <p className="hint">设置自动保存。跟读按当前单词列表顺序（可先打乱列表）。</p>
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
                {listShuffled ? '当前为随机顺序' : '当前为词库顺序'}
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
                      <div className="en">{w.en}</div>
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
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {showBottomBar && (
        <div className="bottom-bar" role="toolbar" aria-label="播放控制">
          <div className="bottom-bar-inner">
            <div className="mini-status">
              <span>
                跟读 · <strong>{currentWord?.en ?? (status === 'done' ? '完成' : '…')}</strong>
              </span>
              <span>{progressText}</span>
            </div>
            <div className={`controls${status === 'done' ? ' controls-done' : ''}`}>
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
                    onPointerDown={() => unlockSpeech()}
                    onClick={() => startPlay('shadow')}
                  >
                    再来一遍
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => playerRef.current?.stop()}>
                    结束
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

function isImportedBook(id: string, catalog: Textbook[]) {
  return !catalog.some((b) => b.id === id)
}
