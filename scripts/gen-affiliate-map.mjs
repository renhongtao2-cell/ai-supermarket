// gen-affiliate-map.mjs — 把 affiliate.mjs 里已接通的联盟链接导出成浏览器可读的 map
//
// 为什么需要它：index.html 的搜索/筛选结果、Best Sellers、My List 都是 app.js 在
// 浏览器里动态渲染的，静态生成器管不到。所以把注册表里「已拿到链接」的那部分
// 导成 js/affiliate-map.js，由 app.js 运行时查表。
//
// 只在 link 非空时输出 —— 没注册的工具不会出现在 map 里，app.js 自动回退到官网。
// 运行：node scripts/gen-affiliate-map.mjs
import fs from "fs";
import path from "path";
import { PROGRAMS, stats } from "./affiliate.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "js", "affiliate-map.js");

const live = {};
for (const [name, p] of Object.entries(PROGRAMS)) {
  if (p.link && /^https?:\/\//.test(p.link)) live[name] = p.link;
}

const body = `/* 由 scripts/gen-affiliate-map.mjs 自动生成 —— 不要手改。
   数据源：scripts/affiliate.mjs 的 PROGRAMS。
   当前已接通：${Object.keys(live).length} / ${stats().registered} 个计划。 */
window.AFFILIATE_MAP = ${JSON.stringify(live, null, 2)};
`;

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
if (prev !== body) {
  fs.writeFileSync(OUT, body);
  console.log(`js/affiliate-map.js 已更新 — ${Object.keys(live).length} 个联盟链接生效`);
} else {
  console.log(`js/affiliate-map.js 无变化 — ${Object.keys(live).length} 个联盟链接生效`);
}
