import { afterEach, describe, expect, it, vi } from 'vitest'
import { isValidTextbook, loadCatalogProgressive, mapPool } from './catalog'
import type { Textbook } from '../types/textbook'

describe('mapPool', () => {
  it('保持顺序并限制并发语义正确', async () => {
    const order: number[] = []
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      order.push(n)
      await new Promise((r) => setTimeout(r, 5))
      return n * 10
    })
    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(order).toHaveLength(5)
  })

  it('空列表', async () => {
    expect(await mapPool([], 3, async (x) => x)).toEqual([])
  })
})

describe('isValidTextbook', () => {
  it('校验 id 与 units', () => {
    expect(isValidTextbook({ id: 'a', units: [] })).toBe(true)
    expect(isValidTextbook({ id: '', units: [] })).toBe(false)
    expect(isValidTextbook({ id: 'a' })).toBe(false)
    expect(isValidTextbook(null)).toBe(false)
  })
})

function bookJson(id: string, title = id): Textbook {
  return {
    id,
    title,
    stage: 'senior',
    units: [{ id: 'u1', title: 'U1', words: [{ en: 'hi', zh: '嗨' }] }],
  }
}

describe('loadCatalogProgressive', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('优先 preferred，其余 complete', async () => {
    const books = {
      'book-a': bookJson('book-a', 'A'),
      'book-b': bookJson('book-b', 'B'),
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('index.json')) {
          return {
            ok: true,
            json: async () => ({
              books: [
                { id: 'book-a', title: 'A', words: 1, units: 1 },
                { id: 'book-b', title: 'B', words: 1, units: 1 },
              ],
            }),
          }
        }
        const id = url.match(/textbooks\/(.+)\.json$/)?.[1]
        if (id && books[id as keyof typeof books]) {
          return { ok: true, json: async () => books[id as keyof typeof books] }
        }
        return { ok: false, status: 404 }
      }),
    )

    const ready: string[] = []
    let completeIds: string[] = []
    await loadCatalogProgressive({
      preferredId: 'book-b',
      onReady: (b, id) => {
        ready.push(id)
        expect(b.id).toBe('book-b')
      },
      onComplete: (list) => {
        completeIds = list.map((b) => b.id)
      },
    })
    expect(ready).toEqual(['book-b'])
    expect(completeIds.sort()).toEqual(['book-a', 'book-b'])
  })

  it('preferred 失败则回退其它册', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('index.json')) {
          return {
            ok: true,
            json: async () => ({
              books: [
                { id: 'bad', title: '坏', words: 0, units: 0 },
                { id: 'good', title: '好', words: 1, units: 1 },
              ],
            }),
          }
        }
        if (url.includes('bad.json')) return { ok: false, status: 404 }
        if (url.includes('good.json')) {
          return { ok: true, json: async () => bookJson('good', '好') }
        }
        return { ok: false, status: 404 }
      }),
    )

    let readyId = ''
    let failed: { id: string }[] = []
    await loadCatalogProgressive({
      preferredId: 'bad',
      onReady: (_b, id) => {
        readyId = id
      },
      onComplete: (_books, f) => {
        failed = f
      },
    })
    expect(readyId).toBe('good')
    expect(failed.some((x) => x.id === 'bad')).toBe(true)
  })

  it('signal 取消后不回调 onComplete', async () => {
    const signal = { cancelled: false }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('index.json')) {
          return {
            ok: true,
            json: async () => ({
              books: [{ id: 'a', title: 'A', words: 1, units: 1 }],
            }),
          }
        }
        signal.cancelled = true
        return { ok: true, json: async () => bookJson('a') }
      }),
    )

    let ready = false
    let complete = false
    await loadCatalogProgressive({
      signal,
      onReady: () => {
        ready = true
      },
      onComplete: () => {
        complete = true
      },
    })
    expect(ready).toBe(false)
    expect(complete).toBe(false)
  })

  it('全部失败则 throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('index.json')) {
          return {
            ok: true,
            json: async () => ({
              books: [{ id: 'x', title: 'X', words: 0, units: 0 }],
            }),
          }
        }
        return { ok: false, status: 404 }
      }),
    )
    await expect(
      loadCatalogProgressive({
        onReady: () => {},
        onComplete: () => {},
      }),
    ).rejects.toThrow(/无法加载任何教材/)
  })
})
