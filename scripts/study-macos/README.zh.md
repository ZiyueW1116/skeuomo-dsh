# 深潜书桌

[English](README.md) | 中文

深潜书桌是 DeepSeek Harness 的三维手写界面。它使用桌前透视、实体网格、纸张纹理、黄铜关节和真实投影；整个客户区由同一个 Three.js 场景构成。视觉起点是 [DEsk](https://github.com/fyzugx/DEsk)，场景模型由本项目生成。

## 打开

双击仓库旁的「深潜书桌.app」。应用在回环地址启动真实 Harness，关闭窗口时结束自己启动的服务。应用依赖构建时的源码目录、依赖和 Node.js，请保留目录。它使用 `~/.dsh` 的 Web profile，与 Harness 共享会话和凭据库。Web 与 Desktop profile 的服务商和默认模型配置独立；已有 Key 的服务商仍需在 Web profile 中注册，并选为当前模型。

## 书桌操作

- 轻触左页开始输入，压下右侧「交稿」杆发送；也可按 Command+Enter。输入和回信时自动靠近纸面，回信结束后保留近景；Esc 或点击空桌面恢复坐姿。
- 右页接收真实会话内容。机械臂的笔尖沿中文笔顺、拉丁字母轨迹留下墨迹。
- 失败原因立即显示在右页，不经过笔顺动画；左页同步显示当前运行状态。
- 「停」键中止当前请求并提笔，已有文字保留。底部拨片翻阅长手稿。
- 「往来书信」逐封翻阅历史；下方拨片换卡，轻触簿内纸页打开选中的会话。
- 「书桌登记簿」填写 DeepSeek API Key 与工作目录。轻触纸面填写凭据，
  Tab 切换目录；拨片选择模型，按下「记入」铜扣保存。再次触碰登记簿将其合上。
- 取用桌前的「另起一页」信纸会新建会话。「试笔」仅演示书写，不调用模型。
- 台灯开关控制桌面照明，书写仪底座切换笔速，滚轮靠近或远离纸面。
- 待授权操作显示为签批纸，使用「同意」或「拒绝」章；问笺在左页逐行作答。

## 构建与验证

```sh
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
python3 scripts/study-macos/build.py
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/study-desk.e2e.ts
pnpm exec vitest run --config vitest.web.perf.config.ts apps/web/tests/study-render.perf.ts
```

macOS 构建需要 Xcode Command Line Tools，使用系统 WebKit 与本机开发签名，未经 Apple 公证。移动源码后需要重新构建。浏览器验证使用隔离工作区和回放模型，通过真实 Harness 消息流测试，真实在线回复仍需有效凭据。

## 源码

`packages/client/ui-chat/src/client/study` 包含场景、物件、笔顺和会话适配。`ui-layout` 将客户区交给 `main.study`；传统侧栏和弹窗层不挂载。`apps/web/public/study` 包含本地字体、笔顺数据及许可证，不依赖外部字体服务。

场景合并静态网格，使用单次 WebGL 渲染及按需更新的阴影；设备像素倍率上限为 1.5。纸面纹理更新不生成 mipmap，笔划轨迹每笔只计算一次。性能诊断输出固定窗口下连续书写的帧率、帧间隔和 JavaScript 堆占用。

中文字体为 Ma Shan Zheng，采用 OFL；笔顺数据来自 Hanzi Writer Data /Make Me a Hanzi，采用 Arphic Public License。数据与原始许可证随应用保存。
