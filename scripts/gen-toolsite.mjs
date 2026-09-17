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
const UPDATED = "2026-09-17";
const ADSENSE_CLIENT = "ca-pub-9901133369141996";

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
    related: ["remove-timestamps", "shift-subtitles", "srt-to-vtt"],
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
    related: ["srt-to-vtt", "vtt-to-srt", "clean-subtitles"],
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
    var offset = $("offset"), offsetMs = $("offset-ms"), status = $("status");

    function readOpt(k, dflt) {
      var el = opts[k];
      if (!el) return dflt;
      return el.checked;
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
      }
      output.value = res;
      if (status) {
        var n = parseCues(text).length;
        status.textContent = n
          ? n + " cue" + (n === 1 ? "" : "s") + " processed"
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
      cleanCues: cleanCues, shiftCues: shiftCues, serialize: serialize, looksVtt: looksVtt
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

const nav = () => TOOLS.map((t) => `<a href="/tools/${t.slug}">${esc(t.h1.replace(/ Converter| from Subtitles| Timing| Up AI-Generated Subtitles| from AI-Generated Subtitles/, ""))}</a>`).join("");

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
        <ul>${TOOLS.map((t) => `<li><a href="/tools/${t.slug}">${esc(t.h1)}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h5>Guides</h5>
        <ul>${GUIDES.map((g) => `<li><a href="/guides/${g.slug}">${esc(g.h1)}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h5>Site</h5>
        <ul>
          <li><a href="/about">About</a></li>
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
  const isText = t.slug === "remove-timestamps";
  const outName = isText ? "transcript.txt" : t.slug === "srt-to-vtt" ? "output.vtt" : t.slug === "vtt-to-srt" ? "output.srt" : "output.srt";
  const outLabel = isText ? "Plain text" : t.slug === "srt-to-vtt" ? "WebVTT output" : "SRT output";

  return `
<div class="wrap narrow">
  <p class="crumb"><a href="/">Home</a> › <a href="/#tools">Tools</a> › ${esc(t.h1)}</p>
  <h1 style="font-size:clamp(25px,3.6vw,34px);margin:8px 0 10px;letter-spacing:-.5px">${esc(t.h1)}</h1>
  <p class="lead" style="font-size:17px;color:var(--text-2);margin:0 0 6px">${esc(t.tagline)}</p>

  <div class="tool">
    <div id="drop">
      Drop a subtitle file here, or
      <input type="file" id="file" accept=".srt,.vtt,.sbv,.txt,text/plain">
    </div>
    <div class="panes">
      <div class="pane">
        <label for="in">Input — .srt / .vtt</label>
        <textarea id="in" spellcheck="false" placeholder="1
00:00:01,000 --> 00:00:04,000
Paste your subtitle file here…"></textarea>
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

function toolJsonLd(t) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: t.h1,
      url: `${SITE}/tools/${t.slug}`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (web browser)",
      description: t.metaDesc,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: t.steps.map((s) => s.replace(/<[^>]*>/g, "")),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]*>/g, "") },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: t.h1, item: `${SITE}/tools/${t.slug}` },
      ],
    },
  ];
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
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BRAND,
        url: SITE + "/",
        description: "Free browser-based subtitle and caption utilities.",
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: TOOLS.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.h1,
          url: `${SITE}/tools/${t.slug}`,
        })),
      },
    ],
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
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: g.h1,
          description: g.desc,
          url: `${SITE}/guides/${g.slug}`,
          inLanguage: "en",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
            { "@type": "ListItem", position: 2, name: g.h1, item: `${SITE}/guides/${g.slug}` },
          ],
        },
      ],
    })
  );
}

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
      <p>Questions about this policy can be raised through the <a href="https://ai.toolboxes.top/about">contact details on the related AI tool directory</a>.</p>
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
  ...TOOLS.map((t) => ({ loc: `/tools/${t.slug}`, pri: "0.9", freq: "monthly" })),
  ...GUIDES.map((g) => ({ loc: `/guides/${g.slug}`, pri: "0.8", freq: "monthly" })),
  { loc: "/about", pri: "0.4", freq: "yearly" },
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
