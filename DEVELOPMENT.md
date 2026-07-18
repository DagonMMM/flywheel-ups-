# 开发流程（DEVELOPMENT）

> 飞轮储能 UPS 系统展示网站 · 天印制造团队
> 最后更新：2026-07-18

## 部署

- 托管：GitHub Pages，源为 `main` 分支根目录
- 线上地址：https://dagonmmm.github.io/flywheel-ups-/
- `main` 合并后 1~2 分钟自动部署，浏览器需 Ctrl+F5 强刷绕过缓存
- 纯静态站，无构建步骤；本地预览直接双击 `index.html`

## 目录与副本

| 位置 | 用途 |
|------|------|
| GitHub `main` | 唯一权威版本，只接受 PR 合并，不直接 push |
| `桌面\claude\flywheel-ups-website` | 本地开发副本（git 仓库，已同步 main） |
| Kimi 工作区副本 | AI 协作改动的工作区，改动经 PR 回流 main |

## 标准改动流程

1. 在本地副本修改，双击 `index.html` 预览确认
2. 建分支：功能 `feature/xxx`，修复 `fix/xxx`，文档 `docs/xxx`
3. 提交并推送，开 PR（base `main`）
4. 审阅后用 **squash 合并**，保持 main 历史干净
5. 等待 Pages 部署，线上强刷验收

## 网络与推送注意事项

- 本机直连 github.com 可能被重置，git 操作挂代理：
  `git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 <命令>`
  （端口 7890 为本机 Clash 代理，需保持开启）
- 图片等二进制文件只能通过 git 提交，不能走纯文本 API 通道（会被存成文本导致裂图）

## 图片规范

- 目录：`images/`，命名 `avatar-<姓名拼音>.<ext>`、`<用途>-<描述>.png`
- 头像：方形头肩特写，384×384，人物居中，JPEG q85~88 或 PNG，单张 < 150KB
- 插图：宽度 ≥ 1000px，白底图配 `.figure-frame` 相框（见 `css/style.css` 第 12 节）
- 原始高清照片（>1MB）不入库，已在 `.gitignore` 忽略

## 代码结构

```
index.html      # 单页全部区块（导航 + 12 sections + 页脚）
css/style.css   # 全站样式：基础主题 → Visual Polish → 插图相框 → 拓扑图
js/main.js      # 交互：粒子背景 / 3D 倾斜 / 飞轮模拟器 / 打字机等
js/charts.js    # 性能测试 4 张 Chart.js 图表（论文数据）
js/live-monitor.js  # 实时监控：MQTT over WebSocket 订阅 + 实时曲线 + 报警
images/         # 头像与插图
```

## 实时监控数据源

- 协议：MQTT over WebSocket（MQTT.js），默认 broker `wss://broker.emqx.io:8084/mqtt`
- 主题：`flywheel/FW001/status`（1 秒/帧 JSON）、`flywheel/FW001/alarms`
- 数据格式见 `js/live-monitor.js` 头部注释；上位机项目 `flywheel_monitor` 为数据生产端
- 浏览器端请使用只读 MQTT 账号 + TLS

## 样式约定

- 暗色工业风：背景 `#1a1c1e`，卡片 `#25282c→#1f2226` 渐变，铜色 `#d4874a` 强调
- 新视觉规则追加到 `style.css` 末尾对应分节，不改既有规则
- JS 依赖的 id / class（见各 JS 文件头部）不可删除或重命名
