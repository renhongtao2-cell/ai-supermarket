# 上架指南 — AI Tools Directory MCP server

当前状态：

| 项 | 状态 |
|---|---|
| 端点 | `https://ai-tools-mcp.toolboxes.top/mcp`（已上线，36/36 自测通过） |
| `server.json` | ✅ 已通过官方 `mcp-publisher validate` |
| `mcp-publisher` | ✅ 已装到 `C:\Users\Administrator\.workbuddy-ai\bin\mcp-publisher\mcp-publisher.exe` |
| 公开仓库 | ⬜ 待你确认后创建（`E:\xiangmu\ai-tools-mcp` 已备好） |

---

## 为什么先发官方 Registry

Smithery 和 PulseMCP **都会自动从官方 Registry 抓取**。发一次，能级联到多个平台。这是性价比最高的一步，而且我们不需要发 npm 包（remote server 用 `remotes` 字段声明 URL 即可）。

---

## 第 1 步：官方 MCP Registry

需要你做**一次交互登录**（GitHub 设备码授权，我代替不了）。

```bash
cd E:\xiangmu\ai-tools-mcp
C:\Users\Administrator\.workbuddy-ai\bin\mcp-publisher\mcp-publisher.exe login github
```

会打印一个链接和一个形如 `ABCD-1234` 的码：打开 `https://github.com/login/device`，填码，授权。授权后回到终端看到 `Successfully logged in`。

然后：

```bash
C:\Users\Administrator\.workbuddy-ai\bin\mcp-publisher\mcp-publisher.exe publish
```

验证：

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.renhongtao2-cell/ai-tools-directory"
```

### 命名说明
`server.json` 里用的是 `io.github.renhongtao2-cell/ai-tools-directory`。官方规则：**GitHub 认证只能发布 `io.github.<你的用户名>/` 开头的名字**，所以这里必须是 `renhongtao2-cell`（你的 GitHub 用户名）。

如果将来想用 `com.toolboxes/...` 这种自定义域名前缀，需要改用 DNS 认证（加 TXT 记录 + Ed25519 密钥）。现在没必要。

---

## 第 2 步：Smithery

- 地址：<https://smithery.ai/new>
- 远程服务器要求 Streamable HTTP —— 我们符合
- **源码可以保持私有**，只要有公网可访问的端点
- 如果第 1 步发成功了，Smithery 可能会自动抓到；没抓到再用表单提交

表单填：

> **Name:** AI Tools Directory
> **URL:** https://ai-tools-mcp.toolboxes.top/mcp
> **Description:** Curated index of 221 AI tools across 21 industries. Search by use case, department or pricing tier.

---

## 第 3 步：Glama

- 地址：<https://glama.ai/mcp/servers>，用 "Add Server" 按钮
- 也可以通过 GitHub 登录验证身份，拿 "Author verified" 徽章
- 它会扫你的仓库，所以**建议第 1 步之后把公开仓库建起来**

---

## 第 4 步：MCP.so

- 地址：<https://mcp.so>，首页有提交表单
- 最大的目录（约 19,000 个），纯社区驱动，填表即可

---

## 第 5 步：Awesome MCP Servers（GitHub PR）

- 主仓库 <https://github.com/punkpeye/awesome-mcp-servers> **曾返回 404**，可能已迁移
- 备选：`appcypher/awesome-mcp-servers`、`wong2/awesome-mcp-servers`、`sammcj/awesome-mcp-servers`
- 需要公开仓库（列表本身就是链到公开 repo 的）
- PR 要求：加到对应分类、保持字母序、写简短描述

---

## 第 6 步（自动）

PulseMCP（<https://pulsemcp.com>）和 MCP Market 会从官方 Registry 自动抓取，**不用手动提交**。

---

## 通用文案（直接复制）

**短描述（≤100 字符，部分表单有长度限制）：**
```
Curated index of 221 AI tools across 21 industries. Search by use case, department or pricing tier.
```

**长描述：**
```
A curated, machine-readable directory of 221 AI tools across 21 industry departments,
exposed as a remote MCP server. AI assistants can search by use case, department or
pricing tier, look up a single tool, and find tools with a usable free tier.

Tools: search_ai_tools, get_ai_tool, list_departments, find_free_ai_tools, directory_stats.
No authentication required. Data maintained at https://ai.toolboxes.top
```

**连接示例（放表单里很有用）：**
```json
{
  "mcpServers": {
    "ai-tools-directory": {
      "type": "http",
      "url": "https://ai-tools-mcp.toolboxes.top/mcp"
    }
  }
}
```

---

## ⚠️ 对外描述时不要做的事

- **不要把「免费额度」说成已验证。** 那是正则自动抽取的，有已知误判（登录墙、免费版/付费版绑卡混淆）。对外文案里别提，或者明确标注 auto-detected。
- 目录本身（名称/URL/部门/定价档/描述）是可靠的，可以放心宣传。
- 服务端已经在 `instructions` 里强制要求 AI 声明该字段未验证，这是最后一道防线。

---

## 数据更新后重新发布

```bash
cd E:\xiangmu\ai-tools-mcp
# 改 server.json 里的 version（官方 Registry 要求版本号递增）
C:\Users\Administrator\.workbuddy-ai\bin\mcp-publisher\mcp-publisher.exe publish
```

服务端改了不用重新发布 —— Registry 只存元数据，指向的是固定 URL。

---

## 检查清单

- [ ] 创建公开 GitHub 仓库（把 `E:\xiangmu\ai-tools-mcp` 推上去）
- [ ] `mcp-publisher login github`（你做，需要浏览器授权）
- [ ] `mcp-publisher publish`
- [ ] 用 Registry API 验证能搜到
- [ ] Smithery 表单
- [ ] Glama Add Server
- [ ] MCP.so 表单
- [ ] Awesome MCP Servers PR（先确认主仓库还在不在）
- [ ] 顺手也加到自家的 `mcp.toolboxes.top` 目录（现成的，别浪费）
