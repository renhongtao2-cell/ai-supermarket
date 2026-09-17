// build-dataset.mjs — 把 js/data.js + 免费额度抽取结果合成 MCP 服务用的数据集
// 用法: node mcp/build-dataset.mjs
// 产出: mcp/dataset.json
//
// 数据质量原则：
//   - 目录本身（名称/URL/部门/定价档/描述/标签）是人工维护的，可靠 → 直接发布
//   - 免费额度事实是正则自动抽取的，**不可靠** → 只带 verification 标记发布，且只放「无矛盾信号」的
//   - 矛盾信号（同时命中不绑卡和要绑卡）一律丢弃，不猜

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const { TOOLS, DEPARTMENTS } = new Function(src + '\n; return { TOOLS, DEPARTMENTS };')();

let audit = null;
const auditPath = path.join(ROOT, '.workbuddy', 'free-tier-audit.json');
if (fs.existsSync(auditPath)) {
  try { audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')); } catch (e) { console.warn('审计结果解析失败，忽略:', e.message); }
}
const auditBy = new Map((audit?.results || []).map(r => [r.name, r]));

// 只有这些信号可以在无人工确认的情况下发布（措辞明确、不易误判）
const PUBLISHABLE = ['noCreditCard', 'freeForever', 'freePlan', 'freeTrial', 'trialDays', 'watermarkFree', 'apiOnFree'];

function freeTierOf(name) {
  const a = auditBy.get(name);
  if (!a || !a.reachable || !a.hits) return null;
  const s = a.signals || {};
  // 矛盾信号 → 丢弃，宁可 unknown
  if (s.noCreditCard && s.creditCardRequired) return null;
  if (s.watermarkFree && s.watermark && !s.freeForever) return null;
  const kept = {};
  for (const k of PUBLISHABLE) if (s[k] !== undefined) kept[k] = s[k];
  if (!Object.keys(kept).length) return null;
  return { ...kept, verification: 'auto-extracted', verified: false, checkedAt: (audit.generatedAt || '').slice(0, 10) };
}

const deptById = new Map(DEPARTMENTS.map(d => [d.id, d]));
const tools = TOOLS.map(t => {
  const ft = freeTierOf(t.name);
  return {
    name: t.name,
    url: t.url,
    department: t.dept,
    departmentName: deptById.get(t.dept)?.name || t.dept,
    pricing: t.pricing,
    description: t.desc || '',
    tags: t.tags || [],
    ...(t.featured ? { featured: true } : {}),
    ...(t.isNew ? { isNew: true } : {}),
    ...(ft ? { freeTier: ft } : {}),
  };
});

const withFacts = tools.filter(t => t.freeTier).length;
const byPricing = tools.reduce((a, t) => { a[t.pricing] = (a[t.pricing] || 0) + 1; return a; }, {});

const dataset = {
  name: 'AI Tools Directory',
  source: 'https://ai.toolboxes.top',
  generatedAt: new Date().toISOString().slice(0, 10),
  license: 'CC BY 4.0 — free to use with attribution to https://ai.toolboxes.top',
  stats: {
    tools: tools.length,
    departments: DEPARTMENTS.length,
    toolsWithFreeTierFacts: withFacts,
    byPricing,
  },
  departments: DEPARTMENTS.map(d => ({ id: d.id, name: d.name, tools: tools.filter(t => t.department === d.id).length })),
  tools,
};

fs.writeFileSync(path.join(__dirname, 'dataset.json'), JSON.stringify(dataset, null, 1), 'utf8');
console.log(`数据集已生成: ${tools.length} 个工具 / ${DEPARTMENTS.length} 个部门 / ${withFacts} 个带免费额度事实`);
console.log(`定价分布: ${JSON.stringify(byPricing)}`);
console.log(`输出: ${path.join(__dirname, 'dataset.json')}  (${(JSON.stringify(dataset).length / 1024).toFixed(1)} KB)`);
