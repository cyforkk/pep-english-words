/**
 * 人教版（PEP）2019 高中英语词库转换
 * 源：lilinji/English 人教版 xlsx（必修三册 + 选择性必修四册）
 *
 * 单元划分：按课本词表起始词切分（含必修一 Welcome Unit / 预备单元）
 * 源表无 Unit 列，边界词来自公开词表对照，可能与个别版本略有出入。
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
 * units: 按顺序的单元；startWord 为该单元在词表中的首词（精确匹配）
 * 最后一单元一直到词表末尾
 */
const BOOKS = [
  {
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
    id: 'pep2019-optional-2',
    file: '人教版高中英语选择性必修第二册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第二册',
    // 无可靠边界词时均分 5 单元
    unitCount: 5,
    unitTitlePrefix: 'Unit',
  },
  {
    id: 'pep2019-optional-3',
    file: '人教版高中英语选择性必修第三册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第三册',
    unitCount: 5,
    unitTitlePrefix: 'Unit',
  },
  {
    id: 'pep2019-optional-4',
    file: '人教版高中英语选择性必修第四册.xlsx',
    title: '人教版高中英语（2019）· 选择性必修第四册',
    unitCount: 5,
    unitTitlePrefix: 'Unit',
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
  if (i < 0) {
    throw new Error(`找不到单元起始词: ${startWord}`)
  }
  return i
}

function splitByMarkers(words, unitDefs) {
  const starts = unitDefs.map((u) => findStartIndex(words, u.startWord))
  // 校验递增
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] <= starts[i - 1]) {
      throw new Error(
        `单元起始顺序错误: ${unitDefs[i].title} (${unitDefs[i].startWord}@${starts[i]}) <= 上一单元`,
      )
    }
  }
  return unitDefs.map((u, i) => {
    const from = starts[i]
    const to = i + 1 < starts.length ? starts[i + 1] : words.length
    return {
      id: u.id,
      title: u.title,
      words: words.slice(from, to),
    }
  })
}

function splitEqual(words, unitCount, titlePrefix = 'Unit') {
  const n = words.length
  const units = []
  const base = Math.floor(n / unitCount)
  let rem = n % unitCount
  let offset = 0
  for (let i = 0; i < unitCount; i++) {
    const size = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    const slice = words.slice(offset, offset + size)
    offset += size
    if (!slice.length) continue
    units.push({
      id: `u${i + 1}`,
      title: `${titlePrefix} ${i + 1}`,
      words: slice,
    })
  }
  return units
}

function main() {
  ensureDir(outDir)
  if (!fs.existsSync(pepDir)) {
    console.error('缺少源目录:', pepDir)
    console.error('请执行: git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English')
    process.exit(1)
  }

  for (const f of fs.readdirSync(outDir)) {
    if (f.startsWith('pep-senior-') || f.startsWith('pep2019-') || f === 'index.json') {
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
      units = splitEqual(words, b.unitCount, b.unitTitlePrefix || 'Unit')
    }
    const textbook = {
      id: b.id,
      title: b.title,
      edition: 'PEP 2019',
      source: 'lilinji/English 人教版 xlsx（2019）',
      units,
    }
    fs.writeFileSync(path.join(outDir, `${b.id}.json`), JSON.stringify(textbook, null, 2), 'utf8')
    const count = units.reduce((s, u) => s + u.words.length, 0)
    index.push({ id: b.id, title: b.title, words: count, units: units.length })
    console.log(
      `OK ${b.id}: ${count} words | ` +
        units.map((u) => `${u.title}(${u.words.length})`).join(' · '),
    )
  }

  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(
      {
        description: '人教版（PEP）2019 高中英语词库（含预备单元）',
        edition: '2019',
        generatedAt: new Date().toISOString(),
        books: index,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log('done, books:', index.length)
}

main()
