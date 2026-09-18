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
  "noCreditCard", "apiOnFree", "watermarkFree", "freeQuota",
];
// ⚠️ commercialUse 已移除（2026-09-18）：它是档位级信息，抽取却是整页级，必然出错。
// 实测 Framer AI 免费档页面明写 "Our Free plan is ideal for non-commercial use"，
// 却因 "non-commercial use" 含 "commercial use" 被判成「免费版可商用」并发布上线。
// Pika 同类（免费档 Not included，但同页付费档 Included）。详见 free-tier-audit.mjs 的 SIGNALS 注释。
const STRONG = ["freePlan", "freeForever", "noCreditCard", "apiOnFree", "watermarkFree", "trialDays"];

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
  published: 0, skipped: 0, quotaRaw: 0, quotaOk: 0, quotaDropped: 0, quotaFixed: 0, quotaVerified: 0, quotaUnverified: 0,
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
  // 以下 8 条为 2026-09-18 逐条人工复核（读原文上下文）后剔除：
  "HubSpot": { keys: ["freeQuota"], why: "1,000 messages 出自功能对比表，匹配处无 free 语境，无法确认属免费档" },
  "ClickUp Brain": { keys: ["freeQuota"], why: "10,000 credits 出自 '$10 per 10,000 credits' 的购买价，非免费额度" },
  "Regie.ai": { keys: ["freeQuota"], why: "5,000 credits 属 Pro $49/月 档（免费档另计）" },
  "Sudowrite": { keys: ["freeQuota"], why: "225,000 credits 属 $10/月 付费档，页面只提供 free trial" },
  // Framer AI 原在此列（15,000 credits 是最高档）。2026-09-18 用「免费档区块」抽取法
  // 拿到了真正的免费档原句「Free Try for free $0 500 AI credits to try」→ 已移入 VERIFIED_QUOTA。
  "Notion AI": { keys: ["freeQuota"], why: "1,000 credits 出自 '$10 per 1,000 credits' 的价格行，非免费额度" },
  "Julius AI": { keys: ["freeQuota"], why: "24,000 credits 属 Plus $16/月 档（且原文为 per year，被丢成一次性）" },
  "Bolt.new": { keys: ["freeQuota"], why: "无法核实：定价页是 SPA，浏览器抓取仍拿不到额度内容，'300,000 tokens' 在原文中不存在" },
  // 以下 3 条为 2026-09-18 第三批（定向短语复核）发现 —— 均为「只有 freeQuota、无免费档信号」的条目，
  // 这类条目一旦额度抽错，整条就是假的，必须逐条验：
  "Bardeen": { keys: ["freeQuota"], why: "'+100 credits/month' 挂在 Basic $10/月 付费档下，免费档额度未知" },
  "Stable Diffusion": { keys: ["freeQuota"], why: "同域误配：'1000 credits' 出自 stability.ai Brand Studio 的试用（Trial ends after credits used），非免费档；且原文另有 '1,000+ images per minute' 属 AWS Bedrock 案例" },
  // Pika：原排除理由成立；2026-09-18 用浏览器重抓定价页后有了更硬的证据 ——
  // 现价页免费档明写 "Free 0credits / month · packs only"（只能另买点数包），本无免费额度可发。
  // ⚠️ 这次重抓还暴露了一个更重要的教训：**旧缓存会过期**。旧缓存里 Pika 是
  // "80 monthly video credits / Basic" 的档位结构（Basic/Standard/Fancy），
  // 与现价页（Free/Starter/Creator/Fancy，900/3150/8550）完全对不上 ——
  // 我原本差点把「80 credits/月」加进去，那会是一条基于过期缓存的新错事实。
  // 结论：「对着缓存核实通过」≠「线上是对的」，高价值/易变的条目必须重抓确认。
  "Pika": { keys: ["freeQuota"], why: "'15 credits Free' 是 Pikaffects 单项特效计价表；且现价页免费档为 0 credits（packs only），本无免费额度" },
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
  // 原文："It includes 10 minutes of video per month, 9 stock avatars…"（免费档说明）。
  // 抽取器丢了周期。
  "Synthesia": "10 minutes per month",
  // 原文："The free plan includes a daily grant of 5 build credits (up to 30 a month), plus monthly grants
  // of 20 Cloud credits." 抽取器抓到的是同段里更小的子项「4 credits usable by AI features」，
  // 会让人误以为免费档只给 4 个额度 → 换成主额度。
  "Lovable": "30 build credits per month",
  // 原文定价页：Free $0 → "50 message credits/month"。抽取器抓到的 700 是 Hobby $40/月 档的值。
  "Chatbase": "50 message credits per month",
  // ——— 2026-09-18 第三批：值对了，但「性质」写错（一次性写成月度、试用写成常驻）———
  // "Free Free forever. ... $0 /month 125 credits 125 one-time credits ... Includes 125 credits (one time)"
  "Runway": "125 credits (one-time)",
  // "Free For simple projects and getting to know Gamma Start for free Free includes: 400 credits at signup"
  "Gamma": "400 credits (one-time)",
  // "Free $0/month Free forever Get Free Features: 5 projects ... 100 AI Tokens (one-time)"
  // 抽取器把 "Free forever" 归成了 "with no time limit"，读起来像项目永不过期 —— 改回档位名。
  "Kittl": "5 projects (free forever)",
  // "we offer a 7-day free trial with a limit of 2,500 words" —— 是试用上限，不是常驻免费档
  "Anyword": "2,500 words (7-day trial)",
  // "You get 10 credits to generate ads ... during your free trial" —— 同上
  "AdCreative.ai": "10 credits (7-day trial)",
  // "Check up to 2,000 words with 3 Free AI Scans Per Day" / "run up to 3 free AI scans daily"
  // 抽取器抓了「每次扫描的词数上限」，那才是限制项 → 换成真正的免费额度（每日扫描次数）。
  "Originality.ai": "3 AI scans per day (up to 2,000 words each)",
};

// 人工核实表：这些工具**有**免费档，但自动抽取稳定抓错（抓到付费档/对比表/营销文案）。
// 值由人工读厂商定价页确认，每条附证据原句，便于将来复核。
// 与 QUOTA_FIX 的区别：QUOTA_FIX 是「纠正已抽出的错值」，这里是「补上抽不出来的值」。
const VERIFIED_QUOTA = {
  // "All other seats (Collab, Dev, and View) and users on the Starter plan receive 500 credits/month."
  "Figma AI": "500 credits per month",
  // "Free £0.00/month ... Video generation: 3 videos per month, Videos up to 1 minute"
  "HeyGen": "3 videos per month",
  // "Free $0 per month Build for free ... 3 Projects in Studio 10k credits per month"
  // （抽取器此前抓到的是 Starter 档的 20 Projects，已剔除）
  "ElevenLabs": "10,000 credits per month",
  // 对比表："Starter / Always free / Minutes in Relaxed Queue: 10 Minutes"
  "LALAL.AI": "10 minutes",
  // "Free $0/month ... 7 message/day limit"
  "v0": "7 messages per day",
  // "Free Free forever $0/month ... Zap workflows, Tables, and Forms included (100 tasks per month)."
  "Zapier": "100 tasks per month",
  // "Free $0 For trying RegieGO before you commit. 250 credits to get started (one-time)"
  // （页面上另有 10,000 free credits 是限时优惠码 WELCOME10K，不是常驻免费档）
  "Regie.ai": "250 credits (one-time)",
  // "Lyro AI Agent conversations: Your first 50 conversations are free (lifetime)."
  "Tidio Lyro": "50 conversations (lifetime)",
  // "Free From $0 per month ... 100K tokens is enough to try 1 document in Genie."
  "Genie AI": "100,000 tokens",
  // "Free To test out the platform ... $0/mo 100/month Interaction Quota"
  "Convai": "100 interactions per month",

  // ——— 2026-09-18 第二批：改用「免费档区块」抽取法（scripts/extract-free-blocks.mjs）———
  // 不再猜数字，而是锚定免费档标题（Free $0 / Free forever / Always free），照抄厂商自己写的区块。
  // 下面每条都回原文核对过（.workbuddy/free-tier-text/<slug>.txt），证据原句见注释。
  // "Free Free forever, no CC required. $0/m ... Generate 10k characters per month"
  "Rytr": "10,000 characters per month",
  // "FREE $0 /month ex. tax. ... Fast Tokens 150 / day Token Bank 150"
  "Leonardo.Ai": "150 fast tokens per day",
  // "Plans Free Start building in Clay for free. ... 500 actions/mo ... 100 data credits/mo"
  "Clay": "100 data credits and 500 actions per month",
  // "Basic Free Forever $0 /mo ... Analyze 5 emails/month Personalize 5 emails/month"
  "Lavender": "5 emails per month",
  // "Reviews & UGC has a limited free plan (up to 50 monthly orders)"
  "Yotpo": "50 orders per month",
  // "Free Free Forever ... Free to use 1 Active Space 2 Users"
  "Matterport": "1 active space (2 users)",
  // "Free For individuals starting out $0 $0 Free forever ... 400 mins of storage/team 20 AI credits"
  "Fireflies.ai": "20 AI credits",
  // FAQ："The free plan typically provides access to basic features and a limited 10-minute voice generation time"
  "Murf AI": "10 minutes of voice generation",
  // "Free Try for free $0 500 AI credits to try Free Framer domain 1 GB bandwidth"
  "Framer AI": "500 AI credits (one-time)",

  // ——— 2026-09-18 第三批：这 4 条自动抽取的结果经定向复核后确认正确，一并纳入人工表 ———
  // 纳入的目的是「结构性收口」：见文件末尾的硬闸 —— 未进人工表的 freeQuota 一律不发布。
  // "Free Free for everyone $0 For students and hobbyists ... 2 projects 10 free templates"
  "Uizard": "2 projects",
  // "Free $ 0 /mo Up to 1,000 credits/mo ... Free includes: 1,000 credits/month"
  "Make": "1,000 credits per month",
  // "There's a free tier with 50 credits so you can explore image generation and public models"
  "Scenario": "50 credits",
  // "Seamless.AI is free for up to 50 credits." / 定价表 Free 档："1 User 50 Credits"
  "Seamless.AI": "50 credits",

  // ——— 2026-09-18 第四批：免费档区块法已挖干，改用「整页 free 语境 + 数字单位」宽扫 + 重抓确认 ———
  // 定价表原文："Basic For those who want to give it a try Free Get started ... 300 monthly transcription minutes"
  // 对比表佐证："Meeting & recording transcription monthly limit (no rollover) 300 minutes per user"
  "Otter.ai": "300 transcription minutes per month",
  // 定价页原文（Grow 档）："Keyword search Start for free 10K search requests /month included then $0.50 per additional 1K"
  // FAQ 佐证："What is included in the free tier of Algolia Grow and Grow Plus? … 10,000 Search Requests … 100,000 Records"
  "Algolia": "10,000 search requests per month",
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
  // 人工核实（补上抽取器抓不出来的值）
  if (VERIFIED_QUOTA[r.name]) { s.freeQuota = VERIFIED_QUOTA[r.name]; stats.quotaVerified++; }

  // 🚦 硬闸：freeQuota 只允许来自人工表（QUOTA_FIX / VERIFIED_QUOTA）。
  // 理由：实测自动抽取的额度错误率约 1/3 —— 数字来自付费档、价格行、口碑数，
  // 甚至压缩 JS 和电话号码（Bardeen 的 100 出自 `o.length>100`，Seamless.AI 的 50 出自 +1(614)665-0450）。
  // 额度是页面上最容易被用户当真的一句话，错一条的代价远大于少一条。
  // 要放开某条：先用 extract-free-blocks.mjs 取原文块人工确认，再写进 VERIFIED_QUOTA。
  if (s.freeQuota !== undefined && !QUOTA_FIX[r.name] && !VERIFIED_QUOTA[r.name]) {
    delete s.freeQuota;
    stats.quotaUnverified++;
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
console.log(`freeQuota: 自动 ${stats.quotaOk} / 丢弃 ${stats.quotaDropped} / 人工校正 ${stats.quotaFixed} / 人工核实 ${stats.quotaVerified} / 共 ${stats.quotaRaw}`);
console.log(`  ↳ 被硬闸拦下（未经人工核实的自动值）: ${stats.quotaUnverified}`);
if (stats.quotaUnverified > 0) {
  console.log("  ⚠️ 有自动值被拦下。若其中有确认无误的，请写进 VERIFIED_QUOTA（附原文证据）。");
}
const names = Object.keys(facts);
console.log("\nsample:");
names.slice(0, 10).forEach((n) => console.log("  " + n + " = " + JSON.stringify(facts[n])));
