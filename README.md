# 原创微信人生重开小游戏（工作项目）

你是一名轮回者。每次开局都会从出生开始体验一段新的人生；本世结束后，根据寿命、经历和结局获得永久奖励，再带着轮回者的成长开启下一世。

## 当前阶段

首个 Cocos Creator MVP 与 v0.2 玩法闭环已经实现。当前核心是“关键人生选择 + 可构筑的轮回传承”，正式名称仍待确定。

核心体验是：**这一世可以失败，但不会白活。** 每次人生结束都会推进轮回等级，并为之后的人生带来永久奖励。

当前版本包含：

- Cocos Creator 3.8.8 竖屏工程与运行场景。
- 天赋抽取、选择和初始属性分配。
- 六个人生阶段、阶段志向，以及遇到选择必停的“快进至抉择”。
- 10 项原创天赋、5 类家庭、46 项原创事件（含 14 项关键抉择）和 10 个结局。
- 能在数年后产生回响并可追溯来源的选择事件链。
- 人生评价、轮回经验、6 个轮回等级，以及五类共 15 项轮回传承。
- 永久传承装配、传承升阶、下一世祝福、事件改写、预见和保护类能力。
- v2 本地自动存档、v1 迁移、退出续玩和经验/传承双重防重复发奖。
- 无图片素材的文字与矢量界面。

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

项目界面由 `GameApp.ts` 在运行时创建，无需在编辑器中手工绑定节点或按钮。

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

测试不依赖 Cocos 编辑器，覆盖确定性随机、阶段志向、关键选择、后续回响、结局、三选一传承、重复结算保护、存档迁移和 1000 局完整模拟。

## 产品与设计文档

当前产品定位、完整业务流程和实现架构统一维护在 [Game_Design.md](Game_Design.md)。

## 原创边界

本项目的源代码、事件文本、数值、名称、界面和素材均独立设计与实现。

开发工具和类型检查依赖见 [第三方声明](THIRD_PARTY_NOTICES.md)。项目当前不包含第三方事件文本或美术素材。
