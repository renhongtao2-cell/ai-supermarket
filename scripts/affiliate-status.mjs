// affiliate-status.mjs — 联盟计划进度表
// 运行：node scripts/affiliate-status.mjs
import { PROGRAMS, NO_PROGRAM, stats } from "./affiliate.mjs";

const pad = (s, n) => { s = String(s); return s + " ".repeat(Math.max(0, n - s.length)); };
const clip = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

const s = stats();
console.log(`\n联盟计划：已接通 ${s.live} / 共 ${s.registered} 个（已人工核实条款 ${s.verified} 个）`);
console.log("─".repeat(96));
console.log(pad("工具", 14) + pad("状态", 8) + pad("分成", 30) + pad("归因窗口", 12) + "核实");
console.log("─".repeat(96));

for (const [name, p] of Object.entries(PROGRAMS)) {
  const live = p.link && /^https?:\/\//.test(p.link);
  const state = live ? "✅ 生效" : p.verified ? "○ 待注册" : "? 待核实";
  console.log(
    pad(name, 14) + pad(state, 8) + pad(clip(p.payout, 28), 30) +
    pad(clip(p.cookie || "—", 10), 12) + (p.verified || "未核实")
  );
}

console.log("\n已确认「没有」联盟计划（别再查一遍）：");
for (const [name, why] of Object.entries(NO_PROGRAM)) console.log(`  · ${pad(name, 12)} ${why}`);

const todo = Object.entries(PROGRAMS).filter(([, p]) => !(p.link && /^https?:\/\//.test(p.link)));
if (todo.length) {
  console.log(`\n下一步（按性价比排序，先注册已核实的）：`);
  const ordered = todo.sort((a, b) => (b[1].verified ? 1 : 0) - (a[1].verified ? 1 : 0));
  ordered.forEach(([name, p], i) => {
    console.log(`  ${i + 1}. ${name}  ${p.network ? "[" + p.network + "] " : ""}${p.signup}`);
  });
  console.log(`\n拿到链接后：填进 scripts/affiliate.mjs 对应条目的 link 字段，重新部署即可。`);
  console.log(`没注册的工具不会受影响 —— 链接保持官网原样，rel 也不带 sponsored。`);
}
console.log("");
