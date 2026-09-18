// build-free-tier-facts.mjs — 从审计结果里筛出「可发布」的免费额度事实
//
// 规则：
//   1. 丢矛盾信号（noCreditCard && creditCardRequired / watermarkFree && watermark）—— 宁缺勿错
//   2. freeQuota 的原始捕获是一段脏文本（含价格、换行、导航残留），
//      这里归一化成「数量 + 单位 + 周期」，例如 "2,000 minutes per month"。
//      归一化失败（没有数字/单位）就丢弃，绝不发布半截句子。
//   3. 发布门槛：至少一个强信号，或有明确的 freeTrial / 归一化成功的 freeQuota。
//
// 运行：node scripts/build-free-tier-facts.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const audit = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".workbuddy", "free-tier-audit.json"), "utf8")
);

const KEEP = [
  "freePlan", "freeForever", "freeTrial", "trialDays",
  "noCreditCard", "apiOnFree", "watermarkFree", "freeQuota", "commercialUse",
];
const STRONG = ["freePlan", "freeForever", "noCreditCard", "apiOnFree", "watermarkFree", "trialDays", "commercialUse"];

/* ---------- freeQuota 归一化 ---------- */
// ⚠️ 不要往单位里加 seats/users —— 那不是「免费额度」，是座位数或口碑数字。
// 实测误收：Predis.ai「3097 users」实为好评数（原文 "Rated 5/5 by 3097 Users"）、
// Brex「0 users per month」、Genie AI「1 user」、HouseCanary「1 user」、Beautiful.ai「3 users」。
const UNIT = /([\d][\d,.]*)\s*(credits?|tokens?|words?|characters?|messages?|generations?|images?|requests?|minutes?|hours?|projects?|videos?|exports?|scans?|pages?)/i;

function normalizeQuota(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  const m = t.match(UNIT);
  if (!m) return null;
  const qty = m[1].replace(/[.,]$/, "");
  const unit = m[2].toLowerCase().replace(/s$/, "");
  if (!qty || !unit) return null;
  // 数量必须是正整数。免费额度不会以 0 或小数给出，出现即说明抓错了：
  // 0 → 无意义（Brex）；18.6 → 价格残片（Kai 的「18.6 messages per week」实为存量客户用量统计）。
  if (!/^[\d,]+$/.test(qty)) return null;
  if (parseFloat(qty.replace(/,/g, "")) <= 0) return null;

  let period = null;
  if (/per\s*month|monthly|\/\s*mo\b|\/\s*month\b/i.test(t)) period = "per month";
  else if (/per\s*week|weekly|\/\s*week\b/i.test(t)) period = "per week";
  else if (/per\s*day|daily|\/\s*day\b/i.test(t)) period = "per day";
  else if (/forever|permanent|no\s*time\s*limit/i.test(t)) period = "with no time limit";
  else if (/per\s*account|per\s*user|per\s*seat/i.test(t)) {
    const u = t.match(/per\s*(account|user|seat)/i)[1].toLowerCase();
    period = `per ${u}`;
  }

  const plural = /^1$/.test(qty) ? unit : unit + "s";
  return period ? `${qty} ${plural} ${period}` : `${qty} ${plural}`;
}

/* ---------- 主流程 ---------- */
const facts = {};
const stats = {
  total: 0, cardContradiction: 0, watermarkContradiction: 0,
  published: 0, skipped: 0, quotaRaw: 0, quotaOk: 0, quotaDropped: 0, quotaFixed: 0,
  excluded: 0, excludedKeys: 0,
  byReason: { strong: 0, trialOnly: 0, quotaOnly: 0 },
};
const keyUnion = new Set();

// 人工排除清单：抽取器在这些条目上会出错，且原因明确 —— 宁缺毋滥。
// 每条都写清"为什么错"，将来条件变了可以复核。
const EXCLUDE = {
  // openai.com 是全库唯一一组「同域多工具」（DALL·E 3 → /dall-e-3，Sora → /sora）。
  // 抓取器从产品页跟到 openai.com/pricing，拿到的是 ChatGPT 免费档那一列，
  // 于是被错记成这两个产品有免费档 —— 实际它们只在付费档内提供。
  "DALL·E 3": { all: "openai.com 同域误配：抓到的是 ChatGPT 免费档那一列" },
  "Sora": { all: "同上：openai.com/pricing 的 Free 列属于 ChatGPT，非 Sora" },
  // AI Dungeon「免费可玩」属实，但 freeQuota 从 $14.99 附近误匹配出「14 images」，
  // 只丢错误的额度，保留 freePlan。
  "AI Dungeon": { keys: ["freeQuota"], why: "freeQuota 误匹配（14 images 来自 $14.99 附近）" },
  // 以下 6 条为 2026-09-18 复核发现：抽到的数字来自付费档 / 附加包 / 帮助文档 / 竞品对比，
  // 不是免费额度。复核方法与原文证据见 scripts/audit-quota-context.mjs。
  // 这些工具本身有免费档（freePlan 等信号保留），只是这个具体数字站不住 → 只丢 freeQuota。
  "Intercom Fin": { keys: ["freeQuota"], why: "2,000 credits 出自 $99/月 的 Pro 附加包，非免费档" },
  "Replit": { keys: ["freeQuota"], why: "60 projects 列在 Core $20/月 档位下，非免费档" },
  "Asana AI": { keys: ["freeQuota"], why: "5 requests 属 $10.99/用户/月 的付费档内容" },
  "Inworld AI": { keys: ["freeQuota"], why: "原文该处是竞品对比表，找不到免费额度语境" },
  "Apollo.io": { keys: ["freeQuota"], why: "10,000 credits 出自帮助文档「记录选择上限」举例，与免费额度无关" },
  "ElevenLabs": { keys: ["freeQuota"], why: "无依据：原文该处讲 12 个月资助计划，'3' 实为 '33M Characters' 的一部分" },
  "Topaz Video AI": { keys: ["freeQuota"], why: "200 credits 出自 $19/月 Creator 付费档，整页无 free/trial 语境（距离为「无」）" },
};

// 人工校正表：抽取器单位/数字抓错，但正确值能从原文确认 → 写正确值，而不是丢掉这条真事实。
const QUOTA_FIX = {
  // 原文（Copilot Free）："$0 USD per user / month ... What's included 2,000 completions per month"。
  // 抽取器把 completions 认成了 minutes —— 同页另有 GitHub Actions 的「2,000 CI/CD minutes/month」，
  // 属于另一个产品，被混进来了。
  "GitHub Copilot": "2,000 completions per month",
  // 原文："use our free-forever plan with 60 minutes of video processing time refreshed monthly"。
  // 抽取器把周期丢成 "with no time limit"（看到 free-forever 就归到无期限），
  // 但同一句写着 refreshed monthly → 实际是每月刷新。
  "Opus Clip": "60 minutes per month",
};

for (const r of audit.results) {
  stats.total++;
  const s = { ...(r.signals || {}) };
  Object.keys(s).forEach((k) => keyUnion.add(k));

  const ex = EXCLUDE[r.name];
  if (ex && ex.all) { stats.excluded++; continue; }
  if (ex && ex.keys) ex.keys.forEach((k) => { delete s[k]; stats.excludedKeys++; });

  // 丢矛盾：绑卡
  if (s.noCreditCard && s.creditCardRequired) {
    delete s.noCreditCard; delete s.creditCardRequired; stats.cardContradiction++;
  } else {
    delete s.creditCardRequired;
  }
  // 丢矛盾：水印
  if (s.watermarkFree && s.watermark) {
    delete s.watermarkFree; delete s.watermark; stats.watermarkContradiction++;
  } else {
    delete s.watermark;
  }

  // freeQuota 归一化
  if (s.freeQuota !== undefined) {
    stats.quotaRaw++;
    const norm = normalizeQuota(s.freeQuota);
    if (norm) { s.freeQuota = norm; stats.quotaOk++; }
    else { delete s.freeQuota; stats.quotaDropped++; }
  }

  // 人工校正（覆盖抽取结果；值已是最终形态，不再过归一化）
  if (QUOTA_FIX[r.name]) { s.freeQuota = QUOTA_FIX[r.name]; stats.quotaFixed++; }

  const keep = {};
  for (const k of KEEP) if (s[k] !== undefined && s[k] !== false && s[k] !== null) keep[k] = s[k];

  const hasStrong = STRONG.some((k) => keep[k]);
  if (hasStrong) { facts[r.name] = keep; stats.published++; stats.byReason.strong++; }
  else if (keep.freeTrial) { facts[r.name] = keep; stats.published++; stats.byReason.trialOnly++; }
  else if (keep.freeQuota) { facts[r.name] = keep; stats.published++; stats.byReason.quotaOnly++; }
  else stats.skipped++;
}

const out = {
  generatedAt: new Date().toISOString(),
  source: "free-tier-audit.json",
  disclaimer: "Auto-extracted from vendor pricing pages. Unverified. May be outdated or wrong.",
  facts,
};
fs.writeFileSync(
  path.join(ROOT, ".workbuddy", "free-tier-facts.json"),
  JSON.stringify(out, null, 2)
);

console.log("signal keys seen:", [...keyUnion].sort().join(", "));
console.log(JSON.stringify(stats, null, 2));
console.log(`published: ${stats.published} / ${stats.total}  (${Math.round(stats.published / stats.total * 100)}%)`);
console.log(`freeQuota 归一化: ${stats.quotaOk} 成功 / ${stats.quotaDropped} 丢弃 / ${stats.quotaFixed} 人工校正 / 共 ${stats.quotaRaw}`);
const names = Object.keys(facts);
console.log("\nsample:");
names.slice(0, 10).forEach((n) => console.log("  " + n + " = " + JSON.stringify(facts[n])));
