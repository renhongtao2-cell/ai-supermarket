// build-free-tier-facts.mjs — 从审计结果里筛出「高置信」免费额度事实
// 规则：丢矛盾信号（noCreditCard && creditCardRequired / watermarkFree && watermark）
//      只保留至少一个强信号（freePlan/freeForever/noCreditCard/apiOnFree/watermarkFree/trialDays/commercialUse）
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

const facts = {};
const stats = { total: 0, cardContradiction: 0, watermarkContradiction: 0, published: 0, skipped: 0 };
const keyUnion = new Set();

for (const r of audit.results) {
  stats.total++;
  const s = { ...(r.signals || {}) };
  Object.keys(s).forEach(k => keyUnion.add(k));

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

  const keep = {};
  for (const k of KEEP) if (s[k] !== undefined && s[k] !== false && s[k] !== null) keep[k] = s[k];

  if (STRONG.some(k => keep[k])) { facts[r.name] = keep; stats.published++; }
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
console.log("published tools:", stats.published, "/", stats.total);
// 抽样
const names = Object.keys(facts);
console.log("sample:", names.slice(0, 8).map(n => `${n}=${JSON.stringify(facts[n])}`).join("\n        "));
