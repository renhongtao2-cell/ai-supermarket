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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
