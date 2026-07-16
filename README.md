# 人教英语单词 · 点读跟读

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-pep--english--words-181717?logo=github)](https://github.com/cyforkk/pep-english-words)

**开源** · 轻量纯前端英语单词练习页。

内置**人教版（PEP）**词库：**小学（三年级起点）+ 初中 + 高中 2019**，按册 / 单元做 **英文点读**、**英文跟读** 与 **默写（可输入判对）**。界面按**手机网页优先**适配，可自托管或一键部署到 Netlify。

- 仓库：https://github.com/cyforkk/pep-english-words  
- 欢迎 Issue / Pull Request

## 当前范围

| 做 | 不做 |
|----|------|
| 英文点读（点「英」） | 中文语音输出 |
| 英文跟读（自动念英文） | 中文 TTS 听写流水线 |
| 默写：藏英文 + **输入英文本地判对错** | 云端成绩 / 账号 |
| 人教小学 / 初中 / 高中 2019 词库 | 中文 mp3 预生成（方案已搁置） |
| 打乱 / 恢复列表顺序 | 导入自定义词表 |
| 本机缓存（教材、单元、学段、语速等） | 跟读流式「一词一输」（方案 B 未做） |

中文释义在列表中展示；默写时只显示中文，不朗读中文。

## 功能一览

- **词库**：小学 8 册 + 初中 5 册 + 高中 2019 七册（共 20 册）  
- **单元**：高中必修一含 **Welcome Unit · 预备单元**；部分册按起始词切分，其余均分 Unit  
- **学段折叠**：小学 / 初中 / 高中可展开收起  
- **本地缓存**：教材、单元、学段折叠、点读/跟读模式、默写开关；语速 / 遍数 / 间隔（默认语速 **1.0**）  
- **选单元**：换册后默认清空勾选（恢复缓存时保留上次勾选）  
- **点读**：单词卡片点「英」发音（有道在线，需联网）  
- **跟读**：按当前列表自动念英文，可看中文；底部栏暂停 / 下一词 / 停止  
- **打乱单词**：仅打乱当前已选单元的列表顺序，可恢复  
- **默写**：隐藏列表英文与音标，只显示中文；每词可**输入英文并判对错**（忽略大小写与多余空格，错显答案；纯前端、无后端）

## 快速开始

```bash
git clone https://github.com/cyforkk/pep-english-words.git
cd pep-english-words
npm install
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)。

**手机同一 Wi‑Fi：**

```bash
npm run dev:host
# 或 npm run dev -- --host
```

用手机浏览器打开终端里的 Network 地址。关静音，调**媒体音量**。

**生产构建：**

```bash
npm run build
npm run preview
```

## 部署到 Netlify

仓库已包含：

| 文件 | 作用 |
|------|------|
| [`netlify.toml`](netlify.toml) | 构建命令、发布目录、Node 版本、SPA 重定向、缓存头 |
| [`public/_redirects`](public/_redirects) | SPA 回退（构建时复制到 `dist/`） |

### 方式一：Git 连接（推荐）

1. Fork 或直接使用本仓库：https://github.com/cyforkk/pep-english-words  
2. [Netlify](https://app.netlify.com/) → **Add new site** → **Import an existing project**  
3. 选择仓库；配置会从 `netlify.toml` 自动读取：  
   - **Build command:** `npm run build`  
   - **Publish directory:** `dist`  
4. Deploy 完成后用站点域名访问  

### 方式二：命令行

```bash
npm install -g netlify-cli
npm run build
netlify login
netlify init      # 首次关联站点
netlify deploy --prod
```

### 方式三：拖拽发布

```bash
npm run build
```

把 **`dist`** 文件夹拖到 [Netlify Drop](https://app.netlify.com/drop)。

### 注意

- 词库 JSON 在 `public/data/textbooks/`，会随构建进 `dist`，**无需**在 Netlify 再跑 `convert:pep2019`  
- 英文发音依赖浏览器访问有道等外网；部分网络环境可能受限  
- 本地 `tmp/` 不参与部署（已在 `.gitignore`）

## 使用说明

1. 选择分册（如「必修第一册」）  
2. 勾选单元（如 **Welcome Unit · 预备单元**）；或点「全选」  
3. **点读**：在单词卡片点「英」  
4. **跟读**：点「跟读」，用底部按钮控制播放  
5. 需要随机：点「打乱单词」；「恢复顺序」回到词库顺序  

## 内置词库

| 学段 | 内容 | 文件 id 前缀 |
|------|------|----------------|
| **小学** | 三年级起点 三上～六下（8 册） | `pep-primary-*` |
| **初中** | 七上/下、八上/下、九年级全册（5 册） | `pep-junior-*` |
| **高中 2019** | 必修一～三 + 选择性必修一～四（7 册；必修一含预备单元） | `pep2019-*` |

数据目录：`public/data/textbooks/`、`index.json`。  
下拉按「小学 / 初中 / 高中」分组。  

> 小学为三年级起点系列（标题不显示该字样）。「一年级起点」源文件暂未接入。  
> 教材列表按 **小学 / 初中 / 高中** 分组，支持折叠展开。

### 重新从源转换

源词表：[lilinji/English](https://github.com/lilinji/English)（人教版目录下 2019 命名 xlsx）。

```bash
git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English
npm run convert:pep2019
```

- 单元按脚本内**起始词**切分（含预备单元），见 `scripts/convert-pep-2019.mjs`  
- 旧课标脚本已归档到 `scripts/archive/`，勿使用

## 本地缓存

所有可选参数均写入浏览器 `localStorage`，刷新后自动恢复：

| 键 | 内容 |
|----|------|
| `le_selection_v1` | 教材 id、勾选单元、小学/初中/高中折叠、点读/跟读模式 |
| `le_player_settings` | 语速（**默认 1.0**）、英文跟读遍数、词间隔 ms |

词库 JSON 结构说明见 [docs/教材词库数据结构.md](docs/教材词库数据结构.md)（供维护内置词库参考）。

## 技术栈

| 项 | 说明 |
|----|------|
| 构建 | Vite |
| UI | React + TypeScript |
| 词表转换 | Node + `xlsx` |
| 英文发音 | 在线 TTS（有道等）+ 系统语音回退 |
| 存储 | localStorage（播放设置 + 选择/默写开关；拼写作答不落盘） |

## 目录结构

```
pep-english-words/
├── public/data/textbooks/     # 小学 / 初中 / 高中 2019 词库 JSON + index
├── scripts/
│   ├── convert-pep-2019.mjs   # 词库转换
│   └── archive/               # 废弃脚本（旧课标）
├── src/
│   ├── App.tsx
│   ├── components/
│   ├── lib/                   # tts、播放队列、存储、目录加载
│   └── types/
├── docs/                      # 词库说明、bug 记录、用户需求
├── netlify.toml
└── LICENSE                    # MIT
```

## 参与贡献

本项目**开源**，欢迎贡献代码、文档与词库边界修订：

1. Fork 本仓库  
2. 新建分支：`git checkout -b feature/your-change`  
3. 提交并推送后发起 Pull Request  

也可直接提 [Issue](https://github.com/cyforkk/pep-english-words/issues) 反馈问题或建议。

开发约定简述：

- 代码改动尽量小而聚焦  
- 功能 / bug 修复可按项目习惯补充 `docs/` 说明  
- 词库边界修改请改 `scripts/convert-pep-2019.mjs` 后重新转换  

## 文档

| 文档 | 内容 |
|------|------|
| [词库说明·高中](docs/词库-人教版高中英语.md) | 高中 2019 词库 |
| [词库说明·小学初中](docs/词库-人教版小学初中.md) | 小学三年级起点 + 初中 |
| [词库资源检索](docs/词库资源-检索记录.md) | 数据来源、转换命令 |
| [词库数据结构](docs/教材词库数据结构.md) | JSON/CSV 字段 |
| [功能实现说明](docs/听写跟读功能实现说明.md) | 实现要点与范围变更 |
| [Bug：词库版本与预备单元](docs/bug-词库版本与预备单元.md) | 误用旧课标、缺少 Welcome Unit |
| [Bug：单元默认全选](docs/bug-单元默认全选.md) | 换册默认不选单元 |
| [Bug：手机无声音](docs/bug-手机点击无声音.md) | 移动端发音问题 |
| [Bug：英文秒出中文不行](docs/bug-英文秒出中文不行.md) | 中英 TTS 差异（中文功能已不做） |
| [代码审查：问题与解决方案](docs/code-review-2026-07-16.md) | 审查 11 项及已落地修复 |
| [代码审查第二轮](docs/code-review-2026-07-16-r2.md) | 缓存/折叠等增量审查 |
| [Bug：去掉导入与选择缓存](docs/bug-去掉导入与选择缓存.md) | 取消导入；记住教材/单元 |
| [用户需求与变更记录](docs/用户需求与变更记录.md) | 功能增减 / 修 bug / 协作要求总表 |
| [功能：默写模式](docs/功能-默写模式.md) | 藏英文 / 音标，开关缓存 |
| [功能：输入默写判对错](docs/功能-输入默写判对错.md) | 列表每词输入、本地判对 |
| [方案：输入默写判对错](docs/方案-输入默写判对错.md) | 为何不需要后端、规则说明 |
| [方案：中文音频预生成](docs/方案-中文音频预生成.md) | **已搁置**，当前不实现 |

## 版权说明

- **本仓库软件代码**（应用、脚本、文档中的原创部分）：见下方 **MIT 许可证**，可自由使用、修改与再分发。  
- **内置词库数据**：转换自社区整理的人教 2019 词表 xlsx，**教材与词表版权归人民教育出版社等权利人**。数据仅供学习与本工具演示；再分发或商用请自行评估合规，勿当作官方授权词库。  
- 第三方开源组件各自遵循其原许可证。

## 许可证

本项目源代码采用 [**MIT License**](./LICENSE) 开源发布。

```
MIT License — 详见仓库根目录 LICENSE 文件
```
