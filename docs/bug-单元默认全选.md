# 问题与解决：单元列表默认全选

> 状态：**已修复**  
> 日期：2026-07-16  
> 相关代码：`src/App.tsx`

---

## 问题

### 现象

- 打开应用或切换教材后，**单元列表默认全部勾选**。  
- 单词列表立刻展示该册全部单元的词。  
- 期望：**默认不要全选**，由用户自行勾选（或再点「全选」）。

### 原因

切换 `textbookId` 时的 `useEffect` 会把当前教材所有单元 id 写入 `selectedUnits`：

```ts
// 修复前（错误行为）
useEffect(() => {
  if (!textbook) return
  setSelectedUnits(textbook.units.map((u) => u.id))  // 默认全选
}, [textbookId])
```

因此一进册或一换册，就是「全选」状态。

`selectedWords` 依赖 `selectedUnits`：

```ts
const selectedWords = useMemo(() => {
  if (!textbook) return [] as Word[]
  return textbook.units
    .filter((u) => selectedUnits.includes(u.id))
    .flatMap((u) => u.words)
}, [textbook, selectedUnits])
```

全选 → 列表立刻铺满全书单词。

---

## 解决方案

切换教材时 **清空勾选**，默认不选任何单元：

```ts
// 修复后 — src/App.tsx
// 切换教材时默认不勾选任何单元（需用户自选或点「全选」）
useEffect(() => {
  if (!textbook) return
  setSelectedUnits([])
}, [textbookId]) // textbook 来自 textbookId 对应册
```

### 用户如何全选

界面仍保留工具栏按钮（逻辑未改）：

```ts
const selectAllUnits = () => {
  if (!textbook) return
  setSelectedUnits(textbook.units.map((u) => u.id))
}

const clearUnits = () => setSelectedUnits([])
```

- **全选**：一键勾选当前册全部单元  
- **清空**：取消全部勾选  

### 初始状态

```ts
const [selectedUnits, setSelectedUnits] = useState<string[]>([])
```

本身就是空数组；问题只出在「换册 effect 写回全选」。修复后与初始一致。

---

## 验证

1. 刷新页面，默认教材下单元 **均未勾选**，单词列表提示「请勾选单元」。  
2. 勾选「Welcome Unit · 预备单元」等，仅显示对应词。  
3. 点「全选」→ 全部单元选中。  
4. 切换另一册教材 → 勾选再次清空，不带上册状态。

---

## 相关代码索引

| 位置 | 作用 |
|------|------|
| `src/App.tsx` → `selectedUnits` state | 当前勾选的单元 id 列表 |
| `src/App.tsx` → `useEffect` on `textbookId` | **换册默认勾选策略（本问题修复点）** |
| `src/App.tsx` → `selectedWords` | 按勾选单元合并单词 |
| `src/App.tsx` → `selectAllUnits` / `clearUnits` | 全选 / 清空按钮 |
| `src/App.tsx` → 单元 `checkbox` | UI 勾选绑定 `selectedUnits.includes(u.id)` |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 换册时 `setSelectedUnits([])`，默认不全选；本文记录问题与代码位置 |
