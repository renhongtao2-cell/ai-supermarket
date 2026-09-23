// 字幕 MCP server — 断言测试
// 运行: node mcp-subtitle/test.mjs
import worker from './worker.js';

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  :: ' + extra : '')); }
};
const section = s => console.log('\n--- ' + s + ' ---');

async function rpc(msg) {
  const r = await worker.fetch(new Request('https://x/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(msg),
  }), {});
  return { status: r.status, body: await r.json() };
}
async function call(name, args) {
  const { body } = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const res = body.result || {};
  return { text: res.content?.[0]?.text ?? '', isError: !!res.isError, structured: res.structuredContent };
}

// ---------- 样例数据 ----------
const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,000
Second line
`;

const VTT = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello world

2
00:00:05.500 --> 00:00:08.000
Second line
`;

const ASS = `[Script Info]
Title: Test
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,64

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello world
Dialogue: 0,0:00:05.50,0:00:08.00,Default,,0,0,0,,Second, with comma
`;

const SBV = `0:00:01.000,0:00:04.000
Hello world

0:00:05.500,0:00:08.000
Second line
`;

const TTML = `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" ttp:frameRate="30">
<body><div>
<p begin="00:00:01.000" end="00:00:04.000">Hello world</p>
<p begin="5s" dur="3s">Second line</p>
</div></body></tt>
`;

const NOISY = `1
00:00:01,000 --> 00:00:03,000
[Music] <i>Hello</i> world

2
00:00:03,000 --> 00:00:05,000
♪ la la la ♪

3
00:00:05,000 --> 00:00:07,000
Hello world
`;

const MOJIBAKE = '1\n00:00:01,000 --> 00:00:04,000\nCaf\u00c3\u00a9 na\u00c3\u00afve \u00e2\u20ac\u2122 quote\n';

// ---------- 协议层 ----------
section('MCP protocol');
{
  const { body } = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  check('initialize → serverInfo.name', body.result?.serverInfo?.name === 'subtitle-toolkit', JSON.stringify(body.result?.serverInfo));
  check('initialize → has instructions', typeof body.result?.instructions === 'string' && body.result.instructions.length > 100);
  check('initialize → protocolVersion', body.result?.protocolVersion === '2025-06-18');

  const { body: tl } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = (tl.result?.tools || []).map(t => t.name);
  check('tools/list → 8 tools', names.length === 8, names.join(','));
  for (const n of ['convert_subtitle', 'clean_subtitles', 'retime_subtitles', 'check_subtitle_timing', 'merge_subtitles', 'split_subtitles', 'fix_subtitle_encoding', 'text_to_subtitles']) {
    check('tools/list includes ' + n, names.includes(n));
  }
  check('every tool has inputSchema', (tl.result?.tools || []).every(t => t.inputSchema && t.inputSchema.type === 'object'));

  const { body: rl } = await rpc({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  check('resources/list → 1 resource', (rl.result?.resources || []).length === 1);

  const { body: rr } = await rpc({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'subtitle://formats' } });
  check('resources/read → markdown table', (rr.result?.contents?.[0]?.text || '').includes('ASS / SSA'));

  const { body: unk } = await rpc({ jsonrpc: '2.0', id: 5, method: 'nope' });
  check('unknown method → -32601', unk.error?.code === -32601);

  const { body: bad } = await rpc({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: {} });
  check('tools/call without name → -32602', bad.error?.code === -32602);

  const r = await worker.fetch(new Request('https://x/health'), {});
  const h = await r.json();
  check('GET /health → ok', r.status === 200 && h.ok === true && h.tools === 8);
  const r2 = await worker.fetch(new Request('https://x/nope'), {});
  check('GET /nope → 404', r2.status === 404);
  const r3 = await worker.fetch(new Request('https://x/', { method: 'DELETE' }), {});
  check('DELETE / → 405', r3.status === 405);
}

// ---------- 格式转换 ----------
section('convert_subtitle');
{
  const a = await call('convert_subtitle', { content: SRT, to: 'vtt' });
  check('srt→vtt has WEBVTT header', a.text.includes('WEBVTT'));
  check('srt→vtt uses dot separator', a.text.includes('00:00:01.000 --> 00:00:04.000'));
  check('srt→vtt keeps text', a.text.includes('Hello world'));

  const b = await call('convert_subtitle', { content: VTT, to: 'srt' });
  check('vtt→srt uses comma separator', b.text.includes('00:00:01,000 --> 00:00:04,000'));
  check('vtt→srt drops WEBVTT header', !b.text.includes('WEBVTT'));
  check('vtt→srt keeps cue count', (b.text.match(/-->/g) || []).length === 2);

  const c = await call('convert_subtitle', { content: ASS, to: 'srt' });
  check('ass→srt 2 cues', (c.text.match(/-->/g) || []).length === 2, c.text.slice(0, 200));
  check('ass→srt preserves comma inside text', c.text.includes('Second, with comma'));
  check('ass→srt centiseconds → ms', c.text.includes('00:00:01,000'));

  const d = await call('convert_subtitle', { content: SBV, to: 'srt' });
  check('sbv→srt 2 cues', (d.text.match(/-->/g) || []).length === 2, d.text.slice(0, 200));

  const e = await call('convert_subtitle', { content: TTML, to: 'srt' });
  check('ttml→srt 2 cues', (e.text.match(/-->/g) || []).length === 2, e.text.slice(0, 300));
  check('ttml→srt offset "5s" parsed', e.text.includes('00:00:05,000'));

  const f = await call('convert_subtitle', { content: SRT, to: 'csv' });
  check('srt→csv header', f.text.startsWith('index,start,end,duration_ms,text'));
  check('srt→csv row count', f.text.trim().split('\n').length === 3);

  const g = await call('convert_subtitle', { content: SRT, to: 'text' });
  check('srt→text one line per cue', g.text.trim().split('\n').length === 2);

  const h = await call('convert_subtitle', { content: SRT, to: 'ass' });
  check('srt→ass has [Events]', h.text.includes('[Events]'));
  check('srt→ass has Dialogue lines', (h.text.match(/^Dialogue:/gm) || []).length === 2);
  check('srt→ass uses centiseconds', h.text.includes('0:00:01.00'));

  const i = await call('convert_subtitle', { content: SRT, to: 'xml' });
  check('invalid "to" → error', i.isError === true);

  const j = await call('convert_subtitle', { content: 'not a subtitle at all', to: 'srt' });
  check('unparseable input → error', j.isError === true);

  const k = await call('convert_subtitle', { to: 'srt' });
  check('missing content → error', k.isError === true);
}

// ---------- 清洗 ----------
section('clean_subtitles');
{
  const a = await call('clean_subtitles', { content: NOISY });
  check('drops ♪ music cue', !a.text.includes('la la la'));
  check('drops [Music] marker', !a.text.includes('[Music]'));
  check('strips <i> tag', !a.text.includes('<i>'));
  check('keeps real text', a.text.includes('Hello world'));
  check('output is pure SRT (no preamble)', a.text.trim().startsWith('1\n'), JSON.stringify(a.text.slice(0, 60)));

  const b = await call('clean_subtitles', { content: NOISY, drop_duplicates: true });
  check('drop_duplicates removes the repeat', (b.text.match(/Hello world/g) || []).length === 1, b.text);

  const c = await call('clean_subtitles', { content: NOISY, to: 'vtt' });
  check('clean → vtt output', c.text.includes('WEBVTT'));
}

// ---------- 时间轴 ----------
section('retime_subtitles');
{
  const a = await call('retime_subtitles', { content: SRT, offset_seconds: 2 });
  check('offset +2s', a.text.includes('00:00:03,000 --> 00:00:06,000'), a.text.slice(0, 200));

  const b = await call('retime_subtitles', { content: SRT, offset_seconds: -5 });
  check('negative offset clamps to 0', b.text.includes('00:00:00,000'));

  const c = await call('retime_subtitles', { content: SRT, ratio: 2 });
  check('ratio 2 doubles', c.text.includes('00:00:02,000 --> 00:00:08,000'), c.text.slice(0, 200));

  const d = await call('retime_subtitles', { content: SRT, from_fps: 25, to_fps: 23.976 });
  check('fps 25→23.976 lengthens', d.text.includes('00:00:01,043'), d.text.slice(0, 200));

  const e = await call('retime_subtitles', { content: SRT });
  check('no timing mode → error', e.isError === true);

  const f = await call('retime_subtitles', { content: SRT, offset_seconds: 1, ratio: 2 });
  check('two modes at once → error', f.isError === true);
}

// ---------- 节奏检查 ----------
section('check_subtitle_timing');
{
  const a = await call('check_subtitle_timing', { content: SRT });
  check('report has header', a.text.includes('Subtitle timing report'));
  check('report counts cues', a.text.includes('2 cues checked'));

  const fast = '1\n00:00:01,000 --> 00:00:01,500\n' + 'x'.repeat(120) + '\n';
  const b = await call('check_subtitle_timing', { content: fast });
  check('flags too-fast cue', /Too fast/.test(b.text));
  check('flags the offending cue by number', /#0001/.test(b.text));

  const c = await call('check_subtitle_timing', { content: 'garbage' });
  check('no cues → error', c.isError === true);
}

// ---------- 合并 / 切分 ----------
section('merge_subtitles / split_subtitles');
{
  const a = await call('merge_subtitles', { content: SRT, append_content: SRT });
  check('merge → 4 cues', (a.text.match(/-->/g) || []).length === 4, a.text.slice(0, 300));
  check('second track starts after first (8s + 1s)', a.text.includes('00:00:09,000'), a.text.slice(0, 400));

  const b = await call('merge_subtitles', { content: SRT, append_content: SRT, gap_seconds: 2 });
  check('merge gap adds 2s', b.text.includes('00:00:11,000'));

  const c = await call('split_subtitles', { content: SRT, at: '3', part: 'a' });
  check('split part a → 1 cue', (c.text.match(/-->/g) || []).length === 1);
  check('split output is pure SRT', c.text.trim().startsWith('1\n'));

  const d = await call('split_subtitles', { content: SRT, at: '3', part: 'b' });
  check('split part b → 1 cue, keeps original timecode', (d.text.match(/-->/g) || []).length === 1 && d.text.includes('00:00:05,500'));

  const e = await call('split_subtitles', { content: SRT, at: '00:01:00', part: 'b' });
  check('split with empty half → error', e.isError === true);
  check('empty-half error explains both parts', /part 1: 2 cue\(s\), part 2: 0 cue\(s\)/.test(e.text), e.text);

  const f = await call('split_subtitles', { content: SRT, at: 'zzz' });
  check('unparseable split point → error', f.isError === true);
}

// ---------- 乱码修复 ----------
section('fix_subtitle_encoding');
{
  const a = await call('fix_subtitle_encoding', { content: MOJIBAKE });
  check('repairs é', a.text.includes('Café'), a.text.slice(0, 200));
  check('repairs ï', a.text.includes('naïve'));
  check('repairs curly apostrophe', a.text.includes('\u2019'));
  check('content is pure (diagnostics moved out)', a.text.trim().startsWith('1\n'), JSON.stringify(a.text.slice(0, 60)));
  check('diagnostics in structuredContent', a.structured?.changed === true && a.structured?.passes === 1, JSON.stringify(a.structured));

  const b = await call('fix_subtitle_encoding', { content: SRT });
  check('clean input → no repair needed', b.structured?.changed === false && /already decodes cleanly/.test(b.structured?.note || ''));
  check('clean input left untouched', b.text === SRT);
}

// ---------- 文本转字幕 ----------
section('text_to_subtitles');
{
  const a = await call('text_to_subtitles', { content: 'One\nTwo\nThree' });
  check('3 lines → 3 cues', (a.text.match(/-->/g) || []).length === 3);
  check('default 2.5s duration', a.text.includes('00:00:00,000 --> 00:00:02,500'));
  check('second cue starts at 2.5s', a.text.includes('00:00:02,500 --> 00:00:05,000'));
  check('output is pure SRT', a.text.trim().startsWith('1\n'));

  const b = await call('text_to_subtitles', { content: 'One\nTwo', start_seconds: 10, duration_seconds: 1 });
  check('start_seconds honoured', b.text.includes('00:00:10,000 --> 00:00:11,000'));

  const c = await call('text_to_subtitles', { content: 'aaa bbb ccc ddd eee fff ggg hhh', max_chars_per_cue: 12 });
  check('max_chars_per_cue splits at word boundary', (c.text.match(/-->/g) || []).length > 1);

  const d = await call('text_to_subtitles', { content: '\n\n' });
  check('empty content → error', d.isError === true);
}

// ---------- 输出纯净性 ----------
// 工具返回的内容会被直接使用（复制进文件、喂给下游程序），
// 任何前置说明都会污染结果 —— 这条对所有返回字幕的工具成立。
section('output purity');
{
  const cases = [
    ['convert_subtitle', { content: SRT, to: 'vtt' }, 'WEBVTT'],
    ['convert_subtitle', { content: SRT, to: 'csv' }, 'index,start,end'],
    ['convert_subtitle', { content: SRT, to: 'ass' }, '[Script Info]'],
    ['convert_subtitle', { content: SRT, to: 'text' }, 'Hello world'],
    ['clean_subtitles', { content: NOISY }, '1\n'],
    ['retime_subtitles', { content: SRT, offset_seconds: 1 }, '1\n'],
    ['merge_subtitles', { content: SRT, append_content: SRT }, '1\n'],
    ['split_subtitles', { content: SRT, at: '3' }, '1\n'],
    ['text_to_subtitles', { content: 'One\nTwo' }, '1\n'],
  ];
  for (const [name, args, mustStart] of cases) {
    const r = await call(name, args);
    check(`${name} (${JSON.stringify(args.to || args.offset_seconds || '')}) payload-first`,
      r.text.trimStart().startsWith(mustStart), JSON.stringify(r.text.slice(0, 60)));
  }
}

console.log(`\n${'='.repeat(46)}\n${pass} passed, ${fail} failed\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
