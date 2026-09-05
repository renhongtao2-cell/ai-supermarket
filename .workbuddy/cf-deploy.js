const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ACC = process.env.CF_ACC;
const PROJ = process.env.CF_PROJ || "ai-supermarket";
const TOK = process.env.CF_TOK;
const ROOT = "E:/xiangmu/AIchaoshi";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function collect(dir, base = "", out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (e.name === "outputs") continue;
    const rel = base ? base + "/" + e.name : e.name;
    if (e.isDirectory()) collect(path.join(dir, e.name), rel, out);
    else out.push(rel);
  }
  return out;
}

(async () => {
  const files = collect(ROOT).filter((f) =>
    /\.(html|css|js|json|svg|png|ico|txt)$/i.test(f)
  );
  const manifest = {};
  const fd = new FormData();

  for (const rel of files) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    manifest[rel] = hash;
    const type = TYPES[path.extname(rel).toLowerCase()] || "application/octet-stream";
    fd.append(rel, new Blob([buf], { type }), rel);
    console.log("+ " + rel.padEnd(20) + String(buf.length).padStart(7) + " bytes  " + type);
  }

  fd.append("manifest", JSON.stringify(manifest));
  fd.append("branch", "main");
  fd.append("commit_message", "Deploy AI Supermarket (retry with content-type)");

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACC}/pages/projects/${PROJ}/deployments`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}` },
    body: fd,
  });
  const j = await res.json();
  console.log("\nHTTP " + res.status + "  success=" + j.success);
  if (j.result) console.log("url: " + j.result.url + "\nenv: " + j.result.environment);
  else console.log(JSON.stringify(j.errors || j, null, 2).slice(0, 1200));
})();
