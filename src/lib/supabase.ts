import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase operations for incubation applications
export const incubationApi = {
  // Submit application
  async submitApplication(formData: any) {
    try {
      console.log('Attempting to insert form data with keys:', Object.keys(formData));
      
      const { data, error } = await supabase
        .from('applications')
        .insert([formData])
        .select();
      
      if (error) {
        console.error('Supabase error details:', {
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
  async saveReferences(references: object[]) {
    const { data, error } = await supabase
      .from('application_references')
      .insert(references)
      .select();

    if (error) throw error;
    return data;
  },

  // Get application by ID
  async getApplicationById(id: string) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all applications (admin)
  async getAllApplications(filters?: { status?: string; limit?: number; offset?: number }) {
    let query = supabase.from('applications').select('*');
    
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
    const { data, error } = await supabase
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
      await supabase
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
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('application_id', applicationId)
      .order('member_number', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Get references for application
  async getReferences(applicationId: string) {
    const { data, error } = await supabase
      .from('references')
      .select('*')
      .eq('application_id', applicationId)
      .order('reference_number', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Get requested services for application
  async getRequestedServices(applicationId: string) {
    const { data, error } = await supabase
      .from('requested_services')
      .select('*')
      .eq('application_id', applicationId);
    
    if (error) throw error;
    return data;
  },

  // Search applications by email
  async searchByEmail(email: string) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .ilike('email', `%${email}%`);
    
    if (error) throw error;
    return data;
  },

  // Get application statistics
  async getApplicationStats() {
    const { data, error } = await supabase
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
