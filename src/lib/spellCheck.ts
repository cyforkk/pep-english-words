/**
 * 拼写判对：本地与词库 en 比对，无后端。
 * 规则：trim → 小写 → 连续空白压成单空格。
 * 不统一弯引号/去标点（严格匹配词库写法）。
 */

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function checkSpelling(input: string, answer: string): boolean {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(answer)
  if (!a || !b) return false
  return a === b
}

/**
 * 列表项身份 key：必须带 **列表下标**，避免同 en+zh 多条串状态。
 * 打乱后下标随 displayWords 变化，配合签名清空作答。
 */
export function listItemSpellKey(index: number, en: string, zh: string): string {
  return `${index}\0${en}\0${zh}`
}

/** 仅内容签名（不含顺序下标时用于选词是否变化）；顺序敏感用带 index 的 join */
export function wordsContentSig(words: { en: string; zh: string }[]): string {
  return words.map((w, i) => listItemSpellKey(i, w.en, w.zh)).join('\n')
}
