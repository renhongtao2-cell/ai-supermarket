// check-seosite.mjs — SerpPrism 生成后的硬闸门
//
// 与 check-toolsite-content.mjs 同一套口径，改一处就要过一遍：
//   [1] 每个页面正文词数 ≥ MIN_WORDS（薄内容是 AdSense 拒审的头号原因）
//   [2] 每个 JSON-LD 块必须能 JSON.parse（坏的结构化数据等于没有）
//   [3] 每个页面必须有 canonical
//   [4] 站内不能有死链
//   [5] sitemap 里的每条 URL 都必须真实存在且带 canonical
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

  const flag = applies(f) && n < MIN_WORDS ? "  ⚠️" : "";
  console.log(f.padEnd(36) + String(n).padStart(4) + "  " + ldNote.padEnd(9) + can.replace(SITE, "") + flag);
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
console.log(`页面 ${files.length} · sitemap ${locs.length} 条 · 死链 ${dead} · 问题 ${problems.length}`);

if (problems.length) {
  console.error("\n❌ 闸门未通过：");
  for (const p of problems) console.error("   - " + p);
  process.exit(1);
}
console.log("✅ OK — all checks passed");
