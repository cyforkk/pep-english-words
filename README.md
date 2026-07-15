# 高中英语单词 · 点读跟读

轻量**纯前端**英语单词练习页：内置**人教版（PEP）2019 新教材**词库，按册/单元练习 **英文点读** 与 **英文跟读**。界面按**手机网页优先**适配。

## 当前范围

| 做 | 不做 |
|----|------|
| 英文点读（点「英」） | 中文语音输出 |
| 英文跟读（自动念英文） | 中文听写 |
| 人教 2019 七册词库 | 中文 mp3 预生成（方案已搁置） |
| 打乱 / 恢复列表顺序 | 账号 / 云同步 |
| 导入 JSON/CSV | |

中文释义**仅展示**，不朗读。

## 功能一览

- **词库**：必修第一～三册 + 选择性必修第一～四册（共 7 册）  
- **单元**：必修一含 **Welcome Unit · 预备单元** + Unit 1～5；其它册按课本主题切分（部分册为均分 Unit）  
- **选单元**：切换教材后**默认不勾选**，需自选或点「全选」  
- **点读**：单词卡片点「英」发音（有道在线，需联网）  
- **跟读**：按当前列表自动念英文，可看中文；底部栏暂停 / 下一词 / 停止  
- **打乱单词**：仅打乱当前已选单元的列表顺序，可恢复  
- **导入**：支持自定义词表（JSON / CSV）

## 快速开始

```bash
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

1. 将本仓库推送到 GitHub / GitLab / Bitbucket  
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

| 分册 | 文件 id |
|------|---------|
| 必修第一册（含预备单元） | `pep2019-compulsory-1` |
| 必修第二、三册 | `pep2019-compulsory-2` / `3` |
| 选择性必修第一～四册 | `pep2019-optional-1` … `4` |

数据目录：`public/data/textbooks/pep2019-*.json`、`index.json`。

### 重新从源转换

源词表：[lilinji/English](https://github.com/lilinji/English)（人教版目录下 2019 命名 xlsx）。

```bash
git clone --depth 1 https://github.com/lilinji/English.git tmp/lilinji/English
npm run convert:pep2019
```

- 单元按脚本内**起始词**切分（含预备单元），见 `scripts/convert-pep-2019.mjs`  
- **不要**使用 `npm run convert:pep`（旧课标 kajweb 转换，已废弃）

## 导入自定义词表

见 [docs/教材词库数据结构.md](docs/教材词库数据结构.md)。

**CSV（UTF-8）：**

```csv
unit,en,zh
Welcome Unit,exchange,交换；交流
Unit 1,teenager,青少年
```

**JSON：** 根对象含 `id`、`title`、`units[]`，单元内 `words: [{ en, zh, phonetic? }]`。

## 技术栈

| 项 | 说明 |
|----|------|
| 构建 | Vite |
| UI | React + TypeScript |
| 词表转换 | Node + `xlsx` |
| 英文发音 | 在线 TTS（有道等）+ 系统语音回退 |
| 存储 | localStorage（设置、用户导入词表） |

## 目录结构

```
learn_english_pj/
├── public/data/textbooks/     # 2019 词库 JSON + index
├── scripts/
│   ├── convert-pep-2019.mjs   # 2019 词库转换（使用这个）
│   └── convert-pep-gaozhong.mjs  # 旧课标，勿用
├── src/
│   ├── App.tsx
│   ├── components/
│   ├── lib/                   # tts、播放队列、导入、存储
│   └── types/
└── docs/                      # 词库说明、bug 记录、方案归档
```

## 文档

| 文档 | 内容 |
|------|------|
| [词库说明](docs/词库-人教版高中英语.md) | 2019 词库定位与分册 |
| [词库资源检索](docs/词库资源-检索记录.md) | 数据来源、转换命令 |
| [词库数据结构](docs/教材词库数据结构.md) | JSON/CSV 字段 |
| [功能实现说明](docs/听写跟读功能实现说明.md) | 实现要点与范围变更 |
| [Bug：词库版本与预备单元](docs/bug-词库版本与预备单元.md) | 误用旧课标、缺少 Welcome Unit |
| [Bug：单元默认全选](docs/bug-单元默认全选.md) | 换册默认不选单元 |
| [Bug：手机无声音](docs/bug-手机点击无声音.md) | 移动端发音问题 |
| [Bug：英文秒出中文不行](docs/bug-英文秒出中文不行.md) | 中英 TTS 差异（中文功能已不做） |
| [方案：中文音频预生成](docs/方案-中文音频预生成.md) | **已搁置**，当前不实现 |

## 版权说明

内置词库转换自社区整理的人教 2019 词表 xlsx，**仅供个人学习使用**；请勿当作官方教材资源再分发。版权归人民教育出版社等权利人所有。

## 许可证

私有项目（`private: true`）。
