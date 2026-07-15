import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SpeakButton } from './components/SpeakButton'
import { parseTextbookFile } from './lib/import'
import { WordPlayer } from './lib/queue'
import {
  loadImportedTextbooks,
  loadSettings,
  removeImportedTextbook,
  saveSettings,
  upsertImportedTextbook,
} from './lib/storage'
import { ensureVoicesLoaded, hasVoiceFor } from './lib/tts'
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

  const selectedWords = useMemo(() => {
    if (!textbook) return [] as Word[]
    return textbook.units.filter((u) => selectedUnits.includes(u.id)).flatMap((u) => u.words)
  }, [textbook, selectedUnits])

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

  useEffect(() => {
    void ensureVoicesLoaded().then(() => {
      const zh = hasVoiceFor('zh-CN')
      const en = hasVoiceFor('en-US')
      if (!zh && !en) {
        setVoiceWarn('未检测到系统语音。手机请在系统设置中安装中文/英文语音引擎。')
      } else if (!zh) {
        setVoiceWarn('未检测到中文语音。听写需要中文 TTS，请在手机系统设置中安装中文语音包。')
      } else if (!en) {
        setVoiceWarn('未检测到英文语音。跟读与英文点读可能异常，请安装英文语音包。')
      } else {
        setVoiceWarn(null)
      }
    })
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

  const startPlay = async (playMode: PlayMode) => {
    setError(null)
    setMode(playMode)
    if (playMode === 'browse') {
      playerRef.current?.stop()
      return
    }
    if (selectedWords.length === 0) {
      setError('请先勾选至少一个单元')
      return
    }
    await playerRef.current?.start(selectedWords, playMode)
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
      {voiceWarn && <div className="alert alert-warn">{voiceWarn}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* 播放区置顶：手机首屏先用 */}
      <section className="card">
        <h2>开始练习</h2>
        <div className="mode-tabs">
          <button
            type="button"
            className={`btn ${mode === 'browse' && !isPlaying ? 'active' : ''}`}
            onClick={() => void startPlay('browse')}
          >
            点读
          </button>
          <button
            type="button"
            className={`btn ${mode === 'dictation' ? 'active' : ''}`}
            onClick={() => void startPlay('dictation')}
            disabled={selectedWords.length === 0}
          >
            听写
          </button>
          <button
            type="button"
            className={`btn ${mode === 'shadow' ? 'active' : ''}`}
            onClick={() => void startPlay('shadow')}
            disabled={selectedWords.length === 0}
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
              onClick={() => void startPlay('dictation')}
              disabled={selectedWords.length === 0}
            >
              开始中文听写（{selectedWords.length} 词）
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void startPlay('shadow')}
              disabled={selectedWords.length === 0}
            >
              英文跟读
            </button>
            <button type="button" className="btn" onClick={() => void startPlay('browse')}>
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
              打乱顺序
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
          <span className="badge">{selectedWords.length}</span>
        </h2>
        {selectedWords.length === 0 ? (
          <p className="hint">请勾选单元以显示单词。</p>
        ) : (
          <div className="word-cards">
            {selectedWords.map((w, i) => {
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
                    <SpeakButton text={w.en} lang="en-US" rate={settings.rate} label="英" />
                    <SpeakButton text={w.zh} lang="zh-CN" rate={settings.rate} label="中" />
                  </div>
                </div>
              )
            })}
          </div>
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
