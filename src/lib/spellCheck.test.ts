import { describe, expect, it } from 'vitest'
import {
  checkSpelling,
  listItemSpellKey,
  normalizeAnswer,
  wordsContentSig,
} from './spellCheck'

describe('normalizeAnswer', () => {
  it('trim 与小写', () => {
    expect(normalizeAnswer('  Hello  ')).toBe('hello')
  })

  it('多空格压成单空格', () => {
    expect(normalizeAnswer('look  after')).toBe('look after')
    expect(normalizeAnswer('  a   b  c ')).toBe('a b c')
  })
})

describe('checkSpelling', () => {
  it('忽略大小写判对', () => {
    expect(checkSpelling('Apple', 'apple')).toBe(true)
    expect(checkSpelling('APPLE', 'apple')).toBe(true)
  })

  it('首尾空格与多空格', () => {
    expect(checkSpelling('  book  ', 'book')).toBe(true)
    expect(checkSpelling('look  after', 'look after')).toBe(true)
  })

  it('错误与空输入', () => {
    expect(checkSpelling('appl', 'apple')).toBe(false)
    expect(checkSpelling('', 'apple')).toBe(false)
    expect(checkSpelling('   ', 'apple')).toBe(false)
  })

  it('短语完整匹配', () => {
    expect(checkSpelling('take care of', 'take care of')).toBe(true)
    expect(checkSpelling('take care', 'take care of')).toBe(false)
  })

  it('弯引号与词库直写不同则判错（严格）', () => {
    expect(checkSpelling("don't", "don't")).toBe(true)
    expect(checkSpelling('don’t', "don't")).toBe(false)
  })
})

describe('listItemSpellKey / wordsContentSig', () => {
  it('同 en+zh 不同下标 key 不同', () => {
    expect(listItemSpellKey(0, 'bank', '银行')).not.toBe(listItemSpellKey(1, 'bank', '银行'))
  })

  it('内容签名含顺序', () => {
    const a = [
      { en: 'a', zh: '1' },
      { en: 'b', zh: '2' },
    ]
    const b = [
      { en: 'b', zh: '2' },
      { en: 'a', zh: '1' },
    ]
    expect(wordsContentSig(a)).not.toBe(wordsContentSig(b))
    expect(wordsContentSig(a)).toBe(wordsContentSig([...a]))
  })
})
