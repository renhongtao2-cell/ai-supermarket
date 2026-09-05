const fs = require("fs");
const path = require("path");

const DATA = "E:/xiangmu/AIchaoshi/js/data.js";
const src = fs.readFileSync(DATA, "utf8");
const { TOOLS } = new Function(src + "\n; return { TOOLS, DEPARTMENTS };")();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function probe(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    // 先 HEAD，被拒再 GET
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "*/*" },
    });
    if (res.status === 403 || res.status === 405 || res.status === 400 || res.status === 429) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      });
    }
    clearTimeout(timer);
    return { status: res.status, ms: Date.now() - t0, finalUrl: res.url };
  } catch (e) {
    clearTimeout(timer);
    const name = e && e.name ? e.name : "Error";
    let reason = name === "AbortError" ? "TIMEOUT" : name;
    const cause = e && e.cause ? e.cause : null;
    if (cause && cause.code) reason += ":" + cause.code;
    else if (e && e.code) reason += ":" + e.code;
    else if (e && e.message) reason += ":" + e.message.slice(0, 60);
    return { status: 0, ms: Date.now() - t0, reason };
  }
}

async function pool(items, size, worker) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await worker(items[idx]);
      }
    })
  );
  return out;
}

(async () => {
  const seen = new Map();
  for (const t of TOOLS) {
    if (!seen.has(t.url)) seen.set(t.url, []);
    seen.get(t.url).push(t.name);
  }
  const urls = [...seen.keys()];
  console.log("TOOLS=" + TOOLS.length + "  UNIQUE_URLS=" + urls.length);

  const results = await pool(urls, 12, async (u) => {
    const r = await probe(u);
    return { url: u, ...r };
  });

  const ok = results.filter((r) => r.status >= 200 && r.status < 400);
  const redirectOnly = ok.filter((r) => r.status >= 300);
  const client = results.filter((r) => r.status >= 400 && r.status < 500);
  const server = results.filter((r) => r.status >= 500);
  const dead = results.filter((r) => r.status === 0);

  const fmt = (r, names) => ({
    tool: (names || []).join(" / "),
    url: r.url.replace(/^https?:\/\//, ""),
    status: r.status || (r.reason || ""),
    final: r.finalUrl && r.finalUrl !== r.url ? r.finalUrl : "",
    ms: r.ms,
  });

  const report = {
    summary: {
      total_tools: TOOLS.length,
      unique_urls: urls.length,
      ok: ok.length,
      redirect: redirectOnly.length,
      http4xx: client.length,
      http5xx: server.length,
      unreachable: dead.length,
    },
    http4xx: client.map((r) => fmt(r, seen.get(r.url))),
    http5xx: server.map((r) => fmt(r, seen.get(r.url))),
    unreachable: dead.map((r) => fmt(r, seen.get(r.url))),
    redirects: redirectOnly.map((r) => fmt(r, seen.get(r.url))),
    ok: ok.map((r) => fmt(r, seen.get(r.url))),
  };

  fs.writeFileSync(
    "E:/xiangmu/AIchaoshi/.workbuddy/link-check-report.json",
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log("OK=" + ok.length + " 4xx=" + client.length + " 5xx=" + server.length + " DEAD=" + dead.length);
  console.log("\n--- 4xx ---");
  client.forEach((r) => console.log(r.status + "  " + r.url + "  [" + seen.get(r.url).join(",") + "]" + (r.reason ? " " + r.reason : "")));
  console.log("\n--- 5xx ---");
  server.forEach((r) => console.log(r.status + "  " + r.url + "  [" + seen.get(r.url).join(",") + "]"));
  console.log("\n--- unreachable ---");
  dead.forEach((r) => console.log((r.reason || "?") + "  " + r.url + "  [" + seen.get(r.url).join(",") + "]"));
})();
