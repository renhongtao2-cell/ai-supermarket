// 每周流量简报数据源：Cloudflare Web Analytics (RUM) GraphQL
// 用法: node traffic-report.js  → 输出最近7天 + 前7天逐日页面浏览量
// 凭据读取同目录 cf.env (CF_ACC / CF_TOK, gitignored)
const fs = require('fs');
const path = require('path');

for (const line of fs.readFileSync(path.join(__dirname, 'cf.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const ACC = process.env.CF_ACC, TOK = process.env.CF_TOK;
const ZONE_NAME = 'toolboxes.top'; // 两站(mcp./ai.子域)的 zone 级自动注入站点

const H = { 'Authorization': 'Bearer ' + TOK, 'Content-Type': 'application/json' };
const gql = q => fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: H, body: JSON.stringify({ query: q }) }).then(r => r.json());

(async () => {
  // 1. 找到 zone 对应的 site_tag
  const list = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/rum/site_info/list`, { headers: { 'Authorization': 'Bearer ' + TOK } }).then(r => r.json());
  const site = (list.result || []).find(x => x.ruleset && x.ruleset.zone_name === ZONE_NAME);
  if (!site) { console.log('NO_SITE_TAG'); return; }

  // 2. 拉 14 天逐日数据（今天为部分数据）
  const day = d => d.toISOString().slice(0, 10);
  const today = new Date();
  const start = new Date(today - 14 * 864e5);
  const q = `query { viewer { accounts(filter:{accountTag:"${ACC}"}) {
    g: rumPageloadEventsAdaptiveGroups(limit: 40,
      filter: { siteTag: "${site.site_tag}", datetime_geq: "${day(start)}T00:00:00Z", datetime_lt: "${day(today)}T00:00:00Z" })
    { dimensions { date } count }
  } } }`;
  const r = await gql(q);
  if (r.errors && r.errors.length) { console.log('GQL_ERROR: ' + JSON.stringify(r.errors).slice(0, 200)); return; }
  const map = {};
  (r.data.viewer.accounts[0].g || []).forEach(row => { map[row.dimensions.date] = row.count; });

  // 3. 输出
  const fmt = d => day(d);
  const thisWeek = [], lastWeek = [];
  for (let i = 13; i >= 7; i--) { const d = new Date(today - i * 864e5); const k = fmt(d); lastWeek.push([k, map[k] || 0]); }
  for (let i = 6; i >= 0; i--) { const d = new Date(today - i * 864e5); const k = fmt(d); thisWeek.push([k, map[k] || 0]); }
  const sum = a => a.reduce((s, x) => s + x[1], 0);
  console.log('最近7天 (含今天部分数据):');
  thisWeek.forEach(([k, v]) => console.log('  ' + k + '  ' + v));
  console.log('前7天:');
  lastWeek.forEach(([k, v]) => console.log('  ' + k + '  ' + v));
  const t = sum(thisWeek), l = sum(lastWeek);
  const pct = l === 0 ? (t > 0 ? '+新起量' : '持平') : Math.round((t - l) / l * 100) + '%';
  console.log(`合计: 本周 ${t} vs 上周 ${l} (${pct})`);
  console.log('日均(本周): ' + Math.round(t / 7));
})();
