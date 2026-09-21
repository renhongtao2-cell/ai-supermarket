# ⚠️ 这个目录是旧副本，不要在这里改

这里的文件是 **2026-09-17** 的快照，已经过时（例如 `worker.js` 缺少
`/.well-known/glama.json` 路由）。

## 真正在用的位置

| 用途 | 路径 |
|---|---|
| **MCP server 源码 / 部署源** | `E:\xiangmu\ai-tools-mcp\` |
| **公开仓库** | https://github.com/renhongtao2-cell/ai-tools-mcp |
| **上架指南（权威版）** | `E:\xiangmu\ai-tools-mcp\PUBLISHING.md` |
| **线上端点** | `https://ai-tools-mcp.toolboxes.top/mcp` |

## 为什么保留

没有脚本引用这个目录。保留只是防止误删历史 —— 但**任何修改都要去
`E:\xiangmu\ai-tools-mcp\`**。

改错文件会造成「改了但线上没变」的困惑。这个项目已经踩过一次同类坑
（部署白名单静默丢文件，见 `scripts/prepare-deploy-dir.mjs` 的守卫），不要再踩第二次。

## 如果你要找的是别的东西

- 字幕工具站源码 → `E:\xiangmu\AIchaoshi\scripts\gen-toolsite.mjs`
- 部署脚本 → `E:\xiangmu\AIchaoshi\.workbuddy\cf-deploy.js`
- 部署白名单 → `E:\xiangmu\AIchaoshi\scripts\prepare-deploy-dir.mjs`
