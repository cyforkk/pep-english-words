# 问题与解决：暂停后 skip 双跳 + 缓存册失败整站不可用

> 日期：2026-07-16  
> 关联审查：[`code-review-2026-07-16-r3.md`](./code-review-2026-07-16-r3.md)

---

## 问题 1：用户暂停后再点「下一词」跳过两词

### 现象

跟读中点暂停，再点「下一词」，可能跳过当前词**之后的再一词**，或短暂复读。

### 根因

`skip()` 在 `paused` 时**总是** `index += 1` 并清掉 `forceNext`，再释放 `pauseResolve`。  
用户暂停时 `loop` 仍挂在 `waitIfPaused`：释放后循环末尾**再** `index += 1`，双次推进。

发音失败后 `loop` 已 `return`、无 `pauseResolve` 的路径本身正确。

### 修复

| 暂停类型 | skip 行为 |
|----------|-----------|
| 有 `pauseResolve`（用户 pause） | `forceNext=true` + 恢复 playing + 释放等待，**不**手动 `index++` |
| 无 `pauseResolve`（失败后 loop 退出） | `index++` + 重进 `loop` |

另：词间隔中 pause 时 `clearGap` 后补 `waitIfPaused`，避免「暂停却跳词」。

---

## 问题 2：缓存册 404 导致整站加载失败

### 现象

localStorage 记住的教材 id 对应 JSON 失败时，页面只显示加载错误，其它册也无法选。

### 根因

`loadCatalogProgressive` 对优先册失败直接 `throw`。

### 修复

按「缓存册 → 索引顺序」依次尝试；任一成功即 `onReady`；失败记入列表；**全部**失败才 throw。  
并对 JSON 做 `id` + `units` 最小校验。

---

## 验证

- 单测：用户 pause→skip 只念 `two, three`；gap 中 pause index 仍为 0  
- 单测：preferred 失败回退 good 册  
- `npm test` / `npm run build`

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 记录并修复 pause/skip 与 catalog 回退 |
