# 代码审查：输入判对错（2026-07-17）

> 状态：**Issue 1～10 已处理**（1～7 代码，8 文档，9 签名已用下标，10 退出清空保留）

| # | 级别 | 处理 |
|---|------|------|
| 1 | bug | `selectedWordsSig` / 仅 `displayWordsSig` 清作答 |
| 2 | bug | `listItemSpellKey(index, en, zh)` |
| 3 | bug | 判分读 `prev` |
| 4 | suggestion | 检查 disabled 当空 |
| 5 | suggestion | a11y |
| 6 | suggestion | WordListItem memo |
| 7 | suggestion | `.spell-btn` min-height tap |
| 8 | nit | 文档写明严格匹配 |
| 9 | nit | wordsContentSig 带 index |
| 10 | nit | 退出默写仍清空 |

见 [`功能-输入默写判对错.md`](./功能-输入默写判对错.md)。
