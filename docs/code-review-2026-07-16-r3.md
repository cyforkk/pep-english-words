# 代码审查记录（第三轮）与修复

> 日期：2026-07-16  
> 范围：本地未提交增量（学段/缓存/渐进加载/skip·cancel 等）  
> 状态：**Issue 1～8 已全部修复**

---

## Summary

本轮在 r2 基础上审查了选择/设置缓存、`loadCatalogProgressive`、`WordPlayer` skip/pause、`cancelSpeak`。  
主路径可用；**用户暂停后再 skip** 会双次推进 index（bug），**缓存册加载失败** 会整站不可用（bug）。已全部落地修复并补测。

---

## Issues

### Issue 1 -- Severity: bug（已修复）

- File: `src/lib/queue.ts` `skip()`
- Description: 用户 `pause()` 后（`pauseResolve` 仍挂起）`skip` 无条件 `index++` 并清 `forceNext`，loop 再 `index++` → 多跳一词。
- Solution: 有 `pauseResolve` 时只 `forceNext` + 释放等待；无 `pauseResolve`（失败后 loop 已退出）才 `index++` 并重进 loop。
- Status: **fixed**

### Issue 2 -- Severity: bug（已修复）

- File: `src/lib/catalog.ts`
- Description: 优先册 fetch 失败直接 throw，其余册可用也进不去。
- Solution: 按「缓存册 → 索引顺序」依次尝试，任一成功则 `onReady`；失败记入 `failed`；全部失败才 throw。
- Status: **fixed**

### Issue 3 -- Severity: suggestion（已修复）

- File: `src/lib/queue.ts` gap
- Description: 词间隔中 pause 会 `clearGap` 后仍推进 index。
- Solution: `waitGap` 返回后若仍 `paused`，先 `waitIfPaused` 再 `index++`。
- Status: **fixed**

### Issue 4 -- Severity: suggestion（已修复）

- File: `src/lib/queue.player.test.ts`
- Description: 缺用户 pause→skip、gap 中 pause 覆盖。
- Solution: 补单测「用户 pause 后 skip 只跳一词」「词间隔中 pause 不提前跳词」。
- Status: **fixed**

### Issue 5 -- Severity: suggestion（已修复）

- File: `src/lib/catalog.test.ts`
- Description: 仅测 `mapPool`。
- Solution: 覆盖 preferred 优先、失败回退、signal 取消、全部失败 throw、`isValidTextbook`。
- Status: **fixed**

### Issue 6 -- Severity: suggestion（已修复）

- File: `src/lib/tts.ts`
- Description: cancel 重置 `playChain` 后旧任务可能与新播放交错。
- Solution: `playGeneration` 世代；`speakOnline` 在 run/换源前检查世代，过期直接 return。
- Status: **fixed**

### Issue 7 -- Severity: nit（已修复）

- File: `src/App.tsx` `stageKeyOf` / `groupBooks`
- Description: 无 stage 静默归入高中。
- Solution: 归入 `other`（展示「其它」）。
- Status: **fixed**

### Issue 8 -- Severity: nit（已修复）

- File: `src/lib/catalog.ts` `fetchBook`
- Description: 任意 JSON 当 Textbook。
- Solution: `isValidTextbook` 校验 `id` + `units` 数组，失败记入 failed。
- Status: **fixed**

---

## 验证

```text
npm test    # 全部通过
npm run build
```

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 第三轮审查；Issue 1～8 全部修复并补测 |
