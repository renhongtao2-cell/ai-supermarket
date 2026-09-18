// extract-free-blocks.mjs — 抽取「免费档区块」原文，供人工判定
//
// 为什么不沿用「数字+单位」匹配：那是猜数字，实测误命中率高（付费档、价格行、口碑数字）。
// 更可靠的做法是**锚定免费档的标题**（Free $0 / Free forever / Always free），
// 取其后的正文块 —— 厂商自己把免费档写了什么，就照抄什么。
//
// 顺带作用：这些区块也能验证 freePlan/freeForever 信号本身对不对。
//
// 用法：node scripts/extract-free-blocks.mjs [--limit N] [--len N]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_DIR = path.join(ROOT, ".workbuddy", "free-tier-text");
const FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-facts.json"), "utf8")
).facts || {};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = new Set(
  fs.readdirSync(TEXT_DIR).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/\.txt$/, ""))
);

const args = process.argv.slice(2);
const li = args.indexOf("--limit");
const limit = li > -1 ? parseInt(args[li + 1], 10) : 999;
const ni = args.indexOf("--len");
const LEN = ni > -1 ? parseInt(args[ni + 1], 10) : 320;

// 免费档标题的常见写法
const FREE_HEAD =
  /(free\s*\$?\s*0(?:\.00)?\s*(?:\/|\s*per\s*)?\s*(?:month|mo)?|free\s*forever|always\s*free|\$0\s*\/\s*(?:month|mo)|free\s*plan|starter\s*(?:plan)?[^a-z]{0,12}always\s*free|plan\s*:\s*free)/gi;

const targets = Object.entries(FACTS).filter(
  ([, v]) => (v.freePlan || v.freeForever) && !v.freeQuota
);

console.log(`待挖：${targets.length} 个工具\n`);

let shown = 0;
for (const [name, v] of targets) {
  if (shown >= limit) break;
  const s = slug(name);
  if (!files.has(s)) continue;
  const txt = fs.readFileSync(path.join(TEXT_DIR, s + ".txt"), "utf8").replace(/\s+/g, " ");

  FREE_HEAD.lastIndex = 0;
  const blocks = [];
  let m;
  while ((m = FREE_HEAD.exec(txt)) !== null) {
    blocks.push({ at: m.index, head: m[0], body: txt.slice(m.index, m.index + LEN) });
    if (blocks.length >= 3) break;
  }
  if (!blocks.length) continue;

  console.log("=".repeat(74));
  console.log(`${name}   [信号: ${Object.keys(v).join(", ")}]`);
  // 只展示第一块（通常就是定价表里最靠前的免费档）
  console.log(`  ▸ 锚点「${blocks[0].head}」`);
  console.log(`    ${blocks[0].body}`);
  if (blocks[1] && blocks[1].at - blocks[0].at > 400) {
    console.log(`  ▸ 另一处「${blocks[1].head}」`);
    console.log(`    ${blocks[1].body}`);
  }
  console.log();
  shown++;
}
console.log(`共输出 ${shown} 个工具`);
