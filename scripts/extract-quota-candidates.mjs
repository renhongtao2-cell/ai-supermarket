// extract-quota-candidates.mjs — 从缓存原文里提取「免费档额度」候选，供人工判定
//
// 与 audit-quota-context.mjs 的区别：
//   audit-*  = 验证「已抽出的值」对不对（守）
//   本脚本   = 从 free 语境里「找值」（攻），用于给还没有额度的工具补事实
//
// 判据：额度句必然同时具备 ①free/tier/plan 字样 ②数字+可数单位。
// 只输出这两者都命中的片段，避免把营销文案喂给人看。
//
// 用法：node scripts/extract-quota-candidates.mjs [--limit N]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_DIR = path.join(ROOT, ".workbuddy", "free-tier-text");
const FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-facts.json"), "utf8")
).facts || {};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = new Set(fs.readdirSync(TEXT_DIR).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/\.txt$/, "")));

// 有免费档信号、但还没有具体额度
const targets = Object.entries(FACTS).filter(
  ([, v]) => (v.freePlan || v.freeForever) && !v.freeQuota
);

const li = process.argv.indexOf("--limit");
const limit = li > -1 ? parseInt(process.argv[li + 1], 10) : targets.length;

// 额度句：数字 + 可数单位（不含 users/seats —— 那不是额度）
const QUOTA = /(\d[\d,.]*)\s*(credits?|tokens?|words?|characters?|messages?|generations?|images?|requests?|minutes?|hours?|projects?|videos?|exports?|scans?|pages?|conversations?|prompts?|queries?|runs?|tasks?|documents?|slides?|characters)\b/gi;
const FREEWORD = /free|trial|no cost|starter|basic|hobby/i;

console.log(`有免费档信号但缺具体额度：${targets.length} 个（本次处理 ${Math.min(limit, targets.length)}）\n`);

let shown = 0;
for (const [name, v] of targets) {
  if (shown >= limit) break;
  const s = slug(name);
  if (!files.has(s)) continue;
  const txt = fs.readFileSync(path.join(TEXT_DIR, s + ".txt"), "utf8").replace(/\s+/g, " ");

  // 找出所有「数字+单位」的位置，保留其中附近有 free 字样的
  const cands = [];
  let m;
  QUOTA.lastIndex = 0;
  while ((m = QUOTA.exec(txt)) !== null) {
    const a = Math.max(0, m.index - 160);
    const b = Math.min(txt.length, m.index + m[0].length + 160);
    const ctx = txt.slice(a, b);
    if (FREEWORD.test(ctx)) cands.push({ hit: m[0], ctx });
    if (cands.length >= 6) break;
  }
  if (!cands.length) continue;

  // 去重：同一个 hit 只留一次
  const seen = new Set();
  const uniq = cands.filter((c) => (seen.has(c.hit) ? false : seen.add(c.hit)));

  console.log("=".repeat(74));
  console.log(`${name}   [信号: ${Object.keys(v).filter((k) => k !== "name").join(", ")}]`);
  for (const c of uniq.slice(0, 2)) {
    console.log(`  ▸ 命中「${c.hit}」`);
    console.log(`    …${c.ctx}…`);
  }
  console.log();
  shown++;
}
console.log(`\n共输出 ${shown} 个工具`);
