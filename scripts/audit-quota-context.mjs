// audit-quota-context.mjs — 用缓存的原始抓取文本复核免费额度是否真实
//
// 为什么需要：抽取器会从定价表里抓错行/错列 —— 实测抓到过好评数（"Rated 5/5 by 3097 Users"）、
// 存量客户用量（"18.6 messages Per user per week"）、付费附加包、竞品对比表。
// 重新抓一遍很贵，而 .workbuddy/free-tier-text/ 已存原文，直接查上下文最省。
//
// 核心判据：额度必须出现在 "free" 语境附近。离得越远越可疑。
//
// 用法：
//   node scripts/audit-quota-context.mjs --all          全部有额度的工具
//   node scripts/audit-quota-context.mjs --suspect      只看机械规则可疑的
//   node scripts/audit-quota-context.mjs "ElevenLabs"   指定工具
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEXT_DIR = path.join(ROOT, ".workbuddy", "free-tier-text");
const FACTS = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-facts.json"), "utf8")
).facts || {};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = fs.readdirSync(TEXT_DIR).filter((f) => f.endsWith(".txt"));

// 单位是座位/用户 → 不是额度；0 → 无意义；非整数 → 多为价格残片
function mechanical(name, q) {
  const r = [];
  if (/users?|seats?/i.test(q)) r.push("单位是座位/用户");
  const ns = (q.match(/[\d][\d,.]*/) || [""])[0];
  const n = parseFloat(ns.replace(/,/g, ""));
  if (n === 0) r.push("数量为 0");
  else if (!/^[\d,]+$/.test(ns)) r.push(`非整数(${ns})`);
  return r;
}

function textFor(name) {
  const s = slug(name);
  const f = files.find((x) => x.replace(/\.txt$/, "") === s);
  if (!f) return null;
  return fs.readFileSync(path.join(TEXT_DIR, f), "utf8").replace(/\s+/g, " ");
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const only = args.filter((a) => !a.startsWith("--"));

const targets = Object.entries(FACTS).filter(([n, v]) => {
  if (!v.freeQuota) return false;
  if (only.length) return only.some((o) => n.toLowerCase().includes(o.toLowerCase()));
  if (all) return true;
  return mechanical(n, v.freeQuota).length > 0;
});

console.log(`复核 ${targets.length} 条（判据：额度离 "free" 语境多远）\n`);

for (const [name, v] of targets) {
  const q = v.freeQuota;
  const mech = mechanical(name, q);
  const txt = textFor(name);
  console.log("=".repeat(72));
  console.log(`${name}  →  「${q}」`);
  if (mech.length) console.log(`  机械可疑：${mech.join(" / ")}`);
  if (!txt) { console.log("  (无缓存原文)\n"); continue; }

  const ns = (q.match(/[\d][\d,.]*/) || [""])[0];
  const cands = [ns, ns.replace(/,/g, "")].filter((x, i, a) => x && a.indexOf(x) === i);

  // 对每个出现位置，算到最近 "free" 的距离，取最近的那次
  let best = null;
  for (const c of cands) {
    let i = -1;
    while ((i = txt.indexOf(c, i + 1)) !== -1) {
      let d = Infinity;
      const re = /free|trial|no cost|complimentary/gi;
      let m;
      while ((m = re.exec(txt))) d = Math.min(d, Math.abs(m.index - i));
      if (!best || d < best.d) best = { d, i };
    }
  }
  if (!best) { console.log(`  ⚠️ 原文中找不到「${ns}」→ 来源不明\n`); continue; }

  const a = Math.max(0, best.i - 120);
  const b = Math.min(txt.length, best.i + 120);
  const verdict = best.d <= 250 ? "✓ 贴近 free 语境" : best.d <= 600 ? "? 偏近" : "⚠️ 远离 free 语境";
  console.log(`  ${verdict}（距最近的 free/trial: ${best.d === Infinity ? "无" : best.d} 字符）`);
  console.log(`  …${txt.slice(a, b)}…`);
  console.log();
}
