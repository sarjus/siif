import type { AppSession } from '@/lib/auth-types';
import { authClient } from '@/lib/auth-client';
import { createBrowserMysqlClient } from '@/lib/mysql-client';

export const database = createBrowserMysqlClient(authClient);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const formatApplicationNumber = (id: string) => {
  const compact = id.replace(/-/g, '').toUpperCase();
  return `SIIF-${compact.slice(-10)}`;
};

export const getSafeSession = async (): Promise<AppSession | null> => {
  const { data, error } = await database.auth.getSession();

  if (!error) {
    const session = data.session;
    if (!session) return null;

    const expiresAtMs = Number(session.expires_at || 0) * 1000;
    const shouldRefresh = expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000;

    if (!shouldRefresh) {
      return session;
    }

    const { data: refreshedData, error: refreshError } = await database.auth.refreshSession();
    if (!refreshError) {
      return refreshedData.session;
    }

    const refreshMessage = refreshError.message || '';
    if (refreshMessage.includes('Invalid Refresh Token') || refreshMessage.includes('Refresh Token Not Found')) {
      await database.auth.signOut();
      return null;
    }

    throw refreshError;
  }

  const message = error.message || '';
  if (message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')) {
    await database.auth.signOut();
    return null;
  }

  throw error;
};

export const getAuthHeaders = async () => {
  const session = await getSafeSession();
  if (!session) {
    throw new Error('Authentication required.');
  }

  return {};
};

// Database operations for incubation applications
export const incubationApi = {
  // Submit application
  async submitApplication(formData: Record<string, unknown>, applicationId?: string) {
    try {
      console.log('Attempting to insert form data with keys:', Object.keys(formData));

      let data;
      let error;

      if (applicationId) {
        const result = await database
          .from('applications')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', applicationId)
          .select();
        data = result.data;
        error = result.error;
      } else {
        const result = await database
          .from('applications')
          .insert([formData])
          .select();
        data = result.data;
        error = result.error;
      }
      
      if (error) {
        console.error('Database error details:', {
          error: error,
          message: error?.message || 'Unknown error',
          code: error?.code || 'No code',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          formDataKeys: Object.keys(formData)
        });
        throw new Error(`Database error: ${error?.message || JSON.stringify(error)}`);
      }
      
      console.log('Form submitted successfully:', data);
      return data;
    } catch (err) {
      console.error('Submission error caught:', err);
      throw err;
    }
  },

  // Save references for an application
  async saveReferences(references: object[], mobilePhone: string) {
    const { data, error } = await database
      .from('application_references')
      .insert(references)
      .eq('application_phone', mobilePhone)
      .select();

    if (error) throw error;
    return data;
  },

  // Replace references for an application (used when resubmitting a draft)
  async replaceReferences(applicationId: string, references: object[], mobilePhone: string) {
    const { error: deleteError } = await database
      .from('application_references')
      .delete()
      .eq('application_id', applicationId)
      .eq('application_phone', mobilePhone);

    if (deleteError) throw deleteError;

    if (references.length === 0) return [];

    const { data, error } = await database
      .from('application_references')
      .insert(references)
      .eq('application_phone', mobilePhone)
      .select();

    if (error) throw error;
    return data;
  },

  // Save draft application (insert new or update existing)
  async saveDraft(formData: Record<string, unknown>, applicationId?: string) {
    if (applicationId) {
      const { data, error } = await database
        .from('applications')
        .update({ ...formData, status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', applicationId)
        .select();

      if (error) throw error;
      return data;
    }

    const { data, error } = await database
      .from('applications')
      .insert([{ ...formData, status: 'draft' }])
      .select();

    if (error) throw error;
    return data;
  },

  // Lookup by application number + mobile number for resume/status checks
  async getByApplicationNumberAndPhone(applicationNumber: string, mobilePhone: string) {
    const trimmedNumber = applicationNumber.trim();
    const normalizedNumber = trimmedNumber.toUpperCase();
    const trimmedPhone = mobilePhone.trim();

    if (UUID_REGEX.test(trimmedNumber)) {
      const { data, error } = await database
        .from('applications')
        .select('*')
        .eq('id', trimmedNumber)
        .eq('mobile_phone', trimmedPhone)
        .single();

      if (error) throw error;
      return data;
    }

    const shortNumber = normalizedNumber.match(/^SIIF-([0-9A-F]{10})$/);
    if (!shortNumber) {
      throw new Error('Application not found for the provided Application Number and Mobile Phone.');
    }

    const { data, error } = await database
      .from('applications')
      .select('*')
      .eq('mobile_phone', trimmedPhone)
      .ilike('id', `%${shortNumber[1]}`)
      .single();

    if (error) throw error;
    return data;
  },

  // Get application by ID
  async getApplicationById(id: string) {
    const { data, error } = await database
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all applications (admin)
  async getAllApplications(filters?: { status?: string; limit?: number; offset?: number }) {
    let query = database.from('applications').select('*');
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }
    
    const { data, error } = await query.order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Update application status
  async updateApplicationStatus(id: string, status: string, notes?: string) {
    const { data, error } = await database
      .from('applications')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    // Log status change
    if (data) {
      await database
        .from('application_status_history')
        .insert({
          application_id: id,
          old_status: null,
          new_status: status,
          notes
        });
    }
    
    return data;
  },

  // Get team members for application
  async getTeamMembers(applicationId: string) {
    const { data, error } = await database
      .from('team_members')
      .select('*')
      .eq('application_id', applicationId)
      .order('member_number', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Get references for application
  async getReferences(applicationId: string, mobilePhone: string) {
    const { data, error } = await database
      .from('application_references')
      .select('*')
      .eq('application_id', applicationId)
      .eq('application_phone', mobilePhone)
      .order('reference_number', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Get requested services for application
  async getRequestedServices(applicationId: string) {
    const { data, error } = await database
      .from('requested_services')
      .select('*')
      .eq('application_id', applicationId);
    
    if (error) throw error;
    return data;
  },

  // Search applications by email
  async searchByEmail(email: string) {
    const { data, error } = await database
      .from('applications')
      .select('*')
      .ilike('email', `%${email}%`);
    
    if (error) throw error;
    return data;
  },

  // Get application statistics
  async getApplicationStats() {
    const { data, error } = await database
      .from('applications')
      .select('status');
    
    if (error) throw error;
    
    // Group and count by status
    const stats: Record<string, number> = {};
    (data || []).forEach(item => {
      stats[item.status] = (stats[item.status] || 0) + 1;
    });
    
    return stats;
  }
};
