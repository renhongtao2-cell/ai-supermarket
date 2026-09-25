// canonical 指向现状 —— 实地调查。
//
// 用途：为 SerpPrism 产出「原创数据」型深度指南（第五篇）。
//   已做过的选题（勿重复）：robots.txt sitemap 声明、首页 JSON-LD、首页 Open Graph、
//   robots.txt 里的 AI 爬虫策略、首页 hreflang。本篇测 canonical。
//   数据可复现：脚本 + 域名列表都在仓库里。
//   node scripts/survey-canonical.mjs            # 抓取 + 统计
//   node scripts/survey-canonical.mjs --report   # 只读上次落盘结果，重新统计（不联网）
//   node scripts/survey-canonical.mjs --evidence # 只打印判定所依据的原文（人工复核用）
//
// 为什么用 curl 而不是 fetch：本机在中国网络环境，直连常被墙，
// curl 读 HTTP_PROXY 而 Node 的 fetch(undici) 不读。两级降级：先直连，失败再走本地代理。
// ⚠️ `-x` 必须传代理 URL 字符串，传布尔值会被 execFile 转成 "true"，curl 报 exit 5。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "canonical-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");
const MARK = "\n__SPMETA__";

function curl(args, tag, maxTime = 25) {
  const bodyFile = path.join(OUT, `b-${tag}.tmp`);
  const headFile = path.join(OUT, `h-${tag}.tmp`);
  const full = [
    "-sS", "--max-time", String(maxTime), "--connect-timeout", "10",
    "-A", UA, "-H", "Accept: text/html,application/xhtml+xml",
    "--compressed",
    "-D", headFile, "-o", bodyFile,
    "-w", MARK + "%{http_code}" + MARK + "%{url_effective}" + MARK + "%{num_redirects}",
    ...args,
  ];
  return new Promise((resolve) => {
    execFile("curl", full, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
      const body = read(bodyFile);
      const heads = read(headFile);
      try { fs.unlinkSync(bodyFile); } catch {}
      try { fs.unlinkSync(headFile); } catch {}
      // 正文走 -o 落盘了（超时也落盘），stdout 里只剩 -w 的输出，直接按 MARK 切
      const parts = stdout.split(MARK).slice(1);
      const status = parts.length >= 3 ? Number(parts[0]) : null;
      const finalUrl = parts.length >= 3 ? parts[1] : null;
      const redirects = parts.length >= 3 ? Number(parts[2]) : null;
      resolve({
        status, finalUrl, redirects, body, heads,
        curlExit: err ? Number(err.code) || 0 : 0,
        error: err ? String(err.code || err.message) : null,
      });
    });
  });
}

// 我们只解析 <head>，所以「下载超时但头部已拿到」的响应照样可用。
// 首页动辄几 MB，走代理 25 秒常常下不完 —— 不接纳部分响应会丢掉大半样本。
function hasHead(body) {
  return /<\/head\s*>/i.test(body) || /<link\b[^>]*canonical/i.test(body) || Buffer.byteLength(body, "utf8") > 20000;
}
function usable(r) {
  return Boolean(r) && r.status >= 200 && r.status < 300 && r.body && Buffer.byteLength(r.body, "utf8") > 500 && hasHead(r.body);
}

async function fetchPage(domain, idx) {
  const url = `https://${domain}/`;
  const pack = (r, channel) => ({
    domain, url, channel,
    status: r.status,
    finalUrl: r.finalUrl || url,
    redirects: r.redirects,
    body: r.body, heads: r.heads,
    truncated: r.curlExit === 28,
    error: r.status ? null : (r.error || "unreachable"),
  });

  const d = await curl(["-L", "--noproxy", "*", url], `${idx}d`, 18);
  if (usable(d)) return pack(d, "direct");
  const p = await curl(["-L", "-x", PROXY, url], `${idx}p`, 30);
  if (usable(p)) return pack(p, "proxy");
  // 两边都没拿到可用响应：取字节多的那个，失败原因如实记录
  const db = d.body ? Buffer.byteLength(d.body, "utf8") : 0;
  const pb = p.body ? Buffer.byteLength(p.body, "utf8") : 0;
  if (pb > db) return pack(p, p.body ? "proxy" : null);
  return pack(d, d.body ? "direct" : null);
}

// canonical 指向的 URL 自己还跳不跳转：不跟随重定向，只看第一跳状态码
//
// ⚠️ 踩过的坑：不能「直连拿到状态码就采纳」。国内直连被墙的站会返回伪造的 404
//   （第一轮 44 个探测里 32 个 404，全是假的）。必须两条路都跑，且 2xx/3xx 优先。
async function probe(target, idx) {
  const d = await curl(["--noproxy", "*", target], `${idx}cd`, 15);
  const p = await curl(["-x", PROXY, target], `${idx}cp`, 20);
  if (process.env.SP_DEBUG) {
    console.error("PROBE", JSON.stringify(target), "d=", d.status, JSON.stringify(d.error), "p=", p.status, JSON.stringify(p.error), "bytes=", (d.body || "").length, (p.body || "").length);
  }
  const good = (r) => r && r.status >= 200 && r.status < 400;
  if (good(p)) return { status: p.status, error: null, via: "proxy" };
  if (good(d)) return { status: d.status, error: null, via: "direct" };
  const best = d.status ? d : p;
  return { status: best.status, error: best.error || "unreachable", via: d.status ? "direct" : "proxy" };
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
        process.stderr.write(out[idx].status === 200 ? "." : "x");
      }
    })
  );
  return out;
}

let results;
if (process.argv.includes("--reprobe")) {
  // HTML 已落盘，只重跑第二轮探测（修判定逻辑时用，省一轮抓取）
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const targets = results.filter((r) => r.status === 200 && r.body && pickCanonical(r.body));
  process.stderr.write(`reprobing ${targets.length} canonicals `);
  await pool(targets, 8, async (r, i) => {
    const c = pickCanonical(r.body);
    const t = resolveHref(c.attrs.href, r.finalUrl || r.url);
    r.probe = t ? await probe(t, i) : null;
    return r;
  });
  process.stderr.write("\n");
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
} else if (process.argv.includes("--report") || process.argv.includes("--evidence")) {
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
} else {
  process.stderr.write("fetching ");
  results = await pool(DOMAINS, 10, fetchPage);
  process.stderr.write("\n");
  // 第二轮：只探测声明了 canonical 的那些
  const targets = [];
  for (const r of results) {
    if (r.status === 200 && r.body) {
      const c = pickCanonical(r.body);
      if (c) targets.push(r);
    }
  }
  process.stderr.write(`probing ${targets.length} canonicals `);
  await pool(targets, 10, async (r, i) => {
    const c = pickCanonical(r.body);
    const t = resolveHref(c.attrs.href, r.finalUrl || r.url);
    r.probe = t ? await probe(t, i) : null;
    return r;
  });
  process.stderr.write("\n");
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
}

/* ---------------- 解析 ---------------- */

// 从 HTML 里摘所有 rel=canonical 的 <link>，保留原文用于复核
function linkTags(html) {
  const tags = [];
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) tags.push({ raw: m[0], index: m.index });
  return tags.map((t) => {
    const a = parseAttrs(t.raw);
    const rel = (a.rel || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return { ...t, attrs: a, isCanonical: rel.includes("canonical") };
  });
}

function parseAttrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;
  let m;
  while ((m = re.exec(tag))) {
    const key = m[1].toLowerCase();
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
    if (!(key in out)) out[key] = val; // 重复属性取第一个（浏览器口径）
  }
  return out;
}

function pickCanonical(html) {
  const tags = linkTags(html).filter((t) => t.isCanonical && t.attrs.href !== undefined);
  return tags.length ? tags[0] : null;
}

function resolveHref(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

function norm(u) {
  try {
    const p = new URL(u);
    const host = p.hostname.toLowerCase().replace(/\.$/, "");
    let path = p.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    path = path.replace(/(^|\/)index\.(html?|php|aspx?|jsp)$/i, "$1") || "/";
    return {
      proto: p.protocol,
      host,
      hostNoWww: host.replace(/^www\./, ""),
      path: path || "/",
      q: p.search || "",
      href: p.href,
    };
  } catch { return null; }
}

// HTTP Link 头里的 rel=canonical（少数站点只在响应头发）
function headerCanonical(heads) {
  if (!heads) return null;
  // 只取最后一次响应（重定向会产生多段 header）
  const blocks = heads.split(/(?=^HTTP\/)/m);
  const last = blocks[blocks.length - 1] || "";
  const out = [];
  for (const line of last.split(/\r?\n/)) {
    const m = line.match(/^link:[ \t]*(.+)$/i);
    if (!m) continue;
    for (const part of m[1].split(/,(?=\s*<)/)) {
      if (/rel\s*=\s*"?[^"]*\bcanonical\b/i.test(part)) {
        const h = part.match(/<([^>]*)>/);
        if (h) out.push(h[1]);
      }
    }
  }
  return out.length ? out[0] : null;
}

const CHALLENGE = [
  /just a moment/i, /cf-browser-verification/i, /checking your browser/i,
  /enable javascript and cookies to continue/i, /attention required/i,
  /access denied/i, /are you a robot/i, /verify you are human/i,
  /please enable javascript/i, /request unsuccessful/i, /captcha/i,
  // 复核原文时补的两条：Amazon 的 bm-verify 跳转页会返回 200，
  // 正文只有 2KB，不带任何真实内容 —— 不排掉会把「没写 canonical」算到它头上。
  /bm-verify/i, /__cf_chl/i, /incapsula/i,
];

// 客户端渲染壳：HTML 里没有内容，canonical 可能由 JS 注入，我们抓不到。
const SHELL = [
  /<div id="root">\s*<\/div>/i, /__NEXT_DATA__/, /shreddit/i,
  /<base href="\/">/i, /window\.__NUXT__/, /id="__next"/i, /__remixContext/i,
];

/* ---------------- 判定 ---------------- */
const rows = results.map((r) => {
  const html = r.body || "";
  const headEnd = html.search(/<\/head\s*>/i);
  const cut = headEnd === -1 ? html.length : headEnd;
  const all = linkTags(html).filter((t) => t.isCanonical);
  const inHead = all.filter((t) => t.index < cut);
  const tags = all;
  const hrefs = tags.map((t) => t.attrs.href);
  const uniqueHrefs = [...new Set(hrefs.map((h) => (h || "").trim()))];
  const href = tags.length ? (tags[0].attrs.href || "") : null;
  const resolved = href != null ? resolveHref(href, r.finalUrl || r.url) : null;
  const hCanon = headerCanonical(r.heads);
  const hResolved = hCanon ? resolveHref(hCanon, r.finalUrl || r.url) : null;

  const finalN = norm(r.finalUrl || r.url);
  const cN = resolved ? norm(resolved) : null;

  let kind = "absent";
  if (tags.length === 0 && hResolved) kind = "headerOnly";
  else if (tags.length > 0) {
    if (inHead.length === 0) kind = "bodyOnly";
    else if (!cN || !finalN) kind = "unparseable";
    else if (uniqueHrefs.length > 1) kind = "conflict";
    else if (cN.hostNoWww !== finalN.hostNoWww) kind = "crossDomain";
    else if (cN.host !== finalN.host) kind = "wwwMismatch";
    else if (cN.proto !== finalN.proto) kind = "protoMismatch";
    else if (cN.path !== finalN.path) kind = "pathDiff";
    else if (cN.q !== finalN.q) kind = "queryDiff";
    else kind = "self";
  }

  const relative = href != null && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href.trim()) && !href.trim().startsWith("//");
  const challenge = CHALLENGE.some((re) => re.test(html.slice(0, 20000)));
  const tiny = Buffer.byteLength(html, "utf8") < 1200;
  const shell = SHELL.some((re) => re.test(html.slice(0, 40000)));

  return {
    domain: r.domain,
    channel: r.channel,
    status: r.status,
    truncated: Boolean(r.truncated),
    finalUrl: r.finalUrl || r.url,
    redirects: r.redirects,
    err: r.error,
    bytes: Buffer.byteLength(html, "utf8"),
    challenge,
    tiny,
    shell,
    count: tags.length,
    href,
    resolved,
    rawTag: tags.length ? tags[0].raw.slice(0, 220) : null,
    rawTags: tags.map((t) => t.raw.slice(0, 220)),
    uniqueHrefs,
    relative,
    inBody: tags.length > 0 && inHead.length === 0,
    headerCanonical: hResolved,
    kind,
    probe: r.probe || null,
  };
});

const ok = rows.filter((r) => r.status === 200 && r.bytes > 0 && !r.challenge && !r.tiny);
const excluded = rows.filter((r) => !(r.status === 200 && r.bytes > 0 && !r.challenge && !r.tiny));
const pct = (n, d = ok.length) => `${n}/${d} (${Math.round((n / d) * 100)}%)`;

fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));

if (process.argv.includes("--evidence")) {
  console.log("=== 原文复核：逐条打印判定所依据的 <link> 原文 ===");
  for (const k of ["absent", "headerOnly", "bodyOnly", "unparseable", "conflict", "crossDomain", "wwwMismatch", "protoMismatch", "pathDiff", "queryDiff"]) {
    const hit = ok.filter((r) => r.kind === k);
    if (!hit.length) continue;
    console.log(`\n--- ${k} (${hit.length}) ---`);
    for (const r of hit) {
      console.log(`  ${r.domain}`);
      console.log(`      final: ${r.finalUrl}`);
      if (r.headerCanonical) console.log(`      header Link: ${r.headerCanonical}`);
      for (const t of r.rawTags) console.log(`      tag: ${t}`);
    }
  }
  console.log("\n=== 原文复核：canonical 目标自身状态码 != 200 ===");
  ok.filter((r) => r.probe && r.probe.status !== 200).forEach((r) => {
    console.log(`  ${r.domain.padEnd(24)} ${String(r.probe.status).padStart(3)}  canonical=${r.resolved}`);
  });
  console.log("\n=== 被排除的站点（挑战页 / 过小 / 抓不到） ===");
  excluded.forEach((r) => console.log(`  ${r.domain.padEnd(24)} status=${r.status} bytes=${r.bytes} challenge=${r.challenge} tiny=${r.tiny} err=${r.err || ""}`));
  process.exit(0);
}

console.log("=== 总览 ===");
console.log(JSON.stringify({
  域名数: rows.length,
  有效样本: ok.length,
  直连: ok.filter((r) => r.channel === "direct").length,
  代理: ok.filter((r) => r.channel === "proxy").length,
  被排除: excluded.length,
  "排除原因-挑战页": rows.filter((r) => r.challenge).length,
  "排除原因-过小": rows.filter((r) => r.tiny && r.status === 200).length,
  "排除原因-抓不到": rows.filter((r) => !(r.status === 200 && r.bytes > 0)).length,
}, null, 2));

console.log("\n=== canonical 状况分布 ===");
const KINDS = [
  ["self", "自指（规范化后一致）"],
  ["queryDiff", "同路径但查询串不同"],
  ["pathDiff", "同主机但路径不同"],
  ["wwwMismatch", "www / 非 www 不一致"],
  ["protoMismatch", "协议不一致（http vs https）"],
  ["crossDomain", "跨域名指向"],
  ["conflict", "多个 canonical 且互相冲突"],
  ["bodyOnly", "canonical 只出现在 body"],
  ["headerOnly", "只有 HTTP Link 头，HTML 里没有"],
  ["unparseable", "href 无法解析"],
  ["absent", "完全没有 canonical"],
];
for (const [k, label] of KINDS) {
  const n = ok.filter((r) => r.kind === k).length;
  console.log(`  ${k.padEnd(14)} ${label.padEnd(28)} ${pct(n)}`);
}
console.log(`\n  声明了 canonical（任意形式）: ${pct(ok.filter((r) => r.kind !== "absent").length)}`);
console.log(`  完全没有声明: ${pct(ok.filter((r) => r.kind === "absent").length)}`);

console.log("\n=== 逐站明细（非自指的先看） ===");
[...ok].sort((a, b) => (a.kind === "self" ? 1 : 0) - (b.kind === "self" ? 1 : 0) || a.domain.localeCompare(b.domain))
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.kind.padEnd(14)} canon=${(r.resolved || "-").slice(0, 90)}`));

console.log("\n=== 相对路径 canonical（不是绝对 URL） ===");
ok.filter((r) => r.relative).forEach((r) => console.log(`  ${r.domain.padEnd(24)} href="${r.href}"  -> ${r.resolved}`));
console.log(`  合计 ${ok.filter((r) => r.relative).length}`);

console.log("\n=== 多个 canonical 标签 ===");
ok.filter((r) => r.count > 1).forEach((r) => {
  console.log(`  ${r.domain.padEnd(24)} ${r.count} 个，去重后 ${r.uniqueHrefs.length} 个不同 href`);
  r.rawTags.forEach((t) => console.log(`      ${t}`));
});

console.log("\n=== HTTP Link 头里的 canonical ===");
ok.filter((r) => r.headerCanonical).forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.headerCanonical}    html内=${r.kind !== "absent" && r.kind !== "headerOnly"}`));

console.log("\n=== canonical 目标自身状态码（不跟随重定向） ===");
const probed = ok.filter((r) => r.probe && r.probe.status);
const byStatus = {};
for (const r of probed) byStatus[r.probe.status] = (byStatus[r.probe.status] || 0) + 1;
console.log("  分布:", JSON.stringify(byStatus));
probed.filter((r) => r.probe.status !== 200)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${String(r.probe.status).padStart(3)} via=${r.probe.via || "-"}  ${r.resolved}`));
console.log("  按通道统计:", JSON.stringify(probed.reduce((a, r) => { const k = r.probe.via || "-"; a[k] = (a[k] || 0) + 1; return a; }, {})));
console.log(`  200 直达: ${pct(probed.filter((r) => r.probe.status === 200).length, probed.length)}`);

console.log("\n=== 首页发生了重定向的站 ===");
ok.filter((r) => r.redirects > 0).forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.redirects} 跳 -> ${r.finalUrl}`));

console.log("\n=== 被排除 / 抓不到（如实记录） ===");
excluded.forEach((r) => console.log(`  ${r.domain.padEnd(24)} status=${r.status} bytes=${r.bytes} challenge=${r.challenge} tiny=${r.tiny} err=${r.err || ""}`));
