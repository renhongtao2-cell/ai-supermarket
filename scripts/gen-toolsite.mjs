// gen-toolsite.mjs — 生成 toolboxes.top「字幕工具站」
// 定位：帮用户「干小活」——纯浏览器本地字幕/字幕文件处理，数据不出本机。
// 与 ai.toolboxes.top（AI 工具目录）内容完全不同，canonical 自指。
// 运行：node scripts/gen-toolsite.mjs
import fs from "fs";
import path from "path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "toolsite");
const SITE = "https://toolboxes.top";
const BRAND = "Subtitle Toolkit";
const UPDATED = "2026-09-21";
const ADSENSE_CLIENT = "ca-pub-9901133369141996";

// 联系邮箱。AdSense 的「关于 / 联系 / 隐私」三大默认检查项里，本站原本缺「联系」——
// 全站一个邮箱都没有，privacy.html 还指向了同样没有联系方式的目录站。
// 改这里即可全站生效（页脚 + /contact + privacy）。
//
// 为什么不是 contact@toolboxes.top：这个 zone 拿不到 Cloudflare Email Routing
// （后台侧栏没有该入口，API 的 email/routing 全部 403，规则端点更是 405
//  —— 不接受 API token 认证）。用户 2026-09-21 决定先用 Gmail。
// 将来若拿到域名邮箱，改这一行即可，全站自动跟着变。
const CONTACT_EMAIL = "renhongtao2@gmail.com";

/* ============================================================
   1. 工具清单（页面 + 元数据）
   ============================================================ */
const TOOLS = [
  {
    slug: "srt-to-vtt",
    h1: "SRT to VTT Converter",
    tagline: "Convert .srt subtitle files to WebVTT (.vtt) for HTML5 video, right in your browser.",
    metaDesc:
      "Free SRT to VTT converter that runs entirely in your browser. No upload, no signup, no file size limit. Handles multi-line cues and non-standard timestamps.",
    mode: "convert-vtt",
    intro:
      "WebVTT is the subtitle format HTML5 <code>&lt;track&gt;</code> elements expect, while most subtitles you download are SubRip (.srt). This converter rewrites the timestamps and adds the required <code>WEBVTT</code> header — without sending your file anywhere.",
    steps: [
      "Paste your SRT content into the box, or drop the <code>.srt</code> file onto it.",
      "The conversion runs locally as you type — no request is made to any server.",
      "Copy the result or download it as a <code>.vtt</code> file.",
    ],
    deep: {
      h2: "Where each format is accepted",
      body: [
        "<strong>SubRip (.srt)</strong> is the safe default for desktop editing software, mobile players and the subtitle upload boxes used by most video platforms. If you are unsure which format to supply, supply SRT.",
        "<strong>WebVTT (.vtt)</strong> is required by the HTML5 <code>&lt;track&gt;</code> element, which means every browser-based player, custom web player and most streaming pipelines. It is also the format modern broadcast workflows expect.",
        "Some tools accept both and detect the format from the content rather than the extension. Those tools are why a file can seem to work locally and then fail after upload — the upload box is stricter than the desktop editor you tested with.",
      ],
    },
    notes: [
      "SRT uses <code>00:00:01,000</code> (comma); WebVTT uses <code>00:00:01.000</code> (period). This is the single most common cause of subtitles silently failing to load.",
      "Cue numbers are optional in WebVTT but are kept here so you can diff the output against the input.",
      "Styling tags such as <code>&lt;i&gt;</code> and <code>&lt;b&gt;</code> are valid in both formats and are preserved.",
    ],
    faq: [
      ["Why won't my .srt file work in an HTML5 video player?",
       "Because HTML5 <code>&lt;track&gt;</code> elements only accept WebVTT. A file with an .srt extension, or with comma decimal separators in its timestamps, will be ignored by the browser without an error message."],
      ["Does this upload my subtitle file anywhere?",
       "No. All parsing and conversion happens in JavaScript on your device. You can disconnect from the network after the page loads and the converter still works."],
      ["Is there a file size limit?",
       "No server-side limit, because nothing is uploaded. The practical limit is your browser's available memory — files of several megabytes convert instantly."],
    ],
    example: {
      inLabel: "Input — .srt",
      outLabel: "Output — .vtt",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\n<i>Music playing</i>",
      after: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nHello there.\n\n2\n00:00:04.200 --> 00:00:07.000\n<i>Music playing</i>",
      cap: "The only structural change is the WEBVTT header plus a period instead of a comma in every timestamp. Text, italics and cue numbers survive untouched.",
    },
    troubleshoot: [
      ["The .vtt file loads but no subtitles appear",
       "Check the <code>&lt;track&gt;</code> tag uses <code>kind=\"subtitles\"</code> and that the server sends the file as <code>text/vtt</code>. A server answering with <code>text/plain</code> makes some browsers ignore the track silently, with no console error."],
      ["Timestamps still contain a comma after conversion",
       "A cue was not recognised, so it was passed through as-is. Every cue needs a blank line before it and a line containing <code>--&gt;</code>. Stray text between cues is the usual culprit."],
      ["Each cue holds two languages stacked on two lines",
       "That is preserved exactly as written. Most players render both lines; if you need one language per track, split the file before converting."],
      ["The output contains empty cues",
       "Cues whose text was only whitespace are kept so the numbering stays stable. Run the file through <a href=\"/tools/clean-subtitles\">Clean subtitles</a> with <em>Drop empty cues</em> enabled."],
    ],
    related: ["vtt-to-srt", "shift-subtitles", "clean-subtitles"],
  },
  {
    slug: "vtt-to-srt",
    h1: "VTT to SRT Converter",
    tagline: "Turn WebVTT files back into SubRip (.srt) for editors, players and upload platforms.",
    metaDesc:
      "Free WebVTT to SRT converter running fully in your browser. Strips VTT headers, NOTE and STYLE blocks, and cue settings. No upload or signup required.",
    mode: "convert-srt",
    intro:
      "Most video editors, mobile players and upload forms want SubRip (.srt). WebVTT files carry extra headers, <code>NOTE</code>/<code>STYLE</code> blocks and per-cue settings that those tools reject, so this converter extracts just the cues and rewrites them as clean SRT.",
    steps: [
      "Paste your VTT content or drop the <code>.vtt</code> file onto the box.",
      "Headers, <code>NOTE</code> and <code>STYLE</code> blocks, and cue settings like <code>align:</code> are discarded automatically.",
      "Copy or download the resulting <code>.srt</code> file.",
    ],
    deep: {
      h2: "What you give up converting VTT to SRT",
      body: [
        "<strong>Cue settings.</strong> <code>align:</code>, <code>line:</code>, <code>position:</code>, <code>size:</code> and <code>region:</code> control where text sits on screen. SubRip has no equivalent, so a caption positioned top-left to avoid covering a face will jump to the bottom centre.",
        "<strong>Regions and STYLE blocks.</strong> WebVTT can define a reusable block of CSS-like styling and apply it to many cues at once. SRT carries only inline <code>&lt;i&gt;</code>, <code>&lt;b&gt;</code> and <code>&lt;u&gt;</code>, so shared styling collapses to whatever was applied inline.",
        "<strong>Voice spans.</strong> <code>&lt;v Speaker&gt;</code> markup identifies who is speaking and lets a player style each speaker differently. In SRT the tag is dropped, which is why podcast captions converted to SRT often lose their speaker distinction.",
        "If any of those matter for your project, keep the VTT as the master file and generate SRT only as a delivery copy.",
      ],
    },
    notes: [
      "Timestamps are rewritten with comma separators, as SubRip requires.",
      "Cue settings (<code>line:</code>, <code>position:</code>, <code>align:</code>, <code>size:</code>, <code>region:</code>) have no SRT equivalent and are dropped.",
      "Cue identifiers are replaced with a clean 1-based sequence.",
    ],
    faq: [
      ["What happens to NOTE and STYLE blocks?",
       "They are discarded. SubRip has no equivalent syntax, and leaving them in produces a file that most editors refuse to open."],
      ["Will I lose any timing information?",
       "No. Cue start and end times are preserved exactly — only the decimal separator and the surrounding syntax change."],
      ["Can I convert in the other direction too?",
       "Yes — use the <a href=\"/tools/srt-to-vtt\">SRT to VTT converter</a>."],
    ],
    example: {
      inLabel: "Input — .vtt",
      outLabel: "Output — .srt",
      before: "WEBVTT\nKind: captions\nLanguage: en\n\nNOTE chapter 2 starts here\n\n1\n00:00:01.000 --> 00:00:04.000 align:start position:10%\nHello there.",
      after: "1\n00:00:01,000 --> 00:00:04,000\nHello there.",
      cap: "The header, the NOTE block and the cue settings are gone; only the cue survives, renumbered and rewritten with comma timestamps.",
    },
    troubleshoot: [
      ["My editor reports the file as empty or invalid",
       "The input had no parseable cue blocks. WebVTT needs a blank line after the header and between cues — a file where the header runs straight into the first cue is rejected."],
      ["Cue positioning was lost",
       "Cue settings such as <code>align:</code>, <code>line:</code>, <code>position:</code>, <code>size:</code> and <code>region:</code> have no SubRip equivalent, so they are dropped by design. Burn the position into the video if you need it."],
      ["Dialogue disappeared from the output",
       "Text inside <code>NOTE</code> and <code>STYLE</code> blocks is not dialogue and is intentionally discarded. If your captions were stored in a NOTE block, the source file was not valid VTT."],
      ["The first cue lost its original identifier",
       "VTT cue identifiers are optional and often absent. Numbers are regenerated from 1 so the SRT file opens everywhere."],
    ],
    related: ["srt-to-vtt", "shift-subtitles", "clean-subtitles"],
  },
  {
    slug: "remove-timestamps",
    h1: "Remove Timestamps from Subtitles",
    tagline: "Strip timestamps and cue numbers to get a clean, readable transcript.",
    metaDesc:
      "Convert .srt or .vtt subtitles into plain text by removing timestamps and cue numbers. Runs in your browser with no upload. Optionally merges repeated lines.",
    mode: "to-text",
    intro:
      "Subtitle files are awkward to read and impossible to paste into a document. This tool keeps only the spoken text, dropping timestamps, cue numbers and formatting so you get a transcript you can actually use.",
    steps: [
      "Paste or drop your <code>.srt</code> or <code>.vtt</code> file.",
      "Choose whether to merge consecutive duplicate lines — captioners often repeat a line across two cues.",
      "Copy the plain-text transcript.",
    ],
    deep: {
      h2: "When you should keep the timestamps",
      body: [
        "A plain transcript is easier to read, but the timing is often the part you need later. Before stripping it, check whether the text will be used for <strong>subtitling</strong> (timing required), <strong>interview analysis</strong> (timecodes let you jump back into the recording), <strong>accessibility documentation</strong> (reviewers routinely ask for a timecoded transcript) or <strong>quotation with citation</strong> (a timecode is the citation).",
        "If any of those apply, keep the original <code>.srt</code> or <code>.vtt</code> as the master file and treat the plain text as a derived copy. Keeping both costs nothing, and re-deriving the transcript later is one click.",
      ],
    },
    notes: [
      "Multi-line cues are joined into a single line so the transcript reads naturally.",
      "Turning on <em>Merge repeated lines</em> removes the duplication that comes from two-part captions.",
      "If you also want to strip sound cues like <code>[Music]</code>, use <a href=\"/tools/clean-subtitles\">Clean subtitles</a> first.",
    ],
    faq: [
      ["Does this keep any timing information?",
       "No. The output is plain text only. If you need the timing, use <a href=\"/tools/shift-subtitles\">Shift subtitles</a> instead, which preserves cues."],
      ["Why does my transcript repeat sentences?",
       "Many captioners split a long line across two cues, so the same words appear twice. Enable <em>Merge repeated lines</em> to collapse them."],
      ["Which input formats are supported?",
       "SubRip (.srt), WebVTT (.vtt), and most .sbv-style files that use the <code>HH:MM:SS,mmm --&gt; HH:MM:SS,mmm</code> arrow syntax."],
    ],
    example: {
      inLabel: "Input — .srt with timing",
      outLabel: "Output — plain text",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\nHello there.\n\n3\n00:00:07,400 --> 00:00:10,000\nHow are you?",
      after: "Hello there.\nHow are you?",
      cap: "Timestamps and cue numbers are gone, and the repeated line from cue 2 is merged because <em>Merge repeated lines</em> is on. Turn it off and you get all three lines.",
    },
    troubleshoot: [
      ["Every sentence appears twice in the transcript",
       "Two-part captions repeat the line across consecutive cues. Enable <em>Merge repeated lines</em> to collapse them."],
      ["Sound cues such as [Music] are still in the text",
       "This tool removes timing, not noise. Run the file through <a href=\"/tools/clean-subtitles\">Clean subtitles</a> with <em>Remove sound cues</em> first, then strip the timestamps."],
      ["Paragraph breaks are missing",
       "Each cue becomes one line of text. Paste into a word processor and replace line breaks with spaces if you want flowing paragraphs."],
      ["The output is empty",
       "No cue lines were found. Confirm the file contains <code>--&gt;</code> between timestamps — a plain transcript saved with a <code>.srt</code> extension has nothing to parse."],
    ],
    related: ["clean-subtitles", "shift-subtitles", "srt-to-vtt"],
  },
  {
    slug: "clean-subtitles",
    h1: "Clean Up AI-Generated Subtitles",
    tagline: "Remove sound cues, HTML tags, speaker labels and duplicate cues from auto-generated captions.",
    metaDesc:
      "Clean messy AI subtitles in your browser: strip sound tags like [Music], HTML and ASS formatting, speaker labels and duplicate cues. No upload required.",
    mode: "clean",
    intro:
      "Auto-generated captions arrive with markup you rarely want: <code>[Music]</code> and <code>[Applause]</code> tags, <code>&lt;font&gt;</code> wrappers, ASS override codes, ALL-CAPS speaker labels and the same line repeated across two cues. This tool removes them and re-emits a valid subtitle file.",
    steps: [
      "Paste or drop the subtitle file you want to clean.",
      "Tick the cleanups you need — the preview updates immediately.",
      "Download the result in the same format you pasted (SRT or VTT is detected automatically).",
    ],
    deep: {
      h2: "What auto-captioning actually gets wrong",
      body: [
        "Automatic captions fail in predictable ways, and it helps to know which defects are safe to fix automatically. <strong>Sound tags</strong> such as <code>[Music]</code>, <code>(applause)</code> and <code>♪ … ♪</code> are almost always noise. <strong>Markup wrappers</strong> added by an export step are safe to strip. <strong>Speaker labels</strong> are safe to strip only if you do not need to know who spoke.",
        "Two categories are not safe to automate. <strong>Punctuation and capitalisation</strong> change meaning — a misplaced full stop turns a question into a statement, and automatic rewriting is how transcripts end up misquoting people. <strong>Homophone errors</strong> from the recogniser, such as \"their\" for \"there\", or a name spelled three different ways, need a human reading the text against the audio.",
        "This tool deliberately only performs the safe category. Anything it cannot fix reliably is left for you rather than guessed at.",
      ],
    },
    notes: [
      "Sound cue removal targets bracketed effects such as <code>[Music]</code>, <code>(applause)</code> and <code>♪ … ♪</code>. Genuine dialogue inside brackets is left alone where the pattern is not a known effect.",
      "Speaker-label removal strips leading <code>SPEAKER:</code> style prefixes, which are common in interview and podcast transcripts.",
      "Empty cues are dropped so the timeline stays valid.",
    ],
    faq: [
      ["Will cleaning break my subtitle timing?",
       "No. Cue start and end times are untouched — only the text inside each cue is modified."],
      ["Can it remove speaker names from a podcast transcript?",
       "Yes, enable <em>Remove speaker labels</em>. It strips a leading name followed by a colon, for example <code>HOST:</code> or <code>Jane Doe:</code>."],
      ["Does it fix bad punctuation or capitalisation?",
       "No, and be cautious with tools that claim to. Automated rewriting can change meaning. This tool only removes markup and noise."],
    ],
    example: {
      inLabel: "Input — raw auto-captions",
      outLabel: "Output — cleaned",
      before: "1\n00:00:01,000 --> 00:00:04,000\n[Music]\n\n2\n00:00:04,200 --> 00:00:07,000\n<font color=\"#ffffff\">HOST: Welcome back.</font>\n\n3\n00:00:07,400 --> 00:00:10,000\nHOST: Welcome back.",
      after: "1\n00:00:04,200 --> 00:00:07,000\nWelcome back.",
      cap: "Cue 1 was a sound cue, cue 3 duplicated cue 2, and the font wrapper and speaker label were stripped. Only one cue survives — with its original timing intact.",
    },
    troubleshoot: [
      ["Genuine dialogue was deleted",
       "Only bracket patterns matching known sound effects are removed. If a line such as <code>[laughs]</code> was real speech, untick <em>Remove sound cues</em> and clean again."],
      ["Speaker names are still present",
       "Enable <em>Remove speaker labels</em>. It strips a leading name followed by a colon, so <code>NARRATOR:</code> and <code>Dr. Chen:</code> are handled, but a name in the middle of a sentence is left alone."],
      ["The timing looks different after cleaning",
       "It should not — start and end times are never modified. If cues look wrong, the source was already broken; inspect it with <a href=\"/tools/shift-subtitles\">Shift subtitles</a>."],
      ["Markup like {\\an8} is still there",
       "Tick <em>Remove markup</em>. It strips HTML tags and ASS override codes, but leaves plain braces that are part of the dialogue itself."],
    ],
    related: ["remove-timestamps", "fix-subtitle-encoding", "subtitle-timing-check"],
  },
  {
    slug: "shift-subtitles",
    h1: "Shift Subtitle Timing",
    tagline: "Move every subtitle cue earlier or later to fix out-of-sync captions.",
    metaDesc:
      "Shift all subtitle timestamps by a fixed offset to resync out-of-sync captions. Works on SRT and VTT entirely in your browser, no upload.",
    mode: "shift",
    intro:
      "When subtitles are consistently early or late, every cue is off by the same amount. Rather than re-transcribing, shift the whole track by a fixed offset — the fix takes seconds and keeps the original text intact.",
    steps: [
      "Paste or drop your subtitle file.",
      "Enter an offset such as <code>+2.5</code> or <code>-1.2</code> (seconds), or type a value directly in milliseconds.",
      "Download the corrected file. Cues that would start before zero are clamped to 00:00:00.",
    ],
    deep: {
      h2: "Offset or resampling? Two different sync problems",
      body: [
        "Subtitles fall out of sync in two different ways, and they need different fixes. Tell them apart by checking a cue near the <strong>start</strong> of the file and another near the <strong>end</strong>.",
        "<strong>Constant offset.</strong> Both cues are wrong by the same amount — for example every line appears two seconds late. This is what this tool fixes: apply one offset and the whole track lines up.",
        "<strong>Progressive drift.</strong> The first cue is nearly right and the last one is badly wrong, with the error growing through the file. That is a frame-rate mismatch, usually 23.976 fps against 25 fps, and no single offset can fix it. The file needs resampling to the video's frame rate instead.",
        "If you shift a drifting file until the middle lines up, you make both ends worse. Confirm which problem you have before entering an offset.",
      ],
    },
    notes: [
      "Use a positive offset to delay subtitles, a negative one to make them appear earlier.",
      "To find the offset, pick one cue and compare its timestamp with the moment the line is actually spoken.",
      "The output format follows the input, so an SRT file stays SRT.",
    ],
    faq: [
      ["How do I know what offset to use?",
       "Pause the video on a line you can identify, note the real time, and subtract the subtitle's timestamp from it. If a line is spoken at 00:01:30 but the cue says 00:01:28, use <code>+2</code>."],
      ["What happens to cues that would move before zero?",
       "They are clamped to <code>00:00:00,000</code>. Shifting a track earlier than its first cue allows is a sign the offset is too large."],
      ["Can I shift only part of a file?",
       "Not with this tool — it applies one offset to every cue. Split the file first if you need per-section offsets."],
    ],
    example: {
      inLabel: "Input — subtitles 2.5s too early",
      outLabel: "Output — offset +2.5",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\nHow are you?",
      after: "1\n00:00:03,500 --> 00:00:06,500\nHello there.\n\n2\n00:00:06,700 --> 00:00:09,500\nHow are you?",
      cap: "Enter <code>+2.5</code> and every start and end time moves 2.5 seconds later. The text is untouched — only the timing changes.",
    },
    troubleshoot: [
      ["All the cues piled up at 00:00:00",
       "The offset is too large and negative. Cues cannot start before zero, so they are clamped. Reduce the offset and check the first cue."],
      ["Subtitles drift progressively out of sync",
       "A fixed offset cannot fix drift. Drift means the subtitle frame rate differs from the video — typically 23.976 against 25 fps — which needs resampling, not shifting."],
      ["The picture and sound are out of sync with each other",
       "This tool only moves subtitles. Correct the audio delay in your video first, then resync the captions against the corrected video."],
      ["The offset box rejects my value",
       "Enter a decimal number of seconds such as <code>2.5</code>, or whole milliseconds in the second box. Timecode strings like <code>00:00:02,500</code> are not accepted here."],
    ],
    related: ["split-subtitles", "vtt-to-srt", "clean-subtitles"],
  },
  {
    slug: "resync-subtitles",
    h1: "Resync Subtitles by Frame Rate or Speed",
    tagline: "Fix subtitles that drift progressively out of sync by resampling them to your video's frame rate or playback speed.",
    metaDesc:
      "Resync drifting subtitles by resampling every timestamp. Pick a 23.976/25 fps conversion or any playback speed. Runs in your browser, no upload.",
    mode: "resync",
    intro:
      "When subtitles start roughly in sync and get worse as the video plays, no single offset can fix them — the error <em>grows</em> with time. That is a frame-rate or playback-speed mismatch, and the fix is to <strong>resample</strong> every timestamp by a ratio rather than shift it by a constant.",
    steps: [
      "Paste or drop the subtitle file that drifts.",
      "Pick the preset that matches your situation — for example <code>23.976 fps → 25 fps</code> — or type a ratio yourself.",
      "Download the resampled file. Every start and end time is multiplied by the same ratio.",
    ],
    deep: {
      h2: "Drift versus offset: pick the right fix",
      body: [
        "Compare a cue near the <strong>start</strong> of the file with one near the <strong>end</strong>. That single check tells you which tool you need.",
        "<strong>Constant offset.</strong> Both cues are wrong by the same amount. Every line appears, say, two seconds late. Use the <a href=\"/tools/shift-subtitles\">shift tool</a> — one offset fixes the whole track.",
        "<strong>Progressive drift.</strong> The first cue is nearly right and the last one is badly wrong, and the error grows steadily through the file. This is what this page fixes. A drifting track needs its timestamps <em>scaled</em>, not moved.",
        "The usual cause is a subtitle file authored for one frame rate being played against another. The 23.976 fps ↔ 25 fps pair is the classic case: it is the difference between NTSC-derived and PAL-derived masters, and it produces about four seconds of drift over a feature-length film.",
        "The same maths covers playback speed. If a video was sped up to 1.1× to fit a time slot, its subtitles need dividing by 1.1 — which is a ratio of roughly 0.909.",
      ],
    },
    notes: [
      "A ratio above 1 stretches the timeline, making subtitles appear later; below 1 compresses it, making them appear earlier.",
      "Resampling changes every gap between cues, not just their position. If the original file had correct pacing, the output will too.",
      "The output format follows the input, so an SRT file stays SRT and a VTT file stays VTT.",
      "If the first cue is correct but later ones drift, resampling around that first cue gives the best result — its position barely moves.",
    ],
    faq: [
      ["How do I tell drift from a simple offset?",
       "Check a cue near the start and one near the end. If both are wrong by the same amount, it is an offset. If the error grows through the file, it is drift and needs a ratio."],
      ["What ratio do I use for 23.976 to 25 fps?",
       "Multiply by <code>25 ÷ 23.976 ≈ 1.04271</code>. The preset on this page already has it, so you do not have to type it."],
      ["My video plays faster than the original. What then?",
       "Divide by the speed factor. For 1.1× playback use a ratio of <code>1 ÷ 1.1 ≈ 0.909</code>; for 1.25× use <code>0.8</code>. Both are in the preset list."],
      ["Can this fix a file that is out of sync only in one section?",
       "No. Split the file at the point where sync changes and resample each part separately — a single ratio applies to the whole track."],
    ],
    example: {
      inLabel: "Input — drifting SRT",
      outLabel: "Output — resampled ×1.04271",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n632\n01:40:12,500 --> 01:40:15,500\nGoodbye.",
      after: "1\n00:00:01,043 --> 00:00:04,171\nHello there.\n\n632\n01:44:17,086 --> 01:44:20,213\nGoodbye.",
      cap: "The early cue barely moves, while the late cue shifts by roughly four minutes — that widening gap is exactly what a fixed offset cannot reproduce.",
    },
    troubleshoot: [
      ["The first cue moved too",
       "Resampling scales everything from zero, so the earliest cues shift slightly. If your file starts late, subtract that starting offset first with the shift tool, then resample."],
      ["Subtitles are now drifting the other way",
       "The ratio is inverted. Swap it — use 0.95904 instead of 1.04271 for a 25 fps source played at 23.976."],
      ["Nothing changed in the output",
       "The ratio is 1, which is a no-op. Pick a preset or enter a value other than 1."],
      ["Cues overlap after resampling",
       "Stretching a track that already had tight gaps can push cues into each other. Clean or re-time the crowded section manually after resampling."],
    ],
    related: ["subtitle-timing-check", "shift-subtitles", "clean-subtitles"],
  },
  {
    slug: "sbv-to-srt",
    h1: "SBV to SRT Converter",
    tagline: "Convert YouTube .sbv caption files to SubRip (.srt), right in your browser.",
    metaDesc:
      "Free SBV to SRT converter running entirely in your browser. Turn YouTube .sbv caption downloads into standard SubRip subtitles. No upload, no signup.",
    mode: "sbv-to-srt",
    intro:
      "Captions downloaded from YouTube as <strong>.sbv</strong> use a compact format that most editors and players do not recognise: one line holding <code>start,end</code> as <code>h:mm:ss.mmm</code>, followed by the text, separated by blank lines. SubRip (.srt) is the format virtually everything else accepts, and this page converts between them locally.",
    steps: [
      "Paste your SBV content, or drop the <code>.sbv</code> file onto the box.",
      "The conversion runs in JavaScript on your device — nothing is sent anywhere.",
      "Copy the result or download it as an <code>.srt</code> file.",
    ],
    deep: {
      h2: "Why SBV files fail in most tools",
      body: [
        "SBV has no cue numbers and no arrow between timestamps. It uses a comma to separate start from end, and allows a single-digit hour — <code>0:00:01.000</code> rather than SRT's <code>00:00:01,000</code>.",
        "That difference is why an SBV file renamed to <code>.srt</code> usually loads as nothing at all. Parsers expect the <code>--&gt;</code> separator, do not find it, and silently drop every cue.",
        "SubRip is the safer target because it is understood by desktop editors, mobile players, and the subtitle upload boxes of most video platforms. If you are unsure which format to produce, produce SRT.",
        "Once converted, the file can be shifted, cleaned or resampled with the other tools here — they all read standard SRT.",
      ],
    },
    notes: [
      "SBV timestamps use a period before milliseconds; SRT uses a comma. The conversion rewrites every one.",
      "Cue numbers are added automatically, starting at 1 and incrementing in order.",
      "Blank-line separated blocks with no valid timestamp line are skipped rather than guessed at.",
      "If your source is already WebVTT, use the <a href=\"/tools/vtt-to-srt\">VTT to SRT converter</a> instead.",
    ],
    faq: [
      ["What is an .sbv file?",
       "YouTube's own subtitle download format. It is simpler than SRT — no cue numbers, no arrow — which is convenient to generate but poorly supported by editing software."],
      ["Why does my renamed file show no subtitles?",
       "Because the extension does not change the contents. A file with SBV formatting and an .srt extension has no <code>--&gt;</code> separators, so SRT parsers find no cues and show nothing."],
      ["Is the text changed in any way?",
       "No. Only the timestamp format and cue numbering are rewritten. Line breaks inside a cue and any markup are preserved."],
      ["Does this upload my captions?",
       "No. Everything happens in JavaScript on your device, and the page keeps working with the network disconnected."],
    ],
    example: {
      inLabel: "Input — .sbv",
      outLabel: "Output — .srt",
      before: "0:00:01.000,0:00:04.000\nHello there.\n\n0:00:04.200,0:00:07.000\nHow are you?",
      after: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\nHow are you?",
      cap: "Commas between timestamps become <code>--&gt;</code>, periods before milliseconds become commas, and cue numbers are added.",
    },
    troubleshoot: [
      ["The output is empty",
       "The blocks are not separated by blank lines, or the first line of each block is not a <code>h:mm:ss.mmm,h:mm:ss.mmm</code> pair. Re-export the captions and try again."],
      ["Only some cues converted",
       "Blocks whose first line does not match the timestamp pattern are skipped by design. Check for stray text or merged lines above a cue."],
      ["Timestamps look wrong",
       "SBV allows a one-digit hour. Long recordings exported with a two-digit hour still convert correctly — if times are off, confirm the source file's own timing first."],
      ["I have a .vtt file, not .sbv",
       "Use the <a href=\"/tools/vtt-to-srt\">VTT to SRT converter</a>. VTT and SBV look similar but have different header and separator rules."],
    ],
    related: ["vtt-to-srt", "srt-to-vtt", "clean-subtitles"],
  },
  {
    slug: "merge-subtitles",
    h1: "Merge Subtitle Files",
    tagline: "Combine two SRT or VTT files into one track, with the second file appended after the first.",
    metaDesc:
      "Merge two subtitle files into a single SRT or VTT track in your browser. Joins CD1 and CD2, or adds a second cue set, with no upload.",
    mode: "merge",
    intro:
      "Feature films and long recordings are often split across several subtitle files, and a player will only load one track. Merging them means appending the second file's cues after the first one ends and renumbering the result — which is what this page does locally, in one step.",
    steps: [
      "Paste or drop the <strong>first</strong> subtitle file into the top box.",
      "Paste the <strong>second</strong> file into the box below it.",
      "Optionally set a gap in seconds, then download the merged file.",
    ],
    deep: {
      h2: "Why merging is not just concatenation",
      body: [
        "The naive approach — pasting one file after another — produces a track where the second half restarts at zero. Every cue from the second file then appears at the beginning of the video, overlapping the first half.",
        "A correct merge re-times the second file. Its cues are shifted by however long the first file runs, so the combined track plays straight through. That is what the <em>gap</em> setting adjusts: zero means the second file starts the instant the first one ends.",
        "Cue numbers are then reassigned in order. SubRip numbers are largely cosmetic — most players ignore them — but a continuous sequence makes the file easier to diff and edit afterwards.",
        "If you need the two files to overlap rather than follow each other — a translation track alongside an original, for example — merging is the wrong operation. Players handle those as separate tracks, not one combined file.",
      ],
    },
    notes: [
      "The second file is appended after the <strong>last cue of the first file</strong>, not after its final timestamp — overlapping cues inside a file do not shorten the result.",
      "Both files should be in the same format. The output follows the first file's format.",
      "A gap of one or two seconds reads more naturally than cutting straight from one part to the next.",
      "To merge more than two files, merge the first two, then merge the result with the third.",
    ],
    faq: [
      ["Why does my merged file play both halves at the start?",
       "Because the files were concatenated without re-timing. The second file's timestamps still begin at zero. This tool shifts them by the first file's duration."],
      ["Can I merge more than two files?",
       "Not in one step. Merge the first two, copy the output, then merge that with the third — repeat as needed."],
      ["What gap should I use?",
       "Zero is correct when the parts are continuous. Use one or two seconds if the original files were split at a scene change and you want a beat before the next part starts."],
      ["Does the text get changed?",
       "No. Only timestamps and cue numbers are rewritten; the wording of every cue is preserved exactly."],
    ],
    example: {
      inLabel: "Input — file A, then file B",
      outLabel: "Output — merged",
      before: "A: 1\n00:00:01,000 --> 00:00:04,000\nPart one.\n\nB: 1\n00:00:01,000 --> 00:00:04,000\nPart two.",
      after: "1\n00:00:01,000 --> 00:00:04,000\nPart one.\n\n2\n00:00:04,000 --> 00:00:07,000\nPart two.",
      cap: "File B's cue moves from 00:00:01 to 00:00:04 — the point where file A ends. Set a gap to push it later still.",
    },
    troubleshoot: [
      ["The second file still starts at the beginning",
       "Confirm the second file is in the lower box. Text pasted into the main input is treated as file A."],
      ["Cues from the two files overlap",
       "Increase the gap. If file A's last cue ends later than you expect, the append point moves with it."],
      ["The output is empty",
       "At least one of the two boxes has no recognisable cues. Both files must use the <code>--&gt;</code> separator between timestamps."],
      ["Numbering restarts in the middle",
       "That happens when the second file was parsed as a separate track. Re-paste both files, ensuring there is no stray text between them."],
    ],
    related: ["split-subtitles", "shift-subtitles", "srt-to-csv"],
  },
  {
    slug: "srt-to-csv",
    h1: "Subtitles to CSV Converter",
    tagline: "Export SRT or VTT cues to a CSV spreadsheet with start time, end time, duration and text.",
    metaDesc:
      "Convert subtitle files to CSV in your browser. One row per cue with start, end, duration and text for translation, review or spreadsheets. No upload.",
    mode: "to-csv",
    intro:
      "A subtitle file is awkward to work with in a spreadsheet, but translation, proofreading and timing review are all easier in rows. This converter flattens an SRT or VTT file into CSV — one row per cue, with the start time, end time, duration and text as separate columns.",
    steps: [
      "Paste or drop your subtitle file.",
      "The CSV is generated locally as you type.",
      "Download it and open it in Excel, Google Sheets, Numbers or a CAT tool.",
    ],
    deep: {
      h2: "What the columns are for",
      body: [
        "<strong>index</strong> is the cue number, starting at 1. It keeps rows identifiable after sorting or filtering, which matters because most review workflows reorder rows.",
        "<strong>start</strong> and <strong>end</strong> use SubRip's <code>hh:mm:ss,mmm</code> form. They are written as text rather than a spreadsheet time so that no application silently reinterpret them.",
        "<strong>duration_ms</strong> is the cue's length in milliseconds. This is the column to sort by when hunting for cues that are too short to read or too long to sit comfortably on screen.",
        "<strong>text</strong> has its internal line breaks collapsed to spaces so that one cue stays on one row. Quotes inside the text are escaped as <code>\"\"</code>, which is the CSV standard.",
      ],
    },
    notes: [
      "Text is quoted, so commas and quotation marks inside a cue survive the round trip.",
      "Multi-line cues become a single row with line breaks replaced by spaces.",
      "The file is UTF-8. If your spreadsheet shows garbled characters, import it and choose UTF-8 explicitly rather than double-clicking the file.",
      "This export is one-way by design — it is for review and translation, not for turning a spreadsheet back into subtitles.",
    ],
    faq: [
      ["Can I convert the CSV back into subtitles?",
       "Not with this tool. The export exists to get cues into a spreadsheet for review or translation; edit the original subtitle file to change timing."],
      ["Why are times written as text?",
       "Because spreadsheets guess. A value like <code>00:01:05,000</code> can be silently reinterpreted as a date or a number depending on locale. Keeping it as text preserves exactly what the subtitle file said."],
      ["Does it keep the formatting tags?",
       "Yes — tags such as <code>&lt;i&gt;</code> stay in the text column. Strip them beforehand with the <a href=\"/tools/clean-subtitles\">clean subtitles tool</a> if you want plain text."],
      ["Is there a cue limit?",
       "No. Nothing is uploaded, so the practical limit is your browser's memory. Files with several thousand cues convert instantly."],
    ],
    example: {
      inLabel: "Input — .srt",
      outLabel: "Output — .csv",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\nHow are you?",
      after: "index,start,end,duration_ms,text\n1,\"00:00:01,000\",\"00:00:04,000\",3000,\"Hello there.\"\n2,\"00:00:04,200\",\"00:00:07,000\",2800,\"How are you?\"",
      cap: "One row per cue. Duration in milliseconds makes it easy to sort by cue length and spot the ones that are too short to read.",
    },
    troubleshoot: [
      ["The CSV is empty",
       "No cues were recognised. Check that the file uses <code>--&gt;</code> between timestamps — a file renamed from SBV will not parse."],
      ["Characters look garbled in Excel",
       "Excel often guesses the wrong encoding. Use Data → From Text/CSV and select UTF-8 rather than opening the file directly."],
      ["Rows are split in the wrong place",
       "That happens when opening the file in a locale that uses semicolons as the separator. Import it manually and set the delimiter to a comma."],
      ["Quotes look doubled",
       "That is correct CSV escaping. A quote inside a cue is written as <code>\"\"</code> and will display as a single quote once imported."],
    ],
    related: ["clean-subtitles", "remove-timestamps", "shift-subtitles"],
  },
  {
    slug: "split-subtitles",
    h1: "Split Subtitle Files",
    tagline: "Cut one SRT or VTT track into two files at any timestamp, right in your browser.",
    metaDesc:
      "Free subtitle splitter that runs in your browser. Split an SRT or VTT file into two parts at any timestamp — CD1 and CD2, halves, or one scene. No upload, no signup.",
    mode: "split",
    intro:
      "A single subtitle track that covers a two-hour film, a double-episode recording or a lecture is awkward to edit, review or hand to a translator. Splitting it means choosing a cut point and writing every cue before that point into one file and every cue after it into another — which is exactly what this page does, with nothing leaving your device.",
    steps: [
      "Paste your subtitle file into the box, or drop the <code>.srt</code> / <code>.vtt</code> file onto it.",
      "Set the <strong>split point</strong> — seconds, <code>m:ss</code> or <code>h:mm:ss</code> all work.",
      "Choose <strong>Part 1</strong> or <strong>Part 2</strong> and download it. Switch the dropdown to get the other half.",
    ],
    deep: {
      h2: "What a correct split has to preserve",
      body: [
        "The obvious approach — cutting the text at a line boundary — breaks the file, because a cue is not a line. A cue is a number, a timing pair and one or more text lines, and cutting in the middle of that group leaves a file with a timestamp but no text, or text with no timestamp. This tool splits between cues, never inside one.",
        "Timestamps are <strong>not</strong> re-based. Part 2 keeps the original time codes, so if you split a film at 45 minutes, the second file still starts at <code>00:45:00</code>. That is what you want when the two halves are played back to back against the same video, and it is why the two files remain interchangeable with the original.",
        "If you need Part 2 to start at zero instead — because it will be attached to a separately exported video clip — run it through the <a href=\"/tools/shift-subtitles\">shift subtitles tool</a> afterwards and pull it back by the split point. Doing both in one step would silently corrupt the first half.",
        "Cue numbers are reassigned from 1 in each part. SubRip numbers are cosmetic to most players, but continuous numbering makes a file diff cleanly and keeps editors from complaining.",
        "The cut is made on a cue's <em>start</em> time. A cue that straddles the split point — started before it, ends after it — stays whole in Part 1 rather than being sliced in half, because a half cue is always worse than a slightly uneven split.",
      ],
    },
    notes: [
      "Both parts keep the input format: an SRT in gives two SRTs, a VTT in gives two VTTs.",
      "A cue that straddles the split point is kept whole in Part 1, so the two parts never share a broken line.",
      "Part 2 keeps the original time codes. Use <a href=\"/tools/shift-subtitles\">shift subtitles</a> if you need it to start at zero.",
      "To split into more than two parts, split once, then split Part 2 again at the next point.",
      "The two parts are independent files — you can merge them back later with the <a href=\"/tools/merge-subtitles\">merge tool</a> if the split point was wrong.",
    ],
    faq: [
      ["Does Part 2 start at zero?",
       "No, and that is deliberate. Part 2 keeps the original time codes so both halves line up with the same video. If you are attaching Part 2 to a separately cut video clip, run it through the <a href=\"/tools/shift-subtitles\">shift subtitles tool</a> afterwards."],
      ["What happens to a cue that crosses the split point?",
       "It stays in Part 1, intact. Splitting a cue would leave one half with text and no sensible timing, so the cut always lands between cues."],
      ["Can I split into three or more parts?",
       "Not in one step. Split at the first point, download Part 2, then paste it back in and split it at the next point. Repeat for as many parts as you need."],
      ["Do both halves keep the same format?",
       "Yes. The output follows the input, so an SRT produces two SRT files and a VTT produces two VTT files. Convert first with the <a href=\"/tools/srt-to-vtt\">SRT to VTT converter</a> if you need the other one."],
      ["Is my file uploaded?",
       "No. Parsing and splitting happen in JavaScript on your device. You can disconnect from the network after this page loads and the splitter keeps working."],
    ],
    example: {
      inLabel: "Input — one file, split at 00:01:00",
      outLabel: "Output — Part 1",
      before:
        "1\n00:00:10,000 --> 00:00:13,000\nFirst half of the film.\n\n2\n00:00:58,000 --> 00:01:02,000\nStill the first half.\n\n3\n00:01:05,000 --> 00:01:08,000\nNow the second half.",
      after: "1\n00:00:10,000 --> 00:00:13,000\nFirst half of the film.\n\n2\n00:00:58,000 --> 00:01:02,000\nStill the first half.",
      cap: "Cue 3 starts after the split point, so it moves to Part 2. Cue 2 straddles it — it started before — so it stays whole in Part 1.",
    },
    troubleshoot: [
      ["Both parts are empty",
       "No cues were recognised. Check that the file uses <code>--&gt;</code> between timestamps. A file renamed from SBV will not parse."],
      ["Everything ended up in Part 1",
       "The split point is later than the last cue. Try <code>45:00</code> instead of <code>45</code> — a bare number is read as seconds, so <code>45</code> means 45 seconds in, not 45 minutes."],
      ["Everything ended up in Part 2",
       "The split point is 0 or earlier than the first cue. Check the field contains a time, not a stray character."],
      ["The download is named part2 but shows Part 1 content",
       "The dropdown and the download name are set together, so re-select the part and download again. The name always matches what is in the output box."],
      ["Part 2 plays at the wrong time",
       "It intentionally keeps original timings. Pull it back to zero with the <a href=\"/tools/shift-subtitles\">shift subtitles tool</a> if the video it belongs to was cut separately."],
    ],
    related: ["merge-subtitles", "shift-subtitles", "srt-to-csv"],
  },
  {
    slug: "fix-subtitle-encoding",
    h1: "Fix Garbled Subtitles (Encoding Repair)",
    tagline: "Repair mojibake — subtitles showing Ã©, â€™ or Ð¿Ñ€Ð¸Ð²ÐµÑ‚ instead of real characters.",
    metaDesc:
      "Free mojibake repair for subtitle files. Fixes text saved as UTF-8 but opened as Windows-1252 or Windows-1251. Runs entirely in your browser, no upload.",
    mode: "fix-encoding",
    intro:
      "When a subtitle file shows <code>Caf\u00c3\u00a9</code> instead of <code>Caf\u00e9</code>, or <code>\u00d0\u00bf\u00d1\u20ac\u00d0\u00b8\u00d0\u00b2\u00d0\u00b5\u00d1\u201a</code> instead of Cyrillic text, the file itself is usually fine — it was simply read with the wrong character encoding. This page reverses that mistake and writes the characters back, locally.",
    steps: [
      "Paste the garbled text, or drop the file onto the box.",
      "Choose what it was <strong>read as</strong>, or leave it on auto-detect.",
      "Copy or download the repaired text and save it as UTF-8.",
    ],
    deep: {
      h2: "Why subtitles turn into garbage",
      body: [
        "A subtitle file is a sequence of bytes. UTF-8 spells <code>\u00e9</code> as two bytes, <code>C3 A9</code>. An older editor that assumes a single-byte codepage reads those two bytes as two separate characters — <code>\u00c3</code> and <code>\u00a9</code> — and displays <code>Caf\u00c3\u00a9</code>. Nothing was lost; the bytes were just interpreted twice under different rules.",
        "The repair is therefore mechanical: take each character, work out which <em>single byte</em> it must have been, then decode that byte sequence as UTF-8. No dictionary, no guessing, no language model — which is why it can run offline in a browser and produce a result you can verify character by character.",
        "The two codepages that account for almost every real case are <strong>Windows-1252</strong> (Western European) and <strong>Windows-1251</strong> (Cyrillic). Auto-detect tries 1252 first and falls back to 1251, because the two produce visibly different garbage and the correct one always decodes cleanly while the wrong one usually hits an invalid byte sequence.",
        "<strong>Double encoding</strong> happens when the mistake is made twice — a file that was already mojibake gets saved and misread again. The tell-tale is garbage that contains <code>\u00c3\u0082</code> or <code>\u00c3\u00a2\u20ac\u201d</code>. Tick the <em>doubly encoded</em> box to run the repair twice.",
        "This tool refuses to guess. If the byte sequence it reconstructs is not valid UTF-8, or if the result is mostly control characters, it leaves your text alone rather than handing back something worse. A tool that always returns something would be a tool you could not trust.",
      ],
    },
    notes: [
      "This repairs <strong>misread UTF-8</strong>. If every non-ASCII character is a plain <code>?</code> or a box, the information was already destroyed and no repair can recover it.",
      "The repair works on the whole text, so timestamps, cue numbers and <code>--&gt;</code> arrows are untouched.",
      "Auto-detect tries Windows-1252 first, then Windows-1251. Pick one explicitly if you know where the file came from.",
      "Save the result as <strong>UTF-8</strong>. Re-saving it in the old codepage re-creates the same problem.",
      "If your player still shows garbage after this, the issue is the player's encoding setting, not the file — check whether it has a forced codepage option.",
    ],
    faq: [
      ["Why does my subtitle file show Ã© instead of é?",
       "Because the file's UTF-8 bytes were read as a single-byte codepage. <code>\u00e9</code> is stored as two bytes; read under Windows-1252 they become <code>\u00c3</code> and <code>\u00a9</code>. This page reverses exactly that step."],
      ["Can it fix question marks and empty boxes?",
       "No. A <code>?</code> means the character was already unrepresentable when the file was written, and the original byte is gone. This tool can only recover what is still in the file."],
      ["Do I need to know which encoding was used?",
       "Usually not — auto-detect covers the overwhelming majority. If the result still looks wrong, switch <em>Read as</em> to the other codepage and compare."],
      ["What does 'doubly encoded' mean?",
       "The misreading happened twice, so the garbage contains sequences like <code>\u00c3\u0082</code> or <code>\u00e2\u20ac\u201d</code> rather than a single layer. Ticking the box runs the repair two passes."],
      ["Does it work on Cyrillic and other scripts?",
       "Yes for Cyrillic via Windows-1251, and for anything else that was genuinely UTF-8 underneath — Greek, CJK, Arabic and emoji all repair the same way, because the bytes are the bytes."],
      ["Is the file uploaded anywhere?",
       "No. The repair is arithmetic on character codes, done in JavaScript in your browser. Confidential captions never leave your machine."],
    ],
    example: {
      inLabel: "Input — misread as Windows-1252",
      outLabel: "Output — repaired UTF-8",
      before:
        "Caf\u00c3\u00a9 ouvert jusqu'\u00c3\u00a0 minuit\nL'\u00c3\u00a9quipe vous attend \u00e2\u0080\u0094 ce soir.",
      after: "Caf\u00e9 ouvert jusqu'\u00e0 minuit\nL'\u00e9quipe vous attend \u2014 ce soir.",
      cap: "Two bytes per accented character become one character each. The em dash is three bytes in UTF-8, which is why it shows as three garbage characters before the repair.",
    },
    troubleshoot: [
      ["Nothing changed",
       "Either the text is already correct, or the damage is not mojibake. Look for <code>\u00c3</code>, <code>\u00c2</code>, <code>\u00e2\u20ac</code>, <code>\u00d0</code> or <code>\u00d1</code> — if none appear, no repair applies."],
      ["Still garbled after repair",
       "Switch <em>Read as</em> to the other codepage. Auto-detect tries Western first, so a Cyrillic file sometimes needs the explicit setting."],
      ["Strange symbols appeared that were not there before",
       "That is what a wrong guess looks like, so the tool should have refused. If you see this, the source was probably not UTF-8 to begin with — reload the page and try the other codepage."],
      ["Only part of the file was fixed",
       "Mixed-encoding files exist: one section saved as UTF-8, another as the old codepage. Repair each section separately and paste the results together."],
      ["The player still shows garbage",
       "The file is now correct but the player is forcing a codepage. Look for an encoding or subtitle codepage setting in the player and set it to UTF-8."],
    ],
    related: ["clean-subtitles", "srt-to-vtt", "vtt-to-srt"],
  },
  {
    slug: "subtitle-timing-check",
    h1: "Subtitle Timing Checker",
    tagline: "Audit an SRT or VTT file for cues that are too fast, too short, too long or overlapping.",
    metaDesc:
      "Free subtitle QC checker. Flags unreadable reading speed (CPS), cues that are too short or too long, over-long lines and overlapping cues. Runs in your browser, no upload.",
    mode: "check",
    intro:
      "A subtitle file can look perfect in an editor and still be unreadable on screen: cues that vanish before the eye can finish them, lines that run past the edge of the frame, two cues on screen at once. This checker measures every cue against the limits broadcasters and streaming platforms actually use and lists the ones that break them.",
    steps: [
      "Paste your subtitle file, or drop the <code>.srt</code> / <code>.vtt</code> file onto the box.",
      "Adjust the limits if you are working to a specific style guide.",
      "Read the report, then open the flagged timestamps in your editor and fix them.",
    ],
    deep: {
      h2: "The four things that make subtitles unreadable",
      body: [
        "<strong>Reading speed</strong> is measured in characters per second (CPS). Most style guides land between 12 and 21 CPS; 20 is a common hard ceiling for streaming delivery. A cue at 30 CPS is technically valid and completely unreadable, which is why no player will ever warn you about it.",
        "<strong>Minimum duration</strong> stops the opposite failure — a two-word cue that flashes for 300 milliseconds. Even a short line needs roughly 0.8 seconds on screen because the eye needs time to find the text at all, not just to read it. The usual floor is about five-sixths of a second.",
        "<strong>Maximum duration</strong> catches the cue that nobody noticed was left on screen for twelve seconds. Viewers re-read a subtitle that never changes and assume it is broken, so seven seconds is a practical ceiling even when the dialogue continues.",
        "<strong>Line length and line count</strong> are about layout rather than timing. Around 40\u201342 characters per line and two lines per cue is what fits comfortably on a phone in portrait. Wider than that and the player either wraps or clips, and neither is under your control after upload.",
      ],
    },
    notes: [
      "Characters per second counts every character including spaces, which is the convention used by most delivery specifications.",
      "Formatting tags such as <code>&lt;i&gt;</code> and ASS overrides are stripped before measuring, so styling does not inflate the count.",
      "An overlap is reported when the next cue starts before the current one ends. Sub-frame overlaps are ignored, because rounding produces them harmlessly.",
      "The default limits match common streaming practice. Broadcast guides are often stricter — some sit at 16 or 17 CPS.",
      "The report is a finding list, not a fix. Timing changes are yours to make; use the <a href=\"/tools/shift-subtitles\">shift</a> or <a href=\"/tools/resync-subtitles\">resync</a> tools when the whole track needs the same correction.",
    ],
    faq: [
      ["What CPS should I aim for?",
       "12\u201320 is comfortable, with 20 a common hard ceiling. Children's content and language-learning material sit lower, around 12\u201315. Fast dialogue that genuinely cannot fit is usually condensed rather than sped up."],
      ["Why is my minimum duration flagged when the cue is one word?",
       "Because the eye has to locate the text before it can read it. Even a single word needs roughly 0.8 seconds on screen, which is why the default floor is 833 ms."],
      ["Does it count formatting tags?",
       "No. HTML tags and ASS override codes are stripped before measuring, so a heavily styled cue is not penalised for its markup."],
      ["Can it fix the problems it finds?",
       "No, deliberately. Changing reading speed means rewriting the text, and changing durations means editing timings — both are judgement calls. The report tells you where to look."],
      ["Are the reported overlaps real?",
       "Only if they exceed one millisecond. Sub-frame overlaps come from rounding and are ignored, so anything reported is visible to a viewer."],
      ["Is there a cue limit?",
       "No. Nothing is uploaded, so the practical limit is browser memory. Files with several thousand cues are checked instantly."],
    ],
    example: {
      inLabel: "Input — .srt",
      outLabel: "Output — report",
      before:
        "1\n00:00:01,000 --> 00:00:02,200\nThe quick brown fox jumps over the extremely lazy dog tonight\n\n2\n00:00:02,100 --> 00:00:02,400\nHi.",
      after:
        "Subtitle timing report\n======================\n2 cues checked \u00b7 2 flagged (100%)\n\nToo fast      (> 20.0 CPS)                  1\nLine too long (> 42 chars)                  1\nToo short     (< 0.83s)                     1\nOverlapping cues                            1\n\n--- Flagged cues ---\n\n#0001  00:00:01,000 -> 00:00:02,200  (1.20s, 61.7 CPS)\n        The quick brown fox jumps over the extremely lazy dog tonight\n        ! too fast \u2014 61.7 CPS (max 20.0); line too long \u2014 61 chars (max 42)",
      cap: "Cue 1 carries 74 characters in 1.2 seconds. Cue 2 is both too short and starts before cue 1 has ended — the report catches all three problems at once.",
    },
    troubleshoot: [
      ["The report is empty",
       "No cues were recognised. Check that the file uses <code>--&gt;</code> between timestamps — a plain transcript or an SBV file will not parse."],
      ["Nothing is flagged but the subtitles still feel rushed",
       "Raise the sensitivity by lowering the CPS limit. The default of 20 is a delivery ceiling, not a comfort target; many editors work to 16 or 17."],
      ["Almost every cue is flagged",
       "The file may be auto-generated caption output with no line balancing. Run it through the <a href=\"/tools/clean-subtitles\">clean subtitles tool</a> first, then re-check."],
      ["Durations look wrong",
       "The checker reads the timestamps as written. If the whole track is offset, fix it with the <a href=\"/tools/shift-subtitles\">shift tool</a> before checking."],
      ["Counts do not add up to the flagged total",
       "One cue can break several rules at once. The summary counts rule violations; the flagged list counts cues."],
    ],
    related: ["subtitle-timing-check", "resync-subtitles", "shift-subtitles"],
  },
  {
    slug: "ass-to-srt",
    h1: "ASS / SSA to SRT Converter",
    tagline: "Turn SubStation Alpha (.ass, .ssa) subtitles into clean SubRip (.srt) — in your browser, with nothing uploaded.",
    metaDesc:
      "Free ASS and SSA to SRT converter that runs entirely in your browser. Reads the [Events] section, strips override tags, converts \\N line breaks and keeps italics and bold as SRT tags. No upload, no signup.",
    mode: "ass-to-srt",
    intro:
      "SubStation Alpha is the format fansub groups and heavily styled releases use. Dialogue lives in an <code>[Events]</code> section, one <code>Dialogue:</code> line per cue, and the order of the fields on those lines is declared by a <code>Format:</code> line above them. Most editors, mobile players and upload forms cannot read any of that, so this converter rewrites the cues as SubRip.",
    steps: [
      "Paste your <code>.ass</code> or <code>.ssa</code> file into the box, or drop it onto the page.",
      "Dialogue lines are read in the order the file's own <code>Format:</code> line declares — the parser never assumes a fixed column order, which is what breaks most converters on SSA v4.00 files.",
      "Copy the result or download it as a <code>.srt</code> file.",
    ],
    deep: {
      h2: "What survives the conversion, and what cannot",
      body: [
        "<strong>Timing is preserved exactly.</strong> ASS writes times as <code>0:00:01.00</code> — one digit for hours, two for centiseconds. SubRip wants milliseconds with three digits and a comma. The converter multiplies the centiseconds by ten, so a cue at <code>0:01:02.35</code> comes out as <code>00:01:02,350</code> and lands in exactly the same place on the timeline.",
        "<strong>Italics and bold come across.</strong> ASS marks them with override blocks such as <code>{\\i1}</code>, <code>{\\i0}</code>, <code>{\\b1}</code> and <code>{\\b0}</code>, which SubRip does not understand. Those are translated into the SRT tags <code>&lt;i&gt;</code> and <code>&lt;b&gt;</code>, and <code>{\\r}</code> closes whatever was open. Everything else inside an override block — fonts, colours, outlines, karaoke timing, vector drawings — is discarded, because SubRip has nowhere to put it.",
        "<strong>Positioning is lost, and there is no way around that.</strong> ASS can place a line anywhere on the frame using <code>{\\pos()}</code>, <code>{\\an8}</code> or <code>{\\move()}</code>. SubRip has no positioning at all. Sign translations that sit beside a speaker, or captions pushed to the top of the frame so they do not cover a face, will jump to the bottom centre. If a release depends on that layout, keep the ASS as the master file and treat the SRT as a delivery copy only.",
        "<strong>Line breaks are normalised.</strong> ASS uses <code>\\N</code> for a hard break and <code>\\n</code> for a soft one; both become real line breaks, which is what SubRip expects. <code>\\h</code>, a non-breaking space, becomes an ordinary space. Cue numbers are regenerated from 1 so the file opens in every editor.",
      ],
    },
    notes: [
      "Both <code>.ass</code> (v4.00+) and <code>.ssa</code> (v4.00) are accepted. The SSA variant adds a <code>Marked=0</code> field to each Dialogue line, which is handled by reading the <code>Format:</code> line rather than guessing.",
      "A <code>Dialogue:</code> line is split on commas only as far as the declared field count — the Text field is last and keeps any commas of its own. This is why naive converters cut dialogue off at the first comma in the sentence.",
      "Comments (<code>Comment:</code> lines), <code>Picture:</code> and <code>Sound:</code> lines are not dialogue and are skipped.",
      "Karaoke effects (<code>{\\k}</code>, <code>{\\kf}</code>) are timing data, not text, so they are removed rather than rendered. The result is a plain reading copy.",
    ],
    faq: [
      ["Does this upload my subtitle file anywhere?",
       "No. The whole file is parsed in JavaScript on your device. You can disconnect from the network after the page loads and the converter still works."],
      ["Why did my sign translations end up at the bottom of the screen?",
       "Because SRT has no positioning. ASS places those lines with <code>{\\pos()}</code> or <code>{\\an8}</code>, and SubRip has no equivalent field to carry the coordinates. The text is kept; the placement is not."],
      ["The output has no italics even though the original was italicised",
       "Only <code>{\\i1}</code> and <code>{\\b1}</code> style overrides map to SRT tags. If a release styled italics through the <code>[V4+ Styles]</code> section instead of inline overrides, the styling lives in the style definition rather than the cue, and there is no inline marker to translate."],
      ["Can I convert the other way, from SRT to ASS?",
       "Yes — use the <a href=\"/tools/srt-to-ass\">SRT to ASS converter</a>. It writes a complete ASS v4+ script with a default style and <code>Dialogue:</code> lines."],
    ],
    example: {
      inLabel: "Input — .ass",
      outLabel: "Output — .srt",
      before: "[Script Info]\nScriptType: v4.00+\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello there.\nDialogue: 0,0:00:04.20,0:00:07.00,Default,,0,0,0,,{\\i1}Music playing{\\i0}\\NSign on wall: EXIT",
      after: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\n<i>Music playing</i>\nSign on wall: EXIT",
      cap: "Centiseconds became milliseconds, {\\i1} became <i>, and \\N became a real line break. Nothing else about the cues changed.",
    },
    troubleshoot: [
      ["No dialogue lines found",
       "The file needs an <code>[Events]</code> section, and that section needs a <code>Format:</code> line naming <code>Start</code>, <code>End</code> and <code>Text</code>. A file where the header was stripped out, or where cues were saved without the events block, has nothing to convert."],
      ["Timestamps look wrong — everything is ten times too long",
       "That is the signature of a file that was already converted from SRT by a tool that treated centiseconds as milliseconds. Re-export the original ASS and convert from that instead."],
      ["The output is empty even though the file opens fine in a player",
       "Check the extension and the first line. Some releases ship MicroDVD (<code>{0}{25}text</code>) or a plain script inside a file named <code>.ass</code>. Those have no <code>Dialogue:</code> lines at all, so they need a different converter."],
      ["Styling beyond italics disappeared",
       "Fonts, colours and outlines are stored in override blocks or in the <code>[V4+ Styles]</code> section. SubRip carries only inline <code>&lt;i&gt;</code>, <code>&lt;b&gt;</code> and <code>&lt;u&gt;</code>, so everything else is dropped by design rather than by mistake."],
      ["Two languages came out stacked in one cue",
       "That is how the source was written — one <code>Dialogue:</code> line containing both languages separated by <code>\\N</code>. Split it into two files if you need one language per track."],
    ],
    related: ["srt-to-vtt", "clean-subtitles", "subtitle-timing-check"],
  },
  {
    slug: "srt-to-ass",
    h1: "SRT to ASS Converter",
    tagline: "Turn SubRip (.srt) subtitles into a complete ASS v4+ script with a default style, ready for styled players.",
    metaDesc:
      "Free SRT to ASS converter that runs in your browser. Produces a valid ASS v4+ file with Script Info, a V4+ Styles block and Dialogue events. Italics and bold convert to override tags. No upload, no signup.",
    mode: "srt-to-ass",
    intro:
      "ASS is the format that supports fonts, colours, positioning and karaoke — which is why fansub groups and staged releases use it. SubRip supports none of that, so converting SRT upwards gives you a file a player like mpv, VLC or Aegisub can restyle, rather than a file that is already correct.",
    steps: [
      "Paste your <code>.srt</code> content into the box, or drop the file onto it.",
      "A complete ASS v4+ script is written: <code>[Script Info]</code>, one <code>Default</code> style in <code>[V4+ Styles]</code>, and one <code>Dialogue:</code> line per cue in <code>[Events]</code>.",
      "Copy the result or download it as an <code>.ass</code> file, then restyle it in Aegisub or your player of choice.",
    ],
    deep: {
      h2: "Why the generated file looks plain at first",
      body: [
        "<strong>A converter cannot invent styling.</strong> SRT records text and timing, nothing else. So the ASS that comes out has one style — Arial at 64px, white with a black outline, centred near the bottom — and every cue points at it. That is a working baseline, not a finished look. The point of converting is to get the cues into a format where styling is <em>possible</em>; the styling itself is a design decision you make afterwards.",
        "<strong>Timing converts cleanly in this direction.</strong> SubRip writes <code>00:00:01,000</code> with milliseconds. ASS writes <code>0:00:01.00</code> with centiseconds, so milliseconds are divided by ten and rounded down. A cue at <code>00:00:04,205</code> becomes <code>0:00:04.20</code> — a five millisecond difference, well below a frame at any normal frame rate.",
        "<strong>Inline tags become override blocks.</strong> <code>&lt;i&gt;</code> and <code>&lt;b&gt;</code> in the SRT are rewritten as <code>{\\i1}</code> / <code>{\\i0}</code> and <code>{\\b1}</code> / <code>{\\b0}</code>, and any other markup is stripped rather than left to confuse the parser. Line breaks inside a cue become <code>\\N</code>, the ASS hard break.",
        "<strong>The PlayRes is set to 1920×1080.</strong> ASS positioning and font sizes are relative to the resolution declared in <code>[Script Info]</code>. Matching that to your video's resolution keeps the styling proportional — if your source is 1280×720, change <code>PlayResX</code> and <code>PlayResY</code> before you start styling, otherwise every measurement you set will be scaled.",
      ],
    },
    notes: [
      "The output is ASS v4.00+, not SSA v4.00. v4.00+ is what modern tools expect; the older SSA variant is only needed for legacy hardware players.",
      "Cue order and timing are preserved. Only the container changes.",
      "A single <code>Default</code> style is written. Add more styles in Aegisub if you want to distinguish speakers or sign translations.",
      "If the source SRT was itself converted from ASS, positioning and karaoke are already gone — this converter cannot bring them back, only supply a file that could carry them next time.",
    ],
    faq: [
      ["Will my subtitles look the same in the player?",
       "The text and timing will match. The appearance will not, because the generated file uses one plain style. That is deliberate: SRT carries no styling to preserve, so the converter supplies a neutral baseline instead of guessing at a look."],
      ["Why 1920×1080?",
       "It is the most common modern delivery resolution, and ASS measurements scale from it. If your video is a different size, edit <code>PlayResX</code> and <code>PlayResY</code> in the <code>[Script Info]</code> block to match."],
      ["Can I convert back to SRT afterwards?",
       "Yes — the <a href=\"/tools/ass-to-srt\">ASS to SRT converter</a> reads this file back. Italics and bold survive the round trip; anything you add in Aegisub beyond that will not."],
      ["Does this upload my file?",
       "No. The conversion runs entirely in your browser. Nothing is sent to a server, and there is no file size limit beyond your own memory."],
    ],
    example: {
      inLabel: "Input — .srt",
      outLabel: "Output — .ass",
      before: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\n<i>Music playing</i>",
      after: "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, ...\nStyle: Default,Arial,64,&H00FFFFFF,...\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello there.\nDialogue: 0,0:00:04.20,0:00:07.00,Default,,0,0,0,,{\\i1}Music playing{\\i0}",
      cap: "Milliseconds became centiseconds, <i> became {\\i1}, and the cues now sit in an [Events] block that a player can restyle.",
    },
    troubleshoot: [
      ["The player shows the file but no subtitles",
       "Check that the <code>[Events]</code> block still contains the <code>Format:</code> line — ASS needs it to know which column is which. If you edited the file by hand and removed it, the player will read the Dialogue lines as malformed."],
      ["Text after a comma in a cue was cut off",
       "That happens when a Dialogue line is edited by hand and the Text field is split at the wrong comma. The Text field is last, so it must absorb every remaining comma in the line."],
      ["Fonts look enormous or tiny",
       "The <code>PlayResX</code> / <code>PlayResY</code> values do not match your video. ASS sizes are relative to that declared resolution, so a mismatch scales every measurement."],
      ["Italics show as literal {\\i1} text",
       "The override block landed outside a cue, or the braces were escaped. Override codes only work inside the Text field of a Dialogue line."],
      ["My styling disappeared after round-tripping through SRT",
       "SRT has no field for positioning, fonts or karaoke, so any of that is lost the moment a file passes through it. Keep the ASS as the master and derive SRT copies from it, not the other way around."],
    ],
    related: ["ass-to-srt", "srt-to-vtt", "clean-subtitles"],
  },
  {
    slug: "ttml-to-srt",
    published: "2026-09-21",
    h1: "TTML / DFXP to SRT Converter",
    tagline: "Turn TTML and DFXP captions (.ttml, .dfxp, .xml) into SubRip (.srt) in your browser — including offset times such as 10s, 100ms and 30f.",
    metaDesc:
      "Free TTML and DFXP to SRT converter that runs entirely in your browser. Reads clock times (hh:mm:ss.mmm), frame times (hh:mm:ss:ff) and offset times (10s, 100ms, 30f, 100t), decodes XML entities and strips styling. No upload, no signup.",
    mode: "ttml-to-srt",
    intro:
      "TTML is the format streaming platforms actually deliver. Netflix, Amazon, Disney+ and the BBC all ship captions as TTML or one of its profiles — DFXP and IMSC — which is why a caption file pulled from a broadcaster will not open in VLC and will not hand off cleanly to a video editor. The cues are XML <code>&lt;p&gt;</code> elements with <code>begin</code> and <code>end</code> attributes, and the times inside them can be written four different ways. This converter reads all four and writes SubRip.",
    steps: [
      "Paste the <code>.ttml</code>, <code>.dfxp</code> or <code>.xml</code> file into the box, or drop it onto the page.",
      "Every <code>&lt;p&gt;</code> element is read, its <code>begin</code> time and its <code>end</code> or <code>dur</code> time are converted to milliseconds, and inline markup is stripped from the text.",
      "Copy the result or download it as a <code>.srt</code> file.",
    ],
    deep: {
      h2: "Four ways TTML writes a timestamp",
      body: [
        "<strong>Clock time with milliseconds</strong> — <code>00:01:02.350</code>. This is the common case and the one closest to SubRip. A comma separator (<code>00:01:02,350</code>) is accepted as well, because some exporters emit it by mistake.",
        "<strong>Clock time with frames</strong> — <code>00:01:02:11</code>. The fourth field is frames, not milliseconds, so it only means something once it has been divided by the frame rate. That rate comes from <code>ttp:frameRate</code> on the root <code>&lt;tt&gt;</code> element; when the file does not declare one, 30 fps is assumed. A file authored at 25 fps and read as if it were 30 fps drifts by roughly 17 percent, which is the single most common reason TTML-to-SRT timing is right at the start of a file and wrong at the end.",
        "<strong>Offset times</strong> — <code>10s</code>, <code>100ms</code>, <code>1.5m</code>, <code>3h</code>. These are durations rather than points on a clock, and TTML permits them in <code>begin</code> as well as in <code>dur</code>. The converter understands <code>h</code>, <code>m</code>, <code>s</code> and <code>ms</code>.",
        "<strong>Frame and tick offsets</strong> — <code>30f</code> and <code>100t</code>. Frames are divided by the frame rate, ticks by the rate declared as <code>ttp:tickRate</code>. Both turn up in broadcast files where timing is authored on a frame grid rather than in wall-clock seconds.",
        "<strong>Entities are decoded.</strong> Because the source is XML, an ampersand arrives as <code>&amp;amp;</code> and a quote as <code>&amp;quot;</code>. Named and numeric entities are both decoded before the text reaches SubRip, so what you see in the output is what the caption was meant to say.",
      ],
    },
    notes: [
      "Profiles accepted: TTML 1.0, DFXP and IMSC. All three share the same <code>&lt;tt&gt;</code> / <code>&lt;body&gt;</code> / <code>&lt;div&gt;</code> / <code>&lt;p&gt;</code> structure, so one parser covers them.",
      "If a cue declares <code>begin</code> but no <code>end</code>, the <code>dur</code> attribute is used instead. A cue with neither is skipped rather than given a guessed duration.",
      "<code>&lt;br/&gt;</code> becomes a real line break. Nested <code>&lt;span&gt;</code> elements are unwrapped and their text kept — the <code>tts:fontStyle</code>, <code>tts:color</code> and <code>tts:textDecoration</code> styling on them is dropped, because SubRip has nowhere to put it.",
      "Regions, positioning and background images (<code>smpte:backgroundImage</code>) do not survive. TTML can place a caption anywhere on the frame; SubRip cannot.",
      "The frame rate is read from the header only, not from per-cue overrides. Files that switch frame rate mid-stream are vanishingly rare, but they would need splitting by hand.",
    ],
    faq: [
      ["Why does the timing drift towards the end of the file?",
       "Almost always the frame rate. If the file uses <code>hh:mm:ss:ff</code> timestamps and declares no <code>ttp:frameRate</code>, the converter assumes 30 fps. A file authored at 25 fps then accumulates error in proportion to the timecode — small at the start, obvious by the end. Open the file, read the rate from the root element, and if it is not 30 you will want to re-time the result with the <a href=\"/tools/resync-subtitles\">resync tool</a>."],
      ["Can I convert the other way, from SRT to TTML?",
       "Not here. SRT to TTML is a rarer direction, and the parts TTML is usually chosen for — regions, positioning, named styles — have to be authored deliberately. Producing a bare TTML wrapper with no styling would not save you the work."],
      ["The output is empty even though the file opens in a player",
       "The parser looks for <code>&lt;p&gt;</code> elements carrying a <code>begin</code> attribute. Files that put the timing on <code>&lt;span&gt;</code> children, or that store cues in a non-standard element, have nothing to read. Check the first few lines of the body section."],
      ["Does this upload my caption file anywhere?",
       "No. The file is parsed in JavaScript on your device and never leaves it. You can load the page, disconnect from the network, and the converter still works."],
      ["Why did my italics disappear?",
       "SubRip carries only <code>&lt;i&gt;</code>, <code>&lt;b&gt;</code> and <code>&lt;u&gt;</code>, and TTML expresses italics as a <code>tts:fontStyle</code> attribute on a <code>&lt;span&gt;</code> or through a named style in a <code>&lt;style&gt;</code> block. Inline spans are unwrapped rather than translated, so the words survive and the emphasis does not."],
    ],
    example: {
      inLabel: "Input — .ttml",
      outLabel: "Output — .srt",
      before: `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" ttp:frameRate="25">
  <body><div>
    <p begin="00:00:01.000" end="00:00:04.000">Hello there.</p>
    <p begin="00:00:04.200" dur="2.8s"><span tts:fontStyle="italic">Music playing</span><br/>Sign on wall: EXIT</p>
  </div></body>
</tt>`,
      after: "1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:04,200 --> 00:00:07,000\nMusic playing\nSign on wall: EXIT",
      cap: "The second cue had no end attribute — its dur of 2.8s was added to the begin time. The span was unwrapped and the br became a real line break.",
    },
    troubleshoot: [
      ["No cues found at all",
       "The file needs <code>&lt;p&gt;</code> elements that carry a <code>begin</code> attribute. A TTML file whose cues were emptied out, or a file that is really a plain XML config with a .ttml extension, will produce nothing. Open it in a text editor and look for the word <code>begin</code>."],
      ["Every cue is a few seconds off, and the error grows",
       "A frame-rate mismatch. Times written as <code>hh:mm:ss:ff</code> were divided by the wrong rate. Note the <code>ttp:frameRate</code> value in the file header and re-time the output — the ratio presets on the <a href=\"/tools/resync-subtitles\">resync tool</a> cover the common 23.976 / 24 / 25 / 30 combinations."],
      ["The text contains stray ampersands or question marks",
       "The source used an entity the decoder does not know, or the file is not UTF-8. Re-save it as UTF-8 from the editor that produced it. Unrecognised named entities are left as written rather than guessed at."],
      ["Two languages came out in one cue",
       "That is how the file was authored — one <code>&lt;p&gt;</code> containing both languages, usually separated by a <code>&lt;br/&gt;</code>. Split them into separate files if you need one language per track; the converter preserves the text exactly as written."],
      ["The player shows the subtitles but they look plain",
       "Expected. SubRip has no font, colour or positioning fields, so all of that is discarded on the way through. Keep the original TTML as the master if appearance matters, and treat the SRT as a delivery or review copy."],
    ],
    related: ["srt-to-vtt", "ass-to-srt", "clean-subtitles"],
  },
  {
    slug: "text-to-srt",
    published: "2026-09-21",
    h1: "Plain Text to SRT Converter",
    tagline: "Turn a transcript — one line per caption — into a valid .srt file with evenly spaced timing you can retime later.",
    metaDesc:
      "Free plain text to SRT converter that runs in your browser. Paste a transcript, choose the cue duration, start offset and line length, and get a valid SubRip file with evenly spaced cues. No upload, no signup.",
    mode: "text-to-srt",
    intro:
      "Sometimes there is no subtitle file to convert — only a transcript. A meeting recording, a YouTube transcript panel, a translated script, a set of narration lines. This tool turns that text into a structurally valid <code>.srt</code> so it can be loaded into an editor, handed to a client or played back immediately. The timing it produces is evenly spaced, which means it is a scaffold to align rather than a finished sync.",
    steps: [
      "Paste the transcript into the box — one caption per line. Blank lines are ignored, so pasted documents do not produce empty cues.",
      "Set how many seconds each cue should last, an optional start offset, and a maximum line length if you want long lines wrapped automatically.",
      "Copy the result or download it as a <code>.srt</code>, then align it to the audio in your editor.",
    ],
    deep: {
      h2: "Evenly spaced timing is a scaffold, not a sync",
      body: [
        "<strong>Be clear about what this does.</strong> The tool cannot know when each line is spoken, because a plain transcript contains no timing information. So it assigns every cue the same duration, back to back. If your cue duration is 2.5 seconds and you have 200 lines, the file runs to roughly eight minutes and twenty seconds — regardless of how long the recording actually is.",
        "<strong>What that is genuinely useful for.</strong> A scaffold gets you past the part of the job that is pure typing. Import the generated file into Subtitle Edit, Aegisub, Premiere or DaVinci Resolve and you have numbered cues with real timestamps to drag against the waveform. Retiming a cue that already exists is far faster than authoring one from an empty track, and it guarantees the numbering and structure are valid from the start.",
        "<strong>Fixing the timing afterwards.</strong> If the whole file is uniformly too early or too late, the <a href=\"/tools/shift-subtitles\">shift tool</a> adds or subtracts a fixed offset in one step. If the text was transcribed at the wrong speed — a common outcome when a transcript is generated from a clip played back at the wrong rate — the <a href=\"/tools/resync-subtitles\">resync tool</a> scales every timestamp by a ratio instead.",
        "<strong>Where the defaults come from.</strong> 2.5 seconds per cue is roughly 150 words per minute, which sits comfortably inside the reading speeds broadcasters work to. A maximum line length of 42 characters is the long-standing convention for subtitling and captions, chosen because it keeps a line inside the safe area of a 16:9 frame at typical font sizes. Wrapping is done on word boundaries, never mid-word.",
        "<strong>If you already have a subtitle file, use a different tool.</strong> Text that already contains timestamps is not plain text, and running it through here would turn every timestamp line into its own cue. Use <a href=\"/tools/vtt-to-srt\">VTT to SRT</a> or <a href=\"/tools/sbv-to-srt\">SBV to SRT</a> instead.",
      ],
    },
    notes: [
      "One line becomes one cue. Blank lines and lines that are only whitespace are skipped entirely.",
      "Cue duration applies to every cue equally. There is no per-line override — if you need variable durations, generate the file and adjust the cues you care about in an editor.",
      "Maximum line length defaults to 42 characters, the long-standing subtitling convention — longer lines are split on word boundaries into as many lines as needed, and each piece becomes its own cue. Set it to <code>0</code> to disable wrapping and keep one source line per cue.",
      "The start offset shifts the whole file later, which is useful when a recording opens with silence or a title card. It does not add an initial gap of its own.",
      "No transcription happens here. This tool formats text you already have; it does not listen to audio.",
    ],
    faq: [
      ["Will the timing line up with my audio?",
       "No, and no tool of this kind could. A plain transcript carries no timing information, so every cue gets the same duration. The output is a starting point to align in an editor, not a finished subtitle track."],
      ["Where do I get a transcript to start from?",
       "YouTube's transcript panel gives you plain lines that paste in directly. Whisper and most speech-to-text services export plain text as well as SRT. Zoom and Teams meeting recordings produce transcripts too. Any of them will work."],
      ["How do I keep a long sentence in one cue?",
       "Leave the maximum line length at 0 so nothing is wrapped, and put the whole sentence on a single line. Blank lines are what separate cues — a line break in the source is a cue boundary, not a soft wrap."],
      ["Does my text get uploaded anywhere?",
       "No. The conversion runs in JavaScript on your device. Confidential transcripts, legal recordings and unreleased scripts stay on your machine."],
      ["Can I go the other way — strip a subtitle file down to plain text?",
       "Yes. The <a href=\"/tools/remove-timestamps\">remove timestamps</a> tool does exactly that, with an option to merge repeated lines."],
    ],
    example: {
      inLabel: "Input — plain text",
      outLabel: "Output — .srt",
      before: "Welcome back to the channel.\nToday we are converting captions.\nLet's start with the timing.",
      after: "1\n00:00:00,000 --> 00:00:02,500\nWelcome back to the channel.\n\n2\n00:00:02,500 --> 00:00:05,000\nToday we are converting captions.\n\n3\n00:00:05,000 --> 00:00:07,500\nLet's start with the timing.",
      cap: "Three lines became three cues at the default 2.5 seconds each. The timestamps are placeholders — the next step is aligning them to the audio.",
    },
    troubleshoot: [
      ["Every cue is exactly the same length",
       "That is the design. A transcript has no timing data, so the duration you set is applied to every cue. Retime them in your editor, or use the shift and resync tools if the error is uniform."],
      ["Lines were split in the middle of a sentence",
       "The maximum line length is doing it. Wrapping only happens when a line exceeds that value, so raise it or set it to 0 to keep each source line as a single cue."],
      ["The first cue starts at 00:00:00 when I wanted a delay",
       "Set the start offset to the number of seconds of silence at the top of the recording. That value is added to every cue, so the gap stays consistent."],
      ["Some lines are missing from the output",
       "Blank lines are treated as separators and skipped, and so is any line that is only spaces. If a line you expected is gone, it was empty in the source."],
      ["The output looks like a normal subtitle file but nothing lines up",
       "Expected for the reason above. This tool produces valid structure with placeholder timing. Use the <a href=\"/tools/shift-subtitles\">shift</a> tool for a constant offset, or <a href=\"/tools/resync-subtitles\">resync</a> if the whole track is compressed or stretched."],
    ],
    related: ["remove-timestamps", "srt-to-vtt", "shift-subtitles"],
  },
];

const bySlug = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

/* ============================================================
   1b. 指南页（参考内容，不是工具）—— 支撑收录与 AdSense 内容深度
   ============================================================ */
const GUIDES = [
  {
    slug: "subtitle-formats",
    h1: "Subtitle File Formats Explained",
    title: "Subtitle File Formats Explained: SRT, VTT, ASS, SBV, TTML",
    desc: "A practical reference to subtitle file formats — what SubRip, WebVTT, ASS/SSA, SBV and TTML each support, how to identify the file you have, and which one to deliver.",
    lead: "Most \u201cmy subtitles won't load\u201d problems are format problems. Here is what each container actually is, how to identify the file you have, and which one to deliver.",
    body: `
<h2>The five formats you will actually meet</h2>
<p>Subtitle files are plain text. The differences are in how timestamps are written and how much styling the format can carry. That is the whole story, and it explains almost every compatibility problem you will run into.</p>
<table>
<thead><tr><th>Format</th><th>Extension</th><th>Timestamp</th><th>Styling</th><th>Positioning</th><th>Typical use</th></tr></thead>
<tbody>
<tr><td>SubRip</td><td><code>.srt</code></td><td><code>00:00:01,000</code></td><td>Inline <code>&lt;i&gt;&lt;b&gt;&lt;u&gt;</code></td><td>No</td><td>Universal delivery, desktop editors</td></tr>
<tr><td>WebVTT</td><td><code>.vtt</code></td><td><code>00:00:01.000</code></td><td>Inline plus <code>STYLE</code> blocks</td><td>Yes</td><td>HTML5 video, streaming, broadcast</td></tr>
<tr><td>ASS / SSA</td><td><code>.ass</code> <code>.ssa</code></td><td><code>0:00:01.00</code></td><td>Full script, karaoke, fonts</td><td>Yes</td><td>Fansubbing, heavily styled releases</td></tr>
<tr><td>SBV</td><td><code>.sbv</code></td><td><code>00:00:01.000</code></td><td>None</td><td>No</td><td>Legacy YouTube caption export</td></tr>
<tr><td>TTML / DFXP</td><td><code>.ttml</code> <code>.xml</code></td><td><code>00:00:01.000</code></td><td>XML styling</td><td>Yes</td><td>Broadcast and streaming delivery specs</td></tr>
</tbody>
</table>

<h3>SubRip (.srt)</h3>
<p>The de facto interchange format. Each cue is a sequence number, a timestamp line using a comma as the decimal separator, the text, then a blank line. Nothing else. That minimalism is exactly why it works everywhere — and why it cannot express position or styling beyond inline italics, bold and underline.</p>

<h3>WebVTT (.vtt)</h3>
<p>WebVTT is a W3C specification designed for the web. It looks like SubRip with a <code>WEBVTT</code> header and a period instead of a comma, but it adds real capability: <code>NOTE</code> comments, <code>STYLE</code> blocks that behave like scoped CSS, regions, voice spans for identifying speakers, and per-cue settings such as <code>line:</code> and <code>align:</code>.</p>
<p>It is the only format an HTML5 <code>&lt;track&gt;</code> element accepts. If you are publishing video on a web page, you need WebVTT — see <a href="/guides/add-subtitles-to-html5-video">adding subtitles to HTML5 video</a>.</p>

<h3>ASS and SSA (.ass, .ssa)</h3>
<p>Advanced SubStation Alpha is a rendering format rather than a caption container. It carries a full stylesheet, font choices, karaoke timing and per-character effects. It is the standard in fansubbing and in any workflow where captions are part of the visual design. Most players and editors do not support it, so outside that world it is rarely a delivery format.</p>

<h3>SBV (.sbv)</h3>
<p>A YouTube-era export format that resembles WebVTT but has no header, no styling and no positioning. You will mostly meet it when downloading older captions from the platform. Convert it to SubRip or WebVTT for anything else.</p>

<h3>TTML and DFXP (.ttml, .xml)</h3>
<p>Timed Text Markup Language is an XML-based specification used in broadcast and by streaming services delivering to specific device profiles. It is verbose and rarely hand-edited, but it is what professional delivery specifications usually ask for.</p>

<h2>How to identify a subtitle file</h2>
<p>Open it in a plain text editor and read the first few lines.</p>
<ul>
<li>Starts with <code>WEBVTT</code> \u2192 WebVTT.</li>
<li>Starts with <code>[Script Info]</code> \u2192 ASS or SSA.</li>
<li>Starts with <code>&lt;?xml</code> or <code>&lt;tt</code> \u2192 TTML.</li>
<li>Starts with a number, then a line containing <code>--&gt;</code> with a comma \u2192 SubRip.</li>
<li>Contains <code>--&gt;</code> with a period but no <code>WEBVTT</code> header \u2192 SBV, or a WebVTT file missing its header.</li>
</ul>
<p>Never trust the file extension alone. Files get renamed constantly, and a <code>.vtt</code> that begins with a cue number and a comma is SubRip content carrying the wrong name.</p>

<h2>Which format should you deliver?</h2>
<p><strong>Web page or browser player:</strong> WebVTT, because it is the only format the browser reads. Use the <a href="/tools/srt-to-vtt">SRT to VTT converter</a>.</p>
<p><strong>Desktop editor, mobile player or a platform upload box:</strong> SubRip. It is the most widely accepted and the least likely to be rejected. Start from the <a href="/tools/vtt-to-srt">VTT to SRT converter</a> if you have WebVTT.</p>
<p><strong>Broadcast or streaming specification:</strong> follow the specification. It will name the format, and it will also mandate things a converter cannot guess — maximum characters per line, minimum and maximum cue duration, reading speed limits.</p>
<p><strong>Captions as visual design:</strong> keep ASS as the master and generate a plain delivery copy, accepting that positioning and styling will be lost.</p>

<h2>Reading speed is a constraint no format enforces</h2>
<p>Every format above will happily store a cue containing three dense lines displayed for half a second, and none of them will warn you. Broadcast and streaming guidelines typically land in the range of about 15 to 20 characters per second for adult audiences, and lower for children or for content that will be read in a second language. If a cue feels too fast, it is too fast — split it or shorten the text. No tool can fix that for you, because it is an editorial decision.</p>`,
  },
  {
    slug: "add-subtitles-to-html5-video",
    h1: "How to Add Subtitles to HTML5 Video",
    title: "How to Add Subtitles to HTML5 Video (track, WebVTT, CORS)",
    desc: "Add captions to an HTML5 video with the track element: the attributes that matter, the four reasons captions silently fail, cue styling, and multiple languages.",
    lead: "The native track element handles captions without any JavaScript library. Here is the working setup, and the four reasons it silently does nothing.",
    body: `
<h2>The short version</h2>
<p>Use a <code>&lt;track&gt;</code> element pointing at a WebVTT file. If your file is <code>.srt</code>, convert it first — browsers do not read SubRip at all. The three things that break most often are the file format, the server's content type, and cross-origin access.</p>

<h2>A minimal working example</h2>
<pre>&lt;video controls width="640"&gt;
  &lt;source src="video.mp4" type="video/mp4"&gt;
  &lt;track src="captions.vtt" kind="subtitles" srclang="en" label="English" default&gt;
&lt;/video&gt;</pre>
<p>Save the captions as <code>captions.vtt</code> beside the video. That is a complete, working setup — no library, no configuration.</p>

<h2>The four attributes that matter</h2>
<ul>
<li><code>src</code> — path to the WebVTT file.</li>
<li><code>kind</code> — use <code>subtitles</code> when you are translating dialogue, <code>captions</code> when you are also conveying sound effects and speaker identity. The distinction is about accessibility, not about file format.</li>
<li><code>srclang</code> — a BCP 47 language tag such as <code>en</code>, <code>zh-Hans</code> or <code>pt-BR</code>. Required for the track to be offered as a subtitle option.</li>
<li><code>label</code> — the text shown in the player's caption menu. Omit it and the menu entry can appear blank.</li>
</ul>
<p>Add <code>default</code> to the track you want enabled automatically. Supply several tracks without marking any <code>default</code> and captions start switched off, leaving the viewer to find the menu.</p>

<h2>Why your captions silently do nothing</h2>
<p>Browsers fail quietly here. A broken track usually produces no console error and no visible message — the captions simply never appear.</p>
<h3>1. The file is SubRip</h3>
<p>An <code>.srt</code> file is ignored even when you point <code>src</code> straight at it. Convert it with the <a href="/tools/srt-to-vtt">SRT to VTT converter</a>. If you can see a comma inside the timestamp, that is your problem.</p>
<h3>2. The server sends the wrong content type</h3>
<p>WebVTT files must be served as <code>text/vtt</code>. Plenty of servers and default static-host configurations serve an unfamiliar extension as <code>application/octet-stream</code> or <code>text/plain</code>, and browsers then refuse the track. Check the response headers in your browser's network panel. On a static host, add a rule mapping <code>.vtt</code> to <code>text/vtt</code>.</p>
<h3>3. The file is on a different origin</h3>
<p>Track files follow cross-origin rules. If the video and the captions live on different domains, the caption request needs CORS headers <em>and</em> the <code>&lt;track&gt;</code> element needs <code>crossorigin="anonymous"</code>. Without both, the track is blocked.</p>
<h3>4. The WebVTT file is malformed</h3>
<p>WebVTT requires the <code>WEBVTT</code> header, a blank line before the first cue, and a blank line between cues. A file missing any of those parses as empty. Re-convert from the original source, or run it through <a href="/tools/clean-subtitles">Clean subtitles</a>.</p>

<h2>Styling the captions</h2>
<p>WebVTT cues can be styled from your own CSS using the <code>::cue</code> pseudo-element — a genuine advantage over SubRip.</p>
<pre>video::cue {
  background: rgba(0,0,0,.75);
  color: #fff;
  font-size: 1.1rem;
}
video::cue(.speaker) { color: #ffd479; }</pre>
<p>To use a class, write it into the cue as <code>&lt;c.speaker&gt;</code> in the WebVTT text. Class-based cue styling is supported unevenly across browsers, so treat it as an enhancement rather than a requirement.</p>

<h2>Serving captions in more than one language</h2>
<p>Add one <code>&lt;track&gt;</code> per language. The player builds its caption menu from <code>label</code> and <code>srclang</code>.</p>
<pre>&lt;track src="captions.en.vtt" kind="subtitles" srclang="en" label="English" default&gt;
&lt;track src="captions.es.vtt" kind="subtitles" srclang="es" label="Espa\u00f1ol"&gt;
&lt;track src="captions.de.vtt" kind="subtitles" srclang="de" label="Deutsch"&gt;</pre>

<h2>Do you need a player library?</h2>
<p>Not for basic captions. Native <code>&lt;track&gt;</code> support in modern browsers handles loading, the caption menu, timing and styling on its own. Reach for a JavaScript player library when you need adaptive bitrate streaming, DRM, or caption rendering that must look identical on every platform — not simply to display subtitles.</p>`,
  },
  {
    slug: "fix-subtitles-out-of-sync",
    h1: "How to Fix Subtitles That Are Out of Sync",
    title: "How to Fix Subtitles That Are Out of Sync (Offset vs Drift)",
    desc: "Diagnose why subtitles are out of sync and fix them: constant offset, progressive drift from a frame-rate mismatch, playback speed changes, or a section that slipped mid-file.",
    lead: "Almost every sync problem is one of four patterns, and each has a different fix. Ten seconds of diagnosis saves an hour of nudging timestamps that will not help.",
    body: `
<h2>First, find out which problem you have</h2>
<p>Pick a line near the <strong>start</strong> of the video and note how far off it is. Then pick one near the <strong>end</strong> and do the same. Those two numbers tell you everything.</p>
<table>
<thead><tr><th>Symptom</th><th>Diagnosis</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Both cues off by the same amount</td><td>Constant offset</td><td><a href="/tools/shift-subtitles">Shift</a> the whole track once</td></tr>
<tr><td>Error grows through the file</td><td>Frame-rate drift</td><td><a href="/tools/resync-subtitles">Resample</a> by a ratio</td></tr>
<tr><td>Everything off after a certain point</td><td>Section slip</td><td>Split, fix the tail, rejoin</td></tr>
<tr><td>Picture and sound disagree too</td><td>Not a subtitle problem</td><td>Fix the video first</td></tr>
</tbody>
</table>

<h2>Pattern 1: constant offset</h2>
<p>The most common case. Every cue is wrong by the same amount — usually because the subtitle file was made against a different cut of the video, or the source has an intro the captions do not account for.</p>
<p>To measure it, pause on a line you can identify, note the real time, and subtract the cue's timestamp. A line spoken at 00:01:30 whose cue reads 00:01:28 needs <code>+2</code>. Apply it once with the <a href="/tools/shift-subtitles">shift tool</a> and the whole track lines up.</p>

<h2>Pattern 2: progressive drift</h2>
<p>The first cue is nearly right, the last is badly wrong, and the error grows steadily. No single offset can fix this — shifting until the middle lines up makes both ends worse.</p>
<p>Drift means the subtitle file's frame rate differs from the video's. The classic pair is <strong>23.976 fps against 25 fps</strong>, the difference between NTSC-derived and PAL-derived masters. Over a two-hour film that is roughly four seconds of error by the end.</p>
<p>The fix is to <em>scale</em> every timestamp, not move it. The <a href="/tools/resync-subtitles">resync tool</a> has the common conversions as presets:</p>
<ul>
<li>23.976 &rarr; 25 fps: multiply by 1.04271</li>
<li>25 &rarr; 23.976 fps: multiply by 0.95904</li>
<li>24 &rarr; 25 fps: multiply by 1.04167</li>
<li>Video plays at 1.1&times; speed: multiply by 0.90909</li>
</ul>

<h3>Why 23.976 is not 24</h3>
<p>Historical accident. NTSC colour was fitted to existing black-and-white broadcasts by slowing the frame rate by 0.1%, giving 23.976 rather than 24. That 0.1% is invisible over a few seconds and ruinous over two hours — which is exactly the signature of drift.</p>

<h2>Pattern 3: a section slipped</h2>
<p>Sync is fine for the first half and wrong for the second. Usually a scene was cut or an intro removed after the captions were made.</p>
<p>A single ratio will not fix this either, because the error is a step, not a slope. Split the file at the break, fix the tail on its own, then rejoin the parts with the <a href="/tools/merge-subtitles">merge tool</a>.</p>

<h2>Pattern 4: the video itself is wrong</h2>
<p>If audio and picture disagree with each other, subtitles are not the problem. Correct the audio delay first, then resync the captions against the corrected video — otherwise you tune them to a fault that will be fixed later.</p>

<h2>Working out the correction without guessing</h2>
<p>Do not nudge and re-check. Measure once:</p>
<ol>
<li>Find a cue near the start and one near the end.</li>
<li>Note the real spoken time for each, from the video.</li>
<li>Subtract each cue's timestamp from its real time.</li>
<li>If the two differences match, it is an offset. If they differ and grow, it is drift.</li>
</ol>
<p>For drift, divide the real time by the cue time at the <em>end</em> of the file. That quotient is your ratio — and it is more accurate than picking a named frame-rate preset, because it accounts for whatever actually happened to your file.</p>

<h2>After the fix</h2>
<p>Check three places: the first cue, a cue at the midpoint, and the last one. If all three sit right, the track is correct. Then run the file through <a href="/tools/clean-subtitles">Clean subtitles</a> if it carries markup you do not want, and keep the original — resampling is reversible only if you still have the source.</p>`,
  },
  {
    slug: "subtitle-reading-speed",
    h1: "How Long Should Subtitles Stay on Screen",
    title: "Subtitle Reading Speed and On-Screen Time: Practical Limits",
    desc: "How long a subtitle should stay up, what characters-per-second means, the limits used by major platforms, and how to audit your own file in a spreadsheet.",
    lead: "A subtitle can be perfectly timed and still unreadable. Reading speed, minimum duration and line length are what separate captions you can follow from captions you fight.",
    body: `
<h2>Characters per second, and why it matters</h2>
<p>Reading speed for subtitles is measured in <strong>CPS</strong> — characters per second, counted over the cue's on-screen duration. A 60-character line shown for two seconds is 30 CPS, which is too fast for comfortable reading in most languages.</p>
<p>The widely used ceiling is around <strong>20 CPS</strong> for adult audiences, with children's content targeting closer to 13–15. Some broadcast specs allow bursts up to 25 CPS for short stretches, but sustained speed above 20 is the single most common complaint in caption quality reports.</p>

<h2>The other three limits</h2>
<ul>
<li><strong>Minimum duration.</strong> A cue should stay up at least about 1 second (some specs say 5/6 second). Anything shorter flickers — viewers register movement but cannot read it.</li>
<li><strong>Maximum duration.</strong> Most guidance caps a cue at roughly 6–7 seconds, not because of reading speed but because a static line starts to look like a bug or a stray graphic.</li>
<li><strong>Line length.</strong> Around 32–42 characters per line, maximum two lines. Longer lines force the eye to travel further and make the cue feel faster than its CPS suggests.</li>
</ul>

<h2>What the major platforms ask for</h2>
<table>
<thead><tr><th>Context</th><th>Reading speed</th><th>Minimum</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Netflix-style delivery</td><td>~20 CPS</td><td>~5/6 s</td><td>Two lines max, ~42 characters per line</td></tr>
<tr><td>Broadcast (UK-style)</td><td>~17–20 CPS</td><td>~1 s</td><td>Strict speaker-label and punctuation rules</td></tr>
<tr><td>Children's content</td><td>~13–15 CPS</td><td>~1 s</td><td>Slower by design</td></tr>
<tr><td>User-generated video</td><td>No enforced limit</td><td>—</td><td>Auto-captions frequently exceed 20 CPS</td></tr>
</tbody>
</table>
<p>Treat these as targets rather than laws. The specs that matter are the ones in your delivery contract; these figures are what to aim for when nobody has told you otherwise.</p>

<h2>How to audit your own file</h2>
<p>Reading the numbers cue by cue is tedious, so export the file and let a spreadsheet do the sorting. The <a href="/tools/srt-to-csv">subtitles to CSV</a> tool writes one row per cue with its duration in milliseconds, which makes the audit mechanical:</p>
<ol>
<li>Convert the file to CSV.</li>
<li>Add a column dividing the character count of the text by <code>duration_ms / 1000</code>.</li>
<li>Sort descending — the top rows are your problem cues.</li>
<li>Sort <code>duration_ms</code> ascending to find cues that flash past.</li>
</ol>
<p>In practice most files have a handful of offenders rather than a systemic problem, and fixing the worst ten cues noticeably improves how the whole track feels.</p>

<h2>Fixing a cue that is too fast</h2>
<p>You have two levers: shorten the text or lengthen the time. Which is correct depends on the material.</p>
<p>If the speaker was genuinely fast and the pause after the line is long, extend the cue's end time — but respect the next cue's start, because overlapping cues are worse than fast ones. If the line is simply verbose, edit it down. Professional subtitling is <em>condensing</em>, not transcribing; dropping filler and collapsing clauses is normal and expected.</p>
<p>Only resync the whole track when the problem is systematic. If most cues are fast, the file was probably timed against a different reading speed standard, and stretching every cue proportionally is quicker than editing each one.</p>

<h2>Reading speed is not the same as comprehension</h2>
<p>CPS is a proxy. A cue at 18 CPS with two dense clauses can be harder than one at 22 CPS with plain wording, and names, numbers and unfamiliar terms all cost more time than their character count suggests. Use the numbers to find candidates, then read the worst ones yourself.</p>
<p>If you are captioning for a language other than English, the 20 CPS figure is a starting point, not a constant — languages differ substantially in how much information a character carries, and several broadcast specs publish separate limits per language.</p>`,
  },
  {
    slug: "translate-subtitles",
    h1: "How to Translate a Subtitle File",
    title: "How to Translate a Subtitle File (Without Breaking the Timing)",
    desc: "A working method for translating SRT or VTT files: export to a spreadsheet, translate per cue, condense to fit the reading speed, then check timing and encoding before delivery.",
    lead: "Translating subtitles is not translating a document. Every line has to fit inside a time window that was set by someone speaking a different language — so the workflow matters more than the wording.",
    body: `
<h2>Start from the right file</h2>
<p>Translate the <strong>original-language subtitle file</strong>, never a re-export from a video editor, and never an auto-generated transcript that has not been corrected. Whatever is wrong upstream — misheard words, missing punctuation, cues split mid-sentence — you will faithfully propagate into every language.</p>
<p>Before you begin, clean the source. Strip sound-effect cues, speaker labels and markup you do not want to carry across, using <a href="/tools/clean-subtitles">Clean subtitles</a>. Confirm the timings are right: if the source is out of sync, translate it first and fix sync afterwards on every language at once, rather than fixing each translation separately.</p>

<h2>Three ways to do the work</h2>
<table>
<thead><tr><th>Method</th><th>Best when</th><th>Watch out for</th></tr></thead>
<tbody>
<tr><td>Subtitle editor (dedicated software)</td><td>You are translating and re-timing in one pass</td><td>Requires the translator to learn the tool</td></tr>
<tr><td>Spreadsheet via CSV</td><td>A translator with no subtitle experience is doing the wording</td><td>Someone must re-import and re-check timing</td></tr>
<tr><td>Machine translation, then human post-edit</td><td>Large volume, tight deadline</td><td>Raw output ignores line length and reading speed entirely</td></tr>
</tbody>
</table>
<p>For most teams the spreadsheet route is the pragmatic one, because it separates the two jobs: a translator handles wording, a captioner handles timing.</p>

<h2>The spreadsheet route, step by step</h2>
<ol>
<li>Open the source file in the <a href="/tools/srt-to-csv">subtitles to CSV converter</a> and download the CSV. You get one row per cue, with start time, end time, duration in milliseconds and text.</li>
<li>Send the CSV to the translator. Ask them to fill a new column and to <strong>keep the row count identical</strong> — one cue in, one cue out.</li>
<li>Paste the translated column back over the text column, preserving row order. Sorting or filtering during translation is the single most common way this workflow breaks.</li>
<li>Rebuild the subtitle file, then run it through the <a href="/tools/subtitle-timing-check">timing checker</a> before you look at anything else.</li>
</ol>
<p>The duration column in that CSV is more useful than it looks. Sort by it and the shortest cues are the ones most likely to be unreadable in the target language, because a translation is rarely shorter than the original.</p>

<h2>Condense — do not translate literally</h2>
<p>English at a comfortable pace is roughly 12\u201320 characters per second. Many target languages need 25\u201340% more characters to say the same thing. If you translate each cue literally, a large share of them will exceed what a viewer can read in the time available.</p>
<p>This is why subtitling is <em>condensing</em>. Drop filler, collapse two clauses into one, prefer a shorter synonym, and let a repeated name become a pronoun once context is established. A translation that reads naturally at speed is better than one that is complete but unreadable.</p>
<p>Keep the two conventions that carry meaning: a maximum of two lines per cue, and roughly 40\u201342 characters per line. Break a line at a natural phrase boundary, never in the middle of a name or a number. See <a href="/guides/subtitle-reading-speed">subtitle reading speed</a> for the numbers behind both.</p>

<h2>What not to translate</h2>
<ul>
<li><strong>On-screen text</strong> is translated only if it is dialogue; a sign, a headline or a UI label is usually rendered as a caption describing it rather than translated word for word.</li>
<li><strong>Names</strong> stay in their original form unless an established translated form exists.</li>
<li><strong>Song lyrics</strong> are conventionally translated rather than transliterated, and marked with a music note at the start and end of the sung section.</li>
<li><strong>Sound effects</strong> \u2014 <code>[door slams]</code> \u2014 are translated, because they are part of the accessibility contract, not the dialogue.</li>
</ul>

<h2>Check before you deliver</h2>
<p>Run three checks on the finished file. First, the <a href="/tools/subtitle-timing-check">timing checker</a> at the reading-speed limit your delivery target uses. Second, encoding: save as <strong>UTF-8</strong>, and if an existing file shows characters like <code>Caf\u00c3\u00a9</code>, repair it with the <a href="/tools/fix-subtitle-encoding">encoding repair tool</a> rather than retyping anything. Third, format \u2014 convert to what the destination actually accepts, usually <a href="/tools/srt-to-vtt">WebVTT</a> for the web and SubRip everywhere else.</p>
<p>Then watch two minutes of the video with the translated track on. Automated checks catch numbers; they do not catch a translation that is technically fine and reads badly.</p>

<h2>Delivering several languages</h2>
<p>One file per language, named consistently \u2014 <code>film.en.srt</code>, <code>film.de.srt</code>, <code>film.ja.srt</code> \u2014 with language codes matching what the player or platform expects. Do not merge translations into a single file: players handle multiple languages as multiple tracks, and a merged file forces one language on every viewer.</p>`,
  },
  {
    slug: "subtitles-not-showing",
    h1: "Why Your Subtitles Aren't Showing Up",
    title: "Subtitles Not Showing Up: A Diagnostic Checklist",
    desc: "Subtitles not appearing? Work through the causes in order — wrong format, filename mismatch, track disabled, malformed file, encoding damage, or timing outside the video.",
    lead: "Players fail silently with subtitles: no error, no warning, just nothing on screen. This walks the causes in the order most likely to be yours, so you stop guessing.",
    body: `
<h2>Work through the causes in this order</h2>
<p>Resist the urge to re-download the file. Nearly every case is one of seven causes, and they are cheap to rule out one at a time.</p>
<table>
<thead><tr><th>Symptom</th><th>Most likely cause</th><th>Fix</th></tr></thead>
<tbody>
<tr><td>Nothing, ever, in any player</td><td>Wrong format or empty file</td><td>Convert; check the file has cues</td></tr>
<tr><td>Works in VLC, not on the web</td><td>SubRip instead of WebVTT</td><td><a href="/tools/srt-to-vtt">Convert to VTT</a></td></tr>
<tr><td>Works on desktop, not on TV</td><td>Filename or encoding</td><td>Match the video filename; save UTF-8</td></tr>
<tr><td>Appears, then stops halfway</td><td>Malformed section or section slip</td><td>Clean, then check sync</td></tr>
<tr><td>Garbled characters but visible</td><td>Encoding damage</td><td><a href="/tools/fix-subtitle-encoding">Repair encoding</a></td></tr>
<tr><td>Visible only at the very start</td><td>Timing shorter than the video</td><td>Re-time the track</td></tr>
<tr><td>Only some viewers see it</td><td>Track not enabled by default</td><td>Mark it default, or tell them to enable it</td></tr>
</tbody>
</table>

<h2>1. The format does not match the destination</h2>
<p>This is the most common cause by a wide margin. SubRip (<code>.srt</code>) is the universal <em>file</em> format, but an HTML5 <code>&lt;track&gt;</code> element accepts <strong>only WebVTT</strong>. Point a browser at an SRT and it will ignore it completely, with no console error. If your captions are on a web page, <a href="/tools/srt-to-vtt">convert to VTT</a> first.</p>
<p>Upload boxes are stricter still. Some platforms accept only one format regardless of what their documentation implies. See <a href="/guides/subtitle-formats">subtitle file formats</a> for which one to send where.</p>

<h2>2. The filename does not match</h2>
<p>Desktop players and TVs load external subtitles by convention: the file sits beside the video and shares its name. <code>movie.mp4</code> looks for <code>movie.srt</code>. A file called <code>movie.eng.srt</code> or <code>subtitles.srt</code> will often be ignored, and the behaviour differs between players \u2014 which is exactly why this cause is so confusing.</p>
<p>Rename to match the video exactly, or use the player's explicit "load subtitle file" menu item, which bypasses the convention entirely.</p>

<h2>3. The track exists but is not enabled</h2>
<p>With multiple language tracks, most players start with captions off unless one is marked default. On the web, that is the <code>default</code> attribute on the <code>&lt;track&gt;</code> element. In a media player, it is the subtitle or audio menu.</p>
<p>Before changing anything, switch captions on manually. If they appear, the file was fine all along.</p>

<h2>4. The file is empty, or the cues are malformed</h2>
<p>Open it in a text editor. A subtitle file must have a timestamp line containing <code>--&gt;</code> for every cue, and a blank line between cues. WebVTT additionally needs the <code>WEBVTT</code> header and a blank line after it. A file missing the header parses as empty \u2014 valid-looking, zero cues.</p>
<p>Run the file through <a href="/tools/clean-subtitles">Clean subtitles</a> to normalise spacing, drop empty cues and remove stray markup. If the output is still empty, the structure is broken and you should re-export from the original source.</p>

<h2>5. The text is damaged, not missing</h2>
<p>If captions appear but show <code>Caf\u00c3\u00a9</code>, <code>\u00e2\u0080\u0099</code> or Cyrillic-looking garbage, the file is fine \u2014 it was read with the wrong character encoding. The bytes are intact, so this is fully recoverable: <a href="/tools/fix-subtitle-encoding">repair the encoding</a>, then save the result as UTF-8.</p>
<p>If you see plain question marks or empty boxes instead, the characters were already lost when the file was written and cannot be recovered by any tool.</p>

<h2>6. The timing is outside the video</h2>
<p>Subtitles that appear for the first twenty seconds and then vanish are usually a timing problem, not a playback problem. It happens when a track was timed against a different cut of the video, or when the subtitle file is shorter than the recording.</p>
<p>Compare the last cue's timestamp with the video duration. If they differ by a constant amount, <a href="/tools/shift-subtitles">shift</a> the track. If the error grows through the file, it is a frame-rate mismatch and you need to <a href="/tools/resync-subtitles">resample</a> instead \u2014 see <a href="/guides/fix-subtitles-out-of-sync">fixing out-of-sync subtitles</a>.</p>

<h2>7. Hardcoded versus soft subtitles</h2>
<p>If captions are visible on every device, cannot be turned off and survive being uploaded anywhere, they are <strong>burned into the picture</strong>. No subtitle file will change them, and none needs to. Confusing the two leads people to chase a file problem that does not exist.</p>
<p>Soft subtitles are a separate track the player renders. If you need to go from soft to hard, that is a video encoding step, not a subtitle editing one.</p>

<h2>A sixty-second checklist</h2>
<ol>
<li>Open the file in a text editor \u2014 does it contain cues with <code>--&gt;</code> timestamps?</li>
<li>Is the text readable, or garbled?</li>
<li>Does the extension match the destination's requirement?</li>
<li>Does the filename match the video, if it is being auto-loaded?</li>
<li>Are captions switched on in the player?</li>
<li>Does the last timestamp roughly match the video length?</li>
</ol>
<p>If all six pass and subtitles still do not appear, the problem is on the platform side \u2014 its upload may still be processing, or its caption settings may require the track to be published explicitly.</p>`,
  },
];
const guideBySlug = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));


/* ============================================================
   2. 客户端核心逻辑（原样写入 js/tools.js）
   ============================================================ */
const TOOLS_JS = String.raw`/* Subtitle Toolkit — client-side core. No network calls. */
(function () {
  "use strict";

  var TIMING = /^(.+?)\s*-->\s*(.+?)\s*$/;

  function parseTime(s) {
    var m = String(s).trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
    if (!m) return null;
    var h = m[1] ? parseInt(m[1], 10) : 0;
    var mi = parseInt(m[2], 10), se = parseInt(m[3], 10);
    var ms = parseInt(m[4].length === 1 ? m[4] + "00" : m[4].length === 2 ? m[4] + "0" : m[4], 10);
    return ((h * 60 + mi) * 60 + se) * 1000 + ms;
  }

  /* 宽松时间解析：接受 "90"（秒）、"45:00"、"1:02:03"、带毫秒也行。用于切分点输入。 */
  function parseLooseTime(s) {
    s = String(s == null ? "" : s).trim();
    if (!s) return 0;
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 1000);
    var m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s);
    if (!m) return null;
    var msStr = m[4] || "0";
    while (msStr.length < 3) msStr += "0";
    return ((parseInt(m[1] || 0, 10) * 60 + parseInt(m[2], 10)) * 60 + parseInt(m[3], 10)) * 1000 + parseInt(msStr, 10);
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }

  function fmtTime(ms, sep) {
    ms = Math.max(0, Math.round(ms));
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var t = ms % 1000;
    return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + sep + pad(t, 3);
  }

  function looksVtt(text) {
    return /^\s*\uFEFF?WEBVTT/.test(String(text));
  }

  /* Split into blocks on blank lines, then keep only blocks containing a timing arrow. */
  function parseCues(text) {
    var norm = String(text).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
    var blocks = norm.split(/\n{2,}/);
    var cues = [];
    for (var b = 0; b < blocks.length; b++) {
      var lines = blocks[b].split("\n");
      var ti = -1, m = null;
      for (var i = 0; i < lines.length; i++) {
        var mm = lines[i].match(TIMING);
        if (mm) { ti = i; m = mm; break; }
      }
      if (ti === -1) continue;
      var st = parseTime(m[1]);
      if (st === null) continue;
      var endRaw = m[2].split(/\s+/)[0];
      var en = parseTime(endRaw);
      if (en === null) en = st;
      var textLines = lines.slice(ti + 1).filter(function (l) { return l.trim() !== ""; });
      cues.push({ start: st, end: en, text: textLines.join("\n") });
    }
    return cues;
  }

  function serialize(cues, vtt) {
    var sep = vtt ? "." : ",";
    var out = vtt ? ["WEBVTT", ""] : [];
    for (var i = 0; i < cues.length; i++) {
      out.push(String(i + 1));
      out.push(fmtTime(cues[i].start, sep) + " --> " + fmtTime(cues[i].end, sep));
      out.push(cues[i].text);
      out.push("");
    }
    return out.join("\n").replace(/\n+$/, "\n");
  }

  function toVtt(text) { var c = parseCues(text); return c.length ? serialize(c, true) : ""; }
  function toSrt(text) { var c = parseCues(text); return c.length ? serialize(c, false) : ""; }

  function toPlainText(text, dedupe) {
    var cues = parseCues(text), out = [];
    for (var i = 0; i < cues.length; i++) {
      var t = cues[i].text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (dedupe && out.length && out[out.length - 1] === t) continue;
      out.push(t);
    }
    return out.join("\n");
  }

  var SOUND = /[\[\(](?:music|applause|laughter|laughs|inaudible|sighs|noise|silence|foreign|speaking [a-z]+|sound|crosstalk|chuckles|clears throat)[^\]\)]*[\]\)]/gi;

  function cleanCues(text, o) {
    var cues = parseCues(text), res = [], seen = {};
    for (var i = 0; i < cues.length; i++) {
      var t = cues[i].text;
      if (o.tags) {
        t = t.replace(/<[^>]*>/g, "");            /* HTML / WebVTT tags */
        t = t.replace(/\{\\[^}]*\}/g, "");        /* ASS override codes */
        t = t.replace(/&(?:amp|lt|gt|quot|#39);/g, " ");
      }
      if (o.sound) {
        t = t.replace(/\u266A[^\u266A]*\u266A/g, " ");
        t = t.replace(SOUND, " ");
      }
      if (o.speaker) {
        t = t.replace(/^\s*[-\u2013\u2014]?\s*(?:[A-Z][A-Z0-9 .'_-]{1,24}):\s*/gm, "");
      }
      t = t.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
      if (o.empty && !t) continue;
      if (o.dupe) { if (seen[t]) continue; seen[t] = 1; }
      res.push({ start: cues[i].start, end: cues[i].end, text: t });
    }
    return res;
  }

  function shiftCues(text, offsetMs) {
    var cues = parseCues(text);
    return cues.map(function (c) {
      return { start: Math.max(0, c.start + offsetMs), end: Math.max(0, c.end + offsetMs), text: c.text };
    });
  }

  /* 渐进失步：帧率/倍速不匹配时，误差随播放递增，单个偏移修不了，只能按比例重采样。 */
  function resyncCues(text, ratio) {
    if (!ratio || ratio <= 0) ratio = 1;
    var cues = parseCues(text);
    return cues.map(function (c) {
      return {
        start: Math.max(0, Math.round(c.start * ratio)),
        end: Math.max(0, Math.round(c.end * ratio)),
        text: c.text
      };
    });
  }

  /* YouTube SBV：每行 "0:00:01.000,0:00:04.000" 后跟文本，空行分块。 */
  function sbvTime(s) {
    var m = /^(-?\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(String(s).trim());
    if (!m) return 0;
    var msStr = m[4];
    while (msStr.length < 3) msStr += "0";
    return (parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) * 1000 + parseInt(msStr, 10);
  }

  /* 合并：第二份文件整体接到第一份结束之后（+ 可选间隔）。用于 CD1+CD2、加配字幕轨。 */
  function mergeCues(a, b, gapMs) {
    var ca = parseCues(a), cb = parseCues(b);
    var base = 0;
    for (var i = 0; i < ca.length; i++) if (ca[i].end > base) base = ca[i].end;
    base += (gapMs || 0);
    var out = ca.slice();
    for (var j = 0; j < cb.length; j++) {
      out.push({ start: cb[j].start + base, end: cb[j].end + base, text: cb[j].text });
    }
    return out;
  }

  /* 导出 CSV：序号,开始,结束,时长(ms),文本 —— 给翻译/审校/表格用。 */
  function toCsv(text) {
    var cues = parseCues(text);
    if (!cues.length) return "";
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var rows = ["index,start,end,duration_ms,text"];
    for (var i = 0; i < cues.length; i++) {
      var c = cues[i];
      rows.push([
        i + 1,
        q(fmtTime(c.start, ",")),
        q(fmtTime(c.end, ",")),
        c.end - c.start,
        q(c.text.replace(/\n/g, " "))
      ].join(","));
    }
    return rows.join("\n");
  }

  /* 切分：按时间点把一条轨分成两半。各自保留原始时间码（不重定时）。 */
  function splitCues(text, atMs) {
    var cues = parseCues(text), a = [], b = [];
    for (var i = 0; i < cues.length; i++) {
      (cues[i].start < atMs ? a : b).push(cues[i]);
    }
    return { a: a, b: b };
  }

  /* ---------- 乱码修复（mojibake） ----------
     成因：UTF-8 字节被当成单字节编码（cp1252 / Latin-1 / cp1251）读了一遍。
     修法：把每个字符还原成它当时那个字节，再按 UTF-8 重新解码。 */
  var CP1252_REV = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };
  /* cp1251 0x80-0xBF 的字符表（用码点写，避免源文件编码问题） */
  var CP1251_HI_CODES = [
    0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021,
    0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F,
    0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
    0x0098, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F,
    0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7,
    0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407,
    0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7,
    0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457
  ];
  var cp1251RevCache = null;
  function cp1251Rev() {
    if (cp1251RevCache) return cp1251RevCache;
    var m = {}, i;
    for (i = 0; i < CP1251_HI_CODES.length; i++) m[CP1251_HI_CODES[i]] = 0x80 + i;
    for (i = 0xC0; i <= 0xDF; i++) m[0x410 + (i - 0xC0)] = i;
    for (i = 0xE0; i <= 0xFF; i++) m[0x430 + (i - 0xE0)] = i;
    cp1251RevCache = m;
    return m;
  }

  /* 严格 UTF-8 解码：遇到非法字节返回 null（宁可不修，也不猜） */
  function utf8Decode(bytes) {
    var out = "", i = 0;
    while (i < bytes.length) {
      var b = bytes[i], need, cp;
      if (b < 0x80) { cp = b; need = 0; }
      else if (b >= 0xC2 && b <= 0xDF) { cp = b & 0x1F; need = 1; }
      else if (b >= 0xE0 && b <= 0xEF) { cp = b & 0x0F; need = 2; }
      else if (b >= 0xF0 && b <= 0xF4) { cp = b & 0x07; need = 3; }
      else return null;
      if (i + need >= bytes.length) return null;
      for (var k = 1; k <= need; k++) {
        var c = bytes[i + k];
        if ((c & 0xC0) !== 0x80) return null;
        cp = (cp << 6) | (c & 0x3F);
      }
      out += String.fromCodePoint ? String.fromCodePoint(cp) : String.fromCharCode(cp);
      i += need + 1;
    }
    return out;
  }

  /* 把一个字符串按指定单字节编码还原成字节流；出现无法表示的字符就放弃 */
  function toBytes(str, src) {
    var rev = src === "cp1251" ? cp1251Rev() : null;
    var out = new Array(str.length);
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i), b;
      if (code in CP1252_REV && src !== "cp1251") b = CP1252_REV[code];
      else if (code <= 0xFF) b = code;
      else if (rev && code in rev) b = rev[code];
      else return null;
      out[i] = b;
    }
    return out;
  }

  /* 结果可信度检查：控制字符（换行/tab 除外）占比过高 => 这不是修复，是二次破坏 */
  function sane(s) {
    var bad = 0, tot = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 10 || c === 13 || c === 9) continue;
      tot++;
      if (c < 0x20 || (c >= 0x7F && c <= 0x9F)) bad++;
    }
    return tot === 0 || bad / tot < 0.02;
  }

  /* 统计疑似 mojibake 的序列数量，用来判断「还有没有乱码」。
     两条规则：
     (1) 拉丁系 —— Ã/Â/â/Ð/Ñ 后面跟一个单字节编码的高位字符（UTF-8 首字节被拆开的痕迹）
     (2) 西里尔系 —— Р/С（UTF-8 的 D0/D1 被当成 cp1251）后面跟 cp1251 高位表里的字符
     第 (2) 条刻意只匹配真实俄语里几乎不会出现的组合，避免把正常俄文误判成乱码。 */
  var MOJI_LAT_RE = /[\u00C3\u00C2\u00E2\u00D0\u00D1][\u0080-\u00BF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g;
  var MOJI_CYR_RE = /[\u0420\u0421][\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u2122\u0459\u203A\u045A\u045C\u045B\u045F\u040E\u045E\u0408\u0490\u0401\u0404\u0407\u0406\u0456\u0491\u0451\u2116\u0454\u0458\u0405\u0455\u0457\u00A0\u00A4\u00A6\u00A7\u00A9\u00AB\u00AC\u00AE\u00B0\u00B1\u00B5\u00B6\u00B7\u00BB]/g;

  function mojiCount(s) {
    var a = String(s).match(MOJI_LAT_RE);
    var b = String(s).match(MOJI_CYR_RE);
    return (a ? a.length : 0) + (b ? b.length : 0);
  }

  function repairOnce(str, src) {
    var bytes = toBytes(str, src);
    if (!bytes) return null;
    var out = utf8Decode(bytes);
    if (out === null || !sane(out)) return null;
    return out;
  }

  /* src: "auto" | "cp1252" | "cp1251"  twice: 双重编码（读错了两遍） */
  function repairEncoding(text, src, twice) {
    var passes = 0, cur = String(text), before = mojiCount(cur);
    var order = src === "cp1251" ? ["cp1251", "cp1252"] : src === "cp1252" ? ["cp1252"] : ["cp1252", "cp1251"];
    var rounds = twice ? 2 : 1;
    for (var r = 0; r < rounds; r++) {
      var got = null, used = null;
      for (var i = 0; i < order.length; i++) {
        var cand = repairOnce(cur, order[i]);
        if (cand !== null && cand !== cur && mojiCount(cand) < mojiCount(cur)) {
          got = cand; used = order[i];
          break;
        }
      }
      if (got === null) break;
      cur = got; passes++;
    }
    return { text: cur, passes: passes, before: before, after: mojiCount(cur), source: src };
  }

  /* ---------- 节奏 / 可读性检查 ---------- */
  function plainOf(t) {
    return String(t).replace(/\{\\[^}]*\}/g, "").replace(/<[^>]*>/g, "");
  }

  function timingReport(text, o) {
    var cues = parseCues(text);
    if (!cues.length) return "";
    var maxCps = o.maxCps > 0 ? o.maxCps : 20;
    var minMs = o.minMs >= 0 ? o.minMs : 833;
    var maxMs = o.maxMs > 0 ? o.maxMs : 7000;
    var maxLine = o.maxLine > 0 ? o.maxLine : 42;
    var maxLines = 2;

    var issues = [], counts = { fast: 0, short: 0, long: 0, wide: 0, lines: 0, overlap: 0 };
    var totalMs = 0, sumCps = 0, nCps = 0, minDur = Infinity, maxDur = 0;

    for (var i = 0; i < cues.length; i++) {
      var c = cues[i], dur = c.end - c.start;
      var plain = plainOf(c.text);
      var rows = plain.split("\n");
      var chars = plain.replace(/\n/g, " ").length;
      var hits = [];

      if (dur > 0) {
        var cps = chars / (dur / 1000);
        sumCps += cps; nCps++;
        if (cps > maxCps) { counts.fast++; hits.push("too fast — " + cps.toFixed(1) + " CPS (max " + maxCps.toFixed(1) + ")"); }
      } else {
        counts.short++; hits.push("zero or negative duration");
      }
      if (dur > 0 && dur < minMs) { counts.short++; hits.push("too short — " + (dur / 1000).toFixed(2) + "s (min " + (minMs / 1000).toFixed(2) + "s)"); }
      if (dur > maxMs) { counts.long++; hits.push("on screen too long — " + (dur / 1000).toFixed(2) + "s (max " + (maxMs / 1000).toFixed(2) + "s)"); }
      var widest = 0;
      for (var k = 0; k < rows.length; k++) if (rows[k].length > widest) widest = rows[k].length;
      if (widest > maxLine) { counts.wide++; hits.push("line too long — " + widest + " chars (max " + maxLine + ")"); }
      if (rows.length > maxLines) { counts.lines++; hits.push(rows.length + " lines (max " + maxLines + ")"); }
      var nxt = cues[i + 1];
      if (nxt && nxt.start < c.end - 1) { counts.overlap++; hits.push("overlaps the next cue by " + ((c.end - nxt.start) / 1000).toFixed(2) + "s"); }

      totalMs += Math.max(0, dur);
      if (dur > 0) { if (dur < minDur) minDur = dur; if (dur > maxDur) maxDur = dur; }
      if (hits.length) issues.push({ n: i + 1, start: c.start, end: c.end, dur: dur, text: plain, hits: hits });
    }

    var secs = function (ms) { return (ms / 1000).toFixed(2) + "s"; };
    var L = [];
    L.push("Subtitle timing report");
    L.push("======================");
    L.push(cues.length + " cues checked · " + issues.length + " flagged (" +
      (cues.length ? Math.round((issues.length / cues.length) * 100) : 0) + "%)");
    L.push("");
    L.push("Average reading speed : " + (nCps ? (sumCps / nCps).toFixed(1) : "0.0") + " CPS");
    L.push("Cue duration          : min " + (minDur === Infinity ? "n/a" : secs(minDur)) +
      " · max " + secs(maxDur) + " · total on-screen " + secs(totalMs));
    L.push("");
    var padR = function (s, n) { s = String(s); while (s.length < n) s += " "; return s; };
    var padL = function (s, n) { s = String(s); while (s.length < n) s = " " + s; return s; };
    L.push(padR("Too fast      (> " + maxCps.toFixed(1) + " CPS)", 34) + padL(counts.fast, 5));
    L.push(padR("Too short     (< " + (minMs / 1000).toFixed(2) + "s)", 34) + padL(counts.short, 5));
    L.push(padR("On too long   (> " + (maxMs / 1000).toFixed(2) + "s)", 34) + padL(counts.long, 5));
    L.push(padR("Line too long (> " + maxLine + " chars)", 34) + padL(counts.wide, 5));
    L.push(padR("More than " + maxLines + " lines", 34) + padL(counts.lines, 5));
    L.push(padR("Overlapping cues", 34) + padL(counts.overlap, 5));
    L.push("");
    if (!issues.length) {
      L.push("Nothing flagged. Every cue is inside the limits above.");
    } else {
      L.push("--- Flagged cues ---");
      L.push("");
      var cap = Math.min(issues.length, 200);
      for (var j = 0; j < cap; j++) {
        var it = issues[j];
        var num = String(it.n); while (num.length < 4) num = "0" + num;
        L.push("#" + num + "  " + fmtTime(it.start, ",") + " -> " + fmtTime(it.end, ",") +
          "  (" + secs(it.dur) + ", " + (it.dur > 0 ? (plainOf(it.text).replace(/\n/g, " ").length / (it.dur / 1000)).toFixed(1) : "0.0") + " CPS)");
        var tr = it.text.split("\n");
        for (var q = 0; q < tr.length; q++) L.push("        " + tr[q]);
        L.push("        ! " + it.hits.join("; "));
        L.push("");
      }
      if (issues.length > cap) L.push("... and " + (issues.length - cap) + " more. Fix the ones above and re-run.");
    }
    return L.join("\n");
  }

  function sbvCues(text) {
    var blocks = String(text).replace(/\r\n?/g, "\n").split(/\n{2,}/);
    var cues = [];
    for (var i = 0; i < blocks.length; i++) {
      var lines = blocks[i].split("\n");
      var m = /^\s*(-?\d+:\d{1,2}:\d{1,2}[.,]\d{1,3})\s*,\s*(-?\d+:\d{1,2}:\d{1,2}[.,]\d{1,3})\s*$/.exec(lines[0] || "");
      if (!m) continue;
      var t = lines.slice(1).join("\n").replace(/\n+$/, "").trim();
      cues.push({ start: sbvTime(m[1]), end: sbvTime(m[2]), text: t });
    }
    return cues;
  }

  /* ---------- SubStation Alpha (.ass / .ssa) ----------
     ASS is not a blank-line cue format: cues live in an [Events] section as
     "Dialogue:" lines whose field order is declared by a preceding "Format:" line.
     The Text field is always last and may itself contain commas. */
  function looksAss(text) {
    var h = String(text).slice(0, 4000);
    return /^\s*\uFEFF?\[Script Info\]/im.test(h) ||
           /^\s*\[Events\]/im.test(h) ||
           /^\s*Dialogue\s*:/im.test(h);
  }

  /* "0:00:01.00" — H:MM:SS.cc, centiseconds (not milliseconds). */
  function assTime(s) {
    var m = /^\s*(\d{1,3}):(\d{1,2}):(\d{1,2})[.:](\d{1,2})\s*$/.exec(String(s));
    if (!m) return null;
    var cs = m[4].length === 1 ? parseInt(m[4], 10) * 10 : parseInt(m[4], 10);
    return ((parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 60 + parseInt(m[3], 10)) * 1000 + cs * 10;
  }

  function assFmt(ms) {
    ms = Math.max(0, Math.round(ms));
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    var cs = Math.floor((ms % 1000) / 10);
    return h + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + pad(cs, 2);
  }

  /* Override blocks: carry italics/bold across to SRT tags, drop the rest.
     \N is a hard line break, \n a soft one, \h a non-breaking space. */
  function assText(raw) {
    var t = String(raw).replace(/\{[^}]*\}/g, function (block) {
      var out = "";
      if (/\\r/.test(block)) return "</i></b>";
      if (/\\i1/.test(block) || /\\i(?!\d)/.test(block)) out += "<i>";
      if (/\\i0/.test(block)) out += "</i>";
      if (/\\b1/.test(block) || /\\b(?!\d)/.test(block)) out += "<b>";
      if (/\\b0/.test(block)) out += "</b>";
      return out;
    });
    t = t.replace(/\\N/g, "\n").replace(/\\n/g, "\n").replace(/\\h/g, " ");
    return t.replace(/[ \t]+$/gm, "").replace(/^\s+|\s+$/g, "");
  }

  function assCues(text) {
    var norm = String(text).replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
    var lines = norm.split("\n");
    var inEvents = false, fields = null, cues = [];
    for (var i = 0; i < lines.length; i++) {
      var sec = /^\s*\[([^\]]+)\]\s*$/.exec(lines[i]);
      if (sec) { inEvents = /^events$/i.test(sec[1].trim()); fields = null; continue; }
      if (!inEvents) continue;

      var fm = /^\s*Format\s*:\s*(.+)$/i.exec(lines[i]);
      if (fm) {
        fields = fm[1].split(",").map(function (x) { return x.trim().toLowerCase(); });
        continue;
      }
      var dm = /^\s*Dialogue\s*:\s*(.*)$/i.exec(lines[i]);
      if (!dm) continue;

      var f = fields || ["marked", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
      var si = f.indexOf("start"), ei = f.indexOf("end"), ti = f.indexOf("text");
      if (si < 0 || ei < 0 || ti < 0) continue;

      var parts = dm[1].split(",");
      if (parts.length <= ti) continue;
      /* Text is the last field, so it absorbs any commas of its own. */
      var st = assTime(parts[si]), en = assTime(parts[ei]);
      if (st === null || en === null) continue;
      cues.push({ start: st, end: en, text: assText(parts.slice(ti).join(",")) });
    }
    return cues;
  }

  function toSrtFromAss(text) {
    var c = assCues(text);
    return c.length ? serialize(c, false) : "";
  }

  function srtTagsToAss(t) {
    return String(t)
      .replace(/<i>/gi, "{\\i1}").replace(/<\/i>/gi, "{\\i0}")
      .replace(/<b>/gi, "{\\b1}").replace(/<\/b>/gi, "{\\b0}")
      .replace(/<u>/gi, "{\\u1}").replace(/<\/u>/gi, "{\\u0}")
      .replace(/<[^>]*>/g, "")
      .replace(/\n/g, "\\N");
  }

  function toAss(text) {
    var cues = parseCues(text);
    if (!cues.length) return "";
    var out = [
      "[Script Info]",
      "; Generated by Subtitle Toolkit — https://toolboxes.top/tools/srt-to-ass",
      "Title: Subtitles",
      "ScriptType: v4.00+",
      "WrapStyle: 0",
      "ScaledBorderAndShadow: yes",
      "PlayResX: 1920",
      "PlayResY: 1080",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,48,1",
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ];
    for (var i = 0; i < cues.length; i++) {
      out.push("Dialogue: 0," + assFmt(cues[i].start) + "," + assFmt(cues[i].end) +
        ",Default,,0,0,0,," + srtTagsToAss(cues[i].text));
    }
    return out.join("\n") + "\n";
  }

  /* ---------- TTML / DFXP (Timed Text Markup Language) ----------
     XML, not a line format. Cues are <p> elements carrying begin/end (or begin + dur).
     Time values come in several flavours: clock (hh:mm:ss.mmm or hh:mm:ss:ff),
     and offsets (10s, 100ms, 5m, 2h, 30f frames, 100t ticks). */
  function looksTtml(text) {
    var h = String(text).slice(0, 5000);
    return /<\s*tt[\s>]/i.test(h) || /<\s*p[^>]*\bbegin\s*=/i.test(h);
  }

  function xmlAttr(s, name) {
    var m = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(s);
    return m ? m[1] : null;
  }

  function decodeXmlEntities(s) {
    return String(s)
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&amp;/gi, "&");
  }

  function ttmlTime(raw, frameRate) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return null;
    var m = /^(\d+(?:\.\d+)?)(h|ms|m|s|f|t)$/i.exec(s);
    if (m) {
      var v = parseFloat(m[1]), u = m[2].toLowerCase();
      if (u === "h") return Math.round(v * 3600000);
      if (u === "m") return Math.round(v * 60000);
      if (u === "s") return Math.round(v * 1000);
      if (u === "ms") return Math.round(v);
      if (u === "f") return Math.round(v / frameRate * 1000);
      return Math.round(v / (frameRate * 1000000) * 1000);   /* ticks */
    }
    /* hh:mm:ss:ff — frames as the fourth component */
    m = /^(\d{1,3}):(\d{2}):(\d{2}):(\d{1,3})$/.exec(s);
    if (m) {
      return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + Math.round(+m[4] / frameRate * 1000);
    }
    /* hh:mm:ss(.mmm | ,mmm) */
    m = /^(\d{1,3}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(s);
    if (m) {
      var ms = 0;
      if (m[4] != null) ms = m[4].length === 3 ? +m[4] : m[4].length === 2 ? +m[4] * 10 : +m[4] * 100;
      return ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + ms;
    }
    return null;
  }

  function ttmlCues(text) {
    var src = String(text).replace(/^\uFEFF/, "");
    var fr = xmlAttr(src.slice(0, 4000), "ttp:frameRate") || xmlAttr(src.slice(0, 4000), "frameRate");
    var frameRate = fr ? parseFloat(fr) : 30;
    if (!(frameRate > 0)) frameRate = 30;

    var cues = [];
    var re = /<\s*p\b([^>]*)>([\s\S]*?)<\s*\/\s*p\s*>/gi;
    var m;
    while ((m = re.exec(src)) !== null) {
      var attrs = m[1], inner = m[2];
      var st = ttmlTime(xmlAttr(attrs, "begin"), frameRate);
      if (st === null) continue;
      var en = ttmlTime(xmlAttr(attrs, "end"), frameRate);
      if (en === null) {
        var d = ttmlTime(xmlAttr(attrs, "dur"), frameRate);
        en = d === null ? st : st + d;
      }
      var t = inner
        .replace(/<\s*br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]*>/g, "");
      t = decodeXmlEntities(t).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
      cues.push({ start: st, end: en, text: t });
    }
    return cues;
  }

  function toSrtFromTtml(text) {
    var c = ttmlCues(text);
    return c.length ? serialize(c, false) : "";
  }

  /* ---------- plain text -> timed SRT (placeholder timing) ---------- */
  function splitByWords(s, maxChars) {
    var words = String(s).split(/\s+/), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      if (!cur) { cur = words[i]; continue; }
      if ((cur + " " + words[i]).length <= maxChars) cur += " " + words[i];
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [s];
  }

  function textToCues(text, o) {
    var dur = o.durMs > 0 ? o.durMs : 2500;
    var gap = o.gapMs > 0 ? o.gapMs : 0;
    var start = o.startMs > 0 ? o.startMs : 0;
    var maxChars = o.maxChars > 0 ? o.maxChars : 0;
    var src = String(text).replace(/\r\n?/g, "\n").split("\n");
    var out = [], t = start;
    for (var i = 0; i < src.length; i++) {
      var s = src[i].replace(/\s+/g, " ").trim();
      if (!s) continue;
      var chunks = (maxChars > 0 && s.length > maxChars) ? splitByWords(s, maxChars) : [s];
      for (var c = 0; c < chunks.length; c++) {
        out.push({ start: t, end: t + dur, text: chunks[c] });
        t += dur + gap;
      }
    }
    return out;
  }

  /* Which parser applies to this input — used for the status line. */
  function countCues(text) {
    if (looksAss(text)) return assCues(text).length;
    if (looksTtml(text)) return ttmlCues(text).length;
    return parseCues(text).length;
  }

  function download(name, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- page wiring ---------- */
  function $(id) { return document.getElementById(id); }

  function wire() {
    var mode = document.body.getAttribute("data-tool");
    var input = $("in"), output = $("out");
    if (!input || !output || !mode) return;

    var opts = {
      tags: $("opt-tags"), sound: $("opt-sound"), speaker: $("opt-speaker"),
      empty: $("opt-empty"), dupe: $("opt-dupe"), dedupe: $("opt-dedupe"),
    };
    var offset = $("offset"), offsetMs = $("offset-ms"), status = $("status"), ratio = $("ratio");
    var in2 = $("in2"), gap = $("gap");
    var splitAt = $("split-at"), part = $("part");
    var chkIds = ["chk-cps", "chk-min", "chk-max", "chk-line"];

    function readOpt(k, dflt) {
      var el = opts[k];
      if (!el) return dflt;
      return el.checked;
    }

    function numVal(id, dflt) {
      var el = $(id);
      if (!el) return dflt;
      var v = parseFloat(el.value);
      return isNaN(v) ? dflt : v;
    }

    function run() {
      var text = input.value;
      if (!text.trim()) { output.value = ""; if (status) status.textContent = ""; return; }
      var res = "", vtt = looksVtt(text), cues;

      if (mode === "convert-vtt") {
        res = toVtt(text);
      } else if (mode === "convert-srt") {
        res = toSrt(text);
      } else if (mode === "to-text") {
        res = toPlainText(text, readOpt("dedupe", true));
      } else if (mode === "clean") {
        cues = cleanCues(text, {
          tags: readOpt("tags", true), sound: readOpt("sound", true),
          speaker: readOpt("speaker", false), empty: readOpt("empty", true),
          dupe: readOpt("dupe", false)
        });
        res = cues.length ? serialize(cues, vtt) : "";
      } else if (mode === "shift") {
        var ms = offsetMs ? parseInt(offsetMs.value, 10) : NaN;
        if (isNaN(ms) && offset) ms = Math.round(parseFloat(offset.value) * 1000);
        if (isNaN(ms)) ms = 0;
        cues = shiftCues(text, ms);
        res = cues.length ? serialize(cues, vtt) : "";
      } else if (mode === "resync") {
        var r = ratio ? parseFloat(ratio.value) : NaN;
        if (isNaN(r) || r <= 0) r = 1;
        cues = resyncCues(text, r);
        res = cues.length ? serialize(cues, vtt) : "";
      } else if (mode === "sbv-to-srt") {
        var sc = sbvCues(text);
        res = sc.length ? serialize(sc, false) : "";
      } else if (mode === "ass-to-srt") {
        res = toSrtFromAss(text);
      } else if (mode === "srt-to-ass") {
        res = toAss(text);
      } else if (mode === "ttml-to-srt") {
        res = toSrtFromTtml(text);
      } else if (mode === "text-to-srt") {
        var tc = textToCues(text, {
          durMs: numVal("txt-dur", 2.5) * 1000,
          startMs: numVal("txt-start", 0) * 1000,
          maxChars: numVal("txt-max", 0)
        });
        output.value = tc.length ? serialize(tc, false) : "";
        if (status) {
          status.textContent = tc.length
            ? tc.length + " cue" + (tc.length === 1 ? "" : "s") +
              " generated — the timing is evenly spaced, so treat it as a starting point."
            : "";
        }
        return;
      } else if (mode === "merge") {
        var g = gap ? Math.round((parseFloat(gap.value) || 0) * 1000) : 0;
        cues = mergeCues(text, in2 ? in2.value : "", g);
        res = cues.length ? serialize(cues, vtt) : "";
      } else if (mode === "to-csv") {
        res = toCsv(text);
      } else if (mode === "split") {
        var atRaw = splitAt ? splitAt.value : "";
        var atMs = parseLooseTime(atRaw);
        if (atMs === null) atMs = 0;
        var sp = splitCues(text, atMs);
        var which = part ? part.value : "a";
        var sel = which === "b" ? sp.b : sp.a;
        res = sel.length ? serialize(sel, vtt) : "";
        var dlBtn = $("download");
        if (dlBtn) dlBtn.setAttribute("data-name", (which === "b" ? "part2" : "part1") + (vtt ? ".vtt" : ".srt"));
        if (status) {
          status.textContent = "Split at " + fmtTime(atMs, ",") +
            " — part 1: " + sp.a.length + " cue" + (sp.a.length === 1 ? "" : "s") +
            " · part 2: " + sp.b.length + " cue" + (sp.b.length === 1 ? "" : "s") +
            (sp.a.length && sp.b.length ? "" : " — move the split point so both parts have cues");
        }
        output.value = res;
        return;
      } else if (mode === "fix-encoding") {
        var srcSel = $("enc-src"), tw = $("enc-twice");
        var rep = repairEncoding(text, srcSel ? srcSel.value : "auto", tw ? tw.checked : false);
        res = rep.text;
        if (status) {
          if (!text.trim()) status.textContent = "";
          else if (rep.passes === 0) {
            status.textContent = rep.after === 0
              ? "No mojibake patterns found — this text already decodes cleanly."
              : "No safe repair found. Try the other \"read as\" setting, or check that the file really is UTF-8 misread as single-byte.";
          } else {
            status.textContent = "Repaired " + rep.passes + " encoding pass" + (rep.passes === 1 ? "" : "es") +
              " (read as " + (rep.source === "auto" ? "auto-detected" : rep.source === "cp1251" ? "Windows-1251" : "Windows-1252") +
              "). Remaining suspicious sequences: " + rep.after + ".";
          }
        }
        output.value = res;
        return;
      } else if (mode === "check") {
        res = timingReport(text, {
          maxCps: numVal("chk-cps", 20), minMs: numVal("chk-min", 833),
          maxMs: numVal("chk-max", 7000), maxLine: numVal("chk-line", 42)
        });
        if (status) {
          var cn = parseCues(text).length;
          var flagged = (res.match(/^#\d{4}/gm) || []).length;
          status.textContent = cn
            ? cn + " cue" + (cn === 1 ? "" : "s") + " checked · " + flagged + " flagged (" +
              Math.round((flagged / cn) * 100) + "%)"
            : "No subtitle cues found — check that the file uses \"-->\" between timestamps.";
        }
        output.value = res;
        return;
      }
      output.value = res;
      if (status) {
        var n = countCues(text);
        var assMode = mode === "ass-to-srt";
        var ttmlMode = mode === "ttml-to-srt";
        status.textContent = n
          ? n + " cue" + (n === 1 ? "" : "s") + " processed"
          : assMode
            ? "No ASS/SSA dialogue lines found — the file needs an [Events] section with Dialogue: lines."
            : ttmlMode
            ? "No timed cues found — TTML cues need <p> elements carrying a begin attribute."
            : "No subtitle cues found — check that the file uses \"-->\" between timestamps.";
      }
    }

    input.addEventListener("input", run);

    if (offset) offset.addEventListener("input", function () {
      if (offsetMs) offsetMs.value = String(Math.round((parseFloat(offset.value) || 0) * 1000));
      run();
    });
    if (offsetMs) offsetMs.addEventListener("input", function () {
      if (offset) offset.value = ((parseInt(offsetMs.value, 10) || 0) / 1000).toFixed(3).replace(/\.?0+$/, "");
      run();
    });
    var preset = $("preset");
    if (preset && ratio) preset.addEventListener("change", function () {
      ratio.value = preset.value;
      run();
    });
    if (ratio) ratio.addEventListener("input", function () {
      if (preset) preset.value = "1";
      run();
    });
    if (in2) in2.addEventListener("input", run);
    if (gap) gap.addEventListener("input", run);
    if (splitAt) splitAt.addEventListener("input", run);
    if (part) part.addEventListener("change", run);
    chkIds.forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", run); });
    ["txt-dur", "txt-start", "txt-max"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", run);
    });
    ["enc-src", "enc-twice"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener(el.tagName === "SELECT" ? "change" : "change", run);
    });
    Object.keys(opts).forEach(function (k) { if (opts[k]) opts[k].addEventListener("change", run); });

    /* file drop / pick */
    var file = $("file");
    if (file) file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { input.value = String(r.result); run(); };
      r.readAsText(f);
    });

    var drop = $("drop");
    if (drop) {
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
      });
      drop.addEventListener("drop", function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () { input.value = String(r.result); run(); };
        r.readAsText(f);
      });
    }

    var copy = $("copy");
    if (copy) copy.addEventListener("click", function () {
      if (!output.value) return;
      output.select();
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy result"; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(output.value).then(done, done);
      } else { try { document.execCommand("copy"); } catch (e) {} done(); }
    });

    var dl = $("download");
    if (dl) dl.addEventListener("click", function () {
      if (!output.value) return;
      dl.download = dl.getAttribute("data-name") || "output.txt";
      download(dl.getAttribute("data-name") || "output.txt", output.value);
    });

    var clear = $("clear");
    if (clear) clear.addEventListener("click", function () {
      input.value = ""; output.value = ""; if (status) status.textContent = ""; input.focus();
    });

    run();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
    else wire();
  }

  /* test hook: no-op in the browser, lets node run the core functions */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      parseTime: parseTime, fmtTime: fmtTime, parseCues: parseCues,
      toVtt: toVtt, toSrt: toSrt, toPlainText: toPlainText,
      cleanCues: cleanCues, shiftCues: shiftCues, serialize: serialize, looksVtt: looksVtt,
      resyncCues: resyncCues, mergeCues: mergeCues, toCsv: toCsv, sbvCues: sbvCues,
      splitCues: splitCues, parseLooseTime: parseLooseTime,
      assCues: assCues, toSrtFromAss: toSrtFromAss, toAss: toAss, looksAss: looksAss,
      assTime: assTime, assFmt: assFmt, countCues: countCues,
      looksTtml: looksTtml, ttmlCues: ttmlCues, ttmlTime: ttmlTime, toSrtFromTtml: toSrtFromTtml,
      textToCues: textToCues, splitByWords: splitByWords, decodeXmlEntities: decodeXmlEntities,
      xmlAttr: xmlAttr,
      repairEncoding: repairEncoding, mojiCount: mojiCount, utf8Decode: utf8Decode,
      timingReport: timingReport, plainOf: plainOf
    };
  }
})();
`;

/* ============================================================
   3. 样式（自包含，复用品牌绿）
   ============================================================ */
const CSS = String.raw`/* Subtitle Toolkit — styles */
:root{
  --green:#10b981; --green-dark:#059669; --green-deep:#065f46;
  --bg:#fafaf6; --bg-alt:#f2f3ee; --surface:#ffffff; --surface-2:#f6f7f4;
  --text:#17251f; --text-2:#5b6b63; --border:#e4e8e2;
  --shadow:0 1px 2px rgba(23,37,31,.05), 0 8px 24px -12px rgba(23,37,31,.12);
  --radius:14px;
}
[data-theme="dark"]{
  --bg:#0d1512; --bg-alt:#101a16; --surface:#16211c; --surface-2:#1b2822;
  --text:#e7efe9; --text-2:#93a59b; --border:#25352d;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.55);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);line-height:1.7;
  font-family:"Plus Jakarta Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:var(--green-dark);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.narrow{max-width:800px}

/* header */
header.site{position:sticky;top:0;z-index:40;background:var(--surface);
  border-bottom:1px solid var(--border);backdrop-filter:saturate(1.4) blur(6px)}
header.site .wrap{display:flex;align-items:center;gap:16px;height:64px}
.logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:17px;color:var(--text)}
.logo:hover{text-decoration:none}
.logo .mark{width:30px;height:30px;border-radius:9px;background:var(--green);
  display:grid;place-items:center;font-size:16px;flex:0 0 auto}
.logo em{font-style:normal;color:var(--green-dark)}
header.site nav{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
header.site nav a{padding:7px 11px;border-radius:9px;font-size:14.5px;font-weight:600;color:var(--text-2)}
header.site nav a:hover{background:var(--surface-2);color:var(--text);text-decoration:none}
#theme{border:1px solid var(--border);background:var(--surface-2);border-radius:9px;
  width:34px;height:34px;cursor:pointer;font-size:15px;line-height:1}

/* hero */
.hero{padding:56px 0 40px;text-align:center}
.hero h1{font-size:clamp(28px,4.4vw,42px);line-height:1.2;margin:0 0 14px;letter-spacing:-.6px}
.hero p.lead{font-size:17.5px;color:var(--text-2);max-width:640px;margin:0 auto 22px}
.hero .badges{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.badge{background:var(--surface);border:1px solid var(--border);border-radius:999px;
  padding:5px 13px;font-size:13px;font-weight:600;color:var(--text-2)}
.badge.on{background:#e8f7f0;border-color:#bfe6cd;color:var(--green-deep)}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin:26px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px;box-shadow:var(--shadow);display:flex;flex-direction:column;transition:transform .15s,border-color .15s}
.card:hover{transform:translateY(-2px);border-color:#bfe6cd;text-decoration:none}
.card .ico{font-size:24px;margin-bottom:10px}
.card h3{margin:0 0 7px;font-size:17px;color:var(--text)}
.card p{margin:0;color:var(--text-2);font-size:14.5px}
.card .go{margin-top:13px;font-weight:700;font-size:14px;color:var(--green-dark)}

/* tool ui */
.tool{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:18px;box-shadow:var(--shadow);margin:22px 0}
.panes{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:760px){.panes{grid-template-columns:1fr}}
.pane{display:flex;flex-direction:column;min-width:0}
.pane label{font-size:13px;font-weight:700;color:var(--text-2);margin-bottom:6px;
  text-transform:uppercase;letter-spacing:.4px}
textarea{width:100%;min-height:230px;resize:vertical;padding:13px;border-radius:11px;
  border:1px solid var(--border);background:var(--surface-2);color:var(--text);
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.55}
textarea:focus{outline:2px solid #9fe3c6;outline-offset:1px;border-color:var(--green)}
#drop{border:2px dashed var(--border);border-radius:11px;padding:11px 13px;margin-bottom:12px;
  background:var(--surface-2);font-size:14px;color:var(--text-2);text-align:center;transition:.15s}
#drop.over{border-color:var(--green);background:#e8f7f0}
#drop input{font-size:13px;max-width:100%}
.row{display:flex;gap:9px;flex-wrap:wrap;align-items:center;margin-top:12px}
button.btn{border:1px solid var(--border);background:var(--surface-2);color:var(--text);
  border-radius:10px;padding:9px 15px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
button.btn:hover{background:var(--bg-alt)}
button.btn.primary{background:var(--green);border-color:var(--green);color:#fff}
button.btn.primary:hover{background:var(--green-dark)}
.opts{display:flex;gap:16px;flex-wrap:wrap;margin-top:13px;padding-top:13px;border-top:1px solid var(--border)}
.opts label{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:600;color:var(--text-2);cursor:pointer}
.opts input[type=checkbox]{width:16px;height:16px;accent-color:var(--green);cursor:pointer}
.field{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--text-2)}
.field input[type=number]{width:110px;padding:7px 10px;border-radius:9px;border:1px solid var(--border);
  background:var(--surface-2);color:var(--text);font-size:14px;font-family:inherit}
#status{margin-top:10px;font-size:13.5px;color:var(--text-2);min-height:20px}

/* prose */
article h2{font-size:22px;margin:36px 0 12px;letter-spacing:-.3px}
article h3{font-size:17px;margin:24px 0 9px}
article p{margin:11px 0;color:var(--text)}
article ul,article ol{padding-left:22px;color:var(--text)}
article li{margin:7px 0}
code{background:var(--bg-alt);border:1px solid var(--border);padding:1.5px 6px;
  border-radius:6px;font-size:13px;font-family:ui-monospace,Consolas,monospace}
.note{background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--green);
  border-radius:10px;padding:15px 18px;margin:20px 0}
.note h4{margin:0 0 8px;font-size:14.5px}
.note ul{margin:8px 0 0}
.example{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}
.example>div{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.example h5{margin:0;padding:9px 13px;font-size:12.5px;letter-spacing:.4px;text-transform:uppercase;
  color:var(--text-2);background:var(--surface);border-bottom:1px solid var(--border);font-weight:700}
.example pre{margin:0;padding:13px;font-size:12.5px;line-height:1.65;overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  color:var(--text);white-space:pre}
.example .cap{padding:0 13px 11px;margin:0;font-size:12.5px;color:var(--text-2)}
.tshoot{counter-reset:ts;list-style:none;padding:0;margin:16px 0}
.tshoot>li{position:relative;padding:0 0 0 34px;margin:0 0 16px}
.tshoot>li::before{counter-increment:ts;content:counter(ts);position:absolute;left:0;top:1px;
  width:22px;height:22px;border-radius:50%;background:var(--green);color:#fff;font-size:12px;
  font-weight:800;display:flex;align-items:center;justify-content:center}
.tshoot .sym{display:block;font-weight:700;color:var(--text);margin-bottom:3px}
.tshoot .fix{color:var(--text-2);font-size:15px}
@media(max-width:680px){.example{grid-template-columns:1fr}}
article table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14.5px;
  display:block;overflow-x:auto;white-space:nowrap}
article th,article td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:top}
article th{background:var(--surface-2);font-weight:700}
article td{white-space:normal}
article pre{background:var(--surface-2);border:1px solid var(--border);border-radius:10px;
  padding:13px;overflow-x:auto;font-size:13px;line-height:1.65;color:var(--text);
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace}
article h3{margin:24px 0 6px;font-size:17px}
.privacy{background:#e8f7f0;border:1px solid #bfe6cd;border-radius:var(--radius);
  padding:16px 19px;margin:22px 0}
.privacy h4{margin:0 0 6px;color:var(--green-deep);font-size:15px}
.privacy p{margin:0;color:#215c46;font-size:14.5px}
details.faq{background:var(--surface);border:1px solid var(--border);border-radius:11px;
  padding:0;margin:10px 0;overflow:hidden}
details.faq summary{cursor:pointer;padding:14px 17px;font-weight:700;font-size:15.5px;list-style:none}
details.faq summary::-webkit-details-marker{display:none}
details.faq summary::after{content:"+";float:right;color:var(--green-dark);font-weight:800}
details.faq[open] summary::after{content:"\2212"}
details.faq .body{padding:0 17px 15px;color:var(--text-2);font-size:15px}
.crumb{font-size:13.5px;color:var(--text-2);margin:20px 0 4px}
.crumb a{color:var(--text-2)}
.updated{font-size:13px;color:var(--text-2);margin-top:26px;padding-top:14px;border-top:1px solid var(--border)}

/* footer */
footer.site{margin-top:56px;padding:30px 0 40px;border-top:1px solid var(--border);
  background:var(--surface);color:var(--text-2);font-size:14px}
footer.site .cols{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:24px}
@media(max-width:860px){footer.site .cols{grid-template-columns:1fr 1fr}}
@media(max-width:680px){footer.site .cols{grid-template-columns:1fr}}
footer.site h5{margin:0 0 9px;font-size:14px;color:var(--text)}
footer.site ul{list-style:none;padding:0;margin:0}
footer.site li{margin:6px 0}
footer.site .legal{margin-top:22px;padding-top:16px;border-top:1px solid var(--border);font-size:13px}
.skip{position:absolute;left:-9999px}
.skip:focus{left:12px;top:12px;z-index:99;background:var(--surface);padding:9px 14px;border-radius:9px}
`;

/* ============================================================
   4. 页面模板
   ============================================================ */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nav = () =>
  `<a href="/tools/">All tools</a>` +
  TOOLS.map(
    (t) =>
      `<a href="/tools/${t.slug}">${esc(t.h1.replace(/ Converter| from Subtitles| Timing| Up AI-Generated Subtitles| from AI-Generated Subtitles/, ""))}</a>`
  ).join("") +
  `<a href="/guides/">Guides</a>`;

// 资源版本号：内容变了才变。用于给 /js/tools.js 破缓存。
const ASSET_V = crypto
  .createHash("sha1")
  .update(CSS)
  .update(TOOLS_JS)
  .digest("hex")
  .slice(0, 8);

function layout({ title, desc, canonicalPath, body, jsonLd, bodyAttr = "" }) {
  const url = SITE + canonicalPath;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${BRAND}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="alternate" type="text/plain" href="${SITE}/llms.txt" title="LLM-friendly index">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%2310b981%22/><text y=%22.74em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2256%22>%F0%9F%92%AC</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script>try{var t=localStorage.getItem("st-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body${bodyAttr}>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap">
    <a class="logo" href="/"><span class="mark">💬</span>Subtitle<em>Toolkit</em></a>
    <nav>${nav()}<button id="theme" title="Toggle theme" aria-label="Toggle theme">🌗</button></nav>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site">
  <div class="wrap">
    <div class="cols">
      <div>
        <h5>Subtitle Toolkit</h5>
        <p style="margin:0">Free subtitle and caption utilities that run entirely in your browser. Nothing is uploaded, nothing is stored.</p>
      </div>
      <div>
        <h5>Tools</h5>
        <ul>
          <li><a href="/tools/"><strong>All tools</strong></a></li>
          ${TOOLS.map((t) => `<li><a href="/tools/${t.slug}">${esc(t.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <h5>Guides</h5>
        <ul>
          <li><a href="/guides/"><strong>All guides</strong></a></li>
          ${GUIDES.map((g) => `<li><a href="/guides/${g.slug}">${esc(g.h1)}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <h5>Site</h5>
        <ul>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="https://ai.toolboxes.top/">AI tool directory →</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <p>© ${new Date().getFullYear()} Subtitle Toolkit. All processing happens locally in your browser. Last updated ${UPDATED}.</p>
    </div>
  </div>
</footer>
<script src="/js/tools.js?v=${ASSET_V}"></script>
<script>(function(){var b=document.getElementById("theme");if(!b)return;b.addEventListener("click",function(){var h=document.documentElement,n=h.getAttribute("data-theme")==="dark"?"light":"dark";h.setAttribute("data-theme",n);try{localStorage.setItem("st-theme",n)}catch(e){}});})();</script>
</body>
</html>
`;
}

/* ---------- 首页 ---------- */
const homeBody = `
<section class="hero">
  <div class="wrap">
    <h1>Free subtitle tools that run in your browser</h1>
    <p class="lead">Convert, clean and resync <code>.srt</code> and <code>.vtt</code> files. No upload, no signup, no file size limit — your captions never leave your device.</p>
    <div class="badges">
      <span class="badge on">100% client-side</span>
      <span class="badge">No account needed</span>
      <span class="badge">Works offline after load</span>
      <span class="badge">No file size limit</span>
    </div>
  </div>
</section>
<div class="wrap narrow">
  <div class="privacy">
    <h4>Why “client-side” matters for subtitles</h4>
    <p>Subtitle files often contain unreleased product names, internal meeting transcripts or client interviews. Most online converters upload your file to a server to process it. These tools don’t: the conversion is plain JavaScript running on your own machine, so the file never travels over the network.</p>
  </div>
  <div class="grid">
    ${TOOLS.map((t) => `<a class="card" href="/tools/${t.slug}">
      <div class="ico">${t.slug.includes("shift") ? "⏱️" : t.slug.includes("clean") ? "🧹" : t.slug.includes("timestamp") ? "📄" : "🔄"}</div>
      <h3>${esc(t.h1)}</h3>
      <p>${esc(t.tagline)}</p>
      <div class="go">Open tool →</div>
    </a>`).join("")}
  </div>

  <article>
    <h2>Which tool do I need?</h2>
    <ul>
      <li><strong>Subtitles won’t show up on a web page</strong> → your file is probably <code>.srt</code>. Use <a href="/tools/srt-to-vtt">SRT to VTT</a>.</li>
      <li><strong>Your video editor rejects the file</strong> → it’s probably WebVTT. Use <a href="/tools/vtt-to-srt">VTT to SRT</a>.</li>
      <li><strong>Subtitles appear too early or too late</strong> → <a href="/tools/shift-subtitles">Shift subtitle timing</a>.</li>
      <li><strong>You want a readable transcript</strong> → <a href="/tools/remove-timestamps">Remove timestamps</a>.</li>
      <li><strong>Auto-captions are full of <code>[Music]</code> and markup</strong> → <a href="/tools/clean-subtitles">Clean up AI subtitles</a>.</li>
    </ul>

    <h2>Frequently asked questions</h2>
    <details class="faq"><summary>Are these tools really free?</summary><div class="body">Yes. There is no account, no usage quota and no watermark. The site is supported by advertising, which is why you may see ads on the page.</div></details>
    <details class="faq"><summary>Do you store my subtitle files?</summary><div class="body">No. Files are read directly by your browser and processed in memory. Nothing is transmitted to a server, and nothing is written to storage. Closing the tab discards everything.</div></details>
    <details class="faq"><summary>Is there a file size limit?</summary><div class="body">No server-side limit, because nothing is uploaded. In practice the limit is your browser’s available memory — files of several megabytes process instantly.</div></details>
    <details class="faq"><summary>Which formats are supported?</summary><div class="body">SubRip (<code>.srt</code>) and WebVTT (<code>.vtt</code>) are fully supported, plus most <code>.sbv</code>-style files that use the <code>HH:MM:SS,mmm --&gt; HH:MM:SS,mmm</code> arrow syntax.</div></details>
    <details class="faq"><summary>Can I use these tools offline?</summary><div class="body">Yes. Once the page has loaded, the conversion logic runs locally, so it keeps working if you lose your connection.</div></details>
  </article>

  <h2>Guides</h2>
  <div class="grid">
    ${GUIDES.map((g) => `<a class="card" href="/guides/${g.slug}">
      <div class="ico">📘</div>
      <h3>${esc(g.h1)}</h3>
      <p>${esc(g.lead)}</p>
      <div class="go">Read guide →</div>
    </a>`).join("")}
  </div>
  <p class="updated">Last updated ${UPDATED}. Found a bug or need another format? The <a href="https://ai.toolboxes.top/">AI tool directory</a> lists transcription and captioning tools that produce these files in the first place.</p>
</div>`;

/* ---------- 工具页 ---------- */
function toolBody(t) {
  const isClean = t.slug === "clean-subtitles";
  const isShift = t.slug === "shift-subtitles";
  const isResync = t.slug === "resync-subtitles";
  const isMerge = t.slug === "merge-subtitles";
  const isSplit = t.slug === "split-subtitles";
  const isEnc = t.slug === "fix-subtitle-encoding";
  const isCheck = t.slug === "subtitle-timing-check";
  const isText = t.slug === "remove-timestamps";
  const isAssIn = t.slug === "ass-to-srt";
  const isAssOut = t.slug === "srt-to-ass";
  const isTtmlIn = t.slug === "ttml-to-srt";
  const isTextToSrt = t.slug === "text-to-srt";
  const OUT_META = {
    "remove-timestamps": ["transcript.txt", "Plain text"],
    "srt-to-csv": ["subtitles.csv", "CSV output"],
    "srt-to-vtt": ["output.vtt", "WebVTT output"],
    "fix-subtitle-encoding": ["fixed.txt", "Repaired text"],
    "subtitle-timing-check": ["timing-report.txt", "Timing report"],
    "srt-to-ass": ["output.ass", "ASS output"],
  };
  const outMeta = OUT_META[t.slug] || ["output.srt", "SRT output"];
  const outName = outMeta[0], outLabel = outMeta[1];
  const ASS_SAMPLE = "[Script Info]\nScriptType: v4.00+\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Paste your .ass file here\u2026";
  const TTML_SAMPLE = "<tt xmlns=\"http://www.w3.org/ns/ttml\" ttp:frameRate=\"25\">\n  <body><div>\n    <p begin=\"00:00:01.000\" end=\"00:00:04.000\">Paste your TTML or DFXP file here\u2026</p>\n  </div></body>\n</tt>";
  const TEXT_SAMPLE = "Paste your transcript here, one caption per line\u2026\nEach line becomes its own cue.\nBlank lines are ignored.";
  const placeholder = isEnc
    ? "Paste the garbled text here — e.g. Caf\u00c3\u00a9 ouvert jusqu'\u00c3\u00a0 minuit"
    : isAssIn
    ? ASS_SAMPLE
    : isTtmlIn
    ? TTML_SAMPLE
    : isTextToSrt
    ? TEXT_SAMPLE
    : isCheck
    ? "1\n00:00:01,000 --> 00:00:04,000\nPaste your subtitle file here\u2026"
    : "1\n00:00:01,000 --> 00:00:04,000\nPaste your subtitle file here\u2026";
  const inLabel = isEnc ? "Input — garbled text"
    : isAssIn ? "Input — .ass / .ssa"
    : isTtmlIn ? "Input — .ttml / .dfxp / .xml"
    : isTextToSrt ? "Input — plain text, one line per cue"
    : "Input — .srt / .vtt";
  const acceptAttr = isAssIn ? ".ass,.ssa,.txt,text/plain"
    : isTtmlIn ? ".ttml,.dfxp,.xml,.txt,text/plain"
    : isTextToSrt ? ".txt,text/plain"
    : ".srt,.vtt,.sbv,.txt,text/plain";

  return `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › <a href="/#tools">Tools</a> › ${esc(t.h1)}</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px;letter-spacing:-.5px">${esc(t.h1)}</h1>
  <p class="lead" style="font-size:17px;color:var(--text-2);margin:0 0 6px">${esc(t.tagline)}</p>

  <div class="tool">
    <div id="drop">
      Drop a subtitle file here, or
      <input type="file" id="file" accept="${acceptAttr}">
    </div>
    ${isMerge ? `<div class="panes">
      <div class="pane">
        <label for="in2">Second file — .srt / .vtt</label>
        <textarea id="in2" spellcheck="false" placeholder="Paste the second subtitle file here…"></textarea>
      </div>
      <div class="pane">
        <span class="field">Gap between files <input type="number" id="gap" step="0.1" value="0" aria-label="Gap in seconds"> seconds</span>
        <p style="margin:10px 0 0;color:var(--text-2);font-size:14px">The second file is appended after the first one ends, so CD1 + CD2 stay in order.</p>
      </div>
    </div>` : ""}
    <div class="panes">
      <div class="pane">
        <label for="in">${inLabel}</label>
        <textarea id="in" spellcheck="false" placeholder="${placeholder}"></textarea>
      </div>
      <div class="pane">
        <label for="out">${esc(outLabel)}</label>
        <textarea id="out" spellcheck="false" readonly placeholder="Output appears here as you type."></textarea>
      </div>
    </div>
    ${isShift ? `<div class="opts">
      <span class="field">Shift by <input type="number" id="offset" step="0.1" value="0" aria-label="Offset in seconds"> seconds</span>
      <span class="field">or <input type="number" id="offset-ms" step="10" value="0" aria-label="Offset in milliseconds"> ms</span>
    </div>` : ""}
    ${isResync ? `<div class="opts">
      <span class="field">Preset <select id="preset" aria-label="Frame rate or playback speed preset">
        <option value="1">Custom — use the ratio box</option>
        <option value="1.04271">23.976 fps → 25 fps (×1.04271)</option>
        <option value="0.95904">25 fps → 23.976 fps (×0.95904)</option>
        <option value="1.04167">24 fps → 25 fps (×1.04167)</option>
        <option value="0.96">24 fps → 23.976 fps (×0.96)</option>
        <option value="0.90909">Video plays at 1.1× speed (×0.90909)</option>
        <option value="0.8">Video plays at 1.25× speed (×0.8)</option>
      </select></span>
      <span class="field">or ratio <input type="number" id="ratio" step="0.00001" value="1" aria-label="Resample ratio"></span>
    </div>` : ""}
    ${isClean ? `<div class="opts">
      <label><input type="checkbox" id="opt-sound" checked> Remove sound cues</label>
      <label><input type="checkbox" id="opt-tags" checked> Remove markup</label>
      <label><input type="checkbox" id="opt-speaker"> Remove speaker labels</label>
      <label><input type="checkbox" id="opt-dupe"> Remove duplicate cues</label>
      <label><input type="checkbox" id="opt-empty" checked> Drop empty cues</label>
    </div>` : ""}
    ${isText ? `<div class="opts">
      <label><input type="checkbox" id="opt-dedupe" checked> Merge repeated lines</label>
    </div>` : ""}
    ${isTextToSrt ? `<div class="opts">
      <span class="field">Each cue lasts <input type="number" id="txt-dur" step="0.1" min="0.1" value="2.5" aria-label="Seconds per cue"> seconds</span>
      <span class="field">Start at <input type="number" id="txt-start" step="0.1" min="0" value="0" aria-label="Start offset in seconds"> s</span>
      <span class="field">Wrap lines at <input type="number" id="txt-max" step="1" min="0" value="42" aria-label="Maximum characters per line"> characters (0 = no wrap)</span>
    </div>` : ""}
    ${isSplit ? `<div class="opts">
      <span class="field">Split at <input type="text" id="split-at" value="45:00" size="9" aria-label="Split point"> (seconds, <code>m:ss</code> or <code>h:mm:ss</code>)</span>
      <span class="field">Output <select id="part" aria-label="Which part to output">
        <option value="a">Part 1 — before the split</option>
        <option value="b">Part 2 — from the split on</option>
      </select></span>
    </div>` : ""}
    ${isEnc ? `<div class="opts">
      <span class="field">Read as <select id="enc-src" aria-label="Encoding the file was misread as">
        <option value="auto">Auto-detect</option>
        <option value="cp1252">Western European (Windows-1252 / Latin-1)</option>
        <option value="cp1251">Cyrillic (Windows-1251)</option>
      </select></span>
      <label><input type="checkbox" id="enc-twice"> Doubly encoded (read wrong twice)</label>
    </div>` : ""}
    ${isCheck ? `<div class="opts">
      <span class="field">Max <input type="number" id="chk-cps" step="0.5" value="20" aria-label="Max characters per second"> characters/second</span>
      <span class="field">Min <input type="number" id="chk-min" step="10" value="833" aria-label="Minimum cue duration"> ms per cue</span>
      <span class="field">Max <input type="number" id="chk-max" step="100" value="7000" aria-label="Maximum cue duration"> ms per cue</span>
      <span class="field">Max <input type="number" id="chk-line" step="1" value="42" aria-label="Max characters per line"> chars per line</span>
    </div>` : ""}
    <div class="row">
      <button class="btn primary" id="copy">Copy result</button>
      <button class="btn" id="download" data-name="${outName}">Download ${outName.split(".").pop().toUpperCase()}</button>
      <button class="btn" id="clear">Clear</button>
    </div>
    <div id="status" role="status" aria-live="polite"></div>
  </div>

  <div class="privacy">
    <h4>Your file never leaves your device</h4>
    <p>This tool is plain JavaScript. There is no upload step and no server-side processing, so confidential captions, unreleased content and client material stay on your machine.</p>
  </div>

  <article>
    <h2>What this does</h2>
    <p>${t.intro}</p>

    <h2>How to use it</h2>
    <ol>${t.steps.map((s) => `<li>${s}</li>`).join("")}</ol>

    <div class="note">
      <h4>Good to know</h4>
      <ul>${t.notes.map((n) => `<li>${n}</li>`).join("")}</ul>
    </div>
${t.deep ? `
    <h2>${t.deep.h2}</h2>
    ${t.deep.body.map((p) => `<p>${p}</p>`).join("\n    ")}` : ""}
${t.example ? `
    <h2>Worked example</h2>
    <div class="example">
      <div>
        <h5>${esc(t.example.inLabel)}</h5>
        <pre>${esc(t.example.before)}</pre>
      </div>
      <div>
        <h5>${esc(t.example.outLabel)}</h5>
        <pre>${esc(t.example.after)}</pre>
      </div>
    </div>
    <p style="color:var(--text-2);font-size:14.5px;margin:0 0 6px">${t.example.cap}</p>` : ""}

    <h2>FAQ</h2>
    ${t.faq.map(([q, a]) => `<details class="faq"><summary>${q}</summary><div class="body">${a}</div></details>`).join("\n    ")}
${t.troubleshoot ? `
    <h2>Troubleshooting</h2>
    <ol class="tshoot">
      ${t.troubleshoot.map(([sym, fix]) => `<li><span class="sym">${sym}</span><span class="fix">${fix}</span></li>`).join("\n      ")}
    </ol>` : ""}

    <h2>Related tools</h2>
    <div class="grid">
      ${t.related.map((r) => {
        const rt = bySlug[r];
        return `<a class="card" href="/tools/${rt.slug}"><h3>${esc(rt.h1)}</h3><p>${esc(rt.tagline)}</p><div class="go">Open tool →</div></a>`;
      }).join("")}
    </div>
  </article>
  <div class="note">
    <h4>Further reading</h4>
    <ul>${GUIDES.map((g) => `<li><a href="/guides/${g.slug}">${esc(g.h1)}</a></li>`).join("")}</ul>
  </div>
  <p class="updated">Last updated ${UPDATED}. All conversions happen locally in your browser.</p>
</div>`;
}

/* ------------------------------------------------------------
   结构化数据
   之前每页输出 2–3 个互不相关的 <script> 块，Google 看不出从属关系。
   改成单个 @graph + @id 互联，对齐排名竞品（subtitlekit.com）的做法：
     Organization → WebSite → WebPage → WebApplication / HowTo / FAQPage

   两个补上的字段很关键：
   - datePublished / dateModified：之前完全没有 → 页面没有任何时效信号
   - HowTo：工具页本质就是「怎么做 X」的操作步骤，之前只声明了
     WebApplication，丢掉了 HowTo 这一整类结构化数据。
   ------------------------------------------------------------ */
const LAUNCH = "2026-09-17"; // 工具站独立上线日（git 0893503）
const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const stripTags = (s) => String(s).replace(/<[^>]*>/g, "");

const siteNodes = () => [
  {
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND,
    url: `${SITE}/`,
    description: "Free browser-based subtitle and caption utilities.",
    email: CONTACT_EMAIL,
  },
  {
    "@type": "WebSite",
    "@id": SITE_ID,
    name: BRAND,
    url: `${SITE}/`,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  },
];

const webPageNode = ({ path, title, desc, published = LAUNCH, modified = UPDATED }) => ({
  "@type": "WebPage",
  "@id": `${SITE}${path}#webpage`,
  url: `${SITE}${path}`,
  name: title,
  description: desc,
  isPartOf: { "@id": SITE_ID },
  inLanguage: "en",
  datePublished: published,
  dateModified: modified,
});

const breadcrumbNode = (path, trail) => ({
  "@type": "BreadcrumbList",
  "@id": `${SITE}${path}#breadcrumb`,
  itemListElement: trail.map(([name, item], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item,
  })),
});

const graphOf = (...nodes) => ({
  "@context": "https://schema.org",
  "@graph": [...siteNodes(), ...nodes.flat()],
});

function toolJsonLd(t) {
  const path = `/tools/${t.slug}`;
  const url = `${SITE}${path}`;
  const steps = t.steps.map(stripTags);
  return graphOf(
    webPageNode({ path, title: t.h1, desc: t.metaDesc, published: t.published || LAUNCH }),
    breadcrumbNode(path, [
      ["Home", `${SITE}/`],
      ["Tools", `${SITE}/tools/`],
      [t.h1, url],
    ]),
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name: t.h1,
      url,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      description: t.metaDesc,
      isPartOf: { "@id": SITE_ID },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: steps,
    },
    {
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: `How to use the ${t.h1}`,
      description: t.tagline,
      inLanguage: "en",
      totalTime: "PT1M",
      tool: [{ "@type": "HowToTool", name: "A web browser" }],
      step: steps.map((text, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: t.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: stripTags(a) },
      })),
    }
  );
}

/* ============================================================
   5. 写入
   ============================================================ */
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ["css", "js", "tools", "guides"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const write = (rel, content) => {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

write("css/style.css", CSS);
write("js/tools.js", TOOLS_JS);

/* 首页 */
write(
  "index.html",
  layout({
    title: `${BRAND} — Free browser-based subtitle tools (SRT & VTT)`,
    desc: "Convert, clean and resync .srt and .vtt subtitle files in your browser. No upload, no signup, no file size limit. Your captions never leave your device.",
    canonicalPath: "/",
    body: homeBody,
    jsonLd: graphOf(
      webPageNode({
        path: "/",
        title: `${BRAND} — Free browser-based subtitle tools (SRT & VTT)`,
        desc: "Convert, clean and resync .srt and .vtt subtitle files in your browser. No upload, no signup, no file size limit.",
      }),
      {
        "@type": "ItemList",
        "@id": `${SITE}/#tools`,
        name: "Subtitle tools",
        numberOfItems: TOOLS.length,
        itemListElement: TOOLS.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.h1,
          url: `${SITE}/tools/${t.slug}`,
        })),
      }
    ),
  })
);

/* 工具页 */
for (const t of TOOLS) {
  write(
    `tools/${t.slug}.html`,
    layout({
      title: `${t.h1} — Free, No Upload | ${BRAND}`,
      desc: t.metaDesc,
      canonicalPath: `/tools/${t.slug}`,
      body: toolBody(t),
      jsonLd: toolJsonLd(t),
      bodyAttr: ` data-tool="${t.mode}"`,
    })
  );
}

/* 指南页 */
for (const g of GUIDES) {
  write(
    `guides/${g.slug}.html`,
    layout({
      title: g.title,
      desc: g.desc,
      canonicalPath: `/guides/${g.slug}`,
      body: `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> \u203a Guides \u203a ${esc(g.h1)}</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px;letter-spacing:-.5px">${esc(g.h1)}</h1>
  <p class="lead" style="font-size:17px;color:var(--text-2);margin:0 0 6px">${esc(g.lead)}</p>
  <article>${g.body}</article>
  <h2>Tools mentioned in this guide</h2>
  <div class="grid">
    ${TOOLS.map((t) => `<a class="card" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.tagline)}</p><div class="go">Open tool \u2192</div></a>`).join("")}
  </div>
  <p class="updated">Last updated ${UPDATED}. All tools run locally in your browser.</p>
</div>`,
      jsonLd: graphOf(
        webPageNode({ path: `/guides/${g.slug}`, title: g.title, desc: g.desc }),
        breadcrumbNode(`/guides/${g.slug}`, [
          ["Home", `${SITE}/`],
          ["Guides", `${SITE}/guides/`],
          [g.h1, `${SITE}/guides/${g.slug}`],
        ]),
        {
          "@type": "TechArticle",
          "@id": `${SITE}/guides/${g.slug}#article`,
          headline: g.h1,
          description: g.desc,
          url: `${SITE}/guides/${g.slug}`,
          inLanguage: "en",
          isPartOf: { "@id": SITE_ID },
          datePublished: LAUNCH,
          dateModified: UPDATED,
          author: { "@id": ORG_ID },
          publisher: { "@id": ORG_ID },
        }
      ),
    })
  );
}

/* 工具索引页 —— 之前不存在，导航直接铺 16 条链接到每个工具，
   导致全站没有层级、面包屑也没有中间层可指。补一个真正的 hub。 */
const toolHubBody = `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> \u203a Tools</p>
  <h1 style="font-size:clamp(26px,3.8vw,36px);margin:8px 0 10px;letter-spacing:-.5px">Subtitle tools</h1>
  <p class="lead" style="font-size:17px;color:var(--text-2);margin:0 0 6px">Sixteen free utilities for converting, repairing and quality-checking subtitle files. Every one runs entirely in your browser \u2014 no upload, no account, no file size limit.</p>
  <article>
    <h2>Why these run in your browser</h2>
    <p>Subtitle files are often confidential. An unreleased product demo, a client interview, a medical lecture or a legal deposition can all arrive as a caption file. Uploading that to an unknown server to change a comma into a period is a bad trade, so none of these tools has an upload endpoint. You can load a page, disconnect from the internet, and the tool still works.</p>

    <h2>Which tool do I need?</h2>
    <p>Most subtitle problems fall into one of five buckets. Find yours first \u2014 it saves you from converting a file you did not need to convert.</p>
    <h3>The file will not open or will not upload</h3>
    <p>That is a <strong>format</strong> problem. Players, editors and upload forms accept different things, and the mismatch is usually invisible until something refuses the file. Convert to the format your destination wants: <a href="/tools/srt-to-vtt">SRT \u2192 VTT</a> for the web, <a href="/tools/vtt-to-srt">VTT \u2192 SRT</a> for desktop editors, <a href="/tools/ass-to-srt">ASS \u2192 SRT</a> for styled anime releases, <a href="/tools/sbv-to-srt">SBV \u2192 SRT</a> for YouTube exports, or <a href="/tools/ttml-to-srt">TTML \u2192 SRT</a> for broadcast and streaming deliverables.</p>
    <h3>The timing is wrong</h3>
    <p>Timing faults come in two shapes and they need different tools. A <strong>constant</strong> offset \u2014 everything is late by the same amount \u2014 is fixed with <a href="/tools/shift-subtitles">Shift Subtitles</a>. A <strong>growing</strong> offset, where the subtitles drift further out of sync as the video plays, means a frame-rate or speed mismatch and needs <a href="/tools/resync-subtitles">Resync Subtitles</a>, which resamples the whole timeline rather than moving it. If you are not sure which one you have, <a href="/guides/fix-subtitles-out-of-sync">this guide walks through the diagnosis</a>.</p>
    <h3>The text itself is broken</h3>
    <p>Stray timestamps baked into the dialogue, doubled blank lines, HTML tags, speaker labels, or mojibake from a file that was decoded as the wrong encoding. <a href="/tools/clean-subtitles">Clean Up Subtitles</a> handles the first group, <a href="/tools/remove-timestamps">Remove Timestamps</a> strips embedded timecodes from transcripts, and <a href="/tools/fix-subtitle-encoding">Fix Encoding</a> repairs \u00e2\u0080\u0099-style corruption.</p>
    <h3>I need to check it before delivery</h3>
    <p><a href="/tools/subtitle-timing-check">Subtitle Timing Check</a> produces a quality-control report: characters per second, minimum and maximum cue duration, line width and overlaps. It tells you what a client or platform would reject, before they do. <a href="/guides/subtitle-reading-speed">This guide explains the thresholds</a> and where they come from.</p>
    <h3>I need to restructure the file</h3>
    <p>Merging two files, splitting one at a point, or exporting the text for a translator. Use <a href="/tools/merge-subtitles">Merge Subtitles</a>, <a href="/tools/split-subtitles">Split Subtitles</a> and <a href="/tools/srt-to-csv">SRT \u2192 CSV</a>. If you are sending files out for translation, read <a href="/guides/translate-subtitles">the translation workflow guide</a> first \u2014 the order of operations matters more than the tool choice.</p>

    <h2>All tools</h2>
    <div class="grid">
      ${TOOLS.map((t) => `<a class="card" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.tagline)}</p><div class="go">Open tool \u2192</div></a>`).join("\n      ")}
    </div>

    <h2>What these tools will not do</h2>
    <p>They do not transcribe audio, translate text, or \u201cimprove\u201d your wording. Every operation here is a deterministic transformation of text and timestamps: given the same input you get the same output, and nothing is invented. Automated rewriting of captions risks changing meaning, which is a far worse failure than awkward phrasing.</p>
    <p>Conversions that are inherently lossy are documented on the relevant page rather than silently applied \u2014 WebVTT cue settings are dropped when converting to SRT, and ASS positioning and effects do not survive either. If you need those preserved, keep the original file.</p>

    <h2>Questions</h2>
    <p>Send them to <a href="/contact">the contact page</a>. Bug reports with the input that broke are the most useful thing you can send \u2014 a subtitle file that fails is worth more than a description of a failure.</p>
    <p class="updated">Last updated ${UPDATED}. All tools run locally in your browser.</p>
  </article>
</div>`;

write(
  "tools/index.html",
  layout({
    title: `Subtitle Tools — 16 Free Browser-Based Converters | ${BRAND}`,
    desc: "All 16 Subtitle Toolkit utilities in one place: convert between SRT, VTT, ASS, SBV and TTML, fix timing drift, repair encoding, and run a subtitle QC check. Free, no upload, no signup.",
    canonicalPath: "/tools/",
    body: toolHubBody,
    jsonLd: graphOf(
      webPageNode({
        path: "/tools/",
        title: "Subtitle Tools — 16 Free Browser-Based Converters",
        desc: "All 16 Subtitle Toolkit utilities in one place: convert between SRT, VTT, ASS, SBV and TTML, fix timing drift, repair encoding, and run a subtitle QC check.",
      }),
      breadcrumbNode("/tools/", [
        ["Home", `${SITE}/`],
        ["Tools", `${SITE}/tools/`],
      ]),
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/tools#collection`,
        url: `${SITE}/tools`,
        name: "Subtitle tools",
        isPartOf: { "@id": SITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: TOOLS.length,
          itemListElement: TOOLS.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.h1,
            description: t.tagline,
            url: `${SITE}/tools/${t.slug}`,
          })),
        },
      }
    ),
  })
);

/* 指南索引页 */
const guideHubBody = `<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> \u203a Guides</p>
  <h1 style="font-size:clamp(26px,3.8vw,36px);margin:8px 0 10px;letter-spacing:-.5px">Subtitle guides</h1>
  <p class="lead" style="font-size:17px;color:var(--text-2);margin:0 0 6px">Six long-form references on subtitle formats, timing and delivery. Written for people who have a broken file in front of them and need to know why.</p>
  <article>
    <h2>Start here if\u2026</h2>
    <p>These are troubleshooting references, not tutorials. Each one assumes you already have a file and something is wrong with it. Read the one that matches your symptom.</p>

    <h3>\u2026you do not know which format to use</h3>
    <p><a href="/guides/subtitle-formats">Subtitle formats compared</a> covers what SRT, WebVTT, ASS/SSA, TTML, SBV and the rest actually are, which platforms accept which, and what you lose in each conversion. Read this before converting anything \u2014 it is cheaper than converting twice.</p>

    <h3>\u2026the subtitles are out of sync</h3>
    <p><a href="/guides/fix-subtitles-out-of-sync">Fixing out-of-sync subtitles</a> separates constant offset from progressive drift and tells you which tool fixes which. Getting this wrong is the most common way people waste an hour: shifting a drifting file moves the whole timeline when the problem is the frame rate.</p>

    <h3>\u2026the subtitles will not display at all</h3>
    <p><a href="/guides/subtitles-not-showing">Why subtitles are not showing</a> is a seven-cause checklist \u2014 wrong container, missing track flag, burned-in assumptions, player settings, encoding, path issues and timing that falls outside the video. Work down the list rather than guessing.</p>

    <h3>\u2026you need to check reading speed or compliance</h3>
    <p><a href="/guides/subtitle-reading-speed">Subtitle reading speed</a> explains characters per second, minimum and maximum cue duration, line limits, and where the widely-cited thresholds come from \u2014 including which ones are platform requirements and which are just convention.</p>

    <h3>\u2026you are embedding captions in a web page</h3>
    <p><a href="/guides/add-subtitles-to-html5-video">Adding subtitles to HTML5 video</a> covers the <code>&lt;track&gt;</code> element, the WebVTT requirement, CORS, and the accessibility reasons to use real captions rather than a styled overlay.</p>

    <h3>\u2026you are sending subtitles out for translation</h3>
    <p><a href="/guides/translate-subtitles">Translating subtitles</a> covers the CSV round trip, why line breaks and cue counts must be preserved, and the three checks to run before delivering. Machine translation of a full subtitle file rarely produces something you can ship without this workflow.</p>

    <h2>How the guides relate to the tools</h2>
    <p>The guides explain diagnosis; the <a href="/tools/">tools</a> do the work. Most pages here link to the specific tool they are describing, so you can read the reasoning and apply the fix in one pass. Where a transformation is lossy or irreversible, the guide says so explicitly rather than leaving you to discover it after the fact.</p>

    <h2>What is not covered here</h2>
    <p>There is no guide on creating subtitles from scratch, because that is a transcription problem rather than a file problem \u2014 it needs audio, not a converter. There is also nothing on styling or karaoke effects: those live in ASS/SSA authoring tools, and the approach changes with every release of every editor, so a written guide would go stale faster than it would help.</p>
    <p>What is covered is everything that goes wrong <em>after</em> a file exists and before it ships: wrong format, wrong timing, broken text, unreadable speed, missing captions on the web, and the handoff to a translator. Those six failure modes account for most of the support questions this kind of tooling attracts, and each one has a page.</p>

    <h2>Corrections</h2>
    <p>If something here is wrong, or a platform requirement has changed, tell us through <a href="/contact">the contact page</a>. Subtitle specifications move \u2014 container support, caption styling rules and platform limits are all subject to change, and a guide that quietly goes stale is worse than no guide.</p>
    <p class="updated">Last updated ${UPDATED}.</p>
  </article>
</div>`;

write(
  "guides/index.html",
  layout({
    title: `Subtitle Guides — Formats, Timing, Sync and Delivery | ${BRAND}`,
    desc: "Six troubleshooting guides for subtitle work: format comparison, out-of-sync diagnosis, why captions do not show, reading speed limits, HTML5 video embedding, and the translation workflow.",
    canonicalPath: "/guides/",
    body: guideHubBody,
    jsonLd: graphOf(
      webPageNode({
        path: "/guides/",
        title: "Subtitle Guides — Formats, Timing, Sync and Delivery",
        desc: "Six troubleshooting guides for subtitle work: format comparison, out-of-sync diagnosis, why captions do not show, reading speed limits, HTML5 video embedding, and the translation workflow.",
      }),
      breadcrumbNode("/guides/", [
        ["Home", `${SITE}/`],
        ["Guides", `${SITE}/guides/`],
      ]),
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/guides#collection`,
        url: `${SITE}/guides`,
        name: "Subtitle guides",
        isPartOf: { "@id": SITE_ID },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: GUIDES.length,
          itemListElement: GUIDES.map((g, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: g.h1,
            description: g.desc,
            url: `${SITE}/guides/${g.slug}`,
          })),
        },
      }
    ),
  })
);

/* about */
write(
  "about.html",
  layout({
    title: `About — ${BRAND}`,
    desc: "Who builds Subtitle Toolkit, how the tools work, and why everything runs locally in your browser.",
    canonicalPath: "/about",
    body: `<div class="wrap narrow"><article>
      <h1 style="font-size:30px;margin:26px 0 12px">About Subtitle Toolkit</h1>
      <p>Subtitle Toolkit is a small set of free utilities for people who work with subtitle and caption files: video editors, translators, podcast producers, accessibility specialists and anyone handed a <code>.srt</code> that won’t load.</p>
      <h2>Why it runs in your browser</h2>
      <p>Subtitle files are frequently confidential. An unreleased product demo, a client interview, a medical lecture or a legal deposition can all arrive as a caption file. Uploading those to an unknown server to change a comma into a period is a bad trade.</p>
      <p>Every tool here is plain JavaScript that executes on your own device. There is no upload endpoint, no queue, no storage and no account. You can load a page, disconnect from the internet, and the tool will still work.</p>
      <h2>How the site is funded</h2>
      <p>The tools are free and have no usage limits. The site is supported by advertising, which is why you may see ads on the page. Ads are never placed inside the tool interface, and no subtitle content is ever shared with advertisers — the content never leaves your browser in the first place.</p>
      <h2>Accuracy and limitations</h2>
      <p>These tools perform deterministic text and timestamp transformations. They do not rewrite, translate or “improve” your text, because automated rewriting of captions risks changing meaning. Where a transformation could be lossy — such as discarding WebVTT cue settings when converting to SRT — it is documented on the relevant tool page.</p>
      <h2>Related project</h2>
      <p>For finding the tools that <em>produce</em> these files — transcription, captioning and translation services — see the <a href="https://ai.toolboxes.top/">AI tool directory</a>.</p>
      <p class="updated">Last updated ${UPDATED}.</p>
    </article></div>`,
  })
);

/* privacy */
write(
  "privacy.html",
  layout({
    title: `Privacy Policy — ${BRAND}`,
    desc: "How Subtitle Toolkit handles your data: subtitle files are processed locally and never uploaded. Advertising and analytics disclosures.",
    canonicalPath: "/privacy",
    body: `<div class="wrap narrow"><article>
      <h1 style="font-size:30px;margin:26px 0 12px">Privacy Policy</h1>
      <p class="updated" style="margin-top:0;border:0;padding-top:0">Last updated ${UPDATED}</p>

      <h2>The short version</h2>
      <p>Your subtitle files are processed entirely in your browser. They are never uploaded, transmitted, stored or read by us.</p>

      <h2>Subtitle files</h2>
      <p>When you paste text or choose a file, your browser reads it locally and performs the conversion in memory. No network request carries your subtitle content. We cannot see your files, and there is no server-side copy to delete.</p>

      <h2>Advertising</h2>
      <p>This site is supported by advertising served by Google AdSense. Third parties, including Google, may use cookies, web beacons or IP addresses to serve and measure ads based on your visits to this and other websites. Google’s use of advertising cookies enables it and its partners to serve ads based on your visit to this site and/or other sites on the internet.</p>
      <p>You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Google Ads Settings</a>, or opt out of third-party vendor cookies at <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info</a>. For more information on how Google uses data, see <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">How Google uses information from sites that use our services</a>.</p>

      <h2>Consent in the EEA, UK and Switzerland</h2>
      <p>Where required by law, a consent message is shown before advertising cookies are set, and you can change or withdraw your choice at any time. If you decline personalised advertising, non-personalised ads may still be shown.</p>

      <h2>Analytics</h2>
      <p>We use privacy-respecting, aggregate traffic measurement to understand which tools are useful. This records page views and coarse technical information such as browser type and country. It is not linked to your subtitle content, and it is not used to identify you.</p>

      <h2>Local storage</h2>
      <p>A single preference — your light or dark theme choice — may be saved in your browser’s local storage. It stays on your device and can be cleared at any time through your browser settings.</p>

      <h2>Children</h2>
      <p>This site is not directed at children under 13 and we do not knowingly collect personal information from them.</p>

      <h2>Changes</h2>
      <p>If this policy changes materially, the “last updated” date above will change. Continued use of the site after an update constitutes acceptance of the revised policy.</p>

      <h2>Contact</h2>
      <p>Questions about this policy, or about how this site handles data, can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    </article></div>`,
  })
);

/* contact */
write(
  "contact.html",
  layout({
    title: `Contact — ${BRAND}`,
    desc: "How to reach Subtitle Toolkit: bug reports, format requests and corrections. One address, read by a person, no ticket system.",
    canonicalPath: "/contact",
    body: `<div class="wrap narrow"><article>
      <h1 style="font-size:30px;margin:26px 0 12px">Contact</h1>
      <p>Subtitle Toolkit is maintained by a small team, and there is exactly one way to reach us. No ticket system, no chat widget, no contact form that swallows your message — just an address that a person reads.</p>

      <h2>Email</h2>
      <p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p>We aim to reply within a few working days. If your message is about a specific page, including the URL saves a round trip.</p>

      <h2>What to include in a bug report</h2>
      <p>Most reports we cannot act on are missing the same three things. Including them makes the difference between a fix and a guessing game:</p>
      <ul>
        <li><strong>The exact input.</strong> Paste the few lines of subtitle content that trigger the problem. If the file is confidential, reproduce it with dummy lines that have the same shape — the same format, the same timestamp style, the same punctuation.</li>
        <li><strong>What you expected, and what you got.</strong> “The output is wrong” is hard to act on; “the second cue came out as <code>00:00:04,200</code> but the source said <code>0:00:04.20</code>” is something we can reproduce in a minute.</li>
        <li><strong>Your browser and operating system.</strong> Every tool here runs locally in JavaScript, so behaviour can differ between browsers — particularly around file reading and clipboard access.</li>
      </ul>

      <h2>Requesting a format or a tool</h2>
      <p>Requests for a new subtitle format or a new conversion direction are welcome, and several tools on this site started as one. Two things help: name the format and where you met it (a particular player, broadcaster or platform), and describe what you need to do with the output. A format nobody can export is not worth building a converter for, and knowing the destination tells us what the output has to preserve.</p>

      <h2>Corrections</h2>
      <p>If something on this site is factually wrong — a format claim, a compatibility note, a timestamp rule — please say so. The guides are written to be checked against the specifications, and corrections are taken seriously.</p>

      <h2>What we cannot help with</h2>
      <p>We cannot recover a file you have lost, and we cannot see your files in the first place: every tool here runs entirely in your browser and nothing is uploaded. If a conversion produced a result you did not keep, the original is still on your device, and re-running the conversion takes seconds.</p>
      <p>We also cannot transcribe or translate audio. This site formats subtitle files; it does not listen to them. The <a href="https://ai.toolboxes.top/">AI tool directory</a> lists services that do.</p>

      <h2>Privacy</h2>
      <p>Email you send us is kept only as long as it takes to deal with the matter. It is never added to a mailing list, and it is never shared. See the <a href="/privacy">privacy policy</a> for how the site itself handles data.</p>

      <p class="updated">Last updated ${UPDATED}.</p>
    </article></div>`,
  })
);

/* 404 */
write(
  "404.html",
  layout({
    title: `Page not found — ${BRAND}`,
    desc: "That page isn’t here. Browse the subtitle tools instead.",
    canonicalPath: "/404",
    body: `<div class="wrap narrow" style="text-align:center;padding:60px 20px">
      <h1 style="font-size:56px;margin:0 0 6px">404</h1>
      <p style="font-size:17px;color:var(--text-2);margin:0 0 26px">That page isn’t on our shelves. Try one of these instead:</p>
      <div class="grid" style="text-align:left">
        ${TOOLS.map((t) => `<a class="card" href="/tools/${t.slug}"><h3>${esc(t.h1)}</h3><p>${esc(t.tagline)}</p><div class="go">Open tool →</div></a>`).join("")}
      </div>
      <p style="margin-top:26px"><a href="/">← Back to all tools</a></p>
    </div>`,
  }).replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex, follow">')
    // AdSense policy: no ad code on error pages (no publisher content)
    .replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^"]*"[^>]*><\/script>\n?/, "")
);

/* sitemap */
const urls = [
  { loc: "/", pri: "1.0", freq: "weekly" },
  { loc: "/tools/", pri: "0.9", freq: "weekly" },
  ...TOOLS.map((t) => ({ loc: `/tools/${t.slug}`, pri: "0.9", freq: "monthly" })),
  { loc: "/guides/", pri: "0.8", freq: "weekly" },
  ...GUIDES.map((g) => ({ loc: `/guides/${g.slug}`, pri: "0.8", freq: "monthly" })),
  { loc: "/about", pri: "0.4", freq: "yearly" },
  { loc: "/contact", pri: "0.3", freq: "yearly" },
  { loc: "/privacy", pri: "0.3", freq: "yearly" },
];
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`
);

/* robots */
write(
  "robots.txt",
  `# robots.txt for Subtitle Toolkit (${SITE}/)

User-agent: *
Allow: /

# Allow major AI crawlers (GEO)
${["GPTBot", "OAI-SearchBot", "ChatGPT-User", "Claude-Web", "ClaudeBot", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "GoogleOther", "Applebot-Extended", "CCBot", "cohere-ai", "DuckAssistBot", "Meta-ExternalAgent", "MistralAI-User"].map((b) => `User-agent: ${b}\nAllow: /`).join("\n")}

Sitemap: ${SITE}/sitemap.xml

# LLM-friendly index (llmstxt.org)
`
);

/* llms.txt */
write(
  "llms.txt",
  `# ${BRAND}

> Free subtitle and caption utilities that run entirely in the browser. Subtitle files are never uploaded — all processing is client-side JavaScript.

Site: ${SITE}/
Last updated: ${UPDATED}

## Tools

${TOOLS.map((t) => `- [${t.h1}](${SITE}/tools/${t.slug}): ${t.tagline}`).join("\n")}

## Key facts

- Supported formats: SubRip (.srt), WebVTT (.vtt), and .sbv-style arrow syntax.
- No account, no usage quota, no watermark, no file size limit.
- Processing is 100% client-side; subtitle content is never transmitted.
- Output format follows the input format unless an explicit conversion is chosen.

## Related

- [AI tool directory](${SITE.replace("toolboxes.top", "ai.toolboxes.top")}/): a directory of AI tools, including transcription and captioning services.
`
);

/* ads.txt */
write("ads.txt", `google.com, pub-9901133369141996, DIRECT, f08c47fec0942fa0\n`);

/* _redirects —— toolboxes.top 从「AI 工具目录」改为「字幕工具站」，
   旧的目录路径 301 到 ai.toolboxes.top，保住已有外链与书签。
   注意：不要重定向 /llms.txt —— 工具站有自己的 llms.txt，重定向会把它挡住。 */
write(
  "_redirects",
  `# toolboxes.top 已改为字幕工具站；旧目录路径永久跳转到 ai.toolboxes.top
/tool/*         https://ai.toolboxes.top/tool/:splat        301
/departments/*  https://ai.toolboxes.top/departments/:splat 301
`
);

/* _headers */
write(
  "_headers",
  `/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/css/*
  Cache-Control: public, max-age=604800

/js/*
  Cache-Control: public, max-age=604800

/*.txt
  Cache-Control: public, max-age=3600

/*.xml
  Cache-Control: public, max-age=3600
`
);

/* ---------- 报告 ---------- */
let n = 0;
(function walk(p) {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(p, e.name));
    else n++;
  }
})(OUT);

console.log(`toolsite 已生成 → toolsite/  (${n} 文件, ${TOOLS.length} 个工具)`);
console.log(`canonical 自指: ${SITE}`);
for (const t of TOOLS) console.log(`  /tools/${t.slug}`);
