// test.mjs — MCP 服务端到端自测（打本地 wrangler dev 或线上）
// 用法: node mcp/test.mjs [baseUrl]   默认 http://127.0.0.1:8791
const BASE = (process.argv[2] || 'http://127.0.0.1:8791').replace(/\/$/, '');
const URL_ = BASE + '/mcp';
let id = 0, pass = 0, fail = 0;

async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body, ct };
}

function check(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}` + (detail ? `\n     ${String(detail).slice(0, 220)}` : '')); }
}

const t0 = Date.now();
console.log(`测试目标: ${URL_}\n`);

// 1. initialize
console.log('1) initialize');
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } });
check('返回 200', init.status === 200, init.status);
check('有 protocolVersion', !!init.body?.result?.protocolVersion, JSON.stringify(init.body).slice(0, 150));
check('声明 tools 能力', !!init.body?.result?.capabilities?.tools);
check('有 instructions', typeof init.body?.result?.instructions === 'string');
check('serverInfo.name 正确', init.body?.result?.serverInfo?.name === 'ai-tools-directory');

// 2. notifications/initialized → 应 202 无 body
console.log('\n2) notifications/initialized');
const note = await rpc('notifications/initialized');
check('返回 202', note.status === 202, note.status);

// 3. ping
console.log('\n3) ping');
const ping = await rpc('ping');
check('返回 result', ping.body?.result !== undefined, JSON.stringify(ping.body).slice(0, 120));

// 4. tools/list
console.log('\n4) tools/list');
const tl = await rpc('tools/list');
const tools = tl.body?.result?.tools || [];
check(`列出 ${tools.length} 个工具`, tools.length === 5, tools.length);
check('每个工具都有 inputSchema', tools.every(t => t.inputSchema && t.inputSchema.type === 'object'));
const names = tools.map(t => t.name);
check('包含 search_ai_tools', names.includes('search_ai_tools'));
check('包含 find_free_ai_tools', names.includes('find_free_ai_tools'));

async function call(name, args) {
  const r = await rpc('tools/call', { name, arguments: args });
  const txt = r.body?.result?.content?.[0]?.text || '';
  return { status: r.status, txt, raw: r.body, isError: r.body?.result?.isError };
}

// 5. search_ai_tools
console.log('\n5) tools/call search_ai_tools');
const s1 = await call('search_ai_tools', { query: 'video', limit: 5 });
check('返回内容', s1.txt.length > 50, s1.txt.slice(0, 120));
check('报告匹配数', /Found \d+ matching/.test(s1.txt), s1.txt.slice(0, 120));

const s2 = await call('search_ai_tools', { department: 'finance', limit: 5 });
check('按部门过滤可用', /Found \d+ matching/.test(s2.txt), s2.txt.slice(0, 120));

const s3 = await call('search_ai_tools', { query: 'zzzzzznonexistent' });
check('无结果时给引导而非报错', /No tools matched/.test(s3.txt), s3.txt.slice(0, 150));
check('无结果不算 isError', s3.isError !== true);

// 6. get_ai_tool
console.log('\n6) tools/call get_ai_tool');
const g1 = await call('get_ai_tool', { name: 'ChatGPT' });
check('精确命中 ChatGPT', /ChatGPT/.test(g1.txt), g1.txt.slice(0, 120));
check('给出 URL', /https?:\/\//.test(g1.txt));

const g2 = await call('get_ai_tool', { name: 'jasper' });
check('大小写不敏感命中', /Jasper/i.test(g2.txt), g2.txt.slice(0, 120));

const g3 = await call('get_ai_tool', { name: 'notarealtool123' });
check('未命中时给相近建议', /No tool named/.test(g3.txt), g3.txt.slice(0, 150));

// 7. list_departments
console.log('\n7) tools/call list_departments');
const d1 = await call('list_departments', {});
check('列出 21 个部门', /21 departments/.test(d1.txt), d1.txt.slice(0, 100));
check('含部门 id', /\*\*marketing\*\*/.test(d1.txt), d1.txt.slice(0, 300));

// 8. find_free_ai_tools
console.log('\n8) tools/call find_free_ai_tools');
const f1 = await call('find_free_ai_tools', { has_free_plan: true, limit: 5 });
check('返回免费工具', /Found \d+ matching/.test(f1.txt), f1.txt.slice(0, 120));
check('带未验证免责声明', /NOT human-verified|unverified/i.test(f1.txt), f1.txt.slice(-200));

const f2 = await call('find_free_ai_tools', { requires_no_credit_card: true, limit: 5 });
check('不绑卡过滤可用', /Found \d+ matching|No tools matched/.test(f2.txt), f2.txt.slice(0, 150));

// 9. directory_stats
console.log('\n9) tools/call directory_stats');
const st = await call('directory_stats', {});
check('报告工具总数', /Tools: 221/.test(st.txt), st.txt.slice(0, 200));
check('报告免费额度事实数', /free-tier facts: \d+ of 221/.test(st.txt), st.txt.slice(0, 300));

// 10. resources
console.log('\n10) resources/list + read');
const rl = await rpc('resources/list');
const res = rl.body?.result?.resources || [];
check(`列出 ${res.length} 个资源`, res.length === 3, res.length);

const rr = await rpc('resources/read', { uri: 'aitools://directory' });
const body = rr.body?.result?.contents?.[0]?.text || '';
let parsed = null; try { parsed = JSON.parse(body); } catch {}
check('directory 资源可读且是合法 JSON', !!parsed, body.slice(0, 120));
check('含 221 个工具', parsed?.tools?.length === 221, parsed?.tools?.length);

const rrBad = await rpc('resources/read', { uri: 'aitools://nope' });
check('未知资源返回错误', !!rrBad.body?.error, JSON.stringify(rrBad.body).slice(0, 150));

// 11. 错误处理
console.log('\n11) 错误处理');
const bad = await rpc('nonexistent/method');
check('未知方法返回 -32601', bad.body?.error?.code === -32601, JSON.stringify(bad.body).slice(0, 150));

const noName = await rpc('tools/call', { arguments: {} });
check('缺 name 返回 -32602', noName.body?.error?.code === -32602, JSON.stringify(noName.body).slice(0, 150));

const badTool = await call('no_such_tool', {});
check('未知工具返回 isError', badTool.isError === true, JSON.stringify(badTool.raw).slice(0, 150));

const malformed = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
check('非法 JSON 返回 400', malformed.status === 400, malformed.status);

const getRoot = await fetch(BASE + '/');
check('GET / 返回落地页', (await getRoot.text()).includes('AI Tools Directory'));

console.log(`\n${'─'.repeat(46)}`);
console.log(`通过 ${pass} / 失败 ${fail} ｜ 耗时 ${Date.now() - t0}ms`);
process.exit(fail ? 1 : 0);
