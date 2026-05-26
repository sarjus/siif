'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, formatApplicationNumber, getSafeSession } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/AdminNav';

interface ApplicationData {
  [key: string]: any;
}

interface ReferenceData {
  id: string;
  reference_number: number;
  name: string;
  organization: string;
  address: string;
  phone: string;
  email: string;
}

interface AssignmentData {
  id: string;
  reviewer_id: string;
  review_status: string;
  review_comments: string | null;
  reviewed_at: string | null;
  assigned_at: string;
  reviewers: {
    name: string;
    email: string;
  };
}

interface ReviewerData {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface SectionDefinition {
  title: string;
  fields: Array<{ label: string; key: string }>;
}

interface AutoTableFooterRef {
  lastAutoTable?: {
    finalY: number;
  };
}

const FINANCIAL_KEYS = new Set([
  'project_cost',
  'pre_operative_expenses',
  'prototype_expenses',
  'test_marketing',
  'equipment',
  'working_capital',
  'other_requirements',
]);

export default function ApplicationDetail() {
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [references, setReferences] = useState<ReferenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [allReviewers, setAllReviewers] = useState<ReviewerData[]>([]);
  const [assignReviewerId, setAssignReviewerId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [expandedComment, setExpandedComment] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const fetchAssignments = useCallback(async () => {
    const { data } = await supabase
      .from('application_assignments')
      .select('*, reviewers(name, email)')
      .eq('application_id', applicationId)
      .order('assigned_at', { ascending: true });
    setAssignments(data || []);
  }, [applicationId]);

  const fetchReviewers = useCallback(async () => {
    const { data } = await supabase
      .from('reviewers')
      .select('id, name, email, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });
    setAllReviewers(data || []);
  }, []);

  const handleAssign = async () => {
    if (!assignReviewerId) return;
    setAssigning(true);
    try {
      const { error: insErr } = await supabase.from('application_assignments').insert([
        { application_id: applicationId, reviewer_id: assignReviewerId },
      ]);
      if (insErr) throw insErr;
      // Auto-set app status to under_review
      if (application && application.status === 'submitted') {
        await supabase
          .from('applications')
          .update({ status: 'under_review', updated_at: new Date().toISOString() })
          .eq('id', applicationId);
        setApplication((prev: ApplicationData | null) => prev ? { ...prev, status: 'under_review' } : prev);
        setStatus('under_review');
      }
      setAssignReviewerId('');
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign reviewer');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await supabase.from('application_assignments').delete().eq('id', assignmentId);
    await fetchAssignments();
  };

  const handleResetAssignment = async (assignmentId: string) => {
    if (!confirm('Reset this reviewer\'s assessment? Their scores and comments will be cleared and they can re-submit.')) return;
    await supabase
      .from('application_assignments')
      .update({ review_status: 'pending', review_comments: null, reviewed_at: null })
      .eq('id', assignmentId);
    // If the application was approved/rejected, bump it back to under_review
    if (application && (application.status === 'approved' || application.status === 'rejected')) {
      await supabase
        .from('applications')
        .update({ status: 'under_review', updated_at: new Date().toISOString() })
        .eq('id', applicationId);
      setApplication((prev: ApplicationData | null) => prev ? { ...prev, status: 'under_review' } : prev);
      setStatus('under_review');
    }
    await fetchAssignments();
  };

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const session = await getSafeSession();
        if (!session) {
          router.push('/admin/login');
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('applications')
          .select('*')
          .eq('id', applicationId)
          .single();

        if (fetchError) throw fetchError;
        
        setApplication(data);
        setStatus(data.status || 'submitted');
        setNotes(data.admin_notes || '');

        const { data: refsData } = await supabase
          .from('application_references')
          .select('*')
          .eq('application_id', applicationId)
          .order('reference_number', { ascending: true });

        setReferences(refsData || []);
        await fetchAssignments();
        await fetchReviewers();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load application');
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [applicationId, router, fetchAssignments, fetchReviewers]);

  const handleSaveNotes = async () => {
    if (!application) return;
    
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('applications')
        .update({ 
          status,
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        console.error('Supabase update error:', {
          message: updateError.message,
          code: updateError.code,
          details: (updateError as any).details,
          hint: (updateError as any).hint
        });
        throw updateError;
      }
      
      setApplication({ ...application, status, admin_notes: notes });
      setError(null);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading...</p>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Application not found</p>
        <Button
          onClick={() => router.back()}
          className="px-6 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700"
          style={{ fontFamily: 'var(--font-hanken-grotesk)' }}
        >
          Go Back
        </Button>
      </div>
    );
  }

  const sections: SectionDefinition[] = [
    {
      title: 'Business Information',
      fields: [
        { label: 'Business Name', key: 'business_name' },
        { label: 'Business Description', key: 'business_description' },
        { label: 'Stage of Startup', key: 'stage_of_startup' },
        { label: 'Legal Status', key: 'legal_status' },
        { label: 'Sector / Domain', key: 'sector_domain' },
        { label: 'Nature of Business', key: 'nature_of_business' },
        { label: 'Innovation Category', key: 'innovation_category' },
      ]
    },
    {
      title: 'Lead Entrepreneur Information',
      fields: [
        { label: 'Full Name', key: 'lead_name' },
        { label: 'Email', key: 'email' },
        { label: 'Mobile Phone', key: 'mobile_phone' },
        { label: 'Residential Phone', key: 'residential_phone' },
        { label: 'Age', key: 'age' },
        { label: 'SJCET Associated', key: 'sjcet_associated' },
        { label: 'SJCET Association Type', key: 'sjcet_association_type' },
      ]
    },
    {
      title: 'Address Information',
      fields: [
        { label: 'Postal Address', key: 'postal_address' },
        { label: 'City', key: 'city' },
        { label: 'State', key: 'state' },
        { label: 'Country', key: 'country' },
        { label: 'Postal Code', key: 'postal_code' },
      ]
    },
    {
      title: 'Educational Background',
      fields: [
        { label: 'Qualification', key: 'qualification' },
        { label: 'Specialization', key: 'specialization' },
        { label: 'Institute', key: 'institute' },
      ]
    },
    {
      title: 'Entrepreneurial Motivation',
      fields: [
        { label: 'Motivation', key: 'entrepreneurial_motivation' },
      ]
    },
    {
      title: 'Team Information',
      fields: [
        { label: 'Team Details', key: 'team_details' },
        { label: 'Company Description', key: 'company_description' },
      ]
    },
    {
      title: 'Product & Market Information',
      fields: [
        { label: 'Product Novelty', key: 'product_novelty' },
        { label: 'Competitors', key: 'competitors' },
        { label: 'Competitive Advantage', key: 'competitive_advantage' },
        { label: 'Market Size', key: 'market_size' },
        { label: 'Revenue Model', key: 'revenue_model' },
      ]
    },
    {
      title: 'Infrastructure & Resources',
      fields: [
        { label: 'Machinery Required', key: 'machinery_required' },
        { label: 'Machinery Details', key: 'machinery_details' },
        { label: 'Market Survey', key: 'market_survey' },
        { label: 'Market Survey Details', key: 'market_survey_details' },
        { label: 'Research Validation', key: 'research_validation' },
      ]
    },
    {
      title: 'Financial Projections',
      fields: [
        { label: 'Project Cost', key: 'project_cost' },
        { label: 'Pre-Operative Expenses', key: 'pre_operative_expenses' },
        { label: 'Prototype Expenses', key: 'prototype_expenses' },
        { label: 'Test Marketing', key: 'test_marketing' },
        { label: 'Equipment', key: 'equipment' },
        { label: 'Working Capital', key: 'working_capital' },
        { label: 'Other Requirements', key: 'other_requirements' },
      ]
    },
    {
      title: 'Services & Support',
      fields: [
        { label: 'Laboratory Access', key: 'laboratory_access' },
        { label: 'Library Access', key: 'library_access' },
        { label: 'Technical Consulting', key: 'technical_consulting' },
        { label: 'Services Expected', key: 'services_expected' },
        { label: 'Other Services', key: 'other_services' },
      ]
    },
    {
      title: 'Declaration',
      fields: [
        { label: 'Declaration Accepted', key: 'declaration' },
        { label: 'Declaration Date', key: 'declaration_date' },
        { label: 'Declaration Place', key: 'declaration_place' },
      ]
    }
  ];

  const statusColors: Record<string, string> = {
    submitted: '#9A9A9A',
    under_review: '#2AA0D3',
    approved: '#4CAF50',
    rejected: '#F44336'
  };

  // Format field values for display
  const formatFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    
    // Handle boolean fields
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'N/A';
    }
    
    // Handle date fields
    if (key.includes('date') && value) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    
    // Handle numeric fields
    if (key.includes('cost') || key.includes('expenses') || key.includes('price') || key.includes('capital')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }
    
    return String(value);
  };

  const parseNumericValue = (value: unknown): number | null => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/,/g, '').replace(/\s+/g, '').replace(/[^0-9.-]/g, '');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatIndianAmount = (amount: number): string => {
    const sign = amount < 0 ? '-' : '';
    const absolute = Math.abs(amount);
    const [integerPart, decimalPart] = absolute.toFixed(2).split('.');
    const lastThree = integerPart.slice(-3);
    const remaining = integerPart.slice(0, -3);
    const groupedRemaining = remaining ? `${remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},` : '';
    return `${sign}${groupedRemaining}${lastThree}.${decimalPart}`;
  };

  const formatPdfFieldValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }

    if (FINANCIAL_KEYS.has(key)) {
      const parsed = parseNumericValue(value);
      if (parsed !== null) {
        return `INR ${formatIndianAmount(parsed)}`;
      }
    }

    const baseValue = formatFieldValue(key, value);
    return baseValue.replace('₹', 'INR').replace(/\s+/g, ' ').trim();
  };

  const handleDownloadPdf = async () => {
    if (!application) return;

    setDownloadingPdf(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      const autoTable = autoTableModule.default;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const appNumber = formatApplicationNumber(application.id);
      const submittedAt = application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'N/A';
      const updatedAt = new Date(application.updated_at || application.created_at).toLocaleString();

      doc.setFillColor(245, 246, 247);
      doc.rect(0, 0, pageWidth, 120, 'F');

      doc.setTextColor(220, 38, 38);
      doc.setFontSize(20);
      doc.text('SIIF Incubation Application', 40, 46);

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(14);
      doc.text(application.business_name || 'Unnamed Business', 40, 70);

      doc.setTextColor(110, 110, 110);
      doc.setFontSize(10);
      doc.text(`Application No: ${appNumber}`, 40, 90);
      doc.text(`Status: ${(application.status || 'submitted').replace('_', ' ')}`, 220, 90);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 106);

      let currentY = 136;
      const marginX = 40;

      sections.forEach((section) => {
        const rows = section.fields.map((field) => [
          field.label,
          formatPdfFieldValue(field.key, application[field.key])
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [[section.title, 'Value']],
          body: rows,
          theme: 'grid',
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [255, 59, 59],
            textColor: 255,
            fontSize: 11,
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [60, 60, 60],
            cellPadding: 6,
            valign: 'top'
          },
          columnStyles: {
            0: { cellWidth: 170, fontStyle: 'bold', textColor: [90, 90, 90] },
            1: { cellWidth: 'auto' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
              data.cell.styles.lineColor = [232, 232, 232];
            }
          }
        });

        currentY = ((doc as AutoTableFooterRef).lastAutoTable?.finalY || currentY) + 14;
      });

      if (references.length > 0) {
        const canonicalizeReference = (ref: ReferenceData) => ({
          name: (ref.name || '').trim(),
          organization: (ref.organization || '').trim(),
          address: (ref.address || '').trim(),
          phone: (ref.phone || '').trim(),
          email: (ref.email || '').trim().toLowerCase(),
        });

        const uniqueReferenceMap = new Map<string, ReturnType<typeof canonicalizeReference>>();
        for (const ref of references) {
          const canonical = canonicalizeReference(ref);
          const identityKey = JSON.stringify(canonical);
          if (!uniqueReferenceMap.has(identityKey)) {
            uniqueReferenceMap.set(identityKey, canonical);
          }
        }

        const uniqueReferences = Array.from(uniqueReferenceMap.values()).slice(0, 2);
        const referenceRows = uniqueReferences.flatMap((ref, idx) => [
          [`Reference ${idx + 1} - Name`, ref.name || 'N/A'],
          ['Organization', ref.organization || 'N/A'],
          ['Address', ref.address || 'N/A'],
          ['Phone', ref.phone || 'N/A'],
          ['Email', ref.email || 'N/A']
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['References', 'Details']],
          body: referenceRows,
          theme: 'grid',
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [42, 160, 211],
            textColor: 255,
            fontSize: 11,
            halign: 'left'
          },
          bodyStyles: {
            fontSize: 10,
            textColor: [60, 60, 60],
            cellPadding: 6,
            valign: 'top'
          },
          columnStyles: {
            0: { cellWidth: 170, fontStyle: 'bold' },
            1: { cellWidth: 'auto' }
          }
        });

        currentY = ((doc as AutoTableFooterRef).lastAutoTable?.finalY || currentY) + 14;
      }

      autoTable(doc, {
        startY: currentY,
        head: [['Submission Details', 'Value']],
        body: [
          ['Submitted On', submittedAt],
          ['Last Updated', updatedAt],
          ['Admin Notes', notes || 'N/A']
        ],
        theme: 'grid',
        margin: { left: marginX, right: marginX },
        headStyles: {
          fillColor: [76, 175, 80],
          textColor: 255,
          fontSize: 11,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 10,
          textColor: [60, 60, 60],
          cellPadding: 6,
          valign: 'top'
        },
        columnStyles: {
          0: { cellWidth: 170, fontStyle: 'bold' },
          1: { cellWidth: 'auto' }
        }
      });

      const sanitizedName = String(application.business_name || 'application')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      doc.save(`siif-incubation-${sanitizedName || 'application'}-${appNumber}.pdf`);
    } catch (pdfError) {
      console.error('Failed to generate PDF:', pdfError);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-hanken-grotesk)' }}>
      {/* Header */}
      <div className="bg-[#F5F6F7] border-b border-gray-200 p-6 mb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <button
                onClick={() => router.back()}
                className="text-[#FF3B3B] hover:text-red-700 mb-2 flex items-center gap-2"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                ← Back to Dashboard
              </button>
              <h1
                className="text-3xl font-bold"
                style={{ color: '#FF3B3B', fontFamily: '"Hanken Grotesk", sans-serif' }}
              >
                {application.business_name}
              </h1>
              <p style={{ color: '#8A8A8A', fontSize: '14px', marginTop: '4px' }}>
                Application Number: {formatApplicationNumber(application.id)}
              </p>
            </div>
            <div className="text-right">
              <p style={{ color: '#8A8A8A', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                Current Status
              </p>
              <span
                className="px-4 py-2 rounded-full text-white font-semibold inline-block"
                style={{
                  backgroundColor: statusColors[application.status] || '#9A9A9A',
                  fontSize: '13px'
                }}
              >
                {application.status?.replace('_', ' ')}
              </span>
              <div className="mt-3">
                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="px-4 py-2 bg-[#2AA0D3] text-white rounded-lg hover:bg-[#2189b4]"
                  style={{ fontFamily: 'var(--font-hanken-grotesk)', fontSize: '13px' }}
                >
                  {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                </Button>
              </div>
            </div>
          </div>
          <AdminNav />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {error && (
          <div 
            className="mb-6 p-4 rounded-lg"
            style={{
              backgroundColor: '#FFE5E5',
              color: '#D32F2F',
              fontSize: '14px'
            }}
          >
            {error}
          </div>
        )}

        {/* Application Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            {sections.map((section, idx) => (
              <Card key={idx} className="border-0 shadow p-6">
                <h2 
                  className="text-xl font-bold mb-6"
                  style={{ color: '#FF3B3B', fontFamily: '"Hanken Grotesk", sans-serif' }}
                >
                  {section.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map((field) => (
                    <div key={field.key}>
                      <p 
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#8A8A8A',
                          textTransform: 'uppercase',
                          marginBottom: '4px'
                        }}
                      >
                        {field.label}
                      </p>
                      <p 
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#4A4A4A',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {formatFieldValue(field.key, application[field.key])}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            {/* References */}
            {references.length > 0 && (
              <Card className="border-0 shadow p-6">
                <h2
                  className="text-xl font-bold mb-6"
                  style={{ color: '#FF3B3B', fontFamily: '"Hanken Grotesk", sans-serif' }}
                >
                  References
                </h2>
                <div className="space-y-6">
                  {references.map((ref, idx) => (
                    <div key={ref.id} className="border border-gray-100 rounded-lg p-4">
                      <p
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#FF3B3B',
                          textTransform: 'uppercase',
                          marginBottom: '12px'
                        }}
                      >
                        Reference {ref.reference_number ?? idx + 1}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: 'Name', value: ref.name },
                          { label: 'Organization', value: ref.organization },
                          { label: 'Address', value: ref.address },
                          { label: 'Phone', value: ref.phone },
                          { label: 'Email', value: ref.email },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p
                              style={{
                                fontFamily: '"Hanken Grotesk", sans-serif',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#8A8A8A',
                                textTransform: 'uppercase',
                                marginBottom: '4px'
                              }}
                            >
                              {label}
                            </p>
                            <p
                              style={{
                                fontFamily: '"Hanken Grotesk", sans-serif',
                                fontSize: '14px',
                                color: '#4A4A4A',
                                wordBreak: 'break-word'
                              }}
                            >
                              {value || 'N/A'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Additional Info */}
            <Card className="border-0 shadow p-6">
              <h2 
                className="text-xl font-bold mb-6"
                style={{ color: '#FF3B3B', fontFamily: '"Hanken Grotesk", sans-serif' }}
              >
                Submission Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#8A8A8A',
                      textTransform: 'uppercase',
                      marginBottom: '4px'
                    }}
                  >
                    Submitted On
                  </p>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    {new Date(application.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#8A8A8A',
                      textTransform: 'uppercase',
                      marginBottom: '4px'
                    }}
                  >
                    Last Updated
                  </p>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '14px',
                      color: '#4A4A4A'
                    }}
                  >
                    {new Date(application.updated_at || application.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar - Status and Notes */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-0 shadow p-6">
              <h3 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4A4A4A',
                  marginBottom: '12px'
                }}
              >
                Update Status
              </h3>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-[#FF3B3B] mb-4 cursor-pointer hover:border-gray-400 transition-colors"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A',
                  backgroundColor: '#fff',
                  appearance: 'auto',
                  pointerEvents: 'auto',
                  zIndex: 10
                }}
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </Card>

            {/* Reviewers Assignment Card */}
            <Card className="border-0 shadow p-6">
              <h3
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4A4A4A',
                  marginBottom: '12px',
                }}
              >
                Reviewer Assessments
              </h3>

              {/* Currently assigned reviewers */}
              {assignments.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#8A8A8A', marginBottom: '12px' }}>
                  No reviewers assigned yet.
                </p>
              ) : (
                <div className="space-y-3 mb-4">
                  {assignments.map((a) => {
                    // Parse structured review from review_comments JSON
                    let structured: any = null;
                    if (a.review_comments) {
                      try {
                        const parsed = JSON.parse(a.review_comments);
                        if (parsed && parsed.__structured) structured = parsed;
                      } catch { /* plain text */ }
                    }

                    const RECOMMENDATIONS_MAP: Record<string, { label: string; color: string }> = {
                      strongly_recommended: { label: 'Strongly Recommended', color: '#2E7D32' },
                      recommended: { label: 'Recommended', color: '#4CAF50' },
                      recommended_with_conditions: { label: 'Recommended with Conditions', color: '#F57C00' },
                      needs_improvement: { label: 'Needs Improvement', color: '#FFA726' },
                      rejected: { label: 'Rejected', color: '#D32F2F' },
                    };

                    const CRITERIA_KEYS = [
                      'innovationLevel', 'technicalFeasibility', 'teamCapability',
                      'marketPotential', 'scalability', 'commitmentLevel', 'resourceFit',
                      'researchDepth', 'studentInclusion', 'nocCompliance', 'conflictOfInterestRisk',
                      'coachability', 'prototypeProgress', 'learningPotential',
                      'productReadiness', 'revenuePotential', 'executionRecord', 'strategicFit',
                    ];
                    const CRITERIA_LABELS: Record<string, string> = {
                      innovationLevel: 'Innovation', technicalFeasibility: 'Tech Feasibility',
                      teamCapability: 'Team', marketPotential: 'Market',
                      scalability: 'Scalability', commitmentLevel: 'Commitment',
                      resourceFit: 'Resource Fit', researchDepth: 'Research Depth',
                      studentInclusion: 'Student Inclusion', nocCompliance: 'NOC',
                      conflictOfInterestRisk: 'COI Risk', coachability: 'Coachability',
                      prototypeProgress: 'Prototype', learningPotential: 'Learning',
                      productReadiness: 'Product Ready', revenuePotential: 'Revenue',
                      executionRecord: 'Execution', strategicFit: 'Strategic Fit',
                    };

                    const ratedCriteria = structured
                      ? CRITERIA_KEYS.filter((k) => structured[k]?.score > 0)
                      : [];
                    const totalScore = ratedCriteria.reduce((sum, k) => sum + (structured?.[k]?.score ?? 0), 0);
                    const maxScore = ratedCriteria.length * 5;
                    const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
                    const recInfo = structured?.recommendation ? RECOMMENDATIONS_MAP[structured.recommendation] : null;

                    return (
                      <div key={a.id} className="rounded-lg border border-gray-200 overflow-hidden">
                        {/* Header row */}
                        <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: '#F5F6F7' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>{a.reviewers?.name}</p>
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-white mt-0.5"
                              style={{ fontSize: '10px', fontWeight: 600, backgroundColor: a.review_status === 'completed' ? '#4CAF50' : a.review_status === 'in_progress' ? '#2AA0D3' : '#FFA726' }}
                            >
                              {a.review_status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {maxScore > 0 && (
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FF3B3B' }}>{pct}%</span>
                            )}
                            <button onClick={() => setExpandedComment(expandedComment === a.id ? null : a.id)}
                              style={{ fontSize: '11px', color: '#2AA0D3', fontWeight: 600 }}>
                              {expandedComment === a.id ? 'Hide' : 'Details'}
                            </button>
                            {a.review_status === 'completed' && (
                              <button onClick={() => handleResetAssignment(a.id)}
                                style={{ fontSize: '11px', color: '#F57C00', fontWeight: 600 }}>
                                Reset
                              </button>
                            )}
                            <button onClick={() => handleRemoveAssignment(a.id)}
                              style={{ fontSize: '11px', color: '#F44336', fontWeight: 600 }}>
                              Remove
                            </button>
                          </div>
                        </div>

                        {/* Recommendation badge (if submitted) */}
                        {recInfo && (
                          <div className="px-3 py-1.5" style={{ backgroundColor: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
                            <span className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: recInfo.color }}>
                              {recInfo.label}
                            </span>
                          </div>
                        )}

                        {/* Expanded detail */}
                        {expandedComment === a.id && (
                          <div className="px-3 py-3 space-y-3" style={{ backgroundColor: '#EEF6FF', borderTop: '1px solid #D0E8FF' }}>
                            {/* Score breakdown */}
                            {ratedCriteria.length > 0 && (
                              <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '6px' }}>
                                  Scores ({totalScore}/{maxScore})
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  {ratedCriteria.map((k) => (
                                    <div key={k} className="flex justify-between">
                                      <span style={{ fontSize: '11px', color: '#6B7280' }}>{CRITERIA_LABELS[k]}</span>
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF3B3B' }}>
                                        {'★'.repeat(structured[k].score)}{'☆'.repeat(5 - structured[k].score)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Feedback sections */}
                            {structured && (['businessFeedback', 'teamFeedback', 'marketFeedback'] as const).map((fbKey) => {
                              const fb = structured[fbKey];
                              const fbLabels: Record<string, string> = {
                                businessFeedback: 'Business & Innovation',
                                teamFeedback: 'Team',
                                marketFeedback: 'Market & Growth',
                              };
                              const hasContent = fb && (fb.strengths || fb.weaknesses || fb.risks || fb.suggestions);
                              if (!hasContent) return null;
                              return (
                                <div key={fbKey}>
                                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {fbLabels[fbKey]}
                                  </p>
                                  {fb.strengths && <p style={{ fontSize: '12px', color: '#2E7D32' }}><strong>+</strong> {fb.strengths}</p>}
                                  {fb.weaknesses && <p style={{ fontSize: '12px', color: '#C62828' }}><strong>−</strong> {fb.weaknesses}</p>}
                                  {fb.risks && <p style={{ fontSize: '12px', color: '#E65100' }}><strong>⚠</strong> {fb.risks}</p>}
                                  {fb.suggestions && <p style={{ fontSize: '12px', color: '#1565C0' }}><strong>→</strong> {fb.suggestions}</p>}
                                </div>
                              );
                            })}

                            {/* Final comment */}
                            {structured?.finalComment && (
                              <div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  Final Comment
                                </p>
                                <p style={{ fontSize: '12px', color: '#4A4A4A', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                  {structured.finalComment}
                                </p>
                              </div>
                            )}

                            {/* Fallback for plain-text comments */}
                            {!structured && a.review_comments && (
                              <p style={{ fontSize: '12px', color: '#4A4A4A', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {a.review_comments}
                              </p>
                            )}

                            {a.reviewed_at && (
                              <p style={{ fontSize: '11px', color: '#8A8A8A' }}>
                                Reviewed on {new Date(a.reviewed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Assign new reviewer */}
              {(() => {
                const assignedIds = assignments.map((a) => a.reviewer_id);
                const available = allReviewers.filter((r) => !assignedIds.includes(r.id));
                if (available.length === 0) return null;
                return (
                  <div className="flex gap-2 mt-2">
                    <select
                      value={assignReviewerId}
                      onChange={(e) => setAssignReviewerId(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                      style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}
                    >
                      <option value="">Select reviewer…</option>
                      {available.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={!assignReviewerId || assigning}
                      className="px-4 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50"
                    >
                      {assigning ? '…' : 'Assign'}
                    </button>
                  </div>
                );
              })()}
            </Card>

            {/* Notes Card */}
            <Card className="border-0 shadow p-6">
              <h3 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4A4A4A',
                  marginBottom: '12px'
                }}
              >
                Review Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes about this application..."
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#FF3B3B] focus:border-[#FF3B3B] mb-4 hover:border-gray-400 transition-colors"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  color: '#4A4A4A',
                  minHeight: '150px',
                  resize: 'vertical',
                  backgroundColor: '#fff'
                }}
              />
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="w-full px-4 py-3 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </Card>

            {/* Contact Card */}
            <Card className="border-0 shadow p-6">
              <h3 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#4A4A4A',
                  marginBottom: '12px'
                }}
              >
                Contact Information
              </h3>
              <div className="space-y-3">
                <div>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#8A8A8A',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}
                  >
                    Email
                  </p>
                  <a 
                    href={`mailto:${application.email}`}
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      color: '#FF3B3B',
                      textDecoration: 'none',
                      wordBreak: 'break-all'
                    }}
                    className="hover:underline"
                  >
                    {application.email}
                  </a>
                </div>
                <div>
                  <p 
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#8A8A8A',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}
                  >
                    Phone
                  </p>
                  <a 
                    href={`tel:${application.mobile_phone}`}
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      color: '#FF3B3B',
                      textDecoration: 'none'
                    }}
                    className="hover:underline"
                  >
                    {application.mobile_phone || 'N/A'}
                  </a>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
