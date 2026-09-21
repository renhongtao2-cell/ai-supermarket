/* Subtitle Toolkit — client-side core. No network calls. */
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
