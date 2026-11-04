import 'server-only';

import mysql, {
  type ExecuteValues,
  type Pool,
  type QueryResult,
  type RowDataPacket,
} from 'mysql2/promise';
import type { AppUser } from '@/lib/auth-types';
import { MysqlClient, type MysqlQueryInput, type MysqlRow } from '@/lib/mysql-client';
export type { MysqlQueryInput } from '@/lib/mysql-client';

export type MysqlRpcClient = Pick<MysqlClient, 'rpc'>;
export type MysqlFromClient = Pick<MysqlClient, 'from'>;

let pool: Pool | undefined;

const TABLES = new Set([
  'application_assignments', 'application_references', 'application_status_history',
  'applications',
  'company_deposits', 'conference_bookings',
  'fee_collections', 'fee_revision_history', 'incubatees',
  'incubation_fee_invoices', 'incubation_fee_settings', 'ledger_categories',
  'notifications', 'requested_services', 'reviewers', 'siif_counters', 'siif_ledger',
  'siif_staff', 'siif_staff_payments', 'team_members',
]);

const REQUIRED_ENV = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'] as const;
const quoteIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Invalid database identifier.');
  return `\`${value}\``;
};

type Column = RowDataPacket & { COLUMN_NAME: string; DATA_TYPE: string };
type Filter = MysqlQueryInput['filters'][number];
type Relation = {
  table: string;
  fields: string[];
  relations: Relation[];
  inner: boolean;
};

export const getMysqlPool = (): Pool => {
  if (pool) return pool;
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing MySQL configuration: ${missing.join(', ')}.`);

  const port = Number(process.env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_PORT must be an integer between 1 and 65535.');
  }

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: true,
    decimalNumbers: true,
  });
  return pool;
};

const getColumns = async (table: string): Promise<Column[]> => {
  const [columns] = await getMysqlPool().execute<Column[]>(
    'SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [table]
  );
  if (!columns.length) throw new Error(`MySQL table "${table}" does not exist. Apply mysql_schema.sql first.`);
  return columns;
};

const parseSelection = (selection: string) => {
  const fields: string[] = [];
  const relations: Relation[] = [];
  const parts: string[] = [];
  let token = '';
  let depth = 0;
  for (const char of selection || '*') {
    if (char === ',' && depth === 0) {
      parts.push(token.trim());
      token = '';
      continue;
    }
    if (char === '(') depth++;
    if (char === ')') depth--;
    token += char;
  }
  if (token.trim()) parts.push(token.trim());

  for (const part of parts) {
    const opening = part.indexOf('(');
    if (opening < 0) {
      if (part !== '*') fields.push(part);
      continue;
    }
    const name = part.slice(0, opening);
    if (!/^[A-Za-z_][A-Za-z0-9_]*(?:![A-Za-z_]+)?$/.test(name) || !part.endsWith(')')) {
      throw new Error('Invalid relation selection.');
    }
    const nested = parseSelection(part.slice(opening + 1, -1));
    relations.push({
      table: name.split('!')[0],
      fields: nested.fields,
      relations: nested.relations,
      inner: name.endsWith('!inner'),
    });
  }
  return { fields, relations };
};

const relationKeys = (leftTable: string, rightTable: string) => {
  const leftPrefix = leftTable.replace(/s$/, '');
  const rightPrefix = rightTable.replace(/s$/, '');
  const pairs: Array<[string, string]> = [
    [`${leftPrefix}_id`, 'id'],
    [`${rightPrefix}_id`, 'id'],
  ];
  const explicitRelations: Record<string, Array<[string, string]>> = {
    'fee_collections:incubation_fee_invoices': [['invoice_id', 'id']],
    'fee_collections:company_deposits': [['deposit_id', 'id']],
    'siif_staff_payments:siif_staff': [['staff_id', 'id']],
  };
  pairs.unshift(...(explicitRelations[`${leftTable}:${rightTable}`] || []));
  if (rightTable === 'applications') pairs.push(['company_id', 'id']);
  if (leftTable === 'applications') pairs.push(['id', 'company_id']);
  return pairs;
};

const resolveRelation = (
  leftTable: string,
  rightTable: string,
  leftColumns: Set<string>,
  rightColumns: Set<string>
) => {
  if (leftTable === 'applications' && leftColumns.has('id') && rightColumns.has('company_id')) {
    return { leftColumn: 'id', rightColumn: 'company_id', many: true };
  }
  for (const [leftColumn, rightColumn] of relationKeys(leftTable, rightTable)) {
    if (leftColumns.has(leftColumn) && rightColumns.has(rightColumn)) {
      return { leftColumn, rightColumn, many: false };
    }
    if (leftColumns.has(rightColumn) && rightColumns.has(leftColumn)) {
      return { leftColumn: rightColumn, rightColumn: leftColumn, many: true };
    }
  }
  throw new Error(`No MySQL relationship found between ${leftTable} and ${rightTable}.`);
};

const filterSql = (filter: Filter, columns: Set<string>, values: ExecuteValues[], prefix = '') => {
  if (!columns.has(filter.column)) throw new Error(`Unknown column ${filter.column}.`);
  const column = `${prefix}${quoteIdentifier(filter.column)}`;
  switch (filter.operator) {
    case 'in': {
      const selected = Array.isArray(filter.value) ? filter.value : [];
      if (!selected.length) return '1 = 0';
      values.push(...selected as ExecuteValues[]);
      return `${column} IN (${selected.map(() => '?').join(', ')})`;
    }
    case 'eq':
    case 'neq':
      if (filter.value === null) return `${column} IS ${filter.operator === 'neq' ? 'NOT ' : ''}NULL`;
      values.push(filter.value as ExecuteValues);
      return `${column} ${filter.operator === 'eq' ? '=' : '<>'} ?`;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      values.push(filter.value as ExecuteValues);
      return `${column} ${{ gt: '>', gte: '>=', lt: '<', lte: '<=' }[filter.operator]} ?`;
    case 'is':
      if (filter.value === null || filter.value === 'null') return `${column} IS NULL`;
      if (filter.value === true || filter.value === 'true') return `${column} IS TRUE`;
      if (filter.value === false || filter.value === 'false') return `${column} IS FALSE`;
      throw new Error('Unsupported is filter.');
    case 'like':
      values.push(filter.value as ExecuteValues);
      return `${column} LIKE ?`;
    case 'ilike':
      values.push(filter.value as ExecuteValues);
      return `LOWER(${column}) LIKE LOWER(?)`;
    default:
      throw new Error(`Unsupported filter operator ${filter.operator}.`);
  }
};

const accessPredicate = (table: string, user: AppUser, values: ExecuteValues[], prefix = '') => {
  const column = (name: string) => `${prefix}${quoteIdentifier(name)}`;
  const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
  const email = (user.email || '').trim().toLowerCase();
  if (role === 'admin') return null;

  const companyTables = new Set([
    'applications', 'incubation_fee_settings', 'company_deposits', 'incubation_fee_invoices',
    'fee_collections', 'notifications',     'conference_bookings',
    'incubatees',
  ]);
  if (role === 'company' && companyTables.has(table)) {
    if (!email) throw new Error('Authenticated company email is required.');
    if (table === 'applications') {
      values.push(email);
      return `LOWER(${column('email')}) = ? AND LOWER(${column('status')}) = 'approved'`;
    }
    if (table === 'notifications') {
      values.push(email);
      return `(${column('recipient_type')} = 'all' OR ${column('company_id')} IN (SELECT \`id\` FROM \`applications\` WHERE LOWER(\`email\`) = ? AND LOWER(\`status\`) = 'approved')`;
    }
    values.push(email);
    if (table === 'conference_bookings') {
      return `(${column('status')} = 'approved' OR ${column('company_id')} IN (SELECT \`id\` FROM \`applications\` WHERE LOWER(\`email\`) = ? AND LOWER(\`status\`) = 'approved')`;
    }
    return `${column('company_id')} IN (SELECT \`id\` FROM \`applications\` WHERE LOWER(\`email\`) = ? AND LOWER(\`status\`) = 'approved')`;
  }

  const reviewerTables = new Set([
    'reviewers', 'application_assignments', 'applications', 'application_references',
    'application_status_history', 'team_members', 'requested_services',
  ]);
  if (role === 'reviewer' && reviewerTables.has(table)) {
    if (table === 'reviewers') {
      values.push(user.id);
      return `${column('user_id')} = ?`;
    }
    const reviewerScope = 'SELECT `id` FROM `reviewers` WHERE `user_id` = ?';
    if (table === 'application_assignments') {
      values.push(user.id);
      return `${column('reviewer_id')} IN (${reviewerScope})`;
    }
    values.push(user.id);
    if (table === 'applications') {
      return `${column('id')} IN (SELECT \`application_id\` FROM \`application_assignments\` WHERE \`reviewer_id\` IN (${reviewerScope}))`;
    }
    return `${column('application_id')} IN (SELECT \`application_id\` FROM \`application_assignments\` WHERE \`reviewer_id\` IN (${reviewerScope}))`;
  }
  throw new Error('This account is not permitted to access this MySQL table.');
};

const normalizeValue = (value: unknown, column: Column) => {
  if (value === undefined) return null;
  if (column.DATA_TYPE === 'json' && value !== null && typeof value !== 'string') return JSON.stringify(value);
  if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
};

export const executeMysqlQuery = async (
  query: MysqlQueryInput,
  user: AppUser | null = null
): Promise<{ data: MysqlRow; error: { message: string; code?: string } | null; count?: number | null }> => {
  try {
    if (!TABLES.has(query.table)) throw new Error(`MySQL table "${query.table}" is not enabled.`);
    const table = quoteIdentifier(query.table);
    const metadata = await getColumns(query.table);
    const columns = new Set(metadata.map((column) => column.COLUMN_NAME));

    if (query.action === 'insert' || query.action === 'upsert') {
      const sourceRows = (Array.isArray(query.values) ? query.values : [query.values || {}]) as Array<Record<string, unknown>>;
      const rows: Array<Record<string, unknown>> = sourceRows.map((row) => ({
        ...row,
        ...(columns.has('id') && !row.id ? { id: crypto.randomUUID() } : {}),
      }));
      if (!rows.length) return { data: [], error: null };
      for (const row of rows) {
        for (const key of Object.keys(row)) {
          if (!columns.has(key)) throw new Error(`Unknown column ${key} on ${query.table}.`);
        }
      }
      const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      if (!keys.length) throw new Error('Cannot insert an empty MySQL row.');
      const params = rows.flatMap((row) => keys
        .filter((key) => Object.hasOwn(row, key))
        .map((key) => normalizeValue(row[key], metadata.find((column) => column.COLUMN_NAME === key)!))
      ) as ExecuteValues[];
      let sql = `INSERT INTO ${table} (${keys.map(quoteIdentifier).join(', ')}) VALUES ${rows.map((row) =>
        `(${keys.map((key) => Object.hasOwn(row, key) ? '?' : 'DEFAULT').join(', ')})`
      ).join(', ')}`;
      if (query.action === 'upsert') {
        const conflictColumns = query.conflictColumns?.length ? query.conflictColumns : ['id'];
        if (conflictColumns.some((column) => !columns.has(column))) throw new Error('Invalid upsert conflict column.');
        if (rows.some((row) => conflictColumns.some((column) => row[column] === null || row[column] === undefined))) {
          throw new Error('Upsert rows must include every conflict column.');
        }
        const updates = keys.filter((key) => !conflictColumns.includes(key) && key !== 'id');
        sql += ` ON DUPLICATE KEY UPDATE ${updates.length
          ? updates.map((key) => `${quoteIdentifier(key)} = VALUES(${quoteIdentifier(key)})`).join(', ')
          : `${quoteIdentifier(conflictColumns[0])} = VALUES(${quoteIdentifier(conflictColumns[0])})`}`;
      }
      await getMysqlPool().execute(sql, params);
      if (!query.returning) return { data: null, error: null };

      const conflictColumns = query.action === 'upsert'
        ? query.conflictColumns?.length ? query.conflictColumns : ['id']
        : ['id'];
      const orFilters = rows.map((row) => conflictColumns.map((column) => ({
        column,
        operator: 'eq',
        value: row[column],
      })));
      const result = await executeMysqlQuery({
        ...query,
        action: 'select',
        filters: [],
        orFilters,
        orders: [],
        single: undefined,
      }, user);
      return result;
    }

    const qualifier = query.action === 'select' ? `${table}.` : '';
    const filterValues: ExecuteValues[] = [];
    const filters = query.filters.map((filter) => filterSql(filter, columns, filterValues, qualifier));
    const orGroups = query.orFilters.map((group) =>
      `(${group.map((filter) => filterSql(filter, columns, filterValues, qualifier)).join(' AND ')})`
    );
    const accessValues: ExecuteValues[] = [];
    const access = user ? accessPredicate(query.table, user, accessValues, qualifier) : null;
    const whereParts = [...filters, ...(orGroups.length ? [`(${orGroups.join(' OR ')})`] : [])];
    if (access) whereParts.push(`(${access})`);
    const where = whereParts.length ? ` WHERE ${whereParts.join(' AND ')}` : '';
    const values = [...filterValues, ...accessValues];

    if (query.action === 'update') {
      const updates = Object.entries((Array.isArray(query.values) ? query.values[0] : query.values) || {});
      if (!updates.length) throw new Error('Cannot update with no values.');
      for (const [key] of updates) if (!columns.has(key)) throw new Error(`Unknown column ${key} on ${query.table}.`);
      const setValues = updates.map(([key, value]) => normalizeValue(value, metadata.find((column) => column.COLUMN_NAME === key)!)) as ExecuteValues[];
      await getMysqlPool().execute(
        `UPDATE ${table} SET ${updates.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ')}${where}`,
        [...setValues, ...values]
      );
      if (!query.returning) return { data: null, error: null };
      return executeMysqlQuery({ ...query, action: 'select' }, user);
    }

    if (query.action === 'delete') {
      await getMysqlPool().execute(`DELETE FROM ${table}${where}`, values);
      return { data: null, error: null };
    }

    const selection = query.fields || '*';
    const { fields, relations } = parseSelection(selection);
    const selected = fields.length ? fields : ['*'];
    const selectedColumns: string[] = [];
    for (const field of selected) {
      if (field === '*') {
        selectedColumns.push(...metadata.map((column) => `${table}.${quoteIdentifier(column.COLUMN_NAME)} AS ${quoteIdentifier(`__main__${column.COLUMN_NAME}`)}`));
      } else {
        if (!columns.has(field)) throw new Error(`Unknown column ${field} on ${query.table}.`);
        selectedColumns.push(`${table}.${quoteIdentifier(field)} AS ${quoteIdentifier(`__main__${field}`)}`);
      }
    }

    const joins: string[] = [];
    type CompiledRelation = {
      name: string;
      alias: string;
      fields: string[];
      many: boolean;
      children: CompiledRelation[];
      instances: WeakMap<Record<string, unknown>, Map<string, Record<string, unknown>>>;
    };
    const compileRelations = async (
      parentTable: string,
      parentAlias: string,
      parentColumns: Set<string>,
      specs: Relation[],
      path: number[] = []
    ): Promise<CompiledRelation[]> => {
      const compiled: CompiledRelation[] = [];
      for (let index = 0; index < specs.length; index++) {
        const relation = specs[index];
        if (!TABLES.has(relation.table)) throw new Error(`Unknown related MySQL table ${relation.table}.`);
        const relatedMetadata = await getColumns(relation.table);
        const relatedColumns = new Set(relatedMetadata.map((column) => column.COLUMN_NAME));
        const relationship = resolveRelation(parentTable, relation.table, parentColumns, relatedColumns);
        const relationPath = [...path, index];
        const alias = `rel${relationPath.join('_')}`;
        const relatedAlias = quoteIdentifier(alias);
        const currentColumn = relationship.many
          ? `${relatedAlias}.${quoteIdentifier(relationship.leftColumn)}`
          : `${parentAlias}.${quoteIdentifier(relationship.leftColumn)}`;
        const relatedColumn = relationship.many
          ? `${parentAlias}.${quoteIdentifier(relationship.rightColumn)}`
          : `${relatedAlias}.${quoteIdentifier(relationship.rightColumn)}`;
        joins.push(`${relation.inner ? 'INNER' : 'LEFT'} JOIN ${quoteIdentifier(relation.table)} AS ${relatedAlias} ON ${currentColumn} = ${relatedColumn}`);
        const relationFields = relation.fields.includes('*')
          ? relatedMetadata.map((column) => column.COLUMN_NAME)
          : relation.fields;
        for (const field of relationFields) {
          if (!relatedColumns.has(field)) throw new Error(`Unknown column ${field} on ${relation.table}.`);
          selectedColumns.push(`${relatedAlias}.${quoteIdentifier(field)} AS ${quoteIdentifier(`__${alias}__${field}`)}`);
        }
        if (!relationFields.includes('id') && relatedColumns.has('id')) {
          selectedColumns.push(`${relatedAlias}.\`id\` AS ${quoteIdentifier(`__${alias}__id`)}`);
        }
        const children = await compileRelations(
          relation.table,
          relatedAlias,
          relatedColumns,
          relation.relations,
          relationPath
        );
        compiled.push({
          name: relation.table,
          alias,
          fields: relationFields,
          many: relationship.many,
          children,
          instances: new WeakMap(),
        });
      }
      return compiled;
    };
    const relationMetadata = await compileRelations(query.table, table, columns, relations);
    if (!selected.includes('*') && !selected.includes('id')) {
      selectedColumns.push(`${table}.\`id\` AS \`__main__id\``);
    }

    const orders = query.orders.map(({ column, ascending }) => {
      if (!columns.has(column)) throw new Error(`Unknown order column ${column}.`);
      return `${table}.${quoteIdentifier(column)} ${ascending ? 'ASC' : 'DESC'}`;
    }).join(', ');
    const shouldPageRelationsInSubquery = joins.length > 0 && (query.limit !== undefined || query.offset !== undefined);
    const limitSql = query.limit !== undefined || query.offset !== undefined ? ' LIMIT ?' : '';
    const offsetSql = query.offset === undefined ? '' : ' OFFSET ?';
    let count: number | undefined;
    if (query.count === 'exact') {
      const [countRows] = await getMysqlPool().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS \`count\` FROM ${table}${where}`,
        values
      );
      count = Number(countRows[0]?.count || 0);
    }
    if (query.head) return { data: null, error: null, count };

    const queryValues = [...values];
    let from = table;
    let resultWhere = where;
    if (shouldPageRelationsInSubquery) {
      const pageLimit = query.limit ?? Number.MAX_SAFE_INTEGER;
      const pageOffset = query.offset ?? 0;
      from += ` INNER JOIN (SELECT \`id\` FROM ${table}${where}${orders ? ` ORDER BY ${orders}` : ''} LIMIT ? OFFSET ?) AS \`__page\` ON \`__page\`.\`id\` = ${table}.\`id\``;
      queryValues.push(pageLimit, pageOffset);
      resultWhere = '';
    } else {
      if (query.limit !== undefined) queryValues.push(query.limit);
      if (query.offset !== undefined) {
        if (query.limit === undefined) queryValues.push(Number.MAX_SAFE_INTEGER);
        queryValues.push(query.offset);
      }
    }
    const sql = `SELECT ${selectedColumns.join(', ')} FROM ${from}${joins.length ? ` ${joins.join(' ')}` : ''}${resultWhere}${orders ? ` ORDER BY ${orders}` : ''}${shouldPageRelationsInSubquery ? '' : `${limitSql}${offsetSql}`}`;
    const [rows] = await getMysqlPool().execute<RowDataPacket[]>(sql, queryValues);
    const buildRelation = (
      parent: Record<string, unknown>,
      relation: CompiledRelation,
      row: RowDataPacket
    ) => {
      const relatedId = row[`__${relation.alias}__id`];
      if (relatedId === null || relatedId === undefined) {
        if (!(relation.name in parent)) parent[relation.name] = relation.many ? [] : null;
        return;
      }
      let instances = relation.instances.get(parent);
      if (!instances) {
        instances = new Map();
        relation.instances.set(parent, instances);
      }
      let child = instances.get(String(relatedId));
      if (!child) {
        child = {};
        for (const field of relation.fields) child[field] = row[`__${relation.alias}__${field}`];
        instances.set(String(relatedId), child);
        if (relation.many) {
          const current = (parent[relation.name] || []) as Record<string, unknown>[];
          if (!Array.isArray(parent[relation.name])) parent[relation.name] = current;
          current.push(child);
        } else {
          parent[relation.name] = child;
        }
      }
      for (const nested of relation.children) buildRelation(child, nested, row);
    };
    const rootRows = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const rowId = String(row.__main__id);
      let result = rootRows.get(rowId);
      if (!result) {
        result = {};
        rootRows.set(rowId, result);
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('__main__')) result[key.slice(8)] = value;
      }
      }
      for (const relation of relationMetadata) buildRelation(result, relation, row);
    }
    const data = [...rootRows.values()];

    if (query.single) {
      if (!data.length && query.single === 'maybeSingle') return { data: null, error: null };
      if (data.length !== 1) {
        return { data: null, error: { message: `Expected one row, got ${data.length}.`, code: 'PGRST116' } };
      }
      return { data: data[0], error: null };
    }
    return { data, error: null, ...(count === undefined ? {} : { count }) };
  } catch (error) {
    const err = error as Error & { code?: string };
    return { data: null, error: { message: err.message || 'MySQL query failed.', code: err.code } };
  }
};

async function allocateNumber(series: string, year: number) {
  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT IGNORE INTO `siif_counters` (`id`, `series`, `year`, `last_seq`) VALUES (?, ?, ?, 0)',
      [crypto.randomUUID(), series, year]
    );
    await connection.execute(
      'UPDATE `siif_counters` SET `last_seq` = LAST_INSERT_ID(`last_seq` + 1) WHERE `series` = ? AND `year` = ?',
      [series, year]
    );
    const [rows] = await connection.query<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS `sequence`');
    await connection.commit();
    return Number(rows[0].sequence);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const rpc = async (name: string, args: Record<string, unknown>) => {
  if (name !== 'next_siif_number') return { data: null, error: { message: `Unsupported MySQL operation: ${name}` } };
  const series = args.p_series;
  const year = Number(args.p_year);
  if (typeof series !== 'string' || !/^[A-Z]{3,4}$/.test(series) || !Number.isInteger(year)) {
    return { data: null, error: { message: 'Invalid sequential number request.' } };
  }
  try {
    return { data: await allocateNumber(series, year), error: null };
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Failed to allocate sequence.' } };
  }
};

export const createMysqlClient = () =>
  new MysqlClient(async (query) => executeMysqlQuery(query), rpc, undefined);

export async function executeMysql<T extends QueryResult>(sql: string, values: ExecuteValues = []): Promise<T> {
  const [result] = await getMysqlPool().execute<T>(sql, values);
  return result;
}

export const mysqlHealthCheck = async () => {
  const [rows] = await getMysqlPool().query<RowDataPacket[]>('SELECT 1 AS `ok`');
  return Number(rows[0]?.ok) === 1;
};
