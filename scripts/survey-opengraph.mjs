// Open Graph 实地调查 —— 抓一批高流量站点的首页，看它们的社交卡片标签到底怎么写的。
//
// 用途：为 SerpPrism 产出第三篇「原创数据」型深度指南。
//   node scripts/survey-opengraph.mjs            # 抓取 + 统计
//   node scripts/survey-opengraph.mjs --report   # 只读上次落盘结果重抽（不联网）
//   node scripts/survey-opengraph.mjs --sample=5 # 打印 5 个站点的原始 meta 行，人工核对
//
// 关注点（按「会不会静默出问题」排序）：
//   1. twitter:card=summary_large_image 却没有 og:image —— 渲染成灰框，
//      但页面本身完全正常，任何校验器都不报。**本站自己就犯过这个错**
//      （2026-09-23 全站 25 页都是这样，当天才修掉）。
//   2. og:image 是相对路径 —— 爬虫没有 base URL 可解析，标签被直接丢弃。
//   3. og:image 是 http:// —— 部分平台拒绝渲染不安全图片。
//   4. 没声明 og:image:width/height —— 爬虫必须先下载图片才能排版，
//      下载慢或被拦时第一条分享就没图，故障看起来是间歇性的。
//
// 传输：直接复用 survey-jsonld.mjs 的两级（直连 → 代理）写法。
// Node 的 fetch 不认 HTTP_PROXY，必须 shell 出去用 curl。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "opengraph-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");

const MARK = "\n__SPMETA__";
const argv = process.argv.slice(2);
const REPORT = argv.includes("--report");
const SAMPLE = Number((argv.find((a) => a.startsWith("--sample=")) || "").split("=")[1] || 0);

/* ---------------- 传输（与 survey-jsonld.mjs 同一套） ---------------- */
function curlOnce(url, { proxy }) {
  const args = [
    "-sSL", "--max-time", "25", "--connect-timeout", "8",
    "-A", UA, "-H", "Accept: text/html,application/xhtml+xml",
    "-w", MARK + "%{http_code}",
  ];
  // ⚠️ 必须传代理 URL 字符串本身。传布尔值会被转成字符串 "true"，
  // curl 收到 `-x true` 报 exit 5「couldn't resolve proxy」，
  // 表现为「代理通道永远 0 成功」，极易误判成网络抖动。
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
const META_RE = /<meta\b[^>]*>/gi;

function attrsOf(tag) {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    o[m[1].toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? "").trim();
  }
  return o;
}

/** 抓出所有 og: / twitter: 开头的 meta，按 property 优先、没有就用 name。 */
function extractMeta(html) {
  const out = [];
  let m;
  META_RE.lastIndex = 0;
  while ((m = META_RE.exec(html))) {
    const a = attrsOf(m[0]);
    const key = (a.property || a.name || "").toLowerCase();
    if (!/^(og:|twitter:)/.test(key)) continue;
    out.push({ key, value: a.content ?? "", raw: m[0].replace(/\s+/g, " ").slice(0, 160) });
  }
  return out;
}

const titleOf = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
};

function analyse(rec) {
  const metas = extractMeta(rec.html);
  // ⚠️ 空值必须当成「没有」。og:title="" 这类标签真实存在（rust-lang.org 首页就有），
  // 直接 truthy 判断会把它算成「有 og:title」，还会算进「与 <title> 不一致」，
  // 凭空造出一个发现。2026-09-23 第一轮统计踩到，靠打印原文才发现。
  const val = (k) => {
    const m = metas.find((x) => x.key === k);
    return m && m.value.trim() ? m.value.trim() : null;
  };
  const all = (k) => metas.filter((x) => x.key === k && x.value.trim());

  const img = val("og:image");
  const card = val("twitter:card");
  const ogTitle = val("og:title");
  const docTitle = titleOf(rec.html).replace(/\s+/g, " ").trim();

  return {
    domain: rec.domain,
    channel: rec.channel,
    bytes: rec.bytes,
    // 有没有 OG 标签
    hasOgAny: metas.some((x) => x.key.startsWith("og:") && x.value.trim()),
    hasTitle: !!ogTitle,
    hasDesc: !!val("og:description"),
    hasImage: !!img,
    hasUrl: !!val("og:url"),
    hasType: !!val("og:type"),
    hasSiteName: !!val("og:site_name"),
    hasLocale: !!val("og:locale"),
    // Twitter
    card: card ? card.toLowerCase() : null,
    hasTwitterImage: !!val("twitter:image"),
    // 图片质量
    imgRelative: !!img && !/^https?:\/\//i.test(img),
    imgInsecure: !!img && /^http:\/\//i.test(img),
    hasDims: !!val("og:image:width") && !!val("og:image:height"),
    hasImgAlt: !!val("og:image:alt"),
    imgCount: all("og:image").length,
    // 🔴 头条指标：声明了大图卡片却没有图
    largeNoImage: card?.toLowerCase() === "summary_large_image" && !img,
    // og:title 与 <title> 是否一致（不一致时分享出去的标题和搜索结果不一样）
    ogTitleMismatch: !!ogTitle && !!docTitle && ogTitle !== docTitle,
    docTitle: docTitle.slice(0, 80),
    ogTitle: (ogTitle || "").slice(0, 80),
    imgValue: (img || "").slice(0, 95),
    metas,
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
  records = fetched.map((r) => (r.status === 200 && r.html ? { html: r.html, channel: r.channel, bytes: r.bytes, domain: r.domain } : { html: "", domain: r.domain, channel: r.channel, error: r.error }));
  // 只存 HTML 供 --report 重放
  fs.writeFileSync(RAW, JSON.stringify(records));
  console.log(`抓取完成：${DOMAINS.length} 个域名，成功 ${records.filter((r) => r.html).length}`);
}

const ok = records.filter((r) => r.html);
const rows = ok.map(analyse);

const pct = (n, d) => ((n / d) * 100).toFixed(1) + "%";
const N = rows.length;
console.log(`\n可分析首页 ${N} 个（直连 ${rows.filter((r) => r.channel === "direct").length} / 代理 ${rows.filter((r) => r.channel === "proxy").length}）`);

console.log("\n【OG 标签覆盖率】");
for (const [label, key] of [
  ["og:title", "hasTitle"], ["og:description", "hasDesc"], ["og:image", "hasImage"],
  ["og:url", "hasUrl"], ["og:type", "hasType"], ["og:site_name", "hasSiteName"], ["og:locale", "hasLocale"],
]) {
  const n = rows.filter((r) => r[key]).length;
  console.log(`  ${label.padEnd(16)} ${String(n).padStart(3)}/${N}  ${pct(n, N)}`);
}
console.log(`  ${"有任何 og: 标签".padEnd(16)} ${String(rows.filter((r) => r.hasOgAny).length).padStart(3)}/${N}  ${pct(rows.filter((r) => r.hasOgAny).length, N)}`);

console.log("\n【twitter:card 取值分布】");
const cards = {};
for (const r of rows) cards[r.card ?? "(未声明)"] = (cards[r.card ?? "(未声明)"] || 0) + 1;
for (const [k, v] of Object.entries(cards).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(24)} ${String(v).padStart(3)}  ${pct(v, N)}`);
}

console.log("\n【🔴 头条：声明大图卡片却没有 og:image】");
const large = rows.filter((r) => r.card === "summary_large_image");
const largeNoImg = rows.filter((r) => r.largeNoImage);
console.log(`  声明 summary_large_image 的：${large.length}/${N}`);
console.log(`  其中没有 og:image 的：      ${largeNoImg.length}  ${large.length ? pct(largeNoImg.length, large.length) : "—"}`);
if (largeNoImg.length) {
  console.log("  涉及域名：");
  for (const r of largeNoImg) console.log(`    ${r.domain}`);
  // ⚠️ 纪律：命中的条目必须打印原文核对。计数口径写错时数字看起来完全合理，
  // 只有原文能暴露问题 —— 第一轮就是靠这个发现空值被当成「有」。
  for (const r of largeNoImg.slice(0, 5)) {
    console.log(`    [原文核对] ${r.domain} 的全部 og:/twitter: 标签：`);
    for (const m of r.metas) console.log(`       ${m.key} = ${m.value.slice(0, 80)}`);
  }
}

const withImg = rows.filter((r) => r.hasImage);
console.log(`\n【og:image 质量】（有图的 ${withImg.length} 个站点）`);
const q = (label, key) => {
  const list = withImg.filter((r) => r[key]);
  console.log(`  ${label.padEnd(28)} ${String(list.length).padStart(3)}/${withImg.length}  ${pct(list.length, withImg.length)}`);
  if (list.length && list.length <= 14) console.log(`    └ ${list.map((r) => r.domain).join(", ")}`);
  return list.length;
};
q("相对路径（爬虫会丢弃）", "imgRelative");
q("http:// 不安全", "imgInsecure");
q("声明了 width/height", "hasDims");
q("声明了 og:image:alt", "hasImgAlt");
const dup = withImg.filter((r) => r.imgCount > 1).length;
console.log(`  ${"重复声明多张 og:image".padEnd(28)} ${String(dup).padStart(3)}/${withImg.length}  ${pct(dup, withImg.length)}`);

const mismatch = rows.filter((r) => r.ogTitleMismatch);
console.log(`\n【og:title 与 <title> 不一致】${mismatch.length}/${rows.filter((r) => r.ogTitle).length}  ${pct(mismatch.length, rows.filter((r) => r.ogTitle).length || 1)}`);
for (const r of mismatch.slice(0, 6)) {
  console.log(`  ${r.domain}`);
  console.log(`    <title>   ${r.docTitle}`);
  console.log(`    og:title  ${r.ogTitle}`);
}

// ⚠️ 纪律：命中的条目必须打印原文核对，不能只信计数。
// 计数口径写错时数字看起来完全合理，只有原文能暴露问题。
if (SAMPLE) {
  console.log(`\n【原始 meta 行抽样核对（${SAMPLE} 个）】`);
  for (const r of rows.slice(0, SAMPLE)) {
    console.log(`\n--- ${r.domain} (${r.channel}) ---`);
    for (const m of r.metas) console.log(`    ${m.key} = ${m.value.slice(0, 90)}`);
  }
}
