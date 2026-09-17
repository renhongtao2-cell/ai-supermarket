// check-catalog-content.mjs — ai.toolboxes.top 内容闸门
//
// 收敛（221 薄页 → 21 深度页）之后，这个脚本防止站点悄悄退回薄内容状态。
// 挂在 .workbuddy/cf-deploy.js 里，不过就中止部署。
//
// 断言：
//   1. 应有的页面都存在，且都在 sitemap 里
//   2. 内容页有 AdSense 代码；404 页没有（AdSense 政策：错误页不得放广告）
//   3. canonical 自指（多域名场景下指错 = 永不独立收录）
//   4. 正文字数下限
//   5. 没有任何活页链接到已删除的 /tool/ 路径
//   6. _redirects 里每条 301 的目标页真实存在
//   7. HTML 标签平衡（先剥掉 <style>/<script> 内容，否则 CSS 注释里的 "<html>" 会误报）
//
// 运行：node scripts/check-catalog-content.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://ai.toolboxes.top";
const ADS = "adsbygoogle.js?client=ca-pub-9901133369141996";

const { DEPARTMENTS, TOOLS } = new Function(
  fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\n;return { DEPARTMENTS, TOOLS };"
)();

const fails = [];
const fail = (m) => { fails.push(m); console.log("  ✗ " + m); };
const ok = (m) => console.log("  ✓ " + m);

/* ---------- 工具函数 ---------- */
const strip = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
   .replace(/<style[\s\S]*?<\/style>/gi, " ")
   .replace(/<[^>]+>/g, " ")
   .replace(/&[a-z#0-9]+;/gi, " ");
const words = (h) => strip(h).split(/\s+/).filter((x) => x.length > 1).length;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ---------- 期望的页面集合 ---------- */
const PAGES = [
  { file: "index.html", url: "/", min: 1500, kind: "home" },
  ...DEPARTMENTS.map((d) => ({ file: `departments/${d.id}.html`, url: `/departments/${d.id}`, min: 700, kind: "dept" })),
  { file: "best/free-ai-tools.html", url: "/best/free-ai-tools", min: 700, kind: "best" },
  { file: "best/ai-tools-with-free-tier.html", url: "/best/ai-tools-with-free-tier", min: 700, kind: "best" },
  { file: "guides/how-to-choose-an-ai-tool.html", url: "/guides/how-to-choose-an-ai-tool", min: 700, kind: "guide" },
  { file: "about.html", url: "/about", min: 400, kind: "static" },
  { file: "privacy.html", url: "/privacy", min: 300, kind: "static" },
];

console.log("\n[1] 页面存在性 / 广告代码 / canonical / 字数");
const sitemap = read("sitemap.xml");
const smUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
let totalWords = 0;

for (const p of PAGES) {
  const abs = path.join(ROOT, p.file);
  if (!fs.existsSync(abs)) { fail(`缺少页面 ${p.file}`); continue; }
  const h = read(p.file);
  const w = words(h);
  totalWords += w;
  const canon = (h.match(/rel="canonical" href="([^"]+)"/) || [])[1];
  const ads = h.includes(ADS);

  if (!ads) fail(`${p.file}: 缺 AdSense 代码`);
  if (canon !== SITE + p.url) fail(`${p.file}: canonical 非自指 (${canon || "缺失"})`);
  if (w < p.min) fail(`${p.file}: 正文 ${w} 词 < 下限 ${p.min}`);
  if (!smUrls.has(SITE + p.url)) fail(`${p.file}: 不在 sitemap.xml 里`);
  if (fs.existsSync(abs) && !fails.some((f) => f.startsWith(p.file + ":"))) {
    ok(`${p.file.padEnd(42)} ${String(w).padStart(5)} 词`);
  }
}
console.log(`  内容页正文合计 ${totalWords} 词 / ${PAGES.length} 页`);

console.log("\n[2] 404 页：真实 404 且不含广告代码");
{
  const h = read("404.html");
  if (h.includes(ADS)) fail("404.html 含 AdSense 代码（政策禁止错误页放广告）");
  else ok("404.html 无广告代码");
  if (!/noindex/.test(h)) fail("404.html 缺 noindex");
  else ok("404.html 带 noindex");
}

console.log("\n[3] 无活页链接到已删除的 /tool/ 路径");
{
  const files = [
    "index.html", "about.html", "privacy.html", "404.html", "sitemap.xml", "llms.txt", "robots.txt",
    "js/app.js", "js/data.js",
    ...DEPARTMENTS.map((d) => `departments/${d.id}.html`),
    "best/free-ai-tools.html", "best/ai-tools-with-free-tier.html",
    "guides/how-to-choose-an-ai-tool.html",
  ];
  let bad = 0;
  // 只抓"链接"，不抓散文里提到 /tool/ 的句子
  //   href="/tool/... | href="https://ai.toolboxes.top/tool/... | ](/tool/... | <loc>.../tool/...
  const TOOL_LINK = /(?:href="|\]\()(?:https?:\/\/ai\.toolboxes\.top)?\/tool\/|<loc>[^<]*\/tool\//g;
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    const hits = (read(f).match(TOOL_LINK) || []).length;
    if (hits) { fail(`${f} 仍有 ${hits} 处指向已删除 /tool/ 页面的链接`); bad++; }
  }
  if (!bad) ok(`${files.length} 个文件全部干净（/tool/ 只应出现在 _redirects）`);
}

console.log("\n[4] _redirects：规则数 + 目标页真实存在");
{
  const r = read("_redirects");
  const rules = r.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  const explicit = rules.filter((l) => /^\/tool\/[a-z0-9-]+\s/.test(l));
  if (explicit.length !== TOOLS.length) {
    fail(`_redirects 显式规则 ${explicit.length} 条，应为 ${TOOLS.length} 条（每个旧工具页一条）`);
  } else ok(`${explicit.length} 条 /tool/<slug> 301 规则`);

  // 每条目标必须是存在的页面
  const targets = new Set();
  let badTarget = 0;
  for (const l of rules) {
    const parts = l.trim().split(/\s+/);
    const to = parts[1];
    if (!to || !to.startsWith("/")) continue;
    if (to.includes(":")) continue; // splat 通配，跳过
    targets.add(to);
  }
  for (const t of targets) {
    const f = t === "/" ? "index.html" : t.replace(/^\//, "") + ".html";
    if (!fs.existsSync(path.join(ROOT, f))) { fail(`_redirects 目标页不存在: ${t} → ${f}`); badTarget++; }
  }
  if (!badTarget) ok(`${targets.size} 个不同目标页全部存在`);
}

console.log("\n[5] sitemap 无死链");
{
  let bad = 0;
  for (const u of smUrls) {
    const rel = u.replace(SITE, "").replace(/^\//, "");
    const f = rel === "" ? "index.html" : rel + ".html";
    if (!fs.existsSync(path.join(ROOT, f))) { fail(`sitemap 指向不存在的页面: ${u}`); bad++; }
  }
  if (!bad) ok(`sitemap ${smUrls.size} 条 URL 全部有对应文件`);
  if (smUrls.size !== PAGES.length) fail(`sitemap 有 ${smUrls.size} 条，期望 ${PAGES.length} 条`);
}

console.log("\n[6] HTML 标签平衡（已剥离 style/script 内容）");
{
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const files = [
    "index.html", "about.html", "privacy.html", "404.html",
    ...DEPARTMENTS.map((d) => `departments/${d.id}.html`),
    "best/free-ai-tools.html", "best/ai-tools-with-free-tier.html",
    "guides/how-to-choose-an-ai-tool.html",
  ];
  let bad = 0;
  for (const f of files) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    // 关键：先剥掉 style/script 内容与 data-URI 图标行，否则会误报
    let h = read(f)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<link rel="icon"[^\n]*>/g, "");
    const stack = [];
    let broken = null;
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
    let m;
    while ((m = re.exec(h))) {
      const close = m[1] === "/", tag = m[2].toLowerCase(), self = m[3] === "/";
      if (VOID.has(tag) || self) continue;
      if (!close) stack.push(tag);
      else {
        const t = stack.pop();
        if (t !== tag) { broken = `期望 </${t}> 实得 </${tag}>`; break; }
      }
    }
    if (!broken && stack.length) broken = `未闭合: ${stack.join(",")}`;
    if (broken) { fail(`${f}: ${broken}`); bad++; }
  }
  if (!bad) ok(`${files.length} 个页面标签全部平衡`);
}

/* ---------- 汇总 ---------- */
console.log("\n" + "─".repeat(60));
if (fails.length) {
  console.log(`内容闸门未通过：${fails.length} 项失败`);
  process.exit(1);
}
console.log(`内容闸门通过：${PAGES.length} 个内容页 / ${TOOLS.length} 工具 / ${DEPARTMENTS.length} 部门`);
