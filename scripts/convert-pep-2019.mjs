/**
 * 人教版英语词库转换（小学 + 初中 + 高中 2019）
 * 源：lilinji/English → 1.全国各大教材版本中小学同步/人教版/*.xlsx
 *
 * 小学：三年级起点（三上～六下）— 主流人教小学英语
 * 初中：七上、七下、八上、八下、九全
 * 高中：2019 必修一～三 + 选择性必修一～四（含必修一 Welcome Unit 起始词切分）
 *
 *   git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English
 *   npm run convert:pep2019
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pepDir = path.join(
  root,
  'tmp/lilinji/English/1.全国各大教材版本中小学同步/人教版',
)
const outDir = path.join(root, 'public/data/textbooks')

/**
 * stage: primary | junior | senior
 * units: 起始词切分；或 unitCount 均分
 */
const BOOKS = [
  // ——— 小学（三年级起点）———
  {
    stage: 'primary',
    id: 'pep-primary-g3-s1',
    file: '人教版三年级起点三年级上.xlsx',
    title: '人教版小学英语 · 三年级上',
    unitCount: 4,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g3-s2',
    file: '人教版三年级起点三年级下.xlsx',
    title: '人教版小学英语 · 三年级下',
    unitCount: 4,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g4-s1',
    file: '人教版三年级起点四年级上.xlsx',
    title: '人教版小学英语 · 四年级上',
    unitCount: 4,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g4-s2',
    file: '人教版三年级起点四年级下.xlsx',
    title: '人教版小学英语 · 四年级下',
    unitCount: 4,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g5-s1',
    file: '人教版三年级起点五年级上.xlsx',
    title: '人教版小学英语 · 五年级上',
    unitCount: 6,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g5-s2',
    file: '人教版三年级起点五年级下.xlsx',
    title: '人教版小学英语 · 五年级下',
    unitCount: 6,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g6-s1',
    file: '人教版三年级起点六年级上.xlsx',
    title: '人教版小学英语 · 六年级上',
    unitCount: 6,
  },
  {
    stage: 'primary',
    id: 'pep-primary-g6-s2',
    file: '人教版三年级起点六年级下.xlsx',
    title: '人教版小学英语 · 六年级下',
    unitCount: 6,
  },

  // ——— 初中 ———
  {
    stage: 'junior',
    id: 'pep-junior-g7-s1',
    file: '人教版初中英语七年级上册.xlsx',
    title: '人教版初中英语 · 七年级上册',
    unitCount: 9,
  },
  {
    stage: 'junior',
    id: 'pep-junior-g7-s2',
    file: '人教版初中英语七年级下册.xlsx',
    title: '人教版初中英语 · 七年级下册',
    unitCount: 9,
  },
  {
    stage: 'junior',
    id: 'pep-junior-g8-s1',
    file: '人教版初中英语八年级上册.xlsx',
    title: '人教版初中英语 · 八年级上册',
    unitCount: 10,
  },
  {
    stage: 'junior',
    id: 'pep-junior-g8-s2',
    file: '人教版初中英语八年级下册.xlsx',
    title: '人教版初中英语 · 八年级下册',
    unitCount: 10,
  },
  {
    stage: 'junior',
    id: 'pep-junior-g9',
    file: '人教版初中英语九年级全册.xlsx',
    title: '人教版初中英语 · 九年级全册',
    unitCount: 14,
  },

  // ——— 高中 2019 ———
  {
    stage: 'senior',
    id: 'pep2019-compulsory-1',
    file: '人教版高中英语必修第一册.xlsx',
    title: '人教版高中英语（2019）· 必修第一册',
    units: [
      { id: 'welcome', title: 'Welcome Unit · 预备单元', startWord: 'exchange' },
      { id: 'u1', title: 'Unit 1 Teenage Life', startWord: 'teenage' },
      { id: 'u2', title: 'Unit 2 Travelling Around', startWord: 'castle' },
      { id: 'u3', title: 'Unit 3 Sports and Fitness', startWord: 'fitness' },
      { id: 'u4', title: 'Unit 4 Natural Disasters', startWord: 'disaster' },
      { id: 'u5', title: 'Unit 5 Languages Around the World', startWord: 'billion' },
    ],
  },
  {
    stage: 'senior',
    id: 'pep2019-compulsory-2',
    file: '人教版高中英语必修第二册.xlsx',
    title: '人教版高中英语（2019）· 必修第二册',
    units: [
      { id: 'u1', title: 'Unit 1 Cultural Heritage', startWord: 'heritage' },
      { id: 'u2', title: 'Unit 2 Wildlife Protection', startWord: 'illegal' },
      { id: 'u3', title: 'Unit 3 The Internet', startWord: 'blog' },
      { id: 'u4', title: 'Unit 4 History and Traditions', startWord: 'Confucius' },
      { id: 'u5', title: 'Unit 5 Music', startWord: 'classical' },
    ],
  },
  {
    stage: 'senior',
    id: 'pep2019-compulsory-3',
    file: '人教版高中英语必修第三册.xlsx',
    title: '人教版高中英语（2019）· 必修第三册',
    units: [
      { id: 'u1', title: 'Unit 1 Festivals and Celebrations', startWord: 'lantern' },
      { id: 'u2', title: 'Unit 2 Morals and Virtues', startWord: 'moral' },
      { id: 'u3', title: 'Unit 3 Diverse Cultures', startWord: 'diverse' },
      { id: 'u4', title: 'Unit 4 Space Exploration', startWord: 'astronaut' },
      { id: 'u5', title: 'Unit 5 The Value of Money', startWord: 'loan' },
    ],
  },
  {
    stage: 'senior',
    id: 'pep2019-optional-1',
    file: '人教版高中英语选择性必修第一册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第一册',
    units: [
      { id: 'u1', title: 'Unit 1 People of Achievement', startWord: 'physiology' },
      { id: 'u2', title: 'Unit 2 Looking into the Future', startWord: 'absence' },
      { id: 'u3', title: 'Unit 3 Fascinating Parks', startWord: 'theme' },
      { id: 'u4', title: 'Unit 4 Body Language', startWord: 'gesture' },
      { id: 'u5', title: 'Unit 5 Working the Land', startWord: 'hybrid' },
    ],
  },
  {
    stage: 'senior',
    id: 'pep2019-optional-2',
    file: '人教版高中英语选择性必修第二册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第二册',
    unitCount: 5,
  },
  {
    stage: 'senior',
    id: 'pep2019-optional-3',
    file: '人教版高中英语选择性必修第三册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第三册',
    unitCount: 5,
  },
  {
    stage: 'senior',
    id: 'pep2019-optional-4',
    file: '人教版高中英语选择性必修第四册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第四册',
    unitCount: 5,
  },
]

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

function cleanPhonetic(s) {
  const t = String(s || '').trim()
  if (!t) return undefined
  if (t.startsWith('/') && t.endsWith('/')) return t
  if (t.startsWith('[') && t.endsWith(']')) return `/${t.slice(1, -1)}/`
  return `/${t}/`
}

function cleanZh(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('；')
}

function readWords(filePath) {
  const wb = XLSX.readFile(filePath)
  const sh = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' })
  if (rows.length < 2) return []

  const header = rows[0].map((c) => String(c).trim())
  const enIdx = header.findIndex((h) => /单词|英文|word/i.test(h))
  const usIdx = header.findIndex((h) => /美音|美式/i.test(h))
  const ukIdx = header.findIndex((h) => /英音|英式/i.test(h))
  const zhIdx = header.findIndex((h) => /释义|中文|翻译/i.test(h))

  const ei = enIdx >= 0 ? enIdx : 0
  const zi = zhIdx >= 0 ? zhIdx : 3
  const pi = usIdx >= 0 ? usIdx : ukIdx >= 0 ? ukIdx : 2

  const words = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const en = String(row[ei] ?? '').trim()
    const zh = cleanZh(row[zi])
    if (!en || !zh) continue
    const phonetic = cleanPhonetic(row[pi])
    words.push({ en, zh, ...(phonetic ? { phonetic } : {}) })
  }
  return words
}

function findStartIndex(words, startWord) {
  const i = words.findIndex((w) => w.en === startWord)
  if (i < 0) throw new Error(`找不到单元起始词: ${startWord}`)
  return i
}

function splitByMarkers(words, unitDefs) {
  const starts = unitDefs.map((u) => findStartIndex(words, u.startWord))
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= starts[i - 1]) {
      throw new Error(`单元起始顺序错误: ${unitDefs[i].title}`)
    }
  }
  return unitDefs.map((u, i) => {
    const from = starts[i]
    const to = i + 1 < starts.length ? starts[i + 1] : words.length
    return { id: u.id, title: u.title, words: words.slice(from, to) }
  })
}

function splitEqual(words, unitCount) {
  const n = words.length
  if (n === 0) return []
  const count = Math.min(unitCount, n)
  const units = []
  const base = Math.floor(n / count)
  let rem = n % count
  let offset = 0
  for (let i = 0; i < count; i++) {
    const size = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    const slice = words.slice(offset, offset + size)
    offset += size
    if (!slice.length) continue
    units.push({
      id: `u${i + 1}`,
      title: `Unit ${i + 1}`,
      words: slice,
    })
  }
  return units
}

function stageLabel(stage) {
  if (stage === 'primary') return '小学'
  if (stage === 'junior') return '初中'
  return '高中'
}

function main() {
  ensureDir(outDir)
  if (!fs.existsSync(pepDir)) {
    console.error('缺少源目录:', pepDir)
    console.error('请执行: git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English')
    process.exit(1)
  }

  // 清理本脚本生成的词库（保留 demo）
  for (const f of fs.readdirSync(outDir)) {
    if (
      f.startsWith('pep-primary-') ||
      f.startsWith('pep-junior-') ||
      f.startsWith('pep2019-') ||
      f.startsWith('pep-senior-') ||
      f === 'index.json'
    ) {
      fs.unlinkSync(path.join(outDir, f))
      console.log('removed', f)
    }
  }

  const index = []
  for (const b of BOOKS) {
    const fp = path.join(pepDir, b.file)
    if (!fs.existsSync(fp)) {
      console.warn('missing', b.file)
      continue
    }
    const words = readWords(fp)
    let units
    if (b.units) {
      units = splitByMarkers(words, b.units)
    } else {
      units = splitEqual(words, b.unitCount || 5)
    }
    const textbook = {
      id: b.id,
      title: b.title,
      stage: b.stage,
      edition: b.stage === 'senior' ? 'PEP 2019' : 'PEP',
      source: 'lilinji/English 人教版 xlsx',
      units,
    }
    fs.writeFileSync(path.join(outDir, `${b.id}.json`), JSON.stringify(textbook, null, 2), 'utf8')
    const count = units.reduce((s, u) => s + u.words.length, 0)
    index.push({
      id: b.id,
      title: b.title,
      stage: b.stage,
      words: count,
      units: units.length,
    })
    console.log(`OK [${stageLabel(b.stage)}] ${b.id}: ${count} words, ${units.length} units`)
  }

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(
      {
        description: '人教版英语词库：小学（三年级起点）+ 初中 + 高中 2019',
        stages: ['primary', 'junior', 'senior'],
        generatedAt: new Date().toISOString(),
        books: index,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(
    'done:',
    index.length,
    'books | primary',
    index.filter((b) => b.stage === 'primary').length,
    'junior',
    index.filter((b) => b.stage === 'junior').length,
    'senior',
    index.filter((b) => b.stage === 'senior').length,
  )
}

main()
