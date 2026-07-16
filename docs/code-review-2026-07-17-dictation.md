# 代码审查：默写模式（2026-07-17）

> 范围：默写功能本地增量  
> 状态：**Issue 1～8 已全部修复**

## Issues

| # | 级别 | 问题 | 状态 |
|---|------|------|------|
| 1 | bug | SpeakButton title 剧透英文 | **fixed** — `hideTextInTitle` / 自定义 title |
| 2 | suggestion | 跟读 en-big 剧透 | **fixed** — 默写显示「？」+ 中文 |
| 3 | suggestion | 底栏 currentWord.en | **fixed** — 默写显示「中：释义」 |
| 4 | suggestion | 空列表无法退出默写 | **fixed** — 开关提到列表外始终可见 |
| 5 | suggestion | storage 归一化单测 | **fixed** |
| 6 | nit | 无用 class | **fixed** — 已删除 |
| 7 | nit | hint 覆盖顺序提示 | **fixed** — 拼接多段 hint |
| 8 | nit | onReady 重复 setDictationMode | **fixed** — 已去掉 |

详见 [`功能-默写模式.md`](./功能-默写模式.md)。
