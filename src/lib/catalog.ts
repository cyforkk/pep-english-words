import type { Textbook, TextbookIndex, TextbookIndexItem } from '../types/textbook'

export type LoadBookResult =
  | { ok: true; book: Textbook }
  | { ok: false; id: string; title: string }

const FETCH_CONCURRENCY = 5

/** 最小结构校验，避免坏 JSON 在 onReady 里炸开 */
export function isValidTextbook(data: unknown): data is Textbook {
  if (!data || typeof data !== 'object') return false
  const b = data as Record<string, unknown>
  return typeof b.id === 'string' && b.id.length > 0 && Array.isArray(b.units)
}

async function fetchBook(item: TextbookIndexItem): Promise<LoadBookResult> {
  try {
    const res = await fetch(`/data/textbooks/${item.id}.json`)
    if (!res.ok) return { ok: false, id: item.id, title: item.title }
    const data: unknown = await res.json()
    if (!isValidTextbook(data)) return { ok: false, id: item.id, title: item.title }
    return { ok: true, book: data }
  } catch {
    return { ok: false, id: item.id, title: item.title }
  }
}

/** 有限并发执行任务，保持结果与 items 下标对齐 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (next < items.length) {
      const i = next
      next += 1
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

export async function loadTextbookIndex(): Promise<TextbookIndex> {
  const r = await fetch('/data/textbooks/index.json')
  if (!r.ok) throw new Error(`加载词库索引失败: ${r.status}`)
  return r.json() as Promise<TextbookIndex>
}

/**
 * 先加载优先册（缓存/首册）以便尽快可用，再限并发预取其余册。
 * 优先册失败时回退尝试其它册，仅当全部失败才 throw。
 * onReady: 首本可用册就绪；onComplete: 全部结束（含失败列表）
 */
export async function loadCatalogProgressive(options: {
  preferredId?: string | null
  concurrency?: number
  signal?: { cancelled: boolean }
  onReady: (book: Textbook, readyId: string) => void
  onComplete: (books: Textbook[], failed: { id: string; title: string }[]) => void
}): Promise<void> {
  const { preferredId, concurrency = FETCH_CONCURRENCY, signal, onReady, onComplete } = options
  const idx = await loadTextbookIndex()
  if (signal?.cancelled) return
  if (!idx.books?.length) throw new Error('词库索引为空')

  // 优先缓存册，其余按索引顺序回退
  const tryOrder: TextbookIndexItem[] = []
  if (preferredId && idx.books.some((b) => b.id === preferredId)) {
    tryOrder.push(idx.books.find((b) => b.id === preferredId)!)
  }
  for (const b of idx.books) {
    if (b.id !== preferredId) tryOrder.push(b)
  }

  const byId = new Map<string, Textbook>()
  const failed: { id: string; title: string }[] = []

  let readyBook: Textbook | null = null
  let readyId = ''

  for (const item of tryOrder) {
    if (signal?.cancelled) return
    const r = await fetchBook(item)
    if (r.ok) {
      byId.set(r.book.id, r.book)
      readyBook = r.book
      readyId = r.book.id
      break
    }
    failed.push({ id: r.id, title: r.title })
  }

  if (!readyBook) {
    throw new Error('无法加载任何教材词库，请检查网络或稍后重试')
  }
  if (signal?.cancelled) return
  onReady(readyBook, readyId)

  // 已失败的不再重试；未尝试的限并发预取
  const failedIds = new Set(failed.map((f) => f.id))
  const toPrefetch = idx.books.filter((b) => !byId.has(b.id) && !failedIds.has(b.id))
  const restResults = await mapPool(toPrefetch, concurrency, (item) => fetchBook(item))
  if (signal?.cancelled) return

  for (const r of restResults) {
    if (r.ok) byId.set(r.book.id, r.book)
    else failed.push({ id: r.id, title: r.title })
  }

  const books = idx.books.map((b) => byId.get(b.id)).filter((b): b is Textbook => !!b)
  onComplete(books, failed)
}
