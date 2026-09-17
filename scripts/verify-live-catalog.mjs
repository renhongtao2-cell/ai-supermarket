// verify-live-catalog.mjs — 线上验证：收敛后的目录站是否真的收敛了
//
// 只做只读 HTTP 检查，不写任何文件。用法：
//   node scripts/verify-live-catalog.mjs
//   node scripts/verify-live-catalog.mjs --sample=40    # 抽查多少条旧 /tool/ 301
//
// 检查项：
//   [1] 27 个存活页全部 200
//   [2] 旧 /tool/<slug> 抽样 → 301，且 Location 指向存在的部门页
//   [3] sitemap.xml 列出的 URL 集合 == 实际存活页集合（无死链、无遗漏）
//   [4] 内容页含 AdSense loader；404 页真实 404 且不含广告代码
//   [5] toolboxes.top 未受影响（首页 200）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.CATALOG_ORIGIN || "https://ai.toolboxes.top";
const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
const SAMPLE = sampleArg ? Number(sampleArg.split("=")[1]) : 25;

let fail = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); fail++; };

async function head(url) {
  const r = await fetch(url, { redirect: "manual" });
  return r;
}

// 存活页集合：以本地 sitemap.xml 为准，再用线上核对
const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const liveUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const paths = liveUrls.map((u) => u.replace(ORIGIN, "") || "/");

console.log(`\n=== 线上验证 ${ORIGIN} ===\n`);
console.log(`[1] 存活页状态码（${paths.length} 个）`);
for (const p of paths) {
  const r = await head(ORIGIN + p);
  if (r.status === 200) ok(`${p} 200`);
  else bad(`${p} 期望 200，实际 ${r.status}`);
}

// [2] 旧 URL 抽样 301
const red = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8");
const rules = red
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(/\s+/))
  .filter((p) => p.length >= 3 && p[0].startsWith("/tool/"));

const step = Math.max(1, Math.floor(rules.length / SAMPLE));
const picked = rules.filter((_, i) => i % step === 0).slice(0, SAMPLE);
console.log(`\n[2] 旧 /tool/ 重定向抽样（${picked.length}/${rules.length} 条）`);
for (const [from, to, status] of picked) {
  const r = await head(ORIGIN + from);
  const loc = r.headers.get("location") || "";
  const want = Number(status);
  if (r.status === want && loc.endsWith(to)) ok(`${from} → ${to} (${r.status})`);
  else if (r.status === 200) bad(`${from} 期望 ${want}，实际 200（未重定向，页面可能仍存在）`);
  else bad(`${from} 期望 ${want} → ${to}，实际 ${r.status} → ${loc}`);
}

// [3] sitemap 无死链已在 [1] 覆盖；这里反向查：线上根目录不该再有 /tool/ 入口
console.log(`\n[3] sitemap 与 _redirects 一致性`);
{
  const targets = new Set(rules.map((p) => p[1]));
  for (const t of targets) {
    if (!paths.includes(t)) bad(`_redirects 目标 ${t} 不在 sitemap 存活页中`);
  }
  if (paths.length === 27) ok(`sitemap ${paths.length} 条 == 预期 27`);
  else bad(`sitemap ${paths.length} 条，预期 27`);
  const wildcard = rules.find((p) => p[0] === "/tool/*");
  if (wildcard) ok(`通配兜底 ${wildcard[0]} → ${wildcard[1]} (${wildcard[2]})`);
  else bad("缺少 /tool/* 通配兜底");
}

// [4] AdSense
console.log(`\n[4] AdSense 投放合规`);
{
  const content = await (await fetch(ORIGIN + "/")).text();
  if (content.includes("pagead2.googlesyndication.com")) ok("首页含 AdSense loader");
  else bad("首页缺少 AdSense loader");

  const r404 = await head(ORIGIN + "/nope-does-not-exist-xyz");
  if (r404.status === 404) ok("未知路径返回真实 404");
  else bad(`未知路径返回 ${r404.status}，期望 404`);
  const t404 = await (await fetch(ORIGIN + "/nope-does-not-exist-xyz")).text();
  if (!t404.includes("pagead2.googlesyndication.com")) ok("404 页不含广告代码");
  else bad("404 页含广告代码（违反 AdSense 政策）");
  if (/name="robots"[^>]*noindex/.test(t404)) ok("404 页 noindex");
  else bad("404 页缺少 noindex");
}

// [5] 另一站未受影响
console.log(`\n[5] toolboxes.top 未受影响`);
{
  const r = await head("https://toolboxes.top/");
  if (r.status === 200) ok("toolboxes.top 首页 200");
  else bad(`toolboxes.top 首页 ${r.status}`);
}

console.log(`\n${fail === 0 ? "线上验证全部通过" : `线上验证失败 ${fail} 项`}\n`);
process.exit(fail === 0 ? 0 : 1);
