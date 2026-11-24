import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/api/admin/fee-management/invoices/amount/route.ts', import.meta.url), 'utf8');
const paymentsSource = await readFile(new URL('../src/app/api/admin/fee-management/payments-data/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const require = createRequire(import.meta.url);
const makeHandler = (pool, authorized = true) => {
  const exports = {};
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    '@/lib/mysql': { getMysqlPool: () => pool },
    '@/lib/server-auth': {
      requireAdmin: async () => authorized
        ? { user: { id: 'admin' }, response: null }
        : { user: null, response: { status: 401 } },
    },
  };
  new Function('exports', 'require', compiled)(exports, (name) => modules[name] ?? require(name));
  return (body) => exports.PATCH({ json: async () => body });
};

test('validates input and requires an administrator before changing amounts', async () => {
  let calls = 0;
  const pool = { execute: async () => { calls++; return [{ affectedRows: 1 }]; } };
  const patch = makeHandler(pool);
  for (const amount of ['', '-1', '1.999', '1e3', '10000000000', null, 2]) {
    assert.equal((await patch({ invoiceId: 'inv', amount })).status, 400);
  }
  assert.equal((await patch({ invoiceId: '', amount: '10' })).status, 400);
  assert.equal((await makeHandler(pool, false)({ invoiceId: 'inv', amount: '10' })).status, 401);
  assert.equal(calls, 0);
  assert.equal((await patch({ invoiceId: 'inv', amount: '10.50' })).status, 200);
  assert.equal(calls, 1);
});

test('reports an invoice that is no longer eligible', async () => {
  const patch = makeHandler({ execute: async () => [{ affectedRows: 0 }] });
  assert.equal((await patch({ invoiceId: 'inv', amount: '10' })).status, 409);
});

test('updates only unpaid invoices and preserves paid and void invoices in MySQL', {
  skip: process.env.RUN_MYSQL_INTEGRATION !== '1',
}, async () => {
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    timezone: 'Z',
  });
  try {
    await connection.query('CREATE TEMPORARY TABLE incubation_fee_invoices (id VARCHAR(40) PRIMARY KEY, company_id VARCHAR(40), amount DECIMAL(12,2), amount_paid DECIMAL(12,2), status VARCHAR(30), due_date DATE)');
    await connection.query('CREATE TEMPORARY TABLE incubation_fee_settings (company_id VARCHAR(40), grace_period_days INT)');
    await connection.query('CREATE TEMPORARY TABLE fee_collections (invoice_id VARCHAR(40), status VARCHAR(30))');
    await connection.query("INSERT INTO incubation_fee_settings VALUES ('company', 5)");
    await connection.query(`INSERT INTO incubation_fee_invoices VALUES
      ('pending', 'company', 100, 0, 'pending', '2999-01-01'),
      ('overdue', 'company', 100, 0, 'overdue', '2000-01-01'),
      ('partial', 'company', 100, 20, 'partially_paid', '2999-01-01'),
      ('paid', 'company', 100, 100, 'paid', '2999-01-01'),
      ('void', 'company', 100, 0, 'void', '2999-01-01'),
      ('collection', 'company', 100, 0, 'pending', '2999-01-01'),
      ('zero', 'company', 100, 0, 'pending', '2999-01-01')`);
    await connection.query("INSERT INTO fee_collections VALUES ('collection', 'recorded')");
    const patch = makeHandler(connection);
    for (const id of ['pending', 'overdue']) {
      assert.equal((await patch({ invoiceId: id, amount: '125.25' })).status, 200);
    }
    for (const id of ['partial', 'paid', 'void', 'collection', 'missing']) {
      assert.equal((await patch({ invoiceId: id, amount: '125.25' })).status, 409);
    }
    assert.equal((await patch({ invoiceId: 'zero', amount: '0' })).status, 200);
    const [rows] = await connection.query('SELECT id, amount, amount_paid, status FROM incubation_fee_invoices ORDER BY id');
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    assert.equal(byId.pending.amount, '125.25');
    assert.equal(byId.pending.status, 'pending');
    assert.equal(byId.overdue.status, 'overdue');
    assert.equal(byId.partial.amount, '100.00');
    assert.equal(byId.collection.amount, '100.00');
    assert.equal(byId.zero.status, 'paid');

    const paymentQuery = /`(UPDATE incubation_fee_invoices SET amount_paid = \?, status = \?[\s\S]*?status <> 'void')`/.exec(paymentsSource)?.[1];
    assert.ok(paymentQuery);
    const [stalePayment] = await connection.execute(paymentQuery, [50, 'partially_paid', 'pending', 100, 0]);
    assert.equal(stalePayment.affectedRows, 0);
    const [currentPayment] = await connection.execute(paymentQuery, [50, 'partially_paid', 'pending', 125.25, 0]);
    assert.equal(currentPayment.affectedRows, 1);
    assert.equal((await patch({ invoiceId: 'pending', amount: '150' })).status, 409);
  } finally {
    await connection.end();
  }
});
