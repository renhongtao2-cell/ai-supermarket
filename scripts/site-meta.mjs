// site-meta.mjs — 目录站站点级常量的唯一来源。
//
// 为什么单独抽出来：日期常量原先硬编码在 4 个生成器里（gen-cross-pages / gen-dept-hubs /
// consolidate-catalog / gen-toolsite），而 gen-llms.mjs 用的是**动态当天日期**
// → 结果 llms.txt 每天自动变新、其它页面永远停在旧日期，
// 同一个站自己说两个日期（实测：线上 llms.txt 说 09-18，sitemap 说 09-17）。
//
// 语义：这是「内容最后变更日」，**不是部署日**。
// 不要改成 new Date() —— 每天自动 +1 会让 lastmod 变得不可信，
// 而 Google 明确会忽略不可靠的 lastmod（得不偿失）。
// 只在内容真的变了时手动更新这里。
export const UPDATED = "2026-09-18";
