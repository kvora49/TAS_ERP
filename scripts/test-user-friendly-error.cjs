const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const file = `${process.cwd()}/src/lib/user-friendly-error.ts`;
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = new Module(file, module);
loaded._compile(output, file);
const { getUserFacingError, getUserFriendlyErrorMessage, readApiJson } = loaded.exports;

(async () => {
  assert.match(getUserFriendlyErrorMessage(new TypeError('Failed to fetch')), /internet connection/i);
  assert.match(getUserFriendlyErrorMessage('duplicate key value violates unique constraint'), /already exists/i);
  assert.match(getUserFriendlyErrorMessage('permission denied for table'), /role does not allow/i);
  assert.match(getUserFriendlyErrorMessage('The string did not match the expected pattern.'), /invalid response/i);
  assert.deepEqual(getUserFacingError('Insufficient meters in roll A. Available: 2, Requested: 5'), {
    title: 'Not enough stock',
    description: 'Insufficient meters in roll A. Available: 2, Requested: 5 Adjust the quantity or select available stock, then try again.',
  });
  assert.match(getUserFriendlyErrorMessage('HTTP 400'), /missing or invalid/i);
  assert.match(getUserFriendlyErrorMessage('Insufficient stock for item "Fabric"'), /Insufficient stock.*Adjust the quantity/);
  await assert.rejects(readApiJson(Response.json({ error: 'duplicate key value violates unique constraint' }, { status: 409 }), 'Unable to save'), /already exists/i);
  await assert.rejects(readApiJson(Response.json({ error: { fieldErrors: { name: ['Required'] } } }, { status: 400 }), 'Unable to save'), /missing or invalid/i);
  await assert.rejects(readApiJson(new Response('<html>bad gateway</html>', { status: 502 }), 'Unable to save'), /server couldn't complete/i);
  assert.deepEqual(await readApiJson(Response.json({ data: { id: '1' } }), 'Unable to load'), { data: { id: '1' } });
  console.log('PASS user-friendly errors: network, database, permissions, malformed responses, and app validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
