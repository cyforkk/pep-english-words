# Bug：手机点击无声音输出

> **相关专题**：若出现「英文秒出、中文不行」，见  
> [`docs/bug-英文秒出中文不行.md`](./bug-英文秒出中文不行.md)（中英文走不同在线源的根因说明）。

## 现象

手机浏览器点击「英」「中」或开始听写/跟读时没有声音。

## 原因

1. 系统 `speechSynthesis` 在 iOS / 部分 Android WebView 上依赖本地语音包，很多机型未安装中文语音。  
2. iOS 上 `cancel()` 后立刻 `speak()` 会静音。  
3. 浏览器自动播放策略：未在用户手势中解锁音频时，后续播放被拦截。  
4. 仅依赖 Web Speech 时，微信内置浏览器等环境经常失败且无明确报错。

## 修复

- 手机端优先使用 **HTMLAudio + 在线 TTS**（英文：有道；中文：百度；失败再试 Google）。  
- 桌面端仍优先系统语音，失败再在线。  
- `unlockSpeech()`：在 touch/click/pointerdown 中解锁。  
- 系统语音路径：`cancel` → 延迟 50ms → `speak` + `resume`。  
- 按钮失败时展示错误信息。

## 验证

1. 手机访问 `npm run dev:host` 的局域网地址。  
2. 关闭静音，调高**媒体音量**（不是铃声音量）。  
3. 点单词「英」「中」应能出声。  
4. 点「听写」应能连续念中文。

## 后续：显示「不支持系统语音合成」

### 现象

页面提示「不支持系统语音合成」或类似文案，仍无声音。

### 原因

1. 在线 TTS 先失败（网络/接口），代码再回退系统语音。  
2. 手机浏览器（尤其微信内置）常**没有** `speechSynthesis`。  
3. 最终只抛出系统语音错误，**掩盖了在线失败的真实原因**。  
4. iOS 上 `cancel` 后延迟 `speak`、以及失败后换源再 `play()`，容易丢掉用户手势导致 `NotAllowedError`。

### 再修复

- 合并错误信息：同时展示在线失败原因 + 浏览器是否有系统语音。  
- 系统 TTS：未在播放时**立即 speak**（保留手势）；仅 cancel 时才短延迟。  
- 在线 TTS：增加百度 `gettts`、多种 `text2audio` 参数与有道中文源。  
- 引导：联网、媒体音量、Safari/Chrome、再点一次。

## 再后续：源1超时 + play() can only be initiated by a user gesture

### 现象

```
在线发音失败（源1超时；play() can only be initiated by a user gesture.）
| 当前浏览器无系统语音接口
```

### 原因

1. 第一个在线音源 6s 超时后，代码创建new Audio** 播第二个源。  
2. 此时已脱离用户点击手势，浏览器拒绝 `play()`。  
3. 该浏览器又没有 `speechSynthesis`，只能报错。

### 修复

1. **全局唯一 HTMLAudioElement**，在 pointerdown/touchstart 用手势播静音片解锁。  
2. 之后所有发音只改 `src` + `play` 同一实例（听写连续播也走这条链）。  
3. 换源在同一 Audio 上完成；「未开始播放」3.5s 换源，「已开始」等到 ended。  
4. 按钮 `onPointerDown`/`onTouchStart` 同步 `unlockSpeech()`。

## 若仍无声

- 用系统 **Safari / Chrome** 打开，不要用微信右上角内置浏览器。  
- 必须联网（有道/百度在线发音）。  
- 关静音，调**媒体音量**。  
- 先点页面一下，再点「英」或「中」。  
- 电脑执行 `npm run dev:host` 后手机强刷缓存。
