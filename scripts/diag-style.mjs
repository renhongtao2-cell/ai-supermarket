// diag-style.mjs — 取证：线上页面到底有没有应用样式
// 用法：node scripts/diag-style.mjs <url> [out.png]
const PW = "file:///C:/Users/Administrator/node_modules/playwright-core/index.js";
const CHROME =
  "C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const _pw = await import(PW);
const chromium = _pw.chromium || (_pw.default && _pw.default.chromium);

const url = process.argv[2];
const out = process.argv[3] || null;
if (!url) { console.error("usage: node scripts/diag-style.mjs <url> [out.png]"); process.exit(1); }

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
const failedReqs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("requestfailed", (r) => failedReqs.push(`${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`));
page.on("response", (r) => {
  if (r.status() >= 400) failedReqs.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
});

await page.goto(url, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1500);

const report = await page.evaluate(() => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const body = cs(document.body);
  const header = cs(document.querySelector("header, .site-header, .topbar, nav"));
  const card = cs(document.querySelector(".tool-card, .card, article"));
  const styleTags = [...document.querySelectorAll("style")];
  return {
    styleSheets: document.styleSheets.length,
    styleTags: styleTags.length,
    styleTagBytes: styleTags.map((s) => s.textContent.length),
    cssRulesTotal: [...document.styleSheets].reduce((n, s) => {
      try { return n + s.cssRules.length; } catch { return n; }
    }, 0),
    bodyBg: body?.backgroundColor,
    bodyFont: body?.fontFamily?.slice(0, 60),
    bodyMargin: body?.margin,
    headerDisplay: header?.display,
    headerBg: header?.backgroundColor,
    headerHeight: header?.height,
    cardDisplay: card?.display,
    cardShadow: card?.boxShadow?.slice(0, 40),
    cardRadius: card?.borderRadius,
    docWidth: document.documentElement.scrollWidth,
    // 是否像"裸 HTML"：卡片没有圆角/阴影，body 是默认字体
    looksUnstyled: (card?.borderRadius === "0px" || !card) && body?.fontFamily?.includes("Times"),
  };
});

console.log(JSON.stringify({ url, report, consoleErrors, failedReqs }, null, 2));

if (out) { await page.screenshot({ path: out, fullPage: false }); console.log("screenshot:", out); }
await browser.close();
