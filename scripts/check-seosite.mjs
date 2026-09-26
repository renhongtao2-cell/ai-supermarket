// check-seosite.mjs — SerpPrism 生成后的硬闸门
//
// 与 check-toolsite-content.mjs 同一套口径，改一处就要过一遍：
//   [1] 每个页面正文词数 ≥ MIN_WORDS（薄内容是 AdSense 拒审的头号原因）
//   [2] 每个 JSON-LD 块必须能 JSON.parse（坏的结构化数据等于没有）
//   [3] 每个页面必须有 canonical
//   [4] 站内不能有死链
//   [5] sitemap 里的每条 URL 都必须真实存在且带 canonical
//   [6] 每个页面的 og:image 必须存在、绝对 URL，且指向的图片文件真实存在
//   [7] 标题层级不能跳级（h2 → h5 这种）
//   [8] canonical 不能指向会被 CF Pages 308 跳掉的 .html 地址
//
// 运行：node scripts/check-seosite.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "seosite");

// 站点 origin 从生成器里读，不在这里硬编码 ——
// 之前这里写死 "https://serpprism.com"，生成器换成 www 之后两边不同步，
// 闸门把所有页面都判成「sitemap URL 无对应文件」。改域名只改 gen-seosite.mjs 一处。
const SITE = (() => {
  const src = fs.readFileSync(path.join(ROOT, "scripts", "gen-seosite.mjs"), "utf8");
  const m = src.match(/^const SITE\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("读不到 gen-seosite.mjs 里的 SITE 常量");
  return m[1].replace(/\/+$/, "");
})();

// 站点词数与 canonical 闸门：tools/ 和 guides/ 下的页面卡 650 词（排名页、审核员会点开），
// 其他"信息型"页面（首页 / about / contact / privacy / 404）只需存在不卡词数。
//
// 特殊豁免：根目录下形如 google<token>.html 的 GSC 站点所有权验证文件
// （token 是 32 位十六进制）—— 这些不是页面，是 Google 用来验证域所有权的
// 静态资源，**不应该**有 canonical / 词数 / JSON-LD。闸门必须跳过它们。
const MIN_WORDS = 650;
const applies = (f) => f.startsWith("tools/") || f.startsWith("guides/");
// title 含品牌后缀，60 字符 ≈ Google 桌面端 ~580px 的截断点；
// description 155 字符 ≈ 920px。留一点余量，超了就是会被截。
const TITLE_MAX = 62;
const DESC_MAX = 160;
const isGscVerify = (f) => /^google[a-f0-9]{16}\.html$/i.test(path.basename(f));

if (!fs.existsSync(OUT)) {
  console.error("❌ seosite/ 不存在，先跑 node scripts/gen-seosite.mjs");
  process.exit(1);
}

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (f.endsWith(".html") && !isGscVerify(f)) files.push(path.relative(OUT, f).split(path.sep).join("/"));
  }
})(OUT);

const wordsOf = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

const problems = [];

/* ---- [1][2][3] 逐页检查 ---- */
console.log("页面".padEnd(36) + "词数  JSON-LD   canonical");
console.log("-".repeat(84));
for (const f of files.slice().sort()) {
  const h = fs.readFileSync(path.join(OUT, f), "utf8");
  const n = wordsOf(h);
  const can = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";

  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let ldNote = "—";
  for (const m of blocks) {
    try {
      const j = JSON.parse(m[1]);
      if (!j["@context"]) throw new Error("no @context");
      ldNote = blocks.length + " ok";
    } catch (e) {
      ldNote = "❌ " + e.message.slice(0, 40);
      problems.push(`${f}: JSON-LD 解析失败 — ${e.message}`);
    }
  }

  if (!can) problems.push(`${f}: 缺少 canonical`);
  if (applies(f) && n < MIN_WORDS) problems.push(`${f}: 正文 ${n} 词 < ${MIN_WORDS}`);

  // title / description 长度：Google 按像素截断，经验值 title ≈60 字符、
  // description ≈155 字符。超了不会报错，只会被截断 —— 属于「看不见的问题」，
  // 所以必须卡在闸门里。（SerpPrism 自己就踩过：7 个 description 超长，
  // 最严重的 196 字符，而站上还有一篇讲这个的指南。）
  const ttl = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const dsc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  if (!ttl) problems.push(`${f}: 缺少 title`);
  else if (ttl.length > TITLE_MAX) problems.push(`${f}: title ${ttl.length} 字符 > ${TITLE_MAX}（会截断）`);
  if (!dsc) problems.push(`${f}: 缺少 description`);
  else if (dsc.length > DESC_MAX) problems.push(`${f}: description ${dsc.length} 字符 > ${DESC_MAX}（会截断）`);
  const h1n = (h.match(/<h1[^>]*>/g) || []).length;
  if (h1n !== 1) problems.push(`${f}: h1 数量 = ${h1n}（应为 1）`);

  const flag = applies(f) && n < MIN_WORDS ? "  ⚠️" : "";
  console.log(f.padEnd(36) + String(n).padStart(4) + "  " + ldNote.padEnd(9) + can.replace(SITE, "") + flag);
}

/* ---- [6] og:image 与 twitter:card ----
   2026-09-23 之前 25/25 个页面都写着 twitter:card=summary_large_image，却一个
   og:image 都没有 —— 分享到 X / Slack / LinkedIn 全是灰框，而本站的
   open-graph-preview 工具正好会把这种组合判成 bad。
   标签由 gen-seosite.mjs 的 ogName() 出，图片由 scripts/gen-og-images.py 的
   og_name() 出：同一套命名规则写了两遍，这条断言是防它们漂移的唯一手段。 */
const OG_DIR = path.join(ROOT, "assets", "og");
let ogCount = 0;
for (const f of files) {
  const h = fs.readFileSync(path.join(OUT, f), "utf8");
  const og = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || "";
  const card = (h.match(/<meta name="twitter:card" content="([^"]+)"/) || [])[1] || "";
  const twImg = (h.match(/<meta name="twitter:image" content="([^"]+)"/) || [])[1] || "";

  if (!og) {
    problems.push(`${f}: 缺少 og:image`);
  } else {
    ogCount++;
    if (!og.startsWith(SITE + "/")) problems.push(`${f}: og:image 不是绝对 URL — ${og}`);
    if (!fs.existsSync(path.join(OG_DIR, path.basename(og)))) {
      problems.push(
        `${f}: og:image 指向的图片不存在 — assets/og/${path.basename(og)}（跑 python scripts/gen-og-images.py）`
      );
    }
  }
  if (card === "summary_large_image" && !og) {
    problems.push(`${f}: twitter:card=summary_large_image 但没有 og:image（渲染成灰框）`);
  }
  if (og && twImg !== og) problems.push(`${f}: twitter:image 与 og:image 不一致`);
  if (!/<meta property="og:image:width" content="1200">/.test(h)) problems.push(`${f}: 缺少 og:image:width`);
  if (!/<meta property="og:image:height" content="630">/.test(h)) problems.push(`${f}: 缺少 og:image:height`);
}

/* ---- [7] 404 页：不得有广告代码，且必须 noindex ----
   AdSense 政策明令禁止在错误页 / 无发布者内容的页面投放广告。
   2026-09-26 实测线上 /zzz-nonexistent 返回 404，页面里却带着
   adsbygoogle.js —— 页面照常渲染、其它检查全过、wrangler 也不报，
   只在人工审核时暴露。这类「静默的政策违规」必须卡在闸门里。

   同时 404 页原先写的是 index, follow（自相矛盾：404 状态码 + 邀请收录）。 */
{
  const p404 = path.join(OUT, "404.html");
  if (!fs.existsSync(p404)) {
    problems.push("404.html: 缺失 —— CF Pages 会退化成 soft-404（不存在的路径返回 200）");
  } else {
    const h = fs.readFileSync(p404, "utf8");
    if (/adsbygoogle|pagead2\.googlesyndication\.com/.test(h))
      problems.push("404.html: 含广告代码 —— AdSense 禁止在错误页投放");
    const rb = (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || "";
    if (!/noindex/.test(rb)) problems.push(`404.html: robots 应为 noindex, follow（现在 "${rb || "缺失"}"）`);
  }
}

/* ---- [7] 标题层级不能跳级 ----
   正文里 h2 直接跳到 h5（或 h1 直接跳到 h3），屏幕阅读器和 outline 工具都会
   当成结构断裂。站上就有一篇讲 heading structure 的指南，自己跳级说不过去。
   先剥掉 <script>/<style>，否则工具页里作为示例出现的标签会被误判。 */
for (const f of files) {
  const h = fs
    .readFileSync(path.join(OUT, f), "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ");
  const levels = [...h.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  let prev = 0;
  for (const lv of levels) {
    if (prev && lv > prev + 1) {
      problems.push(`${f}: 标题跳级 h${prev} → h${lv}`);
      break;
    }
    prev = lv;
  }
}

/* ---- [8] canonical 不能指向会 308 跳转的地址 ----
   CF Pages 的 pretty URL 会把 /x.html 308 跳到 /x。canonical 指向一个 3xx，
   等于让 Google 去收录会跳转的 URL —— 而这类问题线上完全看不出来（页面能打开）。
   2026-09-23 实测：/404.html → 308 → /404，当时 404 页的 canonical 正好写着
   /404.html，全站唯一一个。 */
for (const f of files) {
  const h = fs.readFileSync(path.join(OUT, f), "utf8");
  const can = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";
  if (/\.html$/.test(can)) {
    problems.push(`${f}: canonical 指向 .html（CF Pages 会 308 跳掉）— ${can}`);
  }
}

/* ---- [4] 死链 ---- */
const urlOf = (f) => {
  let u = "/" + f;
  u = u.replace(/index\.html$/, "").replace(/\.html$/, "");
  return u === "/" ? "/" : u.replace(/\/$/, "");
};
const known = new Set(files.map(urlOf));
known.add("/");
let dead = 0;
for (const f of files) {
  const h = fs.readFileSync(path.join(OUT, f), "utf8");
  for (const m of h.matchAll(/href="(\/[^"#?]*?)"/g)) {
    const raw = m[1];
    if (/\.(css|js|txt|xml|png)$/.test(raw)) continue;
    let u = raw.replace(/index\.html$/, "").replace(/\.html$/, "");
    if (u !== "/" && u.endsWith("/")) u = u.slice(0, -1);
    if (!known.has(u)) {
      console.log(`  ❌ 死链 ${f} → ${raw}`);
      problems.push(`${f}: 死链 ${raw}`);
      dead++;
    }
  }
}

/* ---- [5] sitemap 与白名单一致 ---- */
const sm = fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8");
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  const p = loc.replace(SITE, "") || "/";
  const rel = (p === "/" ? "index.html" : p.replace(/^\//, "").replace(/\/$/, "/index.html")).replace(
    /\/(?!.*\/)/,
    "/"
  );
  const cand = p === "/" ? "index.html" : p.replace(/^\//, "") + (p.endsWith("/") ? "index.html" : ".html");
  if (!fs.existsSync(path.join(OUT, cand))) {
    console.log(`  ❌ sitemap 里的 ${loc} 没有对应文件 (${cand})`);
    problems.push(`sitemap: ${loc} 无对应文件`);
  }
}

console.log("-".repeat(84));
console.log(`页面 ${files.length} · sitemap ${locs.length} 条 · 死链 ${dead} · og:image ${ogCount} · 问题 ${problems.length}`);

if (problems.length) {
  console.error("\n❌ 闸门未通过：");
  for (const p of problems) console.error("   - " + p);
  process.exit(1);
}
console.log("✅ OK — all checks passed");
