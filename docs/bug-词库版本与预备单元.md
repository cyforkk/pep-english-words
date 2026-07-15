# 问题与解决：词库版本错误、缺少预备单元

> 状态：**已处理**  
> 日期：2026-07-16  
> 关联：  
> - [`词库-人教版高中英语.md`](./词库-人教版高中英语.md)  
> - [`词库资源-检索记录.md`](./词库资源-检索记录.md)  
> - 脚本：`scripts/convert-pep-2019.mjs`

---

## 问题一：接入的词库不是 2019 人教新教材

### 现象

- 内置词库来自 [kajweb/dict](https://github.com/kajweb/dict) 的 `PEPGaoZhong_1`～`_11`。  
- 分册命名为「必修 1–5 + 选修 6–11」，词序/词目与当前使用的 **人教版（PEP）2019 新教材**不一致。  
- 用户反馈：单词资源不对。

### 原因

| 项 | 错误资源 | 正确目标 |
|----|----------|----------|
| 课标/教材 | 旧课标人教高中（大纲分册） | **2019 新教材** |
| 分册结构 | 必修 1–5、选修 6–11 | **必修第一～三册 + 选择性必修第一～四册** |
| 数据源 | 有道词书导出 zip（NDJSON） | 社区 2019 命名 xlsx |

旧资源与 2019 课本 **不是同一套书**，不能当「正常高中人教版单词」用。

### 解决方案

1. **删除** `public/data/textbooks/pep-senior-*.json` 及错误 `index.json`。  
2. **弃用**生产路径上的 `npm run convert:pep`（`scripts/convert-pep-gaozhong.mjs`，仅归档勿用）。  
3. **改用** [lilinji/English](https://github.com/lilinji/English) 中明确命名的 2019 文件：  
   - `人教版高中英语必修第一册.xlsx` … `第三册`  
   - `人教版高中英语选择性必修第一册.xlsx` … `第四册`  
4. 新脚本 `scripts/convert-pep-2019.mjs`，输出 `pep2019-*.json` + `index.json`。  
5. 重新生成命令：

```bash
git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English
npm run convert:pep2019
```

### 验证

- 必修第一册首词为 `exchange`（Welcome Unit），而非旧课标常见的 `survey` 等。  
- 前端加载 `index.json` 显示 7 册 2019 标题。

---

## 问题二：页面上看不到「预备单元 / Welcome Unit」

### 现象

- 2019 人教 **必修第一册** 课本结构为：**Welcome Unit（预备单元）+ Unit 1～5**。  
- 转换后单元列表只有 Unit 1～5，**没有预备单元**。  
- 用户反馈：不是有预备单元吗？没看见。

### 原因

1. 源 xlsx **只有**「单词 / 英音 / 美音 / 释义」，**没有 Unit 列**。  
2. 初版转换用「整册词序 **均分成 5 段**」硬切：  
   - 把 Welcome Unit 的词（如 exchange、lecture、registration…）**并进了「Unit 1」**；  
   - 单元标题也不体现「预备单元」。  
3. 因此 UI 勾选区只显示 Unit 1～5，用户无法单独练预备单元。

### 解决方案

按公开课本词表对照，用 **单元起始词（startWord）** 切分，而不是均分。

**必修第一册**（已配置）：

| 单元 id | 标题 | 起始词（示例） | 约词数 |
|---------|------|----------------|--------|
| `welcome` | **Welcome Unit · 预备单元** | `exchange` | 57 |
| `u1` | Unit 1 Teenage Life | `teenage` | 56 |
| `u2` | Unit 2 Travelling Around | `castle` | 73 |
| `u3` | Unit 3 Sports and Fitness | `fitness` | 61 |
| `u4` | Unit 4 Natural Disasters | `disaster` | 81 |
| `u5` | Unit 5 Languages Around the World | `billion` | 59 |

实现位置：`scripts/convert-pep-2019.mjs` → `splitByMarkers()`。  
重转后 JSON 中 `units[0].title === "Welcome Unit · 预备单元"`，前端勾选区可见。

### 其它册（补充）

| 册 | 处理 |
|----|------|
| 必修二、三 | 课本无 Welcome Unit；按起始词切 Unit 1～5 并带主题标题 |
| 选择性必修一 | 按起始词切 Unit 1～5 并带主题标题 |
| 选择性必修二～四 | 源表仍无可靠边界，暂 **均分 5 单元**（标题 Unit 1～5） |

边界词来自公开词表/课本目录对照，**可能与个别教辅略有出入**；若与纸质书不一致，改 `BOOKS[].units[].startWord` 后重新 `npm run convert:pep2019` 即可。

### 验证

1. `npm run convert:pep2019` 日志中必修一应出现：  
   `Welcome Unit · 预备单元(57) · Unit 1 …`  
2. 浏览器选「必修第一册」→ 单元列表第一项为 **Welcome Unit · 预备单元**。  
3. 勾选仅预备单元 → 列表首词 `exchange`，末词约 `revise`。

---

## 经验小结

| 原则 | 说明 |
|------|------|
| 先确认课标版本 | 「人教高中」≠ 自动等于 2019；旧课标分册不能当新教材用 |
| 有 Unit 用 Unit，无 Unit 勿瞎均分 | 均分会吞掉 Welcome Unit、打乱单元主题 |
| 起始词切分可维护 | 边界写在转换脚本配置里，方便按课本修订 |
| 文档与脚本同步 | 资源检索、词库说明、本 bug 文互链，避免再接错源 |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 删除旧课标词库，接入 lilinji 2019 七册 |
| 2026-07-16 | 必修一增加 Welcome Unit · 预备单元；起始词切分 Unit 1～5 |
| 2026-07-16 | 本文件：汇总问题现象、原因、方案与验证 |
