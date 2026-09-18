// audit-quota-context.mjs — 用缓存原文逐条复核免费额度
//
// 为什么需要：抽取器会抓错行/错列。实测 39 条里 13 条错（好评数、存量客户用量、付费档、
// 帮助文档举例、竞品对比表、单位错配）。「离 free 近不近」不是有效判据
// （Predis.ai 的错误值距 free 仅 18 字符），只能读上下文。
//
// 精度要点：必须搜「数字+单位」完整短语。只搜裸数字会误命中
// （找 "3" 会匹配到 "33M Characters"）。
//
// 用法：
//   node scripts/audit-quota-context.mjs --all
//   node scripts/audit-quota-context.mjs "ElevenLabs" "Kittl"
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_DIR = path.join(ROOT, ".workbuddy", "free-tier-text");
const FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-facts.json"), "utf8")
).facts || {};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = fs.readdirSync(TEXT_DIR).filter((f) => f.endsWith(".txt"));

function textFor(name) {
  const s = slug(name);
  const f = files.find((x) => x.replace(/\.txt$/, "") === s);
  return f ? fs.readFileSync(path.join(TEXT_DIR, f), "utf8").replace(/\s+/g, " ") : null;
}

// 数字 → 允许逗号插入的正则片段：15000 → 1,?5,?0,?0,?0（同时匹配 15000 和 15,000）
function qtyPattern(qty) {
  const d = qty.replace(/,/g, "");
  return d.split("").map((c) => (/\d/.test(c) ? c : `\\${c}`)).join(",?");
}

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const targets = Object.entries(FACTS).filter(([n, v]) => {
  if (!v.freeQuota) return false;
  if (only.length) return only.some((o) => n.toLowerCase().includes(o.toLowerCase()));
  return true;
});

console.log(`复核 ${targets.length} 条\n`);

for (const [name, v] of targets) {
  const q = v.freeQuota;
  const unit = (q.match(/[a-z]+/i) || [""])[0];
  const qty = (q.match(/[\d][\d,.]*/) || [""])[0];
  console.log("=".repeat(74));
  console.log(`${name}  →  「${q}」`);

  const txt = textFor(name);
  if (!txt) { console.log("  (无缓存原文)\n"); continue; }

  // 找「数字 + 单位」的紧邻组合
  const re = new RegExp(`(${qtyPattern(qty)})\\s*(${unit}\\w*)`, "gi");
  const hits = [];
  let m;
  while ((m = re.exec(txt)) !== null) {
    hits.push({ i: m.index, len: m[0].length });
    if (hits.length > 12) break;
  }

  if (!hits.length) {
    console.log(`  ⚠️ 原文找不到「${qty} ${unit}」→ 来源不明\n`);
    continue;
  }

  for (const h of hits.slice(0, 3)) {
    const a = Math.max(0, h.i - 150);
    const b = Math.min(txt.length, h.i + h.len + 150);
    const ctx = txt.slice(a, b);
    const near = /free|trial|\$0|no cost/i.test(ctx) ? "附近有 free/trial 字样" : "⚠️ 附近无 free 字样";
    console.log(`  · ${near}`);
    console.log(`    …${ctx}…`);
  }
  console.log();
}
