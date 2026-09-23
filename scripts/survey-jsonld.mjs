// JSON-LD 实地调查 —— 抓一批高流量站点的首页，看它们的结构化数据到底怎么写的。
//
// 用途：为 SerpPrism 产出第二篇「原创数据」型深度指南。
//   node scripts/survey-jsonld.mjs            # 抓取 + 统计
//   node scripts/survey-jsonld.mjs --report   # 只读上次落盘结果重抽（不联网）
//
// 关注点：@graph 用得多不多、@id 有没有悬空引用、一个页面塞几个块。
// 悬空引用是最有意思的一项 —— 它不是语法错误，任何校验器都不会报，
// 但会让引用的属性被静默忽略。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "jsonld-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");

const MARK = "\n__SPMETA__";

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

// ---- 抽取 ----
const BLOCK_RE = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function extractBlocks(html) {
  const out = [];
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html))) {
    // 有些老站把内容包在 HTML 注释里
    let t = m[1].replace(/^\s*<!--/, "").replace(/-->\s*$/, "").trim();
    if (t) out.push(t);
  }
  return out;
}

// 递归收集所有「带 @type 的对象」
function collectNodes(value, acc) {
  if (Array.isArray(value)) { for (const v of value) collectNodes(v, acc); return acc; }
  if (!value || typeof value !== "object") return acc;
  if (value["@type"]) acc.push(value);
  for (const k of Object.keys(value)) {
    if (k === "@type" || k === "@context") continue;
    collectNodes(value[k], acc);
  }
  return acc;
}

// 递归收集所有「纯引用」对象（只有 @id 一个键）
function collectRefs(value, acc) {
  if (Array.isArray(value)) { for (const v of value) collectRefs(v, acc); return acc; }
  if (!value || typeof value !== "object") return acc;
  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === "@id" && typeof value["@id"] === "string") {
    acc.push(value["@id"]);
    return acc;
  }
  for (const k of keys) {
    if (k === "@type" || k === "@context") continue;
    collectRefs(value[k], acc);
  }
  return acc;
}

let results;
if (process.argv.includes("--report")) {
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
} else {
  process.stderr.write("fetching ");
  results = await pool(DOMAINS, 10, fetchOne);
  process.stderr.write("\n");
  // 只落盘「抽取出的 JSON-LD 原文」，不落整页 HTML（体积小、复核够用）
  const slim = results.map((r) => ({ ...r, blocks: extractBlocks(r.html), html: undefined }));
  fs.writeFileSync(RAW, JSON.stringify(slim, null, 1));
  results = slim;
}

const rows = results.map((r) => {
  const blocks = r.blocks || extractBlocks(r.html || "");
  const parsed = [];
  let parseErrors = 0;
  const nodes = [];
  const refs = [];
  for (const b of blocks) {
    let j;
    try { j = JSON.parse(b); } catch { parseErrors++; continue; }
    parsed.push(j);
    collectNodes(j, nodes);
    collectRefs(j, refs);
  }
  const defined = new Set();
  for (const n of nodes) if (typeof n["@id"] === "string" && Object.keys(n).length > 1) defined.add(n["@id"]);
  const dangling = refs.filter((x) => !defined.has(x));
  const types = {};
  for (const n of nodes) {
    const t = Array.isArray(n["@type"]) ? n["@type"].join("+") : String(n["@type"]);
    types[t] = (types[t] || 0) + 1;
  }
  const hasGraph = parsed.some((j) => j && typeof j === "object" && Array.isArray(j["@graph"]));
  return {
    domain: r.domain,
    channel: r.channel,
    status: r.status,
    err: r.error,
    bytes: r.bytes,
    blocks: blocks.length,
    parseErrors,
    nodes: nodes.length,
    hasGraph,
    definedIds: defined.size,
    refs: refs.length,
    dangling: dangling.length,
    danglingSample: dangling.slice(0, 3),
    types,
  };
});

const reachable = rows.filter((r) => r.status === 200 && r.bytes > 0);
const withLd = reachable.filter((r) => r.blocks > 0);
const withGraph = withLd.filter((r) => r.hasGraph);
const withRefs = withLd.filter((r) => r.refs > 0);
const withDangling = withLd.filter((r) => r.dangling > 0);
const pct = (n, d) => `${n}/${d} (${d ? Math.round((n / d) * 100) : 0}%)`;

// 全站 @type 频次
const typeFreq = {};
for (const r of withLd) for (const [t, c] of Object.entries(r.types)) typeFreq[t] = (typeFreq[t] || 0) + c;
const topTypes = Object.entries(typeFreq).sort((a, b) => b[1] - a[1]).slice(0, 18);

const s = {
  抓取域名数: rows.length,
  首页可达: pct(reachable.length, rows.length),
  走直连: reachable.filter((r) => r.channel === "direct").length,
  走代理: reachable.filter((r) => r.channel === "proxy").length,
  含JSONLD的站点: pct(withLd.length, reachable.length),
  完全没有JSONLD: reachable.length - withLd.length,
  用了graph的站点: pct(withGraph.length, withLd.length),
  有悬空id引用的站点: pct(withDangling.length, withLd.length),
  JSON解析失败的块: rows.reduce((a, r) => a + r.parseErrors, 0),
};

console.log("=== 总览 ===");
console.log(JSON.stringify(s, null, 2));

console.log("\n=== @type 频次 Top 18 ===");
topTypes.forEach(([t, c]) => console.log(`  ${String(c).padStart(4)}  ${t}`));

console.log(`\n=== 完全没有 JSON-LD 的站点 (${reachable.length - withLd.length}) ===`);
reachable.filter((r) => r.blocks === 0).forEach((r) => console.log("  " + r.domain));

console.log(`\n=== 有悬空 @id 引用的站点 (${withDangling.length}) ===`);
withDangling
  .sort((a, b) => b.dangling - a.dangling)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} dangling=${r.dangling} refs=${r.refs} defined=${r.definedIds}  e.g. ${r.danglingSample[0] || ""}`));

console.log(`\n=== 块数最多的 (Top 10) ===`);
[...withLd].sort((a, b) => b.blocks - a.blocks).slice(0, 10)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} blocks=${r.blocks} nodes=${r.nodes} graph=${r.hasGraph ? "Y" : "n"}`));

console.log(`\n=== 用 @graph 的 (${withGraph.length}) ===`);
withGraph.forEach((r) => console.log("  " + r.domain));

console.log(`\n=== 不可达 (${rows.length - reachable.length}) ===`);
rows.filter((r) => !(r.status === 200 && r.bytes > 0)).forEach((r) => console.log(`  ${r.domain} status=${r.status} err=${r.error}`));

fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
fs.writeFileSync(
  path.join(OUT, "rows.tsv"),
  ["domain\tchannel\tstatus\tbytes\tblocks\tparseErr\tnodes\tgraph\tdefinedIds\trefs\tdangling"]
    .concat(rows.map((r) => [r.domain, r.channel, r.status, r.bytes, r.blocks, r.parseErrors, r.nodes, r.hasGraph ? 1 : 0, r.definedIds, r.refs, r.dangling].join("\t")))
    .join("\n")
);
