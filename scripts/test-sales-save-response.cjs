const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const userErrorFile = `${process.cwd()}/src/lib/user-friendly-error.ts`;
const userErrorOutput = ts.transpileModule(fs.readFileSync(userErrorFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const userErrorModule = new Module(userErrorFile, module);
userErrorModule._compile(userErrorOutput, userErrorFile);
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/user-friendly-error') return userErrorModule.exports;
  return originalLoad.call(this, request, parent, isMain);
};
const file = `${process.cwd()}/src/lib/sales-save-response.ts`;
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(file, module);
loaded._compile(compiled, file);
Module._load = originalLoad;
const { readSalesSaveResponse } = loaded.exports;
const json = (data, status = 200) => Response.json(data, { status });

(async () => {
  for (const data of [{ data: { id: 'bill-1' } }, { bill: { id: 'bill-1' } }, { id: 'bill-1' }]) {
    assert.deepEqual(await readSalesSaveResponse(json(data), true), data);
  }
  assert.deepEqual(await readSalesSaveResponse(json({ success: true }), false), { success: true });
  await assert.rejects(readSalesSaveResponse(json({ error: 'Insufficient stock' }, 400), true), /Insufficient stock/);
  for (const status of [200, 500, 502, 504]) {
    await assert.rejects(readSalesSaveResponse(new Response('<html>Error</html>', { status }), true), /Check the sales bill list/);
  }
  for (const data of [null, {}, [], { success: true }]) {
    await assert.rejects(readSalesSaveResponse(json(data), true), /Unable to confirm/);
  }
  for (const [status, message] of [[401, /session has expired/], [413, /too large/], [429, /Too many requests/]]) {
    await assert.rejects(readSalesSaveResponse(new Response('', { status }), true), message);
  }
  // Simulate the Safari exception instead of depending on Node's parse wording.
  await assert.rejects(readSalesSaveResponse({ status: 502, json: async () => {
    throw new SyntaxError('The string did not match the expected pattern.');
  } }, true), /HTTP 502/);
  await assert.rejects(readSalesSaveResponse(json({ success: false }), false), /Failed to save/);
  console.log('PASS sales save responses: success, API errors, HTML, empty/malformed responses, Safari parsing error, and HTTP guidance');
})().catch(error => { console.error(error); process.exitCode = 1; });
