// cf-purge.mjs — 清除 Cloudflare 边缘缓存
//
// 为什么需要它：Pages 的静态资源默认带很长的边缘缓存（实测 /js/* 命中
// cf-cache-status: HIT、max-age=31536000），部署完直接访问会拿到旧文件。
// 工具站靠 ASSET_V 版本号绕过，但那是"每次改 JS 都要换引用"的权宜之计；
// 真正的解法是部署后主动清缓存。
//
// 用法：
//   node scripts/cf-purge.mjs toolboxes.top
//       → 清该 zone 下所有主机的缓存（purge_everything）
//   node scripts/cf-purge.mjs toolboxes.top --hosts=toolboxes.top,www.toolboxes.top
//       → 只清指定主机，不影响同 zone 的其他站点（推荐）
//   node scripts/cf-purge.mjs toolboxes.top --files=/js/tools.js,/css/style.css
//       → 只清指定 URL（按 zone 主域拼接）
//
// 凭据从 .workbuddy/cf.env 读取（CF_TOK），需要权限 Zone → Cache Purge → Purge。
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadTok() {
  if (process.env.CF_TOK) return process.env.CF_TOK;
  try {
    const txt = fs.readFileSync(path.join(ROOT, ".workbuddy", "cf.env"), "utf8");
    const m = /^\s*CF_TOK\s*=\s*(.+?)\s*$/m.exec(txt);
    if (m) return m[1];
  } catch (e) {}
  return null;
}

const TOK = loadTok();
if (!TOK) {
  console.error("cf-purge: 找不到 CF_TOK（.workbuddy/cf.env 或环境变量）");
  process.exit(2);
}

const args = process.argv.slice(2);
const val = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const zoneName = args.find((a) => !a.startsWith("--"));
const hosts = val("hosts") ? val("hosts").split(",").map((s) => s.trim()).filter(Boolean) : null;
const files = val("files") ? val("files").split(",").map((s) => s.trim()).filter(Boolean) : null;

if (!zoneName) {
  console.error("用法: node scripts/cf-purge.mjs <zone-name> [--hosts=a,b] [--files=/x,/y]");
  process.exit(2);
}

const H = { Authorization: "Bearer " + TOK, "Content-Type": "application/json" };
const api = async (p, opt) => {
  const r = await fetch("https://api.cloudflare.com/client/v4" + p, { headers: H, ...opt });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: j.success, errors: j.errors || [], result: j.result };
};

const zl = await api(`/zones?name=${encodeURIComponent(zoneName)}`);
if (!zl.ok || !zl.result?.length) {
  const why = zl.errors.map((e) => e.code + " " + e.message).join(" | ");
  console.error(
    `cf-purge: 查不到 zone "${zoneName}"` +
      (why ? ` — ${why}` : ` — 名称拼写是否正确？该 token 是否覆盖这个 zone？`)
  );
  process.exit(1);
}
const zoneId = zl.result[0].id;

let body;
if (files?.length) {
  body = { files: files.map((f) => (f.startsWith("http") ? f : `https://${zoneName}${f.startsWith("/") ? "" : "/"}${f}`)) };
} else if (hosts?.length) {
  body = { hosts };
} else {
  body = { purge_everything: true };
}

const res = await api(`/zones/${zoneId}/purge_cache`, { method: "POST", body: JSON.stringify(body) });
if (!res.ok) {
  console.error(
    `cf-purge: 失败 — ${res.errors.map((e) => e.code + " " + e.message).join(" | ") || "status " + res.status}`
  );
  console.error("  需要权限 Zone → Cache Purge → Purge");
  process.exit(1);
}

const what = files?.length ? `${files.length} 个 URL` : hosts?.length ? `主机 ${hosts.join(", ")}` : "整个 zone";
console.log(`cf-purge: ${zoneName} 已清除缓存（${what}）`);
