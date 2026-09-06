# 原创微信人生重开小游戏（工作项目）

你是一名轮回者。每次开局都会从出生附近开始体验一段新的人生。你经历了什么，影响你怎样回应；而新的回应，又会改变你对往事和自己的理解。

## 当前阶段

首个 Cocos Creator MVP 之后，当前核心是 **经历碎片、人生点与可追溯的理解**。正式名称仍待确定。

核心体验是：**经历会留下，理解可以改口，事实不会被覆盖。**

当前版本包含：

- Cocos Creator 3.8.8 竖屏工程与运行场景。
- 开局由家庭和先天气质留下光环、行囊或负累；取消天赋抽选和传承配装。
- 自由模式已按新规则完整重做：每世约 5—10 分钟、6—8 次关键遭遇、两次回望。
- 三个主题共 24 个关键遭遇模板（信任、归属、被需要，外加跨主题事件）。
- 人生点开局 2、上限 4；突破惯常反应花 1 点，主动争取机会花 2 点；零点仍可继续。
- 经历碎片区分事件来源和心理联想；回望可坚持、修正或存疑。
- 自动归档；下一世最多携带两条理解或疑问及其来源。
- 无图片素材的 2.5D 卡通矢量界面：遭遇场景、人物年龄特征，以及可展开的短叙事。
- v3 本地自动存档、旧三键清理、退出续玩，以及点数/回望/归档的重复提交保护。
- 历史模式入口隐藏；人物原文和相关美术保留为未启用内容。

## 运行

### Cocos Creator

已安装 Cocos Creator `3.8.8` 时，可在项目根目录一键启动：

```powershell
npm run cocos
```

启动脚本会读取 `package.json` 中声明的 Creator 版本，自动寻找匹配的编辑器并打开当前工程。也可以直接运行 `./scripts/cocos/start.ps1`，或通过 `-CreatorPath` 指定编辑器路径。

1. 等待编辑器完成资源导入。
2. 打开 `assets/scenes/main.scene`。
3. 点击“浏览器预览”即可游玩 Web 版本。
4. 在“项目 → 构建发布”中选择“微信小游戏”，即可生成微信开发者工具可打开的构建目录。

项目界面由 `GameApp.ts` 调度、`ui/` 运行时绘制，无需在编辑器中手工绑定节点或按钮。

### Release 构建

已提供无需打开 Creator 界面的统一 Release 脚本。默认先做 TypeScript 校验，再依次生成 Web Mobile 与微信小游戏工程：

核心规则和自动化测试可以只靠 Node.js 开发；场景导入、引擎打包以及 Web/微信 Release 产物生成仍需要本机安装与项目匹配的 Cocos Creator 3.8.8。

```powershell
npm run build:release
```

也可以只构建一个目标：

```powershell
npm run build:web
npm run build:wechat
```

产物分别位于 `build/web-mobile/` 和 `build/wechatgame/`。脚本固定使用非 Debug、关闭 Source Map、开启 MD5 缓存的发布配置，并只保留本项目实际使用的 2D UI、Graphics 与渲染模块；同时检查 Creator 版本、退出码和关键产物。Cocos Creator 3.8 的成功退出码为 `36`，脚本已兼容处理。

Web 包应通过 HTTP/HTTPS 静态服务访问，不要直接双击 `index.html`；微信包可在微信开发者工具中直接导入 `build/wechatgame/`。

微信 AppID 可通过参数或环境变量传入：

```powershell
npm run build:wechat -- -WechatAppId 'wx0123456789abcdef'

$env:WECHAT_APP_ID = 'wx0123456789abcdef'
npm run build:wechat
```

未传 AppID 时仍可生成供本地检查的微信小游戏工程，但不能作为正式预览或上传版本。该脚本只生成本地产物，不会登录微信平台、上传代码或提交审核；正式发布仍需使用对应小游戏的 AppID、微信开发者工具账号及后台权限。

Cocos 相关启动、构建脚本和版本化配置统一保存在 `scripts/cocos/`，生成的产物、临时配置和日志不进入版本库。

### 核心逻辑验证

```powershell
npm install
npm test
```

测试不依赖 Cocos 编辑器，覆盖内容校验、经历改变回应、后果差异、理解修订、人生点与重复提交、归档去重、因果追溯、待决重载、旧存档三键清理，以及 1000 局确定性模拟。

## 产品与设计文档

当前产品定位、完整业务流程和实现架构统一维护在 [Game_Design.md](Game_Design.md)。

已确认并完成实施的玩法重构见 [玩法重构计划](GAMEPLAY_REFACTOR_PLAN.md)。视觉分层与 2.5D 场景仍以 [UI 改造计划](UI_REDESIGN_PLAN.md) 为准，其中要求保留旧玩法入口的条款不再适用。

## 原创边界

本项目的源代码、事件文本、数值、名称、界面和素材均独立设计与实现。

开发工具和类型检查依赖见 [第三方声明](THIRD_PARTY_NOTICES.md)。项目当前不包含第三方事件文本或美术素材。
