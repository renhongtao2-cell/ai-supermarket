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
const UNIT = /([\d][\d,.]*)\s*(credits?|tokens?|words?|characters?|messages?|generations?|images?|requests?|minutes?|hours?|projects?|seats?|users?|videos?|exports?|scans?|pages?)/i;

function normalizeQuota(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  const m = t.match(UNIT);
  if (!m) return null;
  const qty = m[1].replace(/[.,]$/, "");
  const unit = m[2].toLowerCase().replace(/s$/, "");
  if (!qty || !unit) return null;

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
  published: 0, skipped: 0, quotaRaw: 0, quotaOk: 0, quotaDropped: 0,
  byReason: { strong: 0, trialOnly: 0, quotaOnly: 0 },
};
const keyUnion = new Set();

for (const r of audit.results) {
  stats.total++;
  const s = { ...(r.signals || {}) };
  Object.keys(s).forEach((k) => keyUnion.add(k));

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
console.log(`freeQuota 归一化: ${stats.quotaOk} 成功 / ${stats.quotaDropped} 丢弃 / 共 ${stats.quotaRaw}`);
const names = Object.keys(facts);
console.log("\nsample:");
names.slice(0, 10).forEach((n) => console.log("  " + n + " = " + JSON.stringify(facts[n])));
