# 问题与解决：去掉导入词表 + 本机参数全量缓存

> 日期：2026-07-16  
> 状态：**已实现**  
> 相关代码：`src/App.tsx`、`src/lib/storage.ts`、`src/types/textbook.ts`

---

## 需求

1. **去除**导入词表功能与按钮。  
2. **支持缓存**用户可选参数，刷新后恢复：
   - 学段折叠（小学 / 初中 / 高中）
   - 教材册、勾选单元
   - 点读 / 跟读模式
   - 语速、跟读遍数、词间隔  
3. **默认语速 1.0**。

---

## 解决方案

### 1. 移除导入

- 删除 UI：导入按钮、文件选择、删除导入。  
- 删除 `parseTextbookFile` / `upsertImportedTextbook` 等在 App 中的调用。  
- 教材列表仅来自内置 `catalog`（`index.json` + 各册 JSON）。

### 2. 选择缓存 `le_selection_v1`

```ts
type UserSelection = {
  textbookId: string
  selectedUnits: string[]
  openStages?: Record<string, boolean> // primary | junior | senior
  mode?: 'browse' | 'shadow'
}
```

| 字段 | 含义 |
|------|------|
| `textbookId` | 上次教材（小学/初中/高中某册） |
| `selectedUnits` | 勾选的单元 id |
| `openStages` | 学段折叠展开 |
| `mode` | 点读 / 跟读 |

**恢复**：优先加载缓存册 → 过滤仍存在的单元 → 恢复折叠（当前学段至少展开）→ 恢复 mode。  
**写入**：`textbookId` / `selectedUnits` / `openStages` / `mode` 变化后 **250ms 防抖**（加载中不写）。  
**换册**：用户点选其它册时清空单元勾选（不清缓存键，下次保存覆盖）。

### 3. 播放设置缓存 `le_player_settings`

```ts
type PlayerSettings = {
  rate: number      // 默认 1.0，范围 0.5～1.5
  repeatEn: number  // 默认 2，范围 1～10
  gapMs: number     // 默认 3000，范围 0～30000
}
```

| API | 作用 |
|-----|------|
| `loadSettings()` / `saveSettings()` | 读写并 `normalizeSettings` 夹紧 |
| `normalizeSettings()` | 非法值回退/夹紧；语速两位小数 |

**写入**：设置变更后 250ms 防抖。  
**恢复默认**：写回 `DEFAULT_SETTINGS`（语速 **1.0**）并自动再缓存。

---

## 验证

1. 选「初中 · 七年级上」并勾选 Unit 2，刷新 → 仍为该册 + Unit 2。  
2. 展开/折叠小学初中高中后刷新 → 折叠状态保持（当前学段至少展开）。  
3. 语速调到 1.2、遍数 3、间隔 2000，刷新 → 仍为上述值。  
4. 新用户无缓存时语速默认 **1.0**。  
5. 页面无「导入词表」按钮。  
6. `npm test` 含 `storage.test.ts`。

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 去掉导入；增加 le_selection_v1 教材/单元/折叠缓存 |
| 2026-07-16 | 语速默认 1.0；设置规范化；mode 一并缓存；设置防抖；补 storage 单测 |
