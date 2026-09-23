// robots.txt 实地调查 —— 抓一批高流量站点的 robots.txt，统计真实使用情况。
//
// 用途：为 SerpPrism 产出「原创数据」型深度指南。数据可复现：脚本 + 域名列表都在仓库里。
//   node scripts/survey-robots.mjs            # 抓取 + 统计
//   node scripts/survey-robots.mjs --report   # 只读上次落盘结果，重新统计（不联网）
//
// 为什么用 curl 而不是 fetch：
//   本机在中国网络环境，直连被墙。curl 会读 HTTP_PROXY，而 Node 的 fetch(undici) 不读，
//   所以「curl 能通、fetch 超时」是正常现象，不是站点问题。
//   这里做两级降级：先直连（住宅 IP 能过一部分 Cloudflare），失败再走本地代理。
//   ⚠️ 代理出口 IP 常被 Cloudflare 403，所以直连优先。
//   每条记录都会写明用了哪个通道，报告里必须如实交代。
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const ROOT = process.cwd();
const OUT = path.join(ROOT, ".workbuddy", "tmp", "robots-survey");
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, "raw.json");
// 域名列表 / 代理 / UA 都在 scripts/survey-domains.mjs（两个调查脚本共用，避免漂移）

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
  // 一级：直连
  let r = await curlOnce(url, { proxy: null });
  if (r.status === 200 && r.body.trim()) {
    rec.status = r.status; rec.body = r.body; rec.channel = "direct";
  } else {
    // 二级：本地代理
    // ⚠️ 这里必须传 PROXY 字符串本身，不能传 true ——
    // 传布尔值会被 execFile 转成字符串 "true"，curl 收到 `-x true` 直接报
    // exit 5「couldn't resolve proxy」，表现为「代理通道永远 0 成功」。
    const p = await curlOnce(url, { proxy: PROXY });
    if (p.status === 200 && p.body.trim()) {
      rec.status = p.status; rec.body = p.body; rec.channel = "proxy";
    } else {
      // 两级都拿不到正文：记录最能说明问题的那个状态
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
  // 增量落盘：每轮全量覆盖（这里每站只抓一次，不存在「劣质抓取覆盖好缓存」的问题）
  fs.writeFileSync(RAW, JSON.stringify(results, null, 1));
}

// ---- 分析 ----
// ⚠️ 解析必须逐行做，绝不能让正则跨行。
// 踩过的坑：原来用 /^\s*disallow\s*:\s*.*sitemap/im 直接扫整个 body，
// 报出「6 个站 disallow 了自己的 sitemap」，**6 条全是误报** ——
// 因为 \s 包含换行，空值的 `Disallow:` 行后面的换行被 \s* 吃掉，
// 接着 `.*` 匹配到了下一行的 `Sitemap:` 文本。
// 教训：robots.txt 一律先 split 成行再逐行匹配；\s* 只用在行内。
function parseRobots(body) {
  const lines = body.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups = new Map(); // ua -> { allow[], disallow[], crawlDelay }
  const sitemaps = [];      // Sitemap 是全局指令，不属于任何 UA 块
  let cur = null;           // 当前 UA 块包含的 ua 名（连续的多个 User-agent 行同属一块）
  let inUaRun = false;
  for (const line of lines) {
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)[ \t]*:[ \t]*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "sitemap") { if (val) sitemaps.push(val); inUaRun = false; continue; }
    if (key === "user-agent") {
      const ua = val.toLowerCase();
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
  const EMPTY = { allow: [], disallow: [], crawlDelay: false };
  return {
    sitemaps,
    // Googlebot 优先用自己那一组，没有才回落到 * 组
    effective: groups.get("googlebot") || groups.get("*") || EMPTY,
    star: groups.get("*") || EMPTY,
    hasUaStar: groups.has("*"),
    groupCount: groups.size,
    contentLines: lines.filter(Boolean).length,
  };
}

// 按 Google 的规则判定某路径是否被允许：最具体的（最长）匹配规则胜出；等长时 Allow 赢。
function isAllowed(rules, pathname) {
  let best = null;
  for (const [pat, allow] of rules) {
    if (!robotsMatch(pat, pathname)) continue;
    const len = pat.replace(/[*$]/g, "").length;
    if (!best || len > best.len || (len === best.len && allow && !best.allow)) best = { len, allow };
  }
  return best ? best.allow : true;
}

// robots.txt 路径匹配：前缀匹配，* 通配，$ 结尾锚定。
function robotsMatch(pattern, pathname) {
  let s = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  if (s.endsWith("$")) s = s.slice(0, -1) + "$";
  else s += ".*";
  try { return new RegExp("^" + s).test(pathname); } catch { return false; }
}

const rows = results.map((r) => {
  const b = r.body || "";
  const isHtml = /^\s*(<!doctype|<html|<\?xml)/i.test(b);
  const p = parseRobots(b);
  const bare = r.domain.replace(/^www\./, "");
  // 真正判断「声明的 sitemap 会不会被自己的 disallow 挡住」：
  // 拿每个 sitemap URL 的 pathname 去逐条 disallow 试匹配，而不是看有没有 "sitemap" 字样。
  // 只在 Googlebot 实际生效的那一组规则里试匹配。
  // ⚠️ 不能把全站 disallow 一把抓 —— 那样会把只针对爬虫的 `Disallow: /` 也算进来，
  // 实测误报 25 条「自己的 sitemap 被自己挡住」。
  const rules = [
    ...p.effective.disallow.map((d) => [d, false]),
    ...p.effective.allow.map((a) => [a, true]),
  ];
  const blocked = [];
  for (const sm of p.sitemaps) {
    let pathname;
    try { pathname = new URL(sm).pathname; } catch { continue; }
    if (isAllowed(rules, pathname)) continue;
    const hit = rules
      .filter(([pat]) => robotsMatch(pat, pathname))
      .sort((a, b) => b[0].length - a[0].length)[0];
    blocked.push(`${hit ? hit[0] : "?"} 挡住 ${pathname}`);
  }
  return {
    domain: r.domain,
    channel: r.channel,
    status: r.status,
    err: r.error,
    bytes: r.bytes,
    isHtml,
    hasUaStar: p.hasUaStar,
    sitemapCount: p.sitemaps.length,
    sitemapFirst: p.sitemaps[0] || "",
    httpScheme: p.sitemaps.filter((u) => /^http:\/\//i.test(u)).length,
    hostMismatch: p.sitemaps.filter((u) => {
      try {
        const h = new URL(u).host.replace(/^www\./, "");
        return h !== bare && !h.endsWith("." + bare);
      } catch { return true; }
    }).length,
    sitemapBlocked: blocked.length,
    blockedDetail: blocked.slice(0, 3).join("; "),
    // Crawl-delay 取 * 组：那一组是 Googlebot 的回落组，所以这条指令本意就是给它看的
    crawlDelay: p.star.crawlDelay,
    groupCount: p.groupCount,
    empty: b.trim().length === 0,
    contentLines: p.contentLines,
  };
});

const ok = rows.filter((r) => r.status === 200 && !r.isHtml && r.bytes > 0);
const pct = (n, d) => `${n}/${d} (${Math.round((n / d) * 100)}%)`;
const s = {
  抓取域名数: rows.length,
  拿到正文: ok.length,
  走直连: ok.filter((r) => r.channel === "direct").length,
  走代理: ok.filter((r) => r.channel === "proxy").length,
  "200 但返回 HTML": rows.filter((r) => r.status === 200 && r.isHtml).length,
  非200或抓不到: rows.filter((r) => !(r.status === 200 && r.bytes > 0)).length,
  声明了sitemap: pct(ok.filter((r) => r.sitemapCount > 0).length, ok.length),
  没声明sitemap: pct(ok.filter((r) => r.sitemapCount === 0).length, ok.length),
  声明多个sitemap: ok.filter((r) => r.sitemapCount > 1).length,
  用了http协议: ok.filter((r) => r.httpScheme > 0).length,
  sitemap主机不一致: ok.filter((r) => r.hostMismatch > 0).length,
  disallow了sitemap: ok.filter((r) => r.disallowSitemap).length,
  有crawl_delay: ok.filter((r) => r.crawlDelay).length,
  空文件: ok.filter((r) => r.empty).length,
  没有user_agent星号: ok.filter((r) => !r.hasUaStar).length,
};

fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
fs.writeFileSync(
  path.join(OUT, "rows.tsv"),
  ["domain\tchannel\tstatus\tbytes\thtml\tuaStar\tsitemaps\thttp\tmismatch\tdisallowSitemap\tcrawlDelay\tempty\tfirst"]
    .concat(rows.map((r) => [r.domain, r.channel, r.status, r.bytes, r.isHtml ? 1 : 0, r.hasUaStar ? 1 : 0, r.sitemapCount, r.httpScheme, r.hostMismatch, r.disallowSitemap ? 1 : 0, r.crawlDelay ? 1 : 0, r.empty ? 1 : 0, r.sitemapFirst].join("\t")))
    .join("\n")
);

console.log("=== 总览 ===");
console.log(JSON.stringify(s, null, 2));
const show = (title, list) => {
  console.log(`\n=== ${title} (${list.length}) ===`);
  list.forEach((r) => console.log("  " + r.domain + (r.sitemapFirst ? "  ->  " + r.sitemapFirst : "")));
};
show("没有 sitemap 行", ok.filter((r) => r.sitemapCount === 0));
show("host 与站点不一致", ok.filter((r) => r.hostMismatch > 0));
show("sitemap 用 http://", ok.filter((r) => r.httpScheme > 0));
const bl = ok.filter((r) => r.sitemapBlocked > 0);
console.log(`\n=== 声明的 sitemap 被自己 disallow 挡住 (${bl.length}) ===`);
bl.forEach((r) => console.log("  " + r.domain + "  |  " + r.blockedDetail));
show("有 Crawl-delay（Google 忽略）", ok.filter((r) => r.crawlDelay));
show("200 但返回 HTML", rows.filter((r) => r.status === 200 && r.isHtml));
show("抓不到", rows.filter((r) => !(r.status === 200 && r.bytes > 0)));
