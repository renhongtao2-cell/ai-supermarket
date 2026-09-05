const fs = require("fs");
const src = fs.readFileSync("E:/xiangmu/AIchaoshi/js/data.js", "utf8");
const { TOOLS, DEPARTMENTS } = new Function(src + "\n; return { TOOLS, DEPARTMENTS };")();

const deptIds = new Set(DEPARTMENTS.map((d) => d.id));
const problems = [];

const byName = new Map();
const byUrl = new Map();

TOOLS.forEach((t, i) => {
  const where = "#" + i + " " + (t.name || "?");
  if (!t.name) problems.push(where + " 缺少 name");
  if (!t.url) problems.push(where + " 缺少 url");
  else if (!/^https:\/\//.test(t.url)) problems.push(where + " url 非 https: " + t.url);
  if (!deptIds.has(t.dept)) problems.push(where + " dept 无效: " + t.dept);
  if (!["free", "freemium", "paid"].includes(t.pricing))
    problems.push(where + " pricing 无效: " + t.pricing);
  if (!t.desc || t.desc.trim().length < 5) problems.push(where + " desc 过短/缺失");
  if (t.pricing === undefined) problems.push(where + " pricing 缺失");
  if (!Array.isArray(t.tags) || t.tags.length === 0) problems.push(where + " tags 缺失");

  const nk = (t.name || "").toLowerCase().trim();
  if (byName.has(nk)) problems.push(where + " 工具名重复: " + t.name);
  byName.set(nk, t);

  const uk = (t.url || "").replace(/\/+$/, "").toLowerCase();
  if (byUrl.has(uk)) problems.push(where + " URL 重复: " + t.url);
  byUrl.set(uk, t);
});

// 部门使用统计
const usage = {};
TOOLS.forEach((t) => (usage[t.dept] = (usage[t.dept] || 0) + 1));

console.log("工具总数: " + TOOLS.length);
console.log("部门数: " + DEPARTMENTS.length);
console.log("\n各部门工具数:");
DEPARTMENTS.forEach((d) => {
  const c = usage[d.id] || 0;
  console.log("  " + (c === 0 ? "⚠️ 空部门  " : "         ") + d.id.padEnd(16) + c);
});
console.log("\nfeatured 数: " + TOOLS.filter((t) => t.featured).length);
console.log("isNew 数: " + TOOLS.filter((t) => t.isNew).length);

console.log("\n=== 数据问题 ===");
if (problems.length === 0) console.log("无");
else problems.forEach((p) => console.log("  " + p));
