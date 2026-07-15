/**
 * 教材 JSON/CSV 解析工具。
 * 产品 UI 已取消「导入词表」；本模块供单元测试与将来扩展/脚本使用。
 */
import type { Textbook, Unit, Word } from '../types/textbook'

function isWord(x: unknown): x is Word {
  if (!x || typeof x !== 'object') return false
  const w = x as Word
  return typeof w.en === 'string' && typeof w.zh === 'string' && w.en.trim() !== '' && w.zh.trim() !== ''
}

function isUnit(x: unknown): x is Unit {
  if (!x || typeof x !== 'object') return false
  const u = x as Unit
  return (
    typeof u.id === 'string' &&
    typeof u.title === 'string' &&
    Array.isArray(u.words) &&
    u.words.every(isWord)
  )
}

export function parseTextbookJson(text: string): Textbook {
  const raw = text.replace(/^\uFEFF/, '')
  const data = JSON.parse(raw) as unknown
  if (!data || typeof data !== 'object') throw new Error('JSON 根节点必须是对象')
  const t = data as Partial<Textbook>
  if (typeof t.id !== 'string' || !t.id.trim()) throw new Error('缺少 id 字段')
  if (typeof t.title !== 'string' || !t.title.trim()) throw new Error('缺少 title 字段')
  if (!Array.isArray(t.units) || t.units.length === 0) throw new Error('units 必须为非空数组')
  if (!t.units.every(isUnit)) throw new Error('units 格式不正确（需 id/title/words[{en,zh}]）')
  return {
    id: t.id.trim(),
    title: t.title.trim(),
    units: t.units.map((u) => ({
      id: u.id.trim(),
      title: u.title.trim(),
      words: u.words.map((w) => ({
        en: w.en.trim(),
        zh: w.zh.trim(),
        phonetic: w.phonetic?.trim() || undefined,
      })),
    })),
  }
}

/** CSV: unit,en,zh 或 单元,英文,中文；支持 UTF-8 BOM */
export function parseTextbookCsv(text: string, title = '导入的教材'): Textbook {
  const raw = text.replace(/^\uFEFF/, '').trim()
  if (!raw) throw new Error('CSV 为空')

  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) throw new Error('CSV 至少需要表头 + 一行数据')

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const unitIdx = header.findIndex((h) => h === 'unit' || h === '单元')
  const enIdx = header.findIndex((h) => h === 'en' || h === 'english' || h === '英文' || h === '单词')
  const zhIdx = header.findIndex((h) => h === 'zh' || h === 'chinese' || h === '中文' || h === '释义')

  if (unitIdx < 0 || enIdx < 0 || zhIdx < 0) {
    throw new Error('CSV 表头需包含 unit/en/zh（或 单元/英文/中文）')
  }

  const unitMap = new Map<string, Word[]>()
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const unit = (cols[unitIdx] ?? '').trim()
    const en = (cols[enIdx] ?? '').trim()
    const zh = (cols[zhIdx] ?? '').trim()
    if (!unit || !en || !zh) continue
    if (!unitMap.has(unit)) unitMap.set(unit, [])
    unitMap.get(unit)!.push({ en, zh })
  }

  if (unitMap.size === 0) throw new Error('未解析到有效单词行')

  const units: Unit[] = []
  let i = 1
  for (const [unitTitle, words] of unitMap) {
    units.push({
      id: `u${i}`,
      title: unitTitle,
      words,
    })
    i += 1
  }

  const id = `import-${Date.now()}`
  return { id, title, units }
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

export async function parseTextbookFile(file: File): Promise<Textbook> {
  const text = await file.text()
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) {
    return parseTextbookJson(text)
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const base = file.name.replace(/\.[^.]+$/, '')
    return parseTextbookCsv(text, base || '导入的教材')
  }
  // 尝试 JSON，失败再 CSV
  try {
    return parseTextbookJson(text)
  } catch {
    return parseTextbookCsv(text, file.name || '导入的教材')
  }
}
