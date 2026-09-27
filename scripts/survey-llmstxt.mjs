// llms.txt 采用情况 —— 实地调查。
//
// 用途：为 SerpPrism 产出「原创数据」型深度指南（第八篇）。
//   已做过的选题（勿重复）：robots.txt sitemap 声明、首页 JSON-LD、首页 Open Graph、
//   robots.txt 里的 AI 爬虫策略、首页 hreflang、canonical 指向、首页 title/meta description。
//   本篇测 llms.txt。
//   数据可复现：脚本 + 域名列表都在仓库里。
//   node scripts/survey-llmstxt.mjs            # 抓取 + 统计
//   node scripts/survey-llmstxt.mjs --report   # 只读上次落盘结果，重新统计（不联网）
//   node scripts/survey-llmstxt.mjs --evidence # 打印判定所依据的原文（人工复核用）
//
// 为什么用 curl 而不是 fetch：本机在中国网络环境，直连常被墙，
// curl 读 HTTP_PROXY 而 Node 的 fetch(undici) 不读。两级降级：先直连，失败再走本地代理。
// ⚠️ `-x` 必须传代理 URL 字符串，传布尔值会被 execFile 转成 "true"，curl 报 exit 5。
//
// 本篇的特殊坑（都踩过，记下来）：
//   1. 软 404：CDN / SPA 会把不存在的 /llms.txt 返回 200 + 一段 HTML。
//      所以「200 就算有」是错的，必须按内容判定（见 looksLikeHtml）。
//   2. 国内直连被墙的站会返回伪造的 404（有些是整段 HTML 错误页）。
//      所以必须直连 + 代理两条路都跑，且 2xx 优先。
//   3. 不能 -L 跟随重定向：很多站把 /llms.txt 301 到首页或文档站，
//      跟随后会拿到首页 HTML，于是「有 llms.txt」是假的。
//      本篇不跟随，只记录 3xx 与 Location。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "llmstxt-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");
const MARK = "\n__SPMETA__";

function curl(args, tag, maxTime = 25) {
  const bodyFile = path.join(OUT, `b-${tag}.tmp`);
  const headFile = path.join(OUT, `h-${tag}.tmp`);
  const full = [
    "-sS", "--max-time", String(maxTime), "--connect-timeout", "10",
    "-A", UA,
    "--compressed", "-H", "Accept-Encoding: gzip, deflate", // 不声明 br：本机 libcurl 不支持 → exit 61
    "-D", headFile, "-o", bodyFile,
    "-w", MARK + "%{http_code}" + MARK + "%{url_effective}" + MARK + "%{content_type}",
    ...args,
  ];
  return new Promise((resolve) => {
    execFile("curl", full, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } };
      const body = read(bodyFile);
      const heads = read(headFile);
      try { fs.unlinkSync(bodyFile); } catch {}
      try { fs.unlinkSync(headFile); } catch {}
      const parts = stdout.split(MARK).slice(1);
      const status = parts.length >= 3 ? Number(parts[0]) : null;
      const finalUrl = parts.length >= 3 ? parts[1] : null;
      const contentType = parts.length >= 3 ? parts[2] : null;
      resolve({
        status, finalUrl, contentType, body, heads,
        curlExit: err ? Number(err.code) || 0 : 0,
        error: err ? String(err.code || err.message) : null,
      });
    });
  });
}

function headerOf(heads, name) {
  const re = new RegExp("^" + name + ":\\s*(.+)$", "im");
  const m = (heads || "").match(re);
  return m ? m[1].trim() : null;
}

// —— 内容判定：这个文件到底是不是 llms.txt ——
function looksLikeHtml(body) {
  if (!body) return true;
  const head = body.slice(0, 800);
  return /^\s*(?:<!doctype\s+html|<html\b)/i.test(head) || /<html\b/i.test(head);
}

function classify(body) {
  if (!body || body.trim().length === 0) return "empty";
  if (looksLikeHtml(body)) return "html";
  return "text";
}

// 只数 markdown 链接，且只数指向 http(s) 的（避免把标题里的括号算成链接）
function mdLinks(body) {
  const re = /\[([^\]]*)\]\(\s*(https?:\/\/[^)\s]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(body))) out.push({ text: m[1].trim(), href: m[2] });
  return out;
}

function analyse(body) {
  const lines = body.split("\n");
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const sections = lines
    .filter((l) => /^\s*#{1,6}\s+\S/.test(l))
    .map((l) => l.replace(/^\s*#+\s*/, "").trim());
  const links = mdLinks(body);
  return {
    bytes: Buffer.byteLength(body, "utf8"),
    lines: lines.length,
    nonEmptyLines: nonEmpty.length,
    hasH1: /^\s*#\s+\S/m.test(body),
    h1: (body.match(/^\s*#\s+(.+)$/m) || [])[1] || null,
    sections,
    sectionCount: sections.length,
    hasOptional: sections.some((s) => /^optional\b/i.test(s)),
    sectionNames: [...new Set(sections.map((s) => s.toLowerCase()))].slice(0, 12),
    linkCount: links.length,
    firstLinks: links.slice(0, 3).map((l) => l.href),
    hasSelfReference: /llms\.txt/i.test(body),
    startsWithH1: /^\s*#\s+\S/.test(body.slice(0, 400)),
    // UTF-8 BOM：文件开头是 U+FEFF，会在 H1 前面塞一个零宽字符
    bom: body.charCodeAt(0) === 0xfeff,
    hasBlockquote: /^\s*>/m.test(body),
  };
}

// 第二轮专用：跟随重定向，但只在「最终 URL 的路径仍然是 /llms.txt」时才算采用。
// 背景：51/78 个域名对 https://domain/llms.txt 返回 301 → https://www.domain/llms.txt，
//   那只是 www 规范化，不是「没有 llms.txt」。不跟随会严重低估采用率。
//   但盲目跟随也错：cdc.gov 301 → 首页、gitlab.com 302 → /users/sign_in，
//   跟随后拿到的是首页 HTML，会被误判成「有 llms.txt」。
async function fetchFollow(domain, idx, file = "llms.txt") {
  const url = `https://${domain}/${file}`;
  const run = async (extra, tag) => {
    const r = await curl(["-L", ...extra, url], tag, 30);
    let finalUrl = r.finalUrl || url;
    let pathname = "/";
    try { pathname = new URL(finalUrl).pathname; } catch {}
    return {
      channel: extra.includes(PROXY) ? "proxy" : "direct",
      status: r.status,
      finalUrl,
      pathname,
      samePath: pathname.replace(/\/+$/, "") === "/" + file,
      kind: classify(r.body),
      bytes: r.body ? Buffer.byteLength(r.body, "utf8") : 0,
      contentType: (r.contentType || headerOf(r.heads, "content-type") || "").toLowerCase(),
      body: r.status === 200 && classify(r.body) === "text" ? r.body : null,
      location: headerOf(r.heads, "location"),
      error: r.status ? null : (r.error || "unreachable"),
    };
  };
  const d = await run(["--noproxy", "*"], `${idx}fd`);
  if (d.status === 200 && d.samePath && d.kind === "text") return { ...d, file, url, domain };
  const p = await run(["-x", PROXY], `${idx}fp`);
  if (p.status === 200 && p.samePath && p.kind === "text") return { ...p, file, url, domain };
  const best = d.status ? d : p;
  return { ...best, file, url, domain };
}

async function fetchTxt(domain, idx, file = "llms.txt") {
  const url = `https://${domain}/${file}`;
  const pack = (r, channel) => {
    const kind = classify(r.body);
    return {
      domain, file, url, channel,
      status: r.status,
      finalUrl: r.finalUrl || url,
      contentType: (r.contentType || headerOf(r.heads, "content-type") || "").toLowerCase(),
      location: headerOf(r.heads, "location"),
      bytes: r.body ? Buffer.byteLength(r.body, "utf8") : 0,
      kind,
      body: kind === "text" && r.status === 200 ? r.body : null, // 只留真文本，别把 HTML 落盘
      error: r.status ? null : (r.error || "unreachable"),
    };
  };
  // 不跟随重定向：跟随会把「301 到首页」误判成「有 llms.txt」
  const d = await curl(["--noproxy", "*", url], `${idx}d`, 15);
  const p = await curl(["-x", PROXY, url], `${idx}p`, 25);
  const good = (r) => r && r.status === 200 && !looksLikeHtml(r.body || "");
  if (good(d)) return pack(d, "direct");
  if (good(p)) return pack(p, "proxy");
  // 两边都不是「真文本 200」：优先采纳状态码更明确的那个
  const pick = (a, b) => {
    const score = (r) => (r && r.status ? (r.status === 404 ? 3 : r.status === 200 ? 2 : 1) : 0);
    return score(a) >= score(b) ? a : b;
  };
  const best = pick(d, p);
  return pack(best, best === d && d.status ? "direct" : (p.status ? "proxy" : null));
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
if (process.argv.includes("--refollow")) {
  // HTML/结果已落盘，只补跑「跟随重定向」这一轮（省一轮全量抓取）
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const todo = results.filter((r) => !r.follow);
  process.stderr.write(`refollowing ${todo.length} domains `);
  await pool(todo, 10, async (r, i) => {
    r.follow = await fetchFollow(r.domain, i, "llms.txt");
    return r;
  });
  process.stderr.write("\n");
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
  console.error(`wrote ${RAW}`);
} else if (process.argv.includes("--refull")) {
  // 只对「采用者」重探 llms-full.txt（跟随重定向版，覆盖 www 跳转的站）
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
  const adopted = results.filter(
    (r) => (r.status === 200 && r.kind === "text") || (r.follow && r.follow.status === 200 && r.follow.samePath && r.follow.kind === "text")
  );
  process.stderr.write(`probing llms-full.txt on ${adopted.length} domains `);
  await pool(adopted, 8, async (r) => {
    const f = await fetchFollow(r.domain, `F${r.domain.replace(/\W/g, "")}`, "llms-full.txt");
    r.full = {
      status: f.status, kind: f.kind, bytes: f.bytes, samePath: f.samePath, finalUrl: f.finalUrl,
    };
    return r;
  });
  process.stderr.write("\n");
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
  console.error(`wrote ${RAW}`);
} else if (process.argv.includes("--report") || process.argv.includes("--evidence") || process.argv.includes("--sample")) {
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
} else {
  process.stderr.write("fetching llms.txt ");
  results = await pool(DOMAINS, 10, (d, i) => fetchTxt(d, i, "llms.txt"));
  process.stderr.write("\n");

  // 第二轮：只对确认有 llms.txt 的域名探 llms-full.txt（规范里的「全量版」）
  const have = results.filter((r) => r.status === 200 && r.kind === "text");
  process.stderr.write(`probing llms-full.txt on ${have.length} domains `);
  await pool(have, 8, async (r) => {
    const f = await fetchTxt(r.domain, `f${r.domain.replace(/\W/g, "")}`, "llms-full.txt");
    r.full = {
      status: f.status,
      kind: f.kind,
      bytes: f.bytes,
      location: f.location,
    };
    return r;
  });
  process.stderr.write("\n");

  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
  console.error(`wrote ${RAW}  (${results.length} domains)`);
}

// —— 统计 ——
//
// 每个域名给一个最终判定 verdict，两轮结果合并：
//   adopted         —— 拿到 200 且内容是文本的 /llms.txt（不跟随轮 or 跟随轮，路径都必须是 /llms.txt）
//   redirect-home   —— 跟随重定向后拿到 200，但最终路径不再是 /llms.txt（软 404 的一种）
//   html-200        —— 不跟随就 200 但内容是 HTML（CDN 软 404）
//   not-found       —— 404
//   other           —— 403 等
const verdict = (r) => {
  const f = r.follow;
  const followedAdopted = f && f.status === 200 && f.samePath && f.kind === "text";
  if (r.status === 200 && r.kind === "text") return "adopted";
  if (followedAdopted) return "adopted";
  if (f && f.status === 200) return f.samePath ? "html-200" : "redirect-home";
  if (r.status === 200 && r.kind === "html") return "html-200";
  if (r.status === 404 || (f && f.status === 404)) return "not-found";
  return "other"; // 401/403/406/超时 —— 被挡，无法判定，单列不可当成「没有」
};
const bodyOf = (r) => r.body || (r.follow && r.follow.body) || null;
const finalUrlOf = (r) => (verdict(r) === "adopted" && !r.body && r.follow ? r.follow.finalUrl : r.finalUrl || r.url);

for (const r of results) r.verdict = verdict(r);

const total = results.length;
const ok200 = results.filter((r) => r.status === 200);
const real = results.filter((r) => r.verdict === "adopted");
const softHtml = results.filter((r) => r.verdict === "html-200");
const empty = results.filter((r) => r.status === 200 && r.kind === "empty");
const notFound = results.filter((r) => r.verdict === "not-found");
const redirectHome = results.filter((r) => r.verdict === "redirect-home");
const otherStatus = results.filter((r) => r.verdict === "other");
const unreachable = results.filter((r) => !r.status);

const pct = (n) => ((n / total) * 100).toFixed(1) + "%";
const pctOf = (n, d) => (d ? ((n / d) * 100).toFixed(1) + "%" : "n/a");

if (process.argv.includes("--evidence")) {
  console.log("=== 判定为真「有 llms.txt」的原文前 3 行 ===");
  for (const r of real) {
    const b = bodyOf(r) || "";
    const head = b.split("\n").slice(0, 3).map((l) => l.slice(0, 110));
    console.log(`\n--- ${r.domain}  status=${r.status}/${r.follow ? r.follow.status : "-"} bytes=${b.length} url=${finalUrlOf(r)}`);
    for (const l of head) console.log("    " + l);
  }
  console.log("\n=== 200 但内容是 HTML（软 404 嫌疑）===");
  for (const r of softHtml) {
    console.log(`\n--- ${r.domain} ct=${r.contentType} bytes=${r.bytes} via=${r.channel}`);
    console.log("    " + (r.finalUrl || r.url));
    console.log("    first120: " + String(r.finalUrl).slice(0, 120));
  }
  console.log("\n=== 3xx 重定向 ===");
  for (const r of redirect) {
    console.log(`${r.domain}: ${r.status} -> ${r.location || "(no Location)"}`);
  }
  console.log("\n=== 非 200/404/3xx ===");
  for (const r of otherStatus) console.log(`${r.domain}: ${r.status} ${r.error || ""}`);
  console.log("\n=== 完全不可达 ===");
  for (const r of unreachable) console.log(`${r.domain}: ${r.error}`);
  process.exit(0);
}

if (process.argv.includes("--sample")) {
  const n = Number((process.argv.find((a) => a.startsWith("--sample=")) || "--sample=5").split("=")[1]);
  console.log(`=== 随机抽 ${n} 条「无 llms.txt」复查（确认不是抓取问题）===`);
  const none = results.filter((r) => r.status === 404);
  for (const r of none.slice(0, n)) {
    console.log(`${r.domain}: status=${r.status} via=${r.channel} ct=${r.contentType} bytes=${r.bytes}`);
  }
  process.exit(0);
}

console.log("=== llms.txt 采用情况 ===");
console.log(`域名总数: ${total}`);
console.log(`采用（200 + 真文本 + 路径仍是 /llms.txt）: ${real.length} (${pct(real.length)})`);
console.log(`  其中直接就有（无重定向）: ${real.filter((r) => r.status === 200 && r.kind === "text").length}`);
console.log(`  其中要跟一次 www 重定向才有: ${real.filter((r) => !(r.status === 200 && r.kind === "text")).length}`);
console.log(`重定向后落到别处（软 404）: ${redirectHome.length}`);
console.log(`200 但内容是 HTML（CDN 软 404）: ${softHtml.length}`);
console.log(`404: ${notFound.length} (${pct(notFound.length)})`);
console.log(`其它状态码: ${otherStatus.length} → ${otherStatus.map((r) => r.domain + ":" + r.status).join(", ")}`);
console.log(`不可达: ${unreachable.length} → ${unreachable.map((r) => r.domain).join(", ") || "(none)"}`);

console.log("\n=== 采用的站 ===");
for (const r of real) {
  const a = analyse(bodyOf(r));
  console.log(
    `${r.domain}: ${a.bytes}B ${a.lines}行 links=${a.linkCount} sections=${a.sectionCount} ` +
      `h1=${a.hasH1 ? "Y" : "N"} optional=${a.hasOptional ? "Y" : "N"} url=${finalUrlOf(r)}`
  );
}

console.log("\n=== 200 但内容是 HTML（软 404：SPA/CDN 兜底页）===");
for (const r of softHtml) {
  console.log(`  ${r.domain}: ${r.status}→${r.follow ? r.follow.status : "-"} ${r.follow ? r.follow.bytes : r.bytes}B  ${r.follow ? r.follow.finalUrl : r.finalUrl}`);
}
console.log("\n=== 重定向后落到别处（软 404 的另一种）===");
for (const r of redirectHome) {
  console.log(`  ${r.domain}: ${r.status}${r.follow ? "→" + r.follow.status : ""} ${r.follow ? r.follow.finalUrl : r.location || ""}`);
}
console.log("\n=== 被挡，无法判定（不可当成「没有」）===");
for (const r of otherStatus) {
  console.log(`  ${r.domain}: ${r.status}${r.follow ? "→" + r.follow.status : ""} ${r.follow ? r.follow.finalUrl : ""}`);
}

console.log(`\n=== 内容结构（仅 ${real.length} 个采用者）===`);
const anas = real.map((r) => ({ domain: r.domain, ...analyse(bodyOf(r)) }));
const cnt = (f) => anas.filter(f).length;
console.log(`有 H1: ${cnt((a) => a.hasH1)}/${anas.length}`);
console.log(`文件第一行就是 H1: ${cnt((a) => a.startsWithH1)}/${anas.length}`);
console.log(`有 ## 分节: ${cnt((a) => a.sectionCount > 0)}/${anas.length}`);
console.log(`有 Optional 节: ${cnt((a) => a.hasOptional)}/${anas.length}`);
console.log(`含 markdown 链接: ${cnt((a) => a.linkCount > 0)}/${anas.length}`);
console.log(`正文提到 llms.txt 自身: ${cnt((a) => a.hasSelfReference)}/${anas.length}`);
console.log(`开头有 UTF-8 BOM: ${cnt((a) => a.bom)}/${anas.length} → ${anas.filter((a) => a.bom).map((a) => a.domain).join(", ")}`);
console.log(`有引用块简介: ${cnt((a) => a.hasBlockquote)}/${anas.length}`);
if (anas.length) {
  const over100k = anas.filter((a) => a.bytes > 100000);
  console.log(`超过 100KB 的: ${over100k.length} → ${over100k.map((a) => a.domain + " " + a.bytes + "B").join(", ")}`);
  const withoutOutlier = anas.filter((a) => a.bytes <= 100000);
  const sizes = anas.map((a) => a.bytes).sort((x, y) => x - y);
  const links = anas.map((a) => a.linkCount).sort((x, y) => x - y);
  const med = (arr) => arr[Math.floor(arr.length / 2)];
  console.log(`字节数: min=${sizes[0]} 中位=${med(sizes)} max=${sizes[sizes.length - 1]}`);
  console.log(`链接数: min=${links[0]} 中位=${med(links)} max=${links[links.length - 1]}`);
}

// 分类口径与 scripts/survey-domains.mjs 里的注释分组一致（手工归类，非随机抽样）。
const CATEGORY = {
  "news": ["nytimes.com", "theguardian.com", "bbc.com", "cnn.com", "reuters.com", "washingtonpost.com", "forbes.com", "bloomberg.com"],
  "ecommerce": ["amazon.com", "ebay.com", "etsy.com", "shopify.com", "walmart.com", "target.com"],
  "saas": ["github.com", "gitlab.com", "atlassian.com", "slack.com", "notion.so", "figma.com", "zoom.us", "asana.com", "trello.com"],
  "social": ["reddit.com", "x.com", "linkedin.com", "pinterest.com", "tumblr.com", "quora.com"],
  "dev": ["stackoverflow.com", "npmjs.com", "docker.com", "kubernetes.io", "python.org", "nodejs.org", "rust-lang.org", "go.dev", "developer.mozilla.org"],
  "streaming": ["youtube.com", "spotify.com", "netflix.com", "twitch.tv", "vimeo.com"],
  "reference": ["wikipedia.org", "mozilla.org", "w3.org", "archive.org", "wikimedia.org"],
  "seo": ["ahrefs.com", "moz.com", "semrush.com", "screamingfrog.co.uk", "yoast.com", "searchenginejournal.com", "searchengineland.com"],
  "edu": ["mit.edu", "harvard.edu", "stanford.edu", "khanacademy.org", "coursera.org"],
  "finance": ["stripe.com", "paypal.com", "coinbase.com", "wise.com", "squareup.com"],
  "cloud": ["cloudflare.com", "vercel.com", "netlify.com", "digitalocean.com", "heroku.com"],
  "local": ["airbnb.com", "booking.com", "uber.com", "doordash.com", "yelp.com"],
  "gov": ["nih.gov", "cdc.gov", "who.int"],
};
console.log("\n=== 分类采用率 ===");
const byDomain = new Map(results.map((r) => [r.domain, r]));
for (const [cat, list] of Object.entries(CATEGORY)) {
  const rs = list.map((d) => byDomain.get(d)).filter(Boolean);
  const yes = rs.filter((r) => r.verdict === "adopted");
  const no = rs.filter((r) => r.verdict === "not-found");
  const blocked = rs.filter((r) => r.verdict === "other");
  console.log(
    `  ${cat.padEnd(10)} ${String(yes.length).padStart(2)}/${String(rs.length).padEnd(2)} ` +
      `采用=${yes.length} 404=${no.length} 软404=${rs.length - yes.length - no.length - blocked.length} 无法判定=${blocked.length}` +
      (yes.length ? `  [${yes.map((r) => r.domain).join(", ")}]` : "")
  );
}

console.log("\n=== 分节标题（出现过的名字）===");
const nameCount = new Map();
for (const a of anas) for (const s of a.sectionNames) nameCount.set(s, (nameCount.get(s) || 0) + 1);
[...nameCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  ${c}x  ${n}`));

console.log("\n=== llms-full.txt（只对已采用的站探）===");
const withFull = real.filter((r) => r.full);
const fullOk = withFull.filter((r) => r.full.status === 200 && r.full.samePath && r.full.kind === "text");
console.log(`已探: ${withFull.length}/${real.length}   200 且是真文本: ${fullOk.length}`);
for (const r of fullOk) console.log(`  ${r.domain}: ${r.full.bytes}B  ${r.full.finalUrl}`);
