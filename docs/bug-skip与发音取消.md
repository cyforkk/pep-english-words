# 问题与解决：暂停后 skip 无效 / 播放中 skip 卡住

> 日期：2026-07-16  
> 相关：`src/lib/queue.ts`、`src/lib/tts.ts`、`src/lib/queue.player.test.ts`

---

## 问题 1：单测「暂停后 skip」期望 `done` 却得到 `paused`

### 现象

`WordPlayer` 在首词 `speak` 失败进入 `paused` 后调用 `skip()`，测试在 `waitFor` 超时后仍为 `paused`，未读到后续词。

### 根因

测试 mock 写乱：

1. `mockImplementationOnce` 让第 1 次 `speak` 抛错；
2. 随后又设了带 `call` 计数的 `mockImplementation`，其中 `call === 1` 再抛一次。

`mockImplementationOnce` **不占用** 计数实现的 call，于是：

- 第 1 次：once 抛错 → 暂停（call 仍为 0）
- skip 后第 2 次（词 `two`）：call 变为 1 → **再次抛错** → 又停在 paused

属测试问题，生产路径（失败后 skip 重进 `loop`）本身正确。

### 修复

- 只用一套 `mockImplementation` + `call` 计数；
- 补断言：失败后 `index === 0`，skip 后读到 `two`/`three`，不含失败的 `one`。

---

## 问题 2：播放中 skip / 暂停时，在线 TTS 的 Promise 可能挂起

### 现象

`cancelSpeak()` 会 `pause` 共享 `HTMLAudioElement` 并清掉 `onended`，但 **`playOneUrl` 的 Promise 既不 resolve 也不 reject**，队列 `await speak(...)` 一直卡住。

系统语音路径因 `interrupted`/`canceled` 会 resolve，桌面尚可；手机主路径走有道在线音，问题更明显。

### 根因

`cancelSpeak` 只动 Audio/合成器，没有通知当前 `playOneUrl` 的 settle 回调。

### 修复

1. `tts.ts`：维护 `activeOnlineSettle`；`playOneUrl` 注册，`cancelSpeak` 时 **resolve**（与系统语音 interrupted 一致），不 reject，避免被当成发音失败。
2. `queue.ts`：
   - `speak` 返回后再次检查 `forceNext` / `waitIfPaused`（pause/skip 打断后正确停或跳）；
   - 真实失败仍 `pause` + `onError`；
   - 已是 skip/paused 触发的异常不覆盖成「发音失败」。
3. 单测：覆盖「播放中 skip」。

---

## 验证

```text
npm test   # 13 passed（含 queue.player 4 条）
npm run build
```

---

## 变更文件

| 文件 | 说明 |
|------|------|
| `src/lib/tts.ts` | cancel 时 settle 在线播放 Promise |
| `src/lib/queue.ts` | skip/pause 与失败路径区分；speak 后检查 forceNext/paused |
| `src/lib/queue.player.test.ts` | 修正 mock；补播放中 skip |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 记录并修复 skip 测试 mock + 在线 cancel 挂起 |
