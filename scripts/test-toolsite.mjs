// test-toolsite.mjs — 验证工具站核心转换逻辑
// 运行：node scripts/test-toolsite.mjs
import { createRequire } from "module";
import path from "path";
const require = createRequire(import.meta.url);

const C = require(path.resolve(import.meta.dirname, "..", "toolsite", "js", "tools.js"));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? "  → " + extra : ""}`); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world.

2
00:00:05,500 --> 00:00:08,250
Second line
spans two rows.

3
00:01:02,900 --> 00:01:05,000
Third cue.
`;

const VTT = `WEBVTT

NOTE this is a comment

STYLE
::cue { color: white }

1
00:00:01.000 --> 00:00:04.000 align:start position:10%
Hello world.

2
00:00:05.500 --> 00:00:08.250
Second line
spans two rows.
`;

console.log("\n--- parseTime / fmtTime ---");
eq("parseTime 00:00:01,000", C.parseTime("00:00:01,000"), 1000);
eq("parseTime 00:01:02,900", C.parseTime("00:01:02,900"), 62900);
eq("parseTime 01:02:03.004", C.parseTime("01:02:03.004"), 3723004);
eq("parseTime 02:03.500 (MM:SS)", C.parseTime("02:03.500"), 123500);
eq("parseTime 00:00:01,5 (short ms)", C.parseTime("00:00:01,5"), 1500);
eq("parseTime garbage -> null", C.parseTime("nope"), null);
eq("fmtTime srt", C.fmtTime(62900, ","), "00:01:02,900");
eq("fmtTime vtt", C.fmtTime(3723004, "."), "01:02:03.004");
eq("fmtTime clamps negative", C.fmtTime(-500, ","), "00:00:00,000");

console.log("\n--- parseCues ---");
const sc = C.parseCues(SRT);
eq("srt cue count", sc.length, 3);
eq("srt cue1 start", sc[0].start, 1000);
eq("srt cue1 end", sc[0].end, 4000);
eq("srt cue1 text", sc[0].text, "Hello world.");
eq("srt multiline preserved", sc[1].text, "Second line\nspans two rows.");
const vc = C.parseCues(VTT);
eq("vtt cue count (skips NOTE/STYLE)", vc.length, 2);
eq("vtt cue1 text", vc[0].text, "Hello world.");
eq("vtt cue settings ignored", vc[0].end, 4000);
eq("empty input -> no cues", C.parseCues("   ").length, 0);
eq("no arrows -> no cues", C.parseCues("just text\nmore text").length, 0);

console.log("\n--- SRT -> VTT ---");
const v = C.toVtt(SRT);
ok("has WEBVTT header", v.startsWith("WEBVTT"));
ok("uses period separator", v.includes("00:00:01.000 --> 00:00:04.000"));
ok("no comma timestamps", !/\d,\d{3}/.test(v));
ok("text preserved", v.includes("Hello world."));
ok("multiline preserved", v.includes("Second line\nspans two rows."));
eq("cue count stable", C.parseCues(v).length, 3);
eq("roundtrip timing stable", C.parseCues(v)[2].start, 62900);

console.log("\n--- VTT -> SRT ---");
const s = C.toSrt(VTT);
ok("no WEBVTT header", !s.includes("WEBVTT"));
ok("NOTE dropped", !s.includes("NOTE this is a comment"));
ok("STYLE dropped", !s.includes("::cue"));
ok("align: dropped", !s.includes("align:start"));
ok("uses comma separator", s.includes("00:00:01,000 --> 00:00:04,000"));
ok("starts with cue number 1", s.startsWith("1\n00:00:01,000"));
eq("cue count", C.parseCues(s).length, 2);
eq("roundtrip start", C.parseCues(s)[0].start, 1000);

console.log("\n--- remove timestamps -> plain text ---");
const t = C.toPlainText(SRT, false);
eq("line count", t.split("\n").length, 3);
eq("first line", t.split("\n")[0], "Hello world.");
ok("multiline joined", t.includes("Second line spans two rows."));
ok("no timestamps", !/-->/.test(t));
ok("no cue numbers", !/^\d+$/m.test(t));
const dup = `1
00:00:01,000 --> 00:00:02,000
Same words

2
00:00:02,000 --> 00:00:03,000
Same words
`;
eq("dedupe off keeps 2", C.toPlainText(dup, false).split("\n").length, 2);
eq("dedupe on keeps 1", C.toPlainText(dup, true).split("\n").length, 1);

console.log("\n--- clean subtitles ---");
const DIRTY = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
<i>♪ upbeat music ♪</i>

2
00:00:03.000 --> 00:00:05.000
[Music] Hello there.

3
00:00:05.000 --> 00:00:07.000
(applause) Great point.

4
00:00:07.000 --> 00:00:09.000
HOST: Welcome back.

5
00:00:09.000 --> 00:00:11.000
  


6
00:00:11.000 --> 00:00:13.000
{\\i1}Styled line{\\i0}
`;
const cleaned = C.cleanCues(DIRTY, { tags: true, sound: true, speaker: true, empty: true, dupe: false });
const texts = cleaned.map((c) => c.text);
ok("music emoji cue emptied+removed", !texts.some((x) => x.includes("upbeat music")));
ok("[Music] removed", !texts.some((x) => /\[Music\]/i.test(x)));
ok("applause removed", !texts.some((x) => /applause/i.test(x)));
ok("dialogue kept", texts.some((x) => x === "Hello there."));
ok("HTML tags removed", !texts.some((x) => /<i>/.test(x)));
ok("ASS codes removed", !texts.some((x) => /\{\\/.test(x)));
ok("ASS text kept", texts.some((x) => x === "Styled line"));
ok("speaker label removed", texts.some((x) => x === "Welcome back."));
// 6 cues parsed; cue 1 (music-only) and cue 5 (blank) are dropped → 4 remain
eq("empty/noise cues dropped", cleaned.length, 4);
eq("timing untouched", cleaned[0].start, 3000);

const keepSound = C.cleanCues(DIRTY, { tags: false, sound: false, speaker: false, empty: false, dupe: false });
ok("opts off -> more cues kept", keepSound.length > cleaned.length);
ok("opts off -> [Music] kept", keepSound.some((c) => /\[Music\]/.test(c.text)));

console.log("\n--- shift timing ---");
const shifted = C.shiftCues(SRT, 2500);
eq("shift +2.5s start", shifted[0].start, 3500);
eq("shift +2.5s end", shifted[0].end, 6500);
eq("shift preserves text", shifted[0].text, "Hello world.");
const neg = C.shiftCues(SRT, -2000);
eq("negative clamps to 0", neg[0].start, 0);
eq("negative shifts others", neg[1].start, 3500);
const ser = C.serialize(shifted, false);
ok("serialized is srt", ser.includes("00:00:03,500 --> 00:00:06,500"));
eq("shifted roundtrip", C.parseCues(ser)[0].start, 3500);

console.log("\n--- format detection ---");
ok("looksVtt on vtt", C.looksVtt(VTT) === true);
ok("looksVtt on srt", C.looksVtt(SRT) === false);
ok("looksVtt with BOM", C.looksVtt("\uFEFFWEBVTT\n\n") === true);

console.log("\n--- edge cases ---");
eq("empty -> empty vtt", C.toVtt(""), "");
eq("garbage -> empty", C.toSrt("no cues here"), "");
eq("CRLF handled", C.parseCues(SRT.replace(/\n/g, "\r\n")).length, 3);
ok("no trailing blank lines", !C.toSrt(SRT).endsWith("\n\n"));
ok("ends with single newline", C.toSrt(SRT).endsWith("\n"));

console.log("\n--- parseLooseTime (split point input) ---");
eq("bare seconds", C.parseLooseTime("90"), 90000);
eq("decimal seconds", C.parseLooseTime("2.5"), 2500);
eq("m:ss", C.parseLooseTime("45:00"), 2700000);
eq("h:mm:ss", C.parseLooseTime("1:02:03"), 3723000);
eq("with millis", C.parseLooseTime("00:01:00,500"), 60500);
eq("empty -> 0", C.parseLooseTime(""), 0);
eq("garbage -> null", C.parseLooseTime("later"), null);

console.log("\n--- split subtitles ---");
const SPLIT_SRC = `1
00:00:10,000 --> 00:00:13,000
First half.

2
00:00:58,000 --> 00:01:02,000
Straddles the cut.

3
00:01:05,000 --> 00:01:08,000
Second half.
`;
const sp = C.splitCues(SPLIT_SRC, 60000);
eq("part1 count", sp.a.length, 2);
eq("part2 count", sp.b.length, 1);
eq("part1 last text", sp.a[1].text, "Straddles the cut.");
eq("part2 first text", sp.b[0].text, "Second half.");
eq("part2 keeps original timing", sp.b[0].start, 65000);
eq("part1 serializes", C.serialize(sp.a, false).includes("00:00:10,000 --> 00:00:13,000"), true);
eq("part2 count when cut at 0", C.splitCues(SPLIT_SRC, 0).b.length, 3);
eq("part1 empty when cut at 0", C.splitCues(SPLIT_SRC, 0).a.length, 0);

console.log("\n--- mojibake repair (encoding) ---");
const MOJI = "Caf\u00c3\u00a9 ouvert jusqu'\u00c3\u00a0 minuit";
const r1 = C.repairEncoding(MOJI, "auto", false);
eq("western repair applied", r1.passes, 1);
eq("western repair text", r1.text, "Caf\u00e9 ouvert jusqu'\u00e0 minuit");
eq("western repair clears mojibake", r1.after, 0);
const MOJI_EM = "L'\u00c3\u00a9quipe vous attend \u00e2\u0080\u0094 ce soir.";
eq("em dash repaired", C.repairEncoding(MOJI_EM, "cp1252", false).text, "L'\u00e9quipe vous attend \u2014 ce soir.");
// UTF-8 "привет" misread as cp1252
const MOJI_RU = "\u00d0\u00bf\u00d1\u20ac\u00d0\u00b8\u00d0\u00b2\u00d0\u00b5\u00d1\u201a";
eq("cyrillic repair", C.repairEncoding(MOJI_RU, "auto", false).text, "\u043f\u0440\u0438\u0432\u0435\u0442");
// UTF-8 "привет" misread as cp1251 → "РїСЂРёРІРµС‚"
const MOJI_RU2 = "\u0420\u0457\u0421\u0402\u0420\u0451\u0420\u0406\u0420\u00b5\u0421\u201a";
eq("cp1251 misread repair", C.repairEncoding(MOJI_RU2, "cp1251", false).text, "\u043f\u0440\u0438\u0432\u0435\u0442");
// already-correct text must be left alone
const GOOD = "Caf\u00e9 d\u00e9j\u00e0 vu";
const r2 = C.repairEncoding(GOOD, "auto", false);
eq("clean text untouched", r2.text, GOOD);
eq("clean text -> 0 passes", r2.passes, 0);
ok("plain ascii is a no-op", C.repairEncoding("Hello there.", "auto", false).text === "Hello there.");
// double-encoded: "Café" → "CafÃ©" → "CafÃƒÂ©" — needs two passes
const MOJI2 = "Caf\u00c3\u0192\u00c2\u00a9";
eq("double-encoded needs 2 passes", C.repairEncoding(MOJI2, "cp1252", true).text, "Caf\u00e9");
eq("double-encoded, 1 pass is not enough", C.repairEncoding(MOJI2, "cp1252", false).text, "Caf\u00c3\u00a9");
// two passes on already-clean text must be harmless
const ONCE = C.repairEncoding(MOJI, "cp1252", false).text;
ok("double pass is stable on clean input", C.repairEncoding(ONCE, "auto", true).text === ONCE);
// timestamps survive a repair
const MOJI_SRT = "1\n00:00:01,000 --> 00:00:04,000\nCaf\u00c3\u00a9";
ok("timestamps survive repair", C.repairEncoding(MOJI_SRT, "auto", false).text.includes("00:00:01,000 --> 00:00:04,000"));
eq("mojibake detector counts", C.mojiCount("Caf\u00c3\u00a9") > 0, true);
eq("mojibake detector ignores clean text", C.mojiCount("Caf\u00e9"), 0);
eq("utf8Decode rejects invalid bytes", C.utf8Decode([0xE9, 0x20]), null);
eq("utf8Decode accepts valid sequence", C.utf8Decode([0xC3, 0xA9]), "\u00e9");

console.log("\n--- timing / readability report ---");
const FAST = `1
00:00:01,000 --> 00:00:02,200
The quick brown fox jumps over the extremely lazy dog tonight

2
00:00:02,100 --> 00:00:02,400
Hi.
`;
const rep = C.timingReport(FAST, { maxCps: 20, minMs: 833, maxMs: 7000, maxLine: 42 });
ok("report header present", rep.startsWith("Subtitle timing report"));
ok("flags too fast", /Too fast/.test(rep) && /too fast/.test(rep));
ok("flags line too long", /line too long/.test(rep));
ok("flags too short", /too short/.test(rep));
ok("flags overlap", /overlaps the next cue/.test(rep));
ok("flags both cues", (rep.match(/^#\d{4}/gm) || []).length === 2);
ok("reports cue count", rep.includes("2 cues checked"));
const CLEAN_SRT = `1
00:00:01,000 --> 00:00:04,000
A perfectly reasonable line.

2
00:00:05,000 --> 00:00:08,000
And another one here.
`;
const rep2 = C.timingReport(CLEAN_SRT, { maxCps: 20, minMs: 833, maxMs: 7000, maxLine: 42 });
ok("clean file -> nothing flagged", rep2.includes("Nothing flagged"));
ok("clean file -> no cue entries", !/^#\d{4}/m.test(rep2));
eq("empty input -> empty report", C.timingReport("no cues here", {}), "");
// stricter limit must flag more
ok("lower CPS limit flags more", (C.timingReport(CLEAN_SRT, { maxCps: 3, minMs: 833, maxMs: 7000, maxLine: 42 }).match(/^#\d{4}/gm) || []).length === 2);
// markup must not inflate the character count
const STYLED = "1\n00:00:01,000 --> 00:00:04,000\n<i>Short styled line</i>\n";
ok("markup stripped before measuring", C.timingReport(STYLED, { maxCps: 20, minMs: 833, maxMs: 7000, maxLine: 42 }).includes("Nothing flagged"));

console.log("\n--- resync / merge / csv (regression) ---");
eq("resync x1.04271", C.resyncCues(SRT, 1.04271)[2].start, 65586);
eq("merge appends after last cue", C.mergeCues(SRT, SRT, 0).length, 6);
// first file ends at 65.000s, so the second file's cue 1 (start 1.000s) lands at 66.000s
eq("merge shifts second file", C.mergeCues(SRT, SRT, 0)[3].start, 66000);
ok("csv header", C.toCsv(SRT).startsWith("index,start,end,duration_ms,text"));
eq("csv row count", C.toCsv(SRT).split("\n").length, 4);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
