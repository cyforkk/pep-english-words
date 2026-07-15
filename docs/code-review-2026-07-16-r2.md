# 代码审查记录（第二轮）

> 日期：2026-07-16  
> 范围：当前工作区相对 `main` 的增量 + 主路径源码（`App` / `queue` / `storage` / 词库与折叠 UI）  
> **审查时已顺手修复**：缓存恢复被 StrictMode 误清单元（见问题 1）  
> **2026-07-16 后续**：Issue 2～6 已落地（按需加载、防抖、注释、gitignore、WordPlayer 测试）

---

## Summary

相对首轮审查，P0/P1 项大多已落地（结束语英文、失败暂停、并行加载、分页、选择缓存、学段折叠、小学初中词库）。  
本轮焦点在**选择缓存与换册逻辑**、**大体积词库加载**、**残留产物**。整体可用；问题 1 为真实回归风险，已在本次改为「仅点选教材时清空单元」。

---

## Issues

### Issue 1 -- Severity: bug（已修复）

- File: `src/App.tsx`（换册 effect + 教材点选）
- Description: 使用 `skipClearUnitsRef` 在 `textbookId` 的 `useEffect` 里「第一次不清理单元」。React 18 StrictMode 开发态会双跑 effect：第一次把 ref 置 false，第二次会 **清空刚从 localStorage 恢复的 selectedUnits**，缓存形同失效。
- Solution:
  - 去掉 `skipClearUnitsRef`；
  - **仅在用户点选其它教材**时 `setSelectedUnits([])`；
  - 学段展开改为依赖 `textbook` 对象，且已展开则不重复写 state。
- Status: **fixed**

### Issue 2 -- Severity: suggestion（已修复）

- File: `src/lib/catalog.ts` + `src/App.tsx`
- Description: 一次 `Promise.all` 拉取约 20 个 JSON，弱网/低端机首屏压力大。
- Solution: `loadCatalogProgressive`：先加载缓存/首册并 `onReady` 可交互，其余 **并发 5** 预取后 `onComplete` 合并；失败仍汇总 `loadWarn`。
- Status: **fixed**

### Issue 3 -- Severity: suggestion（已修复）

- File: `src/App.tsx`（`saveSelection` effect）
- Description: 折叠切换频繁写 localStorage。
- Solution: `setTimeout` **250ms 防抖**，cleanup 清定时器。
- Status: **fixed**

### Issue 4 -- Severity: suggestion（已修复）

- File: `src/lib/import.ts`
- Description: 无导入 UI 但仍有解析模块，易误解。
- Solution: 文件头注释标明「仅供测试/将来扩展」。
- Status: **fixed**

### Issue 5 -- Severity: nit（已修复）

- File: `.gitignore`
- Description: 根目录 `英语.svg` 与 `public/favicon.svg` 重复。
- Solution: `.gitignore` 忽略 `/英语.svg`，站点只用 `public/favicon.svg`。
- Status: **fixed**

### Issue 6 -- Severity: nit（已修复）

- File: `src/lib/queue.player.test.ts`
- Description: 缺 WordPlayer 失败/skip 单测。
- Solution: mock `speak`，覆盖顺序朗读、失败暂停、paused 后 skip、播放中 skip。
- Status: **fixed**

### Issue 7 -- Severity: nit

- File: 小学/初中单元均分
- Description: 与课本真实 Unit 边界可能不一致（已知产品债，非崩溃）。
- Suggestion: 有可靠起始词后再做 marker 切分；见 `docs/词库-人教版小学初中.md`。
- Status: open（文档债，本轮不改数据）

### Issue 8 -- Severity: bug（已修复）

- File: `src/lib/tts.ts` + `src/lib/queue.ts`
- Description: `cancelSpeak` 打断在线 Audio 时不清 settle，`await speak` 可能永久挂起；播放中 skip/暂停不可靠。测试 mock 混用 once+call 导致「失败后 skip」假失败。
- Solution: 见 [`bug-skip与发音取消.md`](./bug-skip与发音取消.md) — online settle + 队列 forceNext/paused 检查 + 单测修正。
- Status: **fixed**

---

## 做得好的地方（本轮）

1. 选择缓存 `le_selection_v1` 字段清晰，恢复时校验 textbook/unit 是否仍存在。  
2. 学段折叠 UI 移动端可用，标题去掉「三年级起点」。  
3. 去掉导入后主路径更简单，职责更干净。  
4. 首轮审查项（失败暂停、Finished.、分页、配额等）仍保持。  
5. Vitest 对 import / shuffle / WordPlayer / catalog 有基础覆盖。

---

## 建议优先级

| 优先级 | 项 |
|--------|-----|
| 已做 | Issue 1～6、8 |
| 可选 | Issue 7 小学/初中真实 Unit 边界 |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 第二轮审查；修复选择缓存 + StrictMode 冲突 |
| 2026-07-16 | Issue 2～6 全部修复并补测 |
| 2026-07-16 | Issue 8：skip/cancel 挂起与单测 mock；全量测试通过 |
