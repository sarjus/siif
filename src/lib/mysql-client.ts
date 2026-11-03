import type { BrowserAuthClient } from '@/lib/auth-client';

export type MysqlQueryInput = {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  fields?: string;
  count?: 'exact';
  head?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters: Array<{ column: string; operator: string; value: unknown }>;
  orFilters: Array<Array<{ column: string; operator: string; value: unknown }>>;
  orders: Array<{ column: string; ascending: boolean }>;
  limit?: number;
  offset?: number;
  single?: 'single' | 'maybeSingle';
  conflictColumns?: string[];
  returning?: boolean;
};

type MysqlError = { message: string; code?: string; details?: string; hint?: string };
type MysqlResponse<TData> = { data: TData; error: MysqlError | null; count?: number | null };
// Table rows are runtime-defined, matching the dynamic data shape of the database client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MysqlRow = any;
type QueryExecutor = (query: MysqlQueryInput) => Promise<MysqlResponse<MysqlRow>>;
type RpcExecutor = (name: string, args: Record<string, unknown>) => Promise<MysqlResponse<MysqlRow>>;

const parseOrFilter = (expression: string) => {
  const filters = [];
  for (const part of expression.split(',')) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|is|ilike|like)\.(.*)$/);
    if (!match) throw new Error('Unsupported OR filter.');
    filters.push({
      column: match[1],
      operator: match[2],
      value: match[3] === 'null' ? null : match[3],
    });
  }
  return filters;
};

export class MysqlQueryBuilder<TData = MysqlRow[]> implements PromiseLike<MysqlResponse<TData>> {
  private readonly query: MysqlQueryInput;

  constructor(table: string, private readonly execute: QueryExecutor) {
    this.query = {
      table,
      action: 'select',
      fields: '*',
      filters: [],
      orFilters: [],
      orders: [],
    };
  }

  select(fields = '*', options?: { count?: 'exact'; head?: boolean }) {
    if (this.query.action === 'select') {
      this.query.fields = fields;
      this.query.count = options?.count;
      this.query.head = options?.head;
    } else {
      this.query.returning = true;
    }
    return this;
  }

  insert(values: Record<string, unknown> | object[]) {
    this.query.action = 'insert';
    this.query.values = values as Record<string, unknown> | Record<string, unknown>[];
    return this;
  }

  upsert(values: Record<string, unknown> | object[], options?: { onConflict?: string }) {
    this.query.action = 'upsert';
    this.query.values = values as Record<string, unknown> | Record<string, unknown>[];
    this.query.conflictColumns = options?.onConflict?.split(',').map((column) => column.trim());
    return this;
  }

  update(values: Record<string, unknown>) {
    this.query.action = 'update';
    this.query.values = values;
    return this;
  }

  delete() {
    this.query.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.addFilter(column, 'neq', value); }
  gt(column: string, value: unknown) { return this.addFilter(column, 'gt', value); }
  gte(column: string, value: unknown) { return this.addFilter(column, 'gte', value); }
  lt(column: string, value: unknown) { return this.addFilter(column, 'lt', value); }
  lte(column: string, value: unknown) { return this.addFilter(column, 'lte', value); }
  ilike(column: string, value: unknown) { return this.addFilter(column, 'ilike', value); }
  like(column: string, value: unknown) { return this.addFilter(column, 'like', value); }
  in(column: string, values: unknown[]) {
    this.query.filters.push({ column, operator: 'in', value: values });
    return this;
  }

  or(expression: string) {
    this.query.orFilters.push(parseOrFilter(expression));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.query.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(limit: number) {
    this.query.limit = Math.max(0, Math.trunc(limit));
    return this;
  }

  range(from: number, to: number) {
    this.query.offset = Math.max(0, Math.trunc(from));
    this.query.limit = Math.max(0, Math.trunc(to - from + 1));
    return this;
  }

  single<T = MysqlRow>() {
    this.query.single = 'single';
    return this as unknown as MysqlQueryBuilder<T>;
  }

  maybeSingle<T = MysqlRow>() {
    this.query.single = 'maybeSingle';
    return this as unknown as MysqlQueryBuilder<T | null>;
  }

  then<TResult1 = MysqlResponse<TData>, TResult2 = never>(
    onfulfilled?: ((value: MysqlResponse<TData>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute(this.query).then((value) => {
      if (onfulfilled) return onfulfilled(value as MysqlResponse<TData>);
      return value as TResult1;
    }, onrejected);
  }

  private addFilter(column: string, operator: string, value: unknown) {
    this.query.filters.push({ column, operator, value });
    return this;
  }
}

export class MysqlClient<TAuth extends BrowserAuthClient | undefined = undefined> {
  constructor(
    private readonly execute: QueryExecutor,
    private readonly executeRpc: RpcExecutor | undefined,
    readonly auth: TAuth
  ) {}

  from(table: string) {
    return new MysqlQueryBuilder(table, (query) => this.execute(query));
  }

  async rpc(name: string, args: Record<string, unknown>) {
    if (!this.executeRpc) return { data: null, error: { message: 'RPC is only available to server-side database clients.' } };
    return this.executeRpc(name, args);
  }
}

export const createBrowserMysqlClient = (auth: BrowserAuthClient) =>
  new MysqlClient(async (query) => {
    try {
      const response = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
        credentials: 'same-origin',
      });
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error || { message: 'Database request failed.' } };
      return result;
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Database request failed.' } };
    }
  }, undefined, auth);
