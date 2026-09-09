// Deploy AI Supermarket to Cloudflare Pages via wrangler (official direct-upload protocol).
// NOTE: The previous hand-rolled multipart upload silently produced broken deployments
// (API returned success but most files were missing → departments/* 404). wrangler handles
// the hash-based upload protocol correctly, so we delegate to it.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Auto-load credentials from gitignored .workbuddy/cf.env when env vars are unset
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
  try {
    for (const line of fs
      .readFileSync(path.join(__dirname, "cf.env"), "utf8")
      .split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (!m) continue;
      if (m[1] === "CF_TOK" && !process.env.CLOUDFLARE_API_TOKEN)
        process.env.CLOUDFLARE_API_TOKEN = m[2];
      if (m[1] === "CF_ACC" && !process.env.CLOUDFLARE_ACCOUNT_ID)
        process.env.CLOUDFLARE_ACCOUNT_ID = m[2];
    }
  } catch (e) {}
}

const PROJ = process.env.CF_PROJ || "ai-supermarket";
const ROOT = path.join(__dirname, "..");
const WRANGLER =
  process.env.WRANGLER_BIN ||
  "C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/wrangler/bin/wrangler.js";

(async () => {
  // Pre-deploy: inline css + add ?v= hash to js refs so edge caches can't mix old/new
  try {
    execSync("node scripts/version-assets.mjs", { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    console.warn("version-assets.mjs failed, deploying without refresh:", e.message);
  }

  execSync(
    `"${process.execPath}" "${WRANGLER}" pages deploy "${ROOT}" --project-name=${PROJ} --branch=main --commit-dirty=true`,
    {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    }
  );
})();
