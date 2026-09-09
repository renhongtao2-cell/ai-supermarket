// gen-llms.mjs — 依据 js/data.js 重建 llms.txt（GEO / AI 引擎抓取用）。幂等。
// 运行: node scripts/gen-llms.mjs
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const raw = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const { DEPARTMENTS, TOOLS } = new Function(raw + "\n;return { DEPARTMENTS, TOOLS };")();
const SITE = "https://ai.toolboxes.top";
const today = new Date().toISOString().slice(0, 10);
const pricingLabel = p => ({ free: "Free", freemium: "Freemium", paid: "Paid" }[p] || p);

const count = id => TOOLS.filter(t => t.dept === id).length;

const out = [
  "# AI Supermarket",
  "",
  `> A hand-curated directory of ${TOOLS.length} AI tools organized into ${DEPARTMENTS.length} industry departments — from marketing and design to law and healthcare. Every listing links to the tool's official website with a one-line description and pricing model (free / freemium / paid). Free to browse, no account needed. Last updated: ${today}.`,
  "",
  "## Pages",
  "",
  `- [AI Supermarket](${SITE}/): browse and search all AI tools by department`,
  `- [About](${SITE}/about): curation policy and contact`,
  `- [Privacy Policy](${SITE}/privacy)`,
  "",
  "## Departments",
  ""
]
  .concat(DEPARTMENTS.map(d => `- [${d.name} AI Tools](${SITE}/departments/${d.id}): ${count(d.id)} hand-picked tools`))
  .concat(["", `## All tools (${TOOLS.length})`, ""])
  .concat(TOOLS.map(t => `- [${t.name}](${t.url}): ${t.desc} [${pricingLabel(t.pricing)}]`))
  .join("\n") + "\n";

fs.writeFileSync(path.join(ROOT, "llms.txt"), out);
console.log(`[gen-llms] llms.txt 已重建: ${TOOLS.length} 工具 / ${DEPARTMENTS.length} 部门`);
