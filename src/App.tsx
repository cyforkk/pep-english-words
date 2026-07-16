import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WordListItem, type SpellEntry } from './components/WordListItem'
import { loadCatalogProgressive } from './lib/catalog'
import { shuffleArray, WordPlayer } from './lib/queue'
import {
  loadSelection,
  loadSettings,
  normalizeSettings,
  saveSelection,
  saveSettings,
} from './lib/storage'
import { checkSpelling, listItemSpellKey, wordsContentSig } from './lib/spellCheck'
import { ensureVoicesLoaded, isMobileClient, unlockSpeech } from './lib/tts'
import type { PlayMode, PlayerSettings, PlayerStatus, Textbook, Word } from './types/textbook'
import { DEFAULT_SETTINGS, WORD_LIST_PAGE_SIZE } from './types/textbook'

export default function App() {
  const [catalog, setCatalog] = useState<Textbook[]>([])
  const [textbookId, setTextbookId] = useState<string>('')
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [settings, setSettings] = useState<PlayerSettings>(() => loadSettings())
  const [mode, setMode] = useState<PlayMode>(() => loadSelection()?.mode ?? 'browse')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [playIndex, setPlayIndex] = useState(0)
  const [currentWord, setCurrentWord] = useState<Word | null>(null)
  const [queueLen, setQueueLen] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [voiceWarn, setVoiceWarn] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadWarn, setLoadWarn] = useState<string | null>(null)
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [listVisibleCount, setListVisibleCount] = useState<number>(WORD_LIST_PAGE_SIZE)
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({})
  /** 默写：隐藏列表英文与音标，仅显示中文释义；可输入判对错 */
  const [dictationMode, setDictationMode] = useState(
    () => loadSelection()?.dictationMode === true,
  )
  /** 本页拼写作答（session 内存，不持久化） */
  const [spellState, setSpellState] = useState<Record<string, SpellEntry>>({})

  const playerRef = useRef<WordPlayer | null>(null)
  const selectedWordsRef = useRef<Word[]>([])

  const textbook = catalog.find((b) => b.id === textbookId) ?? null

  const selectedWords = useMemo(() => {
    if (!textbook) return [] as Word[]
    return textbook.units.filter((u) => selectedUnits.includes(u.id)).flatMap((u) => u.words)
  }, [textbook, selectedUnits])

  selectedWordsRef.current = selectedWords

  /** 仅内容变化时同步列表（避免 catalog 渐进加载换引用时误清空打乱/作答） */
  const selectedWordsSig = useMemo(() => wordsContentSig(selectedWords), [selectedWords])

  const [displayWords, setDisplayWords] = useState<Word[]>([])
  const [listShuffled, setListShuffled] = useState(false)

  useEffect(() => {
    setDisplayWords(selectedWordsRef.current)
    setListShuffled(false)
    setListVisibleCount(WORD_LIST_PAGE_SIZE)
  }, [selectedWordsSig])

  // 列表内容或顺序变化时清空作答（含打乱）；引用不变则不清
  const displayWordsSig = useMemo(() => wordsContentSig(displayWords), [displayWords])
  useEffect(() => {
    setSpellState({})
  }, [displayWordsSig])

  // 退出默写时清空作答
  useEffect(() => {
    if (!dictationMode) setSpellState({})
  }, [dictationMode])

  const visibleWords = useMemo(
    () => displayWords.slice(0, listVisibleCount),
    [displayWords, listVisibleCount],
  )

  const spellStats = useMemo(() => {
    let correct = 0
    let wrong = 0
    displayWords.forEach((w, i) => {
      const r = spellState[listItemSpellKey(i, w.en, w.zh)]?.result
      if (r === 'correct') correct += 1
      else if (r === 'wrong') wrong += 1
    })
    return { correct, wrong, checked: correct + wrong, total: displayWords.length }
  }, [displayWords, spellState])

  const setSpellValue = useCallback((key: string, value: string) => {
    setSpellState((prev) => ({
      ...prev,
      [key]: { value, result: 'idle' },
    }))
  }, [])

  const checkSpellWord = useCallback((key: string, answerEn: string) => {
    setSpellState((prev) => {
      const value = prev[key]?.value ?? ''
      if (!value.trim()) return prev
      const ok = checkSpelling(value, answerEn)
      return {
        ...prev,
        [key]: { value, result: ok ? 'correct' : 'wrong' },
      }
    })
  }, [])

  const retrySpellWord = useCallback((key: string) => {
    setSpellState((prev) => ({
      ...prev,
      [key]: { value: '', result: 'idle' },
    }))
  }, [])

  const onSpeakError = useCallback((message: string) => {
    setError(message)
  }, [])

  const shuffleWordList = () => {
    if (selectedWords.length < 2) return
    playerRef.current?.stop()
    setDisplayWords(shuffleArray(selectedWords))
    setListShuffled(true)
    setListVisibleCount(WORD_LIST_PAGE_SIZE)
  }

  const restoreWordListOrder = () => {
    playerRef.current?.stop()
    setDisplayWords(selectedWords)
    setListShuffled(false)
    setListVisibleCount(WORD_LIST_PAGE_SIZE)
  }

  // 优先加载缓存册，再限并发预取其余；恢复单元勾选与学段折叠
  useEffect(() => {
    const signal = { cancelled: false }
    setLoadingBooks(true)
    setLoadWarn(null)
    const cached = loadSelection()

    void loadCatalogProgressive({
      preferredId: cached?.textbookId,
      signal,
      onReady: (book, preferredId) => {
        if (signal.cancelled) return
        const unitIds = new Set(book.units.map((u) => u.id))
        const units = cached?.selectedUnits?.filter((u) => unitIds.has(u)) ?? []
        setCatalog([book])
        setTextbookId(preferredId)
        setSelectedUnits(units)
        if (cached?.mode === 'browse' || cached?.mode === 'shadow') {
          setMode(cached.mode)
        }
        // dictationMode 已在 useState 初始化时从 loadSelection 恢复
        const stage = stageKeyOf(book)
        // 恢复小学/初中/高中折叠；当前册学段至少展开
        setOpenStages({ ...(cached?.openStages ?? {}), [stage]: true })
        setLoadingBooks(false)
      },
      onComplete: (books, failed) => {
        if (signal.cancelled) return
        setCatalog(books)
        if (failed.length > 0) {
          setLoadWarn(
            `${failed.length} 册词库加载失败：${failed.map((f) => f.title || f.id).join('、')}`,
          )
        }
      },
    }).catch((e: unknown) => {
      if (!signal.cancelled) {
        setLoadError(e instanceof Error ? e.message : String(e))
        setLoadingBooks(false)
      }
    })

    return () => {
      signal.cancelled = true
    }
  }, [])

  // 仅展开当前教材所在学段（换册清空单元在点选教材时处理）
  useEffect(() => {
    if (!textbook) return
    const key = stageKeyOf(textbook)
    setOpenStages((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [textbook])

  // 持久化：教材 / 单元 / 学段折叠 / 点读·跟读 / 默写（防抖）
  useEffect(() => {
    if (!textbookId || loadingBooks) return
    const t = window.setTimeout(() => {
      saveSelection({
        textbookId,
        selectedUnits,
        openStages,
        mode,
        dictationMode,
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [textbookId, selectedUnits, openStages, mode, dictationMode, loadingBooks])

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

  // 持久化：语速 / 跟读遍数 / 词间隔（防抖；默认语速 1.0）
  useEffect(() => {
    playerRef.current?.updateSettings(settings)
    const t = window.setTimeout(() => {
      saveSettings(settings)
    }, 250)
    return () => window.clearTimeout(t)
  }, [settings])

  const patchSettings = useCallback((partial: Partial<PlayerSettings>) => {
    setSettings((s) => normalizeSettings({ ...s, ...partial }))
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

  const isPlaying = status === 'playing' || status === 'paused'
  const showBottomBar = isPlaying || status === 'done'

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
        <h1>人教英语单词 · 点读跟读</h1>
        <p className="sub">小学 / 初中 / 高中 · 选单元 · 英文点读 · 跟读 · 可打乱</p>
      </header>

      {loadingBooks && <div className="alert alert-info">正在加载词库…</div>}
      {loadError && <div className="alert alert-error">{loadError}</div>}
      {loadWarn && (
        <div className="alert alert-warn">
          {loadWarn}
          <button type="button" className="btn btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setLoadWarn(null)}>
            关闭
          </button>
        </div>
      )}
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
              {dictationMode && status !== 'done' && (
                <span className="badge badge-dictation" style={{ marginLeft: '0.4rem' }}>
                  默写
                </span>
              )}
            </div>
            {dictationMode ? (
              <>
                <div className="en-big en-big-dictation" aria-label="默写中，英文已隐藏">
                  {status === 'done' ? '✓' : '？'}
                </div>
                <div className="zh-big" style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                  {currentWord?.zh ?? ''}
                </div>
              </>
            ) : (
              <>
                <div className="en-big">{currentWord?.en ?? (status === 'done' ? '✓' : '…')}</div>
                <div className="zh-big" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {currentWord?.zh ?? ''}
                </div>
              </>
            )}
          </div>
        )}

        <div className="status-bar">
          <span className={`status-pill ${status}`}>{statusLabel}</span>
          <span className="hint">
            {isPlaying || status === 'done'
              ? status === 'paused'
                ? '已暂停：可「继续」重试当前词，或「下一词」跳过'
                : '暂停 / 下一词 / 停止 → 屏幕底部'
              : mode === 'shadow'
                ? '跟读：按列表顺序念英文（结束提示 Finished.）'
                : '点读：在单词卡片点「英」发音'}
          </span>
        </div>
      </section>

      <section className="card">
        <h2>教材与单元</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: '0.65rem' }}>
          学段可折叠；点选教材与单元。上次选择会自动记住。当前：
          <strong> {textbook?.title ?? '未选择'}</strong>
        </p>

        <div className="stage-fold-list">
          {groupBooks(catalog).map((group) => {
            const open = openStages[group.key] === true
            return (
              <div key={group.key} className="stage-fold">
                <button
                  type="button"
                  className="stage-fold-head"
                  disabled={loadingBooks}
                  aria-expanded={open}
                  onClick={() =>
                    setOpenStages((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                  }
                >
                  <span className="stage-fold-title">{group.label}</span>
                  <span className="stage-fold-meta">{group.books.length} 册</span>
                  <span className="stage-fold-chevron">{open ? '收起' : '展开'}</span>
                </button>
                {open && (
                  <div className="stage-fold-body book-pick-list">
                    {group.books.map((b) => {
                      const active = b.id === textbookId
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`book-pick${active ? ' active' : ''}`}
                          onClick={() => {
                            if (b.id === textbookId) return
                            playerRef.current?.stop()
                            setSelectedUnits([])
                            setTextbookId(b.id)
                          }}
                        >
                          <span className="book-pick-title">{displayBookTitle(b.title)}</span>
                          {active && <span className="book-pick-badge">当前</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p className="hint">内置人教版小学、初中、高中 2019 词库。</p>

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
          </div>
          <p className="hint">
            语速 / 遍数 / 间隔自动缓存到本机（默认语速 1.0）。跟读严格按列表顺序；随机请用「打乱单词」。
          </p>
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginTop: '0.55rem' }}
            onClick={() => setSettings(normalizeSettings(DEFAULT_SETTINGS))}
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
          {dictationMode && <span className="badge badge-dictation">默写中</span>}
        </h2>
        <div className="toolbar-inline list-actions">
          <button
            type="button"
            className={`btn btn-sm${dictationMode ? ' btn-primary' : ''}`}
            onClick={() => setDictationMode((v) => !v)}
            aria-pressed={dictationMode}
          >
            {dictationMode ? '退出默写' : '默写'}
          </button>
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
            {[
              dictationMode ? '默写：输入英文判对错；只显示中文' : null,
              dictationMode && spellStats.total > 0
                ? `已检 ${spellStats.checked} · 对 ${spellStats.correct} · 错 ${spellStats.wrong}`
                : null,
              displayWords.length === 0
                ? null
                : listShuffled
                  ? '当前为随机顺序'
                  : '当前为词库顺序',
              displayWords.length > listVisibleCount
                ? `显示 ${visibleWords.length}/${displayWords.length}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        {displayWords.length === 0 ? (
          <p className="hint">请勾选单元以显示单词。</p>
        ) : (
          <>
            <div className="word-cards">
              {visibleWords.map((w, i) => {
                const listIndex = i
                const sKey = listItemSpellKey(listIndex, w.en, w.zh)
                const isCurrent =
                  isPlaying && currentWord && currentWord.en === w.en && currentWord.zh === w.zh
                return (
                  <WordListItem
                    key={sKey}
                    word={w}
                    index={listIndex}
                    listIndex={listIndex}
                    dictationMode={dictationMode}
                    isCurrent={!!isCurrent}
                    spellKey={sKey}
                    spell={spellState[sKey]}
                    rate={settings.rate}
                    onSpellChange={setSpellValue}
                    onSpellCheck={checkSpellWord}
                    onSpellRetry={retrySpellWord}
                    onSpeakError={onSpeakError}
                  />
                )
              })}
            </div>
            {listVisibleCount < displayWords.length && (
              <button
                type="button"
                className="btn btn-block"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setListVisibleCount((n) => n + WORD_LIST_PAGE_SIZE)}
              >
                加载更多（还有 {displayWords.length - listVisibleCount} 词）
              </button>
            )}
          </>
        )}
      </section>

      {showBottomBar && (
        <div className="bottom-bar" role="toolbar" aria-label="播放控制">
          <div className="bottom-bar-inner">
            <div className="mini-status">
              <span>
                跟读 ·{' '}
                <strong>
                  {status === 'done'
                    ? '完成'
                    : dictationMode
                      ? currentWord?.zh
                        ? `中：${currentWord.zh}`
                        : '…'
                      : (currentWord?.en ?? '…')}
                </strong>
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
                <button
                  type="button"
                  className="btn btn-primary"
                  onPointerDown={() => unlockSpeech()}
                  onClick={() => playerRef.current?.resume()}
                >
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

function stageLabel(stage?: string) {
  if (stage === 'primary') return '小学'
  if (stage === 'junior') return '初中'
  if (stage === 'senior') return '高中'
  return '其它'
}

function stageKeyOf(book: Textbook) {
  if (book.stage === 'primary' || book.stage === 'junior' || book.stage === 'senior') {
    return book.stage
  }
  return 'other'
}

function displayBookTitle(title: string) {
  return title.replace(/（三年级起点）/g, '').trim()
}

function groupBooks(catalog: Textbook[]) {
  const order = ['primary', 'junior', 'senior', 'other'] as const
  const buckets = new Map<string, Textbook[]>()
  for (const key of order) buckets.set(key, [])

  for (const b of catalog) {
    const key = stageKeyOf(b)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(b)
  }

  return order
    .filter((k) => (buckets.get(k)?.length ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: stageLabel(k),
      books: buckets.get(k)!,
    }))
}
