// SERP 摘要实地调查 —— 抓一批高流量站点的首页，量它们的 <title> 和
// <meta name="description"> 到底多长、怎么写、用什么分隔符。
//
// 用途：为 SerpPrism 产出「原创数据」型深度指南（与 robots-txt-in-the-wild /
// hreflang-in-the-wild / canonical-in-the-wild 同系列）。
//   node scripts/survey-serp-snippet.mjs            # 抓取 + 统计
//   node scripts/survey-serp-snippet.mjs --report   # 只读上次落盘结果重抽（不联网）
//   node scripts/survey-serp-snippet.mjs --sample=5 # 打印 5 个站点的原始行，人工核对
//
// 关注点（按「会不会静默出问题」排序）：
//   1. 完全没有 meta description —— Google 只能自己从正文里抠一段，你放弃了
//      对摘要的控制权。大站里比例高得离谱。
//   2. title 超长 —— 桌面端约 60 字符、移动端约 50 字符就会被截断，
//      截断发生在**词中间**时最难看。
//   3. description 太短 —— 少于 ~70 字符等于浪费一段本可说服用户的广告位。
//   4. 分隔符习惯 —— | / - / – / · / » 到底哪个是主流？有实测数据才好选。
//   5. 品牌位置 —— 品牌放标题头还是尾？
//
// ⚠️ 长度口径：先做 HTML 实体解码再数，否则 &amp; 会被算成 5 个字符，
// 整体统计会系统性偏长。用码点（[...str].length）而不是 UTF-16 长度。
//
// 传输：复用 survey-hreflang.mjs 的两级（直连 → 代理）写法。
// Node 的 fetch 不认 HTTP_PROXY，必须 shell 出去用 curl。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "serp-snippet-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");

const MARK = "\n__SPMETA__";
const argv = process.argv.slice(2);
const REPORT = argv.includes("--report");
const SAMPLE = Number((argv.find((a) => a.startsWith("--sample=")) || "").split("=")[1] || 0);
const OUTLIERS = argv.includes("--outliers");

/* ---------------- 传输（与 survey-hreflang.mjs 同一套） ---------------- */
function curlOnce(url, { proxy }) {
  const args = [
    "-sSL", "--max-time", "25", "--connect-timeout", "8",
    "-A", UA, "-H", "Accept: text/html,application/xhtml+xml",
    // ⚠️ 必须 --compressed 且只声明 gzip/deflate。python.org 这类站**无条件**返回
    // gzip，不带解压就会把 gzip 字节当 HTML 解析 → 抽不到 title，静默产出假数据
    // （实测：第一轮 python.org 被判成"没有 title"）。
    // ⚠️ 绝不能声明 br：本机 libcurl 不支持 brotli，会直接 exit 61。
    "--compressed", "-H", "Accept-Encoding: gzip, deflate",
    "-w", MARK + "%{http_code}",
  ];
  // ⚠️ 必须传代理 URL 字符串本身。传布尔值会被转成字符串 "true"，curl 报 exit 5。
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

/* ---------------- HTML 实体解码 ---------------- */
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026",
  rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d",
  middot: "\u00b7", raquo: "\u00bb", laquo: "\u00ab",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122",
  times: "\u00d7", deg: "\u00b0", bull: "\u2022", euro: "\u20ac",
  pound: "\u00a3", yen: "\u00a5", sect: "\u00a7", para: "\u00b6",
  ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "",
};

/** 解码命名实体 + 十进制/十六进制数字实体。解码后再量长度才准。 */
function decode(s) {
  if (!s) return "";
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCp(parseInt(d, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
      const k = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED, k) ? NAMED[k] : m;
    });
}
function safeCp(n) {
  try { return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ""; }
  catch { return ""; }
}

/** 把连续空白压成一个空格并 trim —— 否则换行/缩进会让长度虚高。 */
const norm = (s) => decode(s).replace(/\s+/g, " ").trim();
const cps = (s) => [...s].length; // 码点长度

/* ---------------- 抽取 ---------------- */
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
const META_RE = /<meta\b[^>]*>/gi;

function attrsOf(tag) {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    o[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? "").trim();
  }
  return o;
}

/** 找 name="description" 的 meta（不区分 name/property 写法的大小写）。 */
function extractDescription(html) {
  let m;
  META_RE.lastIndex = 0;
  while ((m = META_RE.exec(html))) {
    const a = attrsOf(m[0]);
    const key = (a.name || a.property || "").toLowerCase();
    if (key === "description") return { text: norm(a.content || ""), raw: m[0].replace(/\s+/g, " ").slice(0, 300) };
  }
  return { text: "", raw: "" };
}

// 标题分隔符：只统计「两侧都有空白」的那些，避免把 brand-name 里的连字符算进来
// （例如 "rust-lang" 的 "-" 不是分隔符）。
const SEPS = [
  ["|", "pipe"], ["–", "en dash"], ["—", "em dash"], ["·", "middle dot"],
  ["»", "raquo"], ["/", "slash"], ["::", "double colon"], [":", "colon"],
  ["-", "hyphen"], ["«", "laquo"],
];

function findSeparators(title) {
  const hit = [];
  for (const [ch, label] of SEPS) {
    if (ch.length === 1 && (ch === "|" || ch === "·" || ch === "»" || ch === "«")) {
      if (title.includes(ch)) hit.push(label);
    } else if (ch === "::") {
      if (title.includes("::")) hit.push(label);
    } else {
      // 需要两侧有空白才算分隔符（避免 hyphen 误判）
      if (new RegExp(`\\s${ch.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s`).test(title)) hit.push(label);
    }
  }
  return hit;
}

/** 品牌位置：域名首段（去 www）出现在标题前 1/3 记 head，后 1/3 记 tail，中间记 mid。
 *  ⚠️ 这是近似判断 —— 很多品牌名和域名不同（theguardian.com → The Guardian），
 *  报告里必须声明口径，并抽样人工核对。 */
function brandPosition(domain, title) {
  const brand = domain.replace(/^www\./, "").split(".")[0].toLowerCase();
  if (!brand || brand.length < 3) return "n/a";
  const t = title.toLowerCase();
  const i = t.indexOf(brand);
  if (i === -1) return "absent";
  const L = t.length;
  if (i <= L / 3) return "head";
  if (i >= (2 * L) / 3) return "tail";
  return "mid";
}

// 反爬拦截页 / JS 空壳 —— 这类响应**不是首页**，混进样本会污染统计。
// 实测：khanacademy.org 返回 Cloudflare 的 "Client Challenge"（3 KB），
// 若不去掉，它会被算成"title 只有 15 个字符"。
const CHALLENGE_RE =
  /client challenge|just a moment|attention required|access denied|are you a robot|verify you are human|enable javascript and cookies|checking your browser/i;

function classifySuspect(rec, title) {
  if (CHALLENGE_RE.test(title)) return "bot-challenge";
  if (rec.bytes < 4000) return "tiny-shell";
  if (!title && rec.bytes < 15000) return "js-shell";
  return null;
}

function analyse(rec) {
  const html = rec.html;
  const tm = TITLE_RE.exec(html);
  const title = tm ? norm(tm[1]) : "";
  const desc = extractDescription(html);
  const seps = findSeparators(title);
  return {
    domain: rec.domain,
    channel: rec.channel,
    bytes: rec.bytes,
    suspect: classifySuspect(rec, title),
    title,
    titleLen: cps(title),
    titleWords: title ? title.split(/\s+/).filter(Boolean).length : 0,
    hasTitle: !!title,
    seps,
    brandPos: title ? brandPosition(rec.domain, title) : "n/a",
    desc: desc.text,
    descLen: cps(desc.text),
    descWords: desc.text ? desc.text.split(/\s+/).filter(Boolean).length : 0,
    hasDesc: !!desc.text,
  };
}

/* ---------------- 统计工具 ---------------- */
const pct = (n, d) => ((n / (d || 1)) * 100).toFixed(1) + "%";
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}
function stats(nums) {
  const s = [...nums].sort((a, b) => a - b);
  if (!s.length) return { n: 0 };
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    min: s[0], max: s[s.length - 1],
    mean: +(sum / s.length).toFixed(1),
    p25: percentile(s, 25), p50: percentile(s, 50),
    p75: percentile(s, 75), p90: percentile(s, 90),
  };
}
const fmtStats = (s) =>
  s.n ? `min ${s.min} / p25 ${s.p25} / 中位 ${s.p50} / p75 ${s.p75} / p90 ${s.p90} / max ${s.max} / 均值 ${s.mean}` : "—";

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
      : { html: "", domain: r.domain, channel: r.channel, error: r.error }
  );
  fs.writeFileSync(RAW, JSON.stringify(records));
  console.log(`抓取完成：${DOMAINS.length} 个域名，成功 ${records.filter((r) => r.html).length}`);
}

const ok = records.filter((r) => r.html);
const allRows = ok.map(analyse);
// 剔除反爬拦截页 / 空壳后再统计 —— 否则计数看着合理，结论是错的。
const rows = allRows.filter((r) => !r.suspect);
const excluded = allRows.filter((r) => r.suspect);
const N = rows.length;
console.log(`\n可分析首页 ${N} 个（直连 ${rows.filter((r) => r.channel === "direct").length} / 代理 ${rows.filter((r) => r.channel === "proxy").length}）`);
if (excluded.length) {
  console.log(`\n⚠️ 已剔除 ${excluded.length} 个非首页响应（反爬拦截 / JS 空壳）：`);
  for (const r of excluded) console.log(`    ${r.domain.padEnd(24)} ${String(r.bytes).padStart(7)} bytes  ${r.suspect}  title="${r.title.slice(0, 40)}"`);
}

/* ---- 1. title 长度 ---- */
const withTitle = rows.filter((r) => r.hasTitle);
const tl = stats(withTitle.map((r) => r.titleLen));
console.log("\n【title 长度（码点，已解码实体）】");
console.log(`  有 <title> 的：${withTitle.length}/${N}  ${pct(withTitle.length, N)}`);
console.log(`  分布：${fmtStats(tl)}`);
const over60 = withTitle.filter((r) => r.titleLen > 60);
const over70 = withTitle.filter((r) => r.titleLen > 70);
const under30 = withTitle.filter((r) => r.titleLen < 30);
console.log(`  > 60 字符（桌面端易截断）：  ${over60.length}  ${pct(over60.length, withTitle.length)}`);
console.log(`  > 70 字符（几乎必截断）：    ${over70.length}  ${pct(over70.length, withTitle.length)}`);
console.log(`  < 30 字符（偏短）：          ${under30.length}  ${pct(under30.length, withTitle.length)}`);

/* ---- 2. description ---- */
const withDesc = rows.filter((r) => r.hasDesc);
const dl = stats(withDesc.map((r) => r.descLen));
console.log("\n【🔴 头条：meta description 覆盖】");
console.log(`  写了 description 的：        ${withDesc.length}/${N}  ${pct(withDesc.length, N)}`);
console.log(`  完全没写的：                 ${N - withDesc.length}  ${pct(N - withDesc.length, N)}  ← Google 只能自己从正文抠，你失去摘要控制权`);
if (withDesc.length) {
  console.log(`  长度分布：${fmtStats(dl)}`);
  const dOver160 = withDesc.filter((r) => r.descLen > 160);
  const dUnder70 = withDesc.filter((r) => r.descLen < 70);
  console.log(`  > 160 字符（易截断）：        ${dOver160.length}  ${pct(dOver160.length, withDesc.length)}`);
  console.log(`  < 70 字符（浪费位置）：       ${dUnder70.length}  ${pct(dUnder70.length, withDesc.length)}`);
}

/* ---- 3. 分隔符 ---- */
console.log("\n【title 分隔符习惯（两侧带空白的才算）】");
const sepCount = {};
for (const r of withTitle) for (const s of r.seps) sepCount[s] = (sepCount[s] || 0) + 1;
const sepSorted = Object.entries(sepCount).sort((a, b) => b[1] - a[1]);
for (const [k, v] of sepSorted) console.log(`  ${k.padEnd(12)} ${String(v).padStart(3)}  ${pct(v, withTitle.length)}`);
const noSep = withTitle.filter((r) => r.seps.length === 0);
console.log(`  （不用任何分隔符）            ${noSep.length}  ${pct(noSep.length, withTitle.length)}`);

/* ---- 4. 品牌位置 ---- */
// ⚠️ 实测这个指标**不可用、不要发布**：用「域名首段」当品牌名，遇到多词品牌或
// 与域名拼写不同的品牌就全错。抽样 10 个判为 absent 的，9 个是误判：
//   theguardian.com→"…from the Guardian"  nodejs.org→"Node.js"  rust-lang.org→"Rust"
//   developer.mozilla.org→"MDN"  screamingfrog.co.uk→"Screaming Frog"
//   searchenginejournal.com→"Search Engine Journal"  squareup.com→"Square"
//   linkedin.com→"领英企业服务"（中文，因我们从中囯 IP 抓）
// 保留计算只为记录"这条路走不通"，报告里一律不引用。
console.log("\n【品牌位置（⚠️ 已知不可靠，仅记录，勿引用）】");
const bp = {};
for (const r of withTitle) bp[r.brandPos] = (bp[r.brandPos] || 0) + 1;
for (const [k, v] of Object.entries(bp).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(8)} ${String(v).padStart(3)}  ${pct(v, withTitle.length)}`);

/* ---- 6. 异常值核对（纪律：极端值和"缺失"必须看原文，否则统计会骗人） ---- */
if (OUTLIERS) {
  const bt = [...withTitle].sort((a, b) => a.titleLen - b.titleLen);
  console.log("\n【最短 5 个 title】");
  for (const r of bt.slice(0, 5)) console.log(`  [${String(r.titleLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.title}`);
  console.log("\n【最长 5 个 title】");
  for (const r of bt.slice(-5).reverse()) console.log(`  [${String(r.titleLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.title}`);

  const noTitle = rows.filter((r) => !r.hasTitle);
  console.log(`\n【完全没有 <title> 的（${noTitle.length} 个）】`);
  for (const r of noTitle) console.log(`  ${r.domain.padEnd(24)} bytes=${r.bytes} channel=${r.channel} ← 可能是客户端渲染空壳`);

  const bd = [...withDesc].sort((a, b) => b.descLen - a.descLen);
  console.log("\n【最长 5 个 description】");
  for (const r of bd.slice(0, 5)) console.log(`  [${String(r.descLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.desc.slice(0, 140)}...`);

  const noDesc = rows.filter((r) => !r.hasDesc);
  console.log(`\n【没写 description 的（${noDesc.length} 个）】`);
  for (const r of noDesc) console.log(`  ${r.domain.padEnd(24)} bytes=${r.bytes} title=[${r.titleLen}]`);

  console.log("\n【品牌判定为 absent 的（近似口径可能误判，逐条看）】");
  for (const r of withTitle.filter((x) => x.brandPos === "absent"))
    console.log(`  ${r.domain.padEnd(24)} title: ${r.title}`);

  console.log(`\n【全部 title > 60 字符（${over60.length} 个）】`);
  for (const r of [...over60].sort((a, b) => b.titleLen - a.titleLen))
    console.log(`  [${String(r.titleLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.title}`);
  console.log(`\n【全部 title < 30 字符（${under30.length} 个）】`);
  for (const r of [...under30].sort((a, b) => a.titleLen - b.titleLen))
    console.log(`  [${String(r.titleLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.title}`);
  const dOver = withDesc.filter((r) => r.descLen > 160);
  console.log(`\n【全部 description > 160 字符（${dOver.length} 个）】`);
  for (const r of [...dOver].sort((a, b) => b.descLen - a.descLen))
    console.log(`  [${String(r.descLen).padStart(3)}] ${r.domain.padEnd(24)} ${r.desc.slice(0, 100)}...`);
}

if (SAMPLE) {
  console.log(`\n【原始行抽样核对（前 ${SAMPLE} 个）】`);
  for (const r of withTitle.slice(0, SAMPLE)) {
    console.log(`\n--- ${r.domain} (${r.channel}) ---`);
    console.log(`    title [${r.titleLen}] ${r.title}`);
    console.log(`    desc  [${r.descLen}] ${r.desc || "(无)"}`);
    console.log(`    分隔符=${r.seps.join(",") || "—"}  品牌=${r.brandPos}`);
  }
  const miss = rows.filter((r) => !r.hasDesc).slice(0, SAMPLE);
  if (miss.length) {
    console.log(`\n【没写 description 的抽样（前 ${miss.length} 个）】`);
    for (const r of miss) console.log(`    ${r.domain}  title=[${r.titleLen}] ${r.title.slice(0, 80)}`);
  }
}
