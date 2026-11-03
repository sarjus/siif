import { NextRequest, NextResponse } from 'next/server';
import type { AppUser } from '@/lib/auth-types';
import { executeMysqlQuery, type MysqlQueryInput } from '@/lib/mysql';
import {
  getRequestUser,
  isEffectiveAdminUser,
} from '@/lib/server-auth';

const isValidQuery = (value: unknown): value is MysqlQueryInput => {
  if (!value || typeof value !== 'object') return false;
  const query = value as Partial<MysqlQueryInput>;
  return typeof query.table === 'string'
    && ['select', 'insert', 'update', 'delete', 'upsert'].includes(query.action || '')
    && Array.isArray(query.filters)
    && Array.isArray(query.orFilters)
    && Array.isArray(query.orders);
};

const getApplicationIdFromFilters = (query: MysqlQueryInput) =>
  query.filters.find((filter) => filter.column === 'id' && filter.operator === 'eq')?.value;

const publicApplicationFields = new Set([
  'business_name', 'lead_name', 'sjcet_associated', 'sjcet_association_type', 'age',
  'residential_phone', 'mobile_phone', 'email', 'postal_address', 'city', 'state',
  'postal_code', 'country', 'qualification', 'specialization', 'institute',
  'stage_of_startup', 'legal_status', 'sector_domain', 'nature_of_business',
  'innovation_category', 'business_description', 'entrepreneurial_motivation',
  'team_details', 'company_description', 'product_novelty', 'competitors',
  'competitive_advantage', 'market_size', 'revenue_model', 'machinery_required',
  'machinery_details', 'market_survey', 'market_survey_details', 'research_validation',
  'project_cost', 'pre_operative_expenses', 'prototype_expenses', 'test_marketing',
  'equipment', 'working_capital', 'other_requirements', 'laboratory_access',
  'library_access', 'technical_consulting', 'services_expected', 'other_services',
  'declaration', 'declaration_date', 'declaration_place', 'status', 'updated_at',
]);

const isAllowedApplicationStatus = (value: unknown) =>
  value === undefined || value === 'draft' || value === 'submitted';

const getApplicationForPublicEdit = async (id: unknown) => {
  if (typeof id !== 'string') return null;
  const { data, error } = await executeMysqlQuery({
    table: 'applications',
    action: 'select',
    fields: 'id, status, mobile_phone',
    filters: [{ column: 'id', operator: 'eq', value: id }],
    orFilters: [],
    orders: [],
    single: 'maybeSingle',
  });
  if (error) throw new Error(error.message);
  return data;
};

const authorizePublicRequest = async (query: MysqlQueryInput) => {
  if (query.table === 'applications' && query.action === 'insert') {
    const rows = Array.isArray(query.values) ? query.values : [query.values || {}];
    if (!rows.length) return 'Application data is required.';
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Invalid application data.';
      const values = row as Record<string, unknown>;
      if (!isAllowedApplicationStatus(values.status)) return 'Invalid application status.';
      if (Object.keys(values).some((key) => !publicApplicationFields.has(key))) return 'Application contains unsupported fields.';
      values.status = values.status || 'submitted';
    }
    return null;
  }

  if (query.table === 'applications' && query.action === 'select') {
    const hasPhone = query.filters.some((filter) =>
      filter.column === 'mobile_phone' && filter.operator === 'eq' && typeof filter.value === 'string'
    );
    const idFilter = query.filters.find((filter) => filter.column === 'id');
    const validIdFilter = idFilter?.operator === 'eq'
      ? typeof idFilter.value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idFilter.value)
      : idFilter?.operator === 'ilike'
        && typeof idFilter.value === 'string'
        && /^%[0-9a-f]{10}$/i.test(idFilter.value);
    if (!hasPhone || !validIdFilter) {
      return 'A matching application number and phone number are required.';
    }
    return null;
  }

  if (query.table === 'applications' && query.action === 'update' && !Array.isArray(query.values)) {
    const id = getApplicationIdFromFilters(query);
    if (!id) return 'An application ID is required.';
    const existing = await getApplicationForPublicEdit(id);
    const values = query.values as Record<string, unknown>;
    if (!existing || !['draft', 'submitted'].includes(String(existing.status))) return 'Application not found or cannot be edited.';
    if (!existing.mobile_phone || values.mobile_phone !== existing.mobile_phone) return 'Application phone verification failed.';
    if (!isAllowedApplicationStatus(values.status)) return 'Invalid application status.';
    if (Object.keys(values).some((key) => !publicApplicationFields.has(key))) return 'Application contains unsupported fields.';
    return null;
  }

  if (query.table === 'application_references') {
    const applicationId = query.action === 'insert'
      ? (() => {
        const rows = Array.isArray(query.values) ? query.values : [query.values || {}];
        const ids = [...new Set(rows.map((row) => row.application_id))];
        return ids.length === 1 ? ids[0] : null;
      })()
      : query.filters.find((filter) => filter.column === 'application_id' && filter.operator === 'eq')?.value;
    const applicationPhone = query.filters.find((filter) =>
      filter.column === 'application_phone' && filter.operator === 'eq' && typeof filter.value === 'string'
    )?.value;
    const existing = await getApplicationForPublicEdit(applicationId);
    if (!existing
      || !['draft', 'submitted'].includes(String(existing.status))
      || typeof applicationPhone !== 'string'
      || existing.mobile_phone?.trim() !== applicationPhone.trim()) {
      return 'Application references are not available for the supplied application and phone number.';
    }
    if (query.action === 'select' || query.action === 'delete' || query.action === 'insert') return null;
  }

  return 'Authentication required.';
};

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isValidQuery(body)) {
      return NextResponse.json({ error: { message: 'Invalid database query.' } }, { status: 400 });
    }

    const user = await getRequestUser(request);
    let admin = false;
    if (!user) {
      const publicError = await authorizePublicRequest(body);
      if (publicError) return NextResponse.json({ error: { message: publicError } }, { status: 401 });
    } else {
      const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
      admin = await isEffectiveAdminUser(user);
      if (!admin && role === 'company') {
        const readOnlyTables = new Set([
          'applications', 'incubation_fee_settings', 'company_deposits', 'incubation_fee_invoices',
          'fee_collections', 'notifications',
        ]);
        if (body.action !== 'select' || !readOnlyTables.has(body.table)) {
          return NextResponse.json({ error: { message: 'This account cannot modify this database table.' } }, { status: 403 });
        }
      } else if (!admin && role === 'reviewer') {
        const permittedTables = new Set([
          'reviewers', 'application_assignments', 'applications', 'application_references',
          'application_status_history', 'team_members', 'requested_services',
        ]);
        if (!permittedTables.has(body.table)
          || !['select', 'update'].includes(body.action)
          || (body.action === 'update' && body.table !== 'application_assignments')) {
          return NextResponse.json({ error: { message: 'This reviewer account cannot perform that database operation.' } }, { status: 403 });
        }
        if (body.action === 'update') {
          const updates = body.values as Record<string, unknown>;
          if (Object.keys(updates || {}).some((key) => !['review_status', 'review_comments', 'reviewed_at'].includes(key))) {
            return NextResponse.json({ error: { message: 'Reviewers may only update their review assessment.' } }, { status: 403 });
          }
        }
      } else if (!admin) {
        return NextResponse.json({ error: { message: 'Unauthorized.' } }, { status: 403 });
      }

      if (body.action === 'update' || body.action === 'delete') {
        const hasFilter = body.filters.length > 0 || body.orFilters.length > 0;
        if (!hasFilter) {
          return NextResponse.json({ error: { message: 'Bulk updates and deletes are not allowed.' } }, { status: 400 });
        }
      }

      if (!admin && role === 'reviewer' && body.table === 'application_assignments' && body.action === 'update') {
        const allowedStatuses = new Set(['pending', 'in_progress', 'completed']);
        const updates = body.values as Record<string, unknown>;
        if (updates.review_status && !allowedStatuses.has(String(updates.review_status))) {
          return NextResponse.json({ error: { message: 'Invalid review status.' } }, { status: 400 });
        }
      }

      if (!admin && role === 'reviewer' && body.table === 'application_assignments' && body.action === 'update') {
        const assignmentId = body.filters.find((filter) => filter.column === 'id' && filter.operator === 'eq')?.value;
        if (!assignmentId) {
          return NextResponse.json({ error: { message: 'A review assignment must be selected.' } }, { status: 400 });
        }
      }

      if (body.table === 'applications' && body.action === 'select' && role === 'company') {
        const userEmail = (user.email || '').trim().toLowerCase();
        if (!userEmail) return NextResponse.json({ error: { message: 'Company account email is missing.' } }, { status: 403 });
      }
    }

    if (body.table === 'application_references') {
      body.filters = body.filters.filter((filter) => filter.column !== 'application_phone');
    }
    const queryUser: AppUser | null = user && admin
      ? { ...user, user_metadata: { ...user.user_metadata, role: 'admin' } }
      : user;
    const result = await executeMysqlQuery(body, queryUser);
    if (result.error) {
      const status = result.error.code === 'PGRST116' ? 406 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      error: { message: error instanceof Error ? error.message : 'Database query failed.' },
    }, { status: 500 });
  }
}
