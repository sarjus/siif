'use client';

// ─── SIIF Reviewer Portal — Structured Assessment ────────────────────────────

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, formatApplicationNumber, getSafeSession } from '@/lib/supabase';
import { Card } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplicationData {
  [key: string]: any;
}

interface CriterionScore {
  score: number; // 1–5, 0 = not rated
  remarks: string;
}

interface SectionFeedback {
  strengths: string;
  weaknesses: string;
  risks: string;
  suggestions: string;
}

interface ReviewData {
  // Common criteria
  innovationLevel: CriterionScore;
  technicalFeasibility: CriterionScore;
  teamCapability: CriterionScore;
  marketPotential: CriterionScore;
  scalability: CriterionScore;
  commitmentLevel: CriterionScore;
  resourceFit: CriterionScore;
  // Faculty-specific
  researchDepth: CriterionScore;
  studentInclusion: CriterionScore;
  nocCompliance: CriterionScore;
  conflictOfInterestRisk: CriterionScore;
  // Student-specific
  coachability: CriterionScore;
  prototypeProgress: CriterionScore;
  learningPotential: CriterionScore;
  // Alumni/External-specific
  productReadiness: CriterionScore;
  revenuePotential: CriterionScore;
  executionRecord: CriterionScore;
  strategicFit: CriterionScore;
  // Section feedback
  businessFeedback: SectionFeedback;
  teamFeedback: SectionFeedback;
  marketFeedback: SectionFeedback;
  // Final
  recommendation: string;
  finalComment: string;
  // Marker
  __structured?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_SCORE: CriterionScore = { score: 0, remarks: '' };
const EMPTY_FEEDBACK: SectionFeedback = { strengths: '', weaknesses: '', risks: '', suggestions: '' };

const DEFAULT_REVIEW: ReviewData = {
  innovationLevel: { ...EMPTY_SCORE },
  technicalFeasibility: { ...EMPTY_SCORE },
  teamCapability: { ...EMPTY_SCORE },
  marketPotential: { ...EMPTY_SCORE },
  scalability: { ...EMPTY_SCORE },
  commitmentLevel: { ...EMPTY_SCORE },
  resourceFit: { ...EMPTY_SCORE },
  researchDepth: { ...EMPTY_SCORE },
  studentInclusion: { ...EMPTY_SCORE },
  nocCompliance: { ...EMPTY_SCORE },
  conflictOfInterestRisk: { ...EMPTY_SCORE },
  coachability: { ...EMPTY_SCORE },
  prototypeProgress: { ...EMPTY_SCORE },
  learningPotential: { ...EMPTY_SCORE },
  productReadiness: { ...EMPTY_SCORE },
  revenuePotential: { ...EMPTY_SCORE },
  executionRecord: { ...EMPTY_SCORE },
  strategicFit: { ...EMPTY_SCORE },
  businessFeedback: { ...EMPTY_FEEDBACK },
  teamFeedback: { ...EMPTY_FEEDBACK },
  marketFeedback: { ...EMPTY_FEEDBACK },
  recommendation: '',
  finalComment: '',
};

const RECOMMENDATIONS = [
  { value: 'strongly_recommended', label: 'Strongly Recommended', color: '#2E7D32' },
  { value: 'recommended', label: 'Recommended', color: '#4CAF50' },
  { value: 'recommended_with_conditions', label: 'Recommended with Conditions', color: '#F57C00' },
  { value: 'needs_improvement', label: 'Needs Improvement Before Admission', color: '#FFA726' },
  { value: 'rejected', label: 'Rejected', color: '#D32F2F' },
];

const COMMON_CRITERIA: { key: keyof ReviewData; label: string; description: string }[] = [
  { key: 'innovationLevel', label: 'Innovation Level', description: 'Originality and uniqueness of the solution' },
  { key: 'technicalFeasibility', label: 'Technical Feasibility', description: 'Can the product be realistically built with available resources?' },
  { key: 'teamCapability', label: 'Team Capability', description: 'Skills, diversity, and execution ability of the founding team' },
  { key: 'marketPotential', label: 'Market Potential', description: 'Size, demand, and reachability of the target market' },
  { key: 'scalability', label: 'Scalability', description: 'Can the startup grow beyond its initial scope?' },
  { key: 'commitmentLevel', label: 'Commitment Level', description: 'Seriousness and dedication of founders' },
  { key: 'resourceFit', label: 'Resource Fit with SIIF', description: 'How well the startup can utilise SIIF infrastructure and support' },
];

const FACULTY_CRITERIA: { key: keyof ReviewData; label: string; description: string }[] = [
  { key: 'researchDepth', label: 'Research Depth', description: 'Venture arises from original research or specialised expertise' },
  { key: 'studentInclusion', label: 'Student Inclusion', description: 'Involvement of students or alumni as co-founders' },
  { key: 'nocCompliance', label: 'NOC Compliance', description: 'Written No Objection Certificate from the College provided' },
  { key: 'conflictOfInterestRisk', label: 'Conflict of Interest Risk', description: 'Lower score = lower conflict risk (reverse scale)' },
];

const STUDENT_CRITERIA: { key: keyof ReviewData; label: string; description: string }[] = [
  { key: 'coachability', label: 'Coachability', description: 'Receptiveness to feedback and mentoring' },
  { key: 'prototypeProgress', label: 'Prototype Progress', description: 'Evidence of prototypes, surveys, pilots, or early validation' },
  { key: 'learningPotential', label: 'Learning Potential', description: 'Curiosity and potential to grow through incubation' },
];

const ALUMNI_EXTERNAL_CRITERIA: { key: keyof ReviewData; label: string; description: string }[] = [
  { key: 'productReadiness', label: 'Product Readiness', description: 'Prototype, MVP, or market-ready offering exists' },
  { key: 'revenuePotential', label: 'Revenue Potential', description: 'Clear and realistic path to monetisation' },
  { key: 'executionRecord', label: 'Execution Record', description: 'Prior experience, traction, or industry exposure' },
  { key: 'strategicFit', label: 'Strategic Fit with SIIF', description: 'Alignment with SJCET/SIIF values and ecosystem goals' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryFromApplication(app: ApplicationData | null): 'faculty' | 'student' | 'alumni_external' | 'unknown' {
  if (!app) return 'unknown';
  const assocType = (app.sjcet_association_type || '').toString().toLowerCase();
  if (assocType.includes('faculty') || assocType.includes('staff')) return 'faculty';
  if (assocType.includes('student')) return 'student';
  if (assocType.includes('alumni')) return 'alumni_external';
  const stage = (app.stage_of_startup || '').toString().toLowerCase();
  if (stage.includes('idea') || stage.includes('prototype')) return 'student';
  return 'alumni_external';
}

function computeScores(review: ReviewData, category: ReturnType<typeof categoryFromApplication>) {
  const scoreOf = (k: keyof ReviewData) => {
    const c = review[k] as CriterionScore;
    return typeof c?.score === 'number' ? c.score : 0;
  };
  const commonRated = COMMON_CRITERIA.map((c) => c.key).map(scoreOf).filter((s) => s > 0);
  const commonTotal = commonRated.reduce((a, b) => a + b, 0);
  const commonMax = commonRated.length * 5;

  const specificCriteria = category === 'faculty' ? FACULTY_CRITERIA
    : category === 'student' ? STUDENT_CRITERIA
    : ALUMNI_EXTERNAL_CRITERIA;
  const specificLabel = category === 'faculty' ? 'Faculty Criteria'
    : category === 'student' ? 'Student Criteria'
    : 'Alumni/External Criteria';
  const specificRated = specificCriteria.map((c) => c.key).map(scoreOf).filter((s) => s > 0);
  const specificTotal = specificRated.reduce((a, b) => a + b, 0);
  const specificMax = specificRated.length * 5;

  const allRated = [...commonRated, ...specificRated];
  const totalScore = allRated.reduce((a, b) => a + b, 0);
  const maxScore = allRated.length * 5;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  return { commonTotal, commonMax, specificTotal, specificMax, specificLabel, totalScore, maxScore, percentage };
}

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'N/A';
  if ((key.includes('cost') || key.includes('capital') || key.includes('expenses')) && !isNaN(parseFloat(value))) {
    return `₹ ${parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }
  return String(value);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', color: '#2D2D2D', lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {value}
      </p>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star === value ? 0 : star)}
          style={{ fontSize: '22px', lineHeight: 1, color: star <= value ? '#FF3B3B' : '#D1D5DB', background: 'none', border: 'none', cursor: 'pointer' }}>
          ★
        </button>
      ))}
      {value > 0 && <span style={{ fontSize: '12px', color: '#8A8A8A', marginLeft: '4px' }}>{value}/5</span>}
    </div>
  );
}

function CriteriaBlock({
  title, criteria, review, onChange, accent,
}: {
  title: string;
  criteria: { key: keyof ReviewData; label: string; description: string }[];
  review: ReviewData;
  onChange: (key: keyof ReviewData, field: keyof CriterionScore, value: any) => void;
  accent: string;
}) {
  return (
    <Card className="border-0 shadow p-6 mb-4">
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: accent, marginBottom: '16px' }}>{title}</h3>
      <div className="space-y-5">
        {criteria.map(({ key, label, description }) => {
          const val = review[key] as CriterionScore;
          return (
            <div key={key as string} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-start mb-1 gap-2">
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{label}</p>
                  <p style={{ fontSize: '11px', color: '#8A8A8A', marginTop: '2px' }}>{description}</p>
                </div>
                <StarRating value={val?.score ?? 0} onChange={(v) => onChange(key, 'score', v)} />
              </div>
              <textarea
                value={val?.remarks ?? ''}
                onChange={(e) => onChange(key, 'remarks', e.target.value)}
                placeholder="Remarks (optional)"
                rows={2}
                className="w-full mt-2 rounded border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF3B3B] focus:border-transparent resize-none"
                style={{ color: '#4A4A4A', backgroundColor: '#FAFAFA' }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FeedbackBlock({
  title, feedbackKey, review, onChange,
}: {
  title: string;
  feedbackKey: 'businessFeedback' | 'teamFeedback' | 'marketFeedback';
  review: ReviewData;
  onChange: (key: 'businessFeedback' | 'teamFeedback' | 'marketFeedback', field: keyof SectionFeedback, value: string) => void;
}) {
  const fb = review[feedbackKey] as SectionFeedback;
  const fields: { field: keyof SectionFeedback; label: string; placeholder: string }[] = [
    { field: 'strengths', label: 'Strengths', placeholder: 'Key strengths of this aspect…' },
    { field: 'weaknesses', label: 'Weaknesses', placeholder: 'Gaps or weaknesses observed…' },
    { field: 'risks', label: 'Risks', placeholder: 'Risks during incubation…' },
    { field: 'suggestions', label: 'Suggestions for Improvement', placeholder: 'Specific recommendations for the team…' },
  ];
  return (
    <Card className="border-0 shadow p-6 mb-4">
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FF3B3B', marginBottom: '16px' }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(({ field, label, placeholder }) => (
          <div key={field}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              {label}
            </label>
            <textarea value={fb[field]} onChange={(e) => onChange(feedbackKey, field, e.target.value)}
              placeholder={placeholder} rows={3}
              className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF3B3B] focus:border-transparent resize-none"
              style={{ color: '#4A4A4A', backgroundColor: '#FAFAFA' }}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '12px', color, fontWeight: 700 }}>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReviewerApplicationPage() {
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [review, setReview] = useState<ReviewData>(DEFAULT_REVIEW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'application' | 'assessment'>('application');
  const isSubmitted = reviewStatus === 'completed';
  const isInProgress = reviewStatus === 'in_progress';

  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const fetchData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }

      const { data: reviewerData } = await supabase
        .from('reviewers').select('id').eq('user_id', session.user.id).maybeSingle();
      if (!reviewerData) { router.push('/login'); return; }

      const { data: appData, error: appErr } = await supabase
        .from('applications').select('*').eq('id', applicationId).single();
      if (appErr) throw appErr;
      setApplication(appData);

      const { data: assignData, error: assignErr } = await supabase
        .from('application_assignments')
        .select('id, review_status, review_comments')
        .eq('application_id', applicationId)
        .eq('reviewer_id', reviewerData.id)
        .maybeSingle();
      if (assignErr) throw assignErr;
      if (!assignData) { setError('You are not assigned to review this application.'); return; }

      setAssignmentId(assignData.id);
      setReviewStatus(assignData.review_status || 'pending');

      if (assignData.review_comments) {
        try {
          const parsed = JSON.parse(assignData.review_comments);
          if (parsed && parsed.__structured) {
            setReview({ ...DEFAULT_REVIEW, ...parsed });
          }
        } catch { /* legacy plain-text — ignore */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, [applicationId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateCriterion = (key: keyof ReviewData, field: keyof CriterionScore, value: any) => {
    setSaved(false);
    setSubmitted(false);
    setReview((prev) => ({ ...prev, [key]: { ...(prev[key] as CriterionScore), [field]: value } }));
  };

  const updateFeedback = (
    key: 'businessFeedback' | 'teamFeedback' | 'marketFeedback',
    field: keyof SectionFeedback,
    value: string
  ) => {
    setSaved(false);
    setSubmitted(false);
    setReview((prev) => ({ ...prev, [key]: { ...(prev[key] as SectionFeedback), [field]: value } }));
  };

  const handleSave = async (finalSubmit = false) => {
    if (!assignmentId) return;
    setSaving(true); setSaved(false); setSubmitted(false);
    try {
      const payload = { ...review, __structured: true };
      const newStatus = finalSubmit ? 'completed' : (reviewStatus === 'pending' ? 'in_progress' : reviewStatus);
      const { error: updateErr } = await supabase
        .from('application_assignments')
        .update({
          review_status: newStatus,
          review_comments: JSON.stringify(payload),
          reviewed_at: finalSubmit ? new Date().toISOString() : null,
        })
        .eq('id', assignmentId);
      if (updateErr) throw updateErr;
      setReviewStatus(newStatus);
      if (finalSubmit) {
        setSubmitted(true);
      } else {
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ──
  const category = categoryFromApplication(application);
  const scores = computeScores(review, category);
  const recObj = RECOMMENDATIONS.find((r) => r.value === review.recommendation);
  const reviewStatusColors: Record<string, string> = { pending: '#FFA726', in_progress: '#2AA0D3', completed: '#4CAF50' };
  const categoryLabel = category === 'faculty' ? 'Faculty Startup' : category === 'student' ? 'Student Startup' : 'Alumni / External Startup';
  const categoryColor = category === 'faculty' ? '#7B1FA2' : category === 'student' ? '#1565C0' : '#00695C';

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>

      {/* ── Sticky Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <div>
            <button onClick={() => router.push('/reviewer/dashboard')}
              className="text-[#FF3B3B] hover:text-red-700 text-sm font-medium flex items-center gap-1 mb-1">
              ← Back to My Reviews
            </button>
            <h1 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
              {application?.business_name ?? 'Application'}
            </h1>
            <p style={{ fontSize: '12px', color: '#8A8A8A', marginTop: '2px' }}>
              Application Number: {application ? formatApplicationNumber(application.id) : 'N/A'}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span style={{ fontSize: '13px', color: '#6B7280' }}>{application?.lead_name}</span>
              <span className="px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: categoryColor }}>
                {categoryLabel}
              </span>
              <span className="px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: reviewStatusColors[reviewStatus] || '#9A9A9A' }}>
                {reviewStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving || !assignmentId || isSubmitted}
              className="px-4 py-2 rounded-lg border-2 border-[#FF3B3B] text-[#FF3B3B] font-semibold text-sm hover:bg-red-50 disabled:opacity-50 transition-all">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => handleSave(true)}
              disabled={saving || !assignmentId || !review.recommendation || !review.finalComment.trim() || isSubmitted}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${isSubmitted ? 'bg-green-500 text-white cursor-default hover:bg-green-500' : 'bg-[#FF3B3B] text-white hover:bg-red-700 disabled:opacity-50'}`}
              title={isSubmitted ? 'Review already submitted' : !review.recommendation ? 'Select a recommendation to submit' : !review.finalComment.trim() ? 'Add a final comment to submit' : ''}>
              {isSubmitted ? '✓ Submitted' : saving ? 'Submitting…' : 'Submit Final Review'}
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto mt-3 flex border-b border-gray-200">
          {(['application', 'assessment'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-5 py-2 text-sm font-semibold capitalize transition-colors"
              style={{ borderBottom: activeTab === tab ? '2px solid #FF3B3B' : '2px solid transparent', color: activeTab === tab ? '#FF3B3B' : '#6B7280', marginBottom: '-1px' }}>
              {tab === 'application' ? 'Application Details' : 'Review & Assessment'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-5 p-4 rounded-lg text-sm" style={{ backgroundColor: '#FFE5E5', color: '#D32F2F' }}>{error}</div>
        )}
        {submitted && (
          <div className="mb-5 p-4 rounded-lg text-sm font-medium" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>✓ Review submitted successfully!</div>
            <div style={{ fontSize: '13px', marginTop: '4px', opacity: 0.9 }}>Your assessment has been recorded and the application status is now marked as completed.</div>
          </div>
        )}
        {saved && !submitted && (
          <div className="mb-5 p-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#E3F2FD', color: '#1565C0' }}>
            ✓ Draft saved — you can continue editing
          </div>
        )}

        {/* ══ APPLICATION TAB ══ */}
        {activeTab === 'application' && application && (
          <div className="space-y-4">
            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Startup Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <InfoField label="Startup Name" value={formatValue('business_name', application.business_name)} />
                <InfoField label="Stage of Startup" value={formatValue('stage_of_startup', application.stage_of_startup)} />
                <InfoField label="Legal Status" value={formatValue('legal_status', application.legal_status)} />
                <InfoField label="Sector / Domain" value={formatValue('sector_domain', application.sector_domain)} />
                <InfoField label="Nature of Business" value={formatValue('nature_of_business', application.nature_of_business)} />
                <InfoField label="Innovation Category" value={formatValue('innovation_category', application.innovation_category)} />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoField label="Business Description" value={formatValue('business_description', application.business_description)} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Founder Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <InfoField label="Lead Entrepreneur" value={formatValue('lead_name', application.lead_name)} />
                <InfoField label="Email" value={formatValue('email', application.email)} />
                <InfoField label="Phone" value={formatValue('mobile_phone', application.mobile_phone)} />
                <InfoField label="Age" value={formatValue('age', application.age)} />
                <InfoField label="SJCET Associated" value={formatValue('sjcet_associated', application.sjcet_associated)} />
                <InfoField label="Association Type" value={formatValue('sjcet_association_type', application.sjcet_association_type)} />
                <InfoField label="Qualification" value={formatValue('qualification', application.qualification)} />
                <InfoField label="Specialization" value={formatValue('specialization', application.specialization)} />
                <InfoField label="Institute" value={formatValue('institute', application.institute)} />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoField label="Entrepreneurial Motivation" value={formatValue('entrepreneurial_motivation', application.entrepreneurial_motivation)} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Team</h2>
              <div className="grid grid-cols-1 gap-5">
                <InfoField label="Team Details" value={formatValue('team_details', application.team_details)} />
                <InfoField label="Company Description" value={formatValue('company_description', application.company_description)} />
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Problem, Solution & Market</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoField label="Product / Solution Novelty" value={formatValue('product_novelty', application.product_novelty)} />
                <InfoField label="Competitors" value={formatValue('competitors', application.competitors)} />
                <InfoField label="Competitive Advantage" value={formatValue('competitive_advantage', application.competitive_advantage)} />
                <InfoField label="Market Size" value={formatValue('market_size', application.market_size)} />
                <InfoField label="Revenue Model" value={formatValue('revenue_model', application.revenue_model)} />
                <InfoField label="Market Survey Done" value={formatValue('market_survey', application.market_survey)} />
                <div className="md:col-span-2">
                  <InfoField label="Market Survey Details" value={formatValue('market_survey_details', application.market_survey_details)} />
                </div>
                <div className="md:col-span-2">
                  <InfoField label="Research Validation" value={formatValue('research_validation', application.research_validation)} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Prototype / MVP Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoField label="Machinery Required" value={formatValue('machinery_required', application.machinery_required)} />
                <InfoField label="Machinery Details" value={formatValue('machinery_details', application.machinery_details)} />
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Funding Requirement</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <InfoField label="Project Cost" value={formatValue('project_cost', application.project_cost)} />
                <InfoField label="Pre-Operative Expenses" value={formatValue('pre_operative_expenses', application.pre_operative_expenses)} />
                <InfoField label="Prototype Expenses" value={formatValue('prototype_expenses', application.prototype_expenses)} />
                <InfoField label="Test Marketing" value={formatValue('test_marketing', application.test_marketing)} />
                <InfoField label="Equipment" value={formatValue('equipment', application.equipment)} />
                <InfoField label="Working Capital" value={formatValue('working_capital', application.working_capital)} />
                <div className="md:col-span-2 lg:col-span-3">
                  <InfoField label="Other Requirements" value={formatValue('other_requirements', application.other_requirements)} />
                </div>
              </div>
            </Card>

            <Card className="border-0 shadow p-6">
              <h2 className="text-base font-bold mb-5" style={{ color: '#FF3B3B' }}>Services & Infrastructure Expected</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <InfoField label="Laboratory Access" value={formatValue('laboratory_access', application.laboratory_access)} />
                <InfoField label="Library Access" value={formatValue('library_access', application.library_access)} />
                <InfoField label="Technical Consulting" value={formatValue('technical_consulting', application.technical_consulting)} />
                <InfoField label="Services Expected" value={formatValue('services_expected', application.services_expected)} />
                <div className="md:col-span-2">
                  <InfoField label="Other Services" value={formatValue('other_services', application.other_services)} />
                </div>
              </div>
            </Card>

            <div className="pt-2 text-center">
              <button onClick={() => setActiveTab('assessment')}
                className="px-8 py-3 bg-[#FF3B3B] text-white rounded-lg font-semibold hover:bg-red-700 transition-all">
                Proceed to Assessment →
              </button>
            </div>
          </div>
        )}

        {/* ══ ASSESSMENT TAB ══ */}
        {activeTab === 'assessment' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — criteria & feedback */}
            <div className="lg:col-span-2">
              <CriteriaBlock title="Common Evaluation Criteria" criteria={COMMON_CRITERIA} review={review} onChange={updateCriterion} accent="#FF3B3B" />

              {category === 'faculty' && (
                <CriteriaBlock title="Faculty Startup Criteria" criteria={FACULTY_CRITERIA} review={review} onChange={updateCriterion} accent="#7B1FA2" />
              )}
              {category === 'student' && (
                <CriteriaBlock title="Student Startup Criteria" criteria={STUDENT_CRITERIA} review={review} onChange={updateCriterion} accent="#1565C0" />
              )}
              {(category === 'alumni_external' || category === 'unknown') && (
                <CriteriaBlock title="Alumni / External Startup Criteria" criteria={ALUMNI_EXTERNAL_CRITERIA} review={review} onChange={updateCriterion} accent="#00695C" />
              )}

              <FeedbackBlock title="Business & Innovation Feedback" feedbackKey="businessFeedback" review={review} onChange={updateFeedback} />
              <FeedbackBlock title="Team Feedback" feedbackKey="teamFeedback" review={review} onChange={updateFeedback} />
              <FeedbackBlock title="Market & Growth Feedback" feedbackKey="marketFeedback" review={review} onChange={updateFeedback} />

              {/* Final Recommendation */}
              <Card className="border-0 shadow p-6">
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FF3B3B', marginBottom: '16px' }}>Final Recommendation</h3>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Decision
                </label>
                <select value={review.recommendation}
                  onChange={(e) => { setSaved(false); setReview((p) => ({ ...p, recommendation: e.target.value })); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm mb-4 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{ color: recObj?.color ?? '#4A4A4A', fontWeight: 600 }}>
                  <option value="">— Select a recommendation —</option>
                  {RECOMMENDATIONS.map((r) => (
                    <option key={r.value} value={r.value} style={{ color: r.color }}>{r.label}</option>
                  ))}
                </select>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Final Comment <span style={{ color: '#D32F2F' }}>*</span>
                </label>
                <textarea value={review.finalComment}
                  onChange={(e) => { setSaved(false); setReview((p) => ({ ...p, finalComment: e.target.value })); }}
                  placeholder="Comprehensive summary of your review, key observations, and recommendation rationale…"
                  rows={5}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:ring-1 focus:ring-[#FF3B3B] focus:border-transparent"
                  style={{ color: '#4A4A4A', backgroundColor: '#FAFAFA', resize: 'vertical' }}
                />
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  Required before submitting final review.
                </p>
              </Card>
            </div>

            {/* Right — Score Summary (sticky) */}
            <div>
              <div className="sticky top-[150px] space-y-4">
                {/* Score summary */}
                <Card className="border-0 shadow p-6">
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#FF3B3B', marginBottom: '16px' }}>Score Summary</h3>
                  {/* Circular progress */}
                  <div className="flex flex-col items-center mb-5">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
                      style={{ background: `conic-gradient(#FF3B3B ${scores.percentage * 3.6}deg, #F3F4F6 0deg)` }}>
                      <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center">
                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#FF3B3B' }}>{scores.percentage}%</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>{scores.totalScore} / {scores.maxScore} pts</p>
                  </div>
                  <div className="space-y-3">
                    <ScoreBar label="Common Criteria" score={scores.commonTotal} max={scores.commonMax} color="#FF3B3B" />
                    {scores.specificMax > 0 && (
                      <ScoreBar label={scores.specificLabel} score={scores.specificTotal} max={scores.specificMax} color={categoryColor} />
                    )}
                  </div>
                </Card>

                {/* Recommendation badge */}
                {review.recommendation && (
                  <Card className="border-0 shadow p-5">
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#8A8A8A', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Your Recommendation
                    </p>
                    <span className="inline-block px-3 py-1.5 rounded-full text-white text-sm font-bold" style={{ backgroundColor: recObj?.color }}>
                      {recObj?.label}
                    </span>
                  </Card>
                )}

                {/* Review status */}
                <Card className="border-0 shadow p-5">
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Review Progress
                  </label>
                  <select value={reviewStatus} onChange={(e) => { setSaved(false); setReviewStatus(e.target.value); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    style={{ color: '#4A4A4A' }}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </Card>

                {/* Action buttons */}
                <div className="space-y-2">
                  <button onClick={() => handleSave(false)} disabled={saving || !assignmentId}
                    className="w-full py-2.5 rounded-lg border-2 border-[#FF3B3B] text-[#FF3B3B] font-semibold text-sm hover:bg-red-50 disabled:opacity-50 transition-all">
                    {saving ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button onClick={() => handleSave(true)}
                    disabled={saving || !assignmentId || !review.recommendation || !review.finalComment.trim()}
                    className="w-full py-2.5 rounded-lg bg-[#FF3B3B] text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-all">
                    Submit Final Review
                  </button>
                  {(!review.recommendation || !review.finalComment.trim()) && (
                    <p style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'center' }}>
                      {!review.recommendation ? 'Select a recommendation to submit' : 'Add a final comment to submit'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


