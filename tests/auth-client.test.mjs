import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/auth-client.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { authClient } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('session requests distinguish success, HTTP errors, and network errors', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const session = { user: { id: '1' }, expires_at: 123 };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ session }) });
  assert.deepEqual(await authClient.getSession(), { data: { session }, error: null });

  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { message: 'Database unavailable' } }) });
  assert.deepEqual(await authClient.getSession(), { data: null, error: { message: 'Database unavailable' } });

  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  assert.deepEqual(await authClient.getSession(), { data: null, error: { message: 'Network unavailable' } });
});

test('initial session listener reports request errors and delivers a null session', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logged = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  console.error = (...args) => logged.push(args);

  const result = await new Promise((resolve) => authClient.onAuthStateChange((event, session) => resolve({ event, session })));
  assert.deepEqual(result, { event: 'INITIAL_SESSION', session: null });
  assert.deepEqual(logged, [['Failed to retrieve initial session:', 'Network unavailable']]);
});

test('initial session listener respects unsubscribe before the request completes', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let resolveFetch;
  globalThis.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
  let called = false;
  const { data: { subscription } } = authClient.onAuthStateChange(() => { called = true; });
  subscription.unsubscribe();
  resolveFetch({ ok: true, json: async () => ({ session: null }) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(called, false);
});

test('initial session listener delivers the retrieved session', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const session = { user: { id: '1' }, expires_at: 123 };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ session }) });
  const result = await new Promise((resolve) => authClient.onAuthStateChange((event, value) => resolve({ event, session: value })));
  assert.deepEqual(result, { event: 'INITIAL_SESSION', session });
});

test('initial session listener delivers a null session for a signed-out user', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ session: null }) });
  const result = await new Promise((resolve) => authClient.onAuthStateChange((event, session) => resolve({ event, session })));
  assert.deepEqual(result, { event: 'INITIAL_SESSION', session: null });
});
