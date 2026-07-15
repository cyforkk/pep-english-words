import { describe, expect, it } from 'vitest'
import { parseTextbookCsv, parseTextbookJson } from './import'

describe('parseTextbookJson', () => {
  it('解析合法教材', () => {
    const book = parseTextbookJson(
      JSON.stringify({
        id: 't1',
        title: '测试',
        units: [{ id: 'u1', title: 'Unit 1', words: [{ en: 'hi', zh: '嗨' }] }],
      }),
    )
    expect(book.id).toBe('t1')
    expect(book.units[0].words[0].en).toBe('hi')
  })

  it('缺少 id 抛错', () => {
    expect(() => parseTextbookJson(JSON.stringify({ title: 'x', units: [] }))).toThrow(/id/)
  })
})

describe('parseTextbookCsv', () => {
  it('按 unit 分组', () => {
    const csv = `unit,en,zh
Unit 1,hello,你好
Unit 1,book,书
Unit 2,apple,苹果
`
    const book = parseTextbookCsv(csv, '导入')
    expect(book.units).toHaveLength(2)
    expect(book.units[0].words).toHaveLength(2)
    expect(book.units[1].words[0].en).toBe('apple')
  })

  it('支持 BOM 与中文表头', () => {
    const csv = '\uFEFF单元,英文,中文\n预备单元,exchange,交换\n'
    const book = parseTextbookCsv(csv)
    expect(book.units[0].title).toBe('预备单元')
    expect(book.units[0].words[0].en).toBe('exchange')
  })
})
