---
description: "三维书桌根界面、布局服务与主题呈现。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-layout

[English](README.md) | 中文

## 概述

本包在 Web GUI 客户区挂载三维书桌。已安装插件仍可使用 `ctx.layout`、面板注册和主题呈现服务。可见根组件只渲染 `study` 主入口；侧栏、底部栏和悬浮层仍有注册协议，但不挂载。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

书桌把消息绘入同一三维场景中的纸张。渲染器和交互适配位于 [ui-chat](../ui-chat/README.zh.md) 的 `src/client/study`。操作与启动方式见[本机应用指南](../../../scripts/study-macos/README.zh.md)。

`ctx.layout.selectPanel(id)` 仍验证已注册面板并为插件记录选择；书桌根组件始终保留三维场景。模型设置、历史书信和授权决定均通过纸面操作。

<a id="window-chrome-seat"></a>
### 窗口 chrome 座

macOS 书桌由原生外壳提供标准标题栏，Web 界面占据余下客户区。`shell.leading`、`shell.bottom` 和 `shell.overlay` 表面不挂载。

### 主题呈现

呈现器消费解析后的主题快照，并投影到 document：`html { color-scheme }` 驱动原生 UA 控件，依据当前配色方案设置 `body[data-ds-dark-theme]`，把主题的别名 token、`--dsh-content-font-size`、`--dsh-code-font-size`、`--dsh-terminal-font-size` 以及每个非空的 `--dsh-font-family-<role>` 列表设为 body 上的内联变量，并持有一个 `<meta name="theme-color">`，其内容随计算后的 body 背景色更新。对呈现器执行 dispose（资源释放）时，它会连同其他全局写入一起移除自己的元数据节点。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`selectPanel(id)` 在改变选中态前检查实时 `main` 注册表；缺失的 key 会抛错并保留当前面板。`beginNavigation()` 为异步 UI 导航返回 abort signal。后续调用、有效面板选择（包括重复选择）或布局释放会中止该 signal，但不取消底层会话创建。消费方在提交导航或搬移草稿前检查 signal。

根注册保留已安装插件消费的槽位声明，布局控制器与根 store 仍发布面板选择和几何状态。AppFrame 只渲染 `main` 中的 `study` key，不订阅栏宽。主题呈现器独立应用文档配色、字体变量和元数据。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

以下页面说明保留的插件协议与主题服务。

- [ui-sidebar](../ui-sidebar/README.zh.md)——占据 `sidebar` 栏及其座位。
- [ui-conversation](../ui-conversation/README.zh.md)——占据 `main` 中的 `conversation` key。
- [ui-sidebar-right](../ui-sidebar-right/README.zh.md)——以每会话一个停靠面占据 `rightbar` 栏。
- [ui-theme](../ui-theme/README.zh.md)——呈现器消费其解析快照的主题 seam。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——浏览器插件行如何加载并注册槽位。

-----

<a id="model-experience"></a>
## 模型体验

无。布局外壳管理浏览器查看状态；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 三维书桌需要 WebGL 2；硬件加速可提供流畅的书写动画。
- 传统插件面板仍有注册，但不由当前根组件呈现。
- 布局服务保留插件导航状态；可见书桌导航由书桌组件管理。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
