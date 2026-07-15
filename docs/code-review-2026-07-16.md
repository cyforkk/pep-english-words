# 代码审查：问题与解决方案

> 日期：2026-07-16  
> 范围：`src/**`、转换脚本、`netlify.toml`（不含词库 JSON 内容逐条校对）  
> **状态：审查项已全部修复并落档**

本文记录审查时发现的**问题**与落地的**解决方案**，便于以后回溯。

---

## 总览

| # | 严重度 | 问题（一句话） | 状态 |
|---|--------|----------------|------|
| 1 | bug | 跟读结束仍播中文「本单元结束」 | **已修复** |
| 2 | bug | 词库串行加载，失败册静默跳过 | **已修复** |
| 3 | bug | 发音失败仍继续空跑下一词 | **已修复** |
| 4 | suggestion | 列表打乱 + 设置再随机 → 双重 shuffle | **已修复** |
| 5 | suggestion | 全选后一次渲染数百词卡片 | **已修复** |
| 6 | suggestion | localStorage 爆满无提示 | **已修复** |
| 7 | suggestion | 缺自动化测试 | **已修复（部分）** |
| 8 | nit | 未使用的 `replayCurrent` | **已修复** |
| 9 | nit | 中文 TTS 在线源仍保留 | **已修复** |
| 10 | nit | 旧课标转换脚本易误用 | **已修复** |
| 11 | nit | Netlify SPA 回退与 `/data` | **已修复** |

Issue 7：已补 `import` / `shuffleArray` 单测；App 大组件拆分未做（可后续迭代）。

---

## 问题 1：结束语中文 TTS

### 问题

`WordPlayer` 跟读正常结束后调用：

```ts
await speak('本单元结束', { lang: 'zh-CN', rate: ... })
```

产品已明确**不做中文语音**；手机中文 TTS 又是历史痛点。

### 解决方案

改为英文结束提示：

```ts
await speak('Finished.', { lang: 'en-US', rate: this.settings.rate })
```

- 文件：`src/lib/queue.ts`（loop 结束分支）

---

## 问题 2：词库串行加载、失败静默

### 问题

```ts
for (const item of idx.books) {
  const res = await fetch(...)
  if (!res.ok) continue  // 静默
}
```

- 串行慢；  
- 单册失败用户无感知，目录不完整。

### 解决方案

- `Promise.all` **并行**加载各册；  
- 失败册收集到 `loadWarn` 黄条提示（如「N 册词库加载失败：…」）；  
- 全部失败才 `loadError`。

- 文件：`src/App.tsx`（词库加载 `useEffect`）

---

## 问题 3：发音失败仍继续空跑

### 问题

`speak` 抛错后只 `onError`，循环仍 `index++`，状态保持 `playing`，用户以为还在跟读。

### 解决方案

```ts
} catch (e) {
  this.callbacks.onError?.(`发音失败，已暂停：${msg}`)
  this.pause()  // 停在当前词
  return
}
```

- 用户可点 **继续** 重试当前词，或 **下一词** 跳过（`skip` 在 paused 时会 `index++` 再 `loop`）。  
- 文件：`src/lib/queue.ts`

---

## 问题 4：双重打乱

### 问题

UI「打乱单词」已改 `displayWords`，设置里若再勾选「开始跟读时再随机」，`start` 内再次 `shuffle`，列表顺序与播放不一致。

### 解决方案

- 删除 `PlayerSettings.shuffle` 与设置项 UI；  
- `WordPlayer.start(words)` **严格** `this.queue = [...words]`，不再二次 shuffle；  
- 随机只通过列表「打乱单词」按钮。

- 文件：`src/types/textbook.ts`、`src/lib/queue.ts`、`src/App.tsx`、`src/lib/storage.ts`

---

## 问题 5：大列表一次渲染

### 问题

全选一册 300～400 词卡片一次挂载，低端机卡顿。

### 解决方案

- 常量 `WORD_LIST_PAGE_SIZE = 50`；  
- 首屏只渲染前 50 条；  
- 「加载更多」每次 +50。

- 文件：`src/types/textbook.ts`、`src/App.tsx`

---

## 问题 6：localStorage 配额

### 问题

`setItem` 无 try/catch，大导入可能 `QuotaExceededError` 无中文提示。

### 解决方案

```ts
// saveImportedTextbooks
catch → 中文错误「本地存储空间不足…」

// upsertImportedTextbook
if (countWords(book) > MAX_IMPORT_WORDS) throw …  // 上限 5000
```

- 文件：`src/lib/storage.ts`

---

## 问题 7：缺少测试

### 问题

无自动化测试，重构易回归。

### 解决方案

- 引入 Vitest：`npm test`  
- `src/lib/import.test.ts`：JSON/CSV 解析  
- `src/lib/queue.test.ts`：`shuffleArray`  
- App 拆组件留作后续（未强制本次完成）

- 文件：`vitest.config.ts`、`package.json` scripts

---

## 问题 8：死代码 replayCurrent

### 问题

`WordPlayer.replayCurrent` 无调用方。

### 解决方案

删除该方法。

- 文件：`src/lib/queue.ts`

---

## 问题 9：中文 TTS 在线源残留

### 问题

`onlineUrls` 仍含百度等中文源，与产品范围不符。

### 解决方案

`onlineUrls` 仅保留英文有道 `type=1/2`；即使误传 `zh-CN` 也走英文源。

- 文件：`src/lib/tts.ts`

---

## 问题 10：旧课标转换脚本

### 问题

`scripts/convert-pep-gaozhong.mjs` 易被误用。

### 解决方案

移至 `scripts/archive/`，并加 `scripts/archive/README.md` 说明勿用。  
生产只用 `npm run convert:pep2019`。

---

## 问题 11：Netlify `/data` 与 SPA 回退

### 问题

`/* → index.html` 理论上可能与静态资源规则混淆（实际 Netlify 多先静态后回退）。

### 解决方案

在 `netlify.toml` 显式保留 `/data/*` 静态意图，再写 SPA `/*` 回退。

- 文件：`netlify.toml`

---

## 做得好的地方（审查时保留）

1. TTS / 队列 / 导入 / 存储职责清晰  
2. 共享 Audio + 手势解锁  
3. `runToken` / `forceNext` 控制竞态  
4. 导入校验与 BOM  
5. 词库/单元类 bug 另有专文（预备单元、默认全选等）

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [bug-词库版本与预备单元](./bug-词库版本与预备单元.md) | 旧课标误用、Welcome Unit |
| [bug-单元默认全选](./bug-单元默认全选.md) | 换册默认不选单元 |
| [bug-手机点击无声音](./bug-手机点击无声音.md) | 移动端发音 |
| [bug-英文秒出中文不行](./bug-英文秒出中文不行.md) | 中英 TTS 差异 |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 审查落档（Issue 状态 open） |
| 2026-07-16 | 全部修复 |
| 2026-07-16 | 整理为「问题 + 解决方案」完整记录，Issue 状态改为已修复 |
