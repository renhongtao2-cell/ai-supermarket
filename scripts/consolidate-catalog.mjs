// consolidate-catalog.mjs — 221 薄工具页 → 21 深度部门 hub
//
// 做四件事：
//   1. index.html / js/app.js 的卡片链接从站内 /tool/<slug> 改回厂商官网（撤销早期那次改写）
//   2. 生成 _redirects：221 条 /tool/<slug> → 对应部门 hub 的 301
//   3. 重建 sitemap.xml（只留活着的页面）
//   4. 删除 tool/ 目录
//
// 运行：node scripts/consolidate-catalog.mjs [--dry]
import fs from "fs";
import path from "path";
import { UPDATED } from "./site-meta.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://ai.toolboxes.top";
const DRY = process.argv.includes("--dry");

const { DEPARTMENTS, TOOLS } = new Function(
  fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8") + "\n;return { DEPARTMENTS, TOOLS };"
)();

/* ---------- slug（必须与旧 gen-tool-pages.mjs 完全一致，否则 301 对不上） ---------- */
const slugify = (s) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tool";
const used = new Set();
for (const t of TOOLS) {
  let base = slugify(t.name), slug = base;
  if (used.has(slug)) { slug = base + "-" + t.dept; let n = 2; while (used.has(slug)) slug = base + "-" + t.dept + "-" + n++; }
  used.add(slug);
  t._slug = slug;
}
const bySlug = Object.fromEntries(TOOLS.map((t) => [t._slug, t]));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 1. 卡片链接改回厂商官网 ---------- */
const CARD = /<article class="tool-card">[\s\S]*?<\/article>/g;
const report = { cards: 0, visit: 0, unknown: [] };

function revertCards(html, label) {
  let n = 0, v = 0;
  let out = html.replace(CARD, (block) => {
    const m = block.match(/href="\/tool\/([a-z0-9-]+)"/);
    if (!m) return block;
    const t = bySlug[m[1]];
    if (!t) { report.unknown.push(`${label}: ${m[1]}`); return block; }
    let nb = block.replace(`href="/tool/${m[1]}"`, `href="${esc(t.url)}" target="_blank" rel="noopener noreferrer"`);
    nb = nb.replace(/<span class="visit" aria-hidden="true">Details →<\/span>/,
      `<span class="visit" aria-hidden="true">Visit ↗</span>`);
    if (nb !== block) { n++; v++; }
    return nb;
  });
  // 兜底：任何漏网的 /tool/ 链接
  const leftovers = (out.match(/href="\/tool\//g) || []).length;
  report.cards += n; report.visit += v;
  return { out, n, leftovers };
}

const idxPath = path.join(ROOT, "index.html");
const r1 = revertCards(fs.readFileSync(idxPath, "utf8"), "index.html");
if (!DRY) fs.writeFileSync(idxPath, r1.out);
console.log(`index.html : ${r1.n} 张卡片改回官网链接, 残留 /tool/ = ${r1.leftovers}`);

/* app.js：撤销 _slug 垫片，卡片改回官网链接 */
const appPath = path.join(ROOT, "js", "app.js");
let app = fs.readFileSync(appPath, "utf8");
const beforeApp = app;
app = app.replace(/<a class="tool-main" href="\/tool\/\$\{t\._slug\}">/,
  '<a class="tool-main" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">');
app = app.replace(/<span class="visit" aria-hidden="true">Details →<\/span>/,
  '<span class="visit" aria-hidden="true">Visit ↗</span>');
// 移除不再需要的 _slug 计算垫片（整块：slugify + _used + forEach）
app = app.replace(/[ \t]*const slugify = s => s\.toLowerCase\(\)[\s\S]*?t\._slug = s;\s*\}\);\n/, "");
if (!DRY && app !== beforeApp) fs.writeFileSync(appPath, app);
console.log(`js/app.js  : ${app !== beforeApp ? "已撤销 _slug 垫片 + 卡片改回官网" : "无需改动"}`);

/* ---------- 2. _redirects ---------- */
const lines = [
  "# /tool/<slug> → 对应部门 hub（221 条显式规则，顺序优先于下面的通配）",
  ...TOOLS.map((t) => `/tool/${t._slug}    /departments/${t.dept}    301`),
  "",
  "# 兜底：任何其他 /tool/ 路径回首页",
  "/tool/*    /    301",
  "",
  "# 站点改名前的历史路径",
  "/best    /best/ai-tools-with-free-tier    301",
];
const redirectsPath = path.join(ROOT, "_redirects");
if (!DRY) fs.writeFileSync(redirectsPath, lines.join("\n") + "\n");
console.log(`_redirects : ${TOOLS.length} 条显式 301 + 1 条通配兜底`);

/* ---------- 3. sitemap ---------- */
const urls = [
  { loc: "/", pri: "1.0", freq: "weekly" },
  ...DEPARTMENTS.map((d) => ({ loc: `/departments/${d.id}`, pri: "0.9", freq: "monthly" })),
  { loc: "/best/ai-tools-with-free-tier", pri: "0.8", freq: "monthly" },
  { loc: "/best/free-tier-comparison", pri: "0.8", freq: "monthly" },
  { loc: "/best/free-ai-tools", pri: "0.8", freq: "monthly" },
  { loc: "/guides/how-to-choose-an-ai-tool", pri: "0.8", freq: "monthly" },
  { loc: "/about", pri: "0.4", freq: "yearly" },
  { loc: "/privacy", pri: "0.3", freq: "yearly" },
  { loc: "/affiliate-disclosure", pri: "0.3", freq: "yearly" },
];
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join("\n")}
</urlset>
`;
if (!DRY) fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sm);
console.log(`sitemap.xml: ${urls.length} 条 URL（原 243 条）`);

/* ---------- 4. 删除 tool/ ---------- */
const toolDir = path.join(ROOT, "tool");
if (fs.existsSync(toolDir)) {
  const n = fs.readdirSync(toolDir).filter((f) => f.endsWith(".html")).length;
  if (DRY) {
    console.log(`tool/      : [dry-run] 将删除 ${n} 个文件`);
  } else {
    // 先确认备份存在，再删
    const bk = path.join(ROOT, ".workbuddy", "backup-pre-consolidation", "tool");
    if (!fs.existsSync(bk) || fs.readdirSync(bk).filter((f) => f.endsWith(".html")).length !== n) {
      throw new Error(`备份不完整，拒绝删除。backup=${bk}`);
    }
    fs.rmSync(toolDir, { recursive: true, force: true });
    console.log(`tool/      : 已删除 ${n} 个文件（备份在 .workbuddy/backup-pre-consolidation/tool/）`);
  }
} else {
  console.log("tool/      : 不存在（已删除）");
}

if (report.unknown.length) {
  console.log(`\n⚠️  未识别的 slug ${report.unknown.length} 个:`);
  report.unknown.slice(0, 10).forEach((x) => console.log("   " + x));
}
console.log(`\n完成。活页数：1 首页 + ${DEPARTMENTS.length} 部门 + 3 专题 + 2 静态 = ${urls.length}`);
