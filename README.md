# 教材单词听写 · 跟读

轻量**纯前端**英语单词工具：选教材与单元，中/英点读，**中文听写（纸笔默写）**，**英文跟读**。界面按**手机网页优先**适配。

无需后端账号，打开即用；设置与导入词表保存在浏览器本地。

## 功能

- **教材 / 单元**：多单元勾选，合并单词列表  
- **打乱单词**：一键打乱列表顺序 / 恢复原顺序（听写跟读按当前列表）  
- **点读**：每词「英」「中」大按钮分别发音  
- **中文听写**：念中文 N 遍 → 间隔默写 → 下一词（可隐藏英文）  
- **英文跟读**：念英文 N 遍，显示中文提示  
- **可调参数**：语速、中文/英文重复遍数、词间隔、顺序或打乱  
- **导入词表**：JSON / CSV，本机 `localStorage` 持久化  
- **手机适配**：大触控区、单词卡片、播放中底部固定控制条  

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)。

### 手机访问（同一 Wi‑Fi）

```bash
npm run dev:host
# 或：npm run dev -- --host
```

用手机浏览器打开终端里显示的 **Network** 地址（如 `http://192.168.x.x:5173`）。

### 生产构建

```bash
npm run build
npm run preview
```

## 使用说明

1. 勾选教材单元（可全选）  
2. **点读**：在单词卡片点「英」「中」  
3. **听写**：调好语速 / 中文遍数 / 间隔 → 点「听写」→ 纸笔默写  
4. **跟读**：点「跟读」，跟读英文  
5. 自定义词表：点「导入词表」，选择 UTF-8 的 JSON 或 CSV  

> **提示**：听写依赖系统 TTS。手机若无中文/英文语音，请到系统设置安装对应语音包。

## 导入词表格式

详见 [docs/教材词库数据结构.md](docs/教材词库数据结构.md)。

**CSV 示例**（表头支持 `unit,en,zh` 或 `单元,英文,中文`）：

```csv
unit,en,zh
Unit 1,hello,你好
Unit 1,book,书
Unit 2,apple,苹果
```

**JSON 示例**：

```json
{
  "id": "my-book",
  "title": "我的教材",
  "units": [
    {
      "id": "u1",
      "title": "Unit 1",
      "words": [{ "en": "hello", "zh": "你好", "phonetic": "/həˈləʊ/" }]
    }
  ]
}
```

内置演示教材：`public/data/textbooks/demo-pep-sample.json`。

## 技术栈

| 项 | 说明 |
|----|------|
| 构建 | Vite |
| UI | React + TypeScript |
| 语音 | 浏览器 Web Speech API（`speechSynthesis`） |
| 存储 | localStorage（设置、导入教材） |

## 目录结构

```
learn_english_pj/
├── public/data/textbooks/   # 内置示例教材
├── src/
│   ├── components/          # 点读按钮等
│   ├── lib/                 # TTS、播放队列、导入、存储
│   ├── types/               # 教材与设置类型
│   └── App.tsx              # 主界面
├── docs/                    # 数据结构与实现说明
└── package.json
```

## 文档

- [教材词库数据结构](docs/教材词库数据结构.md)  
- [听写跟读功能实现说明](docs/听写跟读功能实现说明.md)  
- [Bug：手机点击无声音](docs/bug-手机点击无声音.md)  
- [Bug：英文秒出、中文不行（原因说明）](docs/bug-英文秒出中文不行.md)  

## 许可证

私有项目（`private: true`）。若需开源再补充 LICENSE。
