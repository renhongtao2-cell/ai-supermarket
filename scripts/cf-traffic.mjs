// cf-traffic.mjs — 查 Cloudflare 真实访问量（按日）
// 用法：node scripts/cf-traffic.mjs <zoneId> [days]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const env = fs.readFileSync(path.join(ROOT, ".workbuddy", "cf.env"), "utf8");
const TOK = (env.match(/CF_TOK\s*=\s*"?([^"\r\n]+)"?/) || [])[1];
if (!TOK) { console.error("no CF_TOK"); process.exit(1); }

const zone = process.argv[2];
const days = parseInt(process.argv[3] || "7", 10);
if (!zone) { console.error("usage: node scripts/cf-traffic.mjs <zoneId> [days]"); process.exit(1); }

const now = new Date();
const since = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
const until = now.toISOString().slice(0, 10);

const q = `
query {
  viewer {
    zones(filter: { zoneTag: "${zone}" }) {
      httpRequests1dGroups(
        limit: 100
        filter: { date_geq: "${since}", date_leq: "${until}" }
        orderBy: [date_ASC]
      ) {
        dimensions { date }
        sum { requests pageViews }
        uniq { uniques }
      }
    }
  }
}`;

(async () => {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  const j = await r.json();
  if (j.errors) { console.log("GRAPHQL 错误:", JSON.stringify(j.errors).slice(0, 400)); return; }
  const groups = j.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  if (!groups.length) { console.log("无数据（或该 zone 无流量记录）"); return; }
  let tr = 0, tp = 0, tu = 0;
  console.log("日期        请求数   页面浏览  独立访客");
  for (const g of groups) {
    const { requests, pageViews } = g.sum;
    const u = g.uniq.uniques;
    tr += requests; tp += pageViews; tu += u;
    console.log(`${g.dimensions.date}  ${String(requests).padStart(7)}  ${String(pageViews).padStart(8)}  ${String(u).padStart(8)}`);
  }
  console.log("-".repeat(46));
  console.log(`合计          ${String(tr).padStart(7)}  ${String(tp).padStart(8)}  ${String(tu).padStart(8)}`);
  console.log(`\n区间: ${since} ~ ${until} (${days} 天)`);
})();
