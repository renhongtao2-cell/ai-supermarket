// cf-deploy.js — 部署 AIchaoshi 的两个站点到 Cloudflare Pages
//
// 用法：
//   node .workbuddy/cf-deploy.js                  # 目录站 → ai-supermarket (ai.toolboxes.top)
//   node .workbuddy/cf-deploy.js --site=tools     # 工具站 → toolboxhub (toolboxes.top / www)
//   CF_PROJ=<name> node .workbuddy/cf-deploy.js   # 覆盖目标 Pages 项目
//
// 安全红线：绝不部署项目根目录。wrangler pages deploy 会上传整个目录且不认 .assetsignore，
// 历史上曾把 .workbuddy/cf.env（明文 CF token）公开到线上。只部署白名单 staging 目录。
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Auto-load credentials from gitignored .workbuddy/cf.env when env vars are unset
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  try {
    for (const line of fs
      .readFileSync(path.join(__dirname, "cf.env"), "utf8")
      .split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      if (m[1] === "CF_TOK" && !process.env.CLOUDFLARE_API_TOKEN)
        process.env.CLOUDFLARE_API_TOKEN = m[2];
      if (m[1] === "CF_ACC" && !process.env.CLOUDFLARE_ACCOUNT_ID)
        process.env.CLOUDFLARE_ACCOUNT_ID = m[2];
    }
  } catch (e) {}
}

const siteArg = process.argv.find((a) => a.startsWith("--site="));
const SITE = siteArg ? siteArg.split("=")[1] : "catalog";
const IS_TOOLS = SITE === "tools";

const DEFAULTS = { catalog: "ai-supermarket", tools: "toolboxhub" };
const PROJ = process.env.CF_PROJ || DEFAULTS[SITE] || DEFAULTS.catalog;

const ROOT = path.join(__dirname, "..");
const WRANGLER =
  process.env.WRANGLER_BIN ||
  "C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/wrangler/bin/wrangler.js";

// Pre-deploy auto-sync. Running these by hand was the #1 source of drift:
// every time data.js gained tools, index.html counts / ItemList / llms.txt went stale.
function autoSync(name, args) {
  try {
    execSync(`node scripts/${name}${args ? " " + args : ""}`, { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.warn(`${name} failed (continuing deploy):`, e.message);
  }
}

(async () => {
  if (IS_TOOLS) {
    // 工具站：重新生成 + 跑核心逻辑测试（测试失败则中止，避免发布坏逻辑）
    autoSync("gen-toolsite.mjs");
    try {
      execSync("node scripts/test-toolsite.mjs", { cwd: ROOT, stdio: "inherit" });
    } catch (e) {
      console.error("工具站核心逻辑测试失败，中止部署。");
      process.exit(1);
    }
  } else {
    // 目录站：SEO/GEO 数据同步
    autoSync("regen-seo-blocks.mjs");
    autoSync("gen-llms.mjs");
    try {
      execSync("node scripts/version-assets.mjs", { cwd: ROOT, stdio: "inherit" });
    } catch (e) {
      console.warn("version-assets.mjs failed, deploying without refresh:", e.message);
    }
  }

  // 构建干净 staging 目录（白名单 + 安全自检）
  const stageArg = IS_TOOLS ? "--site=tools" : "";
  execSync(`node scripts/prepare-deploy-dir.mjs ${stageArg}`.trim(), { cwd: ROOT, stdio: "inherit" });

  const STAGE = path.join(ROOT, IS_TOOLS ? ".deploy-tools" : ".deploy");

  execSync(
    `"${process.execPath}" "${WRANGLER}" pages deploy "${STAGE}" --project-name=${PROJ} --branch=main --commit-dirty=true`,
    { cwd: ROOT, stdio: "inherit", env: process.env }
  );
})();
