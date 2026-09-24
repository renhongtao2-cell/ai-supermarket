// hreflang 实地调查 —— 抓一批高流量站点的首页，看它们的 hreflang 注解到底怎么写的。
//
// 用途：为 SerpPrism 产出一篇「原创数据」型深度指南（与 open-graph-in-the-wild /
// robots-txt-in-the-wild 同系列）。
//   node scripts/survey-hreflang.mjs            # 抓取 + 统计
//   node scripts/survey-hreflang.mjs --report   # 只读上次落盘结果重抽（不联网）
//   node scripts/survey-hreflang.mjs --sample=5 # 打印 5 个站点的原始 link 行，人工核对
//
// 关注点（按「会不会静默出问题」排序）：
//   1. 声明了 ≥2 个 hreflang 却没有 x-default —— Google 明确建议 x-default 作为兜底，
//      缺失时非匹配地区的用户落到哪个版本是未定义的，且**任何校验器都不报**。
//   2. 缺失自引用 —— 每个页面必须包含一条指向自身的 hreflang，否则 Google 视为
//      "未确认" 直接忽略整组注解，整页 hreflang 静默失效。
//   3. 只声明了 1 条 hreflang —— 单条 alternate 没有"替代"对象，等于没写。
//   4. hreflang 值格式非法（en_en、english、3 段）或 href 是相对路径。
//
// 传输：直接复用 survey-opengraph.mjs / survey-jsonld.mjs 的两级（直连 → 代理）写法。
// Node 的 fetch 不认 HTTP_PROXY，必须 shell 出去用 curl。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "hreflang-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");

const MARK = "\n__SPMETA__";
const argv = process.argv.slice(2);
const REPORT = argv.includes("--report");
const SAMPLE = Number((argv.find((a) => a.startsWith("--sample=")) || "").split("=")[1] || 0);

/* ---------------- 传输（与 survey-opengraph.mjs 同一套） ---------------- */
function curlOnce(url, { proxy }) {
  const args = [
    "-sSL", "--max-time", "25", "--connect-timeout", "8",
    "-A", UA, "-H", "Accept: text/html,application/xhtml+xml",
    "-w", MARK + "%{http_code}",
  ];
  // ⚠️ 必须传代理 URL 字符串本身。传布尔值会被转成字符串 "true"，
  // curl 收到 `-x true` 报 exit 5。
  if (proxy) args.push("-x", proxy);
  else args.push("--noproxy", "*");
  args.push(url);
  return new Promise((resolve) => {
    execFile("curl", args, { maxBuffer: 48 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ status: null, body: "", error: String(err.code || err.message) });
      const i = stdout.lastIndexOf(MARK);
      if (i === -1) return resolve({ status: null, body: stdout, error: "no-status" });
      resolve({ status: Number(stdout.slice(i + MARK.length).trim()), body: stdout.slice(0, i), error: null });
    });
  });
}

async function fetchOne(domain) {
  const url = `https://${domain}/`;
  const rec = { domain, url, status: null, bytes: 0, channel: null, error: null, html: "" };
  let r = await curlOnce(url, { proxy: null });
  if (r.status === 200 && r.body.trim()) {
    rec.status = r.status; rec.html = r.body; rec.channel = "direct";
  } else {
    const p = await curlOnce(url, { proxy: PROXY });
    if (p.status === 200 && p.body.trim()) {
      rec.status = p.status; rec.html = p.body; rec.channel = "proxy";
    } else {
      rec.status = p.status ?? r.status;
      rec.error = p.error || r.error || (r.status ? `http ${r.status}` : "unreachable");
      rec.channel = p.status ? "proxy" : r.status ? "direct" : null;
    }
  }
  rec.bytes = Buffer.byteLength(rec.html, "utf8");
  return rec;
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
        process.stderr.write(out[idx].status === 200 ? "." : "x");
      }
    })
  );
  return out;
}

/* ---------------- 抽取 ---------------- */
const LINK_RE = /<link\b[^>]*>/gi;

function attrsOf(tag) {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    o[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? "").trim();
  }
  return o;
}

/** 抓出所有 <link rel="alternate" hreflang="...">，只取真正带 hreflang 的。 */
function extractLinks(html) {
  const out = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(html))) {
    const a = attrsOf(m[0]);
    const rel = (a.rel || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!rel.includes("alternate")) continue;
    const hl = (a.hreflang || "").trim().toLowerCase();
    if (!hl) continue; // hreflang 必须存在才有意义，空值当"没有"
    const href = (a.href || "").trim();
    out.push({ hreflang: hl, href, raw: m[0].replace(/\s+/g, " ").slice(0, 200) });
  }
  return out;
}

// 语言 2–3 位 + 可选 4 位 script 子标签 + 可选 2 位地区码；x-default 单独放行。
// 覆盖：en / en-us / zh-hans（简体 script）/ zh-hant-tw（繁体+地区）/ sco（ISO 639-3 苏格兰语）等。
const VALID_HL = /^[a-z]{2,3}(-[a-z]{4})?(-[a-z]{2})?$/;

function analyse(rec) {
  const links = extractLinks(rec.html);
  const n = links.length;
  const langs = [...new Set(links.map((l) => l.hreflang))];
  const hasXDefault = langs.includes("x-default");
  // 自引用：某条 href 的 origin 命中本域（含 www 变体）即视为指向自身。
  const hasSelf = links.some((l) => {
    if (!/^https?:\/\//i.test(l.href)) return false;
    try {
      const o = new URL(l.href).origin;
      return o === `https://${rec.domain}` || o === `https://www.${rec.domain}`;
    } catch { return false; }
  });
  const invalidLang = links.filter((l) => l.hreflang !== "x-default" && !VALID_HL.test(l.hreflang));
  const relativeHref = links.filter((l) => l.href && !/^https?:\/\//i.test(l.href));
  return {
    domain: rec.domain,
    channel: rec.channel,
    bytes: rec.bytes,
    count: n,
    langs,
    hasHreflang: n > 0,
    hasXDefault,
    hasSelf,
    onlyOne: n === 1,
    invalidLang: invalidLang.map((l) => l.hreflang),
    relativeHref: relativeHref.length,
    links,
  };
}

/* ---------------- 主流程 ---------------- */
let records;
if (REPORT) {
  if (!fs.existsSync(RAW)) {
    console.error("raw.json 不存在，先跑一次不带 --report 的抓取");
    process.exit(1);
  }
  records = JSON.parse(fs.readFileSync(RAW, "utf8"));
  console.log(`（--report：读上次落盘 ${records.length} 条，不联网）`);
} else {
  process.stderr.write("抓取中 ");
  const fetched = await pool(DOMAINS, 8, fetchOne);
  process.stderr.write("\n");
  records = fetched.map((r) =>
    r.status === 200 && r.html
      ? { html: r.html, channel: r.channel, bytes: r.bytes, domain: r.domain }
      : { html: "", domain: r.domain, channel: r.channel, error: r.error });
  fs.writeFileSync(RAW, JSON.stringify(records));
  console.log(`抓取完成：${DOMAINS.length} 个域名，成功 ${records.filter((r) => r.html).length}`);
}

const ok = records.filter((r) => r.html);
const rows = ok.map(analyse);
const pct = (n, d) => ((n / d) * 100).toFixed(1) + "%";
const N = rows.length;
console.log(`\n可分析首页 ${N} 个（直连 ${rows.filter((r) => r.channel === "direct").length} / 代理 ${rows.filter((r) => r.channel === "proxy").length}）`);

const withHl = rows.filter((r) => r.hasHreflang);
console.log("\n【hreflang 覆盖率】");
console.log(`  声明了 hreflang 的：${withHl.length}/${N}  ${pct(withHl.length, N)}`);

console.log("\n【hreflang 条数分布】");
const buckets = { "0": 0, "1": 0, "2": 0, "3–5": 0, "6+": 0 };
for (const r of rows) {
  if (r.count === 0) buckets["0"]++;
  else if (r.count === 1) buckets["1"]++;
  else if (r.count === 2) buckets["2"]++;
  else if (r.count <= 5) buckets["3–5"]++;
  else buckets["6+"]++;
}
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(6)} ${String(v).padStart(3)}  ${pct(v, N)}`);

console.log("\n【🔴 头条：声明了 hreflang 的站点里，静默问题】");
const missingXD = withHl.filter((r) => !r.hasXDefault);
const onlyOne = withHl.filter((r) => r.onlyOne);
console.log(`  声明了 hreflang 的站点：          ${withHl.length}`);
console.log(`  其中没有 x-default：              ${missingXD.length}  ${pct(missingXD.length, withHl.length || 1)}  ← 推荐但非强制，缺失时非匹配地区用户落到哪版未定义，任何校验器都不报`);
console.log(`  其中只声明了 1 条（无意义）：      ${onlyOne.length}  ${pct(onlyOne.length, withHl.length || 1)}`);

console.log("\n  没有 x-default 的域名：");
for (const r of missingXD) console.log(`    ${r.domain}  (${r.count} 条, ${r.langs.join("/")})`);

console.log("\n【自引用 / 跨域架构提示（非缺陷，采样口径）】");
// ⚠️ 说明：以下站点把 hreflang 集合放在与裸首页不同的域/子域上
// （about.gitlab.com / notion.com / zoom.com / open.spotify.com）。
// 我们采样的是裸首页，所以那页上不存在同源自引用 —— 这是采样口径，不是注解缺陷。
const crossDomain = withHl.filter((r) => !r.hasSelf);
console.log(`  主页采样域与本地化宿主不同域的：  ${crossDomain.length}  ${crossDomain.map((r) => r.domain).join(", ") || "—"}`);
console.log(`  （这些站点的本地化集合在子域/另一域上，裸首页只是入口；不算错误）`);

console.log("\n【格式质量】");
const inv = withHl.flatMap((r) => r.invalidLang);
const rel = withHl.filter((r) => r.relativeHref);
console.log(`  真正非法的 hreflang 值：          ${inv.length}  ${[...new Set(inv)].join(", ") || "—"}`);
console.log(`  href 是相对路径的站点：            ${rel.length}  ${rel.map((r) => r.domain).join(", ") || "—"}`);
console.log(`  （注：zh-hans / zh-hant-tw 这类 script 子标签，以及 sco/ast/kab 等 ISO 639-3 码都是合法 BCP-47，不算非法）`);

// ⚠️ 纪律：命中的条目必须打印原文核对，不能只信计数。
if (SAMPLE) {
  console.log(`\n【原始 link 行抽样核对（${SAMPLE} 个有 hreflang 的）】`);
  for (const r of withHl.slice(0, SAMPLE)) {
    console.log(`\n--- ${r.domain} (${r.channel}) ---`);
    for (const l of r.links) console.log(`    hreflang=${l.hreflang}  href=${l.href.slice(0, 90)}`);
  }
}
