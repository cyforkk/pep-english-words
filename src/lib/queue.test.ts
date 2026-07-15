import { describe, expect, it } from 'vitest'
import { shuffleArray } from './queue'

describe('shuffleArray', () => {
  it('不修改原数组', () => {
    const src = [1, 2, 3, 4, 5]
    const copy = [...src]
    shuffleArray(src)
    expect(src).toEqual(copy)
  })

  it('结果长度与元素集合一致', () => {
    const src = ['a', 'b', 'c', 'd']
    const out = shuffleArray(src)
    expect(out).toHaveLength(src.length)
    expect([...out].sort()).toEqual([...src].sort())
  })

  it('空数组与单元素', () => {
    expect(shuffleArray([])).toEqual([])
    expect(shuffleArray([1])).toEqual([1])
  })
})
