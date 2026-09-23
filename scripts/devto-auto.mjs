// devto-auto.mjs — 无人值守：Dev.to 每日自动发布
//
// 链路：
//   1. node scripts/devto-publish.mjs            # 发 outputs/devto-*.md（幂等，已发的自动跳过）
//   2. node scripts/devto-publish.mjs --publish-drafts  # 把 RSS 导入进来的新草稿也发掉
//
// 自动化里用 `||` 串：第 1 步非 0 退出（key 失效 / 网络不通）会中断第 2 步，
// 避免「第 1 步连不上、第 2 步又把旧草稿发出去」的脏状态。
// 第 2 步本身幂等 —— 没新草稿就打印「草稿箱是空的」退出 0，不算失败。
//
// 用法：
//   node scripts/devto-auto.mjs              # 真跑
//   node scripts/devto-auto.mjs --dry-run    # 只看要发什么、不实际请求
//
// 配 RSS 自动导入（一次性，Dev.to UI 里点 5 分钟，API 不支持）：
//   dev.to/settings/extensions → 「Publishing from RSS」
//   - 填 feed：https://www.serpprism.com/feed.xml
//   - 勾「Mark the RSS source as canonical URL」
//   配好后，Dev.to 每抓一次 feed，新文章自动进**草稿箱**且 canonical 自动指回主站。
//   这个脚本的第二步把那些草稿批量发掉 —— RSS 管搬运，这里管发布，合起来才是全自动。
import { execFileSync } from "child_process";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DRY = process.argv.includes("--dry-run");

function run(label, args) {
  console.log(`\n${"=".repeat(50)}\n${label}\n${"=".repeat(50)}`);
  try {
    const out = execFileSync("node", ["scripts/devto-publish.mjs", ...args], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    return out;
  } catch (e) {
    console.error(`❌ ${label} 失败：${e.message}`);
    process.exit(1);
  }
}

const dryArgs = DRY ? ["--dry-run"] : [];
run("① 发 outputs/devto-*.md（幂等）", dryArgs);
run("② 把 RSS 导入的草稿也发掉（幂等）", ["--publish-drafts", ...dryArgs]);
console.log(`\n✅ Dev.to 自动发布完成${DRY ? "（--dry-run）" : ""}`);
