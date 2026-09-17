// check-free-tier-coverage.mjs — 统计线上部门页「Free tier」列的真实覆盖率
// 用法：node scripts/check-free-tier-coverage.mjs [--local]
//   默认查线上 https://ai.toolboxes.top；--local 查本地 departments/*.html
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOCAL = process.argv.includes("--local");
const ORIGIN = "https://ai.toolboxes.top";

const src = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS } = new Function(src + "\n; return { TOOLS, DEPARTMENTS };")();

const get = async (slug) => {
  if (LOCAL) return fs.readFileSync(path.join(ROOT, "departments", slug + ".html"), "utf8");
  const r = await fetch(`${ORIGIN}/departments/${slug}`);
  return r.text();
};

const rows = (html) => [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
const cells = (row) =>
  [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

let total = 0, filled = 0;
const per = [];
for (const d of DEPARTMENTS) {
  let html;
  try { html = await get(d.id); } catch { continue; }
  const body = rows(html).slice(1); // 去掉表头
  if (!body.length) continue;
  let f = 0;
  for (const r of body) {
    const c = cells(r);
    if (c.length >= 3 && c[2] && c[2] !== "—") f++;
  }
  total += body.length; filled += f;
  per.push({ slug: d.id, f, n: body.length, pct: Math.round((f / body.length) * 100) });
}

per.sort((a, b) => a.pct - b.pct);
console.log(`来源：${LOCAL ? "本地 departments/" : ORIGIN}`);
console.log(`部门页表格行合计 ${total} | Free tier 列有值 ${filled} (${Math.round((filled / total) * 100)}%)\n`);
console.log("覆盖率最低的 8 个部门：");
for (const p of per.slice(0, 8)) console.log(`  ${p.slug.padEnd(16)} ${p.f}/${p.n}  ${p.pct}%`);
console.log("\n覆盖率最高的 5 个部门：");
for (const p of per.slice(-5).reverse()) console.log(`  ${p.slug.padEnd(16)} ${p.f}/${p.n}  ${p.pct}%`);
