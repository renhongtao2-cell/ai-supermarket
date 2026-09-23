// AI 爬虫在 robots.txt 里的待遇 —— 实地调查。
//
// 用途：为 SerpPrism 产出「原创数据」型深度指南（robots.txt 系列第三篇）。
//   前两篇分别测过：sitemap 声明现状、首页 JSON-LD 现状。本篇测 AI 爬虫策略。
//   数据可复现：脚本 + 域名列表都在仓库里。
//   node scripts/survey-aicrawlers.mjs            # 抓取 + 统计
//   node scripts/survey-aicrawlers.mjs --report   # 只读上次落盘结果，重新统计（不联网）
//
// 为什么用 curl 而不是 fetch：本机在中国网络环境，直连常被墙，
// curl 读 HTTP_PROXY 而 Node 的 fetch(undici) 不读。两级降级：先直连，失败再走本地代理。
// ⚠️ `-x` 必须传代理 URL 字符串，传布尔值会被 execFile 转成 "true"，curl 报 exit 5。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { DOMAINS, PROXY, UA } from "./survey-domains.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "aicrawler-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");
const MARK = "\n__SPMETA__";

function curlOnce(url, { proxy }) {
  const args = [
    "-sSL", "--max-time", "25", "--connect-timeout", "10",
    "-A", UA, "-H", "Accept: text/plain,*/*",
    "-w", MARK + "%{http_code}",
  ];
  if (proxy) args.push("-x", proxy);
  else args.push("--noproxy", "*");
  args.push(url);
  return new Promise((resolve) => {
    execFile("curl", args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ status: null, body: "", error: String(err.code || err.message) });
      const i = stdout.lastIndexOf(MARK);
      if (i === -1) return resolve({ status: null, body: stdout, error: "no-status" });
      resolve({ status: Number(stdout.slice(i + MARK.length).trim()), body: stdout.slice(0, i), error: null });
    });
  });
}

async function fetchOne(domain) {
  const url = `https://${domain}/robots.txt`;
  const rec = { domain, url, status: null, bytes: 0, channel: null, error: null, body: "" };
  let r = await curlOnce(url, { proxy: null });
  if (r.status === 200 && r.body.trim()) {
    rec.status = r.status; rec.body = r.body; rec.channel = "direct";
  } else {
    const p = await curlOnce(url, { proxy: PROXY });
    if (p.status === 200 && p.body.trim()) {
      rec.status = p.status; rec.body = p.body; rec.channel = "proxy";
    } else {
      rec.status = p.status ?? r.status;
      rec.error = p.error || r.error || (r.status ? `http ${r.status}` : "unreachable");
      rec.body = p.body || r.body || "";
      rec.channel = p.status ? "proxy" : r.status ? "direct" : null;
    }
  }
  rec.bytes = Buffer.byteLength(rec.body, "utf8");
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

let results;
if (process.argv.includes("--report")) {
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
} else {
  process.stderr.write("fetching ");
  results = await pool(DOMAINS, 12, fetchOne);
  process.stderr.write("\n");
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
}

/* ---- 爬虫清单 ----
   只列真实存在的 UA token（小写，robots.txt 的 UA 匹配按 Google 口径是大小写不敏感的）。
   vendor 用于后面做「同一家多个爬虫」的对比。 */
const CRAWLERS = [
  ["GPTBot", "OpenAI"],
  ["OAI-SearchBot", "OpenAI"],
  ["ChatGPT-User", "OpenAI"],
  ["ClaudeBot", "Anthropic"],
  ["anthropic-ai", "Anthropic"],
  ["Claude-User", "Anthropic"],
  ["Claude-SearchBot", "Anthropic"],
  ["PerplexityBot", "Perplexity"],
  ["Perplexity-User", "Perplexity"],
  ["Google-Extended", "Google"],
  ["CCBot", "Common Crawl"],
  ["Bytespider", "ByteDance"],
  ["Applebot-Extended", "Apple"],
  ["meta-externalagent", "Meta"],
  ["Amazonbot", "Amazon"],
  ["Diffbot", "Diffbot"],
  ["Timpibot", "Timpi"],
  ["ImagesiftBot", "Hive"],
  ["cohere-ai", "Cohere"],
  ["omgili", "Webz.io"],
  ["YouBot", "You.com"],
  ["AI2Bot", "AI2"],
];
const UA_KEYS = CRAWLERS.map(([c]) => c.toLowerCase());

/* ---- 疑似写错的 token ----
   这些不是任何爬虫的真实 UA token（或不是该厂商的完整 token），
   写了等于没写：爬虫不会匹配它，规则永远不会生效。
   ⚠️ 命中后必须打印原文人工复核 —— 列表里 "ai" / "bot" 这种泛词有误报风险。 */
const SUSPECT_TOKENS = [
  "openai", "chatgpt", "chat-gpt", "claude", "anthropic", "gpt", "gpt-4",
  "gemini", "bard", "ai", "bot", "aicrawler", "ai-crawler", "airobot",
  "cc-bot", "ccbot2", "perplexity", "byte-spider", "bytespider2",
];

/* ---- 解析 ----
   ⚠️ 一律先 split 成行再逐行匹配，绝不能让 \s 跨行。
   前两次调查各自造出 6 条和 25 条「看起来完全合理」的误报，全是因为 \s 吃掉了换行。 */
function parseRobots(body) {
  const lines = body.split(/\r?\n/);
  const groups = new Map(); // ua(小写) -> { allow[], disallow[], crawlDelay }
  const uaLines = [];       // 原始 User-agent 行，用于排查 token 拼写
  let cur = null;
  let inUaRun = false;
  for (const raw of lines) {
    const line = raw.replace(/^\uFEFF/, "").replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)[ \t]*:[ \t]*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      const ua = val.toLowerCase();
      uaLines.push(val);
      if (!inUaRun) { cur = []; inUaRun = true; }
      cur.push(ua);
      if (!groups.has(ua)) groups.set(ua, { allow: [], disallow: [], crawlDelay: false });
      continue;
    }
    if (cur) {
      for (const ua of cur) {
        const g = groups.get(ua);
        if (!g) continue;
        if (key === "disallow" && val) g.disallow.push(val);
        else if (key === "allow" && val) g.allow.push(val);
        else if (key === "crawl-delay") g.crawlDelay = true;
      }
    }
    inUaRun = false;
  }
  return { groups, uaLines };
}

function robotsMatch(pattern, pathname) {
  let s = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  if (s.endsWith("$")) s = s.slice(0, -1) + "$";
  else s += ".*";
  try { return new RegExp("^" + s).test(pathname); } catch { return false; }
}

// 最具体（最长）规则胜出；等长时 Allow 赢。这是 Google 的口径。
function isAllowed(group, pathname) {
  if (!group) return true;
  const rules = [
    ...group.disallow.map((d) => [d, false]),
    ...group.allow.map((a) => [a, true]),
  ];
  let best = null;
  for (const [pat, allow] of rules) {
    if (!robotsMatch(pat, pathname)) continue;
    const len = pat.replace(/[*$]/g, "").length;
    if (!best || len > best.len || (len === best.len && allow && !best.allow)) best = { len, allow };
  }
  return best ? best.allow : true;
}

// 判定：blocked = 根路径被挡；partial = 有具体 disallow 但根路径放行；allowed = 其余
function verdict(group) {
  if (!group) return "allowed";
  if (!isAllowed(group, "/")) return "blocked";
  if (group.disallow.length > 0) return "partial";
  return "allowed";
}

const rows = results.map((r) => {
  const b = r.body || "";
  const isHtml = /^\s*(<!doctype|<html|<\?xml)/i.test(b);
  const { groups, uaLines } = parseRobots(b);
  const star = groups.get("*");
  const per = {};
  const explicit = {};
  for (const [crawler] of CRAWLERS) {
    const k = crawler.toLowerCase();
    const own = groups.get(k);
    // 爬虫没专属分组时，回落 * 组（robots.txt 的规则：没匹配就用 *）
    const eff = own || star;
    per[crawler] = verdict(eff);
    explicit[crawler] = Boolean(own);
  }
  const mentioned = UA_KEYS.filter((k) => groups.has(k));
  // 疑似写错：只在 User-agent 行里找，且必须整行完全等于该 token（避免把 "GPTBot" 误判）
  const suspects = [];
  for (const raw of uaLines) {
    const low = raw.trim().toLowerCase();
    if (UA_KEYS.includes(low)) continue;      // 是真实 token，跳过
    if (!SUSPECT_TOKENS.includes(low)) continue;
    suspects.push(raw.trim());
  }
  return {
    domain: r.domain,
    channel: r.channel,
    status: r.status,
    err: r.error,
    bytes: r.bytes,
    isHtml,
    groupCount: groups.size,
    hasStar: Boolean(star),
    per,
    explicit,
    mentioned,
    suspects,
    anyAi: mentioned.length > 0,
    aiCount: mentioned.length,
    starVerdict: verdict(star),
    googlebot: verdict(groups.get("googlebot") || star),
    googlebotExplicit: Boolean(groups.get("googlebot")),
    // AI 爬虫专属的 Crawl-delay（* 组的不算，那是给所有人的）
    aiCrawlDelay: CRAWLERS.filter(([c]) => groups.get(c.toLowerCase())?.crawlDelay).map(([c]) => c),
  };
});

const ok = rows.filter((r) => r.status === 200 && !r.isHtml && r.bytes > 0);
const pct = (n, d = ok.length) => `${n}/${d} (${Math.round((n / d) * 100)}%)`;

fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));

console.log("=== 总览 ===");
console.log(JSON.stringify({
  域名数: rows.length,
  拿到正文: ok.length,
  直连: ok.filter((r) => r.channel === "direct").length,
  代理: ok.filter((r) => r.channel === "proxy").length,
  "200 但返回 HTML": rows.filter((r) => r.status === 200 && r.isHtml).length,
  抓不到: rows.filter((r) => !(r.status === 200 && r.bytes > 0)).length,
  完全没提AI爬虫: pct(ok.filter((r) => !r.anyAi).length),
  至少提一个AI爬虫: pct(ok.filter((r) => r.anyAi).length),
}, null, 2));

console.log("\n=== 每个爬虫：显式分组数 / 被挡数（含回落 * 组） ===");
const stats = CRAWLERS.map(([c, v]) => {
  const ex = ok.filter((r) => r.explicit[c]).length;
  const blocked = ok.filter((r) => r.per[c] === "blocked").length;
  const blockedExplicit = ok.filter((r) => r.explicit[c] && r.per[c] === "blocked").length;
  return { crawler: c, vendor: v, explicitGroups: ex, blocked, blockedExplicit };
});
stats.sort((a, b) => b.blocked - a.blocked || b.explicitGroups - a.explicitGroups);
for (const s of stats) {
  console.log(`  ${s.crawler.padEnd(20)} 显式分组 ${String(s.explicitGroups).padStart(2)}  被挡 ${String(s.blocked).padStart(2)} (${Math.round((s.blocked / ok.length) * 100)}%)  其中显式 ${s.blockedExplicit}  厂商 ${s.vendor}`);
}

console.log("\n=== 提了 AI 爬虫的站点（按条数降序） ===");
ok.filter((r) => r.anyAi).sort((a, b) => b.aiCount - a.aiCount)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.aiCount} 个: ${r.mentioned.join(", ")}`));

console.log(`\n=== 完全没提任何 AI 爬虫 (${ok.filter((r) => !r.anyAi).length}) ===`);
ok.filter((r) => !r.anyAi).forEach((r) => console.log("  " + r.domain));

// 同一家厂商多爬虫之间的不一致：挡了 A 没挡 B
console.log("\n=== OpenAI 内部不一致（挡了 GPTBot 系列之一，没挡另一个） ===");
ok.filter((r) => r.anyAi).forEach((r) => {
  const o = ["GPTBot", "OAI-SearchBot", "ChatGPT-User"].map((c) => `${c}=${r.per[c]}`);
  const vals = new Set(["GPTBot", "OAI-SearchBot", "ChatGPT-User"].map((c) => r.per[c]));
  if (vals.size > 1) console.log(`  ${r.domain.padEnd(24)} ${o.join("  ")}`);
});

console.log("\n=== 挡了 GPTBot 但放行 ClaudeBot ===");
ok.filter((r) => r.per.GPTBot === "blocked" && r.per.ClaudeBot !== "blocked")
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} GPTBot=${r.per.GPTBot}  ClaudeBot=${r.per.ClaudeBot}(显式:${r.explicit.ClaudeBot})`));

console.log("\n=== 挡了 ClaudeBot 但放行 GPTBot ===");
ok.filter((r) => r.per.ClaudeBot === "blocked" && r.per.GPTBot !== "blocked")
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} ClaudeBot=${r.per.ClaudeBot}  GPTBot=${r.per.GPTBot}(显式:${r.explicit.GPTBot})`));

console.log("\n=== Google-Extended ===");
ok.filter((r) => r.explicit["Google-Extended"])
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} Google-Extended=${r.per["Google-Extended"]}  Googlebot=${r.googlebot}(显式:${r.googlebotExplicit})`));
console.log("  挡了 Googlebot 的站点: " + (ok.filter((r) => r.googlebot === "blocked").map((r) => r.domain).join(", ") || "无"));

console.log("\n=== 疑似写错的 UA token（必须人工复核原文） ===");
const suspectHits = ok.filter((r) => r.suspects.length > 0);
suspectHits.forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.suspects.join(" | ")}`));
console.log(`  合计 ${suspectHits.length} 个站`);

console.log("\n=== AI 爬虫专属 Crawl-delay ===");
ok.filter((r) => r.aiCrawlDelay.length > 0)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} ${r.aiCrawlDelay.join(", ")}`));

console.log("\n=== * 组全站 Disallow: / （AI 爬虫被顺带挡掉，非显式声明） ===");
ok.filter((r) => r.starVerdict === "blocked" && r.per.GPTBot === "blocked" && !r.explicit.GPTBot)
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} 分组数=${r.groupCount}`));

console.log("\n=== 抓不到 / 返回 HTML ===");
rows.filter((r) => !(r.status === 200 && !r.isHtml && r.bytes > 0))
  .forEach((r) => console.log(`  ${r.domain.padEnd(24)} status=${r.status} html=${r.isHtml} err=${r.err || ""} bytes=${r.bytes}`));
