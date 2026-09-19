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
      } else if (mode === "resync") {
        var r = ratio ? parseFloat(ratio.value) : NaN;
        if (isNaN(r) || r <= 0) r = 1;
        cues = resyncCues(text, r);
        res = cues.length ? serialize(cues, vtt) : "";
      } else if (mode === "sbv-to-srt") {
        var sc = sbvCues(text);
        res = sc.length ? serialize(sc, false) : "";
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
    var preset = $("preset");
    if (preset && ratio) preset.addEventListener("change", function () {
      ratio.value = preset.value;
      run();
    });
    if (ratio) ratio.addEventListener("input", function () {
      if (preset) preset.value = "1";
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
