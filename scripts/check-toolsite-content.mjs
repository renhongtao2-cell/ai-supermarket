// check-toolsite-content.mjs — 内容体检：字数、AdSense、新章节、canonical
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TS = path.join(ROOT, "toolsite");

const files = [
  "index.html",
  "tools/srt-to-vtt.html",
  "tools/vtt-to-srt.html",
  "tools/remove-timestamps.html",
  "tools/clean-subtitles.html",
  "tools/shift-subtitles.html",
  "guides/subtitle-formats.html",
  "guides/add-subtitles-to-html5-video.html",
  "about.html",
  "privacy.html",
  "404.html",
];

// 工具页 / 指南页 的最低正文字数（去标签后）
const MIN_WORDS = 650;

const strip = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");

let fail = 0;
console.log("file".padEnd(30) + "words  ads  ex  ts  canonical");
for (const f of files) {
  const p = path.join(TS, f);
  if (!fs.existsSync(p)) {
    console.log(f.padEnd(30) + "MISSING");
    fail++;
    continue;
  }
  const h = fs.readFileSync(p, "utf8");
  const w = strip(h).split(/\s+/).filter((x) => x.length > 1).length;
  const ads = h.includes("adsbygoogle.js?client=ca-pub-9901133369141996");
  const ex = h.includes("<h2>Worked example</h2>");
  const ts = h.includes("<h2>Troubleshooting</h2>");
  const canon = (h.match(/rel="canonical" href="([^"]+)"/) || [])[1] || "NO-CANON";
  console.log(
    f.padEnd(30) +
      String(w).padStart(5) +
      "  " +
      (ads ? " ✓ " : " ✗ ") +
      "  " +
      (ex ? "✓" : "–") +
      "  " +
      (ts ? "✓" : "–") +
      "  " +
      canon
  );
  if (f === "404.html") {
    // AdSense policy: error pages must not carry ad code
    if (ads) {
      console.log("   ^ FAIL: ad code present on 404 page");
      fail++;
    }
  } else if (!ads) {
    console.log("   ^ FAIL: AdSense loader missing");
    fail++;
  }
  if ((f.startsWith("tools/") || f.startsWith("guides/")) && w < MIN_WORDS) {
    console.log(`   ^ FAIL: content page under ${MIN_WORDS} words`);
    fail++;
  }
  if (canon === "NO-CANON" || !canon.startsWith("https://toolboxes.top/")) {
    console.log("   ^ FAIL: canonical not self-referential");
    fail++;
  }
}
console.log(fail === 0 ? "\nOK — all checks passed" : `\n${fail} check(s) failed`);
process.exit(fail === 0 ? 0 : 1);
